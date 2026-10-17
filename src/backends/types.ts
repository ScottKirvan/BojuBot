/**
 * The seam between BojuBot and the agent CLI it drives. Everything above this
 * layer (SessionCoordinator, ClaudeView, UIBridge, ContextManager) talks to an
 * AgentBackend and consumes StreamCallbacks; each backend translates its own
 * CLI's flags and stream format into that contract.
 * See notes/dev/specs/agent-backends-spec.md.
 */
import type { ChildProcess } from 'child_process';
import type { ApiError } from '../utils/apiError';
import type { CliCapabilities } from '../utils/cliCapabilities';

export type BackendId = 'claude-code' | 'antigravity';

/** BojuBot's own permission vocabulary; each backend maps it to its CLI's flags. */
export type PermissionMode = 'standard' | 'readonly' | 'full' | 'restricted';

export interface PermissionDenial {
  tool: string;
  input: unknown;
}

export interface TokenUsage {
  inputTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
}

export interface StreamCallbacks {
  onText: (delta: string) => void;
  /** Live preview of the text block being generated (needs --include-partial-messages).
   *  Receives the block's full text so far, raw — it may contain partial or complete
   *  @@BOJU lines. Display only: onText with the complete message always follows and
   *  is the source of truth. Optional — existing callers unaffected. */
  onTextPreview?: (blockText: string) => void;
  onAction: (line: string) => void;
  /** Called for each @@BOJU_QUERY line. Optional — existing callers unaffected. */
  onQuery?: (line: string) => void;
  onToolCall: (tool: string, input: unknown, toolUseId: string) => void;
  onToolResult?: (toolUseId: string, content: string) => void;
  /** Called when the CLI reports an API error (synthetic `API Error: ...` message).
   *  Optional — without it the error text is passed to onText as before. */
  onApiError?: (err: ApiError) => void;
  onPermissionDenied: (denials: PermissionDenial[]) => void;
  onUsage: (usage: TokenUsage) => void;
  onDone: (sessionId?: string, clean?: boolean) => void;
  onError: (err: string) => void;
}

/** One chat turn. The prompt always goes to stdin, never into args. */
export interface TurnOptions {
  binaryPath: string;
  prompt: string;
  cwd: string;
  env: Record<string, string>;
  resumeSessionId?: string;
  permissionMode?: PermissionMode;
  model?: string;
  /** Effort level. Dropped unless the CLI listed it in `capabilities`. */
  effort?: string;
  /** Request token-by-token stream events. Dropped unless the CLI supports them. */
  includePartialMessages?: boolean;
  /** What the installed CLI supports. Omitted → unknown → the long-standing default args. */
  capabilities?: CliCapabilities;
}

/** One entry in a model picker. */
export interface ModelOption {
  id: string;
  displayName: string;
  description: string;
}

export interface PermissionDescription {
  summary: string;
  can: string;
  cannot: string;
}

/** Backend-specific wording injected into the session orientation. */
export interface BackendOrientation {
  /** What BojuBot is running, e.g. "Claude Code". */
  agentLabel: string;
  /** Extra guidance about the CLI's own environment, with `{{BRAND}}` for the
   *  assistant's name. Null when the CLI needs none. */
  environmentNote: string | null;
  /** How to name the file-editing tool in instructions, e.g. "the Write or Edit tool". */
  editToolHint: string;
  permissions: Record<PermissionMode, PermissionDescription>;
}

export interface AgentBackend {
  id: BackendId;
  /** Product name for the UI, e.g. "Claude Code". */
  displayName: string;
  findBinary(settingsOverride?: string): string | null;
  /** Never rejects: a failed probe yields unknown capabilities. */
  probe(binaryPath: string, env: Record<string, string>, cwd: string): Promise<CliCapabilities>;
  spawnTurn(opts: TurnOptions): ChildProcess;
  parseStream(proc: ChildProcess, cb: StreamCallbacks): void;
  /** Plain-text plan usage report. Rejects with a short message on failure. */
  fetchPlanUsage(binaryPath: string, env: Record<string, string>, cwd: string, caps: CliCapabilities): Promise<string>;
  /** Prompt that compacts the resumed conversation, or null when unsupported. */
  compactPrompt: string | null;
  /** True when BojuBot can read the CLI's own conversation history (Claude Code's
   *  .jsonl files). False → BojuBot keeps its own transcript of the session. */
  readableHistory: boolean;
  /** Asks the CLI which models it offers. Null when BojuBot keeps the list
   *  itself (Claude Code). Rejects on failure. */
  listModels: ((binaryPath: string, env: Record<string, string>, cwd: string) => Promise<ModelOption[]>) | null;
  /** Permission modes this backend can't enforce, each with the reason the UI shows. */
  unavailableModes: Partial<Record<PermissionMode, string>>;
  /** Short picker descriptions where the backend behaves differently from the
   *  stock wording (e.g. which shell commands Standard allows). */
  modeDescriptions: Partial<Record<PermissionMode, string>>;
  orientation: BackendOrientation;
}
