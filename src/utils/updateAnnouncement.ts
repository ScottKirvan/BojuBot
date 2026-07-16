import { compareVersions, isNewerThan } from './versionCompare';

/** Minimal shape of a GitHub releases-API entry — only what the update modal needs. */
export interface GitHubReleaseLike {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  body: string | null;
}

/**
 * Bump every Markdown heading up one level (## -> ###, etc.) so headings from
 * a fetched release body nest correctly under the modal's own ### preamble
 * instead of competing with it at the same level.
 */
export function bumpHeadingLevel(markdown: string): string {
  return markdown.replace(/^(#{1,6})(\s)/gm, '#$1$2');
}

/**
 * Releases worth showing in the update modal: published (not draft/prerelease)
 * and newer than the last version the user was already shown. Oldest first,
 * so the modal reads chronologically top-to-bottom.
 */
export function selectReleasesToAnnounce(
  releases: GitHubReleaseLike[],
  lastAnnouncedVersion: string,
): GitHubReleaseLike[] {
  return releases
    .filter(r => !r.draft && !r.prerelease && isNewerThan(r.tag_name, lastAnnouncedVersion))
    .sort((a, b) => compareVersions(a.tag_name, b.tag_name));
}

export interface UpdateAnnouncementOptions {
  currentVersion: string;
  bmacUrl: string;
  discordUrl: string;
  issuesUrl: string;
}

/**
 * Assembles the full Markdown string rendered inside the update modal: a
 * hardcoded preamble (heading, thank-you/funding block, support links)
 * followed by each release's body (heading-bumped), oldest first.
 *
 * Always the stock "BojuBot" identity, not brand-aware — this modal never
 * runs for a white-labeled install in the first place (see main.ts's
 * announceUpdate(), which skips it entirely when isWhiteLabeled() is true),
 * so there is no scenario where a custom brand name would reach this string.
 */
export function buildUpdateAnnouncementMarkdown(
  releases: GitHubReleaseLike[],
  opts: UpdateAnnouncementOptions,
): string {
  const preamble = [
    `### What's new in BojuBot v${opts.currentVersion}`,
    ``,
    `Thanks for using BojuBot! If it saves you time, consider buying me a coffee ☕`,
    ``,
    `[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](${opts.bmacUrl})`,
    ``,
    `[💬 Discord](${opts.discordUrl}) · [🐛 Report a Bug](${opts.issuesUrl})`,
  ].join('\n');

  const bodies = releases.map(r => bumpHeadingLevel((r.body ?? '').trim()));
  return [preamble, ...bodies].join('\n\n---\n\n');
}
