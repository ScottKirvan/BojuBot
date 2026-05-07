import { exec } from 'child_process';

export function resolveShellEnv(): Promise<Record<string, string>> {
  // On Windows, skip shell resolution and use process.env directly.
  // The full shell env is not needed on Windows — PATH and relevant vars
  // are already present in process.env via Obsidian's launch environment.
  if (process.platform === 'win32') {
    return Promise.resolve({ ...process.env } as Record<string, string>);
  }

  // On Mac/Linux, launch a login shell to pick up PATH from .zshrc / .bash_profile.
  // Uses exec (async) so the Obsidian event loop is never blocked.
  return new Promise((resolve) => {
    const shell = process.env.SHELL || '/bin/bash';
    exec(`${shell} -l -c env`, { encoding: 'utf8', timeout: 5000 }, (err, stdout) => {
      if (err) {
        resolve({ ...process.env } as Record<string, string>);
        return;
      }
      const env: Record<string, string> = {};
      for (const line of stdout.split('\n')) {
        const idx = line.indexOf('=');
        if (idx > 0) {
          env[line.substring(0, idx)] = line.substring(idx + 1);
        }
      }
      resolve(env);
    });
  });
}
