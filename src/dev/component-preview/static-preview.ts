import type { ExtensionAPI, MessageRenderer } from '@earendil-works/pi-coding-agent';
import type { Component, TUI } from '@earendil-works/pi-tui';

type MessageRendererMessage<T> = Parameters<MessageRenderer<T>>[0];

/**
 * Mount a static, non-interactive `Component` (a transcript message
 * renderer's output, or a persistent chrome region) and resolve on the next
 * keypress.
 *
 * These lanes have no `done()` callback of their own — in production a
 * message-renderer's output sits in the transcript indefinitely, and chrome
 * regions (`ui.setHeader`/`setFooter`) stay mounted for the whole session.
 * "Press any key to return to the gallery" is a preview-only affordance, not
 * a mirrored production behavior — unlike `showComponentPreview`, which
 * mirrors `ctx.ui.custom`'s real overlay/inline contract exactly.
 */
export function previewStaticComponent(tui: TUI, component: Component): Promise<void> {
  return new Promise((resolve) => {
    let closed = false;
    const wrapper: Component = {
      render: (width) => component.render(width),
      invalidate: () => component.invalidate(),
      handleInput: () => {
        if (closed) return;
        closed = true;
        tui.removeChild(wrapper);
        tui.requestRender();
        resolve();
      },
    };
    tui.addChild(wrapper);
    tui.setFocus(wrapper);
    tui.requestRender();
  });
}

/**
 * Capture a message renderer registered via `pi.registerMessageRenderer` by
 * feeding the real registration function (e.g. `registerBrunchAlternatives`)
 * a minimal fake `ExtensionAPI` slice, then return the captured renderer so
 * it can be called directly with a sample message. Mirrors how
 * `registry.test.ts` already asserts renderer registration; the harness just
 * goes one step further and renders the captured function's real output
 * instead of only asserting its `customType`.
 *
 * The fake slice only needs to satisfy each registrar's own runtime feature
 * guard (e.g. `alternatives.ts`'s `supportsAlternativesPrimitive`), so it is
 * cast rather than fully implementing `ExtensionAPI` — the same pattern
 * existing extension tests already use for fake registration recorders.
 */
export function captureMessageRenderer<T>(
  customType: string,
  register: (pi: ExtensionAPI) => void,
): MessageRenderer<T> {
  let captured: MessageRenderer<T> | undefined;
  register({
    registerMessageRenderer: (type: string, renderer: MessageRenderer<unknown>) => {
      if (type === customType) captured = renderer as MessageRenderer<T>;
    },
    registerTool: () => {},
    sendMessage: () => {},
  } as unknown as ExtensionAPI);
  if (!captured) {
    throw new Error(`registerMessageRenderer never registered customType "${customType}"`);
  }
  return captured;
}

/** Build a minimal sample message for feeding a captured renderer a payload. */
export function sampleCustomMessage<T>(customType: string, details: T): MessageRendererMessage<T> {
  return {
    role: 'custom',
    customType,
    content: '',
    display: true,
    details,
    timestamp: Date.now(),
  } as MessageRendererMessage<T>;
}
