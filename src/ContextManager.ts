import { App } from 'obsidian';
import { AppInternal } from './obsidianInternal';
import { buildVaultTree } from './utils/fileTree';
import { log, estimateTokens } from './utils/logger';
import { neutralizeTriggers } from './constants';
import { scanPinnedFiles, scanFileInstructions } from './FrontmatterGuard';
import type { PermissionMode } from './ClaudeProcess';
import orientationTemplate from './orientation.md';
import { activeBrand, DEFAULT_BRAND } from './brand';

export const PERMISSION_DESCRIPTIONS: Record<PermissionMode, { summary: string; can: string; cannot: string }> = {
  restricted: {
    summary: 'Chat only',
    can: 'respond to messages, fetch web URLs (WebFetch), search the web (WebSearch), and work with any context the user explicitly attaches',
    cannot: 'read, write, or modify vault files. If asked to make file changes, describe exactly what you would change and ask the user to switch to Standard mode or apply the change themselves',
  },
  readonly: {
    summary: 'Read-only',
    can: 'read vault files (Read, Glob, Grep), fetch web URLs, and search the web',
    cannot: 'write or modify any files. If asked to make changes, show the user a diff or the exact content to paste',
  },
  standard: {
    summary: 'Standard',
    can: 'read and write vault files and fetch the web',
    cannot: 'run shell commands (Bash). Request permission if a task genuinely requires it',
  },
  full: {
    summary: 'Full access',
    can: 'use all tools including Bash shell commands',
    cannot: 'nothing — all tools are available',
  },
};

export class ContextManager {
  needsCompaction = false;

  constructor(
    private app: App,
    private contextFilePath: string,
    private autonomousMemory: boolean = true,
    private vaultTreeDepth: number = 0,
    private commandAllowlist: string[] = [],
    private permissionMode: PermissionMode = 'standard',
    private contextFileSizeCapTokens: number = 0,
    private minimalMode: boolean = false,
    private suppressVaultContext: boolean = false,
    private primeInstructions: string = '',
    private cwd: string = '',
    private vaultRoot: string = '',
  ) { }

