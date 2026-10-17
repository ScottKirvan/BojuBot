import { existsSync, readFileSync } from 'fs';
import type { ModelOption } from '../backends/types';

/** Extra Claude Code models from custom-models.json. Invalid entries are skipped; a missing or bad file yields []. */
export function loadCustomModels(filePath: string): ModelOption[] {
  if (!existsSync(filePath)) return [];
  try {
    const raw: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!Array.isArray(raw)) return [];
    return (raw as unknown[]).filter((e): e is ModelOption => {
      if (!e || typeof e !== 'object') return false;
      const obj = e as Record<string, unknown>;
      return typeof obj.id === 'string' && obj.id.trim() !== '' &&
        typeof obj.displayName === 'string' && obj.displayName.trim() !== '';
    }).map(e => ({
      id: e.id.trim(),
      displayName: e.displayName.trim(),
      description: typeof e.description === 'string' ? e.description.trim() : '',
    }));
  } catch {
    return [];
  }
}
