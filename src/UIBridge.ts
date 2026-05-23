import { App, Modal, Notice } from 'obsidian';
import { log, warn } from './utils/logger';
import { ACTION_PREFIX } from './constants';
export { ACTION_PREFIX } from './constants';
export { BojuBotAction, extractActions } from './utils/actionParser';
import type { BojuBotAction } from './utils/actionParser';

interface UIBridgeInternal {
  setting: { open(): void; openTabById(id: string): void };
  commands: {
    commands: Record<string, { id: string; name: string }>;
    executeCommandById(id: string): boolean;
  };
}

export interface UIBridgeOptions {
  commandAllowlist?: string[];
  commandDenylist?: string[];
  /** If true, prompt when Claude tries a command not in the allowlist. If false, hard-block it. */
  confirmUnlistedCommands?: boolean;
  onAddToAllowlist?: (commandId: string) => Promise<void>;
  onAddToDenylist?: (commandId: string) => Promise<void>;
  onSetLabel?: (userLabel: string, assistantLabel: string) => void;
}

class ConfirmCommandModal extends Modal {
  private resolved = false;

  constructor(
    app: App,
    private commandName: string,
    private resolve: (result: { allow: boolean; remember: boolean }) => void,
  ) {
    super(app);
  }

  private settle(result: { allow: boolean; remember: boolean }) {
    if (this.resolved) return;
    this.resolved = true;
    this.resolve(result);
    this.close();
  }

  onOpen() {
    this.titleEl.setText('BojuBot — unlisted command');
    const { contentEl } = this;

    contentEl.createEl('p', {
      text: `Claude wants to run: "${this.commandName}". This command isn't in your allowlist.`,
      cls: 'bojubot-confirm-desc',
    });

    let remember = false;
    const checkRow = contentEl.createDiv({ cls: 'bojubot-confirm-check-row' });
    const checkbox = checkRow.createEl('input', { type: 'checkbox' });
    checkbox.id = 'bojubot-confirm-remember';
    checkbox.addEventListener('change', () => { remember = checkbox.checked; });
    const label = checkRow.createEl('label', { text: 'Don\'t ask again' });
    label.htmlFor = 'bojubot-confirm-remember';

    const btnRow = contentEl.createDiv({ cls: 'bojubot-confirm-btn-row' });
    const allowBtn = btnRow.createEl('button', { text: 'Allow', cls: 'mod-cta' });
    allowBtn.addEventListener('click', () => this.settle({ allow: true, remember }));
    const denyBtn = btnRow.createEl('button', { text: 'Deny' });
    denyBtn.addEventListener('click', () => this.settle({ allow: false, remember }));
  }

  onClose() {
    this.settle({ allow: false, remember: false });
    this.contentEl.empty();
  }
}

class RequestPermissionModal extends Modal {
  private resolved = false;

  constructor(
    app: App,
    private tool: string,
    private reason: string,
    private resolve: (granted: boolean) => void,
  ) {
    super(app);
  }

  private settle(granted: boolean) {
    if (this.resolved) return;
    this.resolved = true;
    this.resolve(granted);
    this.close();
  }

  onOpen() {
    this.titleEl.setText('Permission request');
    const { contentEl } = this;
    contentEl.createEl('p', {
      text: `Claude needs permission to use ${this.tool}:`,
      cls: 'bojubot-confirm-desc',
    });
    if (this.reason) {
      contentEl.createEl('p', { text: this.reason, cls: 'bojubot-permission-reason' });
    }
    const btnRow = contentEl.createDiv({ cls: 'bojubot-confirm-btn-row' });
    const allowBtn = btnRow.createEl('button', { text: 'Allow full access for this session', cls: 'mod-cta' });
    allowBtn.addEventListener('click', () => this.settle(true));
    const denyBtn = btnRow.createEl('button', { text: 'Deny' });
    denyBtn.addEventListener('click', () => this.settle(false));
  }

  onClose() {
    this.settle(false);
    this.contentEl.empty();
  }
}

export function promptPermissionRequest(app: App, tool: string, reason: string): Promise<boolean> {
  return new Promise<boolean>(resolve => new RequestPermissionModal(app, tool, reason, resolve).open());
}

/**
 * Execute a single BojuBot UI action via the Obsidian API.
 * The 6 built-in actions execute immediately (transparency via show-notice).
 * run-command requires the commandId to be in the allowlist, or prompts if confirmUnlistedCommands is true.
 */
