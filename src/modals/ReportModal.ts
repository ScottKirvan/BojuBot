import { App, Modal, Notice, requestUrl } from 'obsidian';
import { existsSync, readFileSync } from 'fs';
import { PRIVACY_URL } from '../constants';
import { RELAY_UNREACHABLE, ReportType, TITLE_MAX, SendResult, readRelayResponse, relayRequest, reportBody, reportIssueUrl, reportTitle, tailLines } from '../utils/report';

/** Lines of the debug log offered when the user ticks "Include recent log". */
const LOG_LINES = 80;
/** How long Send waits for the relay before offering the fallbacks. */
const SEND_TIMEOUT_MS = 20_000;

export interface ReportModalOptions {
  /** Where issues go (the brand's source repo). '' → no Open on GitHub button. */
  sourceRepoUrl: string;
  /** The report relay's `/report` address. '' → no Send button (white-labeled builds). */
  relayUrl: string;
  /** Pre-filled, editable details: version line, agent and model, error text. */
  details: string;
  type?: ReportType;
  /** Absolute path of the debug log, or '' when logging is off. */
  logPath: string;
  /** Show the privacy policy link (stock builds only). */
  showPrivacyLink: boolean;
}

const PLACEHOLDER: Record<ReportType, string> = {
  bug: 'What went wrong? What did you expect to happen?\n\nSteps to reproduce:\n1. \n2. \n3. ',
  feature: 'What would you like BojuBot to do?',
  feedback: "What's on your mind?",
};

const TITLE_PLACEHOLDER: Record<ReportType, string> = {
  bug: 'A short summary of the problem',
  feature: 'A short summary of the idea',
  feedback: 'A short summary',
};

/**
 * "Report a problem" (#382): everything pre-filled, everything that could hold
 * personal data editable, and nothing sent until the user clicks Send, which
 * posts it to the report relay (#381) to be filed as a GitHub issue. Open on
 * GitHub and Copy report stay available, so a failed Send never loses a report.
 */
export class ReportModal extends Modal {
  constructor(app: App, private readonly options: ReportModalOptions) {
    super(app);
  }

