import { App, Component, MarkdownRenderer, Modal, requestUrl } from 'obsidian';
import { selectReleasesToAnnounce, buildUpdateAnnouncementMarkdown, GitHubReleaseLike } from '../utils/updateAnnouncement';
import { warn } from '../utils/logger';

const REPO = 'ScottKirvan/BojuBot';
const BMAC_URL = 'https://buymeacoffee.com/scottkirvan';
const DISCORD_URL = 'https://discord.gg/TN6XJSNK5Y';
const ISSUES_URL = `https://github.com/${REPO}/issues`;

/**
 * Shown after an update, once per version, with the release notes for
 * everything the user missed plus a thank-you/funding block. Only ever
 * opened for the stock identity — see main.ts's announceUpdate(), which
 * skips this entirely for white-labeled installs.
 */
export class UpdateModal extends Modal {
  private renderComponent = new Component();

  constructor(
    app: App,
    private currentVersion: string,
    private lastAnnouncedVersion: string,
  ) {
    super(app);
  }

  async onOpen() {
    this.renderComponent.load();
    const { contentEl } = this;
    contentEl.addClass('bojubot-update-modal');
    this.titleEl.setText("What's new");

    const body = contentEl.createDiv({ cls: 'bojubot-update-content' });
    body.createEl('p', { text: 'Loading release notes…' });

    let releases: GitHubReleaseLike[] = [];
    try {
      const resp = await requestUrl({
        url: `https://api.github.com/repos/${REPO}/releases`,
        method: 'GET',
      });
      releases = selectReleasesToAnnounce(resp.json as GitHubReleaseLike[], this.lastAnnouncedVersion);
    } catch (err) {
      warn('UpdateModal: failed to fetch release notes', err);
    }

    body.empty();
    const markdown = buildUpdateAnnouncementMarkdown(releases, {
      currentVersion: this.currentVersion,
      bmacUrl: BMAC_URL,
      discordUrl: DISCORD_URL,
      issuesUrl: ISSUES_URL,
    });
    await MarkdownRenderer.render(this.app, markdown, body, '', this.renderComponent);

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    const gotIt = btnRow.createEl('button', { text: 'Got it', cls: 'mod-cta' });
    gotIt.addEventListener('click', () => this.close());
  }

  onClose() {
    this.renderComponent.unload();
    this.contentEl.empty();
  }
}