export async function executeAction(app: App, action: BojuBotAction, options: UIBridgeOptions = {}): Promise<void> {
  const {
    commandAllowlist = [],
    commandDenylist = [],
    confirmUnlistedCommands = true,
    onAddToAllowlist,
    onAddToDenylist,
  } = options;

  log('UIBridge: executing action:', action.action);

  switch (action.action) {

    case 'open-file': {
      const file = app.vault.getFileByPath(action.path as string);
      if (file) {
        await app.workspace.getLeaf(false).openFile(file);
      } else {
        warn('UIBridge: open-file — file not found:', action.path);
      }
      break;
    }

    case 'open-file-split': {
      const file = app.vault.getFileByPath(action.path as string);
      if (file) {
        const leaf = app.workspace.getLeaf('split');
        await leaf.openFile(file);
      } else {
        warn('UIBridge: open-file-split — file not found:', action.path);
      }
      break;
    }

    case 'navigate-heading': {
      const file = app.vault.getFileByPath(action.path as string);
      if (file) {
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);
        requestAnimationFrame(() => {
          const view = leaf.view as unknown as { editor?: { getValue(): string; setCursor(pos: { line: number; ch: number }): void } };
          const editor = view?.editor;
          if (editor && action.heading) {
            const content = editor.getValue();
            const lines = content.split('\n');
            const idx = lines.findIndex((l: string) =>
              l.replace(/^#+\s*/, '').toLowerCase() === (action.heading as string).toLowerCase()
            );
            if (idx !== -1) editor.setCursor({ line: idx, ch: 0 });
          }
        });
      } else {
        warn('UIBridge: navigate-heading — file not found:', action.path);
      }
      break;
    }

    case 'show-notice': {
      const msg = (action.message as string) ?? '';
      const duration = typeof action.duration === 'number' ? action.duration : 4000;
      new Notice(msg, duration);
      break;
    }

    case 'focus-search': {
      (app as unknown as UIBridgeInternal).commands.executeCommandById('switcher:open');
      break;
    }

    case 'open-settings': {
      const tab = action.tab as string | undefined;
      (app as unknown as UIBridgeInternal).setting.open();
      if (tab) (app as unknown as UIBridgeInternal).setting.openTabById(tab);
      break;
    }

    case 'run-command': {
      const commandId = action.commandId as string;
      if (!commandId) { warn('UIBridge: run-command — missing commandId'); break; }

      const appInternal = app as unknown as UIBridgeInternal;
      const displayName = appInternal.commands.commands[commandId]?.name ?? commandId;

      if (commandAllowlist.includes(commandId)) {
        // Allowlist takes precedence over everything — execute immediately
        const executed = appInternal.commands.executeCommandById(commandId);
        if (executed) log('UIBridge: run-command executed:', commandId);
        else {
          warn('UIBridge: run-command — command not found or failed:', commandId);
          new Notice(`BojuBot: Could not run "${displayName}" — the command wasn't found. It may belong to a plugin that isn't enabled.`, 6000);
        }
      } else if (commandDenylist.includes(commandId)) {
        // Permanently denied (and not in allowlist) — hard block silently
        log('UIBridge: run-command hard-blocked by denylist:', commandId);
      } else if (confirmUnlistedCommands) {
        // Neither list — prompt
        const { allow, remember } = await new Promise<{ allow: boolean; remember: boolean }>(resolve => {
          new ConfirmCommandModal(app, displayName, resolve).open();
        });
        if (allow) {
          if (remember && onAddToAllowlist) await onAddToAllowlist(commandId);
          const executed = appInternal.commands.executeCommandById(commandId);
          if (executed) log('UIBridge: run-command executed:', commandId);
          else {
            warn('UIBridge: run-command — command not found or failed:', commandId);
            new Notice(`BojuBot: Could not run "${displayName}" — the command wasn't found. It may belong to a plugin that isn't enabled.`, 6000);
          }
        } else {
          if (remember && onAddToDenylist) await onAddToDenylist(commandId);
          log('UIBridge: run-command denied by user:', commandId);
          new Notice(`BojuBot: Command "${displayName}" denied.`, 3000);
        }
      } else {
        // Prompting disabled — hard block with notice
        warn('UIBridge: run-command blocked — not in allowlist:', commandId);
        new Notice(`BojuBot: Claude wanted to run "${displayName}" but it isn't in the Command Allowlist. Add it in Settings → BojuBot to enable it.`, 8000);
      }
      break;
    }

    case 'set-label': {
      const userLabel = ((action.user as string) ?? '').trim() || 'User';
      const assistantLabel = ((action.assistant as string) ?? '').trim() || 'BojuBot';
      options.onSetLabel?.(userLabel, assistantLabel);
      break;
    }

    default:
      warn('UIBridge: unknown action:', action.action);
  }
}
