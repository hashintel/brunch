import { visibleWidth } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { ComponentGalleryComponent } from '../component-preview/gallery-component.js';
import type { ComponentPreviewEntry } from '../component-preview/registry.js';
import { createComponentPreviewTheme } from '../component-preview/theme.js';

const ESC = '\u001b';

const LONG_ENTRY: ComponentPreviewEntry = {
  id: 'long-entry',
  label: 'a very long preview entry label that will certainly be truncated',
  presentedLike: 'overlay via ctx.ui.custom with a lengthy description',
  open: async () => {},
};

function renderGallery(width: number): string[] {
  const gallery = new ComponentGalleryComponent(
    [LONG_ENTRY],
    createComponentPreviewTheme(),
    // render() touches neither keybindings nor tui
    null as never,
    null as never,
    () => {},
  );
  return gallery.render(width);
}

describe('ComponentGalleryComponent.render', () => {
  it('truncates ANSI-colored lines without leaving a dangling escape sequence', () => {
    for (const line of renderGallery(10)) {
      // A raw .slice() cuts through ESC[38;5;NNm prefixes; a width-aware
      // truncator always terminates every escape sequence it keeps, so the
      // text after the line's last ESC must still be a complete SGR sequence.
      const lastEsc = line.lastIndexOf(ESC);
      if (lastEsc !== -1) {
        expect(line.slice(lastEsc)).toMatch(/^.\[[0-9;]*m/);
      }
      expect(visibleWidth(line)).toBeLessThanOrEqual(10);
    }
  });

  it('keeps lines within the requested visible width', () => {
    for (const line of renderGallery(24)) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(24);
    }
  });
});
