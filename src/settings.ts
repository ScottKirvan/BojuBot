import { App, PluginSettingTab, requireApiVersion, Setting } from 'obsidian';
import type { SettingDefinition, SettingDefinitionItem } from 'obsidian';
import type BojuBotPlugin from '../main';
import type { BackendId, ModelOption, PermissionMode } from './backends/types';
export type { PermissionMode };
import { getBackend } from './backends';
import { AppInternal } from './obsidianInternal';
import { BrandConfig, brandName, DEFAULT_BRAND, isWhiteLabeled } from './brand';
import { formatCliVersion } from './utils/cliCapabilities';
import { GITHUB_SPONSORS_URL, KOFI_URL, SUPPORT_PAGE_URL } from './constants';
import { renderSettingDefinitions } from './settingsFallback';
import {
  asText,
  BrandField,
  brandFieldOf,
  CommandInfo,
  commandCountText,
  filterCommands,
  orphanedCommandIds,
  parseNonNegativeInt,
  tokenCapText,
} from './utils/settingDefinitions';

export type ClaudeModel = ModelOption;

export const CLAUDE_MODELS: ClaudeModel[] = [
  { id: 'claude-haiku-5-5', displayName: 'Claude Haiku 5.5', description: 'Fastest — great for quick tasks' },
  { id: 'claude-sonnet-5-5', displayName: 'Claude Sonnet 5.5', description: 'Balanced speed and capability (default)' },
  { id: 'claude-opus-5-5', displayName: 'Claude Opus 5.5', description: 'Most capable — best for complex reasoning' },
  { id: 'claude-fable-5-1', displayName: 'Claude Fable 5.1', description: 'Most capable — coding-focused, highest reasoning' },
];

/** Falls back to this when settings.defaultModel is unset — covers both fresh
 *  installs and installs with an empty string already persisted from before
 *  this default existed (DEFAULT_SETTINGS alone only helps fresh installs). */
export const DEFAULT_MODEL_ID = 'claude-sonnet-5-5';

export interface BojuBotSettings {
  /** Agent CLI for new sessions. Existing sessions keep the backend they started on. */
  backend: BackendId;
  /** Claude Code binary. Empty = auto-detect. */
  binaryPath: string;
  /** Antigravity (`agy`) binary. Empty = auto-detect. */
  agyBinaryPath: string;
  /** Antigravity model ID for --model — a base model ("gemini-3.8-flash"),
   *  never an effort variant (migrated on load). Empty = Antigravity's own default. */
  agyDefaultModel: string;
  /** Antigravity's `--effort` default. Separate from Claude's: the levels
   *  differ per model. '' = Default (flag left off). */
  agyDefaultEffort: string;
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
  /** Claude Code's `--effort` level for new turns. '' = Default (flag left off, the CLI decides). Only sent if the CLI lists it. */
  defaultEffort: string;
  /** Show reply text as it's generated (--include-partial-messages, when the CLI supports it). */
  streamPartialMessages: boolean;
  /** Sessions that got at least one reply from the agent. Drives the sponsorship milestones
   *  (src/utils/sponsorGate.ts). Seeded from saved sessions on first load (main.ts). */
  startedSessionCount: number;
  /** The sponsorship milestone last shown (10, 20, 30, 50, then every 50th), 0 if never. */
  lastSponsorMilestone: number;
  /** User opt-out of the periodic sponsorship welcome variant. Always hidden/off on white-labeled installs regardless of this value. */
  hideSponsorshipMessages: boolean;
  /** When the sponsorship welcome variant was last shown (ms since epoch), 0 if never. Enforces the 1-day minimum gap. */
  lastSponsorShownAt: number;
  /** When the thank-you card (#385) was last shown (ms since epoch), 0 if never. At most one a day. */
  lastThanksCardAt: number;
  /**
   * Optional white-label branding (display name, icon, art, greetings, links).
   * Absent → the stock BojuBot identity, byte-for-byte. Always read through
   * resolveBrand() — never trust the shallow settings merge to fill it in.
   */
  brand?: BrandConfig;
}

