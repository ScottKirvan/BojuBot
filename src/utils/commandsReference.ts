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
]);

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
