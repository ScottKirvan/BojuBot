/**
 * Brand configuration — an opt-in surface for presenting the plugin under a
 * custom name, icon, art, greetings, and links.
 *
 * Design contract:
 *   - Every field is OPTIONAL and defaults to the bundled BojuBot identity.
 *     Nothing set anywhere → byte-for-byte the stock experience.
 *   - This is *presentation* only. Internal identifiers that would break
 *     existing installs or session histories if renamed are deliberately NOT
 *     brandable: the `bojubot:` command prefix, the view type, the settings
 *     tab id, the `bojubot-*` CSS classes, storage/log paths, asset filenames,
 *     and the `@@BOJU` wire protocol. See constants.ts / styles.css.
 *   - Author attribution (credit + MIT) is never a brand field — it is not
 *     removable via config.
 *
 * Link semantics differ from name/art on purpose:
 *   - `undefined` (key absent)  → fall back to the bundled default URL.
 *   - `''` (empty string)       → intentionally hidden (e.g. a white-label
 *                                 build that runs no community server).
 * That distinction is what lets a downstream build *hide* the Discord card
 * without the plugin ever *deleting* it — configuration, not removal.
 *
 * `resolveBrand()` is a pure function with no Obsidian dependency so it can be
 * unit-tested directly (see test/unit.test.ts). Do NOT rely on the shallow
 * `Object.assign` merge in loadSettings() to fill these in — a partial `brand`
 * in data.json (e.g. only `{ name }`) must still resolve every other field.
 */
import welcomeData from './welcome.json';

export interface Greeting {
  withName: string;
  withoutName: string;
}

export interface WelcomeGreetings {
  morning: Greeting[];
  afternoon: Greeting[];
  evening: Greeting[];
  night: Greeting[];
}

export interface BrandLinks {
  /** Documentation card in the About modal. */
  doc?: string;
  /** Community card (Discord by default) in the About modal. */
  community?: string;
  /** Source-code card in the About modal. */
  source?: string;
  /** Support URL shown to Claude in the system orientation. */
  support?: string;
}

export interface BrandConfig {
  /** Display name shown everywhere the user (or Claude) reads it. */
  name?: string;
  /** Lucide icon id for the ribbon / view tab. */
  icon?: string;
  /** `data:` URI or vault-relative path. Empty/absent → bundled logo. */
  logo?: string;
  /** `data:` URI or vault-relative path. Empty/absent → bundled sprite. */
  sprite?: string;
  /** Override the welcome-screen greeting sets. Absent → bundled greetings. */
  greetings?: WelcomeGreetings;
  /** Override the welcome-screen tips. Absent → bundled tips. */
  tips?: string[];
  /** Per-link overrides. See BrandLinks for the undefined-vs-empty semantics. */
  links?: BrandLinks;
  /**
   * Also rebrand the identity Claude receives in the system orientation
   * (the "## BojuBot" heading, "intercepted by BojuBot", the Support line).
   * Default false → the assistant identity stays byte-for-byte upstream even
   * when a display name is set, so behaviour/tests are unaffected unless a
   * downstream build explicitly opts in.
   */
  applyToAssistantIdentity?: boolean;
  /**
   * Hide the Brand section from Settings entirely once a white-label build is
   * configured, so end users can't discover or revert it from the UI. This is
   * a UX convenience, not a security boundary — anyone with file access to
   * the vault can still flip it back in data.json, same as any other setting.
   * Set from within the Settings UI itself (a one-way toggle while unlocked);
   * there is deliberately no in-app way back once it's on.
   */
  locked?: boolean;
}

export interface ResolvedBrand {
  name: string;
  icon: string;
  /** '' signals "use the bundled logo import". */
  logo: string;
  /** '' signals "use the bundled sprite import". */
  sprite: string;
  greetings: WelcomeGreetings;
  tips: string[];
  links: Required<BrandLinks>;
  applyToAssistantIdentity: boolean;
}

