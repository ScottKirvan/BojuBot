import { Modal, App, setIcon } from 'obsidian';

/** Minimal confirm dialog using an Obsidian Modal (replaces window.confirm). */
class ConfirmDeleteModal extends Modal {
  constructor(app: App, private sessionTitle: string, private onConfirm: () => void) {
    super(app);
  }
  onOpen() {
    this.titleEl.setText('Delete session');
    this.contentEl.createEl('p', {
      text: `Delete "${this.sessionTitle}"? This cannot be undone.`,
    });
    const btnRow = this.contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Cancel' })
      .addEventListener('click', () => this.close());
    const del = btnRow.createEl('button', { text: 'Delete', cls: 'mod-warning' });
    del.addEventListener('click', () => { this.close(); this.onConfirm(); });
  }
  onClose() { this.contentEl.empty(); }
}
import { StoredSession, saveSession, canResumeLocally, deleteSession } from '../utils/sessionStorage';

export class SessionListModal extends Modal {
  sessions: StoredSession[];
  filteredSessions: StoredSession[];
  vaultRoot: string;
  sessionsDir: string;
  activeSessionFileId: string | undefined;
  onSelect: (session: StoredSession) => void;
  onNewSession: () => void;
  onDismiss: () => void;
  onRename: (session: StoredSession) => void;
  onExportToVault: (session: StoredSession) => void;
  listContainer: HTMLElement | null = null;
  private draggedId: string | null = null;
  private isFiltering = false;

