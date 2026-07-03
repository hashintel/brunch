import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import type { Component, OverlayHandle, OverlayOptions, TUI } from '@earendil-works/pi-tui';

import { parseWheelEvent } from '../../.pi/components/mouse-wheel.js';

export interface ComponentPreviewCustomOptions {
  readonly overlay?: boolean;
  readonly overlayOptions?: OverlayOptions | (() => OverlayOptions);
  readonly wheelScroll?: boolean;
}

export type ComponentPreviewFactory<T> = (
  tui: TUI,
  theme: Theme,
  keybindings: KeybindingsManager,
  done: (result?: T) => void,
) => Component;

const ENABLE_SGR_MOUSE = '\x1b[?1000h\x1b[?1006h';
const DISABLE_SGR_MOUSE = '\x1b[?1006l\x1b[?1000l';
const ARROW_UP = '\x1b[A';
const ARROW_DOWN = '\x1b[B';

/**
 * Mirrors the real `ExtensionUIContext.custom` calling contract — the shape
 * every `.pi/extensions/*` registration uses, driven in production by
 * `showExtensionCustom` inside pi-coding-agent's interactive mode — closely
 * enough that a previewed component opens exactly the way its real call site
 * opens it: a true `tui.showOverlay` when `{ overlay: true, overlayOptions }`
 * is given (workspace-dialog's shape), or an inline swap of the gallery's
 * current root content when it is not (axis-picker's and multi-choice-picker's
 * shape). This reimplements the *documented public calling shape*
 * (`ExtensionUIContext.custom`'s exported type) only — not private
 * interactive-mode internals, which the installed package's `exports` map
 * does not expose outside a running session.
 *
 * Because `tui` is the same live `TUI` instance handed to `factory`, a
 * previewed component that itself calls `tui.showOverlay(...)` (a nested
 * overlay or confirm dialog) stacks correctly regardless of whether this
 * `custom()` call opened it as an overlay or an inline swap — overlay
 * stacking is a `pi-tui` `TUI` primitive, independent of this wrapper.
 */
export function showComponentPreview<T>(
  tui: TUI,
  theme: Theme,
  keybindings: KeybindingsManager,
  factory: ComponentPreviewFactory<T>,
  options?: ComponentPreviewCustomOptions,
): Promise<T | undefined> {
  const isOverlay = options?.overlay ?? false;
  return new Promise((resolve) => {
    let closed = false;
    let overlayHandle: OverlayHandle | undefined;
    let component: Component;
    let removeWheelListener: (() => void) | undefined;
    const close = (result?: T) => {
      if (closed) return;
      closed = true;
      removeWheelListener?.();
      if (options?.wheelScroll) tui.terminal.write(DISABLE_SGR_MOUSE);
      if (isOverlay) overlayHandle?.hide();
      else tui.removeChild(component);
      tui.requestRender();
      resolve(result);
    };
    component = factory(tui, theme, keybindings, close);
    if (options?.wheelScroll) {
      tui.terminal.write(ENABLE_SGR_MOUSE);
      removeWheelListener = tui.addInputListener((data) => {
        const wheel = parseWheelEvent(data);
        if (!wheel) return undefined;
        return { data: wheel === 'up' ? ARROW_UP : ARROW_DOWN };
      });
    }
    if (isOverlay) {
      const resolvedOverlayOptions =
        typeof options?.overlayOptions === 'function' ? options.overlayOptions() : options?.overlayOptions;
      overlayHandle = tui.showOverlay(component, resolvedOverlayOptions);
    } else {
      tui.addChild(component);
      tui.setFocus(component);
      tui.requestRender();
    }
  });
}
