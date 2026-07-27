import { App, FuzzySuggestModal, Modal, Notice, TFile, setIcon } from 'obsidian';
import type { PendingContext } from '../AttachmentHandler';
import type { PermissionMode } from '../ClaudeProcess';
import type { ClaudeModel } from '../settings';
import { PERMISSION_MODES, openModePickerPopover } from './PermissionPickerModal';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getElectronDialog } from '../utils/electronUtils';
import { log } from '../utils/logger';

export interface PrimeSessionOptions {
  name: string;
  cwd: string;
  initialInstructions: string;
  suppressVaultContext: boolean;
  primeAttachments: PendingContext[];
  /** Always set — pre-filled from the global default, editable before submit. */
  permissionMode: PermissionMode;
  /** Always set — pre-filled from the global default, editable before submit. */
  model: string;
  /** Bare Claude Code experience — no BojuBot context injection at all (the
   *  per-session equivalent of global Minimal mode). */
  rawSession: boolean;
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

export class PrimeSessionModal extends Modal {
  private name = '';
  private cwd = '';
  private initialInstructions = '';
  private suppressVaultContext = false;
  private attachments: PendingContext[] = [];
  private attachListEl: HTMLElement | null = null;
  private permissionMode: PermissionMode;
  private model: string;
  private rawSession = false;
  private readonly vaultRoot: string;
  private readonly configDir: string;

  constructor(
    app: App,
    vaultRoot: string,
    configDir: string,
    private readonly allModels: ClaudeModel[],
    defaultPermissionMode: PermissionMode,
    defaultModel: string,
    private readonly onSubmit: (opts: PrimeSessionOptions) => void,
  ) {
    super(app);
    this.vaultRoot = vaultRoot;
    this.configDir = configDir;
    this.permissionMode = defaultPermissionMode;
    this.model = defaultModel;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('bojubot-param-modal');
    contentEl.createEl('h2', { text: 'New session' });

    const form = contentEl.createEl('form');

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
      field.createDiv({ text: 'Absolute path Claude runs in. Leave blank to use vault root.', cls: 'bojubot-param-desc' });
      const row = field.createDiv({ cls: 'bojubot-prime-cwd-row' });
      const input = row.createEl('input', {
        cls: 'bojubot-param-input bojubot-prime-cwd-input',
        attr: { type: 'text', placeholder: 'E.g. C:\\projects\\my-repo' },
      });
      input.addEventListener('input', () => { this.cwd = input.value; });

      const pickBtn = row.createEl('button', { cls: 'bojubot-prime-cwd-btn', attr: { type: 'button' } });
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
      const btn = field.createEl('button', { cls: 'bojubot-param-input bojubot-prime-perm-btn', attr: { type: 'button' } });
      const renderBtn = () => {
        btn.empty();
        const opt = PERMISSION_MODES.find(o => o.mode === this.permissionMode) ?? PERMISSION_MODES[2];
        const iconEl = btn.createSpan({ cls: `bojubot-prime-perm-btn-icon ${opt.colorClass}` });
        setIcon(iconEl, opt.icon);
        btn.createSpan({ cls: 'bojubot-prime-perm-btn-label', text: opt.label });
        const chevronEl = btn.createSpan({ cls: 'bojubot-prime-perm-btn-chevron' });
        setIcon(chevronEl, 'chevron-down');
      };
      renderBtn();
      btn.addEventListener('click', () => {
        openModePickerPopover(btn, this.permissionMode, (mode) => {
          this.permissionMode = mode;
          renderBtn();
        });
      });
    }

    // ── Model ──────────────────────────────────────────────────────────────────
    {
      const field = form.createDiv({ cls: 'bojubot-param-field' });
      field.createEl('label', { text: 'Model', cls: 'bojubot-param-label' });
      field.createDiv({ text: 'Applies to this session only. Pre-filled from your global default — change it here to override.', cls: 'bojubot-param-desc' });
      const select = field.createEl('select', { cls: 'bojubot-param-input' });
      for (const m of this.allModels) {
        const opt = select.createEl('option', { text: m.displayName, value: m.id });
        if (m.id === this.model) opt.selected = true;
      }
      select.addEventListener('change', () => { this.model = select.value; });
    }

    // ── Raw session ────────────────────────────────────────────────────────────
    {
      const field = form.createDiv({ cls: 'bojubot-param-field' });
      const row = field.createEl('label', { cls: 'bojubot-prime-toggle-row' });
      const cb = row.createEl('input', { attr: { type: 'checkbox' } });
      row.createSpan({ text: 'Raw Claude Code session', cls: 'bojubot-param-label bojubot-prime-toggle-label' });
      field.createDiv({ text: 'Bare CLI experience — skips all BojuBot context injection (orientation, vault tree, context file, UI Bridge). Claude Code still reads CLAUDE.md from the working directory on its own.', cls: 'bojubot-param-desc' });
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
      const row = field.createEl('label', { cls: 'bojubot-prime-toggle-row' });
      const cb = row.createEl('input', { attr: { type: 'checkbox' } });
      cb.checked = true;
      row.createSpan({ text: 'Include vault context', cls: 'bojubot-param-label bojubot-prime-toggle-label' });
      field.createDiv({ text: 'Vault tree, _Claude-context.md, and pinned notes. Uncheck for focused sessions.', cls: 'bojubot-param-desc' });
      cb.addEventListener('change', () => { this.suppressVaultContext = !cb.checked; });
    }

    // ── Context attachments ───────────────────────────────────────────────────
    {
      const field = form.createDiv({ cls: 'bojubot-param-field' });
      field.createEl('label', { text: 'Context attachments', cls: 'bojubot-param-label' });

      const btnRow = field.createDiv({ cls: 'bojubot-prime-attach-btns' });

      const fileBtn = btnRow.createEl('button', { text: '+ file', cls: 'bojubot-prime-attach-btn', attr: { type: 'button' } });
      fileBtn.addEventListener('click', () => this.pickFile());

      const noteBtn = btnRow.createEl('button', { text: '+ note', cls: 'bojubot-prime-attach-btn', attr: { type: 'button' } });
      noteBtn.addEventListener('click', () => this.pickNote());

      const urlBtn = btnRow.createEl('button', { text: '+ URL', cls: 'bojubot-prime-attach-btn', attr: { type: 'button' } });
      urlBtn.addEventListener('click', () => this.promptUrl(field));

      this.attachListEl = field.createDiv({ cls: 'bojubot-prime-attach-list' });
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
        primeAttachments: this.attachments,
        permissionMode: this.permissionMode,
        model: this.model,
        rawSession: this.rawSession,
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
    const existing = container.querySelector('.bojubot-prime-url-row');
    if (existing) { (existing as HTMLElement).focus(); return; }

    const row = container.createDiv({ cls: 'bojubot-prime-url-row' });
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
      const row = el.createDiv({ cls: 'bojubot-prime-attach-row' });
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