  constructor(
    app: App,
    vaultRoot: string,
    sessions: StoredSession[],
    onSelect: (s: StoredSession) => void,
    onNewSession: () => void,
    onDismiss: () => void = () => { },
    activeSessionFileId?: string,
    onRename: (session: StoredSession) => void = () => { },
    onExportToVault: (session: StoredSession) => void = () => { },
    sessionsDir?: string,
  ) {
    super(app);
    this.vaultRoot = vaultRoot;
    this.sessionsDir = sessionsDir ?? vaultRoot;
    this.sessions = sessions;
    this.filteredSessions = sessions;
    this.onSelect = onSelect;
    this.onNewSession = onNewSession;
    this.onDismiss = onDismiss;
    this.onRename = onRename;
    this.onExportToVault = onExportToVault;
    this.activeSessionFileId = activeSessionFileId;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Session history' });

    const topBar = contentEl.createDiv({ cls: 'bojubot-modal-topbar' });

    const filterInput = topBar.createEl('input', {
      cls: 'bojubot-session-filter',
      attr: { type: 'text', placeholder: 'Search sessions…' },
    });
    filterInput.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value.toLowerCase();
      this.isFiltering = query.length > 0;
      this.filteredSessions = this.isFiltering
        ? this.sessions.filter(s => s.title.toLowerCase().includes(query))
        : this.sessions;
      this.rerenderList();
    });

    const newSessionBtn = topBar.createEl('button', {
      text: '+ new',
      cls: 'bojubot-new-session-btn',
    });
    newSessionBtn.addEventListener('click', () => this.createNewSession());

    this.listContainer = contentEl.createDiv({ cls: 'bojubot-session-list-container' });
    this.rerenderList();
  }

  private createNewSession() {
    this.onNewSession();
    this.close();
  }

  private rerenderList() {
    if (!this.listContainer) return;
    this.listContainer.empty();

    if (this.filteredSessions.length === 0) {
      this.listContainer.createEl('p', {
        text: this.sessions.length === 0 ? 'No saved sessions yet.' : 'No sessions match your search.',
        cls: 'bojubot-modal-empty',
      });
      return;
    }

    const list = this.listContainer.createEl('ul', { cls: 'bojubot-session-list' });
    for (const session of this.filteredSessions) {
      this.renderSessionItem(list, session);
    }
    // Drop target for end of list
    if (!this.isFiltering) {
      list.addEventListener('dragover', (e) => e.preventDefault());
    }
  }

  private saveSortOrder() {
    this.sessions.forEach((s, i) => {
      s.sortOrder = i;
      saveSession(this.vaultRoot, s, this.sessionsDir);
    });
  }

  private renderSessionItem(list: HTMLElement, session: StoredSession) {
    const isNew = !session.claudeSessionId;
    const resumable = !isNew && canResumeLocally(session.claudeSessionId);
    const isActive = session.id === this.activeSessionFileId;
    const cls = [
      'bojubot-session-item',
      isNew ? 'bojubot-session-new' : '',
      !isNew && !resumable ? 'bojubot-session-remote' : '',
      isActive ? 'bojubot-session-active' : '',
    ].filter(Boolean).join(' ');
    const item = list.createEl('li', { cls });

    // Drag handle (hidden while filtering)
    const grip = item.createEl('span', { cls: 'bojubot-session-drag-handle' });
    setIcon(grip, 'grip-vertical');
    if (this.isFiltering) grip.addClass('bojubot-invisible');

    if (!this.isFiltering) {
      item.draggable = true;

      item.addEventListener('dragstart', (e) => {
        this.draggedId = session.id;
        item.addClass('bojubot-session-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setDragImage(item, 20, item.offsetHeight / 2);
        }
      });

      item.addEventListener('dragend', () => {
        this.draggedId = null;
        item.removeClass('bojubot-session-dragging');
        list.querySelectorAll('.bojubot-session-dragover-above, .bojubot-session-dragover-below')
          .forEach(el => {
            el.removeClass('bojubot-session-dragover-above');
            el.removeClass('bojubot-session-dragover-below');
          });
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!this.draggedId || this.draggedId === session.id) return;
        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        list.querySelectorAll('.bojubot-session-dragover-above, .bojubot-session-dragover-below')
          .forEach(el => {
            el.removeClass('bojubot-session-dragover-above');
            el.removeClass('bojubot-session-dragover-below');
          });
        item.addClass(e.clientY < midY ? 'bojubot-session-dragover-above' : 'bojubot-session-dragover-below');
      });

      item.addEventListener('dragleave', () => {
        item.removeClass('bojubot-session-dragover-above');
        item.removeClass('bojubot-session-dragover-below');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!this.draggedId || this.draggedId === session.id) return;
        const fromIdx = this.sessions.findIndex(s => s.id === this.draggedId);
        const toIdx = this.sessions.findIndex(s => s.id === session.id);
        if (fromIdx === -1 || toIdx === -1) return;

        const rect = item.getBoundingClientRect();
        const insertBefore = e.clientY < rect.top + rect.height / 2;
        const adjusted = toIdx + (insertBefore ? 0 : 1);

        const reordered = [...this.sessions];
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(fromIdx < adjusted ? adjusted - 1 : adjusted, 0, moved);

        this.sessions = reordered;
        this.filteredSessions = reordered;
        this.saveSortOrder();
        this.rerenderList();
      });
    }
    const titleEl = item.createEl('span', { text: session.title, cls: 'bojubot-session-title' });
    item.createEl('span', {
      text: new Date(session.updatedAt).toLocaleString(),
      cls: 'bojubot-session-date',
    });
    if (isNew) {
      item.createEl('span', { text: 'New', cls: 'bojubot-session-new-badge' });
    } else if (!resumable) {
      item.createEl('span', { text: 'Remote', cls: 'bojubot-session-remote-badge' });
    }

    const actionsDiv = item.createEl('div', { cls: 'bojubot-session-actions' });
    const exportBtn = actionsDiv.createEl('button', { cls: 'bojubot-export-btn' });
    setIcon(exportBtn, 'download');
    exportBtn.title = 'Save to vault';
    const renameBtn = actionsDiv.createEl('button', { cls: 'bojubot-rename-btn' });
    setIcon(renameBtn, 'pencil');
    renameBtn.title = 'Rename session';
    const deleteBtn = actionsDiv.createEl('button', { cls: 'bojubot-delete-btn' });
    setIcon(deleteBtn, 'trash-2');
    deleteBtn.title = 'Delete session';

    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onExportToVault(session);
    });

    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.bojubot-session-actions')) return;
      this.onSelect(session);
      this.close();
    });

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      new ConfirmDeleteModal(this.app, session.title, () => {
        const legacyDir = (session as StoredSession & { _legacyDir?: string })._legacyDir;
        deleteSession(this.vaultRoot, session.id, legacyDir, this.sessionsDir);
        this.sessions = this.sessions.filter(s => s.id !== session.id);
        this.filteredSessions = this.filteredSessions.filter(s => s.id !== session.id);
        this.rerenderList();
      }).open();
    });

    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const input = item.createEl('input', {
        cls: 'bojubot-rename-input',
        attr: { value: session.title, type: 'text' },
      });
      titleEl.hide();
      renameBtn.hide();
      deleteBtn.hide();
      input.focus();
      input.select();

      let committed = false;
      const commit = () => {
        if (committed) return;
        committed = true;
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== session.title) {
          session.title = newTitle;
          saveSession(this.vaultRoot, session, this.sessionsDir);
          titleEl.setText(newTitle);
          this.onRename(session);
        }
        input.remove();
        titleEl.show();
        renameBtn.show();
        deleteBtn.show();
      };

      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') { ke.preventDefault(); commit(); }
        if (ke.key === 'Escape') { input.remove(); titleEl.show(); renameBtn.show(); deleteBtn.show(); }
      });
      input.addEventListener('blur', commit);
    });
  }

  onClose() {
    this.contentEl.empty();
    this.onDismiss();
  }
}
