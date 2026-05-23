import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, isAbsolute } from 'path';
import { parseYaml } from 'obsidian';
import type { SlashParam } from './modals/SlashParamModal';

export interface SkillDef {
  filePath: string;
  name: string;
  body: string;
  category: string;
  description?: string;
  autorun: boolean;
  params?: SlashParam[];
}

export function resolveSkillsFolder(vaultRoot: string, custom: string): string {
  if (custom.trim()) {
    const p = custom.trim();
    return isAbsolute(p) ? p : join(vaultRoot, p);
  }
  return join(vaultRoot, '_BojuBot Skills');
}

export function nameFromPath(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  const fileName = parts[parts.length - 1] ?? '';
  return fileName === 'SKILL.md'
    ? (parts[parts.length - 2] ?? 'Command')
    : fileName.replace(/\.md$/, '') || 'Command';
}

export function scanSkillFolder(folder: string): { filePath: string; name: string }[] {
  if (!existsSync(folder)) return [];
  const entries: { filePath: string; name: string }[] = [];
  try {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        entries.push({ filePath: join(folder, entry.name), name: entry.name.replace(/\.md$/, '') });
      } else if (entry.isDirectory()) {
        const skillMd = join(folder, entry.name, 'SKILL.md');
        if (existsSync(skillMd)) {
          entries.push({ filePath: skillMd, name: entry.name });
        }
      }
    }
  } catch { /* folder unreadable */ }
  return entries;
}

export function parseSkillFile(filePath: string, name: string): SkillDef {
  const raw = readFileSync(filePath, 'utf8');
  let body = raw;
  let category = 'Prompts';
  let description: string | undefined;
  let params: SlashParam[] | undefined;
  let autorun = false;

  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (fmMatch) {
    body = fmMatch[2].trim();
    try {
      const fm = parseYaml(fmMatch[1]) as Record<string, unknown>;
      if (typeof fm.category === 'string') category = fm.category;
      if (typeof fm.description === 'string') description = fm.description;
      if (fm.autorun === true) autorun = true;
      if (Array.isArray(fm.params)) {
        params = fm.params as SlashParam[];
      } else if (Array.isArray(fm.arguments)) {
        const argHint = typeof fm['argument-hint'] === 'string' ? fm['argument-hint'] : '';
        params = (fm.arguments as string[]).map((argName, i) => ({
          id: String(argName),
          type: 'input' as const,
          label: String(argName),
          placeholder: i === 0 ? argHint : '',
        }));
      }
    } catch { /* malformed frontmatter */ }
  }

  return { filePath, name, body, category, description, autorun, params };
}

export function loadSkills(folder: string): SkillDef[] {
  return scanSkillFolder(folder).flatMap(({ filePath, name }) => {
    try {
      return [parseSkillFile(filePath, name)];
    } catch {
      return [];
    }
  });
}
