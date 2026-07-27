import { App, FuzzySuggestModal, setIcon } from 'obsidian';
import type BojuBotPlugin from '../../main';
import type { PermissionMode } from '../ClaudeProcess';

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
  { mode: 'standard', icon: 'shield', colorClass: 'bojubot-perm-standard', label: 'Standard', description: 'read+write vault, no bash' },
  { mode: 'full', icon: 'triangle-alert', colorClass: 'bojubot-perm-full', label: 'Full access', description: 'unrestricted, including bash' },
];

function applyPermission(plugin: BojuBotPlugin, mode: PermissionMode): void {
  plugin.settings.permissionMode = mode;
  void plugin.saveSettings();
  plugin.notifyPermissionChanged();
}

export function renderRow(el: HTMLElement, opt: ModeOption, isCurrent: boolean): void {
  if (isCurrent) el.addClass('bojubot-perm-row--active');
  const iconEl = el.createDiv({ cls: `bojubot-perm-row-icon ${opt.colorClass}` });
  setIcon(iconEl, opt.icon);
  const textEl = el.createDiv({ cls: 'bojubot-perm-row-text' });
  textEl.createSpan({ cls: 'bojubot-perm-row-label', text: opt.label });
  textEl.createSpan({ cls: 'bojubot-perm-row-desc', text: opt.description });
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

  getItems(): ModeOption[] { return PERMISSION_MODES; }
  getItemText(opt: ModeOption): string { return opt.label; }

  renderSuggestion(fuzzy: { item: ModeOption }, el: HTMLElement): void {
    el.addClass('bojubot-perm-row');
    renderRow(el, fuzzy.item, fuzzy.item.mode === this.currentMode);
  }

  onChooseItem(opt: ModeOption): void {
    applyPermission(this.plugin, opt.mode);
  }
}

// ---------------------------------------------------------------------------
// Icon-click popover (positioned above the toolbar icon)
// ---------------------------------------------------------------------------

export function openPermissionPopover(
  plugin: BojuBotPlugin,
  iconEl: HTMLElement,
  currentMode: PermissionMode,
): void {
  activeDocument.querySelector('.bojubot-perm-popover')?.remove();

  const rect = iconEl.getBoundingClientRect();
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
    renderRow(row, opt, opt.mode === currentMode);

    row.addEventListener('mouseenter', () => {
      focusedIndex = i;
      updateFocus();
    });

    row.addEventListener('click', () => {
      close();
      applyPermission(plugin, opt.mode);
    });

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
      close();
      applyPermission(plugin, PERMISSION_MODES[focusedIndex].mode);
    }
  };

  const outsideHandler = (e: MouseEvent) => {
    if (!popover.contains(e.target as Node) && e.target !== iconEl) {
      close();
    }
  };

  // Defer so the icon's own click event doesn't immediately trigger outsideHandler.
  window.setTimeout(() => {
    activeDocument.addEventListener('keydown', keyHandler, true);
    activeDocument.addEventListener('mousedown', outsideHandler, true);
  }, 0);
}
