import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import type { AgentBackend, BackendId, PermissionMode, PermissionDenial, TokenUsage } from './backends/types';
import { killProcess } from './backends/process';
import { resolveSpawnCwd } from './backends/modes';
import { VaultQuery } from './QueryHandler';
import { BOJU_PREFIX } from './constants';
import { extractActions, BojuBotAction } from './utils/actionParser';
import {
  StoredSession,
  ChatMessage,
  saveSession,
  saveSessionAtTop,
  loadSessionFile,
  updateStoredSession,
  hasReadableHistory,
  loadHistory,
  sessionBackend,
  appendTranscript,
  transcriptEntries,
  titleFromPrompt,
} from './utils/sessionStorage';
import { log } from './utils/logger';
import type { ApiError } from './utils/apiError';
import { CliCapabilities, UNKNOWN_CAPABILITIES } from './utils/cliCapabilities';
import { resolveEffort } from './utils/effort';
import { composeStreamingText } from './utils/streamPreview';
import { preserveUserFields } from './utils/sessionList';

// ── Host interface ───────────────────────────────────────────────────────────

export interface SessionCoordinatorHost {
  getBackend(id: BackendId): AgentBackend;
  getBinaryPath(id: BackendId): string | null;
  /** Backend for new sessions that don't pick one. Optional — omitted means Claude Code. */
  getDefaultBackend?(): BackendId;
  getVaultRoot(): string;
  getConfigDir(): string;
  getEnv(): Record<string, string>;
  /** Default permission mode for new sessions. A session never follows it once started. */
  getPermissionMode(): PermissionMode;
  /** False when a session saved in Full access must reopen in Standard (Full access
   *  isn't set to persist between restarts and wasn't given to this session since
   *  the last one). Optional — omitted means the saved mode is kept. */
  keepsFullAccess?(sessionFileId: string): boolean;
  /** Told whenever a session is put in Full access, so keepsFullAccess can answer for it. */
  noteFullAccess?(sessionFileId: string): void;
  /** Global default model for the backend; '' = let the CLI choose. */
  getModel(id: BackendId): string;
  /** Global default effort level; '' = Default (flag left off). Optional — omitted means ''. */
  getEffort?(): string;
  getSessionsDir(): string;
  saveLastActiveSessionId(id: string): Promise<void>;
  isUiBridgeEnabled(): boolean;
  /** Stream reply text as it's generated (--include-partial-messages). Optional — omitted means off. */
  isStreamingEnabled?(): boolean;
  /** What the installed CLI supports. Optional — omitted (or before the probe
   *  finishes) means unknown, which keeps spawn args at their defaults. */
  getCliCapabilities?(id: BackendId): CliCapabilities;
}

// ── Event payload types ──────────────────────────────────────────────────────

export interface SessionLoadedPayload {
  session: StoredSession;
  messages: ChatMessage[];
  isNew: boolean;
  canResume: boolean;
}

export interface TurnDoneResult {
  sessionId: string | undefined;
  clean: boolean | undefined;
  pendingQueries: VaultQuery[];
  pendingPermissionRequest: { tool: string; reason: string } | null;
}

/** Typed map of all events emitted by SessionCoordinator.
 *  External plugins subscribe via `coordinator.on(event, listener)`. */
export interface SessionCoordinatorEvents {
  /** Fired after state is initialised for a brand-new session. */
  'session:new': [session: StoredSession];
  /** Fired after session state is initialised from a StoredSession. */
  'session:loaded': [payload: SessionLoadedPayload];
  /** Fired each time the current session's title or ID is persisted. */
  'session:updated': [updates: { title?: string; sessionId?: string }];
  /** Fired once per session, when its first turn binds a conversation ID — the
   *  session has had at least one reply from the agent. */
  'session:started': [sessionId: string];
  /** Fired when a Claude turn begins (process spawned). */
  'turn:start': [];
  /** Fired on each text chunk. `accumulated` is the text to display so far — the
   *  committed text plus any live preview of the block being generated (with
   *  @@BOJU lines filtered out). `committed` is the clean text from complete
   *  messages only: the source of truth for the final render. */
  'turn:text': [accumulated: string, committed: string];
  /** Fired for each parsed UI bridge action (request-permission excluded). */
  'turn:action': [action: BojuBotAction];
  /** Fired when Claude initiates a tool call. */
  'turn:tool-call': [tool: string, input: unknown, toolUseId: string];
  /** Fired when a tool result arrives. */
  'turn:tool-result': [toolUseId: string, content: string];
  /** Fired for each @@BOJU_QUERY line received. */
  'turn:query': [query: VaultQuery];
  /** Fired when token-usage data arrives. */
  'turn:usage': [usage: TokenUsage];
  /** Fired when the CLI reports an API error for this turn (turn:done still follows). */
  'turn:api-error': [err: ApiError];
  /** Fired for stderr output (non-fatal; process continues). */
  'turn:stderr': [err: string];
  /** Fired when the process exits abnormally (fatal; no turn:done follows). */
  'turn:error': [err: string];
  /** Fired when a turn completes normally. */
  'turn:done': [result: TurnDoneResult];
  /** Fired when the permission system blocks one or more tool calls.
   *  `hasPendingRequest` is true when a request-permission action was also fired
   *  this turn — the denial card should be suppressed in that case. */
  'permission:denied': [denials: PermissionDenial[], hasPendingRequest: boolean];
}

