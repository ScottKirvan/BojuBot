/**
 * Pure helpers for the /usage side process (plan usage limits).
 * No Obsidian API dependency — safe to import in unit tests.
 *
 * `claude --print` runs a local slash command when the whole stdin prompt is
 * the command. For `/usage` that costs nothing (0 tokens) and the plain-text
 * report arrives as the `result` field of the final `result` message.
 */

export interface CommandResult {
  text: string;
  isError: boolean;
}

/**
 * The `result` text from stream-json output, or null when no result message
 * with a string `result` is present. Non-JSON lines are skipped; if several
 * result messages appear, the last one wins.
 */
export function extractResultText(streamJson: string): CommandResult | null {
  let found: CommandResult | null = null;
  for (const line of streamJson.split('\n')) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line) as Record<string, unknown>;
      if (msg.type === 'result' && typeof msg.result === 'string') {
        found = { text: msg.result, isError: msg.is_error === true };
      }
    } catch { /* not JSON — skip */ }
  }
  return found;
}
