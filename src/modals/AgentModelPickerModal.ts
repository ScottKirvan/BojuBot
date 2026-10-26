import { App, Modal } from 'obsidian';
import type { BackendId, ModelOption } from '../backends/types';
import { renderAgentIcon } from '../agentIcon';

/** One agent's section in the picker. Built from the backend list, so a new
 *  backend gets its own section with no picker changes. */
export interface AgentModelSection {
  id: BackendId;
  /** Section header, e.g. "Claude (Claude Code)". */
  label: string;
  /** False when the CLI wasn't found: shown greyed out, can't be picked. */
  installed: boolean;
  models: ModelOption[];
}

/**
 * The agent + model picker (#402): one section per agent, each model listed
 * once under the agent that runs it. Opened from the model indicator, /model,
 * the Switch model command and Custom Session's model field.
 */
export class AgentModelPickerModal extends Modal {
  constructor(
    app: App,
    private readonly sections: AgentModelSection[],
    /** The agent and model in use; its row gets the check mark. */
    private readonly current: { backend: BackendId; model: string },
    private readonly onSelect: (backend: BackendId, model: ModelOption) => void,
  ) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText('Switch agent or model');
    this.contentEl.addClass('bojubot-model-picker');

    for (const section of this.sections) {
      const header = this.contentEl.createDiv({ cls: 'bojubot-model-section' });
      renderAgentIcon(header, section.id, 'bojubot-model-section-icon');
      header.createSpan({ cls: 'bojubot-model-section-label', text: section.label });

      if (!section.installed) {
        header.addClass('is-disabled');
        header.createSpan({ cls: 'bojubot-model-section-note', text: 'not installed' });
        continue;
      }
      if (section.models.length === 0) {
        this.contentEl.createDiv({ cls: 'bojubot-model-section-empty', text: 'Models not listed yet — try again in a moment.' });
        continue;
      }

      for (const model of section.models) {
        const isCurrent = section.id === this.current.backend && model.id === this.current.model;
        const row = this.contentEl.createDiv({ cls: 'bojubot-model-row' });
        if (isCurrent) row.addClass('is-active');

        const text = row.createDiv({ cls: 'bojubot-model-text' });
        text.createDiv({ cls: 'bojubot-model-name', text: model.displayName });
        if (model.description) text.createDiv({ cls: 'bojubot-model-desc', text: model.description });

        if (isCurrent) row.createDiv({ cls: 'bojubot-model-check', text: '✓' });

        row.addEventListener('click', () => {
          this.close();
          this.onSelect(section.id, model);
        });
      }
    }
  }

  onClose() { this.contentEl.empty(); }
}
