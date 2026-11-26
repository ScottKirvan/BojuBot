import type { PermissionMode } from '../backends/types';
import { sharesVaultInfo } from './modeGates';

/**
 * Telling open sessions about setting changes (#461). A session's context is
 * built once, at its first message, so a later change to a setting it was
 * built from would go unnoticed. Each panel keeps the settings its agent was
 * told (`AgentSettings`), compares them with the current ones when settings
 * change, and queues one note for the next message with what's different.
 * Comparing against what the agent was told, not the previous change, means a
 * setting changed and changed back produces no note.
 *
 * The text blocks the session context uses (memory instruction, context file,
 * vault tree) live here too, so a note reads the same as the session start.
 * Pure — exported for tests.
 */

/** The settings keys whose changes can matter to an open session. */
export const AGENT_SETTING_KEYS: ReadonlySet<string> = new Set([
  'minimalMode',
  'contextFilePath',
  'autonomousMemory',
  'contextFileSizeCapTokens',
  'commandsFolder',
  'vaultTreeDepth',
  'vaultExclusions',
]);

/** What a session's context was built from, as the agent sees it. */
export interface AgentSettings {
  minimalMode: boolean;
  contextFilePath: string;
  autonomousMemory: boolean;
  contextFileSizeCapTokens: number;
  /** The skills folder as named to the agent (`agentSkillsFolder()`). */
  skillsFolder: string;
  vaultTreeDepth: number;
  /** The parsed exclusion patterns, one per line. */
  vaultExclusions: string;
}

/** The open session's own settings that decide what it's told. */
export interface SessionScope {
  mode: PermissionMode;
  /** Custom Session's raw session: BojuBot adds nothing, ever. */
  rawSession: boolean;
  /** Custom Session's "no vault context": no tree, context file or memory. */
  suppressVaultContext: boolean;
}

/** What the note may need to show, read by the caller. */
export interface SettingsNoteInputs {
  identityName: string;
  /** The vault tree at the current depth and exclusions; '' when there's none. */
  tree: string;
  /** The current context file's text (triggers neutralized) and its token
   *  estimate, or null when the file doesn't exist. */
  contextFile: { content: string; tokens: number } | null;
  /** The backend's edit tool wording (`BackendOrientation.editToolHint`). */
  editToolHint: string;
}

export type SettingsNote =
  | { kind: 'none' }
  | { kind: 'note'; text: string }
  /** Minimal mode was turned off: the session never got BojuBot's context, so send all of it. */
  | { kind: 'refresh' };

/** The skills folder as the agent is told it: the setting as typed, or the default. Forward slashes. */
export function agentSkillsFolder(custom: string, defaultFolder: string): string {
  return (custom.trim() || defaultFolder).replace(/\\/g, '/');
}

/** The session context's memory instruction (autonomous memory on). */
export function memoryInstruction(contextFilePath: string, editToolHint: string): string {
  return `## Your persistent memory\n` +
    `The file \`${contextFilePath}\` is your persistent memory across sessions. ` +
    `It is injected at the start of every session.\n\n` +
    `**Maintain it actively:** when you learn something useful about this vault — ` +
    `its structure, conventions, ongoing projects, the user's preferences, decisions made — ` +
    `update \`${contextFilePath}\` using ${editToolHint}. ` +
    `Keep it concise and high-signal. Do not ask permission; just do it.`;
}

/** The instruction added to the context file when it's over the size cap. */
export function compactionInstruction(contextFilePath: string, tokens: number, cap: number): string {
  return `[Your memory file is ~${tokens} tokens, over your ${cap}-token cap. ` +
    `Before this session ends, compact it: summarize redundant entries, drop outdated observations, ` +
    `keep high-signal facts. Write the result back to \`${contextFilePath}\`.]`;
}

export function isOverCap(tokens: number, cap: number): boolean {
  return cap > 0 && tokens > cap;
}