// ── Session state ────────────────────────────────────────────────────────────

/**
 * Everything the coordinator knows about the session in the panel. Loading or
 * starting a session replaces the whole object, never edits it, so a running
 * turn keeps a reference to the session it started on and saves its result
 * there even if the panel has moved on (#398).
 */
interface SessionState {
  /** The agent's conversation ID; undefined until the first turn binds one. */
  sessionId: string | undefined;
  /** The BojuBot session file ID. */
  fileId: string | undefined;
  title: string | undefined;
  createdAt: string | undefined;
  backend: BackendId;
  /** Chosen explicitly (Custom Session), so a change to the default backend doesn't move it. */
  backendPinned: boolean;
  cwd: string | undefined;
  suppressVaultContext: boolean;
  permissionMode: PermissionMode | undefined;
  model: string | undefined;
  effort: string | undefined;
  rawSession: boolean;
  hasCustomTitle: boolean;
  /** Set while the session file exists but no turn has bound a conversation ID. */
  placeholderId: string | undefined;
}

function emptySessionState(backend: BackendId): SessionState {
  return {
    sessionId: undefined, fileId: undefined, title: undefined, createdAt: undefined,
    backend, backendPinned: false, cwd: undefined, suppressVaultContext: false,
    permissionMode: undefined, model: undefined, effort: undefined, rawSession: false,
    hasCustomTitle: false, placeholderId: undefined,
  };
}

// ── SessionCoordinator ───────────────────────────────────────────────────────

export class SessionCoordinator {
  private readonly _emitter = new EventEmitter();

  /** The session in the panel. Replaced (not mutated) when the panel switches session. */
  private _s: SessionState;
  /** A note for the open session's next turn. Dropped whenever another session opens. */
  private _pendingSystemMessage: string | null = null;
  private _activeProc: ChildProcess | null = null;
  /** stop() callers waiting for the running process to end. */
  private _turnEndWaiters: Array<() => void> = [];

  constructor(private readonly host: SessionCoordinatorHost) {
    this._s = emptySessionState(host.getDefaultBackend?.() ?? 'claude-code');
  }

  // ── Typed event API ────────────────────────────────────────────────────────

  on<K extends keyof SessionCoordinatorEvents>(
    event: K,
    listener: (...args: SessionCoordinatorEvents[K]) => void,
  ): this {
    this._emitter.on(event, listener);
    return this;
  }

  off<K extends keyof SessionCoordinatorEvents>(
    event: K,
    listener: (...args: SessionCoordinatorEvents[K]) => void,
  ): this {
    this._emitter.off(event, listener);
    return this;
  }

  private emit<K extends keyof SessionCoordinatorEvents>(
    event: K,
    ...args: SessionCoordinatorEvents[K]
  ): void {
    this._emitter.emit(event, ...args);
  }

  // ── State accessors ────────────────────────────────────────────────────────

  get sessionId(): string | undefined { return this._s.sessionId; }
  get sessionFileId(): string | undefined { return this._s.fileId; }
  get sessionTitle(): string | undefined { return this._s.title; }
  get sessionCreatedAt(): string | undefined { return this._s.createdAt; }
  get sessionCwd(): string | undefined { return this._s.cwd; }
  /** The agent CLI this session is bound to. */
  get backendId(): BackendId { return this._s.backend; }
  get backend(): AgentBackend { return this.host.getBackend(this._s.backend); }
  get suppressVaultContext(): boolean { return this._s.suppressVaultContext; }
  get sessionModel(): string | undefined { return this._s.model; }
  get sessionEffort(): string | undefined { return this._s.effort; }
  get rawSession(): boolean { return this._s.rawSession; }

