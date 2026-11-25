import { App, Modal } from 'obsidian';

/** Asks for a session's new name (the `/` menu's Rename session, #323). Enter saves, Escape cancels. */
export class RenameSessionModal extends Modal {
  constructor(app: App, private readonly current: string, private readonly onRename: (title: string) => void) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText('Rename session');
    const input = this.contentEl.createEl('input', { cls: 'bojubot-rename-session-input', attr: { type: 'text', value: this.current } });
    const save = () => {
      const title = input.value.trim();
      this.close();
      if (title && title !== this.current) this.onRename(title);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); }
    });
    const btnRow = this.contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.close());
    btnRow.createEl('button', { text: 'Rename', cls: 'mod-cta' }).addEventListener('click', save);
    input.focus();
    input.select();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
