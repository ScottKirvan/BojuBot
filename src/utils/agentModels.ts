/**
 * Pure helpers for the agent + model picker (#402): effort variants, the model
 * and effort a turn sends, and what picking a model does.
 * No Obsidian API dependency — safe to import in unit tests.
 */
import type { BackendId, ModelOption, PermissionMode } from '../backends/types';

/** Effort levels from least to most thinking. Used to order a model's levels
 *  and to find the nearest level a model has. */
export const EFFORT_ORDER = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

const LEVEL_NAMES: Record<string, string> = {
  minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Xhigh', max: 'Max',
};

function rank(level: string): number {
  return (EFFORT_ORDER as readonly string[]).indexOf(level);
}

/**
 * Split an effort-variant model ID ("gemini-3.8-flash-high") into its base
 * model and level, or null when the ID doesn't end in a known level.
 */
export function splitEffortVariant(id: string): { base: string; level: string } | null {
  const m = /^(.+)-(minimal|low|medium|high|xhigh|max)$/.exec(id);
  return m ? { base: m[1], level: m[2] } : null;
}

/**
 * Antigravity lists each model once per effort level ("gemini-3.8-flash-low" /
 * "Gemini 3.8 Flash (Low)", "-medium", "-high"). Collapse those into one entry
 * per base model ("gemini-3.8-flash" / "Gemini 3.8 Flash") that records the
 * levels it has, in EFFORT_ORDER. An ID is only treated as a variant when its
 * display name ends in the matching "(Level)"; anything else is kept as it is.
 * Order follows each base model's first appearance.
 */
export function collapseEffortVariants(models: readonly ModelOption[]): ModelOption[] {
  const out: ModelOption[] = [];
  const byBase = new Map<string, ModelOption>();
  const plain = new Set<string>();
  for (const m of models) {
    const split = splitEffortVariant(m.id);
    const suffix = split ? ` (${LEVEL_NAMES[split.level]})` : '';
    if (!split || !m.displayName.toLowerCase().endsWith(suffix.toLowerCase())) {
      if (!plain.has(m.id) && !byBase.has(m.id)) out.push({ ...m });
      plain.add(m.id);
      continue;
    }
    let entry = byBase.get(split.base);
    if (!entry) {
      entry = { id: split.base, displayName: m.displayName.slice(0, -suffix.length).trim() || split.base, description: m.description, effortLevels: [] };
      byBase.set(split.base, entry);
      out.push(entry);
    }
    const levels = entry.effortLevels ?? [];
    if (!levels.includes(split.level)) levels.push(split.level);
    levels.sort((a, b) => rank(a) - rank(b));
    entry.effortLevels = levels;
  }
  return out;
}

/**
 * A saved model ID from before models were collapsed ("gemini-3.8-flash-high")
 * as the base model plus the level it implied. Any other ID comes back as it
 * is. Used to migrate settings and session pins.
 */
export function migrateVariantModel(id: string): { model: string; level?: string } {
  const split = splitEffortVariant(id);
  return split ? { model: split.base, level: split.level } : { model: id };
}

/**
 * The level of `levels` closest to `wanted`; on a tie the lower one (less
 * thinking, less quota). Undefined when `levels` is empty or `wanted` isn't a
 * known level.
 */