/** The session context's "Vault context" block: the context file, plus the compaction instruction when it's over the cap. */
export function contextFileBlock(content: string, contextFilePath: string, tokens: number, cap: number): string {
  let text = content.trim();
  if (isOverCap(tokens, cap)) text += `\n\n${compactionInstruction(contextFilePath, tokens, cap)}`;
  return `## Vault context\n${text}`;
}

export function vaultTreeBlock(tree: string): string {
  return `## Vault structure\n\`\`\`\n${tree}\n\`\`\``;
}

/** The note for an open session whose agent was told `told` and whose settings are now `now`. */
export function settingsNote(told: AgentSettings, now: AgentSettings, scope: SessionScope, inputs: SettingsNoteInputs): SettingsNote {
  // Chat only gets nothing about the vault (#406); a raw session gets nothing at all
  if (scope.rawSession || !sharesVaultInfo(scope.mode)) return { kind: 'none' };
  if (told.minimalMode && !now.minimalMode) return { kind: 'refresh' };
  if (now.minimalMode) {
    if (told.minimalMode) return { kind: 'none' };
    return {
      kind: 'note',
      text: `[System: The user turned on minimal mode. ${inputs.identityName} no longer adds vault context or open-note hints, ` +
        `and the memory instructions you were given no longer apply: change the context file only when the user asks.]`,
    };
  }

  const parts: string[] = [];

  if (told.skillsFolder !== now.skillsFolder) {
    parts.push(`${inputs.identityName} skills now go in \`${now.skillsFolder}\` (was \`${told.skillsFolder}\`). Write new skills there.`);
  }

  if (!scope.suppressVaultContext) {
    const path = now.contextFilePath;
    const fileChanged = told.contextFilePath !== path;
    if (fileChanged) {
      let line = `The vault context file is now \`${path}\` (was \`${told.contextFilePath}\`).`;
      if (now.autonomousMemory && told.autonomousMemory) {
        line += ` Keep your persistent memory there from now on; don't write to \`${told.contextFilePath}\`.`;
      }
      const file = inputs.contextFile;
      if (!file) line += " It doesn't exist yet.";
      else if (!file.content.trim()) line += " It's empty.";
      parts.push(line);
      if (file?.content.trim()) {
        parts.push(contextFileBlock(file.content, path, file.tokens, now.autonomousMemory ? now.contextFileSizeCapTokens : 0));
      }
    }

    if (told.autonomousMemory !== now.autonomousMemory) {
      parts.push(now.autonomousMemory
        ? memoryInstruction(path, inputs.editToolHint)
        : `Autonomous memory is off: stop updating \`${fileChanged ? told.contextFilePath : path}\` on your own. Change the context file only when the user asks.`);
    }

    // The cap only matters while the agent keeps the memory file
    if (now.autonomousMemory && !fileChanged && told.contextFileSizeCapTokens !== now.contextFileSizeCapTokens) {
      const cap = now.contextFileSizeCapTokens;
      let line = cap > 0
        ? `The memory file's size cap is now ${cap} tokens.`
        : 'The memory file no longer has a size cap.';
      const file = inputs.contextFile;
      if (file && isOverCap(file.tokens, cap)) line += ` ${compactionInstruction(path, file.tokens, cap)}`;
      parts.push(line);
    }

    if (told.vaultTreeDepth !== now.vaultTreeDepth || told.vaultExclusions !== now.vaultExclusions) {
      if (inputs.tree) {
        parts.push(`The vault structure ${inputs.identityName} sends changed (tree depth or exclusions). The current one:\n\n${vaultTreeBlock(inputs.tree)}`);
      } else if (now.vaultTreeDepth === 0 && told.vaultTreeDepth !== 0) {
        parts.push(`${inputs.identityName} no longer sends a vault tree, so the one you were given may be out of date. To see folders, use the file-list vault query.`);
      }
    }
  }

  if (parts.length === 0) return { kind: 'none' };
  return { kind: 'note', text: `[System: The user changed ${inputs.identityName} settings.\n\n${parts.join('\n\n')}]` };
}
