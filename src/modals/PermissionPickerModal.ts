import { App, FuzzySuggestModal, setIcon } from 'obsidian';
import type BojuBotPlugin from '../../main';
import type { PermissionMode } from '../backends/types';

export interface ModeOption {
  mode: PermissionMode;
  icon: string;
  colorClass: string;
  label: string;
  description: string;
}

export const PERMISSION_MODES: ModeOption[] = [
  { mode: 'restricted', icon: 'lock', colorClass: 'bojubot-perm-restricted', label: 'Chat only', description: 'web only, no vault access' },
  { mode: 'readonly', icon: 'eye', colorClass: 'bojubot-perm-readonly', label: 'Read only', description: 'read vault, no writes' },
  { mode: 'standard', icon: 'shield', colorClass: 'bojubot-perm-standard', label: 'Standard', description: 'read+write vault, read-only shell' },
  { mode: 'full', icon: 'triangle-alert', colorClass: 'bojubot-perm-full', label: 'Full access', description: 'unrestricted, including bash' },
];

function applyPermission(plugin: BojuBotPlugin, mode: PermissionMode): void {
  plugin.settings.permissionMode = mode;
  void plugin.saveSettings();
  plugin.notifyPermissionChanged();
}

/** Modes the active backend can't enforce, each with the reason shown in place of its description. */
export type UnavailableModes = Partial<Record<PermissionMode, string>>;

/** How the session's backend changes the picker: modes it can't offer, and wording that differs. */
export interface ModeOverrides {
  unavailable?: UnavailableModes;
  descriptions?: Partial<Record<PermissionMode, string>>;
}

export function renderRow(el: HTMLElement, opt: ModeOption, isCurrent: boolean, unavailableReason?: string, description?: string): void {
  if (isCurrent) el.addClass('bojubot-perm-row--active');
  if (unavailableReason) el.addClass('bojubot-perm-row--disabled');
  const iconEl = el.createDiv({ cls: `bojubot-perm-row-icon ${opt.colorClass}` });
  setIcon(iconEl, opt.icon);
  const textEl = el.createDiv({ cls: 'bojubot-perm-row-text' });
  textEl.createSpan({ cls: 'bojubot-perm-row-label', text: opt.label });
  textEl.createSpan({ cls: 'bojubot-perm-row-desc', text: unavailableReason ?? description ?? opt.description });
}

/** Overrides for the backend of the session open in the panel. */
export function activeModeOverrides(plugin: BojuBotPlugin): ModeOverrides {
  const backend = plugin.getBackend(plugin.getActiveBackendId());
  return { unavailable: backend.unavailableModes, descriptions: backend.modeDescriptions };
}

// ---------------------------------------------------------------------------
// Ctrl+P modal (FuzzySuggestModal — centered, filterable, keyboard-native)
// ---------------------------------------------------------------------------

export class PermissionPickerModal extends FuzzySuggestModal<ModeOption> {
  constructor(
    app: App,
    private plugin: BojuBotPlugin,
    private currentMode: PermissionMode,
  ) {
    super(app);
    this.setPlaceholder('Select permission mode…');
    this.modalEl.addClass('bojubot-permission-picker-modal');
  }

  getItems(): ModeOption[] {
    const unavailable = activeModeOverrides(this.plugin).unavailable ?? {};
    return PERMISSION_MODES.filter(m => !unavailable[m.mode]);
  }
  getItemText(opt: ModeOption): string { return opt.label; }

  renderSuggestion(fuzzy: { item: ModeOption }, el: HTMLElement): void {
    el.addClass('bojubot-perm-row');
    const descriptions = activeModeOverrides(this.plugin).descriptions ?? {};
    renderRow(el, fuzzy.item, fuzzy.item.mode === this.currentMode, undefined, descriptions[fuzzy.item.mode]);
  }

  onChooseItem(opt: ModeOption): void {
    applyPermission(this.plugin, opt.mode);
  }
}

