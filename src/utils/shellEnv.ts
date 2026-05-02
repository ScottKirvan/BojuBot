import { execSync } from 'child_process';

export function resolveShellEnv(): Record<string, string> {
  // On Windows, skip shell resolution and use process.env directly.
  // The full shell env is not needed on Windows — PATH and relevant vars
  // are already present in process.env via Obsidian's launch environment.
  if (process.platform === 'win32') {
    return { ...process.env };
  }

  // On Mac/Linux, launch a login shell to pick up PATH from .zshrc / .bash_profile
  try {
    const shell = process.env.SHELL || '/bin/bash';
    const output = execSync(`${shell} -l -c env`, {
      encoding: 'utf8',
      timeout: 5000,
    });

    const env: Record<string, string> = {};
    for (const line of output.split('\n')) {
      const idx = line.indexOf('=');
      if (idx > 0) {
        env[line.substring(0, idx)] = line.substring(idx + 1);
      }
    }
    return env;
  } catch {
    return { ...process.env };
  }
}
