import type { BackendOrientation, PermissionMode } from '../backends/types';

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

const CWD_BOUNDARY = 'Treat your CWD as your working root. Never autonomously infer or declare a vault root, project root, or repository root from directory structure or config folder markers. If the user explicitly asks you to look at a parent directory, you may do so.';

/** Fill the session orientation template (src/orientation.md). Pure — exported for tests. */
export function renderOrientation(template: string, v: OrientationVars): string {
  const perm = v.backend.permissions[v.permissionMode];
  const cwdInstruction = [
    v.backend.environmentNote?.split('{{BRAND}}').join(v.identityName) ?? '',
    v.customCwd ? CWD_BOUNDARY : '',
  ].filter(Boolean).join(' ');

  return template
    .split('{{BRAND}}').join(v.identityName)
    .replace('{{AGENT}}', v.backend.agentLabel)
    .replace('{{SUPPORT_LINE}}', v.supportLine)
    .replace('{{CWD}}', v.cwdDisplay)
    .replace('{{CWD_INSTRUCTION}}', cwdInstruction)
    .replace('{{PERMISSION_SUMMARY}}', perm.summary)
    .replace('{{PERMISSION_CAN}}', perm.can)
    .replace('{{PERMISSION_CANNOT}}', perm.cannot);
}
