import { App, PluginSettingTab, Setting } from 'obsidian';
import type BojuBotPlugin from '../main';
import type { PermissionMode } from './ClaudeProcess';
export type { PermissionMode };
import { AppInternal } from './obsidianInternal';
import { FolderSuggest } from './utils/FolderSuggest';
import { BrandConfig, brandName, DEFAULT_BRAND, isWhiteLabeled } from './brand';

export interface ClaudeModel {
  id: string;
  displayName: string;
  description: string;
}

export const CLAUDE_MODELS: ClaudeModel[] = [
  { id: 'claude-haiku-4-5', displayName: 'Claude Haiku 4.5', description: 'Fastest — great for quick tasks' },
  { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', description: 'Balanced speed and capability (default)' },
  { id: 'claude-opus-4-8', displayName: 'Claude Opus 4.8', description: 'Most capable — best for complex reasoning' },
  { id: 'claude-fable-5', displayName: 'Claude Fable 5', description: 'Most capable — coding-focused, highest reasoning' },
];

/** Falls back to this when settings.defaultModel is unset — covers both fresh
 *  installs and installs with an empty string already persisted from before
 *  this default existed (DEFAULT_SETTINGS alone only helps fresh installs). */
export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6';

export interface BojuBotSettings {
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
   * Empty = default (.obsidian/bojubot/sessions — gitignored).
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
  /** Keep full access mode between restarts instead of resetting to standard. Default off. */
  persistFullAccess: boolean;
  /** Max characters of canvas text injected as context. 0 = no limit. */
  canvasMaxChars: number;
  /** Max tokens of context file content injected at session start. 0 = no limit. */
  contextFileSizeCapTokens: number;
  /** Skip all context injection — orientation, vault tree, context file, active note. Bare Claude Code experience. */
  minimalMode: boolean;
  /** User's preferred name, set via conversation (set-label action). Empty = unknown. */
  userLabel: string;
  /** Claude model ID passed via --model at spawn time. Empty = Claude default (Sonnet). */
  defaultModel: string;
  /** Count of new-session creations (not sessions saved). Drives the periodic sponsorship welcome variant. */
  sessionCreationCount: number;
  /** User opt-out of the periodic sponsorship welcome variant. Always hidden/off on white-labeled installs regardless of this value. */
  hideSponsorshipMessages: boolean;
  /**
   * Optional white-label branding (display name, icon, art, greetings, links).
   * Absent → the stock BojuBot identity, byte-for-byte. Always read through
   * resolveBrand() — never trust the shallow settings merge to fill it in.
   */
  brand?: BrandConfig;
}

export const DEFAULT_SETTINGS: BojuBotSettings = {
  binaryPath: '',
  contextFilePath: '_claude-context.md',
  sendOnEnter: true,
  resumeLastSession: true,
  autonomousMemory: true,
  vaultTreeDepth: 0,
  skipContextFilePrompt: false,
  uiBridgeEnabled: true,
  commandAllowlist: ['switcher:open', 'editor:open-search'],
  confirmUnlistedCommands: true,
  commandDenylist: [],
  permissionMode: 'standard',
  logEnabled: false,
  logFilePath: '',
  logVerbosity: 'normal',
  atMentionExtensions: '*',
  injectSplitPaneFiles: true,
  injectStackedTabFiles: false,
  exportFolder: '',
  lastActiveSessionId: '',
  sessionStoragePath: '',
  commandsFolder: '',
  registerSkillsAsCommands: true,
  persistFullAccess: false,
  canvasMaxChars: 50000,
  contextFileSizeCapTokens: 0,
  minimalMode: false,
  userLabel: '',
  defaultModel: DEFAULT_MODEL_ID,
  sessionCreationCount: 0,
  hideSponsorshipMessages: false,
};

export class BojuBotSettingsTab extends PluginSettingTab {
  plugin: BojuBotPlugin;

  constructor(app: App, plugin: BojuBotPlugin) {
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
          .setPlaceholder('(Auto-detect)')
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
      .setDesc('File extensions for @-mention autocomplete, comma-separated. Use * to match all file types. Add a trailing comma to include extensionless files.')
      .addText((text) =>
        text
          .setPlaceholder('*')
          .setValue(this.plugin.settings.atMentionExtensions)
          .onChange(async (value) => {
            this.plugin.settings.atMentionExtensions = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Context & Memory ───────────────────────────────────────────────────
    new Setting(containerEl).setName('Context & memory').setHeading();

    const muted = this.plugin.settings.minimalMode;
    const muteIfMinimal = (s: Setting) => { if (muted) s.settingEl.addClass('bojubot-setting-muted'); return s; };

    muteIfMinimal(new Setting(containerEl)
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
      )
      .setDisabled(muted));

    muteIfMinimal(new Setting(containerEl)
      .setName('Vault tree depth')
      .setDesc(
        'How many levels of your vault folder/file tree to include at the start of each session. ' +
        'This gives Claude a map of your vault structure (names only — no file contents are read). ' +
        'Deeper trees cost more tokens on the first message of each session. ' +
        '"Off" disables the tree entirely.'
      )
      .addDropdown((drop) =>
        drop
          .addOption('0', 'Off (default)')
          .addOption('1', '1 Level (root only)')
          .addOption('2', '2 Levels')
          .addOption('3', '3 Levels')
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
      )
      .setDisabled(muted));

    muteIfMinimal(new Setting(containerEl)
      .setName('Autonomous memory')
      .setDesc(`Claude will autonomously update the context file (${this.plugin.settings.contextFilePath}) as it learns about your vault. Disable if you prefer to manage the context file manually, or if your vault is shared/public.`)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autonomousMemory)
          .onChange(async (value) => {
            this.plugin.settings.autonomousMemory = value;
            await this.plugin.saveSettings();
          })
      )
      .setDisabled(muted));

    muteIfMinimal(new Setting(containerEl)
      .setName('Memory file size limit (tokens)')
      .setDesc(
        'When your context file exceeds this token count, Claude is instructed to compact it before the session ends — ' +
        'summarizing redundant entries and dropping outdated observations. ' +
        'Set to 0 to disable. Typical context files stay well under 4 000 tokens; set a limit if yours grows large over time.'
      )
      .addText((text) =>
        text
          .setPlaceholder('0 (No limit)')
          .setValue(
            this.plugin.settings.contextFileSizeCapTokens === 0
              ? ''
              : String(this.plugin.settings.contextFileSizeCapTokens)
          )
          .onChange(async (value) => {
            const n = parseInt(value, 10);
            this.plugin.settings.contextFileSizeCapTokens = isNaN(n) || n < 0 ? 0 : n;
            await this.plugin.saveSettings();
          })
      )
      .setDisabled(muted));

    new Setting(containerEl)
      .setName('Minimal mode')
      .setDesc(
        'Skip all context injection — no orientation, vault tree, context file, or active note. ' +
        'Reduces session start cost to zero. ' +
        'UI Bridge actions (open file, show notice, etc.) and vault queries will not work in this mode. ' +
        'Skills still work.'
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.minimalMode)
          .onChange(async (value) => {
            this.plugin.settings.minimalMode = value;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    muteIfMinimal(new Setting(containerEl)
      .setName('Inject split-pane files as context')
      .setDesc('When notes are open side by side in split panes, include all visible file paths in the active note context.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.injectSplitPaneFiles)
          .onChange(async (value) => {
            this.plugin.settings.injectSplitPaneFiles = value;
            await this.plugin.saveSettings();
          })
      )
      .setDisabled(muted));

    muteIfMinimal(new Setting(containerEl)
      .setName('Inject stacked tab files as context')
      .setDesc('When multiple notes are open as stacked tabs in the same pane, include all open tab file paths in the active note context.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.injectStackedTabFiles)
          .onChange(async (value) => {
            this.plugin.settings.injectStackedTabFiles = value;
            await this.plugin.saveSettings();
          })
      )
      .setDisabled(muted));

    muteIfMinimal(new Setting(containerEl)
      .setName('Max canvas size (characters)')
      .setDesc('Canvas files converted to text and injected as context will be truncated at this character limit. Set to 0 for no limit.')
      .addText((text) =>
        text
          .setPlaceholder('50000')
          .setValue(String(this.plugin.settings.canvasMaxChars))
          .onChange(async (value) => {
            const n = parseInt(value, 10);
            this.plugin.settings.canvasMaxChars = isNaN(n) || n < 0 ? 0 : n;
            await this.plugin.saveSettings();
          })
      )
      .setDisabled(muted));

    new Setting(containerEl)
      .setName('Export folder')
      .setDesc('Vault-relative folder where "export session to vault" saves notes. Created automatically if it does not exist.')
      .addText((text) => {
        new FolderSuggest(this.app, text.inputEl);
        text
          .setPlaceholder(`${brandName()} exports`)
          .setValue(this.plugin.settings.exportFolder)
          .onChange(async (value) => {
            this.plugin.settings.exportFolder = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Session storage path')
      .setDesc(
        'Where session files are stored. ' +
        'Leave empty for the default location (Obsidian config folder/bojubot/sessions). ' +
        'Use a vault-relative path (e.g. _sessions) to track sessions in git alongside your notes, ' +
        'or an absolute path to store them outside the vault entirely. ' +
        `Restart ${brandName()} after changing this.`
      )
      .addText((text) => {
        new FolderSuggest(this.app, text.inputEl);
        text
          .setPlaceholder('Default (Obsidian config folder/BojuBot/sessions)')
          .setValue(this.plugin.settings.sessionStoragePath)
          .onChange(async (value) => {
            this.plugin.settings.sessionStoragePath = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Skills folder')
      .setDesc(
        'Folder containing your skill files (.md files). ' +
        'Leave empty for the default location (plugin dir/commands). ' +
        'Use a vault-relative path (e.g. _skills) to keep skills in your vault, ' +
        'or an absolute path. Skills reload each time you open the / menu.'
      )
      .addText((text) => {
        new FolderSuggest(this.app, text.inputEl);
        text
          .setPlaceholder('Default (plugin dir/commands)')
          .setValue(this.plugin.settings.commandsFolder)
          .onChange(async (value) => {
            this.plugin.settings.commandsFolder = value.trim();
            await this.plugin.saveSettings();
            if (this.plugin.settings.registerSkillsAsCommands) {
              this.plugin.reloadSkillCommands();
            }
          });
      });

    new Setting(containerEl)
      .setName('Register skills as Ctrl+P commands')
      .setDesc(
        'Expose each skill as an Obsidian command palette entry (prefixed "Skill: …"). ' +
        `Run "${brandName()}: Reload skills" from the palette after adding or removing skill files. ` +
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
          .addOption('restricted', 'Chat only — web access, no file system')
          .addOption('standard', 'Standard — files + web, no bash (recommended)')
          .addOption('readonly', 'Read only — no writes or shell commands')
          .addOption('full', 'Full access — everything including bash')
          .setValue(this.plugin.getEffectivePermissionMode())
          .onChange(async (value) => {
            this.plugin.settings.permissionMode = value as PermissionMode;
            await this.plugin.saveSettings();
            this.plugin.notifyPermissionChanged();
            this.display();
          })
      );

    if (this.plugin.getEffectivePermissionMode() === 'full') {
      new Setting(containerEl)
        .setName('Persist full access between restarts')
        .setDesc('When off, full access resets to standard when Obsidian restarts.')
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.persistFullAccess)
            .onChange(async (value) => {
              this.plugin.settings.persistFullAccess = value;
              await this.plugin.saveSettings();
            })
        );
    }

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

    const commandListEl = containerEl.createDiv({ cls: 'bojubot-command-list' });
    const commandCountEl = containerEl.createEl('p', { cls: 'bojubot-command-count' });

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
          const row = commandListEl.createDiv({ cls: 'bojubot-command-row bojubot-command-row--orphaned' });
          const checkbox = row.createEl('input', { type: 'checkbox' });
          checkbox.id = `bojubot-cmd-orphan-${id}`;
          checkbox.checked = true;
          checkbox.addEventListener('change', () => {
            this.plugin.settings.commandAllowlist = this.plugin.settings.commandAllowlist.filter(x => x !== id);
            void this.plugin.saveSettings().then(() => {
              this.plugin.notifyAllowlistChanged(this.plugin.settings.commandAllowlist);
              renderCommandList();
              updateCountText();
            });
          });
          const label = row.createEl('label', { cls: 'bojubot-command-name' });
          label.htmlFor = `bojubot-cmd-orphan-${id}`;
          label.createSpan({ text: id, cls: 'bojubot-command-orphan-id' });
          label.createSpan({ text: ' — not found', cls: 'bojubot-command-orphan-badge' });
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
        commandListEl.createEl('p', { text: 'No commands match your search.', cls: 'bojubot-command-empty' });
      } else {
        for (const cmd of filtered) {
          const row = commandListEl.createDiv({ cls: 'bojubot-command-row' });
          const checkbox = row.createEl('input', { type: 'checkbox' });
          checkbox.id = `bojubot-cmd-${cmd.id}`;
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
          const label = row.createEl('label', { text: cmd.name, cls: 'bojubot-command-name' });
          label.htmlFor = `bojubot-cmd-${cmd.id}`;
        }
      }

      updateCountText();
    };

    renderCommandList();

    // ── Logging ────────────────────────────────────────────────────────────
    new Setting(containerEl).setName('Logging').setHeading();

    new Setting(containerEl)
      .setName('Enable debug log')
      .setDesc('Write a debug log file to your vault. Useful for troubleshooting. Takes effect immediately.')
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
          .setPlaceholder('Default (plugin folder/BojuBot-debug.log)')
          .setValue(this.plugin.settings.logFilePath)
          .onChange(async (value) => {
            this.plugin.settings.logFilePath = value || '_bojubot-debug.log';
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

    // Periodic welcome-screen sponsorship message — never shown, and the
    // toggle never surfaced, on white-labeled installs (a downstream
    // distributor manages their own funding messaging, not Scott's).
    if (!isWhiteLabeled(this.plugin.brand)) {
      new Setting(containerEl)
        .setName('Hide sponsorship messages')
        .setDesc('BojuBot occasionally swaps the welcome screen for a short message about supporting the project. Turn this on to never see it.')
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.hideSponsorshipMessages)
            .onChange(async (value) => {
              this.plugin.settings.hideSponsorshipMessages = value;
              await this.plugin.saveSettings();
            })
        );
    }

    // ── Brand ──────────────────────────────────────────────────────────────
    // Everything here is optional. Blank fields fall back to the stock BojuBot
    // identity (see resolveBrand). Nothing is ever removed — an empty link just
    // hides its card. Greetings/tips overrides are data.json-only for now.
    new Setting(containerEl).setName('Branding').setHeading();

    if (this.plugin.settings.brand?.locked) {
      new Setting(containerEl)
        .setDesc('Branding is locked and cannot be changed from this panel. Edit data.json directly (brand.locked) and reload the plugin to unlock it.');
      // Brand is the last section in display() — safe to bail out here. If a
      // new section is ever added after Brand, this must become an if/else.
      return;
    }

    const ensureBrand = (): NonNullable<typeof this.plugin.settings.brand> =>
      (this.plugin.settings.brand ??= {});
    const ensureLinks = (): NonNullable<NonNullable<typeof this.plugin.settings.brand>['links']> => {
      const b = ensureBrand();
      return (b.links ??= {});
    };
    const saveBrand = async () => {
      // Drop an empty brand object so an untouched install stays byte-for-byte.
      const b = this.plugin.settings.brand;
      if (b && Object.keys(b).length === 0) delete this.plugin.settings.brand;
      await this.plugin.saveSettings();
    };

    new Setting(containerEl)
      .setName('Display name')
      .setDesc('Shown in the panel title, welcome header, notices, and prompts. Blank = BojuBot. Reload the panel to apply everywhere.')
      .addText((text) =>
        text
          .setPlaceholder('BojuBot')
          .setValue(this.plugin.settings.brand?.name ?? '')
          .onChange(async (value) => {
            ensureBrand().name = value;
            await saveBrand();
          })
      );

    new Setting(containerEl)
      .setName('Ribbon icon')
      .setDesc(`Lucide icon ID for the ribbon and tab. Blank = ${DEFAULT_BRAND.icon}.`)
      .addText((text) =>
        text
          // Referencing the constant (not a literal) keeps this in sync with
          // DEFAULT_BRAND.icon and avoids a lint disable-comment for a literal
          // Lucide id that must stay lowercase (Obsidian's submission scan
          // flags eslint-disable comments on required rules directly).
          .setPlaceholder(DEFAULT_BRAND.icon)
          .setValue(this.plugin.settings.brand?.icon ?? '')
          .onChange(async (value) => {
            ensureBrand().icon = value;
            await saveBrand();
          })
      );

    new Setting(containerEl)
      .setName('Logo')
      .setDesc('Data: URI or vault-relative image path for the header logo. Blank = bundled logo.')
      .addText((text) =>
        text
          .setPlaceholder('(Bundled)')
          .setValue(this.plugin.settings.brand?.logo ?? '')
          .onChange(async (value) => {
            ensureBrand().logo = value;
            await saveBrand();
          })
      );

    new Setting(containerEl)
      .setName('Welcome sprite')
      .setDesc('Data: URI or vault-relative image path for the welcome mascot. Blank = bundled sprite.')
      .addText((text) =>
        text
          .setPlaceholder('(Bundled)')
          .setValue(this.plugin.settings.brand?.sprite ?? '')
          .onChange(async (value) => {
            ensureBrand().sprite = value;
            await saveBrand();
          })
      );

    const linkSetting = (
      name: string,
      desc: string,
      key: 'doc' | 'community' | 'source' | 'support',
      placeholder: string,
      hideable = true,
    ) => {
      const setting = new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addText((text) =>
          text
            .setPlaceholder(placeholder)
            .setValue(this.plugin.settings.brand?.links?.[key] ?? '')
            .onChange(async (value) => {
              const trimmed = value.trim();
              const links = ensureLinks();
              // A blank field means "use the default" — delete the key rather
              // than storing '', which resolveBrand treats as "explicitly
              // hidden". Hiding a card is a deliberate action via the button
              // below, not an incidental side effect of clearing the field.
              if (trimmed) links[key] = trimmed;
              else delete links[key];
              await saveBrand();
            })
        );
      if (hideable) {
        // '' means explicitly hidden; the field itself looks the same (blank)
        // whether hidden or just unset, so the icon is the only visible cue —
        // it must reflect current state, not just always offer to hide.
        const label = name.replace(' link', '');
        const isHidden = this.plugin.settings.brand?.links?.[key] === '';
        setting.addExtraButton((btn) =>
          btn
            .setIcon(isHidden ? 'eye' : 'eye-off')
            .setTooltip(isHidden ? `Restore the default ${label} link` : `Hide the ${label} card`)
            .onClick(async () => {
              const links = ensureLinks();
              if (isHidden) delete links[key];
              else links[key] = '';
              await saveBrand();
              this.display();
            })
        );
      }
    };

    linkSetting('Documentation link', 'About-modal Documentation card. Blank = default.', 'doc', '(default)');
    linkSetting('Community link', 'About-modal community/Discord card. Blank = default.', 'community', '(default)');
    linkSetting('Source link', 'About-modal source-code card. Blank = default upstream repo.', 'source', '(default)');
    linkSetting('Support link', 'Support URL shown to Claude in the system prompt. Blank = default.', 'support', '(default)', false);

    new Setting(containerEl)
      .setName('Rebrand assistant identity')
      .setDesc('Also use the display name in the system prompt Claude receives (how it refers to itself). Off = the assistant identity stays "BojuBot" even with a custom name.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.brand?.applyToAssistantIdentity ?? false)
          .onChange(async (value) => {
            ensureBrand().applyToAssistantIdentity = value;
            await saveBrand();
          })
      );

    new Setting(containerEl)
      .setName('Lock branding')
      .setDesc(
        'Hide the entire Brand settings section from casual users. This is not a security boundary — it can ' +
        'still be reverted by editing brand.locked in data.json directly.'
      )
      .addToggle((toggle) =>
        toggle
          .setValue(false)
          .onChange(async (value) => {
            if (!value) return;
            ensureBrand().locked = true;
            await saveBrand();
            this.display();
          })
      );
  }
}
