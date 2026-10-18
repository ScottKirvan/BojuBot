import { App, Modal } from 'obsidian';
import creditsData from '../credits.json';
import { creditsTimeline } from '../utils/credits';

interface CreditEntry {
  name: string;
  detail?: string;
  url?: string;
}

interface CreditSection {
  title: string;
  entries: CreditEntry[];
}

/**
 * Movie-style credits (#380): the list rolls slowly upward until the last line
 * reaches the middle, fades out, and starts again — it keeps rolling under the
 * mouse. Scrolling, a click on the list or ↓ stops the roll so it can be read
 * at the reader's own pace. With reduced motion on, it never rolls — it's a
 * plain scrollable list.
 */
export class CreditsModal extends Modal {
  private roll: Animation | null = null;

  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    modalEl.addClass('bojubot-credits-modal');
    contentEl.createEl('h2', { text: 'Credits', cls: 'bojubot-credits-heading' });

    const viewport = contentEl.createDiv({ cls: 'bojubot-credits-viewport' });
    const track = viewport.createDiv({ cls: 'bojubot-credits-track' });

    for (const section of creditsData.sections as CreditSection[]) {
      const sectionEl = track.createDiv({ cls: 'bojubot-credits-section' });
      sectionEl.createDiv({ cls: 'bojubot-credits-title', text: section.title });
      for (const entry of section.entries) {
        const entryEl = sectionEl.createDiv({ cls: 'bojubot-credits-entry' });
        if (entry.url) {
          const link = entryEl.createEl('a', { cls: 'bojubot-credits-name', text: entry.name, href: entry.url });
          link.setAttr('target', '_blank');
          link.setAttr('rel', 'noopener');
        } else {
          entryEl.createSpan({ cls: 'bojubot-credits-name', text: entry.name });
        }
        if (entry.detail) entryEl.createDiv({ cls: 'bojubot-credits-detail', text: entry.detail });
      }
    }
    track.createDiv({ cls: 'bojubot-credits-notice', text: creditsData.notice });

    const reducedMotion = activeWindow.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stopRolling = () => {
      this.roll?.cancel();
      this.roll = null;
      viewport.removeClass('is-rolling');
      viewport.addClass('is-static');
    };
    if (reducedMotion) {
      stopRolling();
      return;
    }

    // Measured after layout. Roll up at a constant speed, fade out once the last
    // line reaches the middle, then loop from the bottom again.
    viewport.addClass('is-rolling');
    window.requestAnimationFrame(() => {
      const t = creditsTimeline(track.offsetHeight, viewport.clientHeight);
      this.roll = track.animate([
        { transform: `translateY(${t.fromPx}px)`, opacity: 1, offset: 0 },
        { transform: `translateY(${t.toPx}px)`, opacity: 1, offset: t.rollFraction },
        { transform: `translateY(${t.toPx}px)`, opacity: 0, offset: 1 },
      ], { duration: t.totalMs, iterations: Infinity, easing: 'linear' });
    });
    viewport.addEventListener('wheel', stopRolling, { once: true, passive: true });
    viewport.addEventListener('mousedown', stopRolling, { once: true });
    this.scope.register([], 'ArrowDown', () => { stopRolling(); return true; });
  }

  onClose() {
    this.roll?.cancel();
    this.roll = null;
    this.contentEl.empty();
  }
}