// ---------------------------------------------------------------------------
// Icon-click popover (positioned above the anchor element)
// ---------------------------------------------------------------------------

/**
 * Generic mode-picker popover, decoupled from plugin settings — the caller
 * decides what happens on selection via `onSelect`. Used both by the toolbar
 * icon (which writes straight to global settings) and by CustomSessionModal
 * (which just captures the choice into local form state).
 */
export function openModePickerPopover(
  anchorEl: HTMLElement,
  currentMode: PermissionMode,
  onSelect: (mode: PermissionMode) => void,
  overrides: ModeOverrides = {},
): void {
  const unavailable = overrides.unavailable ?? {};
  const descriptions = overrides.descriptions ?? {};
  activeDocument.querySelector('.bojubot-perm-popover')?.remove();
  const choose = (mode: PermissionMode) => {
    if (unavailable[mode]) return;
    close();
    onSelect(mode);
  };

  const rect = anchorEl.getBoundingClientRect();
  const popover = activeDocument.body.createDiv({ cls: 'bojubot-perm-popover' });

  // Measure after inserting so we get real height; use an estimate for initial placement.
  const rowHeight = 44;
  const padding = 8;
  const estimatedHeight = PERMISSION_MODES.length * rowHeight + padding;
  const gap = 4;
  const topAbove = rect.top - estimatedHeight - gap;

  // Set layout/visual properties inline so they win the cascade when appended to document.body,
  // where Obsidian's base rules have higher specificity than our plugin class.
  const top = topAbove >= 8 ? topAbove : rect.bottom + gap;
  popover.setAttribute('style',
    `position:fixed;left:${rect.left}px;top:${top}px;z-index:9999;` +
    `background:var(--background-primary);` +
    `border:1px solid var(--background-modifier-border);` +
    `border-radius:6px;padding:4px;` +
    `display:flex;flex-direction:column;gap:2px;min-width:220px;` +
    `box-shadow:0 6px 20px rgba(0,0,0,0.35);`
  );

  let focusedIndex = PERMISSION_MODES.findIndex(m => m.mode === currentMode);
  if (focusedIndex < 0) focusedIndex = 2;

  const rows: HTMLElement[] = [];

  PERMISSION_MODES.forEach((opt, i) => {
    const row = popover.createDiv({ cls: 'bojubot-perm-popover-row bojubot-perm-row' });
    renderRow(row, opt, opt.mode === currentMode, unavailable[opt.mode], descriptions[opt.mode]);

    row.addEventListener('mouseenter', () => {
      focusedIndex = i;
      updateFocus();
    });

    row.addEventListener('click', () => choose(opt.mode));

    rows.push(row);
  });

  function updateFocus() {
    rows.forEach((r, j) => r.toggleClass('bojubot-perm-popover-row--focused', j === focusedIndex));
  }
  updateFocus();

  function close() {
    popover.remove();
    activeDocument.removeEventListener('keydown', keyHandler, true);
    activeDocument.removeEventListener('mousedown', outsideHandler, true);
  }

  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedIndex = (focusedIndex + 1) % PERMISSION_MODES.length;
      updateFocus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedIndex = (focusedIndex - 1 + PERMISSION_MODES.length) % PERMISSION_MODES.length;
      updateFocus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(PERMISSION_MODES[focusedIndex].mode);
    }
  };

  const outsideHandler = (e: MouseEvent) => {
    if (!popover.contains(e.target as Node) && e.target !== anchorEl) {
      close();
    }
  };

  // Defer so the icon's own click event doesn't immediately trigger outsideHandler.
  window.setTimeout(() => {
    activeDocument.addEventListener('keydown', keyHandler, true);
    activeDocument.addEventListener('mousedown', outsideHandler, true);
  }, 0);
}

export function openPermissionPopover(
  plugin: BojuBotPlugin,
  iconEl: HTMLElement,
  currentMode: PermissionMode,
): void {
  openModePickerPopover(iconEl, currentMode, (mode) => applyPermission(plugin, mode), activeModeOverrides(plugin));
}
