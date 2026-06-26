import { setIcon } from 'obsidian';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { canvasToText } from './utils/canvasParser';
import { getElectronClipboard } from './utils/electronUtils';

export type PendingContext = {
  text: string;
  source: string;
  pinned: boolean;
  type?: 'text' | 'url' | 'image' | 'pdf';
};

const TEXT_EXTS = new Set([
  'txt', 'md', 'fountain', 'js', 'ts', 'jsx', 'tsx', 'json', 'canvas',
  'css', 'html', 'xml', 'csv', 'yaml', 'yml', 'py', 'rb', 'go', 'rs',
  'java', 'c', 'cpp', 'h', 'sh', 'bat', 'ps1',
]);
const IMAGE_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico',
  'tiff', 'heic', 'heif', 'avif',
]);

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
    const input = activeDocument.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      if (IMAGE_EXTS.has(ext) || ext === 'pdf') {
        const filePath = this.saveBinaryToTmp(f.name, await f.arrayBuffer());
        const type = IMAGE_EXTS.has(ext) ? 'image' : 'pdf';
        this.contexts.push({ text: filePath, source: f.name, pinned: false, type });
      } else {
        let text = TEXT_EXTS.has(ext) ? await f.text() : f.name;
        if (ext === 'canvas') text = canvasToText(f.name, text, this.host.getCanvasMaxChars());
        this.contexts.push({ text, source: f.name, pinned: false });
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
        let handled = false;
        for (const filePath of filePaths) {
          const name = filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;
          const ext = name.split('.').pop()?.toLowerCase() ?? '';
          if (IMAGE_EXTS.has(ext) || ext === 'pdf') {
            e.preventDefault();
            const type = IMAGE_EXTS.has(ext) ? 'image' : 'pdf';
            this.contexts.push({ text: filePath, source: name, pinned: false, type });
            handled = true;
          }
        }
        if (handled) { this.render(); return; }
      }
    } catch { /* Electron API unavailable — fall through */ }

    // clipboardData.files has the real filename even when readFilePaths() fails.
    // file.path is unavailable (context isolation) so save binary data to tmp.
    // Always generate a unique paste name — Windows names every screenshot "image.jpg".
    const files = e.clipboardData?.files;
    if (files?.length) {
      for (const f of Array.from(files)) {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        if (IMAGE_EXTS.has(ext) || ext === 'pdf') {
          e.preventDefault();
          const type = IMAGE_EXTS.has(ext) ? 'image' : 'pdf';
          const uniqueName = `paste-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
          const filePath = this.saveBinaryToTmp(uniqueName, await f.arrayBuffer());
          this.contexts.push({ text: filePath, source: uniqueName, pinned: false, type });
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
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      if (IMAGE_EXTS.has(ext) || ext === 'pdf') {
        const type = IMAGE_EXTS.has(ext) ? 'image' : 'pdf';
        const filePath = this.saveBinaryToTmp(f.name, await f.arrayBuffer());
        this.contexts.push({ text: filePath, source: f.name, pinned: false, type });
      } else if (TEXT_EXTS.has(ext)) {
        let text = await f.text();
        if (ext === 'canvas') text = canvasToText(f.name, text, this.host.getCanvasMaxChars());
        this.contexts.push({ text, source: f.name, pinned: false });
      } else {
        // Unknown binary — pass filename; Claude can attempt to read it
        this.contexts.push({ text: f.name, source: f.name, pinned: false });
      }
    }
    this.render();
    this.host.focusInput();
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