  async buildSessionContext(): Promise<string> {
    if (this.minimalMode) return '';
    const parts: string[] = [];
    const layerBreakdown: Record<string, { text: string; chars: number; tokens: number }> = {};

    // Layer 0: System orientation (always injected)
    const perm = PERMISSION_DESCRIPTIONS[this.permissionMode];
    // Assistant identity: only rebranded when the user opts in — otherwise the
    // orientation stays byte-for-byte the stock BojuBot identity even if a
    // display name is set elsewhere. Support line falls back to the bundled URLs.
    const brand = activeBrand();
    const identityName = brand.applyToAssistantIdentity ? brand.name : DEFAULT_BRAND.name;
    const supportLine = brand.applyToAssistantIdentity
      ? [brand.links.support, brand.links.community].filter(Boolean).join(' · ')
      : `${DEFAULT_BRAND.links.support} · ${DEFAULT_BRAND.links.community}`;
    let cwdDisplay: string;
    if (!this.cwd || this.cwd === this.vaultRoot) {
      cwdDisplay = 'vault root';
    } else if (
      this.vaultRoot &&
      (this.cwd + '/').toLowerCase().startsWith((this.vaultRoot + '/').toLowerCase())
    ) {
      // cwd is a subfolder of the vault — show only the vault-root-relative portion
      // so Claude can navigate via relative paths without knowing the absolute vault location
      cwdDisplay = this.cwd.slice(this.vaultRoot.length).replace(/^[/\\]+/, '');
    } else {
      // cwd is outside the vault entirely — absolute path is fine, no vault info leaked
      cwdDisplay = this.cwd;
    }
    const ADDITIONAL_DIRS_BOUNDARY = `Your environment may list "Additional working directories" beyond your CWD — these come from Claude Code CLI's own global config and are not something ${identityName} set up; they are frequently leftover from unrelated projects. Ignore them: do not read, write, or explore any additional working directory unless the user explicitly directs you there.`;
    const CWD_BOUNDARY = 'Treat your CWD as your working root. Never autonomously infer or declare a vault root, project root, or repository root from directory structure or config folder markers. If the user explicitly asks you to look at a parent directory, you may do so.';
    const cwdInstruction = [
      ADDITIONAL_DIRS_BOUNDARY,
      (this.cwd && this.cwd !== this.vaultRoot) ? CWD_BOUNDARY : '',
    ].filter(Boolean).join(' ');

    let orientation = orientationTemplate
      .split('{{BRAND}}').join(identityName)
      .replace('{{SUPPORT_LINE}}', supportLine)
      .replace('{{CWD}}', cwdDisplay)
      .replace('{{CWD_INSTRUCTION}}', cwdInstruction)
      .replace('{{PERMISSION_SUMMARY}}', perm.summary)
      .replace('{{PERMISSION_CAN}}', perm.can)
      .replace('{{PERMISSION_CANNOT}}', perm.cannot);

    if (this.commandAllowlist.length > 0) {
      const rows = this.commandAllowlist
        .map(id => {
          const name = (this.app as unknown as AppInternal).commands.commands[id]?.name ?? id;
          return `| \`${name}\` | \`${id}\` |`;
        })
        .join('\n');
      orientation +=
        `\n\n## Allowed Obsidian commands\n` +
        `You can run specific Obsidian commands using:\n` +
        `@@BOJU {"action": "run-command", "commandId": "<id>"}\n\n` +
        `These commands run immediately. For any other command the user asks for, attempt it — the user will be prompted to approve or deny:\n\n` +
        `| Command | ID |\n|---|---|\n${rows}`;
    }

    parts.push(orientation);
    layerBreakdown['orientation'] = {
      text: orientation,
      chars: orientation.length,
      tokens: estimateTokens(orientation),
    };

    if (!this.suppressVaultContext) {
      // Layer 1: Vault tree (folder/file names only — no content)
      const tree = buildVaultTree(this.app.vault, this.vaultTreeDepth);
      if (tree) {
        const treeBlock = `## Vault structure\n\`\`\`\n${tree}\n\`\`\``;
        parts.push(treeBlock);
        layerBreakdown['vault-tree'] = {
          text: tree,
          chars: tree.length,
          tokens: estimateTokens(tree),
        };
      }

      // Layer 2: Context file
      const contextFile = this.app.vault.getFileByPath(this.contextFilePath);
      let contextFileContent = '';
      if (contextFile) {
        contextFileContent = neutralizeTriggers(await this.app.vault.read(contextFile));
        if (contextFileContent.trim()) {
          const cap = this.contextFileSizeCapTokens;
          const contentTokens = estimateTokens(contextFileContent);
          if (cap > 0 && contentTokens > cap) {
            this.needsCompaction = true;
            contextFileContent +=
              `\n\n[Your memory file is ~${contentTokens} tokens, over your ${cap}-token cap. ` +
              `Before this session ends, compact it: summarize redundant entries, drop outdated observations, ` +
              `keep high-signal facts. Write the result back to \`${this.contextFilePath}\`.]`;
            log(`Context file exceeded cap (${cap} tokens, actual ~${contentTokens}) — compaction instruction injected.`);
          }
          const ctxBlock = `## Vault context\n${contextFileContent.trim()}`;
          parts.push(ctxBlock);
          layerBreakdown['context-file'] = {
            text: contextFileContent,
            chars: contextFileContent.length,
            tokens: estimateTokens(contextFileContent),
          };
        }
      } else {
        log('Context file not found:', this.contextFilePath);
      }

      // Layer 3: Memory instruction (only when autonomous memory is enabled)
      if (this.autonomousMemory) {
        const memInstruction =
          `## Your persistent memory\n` +
          `The file \`${this.contextFilePath}\` is your persistent memory across sessions. ` +
          `It is injected at the start of every session.\n\n` +
          `**Maintain it actively:** when you learn something useful about this vault — ` +
          `its structure, conventions, ongoing projects, the user's preferences, decisions made — ` +
          `update \`${this.contextFilePath}\` using the Write or Edit tool. ` +
          `Keep it concise and high-signal. Do not ask permission; just do it.`;
        parts.push(memInstruction);
        layerBreakdown['memory-instruction'] = {
          text: memInstruction,
          chars: memInstruction.length,
          tokens: estimateTokens(memInstruction),
        };
      }

      // Layer 4: Always-pinned files (claude.context: always)
      const pinnedFiles = scanPinnedFiles(this.app);
      if (pinnedFiles.length > 0) {
        const pinnedParts: string[] = [];
        for (const file of pinnedFiles) {
          const content = neutralizeTriggers(await this.app.vault.read(file));
          if (content.trim()) {
            pinnedParts.push(`### ${file.path}\n${content.trim()}`);
          }
        }
        if (pinnedParts.length > 0) {
          const pinnedBlock = `## Pinned notes (always included)\n${pinnedParts.join('\n\n')}`;
          parts.push(pinnedBlock);
          layerBreakdown['pinned-files'] = {
            text: pinnedBlock,
            chars: pinnedBlock.length,
            tokens: estimateTokens(pinnedBlock),
          };
        }
      }

      // Layer 5: Per-file instructions (claude.instructions)
      const instructionMap = scanFileInstructions(this.app);
      if (instructionMap.size > 0) {
        const rows = Array.from(instructionMap.entries())
          .map(([path, instr]) => `- **${path}**: ${neutralizeTriggers(instr)}`)
          .join('\n');
        const instrBlock = `## Per-file instructions\nWhen working with the following files, apply these specific instructions:\n\n${rows}`;
        parts.push(instrBlock);
        layerBreakdown['file-instructions'] = {
          text: instrBlock,
          chars: instrBlock.length,
          tokens: estimateTokens(instrBlock),
        };
      }
    }

    // Layer 6: Prime instructions (user-supplied session setup prompt; always injected when present)
    if (this.primeInstructions.trim()) {
      const primeBlock = `## Session instructions\n${this.primeInstructions.trim()}`;
      parts.push(primeBlock);
      layerBreakdown['prime-instructions'] = {
        text: primeBlock,
        chars: primeBlock.length,
        tokens: estimateTokens(primeBlock),
      };
    }

    if (parts.length === 0) return '';

    const fullContext = [
      '<vault_context>',
      parts.join('\n\n'),
      '</vault_context>',
    ].join('\n');

    // Log breakdown
    const totalTokens = estimateTokens(fullContext);
    log('=== CONTEXT INJECTION BREAKDOWN (first turn of session) ===');
    if (this.suppressVaultContext) log('  [vault context suppressed by prime options]');
    for (const [layer, data] of Object.entries(layerBreakdown)) {
      log(`  ${layer}: ${data.chars} chars, ~${data.tokens} tokens`);
    }
    log(`  TOTAL: ${fullContext.length} chars, ~${totalTokens} tokens`);

    return fullContext;
  }

  injectContext(context: string, userPrompt: string): string {
    if (!context) return userPrompt;
    return `${context}\n\n${userPrompt}`;
  }
}
