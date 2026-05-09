import { App, FuzzySuggestModal, Modal, TFile } from 'obsidian';

export interface SlashParam {
  id: string;
  /** `obsidianmd_note` is the canonical vault-picker type; `note` is a legacy alias. */
  type: 'input' | 'textarea' | 'dropdown' | 'checkboxes' | 'obsidianmd_note' | 'note';
  label: string;
  description?: string;
  placeholder?: string;
  options?: string[];
  default?: string;
  validations?: { required?: boolean };
}

/** True for both the canonical `obsidianmd_note` type and the legacy `note` alias. */
function isNoteType(type: SlashParam['type']): boolean {
  return type === 'obsidianmd_note' || type === 'note';
}

export interface SlashParamAttachment {
  text: string;
  source: string;
}

/**
 * Modal form for parameterized skills.
 * Renders fields from the skill's `params` frontmatter, validates required
 * fields, interpolates {{id}} tokens into the prompt body, then calls back
 * with the result, whether to autorun it, and any note attachments.
 *
 * Note-type fields are NOT interpolated inline — their content is returned
 * as attachments so ClaudeView can add them to pendingContexts (same as
 * @-mention). The {{id}} token is stripped from the prompt body.
 */
export class SlashParamModal extends Modal {
  private values: Record<string, string> = {};
  /** Maps note param id → { content, basename } for attachment handling. */
  private noteValues: Record<string, { content: string; basename: string }> = {};

  constructor(
    app: App,
    private commandName: string,
    private params: SlashParam[],
    private body: string,
    private autorun: boolean,
    private onSubmit: (result: string, autorun: boolean, attachments: SlashParamAttachment[]) => void,
  ) {
    super(app);
    for (const p of params) {
      if (!isNoteType(p.type)) this.values[p.id] = p.default ?? '';
    }
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('obsidibot-param-modal');
    contentEl.createEl('h2', { text: this.commandName });

    const form = contentEl.createEl('form');
    const errorEls: Record<string, HTMLElement> = {};

    for (const param of this.params) {
      const fieldEl = form.createDiv({ cls: 'obsidibot-param-field' });
      fieldEl.createEl('label', { text: param.label, cls: 'obsidibot-param-label' });
      if (param.description) {
        fieldEl.createEl('div', { text: param.description, cls: 'obsidibot-param-desc' });
      }

      if (param.type === 'input') {
        const input = fieldEl.createEl('input', {
          cls: 'obsidibot-param-input',
          attr: { type: 'text', placeholder: param.placeholder ?? '' },
        });
        input.value = this.values[param.id];
        input.addEventListener('input', () => { this.values[param.id] = input.value; });

      } else if (param.type === 'textarea') {
        const ta = fieldEl.createEl('textarea', { cls: 'obsidibot-param-textarea' });
        ta.placeholder = param.placeholder ?? '';
        ta.value = this.values[param.id];
        ta.addEventListener('input', () => { this.values[param.id] = ta.value; });

      } else if (param.type === 'dropdown') {
        const sel = fieldEl.createEl('select', { cls: 'obsidibot-param-select' });
        for (const opt of param.options ?? []) {
          sel.createEl('option', { text: opt, value: opt });
        }
        const initial = this.values[param.id] || param.options?.[0] || '';
        this.values[param.id] = initial;
        sel.value = initial;
        sel.addEventListener('change', () => { this.values[param.id] = sel.value; });

      } else if (param.type === 'checkboxes') {
        const checked: string[] = [];
        for (const opt of param.options ?? []) {
          const row = fieldEl.createEl('label', { cls: 'obsidibot-param-checkbox-row' });
          const cb = row.createEl('input', { attr: { type: 'checkbox' } });
          row.createSpan({ text: opt });
          cb.addEventListener('change', () => {
            if (cb.checked) {
              if (!checked.includes(opt)) checked.push(opt);
            } else {
              const i = checked.indexOf(opt);
              if (i >= 0) checked.splice(i, 1);
            }
            this.values[param.id] = checked.join(', ');
          });
        }

      } else if (isNoteType(param.type)) {
        const noteInput = fieldEl.createEl('input', {
          cls: 'obsidibot-param-input obsidibot-param-note-input',
          attr: { type: 'text', placeholder: 'Click to pick a note…', readonly: 'true' },
        });
        noteInput.addEventListener('click', () => {
          new NotePicker(this.app, async (file) => {
            const content = await this.app.vault.read(file);
            this.noteValues[param.id] = { content, basename: file.basename };
            noteInput.value = file.basename;
          }).open();
        });
      }

      const errEl = fieldEl.createEl('div', { cls: 'obsidibot-param-error' });
      errEl.hide();
      errorEls[param.id] = errEl;
    }

    const btnRow = form.createDiv({ cls: 'obsidibot-param-btn-row' });
    btnRow.createEl('button', {
      text: this.autorun ? 'Run' : 'Insert',
      cls: 'mod-cta',
      attr: { type: 'submit' },
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      let valid = true;
      for (const param of this.params) {
        const errEl = errorEls[param.id];
        const hasValue = isNoteType(param.type)
          ? !!this.noteValues[param.id]
          : !!this.values[param.id]?.trim();
        if (param.validations?.required && !hasValue) {
          errEl.setText(`${param.label} is required.`);
          errEl.show();
          valid = false;
        } else {
          errEl.hide();
        }
      }
      if (!valid) return;

      // Interpolate non-note fields; strip note {{tokens}} (content goes as attachments)
      let result = this.body;
      const attachments: SlashParamAttachment[] = [];

      for (const param of this.params) {
        if (isNoteType(param.type)) {
          const note = this.noteValues[param.id];
          if (note) attachments.push({ text: note.content, source: note.basename });
          // Remove the {{id}} placeholder from the prompt body
          result = result.replace(new RegExp(`\\{\\{${param.id}\\}\\}`, 'g'), '');
        } else {
          const val = this.values[param.id] ?? '';
          result = result.replace(new RegExp(`\\{\\{${param.id}\\}\\}`, 'g'), val);
        }
      }

      // Strip any remaining unresolved tokens and collapse extra blank lines
      result = result.replace(/\{\{\w+\}\}/g, '').replace(/\n{3,}/g, '\n\n').trim();

      this.close();
      this.onSubmit(result, this.autorun, attachments);
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

/** Fuzzy vault-file picker used by the `obsidianmd_note` field type (and legacy `note` alias). */
class NotePicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, private onChoose: (file: TFile) => Promise<void>) {
    super(app);
    this.setPlaceholder('Pick a note…');
  }

  getItems(): TFile[] {
    return this.app.vault.getMarkdownFiles();
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile) {
    void this.onChoose(file);
  }
}
