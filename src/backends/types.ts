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
  /** The CLI's own agent the conversation runs as (Antigravity, #403): on the
   *  first turn the one to start it with, on later turns the one it started
   *  with. Omitted = none. */
  agent?: string;
}

/** How a backend is pictured in session lists: inline SVG markup (drawn in
 *  currentColor) or a Lucide icon id. */
export type AgentIcon = { svg: string } | { lucide: string };

/** One entry in a model picker. */
export interface ModelOption {
  id: string;
  displayName: string;
  description: string;
  /** Effort levels this model has, when the CLI lists them per model
   *  (Antigravity's effort variants). Omitted = whatever the CLI lists. */
  effortLevels?: string[];
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
  /** Label for pickers, settings and section headers: "Claude (Claude Code)". */
  label: string;
  /** The agent in sentences about the conversation: "Claude" ("Chat only needs
   *  a new Claude session"). */
  name: string;
  /** The CLI product, for version lines: "Claude Code", "Antigravity CLI". */
  cliName: string;
  /** The CLI mid-sentence, for installing, signing in, the binary and versions:
   *  "Claude Code", "the Antigravity CLI". Capitalize it at the start of a
   *  sentence with sentenceStart(). */
  cliPhrase: string;
  /** Shown next to each session in the session manager and recent-sessions list. */
  icon: AgentIcon;
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
  /** True when the CLI lists every model once per effort level ("…-low",
   *  "…-high"). BojuBot lists the base models and sends `--effort` instead
   *  (see utils/agentModels.ts). Optional — omitted means false. */
  effortVariants?: boolean;
  /** Asks the CLI which models it offers. Null when BojuBot keeps the list
   *  itself (Claude Code). Rejects on failure. */
  listModels: ((binaryPath: string, env: Record<string, string>, cwd: string) => Promise<ModelOption[]>) | null;
  /** Permission modes this backend can't enforce with the installed CLI
   *  (`caps`), each with the reason the UI shows. */
  unavailableModes(caps: CliCapabilities): Partial<Record<PermissionMode, string>>;
  /** Short picker descriptions where the backend behaves differently from the
   *  stock wording (e.g. which shell commands Standard allows). */
  modeDescriptions(caps: CliCapabilities): Partial<Record<PermissionMode, string>>;
  /** The CLI agent a new conversation in `mode` starts as, or undefined for
   *  none. Optional — omitted means the backend has no agents. */
  conversationAgent?(mode: PermissionMode, caps: CliCapabilities): string | undefined;
  /** True when a conversation started as `agent` can't continue in `mode`, so
   *  switching to it needs a new session. Optional — omitted means never. */
  needsNewConversation?(agent: string | undefined, mode: PermissionMode): boolean;
  orientation: BackendOrientation;
}
