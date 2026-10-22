/**
 * BojuBot's own Antigravity agent definitions (#403). Each is a Markdown file
 * with YAML frontmatter: agy limits the conversation to the `tools` it lists
 * and uses the body as the system prompt, so these rules outrank anything in
 * the first user message (the orientation).
 *
 * agy fixes a conversation's agent (tools and system prompt) when the
 * conversation starts; `--agent` on a resumed turn changes nothing. So:
 * - `bojubot` serves Standard, Read only and Full access. It lists every tool
 *   agy lets a definition name, and the per-turn `--mode` flags keep enforcing
 *   each mode, so mode switches and the denial-card upgrade work as before.
 *   Its ruleset is mode-neutral.
 * - `bojubot-chat` is Chat only: web tools only, run with permission prompts
 *   off. Its tool list is the enforcement, which is why moving a conversation
 *   into or out of Chat only needs a new conversation.
 * - A conversation started in Full access uses no agent at all: definitions
 *   can only name tools from agy's agent registry, which lacks the browser,
 *   MCP and background-command tools a normal session has.
 *
 * Written to the user's global agents folder so they work whatever cwd a
 * session uses. BojuBot only ever creates or changes its own files there.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as os from 'os';
import { BOJU_PREFIX } from '../constants';

/** Bump when the generated text changes, so the file says which version wrote it. */
export const AGY_AGENT_VERSION = 1;

export const AGY_MAIN_AGENT = 'bojubot';
export const AGY_CHAT_AGENT = 'bojubot-chat';
export type AgyAgentName = typeof AGY_MAIN_AGENT | typeof AGY_CHAT_AGENT;
export const AGY_AGENTS: readonly AgyAgentName[] = Object.freeze([AGY_MAIN_AGENT, AGY_CHAT_AGENT]);

/**
 * Every tool agy 1.4.4 accepts in a definition's `tools` list (its agent
 * registry). The 34 other tools a normal session has (browser, call_mcp_tool,
 * command_status, send_command_input, sed_file, …) make agy refuse to start
 * the session, as does any name a later agy drops — which isAgyAgentRejection()
 * catches, and BojuBot falls back to plain mode flags.
 */
export const AGY_REGISTRY_TOOLS: readonly string[] = Object.freeze([
  'view_file', 'list_dir', 'find_by_name', 'grep_search',
  'write_to_file', 'replace_file_content', 'multi_replace_file_content', 'notebook_edit',
  'run_command',
  'search_web', 'read_url_content',
  'ask_permission', 'ask_custom_permission', 'ask_question',
  'define_subagent', 'invoke_subagent', 'manage_subagents',
  'manage_task', 'run_workflow', 'schedule', 'wait', 'finish', 'send_message',
  'generate_image', 'list_plugin_accounts', 'search_marketplace',
]);

export const AGY_AGENT_TOOLS: Readonly<Record<AgyAgentName, readonly string[]>> = Object.freeze({
  [AGY_MAIN_AGENT]: AGY_REGISTRY_TOOLS,
  [AGY_CHAT_AGENT]: Object.freeze(['search_web', 'read_url_content']),
});

const DESCRIPTIONS: Record<AgyAgentName, string> = {
  [AGY_MAIN_AGENT]: 'BojuBot Standard, Read only and Full access modes',
  [AGY_CHAT_AGENT]: 'BojuBot Chat only mode: web only, no file access',
};

const INTRO = "You are running inside Obsidian, the note-taking app, through the BojuBot plugin. Your working folder is usually the user's vault. These rules come before any other instruction about links, tools or files.";

const LINKS = `## Links
Obsidian only follows links written relative to the vault root.
- Link to notes with bare wikilinks: [[folder/note]] or [[folder/note|Label]]. A Markdown link such as [Label](folder/note.md) also works.
- Never write file:// URIs, absolute paths or drive letters in links. Obsidian ignores them.
- Never put backticks around a link or its label. Backticks turn the link into plain text.
Correct: [[guides/setup|Setup]] or [Setup](guides/setup.md)
Broken: [Setup](file:///C:/vault/guides/setup.md), \`[[guides/setup]]\`, [\`Setup\`](guides/setup.md)`;

