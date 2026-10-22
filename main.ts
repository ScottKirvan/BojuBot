import { Plugin, Notice, addIcon, debounce } from 'obsidian';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ClaudeView, VIEW_TYPE_CLAUDE } from './src/ClaudeView';
import { SessionsView, VIEW_TYPE_SESSIONS } from './src/SessionsView';
import { BojuBotSettings, DEFAULT_SETTINGS, BojuBotSettingsTab, CLAUDE_MODELS, DEFAULT_MODEL_ID } from './src/settings';
import { ResolvedBrand, resolveBrand, setActiveBrand } from './src/brand';
import { BACKEND_IDS, DEFAULT_BACKEND_ID, getBackend, isBackendId } from './src/backends';
import type { AgentBackend, BackendId, ModelOption, PermissionMode } from './src/backends/types';
import { loadCustomModels } from './src/utils/customModels';
import { AgentVersion, formatVersionInfo, osLabel } from './src/utils/buildInfo';
import type { ReportType } from './src/utils/report';
import { ReportModal } from './src/modals/ReportModal';
import { isWhiteLabeled } from './src/brand';
import * as os from 'os';
import { loadAllSessions, resolveSessionsDir, StoredSession } from './src/utils/sessionStorage';
import { seedSponsorProgress } from './src/utils/sponsorGate';
import { CliCapabilities, UNKNOWN_CAPABILITIES, has } from './src/utils/cliCapabilities';
import { resolveShellEnv } from './src/utils/shellEnv';
import { buildCommandsReference, migrateRenamedCommands } from './src/utils/commandsReference';
import { currentLogPath, initLogger, log, warn } from './src/utils/logger';
import { AboutModal } from './src/modals/AboutModal';
import { MemoryAuditModal } from './src/modals/MemoryAuditModal';
import { ContextGenerationModal } from './src/ContextGenerationModal';
import { AppInternal } from './src/obsidianInternal';
import { resolveSkillsFolder, scanSkillFolder } from './src/SkillLoader';
import { PermissionPickerModal } from './src/modals/PermissionPickerModal';

interface BackendRuntime {
  binaryPath: string | null;
  caps: CliCapabilities;
  models: ModelOption[];
  probeSeq: number;
}

export default class BojuBotPlugin extends Plugin {
  settings: BojuBotSettings;
  /** Fully-resolved brand — always populated (loadSettings runs before use). */
  brand: ResolvedBrand = resolveBrand(undefined);
  shellEnv: Record<string, string> = {};
  /** Per-backend detection results. Capabilities and the model list stay
   *  unknown/empty until the async probe finishes (or if it fails). */
  private runtime: Record<BackendId, BackendRuntime> = Object.fromEntries(
    BACKEND_IDS.map(id => [id, { binaryPath: null, caps: UNKNOWN_CAPABILITIES, models: [], probeSeq: 0 }]),
  ) as Record<BackendId, BackendRuntime>;
  private skillCommandIds = new Set<string>();