export function nearestLevel(wanted: string, levels: readonly string[]): string | undefined {
  if (levels.includes(wanted)) return wanted;
  const w = rank(wanted);
  if (w < 0 || levels.length === 0) return undefined;
  let best: string | undefined;
  let bestDist = Infinity;
  for (const l of levels) {
    const r = rank(l);
    if (r < 0) continue;
    const d = Math.abs(r - w);
    if (d < bestDist || (d === bestDist && best !== undefined && r < rank(best))) {
      best = l;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Effort levels a model offers: the ones it has (Antigravity) that the CLI
 * also lists, or every level the CLI lists when the model doesn't say.
 * `cliLevels` is [] when the CLI doesn't support --effort.
 */
export function modelEffortLevels(models: readonly ModelOption[], modelId: string | undefined, cliLevels: readonly string[]): readonly string[] {
  const own = modelId ? models.find(m => m.id === modelId)?.effortLevels : undefined;
  return own ? cliLevels.filter(l => own.includes(l)) : cliLevels;
}

export interface TurnModelInput {
  /** The model for the turn (session pin, then the agent's default). May be an
   *  old effort-variant ID. Undefined = the CLI's own default. */
  model: string | undefined;
  /** Session pin; '' or undefined = none. */
  sessionEffort: string | undefined;
  /** The agent's default level; '' = Default (flag left off). */
  defaultEffort: string;
  /** The agent's models (collapsed). */
  models: readonly ModelOption[];
  /** Levels the CLI lists for --effort; [] when it doesn't support the flag. */
  cliLevels: readonly string[];
  /** True when the agent's model IDs come in effort variants (Antigravity). */
  effortVariants: boolean;
}

export interface TurnModel {
  model: string | undefined;
  effort: string | undefined;
  /** The levels the effort picker offers for this model. */
  levels: readonly string[];
}

/**
 * The model and `--effort` level a turn sends. Precedence: the session pin,
 * then the level an old variant model ID implied, then the agent's default.
 * A level the model doesn't have falls back to its nearest one; one the CLI
 * doesn't list is dropped (Claude Code, as before). The two never disagree:
 * with an effort the model is always the base ID, and an old variant ID is only
 * sent as it is when no effort can be sent.
 */
export function resolveTurnModel(input: TurnModelInput): TurnModel {
  let model = input.model;
  let implied: string | undefined;
  if (input.effortVariants && model) {
    const split = splitEffortVariant(model);
    // Only an ID the list doesn't know as it is (models are listed collapsed)
    if (split && !input.models.some(m => m.id === model)) {
      model = split.base;
      implied = split.level;
    }
  }
  const own = model ? input.models.find(m => m.id === model)?.effortLevels : undefined;
  const levels = modelEffortLevels(input.models, model, input.cliLevels);
  const chosen = input.sessionEffort || implied || input.defaultEffort;
  let effort: string | undefined;
  if (chosen) effort = own ? nearestLevel(chosen, levels) : (levels.includes(chosen) ? chosen : undefined);
  // Can't send the level: send the old variant ID itself, which carries it.
  if (!effort && implied) model = input.model;
  return { model, effort, levels };
}

export type ModelPickAction = 'switch-model' | 'switch-agent' | 'new-session';

/**
 * What picking a model does (#402). A model of the session's own agent switches
 * the model mid-session. Another agent's model moves a session that has no
 * conversation yet (and no first turn running) to that agent; otherwise a new
 * session starts on it.
 */
export function modelPickAction(opts: {
  sessionBackend: BackendId;
  pickedBackend: BackendId;
  hasConversation: boolean;
  busy: boolean;
}): ModelPickAction {
  if (opts.pickedBackend === opts.sessionBackend) return 'switch-model';
  return opts.hasConversation || opts.busy ? 'new-session' : 'switch-agent';
}

/** Permission modes from least to most access. */
const MODE_ORDER: PermissionMode[] = ['restricted', 'readonly', 'standard', 'full'];

/**
 * The permission mode a session keeps when it moves to (or starts again on)
 * another agent: the same mode when that agent offers it, otherwise the
 * nearest one with less access. Null when the agent has no mode with the same
 * or less access (Chat only on an Antigravity without BojuBot's agents): the
 * switch must not happen, since every other mode gives the agent more.
 */
export function modeForAgentSwitch(mode: PermissionMode, unavailable: Partial<Record<PermissionMode, string>>): PermissionMode | null {
  for (let i = MODE_ORDER.indexOf(mode); i >= 0; i--) {
    if (!unavailable[MODE_ORDER[i]]) return MODE_ORDER[i];
  }
  return null;
}

/** Toolbar text: "Claude · Claude Sonnet 5.5 · high"; no level at Default. */
export function agentModelIndicatorText(agentName: string, modelName: string, effort: string | undefined): string {
  return effort ? `${agentName} · ${modelName} · ${effort}` : `${agentName} · ${modelName}`;
}
