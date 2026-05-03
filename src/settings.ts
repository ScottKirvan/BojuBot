import { App, PluginSettingTab, Setting } from 'obsidian';
import type ObsidiBotPlugin from '../main';
import type { PermissionMode } from './ClaudeProcess';
export type { PermissionMode };

interface AppInternal {
  commands: { commands: Record<string, { id: string; name: string }> };
}

export interface ObsidiBotSettings {
  binaryPath: string;
  contextFilePath: string;
  sendOnEnter: boolean;
  resumeLastSession: boolean;
  autonomousMemory: boolean;
  /** Vault tree depth injected at session start. 0=off, 1=root only, N=N levels, -1=unlimited. */
  vaultTreeDepth: number;
  /** User dismissed the context file setup modal and doesn't want to see it again. */
  skipContextFilePrompt: boolean;
  /** Allow Claude to trigger Obsidian UI actions (open files, show notices, etc.) */
  uiBridgeEnabled: boolean;
  /** Command IDs Claude is allowed to execute via the run-command UI Bridge action. */
  commandAllowlist: string[];
  /** Prompt when Claude tries a command not in the allowlist, offering a one-time allow or add-to-allowlist. */
  confirmUnlistedCommands: boolean;
  /** Command IDs permanently denied via "Deny + don't ask again". Allowlist takes precedence. */
  commandDenylist: string[];
  /** Which operations Claude is allowed to perform. */
  permissionMode: PermissionMode;
  /** Write a debug log file to the vault. */
  logEnabled: boolean;
  /** Vault-relative path for the log file. */
  logFilePath: string;
  /** How much detail to log. 'verbose' includes raw stream chunks and token breakdowns. */
  logVerbosity: 'normal' | 'verbose';
  /** Comma-separated file extensions included in @-mention search. */
  atMentionExtensions: string;
  /** Inject all visible files when Obsidian is in split-pane view. */
  injectSplitPaneFiles: boolean;
  /** Inject all open files when Obsidian is showing stacked tabs. */
  injectStackedTabFiles: boolean;
  /** Vault-relative folder where "Export session to vault" saves notes. */
  exportFolder: string;
  /** File ID of the session that was active when Obsidian was last closed. */
  lastActiveSessionId: string;
  /**
   * Where session JSON files are stored.
   * Empty = default (.obsidian/obsidibot/sessions — gitignored).
   * Vault-relative path (e.g. "_sessions") or absolute path.
   */
  sessionStoragePath: string;
  /**
   * Folder containing skill files (.md files).
   * Empty = default (plugin dir/commands — gitignored).
   * Vault-relative path or absolute path.
   */
  commandsFolder: string;
  /**
   * Register skills as Obsidian Ctrl+P commands.
   * Use "Reload skills" from the palette after adding or removing skill files.
   */
  registerSkillsAsCommands: boolean;
}

export const DEFAULT_SETTINGS: ObsidiBotSettings = {
  binaryPath: '',
  contextFilePath: '_claude-context.md',
  sendOnEnter: true,
  resumeLastSession: true,
  autonomousMemory: true,
  vaultTreeDepth: 3,
  skipContextFilePrompt: false,
  uiBridgeEnabled: true,
  commandAllowlist: ['switcher:open', 'daily-notes', 'editor:open-search'],
  confirmUnlistedCommands: true,
  commandDenylist: [],
  permissionMode: 'standard',
  logEnabled: false,
  logFilePath: '',
  logVerbosity: 'normal',
  atMentionExtensions: 'md, canvas, pdf, fountain, txt',
  injectSplitPaneFiles: true,
  injectStackedTabFiles: false,
  exportFolder: 'ObsidiBot Exports',
  lastActiveSessionId: '',
  sessionStoragePath: '',
  commandsFolder: '',
  registerSkillsAsCommands: false,
};

export class ObsidiBotSettingsTab extends PluginSettingTab {
  plugin: ObsidiBotPlugin;

