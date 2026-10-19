/**
 * The command reference the agent reads before using run-command
 * (.obsidian/plugins/bojubot/obsidian-commands.md). Pure — exported for tests.
 */

/**
 * BojuBot commands left out of the reference: running them from inside a turn
 * would start a new session under the agent, or fiddle with the panel and input
 * it's replying through. Everything else, skill commands included, is listed.
 */
export const EXCLUDED_FROM_REFERENCE: ReadonlySet<string> = new Set([
  'bojubot:new-session',
  'bojubot:clear-session',
  'bojubot:audit-memory-file',
  'bojubot:toggle-panel',
  'bojubot:open-agent',
  'bojubot:focus-input',
  'bojubot:send-selection',
  'bojubot:refresh-context',
  // Deprecated alias of bojubot:open-help — the agent should learn the new ID
  'bojubot:show-about',
]);

/** Commands that were renamed: old ID → new ID. The old ones stay registered as deprecated aliases. */
export const RENAMED_COMMANDS: Readonly<Record<string, string>> = {
  'bojubot:show-about': 'bojubot:open-help',
};

/**
 * Carry allowlist/denylist entries over to renamed commands' new IDs, so a
 * decision made about the old ID keeps applying. Old entries are kept (the
 * old IDs still work as aliases). Pure — exported for tests.
 */
export function migrateRenamedCommands(allowlist: string[], denylist: string[]): { allowlist: string[]; denylist: string[]; changed: boolean } {
  const carry = (list: string[]) => {
    const out = [...list];
    for (const [oldId, newId] of Object.entries(RENAMED_COMMANDS)) {
      if (out.includes(oldId) && !out.includes(newId)) out.push(newId);
    }
    return out;
  };
  const allow = carry(allowlist);
  const deny = carry(denylist);
  return { allowlist: allow, denylist: deny, changed: allow.length !== allowlist.length || deny.length !== denylist.length };
}

export interface CommandInfo {
  id: string;
  name: string;
}

/** Markdown for the reference: commands grouped by plugin prefix, both sorted. */
export function buildCommandsReference(commands: CommandInfo[], generatedAt: string): string {
  const groups = new Map<string, CommandInfo[]>();
  for (const cmd of [...commands].sort((a, b) => a.id.localeCompare(b.id))) {
    if (EXCLUDED_FROM_REFERENCE.has(cmd.id)) continue;
    const prefix = cmd.id.includes(':') ? cmd.id.split(':')[0] : 'core';
    let group = groups.get(prefix);
    if (!group) { group = []; groups.set(prefix, group); }
    group.push(cmd);
  }

  const lines: string[] = [
    '# Obsidian Command Reference',
    `_Generated: ${generatedAt}_`,
    '_Grep by plugin name or display name to find the right command ID for run-command._',
    '',
  ];
  for (const [prefix, cmds] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`## ${prefix}`);
    for (const cmd of cmds) lines.push(`- \`${cmd.id}\` — ${cmd.name}`);
    lines.push('');
  }
  return lines.join('\n');
}
