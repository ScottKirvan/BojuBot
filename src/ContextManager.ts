import { App } from 'obsidian';
import { AppInternal } from './obsidianInternal';
import { buildVaultTree } from './utils/fileTree';
import { log, estimateTokens } from './utils/logger';
import { neutralizeTriggers } from './constants';
import { scanPinnedFiles, scanFileInstructions } from './FrontmatterGuard';
import type { BackendOrientation, PermissionMode } from './backends/types';
import orientationTemplate from './orientation.md';
import { renderOrientation } from './utils/orientation';
import { canRunCommands } from './utils/modeGates';
import { activeBrand, resolveIdentityName, DEFAULT_BRAND } from './brand';

export class ContextManager {
  needsCompaction = false;

  constructor(
    private app: App,
    /** Wording for the CLI this session runs on — the session's backend, never a default. */
    private orientation: BackendOrientation,
    private contextFilePath: string,
    private autonomousMemory: boolean = true,
    private vaultTreeDepth: number = 0,
    private commandAllowlist: string[] = [],
    private permissionMode: PermissionMode = 'standard',
    private contextFileSizeCapTokens: number = 0,
    private minimalMode: boolean = false,
    private suppressVaultContext: boolean = false,
    private customInstructions: string = '',
    private cwd: string = '',
    private vaultRoot: string = '',
    /** Ask the agent to flag thank-yous (#385). Off when the card can't show:
     *  opted out of support messages, or a white-labeled build. */
    private thanksHook: boolean = false,
  ) { }

  async buildSessionContext(): Promise<string> {
    if (this.minimalMode) return '';
    const parts: string[] = [];
    const layerBreakdown: Record<string, { text: string; chars: number; tokens: number }> = {};

    // Layer 0: System orientation (always injected)
    // Assistant identity: only rebranded when the user opts in — otherwise the
    // orientation stays byte-for-byte the stock BojuBot identity even if a
    // display name is set elsewhere. Support line falls back to the bundled URLs.
    const brand = activeBrand();
    const identityName = resolveIdentityName(brand);
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

    let orientation = renderOrientation(orientationTemplate, {
      identityName,
      supportLine,
      cwdDisplay,
      customCwd: !!this.cwd && this.cwd !== this.vaultRoot,
      permissionMode: this.permissionMode,
      backend: this.orientation,
    });

    // Chat only and Read only refuse run-command, so don't list commands or invite it (#406)
    if (this.commandAllowlist.length > 0 && canRunCommands(this.permissionMode)) {
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

    if (this.thanksHook) {
      orientation +=
        `\n\n## Thanks\n` +
        `When the user genuinely thanks you because your help worked, reply naturally and also emit on its own line ` +
        `(never for "thanks, but…" corrections, complaints or "no thanks"):\n` +
        `@@BOJU {"action":"thanked"}`;
    }

    parts.push(orientation);
    layerBreakdown['orientation'] = {
      text: orientation,
      chars: orientation.length,
      tokens: estimateTokens(orientation),
    };

    // Chat only (restricted) mode's "no vault access" guarantee must hold even
    // when nothing was explicitly attached — layers 1-5 below include vault
    // content (context file, pinned notes, per-file instructions) that could
    // otherwise leak details established in other, non-restricted sessions.
    if (!this.suppressVaultContext && this.permissionMode !== 'restricted') {
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
          `update \`${this.contextFilePath}\` using ${this.orientation.editToolHint}. ` +
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

    // Layer 6: Custom-session instructions (user-supplied session setup prompt; always injected when present)
    if (this.customInstructions.trim()) {
      const customBlock = `## Session instructions\n${this.customInstructions.trim()}`;
      parts.push(customBlock);
      layerBreakdown['custom-instructions'] = {
        text: customBlock,
        chars: customBlock.length,
        tokens: estimateTokens(customBlock),
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
    if (this.suppressVaultContext) log('  [vault context suppressed by custom session options]');
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
