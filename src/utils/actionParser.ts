import { log, warn } from './logger';
import { ACTION_PREFIX, QUERY_PREFIX } from '../constants';

export interface ObsidiBotAction {
  action: string;
  [key: string]: unknown;
}

export function extractActions(text: string): { clean: string; actions: ObsidiBotAction[] } {
  const actions: ObsidiBotAction[] = [];
  const lines = text.split('\n');
  const kept: string[] = [];

  for (const line of lines) {
    if (line.startsWith(ACTION_PREFIX)) {
      try {
        const action = JSON.parse(line.slice(ACTION_PREFIX.length)) as ObsidiBotAction;
        actions.push(action);
        log('UIBridge: parsed action:', action.action, action);
      } catch {
        warn('UIBridge: malformed action line:', line);
      }
    } else if (line.startsWith(QUERY_PREFIX)) {
      // Strip query lines — intercepted at stream time and must never appear in the UI
    } else {
      kept.push(line);
    }
  }

  return { clean: kept.join('\n'), actions };
}
