import { App, FuzzySuggestModal, Modal, Notice, TFile, setIcon } from 'obsidian';
import type { PendingContext } from '../AttachmentHandler';
import type { BackendId, ModelOption, PermissionMode } from '../backends/types';
import { PERMISSION_MODES, UnavailableModes, openModePickerPopover } from './PermissionPickerModal';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getElectronDialog } from '../utils/electronUtils';
import { log } from '../utils/logger';
import { modelEffortLevels, nearestLevel } from '../utils/agentModels';
import { renderAgentIcon } from '../agentIcon';
import { AgentModelPickerModal } from './AgentModelPickerModal';

export interface CustomSessionOptions {
  name: string;
  cwd: string;
  initialInstructions: string;
  suppressVaultContext: boolean;
  customAttachments: PendingContext[];
  /** Always set — pre-filled from the global default, editable before submit. */
  permissionMode: PermissionMode;
  /** Always set — pre-filled from the global default, editable before submit. */
  model: string;
  /** `--effort` level pinned for this session. '' = Default (no pin — follows the
   *  global setting). Always '' when the CLI doesn't support effort. */
  effort: string;
  /** Bare Claude Code experience — no BojuBot context injection at all (the
   *  per-session equivalent of global Minimal mode). */
  rawSession: boolean;
  /** Agent CLI the session runs on. */
  backend: BackendId;
}

/** What the form needs to know about one agent backend. */
export interface BackendChoice {
  id: BackendId;
  /** "Claude (Claude Code)" */
  label: string;
  /** "Claude" */
  name: string;
  /** "Claude Code", "Antigravity CLI" */
  cliName: string;
  /** False when the CLI wasn't found — listed, but can't be chosen. */
  installed: boolean;
  models: ModelOption[];
  /** The global default model; '' = the CLI's own default. */
  defaultModel: string;
  /** Levels the CLI lists for --effort. Empty → the effort field is hidden.
   *  A model may offer fewer (ModelOption.effortLevels). */
  effortLevels: readonly string[];
  /** The agent's default effort level; '' = Default. */
  defaultEffort: string;
  unavailableModes: UnavailableModes;
  modeDescriptions: Partial<Record<PermissionMode, string>>;
}

const TEXT_EXTS = new Set([
  'txt', 'md', 'fountain', 'js', 'ts', 'jsx', 'tsx', 'json', 'canvas',
  'css', 'html', 'xml', 'csv', 'yaml', 'yml', 'py', 'rb', 'go', 'rs',
  'java', 'c', 'cpp', 'h', 'sh', 'bat', 'ps1',
]);
const IMAGE_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico',
  'tiff', 'heic', 'heif', 'avif',
]);

export class CustomSessionModal extends Modal {
  private name = '';
  private cwd = '';
  private initialInstructions = '';
  private suppressVaultContext = false;
  private attachments: PendingContext[] = [];
  private attachListEl: HTMLElement | null = null;
  private permissionMode: PermissionMode;
  private model = '';
  private effort = '';
  private rawSession = false;
  private backend: BackendChoice;
  private readonly vaultRoot: string;
  private readonly configDir: string;

  constructor(
    app: App,
    vaultRoot: string,
    configDir: string,
    private readonly backends: BackendChoice[],
    defaultBackend: BackendId,
    defaultPermissionMode: PermissionMode,
    private readonly onSubmit: (opts: CustomSessionOptions) => void,
  ) {
    super(app);
    this.vaultRoot = vaultRoot;
    this.configDir = configDir;
    this.permissionMode = defaultPermissionMode;
    this.backend = backends.find(b => b.id === defaultBackend) ?? backends[0];
    this.applyBackendDefaults();
  }

  /** Model and effort pre-fill from the chosen backend's defaults; a permission
   *  mode it can't enforce falls back to Read only (the safer neighbour). */
  private applyBackendDefaults(): void {
    this.model = this.backend.defaultModel;
    this.effort = this.backend.defaultEffort;
    this.fitEffort();
    if (this.backend.unavailableModes[this.permissionMode]) this.permissionMode = 'readonly';
  }

  /** Effort levels the chosen model offers. */
  private effortLevels(): readonly string[] {
    return modelEffortLevels(this.backend.models, this.model, this.backend.effortLevels);
  }

