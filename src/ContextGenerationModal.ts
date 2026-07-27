import { App, FuzzySuggestModal, Modal, Notice, TFile } from 'obsidian';
import type BojuBotPlugin from '../main';
import { spawnClaude, parseStreamOutput, killProcess } from './ClaudeProcess';
import { ContextManager } from './ContextManager';
import { VIEW_TYPE_CLAUDE } from './ClaudeView';
import { log } from './utils/logger';
import { brandName } from './brand';
import { existsSync, readdirSync } from 'fs';
import { join, isAbsolute } from 'path';

/**
 * Blocks the user from starting a chat session while the background context-file
 * generation is in flight — starting one earlier would race with it (the new
 * session's context injection would run before the file exists) and was part of
 * the concurrent-process incident in #287. Not dismissible via Escape/outside-click
 * while generation is running; only Cancel or completion closes it for real.
 */
class ContextGenerationProgressModal extends Modal {
  private settled = false;
  private statusEl!: HTMLElement;

  constructor(app: App, private onCancel: () => void) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText('Generating your context file…');
    const { contentEl } = this;
    contentEl.createEl('p', {
      text: `Your ${brandName()} session will start up momentarily, please wait.`,
    });
    this.statusEl = contentEl.createEl('p', { cls: 'bojubot-status', text: 'Thinking…' });
    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    const cancelBtn = btnRow.createEl('button', { text: 'Cancel generation', cls: 'mod-warning' });
    cancelBtn.addEventListener('click', () => {
      this.settled = true;
      this.onCancel();
      this.close();
    });
  }

  /** Reflect real tool activity so it's obvious the process hasn't hung. */
  updateStatus(text: string) {
    this.statusEl?.setText(text);
  }

  /** Call when generation finishes (success or error) to allow the modal to actually close. */
  finish() {
    this.settled = true;
    this.close();
  }

  onClose() {
    this.contentEl.empty();
    if (!this.settled) {
      // Generation is still running and the user tried to dismiss via Escape or
      // clicking outside — reopen immediately rather than letting them proceed.
      activeWindow.setTimeout(() => this.open(), 0);
    }
  }
}

/** Friendly status text for the progress modal, based on which tool Claude is using. */
function statusForTool(tool: string): string {
  switch (tool) {
    case 'Read':
    case 'Glob':
    case 'Grep':
      return 'Scanning vault…';
    case 'Write':
    case 'Edit':
      return 'Writing your context file…';
    case 'ToolSearch':
      return 'Loading tools…';
    default:
      return 'Thinking…';
  }
}

export class ContextGenerationModal extends Modal {
  private plugin: BojuBotPlugin;
  private contextFilePath: string;
  private binaryPath: string;
  private vaultRoot: string;
  private env: Record<string, string>;
  private vaultTreeDepth: number;
  private settled = false;

