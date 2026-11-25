import { log, warn } from './logger';
import { BOJU_PREFIX } from '../constants';

export interface BojuBotAction {
  action: string;
  [key: string]: unknown;
}

export function extractActions(text: string): { clean: string; actions: BojuBotAction[] } {
  const actions: BojuBotAction[] = [];
  const lines = text.split('\n');
  const kept: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    // Gemini sometimes starts a reply with a bare "{}" line before its
    // protocol lines: noise, never content (code blocks keep theirs)
    if (!inFence && line.trim() === '{}') continue;
    if (line.startsWith(BOJU_PREFIX)) {
      try {
        const parsed = JSON.parse(line.slice(BOJU_PREFIX.length)) as Record<string, unknown>;
        if ('action' in parsed) {
          const action = parsed as unknown as BojuBotAction;
          actions.push(action);
          log('UIBridge: parsed action:', action.action, action);
        }
        // query lines are silently stripped — intercepted at stream time, must never appear in the UI
      } catch {
        warn('UIBridge: malformed BOJU line:', line);
      }
    } else {
      kept.push(line);
    }
  }

  return { clean: kept.join('\n'), actions };
}
