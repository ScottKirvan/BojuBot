/**
 * The chat card for an image the agent's own tools saved outside the vault
 * (#427): a preview and a Save to vault button. Saving is the user's click, so
 * it works in every permission mode and needs no shell access; the file comes
 * only from where the backend saves generated images (GeneratedImageSource.owns).
 */
import { App, Notice, TFile, setIcon } from 'obsidian';
import { promises as fs } from 'fs';
import { basename } from 'path';
import { imageMimeType } from './utils/generatedImages';
import { log } from './utils/logger';

/** Bigger images get the card without an inline preview. */
const MAX_PREVIEW_BYTES = 20 * 1024 * 1024;

/**
 * Add the card for `path` to `parent`. `sourcePath` gives the note the
 * attachment folder is resolved against (Obsidian's "same folder as current
 * file" setting), read when Save is clicked.
 */
export function renderGeneratedImageCard(app: App, parent: HTMLElement, path: string, sourcePath: () => string): HTMLElement {
  const name = basename(path);
  const card = parent.createDiv({ cls: 'bojubot-generated-image' });
  const preview = card.createDiv({ cls: 'bojubot-generated-image-preview' });
  const footer = card.createDiv({ cls: 'bojubot-generated-image-footer' });
  const iconEl = footer.createSpan({ cls: 'bojubot-generated-image-icon' });
  setIcon(iconEl, 'image');
  footer.createSpan({ cls: 'bojubot-generated-image-name', text: name, attr: { title: path } });
  const actions = footer.createDiv({ cls: 'bojubot-generated-image-actions' });

  void (async () => {
    let size: number;
    try {
      size = (await fs.stat(path)).size;
    } catch {
      preview.remove();
      card.addClass('is-missing');
      actions.createSpan({ cls: 'bojubot-generated-image-note', text: 'No longer on disk' });
      return;
    }
    if (size <= MAX_PREVIEW_BYTES) {
      try {
        const data = await fs.readFile(path);
        preview.createEl('img', { attr: { src: `data:${imageMimeType(name)};base64,${data.toString('base64')}`, alt: name } });
      } catch (e) {
        log('Generated image preview failed:', e instanceof Error ? e.message : String(e));
        preview.remove();
      }
    } else {
      preview.remove();
    }
    const saveBtn = actions.createEl('button', { cls: 'mod-cta', text: 'Save to vault' });
    saveBtn.addEventListener('click', () => {
      saveBtn.disabled = true;
      void saveToVault(app, path, sourcePath()).then((file) => {
        if (!file) { saveBtn.disabled = false; return; }
        actions.empty();
        showSaved(app, actions, file, sourcePath());
      });
    });
  })();

  return card;
}

/** Copy the image into the vault's attachment folder under a free name. Null on failure (with a notice). */
async function saveToVault(app: App, path: string, sourcePath: string): Promise<TFile | null> {
  try {
    const data = await fs.readFile(path);
    const target = await app.fileManager.getAvailablePathForAttachment(basename(path), sourcePath);
    const file = await app.vault.createBinary(target, Uint8Array.from(data).buffer);
    log('Generated image saved to', file.path);
    return file;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log('Saving a generated image failed:', message);
    new Notice(`Couldn't save the image to your vault: ${message}`);
    return null;
  }
}

function showSaved(app: App, actions: HTMLElement, file: TFile, sourcePath: string): void {
  actions.createSpan({ cls: 'bojubot-generated-image-note', text: 'Saved to ' });
  const link = actions.createEl('a', { cls: 'bojubot-generated-image-link', text: file.path, href: '#' });
  link.addEventListener('click', (e) => {
    e.preventDefault();
    void app.workspace.getLeaf(false).openFile(file);
  });
  const copyBtn = actions.createEl('button', { text: 'Copy embed', attr: { title: 'Copy a link that shows the image in a note' } });
  copyBtn.addEventListener('click', () => {
    const embed = '!' + app.fileManager.generateMarkdownLink(file, sourcePath);
    void navigator.clipboard.writeText(embed).then(() => new Notice('Embed copied'));
  });
}