  /** Keep the effort level one the chosen model has: its nearest, or Default. */
  private fitEffort(): void {
    if (this.effort) this.effort = nearestLevel(this.effort, this.effortLevels()) ?? '';
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('bojubot-param-modal');
    contentEl.createEl('h2', { text: 'New session' });

    const form = contentEl.createEl('form');
    let renderPermissionBtn = () => { /* set by the permission field below */ };
    let renderBackendFields = () => { /* set by the model/effort fields below */ };

    // ── Agent and model (#402) ───────────────────────────────────────────────
    {
      const field = form.createDiv({ cls: 'bojubot-param-field' });
      field.createEl('label', { text: 'Agent and model', cls: 'bojubot-param-label' });
      field.createDiv({ text: 'The agent this session runs on (a session stays on its agent) and its model. Pre-filled from your defaults.', cls: 'bojubot-param-desc' });
      const btn = field.createEl('button', { cls: 'bojubot-param-input bojubot-custom-session-perm-btn', attr: { type: 'button' } });
      const renderBtn = () => {
        btn.empty();
        renderAgentIcon(btn, this.backend.id, 'bojubot-custom-session-perm-btn-icon');
        const modelName = this.model
          ? this.backend.models.find(m => m.id === this.model)?.displayName ?? this.model
          : `${this.backend.cliName} default`;
        btn.createSpan({ cls: 'bojubot-custom-session-perm-btn-label', text: `${this.backend.label} · ${modelName}` });
        setIcon(btn.createSpan({ cls: 'bojubot-custom-session-perm-btn-chevron' }), 'chevron-down');
      };
      renderBtn();
      btn.addEventListener('click', () => {
        new AgentModelPickerModal(this.app, this.backends, { backend: this.backend.id, model: this.model }, (id, model) => {
          if (id !== this.backend.id) {
            this.backend = this.backends.find(b => b.id === id) ?? this.backend;
            this.applyBackendDefaults();
            renderPermissionBtn();
          }
          this.model = model.id;
          this.fitEffort();
          renderBtn();
          renderBackendFields();
        }).open();
      });
    }

    // ── Session name ─────────────────────────────────────────────────────────
    {
      const field = form.createDiv({ cls: 'bojubot-param-field' });
      field.createEl('label', { text: 'Session name', cls: 'bojubot-param-label' });
      field.createDiv({ text: 'Leave blank to use the first message as title', cls: 'bojubot-param-desc' });
      const input = field.createEl('input', {
        cls: 'bojubot-param-input',
        attr: { type: 'text', placeholder: 'E.g. Screenplay review — act 2' },
      });
      input.addEventListener('input', () => { this.name = input.value; });
      window.setTimeout(() => input.focus(), 50);
    }

    // ── Working directory ─────────────────────────────────────────────────────
    {
      const field = form.createDiv({ cls: 'bojubot-param-field' });
      field.createEl('label', { text: 'Working directory (cwd)', cls: 'bojubot-param-label' });
      field.createDiv({ text: 'Absolute path the agent runs in. Leave blank to use vault root.', cls: 'bojubot-param-desc' });
      const row = field.createDiv({ cls: 'bojubot-custom-session-cwd-row' });
      const input = row.createEl('input', {
        cls: 'bojubot-param-input bojubot-custom-session-cwd-input',
        attr: { type: 'text', placeholder: 'E.g. C:\\projects\\my-repo' },
      });
      input.addEventListener('input', () => { this.cwd = input.value; });

      const pickBtn = row.createEl('button', { cls: 'bojubot-custom-session-cwd-btn', attr: { type: 'button' } });
      setIcon(pickBtn, 'folder-open');
      pickBtn.title = 'Browse…';
      pickBtn.addEventListener('click', () => {
        void (async () => {
          const dialog = getElectronDialog();
          if (!dialog) return;
          try {
            const result = await dialog.showOpenDialog({ properties: ['openDirectory'], defaultPath: this.vaultRoot });
            if (!result.canceled && result.filePaths[0]) {
              input.value = result.filePaths[0];
              this.cwd = result.filePaths[0];
            }
          } catch (err) {
            log('error', 'showOpenDialog failed', err);
            new Notice('Could not open folder picker.');
          }
        })();
      });
    }

    // ── Permission mode ────────────────────────────────────────────────────────
    {
      const field = form.createDiv({ cls: 'bojubot-param-field' });
      field.createEl('label', { text: 'Permission mode', cls: 'bojubot-param-label' });
      field.createDiv({ text: 'Applies to this session only. Pre-filled from your global default — change it here to override.', cls: 'bojubot-param-desc' });
      const btn = field.createEl('button', { cls: 'bojubot-param-input bojubot-custom-session-perm-btn', attr: { type: 'button' } });
      const renderBtn = renderPermissionBtn = () => {
        btn.empty();
        const opt = PERMISSION_MODES.find(o => o.mode === this.permissionMode) ?? PERMISSION_MODES[2];
        const iconEl = btn.createSpan({ cls: `bojubot-custom-session-perm-btn-icon ${opt.colorClass}` });
        setIcon(iconEl, opt.icon);
        btn.createSpan({ cls: 'bojubot-custom-session-perm-btn-label', text: opt.label });
        const chevronEl = btn.createSpan({ cls: 'bojubot-custom-session-perm-btn-chevron' });
        setIcon(chevronEl, 'chevron-down');
      };
      renderBtn();
      btn.addEventListener('click', () => {
        openModePickerPopover(btn, this.permissionMode, (mode) => {
          this.permissionMode = mode;
          renderBtn();
        }, { unavailable: this.backend.unavailableModes, descriptions: this.backend.modeDescriptions });
      });
    }

    // ── Effort (rebuilt when the agent or model changes) ──────────────────────
    const backendFieldsEl = form.createDiv();
    renderBackendFields = () => {
      backendFieldsEl.empty();
      const b = this.backend;

      const levels = this.effortLevels();

      // Only when the CLI supports --effort
      if (levels.length > 0) {
        const field = backendFieldsEl.createDiv({ cls: 'bojubot-param-field' });
        field.createEl('label', { text: 'Effort', cls: 'bojubot-param-label' });
        field.createDiv({ text: `How much thinking the model does per turn. Pre-filled from your global default. Default lets ${b.name} decide and follows the global setting.`, cls: 'bojubot-param-desc' });
        const select = field.createEl('select', { cls: 'bojubot-param-input' });
        for (const level of ['', ...levels]) {
          const opt = select.createEl('option', { text: level || 'Default', value: level });
          if (level === this.effort) opt.selected = true;
        }
        select.addEventListener('change', () => { this.effort = select.value; });
      }
    };
    renderBackendFields();

    // ── Raw session ────────────────────────────────────────────────────────────
    {
      const field = form.createDiv({ cls: 'bojubot-param-field' });
      const row = field.createEl('label', { cls: 'bojubot-custom-session-toggle-row' });
      const cb = row.createEl('input', { attr: { type: 'checkbox' } });
      row.createSpan({ text: 'Raw session', cls: 'bojubot-param-label bojubot-custom-session-toggle-label' });
      field.createDiv({ text: 'Bare CLI experience — skips all BojuBot context injection (orientation, vault tree, context file, UI Bridge). The CLI still reads its own instruction files (e.g. CLAUDE.md) from the working directory.', cls: 'bojubot-param-desc' });
      cb.addEventListener('change', () => { this.rawSession = cb.checked; });
    }

    // ── Initial instructions ──────────────────────────────────────────────────
    {
      const field = form.createDiv({ cls: 'bojubot-param-field' });
      field.createEl('label', { text: 'Initial instructions', cls: 'bojubot-param-label' });
      field.createDiv({ text: 'System prompt injected at session start. Leave blank for none.', cls: 'bojubot-param-desc' });
      const ta = field.createEl('textarea', {
        cls: 'bojubot-param-textarea',
        attr: { placeholder: 'E.g. You are reviewing screenplay drafts in this folder. Focus on structure and pacing.' },
      });
      ta.addEventListener('input', () => { this.initialInstructions = ta.value; });
    }

    // ── Vault context toggle ──────────────────────────────────────────────────
    {
      const field = form.createDiv({ cls: 'bojubot-param-field' });
      const row = field.createEl('label', { cls: 'bojubot-custom-session-toggle-row' });
      const cb = row.createEl('input', { attr: { type: 'checkbox' } });
      cb.checked = true;
      row.createSpan({ text: 'Include vault context', cls: 'bojubot-param-label bojubot-custom-session-toggle-label' });
      field.createDiv({ text: 'Vault tree, _Claude-context.md, and pinned notes. Uncheck for focused sessions.', cls: 'bojubot-param-desc' });
      cb.addEventListener('change', () => { this.suppressVaultContext = !cb.checked; });
    }

    // ── Context attachments ───────────────────────────────────────────────────
    {
      const field = form.createDiv({ cls: 'bojubot-param-field' });
      field.createEl('label', { text: 'Context attachments', cls: 'bojubot-param-label' });

      const btnRow = field.createDiv({ cls: 'bojubot-custom-session-attach-btns' });

      const fileBtn = btnRow.createEl('button', { text: '+ file', cls: 'bojubot-custom-session-attach-btn', attr: { type: 'button' } });
      fileBtn.addEventListener('click', () => this.pickFile());

      const noteBtn = btnRow.createEl('button', { text: '+ note', cls: 'bojubot-custom-session-attach-btn', attr: { type: 'button' } });
      noteBtn.addEventListener('click', () => this.pickNote());

      const urlBtn = btnRow.createEl('button', { text: '+ URL', cls: 'bojubot-custom-session-attach-btn', attr: { type: 'button' } });
      urlBtn.addEventListener('click', () => this.promptUrl(field));

      this.attachListEl = field.createDiv({ cls: 'bojubot-custom-session-attach-list' });
      this.renderAttachments();
    }

    // ── Buttons ───────────────────────────────────────────────────────────────
    const btnRow = form.createDiv({ cls: 'bojubot-param-btn-row' });
    btnRow.createEl('button', { text: 'Cancel', attr: { type: 'button' } })
      .addEventListener('click', () => this.close());
    btnRow.createEl('button', { text: 'Start session', cls: 'mod-cta', attr: { type: 'submit' } });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.close();
      this.onSubmit({
        name: this.name.trim(),
        cwd: this.cwd.trim(),
        initialInstructions: this.initialInstructions.trim(),
        suppressVaultContext: this.suppressVaultContext,
        customAttachments: this.attachments,
        permissionMode: this.permissionMode,
        model: this.model,
        effort: this.effort,
        rawSession: this.rawSession,
        backend: this.backend.id,
      });
    });

    // Enter submits, Escape closes
    contentEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    });
  }

  onClose() {
    this.contentEl.empty();
  }

  // ── Attachment helpers ────────────────────────────────────────────────────

  private pickFile(): void {
    const input = createEl('input');
    input.type = 'file';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      if (IMAGE_EXTS.has(ext) || ext === 'pdf') {
        const filePath = this.saveBinaryToTmp(f.name, await f.arrayBuffer());
        const type = IMAGE_EXTS.has(ext) ? 'image' : 'pdf';
        this.attachments.push({ text: filePath, source: f.name, pinned: false, type });
      } else {
        const text = TEXT_EXTS.has(ext) ? await f.text() : f.name;
        this.attachments.push({ text, source: f.name, pinned: false });
      }
      this.renderAttachments();
    };
    input.click();
  }

  private pickNote(): void {
    new NotePicker(this.app, async (file) => {
      const content = await this.app.vault.read(file);
      this.attachments.push({ text: content, source: file.basename, pinned: false });
      this.renderAttachments();
    }).open();
  }

  private promptUrl(container: HTMLElement): void {
    // Inline URL input that appears below the buttons
    const existing = container.querySelector('.bojubot-custom-session-url-row');
    if (existing) { (existing as HTMLElement).focus(); return; }

    const row = container.createDiv({ cls: 'bojubot-custom-session-url-row' });
    const input = row.createEl('input', {
      cls: 'bojubot-param-input',
      attr: { type: 'text', placeholder: 'HTTPS://…' },
    });
    const addBtn = row.createEl('button', { text: 'Add', cls: 'mod-cta', attr: { type: 'button' } });
    const addUrl = () => {
      const url = input.value.trim();
      if (!url) return;
      const label = url.replace(/^https?:\/\//, '').split('/')[0];
      this.attachments.push({ text: url, source: label, pinned: false, type: 'url' });
      row.remove();
      this.renderAttachments();
    };
    addBtn.addEventListener('click', addUrl);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } });

    // Insert before the attach list
    if (this.attachListEl) container.insertBefore(row, this.attachListEl);
    window.setTimeout(() => input.focus(), 20);
  }

  private renderAttachments(): void {
    const el = this.attachListEl;
    if (!el) return;
    el.empty();
    for (const ctx of this.attachments) {
      const row = el.createDiv({ cls: 'bojubot-custom-session-attach-row' });
      const iconEl = row.createSpan({ cls: 'bojubot-pending-context-icon' });
      setIcon(iconEl, ctx.type === 'image' ? 'image' : ctx.type === 'pdf' ? 'file-text' : ctx.type === 'url' ? 'link' : 'paperclip');
      row.createSpan({ cls: 'bojubot-pending-context-label', text: ctx.source });
      const removeBtn = row.createEl('button', { cls: 'bojubot-context-clear', text: '×', attr: { type: 'button' } });
      removeBtn.title = 'Remove';
      removeBtn.addEventListener('click', () => {
        this.attachments.splice(this.attachments.indexOf(ctx), 1);
        this.renderAttachments();
      });
    }
  }

  private saveBinaryToTmp(filename: string, data: ArrayBuffer): string {
    const tmpDir = join(this.vaultRoot, this.configDir, 'plugins', 'bojubot', 'tmp');
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    const filePath = join(tmpDir, `${Date.now()}-${filename}`);
    writeFileSync(filePath, Buffer.from(data));
    return filePath;
  }
}

class NotePicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, private onChoose: (file: TFile) => Promise<void>) {
    super(app);
    this.setPlaceholder('Pick a note…');
  }
  getItems(): TFile[] { return this.app.vault.getMarkdownFiles(); }
  getItemText(file: TFile): string { return file.path; }
  onChooseItem(file: TFile) { void this.onChoose(file); }
}
