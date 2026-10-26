import { App, Modal } from 'obsidian';

/** What stopping the reply is for: switching the panel's session, or closing its tab. */
export type StopReplyAction = 'switch' | 'close';

const WORDING: Record<StopReplyAction, { text: string; button: string }> = {
  switch: { text: 'Stop it to switch now. The reply so far stays with the session it belongs to.', button: 'Stop it and switch' },
  close: { text: 'Stop it to close this tab now. The reply so far is saved with its session.', button: 'Stop it and close' },
};

/**
 * Asked before anything changes the panel's session, or closes its tab, while
 * a reply is still running (#398). `onChoice(true)` = stop the reply and go
 * ahead; closing the dialog any other way (Keep waiting, Escape, the close
 * button) = false.
 */
export class StopReplyModal extends Modal {
  private settled = false;

  constructor(app: App, private readonly onChoice: (stop: boolean) => void, private readonly action: StopReplyAction = 'switch') {
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
    this.contentEl.createEl('p', { text: WORDING[this.action].text });
    const btnRow = this.contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Keep waiting' })
      .addEventListener('click', () => this.settle(false));
    btnRow.createEl('button', { text: WORDING[this.action].button, cls: 'mod-warning' })
      .addEventListener('click', () => this.settle(true));
  }

  onClose(): void {
    this.contentEl.empty();
    this.settle(false);
  }
}