  constructor(
    app: App,
    plugin: BojuBotPlugin,
    contextFilePath: string,
    binaryPath: string,
    vaultRoot: string,
    env: Record<string, string>,
    vaultTreeDepth: number,
  ) {
    super(app);
    this.plugin = plugin;
    this.contextFilePath = contextFilePath;
    this.binaryPath = binaryPath;
    this.vaultRoot = vaultRoot;
    this.env = env;
    this.vaultTreeDepth = vaultTreeDepth;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Set up your context file' });
    contentEl.createEl('p', {
      text: `No context file was found at "${this.contextFilePath}". ` +
        'This file gives Claude persistent memory of your vault across sessions. ' +
        'You can have Claude generate one from your vault structure, start with a blank template, or skip for now.',
    });

    // The explicit X button is a deliberate "not now" — unlike an accidental Escape
    // or outside-click, which reopens this prompt (see onClose()), close the whole
    // BojuBot panel too instead of leaving it sitting there unconfigured. Attached
    // with `capture: true` so it runs before Obsidian's own close-button handler —
    // that handler calls this.close() synchronously, and onClose() needs `settled`
    // already true by then or it'll reopen this same modal.
    this.modalEl.querySelector('.modal-close-button')?.addEventListener('click', () => {
      this.settled = true;
      this.app.workspace.detachLeavesOfType(VIEW_TYPE_CLAUDE);
    }, { capture: true });

    const checkboxRow = contentEl.createDiv({ cls: 'bojubot-checkbox-row' });
    const openAfterCheckbox = checkboxRow.createEl('input', {
      attr: { type: 'checkbox', id: 'bojubot-open-context-after' },
    });
    openAfterCheckbox.checked = false;
    checkboxRow.createEl('label', {
      text: 'Open context file after creation',
      attr: { for: 'bojubot-open-context-after' },
    });

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });

    const generateBtn = btnRow.createEl('button', {
      text: 'Generate with Claude',
      cls: 'mod-cta',
    });
    generateBtn.addEventListener('click', () => {
      this.settled = true;
      const openAfter = openAfterCheckbox.checked;
      this.close();
      new UserIntroModal(this.app, (intro, contextFiles) => {
        void this.generateContextFile(intro, contextFiles, openAfter);
      }).open();
    });

    const blankBtn = btnRow.createEl('button', { text: 'Create blank template' });
    blankBtn.addEventListener('click', () => {
      this.settled = true;
      const openAfter = openAfterCheckbox.checked;
      this.close();
      void this.createBlankTemplate(openAfter);
    });

    const skipBtn = btnRow.createEl('button', { text: 'Skip' });
    skipBtn.addEventListener('click', () => {
      this.settled = true;
      this.plugin.settings.skipContextFilePrompt = true;
      void this.plugin.saveSettings().then(() => { this.close(); });
    });
  }

  onClose() {
    this.contentEl.empty();
    if (!this.settled) {
      // Easy to fat-finger away via Escape or an outside click before even reading
      // it — reopen instead of silently losing the offer to set up a context file.
      activeWindow.setTimeout(() => this.open(), 0);
    }
  }

  /** Re-show this same setup prompt — used when the user cancels generation partway through. */
  reopen(): void {
    this.settled = false;
    this.open();
  }

  private resolveSkillsFolder(): string {
    const custom = this.plugin.settings.commandsFolder;
    if (custom?.trim()) {
      const p = custom.trim();
      return isAbsolute(p) ? p : join(this.vaultRoot, p);
    }
    return join(this.vaultRoot, this.plugin.manifest.dir, 'commands');
  }

  private listSkills(): string[] {
    try {
      const folder = this.resolveSkillsFolder();
      if (!existsSync(folder)) return [];
      return readdirSync(folder)
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace(/\.md$/, ''));
    } catch {
      return [];
    }
  }

  private async generateContextFile(userIntro: string, contextFiles: string[] = [], openAfter: boolean = false) {
    log('ContextGenerationModal: spawning background generation');

    // Reuse the same session-start context injection every normal session gets
    // (orientation — including the "ignore additional working directories"
    // boundary — vault tree at the configured depth, pinned notes, per-file
    // instructions) instead of a separate hand-rolled prompt. Keeps this path in
    // sync with fixes made to ContextManager instead of silently drifting out of
    // date, and respects the user's actual settings (tree depth, autonomous
    // memory, command allowlist) rather than re-deciding them here.
    // Permission mode is forced to 'standard' regardless of the user's configured
    // default — generation always needs write access to create the file.
    const ctx = new ContextManager(
      this.app,
      this.contextFilePath,
      this.plugin.settings.autonomousMemory,
      this.vaultTreeDepth,
      this.plugin.settings.commandAllowlist,
      'standard',
      this.plugin.settings.contextFileSizeCapTokens,
      false,
      false,
      '',
      this.vaultRoot,
      this.vaultRoot,
    );
    const sessionContext = await ctx.buildSessionContext();

    const skills = this.listSkills();
    const skillsSection = skills.length > 0
      ? `\nThe user has the following ${brandName()} skills available:\n${skills.map(s => `- ${s}`).join('\n')}\nInclude a brief "## Available Skills" section listing these.`
      : '';

    const introSection = userIntro.trim()
      ? `\nThe user has shared the following about themselves and how they use this vault:\n"${userIntro.trim()}"\nUse this to personalise the context file where relevant.`
      : '';

    const contextFilesSection = contextFiles.length > 0
      ? `\nThe user has provided the following files as additional context. Read each of them before writing the context file — they contain relevant background information about the project, conventions, or prior work:\n${contextFiles.map(p => `- ${join(this.vaultRoot, p)}`).join('\n')}`
      : '';

    const today = new Date().toISOString().slice(0, 10);

    const instructions = [
      `You are setting up a context file for a new ${brandName()} (Obsidian plugin) user.`,
      ``,
      `${introSection}`,
      `${contextFilesSection}`,
      `${skillsSection}`,
      ``,
      `Please create the file \`${this.contextFilePath}\` in the vault root.`,
      `This file will be injected at the start of every ${brandName()} session as your persistent memory.`,
      ``,
      `Generate a concise, useful context file (aim for under 300 words) that includes:`,
      `- A brief summary of the vault's organisation based on the folder structure`,
      `- Inferred naming conventions and folder purposes`,
      `- Any obvious ongoing projects or focus areas you can detect from folder/file names`,
      `- A short "## Notes for Claude" section with placeholder text the user can customise`,
      `${skillsSection ? '- A "## Available Skills" section listing the skills above' : ''}`,
      `- A footer line: "_Last updated: ${today}_"`,
      ``,
      `Write the file now using your file tools. Do not ask for confirmation — just create it.`,
    ].join('\n');

    const prompt = sessionContext ? `${sessionContext}\n\n${instructions}` : instructions;

    const proc = spawnClaude({
      binaryPath: this.binaryPath,
      prompt,
      vaultRoot: this.vaultRoot,
      env: this.env,
      permissionMode: 'standard',
    });

    let cancelled = false;
    const progressModal = new ContextGenerationProgressModal(this.app, () => {
      log('ContextGenerationModal: generation cancelled by user');
      cancelled = true;
      killProcess(proc);
      new Notice(`${brandName()}: context file generation cancelled.`);
      // Re-show the original setup prompt so the user can choose again
      // (generate, blank template, or skip) instead of being left with nothing.
      this.reopen();
    });
    progressModal.open();

    parseStreamOutput(proc, {
      onText: () => { /* background — discard streaming text */ },
      onAction: () => { /* background — discard UI actions */ },
      onToolCall: (tool) => {
        log('ContextGenerationModal: tool call:', tool);
        progressModal.updateStatus(statusForTool(tool));
      },
      onPermissionDenied: () => { /* background generation — denials not surfaced */ },
      onUsage: () => { /* background generation — usage not surfaced */ },
      onDone: () => {
        progressModal.finish();
        // Killing the process still fires this via the stream's close event —
        // the cancel callback above already gave the user a notice, don't pile on.
        if (cancelled) return;
        const exists = this.app.vault.getFileByPath(this.contextFilePath);
        if (exists) {
          if (openAfter) {
            void this.app.workspace.getLeaf(false).openFile(exists);
            new Notice(`${brandName()}: context file created at "${this.contextFilePath}".`);
          } else {
            new Notice(`${brandName()}: context file created at "${this.contextFilePath}". Open it in Obsidian to review and edit.`);
          }
        } else {
          new Notice(`${brandName()}: generation finished but "${this.contextFilePath}" was not found. You may need to create it manually.`);
        }
      },
      onError: (err) => {
        log('ContextGenerationModal: error:', err);
        if (cancelled) return;
        new Notice(`${brandName()}: context file generation encountered an error. Check the debug log.`);
      },
    });
  }

  private async createBlankTemplate(openAfter: boolean) {
    const today = new Date().toISOString().slice(0, 10);
    const stub = [
      '# Vault Context',
      '',
      `This file is injected at the start of every ${brandName()} session as Claude's persistent memory.`,
      'Edit it freely — add conventions, ongoing projects, folder explanations, or anything useful.',
      '',
      '## Conventions',
      '<!-- e.g. Meeting notes go in 02_Calendar/YYYY-MM-DD format -->',
      '',
      '## Current focus',
      '<!-- e.g. Working on Q2 planning. Key notes: [[Goals]], [[Team Roster]] -->',
      '',
      '## Notes for Claude',
      '<!-- e.g. Prefer concise bullet-point summaries. Always ask before deleting files. -->',
      '',
      `_Last updated: ${today}_`,
    ].join('\n');

    try {
      const file = await this.app.vault.create(this.contextFilePath, stub);
      new Notice(`${brandName()}: created blank context file at "${this.contextFilePath}".`);
      if (openAfter) await this.app.workspace.getLeaf(false).openFile(file);
    } catch (err) {
      log('ContextGenerationModal: failed to create blank template:', err);
      new Notice(`${brandName()}: failed to create context file. Check the debug log.`);
    }
  }
}

