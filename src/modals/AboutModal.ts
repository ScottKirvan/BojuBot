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

// Ko-fi brand mark (simple-icons). fill="currentColor" + width/height 100% match
// the DISCORD_SVG pattern so it inherits the icon color and fills its container
// the same way every other card icon does.
const KOFI_SVG = `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
  fill="currentColor" width="100%" height="100%">
  <title>Ko-fi</title>
  <path d="M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298"/>
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
      icon: '',
      svgInline: KOFI_SVG,
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
    header.createDiv({ text: brand.name, cls: 'bojubot-about-name' });
    header.createDiv({
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
      text.createDiv({ text: item.title, cls: 'bojubot-about-item-title' });
      text.createDiv({ text: item.desc, cls: 'bojubot-about-item-desc' });

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