  /** The `--effort` level for the next turn (session pin, then global default),
   *  or undefined when it's Default or the installed CLI doesn't list it. */
  getEffectiveEffort(): string | undefined {
    return resolveEffort(this._s.effort, this.host.getEffort?.() ?? '', this.capabilities.effortLevels);
  }

  /** Read fresh on every spawn so a probe that finishes mid-session applies from the next turn. */
  get capabilities(): CliCapabilities {
    return this.host.getCliCapabilities?.(this._s.backend) ?? UNKNOWN_CAPABILITIES;
  }

  /** The open session's own mode. The global default only applies while no
   *  session is open (it's what the next new session will start in). */
  getEffectivePermissionMode(): PermissionMode {
    return this._s.permissionMode ?? this.host.getPermissionMode();
  }

  /** The model for the next turn: the session pin, then the backend's global default. */
  getEffectiveModel(): string | undefined {
    return this._s.model || this.host.getModel(this._s.backend) || undefined;
  }

  /**
   * Change the open session's permission mode and save it in the session file
   * (toolbar picker, denial-card Allow, request-permission card). Only ever
   * touches one session: `forSessionFileId` is the session the request was made
   * in — when that's no longer the open session (or none is open) nothing
   * changes and it returns false.
   */
  setSessionPermissionMode(mode: PermissionMode, forSessionFileId: string | undefined = this._s.fileId): boolean {
    const s = this._s;
    const fileId = s.fileId;
    if (!fileId || forSessionFileId !== fileId) return false;
    s.permissionMode = mode;
    if (mode === 'full') this.host.noteFullAccess?.(fileId);
    try {
      // A patch, so the session's last-active time and user fields stay as they are
      if (!updateStoredSession(this.host.getSessionsDir(), fileId, { permissionMode: mode })) {
        const now = new Date().toISOString();
        this._save(this._storedSession(s, fileId, s.sessionId ?? '', now));
      }
    } catch (e) {
      log('Saving the session permission mode failed:', e instanceof Error ? e.message : String(e));
    }
    log('Session permission mode set to', mode, 'for', fileId);
    return true;
  }

  getPendingSystemMessage(): string | null {
    return this._pendingSystemMessage;
  }

  setPendingSystemMessage(msg: string | null): void {
    this._pendingSystemMessage = msg;
  }

  clearPendingSystemMessage(): void {
    this._pendingSystemMessage = null;
  }

  // ── Session lifecycle ──────────────────────────────────────────────────────

  startNewSession(custom?: {
    name?: string;
    cwd?: string;
    suppressVaultContext?: boolean;
    permissionMode?: PermissionMode;
    model?: string;
    /** '' or omitted = no pin (follows the global default). */
    effort?: string;
    rawSession?: boolean;
    /** Omitted = the host's default backend. */
    backend?: BackendId;
  }): void {
    this._pendingSystemMessage = null;
    const vaultRoot = this.host.getVaultRoot();
    const now = new Date().toISOString();
    const sessionId = now.replace(/[:.]/g, '-');
    const title = custom?.name?.trim() || 'Untitled session';
    const cwd = custom?.cwd?.trim() || undefined;
    const suppressVaultContext = custom?.suppressVaultContext ?? false;
    // Saved with the session from the start, so a later change to the default never moves it.
    const permissionMode = custom?.permissionMode ?? this.host.getPermissionMode();
    const model = custom?.model?.trim() || undefined;
    const effort = custom?.effort?.trim() || undefined;
    const rawSession = custom?.rawSession ?? false;

    this._s = {
      placeholderId: sessionId,
      sessionId: undefined,
      fileId: sessionId,
      title,
      createdAt: now,
      cwd,
      suppressVaultContext,
      permissionMode,
      model,
      effort,
      rawSession,
      backend: custom?.backend ?? this.host.getDefaultBackend?.() ?? 'claude-code',
      backendPinned: !!custom?.backend,
      hasCustomTitle: !!custom?.name?.trim(),
    };
    if (permissionMode === 'full') this.host.noteFullAccess?.(sessionId);

    const session = this._storedSession(this._s, sessionId, '', now);
    saveSessionAtTop(vaultRoot, session, this.host.getSessionsDir(), this.host.getConfigDir());
    void this.host.saveLastActiveSessionId(sessionId);

    this.emit('session:new', session);
    log('New session placeholder created:', sessionId, cwd ? `cwd=${cwd}` : '');
  }

