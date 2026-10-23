import type { BackendOrientation, PermissionMode } from '../backends/types';
import { canRunCommands, sharesVaultInfo } from './modeGates';

export interface OrientationVars {
  /** Assistant name (BojuBot, or the rebranded identity). */
  identityName: string;
  supportLine: string;
  cwdDisplay: string;
  /** True when the session runs somewhere other than the vault root. */
  customCwd: boolean;
  permissionMode: PermissionMode;
  backend: BackendOrientation;
}

/**
 * Line tags in the template: a line starting with one is kept (tag removed) only
 * when its condition holds for the session's permission mode, so the agent is
 * never invited to use a channel BojuBot will refuse (#406).
 */
const LINE_TAGS: { tag: string; keep: (mode: PermissionMode) => boolean }[] = [
  { tag: '{{IF_COMMANDS}}', keep: canRunCommands },
  { tag: '{{IF_NO_COMMANDS}}', keep: m => !canRunCommands(m) },
  { tag: '{{IF_VAULT}}', keep: sharesVaultInfo },
  { tag: '{{IF_NO_VAULT}}', keep: m => !sharesVaultInfo(m) },
];

/** Apply the line tags for a mode. Pure — exported for tests. */
export function applyModeTags(template: string, mode: PermissionMode): string {
  const lines: string[] = [];
  for (const line of template.split('\n')) {
    const rule = LINE_TAGS.find(r => line.startsWith(r.tag));
    if (!rule) lines.push(line);
    else if (rule.keep(mode)) lines.push(line.slice(rule.tag.length));
  }
  // Dropped lines can leave a run of blank lines behind; keep at most one.
  const out = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  return template.endsWith('\n') ? out.replace(/\n+$/, '\n') : out.replace(/\n+$/, '');
}

const CWD_BOUNDARY = 'Treat your CWD as your working root. Never autonomously infer or declare a vault root, project root, or repository root from directory structure or config folder markers. If the user explicitly asks you to look at a parent directory, you may do so.';

/** Fill the session orientation template (src/orientation.md). Pure — exported for tests. */
export function renderOrientation(template: string, v: OrientationVars): string {
  const perm = v.backend.permissions[v.permissionMode];
  const cwdInstruction = [
    v.backend.environmentNote?.split('{{BRAND}}').join(v.identityName) ?? '',
    v.customCwd ? CWD_BOUNDARY : '',
  ].filter(Boolean).join(' ');

  return applyModeTags(template, v.permissionMode)
    .split('{{BRAND}}').join(v.identityName)
    .replace('{{AGENT}}', v.backend.agentLabel)
    .replace('{{SUPPORT_LINE}}', v.supportLine)
    .replace('{{CWD}}', v.cwdDisplay)
    .replace('{{CWD_INSTRUCTION}}', cwdInstruction)
    .replace('{{PERMISSION_SUMMARY}}', perm.summary)
    .replace('{{PERMISSION_CAN}}', perm.can)
    .replace('{{PERMISSION_CANNOT}}', perm.cannot);
}
