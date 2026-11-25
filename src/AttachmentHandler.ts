import { setIcon } from 'obsidian';
import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { canvasToText } from './utils/canvasParser';
import { getElectronClipboard, getPathForFile } from './utils/electronUtils';
import { attachmentKind, fileExtension, fileNameOf, PASTE_TEXT_MAX_BYTES } from './utils/attachmentKind';

export type PendingContext = {
  text: string;
  source: string;
  pinned: boolean;
  /** 'file': a binary file sent by name only (the agent is asked to open it). */
  type?: 'text' | 'url' | 'image' | 'pdf' | 'file';
};

export interface AttachmentHandlerHost {
  getVaultRoot(): string;
  getConfigDir(): string;
  getCanvasMaxChars(): number;
  focusInput(): void;
}

/**
 * Manages the pendingContexts list and the zone element that displays them.
 * Owns all file/URL/paste/drop attachment flows.
 * Build the DOM zone via build(), then use add/reset/clearNonPinned to mutate.
 */
export class AttachmentHandler {
  private contexts: PendingContext[] = [];
  private zoneEl: HTMLElement | null = null;

  constructor(private readonly host: AttachmentHandlerHost) { }

  /** Attach to the pending-context zone element created in onOpen(). */
  build(zone: HTMLElement): void {
    this.zoneEl = zone;
    zone.hide();
  }

  getContexts(): ReadonlyArray<PendingContext> {
    return this.contexts;
  }

  /** Push a selection/note into pending contexts and focus the input. */
  injectSelectionContext(text: string, source: string): void {
    this.contexts.push({ text, source, pinned: false });
    this.render();
    this.host.focusInput();
  }

  add(ctx: PendingContext): void {
    this.contexts.push(ctx);
    this.render();
  }

  /** Remove all non-pinned contexts; called after send. */
  clearNonPinned(): void {
    this.contexts = this.contexts.filter(c => c.pinned);
    this.render();
  }

  /** Clear all contexts; called on new session. */
  reset(): void {
    this.contexts = [];
    this.render();
  }