  /**
   * Syncs the in-memory title when a session is renamed elsewhere (e.g. the Session
   * Manager). The header and active-session vault export both read cached coordinator
   * state, not disk, so without this they'd keep showing the pre-rename title until
   * the session was reloaded.
   */
  renameActiveSession(sessionFileId: string, newTitle: string): void {
    if (sessionFileId !== this._s.fileId) return;
    this._s.title = newTitle;
    this._s.hasCustomTitle = true;
    this.emit('session:updated', { title: newTitle, sessionId: this._s.sessionId });
  }

  /**
   * Mid-session model switch. Unpinned sessions already follow the host default, so
   * only a session with its own pinned model (Custom Session) needs updating — otherwise
   * the pin would silently override the switch. Persisted with the next turn's save.
   */
  switchSessionModel(modelId: string): void {
    if (this._s.model) this._s.model = modelId;
  }

  /**
   * Mid-session effort switch — same rule as switchSessionModel: only a pinned
   * session needs updating. Switching a pinned session to Default ('') drops the
   * pin, so the session follows the (now Default) global setting.
   */
  switchSessionEffort(level: string): void {
    if (this._s.effort) this._s.effort = level || undefined;
  }

  /**
   * The default backend changed. A session that hasn't run a turn and wasn't
   * given a backend explicitly follows it; any other session stays bound to the
   * CLI that holds its conversation. Returns true when the session moved.
   */
  followDefaultBackend(id: BackendId): boolean {
    const s = this._s;
    // A running first turn is already talking to the current backend.
    if (this._activeProc) return false;
    if (s.sessionId || s.backendPinned || !s.placeholderId || s.backend === id) return false;
    s.backend = id;
    // A model pin belongs to the old backend's model list.
    s.model = undefined;
    const now = new Date().toISOString();
    this._save(this._storedSession(s, s.placeholderId, '', now));
    return true;
  }

  async loadSession(session: StoredSession): Promise<void> {
    session = this._settleSessionPermissionMode(session);
    this._pendingSystemMessage = null;
    const isNew = !session.claudeSessionId;
    this._s = {
      placeholderId: isNew ? session.id : undefined,
      sessionId: session.claudeSessionId || undefined,
      fileId: session.id,
      title: session.title,
      createdAt: session.createdAt,
      cwd: session.cwd || undefined,
      suppressVaultContext: session.suppressVaultContext ?? false,
      permissionMode: session.permissionMode,
      model: session.model,
      effort: session.effort || undefined,
      rawSession: session.rawSession ?? false,
      backend: sessionBackend(session),
      backendPinned: !!session.backend,
      hasCustomTitle: false,
    };

    await this.host.saveLastActiveSessionId(session.id);

    const canResume = hasReadableHistory(session, this.host.getSessionsDir());

    const messages: ChatMessage[] = canResume ? loadHistory(session, this.host.getSessionsDir()) : [];

    this.emit('session:loaded', { session, messages, isNew, canResume });
    log(
      'Loaded session:',
      session.claudeSessionId || '(new)',
      session.title,
      canResume ? '(local)' : isNew ? '(new)' : '(remote)',
    );
  }

  // ── Turn execution ─────────────────────────────────────────────────────────

  /** True while a turn's claude process is running — a second send() must not be started until this clears. */
  get isBusy(): boolean {
    return this._activeProc !== null;
  }

  cancel(): void {
    if (this._activeProc) killProcess(this._activeProc);
  }

  /**
   * Stop the running process and wait until it has ended — its turn finished
   * and saved to the session it started on, and `turn:done` (or `turn:error`)
   * already emitted. Resolves straight away when nothing is running. Never
   * rejects, but never resolves if the process can't be ended — callers that
   * must not hang add their own timeout.
   */
  stop(): Promise<void> {
    if (!this._activeProc) return Promise.resolve();
    const ended = new Promise<void>((resolve) => { this._turnEndWaiters.push(resolve); });
    this.cancel();
    return ended;
  }

