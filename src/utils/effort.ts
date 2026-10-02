/**
 * Pure helpers for the effort level (`claude --effort <level>`).
 * No Obsidian API dependency — safe to import in unit tests.
 *
 * Levels are never hardcoded as the source of truth: the CLI lists them in
 * `--help` (see cliCapabilities.ts) and only a listed level is ever sent. The
 * empty string means "Default" — the flag is left off and the CLI decides.
 */

/** Short descriptions for the levels known at the time of writing. Unknown levels get none. */
export const EFFORT_DESCRIPTIONS: Record<string, string> = {
  low: 'Fastest replies, least thinking',
  medium: 'Balanced speed and depth',
  high: 'Deeper reasoning for harder tasks',
  xhigh: 'Extra thinking — slower, uses more of your plan',
  max: 'Most thinking — slowest, uses the most of your plan',
};

/**
 * The level to pass as `--effort` for a turn, or undefined to leave the flag off.
 * A session pin wins over the global default; whichever applies is only used
 * if the installed CLI listed it, so an empty/unsupported/stale value is dropped.
 */
export function resolveEffort(
  sessionEffort: string | undefined,
  globalDefault: string,
  supportedLevels: readonly string[],
): string | undefined {
  const chosen = sessionEffort || globalDefault;
  return chosen && supportedLevels.includes(chosen) ? chosen : undefined;
}

/** Toolbar text: "Claude Sonnet 5.5 · high", or just the model name at Default. */
export function modelIndicatorText(modelName: string, effort: string | undefined): string {
  return effort ? `${modelName} · ${effort}` : modelName;
}
