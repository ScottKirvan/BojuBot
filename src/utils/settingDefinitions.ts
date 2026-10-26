/**
 * Pure helpers for the settings tab (src/settings.ts) and its fallback renderer
 * for Obsidian < 1.13 (src/settingsFallback.ts). Type-only imports from
 * 'obsidian', so this file runs under `npm test` without the app.
 */
import type { SettingDefinition, SettingDefinitionItem, SettingGroupItem } from 'obsidian';

/** A `visible` / `disabled` / `searchable` value from a setting definition. */
export type DefinitionFlag = boolean | (() => boolean) | undefined;

/** Resolves a definition flag. Matches Obsidian: undefined → `fallback`, and a
 *  predicate that throws counts as `fallback` too (the error is logged). */
export function evalFlag(flag: DefinitionFlag, fallback: boolean): boolean {
  if (flag === undefined) return fallback;
  if (typeof flag !== 'function') return flag;
  try {
    return flag();
  } catch (e) {
    console.error(e);
    return fallback;
  }
}

/** Whether a definition renders as disabled, read the way Obsidian reads it:
 *  the row's own `disabled` (action rows), else its control's. Render rows
 *  handle their own state. */
export function rowDisabled(def: SettingDefinition): boolean {
  if ('disabled' in def) return evalFlag(def.disabled, false);
  return evalFlag(def.control?.disabled, false);
}

/** Obsidian skips definitions with nothing to show (no name, render, control or action). */
export function hasContent(def: SettingDefinition): boolean {
  return !!(def.name || def.render || def.control || def.action);
}

export interface FallbackRow {
  def: SettingDefinition;
  disabled: boolean;
}

/** One block of rows, from a group or a run of top-level definitions. */
export interface FallbackSection {
  heading?: string;
  cls?: string;
  rows: FallbackRow[];
}

function isPage(item: SettingDefinitionItem | SettingGroupItem): boolean {
  return 'type' in item && item.type === 'page';
}

/**
 * What the fallback renderer draws, in order. Follows Obsidian 1.13's own
 * rendering: consecutive top-level definitions share an untitled section,
 * hidden items are left out, and a group whose items are all hidden is left
 * out with its heading. Pages are skipped (BojuBot defines none).
 */
export function planFallback(items: SettingDefinitionItem[]): FallbackSection[] {
  const sections: FallbackSection[] = [];
  let loose: SettingDefinition[] | null = null;
  const blocks: { heading?: string; cls?: string; visible: DefinitionFlag; defs: SettingGroupItem[] }[] = [];

  for (const item of items) {
    if (isPage(item)) continue;
    if ('type' in item && (item.type === 'group' || item.type === 'list')) {
      loose = null;
      blocks.push({ heading: item.heading, cls: item.cls, visible: item.visible, defs: item.items ?? [] });
    } else {
      if (!loose) {
        loose = [];
        blocks.push({ visible: true, defs: loose });
      }
      loose.push(item as SettingDefinition);
    }
  }

  for (const block of blocks) {
    if (!evalFlag(block.visible, true)) continue;
    const defs = block.defs.filter((d): d is SettingDefinition => !isPage(d)).filter(hasContent);
    const rows = defs
      .filter(def => evalFlag(def.visible, true))
      .map(def => ({ def, disabled: rowDisabled(def) }));
    if (defs.length > 0 && rows.length === 0) continue;
    sections.push({ heading: block.heading, cls: block.cls, rows });
  }
  return sections;
}

// ── Value mapping ──────────────────────────────────────────────────────────

/** A control value as field text: strings as-is, numbers and booleans
 *  stringified, anything else (undefined, null, objects) blank. */
export function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/** A text field's number: blank, negative or not a number → 0. */
export function parseNonNegativeInt(value: string): number {
  const n = parseInt(value, 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

/** The memory file size limit as shown in its field: 0 (no limit) shows blank. */
export function tokenCapText(tokens: number): string {
  return tokens === 0 ? '' : String(tokens);
}

// ── Branding control keys ──────────────────────────────────────────────────

export const BRAND_TEXT_FIELDS = ['name', 'icon', 'logo', 'sprite'] as const;
export type BrandTextField = typeof BRAND_TEXT_FIELDS[number];
export type BrandField = BrandTextField | 'applyToAssistantIdentity' | 'locked';

const BRAND_KEY_PREFIX = 'brand.';

/** The branding field a control key such as `brand.name` refers to, or null
 *  for any other key. */
export function brandFieldOf(key: string): BrandField | null {
  if (!key.startsWith(BRAND_KEY_PREFIX)) return null;
  const field = key.slice(BRAND_KEY_PREFIX.length);
  return (BRAND_TEXT_FIELDS as readonly string[]).includes(field) || field === 'applyToAssistantIdentity' || field === 'locked'
    ? field as BrandField
    : null;
}

// ── Command allowlist browser ──────────────────────────────────────────────

export interface CommandInfo {
  id: string;
  name: string;
}

/** Allowlisted IDs that no longer match a registered command, in allowlist order. */
export function orphanedCommandIds(allowlist: string[], commands: CommandInfo[]): string[] {
  const ids = new Set(commands.map(c => c.id));
  return allowlist.filter(id => !ids.has(id));
}

/** Commands matching the filter (name or ID, case-insensitive), allowlisted
 *  first, otherwise in the order given. */
export function filterCommands(commands: CommandInfo[], allowlist: string[], query: string): CommandInfo[] {
  const q = query.toLowerCase();
  const matched = q
    ? commands.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
    : commands.slice();
  const on = new Set(allowlist);
  return matched
    .map((cmd, index) => ({ cmd, index }))
    .sort((a, b) => {
      const aOn = on.has(a.cmd.id);
      const bOn = on.has(b.cmd.id);
      if (aOn !== bOn) return aOn ? -1 : 1;
      return a.index - b.index;
    })
    .map(({ cmd }) => cmd);
}

/** The count line under the command list. */
export function commandCountText(allowlist: string[], commands: CommandInfo[]): string {
  if (allowlist.length === 0) return 'No commands enabled.';
  const orphaned = orphanedCommandIds(allowlist, commands).length;
  const active = allowlist.length - orphaned;
  const enabled = `${active} command${active === 1 ? '' : 's'} enabled`;
  return orphaned > 0 ? `${enabled}, ${orphaned} not found (uncheck to remove).` : `${enabled}.`;
}
