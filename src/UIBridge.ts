import { App, Modal, Notice } from 'obsidian';
import { log, warn } from './utils/logger';
import { brandName } from './brand';
import { canWrite } from './backends/modes';
import { bridgeActionAllowed } from './utils/modeGates';
import { BridgeRefusal, destinationProblem, knownSettingsTab, newNameProblem, noticePayload } from './utils/bridgeValidation';
import type { PermissionMode } from './backends/types';
import { ReportPrefill, reportPrefill } from './utils/report';
export { BOJU_PREFIX } from './constants';
export { BojuBotAction, extractActions } from './utils/actionParser';
import type { BojuBotAction } from './utils/actionParser';

interface UIBridgeInternal {
  setting: {
    open(): void;
    openTabById(id: string): void;
    settingTabs?: { id: string }[];
    pluginTabs?: { id: string }[];
  };
  commands: {
    commands: Record<string, { id: string; name: string }>;
    executeCommandById(id: string): boolean;
  };
}

export interface UIBridgeOptions {
  /** Session's current effective permission mode — gates file-mutating actions
   *  (rename-file, move-file, delete-file) and run-command, which run through this
   *  side-channel rather than the CLI's own tool permissions and so aren't otherwise
   *  subject to Read only / Chat only's "no writes" guarantee. */
  permissionMode?: PermissionMode;
  commandAllowlist?: string[];
  commandDenylist?: string[];
  /** If true, prompt when Claude tries a command not in the allowlist. If false, hard-block it. */
  confirmUnlistedCommands?: boolean;
  onAddToAllowlist?: (commandId: string) => Promise<void>;
  onAddToDenylist?: (commandId: string) => Promise<void>;
  onSetLabel?: (userLabel: string, assistantLabel: string) => void;
  /** The user thanked the agent (#385). */
  onThanked?: () => void;
  /** Open Report a problem pre-filled by the agent (#382); the user reviews and sends it. */
  onReportProblem?: (prefill: ReportPrefill) => void;
  /** A dialog asking the user opened (true) or closed (false), for the session's live status (#399). */
  onAwaitUser?: (waiting: boolean) => void;
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
    this.titleEl.setText(`${brandName()} — unlisted command`);
    const { contentEl } = this;