  /** The process `proc` has ended. Ignored for a process that's no longer the active one. */
  private _procEnded(proc: ChildProcess): boolean {
    if (this._activeProc !== proc) return false;
    this._activeProc = null;
    return true;
  }

  /** Release stop() callers. Called after the turn's own events so the panel has
   *  rendered the (partial) reply before a caller switches session. */
  private _releaseTurnEndWaiters(): void {
    const waiters = this._turnEndWaiters;
    this._turnEndWaiters = [];
    for (const w of waiters) w();
  }

  /**
   * Trigger the backend's native compact command (Claude Code's /compact) via a resumed turn.
   * Shares the busy guard and _activeProc tracking with send() — previously this
   * spawned its own untracked process directly from TokenGauge, so compacting
   * while a turn was streaming raced a second process against the same
   * --resume session, the same bug class fixed above for send().
   */
  compact(onDone: () => void, onError: (message: string) => void): void {
    if (this._activeProc) {
      onError('A turn is already in progress — wait for it to finish or cancel it first.');
      return;
    }
    if (!this._s.sessionId) {
      onError('No active session to compact.');
      return;
    }
    const backend = this.backend;
    if (!backend.compactPrompt) {
      onError(`${backend.displayName} doesn't support compacting a session.`);
      return;
    }
    const binary = this.host.getBinaryPath(this._s.backend);
    if (!binary) {
      onError(`${backend.displayName} binary not found.`);
      return;
    }

    let proc: ChildProcess;
    try {
      proc = backend.spawnTurn({
        binaryPath: binary,
        prompt: backend.compactPrompt,
        cwd: resolveSpawnCwd(this.getEffectivePermissionMode(), this._s.cwd, this.host.getVaultRoot()),
        env: this.host.getEnv(),
        resumeSessionId: this._s.sessionId,
        permissionMode: this.getEffectivePermissionMode(),
        model: this.getEffectiveModel(),
        effort: this.getEffectiveEffort(),
        capabilities: this.capabilities,
      });
    } catch (e) {
      onError(`Failed to start ${backend.displayName}: ${e}`);
      return;
    }

    this._activeProc = proc;
    proc.stdout?.resume();
    proc.on('close', () => {
      if (!this._procEnded(proc)) return;
      onDone();
      this._releaseTurnEndWaiters();
    });
    proc.on('error', (err) => {
      if (!this._procEnded(proc)) return;
      onError(err.message);
      this._releaseTurnEndWaiters();
    });
  }

