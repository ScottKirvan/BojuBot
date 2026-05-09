import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import {
  spawnClaude,
  parseStreamOutput,
  killProcess,
  PermissionMode,
  PermissionDenial,
  TokenUsage,
} from './ClaudeProcess';
import { VaultQuery } from './QueryHandler';
import { QUERY_PREFIX } from './constants';
import { extractActions, ObsidiBotAction } from './UIBridge';
import {
  StoredSession,
  ChatMessage,
  saveSession,
  saveSessionAtTop,
  canResumeLocally,
  loadSessionMessages,
  titleFromPrompt,
} from './utils/sessionStorage';
import { log } from './utils/logger';

// ── Host interface ───────────────────────────────────────────────────────────

export interface SessionCoordinatorHost {
  getBinaryPath(): string | null;
  getVaultRoot(): string;
  getConfigDir(): string;
  getEnv(): Record<string, string>;
  getPermissionMode(): PermissionMode;
  getSessionsDir(): string;
  saveLastActiveSessionId(id: string): Promise<void>;
  isUiBridgeEnabled(): boolean;
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
  /** Fired when a Claude turn begins (process spawned). */
  'turn:start': [];
  /** Fired on each text chunk; `accumulated` is the full clean text so far. */
  'turn:text': [accumulated: string];
  /** Fired for each parsed UI bridge action (request-permission excluded). */
  'turn:action': [action: ObsidiBotAction];
  /** Fired when Claude initiates a tool call. */
  'turn:tool-call': [tool: string, input: unknown, toolUseId: string];
  /** Fired when a tool result arrives. */
  'turn:tool-result': [toolUseId: string, content: string];
  /** Fired for each @@CORTEX_QUERY line received. */
  'turn:query': [query: VaultQuery];
  /** Fired when token-usage data arrives. */
  'turn:usage': [usage: TokenUsage];
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

// ── SessionCoordinator ───────────────────────────────────────────────────────

export class SessionCoordinator {
  private readonly _emitter = new EventEmitter();

  // Session state
  private _sessionId: string | undefined;
  private _sessionFileId: string | undefined;
  private _sessionTitle: string | undefined;
  private _sessionCreatedAt: string | undefined;
  private _placeholderSessionId: string | undefined;
  private _permissionOverride: PermissionMode | null = null;
  private _pendingSystemMessage: string | null = null;
  private _activeProc: ChildProcess | null = null;

  constructor(private readonly host: SessionCoordinatorHost) {}

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

  get sessionId(): string | undefined { return this._sessionId; }
  get sessionFileId(): string | undefined { return this._sessionFileId; }
  get sessionTitle(): string | undefined { return this._sessionTitle; }
  get sessionCreatedAt(): string | undefined { return this._sessionCreatedAt; }

  getEffectivePermissionMode(): PermissionMode {
    return this._permissionOverride ?? this.host.getPermissionMode();
  }