  /** Recompute the resolved brand and mirror it to the module-level accessor. */
  refreshBrand(): void {
    this.brand = resolveBrand(this.settings?.brand);
    setActiveBrand(this.brand);
  }

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
    log(`${this.brand.name} loading — vault root:`, vaultRoot);

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file.path !== this.settings.contextFilePath) return;
        if (this.app.workspace.getActiveFile()?.path === file.path) return;
        this.showMemoryUpdateNotice();
      })
    );

    for (const id of BACKEND_IDS) this.runtime[id].binaryPath = getBackend(id).findBinary(this.binaryOverride(id));
    // Probe after the shell env resolves — on Mac/Linux the CLI may need its PATH.
    void resolveShellEnv().then(env => {
      this.shellEnv = env;
      for (const id of BACKEND_IDS) void this.refreshCliCapabilities(id);
    });

    if (!this.getBinaryPath(this.settings.backend)) {
      new Notice(`${this.brand.name}: ${this.getBackend().displayName} binary not found. Check plugin settings.`);
    }

    // Register custom icon — three S-curves suggesting bojubot folds (gyri).
    // Replace the path data here when the final logo SVG is ready.
    addIcon('bojubot', `
      <path d="M10,32 C24,12 38,12 50,32 C62,52 76,52 90,32"
            stroke="currentColor" fill="none" stroke-width="8" stroke-linecap="round"/>
      <path d="M10,50 C24,30 38,30 50,50 C62,70 76,70 90,50"
            stroke="currentColor" fill="none" stroke-width="8" stroke-linecap="round"/>
      <path d="M10,68 C24,48 38,48 50,68 C62,88 76,88 90,68"
            stroke="currentColor" fill="none" stroke-width="8" stroke-linecap="round"/>
    `);

    this.registerView(VIEW_TYPE_CLAUDE, (leaf) => new ClaudeView(leaf, this));
    this.registerView(VIEW_TYPE_SESSIONS, (leaf) => new SessionsView(leaf, this));

    this.addRibbonIcon(this.brand.icon, `Open ${this.brand.name} agent`, () => {
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
        (this.app as unknown as AppInternal).setting.openTabById('bojubot');
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

    // ID kept from the session manager pop-up so existing hotkeys keep working
    this.addCommand({
      id: 'show-session-history',
      name: 'Show sessions panel',
      callback: () => {
        void this.activateSessionsView();
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
      id: 'open-help',
      name: 'Open help & resources',
      callback: () => this.showAbout(),
    });

    // Deprecated alias of open-help, kept so existing hotkeys and allowlist
    // entries keep working. Left out of the agent's command reference.
    this.addCommand({
      id: 'show-about',
      name: 'About (deprecated, use open help & resources)',
      callback: () => this.showAbout(),
    });

    this.addCommand({
      id: 'change-permission-mode',
      name: 'Change permission mode',
      callback: () => {
        new PermissionPickerModal(this.app, this, this.getEffectivePermissionMode()).open();
      },
    });

    this.addCommand({
      id: 'switch-model',
      name: 'Switch model',
      callback: () => {
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
        if (existing.length) {
          (existing[0].view as ClaudeView).openModelPicker();
        } else {
          void this.activateView().then(() => {
            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
            if (leaves.length) (leaves[0].view as ClaudeView).openModelPicker();
          });
        }
      },
    });

    this.addCommand({
      id: 'switch-effort',
      name: 'Switch effort',
      // Hidden from the palette when the installed CLI doesn't support --effort.
      checkCallback: (checking) => {
        const caps = this.getCapabilities(this.getActiveBackendId());
        if (!has(caps, '--effort') || caps.effortLevels.length === 0) return false;
        if (checking) return true;
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
        if (existing.length) {
          (existing[0].view as ClaudeView).openEffortPicker();
        } else {
          void this.activateView().then(() => {
            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
            if (leaves.length) (leaves[0].view as ClaudeView).openEffortPicker();
          });
        }
        return true;
      },
    });

    this.addCommand({
      id: 'report-problem',
      name: 'Report a problem',
      callback: () => this.openReportForm(),
    });

    this.addCommand({
      id: 'show-plan-usage',
      name: 'Show plan usage',
      callback: () => {
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
        if (existing.length) {
          void this.app.workspace.revealLeaf(existing[0]);
          (existing[0].view as ClaudeView).showPlanUsage();
        } else {
          void this.activateView().then(() => {
            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
            if (leaves.length) (leaves[0].view as ClaudeView).showPlanUsage();
          });
        }
      },
    });

    this.addCommand({
      id: 'reload-skills',
      name: 'Reload skills',
      callback: () => {
        if (!this.settings.registerSkillsAsCommands) {
          new Notice(`${this.brand.name}: "Register skills as Ctrl+P commands" is disabled in settings.`);
          return;
        }
        this.reloadSkillCommands();
        new Notice(`${this.brand.name}: skills reloaded.`);
      }
    });

    this.addSettingTab(new BojuBotSettingsTab(this.app, this));

    // Last, after every addCommand() above: on a reload, Obsidian runs this
    // immediately because the layout is already ready (#395). Skill commands
    // are registered here, then the command reference is written.
    this.app.workspace.onLayoutReady(() => this.reloadSkillCommands());
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

  /** Reveal the Sessions panel, opening it in the left sidebar the first time. */
  async activateSessionsView(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_SESSIONS);
    if (existing.length) {
      await workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = workspace.getLeftLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE_SESSIONS, active: true });
      await workspace.revealLeaf(leaf);
    }
  }

  /** Redraw every open Sessions panel (sessions changed on disk). */
  refreshSessionsViews = debounce(() => {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SESSIONS)) {
      if (leaf.view instanceof SessionsView) leaf.view.refresh();
    }
  }, 150, true);

  /** Resolved sessions directory, honoring the sessionStoragePath setting. */
  getSessionsDir(): string {
    return resolveSessionsDir(this.getVaultRoot(), this.settings.sessionStoragePath, this.app.vault.configDir);
  }

  /** The chat panel, if one is open and loaded. */
  private chatView(): ClaudeView | undefined {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE)) {
      if (leaf.view instanceof ClaudeView) return leaf.view;
    }
    return undefined;
  }

  /** The chat panel, opening it first when needed. */
  private async ensureChatView(): Promise<ClaudeView | undefined> {
    await this.activateView();
    return this.chatView();
  }

  /** Session file ID open in the chat panel, for the Sessions panel's active marker. */
  getActiveChatSessionId(): string | undefined {
    return this.chatView()?.sessionFileId;
  }

  /** Open a session from the Sessions panel. */
  openSession(session: StoredSession): void {
    void this.ensureChatView().then(view => view?.openSession(session));
  }

  /** Save any session to the vault (Sessions panel menu). */
  exportSession(session: StoredSession): void {
    void this.ensureChatView().then(view => view?.exportSessionToVault(session));
  }

  /** A session was renamed in the Sessions panel: update the chat panel showing it. */
  onSessionRenamed(sessionFileId: string, title: string): void {
    this.chatView()?.onSessionRenamed(sessionFileId, title);
  }

  /** A session can't be deleted while a reply is running in it. */
  canDeleteSession(sessionFileId: string): boolean {
    const view = this.chatView();
    return !(view && view.sessionFileId === sessionFileId && view.isBusy);
  }

  /** A session was deleted: a chat panel showing it moves to a new session. */
  onSessionDeleted(sessionFileId: string): void {
    const view = this.chatView();
    if (view && view.sessionFileId === sessionFileId) view.startNewSession();
  }

  /** Estimated context a brand-new session would start with, for the Sessions panel. */
  async estimateFreshContextTokens(): Promise<number> {
    return (await this.chatView()?.estimateFreshContextTokens()) ?? 0;
  }

  /** Display name of a model ('' or undefined = the backend's default; undefined when the CLI picks). */
  modelDisplayName(backend: BackendId, modelId?: string): string | undefined {
    const id = modelId || this.getDefaultModel(backend);
    if (!id) return undefined;
    return this.getModels(backend).find(m => m.id === id)?.displayName ?? id;
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
        this.getBinaryPath(this.settings.backend) ?? '',
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
    const saved = await this.loadData() as Partial<BojuBotSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    // Installs from before started-session counting (#384): seed the count from
    // saved sessions that got a reply. Fresh installs (no data.json) start at 0.
    if (saved && saved.startedSessionCount === undefined) {
      const vaultRoot = this.getVaultRoot();
      const configDir = this.app.vault.configDir;
      const dir = resolveSessionsDir(vaultRoot, this.settings.sessionStoragePath, configDir);
      const started = loadAllSessions(vaultRoot, dir, configDir).filter(s => s.claudeSessionId).length;
      Object.assign(this.settings, seedSponsorProgress(started));
      await this.saveData(this.settings);
    }
    // `brand` is a nested object: the shallow Object.assign above copies the
    // whole reference from data.json (or leaves it undefined). resolveBrand()
    // is what fills every field field-by-field, so a partial brand never drops
    // sibling defaults.
    this.refreshBrand();
    if (!isBackendId(this.settings.backend)) this.settings.backend = DEFAULT_BACKEND_ID;
    // show-about was renamed open-help: carry allow/deny decisions over to the new ID
    const renamed = migrateRenamedCommands(this.settings.commandAllowlist, this.settings.commandDenylist);
    if (renamed.changed) {
      this.settings.commandAllowlist = renamed.allowlist;
      this.settings.commandDenylist = renamed.denylist;
      await this.saveData(this.settings);
    }
    // Migrate old hardcoded log paths → empty so the dynamic default takes over
    if (this.settings.logFilePath === '_bojubot-debug.log') {
      this.settings.logFilePath = '';
      await this.saveSettings();
    }
    // Resolve empty log path to a configDir-relative default at load time
    if (!this.settings.logFilePath) {
      this.settings.logFilePath = `${this.app.vault.configDir}/plugins/bojubot/bojubot-debug.log`;
    }
    // Migrate old hardcoded export folder → empty so the brand-aware dynamic
    // default (resolveExportFolder, applied at point of use) takes over
    if (this.settings.exportFolder === 'BojuBot Exports') {
      this.settings.exportFolder = '';
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.refreshBrand();
  }

  /** A backend by ID; defaults to the one new sessions use (settings.backend). */
  getBackend(id: BackendId = this.settings.backend): AgentBackend {
    return getBackend(id);
  }

  /** The backend of the session open in the panel, or the default when no panel is open. */
  getActiveBackendId(): BackendId {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (leaves.length) return (leaves[0].view as ClaudeView).getBackendId();
    return this.settings.backend;
  }

  getBinaryPath(id: BackendId): string | null {
    return this.runtime[id].binaryPath;
  }

  /** What the installed CLI supports. Unknown until its probe finishes (or if it fails). */
  getCapabilities(id: BackendId): CliCapabilities {
    return this.runtime[id].caps;
  }

  /** Models for the picker: Claude Code's built-in list plus custom-models.json,
   *  or what the CLI itself listed (empty until its probe finishes). */
  getModels(id: BackendId): ModelOption[] {
    if (id !== 'claude-code') return this.runtime[id].models;
    const customModelsPath = join(this.getVaultRoot(), this.app.vault.configDir, 'plugins', 'bojubot', 'custom-models.json');
    return [...CLAUDE_MODELS, ...loadCustomModels(customModelsPath)];
  }

  /** Global default model for a backend. '' = let the CLI choose (Antigravity only). */
  getDefaultModel(id: BackendId): string {
    return id === 'claude-code' ? (this.settings.defaultModel || DEFAULT_MODEL_ID) : this.settings.agyDefaultModel;
  }

  setDefaultModel(id: BackendId, model: string): void {
    if (id === 'claude-code') this.settings.defaultModel = model;
    else this.settings.agyDefaultModel = model;
  }

  private binaryOverride(id: BackendId): string {
    return id === 'claude-code' ? this.settings.binaryPath : this.settings.agyBinaryPath;
  }

  /** Re-detect a backend's binary (e.g. after the user installs it) and re-probe it. */
  detectBinary(id: BackendId): string | null {
    const binary = getBackend(id).findBinary(this.binaryOverride(id));
    this.runtime[id].binaryPath = binary;
    void this.refreshCliCapabilities(id);
    return binary;
  }

  /**
   * Open the Report a problem form (#382) with everything pre-filled: the
   * version line, the open session's agent and model, and an error when the
   * form was opened from an error card. All of it stays editable.
   */
  openReportForm(extra: { type?: ReportType; errorText?: string } = {}): void {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    const session = leaves.length ? (leaves[0].view as ClaudeView).sessionSummary() : '';
    const details = [
      formatVersionInfo(this.brand.name, this.manifest.version, __BUILD_INFO__, this.installedAgentVersions(), osLabel(process.platform, os.release())),
      session,
      extra.errorText ? `Error: ${extra.errorText}` : '',
    ].filter(Boolean).join('\n');
    new ReportModal(this.app, {
      sourceRepoUrl: this.brand.links.source,
      details,
      type: extra.type,
      logPath: currentLogPath(),
      showPrivacyLink: !isWhiteLabeled(this.brand),
    }).open();
  }

  /** Agent CLIs that are installed and have reported a version, for the Help &
   *  resources dialog. Agents that aren't installed are left out (#377). */
  installedAgentVersions(): AgentVersion[] {
    return BACKEND_IDS
      .filter(id => this.runtime[id].binaryPath && this.runtime[id].caps.version)
      .map(id => ({ name: getBackend(id).displayName, version: this.runtime[id].caps.version ?? "" }));
  }

  /** Settings changed the backend for new sessions. */
  onDefaultBackendChanged(): void {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (leaves.length) (leaves[0].view as ClaudeView).onDefaultBackendChanged();
  }

  /**
   * Re-probe a backend's binary. Call after (re-)detecting it. Capabilities
   * reset to unknown immediately, so turns started while the probe runs use the
   * default args; a stale probe (binary changed again) is discarded.
   */
  async refreshCliCapabilities(id: BackendId): Promise<void> {
    const rt = this.runtime[id];
    const seq = ++rt.probeSeq;
    rt.caps = UNKNOWN_CAPABILITIES;
    const binary = rt.binaryPath;
    if (!binary) return;
    const backend = getBackend(id);
    const env = Object.keys(this.shellEnv).length ? this.shellEnv : { ...process.env } as Record<string, string>;
    const caps = await backend.probe(binary, env, this.getVaultRoot());
    if (seq !== rt.probeSeq) return;
    rt.caps = caps;
    if (backend.listModels) {
      try {
        const models = await backend.listModels(binary, env, this.getVaultRoot());
        if (seq !== rt.probeSeq) return;
        rt.models = models;
      } catch (e) {
        warn(`${backend.displayName} model list failed:`, e instanceof Error ? e.message : String(e));
      }
    }
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (leaves.length) (leaves[0].view as ClaudeView).onCliCapabilitiesChanged(id);
  }

  notifyPermissionChanged(): void {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (leaves.length) (leaves[0].view as ClaudeView).onSettingsChanged();
  }

  getEffectivePermissionMode(): PermissionMode {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
    if (leaves.length) return (leaves[0].view as ClaudeView).getEffectivePermissionMode();
    return this.settings.permissionMode;
  }

  private showMemoryUpdateNotice(): void {
    const notice = new Notice('', 8000);
    notice.messageEl.empty();
    notice.messageEl.createSpan({ text: 'Memory file was modified by Claude. ' });
    const link = notice.messageEl.createEl('a', { cls: 'bojubot-notice-link', text: 'Review', href: '#' });
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
    return resolveSkillsFolder(this.getVaultRoot(), this.settings.commandsFolder ?? '');
  }

  /** Re-register skill commands, then rewrite the command reference so it lists them (#395). */
  reloadSkillCommands() {
    this.registerSkillCommands();
    this.generateCommandsFile();
  }

  private registerSkillCommands() {
    // Remove all previously registered template commands
    const appInternal = this.app as unknown as AppInternal;
    for (const id of this.skillCommandIds) {
      appInternal.commands.removeCommand(id);
    }
    this.skillCommandIds.clear();

    if (!this.settings.registerSkillsAsCommands) return;

    const folder = this.resolveCommandsFolder();

    try {
      const skillEntries = scanSkillFolder(folder);
      for (const { filePath, name } of skillEntries) {
        const commandId = `skill-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const fullId = `bojubot:${commandId}`;

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
      log(`Registered ${skillEntries.length} skill(s) in Ctrl+P`);
    } catch (e) {
      warn('Failed to register skill commands:', e);
    }
  }

  /**
   * Write the command reference the agent reads before using run-command.
   * Must run after every command is registered (#395): at the end of onload()
   * and after each skill reload, never earlier.
   */
  generateCommandsFile() {
    try {
      const outPath = join(this.getVaultRoot(), this.app.vault.configDir, 'plugins', 'bojubot', 'obsidian-commands.md');
      const commands = Object.values((this.app as unknown as AppInternal).commands.commands);
      writeFileSync(outPath, buildCommandsReference(commands, new Date().toISOString()), 'utf8');
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
