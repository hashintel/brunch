import type { KeybindingsManager } from '@earendil-works/pi-coding-agent';
import {
  KeybindingsManager as PiTuiKeybindingsManager,
  ProcessTerminal,
  TuiMainScreen,
  TUI_KEYBINDINGS,
  type KeybindingDefinitions,
} from '@earendil-works/pi-tui';

import { ComponentGalleryComponent } from './component-preview/gallery-component.js';
import { COMPONENT_PREVIEW_REGISTRY } from './component-preview/registry.js';
import {
  createThemePaintingTerminal,
  registerComponentPreviewThemeToggle,
  SwitchableComponentPreviewTheme,
  watchComponentPreviewTheme,
} from './component-preview/theme.js';

export interface ComponentPreviewGalleryOptions {
  /** Skip the gallery menu and open this one registry entry directly. */
  readonly entryId?: string;
}

/**
 * Real pi-tui KeybindingsManager, not a stub: `BrunchEditorComponent`'s
 * inherited `CustomEditor.handleInput` calls `.matches(...)` for app-level
 * actions (escape-to-cancel, ctrl+d-to-exit). pi-coding-agent's own
 * `KeybindingsManager` subclass is type-only from the public entry (package
 * `exports` map constraint, same as the theme-loading internals noted in
 * `theme.ts`) and its full app-action table isn't exported either, so this
 * constructs the real pi-tui base class with `TUI_KEYBINDINGS` plus the two
 * app-level actions any `CustomEditor`-based preview entry needs, and casts
 * — every previewed component only ever calls base-class methods.
 */
function createComponentPreviewKeybindings(): KeybindingsManager {
  const definitions: KeybindingDefinitions = {
    ...TUI_KEYBINDINGS,
    'app.interrupt': { defaultKeys: ['escape', 'ctrl+c'], description: 'Cancel' },
    'app.exit': { defaultKeys: 'ctrl+d', description: 'Exit' },
  } as unknown as KeybindingDefinitions;
  return new PiTuiKeybindingsManager(definitions) as unknown as KeybindingsManager;
}

/**
 * Standalone real-terminal preview loop for `.pi/components` — no workspace,
 * session, or DB. See `src/dev/TOPOLOGY.md`'s "Component Preview Harness"
 * section for the design rationale (why a bare `ProcessTerminal` + `TuiMainScreen` is
 * the right truth environment, and why entries mirror their real production
 * presentation contract instead of a uniform overlay assumption).
 */
export async function runComponentPreviewGallery(
  options: ComponentPreviewGalleryOptions = {},
): Promise<void> {
  const theme = new SwitchableComponentPreviewTheme();
  const terminal = createThemePaintingTerminal(new ProcessTerminal(), theme);
  const tui = new TuiMainScreen(terminal);
  const keybindings = createComponentPreviewKeybindings();

  if (options.entryId) {
    const entry = COMPONENT_PREVIEW_REGISTRY.find((candidate) => candidate.id === options.entryId);
    if (!entry) {
      const known = COMPONENT_PREVIEW_REGISTRY.map((candidate) => candidate.id).join(', ');
      throw new Error(`Unknown component preview id "${options.entryId}". Known ids: ${known}`);
    }
    tui.start();
    const disposeThemeToggle = registerComponentPreviewThemeToggle(tui, theme);
    const disposeThemeWatch = watchComponentPreviewTheme(tui, theme);
    try {
      await entry.open(tui, theme, keybindings);
    } finally {
      disposeThemeWatch();
      disposeThemeToggle();
      tui.stop();
    }
    return;
  }

  await new Promise<void>((resolveQuit) => {
    let disposeThemeToggle: (() => void) | undefined;
    let disposeThemeWatch: (() => void) | undefined;
    const gallery = new ComponentGalleryComponent(COMPONENT_PREVIEW_REGISTRY, theme, keybindings, tui, () => {
      disposeThemeWatch?.();
      disposeThemeToggle?.();
      tui.stop();
      resolveQuit();
    });
    tui.addChild(gallery);
    tui.setFocus(gallery);
    tui.start();
    disposeThemeToggle = registerComponentPreviewThemeToggle(tui, theme);
    disposeThemeWatch = watchComponentPreviewTheme(tui, theme);
  });
}
