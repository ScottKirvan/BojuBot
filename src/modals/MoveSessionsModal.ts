import { App, Modal } from 'obsidian';

/** Offered when the session storage path changed and the old folder still has sessions. */
export class MoveSessionsModal extends Modal {
  constructor(
    app: App,
    private count: number,
    private fromDir: string,
    private toDir: string,
    private onMove: () => void,
  ) {
    super(app);
  }

  onOpen() {
    const sessions = this.count === 1 ? '1 session is' : `${this.count} sessions are`;
    this.titleEl.setText('Move your sessions?');
    this.contentEl.createEl('p', { text: `The session storage path changed. ${sessions} still in the old folder:` });
    this.contentEl.createEl('pre', { text: this.fromDir });
    this.contentEl.createEl('p', { text: 'Move them to the new folder?' });
    this.contentEl.createEl('pre', { text: this.toDir });
    this.contentEl.createEl('p', {
      text: "If you leave them, they won't be listed until you set the old path again.",
      cls: 'setting-item-description',
    });
    const btnRow = this.contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Leave them' }).addEventListener('click', () => this.close());
    const move = btnRow.createEl('button', { text: 'Move', cls: 'mod-cta' });
    move.addEventListener('click', () => { this.close(); this.onMove(); });
  }

  onClose() { this.contentEl.empty(); }
}
