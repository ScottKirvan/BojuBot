/**
 * SlashMenu — unified command palette for BojuBot.
 *
 * Two modes:
 *  - 'button'  opened via the / toolbar button; includes a search box
 *  - 'inline'  opened by typing / in the input; no search box;
 *              any non-navigation key dismisses and is passed back to input
 */

export interface SlashCommand {
  category: string;
  name: string;
  description?: string;
  action: () => void;
}

export class SlashMenu {
  private el: HTMLElement;
  private listEl: HTMLElement;
  private searchEl: HTMLInputElement | null = null;
  private commands: SlashCommand[];
  private filtered: SlashCommand[];
  private highlightedIndex = -1;
  private mode: 'button' | 'inline';
  private onDismiss: () => void;
  private outsideClickHandler: (e: MouseEvent) => void;

  constructor(
    private container: HTMLElement,
    commands: SlashCommand[],
    mode: 'button' | 'inline',
    onDismiss: () => void,
  ) {
    this.commands = commands;
    this.filtered = commands;
    this.mode = mode;
    this.onDismiss = onDismiss;

    this.el = container.createDiv({ cls: 'bojubot-slash-menu' });
    this.el.setAttribute('role', 'listbox');

    if (mode === 'button') {
      const searchWrap = this.el.createDiv({ cls: 'bojubot-slash-search-wrap' });
      this.searchEl = searchWrap.createEl('input', {
        cls: 'bojubot-slash-search',
        attr: { type: 'text', placeholder: 'Search commands…' },
      });
      this.searchEl.addEventListener('input', () => {
        this.filter(this.searchEl.value);
      });
      this.searchEl.addEventListener('keydown', (e) => {
        this.handleKeyDown(e);
      });
    }

    this.listEl = this.el.createDiv({ cls: 'bojubot-slash-list' });
    this.render();

    // Close on outside click
    this.outsideClickHandler = (e: MouseEvent) => {
      if (!this.el.contains(e.target as Node)) {
        this.close();
      }
    };
    // Use setTimeout so the click that opened the menu doesn't immediately close it
    activeWindow.setTimeout(() => activeDocument.addEventListener('mousedown', this.outsideClickHandler), 0);
  }

  open() {
    this.el.show();
    if (this.mode === 'button' && this.searchEl) {
      this.searchEl.focus();
    }
  }

  close() {
    activeDocument.removeEventListener('mousedown', this.outsideClickHandler);
    this.el.remove();
    this.onDismiss();
  }

  filter(query: string) {
    const q = query.toLowerCase().trim();
    this.filtered = q
      ? this.commands.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q)
      )
      : this.commands;
    this.highlightedIndex = -1;
    this.render();
  }

  /**
   * Handle keyboard events. Returns true if the key was consumed.
   * In inline mode, non-navigation keys return false so the caller
   * can pass them through to the input and dismiss the menu.
   */
  handleKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      this.close();
      return true;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.moveHighlight(1);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.moveHighlight(-1);
      return true;
    }
    if (e.key === 'Enter') {
      if (this.highlightedIndex >= 0 && this.highlightedIndex < this.filtered.length) {
        e.preventDefault();
        this.execute(this.highlightedIndex);
        return true;
      }
      // No item highlighted — in button mode do nothing; in inline mode dismiss
      if (this.mode === 'inline') {
        this.close();
      }
      return this.mode === 'button';
    }
    // In inline mode any other key dismisses the menu (caller keeps the key)
    if (this.mode === 'inline') {
      this.close();
      return false;
    }
    // In button mode, redirect typing to the search box
    return false;
  }

  private moveHighlight(delta: number) {
    const count = this.filtered.length;
    if (count === 0) return;
    if (this.highlightedIndex === -1) {
      this.highlightedIndex = delta > 0 ? 0 : count - 1;
    } else {
      this.highlightedIndex = (this.highlightedIndex + delta + count) % count;
    }
    this.render();
    this.scrollHighlightedIntoView();
  }

  private execute(index: number) {
    const cmd = this.filtered[index];
    if (!cmd) return;
    this.close();
    cmd.action();
  }

  private scrollHighlightedIntoView() {
    const items = this.listEl.querySelectorAll('.bojubot-slash-item');
    const el = items[this.highlightedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }

  private render() {
    this.listEl.empty();

    if (this.filtered.length === 0) {
      this.listEl.createDiv({ cls: 'bojubot-slash-empty', text: 'No commands found.' });
      return;
    }

    // Group by category, preserving insertion order
    const groups = new Map<string, SlashCommand[]>();
    for (const cmd of this.filtered) {
      if (!groups.has(cmd.category)) groups.set(cmd.category, []);
      groups.get(cmd.category).push(cmd);
    }

    // Flat index tracks position across all groups for highlight
    let flatIndex = 0;
    for (const [category, cmds] of groups) {
      this.listEl.createDiv({ cls: 'bojubot-slash-category', text: category });
      for (const cmd of cmds) {
        const item = this.listEl.createDiv({ cls: 'bojubot-slash-item' });
        if (flatIndex === this.highlightedIndex) item.addClass('bojubot-slash-item-highlighted');
        item.setAttribute('role', 'option');

        item.createSpan({ cls: 'bojubot-slash-item-name', text: cmd.name });
        if (cmd.description) {
          item.createSpan({ cls: 'bojubot-slash-item-desc', text: cmd.description });
        }

        const idx = flatIndex; // capture for closure
        item.addEventListener('mouseenter', () => {
          this.highlightedIndex = idx;
          this.render();
        });
        item.addEventListener('mousedown', (e) => {
          e.preventDefault(); // don't steal focus
          this.execute(idx);
        });

        flatIndex++;
      }
    }
  }
}