  onOpen() {
    const { contentEl, options } = this;
    contentEl.addClass('bojubot-param-modal', 'bojubot-report-modal');
    contentEl.createEl('h2', { text: 'Report a problem' });

    let type: ReportType = options.type ?? 'bug';

    const typeField = contentEl.createDiv({ cls: 'bojubot-param-field' });
    typeField.createEl('label', { text: 'Type', cls: 'bojubot-param-label' });
    const typeSelect = typeField.createEl('select', { cls: 'bojubot-param-input' });
    for (const [value, label] of [['bug', 'Bug'], ['feature', 'Feature request'], ['feedback', 'Feedback']] as const) {
      const opt = typeSelect.createEl('option', { text: label, value });
      if (value === type) opt.selected = true;
    }

    const titleField = contentEl.createDiv({ cls: 'bojubot-param-field' });
    titleField.createEl('label', { text: 'Title', cls: 'bojubot-param-label' });
    const title = titleField.createEl('input', { cls: 'bojubot-param-input', attr: { type: 'text', placeholder: TITLE_PLACEHOLDER[type], maxlength: String(TITLE_MAX) } });

    const descField = contentEl.createDiv({ cls: 'bojubot-param-field' });
    descField.createEl('label', { text: 'Description', cls: 'bojubot-param-label' });
    const desc = descField.createEl('textarea', { cls: 'bojubot-param-textarea', attr: { placeholder: PLACEHOLDER[type], rows: '7' } });
    typeSelect.addEventListener('change', () => {
      type = typeSelect.value as ReportType;
      title.placeholder = TITLE_PLACEHOLDER[type];
      desc.placeholder = PLACEHOLDER[type];
    });
    window.setTimeout(() => title.focus(), 50);

    const detailsField = contentEl.createDiv({ cls: 'bojubot-param-field' });
    detailsField.createEl('label', { text: 'Details', cls: 'bojubot-param-label' });
    detailsField.createDiv({ text: 'Filled in for you. Edit or remove anything you would rather not share.', cls: 'bojubot-param-desc' });
    const details = detailsField.createEl('textarea', { cls: 'bojubot-param-textarea bojubot-report-mono', attr: { rows: '4' } });
    details.value = options.details;

    // Recent log: off by default, shown for editing when included — logs can hold vault paths and note names.
    const logField = contentEl.createDiv({ cls: 'bojubot-param-field' });
    const logRow = logField.createEl('label', { cls: 'bojubot-custom-session-toggle-row' });
    const logCheck = logRow.createEl('input', { attr: { type: 'checkbox' } });
    logRow.createSpan({ text: 'Include recent log', cls: 'bojubot-param-label bojubot-custom-session-toggle-label' });
    const logHint = logField.createDiv({ cls: 'bojubot-param-desc' });
    const logText = logField.createEl('textarea', { cls: 'bojubot-param-textarea bojubot-report-mono', attr: { rows: '6' } });
    logText.hide();
    const logAvailable = !!options.logPath && existsSync(options.logPath);
    logHint.setText(logAvailable
      ? 'The last lines of the debug log. They can include note names and parts of messages; edit before sending.'
      : 'Turn on Settings → Logging → Enable debug log, reproduce the problem, then report it to include a log.');
    logCheck.disabled = !logAvailable;
    logCheck.addEventListener('change', () => {
      if (logCheck.checked) {
        if (!logText.value) {
          try { logText.value = tailLines(readFileSync(options.logPath, 'utf8'), LOG_LINES); }
          catch { logText.value = ''; }
        }
        logText.show();
      } else {
        logText.hide();
      }
    });

    const note = contentEl.createDiv({ cls: 'bojubot-param-desc bojubot-report-note' });
    note.appendText(options.relayUrl
      ? 'Send files your report as a public GitHub issue, so anyone can read it. You don\'t need a GitHub account. '
      : 'Reports become public GitHub issues, so anyone can read them. ');
    if (options.showPrivacyLink) {
      const a = note.createEl('a', { text: 'Privacy policy', href: PRIVACY_URL });
      a.setAttr('target', '_blank');
      a.setAttr('rel', 'noopener');
    }

    const current = () => ({
      type,
      title: title.value,
      description: desc.value,
      details: details.value,
      log: logCheck.checked ? logText.value : undefined,
    });

    /** Send and Open on GitHub need both; Copy report takes whatever is there. */
    const incomplete = (): boolean => {
      const missing = !title.value.trim() ? title : !desc.value.trim() ? desc : null;
      if (!missing) return false;
      new Notice(missing === title ? 'Add a title first.' : 'Add a description first.', 3000);
      missing.focus();
      return true;
    };

    const error = contentEl.createDiv({ cls: 'bojubot-report-error' });
    error.hide();

    const btnRow = contentEl.createDiv({ cls: 'bojubot-param-btn-row' });
    const copyBtn = btnRow.createEl('button', { text: 'Copy report', attr: { type: 'button' } });
    copyBtn.addEventListener('click', () => {
      const r = current();
      const text = `${reportTitle(r.type, r.title)}\n\n${reportBody(r)}`;
      navigator.clipboard.writeText(text)
        .then(() => new Notice('Report copied. Paste it wherever you want to send it.', 4000))
        .catch(() => new Notice("Couldn't copy the report.", 4000));
    });
    if (options.sourceRepoUrl) {
      const openBtn = btnRow.createEl('button', { text: 'Open on GitHub', cls: options.relayUrl ? '' : 'mod-cta', attr: { type: 'button' } });
      openBtn.addEventListener('click', () => {
        if (incomplete()) return;
        window.open(reportIssueUrl(options.sourceRepoUrl, current()), '_blank');
        this.close();
      });
    }
    if (options.relayUrl) {
      const sendBtn = btnRow.createEl('button', { text: 'Send', cls: 'mod-cta', attr: { type: 'button' } });
      sendBtn.addEventListener('click', () => {
        if (incomplete()) return;
        error.hide();
        sendBtn.disabled = true;
        sendBtn.setText('Sending…');
        void this.send(options.relayUrl, current()).then(result => {
          if ('url' in result) {
            this.showSent(result.url, result.number);
            return;
          }
          sendBtn.disabled = false;
          sendBtn.setText('Send');
          error.setText(result.message);
          error.show();
        });
      });
    }
  }

  /** Post the report to the relay. Never throws: every failure is a message. */
  private async send(relayUrl: string, input: Parameters<typeof relayRequest>[0]): Promise<SendResult> {
    let timer = 0;
    const timeout = new Promise<null>(resolve => { timer = window.setTimeout(() => resolve(null), SEND_TIMEOUT_MS); });
    try {
      // requestUrl, not fetch: it isn't subject to CORS, and the relay sends no CORS headers.
      const response = await Promise.race([
        requestUrl({ url: relayUrl, method: 'POST', contentType: 'application/json', body: JSON.stringify(relayRequest(input)), throw: false }),
        timeout,
      ]);
      if (!response) return { ok: false, message: RELAY_UNREACHABLE };
      let json: unknown = null;
      try { json = response.json; } catch { json = null; }
      return readRelayResponse(response.status, json);
    } catch {
      return { ok: false, message: RELAY_UNREACHABLE };
    } finally {
      window.clearTimeout(timer);
    }
  }

  /** Replace the form with the link to the filed issue. */
  private showSent(url: string, number: number): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Sent. Thanks!' });
    const p = contentEl.createEl('p');
    p.appendText('Your report is now ');
    const a = p.createEl('a', { text: number ? `issue #${number}` : 'a GitHub issue', href: url });
    a.setAttr('target', '_blank');
    a.setAttr('rel', 'noopener');
    p.appendText('. Anyone can read it there without a GitHub account; follow it to see replies.');
    const btnRow = contentEl.createDiv({ cls: 'bojubot-param-btn-row' });
    btnRow.createEl('button', { text: 'Close', cls: 'mod-cta', attr: { type: 'button' } })
      .addEventListener('click', () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}
