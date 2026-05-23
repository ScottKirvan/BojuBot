import { App, Modal } from 'obsidian';
import type BojuBotPlugin from '../../main';

export class MemoryAuditModal extends Modal {
  constructor(private _app: App, private plugin: BojuBotPlugin) {
    super(_app);
  }

  onOpen() {
    this.titleEl.setText('Memory file updated');

    this.contentEl.createEl('p', {
      text:
        `The memory file (${this.plugin.settings.contextFilePath}) was modified by Claude. ` +
        `Open it to review the changes, or ask Claude to audit it for suspicious content.`,
    });

    const btnRow = this.contentEl.createDiv({ cls: 'bojubot-audit-btn-row' });

    btnRow.createEl('button', { text: 'Open file' })
      .addEventListener('click', () => {
        this.close();
        const file = this._app.vault.getFileByPath(this.plugin.settings.contextFilePath);
        if (file) void this._app.workspace.getLeaf(false).openFile(file);
      });

    btnRow.createEl('button', { cls: 'mod-cta', text: 'Audit with Claude' })
      .addEventListener('click', () => {
        this.close();
        void this.plugin.triggerMemoryAudit();
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}
