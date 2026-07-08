import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import { type Component, Key, matchesKey, truncateToWidth, type TUI } from '@earendil-works/pi-tui';

import type { ComponentPreviewEntry } from './registry.js';
import { SwitchableComponentPreviewTheme } from './theme.js';

/**
 * Menu Component listing every registered preview entry. Selecting one hands
 * the entry its `open(tui, theme, keybindings)` call — which decides for
 * itself whether to open as a real overlay or an inline swap, matching that
 * component's actual production presentation contract (see `registry.ts`).
 *
 * The gallery removes itself from `tui`'s children while an entry is open so
 * inline-swap entries don't double-render alongside the menu, then re-adds
 * itself once the entry's `done()` resolves.
 */
export class ComponentGalleryComponent implements Component {
  #activeIndex = 0;
  #busy = false;

  constructor(
    private readonly entries: readonly ComponentPreviewEntry[],
    private readonly theme: Theme,
    private readonly keybindings: KeybindingsManager,
    private readonly tui: TUI,
    private readonly onQuit: () => void,
  ) {}

  render(width: number): string[] {
    const safeWidth = Math.max(1, width);
    const lines = [
      this.theme.fg('accent', 'Brunch component preview'),
      this.theme.fg('dim', 'npm run dev:components -- <id> to deep-link into one entry'),
      '',
      ...this.entries.map((entry, index) => this.#entryLine(entry, index)),
      '',
      this.theme.fg('dim', `\u2191/\u2193 or j/k move \u00b7 enter opens \u00b7 q quits${this.#themeHint()}`),
    ];
    return lines.map((line) => truncateToWidth(line, safeWidth));
  }

  #themeHint(): string {
    if (!(this.theme instanceof SwitchableComponentPreviewTheme)) return '';
    return ` \u00b7 ctrl+t theme (${this.theme.variant})`;
  }

  #entryLine(entry: ComponentPreviewEntry, index: number): string {
    const marker = index === this.#activeIndex ? '\u203a' : ' ';
    const text = `${marker} ${entry.label} \u2014 ${entry.presentedLike}`;
    return index === this.#activeIndex ? this.theme.fg('success', text) : this.theme.fg('text', text);
  }

  // matchesKey, not raw-byte comparison: ProcessTerminal negotiates the kitty
  // keyboard protocol where supported (Ghostty, kitty, ...), and keys then
  // arrive as CSI-u sequences that legacy byte equality misses.
  handleInput(data: string): void {
    if (this.#busy) return;
    if (matchesKey(data, 'q') || matchesKey(data, Key.escape)) {
      this.onQuit();
      return;
    }
    if (matchesKey(data, Key.down) || matchesKey(data, 'j')) {
      this.#activeIndex = (this.#activeIndex + 1) % this.entries.length;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.up) || matchesKey(data, 'k')) {
      this.#activeIndex = (this.#activeIndex - 1 + this.entries.length) % this.entries.length;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.enter)) {
      this.#openActiveEntry();
    }
  }

  invalidate(): void {}

  #openActiveEntry(): void {
    const entry = this.entries[this.#activeIndex];
    if (!entry) return;
    this.#busy = true;
    this.tui.removeChild(this);
    this.tui.requestRender();
    void entry.open(this.tui, this.theme, this.keybindings).finally(() => {
      this.#busy = false;
      this.tui.addChild(this);
      this.tui.setFocus(this);
      this.tui.requestRender();
    });
  }
}