export const DEFAULT_SETTINGS: BojuBotSettings = {
  backend: 'claude-code',
  binaryPath: '',
  agyBinaryPath: '',
  agyDefaultModel: '',
  agyDefaultEffort: '',
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
  defaultEffort: '',
  streamPartialMessages: true,
  startedSessionCount: 0,
  lastSponsorMilestone: 0,
  hideSponsorshipMessages: false,
  lastSponsorShownAt: 0,
  lastThanksCardAt: 0,
};

/**
 * Control keys in the settings tab: settings fields, plus a few that map onto
 * them in get/setControlValue (inverted toggles, nested branding fields).
 */
type ControlKey = keyof BojuBotSettings | 'showContextFilePrompt' | `brand.${BrandField}`;
type Definition = SettingDefinition<ControlKey>;

/**
 * The settings tab. One set of definitions drives both renderers:
 *
 * - Obsidian 1.13+ renders getSettingDefinitions() itself (and indexes it for
 *   settings search). It calls it once from addSettingTab() and again on every
 *   update(), then keeps the result: opening the tab re-renders from the stored
 *   definitions. So anything that can change while the plugin runs is read
 *   lazily: `visible`/`disabled` predicates, `desc` getters, render callbacks.
 * - Older versions call display(), which draws the same definitions with the
 *   small fallback renderer in settingsFallback.ts.
 *
 * Every control reads and writes through getControlValue/setControlValue, so
 * the side effects of a change (notifying chat panels, reloading skills, the
 * logger) run on both paths.
 */
export class BojuBotSettingsTab extends PluginSettingTab {
  plugin: BojuBotPlugin;
  /** Cleanups returned by render callbacks the fallback renderer drew. */
  private fallbackCleanups: (() => void)[] = [];

