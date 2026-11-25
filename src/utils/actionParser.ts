import { log, warn } from './logger';
import { fencedLines, parseBojuLine } from './bojuLines';

export interface BojuBotAction {
  action: string;
  [key: string]: unknown;
}

/**
 * Split text into what's displayed and the UI Bridge actions in it. Every
 * @@BOJU line outside a fenced code block is removed (query lines too: they're
 * intercepted at stream time and must never appear in the UI). Inside a code
 * block they're text the agent is showing, kept and never run.
 */
export function extractActions(text: string): { clean: string; actions: BojuBotAction[] } {
  const actions: BojuBotAction[] = [];
  const kept: string[] = [];

  for (const { line, fenced } of fencedLines(text)) {
    // Gemini sometimes starts a reply with a bare "{}" line before its
    // protocol lines: noise, never content (code blocks keep theirs)
    if (!fenced && line.trim() === '{}') continue;
    const parsed = fenced ? null : parseBojuLine(line);
    if (parsed === null) {
      kept.push(line);
    } else if (parsed === 'malformed') {
      warn('UIBridge: malformed BOJU line:', line);
    } else if ('action' in parsed) {
      const action = parsed as unknown as BojuBotAction;
      actions.push(action);
      log('UIBridge: parsed action:', action.action, action);
    }
  }

  return { clean: kept.join('\n'), actions };
}
