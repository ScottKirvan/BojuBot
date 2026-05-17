import { AbstractInputSuggest, App, TFolder } from 'obsidian';

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  private textInputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.textInputEl = inputEl;
  }

  getSuggestions(query: string): TFolder[] {
    const lower = query.toLowerCase();
    return this.app.vault
      .getAllFolders(true)
      .filter(f => f.path.toLowerCase().includes(lower))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path === '/' ? '/ (vault root)' : folder.path);
  }

  selectSuggestion(folder: TFolder): void {
    this.setValue(folder.path === '/' ? '' : folder.path);
    this.textInputEl.dispatchEvent(new Event('input'));
    this.close();
  }
}
