/**
 * Images an agent's own tools save outside the vault (#427): Antigravity's
 * generate_image writes `<ImageName>_<epoch ms>.<ext>` into the conversation's
 * folder and reports neither the path nor any output. BojuBot finds the file
 * from the call's ImageName, shows it in the chat and saves it to the vault on
 * request. Pure — exported for tests.
 */
import { isAbsolute, relative, resolve } from 'path';

export const GENERATED_IMAGE_EXTENSIONS: readonly string[] = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

/** A tool call seen during a turn, with when it started (ms since the epoch). */
export interface TurnToolCall {
  tool: string;
  input: unknown;
  startedAt: number;
}

/** How far a file's stamp may be before its call started: the clocks are the same machine's, so this is only rounding. */
const STAMP_SLACK_MS = 5_000;

/**
 * The ImageName a generate_image call was given, when it's a plain file-name
 * stem. Anything with a path separator or `..` is refused: the name only ever
 * picks a file inside the conversation's folder.
 */
export function generatedImageStem(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null;
  const name = (input as Record<string, unknown>).ImageName;
  if (typeof name !== 'string') return null;
  const stem = name.trim();
  if (!stem || stem.length > 200 || /[\\/:*?"<>|\0]/.test(stem) || stem.includes('..')) return null;
  return stem;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The file generate_image saved for `stem` among `files` (names in the
 * conversation's folder): `<stem>_<epoch ms>.<image ext>`, stamped no earlier
 * than `sinceMs`, the newest when there are several. Null when none matches,
 * so an older image of the same name from an earlier turn is never shown.
 */
export function pickGeneratedImage(files: readonly string[], stem: string, sinceMs: number): string | null {
  const pattern = new RegExp(`^${escapeRegExp(stem)}_(\\d{10,})\\.(${GENERATED_IMAGE_EXTENSIONS.join('|')})$`, 'i');
  let best: { file: string; stamp: number } | null = null;
  for (const file of files) {
    const m = pattern.exec(file);
    if (!m) continue;
    const stamp = Number(m[1]);
    if (stamp < sinceMs - STAMP_SLACK_MS) continue;
    if (!best || stamp > best.stamp) best = { file, stamp };
  }
  return best?.file ?? null;
}

/** True when `path` is an image file inside `dir` (not `dir` itself, never through `..`). */
export function isImageInside(path: string, dir: string): boolean {
  if (!isAbsolute(path)) return false;
  const rel = relative(resolve(dir), resolve(path));
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return false;
  const ext = rel.split('.').pop()?.toLowerCase() ?? '';
  return rel.includes('.') && GENERATED_IMAGE_EXTENSIONS.includes(ext);
}

/** The MIME type for an image file name, by extension. */
export function imageMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    default: return 'image/png';
  }
}
