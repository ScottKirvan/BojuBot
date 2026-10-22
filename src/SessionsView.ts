import { App, ItemView, Keymap, Menu, Modal, Notice, WorkspaceLeaf, setIcon, setTooltip } from 'obsidian';
import type BojuBotPlugin from '../main';
import { renderAgentIcon } from './agentIcon';
import { estimateSessionTokens, hasReadableHistory, loadAllSessions, loadHistory, loadSessionFile, saveSession, sessionBackend, deleteSession, StoredSession } from './utils/sessionStorage';
import { STATUS_LABELS, SessionStatus } from './utils/sessionStatus';
import { agentModelLabel, filterSessions, groupSessions, moveSession, relativeTime, sessionGroupKey, sessionTooltip, SessionHistoryState } from './utils/sessionList';

export const VIEW_TYPE_SESSIONS = 'bojubot-sessions';

type LegacySession = StoredSession & { _legacyDir?: string };

/** Minimal confirm dialog for deleting a session. */
class ConfirmDeleteModal extends Modal {
  constructor(app: App, private sessionTitle: string, private onConfirm: () => void) {
    super(app);
  }
  onOpen() {
    this.titleEl.setText('Delete session');
    this.contentEl.createEl('p', { text: `Delete "${this.sessionTitle}"? This cannot be undone.` });
    const btnRow = this.contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.close());
    const del = btnRow.createEl('button', { text: 'Delete', cls: 'mod-warning' });
    del.addEventListener('click', () => { this.close(); this.onConfirm(); });
  }
  onClose() { this.contentEl.empty(); }
}

interface HistoryInfo {
  /** Cache key: changes whenever the session's record does. */
  key: string;
  state: SessionHistoryState;
  tokens?: number;
}

/**
 * The Sessions panel (#399): every saved session, grouped by when it was last
 * active, in a view that can sit in a sidebar and stay open. Replaces the
 * session manager pop-up.
 */
export class SessionsView extends ItemView {
  private sessions: StoredSession[] = [];
  private query = '';
  private listEl: HTMLElement | null = null;
  private draggedId: string | null = null;
  /** True while a row's title is being edited; refreshes wait until it's done. */
  private renaming = false;
  private refreshPending = false;
  private historyCache = new Map<string, HistoryInfo>();
  private contextTokens = 0;
  /** Agent and model labels for the render in progress (model lists read files). */
  private labelMemo = new Map<string, string>();

