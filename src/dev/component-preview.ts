import type { KeybindingsManager } from '@earendil-works/pi-coding-agent';
import { ProcessTerminal, TUI } from '@earendil-works/pi-tui';

import { ComponentGalleryComponent } from './component-preview/gallery-component.js';
import { COMPONENT_PREVIEW_REGISTRY } from './component-preview/registry.js';
import { createComponentPreviewTheme } from './component-preview/theme.js';

export interface ComponentPreviewGalleryOptions {
  /** Skip the gallery menu and open this one registry entry directly. */
  readonly entryId?: string;
}

/**
 * Standalone real-terminal preview loop for `.pi/components` — no workspace,
 * session, or DB. See `memory/cards/tooling--component-preview-harness.md`
 * for the design rationale (why a bare `ProcessTerminal` + `TUI` is the right
 * truth environment, and why entries mirror their real production
 * presentation contract instead of a uniform overlay assumption).
 */
export async function runComponentPreviewGallery(
  options: ComponentPreviewGalleryOptions = {},
): Promise<void> {
  const terminal = new ProcessTerminal();
  const tui = new TUI(terminal);
  const theme = createComponentPreviewTheme();
  // ceiling: no previewed component reads keybindings yet; stub until one does.
  const keybindings = undefined as unknown as KeybindingsManager;

  if (options.entryId) {
    const entry = COMPONENT_PREVIEW_REGISTRY.find((candidate) => candidate.id === options.entryId);
    if (!entry) {
      const known = COMPONENT_PREVIEW_REGISTRY.map((candidate) => candidate.id).join(', ');
      throw new Error(`Unknown component preview id "${options.entryId}". Known ids: ${known}`);
    }
    tui.start();
    await entry.open(tui, theme, keybindings);
    tui.stop();
    return;
  }

  await new Promise<void>((resolveQuit) => {
    const gallery = new ComponentGalleryComponent(COMPONENT_PREVIEW_REGISTRY, theme, keybindings, tui, () => {
      tui.stop();
      resolveQuit();
    });
    tui.addChild(gallery);
    tui.setFocus(gallery);
    tui.start();
  });
}