  constructor(app: App, plugin: ObsidiBotPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Claude binary path')
      .setDesc('Path to the Claude CLI binary. Leave blank to auto-detect.')
      .addText((text) =>
        text
          // eslint-disable-next-line obsidianmd/ui/sentence-case
          .setPlaceholder('/usr/local/bin/claude')
          .setValue(this.plugin.settings.binaryPath)
          .onChange(async (value) => {
            this.plugin.settings.binaryPath = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Send on enter')
      .setDesc('Press Enter to send. Shift+Enter always inserts a newline.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.sendOnEnter)
          .onChange(async (value) => {
            this.plugin.settings.sendOnEnter = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Resume last session on startup')
      .setDesc('Automatically resume the most recent session when the panel opens.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.resumeLastSession)
          .onChange(async (value) => {
            this.plugin.settings.resumeLastSession = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('@-mention file types')
      // eslint-disable-next-line obsidianmd/ui/sentence-case
      .setDesc('Comma-separated extensions to include in @-mention search (e.g. md, pdf, fountain, txt).')
      .addText((text) =>
        text
          // eslint-disable-next-line obsidianmd/ui/sentence-case
          .setPlaceholder('md, pdf, fountain, txt')
          .setValue(this.plugin.settings.atMentionExtensions)
          .onChange(async (value) => {
            this.plugin.settings.atMentionExtensions = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Context & Memory ───────────────────────────────────────────────────
    new Setting(containerEl).setName('Context & memory').setHeading();

    new Setting(containerEl)
      .setName('Context file path')
      .setDesc('Vault-relative path to the context file injected at session start.')
      .addText((text) =>
        text
          .setPlaceholder('_claude-context.md')
          .setValue(this.plugin.settings.contextFilePath)
          .onChange(async (value) => {
            this.plugin.settings.contextFilePath = value;
            await this.plugin.saveSettings();
          })
      )
      .addButton((btn) =>
        btn
          .setButtonText('Open file')
          .setTooltip('Open the context file in Obsidian for editing')
          .onClick(async () => {
            let file = this.app.vault.getFileByPath(this.plugin.settings.contextFilePath);
            if (!file) {
              file = await this.app.vault.create(this.plugin.settings.contextFilePath, '');
            }
            await this.app.workspace.getLeaf(false).openFile(file);
          })
      );

    new Setting(containerEl)
      .setName('Vault tree depth')
      .setDesc(
        'How many levels of your vault folder/file tree to include at the start of each session. ' +
        'This gives Claude a map of your vault structure (names only — no file contents are read). ' +
        'Deeper trees cost more tokens on the first message of each session. ' +
        '"Off" disables the tree entirely.'
      )
      .addDropdown((drop) =>
        drop
          .addOption('0', 'Off')
          .addOption('1', '1 Level (root only)')
          .addOption('2', '2 Levels')
          .addOption('3', '3 Levels (default)')
          .addOption('4', '4 Levels')
          .addOption('5', '5 Levels')
          .addOption('6', '6 Levels')
          .addOption('7', '7 Levels')
          .addOption('8', '8 Levels')
          .addOption('9', '9 Levels')
          .addOption('10', '10 Levels')
          .addOption('-1', 'Unlimited')
          .setValue(String(this.plugin.settings.vaultTreeDepth))
          .onChange(async (value) => {
            this.plugin.settings.vaultTreeDepth = parseInt(value, 10);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Autonomous memory')
      .setDesc(`Claude will autonomously update the context file (${this.plugin.settings.contextFilePath}) as it learns about your vault. Disable if you prefer to manage the context file manually, or if your vault is shared/public.`)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autonomousMemory)
          .onChange(async (value) => {
            this.plugin.settings.autonomousMemory = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Inject split-pane files as context')
      .setDesc('When notes are open side by side in split panes, include all visible file paths in the active note context.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.injectSplitPaneFiles)
          .onChange(async (value) => {
            this.plugin.settings.injectSplitPaneFiles = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Inject stacked tab files as context')
      .setDesc('When multiple notes are open as stacked tabs in the same pane, include all open tab file paths in the active note context.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.injectStackedTabFiles)
          .onChange(async (value) => {
            this.plugin.settings.injectStackedTabFiles = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Export folder')
      .setDesc('Vault-relative folder where "export session to vault" saves notes. Created automatically if it does not exist.')
      .addText((text) =>
        text
          // eslint-disable-next-line obsidianmd/ui/sentence-case
          .setPlaceholder('ObsidiBot Exports')
          .setValue(this.plugin.settings.exportFolder)
          .onChange(async (value) => {
            this.plugin.settings.exportFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Session storage path')
      .setDesc(
        'Where session files are stored. ' +
        'Leave empty for the default location (Obsidian config folder/obsidibot/sessions). ' +
        'Use a vault-relative path (e.g. _sessions) to track sessions in git alongside your notes, ' +
        'or an absolute path to store them outside the vault entirely. ' +
        'Restart ObsidiBot after changing this.'
      )
      .addText((text) =>
        text
          .setPlaceholder('Default (Obsidian config folder/obsidibot/sessions)')
          .setValue(this.plugin.settings.sessionStoragePath)
          .onChange(async (value) => {
            this.plugin.settings.sessionStoragePath = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Skills folder')
      .setDesc(
        'Folder containing your skill files (.md files). ' +
        'Leave empty for the default location (plugin dir/commands). ' +
        'Use a vault-relative path (e.g. _skills) to keep skills in your vault, ' +
        'or an absolute path. Skills reload each time you open the / menu.'
      )
      .addText((text) =>
        text
          .setPlaceholder('Default (plugin dir/commands)')
          .setValue(this.plugin.settings.commandsFolder)
          .onChange(async (value) => {
            this.plugin.settings.commandsFolder = value.trim();
            await this.plugin.saveSettings();
            if (this.plugin.settings.registerSkillsAsCommands) {
              this.plugin.reloadSkillCommands();
            }
          })
      );

    new Setting(containerEl)
      .setName('Register skills as Ctrl+P commands')
      .setDesc(
        'Expose each skill as an Obsidian command palette entry (prefixed "Skill: …"). ' +
        'Run "ObsidiBot: Reload skills" from the palette after adding or removing skill files. ' +
        'Disable if you find the extra commands cluttering the palette.'
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.registerSkillsAsCommands)
          .onChange(async (value) => {
            this.plugin.settings.registerSkillsAsCommands = value;
            await this.plugin.saveSettings();
            this.plugin.reloadSkillCommands();
          })
      );

    // ── Permissions ────────────────────────────────────────────────────────
    new Setting(containerEl).setName('Permissions').setHeading();

    new Setting(containerEl)
      .setName('Permission mode')
      .setDesc('Controls which vault operations Claude is allowed to perform.')
      .addDropdown((drop) =>
        drop
          .addOption('standard', 'Standard — files + web, no bash (recommended)')
          .addOption('readonly', 'Read only — no writes or shell commands')
          .addOption('full', 'Full access — everything including bash')
          .setValue(this.plugin.settings.permissionMode)
          .onChange(async (value) => {
            this.plugin.settings.permissionMode = value as PermissionMode;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Show context file setup prompt')
      .setDesc('Show the setup modal on launch when no context file is found. Disable if you prefer to create the file manually.')
      .addToggle((toggle) =>
        toggle
          .setValue(!this.plugin.settings.skipContextFilePrompt)
          .onChange(async (value) => {
            this.plugin.settings.skipContextFilePrompt = !value;
            await this.plugin.saveSettings();
          })
      );

    // ── UI Bridge & Commands ───────────────────────────────────────────────
    new Setting(containerEl).setName('UI bridge & commands').setHeading();

    new Setting(containerEl)
      .setName('UI bridge')
      .setDesc('Allow Claude to trigger Obsidian UI actions — open files, show notices, navigate headings. Claude is instructed to use these proactively after completing tasks.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.uiBridgeEnabled)
          .onChange(async (value) => {
            this.plugin.settings.uiBridgeEnabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Prompt for unlisted commands')
      .setDesc('When Claude tries to run a command not in the allowlist, show a prompt offering a one-time allow or the option to add it to the allowlist. If off, unlisted commands are hard-blocked with a notice.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.confirmUnlistedCommands)
          .onChange(async value => {
            this.plugin.settings.confirmUnlistedCommands = value;
            await this.plugin.saveSettings();
          })
      );

    if (this.plugin.settings.commandDenylist.length > 0) {
      new Setting(containerEl)
        .setName('Denied commands')
        .setDesc(`${this.plugin.settings.commandDenylist.length} command${this.plugin.settings.commandDenylist.length === 1 ? '' : 's'} permanently denied. Add a denied command to the allowlist to re-enable it.`)
        .addButton(btn =>
          btn
            .setButtonText('Clear denylist')
            .setTooltip('Remove all permanent denials — commands will prompt again')
            .onClick(async () => {
              this.plugin.settings.commandDenylist = [];
              await this.plugin.saveSettings();
              this.display();
            })
        );
    }

    containerEl.createEl('p', {
      text: 'Obsidian commands Claude is allowed to run directly. ' +
        'Search and check commands to enable them. Allowlisted commands run immediately; others prompt for approval.',
      cls: 'setting-item-description',
    });

    let commandSearchQuery = '';
    new Setting(containerEl)
      .setName('Filter commands')
      .addSearch(search =>
        search
          .setPlaceholder('Search by name or ID…')
          .onChange(val => { commandSearchQuery = val; renderCommandList(); })
      );

    const commandListEl = containerEl.createDiv({ cls: 'obsidibot-command-list' });
    const commandCountEl = containerEl.createEl('p', { cls: 'obsidibot-command-count' });

    const allCommands = Object.values(
      (this.app as unknown as AppInternal).commands.commands
    ).sort((a, b) => a.name.localeCompare(b.name));

    const updateCountText = () => {
      const allCommandIds = new Set(allCommands.map(c => c.id));
      const active = this.plugin.settings.commandAllowlist.filter(id => allCommandIds.has(id)).length;
      const orphaned = this.plugin.settings.commandAllowlist.length - active;
      if (this.plugin.settings.commandAllowlist.length === 0) {
        commandCountEl.setText('No commands enabled.');
      } else if (orphaned > 0) {
        commandCountEl.setText(`${active} command${active === 1 ? '' : 's'} enabled, ${orphaned} not found (uncheck to remove).`);
      } else {
        commandCountEl.setText(`${active} command${active === 1 ? '' : 's'} enabled.`);
      }
    };

    const renderCommandList = () => {
      commandListEl.empty();
      const q = commandSearchQuery.toLowerCase();

      // Show orphaned entries (stored IDs not in current command registry) when not filtering
      if (!q) {
        const allCommandIds = new Set(allCommands.map(c => c.id));
        const orphaned = this.plugin.settings.commandAllowlist.filter(id => !allCommandIds.has(id));
        for (const id of orphaned) {
          const row = commandListEl.createDiv({ cls: 'obsidibot-command-row obsidibot-command-row--orphaned' });
          const checkbox = row.createEl('input', { type: 'checkbox' });
          checkbox.id = `obsidibot-cmd-orphan-${id}`;
          checkbox.checked = true;
          checkbox.addEventListener('change', () => {
            this.plugin.settings.commandAllowlist = this.plugin.settings.commandAllowlist.filter(x => x !== id);
            void this.plugin.saveSettings().then(() => {
              this.plugin.notifyAllowlistChanged(this.plugin.settings.commandAllowlist);
              renderCommandList();
              updateCountText();
            });
          });
          const label = row.createEl('label', { cls: 'obsidibot-command-name' });
          label.htmlFor = `obsidibot-cmd-orphan-${id}`;
          label.createEl('span', { text: id });
          label.createEl('span', { text: ' — not found', cls: 'obsidibot-command-orphan-badge' });
        }
      }

      const filtered = (q
        ? allCommands.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
        : allCommands
      ).sort((a, b) => {
        const aOn = this.plugin.settings.commandAllowlist.includes(a.id);
        const bOn = this.plugin.settings.commandAllowlist.includes(b.id);
        if (aOn !== bOn) return aOn ? -1 : 1;
        return 0; // already alphabetical from allCommands sort
      });

      if (filtered.length === 0) {
        commandListEl.createEl('p', { text: 'No commands match your search.', cls: 'obsidibot-command-empty' });
      } else {
        for (const cmd of filtered) {
          const row = commandListEl.createDiv({ cls: 'obsidibot-command-row' });
          const checkbox = row.createEl('input', { type: 'checkbox' });
          checkbox.id = `obsidibot-cmd-${cmd.id}`;
          checkbox.checked = this.plugin.settings.commandAllowlist.includes(cmd.id);
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
              if (!this.plugin.settings.commandAllowlist.includes(cmd.id)) {
                this.plugin.settings.commandAllowlist = [...this.plugin.settings.commandAllowlist, cmd.id];
              }
            } else {
              this.plugin.settings.commandAllowlist = this.plugin.settings.commandAllowlist.filter(id => id !== cmd.id);
            }
            void this.plugin.saveSettings().then(() => {
              this.plugin.notifyAllowlistChanged(this.plugin.settings.commandAllowlist);
              updateCountText();
            });
          });
          const label = row.createEl('label', { text: cmd.name, cls: 'obsidibot-command-name' });
          label.htmlFor = `obsidibot-cmd-${cmd.id}`;
        }
      }

      updateCountText();
    };

    renderCommandList();

    // ── Logging ────────────────────────────────────────────────────────────
    new Setting(containerEl).setName('Logging').setHeading();

    new Setting(containerEl)
      .setName('Enable debug log')
      .setDesc('Write a debug log file to your vault. Useful for troubleshooting. Takes effect on next Obsidian restart.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.logEnabled)
          .onChange(async (value) => {
            this.plugin.settings.logEnabled = value;
            await this.plugin.saveSettings();
            this.plugin.reconfigureLogger();
          })
      );

    new Setting(containerEl)
      .setName('Log file path')
      .setDesc('Vault-relative path for the log file. Defaults to the plugin folder so it stays out of your vault.')
      .addText((text) =>
        text
          .setPlaceholder('Default (plugin folder/obsidibot-debug.log)')
          .setValue(this.plugin.settings.logFilePath)
          .onChange(async (value) => {
            this.plugin.settings.logFilePath = value || '_obsidibot-debug.log';
            await this.plugin.saveSettings();
            this.plugin.reconfigureLogger();
          })
      );

    new Setting(containerEl)
      .setName('Log verbosity')
      .setDesc('Normal logs session events and errors. Verbose adds raw stream data and token breakdowns — useful for deep debugging but produces large log files.')
      .addDropdown((drop) =>
        drop
          .addOption('normal', 'Normal')
          .addOption('verbose', 'Verbose')
          .setValue(this.plugin.settings.logVerbosity)
          .onChange(async (value) => {
            this.plugin.settings.logVerbosity = value as 'normal' | 'verbose';
            await this.plugin.saveSettings();
            this.plugin.reconfigureLogger();
          })
      );
  }
}
