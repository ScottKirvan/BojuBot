import type { PermissionMode } from '../backends/types';
import { canWrite } from '../backends/modes';
import type { VaultQuery, VaultQueryResult } from '../QueryHandler';

/**
 * Gates for BojuBot's own channels to the agent (#406). The CLI's permission
 * flags only restrict the agent's tools; these keep BojuBot itself from handing
 * a Chat only agent vault information, and from running Obsidian commands for a
 * session that can't write. Always pass the session's effective mode for the turn.
 */

/** Chat only shares nothing about the vault: no open-note paths, no vault query results. */
export function sharesVaultInfo(mode: PermissionMode): boolean {
  return mode !== 'restricted';
}

/** Obsidian commands can create or change notes, so they need a mode that can write. */
export function canRunCommands(mode: PermissionMode): boolean {
  return canWrite(mode);
}

/**
 * Whether BojuBot answers a vault query in this mode. `help` returns BojuBot's
 * own bundled reference text, never anything from the vault, so it's always allowed.
 */
export function queryAllowed(queryType: string, mode: PermissionMode): boolean {
  return queryType === 'help' || sharesVaultInfo(mode);
}

export const CHAT_ONLY_QUERY_REFUSAL =
  "Vault queries aren't available in Chat only: this session has no vault access. " +
  'Answer without vault information, or ask the user to switch to Read only or Standard.';

/** A refusal result for a query this mode doesn't allow, or null to resolve it normally. */
export function refuseQuery(query: VaultQuery, mode: PermissionMode): VaultQueryResult | null {
  return queryAllowed(query.query, mode) ? null : { query, result: null, error: CHAT_ONLY_QUERY_REFUSAL };
}

/**
 * Whether a UI Bridge action may run in this mode. File operations and
 * run-command need write access. Everything else only acts on Obsidian's UI
 * (open a note, show a notice, open settings or the quick switcher) and sends
 * nothing back to the agent, so it's allowed in every mode.
 */
export function bridgeActionAllowed(action: string, mode: PermissionMode | undefined): boolean {
  switch (action) {
    case 'rename-file':
    case 'move-file':
    case 'delete-file':
    case 'run-command':
      return canWrite(mode);
    default:
      return true;
  }
}

/**
 * Switching into Chat only would keep the earlier turns (vault tree, context
 * file, whatever the agent read) in the conversation, so a session with
 * messages starts over. `sessionMode` is the open session's own saved mode: a
 * session already in Chat only has never had vault access and just continues.
 */
export function needsFreshSessionForChatOnly(
  newMode: PermissionMode,
  hasConversation: boolean,
  sessionMode: PermissionMode,
): boolean {
  return newMode === 'restricted' && hasConversation && sessionMode !== 'restricted';
}

export const CHAT_ONLY_NEW_SESSION_NOTICE =
  'Chat only needs a new session. Your previous session is in the session manager.';

/** Chat only picked while a reply is still running. */
export const CHAT_ONLY_PENDING_NOTICE =
  'Chat only needs a new session. It starts with your next message; this session stays in the session manager.';
