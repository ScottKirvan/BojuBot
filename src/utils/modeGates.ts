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
 * Moving into or out of Chat only starts a new session when the session has
 * messages, on every backend. Into Chat only: the earlier turns (vault tree,
 * context file, whatever the agent read) would stay in the conversation.
 * Out of Chat only: the conversation never had the vault context, and on
 * Claude Code it ran from the temp folder (`resolveSpawnCwd()`), so
 * `--resume` from the vault can't find it. `sessionMode` is the open
 * session's own saved mode. One of the rules behind
 * `SessionCoordinator.modeNeedsNewSession()`.
 */
export function needsFreshSessionForChatOnly(
  newMode: PermissionMode,
  hasConversation: boolean,
  sessionMode: PermissionMode,
): boolean {
  return hasConversation && (newMode === 'restricted') !== (sessionMode === 'restricted');
}

/**
 * Attachments a mode can't send. Attaching anything from disk is a read —
 * files of any type, pasted screenshots (saved into the vault), @-mentioned
 * notes, Send selection, skill note fields, Custom Session attachments — and
 * Chat only reads nothing. Images and PDFs would also send a path that reveals
 * where the vault is. Only URLs are allowed; text the user types or pastes goes
 * in the message itself, not here.
 */
export function blockedAttachments<T extends { type?: string }>(attachments: readonly T[], mode: PermissionMode): T[] {
  if (sharesVaultInfo(mode)) return [];
  return attachments.filter(a => a.type !== 'url');
}

export const CHAT_ONLY_ATTACHMENT_NOTICE =
  "Chat only can't send files, notes or selections — only links. Remove them, or switch to another mode.";
