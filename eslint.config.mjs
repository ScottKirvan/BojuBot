import obsidianmd from './node_modules/eslint-plugin-obsidianmd/dist/lib/index.js';
import tsparser from '@typescript-eslint/parser';
import tseslint from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['**/*.js'],
  },
  {
    plugins: {
      obsidianmd,
      '@typescript-eslint': tseslint,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Obsidian plugin rules (matching obsidianmd bot ruleset)
      'obsidianmd/ui/sentence-case': ['error', { allowAutoFix: true }],
      'obsidianmd/hardcoded-config-path': 'error',
      'obsidianmd/commands/no-plugin-id-in-command-id': 'error',
      'obsidianmd/commands/no-plugin-name-in-command-name': 'error',
      'obsidianmd/detach-leaves': 'error',
      'obsidianmd/no-tfile-tfolder-cast': 'error',
      'obsidianmd/no-static-styles-assignment': 'error',
      'obsidianmd/settings-tab/no-manual-html-headings': 'error',
      'obsidianmd/no-forbidden-elements': 'error',

      // TypeScript rules (type-aware — require parserOptions.project)
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-base-to-string': 'error',
    },
    files: ['**/*.ts'],
  }
];
