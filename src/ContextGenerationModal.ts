import { App, FuzzySuggestModal, Modal, Notice, TFile } from 'obsidian';
import type BojuBotPlugin from '../main';
import { spawnClaude, parseStreamOutput } from './ClaudeProcess';
import { buildVaultTree } from './utils/fileTree';
import { log } from './utils/logger';
import { existsSync, readdirSync } from 'fs';
import { join, isAbsolute } from 'path';

export class ContextGenerationModal extends Modal {
  private plugin: BojuBotPlugin;
  private contextFilePath: string;
  private binaryPath: string;
  private vaultRoot: string;
  private env: Record<string, string>;
  private vaultTreeDepth: number;

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

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });

    const generateBtn = btnRow.createEl('button', {
      text: 'Generate with Claude',
      cls: 'mod-cta',
    });
    generateBtn.addEventListener('click', () => {
      this.close();
      new UserIntroModal(this.app, (intro, contextFiles) => {
        this.generateContextFile(intro, contextFiles);
      }).open();
    });

    const blankBtn = btnRow.createEl('button', { text: 'Create blank template' });
    blankBtn.addEventListener('click', () => {
      this.close();
      void this.createBlankTemplate();
    });

    const skipBtn = btnRow.createEl('button', { text: 'Skip' });
    skipBtn.addEventListener('click', () => {
      this.plugin.settings.skipContextFilePrompt = true;
      void this.plugin.saveSettings().then(() => { this.close(); });
    });
  }

  onClose() {
    this.contentEl.empty();
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

  private generateContextFile(userIntro: string, contextFiles: string[] = []) {
    new Notice('BojuBot: generating context file in the background…');
    log('ContextGenerationModal: spawning background generation');

    const tree = buildVaultTree(this.app.vault, this.vaultTreeDepth);
    const treeSection = tree
      ? `Here is the current vault structure (folder and file names only — no file contents):\n\`\`\`\n${tree}\n\`\`\``
      : 'The vault structure is not available — please explore with your file tools.';

    const skills = this.listSkills();
    const skillsSection = skills.length > 0
      ? `\nThe user has the following BojuBot skills available:\n${skills.map(s => `- ${s}`).join('\n')}\nInclude a brief "## Available Skills" section listing these.`
      : '';

    const introSection = userIntro.trim()
      ? `\nThe user has shared the following about themselves and how they use this vault:\n"${userIntro.trim()}"\nUse this to personalise the context file where relevant.`
      : '';

    const contextFilesSection = contextFiles.length > 0
      ? `\nThe user has provided the following files as additional context. Read each of them before writing the context file — they contain relevant background information about the project, conventions, or prior work:\n${contextFiles.map(p => `- ${join(this.vaultRoot, p)}`).join('\n')}`
      : '';

    const today = new Date().toISOString().slice(0, 10);

    const prompt = [
      `You are setting up a context file for a new BojuBot (Obsidian plugin) user.`,
      ``,
      `${treeSection}`,
      `${introSection}`,
      `${contextFilesSection}`,
      `${skillsSection}`,
      ``,
      `Please create the file \`${this.contextFilePath}\` in the vault root.`,
      `This file will be injected at the start of every BojuBot session as your persistent memory.`,
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

    const proc = spawnClaude({
      binaryPath: this.binaryPath,
      prompt,
      vaultRoot: this.vaultRoot,
      env: this.env,
    });

    parseStreamOutput(proc, {
      onText: () => { /* background — discard streaming text */ },
      onAction: () => { /* background — discard UI actions */ },
      onToolCall: (tool) => { log('ContextGenerationModal: tool call:', tool); },
      onPermissionDenied: () => { /* background generation — denials not surfaced */ },
      onUsage: () => { /* background generation — usage not surfaced */ },
      onDone: () => {
        const exists = this.app.vault.getFileByPath(this.contextFilePath);
        if (exists) {
          new Notice(`BojuBot: context file created at "${this.contextFilePath}". Open it in Obsidian to review and edit.`);
        } else {
          new Notice(`BojuBot: generation finished but "${this.contextFilePath}" was not found. You may need to create it manually.`);
        }
      },
      onError: (err) => {
        log('ContextGenerationModal: error:', err);
        new Notice('BojuBot: context file generation encountered an error. Check the debug log.');
      },
    });
  }

  private async createBlankTemplate() {
    const today = new Date().toISOString().slice(0, 10);
    const stub = [
      '# Vault Context',
      '',
      'This file is injected at the start of every BojuBot session as Claude\'s persistent memory.',
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
      await this.app.vault.create(this.contextFilePath, stub);
      new Notice(`BojuBot: created blank context file at "${this.contextFilePath}".`);
    } catch (err) {
      log('ContextGenerationModal: failed to create blank template:', err);
      new Notice('BojuBot: failed to create context file. Check the debug log.');
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

    setTimeout(() => ta.focus(), 50);
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