/** The stock BojuBot identity — every resolveBrand() fallback lives here. */
export const DEFAULT_BRAND = {
  name: 'BojuBot',
  icon: 'brain-circuit',
  links: {
    doc: 'https://www.scottkirvan.com/BojuBot/',
    community: 'https://discord.gg/TN6XJSNK5Y',
    source: 'https://github.com/ScottKirvan/BojuBot',
    support: 'https://www.scottkirvan.com/BojuBot/',
  },
} as const;

const DEFAULT_GREETINGS = welcomeData.welcome.greetings as WelcomeGreetings;
const DEFAULT_TIPS: string[] = welcomeData.welcome.tips;

/**
 * Resolve a (possibly partial, possibly undefined) BrandConfig into a fully
 * populated ResolvedBrand. Pure and total — safe to call on every read.
 */
export function resolveBrand(brand?: BrandConfig): ResolvedBrand {
  const links = brand?.links;
  return {
    // Whitespace-only strings fall back to the default, so a blank name field
    // in the settings UI can't produce an empty title.
    name: brand?.name?.trim() || DEFAULT_BRAND.name,
    icon: brand?.icon?.trim() || DEFAULT_BRAND.icon,
    logo: brand?.logo?.trim() || '',
    sprite: brand?.sprite?.trim() || '',
    greetings: brand?.greetings ?? DEFAULT_GREETINGS,
    tips: brand?.tips ?? DEFAULT_TIPS,
    // Nullish (not ||): an explicit '' means "hide", absent means "default".
    links: {
      doc: links?.doc ?? DEFAULT_BRAND.links.doc,
      community: links?.community ?? DEFAULT_BRAND.links.community,
      source: links?.source ?? DEFAULT_BRAND.links.source,
      support: links?.support ?? DEFAULT_BRAND.links.support,
    },
    applyToAssistantIdentity: brand?.applyToAssistantIdentity ?? false,
  };
}

/** True when a build is white-labeled (name differs from the stock identity). */
export function isWhiteLabeled(brand: ResolvedBrand): boolean {
  return brand.name !== DEFAULT_BRAND.name;
}

/**
 * The name Claude's own identity should use: the custom brand name only when
 * applyToAssistantIdentity is on, the stock name otherwise. Shared by
 * ContextManager (system orientation) and QueryHandler (the ui-bridge help
 * reference) so both stay in sync.
 */
export function resolveIdentityName(brand: ResolvedBrand): string {
  return brand.applyToAssistantIdentity ? brand.name : DEFAULT_BRAND.name;
}

/**
 * Rewrite occurrences of the stock name in a static reference doc to match
 * the resolved assistant identity. A no-op when identity rebranding is off.
 */
export function applyIdentityName(text: string, brand: ResolvedBrand): string {
  const identityName = resolveIdentityName(brand);
  return text.split(DEFAULT_BRAND.name).join(identityName);
}

/** Vault-relative export folder, falling back to a brand-aware default when unset. */
export function resolveExportFolder(custom: string, brand: ResolvedBrand): string {
  return custom.trim() || `${brand.name} Exports`;
}

// ---------------------------------------------------------------------------
// Active-brand accessor
//
// Most user-facing strings live in functional modules (notices in TokenGauge /
// UIBridge, the canvas truncation note, the About modal) that have no handle on
// the plugin instance. Rather than thread `brand` through every constructor and
// host interface, we mirror the resolved brand in module state — the same
// pattern the logger uses (initLogger + log()). The plugin sets this once in
// loadSettings() and again on every saveSettings(); until then it defaults to
// the stock identity, so anything importing this before load still reads
// "BojuBot" (and unit tests are unaffected).
// ---------------------------------------------------------------------------

let ACTIVE_BRAND: ResolvedBrand = resolveBrand(undefined);

export function setActiveBrand(brand: ResolvedBrand): void {
  ACTIVE_BRAND = brand;
}

export function activeBrand(): ResolvedBrand {
  return ACTIVE_BRAND;
}

/** Shorthand for the most common need: the display name. */
export function brandName(): string {
  return ACTIVE_BRAND.name;
}
