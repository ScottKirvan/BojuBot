/**
 * Pure helpers for the effort level (`claude --effort <level>`).
 * No Obsidian API dependency — safe to import in unit tests.
 *
 * Levels are never hardcoded as the source of truth: the CLI lists them in
 * `--help` (see cliCapabilities.ts) and only a listed level is ever sent. The
 * empty string means "Default" — the flag is left off and the CLI decides.
 * Which level a turn sends is resolved with its model: see agentModels.ts.
 */

/** Short descriptions for the levels known at the time of writing. Unknown levels get none. */
export const EFFORT_DESCRIPTIONS: Record<string, string> = {
  low: 'Fastest replies, least thinking',
  medium: 'Balanced speed and depth',
  high: 'Deeper reasoning for harder tasks',
  xhigh: 'Extra thinking — slower, uses more of your plan',
  max: 'Most thinking — slowest, uses the most of your plan',
};