  constructor(leaf: WorkspaceLeaf, private plugin: BojuBotPlugin) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE_SESSIONS; }
  getDisplayText(): string { return 'Sessions'; }
  getIcon(): string { return 'messages-square'; }

  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass('bojubot-sessions-view');

    const header = root.createDiv({ cls: 'bojubot-sessions-header' });
    const filter = header.createEl('input', {
      cls: 'bojubot-sessions-filter',
      attr: { type: 'search', placeholder: 'Filter sessions…', 'aria-label': 'Filter sessions' },
    });
    filter.addEventListener('input', () => {
      this.query = filter.value;
      this.renderList();
    });

    const newBtn = header.createDiv({ cls: 'clickable-icon bojubot-sessions-new', attr: { role: 'button', tabindex: '0' } });
    setIcon(newBtn, 'message-square-plus');
    setTooltip(newBtn, 'New session (Ctrl/Cmd+click for a new tab)');
    newBtn.addEventListener('click', (e) => void this.plugin.newSession({ forceNewTab: Keymap.isModEvent(e) !== false }));
    newBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void this.plugin.newSession(); }
    });

    this.listEl = root.createDiv({ cls: 'bojubot-sessions-list' });
    this.refresh();
    void this.updateContextTokens();
  }

  async onClose() { this.listEl = null; }

  /** Reload sessions from disk and redraw. Deferred while a rename or drag is in progress. */
  refresh(): void {
    if (this.renaming || this.draggedId) { this.refreshPending = true; return; }
    this.refreshPending = false;
    this.sessions = loadAllSessions(this.plugin.getVaultRoot(), this.plugin.getSessionsDir(), this.app.vault.configDir);
    this.renderList();
  }

  /** Re-estimate the context a new session starts with (shown in row tooltips). */
  async updateContextTokens(): Promise<void> {
    const tokens = await this.plugin.estimateFreshContextTokens();
    if (tokens === this.contextTokens) return;
    this.contextTokens = tokens;
    this.renderList();
  }

  /** Update the status dots in place (cheaper than a redraw, and keeps hover and drag state). */
  updateStatuses(): void {
    if (!this.listEl) return;
    const statuses = this.plugin.getSessionStatuses();
    const openIds = this.plugin.getOpenSessionIds();
    this.listEl.querySelectorAll<HTMLElement>('.bojubot-sessions-row').forEach(row => {
      const id = row.dataset.sessionId ?? '';
      const dot = row.querySelector<HTMLElement>('.bojubot-status-dot');
      if (dot) this.renderStatusDot(dot, statuses.get(id), openIds.has(id));
    });
  }

  private renderStatusDot(dot: HTMLElement, status: SessionStatus | undefined, isOpen: boolean): void {
    const shown = status && status !== 'idle' ? status : isOpen ? 'open' : '';
    if (!shown) {
      dot.removeAttribute('data-status');
      dot.removeAttribute('aria-label');
      return;
    }
    dot.setAttribute('data-status', shown);
    dot.setAttribute('aria-label', shown === 'open' ? 'Open in a chat tab' : STATUS_LABELS[shown as SessionStatus]);
  }

  private finishDeferredRefresh(): void {
    if (this.refreshPending) this.refresh();
  }

  private renderList(): void {
    const list = this.listEl;
    if (!list) return;
    list.empty();

    const shown = filterSessions(this.sessions, this.query);
    if (shown.length === 0) {
      list.createDiv({
        cls: 'bojubot-sessions-empty',
        text: this.sessions.length === 0 ? 'No saved sessions yet.' : 'No sessions match your filter.',
      });
      return;
    }

    this.labelMemo.clear();
    const now = Date.now();
    const activeId = this.plugin.getActiveChatSessionId();
    const openIds = this.plugin.getOpenSessionIds();
    for (const group of groupSessions(shown, now)) {
      const groupEl = list.createDiv({ cls: 'bojubot-sessions-group' });
      groupEl.createDiv({ cls: 'bojubot-sessions-group-label', text: group.label });
      for (const session of group.sessions) this.renderRow(groupEl, session, now, session.id === activeId, openIds.has(session.id));
    }
  }

  private historyInfo(session: StoredSession): HistoryInfo {
    const key = `${session.updatedAt}|${session.claudeSessionId}`;
    const cached = this.historyCache.get(session.id);
    if (cached?.key === key) return cached;
    const sessionsDir = this.plugin.getSessionsDir();
    let info: HistoryInfo;
    if (!session.claudeSessionId) {
      info = { key, state: 'new' };
    } else if (!hasReadableHistory(session, sessionsDir)) {
      info = { key, state: 'remote' };
    } else {
      const messages = loadHistory(session, sessionsDir);
      info = { key, state: 'local', tokens: messages.length > 0 ? estimateSessionTokens(messages) : undefined };
    }
    this.historyCache.set(session.id, info);
    return info;
  }

  private agentModel(session: StoredSession): string {
    const backend = sessionBackend(session);
    const key = `${backend}|${session.model ?? ''}`;
    let label = this.labelMemo.get(key);
    if (label === undefined) {
      label = agentModelLabel(this.plugin.getBackend(backend).displayName, this.plugin.modelDisplayName(backend, session.model));
      this.labelMemo.set(key, label);
    }
    return label;
  }

  private renderRow(parent: HTMLElement, session: StoredSession, now: number, isActive: boolean, isOpen: boolean): void {
    const info = this.historyInfo(session);
    const row = parent.createDiv({
      cls: 'bojubot-sessions-row',
      attr: { tabindex: '0', role: 'button', 'data-session-id': session.id },
    });
    if (isActive) row.addClass('is-active');
    // Open in a chat tab: clicking it switches to that tab
    if (isOpen) row.addClass('bojubot-sessions-row-open');
    if (info.state === 'remote') row.addClass('bojubot-sessions-row-remote');

    const text = row.createDiv({ cls: 'bojubot-sessions-row-text' });
    const titleLine = text.createDiv({ cls: 'bojubot-sessions-row-title-line' });
    // Live status dot (#399): replying, waiting for you, unseen reply, error; a ring when open and idle
    this.renderStatusDot(titleLine.createSpan({ cls: 'bojubot-status-dot' }), this.plugin.getSessionStatuses().get(session.id), isOpen);
    if (session.pinned) setIcon(titleLine.createSpan({ cls: 'bojubot-sessions-row-pin' }), 'pin');
    const titleEl = titleLine.createSpan({ cls: 'bojubot-sessions-row-title', text: session.title });

    const backend = sessionBackend(session);
    const meta = text.createDiv({ cls: 'bojubot-sessions-row-meta' });
    renderAgentIcon(meta, backend, 'bojubot-sessions-row-agent');
    meta.createSpan({ cls: 'bojubot-sessions-row-agent-model', text: this.agentModel(session) });
    meta.createSpan({ cls: 'bojubot-sessions-row-time', text: relativeTime(session.updatedAt, now) });

    setTooltip(row, sessionTooltip({
      title: session.title,
      lastActive: new Date(session.updatedAt).toLocaleString(),
      state: info.state,
      tokens: info.tokens,
      contextTokens: this.contextTokens,
    }), { placement: 'right' });

    const more = row.createDiv({ cls: 'clickable-icon bojubot-sessions-row-more', attr: { 'aria-label': 'More options' } });
    setIcon(more, 'more-horizontal');
    more.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sessionMenu(session, row, titleEl).showAtMouseEvent(e);
    });

    // Ctrl/Cmd-click opens it in a new tab even when the current chat panel is free
    row.addEventListener('click', (e) => void this.plugin.openSession(session, { forceNewTab: Keymap.isModEvent(e) !== false }));
    row.addEventListener('keydown', (e) => {
      if (e.target !== row) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void this.plugin.openSession(session); }
    });
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.sessionMenu(session, row, titleEl).showAtMouseEvent(e);
    });

    if (!this.query) this.makeDraggable(row, session, now);
  }

  private sessionMenu(session: StoredSession, row: HTMLElement, titleEl: HTMLElement): Menu {
    const menu = new Menu();
    menu.addItem(item => item.setTitle('Open').setIcon('message-square').onClick(() => void this.plugin.openSession(session)));
    menu.addItem(item => item.setTitle('Open in new tab').setIcon('file-plus').onClick(() => void this.plugin.openSession(session, { forceNewTab: true })));
    menu.addItem(item => item.setTitle('Rename').setIcon('pencil').onClick(() => this.startRename(session, row, titleEl)));
    menu.addItem(item => item
      .setTitle(session.pinned ? 'Unpin' : 'Pin')
      .setIcon(session.pinned ? 'pin-off' : 'pin')
      .onClick(() => this.updateSession(session, s => { if (s.pinned) delete s.pinned; else s.pinned = true; })));
    menu.addItem(item => item.setTitle('Save to vault').setIcon('download').onClick(() => this.plugin.exportSession(session)));
    menu.addSeparator();
    menu.addItem(item => item.setTitle('Delete').setIcon('trash-2').setWarning(true).onClick(() => this.confirmDelete(session)));
    return menu;
  }

  /** Change one session's record: re-read it from disk first so a turn that
   *  finished meanwhile isn't overwritten, then save and redraw. */
  private updateSession(session: StoredSession, mutate: (s: StoredSession) => void): void {
    const sessionsDir = this.plugin.getSessionsDir();
    const fresh: LegacySession = loadSessionFile(sessionsDir, session.id) ?? session;
    const legacyDir = (session as LegacySession)._legacyDir;
    if (legacyDir && !fresh._legacyDir) fresh._legacyDir = legacyDir;
    mutate(fresh);
    saveSession(this.plugin.getVaultRoot(), fresh, sessionsDir);
    this.refresh();
  }

  private startRename(session: StoredSession, row: HTMLElement, titleEl: HTMLElement): void {
    this.renaming = true;
    row.draggable = false;
    const input = createEl('input', { cls: 'bojubot-sessions-rename', attr: { type: 'text', value: session.title } });
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const finish = (commit: boolean) => {
      if (done) return;
      done = true;
      this.renaming = false;
      const newTitle = input.value.trim();
      if (commit && newTitle && newTitle !== session.title) {
        this.updateSession(session, s => { s.title = newTitle; });
        this.plugin.onSessionRenamed(session.id, newTitle);
      } else {
        input.replaceWith(titleEl);
        this.finishDeferredRefresh();
      }
    };
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  }

  private confirmDelete(session: StoredSession): void {
    if (!this.plugin.canDeleteSession(session.id)) {
      new Notice('This session is still replying. Stop it before deleting the session.');
      return;
    }
    new ConfirmDeleteModal(this.app, session.title, () => {
      deleteSession(this.plugin.getVaultRoot(), session.id, (session as LegacySession)._legacyDir, this.plugin.getSessionsDir());
      this.historyCache.delete(session.id);
      this.plugin.onSessionDeleted(session.id);
      this.refresh();
    }).open();
  }

  private clearDropMarkers(): void {
    this.listEl?.querySelectorAll('.bojubot-sessions-dragover-above, .bojubot-sessions-dragover-below').forEach(el => {
      el.removeClass('bojubot-sessions-dragover-above', 'bojubot-sessions-dragover-below');
    });
  }

  /** Drag to reorder. A session can only move within its own group. */
  private makeDraggable(row: HTMLElement, session: StoredSession, now: number): void {
    row.draggable = true;
    const group = sessionGroupKey(session, now);
    const canDropHere = () => {
      if (!this.draggedId || this.draggedId === session.id) return false;
      const dragged = this.sessions.find(s => s.id === this.draggedId);
      return !!dragged && sessionGroupKey(dragged, now) === group;
    };

    row.addEventListener('dragstart', (e) => {
      this.draggedId = session.id;
      row.addClass('bojubot-sessions-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', session.title);
      }
    });
    row.addEventListener('dragend', () => {
      this.draggedId = null;
      row.removeClass('bojubot-sessions-dragging');
      this.clearDropMarkers();
      this.finishDeferredRefresh();
    });
    row.addEventListener('dragover', (e) => {
      if (!canDropHere()) return;
      e.preventDefault();
      const rect = row.getBoundingClientRect();
      this.clearDropMarkers();
      row.addClass(e.clientY < rect.top + rect.height / 2 ? 'bojubot-sessions-dragover-above' : 'bojubot-sessions-dragover-below');
    });
    row.addEventListener('dragleave', () => row.removeClass('bojubot-sessions-dragover-above', 'bojubot-sessions-dragover-below'));
    row.addEventListener('drop', (e) => {
      if (!canDropHere() || !this.draggedId) return;
      e.preventDefault();
      const rect = row.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      this.sessions = moveSession(this.sessions, this.draggedId, session.id, before);
      this.draggedId = null;
      this.saveSortOrder();
      this.renderList();
    });
  }

  private saveSortOrder(): void {
    const vaultRoot = this.plugin.getVaultRoot();
    const sessionsDir = this.plugin.getSessionsDir();
    this.sessions.forEach((s, i) => {
      // Re-read each record so a turn that finished meanwhile isn't overwritten
      const fresh: LegacySession = loadSessionFile(sessionsDir, s.id) ?? s;
      fresh.sortOrder = i;
      s.sortOrder = i;
      saveSession(vaultRoot, fresh, sessionsDir);
    });
  }
}