  /**
   * Spawn a Claude turn and emit stream events as it runs.
   *
   * @param prompt       Full prompt to send (context already injected by caller).
   * @param firstUserInput  Raw user input used for session title generation on
   *                        the first turn of a new session. Omit for inject turns.
   */
  send(prompt: string, firstUserInput?: string): void {
    if (this._activeProc) {
      // A previous turn's process is still running — starting another here would spawn
      // a second `claude --resume <id>` against the same session transcript concurrently,
      // racing both processes' file writes and orphaning the first from cancel().
      this.emit('turn:error', 'A turn is already in progress — wait for it to finish or cancel it first.');
      return;
    }

    // The session this turn runs for. Its result is saved here even if the panel
    // has switched to another session by the time the turn ends (#398).
    const turnSession = this._s;
    const backend = this.backend;
    const binary = this.host.getBinaryPath(turnSession.backend);
    if (!binary) {
      this.emit('turn:error', `${backend.displayName} binary not found.`);
      return;
    }

    // No session open yet (send() before startNewSession/loadSession): the mode this
    // first turn runs in becomes the session's own, and is saved with it.
    turnSession.permissionMode ??= this.host.getPermissionMode();

    const streaming = this.host.isStreamingEnabled?.() ?? false;
    let proc: ChildProcess;
    try {
      proc = backend.spawnTurn({
        binaryPath: binary,
        prompt,
        cwd: resolveSpawnCwd(this.getEffectivePermissionMode(), turnSession.cwd, this.host.getVaultRoot()),
        env: this.host.getEnv(),
        resumeSessionId: turnSession.sessionId,
        permissionMode: this.getEffectivePermissionMode(),
        model: this.getEffectiveModel(),
        effort: this.getEffectiveEffort(),
        includePartialMessages: streaming,
        capabilities: this.capabilities,
      });
      this._activeProc = proc;
    } catch (e) {
      this.emit('turn:error', `Failed to start ${backend.displayName}: ${e}`);
      return;
    }

    this.emit('turn:start');

    let accumulated = '';
    // The reply as the CLI produced it, @@BOJU lines included — what a transcript
    // keeps, so replay can rebuild query cards the way Claude Code history does.
    let transcriptReply = '';
    const pendingQueries: VaultQuery[] = [];
    let pendingPermissionRequest: { tool: string; reason: string } | null = null;

    const handleAction = (action: BojuBotAction) => {
      if (action.action === 'request-permission') {
        pendingPermissionRequest = {
          tool: (action['tool'] as string) ?? 'unknown tool',
          reason: (action['reason'] as string) ?? '',
        };
      } else {
        this.emit('turn:action', action);
      }
    };

    backend.parseStream(proc, {
      onText: (delta) => {
        // The complete block replaces its live preview.
        transcriptReply += delta;
        accumulated += delta;
        if (this.host.isUiBridgeEnabled()) {
          const { clean, actions } = extractActions(accumulated);
          accumulated = clean;
          for (const a of actions) handleAction(a);
        }
        this.emit('turn:text', accumulated, accumulated);
      },
      // Display only — never parsed for actions or queries. @@BOJU lines (and
      // partial lines that could become one) are filtered out of what's shown.
      // Omitted when streaming is off: some CLIs stream deltas regardless of flags.
      onTextPreview: streaming
        ? (blockText) => this.emit('turn:text', composeStreamingText(accumulated, blockText), accumulated)
        : undefined,
      onAction: (line) => {
        transcriptReply += line + '\n';
        if (!this.host.isUiBridgeEnabled()) return;
        try {
          const { actions } = extractActions(line + '\n');
          for (const a of actions) handleAction(a);
        } catch { /* malformed action line */ }
      },
      onQuery: (line) => {
        transcriptReply += line + '\n';
        try {
          const q = JSON.parse(line.slice(BOJU_PREFIX.length)) as VaultQuery;
          pendingQueries.push(q);
          this.emit('turn:query', q);
          log('turn:query — queued:', q.query, q.mode, q.path ?? '');
        } catch { log('turn:query — malformed line:', line.substring(0, 100)); }
      },
      onToolCall: (tool, input, toolUseId) => {
        this.emit('turn:tool-call', tool, input, toolUseId);
        log('onToolCall —', tool, JSON.stringify(input).substring(0, 120));
      },
      onToolResult: (toolUseId, content) => {
        this.emit('turn:tool-result', toolUseId, content);
      },
      onPermissionDenied: (denials) => {
        this.emit('permission:denied', denials, pendingPermissionRequest !== null);
      },
      onUsage: (usage) => {
        this.emit('turn:usage', usage);
      },
      onApiError: (err) => {
        this.emit('turn:api-error', err);
      },
      onError: (err) => {
        this.emit('turn:stderr', err);
      },
      onDone: (sessionId, clean) => {
        if (!this._procEnded(proc)) return;
        if (sessionId) {
          this._persistSessionAfterTurn(turnSession, sessionId, firstUserInput);
          if (!backend.readableHistory) this._appendTranscript(turnSession, prompt, transcriptReply);
        }
        this.emit('turn:done', { sessionId, clean, pendingQueries, pendingPermissionRequest });
        this._releaseTurnEndWaiters();
      },
    });

    proc.on('error', (err) => {
      if (!this._procEnded(proc)) return;
      this.emit('turn:error', err.message);
      this._releaseTurnEndWaiters();
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * The mode a session opens in, never more than it was saved with: a session
   * with no saved mode (from before modes were saved per session) gets Standard,
   * and a Full access session that may not keep it (host.keepsFullAccess) drops
   * to Standard. Either change is saved to the session file.
   */
  private _settleSessionPermissionMode(session: StoredSession): StoredSession {
    let mode: PermissionMode = session.permissionMode ?? 'standard';
    if (mode === 'full' && !(this.host.keepsFullAccess?.(session.id) ?? true)) mode = 'standard';
    if (mode === session.permissionMode) return session;
    const settled = { ...session, permissionMode: mode };
    try {
      // saveSession (not a patch) so a session still in a legacy folder is migrated as before
      saveSession(this.host.getVaultRoot(), settled, this.host.getSessionsDir());
    } catch (e) {
      log('Saving the session permission mode failed:', e instanceof Error ? e.message : String(e));
    }
    log('Session', session.id, 'opens in', mode, session.permissionMode ? `(saved: ${session.permissionMode})` : '(no saved mode)');
    return settled;
  }

  /** Record a finished turn for backends whose own history BojuBot can't read.
   *  Best-effort: a failed write costs the replay, never the turn. */
  private _appendTranscript(s: SessionState, prompt: string, reply: string): void {
    const fileId = s.fileId;
    if (!fileId) return;
    try {
      appendTranscript(this.host.getSessionsDir(), fileId, transcriptEntries(prompt, reply, new Date().toISOString()));
    } catch (e) {
      log('Transcript write failed:', e instanceof Error ? e.message : String(e));
    }
  }

  /** The session record as persisted. Optional fields are only written when set,
   *  so a plain Claude Code session's JSON is unchanged from before backends. */
  private _storedSession(
    s: SessionState,
    id: string,
    claudeSessionId: string,
    updatedAt: string,
    title = s.title ?? 'Untitled session',
    createdAt = s.createdAt ?? updatedAt,
  ): StoredSession {
    return {
      id,
      title,
      createdAt,
      updatedAt,
      claudeSessionId,
      ...(s.backend !== 'claude-code' && { backend: s.backend }),
      ...(s.cwd && { cwd: s.cwd }),
      ...(s.suppressVaultContext && { suppressVaultContext: true }),
      ...(s.permissionMode && { permissionMode: s.permissionMode }),
      ...(s.model && { model: s.model }),
      ...(s.effort && { effort: s.effort }),
      ...(s.rawSession && { rawSession: true }),
    };
  }

  /**
   * Save a finished turn to the session `s` it ran for. When the panel has since
   * moved to another session, `s` is no longer the panel's state: it's still
   * updated and written to disk, but `session:updated` (which drives the
   * panel's header) is not emitted.
   */
  /** Save a rebuilt record, keeping the user's own fields (drag order, pin,
   *  name labels) from the file on disk, which the record doesn't carry. */
  private _save(session: StoredSession): void {
    const sessionsDir = this.host.getSessionsDir();
    saveSession(this.host.getVaultRoot(), preserveUserFields(session, loadSessionFile(sessionsDir, session.id)), sessionsDir);
  }

  private _persistSessionAfterTurn(s: SessionState, sessionId: string, firstUserInput?: string): void {
    const now = new Date().toISOString();
    const wasNew = !s.sessionId;
    const inPanel = s === this._s;

    if (s.placeholderId) {
      // First turn on a placeholder session → bind the real Claude session ID
      s.sessionId = sessionId;
      if (firstUserInput && !s.hasCustomTitle) s.title = titleFromPrompt(firstUserInput);
      this._save(this._storedSession(s, s.placeholderId, sessionId, now, s.title ?? 'Untitled session', s.createdAt ?? now));
      const placeholderId = s.placeholderId;
      s.placeholderId = undefined;
      if (inPanel) this.emit('session:updated', { title: s.title, sessionId });
      this.emit('session:started', sessionId);
      log('Placeholder session updated:', placeholderId, '→', sessionId, inPanel ? '' : '(no longer in the panel)');
    } else if (wasNew && firstUserInput) {
      // Brand-new session with no pre-created placeholder.
      // In practice this branch is unreachable through the normal UI: startNewSession()
      // always sets placeholderId, and loadSession() sets it for new sessions.
      // This is a defensive guard in case send() is called on an unconfigured coordinator.
      s.sessionId = sessionId;
      s.fileId = sessionId;
      s.title = titleFromPrompt(firstUserInput);
      s.createdAt = now;
      this._save(this._storedSession(s, sessionId, sessionId, now, s.title, now));
      if (inPanel) this.emit('session:updated', { title: s.title, sessionId });
      this.emit('session:started', sessionId);
      log('Session saved:', sessionId, s.title);
    } else if (s.sessionId) {
      // Continuing session — update the updatedAt timestamp
      s.sessionId = sessionId;
      const fileId = s.fileId ?? s.sessionId;
      this._save(this._storedSession(s, fileId, s.sessionId, now, s.title ?? s.sessionId.substring(0, 8), s.createdAt ?? now));
    }
  }
}