  openFilePicker(): void {
    const input = createEl('input');
    input.type = 'file';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const kind = attachmentKind(f.name);
      if (kind === 'image' || kind === 'pdf') {
        const filePath = this.saveBinaryToTmp(f.name, await f.arrayBuffer());
        this.contexts.push({ text: filePath, source: f.name, pinned: false, type: kind });
      } else if (kind === 'text') {
        this.contexts.push({ text: this.textContent(f.name, await f.text()), source: f.name, pinned: false });
      } else {
        this.contexts.push({ text: f.name, source: f.name, pinned: false, type: 'file' });
      }
      this.render();
      this.host.focusInput();
    };
    input.click();
  }

  attachUrl(url: string): void {
    const label = url.replace(/^https?:\/\//, '').split('/')[0];
    this.contexts.push({ text: url, source: label, pinned: false, type: 'url' });
    this.render();
    this.host.focusInput();
  }

  async handlePaste(e: ClipboardEvent): Promise<void> {
    // Use Electron's clipboard API to get real file paths when a file was
    // copied from Explorer. Works even with context isolation unlike file.path.
    try {
      const clipboard = getElectronClipboard();
      const filePaths = clipboard?.readFilePaths() ?? [];
      if (filePaths.length > 0) {
        // Any file type, like drag and drop (#262): it's read where it is, never copied
        e.preventDefault();
        for (const filePath of filePaths) this.attachPath(filePath);
        this.render();
        this.host.focusInput();
        return;
      }
    } catch { /* Electron API unavailable — fall through */ }

    // clipboardData.files has the real file name even when readFilePaths() fails.
    // When a file has no path, binary data is saved to tmp.
    // Always generate a unique paste name — Windows names every screenshot "image.jpg".
    const files = e.clipboardData?.files;
    if (files?.length) {
      // A file copied in the file manager has a real path: read it where it is,
      // any type (#262). Without one, images and PDFs are copied to tmp and
      // small text files read inline.
      const paths = Array.from(files).map(f => getPathForFile(f));
      if (paths.every(p => p)) {
        e.preventDefault();
        for (const p of paths) this.attachPath(p);
        this.render();
        this.host.focusInput();
        return;
      }
      for (const f of Array.from(files)) {
        const kind = attachmentKind(f.name);
        if (kind === 'image' || kind === 'pdf') {
          e.preventDefault();
          const uniqueName = `paste-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${fileExtension(f.name)}`;
          const filePath = this.saveBinaryToTmp(uniqueName, await f.arrayBuffer());
          this.contexts.push({ text: filePath, source: uniqueName, pinned: false, type: kind });
          this.render();
          return;
        }
        if (kind === 'text' && f.size <= PASTE_TEXT_MAX_BYTES) {
          e.preventDefault();
          this.contexts.push({ text: this.textContent(f.name, await f.text()), source: f.name, pinned: false });
          this.render();
          return;
        }
      }
    }

    // Last resort: raw image data from clipboard (screenshots have no filename)
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;
        const ext = item.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
        const filename = `paste-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const filePath = this.saveBinaryToTmp(filename, await blob.arrayBuffer());
        this.contexts.push({ text: filePath, source: filename, pinned: false, type: 'image' });
        this.render();
        return;
      }
    }
  }

  async handleDroppedFiles(files: FileList): Promise<void> {
    for (const f of Array.from(files)) {
      const kind = attachmentKind(f.name);
      if (kind === 'image' || kind === 'pdf') {
        const filePath = this.saveBinaryToTmp(f.name, await f.arrayBuffer());
        this.contexts.push({ text: filePath, source: f.name, pinned: false, type: kind });
      } else if (kind === 'text') {
        this.contexts.push({ text: this.textContent(f.name, await f.text()), source: f.name, pinned: false });
      } else {
        // Unknown binary — pass filename; Claude can attempt to read it
        this.contexts.push({ text: f.name, source: f.name, pinned: false, type: 'file' });
      }
    }
    this.render();
    this.host.focusInput();
  }

  /** A text attachment's content; a canvas is turned into readable text. */
  private textContent(name: string, text: string): string {
    return fileExtension(name) === 'canvas' ? canvasToText(name, text, this.host.getCanvasMaxChars()) : text;
  }

  /**
   * Attach a file the file manager put on the clipboard, by its real path.
   * Images and PDFs, and text files over PASTE_TEXT_MAX_BYTES or that can't be
   * read, are passed by path for the agent to open; other text files inline.
   */
  private attachPath(filePath: string): void {
    const source = fileNameOf(filePath);
    const kind = attachmentKind(filePath);
    if (kind === 'image' || kind === 'pdf') {
      this.contexts.push({ text: filePath, source, pinned: false, type: kind });
      return;
    }
    if (kind === 'text') {
      try {
        if (statSync(filePath).size <= PASTE_TEXT_MAX_BYTES) {
          this.contexts.push({ text: this.textContent(source, readFileSync(filePath, 'utf8')), source, pinned: false });
          return;
        }
      } catch { /* unreadable: pass the path below */ }
    }
    this.contexts.push({ text: filePath, source, pinned: false, type: 'file' });
  }

  private saveBinaryToTmp(filename: string, data: ArrayBuffer): string {
    const tmpDir = join(
      this.host.getVaultRoot(),
      this.host.getConfigDir(),
      'plugins', 'bojubot', 'tmp',
    );
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    const filePath = join(tmpDir, filename);
    writeFileSync(filePath, Buffer.from(data));
    return filePath;
  }

  private render(): void {
    if (!this.zoneEl) return;
    const zone = this.zoneEl;
    zone.empty();
    if (this.contexts.length === 0) { zone.hide(); return; }
    zone.show();
    for (const entry of this.contexts) {
      const row = zone.createDiv({
        cls: 'bojubot-pending-context-row' + (entry.pinned ? ' bojubot-context-pinned' : ''),
      });
      const preview = entry.text.length > 80 ? entry.text.substring(0, 80) + '…' : entry.text;
      const iconName = entry.type === 'image' ? 'image'
        : entry.type === 'pdf' ? 'file-text'
          : entry.type === 'url' ? 'link'
            : 'paperclip';
      const iconEl = row.createSpan({ cls: 'bojubot-pending-context-icon' });
      setIcon(iconEl, iconName);
      row.createSpan({ cls: 'bojubot-pending-context-label', text: `${entry.source}: ` });
      if (entry.type !== 'image' && entry.type !== 'pdf') {
        row.createSpan({ cls: 'bojubot-pending-context-preview', text: preview });
      }
      const pinBtn = row.createEl('button', { cls: 'bojubot-context-pin' });
      setIcon(pinBtn, entry.pinned ? 'pin-off' : 'pin');
      pinBtn.title = entry.pinned ? 'Unpin (remove after send)' : 'Pin (keep after send)';
      pinBtn.addEventListener('click', () => { entry.pinned = !entry.pinned; this.render(); });
      const clearBtn = row.createEl('button', { cls: 'bojubot-context-clear', text: '×' });
      clearBtn.title = 'Remove';
      clearBtn.addEventListener('click', () => {
        this.contexts.splice(this.contexts.indexOf(entry), 1);
        this.render();
      });
    }
  }
}
