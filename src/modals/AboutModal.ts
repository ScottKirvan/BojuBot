import { App, Modal, Plugin, sanitizeHTMLToDom, setIcon } from 'obsidian';
import logoDataUrl from '../../assets/media/logo.png';

// Inline SVG — no file import, no runtime string replacement, attributes set directly.
// stroke-width="4" matches Lucide's visual weight at this viewBox size (48×48 vs Lucide's 24×24).
const DISCORD_SVG = `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"
  fill="none" stroke="currentColor" stroke-width="3"
  stroke-linecap="round" stroke-linejoin="round"
  width="100%" height="100%">
  <path d="M17.59,34.1733c-.89,1.3069-1.8944,2.6152-2.91,3.8267C7.3,37.79,4.5,33,4.5,33A44.83,44.83,0,0,1,9.31,13.48,16.47,16.47,0,0,1,18.69,10l1,2.31A32.6875,32.6875,0,0,1,24,12a32.9643,32.9643,0,0,1,4.33.3l1-2.31a16.47,16.47,0,0,1,9.38,3.51A44.8292,44.8292,0,0,1,43.5,33s-2.8,4.79-10.18,5a47.4193,47.4193,0,0,1-2.86-3.81m6.46-2.9c-3.84,1.9454-7.5555,3.89-12.92,3.89s-9.08-1.9446-12.92-3.89"/>
  <circle cx="17.847" cy="26.23" r="3.35"/>
  <circle cx="30.153" cy="26.23" r="3.35"/>
</svg>`;

interface LinkItem {
  icon: string;
  title: string;
  desc: string;
  label: string;
  href: string;
  accent?: boolean;
  svgInline?: string;
}

const LINK_ITEMS: LinkItem[] = [
  {
    icon: 'book-open',
    title: 'Documentation',
    desc: 'Official guide, skill reference, and setup instructions.',
    label: 'Visit',
    href: 'https://www.scottkirvan.com/BojuBot/',
    accent: true,
  },
  {
    icon: '',
    svgInline: DISCORD_SVG,
    title: 'Discord',
    desc: 'Chat with other BojuBot users and get support.',
    label: 'Join',
    href: 'https://discord.gg/TN6XJSNK5Y',
  },
  {
    icon: 'github',
    title: 'GitHub',
    desc: 'Source code, issues, and release notes.',
    label: 'View',
    href: 'https://github.com/ScottKirvan/BojuBot',
  },
];

export class AboutModal extends Modal {
  private plugin: Plugin;

  constructor(app: App, plugin: Plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('bojubot-about-modal');

    const header = contentEl.createDiv({ cls: 'bojubot-about-header' });
    const logoImg = header.createEl('img', { cls: 'bojubot-about-logo' });
    logoImg.src = logoDataUrl;
    logoImg.alt = 'BojuBot';
    header.createEl('div', { text: 'BojuBot', cls: 'bojubot-about-name' });
    header.createEl('div', {
      text: `Version ${this.plugin.manifest.version}`,
      cls: 'bojubot-about-version',
    });

    const list = contentEl.createDiv({ cls: 'bojubot-about-list' });
    for (const item of LINK_ITEMS) {
      const row = list.createDiv({ cls: 'bojubot-about-item' });

      const iconEl = row.createDiv({ cls: 'bojubot-about-item-icon' });
      if (item.svgInline) {
        iconEl.appendChild(sanitizeHTMLToDom(item.svgInline));
      } else {
        setIcon(iconEl, item.icon);
      }

      const text = row.createDiv({ cls: 'bojubot-about-item-text' });
      text.createEl('div', { text: item.title, cls: 'bojubot-about-item-title' });
      text.createEl('div', { text: item.desc, cls: 'bojubot-about-item-desc' });

      const btn = row.createEl('a', {
        text: item.label,
        cls: 'bojubot-about-item-btn' + (item.accent ? ' mod-cta' : ''),
        href: item.href,
      });
      btn.setAttr('target', '_blank');
      btn.setAttr('rel', 'noopener');
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
