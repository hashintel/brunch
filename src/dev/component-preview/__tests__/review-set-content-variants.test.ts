import { describe, expect, it, vi } from 'vitest';

import {
  REVIEW_SET_CONTENT_VARIANTS,
  ReviewSetContentVariantGallery,
} from '../review-set-content-variants.js';
import { createComponentPreviewTheme } from '../theme.js';

const EXPECTED_VARIANTS = [
  'all-short',
  'all-long',
  'alternating-long-short',
  'one-long-outlier',
  'term-heavy',
  'connection-heavy',
];

describe('ReviewSetContentVariantGallery', () => {
  it('renders every deterministic named variant through the gallery without throwing', () => {
    expect(REVIEW_SET_CONTENT_VARIANTS.map((variant) => variant.id)).toEqual(EXPECTED_VARIANTS);

    for (const [index, variant] of REVIEW_SET_CONTENT_VARIANTS.entries()) {
      const gallery = new ReviewSetContentVariantGallery(
        createComponentPreviewTheme(),
        { requestRender: vi.fn() },
        index,
      );
      const output = gallery.render(52).join('\n');
      expect(output).toContain(`${variant.label} (${index + 1}/${REVIEW_SET_CONTENT_VARIANTS.length})`);
      expect(output).toContain('G2');
    }
  });

  it('cycles reproducibly with the component gallery up/down and j/k conventions', () => {
    const requestRender = vi.fn();
    const gallery = new ReviewSetContentVariantGallery(createComponentPreviewTheme(), { requestRender });

    expect(gallery.render(80).join('\n')).toContain('All short (1/6)');
    gallery.handleInput('\x1b[B');
    expect(gallery.render(80).join('\n')).toContain('All long (2/6)');
    gallery.handleInput('k');
    expect(gallery.render(80).join('\n')).toContain('All short (1/6)');
    gallery.handleInput('\x1b[A');
    expect(gallery.render(80).join('\n')).toContain('Connection heavy (6/6)');
    expect(requestRender).toHaveBeenCalledTimes(3);
  });
});
