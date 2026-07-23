import { App, Modal, Plugin, sanitizeHTMLToDom, setIcon } from 'obsidian';
import logoDataUrl from '../../assets/media/logo.png';
import { activeBrand, isWhiteLabeled, DEFAULT_BRAND, ResolvedBrand } from '../brand';
import { KOFI_URL } from '../constants';

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

// Cards are built from the resolved brand links. An empty link ('') means the
// downstream build chose to hide that card — the card is skipped, never deleted
// from the code. Nothing here removes author attribution: that lives in the
// credit line below, outside the configurable links.
function buildLinkItems(brand: ResolvedBrand): LinkItem[] {
  const { name, links } = brand;
  const items: LinkItem[] = [];
  if (links.doc) {
    items.push({
      icon: 'book-open',
      title: 'Documentation',
      desc: 'Official guide, skill reference, and setup instructions.',
      label: 'Visit',
      href: links.doc,
      accent: true,
    });
  }
  if (links.community) {
    items.push({
      icon: '',
      svgInline: DISCORD_SVG,
      title: 'Discord',
      desc: `Chat with other ${name} users and get support.`,
      label: 'Join',
      href: links.community,
    });
  }
  if (links.source) {
    items.push({
      icon: 'github',
      title: 'GitHub',
      desc: 'Source code, issues, and release notes.',
      label: 'View',
      href: links.source,
    });
  }
  // Scott's own funding link, not a brand.links field — never surfaced on a
  // white-labeled build, same reasoning as the welcome-screen sponsor message.
  if (!isWhiteLabeled(brand)) {
    items.push({
      icon: 'heart',
      title: 'Buy me a coffee',
      desc: 'Show your love by supporting BojuBot and the author.',
      label: 'Buy',
      href: KOFI_URL,
    });
  }
  return items;
}

export class AboutModal extends Modal {
  private plugin: Plugin;

  constructor(app: App, plugin: Plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('bojubot-about-modal');

    const brand = activeBrand();
    const logoSrc = !brand.logo
      ? logoDataUrl
      : brand.logo.startsWith('data:')
        ? brand.logo
        : this.app.vault.adapter.getResourcePath(brand.logo);

    const header = contentEl.createDiv({ cls: 'bojubot-about-header' });
    const logoImg = header.createEl('img', { cls: 'bojubot-about-logo' });
    logoImg.src = logoSrc;
    logoImg.alt = brand.name;
    header.createEl('div', { text: brand.name, cls: 'bojubot-about-name' });
    header.createEl('div', {
      text: `Version ${this.plugin.manifest.version}`,
      cls: 'bojubot-about-version',
    });

    const list = contentEl.createDiv({ cls: 'bojubot-about-list' });
    for (const item of buildLinkItems(brand)) {
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

    // Preserve upstream attribution on any white-labeled build. Never shown for
    // a stock BojuBot install (it would be redundant); always shown once the
    // name is customized, so the origin credit + license can't be configured
    // away — only the operational links above are configurable.
    if (isWhiteLabeled(brand)) {
      const credit = contentEl.createDiv({ cls: 'bojubot-about-credit' });
      credit.appendText('Based on ');
      const link = credit.createEl('a', { text: DEFAULT_BRAND.name, href: DEFAULT_BRAND.links.source });
      link.setAttr('target', '_blank');
      link.setAttr('rel', 'noopener');
      credit.appendText(' by Scott Kirvan · MIT');
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
