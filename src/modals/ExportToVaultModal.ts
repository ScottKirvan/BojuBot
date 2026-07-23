import { Modal, App } from 'obsidian';

export class ExportToVaultModal extends Modal {
  constructor(
    app: App,
    private defaultPath: string,
    private onConfirm: (path: string, openAfter: boolean) => void | Promise<void>,
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Export session to vault' });
    contentEl.createEl('p', {
      text: 'Vault-relative path for the note (folder will be created if needed):',
      cls: 'bojubot-export-hint',
    });

    const input = contentEl.createEl('input', {
      cls: 'bojubot-export-path-input',
      attr: { type: 'text', value: this.defaultPath },
    });

    const checkboxRow = contentEl.createDiv({ cls: 'bojubot-checkbox-row' });
    const checkbox = checkboxRow.createEl('input', {
      attr: { type: 'checkbox', id: 'bojubot-open-after' },
    });
    checkbox.checked = false;
    checkboxRow.createEl('label', {
      text: 'Open note after creation',
      attr: { for: 'bojubot-open-after' },
    });

    const btnRow = contentEl.createDiv({ cls: 'bojubot-export-btn-row' });
    btnRow.createEl('button', { text: 'Cancel' })
      .addEventListener('click', () => this.close());
    const exportBtn = btnRow.createEl('button', { text: 'Save to vault', cls: 'mod-cta' });
    exportBtn.addEventListener('click', () => {
      const path = input.value.trim();
      if (path) { void this.onConfirm(path, checkbox.checked); this.close(); }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { exportBtn.click(); }
      if (e.key === 'Escape') { this.close(); }
    });

    activeWindow.setTimeout(() => { input.focus(); input.select(); }, 50);
  }

  onClose() { this.contentEl.empty(); }
}