  setPermissionOverride(mode: PermissionMode | null): void {
    this._permissionOverride = mode;
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

  startNewSession(): void {
    this._permissionOverride = null;
    const vaultRoot = this.host.getVaultRoot();
    const now = new Date().toISOString();
    const sessionId = now.replace(/[:.]/g, '-');

    const session: StoredSession = {
      id: sessionId,
      title: 'Untitled session',
      createdAt: now,
      updatedAt: now,
      claudeSessionId: '',
    };

    saveSessionAtTop(vaultRoot, session, this.host.getSessionsDir(), this.host.getConfigDir());
    this._placeholderSessionId = sessionId;
    this._sessionId = undefined;
    this._sessionFileId = sessionId;
    this._sessionTitle = 'Untitled session';
    this._sessionCreatedAt = now;
    void this.host.saveLastActiveSessionId(sessionId);

    this.emit('session:new', session);
    log('New session placeholder created:', sessionId);
  }

  async loadSession(session: StoredSession): Promise<void> {
    this._placeholderSessionId = undefined;
    this._sessionId = session.claudeSessionId || undefined;
    this._sessionFileId = session.id;
    this._sessionTitle = session.title;
    this._sessionCreatedAt = session.createdAt;

    await this.host.saveLastActiveSessionId(session.id);

    const isNew = !session.claudeSessionId;
    const canResume = !isNew && canResumeLocally(session.claudeSessionId);

    if (isNew) this._placeholderSessionId = session.id;

    const messages: ChatMessage[] = canResume ? loadSessionMessages(session.claudeSessionId) : [];

    this.emit('session:loaded', { session, messages, isNew, canResume });
    log(
      'Loaded session:',
      session.claudeSessionId || '(new)',
      session.title,
      canResume ? '(local)' : isNew ? '(new)' : '(remote)',
    );
  }

  // ── Turn execution ─────────────────────────────────────────────────────────

  cancel(): void {
    if (this._activeProc) killProcess(this._activeProc);
  }

  /**
   * Spawn a Claude turn and emit stream events as it runs.
   *
   * @param prompt       Full prompt to send (context already injected by caller).
   * @param firstUserInput  Raw user input used for session title generation on
   *                        the first turn of a new session. Omit for inject turns.
   */
  send(prompt: string, firstUserInput?: string): void {
    const binary = this.host.getBinaryPath();
    if (!binary) {
      this.emit('turn:error', 'Claude binary not found.');
      return;
    }

    let proc: ChildProcess;
    try {
      proc = spawnClaude({
        binaryPath: binary,
        prompt,
        vaultRoot: this.host.getVaultRoot(),
        env: this.host.getEnv(),
        resumeSessionId: this._sessionId,
        permissionMode: this._permissionOverride ?? this.host.getPermissionMode(),
      });
      this._activeProc = proc;
    } catch (e) {
      this.emit('turn:error', `Failed to start claude: ${e}`);
      return;
    }

    this.emit('turn:start');

    let accumulated = '';
    const pendingQueries: VaultQuery[] = [];
    let pendingPermissionRequest: { tool: string; reason: string } | null = null;

    const handleAction = (action: ObsidiBotAction) => {
      if (action.action === 'request-permission') {
        pendingPermissionRequest = {
          tool: (action['tool'] as string) ?? 'unknown tool',
          reason: (action['reason'] as string) ?? '',
        };
      } else {
        this.emit('turn:action', action);
      }
    };

    parseStreamOutput(proc, {
      onText: (delta) => {
        accumulated += delta;
        if (this.host.isUiBridgeEnabled()) {
          const { clean, actions } = extractActions(accumulated);
          accumulated = clean;
          for (const a of actions) handleAction(a);
        }
        this.emit('turn:text', accumulated);
      },
      onAction: (line) => {
        if (!this.host.isUiBridgeEnabled()) return;
        try {
          const { actions } = extractActions(line + '\n');
          for (const a of actions) handleAction(a);
        } catch { /* malformed action line */ }
      },
      onQuery: (line) => {
        try {
          const q = JSON.parse(line.slice(QUERY_PREFIX.length)) as VaultQuery;
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
      onError: (err) => {
        this.emit('turn:stderr', err);
      },
      onDone: (sessionId, clean) => {
        this._activeProc = null;
        if (sessionId) this._persistSessionAfterTurn(sessionId, firstUserInput);
        this.emit('turn:done', { sessionId, clean, pendingQueries, pendingPermissionRequest });
      },
    });

    proc.on('error', (err) => {
      this._activeProc = null;
      this.emit('turn:error', err.message);
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _persistSessionAfterTurn(sessionId: string, firstUserInput?: string): void {
    const vaultRoot = this.host.getVaultRoot();
    const sessionsDir = this.host.getSessionsDir();
    const now = new Date().toISOString();
    const wasNew = !this._sessionId;

    if (this._placeholderSessionId) {
      // First turn on a placeholder session → bind the real Claude session ID
      this._sessionId = sessionId;
      if (firstUserInput) this._sessionTitle = titleFromPrompt(firstUserInput);
      saveSession(vaultRoot, {
        id: this._placeholderSessionId,
        title: this._sessionTitle ?? 'Untitled session',
        createdAt: this._sessionCreatedAt ?? now,
        updatedAt: now,
        claudeSessionId: sessionId,
      }, sessionsDir);
      const placeholderId = this._placeholderSessionId;
      this._placeholderSessionId = undefined;
      this.emit('session:updated', { title: this._sessionTitle, sessionId });
      log('Placeholder session updated:', placeholderId, '→', sessionId);
    } else if (wasNew && firstUserInput) {
      // Brand-new session with no pre-created placeholder.
      // In practice this branch is unreachable through the normal UI: startNewSession()
      // always sets _placeholderSessionId, and loadSession() sets it for new sessions.
      // This is a defensive guard in case send() is called on an unconfigured coordinator.
      this._sessionId = sessionId;
      this._sessionFileId = sessionId;
      this._sessionTitle = titleFromPrompt(firstUserInput);
      this._sessionCreatedAt = now;
      saveSession(vaultRoot, {
        id: sessionId,
        title: this._sessionTitle,
        createdAt: now,
        updatedAt: now,
        claudeSessionId: sessionId,
      }, sessionsDir);
      this.emit('session:updated', { title: this._sessionTitle, sessionId });
      log('Session saved:', sessionId, this._sessionTitle);
    } else if (this._sessionId) {
      // Continuing session — update the updatedAt timestamp
      this._sessionId = sessionId;
      const fileId = this._sessionFileId ?? this._sessionId;
      saveSession(vaultRoot, {
        id: fileId,
        title: this._sessionTitle ?? this._sessionId.substring(0, 8),
        createdAt: this._sessionCreatedAt ?? now,
        updatedAt: now,
        claudeSessionId: this._sessionId,
      }, sessionsDir);
    }
  }
}
