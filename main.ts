import { Plugin, Notice, addIcon } from 'obsidian';
import { writeFileSync, existsSync, readdirSync } from 'fs';
import { join, isAbsolute } from 'path';
import { ClaudeView, VIEW_TYPE_CLAUDE } from './src/ClaudeView';
import { ObsidiBotSettings, DEFAULT_SETTINGS, ObsidiBotSettingsTab } from './src/settings';
import { findClaudeBinary } from './src/ClaudeProcess';
import { resolveShellEnv } from './src/utils/shellEnv';
import { initLogger, log, warn } from './src/utils/logger';
import { AboutModal } from './src/modals/AboutModal';
import { MemoryAuditModal } from './src/modals/MemoryAuditModal';
import { ContextGenerationModal } from './src/ContextGenerationModal';

/** Minimal shape of Obsidian's private settings/commands APIs. */
interface AppInternal {
  setting: { open(): void; openTabById(id: string): void };
  commands: {
    commands: Record<string, { id: string; name: string }>;
    removeCommand(id: string): void;
  };
}

export default class ObsidiBotPlugin extends Plugin {
  settings: ObsidiBotSettings;
  shellEnv: Record<string, string> = {};
  claudeBinaryPath: string | null = null;
  private skillCommandIds = new Set<string>();

  getVaultRoot(): string {
    return (this.app.vault.adapter as unknown as { basePath: string }).basePath;
  }

