import { execSync, spawn, ChildProcess } from 'child_process';
import { log as LOG } from '../utils/logger';

/**
 * Start a CLI binary with `args`. Every invocation goes through here so the
 * Windows/Electron workaround and the env cleanup apply everywhere.
 * Never put user content in `args` — write it to stdin instead.
 */
export function launchCli(binaryPath: string, args: string[], cwd: string, baseEnv: Record<string, string>): ChildProcess {
  // Strip CLAUDECODE so claude doesn't refuse to launch inside another session.
  const env = { ...baseEnv };
  delete env['CLAUDECODE'];

  let proc: ChildProcess;

  if (process.platform === 'win32') {
    // On Windows, Electron's child_process piping doesn't work correctly with
    // cmd.exe (shell:true) or direct spawn (shell:false) — stdout is swallowed.
    // Spawning via powershell.exe -NonInteractive works reliably.
    // Single-quote flags only (no user content in args now — prompt goes via stdin).
    const ps = (s: string) => `'${s.replace(/'/g, "''")}'`;
    const psCmd = `& ${ps(binaryPath)} ${args.map(ps).join(' ')}`;
    LOG('  powershell spawn');
    proc = spawn('powershell.exe', ['-NonInteractive', '-Command', psCmd], {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
  } else {
    proc = spawn(binaryPath, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
  }

  LOG('  pid:', proc.pid);
  return proc;
}

/**
 * Run a CLI to completion and resolve with its stdout. `stdin` (if given) is
 * written, and stdin is always closed so the CLI never waits for more input.
 * Rejects on spawn error, non-zero exit, or timeout (the process tree is killed).
 */
export function runCli(
  binaryPath: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
  timeoutMs: number,
  stdin = '',
): Promise<string> {
  return new Promise((resolve, reject) => {
    let proc: ChildProcess;
    try {
      proc = launchCli(binaryPath, args, cwd, env);
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    let out = '';
    let errText = '';
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      killProcess(proc);
      reject(new Error(`timed out after ${timeoutMs} ms`));
    }, timeoutMs);
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn();
    };

    proc.stdout?.on('data', (chunk: Buffer) => { out += chunk.toString(); });
    proc.stderr?.on('data', (chunk: Buffer) => { errText += chunk.toString(); });
    proc.on('error', (e) => settle(() => reject(e)));
    proc.on('close', (code) => settle(() => {
      if (code === 0) resolve(out);
      else reject(new Error(`exit code ${code}${errText.trim() ? `: ${errText.trim().substring(0, 200)}` : ''}`));
    }));

    if (stdin) proc.stdin?.write(stdin, 'utf8');
    proc.stdin?.end();
  });
}

/**
 * Kill a spawned CLI process and its entire process tree.
 * On Windows, proc.kill() only kills the PowerShell wrapper — the CLI keeps running.
 * taskkill /F /T kills the full tree.
 */
export function killProcess(proc: ChildProcess): void {
  if (!proc.pid) return;
  LOG('killProcess — pid:', proc.pid);
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' });
    } catch {
      // Process may have already exited — ignore
    }
  } else {
    proc.kill('SIGTERM');
  }
}
