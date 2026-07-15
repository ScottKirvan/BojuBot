import { Notice } from 'obsidian';
import { brandName } from './brand';

export interface TokenGaugeHost {
  getSessionId(): string | undefined;
  /** Delegates to SessionCoordinator.compact() so the reentrancy guard applies. */
  compact(onDone: () => void, onError: (message: string) => void): void;
}

/**
 * Manages the SVG context-window ring gauge and the compact-session confirm panel.
 * Build the DOM via build(), then call update() / reset() as token counts change.
 */
export class TokenGauge {
  static readonly CONTEXT_WINDOW = 200_000;

  private gaugeEl!: SVGElement;
  private confirmEl!: HTMLElement;
  private contextTokens = 0;

  constructor(private readonly host: TokenGaugeHost) { }

  /**
   * Create the SVG gauge and compact-confirm panel, attaching them to the
   * provided container elements. Call once during view construction.
   * The gauge is appended to inputToolbar; the confirm panel to inputArea.
   */
  build(inputToolbar: HTMLElement, inputArea: HTMLElement): void {
    const NS = 'http://www.w3.org/2000/svg';
    const R = 7, C = R * 2 * Math.PI;
    const svg = activeDocument.createElementNS(NS, 'svg') as SVGElement;
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('viewBox', '0 0 18 18');
    svg.classList.add('bojubot-token-gauge', 'bojubot-hidden');

    const svgTitle = activeDocument.createElementNS(NS, 'title');
    svg.appendChild(svgTitle);

    const track = activeDocument.createElementNS(NS, 'circle');
    track.setAttribute('cx', '9'); track.setAttribute('cy', '9'); track.setAttribute('r', String(R));
    track.classList.add('bojubot-gauge-track');
    svg.appendChild(track);

    const arc = activeDocument.createElementNS(NS, 'circle');
    arc.setAttribute('cx', '9'); arc.setAttribute('cy', '9'); arc.setAttribute('r', String(R));
    arc.classList.add('bojubot-gauge-arc');
    arc.setAttribute('stroke-dasharray', String(C));
    arc.setAttribute('stroke-dashoffset', String(C));
    svg.appendChild(arc);

    svg.addEventListener('click', () => this.showConfirm());
    inputToolbar.appendChild(svg);
    this.gaugeEl = svg;

    const confirm = inputArea.createDiv({ cls: 'bojubot-compact-confirm' });
    confirm.createEl('p', {
      text: 'Compact this session? Earlier messages will be summarized to free up context.',
      cls: 'bojubot-compact-confirm-msg',
    });
    const btnRow = confirm.createDiv({ cls: 'bojubot-compact-confirm-btns' });
    const doBtn = btnRow.createEl('button', { text: 'Compact', cls: 'mod-cta bojubot-compact-confirm-btn' });
    doBtn.addEventListener('click', () => { this.hideConfirm(); this.compact(); });
    const cancelBtn = btnRow.createEl('button', { text: 'Cancel', cls: 'bojubot-compact-confirm-btn' });
    cancelBtn.addEventListener('click', () => this.hideConfirm());
    this.confirmEl = confirm;
  }

  /** The SVG element — use to position relative siblings in the toolbar. */
  get element(): SVGElement { return this.gaugeEl; }

  getContextTokens(): number { return this.contextTokens; }

  /** Update gauge to reflect current token count; shows the gauge if hidden. */
  update(tokens: number): void {
    this.contextTokens = tokens;
    this.gaugeEl.classList.remove('bojubot-hidden');

    const arc = this.gaugeEl.querySelector('.bojubot-gauge-arc');
    if (!arc) return;

    const R = 7, C = R * 2 * Math.PI;
    const fraction = Math.min(tokens / TokenGauge.CONTEXT_WINDOW, 1);
    arc.setAttribute('stroke-dashoffset', String(C * (1 - fraction)));
    const cls = fraction < 0.6 ? 'low' : fraction < 0.8 ? 'mid' : fraction < 0.95 ? 'high' : 'full';
    arc.setAttribute('class', `bojubot-gauge-arc bojubot-gauge-${cls}`);

    const remaining = Math.round((1 - fraction) * 100);
    const label = tokens === 0
      ? 'Context window empty. Click to compact.'
      : `${remaining}% of context remaining before auto-compaction. Click to compact now.`;
    this.gaugeEl.setAttribute('aria-label', label);
    const titleEl = this.gaugeEl.querySelector('title');
    if (titleEl) titleEl.textContent = label;
  }

  /** Reset token count and hide the gauge; call on new session. */
  reset(): void {
    this.contextTokens = 0;
    this.gaugeEl.classList.add('bojubot-hidden');
  }

  showConfirm(): void {
    if (!this.host.getSessionId()) {
      new Notice(`${brandName()}: no active session to compact.`);
      return;
    }
    this.confirmEl.classList.add('is-visible');
  }

  hideConfirm(): void {
    this.confirmEl.classList.remove('is-visible');
  }

  /**
   * Trigger Claude Code's native /compact slash command via a --resume turn.
   * Claude Code writes a compact_boundary entry to the session .jsonl; BojuBot
   * reads that marker in loadSessionMessages() to render the compaction divider.
   * No custom summarization is performed here — all compaction logic lives in the CLI.
   */
  compact(): void {
    const sessionId = this.host.getSessionId();
    if (!sessionId) {
      new Notice(`${brandName()}: no active session to compact.`);
      return;
    }
    this.contextTokens = 0;
    this.update(0);
    new Notice(`${brandName()}: compacting session…`);
    this.host.compact(
      () => new Notice(`${brandName()}: session compacted.`),
      (message) => new Notice(`${brandName()}: compaction failed — ${message}`),
    );
  }
}
