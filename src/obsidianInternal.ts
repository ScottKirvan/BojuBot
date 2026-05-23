/**
 * Minimal shape of Obsidian's private App APIs used across BojuBot.
 * Cast via: `(this.app as unknown as AppInternal)`
 */
export interface AppInternal {
  setting: { open(): void; openTabById(id: string): void };
  commands: {
    commands: Record<string, { id: string; name: string }>;
    removeCommand(id: string): void;
  };
}