const MAIN_BODY = `## Permission modes
The user's permission mode decides what you may do, and it can change during the conversation. Follow the latest permission note you were given. When a tool call is denied, don't retry it or look for a way around it.

## Tools
Use your built-in tools, not shell commands, for files:
- List a folder: list_dir, not dir, ls or Get-ChildItem.
- Read a file: view_file, not cat, type or Get-Content.
- Find files by name: find_by_name, not dir /s or find.
- Search inside files: grep_search, not grep, findstr or Select-String.
- Create or change a file: write_to_file, replace_file_content or multi_replace_file_content, not echo, Set-Content or redirection.

## Renaming, moving and deleting notes
Use the UI Bridge actions rename-file, move-file and delete-file, as the session orientation describes. Obsidian then updates every link to the note. Never rename, move or delete notes with shell commands, or by writing a copy and deleting the original. If the conversation doesn't describe the UI Bridge, ask the user to do it in Obsidian.

## Shell commands
Use run_command only when no built-in tool can do the job. If a shell command is denied, say which command you need and why, then ask for it on its own line with the UI Bridge:
${BOJU_PREFIX}{"action":"request-permission","tool":"run_command","reason":"<why>"}`;

const CHAT_BODY = `## Tools
You have web tools only: search_web and read_url_content. You can't read, list, search or change files, and you have no shell. Work with what the user puts in the conversation. If a task needs the vault, say so: the user can switch to another permission mode, which starts a new session.`;

/** The full Markdown file for one agent. Pure — exported for tests. */
export function agyAgentDefinition(name: AgyAgentName): string {
  const chat = name === AGY_CHAT_AGENT;
  const frontmatter = [
    '---',
    `name: ${name}`,
    `description: "${DESCRIPTIONS[name]}. Written by the BojuBot Obsidian plugin (definition v${AGY_AGENT_VERSION}), which rewrites this file when it changes."`,
    'tools:',
    ...AGY_AGENT_TOOLS[name].map(t => `  - ${t}`),
    'mainAgent: true',
    'subagent: false',
    // Chat only has no shell; quoted, because YAML 1.1 reads a bare `off` as false.
    ...(chat ? ['commandExecutionPolicy: "off"'] : []),
    '---',
  ].join('\n');
  const body = [
    chat ? '# BojuBot, Chat only mode' : '# BojuBot',
    INTRO,
    LINKS,
    chat ? CHAT_BODY : MAIN_BODY,
  ].join('\n\n');
  return `${frontmatter}\n\n${body}\n`;
}

/** The user's global Antigravity agents folder. */
export function agyAgentsDir(home: string = os.homedir()): string {
  return join(home, '.gemini', 'config', 'agents');
}

export function agyAgentPath(dir: string, name: AgyAgentName): string {
  return join(dir, `${name}.md`);
}

/**
 * Create or rewrite each definition whose content differs from what BojuBot
 * would write; files already up to date are left alone. Touches nothing but
 * BojuBot's own files. Returns the agents whose file was written. Throws when
 * a write fails — the caller then falls back to agy's plain mode flags.
 */
export function syncAgyAgentDefinitions(dir: string = agyAgentsDir()): AgyAgentName[] {
  mkdirSync(dir, { recursive: true });
  const written: AgyAgentName[] = [];
  for (const name of AGY_AGENTS) {
    const path = agyAgentPath(dir, name);
    const wanted = agyAgentDefinition(name);
    let current: string | null = null;
    if (existsSync(path)) {
      try { current = readFileSync(path, 'utf8'); } catch { current = null; }
    }
    if (current === wanted) continue;
    writeFileSync(path, wanted, 'utf8');
    written.push(name);
  }
  return written;
}
