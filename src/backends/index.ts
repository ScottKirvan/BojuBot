import { claudeCodeBackend } from './claudeCode';
import type { AgentBackend, BackendId } from './types';

const BACKENDS: Record<BackendId, AgentBackend> = {
  'claude-code': claudeCodeBackend,
};

export const DEFAULT_BACKEND_ID: BackendId = 'claude-code';

export function getBackend(id: BackendId = DEFAULT_BACKEND_ID): AgentBackend {
  return BACKENDS[id];
}
