/**
 * How an attached file is handed to the agent, by its extension. Pure — shared
 * by every attachment route (file picker, paste, drag and drop) and unit-tested.
 */

export const TEXT_EXTS: ReadonlySet<string> = new Set([
  'txt', 'md', 'fountain', 'js', 'ts', 'jsx', 'tsx', 'json', 'canvas',
  'css', 'html', 'xml', 'csv', 'yaml', 'yml', 'py', 'rb', 'go', 'rs',
  'java', 'c', 'cpp', 'h', 'sh', 'bat', 'ps1',
]);

export const IMAGE_EXTS: ReadonlySet<string> = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico',
  'tiff', 'heic', 'heif', 'avif',
]);

/**
 * `image` / `pdf`: the agent reads the file itself; `text`: its content is
 * attached inline; `file`: anything else, passed by name or path for the agent
 * to open if it can.
 */
export type AttachmentKind = 'image' | 'pdf' | 'text' | 'file';

/** Largest text file pasted from the file manager that's attached inline;
 *  a bigger one is passed by path instead, so it can't flood the context. */
export const PASTE_TEXT_MAX_BYTES = 512 * 1024;

/** The lower-cased extension of a file name or path ('' when there's none). */
export function fileExtension(nameOrPath: string): string {
  const name = nameOrPath.replace(/\\/g, '/').split('/').pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** The file name of a path, with either separator. */
export function fileNameOf(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() || path;
}

export function attachmentKind(nameOrPath: string): AttachmentKind {
  const ext = fileExtension(nameOrPath);
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (TEXT_EXTS.has(ext)) return 'text';
  return 'file';
}