    contentEl.createEl('p', {
      text: `The agent wants to run: "${this.commandName}". This command isn't in your allowlist.`,
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
      text: `The agent needs permission to use ${this.tool}:`,
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

/** A payload value as text for a refusal reason. */
function shown(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value) ?? 'nothing';
}

/**
 * Execute a single BojuBot UI action via the Obsidian API.
 * The 6 built-in actions execute immediately (transparency via show-notice).
 * run-command requires a mode that can write (Obsidian commands can create or change
 * notes), then the commandId in the allowlist, or a prompt if confirmUnlistedCommands is true.
 *
 * Returns why the action wasn't run, or null when it ran. The caller tells the
 * user and the agent: a refused action must never look like a done one.
 */
export async function executeAction(app: App, action: BojuBotAction, options: UIBridgeOptions = {}): Promise<BridgeRefusal | null> {
  const {
    permissionMode,
    commandAllowlist = [],
    commandDenylist = [],
    confirmUnlistedCommands = true,
    onAddToAllowlist,
    onAddToDenylist,
  } = options;

  log('UIBridge: executing action:', action.action);

  const refuse = (reason: string, byUser = false): BridgeRefusal => {
    warn(`UIBridge: ${action.action} — not run: ${reason}`);
    return { action: action.action, reason, byUser };
  };
  const noNote = (path: unknown) => refuse(`no note at "${shown(path)}"`);
  const noWrites = () => refuse("this session's permission mode doesn't allow vault changes");

  switch (action.action) {

    case 'open-file': {
      const file = app.vault.getFileByPath(action.path as string);
      if (!file) return noNote(action.path);
      await app.workspace.getLeaf(false).openFile(file);
      break;
    }

    case 'open-file-split': {
      const file = app.vault.getFileByPath(action.path as string);
      if (!file) return noNote(action.path);
      await app.workspace.getLeaf('split').openFile(file);
      break;
    }

    case 'open-file-new-tab': {
      const file = app.vault.getFileByPath(action.path as string);
      if (!file) return noNote(action.path);
      await app.workspace.getLeaf('tab').openFile(file);
      break;
    }

    case 'rename-file': {
      if (!canWrite(permissionMode)) return noWrites();
      const file = app.vault.getFileByPath(action.path as string);
      if (!file) return noNote(action.path);
      const nameProblem = newNameProblem(action.newName);
      if (nameProblem) return refuse(`${nameProblem} ("${shown(action.newName)}")`);
      const newName = action.newName as string;
      const newPath = file.parent && file.parent.path !== '/' ? `${file.parent.path}/${newName}` : newName;
      const renameProblem = destinationProblem(newPath, app.vault.configDir);
      if (renameProblem) return refuse(`${renameProblem} ("${newPath}")`);
      await app.fileManager.renameFile(file, newPath);
      break;
    }

    case 'move-file': {
      if (!canWrite(permissionMode)) return noWrites();
      const file = app.vault.getFileByPath(action.path as string);
      if (!file) return noNote(action.path);
      const moveProblem = destinationProblem(action.newPath, app.vault.configDir);
      if (moveProblem) return refuse(`${moveProblem} ("${shown(action.newPath)}")`);
      await app.fileManager.renameFile(file, action.newPath as string);
      break;
    }

    case 'delete-file': {
      if (!canWrite(permissionMode)) return noWrites();
      const file = app.vault.getFileByPath(action.path as string);
      if (!file) return noNote(action.path);
      await app.fileManager.trashFile(file);
      break;
    }

    case 'navigate-heading': {
      const file = app.vault.getFileByPath(action.path as string);
      if (!file) return noNote(action.path);
      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(file);
      window.requestAnimationFrame(() => {
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
      break;
    }

    case 'show-notice': {
      // Bounded length and duration: a notice can't fill the screen or stay forever (#172)
      const { message, duration } = noticePayload(action.message, action.duration);
      if (message) new Notice(message, duration);
      break;
    }

    case 'focus-search': {
      (app as unknown as UIBridgeInternal).commands.executeCommandById('switcher:open');
      break;
    }

    case 'open-settings': {
      const setting = (app as unknown as UIBridgeInternal).setting;
      const ids = [...(setting.settingTabs ?? []), ...(setting.pluginTabs ?? [])].map(t => t.id);
      setting.open();
      // Only a tab that exists (#172); anything else just opens settings
      const tab = knownSettingsTab(action.tab, ids);
      if (tab) setting.openTabById(tab);
      else if (action.tab !== undefined) warn('UIBridge: open-settings — unknown tab, opening settings only:', action.tab);
      break;
    }

    case 'run-command': {
      const commandId = action.commandId as string;
      if (!commandId) return refuse('no commandId given');
      if (!bridgeActionAllowed('run-command', permissionMode)) {
        return refuse("Chat only and Read only don't run Obsidian commands, because commands can create or change notes");
      }

      const appInternal = app as unknown as UIBridgeInternal;
      const displayName = appInternal.commands.commands[commandId]?.name ?? commandId;
      const notFound = () => refuse(`the command "${displayName}" wasn't found; it may belong to a plugin that isn't enabled`);

      if (commandAllowlist.includes(commandId)) {
        // Allowlist takes precedence over everything — execute immediately
        if (!appInternal.commands.executeCommandById(commandId)) return notFound();
        log('UIBridge: run-command executed:', commandId);
      } else if (commandDenylist.includes(commandId)) {
        // Permanently denied (and not in allowlist): no prompt, no notice
        return refuse(`the user has blocked the command "${displayName}"`, true);
      } else if (confirmUnlistedCommands) {
        // Neither list — prompt
        options.onAwaitUser?.(true);
        const { allow, remember } = await new Promise<{ allow: boolean; remember: boolean }>(resolve => {
          new ConfirmCommandModal(app, displayName, resolve).open();
        });
        options.onAwaitUser?.(false);
        if (!allow) {
          if (remember && onAddToDenylist) await onAddToDenylist(commandId);
          return refuse(`the user denied the command "${displayName}"`, true);
        }
        if (remember && onAddToAllowlist) await onAddToAllowlist(commandId);
        if (!appInternal.commands.executeCommandById(commandId)) return notFound();
        log('UIBridge: run-command executed:', commandId);
      } else {
        // Prompting disabled — hard block
        return refuse(`"${displayName}" isn't in the command allowlist (Settings → ${brandName()})`);
      }
      break;
    }

    case 'set-label': {
      const userLabel = ((action.user as string) ?? '').trim() || 'User';
      const assistantLabel = ((action.assistant as string) ?? '').trim() || brandName();
      options.onSetLabel?.(userLabel, assistantLabel);
      break;
    }

    case 'report-problem': {
      // Only opens the form; nothing is sent until the user clicks Send.
      options.onReportProblem?.(reportPrefill(action));
      break;
    }

    case 'thanked': {
      options.onThanked?.();
      break;
    }

    default:
      return refuse('unknown action');
  }
  return null;
}
