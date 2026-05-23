/**
 * Prefix Claude emits to signal an BojuBot UI action. Must match ContextManager injection.
 *
 * FROZEN: The "BOJU" name predates the BojuBot rename and is intentionally kept as the
 * wire format. Renaming would break all existing _claude-context.md files, session .jsonl
 * histories, and any skill files that reference the protocol. A future hardening option is to
 * rotate or obfuscate this prefix periodically to reduce prompt-injection surface — but the
 * current risk is low because neutralizeTriggers() strips the prefix from all vault-sourced
 * content before it reaches the model.
 */
export const ACTION_PREFIX = '@@BOJU_ACTION ';

/**
 * Prefix Claude emits to query live vault state. Must match ContextManager injection.
 * See ACTION_PREFIX for freeze rationale.
 */
export const QUERY_PREFIX = '@@BOJU_QUERY ';

/**
 * Neutralize trigger prefixes in vault-sourced content before injecting it into the prompt.
 * Prevents a malicious note from causing Claude to reproduce a live action/query line.
 */
export function neutralizeTriggers(content: string): string {
  return content.replace(/@@BOJU_/g, '@ @BOJU_');
}
