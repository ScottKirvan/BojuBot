/**
 * Minimal shape of Obsidian's private App APIs used across BojuBot.
 * Cast via: `(this.app as unknown as AppInternal)`
 */
/** Private WorkspaceLeaf members, each optional so a missing one is a no-op. */
export interface LeafInternal {
  /** Redraw the tab title and icon from the view. */
  updateHeader?(): void;
  /** The tab's header element. */
  tabHeaderEl?: HTMLElement;
}

export interface AppInternal {
  setting: { open(): void; openTabById(id: string): void };
  commands: {
    commands: Record<string, { id: string; name: string }>;
    removeCommand(id: string): void;
  };
}
