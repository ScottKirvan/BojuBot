/**
 * Pure utility functions for formatting tool call events in the chat panel.
 * No Obsidian API dependency — safe to import in unit tests.
 */

/**
 * Extracts a human-readable detail string from a tool call's input object.
 * Used to build the label shown in each tool event row (e.g. "Read: my-note.md").
 *
 * @param tool  Lowercase tool name (e.g. "read", "bash", "grep")
 * @param input Raw input object received from the Claude Code stream
 * @returns     A short descriptive string, or empty string if nothing useful is found
 */
export function extractToolDetail(tool: string, input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const inp = input as Record<string, unknown>;

  // Try path-like fields first (covers Read, Write, Edit, Glob, Grep, LS…;
  // AbsolutePath/TargetFile are Antigravity's view_file/write_to_file)
  const pathVal = (inp.file_path ?? inp.path ?? inp.filePath ?? inp.AbsolutePath ?? inp.TargetFile) as string | undefined;
  if (pathVal) {
    // For commands that benefit from showing just the filename
    const key = tool.toLowerCase();
    if (key !== 'bash' && key !== 'grep' && key !== 'glob') {
      return pathVal.split(/[\\/]/).pop() ?? pathVal;
    }
    return pathVal;
  }

  // Bash (Claude Code) / run_command (Antigravity): show the command
  const command = (inp.command ?? inp.CommandLine) as string | undefined;
  if (command) {
    const cmd = command;
    return cmd.length > 70 ? cmd.substring(0, 70) + '…' : cmd;
  }

  // Web tools
  if (inp.url) return inp.url as string;
  if (inp.query) return inp.query as string;

  // Grep / Glob: show the pattern
  if (inp.pattern) return inp.pattern as string;

  return '';
}
