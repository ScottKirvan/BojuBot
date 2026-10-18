import { App, Modal, Notice } from 'obsidian';
import { existsSync, readFileSync } from 'fs';
import { PRIVACY_URL } from '../constants';
import { ReportType, reportBody, reportIssueUrl, reportTitle, tailLines } from '../utils/report';

/** Lines of the debug log offered when the user ticks "Include recent log". */
const LOG_LINES = 80;

export interface ReportModalOptions {
  /** Where issues go (the brand's source repo). '' → only Copy report is offered. */
  sourceRepoUrl: string;
  /** Pre-filled, editable details: version line, agent and model, error text. */
  details: string;
  type?: ReportType;
  /** Absolute path of the debug log, or '' when logging is off. */
  logPath: string;
  /** Show the privacy policy link (stock builds only). */
  showPrivacyLink: boolean;
}

const PLACEHOLDER: Record<ReportType, string> = {
  bug: 'What went wrong? What did you expect to happen?',
  feature: 'What would you like BojuBot to do?',
  feedback: "What's on your mind?",
};

/**
 * "Report a problem" (#382): everything pre-filled, everything that could hold
 * personal data editable, and nothing sent by BojuBot — the report opens as a
 * pre-filled GitHub issue for the user to submit, or is copied. A Send button
 * comes with the report relay (#381).
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

    const descField = contentEl.createDiv({ cls: 'bojubot-param-field' });
    descField.createEl('label', { text: 'Description', cls: 'bojubot-param-label' });
    const desc = descField.createEl('textarea', { cls: 'bojubot-param-textarea', attr: { placeholder: PLACEHOLDER[type], rows: '5' } });
    typeSelect.addEventListener('change', () => {
      type = typeSelect.value as ReportType;
      desc.placeholder = PLACEHOLDER[type];
    });
    window.setTimeout(() => desc.focus(), 50);

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
    note.appendText('Reports become public GitHub issues, so anyone can read them. ');
    if (options.showPrivacyLink) {
      const a = note.createEl('a', { text: 'Privacy policy', href: PRIVACY_URL });
      a.setAttr('target', '_blank');
      a.setAttr('rel', 'noopener');
    }

    const current = () => ({
      type,
      description: desc.value,
      details: details.value,
      log: logCheck.checked ? logText.value : undefined,
    });

    const btnRow = contentEl.createDiv({ cls: 'bojubot-param-btn-row' });
    const copyBtn = btnRow.createEl('button', { text: 'Copy report', attr: { type: 'button' } });
    copyBtn.addEventListener('click', () => {
      const r = current();
      const text = `${reportTitle(r.type, r.description)}\n\n${reportBody(r)}`;
      navigator.clipboard.writeText(text)
        .then(() => new Notice('Report copied. Paste it wherever you want to send it.', 4000))
        .catch(() => new Notice("Couldn't copy the report.", 4000));
    });
    if (options.sourceRepoUrl) {
      const openBtn = btnRow.createEl('button', { text: 'Open on GitHub', cls: 'mod-cta', attr: { type: 'button' } });
      openBtn.addEventListener('click', () => {
        if (!desc.value.trim()) {
          new Notice('Add a short description first.', 3000);
          desc.focus();
          return;
        }
        window.open(reportIssueUrl(options.sourceRepoUrl, current()), '_blank');
        this.close();
      });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
