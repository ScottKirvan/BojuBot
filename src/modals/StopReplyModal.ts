import { App, Modal } from 'obsidian';

/**
 * Asked before anything changes the panel's session while a reply is still
 * running (#398). `onChoice(true)` = stop the reply and switch; closing the
 * dialog any other way (Keep waiting, Escape, the close button) = false.
 */
export class StopReplyModal extends Modal {
  private settled = false;

  constructor(app: App, private readonly onChoice: (stop: boolean) => void) {
    super(app);
  }

  private settle(stop: boolean): void {
    if (this.settled) return;
    this.settled = true;
    this.close();
    this.onChoice(stop);
  }

  onOpen(): void {
    this.titleEl.setText('A reply is still running.');
    this.contentEl.createEl('p', {
      text: 'Stop it to switch now. The reply so far stays with the session it belongs to.',
    });
    const btnRow = this.contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Keep waiting' })
      .addEventListener('click', () => this.settle(false));
    btnRow.createEl('button', { text: 'Stop it and switch', cls: 'mod-warning' })
      .addEventListener('click', () => this.settle(true));
  }

  onClose(): void {
    this.contentEl.empty();
    this.settle(false);
  }
}