  async onload() {
    await this.loadSettings();

    if (this.settings.permissionMode === 'full' && !this.settings.persistFullAccess) {
      this.settings.permissionMode = 'standard';
      await this.saveSettings();
    }

    const vaultRoot = this.getVaultRoot();
    initLogger(vaultRoot, {
      enabled: this.settings.logEnabled,
      filePath: this.settings.logFilePath,
      verbosity: this.settings.logVerbosity,
    });
    log('ObsidiBot loading — vault root:', vaultRoot);

    this.app.workspace.onLayoutReady(() => {
      this.generateCommandsFile();
      this.reloadSkillCommands();
    });

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file.path !== this.settings.contextFilePath) return;
        if (this.app.workspace.getActiveFile()?.path === file.path) return;
        this.showMemoryUpdateNotice();
      })
    );

    void resolveShellEnv().then(env => { this.shellEnv = env; });
    this.claudeBinaryPath = findClaudeBinary(this.settings.binaryPath);

    if (!this.claudeBinaryPath) {
      new Notice('ObsidiBot: Claude binary not found. Check plugin settings.');
    }

    // Register custom icon — three S-curves suggesting obsidibot folds (gyri).
    // Replace the path data here when the final logo SVG is ready.
    addIcon('obsidibot', `
      <path d="M10,32 C24,12 38,12 50,32 C62,52 76,52 90,32"
            stroke="currentColor" fill="none" stroke-width="8" stroke-linecap="round"/>
      <path d="M10,50 C24,30 38,30 50,50 C62,70 76,70 90,50"
            stroke="currentColor" fill="none" stroke-width="8" stroke-linecap="round"/>
      <path d="M10,68 C24,48 38,48 50,68 C62,88 76,88 90,68"
            stroke="currentColor" fill="none" stroke-width="8" stroke-linecap="round"/>
    `);

    this.registerView(VIEW_TYPE_CLAUDE, (leaf) => new ClaudeView(leaf, this));

    this.addRibbonIcon('brain-circuit', 'Open ObsidiBot agent', () => {
      void this.activateView();
    });

    this.addCommand({
      id: 'open-agent',
      name: 'Open agent panel',
      callback: () => {
        void this.activateView();
      }
    });

    this.addCommand({
      id: 'open-settings',
      name: 'Open settings',
      callback: () => {
        (this.app as unknown as AppInternal).setting.open();
        (this.app as unknown as AppInternal).setting.openTabById('obsidibot');
      }
    });

    this.addCommand({
      id: 'new-session',
      name: 'New session',
      callback: () => {
        this.newSession();
      }
    });

    this.addCommand({
      id: 'clear-session',
      name: 'Clear current session',
      callback: () => {
        this.clearCurrentSession();
      }
    });

    this.addCommand({
      id: 'toggle-panel',
      name: 'Toggle panel',
      callback: () => {
        this.togglePanel();
      }
    });

    this.addCommand({
      id: 'show-session-history',
      name: 'Show session history',
      callback: () => {
        this.showSessionHistory();
      }
    });

    this.addCommand({
      id: 'export-conversation',
      name: 'Export conversation',
      callback: () => {
        this.exportConversation();
      }
    });

    this.addCommand({
      id: 'export-to-vault',
      name: 'Export session to vault',
      callback: () => {
        this.exportToVault();
      }
    });

    this.addCommand({
      id: 'copy-last-response',
      name: 'Copy last response',
      callback: () => {
        this.copyLastResponse();
      }
    });

    this.addCommand({
      id: 'send-selection',
      name: 'Send selection as context',
      editorCallback: (editor) => {
        const selection = editor.getSelection();
        if (!selection) {
          new Notice('No text selected');
          return;
        }
        const file = this.app.workspace.getActiveFile();
        const sourceName = file?.basename ?? 'note';
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
        if (existing.length) {
          void this.app.workspace.revealLeaf(existing[0]);
          (existing[0].view as ClaudeView).injectSelectionContext(selection, sourceName);
        } else {
          void this.activateView().then(() => {
            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
            if (leaves.length) (leaves[0].view as ClaudeView).injectSelectionContext(selection, sourceName);
          });
        }
      }
    });

    this.addCommand({
      id: 'focus-input',
      name: 'Focus chat input',
      callback: () => {
        this.focusChatInput();
      }
    });

    this.addCommand({
      id: 'open-context-file',
      name: 'Open context file',
      callback: () => {
        this.openContextFile();
      }
    });

    this.addCommand({
      id: 'refresh-context',
      name: 'Refresh session context',
      callback: () => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
        if (leaves.length) {
          void (leaves[0].view as ClaudeView).refreshSessionContext();
        } else {
          void this.activateView().then(() => {
            const l = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
            if (l.length) void (l[0].view as ClaudeView).refreshSessionContext();
          });
        }
      }
    });

    this.addCommand({
      id: 'audit-memory-file',
      name: 'Audit memory file',
      callback: () => void this.triggerMemoryAudit(),
    });

    this.addCommand({
      id: 'show-about',
      name: 'About',
      callback: () => {
        this.showAbout();
      }
    });

    this.addCommand({
      id: 'reload-skills',
      name: 'Reload skills',
      callback: () => {
        if (!this.settings.registerSkillsAsCommands) {
          new Notice('ObsidiBot: "Register skills as Ctrl+P commands" is disabled in settings.');
          return;
        }
        this.reloadSkillCommands();
        new Notice('ObsidiBot: skills reloaded.');
      }
    });

    this.addSettingTab(new ObsidiBotSettingsTab(this.app, this));
  }

  onunload() {
    // Intentionally empty — Obsidian restores leaf layout on reload.
    // Do NOT call detachLeavesOfType here; that resets the leaf to its default
    // location and discards any position the user has moved it to.
  }

  async activateView() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);

    if (existing.length) {
      await workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE_CLAUDE, active: true });
      await workspace.revealLeaf(leaf);
    }
  }

  newSession() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (existing.length) {
      const view = existing[0].view as ClaudeView;
      view.startNewSession();
    } else {
      void this.activateView().then(() => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
        if (leaves.length) (leaves[0].view as ClaudeView).startNewSession();
      });
    }
  }

  clearCurrentSession() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (existing.length) {
      const view = existing[0].view as ClaudeView;
      view.clearCurrentSession();
    }
  }

  togglePanel() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (existing.length) {
      // Panel is open, detach it
      this.app.workspace.detachLeavesOfType(VIEW_TYPE_CLAUDE);
    } else {
      void this.activateView();
    }
  }

  showSessionHistory() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (existing.length) {
      const view = existing[0].view as ClaudeView;
      view.showSessionHistory();
    } else {
      void this.activateView().then(() => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
        if (leaves.length) (leaves[0].view as ClaudeView).showSessionHistory();
      });
    }
  }

  exportConversation() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (existing.length) {
      const view = existing[0].view as ClaudeView;
      view.exportConversation();
    }
  }

  exportToVault() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (existing.length) {
      void (existing[0].view as ClaudeView).exportToVault();
    } else {
      void this.activateView().then(() => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
        if (leaves.length) void (leaves[0].view as ClaudeView).exportToVault();
      });
    }
  }

  copyLastResponse() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (existing.length) {
      const view = existing[0].view as ClaudeView;
      view.copyLastResponse();
    }
  }

  focusChatInput() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (existing.length) {
      void this.app.workspace.revealLeaf(existing[0]);
      (existing[0].view as ClaudeView).focusInput();
    } else {
      void this.activateView().then(() => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
        if (leaves.length) (leaves[0].view as ClaudeView).focusInput();
      });
    }
  }

  openContextFile() {
    const contextPath = this.settings.contextFilePath || '_claude-context.md';
    const file = this.app.vault.getAbstractFileByPath(contextPath);
    if (file) {
      void this.app.workspace.openLinkText(contextPath, '', false);
    } else {
      // File missing — relaunch the creation dialog instead of dead-ending with a Notice
      new ContextGenerationModal(
        this.app,
        this,
        contextPath,
        this.claudeBinaryPath ?? '',
        this.getVaultRoot(),
        this.shellEnv,
        this.settings.vaultTreeDepth,
      ).open();
    }
  }

  showAbout() {
    new AboutModal(this.app, this).open();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // Migrate old hardcoded log paths → empty so the dynamic default takes over
    if (this.settings.logFilePath === '_obsidibot-debug.log') {
      this.settings.logFilePath = '';
      await this.saveSettings();
    }
    // Resolve empty log path to a configDir-relative default at load time
    if (!this.settings.logFilePath) {
      this.settings.logFilePath = `${this.app.vault.configDir}/plugins/obsidibot/obsidibot-debug.log`;
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  notifyPermissionChanged(): void {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (leaves.length) (leaves[0].view as ClaudeView).onSettingsChanged();
  }

  private showMemoryUpdateNotice(): void {
    const notice = new Notice('', 8000);
    notice.noticeEl.empty();
    notice.noticeEl.createSpan({ text: 'Memory file was modified by Claude. ' });
    const link = notice.noticeEl.createEl('a', { cls: 'obsidibot-notice-link', text: 'Review', href: '#' });
    link.addEventListener('click', (e) => {
      e.preventDefault();
      notice.hide();
      new MemoryAuditModal(this.app, this).open();
    });
  }

  async triggerMemoryAudit(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (existing.length) {
      await this.app.workspace.revealLeaf(existing[0]);
      (existing[0].view as ClaudeView).auditMemoryFile();
    } else {
      await this.activateView();
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
      if (leaves.length) (leaves[0].view as ClaudeView).auditMemoryFile();
    }
  }

  private resolveCommandsFolder(): string {
    const custom = this.settings.commandsFolder;
    if (custom?.trim()) {
      const p = custom.trim();
      return isAbsolute(p) ? p : join(this.getVaultRoot(), p);
    }
    return join(this.getVaultRoot(), this.manifest.dir, 'commands');
  }

  reloadSkillCommands() {
    // Remove all previously registered template commands
    const appInternal = this.app as unknown as AppInternal;
    for (const id of this.skillCommandIds) {
      appInternal.commands.removeCommand(id);
    }
    this.skillCommandIds.clear();

    if (!this.settings.registerSkillsAsCommands) return;

    const folder = this.resolveCommandsFolder();
    if (!existsSync(folder)) return;

    try {
      const files = readdirSync(folder).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const filePath = join(folder, file);
        const name = file.replace(/\.md$/, '');
        const commandId = `skill-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const fullId = `obsidibot:${commandId}`;

        this.addCommand({
          id: commandId,
          name: `Skill: ${name}`,
          callback: () => {
            const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
            if (existing.length) {
              void this.app.workspace.revealLeaf(existing[0]);
              (existing[0].view as ClaudeView).executeSkill(filePath);
            } else {
              void this.activateView().then(() => {
                const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
                if (leaves.length) (leaves[0].view as ClaudeView).executeSkill(filePath);
              });
            }
          }
        });

        this.skillCommandIds.add(fullId);
      }
      log(`Registered ${files.length} skill(s) in Ctrl+P`);
    } catch (e) {
      warn('Failed to register skill commands:', e);
    }
  }

  generateCommandsFile() {
    try {
      const vaultRoot = this.getVaultRoot();
      const configDir = this.app.vault.configDir;
      const outPath = join(vaultRoot, configDir, 'plugins', 'obsidibot', 'obsidian-commands.md');

      const appInternal = this.app as unknown as AppInternal;
      const commands = Object.values(appInternal.commands.commands)
        .sort((a, b) => a.id.localeCompare(b.id));

      // Group by plugin prefix (part before first ':')
      const groups = new Map<string, { id: string; name: string }[]>();
      for (const cmd of commands) {
        const prefix = cmd.id.includes(':') ? cmd.id.split(':')[0] : 'core';
        if (!groups.has(prefix)) groups.set(prefix, []);
        groups.get(prefix)!.push(cmd);
      }

      const lines: string[] = [
        '# Obsidian Command Reference',
        `_Generated: ${new Date().toISOString()}_`,
        '_Grep by plugin name or display name to find the right command ID for run-command._',
        '',
      ];

      for (const [prefix, cmds] of [...groups.entries()].sort()) {
        lines.push(`## ${prefix}`);
        for (const cmd of cmds) {
          lines.push(`- \`${cmd.id}\` — ${cmd.name}`);
        }
        lines.push('');
      }

      writeFileSync(outPath, lines.join('\n'), 'utf8');
      log(`Commands file written: ${outPath} (${commands.length} commands)`);
    } catch (e) {
      warn('Failed to write commands file:', e);
    }
  }

  notifyAllowlistChanged(newAllowlist: string[]) {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (leaves.length) (leaves[0].view as ClaudeView).injectAllowlistUpdate(newAllowlist);
  }

  reconfigureLogger() {
    initLogger(this.getVaultRoot(), {
      enabled: this.settings.logEnabled,
      filePath: this.settings.logFilePath,
      verbosity: this.settings.logVerbosity,
    });
    log('Logger reconfigured — enabled:', this.settings.logEnabled, 'verbosity:', this.settings.logVerbosity);
  }
}
