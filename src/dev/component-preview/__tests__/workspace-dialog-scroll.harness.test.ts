import { TUI } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { VirtualTerminal } from '../../../.pi/__tests__/support/virtual-terminal.js';
import { WORKSPACE_DIALOG_MAX_VISIBLE_OPTIONS } from '../../../.pi/components/workspace-dialog/index.js';
import { COMPONENT_PREVIEW_REGISTRY } from '../registry.js';
import { createComponentPreviewTheme } from '../theme.js';

/**
 * Proves the `workspace-dialog-scroll` registry entry's opt-in wheelScroll
 * wiring end-to-end through the real entry (not a hand-built component) —
 * same tier as `custom-ui.test.ts`'s generic wheel-routing tests, but for
 * this specific consumer. Lives here rather than under
 * `.pi/components/__tests__/` because it depends on the dev preview
 * harness's registry, matching that directory's established dependency
 * direction (dev consumes `.pi/components/`, never the reverse) and the
 * existing `.harness.test.ts` convention for real-TUI integration tests.
 */
describe('workspace-dialog-scroll preview entry', () => {
  it('moves the selection with wheel-down exactly like arrow-down', async () => {
    const arrowViewport = await viewportAfterInputs([
      '\r',
      ...Array.from({ length: WORKSPACE_DIALOG_MAX_VISIBLE_OPTIONS }, () => '\x1B[B'),
    ]);
    const wheelViewport = await viewportAfterInputs([
      '\r',
      ...Array.from({ length: WORKSPACE_DIALOG_MAX_VISIBLE_OPTIONS }, () => '\x1b[<65;10;5M'),
    ]);

    expect(visibleSpecLines(wheelViewport)).toEqual(visibleSpecLines(arrowViewport));
    expect(visibleSpecLines(wheelViewport).join('\n')).not.toContain('Spec 0');
  });
});

async function viewportAfterInputs(inputs: readonly string[]): Promise<string[]> {
  const terminal = new VirtualTerminal(100, 32);
  const tui = new TUI(terminal);
  const entry = COMPONENT_PREVIEW_REGISTRY.find((candidate) => candidate.id === 'workspace-dialog-scroll');
  if (!entry) throw new Error('workspace-dialog-scroll preview entry is missing');

  void entry.open(tui, createComponentPreviewTheme(), undefined as never);
  tui.start();

  try {
    await terminal.waitForRender();
    for (const input of inputs) {
      terminal.sendInput(input);
      await terminal.waitForRender();
    }
    return terminal.getViewport();
  } finally {
    terminal.stop();
    tui.stop();
  }
}

function visibleSpecLines(viewport: readonly string[]): string[] {
  return viewport.filter((line) => /Spec \d+/.test(line));
}
