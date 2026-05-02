/** Prefix Claude emits to signal a ObsidiBot UI action. Must match ContextManager injection. */
export const ACTION_PREFIX = '@@CORTEX_ACTION ';

/** Prefix Claude emits to query live vault state. Must match ContextManager injection. */
export const QUERY_PREFIX = '@@CORTEX_QUERY ';

/**
 * Neutralize trigger prefixes in vault-sourced content before injecting it into the prompt.
 * Prevents a malicious note from causing Claude to reproduce a live action/query line.
 */
export function neutralizeTriggers(content: string): string {
  return content.replace(/@@CORTEX_/g, '@ @CORTEX_');
}