  constructor(app: App, plugin: BojuBotPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem<ControlKey>[] {
    return [
      { type: 'group', items: this.generalSettings() },
      { type: 'group', heading: 'Context & memory', cls: 'bojubot-settings-context', items: this.contextSettings() },
      { type: 'group', heading: 'Permissions', items: this.permissionSettings() },
      { type: 'group', heading: 'UI bridge & commands', items: this.bridgeSettings() },
      { type: 'group', heading: 'Logging', items: this.loggingSettings() },
      // Everything here is optional. Blank fields fall back to the stock BojuBot
      // identity (see resolveBrand). Nothing is ever removed — an empty link just
      // hides its card. Greetings/tips overrides are data.json-only for now.
      { type: 'group', heading: 'Branding', items: this.brandingSettings() },
      { type: 'group', heading: 'Help & feedback', items: this.helpSettings() },
      // Ways to support the project, at the very bottom (#376). Never shown on
      // white-labeled builds: a downstream distributor handles its own funding.
      {
        type: 'group',
        heading: 'Support the project',
        visible: () => !isWhiteLabeled(this.plugin.brand),
        items: this.supportSettings(),
      },
    ];
  }

  getControlValue(key: string): unknown {
    const s = this.plugin.settings;
    const brandField = brandFieldOf(key);
    if (brandField === 'locked') return false; // only ever switched on, from unlocked
    if (brandField === 'applyToAssistantIdentity') return s.brand?.applyToAssistantIdentity ?? false;
    if (brandField) return s.brand?.[brandField] ?? '';
    switch (key) {
      case 'vaultTreeDepth': return String(s.vaultTreeDepth);
      case 'contextFileSizeCapTokens': return tokenCapText(s.contextFileSizeCapTokens);
      case 'canvasMaxChars': return String(s.canvasMaxChars);
      case 'showContextFilePrompt': return !s.skipContextFilePrompt;
      default: return (s as unknown as Record<string, unknown>)[key];
    }
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const s = this.plugin.settings;
    const brandField = brandFieldOf(key);
    if (brandField) {
      await this.setBrandField(brandField, value);
      return;
    }
    switch (key) {
      case 'vaultTreeDepth': s.vaultTreeDepth = parseInt(asText(value), 10); break;
      case 'contextFileSizeCapTokens': s.contextFileSizeCapTokens = parseNonNegativeInt(asText(value)); break;
      case 'canvasMaxChars': s.canvasMaxChars = parseNonNegativeInt(asText(value)); break;
      case 'showContextFilePrompt': s.skipContextFilePrompt = !value; break;
      case 'sessionStoragePath': s.sessionStoragePath = asText(value).trim(); break;
      case 'commandsFolder': s.commandsFolder = asText(value).trim(); break;
      case 'logFilePath': s.logFilePath = asText(value) || '_bojubot-debug.log'; break;
      default: (s as unknown as Record<string, unknown>)[key] = value;
    }
    await this.plugin.saveSettings();

    switch (key) {
      case 'permissionMode':
        this.plugin.notifyDefaultPermissionChanged();
        this.refreshState(); // "Persist full access" shows only in full access
        break;
      case 'minimalMode':
        this.rebuild(); // mutes the context rows, including the custom context file row
        break;
      case 'commandsFolder':
        if (s.registerSkillsAsCommands) this.plugin.reloadSkillCommands();
        break;
      case 'registerSkillsAsCommands':
        this.plugin.reloadSkillCommands();
        break;
      case 'logEnabled':
      case 'logFilePath':
      case 'logVerbosity':
        this.plugin.reconfigureLogger();
        break;
    }
  }

  /** Obsidian < 1.13 only. 1.13+ renders getSettingDefinitions() and never calls this. */
  display(): void {
    this.renderFallback();
  }

  hide(): void {
    this.runFallbackCleanups();
    super.hide();
  }

  // ── Re-rendering ──────────────────────────────────────────────────────────

  // 1.13+ renders from the definitions; older versions use the fallback renderer.
  // The version checks stay inline so the no-unsupported-api lint rule sees them.

  /** Re-render the rows, re-running render callbacks (and re-reading definitions). */
  private rebuild(): void {
    if (requireApiVersion('1.13.0')) this.update();
    else this.renderFallback();
  }

  /** Re-apply `visible` and `disabled` after a change outside a control. */
  private refreshState(): void {
    if (requireApiVersion('1.13.0')) this.refreshDomState();
    else this.renderFallback();
  }

  private renderFallback(): void {
    this.runFallbackCleanups();
    this.containerEl.empty();
    this.fallbackCleanups = renderSettingDefinitions(this.containerEl, this.getSettingDefinitions(), this);
  }

  private runFallbackCleanups(): void {
    const cleanups = this.fallbackCleanups;
    this.fallbackCleanups = [];
    for (const cleanup of cleanups) cleanup();
  }

  // ── General ───────────────────────────────────────────────────────────────

  private generalSettings(): Definition[] {
    const plugin = this.plugin;

    return [
      {
        name: 'Claude Code binary path',
        get desc() {
          return `Path to the Claude Code binary (claude). Leave blank to auto-detect. Detected version: ${formatCliVersion(plugin.getCapabilities('claude-code'), getBackend('claude-code').cliName)}.`;
        },
        control: { type: 'text', key: 'binaryPath', placeholder: '(Auto-detect)' },
      },
      {
        name: 'Antigravity CLI binary path',
        get desc() {
          return `Path to the Antigravity CLI (agy). Leave blank to auto-detect. Detected version: ${formatCliVersion(plugin.getCapabilities('antigravity'), getBackend('antigravity').cliName)}.`;
        },
        control: { type: 'text', key: 'agyBinaryPath', placeholder: '(Auto-detect)' },
      },
      {
        name: 'Send on enter',
        desc: 'Press Enter to send. Shift+Enter always inserts a newline.',
        control: { type: 'toggle', key: 'sendOnEnter' },
      },
      {
        name: 'Resume last session on startup',
        desc: 'Automatically resume the most recent session when the panel opens.',
        control: { type: 'toggle', key: 'resumeLastSession' },
      },
      {
        name: "Stream replies as they're written",
        desc: 'Show reply text word by word as the agent writes it, instead of a block at a time. For Claude, needs a Claude Code version that supports streaming. Takes effect on the next message.',
        control: { type: 'toggle', key: 'streamPartialMessages' },
      },
      {
        name: '@-mention file types',
        desc: 'File extensions for @-mention autocomplete, comma-separated. Use * to match all file types. Add a trailing comma to include extensionless files.',
        control: { type: 'text', key: 'atMentionExtensions', placeholder: '*' },
      },
    ];
  }

  // ── Context & memory ──────────────────────────────────────────────────────

  private contextSettings(): Definition[] {
    const settings = () => this.plugin.settings;
    // Minimal mode skips context injection, so these rows are muted (the
    // .bojubot-settings-context group styles its disabled rows).
    const muted = () => settings().minimalMode;

    return [
      {
        name: 'Context file path',
        desc: 'Vault-relative path to the context file injected at session start.',
        // Custom row: a control can't carry the "Open file" button
        render: (setting) => {
          setting
            .addText((text) =>
              text
                .setPlaceholder('_claude-context.md')
                .setValue(settings().contextFilePath)
                .onChange(async (value) => {
                  await this.setControlValue('contextFilePath', value);
                })
            )
            .addButton((btn) =>
              btn
                .setButtonText('Open file')
                .setTooltip('Open the context file in Obsidian for editing')
                .onClick(async () => {
                  let file = this.app.vault.getFileByPath(settings().contextFilePath);
                  if (!file) {
                    file = await this.app.vault.create(settings().contextFilePath, '');
                  }
                  await this.app.workspace.getLeaf(false).openFile(file);
                })
            )
            .setDisabled(muted());
          // setDisabled sets this on 1.13+; toggle it too in case older versions don't
          setting.settingEl.toggleClass('is-disabled', muted());
        },
      },
      {
        name: 'Vault tree depth',
        desc:
          'How many levels of your vault folder/file tree to include at the start of each session. ' +
          'This gives the agent a map of your vault structure (names only — no file contents are read). ' +
          'Deeper trees cost more tokens on the first message of each session. ' +
          '"Off" disables the tree entirely.',
        control: {
          type: 'dropdown',
          key: 'vaultTreeDepth',
          options: {
            '0': 'Off (default)',
            '1': '1 Level (root only)',
            '2': '2 Levels',
            '3': '3 Levels',
            '4': '4 Levels',
            '5': '5 Levels',
            '6': '6 Levels',
            '7': '7 Levels',
            '8': '8 Levels',
            '9': '9 Levels',
            '10': '10 Levels',
            '-1': 'Unlimited',
          },
          disabled: muted,
        },
      },
      {
        name: 'Autonomous memory',
        get desc() {
          return `The agent will autonomously update the context file (${settings().contextFilePath}) as it learns about your vault. Disable if you prefer to manage the context file manually, or if your vault is shared/public.`;
        },
        control: { type: 'toggle', key: 'autonomousMemory', disabled: muted },
      },
      {
        name: 'Memory file size limit (tokens)',
        desc:
          'When your context file exceeds this token count, the agent is instructed to compact it before the session ends — ' +
          'summarizing redundant entries and dropping outdated observations. ' +
          'Set to 0 to disable. Typical context files stay well under 4 000 tokens; set a limit if yours grows large over time.',
        control: { type: 'text', key: 'contextFileSizeCapTokens', placeholder: '0 (No limit)', disabled: muted },
      },
      {
        name: 'Minimal mode',
        desc:
          'Skip all context injection — no orientation, vault tree, context file, or active note. ' +
          'Reduces session start cost to zero. ' +
          'UI Bridge actions (open file, show notice, etc.) and vault queries will not work in this mode. ' +
          'Skills still work.',
        control: { type: 'toggle', key: 'minimalMode' },
      },
      {
        name: 'Inject split-pane files as context',
        desc: 'When notes are open side by side in split panes, include all visible file paths in the active note context.',
        control: { type: 'toggle', key: 'injectSplitPaneFiles', disabled: muted },
      },
      {
        name: 'Inject stacked tab files as context',
        desc: 'When multiple notes are open as stacked tabs in the same pane, include all open tab file paths in the active note context.',
        control: { type: 'toggle', key: 'injectStackedTabFiles', disabled: muted },
      },
      {
        name: 'Max canvas size (characters)',
        desc: 'Canvas files converted to text and injected as context will be truncated at this character limit. Set to 0 for no limit.',
        control: { type: 'text', key: 'canvasMaxChars', placeholder: '50000', disabled: muted },
      },
      {
        name: 'Export folder',
        desc: 'Vault-relative folder where "export session to vault" saves notes. Created automatically if it does not exist.',
        control: {
          type: 'folder',
          key: 'exportFolder',
          get placeholder() { return `${brandName()} exports`; },
        },
      },
      {
        name: 'Session storage path',
        get desc() {
          return 'Where session files are stored. ' +
            'Leave empty for the default location (Obsidian config folder/bojubot/sessions). ' +
            'Use a vault-relative path (e.g. _sessions) to track sessions in git alongside your notes, ' +
            'or an absolute path to store them outside the vault entirely. ' +
            `Restart ${brandName()} after changing this.`;
        },
        control: { type: 'folder', key: 'sessionStoragePath', placeholder: 'Default (Obsidian config folder/BojuBot/sessions)' },
      },
      {
        name: 'Skills folder',
        desc:
          'Folder containing your skill files (.md files). ' +
          'Leave empty for the default location (plugin dir/commands). ' +
          'Use a vault-relative path (e.g. _skills) to keep skills in your vault, ' +
          'or an absolute path. Skills reload each time you open the / menu.',
        control: { type: 'folder', key: 'commandsFolder', placeholder: 'Default (plugin dir/commands)' },
      },
      {
        name: 'Register skills as Ctrl+P commands',
        get desc() {
          return 'Expose each skill as an Obsidian command palette entry (prefixed "Skill: …"). ' +
            `Run "${brandName()}: Reload skills" from the palette after adding or removing skill files. ` +
            'Disable if you find the extra commands cluttering the palette.';
        },
        control: { type: 'toggle', key: 'registerSkillsAsCommands' },
      },
    ];
  }

  // ── Permissions ───────────────────────────────────────────────────────────

  private permissionSettings(): Definition[] {
    return [
      {
        name: 'Default permission mode',
        desc: 'The mode new sessions start in. Each session keeps its own mode; change an open session\'s mode with the permission button in the chat panel.',
        control: {
          type: 'dropdown',
          key: 'permissionMode',
          options: {
            restricted: 'Chat only — web access, no file system',
            standard: 'Standard — files + web, read-only shell (recommended)',
            readonly: 'Read only — no writes or shell commands',
            full: 'Full access — everything including bash',
          },
        },
      },
      {
        name: 'Persist full access between restarts',
        desc: 'When off, full access lasts until Obsidian restarts: then the default goes back to standard, and sessions left in full access reopen in standard.',
        visible: () => this.plugin.settings.permissionMode === 'full' || this.plugin.getEffectivePermissionMode() === 'full',
        control: { type: 'toggle', key: 'persistFullAccess' },
      },
      {
        name: 'Show context file setup prompt',
        desc: 'Show the setup modal on launch when no context file is found. Disable if you prefer to create the file manually.',
        control: { type: 'toggle', key: 'showContextFilePrompt' },
      },
    ];
  }

  // ── UI bridge & commands ──────────────────────────────────────────────────

  private bridgeSettings(): Definition[] {
    const settings = () => this.plugin.settings;
    return [
      {
        name: 'UI bridge',
        desc: 'Allow the agent to trigger Obsidian UI actions — open files, show notices, navigate headings. The agent is instructed to use these proactively after completing tasks.',
        control: { type: 'toggle', key: 'uiBridgeEnabled' },
      },
      {
        name: 'Prompt for unlisted commands',
        desc: 'When the agent tries to run a command not in the allowlist, show a prompt offering a one-time allow or the option to add it to the allowlist. If off, unlisted commands are hard-blocked with a notice.',
        control: { type: 'toggle', key: 'confirmUnlistedCommands' },
      },
      {
        name: 'Denied commands',
        get desc() {
          const n = settings().commandDenylist.length;
          return `${n} command${n === 1 ? '' : 's'} permanently denied. Add a denied command to the allowlist to re-enable it.`;
        },
        aliases: ['denylist'],
        visible: () => settings().commandDenylist.length > 0,
        render: (setting) => {
          setting.addButton(btn =>
            btn
              .setButtonText('Clear denylist')
              .setTooltip('Remove all permanent denials — commands will prompt again')
              .onClick(async () => {
                settings().commandDenylist = [];
                await this.plugin.saveSettings();
                this.refreshState();
              })
          );
        },
      },
      {
        name: 'Filter commands',
        desc: 'Obsidian commands the agent is allowed to run directly. ' +
          'Search and check commands to enable them. Allowlisted commands run immediately; others prompt for approval.',
        aliases: ['allowlist', 'allowed commands', 'command allowlist'],
        render: (setting) => this.renderCommandBrowser(setting),
      },
    ];
  }

  /**
   * The searchable command allowlist: a search field in the row, and the
   * checklist plus count on a full-width line below it. Returns a cleanup that
   * removes what it added, since Obsidian 1.13 reuses the row on update().
   */
  private renderCommandBrowser(setting: Setting): () => void {
    const settings = () => this.plugin.settings;
    let commandSearchQuery = '';

    setting.settingEl.addClass('bojubot-command-browser');
    const bodyEl = setting.settingEl.createDiv({ cls: 'bojubot-command-browser-body' });
    const commandListEl = bodyEl.createDiv({ cls: 'bojubot-command-list' });
    const commandCountEl = bodyEl.createEl('p', { cls: 'bojubot-command-count' });

    const allCommands: CommandInfo[] = Object.values(
      (this.app as unknown as AppInternal).commands.commands
    ).sort((a, b) => a.name.localeCompare(b.name));

    const updateCountText = () => {
      commandCountEl.setText(commandCountText(settings().commandAllowlist, allCommands));
    };

    const saveAllowlist = (after: () => void) => {
      void this.plugin.saveSettings().then(() => {
        this.plugin.notifyAllowlistChanged(settings().commandAllowlist);
        after();
      });
    };

    const renderCommandList = () => {
      commandListEl.empty();

      // Show orphaned entries (stored IDs not in current command registry) when not filtering
      if (!commandSearchQuery) {
        for (const id of orphanedCommandIds(settings().commandAllowlist, allCommands)) {
          const row = commandListEl.createDiv({ cls: 'bojubot-command-row bojubot-command-row--orphaned' });
          const checkbox = row.createEl('input', { type: 'checkbox' });
          checkbox.id = `bojubot-cmd-orphan-${id}`;
          checkbox.checked = true;
          checkbox.addEventListener('change', () => {
            settings().commandAllowlist = settings().commandAllowlist.filter(x => x !== id);
            saveAllowlist(() => {
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

      const filtered = filterCommands(allCommands, settings().commandAllowlist, commandSearchQuery);
      if (filtered.length === 0) {
        commandListEl.createEl('p', { text: 'No commands match your search.', cls: 'bojubot-command-empty' });
      } else {
        for (const cmd of filtered) {
          const row = commandListEl.createDiv({ cls: 'bojubot-command-row' });
          const checkbox = row.createEl('input', { type: 'checkbox' });
          checkbox.id = `bojubot-cmd-${cmd.id}`;
          checkbox.checked = settings().commandAllowlist.includes(cmd.id);
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
              if (!settings().commandAllowlist.includes(cmd.id)) {
                settings().commandAllowlist = [...settings().commandAllowlist, cmd.id];
              }
            } else {
              settings().commandAllowlist = settings().commandAllowlist.filter(id => id !== cmd.id);
            }
            saveAllowlist(updateCountText);
          });
          const label = row.createEl('label', { text: cmd.name, cls: 'bojubot-command-name' });
          label.htmlFor = `bojubot-cmd-${cmd.id}`;
        }
      }

      updateCountText();
    };

    setting.addSearch(search =>
      search
        .setPlaceholder('Search by name or ID…')
        .onChange(val => { commandSearchQuery = val; renderCommandList(); })
    );
    renderCommandList();

    return () => {
      bodyEl.remove();
      setting.settingEl.removeClass('bojubot-command-browser');
    };
  }

  // ── Logging ───────────────────────────────────────────────────────────────

  private loggingSettings(): Definition[] {
    return [
      {
        name: 'Enable debug log',
        desc: 'Write a debug log file to your vault. Useful for troubleshooting. Takes effect immediately.',
        control: { type: 'toggle', key: 'logEnabled' },
      },
      {
        name: 'Log file path',
        desc: 'Vault-relative path for the log file. Defaults to the plugin folder so it stays out of your vault.',
        control: { type: 'text', key: 'logFilePath', placeholder: 'Default (plugin folder/BojuBot-debug.log)' },
      },
      {
        name: 'Log verbosity',
        desc: 'Normal logs session events and errors. Verbose adds raw stream data and token breakdowns — useful for deep debugging but produces large log files.',
        control: { type: 'dropdown', key: 'logVerbosity', options: { normal: 'Normal', verbose: 'Verbose' } },
      },
    ];
  }

  // ── Branding ──────────────────────────────────────────────────────────────

  private brandingSettings(): Definition[] {
    const locked = () => !!this.plugin.settings.brand?.locked;
    const unlocked = () => !locked();
    return [
      {
        name: '',
        desc: 'Branding is locked and cannot be changed from this panel. Edit data.json directly (brand.locked) and reload the plugin to unlock it.',
        visible: locked,
        render: () => undefined, // description only
      },
      {
        name: 'Display name',
        desc: 'Shown in the panel title, welcome header, notices, and prompts. Blank = BojuBot. Reload the panel to apply everywhere.',
        visible: unlocked,
        control: { type: 'text', key: 'brand.name', placeholder: 'BojuBot' },
      },
      {
        name: 'Ribbon icon',
        desc: `Lucide icon ID for the ribbon and tab. Blank = ${DEFAULT_BRAND.icon}.`,
        visible: unlocked,
        control: {
          type: 'text',
          key: 'brand.icon',
          // Referencing the constant (not a literal) keeps this in sync with
          // DEFAULT_BRAND.icon and avoids a lint disable-comment for a literal
          // Lucide id that must stay lowercase (Obsidian's submission scan
          // flags eslint-disable comments on required rules directly).
          placeholder: DEFAULT_BRAND.icon,
        },
      },
      {
        name: 'Logo',
        desc: 'Data: URI or vault-relative image path for the header logo. Blank = bundled logo.',
        visible: unlocked,
        control: { type: 'text', key: 'brand.logo', placeholder: '(Bundled)' },
      },
      {
        name: 'Welcome sprite',
        desc: 'Data: URI or vault-relative image path for the welcome mascot. Blank = bundled sprite.',
        visible: unlocked,
        control: { type: 'text', key: 'brand.sprite', placeholder: '(Bundled)' },
      },
      this.brandLinkSetting('Documentation link', 'About-modal Documentation card. Blank = default.', 'doc', '(default)', unlocked),
      this.brandLinkSetting('Community link', 'About-modal community/Discord card. Blank = default.', 'community', '(default)', unlocked),
      this.brandLinkSetting('Source link', 'About-modal source-code card. Blank = default upstream repo.', 'source', '(default)', unlocked),
      this.brandLinkSetting('Support link', 'Support URL shown to the agent in the system prompt. Blank = default.', 'support', '(default)', unlocked, false),
      {
        name: 'Rebrand assistant identity',
        desc: 'Also use the display name in the system prompt the agent receives (how it refers to itself). Off = the assistant identity stays "BojuBot" even with a custom name.',
        visible: unlocked,
        control: { type: 'toggle', key: 'brand.applyToAssistantIdentity' },
      },
      {
        name: 'Lock branding',
        desc:
          'Hide the entire Brand settings section from casual users. This is not a security boundary — it can ' +
          'still be reverted by editing brand.locked in data.json directly.',
        visible: unlocked,
        control: { type: 'toggle', key: 'brand.locked' },
      },
    ];
  }

  private brandLinkSetting(
    name: string,
    desc: string,
    key: 'doc' | 'community' | 'source' | 'support',
    placeholder: string,
    visible: () => boolean,
    hideable = true,
  ): Definition {
    return {
      name,
      desc,
      visible,
      // Custom row: the text field plus a show/hide button
      render: (setting) => {
        setting.addText((text) =>
          text
            .setPlaceholder(placeholder)
            .setValue(this.plugin.settings.brand?.links?.[key] ?? '')
            .onChange(async (value) => {
              const trimmed = value.trim();
              const links = this.ensureBrandLinks();
              // A blank field means "use the default" — delete the key rather
              // than storing '', which resolveBrand treats as "explicitly
              // hidden". Hiding a card is a deliberate action via the button
              // below, not an incidental side effect of clearing the field.
              if (trimmed) links[key] = trimmed;
              else delete links[key];
              await this.saveBrand();
            })
        );
        if (!hideable) return;
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
              const links = this.ensureBrandLinks();
              if (isHidden) delete links[key];
              else links[key] = '';
              await this.saveBrand();
              this.rebuild();
            })
        );
      },
    };
  }

  private async setBrandField(field: BrandField, value: unknown): Promise<void> {
    const s = this.plugin.settings;
    if (field === 'locked') {
      if (!value) return; // one-way: unlocking means editing data.json
      (s.brand ??= {}).locked = true;
      await this.saveBrand();
      this.refreshState();
      return;
    }
    if (field === 'applyToAssistantIdentity') (s.brand ??= {}).applyToAssistantIdentity = Boolean(value);
    else (s.brand ??= {})[field] = asText(value);
    await this.saveBrand();
  }

  private ensureBrandLinks(): NonNullable<BrandConfig['links']> {
    const brand = (this.plugin.settings.brand ??= {});
    return (brand.links ??= {});
  }

  private async saveBrand(): Promise<void> {
    // Drop an empty brand object so an untouched install stays byte-for-byte.
    const b = this.plugin.settings.brand;
    if (b && Object.keys(b).length === 0) delete this.plugin.settings.brand;
    await this.plugin.saveSettings();
  }

  // ── Help & feedback ───────────────────────────────────────────────────────

  /** Where to get help or send feedback (#376). Uses the brand's links, so a
   *  white-labeled build points at its own docs and community. */
  private helpSettings(): Definition[] {
    const brand = () => this.plugin.brand;
    const linkSetting = (name: string, desc: () => string, label: string, url: () => string): Definition => ({
      name,
      get desc() { return desc(); },
      visible: () => !!url(),
      render: (setting) => {
        setting.addButton((btn) => btn.setButtonText(label).onClick(() => window.open(url(), '_blank')));
      },
    });
    return [
      linkSetting('Documentation', () => `Guides for every ${brand().name} feature, plus troubleshooting.`, 'Open', () => brand().links.doc),
      linkSetting('Get help on Discord', () => 'Ask questions and get help from me and other users.', 'Join', () => brand().links.community),
      // Both open the in-app report form (#382), pre-filled with version details
      {
        name: 'Report a problem',
        desc: 'Something not working? Tell me. I read every report.',
        render: (setting) => {
          setting.addButton((btn) => btn.setButtonText('Report').onClick(() => this.plugin.openReportForm({ type: 'bug' })));
        },
      },
      {
        name: 'Request a feature',
        desc: 'Ideas for making it better are always welcome.',
        render: (setting) => {
          setting.addButton((btn) => btn.setButtonText('Suggest').onClick(() => this.plugin.openReportForm({ type: 'feature' })));
        },
      },
    ];
  }

  // ── Support the project ───────────────────────────────────────────────────

  private supportSettings(): Definition[] {
    const linkSetting = (name: string, desc: string, label: string, url: string, cta = false): Definition => ({
      name,
      desc,
      render: (setting) => {
        setting.addButton((btn) => {
          btn.setButtonText(label).onClick(() => window.open(url, '_blank'));
          if (cta) btn.setCta();
        });
      },
    });
    return [
      {
        name: '',
        desc: "BojuBot is built and maintained by one person. If it saves you time, here's how you can help.",
        render: () => undefined, // description only
      },
      linkSetting('Buy me a coffee', 'A one-off or monthly tip.', 'Ko-fi', KOFI_URL, true),
      linkSetting('Sponsor on GitHub', 'Using BojuBot at work? Ask your company to sponsor it.', 'Sponsor', GITHUB_SPONSORS_URL),
      linkSetting('Star on GitHub', 'Free, and it helps other people find BojuBot.', 'Star', DEFAULT_BRAND.links.source),
      linkSetting('More ways to help', 'Reporting bugs, suggesting features, telling a friend.', 'Read', SUPPORT_PAGE_URL),
      {
        name: 'Hide the support message',
        desc: "Don't show the occasional support message on the welcome screen.",
        render: (setting) => {
          const thanks = setting.descEl.createSpan({ cls: 'bojubot-settings-thankyou', text: ' Thank you!' });
          thanks.toggle(this.plugin.settings.hideSponsorshipMessages);
          setting.addToggle((toggle) =>
            toggle
              .setValue(this.plugin.settings.hideSponsorshipMessages)
              .onChange(async (value) => {
                await this.setControlValue('hideSponsorshipMessages', value);
                // Same thank-you as the welcome screen's "I already donated" checkbox
                thanks.toggle(value);
              })
          );
        },
      },
    ];
  }
}
