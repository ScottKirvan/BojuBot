import { TFile, Vault } from 'obsidian';
import { canvasToText } from './utils/canvasParser';

export interface AtMentionControllerHost {
  getAtMentionExtensions(): string;
  getCanvasMaxChars(): number;
  getVault(): Vault;
  getActiveFile(): TFile | null;
  getInputEl(): HTMLTextAreaElement;
  injectSelectionContext(text: string, source: string): void;
}

/**
 * Manages the @-mention autocomplete dropdown.
 * Build the DOM element via build(), then wire input/blur/keydown events
 * to the corresponding handle* methods.
 */
export class AtMentionController {
  private dropdownEl: HTMLElement | null = null;
  private items: TFile[] = [];
  private index = -1;

  constructor(private readonly host: AtMentionControllerHost) { }

  /** Attach to the dropdown element created in onOpen(). */
  build(dropdownEl: HTMLElement): void {
    this.dropdownEl = dropdownEl;
  }

  /** True when the dropdown is visible. */
  isOpen(): boolean {
    return !!this.dropdownEl && this.dropdownEl.style.display !== 'none';
  }

  /** Call from textarea 'input' event. */
  handleInput(): void {
    const inputEl = this.host.getInputEl();
    const { value, selectionStart } = inputEl;
    if (selectionStart === null) { this.hide(); return; }

    const before = value.substring(0, selectionStart);
    const match = before.match(/@(\S*)$/);
    if (!match) { this.hide(); return; }

    const parsedExts = this.host.getAtMentionExtensions().split(',').map(e => e.trim().toLowerCase());
    const allTypes = parsedExts.includes('*');
    const textExts = new Set(parsedExts);
    const query = match[1].toLowerCase();
    const activeFile = this.host.getActiveFile();
    const files = this.host.getVault().getFiles()
      .filter(f => (allTypes || textExts.has(f.extension)) && (!query || f.basename.toLowerCase().includes(query)))
      .sort((a, b) => {
        if (!query) {
          if (a === activeFile) return -1;
          if (b === activeFile) return 1;
        }
        return a.basename.localeCompare(b.basename);
      })
      .slice(0, 8);

    if (files.length === 0) { this.hide(); return; }

    this.items = files;
    if (this.index < 0 || this.index >= files.length) this.index = 0;
    this.render();
  }

  /** Call from textarea 'blur' event. */
  handleBlur(): void {
    // Delay so mousedown on a dropdown item fires before the dropdown hides.
    setTimeout(() => this.hide(), 150);
  }

  /**
   * Call from textarea 'keydown' event.
   * Returns true if the key was consumed (caller should return early).
   */
  handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen()) return false;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.nav(1); return true; }
    if (e.key === 'ArrowUp') { e.preventDefault(); this.nav(-1); return true; }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); void this.select(); return true; }
    if (e.key === 'Escape') { this.hide(); return true; }
    return false;
  }

  hide(): void {
    this.dropdownEl?.hide();
    this.items = [];
    this.index = -1;
  }

  private render(): void {
    const el = this.dropdownEl;
    if (!el) return;
    el.empty();
    el.show();
    this.items.forEach((file, i) => {
      const item = el.createDiv({
        cls: 'bojubot-at-item' + (i === this.index ? ' bojubot-at-item-active' : ''),
      });
      const nameEl = item.createSpan({ cls: 'bojubot-at-item-name', text: file.basename });
      if (file.extension !== 'md') {
        nameEl.createSpan({ cls: 'bojubot-at-item-ext', text: '.' + file.extension });
      }
      const parentPath = file.parent?.path;
      if (parentPath && parentPath !== '/') {
        item.createSpan({ cls: 'bojubot-at-item-path', text: parentPath });
      }
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // prevent textarea blur before select fires
        this.index = i;
        void this.select();
      });
    });
  }

  private nav(dir: number): void {
    this.index = Math.max(0, Math.min(this.items.length - 1, this.index + dir));
    this.render();
  }

  private async select(): Promise<void> {
    const file = this.items[this.index];
    if (!file) return;
    this.hide();

    const inputEl = this.host.getInputEl();
    const { value, selectionStart } = inputEl;
    if (selectionStart !== null) {
      const before = value.substring(0, selectionStart);
      const after = value.substring(selectionStart);
      const newBefore = before.replace(/@\S*$/, '');
      inputEl.value = newBefore + after;
      inputEl.setSelectionRange(newBefore.length, newBefore.length);
    }

    const raw = await this.host.getVault().read(file);
    const content = file.extension === 'canvas'
      ? canvasToText(file.name, raw, this.host.getCanvasMaxChars())
      : raw;
    this.host.injectSelectionContext(content, file.basename);
  }
}
