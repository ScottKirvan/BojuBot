/**
 * Pure helpers for detecting what the installed Claude Code CLI supports.
 * No Obsidian API dependency — safe to import in unit tests.
 *
 * The CLI's flags and permission modes change between releases (e.g. 2.1.286
 * replaced the listed `default` permission mode with `manual`, #352), so spawn
 * args are built from what `claude --help` actually reports rather than from a
 * hardcoded version table. Anything we can't parse is treated as unknown, and
 * unknown capabilities always produce the same args BojuBot has always sent.
 */

export interface CliCapabilities {
  /** Semver-ish version from `claude --version` (e.g. "2.1.286"), or null if unknown. */
  version: string | null;
  /** Every long flag listed in `claude --help`, including aliases (e.g. "--allowed-tools"). */
  flags: ReadonlySet<string>;
  /** Values listed in the `--permission-mode` choices, in help-text order. */
  permissionModes: readonly string[];
  /** Values listed in the `--effort` help text, in help-text order. Empty when unsupported. */
  effortLevels: readonly string[];
}

/** Used until (or instead of, on failure) a successful probe of the CLI. */
export const UNKNOWN_CAPABILITIES: CliCapabilities = Object.freeze({
  version: null,
  flags: new Set<string>(),
  permissionModes: Object.freeze([]),
  effortLevels: Object.freeze([]),
});

/** True when the CLI's help listed `flag` (e.g. "--effort"). */
export function has(caps: CliCapabilities, flag: string): boolean {
  return caps.flags.has(flag);
}

/** One option from the help text: its flag names and its full (unwrapped) description. */
interface HelpOption {
  names: string[];
  description: string;
}

// An option line has exactly two leading spaces then a dash ("  --model <model>",
// "  -p, --print"). Wrapped description lines are indented further, so they never match.
const OPTION_LINE = /^ {2}-/;
const LONG_FLAG = /--[A-Za-z][\w-]*/g;

/**
 * Split help text into options, joining each option's wrapped description lines.
 * Commander wraps at word boundaries, so joining with a single space restores the
 * original sentence (quoted choice values are never split mid-word).
 */
function parseHelpOptions(helpText: string): HelpOption[] {
  const options: HelpOption[] = [];
  let current: HelpOption | null = null;

  for (const rawLine of helpText.replace(/\r/g, '').split('\n')) {
    if (OPTION_LINE.test(rawLine)) {
      const trimmed = rawLine.trim();
      // Flag names and their arg placeholder come first; the description starts
      // after a run of 2+ spaces (or on the next line for very long flag names).
      const gap = trimmed.search(/\s{2,}/);
      const head = gap === -1 ? trimmed : trimmed.slice(0, gap);
      const desc = gap === -1 ? '' : trimmed.slice(gap).trim();
      current = { names: head.match(LONG_FLAG) ?? [], description: desc };
      options.push(current);
    } else if (current && /^\s{3,}\S/.test(rawLine)) {
      const more = rawLine.trim();
      current.description = current.description ? `${current.description} ${more}` : more;
    } else {
      // Blank line or a section header ("Commands:") ends the current option.
      current = null;
    }
  }
  return options;
}

/** Quoted values from a commander `(choices: "a", "b", default: "a")` clause. */
function parseChoices(description: string): string[] {
  const m = /\(choices:([^)]*)\)/.exec(description);
  if (!m) return [];
  const listed = m[1].split(/\bdefault:/)[0];
  const values: string[] = [];
  const quoted = /"([^"]+)"/g;
  let v: RegExpExecArray | null;
  while ((v = quoted.exec(listed)) !== null) values.push(v[1]);
  return values;
}

/** Bare comma-separated values from a parenthesised list like "(low, medium, high)". */
function parseBareList(description: string): string[] {
  const m = /\(\s*([A-Za-z][\w-]*(?:\s*,\s*[A-Za-z][\w-]*)+)\s*\)/.exec(description);
  return m ? m[1].split(',').map(s => s.trim()) : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Parse `claude --help` and `claude --version` output. Either may be empty or
 * garbage (probe failed, unexpected format); whatever can't be read is reported
 * as unknown rather than guessed.
 */
export function parseCliCapabilities(helpText: string, versionText: string): CliCapabilities {
  const versionMatch = /\b(\d+\.\d+\.\d+)\b/.exec(versionText ?? '');
  const version = versionMatch ? versionMatch[1] : null;

  const options = parseHelpOptions(helpText ?? '');
  const flags = new Set<string>();
  for (const opt of options) for (const name of opt.names) flags.add(name);

  const find = (flag: string) => options.find(o => o.names.includes(flag));

  const permOpt = find('--permission-mode');
  const permissionModes = permOpt ? unique(parseChoices(permOpt.description)) : [];

  const effortOpt = find('--effort');
  let effortLevels: string[] = [];
  if (effortOpt) {
    const choices = parseChoices(effortOpt.description);
    effortLevels = unique(choices.length ? choices : parseBareList(effortOpt.description));
  }

  if (version === null && flags.size === 0) return UNKNOWN_CAPABILITIES;
  return { version, flags, permissionModes, effortLevels };
}

/** "Claude Code 2.1.286", or "unknown" before/without a successful probe. */
export function formatCliVersion(caps: CliCapabilities): string {
  return caps.version ? `Claude Code ${caps.version}` : 'unknown';
}