/**
 * Second-step modal shown after "Generate with Claude" is selected.
 * Collects an optional self-description and optional additional context files,
 * then calls back with both.
 */
class UserIntroModal extends Modal {
  private selectedFiles = new Map<string, string>(); // path → display name
  private chipsEl!: HTMLElement;
  private onSubmit: (intro: string, contextFiles: string[]) => void;

  constructor(app: App, onSubmit: (intro: string, contextFiles: string[]) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('bojubot-intro-modal');
    contentEl.createEl('h2', { text: 'About you and your vault' });
    contentEl.createEl('p', {
      text: 'Help Claude generate a more personalised context file. ' +
        'Tell it a little about yourself and how you use this vault.',
    });

    const ta = contentEl.createEl('textarea', { cls: 'bojubot-intro-textarea' });
    ta.placeholder = '(Optional) e.g. I\'m a screenwriter using this vault for research and script development.';
    ta.rows = 4;

    // ── Additional context files (optional) ──────────────────────────────
    const filesSection = contentEl.createDiv({ cls: 'bojubot-intro-files-section' });
    filesSection.createEl('div', {
      text: 'Additional context files (optional)',
      cls: 'bojubot-intro-files-label',
    });
    filesSection.createEl('div', {
      text: 'Add any files Claude should read before generating — e.g. An existing Claude.md, project notes, or style guides.',
      cls: 'bojubot-intro-files-desc',
    });

    this.chipsEl = filesSection.createDiv({ cls: 'bojubot-intro-chips' });

    const addBtn = filesSection.createEl('button', {
      text: '+ add file',
      cls: 'bojubot-intro-add-btn',
    });
    addBtn.addEventListener('click', () => {
      new ContextFilePicker(this.app, (file) => {
        if (!this.selectedFiles.has(file.path)) {
          this.selectedFiles.set(file.path, file.basename);
          this.renderChips();
        }
      }).open();
    });

    // ── Buttons ──────────────────────────────────────────────────────────
    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });

    const okBtn = btnRow.createEl('button', { text: 'Generate', cls: 'mod-cta' });
    okBtn.addEventListener('click', () => {
      const intro = ta.value.trim() === '(optional)' ? '' : ta.value.trim();
      const files = [...this.selectedFiles.keys()];
      this.close();
      this.onSubmit(intro, files);
    });

    const cancelBtn = btnRow.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.close());

    activeWindow.setTimeout(() => ta.focus(), 50);
  }

  private renderChips() {
    this.chipsEl.empty();
    for (const [path, name] of this.selectedFiles) {
      const chip = this.chipsEl.createDiv({ cls: 'bojubot-intro-chip' });
      chip.createSpan({ text: name, cls: 'bojubot-intro-chip-name' });
      const remove = chip.createSpan({ text: '×', cls: 'bojubot-intro-chip-remove' });
      remove.addEventListener('click', () => {
        this.selectedFiles.delete(path);
        this.renderChips();
      });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

/** Fuzzy vault-file picker for the UserIntroModal context file selector. */
class ContextFilePicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, private onChoose: (file: TFile) => void) {
    super(app);
    this.setPlaceholder('Pick a file to include as context…');
  }

  getItems(): TFile[] {
    return this.app.vault.getFiles();
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile) {
    this.onChoose(file);
  }
}
