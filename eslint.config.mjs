import obsidianmd from './node_modules/eslint-plugin-obsidianmd/dist/lib/index.js';
import tsparser from '@typescript-eslint/parser';

export default [
  { ignores: ['**/*.js'] },

  // Full community-bot ruleset — stays in sync with Obsidian plugin submission checks
  ...obsidianmd.configs.recommended,

  // Project-specific rule overrides
  {
    files: ['**/*.ts'],
    rules: {
      'obsidianmd/ui/sentence-case': ['error', {
        brands: ['BojuBot', 'Claude', 'Code', 'Obsidian', 'WSL', 'PowerShell'],
      }],
    },
  },

  // Override: add tsconfig project so type-aware rules (@typescript-eslint/no-unsafe-*,
  // no-floating-promises, no-deprecated, etc.) can resolve types
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
