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
 * Neutralize trigger prefixes in vault-sourced content before injecting it into the prompt.
 * Prevents a malicious note from causing Claude to reproduce a live action/query line.
 */
export function neutralizeTriggers(content: string): string {
  return content.replace(/@@BOJU/g, '@ @BOJU');
}
