/**
 * Unified prefix for all BojuBot protocol lines (actions and queries).
 * Routing is by JSON key: "action" → UIBridge, "query" → QueryHandler.
 *
 * Wire format is intentionally stable — renaming would break existing session
 * histories and any skill files referencing the protocol. neutralizeTriggers()
 * strips this prefix from all vault-sourced content before it reaches the model.
 */
export const BOJU_PREFIX = '@@BOJU ';

/** @deprecated Use BOJU_PREFIX. Kept for callers being migrated. */
export const ACTION_PREFIX = BOJU_PREFIX;
/** @deprecated Use BOJU_PREFIX. Kept for callers being migrated. */
export const QUERY_PREFIX = BOJU_PREFIX;

/**
 * Scott's funding link — not a brand.links field, so it's not overridable via
 * config. Also hardcoded (necessarily, since they can't import TS) in
 * manifest.json's fundingUrl and docs/index.md's sponsor block; keep those two
 * in sync by hand if this ever changes.
 */
export const KOFI_URL = 'https://ko-fi.com/scottkirvan';

/**
 * Neutralize trigger prefixes in vault-sourced content before injecting it into the prompt.
 * Prevents a malicious note from causing Claude to reproduce a live action/query line.
 *
 * Coverage is necessarily partial: this only protects content that passes through
 * BojuBot's own JavaScript on its way into the prompt — the context file, pinned
 * notes, per-file instructions, attachments, @-mentions, skill bodies, and vault-query
 * results. It cannot cover content Claude reads on its own initiative mid-session via
 * its own Read, Glob, or Grep tool calls — those execute entirely inside the Claude
 * Code CLI subprocess, and the file content goes straight from disk to the model,
 * never passing through this function. There is no hook available to intercept it
 * (same root constraint as FrontmatterGuard's write-protection: `--print` mode has
 * no per-tool-call approval or interception point).
 */
export function neutralizeTriggers(content: string): string {
  return content.replace(/@@BOJU/g, '@ @BOJU');
}
