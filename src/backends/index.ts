import { claudeCodeBackend } from './claudeCode';
import { antigravityBackend } from './antigravity';
import type { AgentBackend, BackendId } from './types';

const BACKENDS: Record<BackendId, AgentBackend> = {
  'claude-code': claudeCodeBackend,
  'antigravity': antigravityBackend,
};

export const DEFAULT_BACKEND_ID: BackendId = 'claude-code';

export const BACKEND_IDS = Object.keys(BACKENDS) as BackendId[];

export function isBackendId(value: unknown): value is BackendId {
  return typeof value === 'string' && (BACKEND_IDS as string[]).includes(value);
}

export function getBackend(id: BackendId = DEFAULT_BACKEND_ID): AgentBackend {
  return BACKENDS[id];
}
