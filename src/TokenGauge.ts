import { Notice } from 'obsidian';
import { spawnClaude, PermissionMode } from './ClaudeProcess';

export interface TokenGaugeHost {
  getSessionId(): string | undefined;
  getBinaryPath(): string;
  getVaultRoot(): string;
  getEnv(): Record<string, string>;
  getPermissionMode(): PermissionMode;
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

  constructor(private readonly host: TokenGaugeHost) {}

  /**
   * Create the SVG gauge and compact-confirm panel, attaching them to the
   * provided container elements. Call once during view construction.
   * The gauge is appended to inputToolbar; the confirm panel to inputArea.
   */
  build(inputToolbar: HTMLElement, inputArea: HTMLElement): void {
    const NS = 'http://www.w3.org/2000/svg';
    const R = 7, C = R * 2 * Math.PI;
    const svg = document.createElementNS(NS, 'svg') as SVGElement;
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('viewBox', '0 0 18 18');
    svg.classList.add('obsidibot-token-gauge', 'obsidibot-hidden');

    const svgTitle = document.createElementNS(NS, 'title');
    svg.appendChild(svgTitle);

    const track = document.createElementNS(NS, 'circle');
    track.setAttribute('cx', '9'); track.setAttribute('cy', '9'); track.setAttribute('r', String(R));
    track.classList.add('obsidibot-gauge-track');
    svg.appendChild(track);

    const arc = document.createElementNS(NS, 'circle');
    arc.setAttribute('cx', '9'); arc.setAttribute('cy', '9'); arc.setAttribute('r', String(R));
    arc.classList.add('obsidibot-gauge-arc');
    arc.setAttribute('stroke-dasharray', String(C));
    arc.setAttribute('stroke-dashoffset', String(C));
    svg.appendChild(arc);

    svg.addEventListener('click', () => this.showConfirm());
    inputToolbar.appendChild(svg);
    this.gaugeEl = svg;

    const confirm = inputArea.createDiv({ cls: 'obsidibot-compact-confirm' });
    confirm.createEl('p', {
      text: 'Compact this session? Earlier messages will be summarized to free up context.',
      cls: 'obsidibot-compact-confirm-msg',
    });
    const btnRow = confirm.createDiv({ cls: 'obsidibot-compact-confirm-btns' });
    const doBtn = btnRow.createEl('button', { text: 'Compact', cls: 'mod-cta obsidibot-compact-confirm-btn' });
    doBtn.addEventListener('click', () => { this.hideConfirm(); this.compact(); });
    const cancelBtn = btnRow.createEl('button', { text: 'Cancel', cls: 'obsidibot-compact-confirm-btn' });
    cancelBtn.addEventListener('click', () => this.hideConfirm());
    this.confirmEl = confirm;
  }

  /** The SVG element — use to position relative siblings in the toolbar. */
  get element(): SVGElement { return this.gaugeEl; }

  getContextTokens(): number { return this.contextTokens; }

  /** Update gauge to reflect current token count; shows the gauge if hidden. */
  update(tokens: number): void {
    this.contextTokens = tokens;
    this.gaugeEl.classList.remove('obsidibot-hidden');

    const arc = this.gaugeEl.querySelector('.obsidibot-gauge-arc');
    if (!arc) return;

    const R = 7, C = R * 2 * Math.PI;
    const fraction = Math.min(tokens / TokenGauge.CONTEXT_WINDOW, 1);
    arc.setAttribute('stroke-dashoffset', String(C * (1 - fraction)));
    const cls = fraction < 0.6 ? 'low' : fraction < 0.8 ? 'mid' : fraction < 0.95 ? 'high' : 'full';
    arc.setAttribute('class', `obsidibot-gauge-arc obsidibot-gauge-${cls}`);

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
    this.gaugeEl.classList.add('obsidibot-hidden');
  }

  showConfirm(): void {
    if (!this.host.getSessionId()) {
      new Notice('ObsidiBot: no active session to compact.');
      return;
    }
    this.confirmEl.classList.add('is-visible');
  }

  hideConfirm(): void {
    this.confirmEl.classList.remove('is-visible');
  }

  /**
   * Trigger Claude Code's native /compact slash command via a --resume turn.
   * Claude Code writes a compact_boundary entry to the session .jsonl; ObsidiBot
   * reads that marker in loadSessionMessages() to render the compaction divider.
   * No custom summarization is performed here — all compaction logic lives in the CLI.
   */
  compact(): void {
    const sessionId = this.host.getSessionId();
    if (!sessionId) {
      new Notice('ObsidiBot: no active session to compact.');
      return;
    }
    this.contextTokens = 0;
    this.update(0);
    new Notice('ObsidiBot: compacting session…');
    const proc = spawnClaude({
      binaryPath: this.host.getBinaryPath(),
      prompt: '/compact',
      vaultRoot: this.host.getVaultRoot(),
      env: this.host.getEnv(),
      resumeSessionId: sessionId,
      permissionMode: this.host.getPermissionMode(),
    });
    proc.stdout?.resume();
    proc.on('close', () => new Notice('ObsidiBot: session compacted.'));
    proc.on('error', (err) => new Notice(`ObsidiBot: compaction failed — ${err.message}`));
  }
}
