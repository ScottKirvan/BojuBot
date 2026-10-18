import { sanitizeHTMLToDom, setIcon } from 'obsidian';
import { getBackend } from './backends';
import type { BackendId } from './backends/types';

/**
 * A small icon for the agent a session runs on, with its name as the tooltip,
 * so picking a session shows which CLI it will switch to.
 */
export function renderAgentIcon(parent: HTMLElement, id: BackendId, cls: string): HTMLElement {
  const backend = getBackend(id);
  const el = parent.createSpan({ cls: `bojubot-agent-icon ${cls}`, attr: { 'aria-label': backend.displayName, title: backend.displayName } });
  if ('svg' in backend.icon) el.appendChild(sanitizeHTMLToDom(backend.icon.svg));
  else setIcon(el, backend.icon.lucide);
  return el;
}
