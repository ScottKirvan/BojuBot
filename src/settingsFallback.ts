import { App, Setting } from 'obsidian';
import type { SettingControl, SettingDefinitionItem, SettingGroup } from 'obsidian';
import { FolderSuggest } from './utils/FolderSuggest';
import { asText, planFallback } from './utils/settingDefinitions';

/** What the fallback renderer needs from the settings tab. */
export interface FallbackHost {
  app: App;
  getControlValue(key: string): unknown;
  setControlValue(key: string, value: unknown): void | Promise<void>;
}

// Render callbacks receive the row's SettingGroup on Obsidian 1.13+. The class
// only exists from 1.11, and BojuBot's render callbacks never use it, so the
// fallback passes this placeholder instead.
const NO_GROUP = null as unknown as SettingGroup;

/**
 * Draws setting definitions with the imperative Setting API, for Obsidian
 * versions older than 1.13.0 (which never call getSettingDefinitions()). Covers
 * what BojuBot's definitions use: groups with headings and classes, `visible`,
 * `disabled`, `render` rows, and toggle, dropdown, text, textarea, number and
 * folder controls; other control types fall back to a text field. Not covered: pages,
 * list affordances (add, delete, reorder), group search, `validate`.
 *
 * Returns the cleanup functions the render callbacks gave back; run them before
 * the next render and when the tab is hidden.
 */
export function renderSettingDefinitions(
  containerEl: HTMLElement,
  items: SettingDefinitionItem[],
  host: FallbackHost,
): (() => void)[] {
  const cleanups: (() => void)[] = [];
  for (const section of planFallback(items)) {
    // Mirror the group element Obsidian 1.13 creates, so `cls` styling applies.
    const el = section.cls ? containerEl.createDiv({ cls: section.cls }) : containerEl;
    if (section.heading) new Setting(el).setName(section.heading).setHeading();
    section.rows.forEach(({ def, disabled }, index) => {
      const setting = new Setting(el).setName(def.name);
      if (def.desc) setting.setDesc(def.desc);
      if (def.control) {
        addControl(setting, def.control, host);
      } else if (def.render) {
        const cleanup = def.render(setting, NO_GROUP);
        if (typeof cleanup === 'function') cleanups.push(cleanup);
      } else if (def.action) {
        const action = def.action;
        setting.settingEl.addEventListener('click', () => action(setting.settingEl, index));
      }
      if (disabled) {
        setting.setDisabled(true);
        // setDisabled sets this on 1.13+; set it here too in case older versions don't
        setting.settingEl.addClass('is-disabled');
      }
    });
  }
  return cleanups;
}

function addControl(setting: Setting, control: SettingControl, host: FallbackHost): void {
  const stored = host.getControlValue(control.key);
  const value = stored ?? control.defaultValue;
  const save = (v: unknown) => { void host.setControlValue(control.key, v); };

  switch (control.type) {
    case 'toggle':
      setting.addToggle(toggle => toggle.setValue(Boolean(value)).onChange(save));
      return;
    case 'dropdown':
      setting.addDropdown(drop => drop.addOptions(control.options).setValue(asText(value)).onChange(save));
      return;
    case 'textarea':
      setting.addTextArea(area => {
        if (control.placeholder) area.setPlaceholder(control.placeholder);
        if (control.rows !== undefined) area.inputEl.rows = control.rows;
        area.setValue(asText(value)).onChange(save);
      });
      return;
    case 'folder':
      setting.addText(text => {
        if (control.placeholder) text.setPlaceholder(control.placeholder);
        text.setValue(asText(value)).onChange(save);
        new FolderSuggest(host.app, text.inputEl);
      });
      return;
    case 'number':
      setting.addText(text => {
        if (control.placeholder) text.setPlaceholder(control.placeholder);
        text.setValue(typeof value === 'number' ? String(value) : '').onChange(v => {
          const n = parseFloat(v);
          save(isNaN(n) ? control.defaultValue ?? 0 : n);
        });
      });
      return;
    default:
      setting.addText(text => {
        if ('placeholder' in control && control.placeholder) text.setPlaceholder(control.placeholder);
        text.setValue(asText(value)).onChange(save);
      });
  }
}
