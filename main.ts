import { Plugin, Notice, addIcon, debounce, WorkspaceLeaf } from 'obsidian';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ClaudeView, VIEW_TYPE_CLAUDE } from './src/ClaudeView';
import { SessionsView, VIEW_TYPE_SESSIONS } from './src/SessionsView';
import type { CustomSessionOptions } from './src/modals/CustomSessionModal';
import { ChatPanelState, PanelInfo, panelForSession, pickTargetPanel, planNewSession, planOpenSession } from './src/utils/chatPanels';
import { SessionStatus, statusNotice } from './src/utils/sessionStatus';
import { BojuBotSettings, DEFAULT_SETTINGS, BojuBotSettingsTab, CLAUDE_MODELS, DEFAULT_MODEL_ID } from './src/settings';
import { ResolvedBrand, resolveBrand, setActiveBrand } from './src/brand';
import { BACKEND_IDS, DEFAULT_BACKEND_ID, getBackend, isBackendId, sentenceStart } from './src/backends';
import type { AgentBackend, BackendId, ModelOption, PermissionMode } from './src/backends/types';
import { loadCustomModels } from './src/utils/customModels';
import { migrateVariantModel } from './src/utils/agentModels';
import { AgentVersion, formatVersionInfo, osLabel } from './src/utils/buildInfo';
import type { ReportType } from './src/utils/report';
import { ReportModal } from './src/modals/ReportModal';
import { isWhiteLabeled } from './src/brand';
import * as os from 'os';
import { countSessionsIn, loadAllSessions, moveSessionFiles, resolveSessionsDir, StoredSession } from './src/utils/sessionStorage';
import { MoveSessionsModal } from './src/modals/MoveSessionsModal';
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
  /** When each chat panel was last used, for picking the panel commands act on (#399). */
  private chatLastActive = new WeakMap<WorkspaceLeaf, number>();
  /** The status notice showing for each chat panel, replaced when its status moves on. */
  private statusNotices = new WeakMap<ClaudeView, Notice>();

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
    this.sessionsDirInUse = this.getSessionsDir();

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
      new Notice(`${this.brand.name}: ${sentenceStart(this.getBackend().cliPhrase)} wasn't found. Check plugin settings.`);
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

    // The chat panel used most recently is the one commands act on (#399)
    this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
      if (leaf && leaf.view.getViewType() === VIEW_TYPE_CLAUDE) {
        this.markChatActive(leaf);
        this.refreshSessionsViews();
      }
      this.markChatsViewed();
    }));
    // Switching tabs or opening a sidebar shows a panel: its unseen reply counts as seen
    this.registerEvent(this.app.workspace.on('layout-change', () => this.markChatsViewed()));

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
        void this.newSession();
      }
    });

    this.addCommand({
      id: 'new-chat-tab',
      name: 'Open new chat tab',
      callback: () => {
        void this.newSession({ forceNewTab: true });
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
        void this.withTargetChatView(view => view.injectSelectionContext(selection, sourceName));
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
        void this.withTargetChatView(view => void view.refreshSessionContext());
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
        void this.withTargetChatView(view => view.openModelPicker());
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
        void this.withTargetChatView(view => view.openEffortPicker());
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
        void this.withTargetChatView(view => view.showPlanUsage());
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

  // ── Chat panels (#399) ───────────────────────────────────────────────────
  // Several chat panels can be open at once, one session each. Commands act on
  // the target panel: the chat panel used most recently (focused, or made the
  // active leaf), falling back to the first one open. Settings changes go to
  // every panel. A session is never open in two panels.

  /** Record that a chat panel was just used. */
  markChatActive(leaf: WorkspaceLeaf): void {
    this.chatLastActive.set(leaf, Date.now());
  }

  /** Every chat panel's leaf, loaded or not. */
  private chatLeaves(): WorkspaceLeaf[] {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);
  }

  /** Every loaded chat panel. A background tab Obsidian hasn't loaded yet has none. */
  chatViews(): ClaudeView[] {
    return this.chatLeaves().map(l => l.view).filter((v): v is ClaudeView => v instanceof ClaudeView);
  }

  /** Session open in a chat panel; read from its saved state while it's still unloaded. */
  private leafSessionId(leaf: WorkspaceLeaf): string | undefined {
    if (leaf.view instanceof ClaudeView) return leaf.view.sessionFileId;
    const id = leaf.getViewState().state?.sessionFileId;
    return typeof id === 'string' ? id : undefined;
  }

  private panelInfos(): PanelInfo<WorkspaceLeaf>[] {
    return this.chatLeaves().map(leaf => ({
      panel: leaf,
      lastActive: this.chatLastActive.get(leaf) ?? 0,
      sessionFileId: this.leafSessionId(leaf),
    }));
  }

  /** The chat panel commands act on, if any is open. */
  targetChatLeaf(): WorkspaceLeaf | undefined {
    return pickTargetPanel(this.panelInfos());
  }

  /** The target chat panel's view, without opening or loading anything. */
  private targetChatView(): ClaudeView | undefined {
    const leaf = this.targetChatLeaf();
    if (leaf?.view instanceof ClaudeView) return leaf.view;
    return this.chatViews()[0];
  }

  /** The chat panel a session is open in (never `exclude`). */
  leafForSession(sessionFileId: string, exclude?: WorkspaceLeaf): WorkspaceLeaf | undefined {
    return panelForSession(this.panelInfos(), sessionFileId, exclude);
  }

  /** True when another loaded chat panel exists besides `view`. */
  otherChatViewOpen(view: ClaudeView): boolean {
    return this.chatViews().some(v => v !== view);
  }

  /** Load (if it's a background tab) and reveal a chat panel; its view. */
  private async showChatLeaf(leaf: WorkspaceLeaf, reveal = true): Promise<ClaudeView | undefined> {
    await leaf.loadIfDeferred();
    if (reveal) await this.app.workspace.revealLeaf(leaf);
    this.markChatActive(leaf);
    return leaf.view instanceof ClaudeView ? leaf.view : undefined;
  }

  /**
   * Open a new chat panel: a new tab next to `near` (same sidebar, or the main
   * area), or in the right sidebar when no chat panel is open yet. `state`
   * picks its session; empty = the usual first session (Resume last session).
   */
  async openChatTab(state: ChatPanelState = {}, near?: WorkspaceLeaf): Promise<ClaudeView | undefined> {
    const { workspace } = this.app;
    const root = near?.getRoot();
    let leaf: WorkspaceLeaf | null;
    if (!near || root === workspace.rightSplit) leaf = workspace.getRightLeaf(false);
    else if (root === workspace.leftSplit) leaf = workspace.getLeftLeaf(false);
    else leaf = workspace.getLeaf('tab');
    if (!leaf) return undefined;
    await leaf.setViewState({ type: VIEW_TYPE_CLAUDE, active: true, state: { ...state } });
    const view = await this.showChatLeaf(leaf);
    await view?.ensureInitialized(state);
    return view;
  }

  /** Reveal the target chat panel, opening one when none is open. */
  async activateView(): Promise<ClaudeView | undefined> {
    const leaf = this.targetChatLeaf();
    if (leaf) return this.showChatLeaf(leaf);
    return this.openChatTab();
  }

  /** Run `fn` on the target chat panel, revealing it (and opening one if needed). */
  private async withTargetChatView(fn: (view: ClaudeView) => void, reveal = true): Promise<void> {
    const leaf = this.targetChatLeaf();
    const view = leaf ? await this.showChatLeaf(leaf, reveal) : await this.openChatTab();
    if (view) fn(view);
  }

  /**
   * Open a stored session (#399). Already open in a panel: reveal that panel.
   * Otherwise it loads into `from` (or the target panel) when that panel is
   * free, or opens in a new tab so the panel's own session keeps going.
   */
  async openSession(session: StoredSession, opts: { from?: ClaudeView; forceNewTab?: boolean } = {}): Promise<void> {
    const preferredLeaf = opts.from?.leaf ?? this.targetChatLeaf();
    const preferred = opts.from ?? (preferredLeaf ? await this.showChatLeaf(preferredLeaf, false) : undefined);
    const plan = planOpenSession<WorkspaceLeaf>({
      openIn: this.leafForSession(session.id),
      preferred: preferredLeaf,
      preferredReusable: !!preferred?.isReusable(),
      forceNewTab: opts.forceNewTab,
    });
    if (plan.kind === 'reveal') {
      await this.showChatLeaf(plan.panel);
    } else if (plan.kind === 'load' && preferred) {
      await this.showChatLeaf(plan.panel);
      preferred.loadSessionHere(session);
    } else {
      await this.openChatTab({ sessionFileId: session.id }, preferredLeaf);
    }
  }

  /**
   * New session in the target panel. A panel with a reply running keeps it
   * running and the new session opens in a new tab; so does `forceNewTab`
   * (Ctrl/Cmd-click on +, "Open new chat tab").
   */
  async newSession(opts: { custom?: CustomSessionOptions; forceNewTab?: boolean; near?: WorkspaceLeaf } = {}): Promise<void> {
    const targetLeaf = opts.near ?? this.targetChatLeaf();
    const target = targetLeaf ? await this.showChatLeaf(targetLeaf, false) : undefined;
    const plan = planNewSession({
      target,
      busy: !!target?.isBusy,
      pristine: !!target?.isPristine,
      forceNewTab: opts.forceNewTab,
      custom: !!opts.custom,
    });
    if (plan.kind === 'new-tab') {
      const view = await this.openChatTab({ blank: true }, targetLeaf);
      view?.startNewSession(opts.custom);
      view?.focusInput();
    } else {
      await this.showChatLeaf(plan.panel.leaf);
      if (plan.kind === 'start') plan.panel.startNewSession(opts.custom);
      plan.panel.focusInput();
    }
  }

  clearCurrentSession() {
    this.targetChatView()?.clearCurrentSession();
  }

  /** Hide or show the target chat panel: collapses or expands its sidebar. */
  togglePanel() {
    const leaf = this.targetChatLeaf();
    if (!leaf) { void this.activateView(); return; }
    const { workspace } = this.app;
    const root = leaf.getRoot();
    const side = root === workspace.rightSplit ? workspace.rightSplit : root === workspace.leftSplit ? workspace.leftSplit : null;
    if (side && !side.collapsed && leaf.view.containerEl.isShown()) side.collapse();
    else void this.showChatLeaf(leaf);
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

  /** The sessions folder before the storage path setting was last edited. */
  private sessionsDirInUse = '';

  /**
   * Settings closed: if the session storage path changed and the old folder
   * still has sessions, offer to move them so they don't drop out of the
   * Sessions panel.
   */
  checkSessionsDirChanged(): void {
    const from = this.sessionsDirInUse;
    const to = this.getSessionsDir();
    this.sessionsDirInUse = to;
    if (!from || from === to) return;
    const count = countSessionsIn(from);
    if (!count) return;
    new MoveSessionsModal(this.app, count, from, to, () => {
      const { moved, skipped } = moveSessionFiles(from, to);
      log('Sessions moved', from, '->', to, moved, 'moved,', skipped.length, 'files left');
      new Notice(skipped.length
        ? `${this.brand.name}: moved ${moved} of ${count} sessions. ${skipped.length} files stayed in the old folder because the new one already has files with those names.`
        : `${this.brand.name}: moved ${moved} sessions.`, 8000);
      this.refreshSessionsViews();
    }).open();
  }

  /** Resolved sessions directory, honoring the sessionStoragePath setting. */
  getSessionsDir(): string {
    return resolveSessionsDir(this.getVaultRoot(), this.settings.sessionStoragePath, this.app.vault.configDir);
  }

  /** Session file ID open in the target chat panel, for the Sessions panel's active marker. */
  getActiveChatSessionId(): string | undefined {
    const leaf = this.targetChatLeaf();
    return leaf ? this.leafSessionId(leaf) : undefined;
  }

  // ── Live status (#399) ─────────────────────────────────────────────────────

  /** True when a chat panel is on screen: its tab is showing and its sidebar isn't collapsed. */
  isChatVisible(view: ClaudeView): boolean {
    const { workspace } = this.app;
    const root = view.leaf.getRoot();
    if (root === workspace.leftSplit && workspace.leftSplit.collapsed) return false;
    if (root === workspace.rightSplit && workspace.rightSplit.collapsed) return false;
    return view.containerEl.isShown();
  }

  private markChatsViewed(): void {
    for (const view of this.chatViews()) view.markViewed();
  }

  /** Live status of every session open in a chat panel. */
  getSessionStatuses(): Map<string, SessionStatus> {
    const statuses = new Map<string, SessionStatus>();
    for (const view of this.chatViews()) {
      if (view.sessionFileId) statuses.set(view.sessionFileId, view.sessionStatus);
    }
    return statuses;
  }

  /** A chat panel's status changed: update the Sessions panel's dots, and tell
   *  the user when a session they can't see finishes or needs them. */
  onChatStatusChanged(view: ClaudeView, prev: SessionStatus, next: SessionStatus): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SESSIONS)) {
      if (leaf.view instanceof SessionsView) leaf.view.updateStatuses();
    }
    // A notice about the old status is out of date now (e.g. the wait was answered)
    this.statusNotices.get(view)?.hide();
    this.statusNotices.delete(view);
    const text = statusNotice(prev, next, this.isChatVisible(view), view.getDisplayText());
    if (!text) return;
    const notice = new Notice('', next === 'waiting' ? 0 : 8000);
    this.statusNotices.set(view, notice);
    notice.messageEl.empty();
    notice.messageEl.addClass('bojubot-status-notice');
    notice.messageEl.createSpan({ text: `${text}. ` });
    notice.messageEl.createEl('a', { cls: 'bojubot-notice-link', text: 'Show', href: '#' });
    notice.messageEl.addEventListener('click', (e) => {
      e.preventDefault();
      notice.hide();
      if (view.leaf.view === view) void this.showChatLeaf(view.leaf);
    });
  }

  /** Session file IDs open in any chat panel. */
  getOpenSessionIds(): Set<string> {
    const ids = new Set<string>();
    for (const leaf of this.chatLeaves()) {
      const id = this.leafSessionId(leaf);
      if (id) ids.add(id);
    }
    return ids;
  }

  /** Save any session to the vault (Sessions panel menu). */
  exportSession(session: StoredSession): void {
    void this.withTargetChatView(view => view.exportSessionToVault(session), false);
  }

  /** A session was renamed in the Sessions panel: update the chat panel showing it. */
  onSessionRenamed(sessionFileId: string, title: string): void {
    for (const view of this.chatViews()) view.onSessionRenamed(sessionFileId, title);
  }

  /** A session can't be deleted while a reply is running in it. */
  canDeleteSession(sessionFileId: string): boolean {
    return !this.chatViews().some(v => v.sessionFileId === sessionFileId && v.isBusy);
  }

  /** A session was deleted: a chat panel showing it moves to a new session. */
  onSessionDeleted(sessionFileId: string): void {
    for (const view of this.chatViews()) {
      if (view.sessionFileId === sessionFileId) view.startNewSession();
    }
  }

  /** Estimated context a brand-new session would start with, for the Sessions panel. */
  async estimateFreshContextTokens(): Promise<number> {
    return (await this.targetChatView()?.estimateFreshContextTokens()) ?? 0;
  }

  /** Display name of a model ('' or undefined = the backend's default; undefined when the CLI picks). */
  modelDisplayName(backend: BackendId, modelId?: string): string | undefined {
    const id = modelId || this.getDefaultModel(backend);
    if (!id) return undefined;
    const models = this.getModels(backend);
    const found = models.find(m => m.id === id);
    if (found) return found.displayName;
    // An old effort-variant ID ("gemini-3.8-flash-high") names its base model (#402)
    const base = getBackend(backend).effortVariants ? migrateVariantModel(id).model : id;
    return models.find(m => m.id === base)?.displayName ?? id;
  }

  exportConversation() {
    this.targetChatView()?.exportConversation();
  }

  exportToVault() {
    void this.withTargetChatView(view => view.exportToVault());
  }

  copyLastResponse() {
    this.targetChatView()?.copyLastResponse();
  }

  focusChatInput() {
    void this.withTargetChatView(view => view.focusInput());
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
    // Antigravity models used to be saved as effort variants ("gemini-3.8-flash-high"):
    // keep the base model and carry the level over as Antigravity's default effort (#402)
    const agyModel = migrateVariantModel(this.settings.agyDefaultModel ?? '');
    if (agyModel.level) {
      this.settings.agyDefaultModel = agyModel.model;
      if (!this.settings.agyDefaultEffort) this.settings.agyDefaultEffort = agyModel.level;
      await this.saveData(this.settings);
    }
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

  /** The backend of the target chat panel's session, or the default when no panel is open. */
  getActiveBackendId(): BackendId {
    return this.targetChatView()?.getBackendId() ?? this.settings.backend;
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

  /** Global default effort level for a backend; '' = Default (flag left off). */
  getDefaultEffort(id: BackendId): string {
    return (id === 'claude-code' ? this.settings.defaultEffort : this.settings.agyDefaultEffort) ?? '';
  }

  setDefaultEffort(id: BackendId, level: string): void {
    if (id === 'claude-code') this.settings.defaultEffort = level;
    else this.settings.agyDefaultEffort = level;
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
    const session = this.targetChatView()?.sessionSummary() ?? '';
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
      .map(id => ({ name: getBackend(id).cliName, version: this.runtime[id].caps.version ?? "" }));
  }

  /** Settings changed the backend for new sessions. */
  onDefaultBackendChanged(): void {
    for (const view of this.chatViews()) view.onDefaultBackendChanged();
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
        warn(`${backend.cliName} model list failed:`, e instanceof Error ? e.message : String(e));
      }
    }
    for (const view of this.chatViews()) view.onCliCapabilitiesChanged(id);
  }

  /** A global default model or effort changed: every chat panel's indicator follows. */
  refreshChatIndicators(): void {
    for (const view of this.chatViews()) view.refreshIndicators();
  }

  /**
   * A permission picker chose a mode (it's already the new default). It applies
   * to the session in `view` — the panel whose toolbar was used, or the target
   * panel for the Ctrl+P picker — and to no other panel's session.
   */
  notifyPermissionPicked(mode: PermissionMode, view: ClaudeView | undefined = this.targetChatView()): void {
    for (const v of this.chatViews()) {
      if (v === view) v.onPermissionModePicked(mode);
      else v.onDefaultPermissionModeChanged();
    }
  }

  /** The default for new sessions changed in settings; open sessions keep their own mode. */
  notifyDefaultPermissionChanged(): void {
    for (const view of this.chatViews()) view.onDefaultPermissionModeChanged();
  }

  /** Sessions put in Full access since Obsidian started. In memory only, keyed by
   *  session, so it can't apply to any other session. */
  private fullAccessSessions = new Set<string>();

  /** Whether a session saved in Full access may reopen in it: always when Full access
   *  persists between restarts, otherwise only if it was given Full access in this run. */
  keepsFullAccess(sessionFileId: string): boolean {
    return this.settings.persistFullAccess || this.fullAccessSessions.has(sessionFileId);
  }

  noteFullAccess(sessionFileId: string): void {
    this.fullAccessSessions.add(sessionFileId);
  }

  /** The target chat panel's permission mode, or the global default when no panel is open. */
  getEffectivePermissionMode(): PermissionMode {
    return this.targetChatView()?.getEffectivePermissionMode() ?? this.settings.permissionMode;
  }

  private showMemoryUpdateNotice(): void {
    const notice = new Notice('', 8000);
    notice.messageEl.empty();
    notice.messageEl.createSpan({ text: 'Memory file was modified by the agent. ' });
    const link = notice.messageEl.createEl('a', { cls: 'bojubot-notice-link', text: 'Review', href: '#' });
    link.addEventListener('click', (e) => {
      e.preventDefault();
      notice.hide();
      new MemoryAuditModal(this.app, this).open();
    });
  }

  async triggerMemoryAudit(): Promise<void> {
    // A busy panel keeps its reply running and audits in a new tab (ClaudeView.auditMemoryFile)
    await this.withTargetChatView(view => view.auditMemoryFile());
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
            void this.withTargetChatView(view => view.executeSkill(filePath));
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
    for (const view of this.chatViews()) view.injectAllowlistUpdate(newAllowlist);
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
