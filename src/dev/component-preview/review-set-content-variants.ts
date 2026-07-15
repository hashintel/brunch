import type { Theme } from '@earendil-works/pi-coding-agent';
import { type Component, Key, matchesKey, type TUI } from '@earendil-works/pi-tui';

import { ExchangeReviewSetResultComponent } from '../../.pi/components/exchange-review-set-result.js';
import type { PresentReviewSetDetails } from '../../exchanges/schemas/index.js';
import { presentReviewSetFixture } from './exchange-fixtures.js';

export interface ReviewSetContentVariant {
  readonly id: string;
  readonly label: string;
  readonly details: PresentReviewSetDetails;
}

const SHORT = ['Launch safely.', 'Rollback required.', 'Observe rollback.'];
const LONG = [
  'Launch only after every operator can identify the rollback trigger, execute the recovery path, and verify restored service without relying on undocumented context.',
  'Rollback must remain available throughout deployment and preserve enough diagnostic evidence to explain both the original failure and the recovery decision.',
  'Observe the complete rollback path with signals that distinguish a successful recovery from a deployment that merely stopped producing visible errors.',
];

function withContent(
  id: string,
  label: string,
  contentAt: (index: number) => string,
): ReviewSetContentVariant {
  const details = presentReviewSetFixture.projection.details;
  return {
    id,
    label,
    details: {
      ...details,
      review_set: {
        ...details.review_set,
        nodes: details.review_set.nodes.map((node, index) => ({ ...node, title: contentAt(index) })),
      },
    },
  };
}

const baseDetails = presentReviewSetFixture.projection.details;

export const REVIEW_SET_CONTENT_VARIANTS: readonly ReviewSetContentVariant[] = [
  withContent('all-short', 'All short', (index) => SHORT[index] ?? 'Short entry.'),
  withContent('all-long', 'All long', (index) => LONG[index] ?? LONG[0]!),
  withContent('alternating-long-short', 'Alternating long / short', (index) =>
    index % 2 === 0 ? (LONG[index] ?? LONG[0]!) : (SHORT[index] ?? 'Short entry.'),
  ),
  withContent('one-long-outlier', 'One long outlier', (index) =>
    index === 1 ? LONG[1]! : (SHORT[index] ?? 'Short entry.'),
  ),
  {
    id: 'term-heavy',
    label: 'Term heavy',
    details: {
      ...baseDetails,
      review_set: {
        ...baseDetails.review_set,
        nodes: baseDetails.review_set.nodes.map((node, index) => ({
          ...node,
          kind: 'term',
          detail: {
            definition: index % 2 === 0 ? (LONG[index] ?? LONG[0]!) : (SHORT[index] ?? 'Short term.'),
          },
        })),
      },
    },
  },
  {
    id: 'connection-heavy',
    label: 'Connection heavy',
    details: {
      ...baseDetails,
      review_set: {
        ...baseDetails.review_set,
        edges: [
          ...baseDetails.review_set.edges,
          ...Array.from({ length: 8 }, (_, index) => ({
            category: 'cross_reference' as const,
            a: {
              draft_id: baseDetails.review_set.nodes[index % baseDetails.review_set.nodes.length]!.draft_id,
            },
            b: { existing_code: `EXT${index + 1}` },
          })),
        ],
      },
    },
  },
];

interface RenderRequester {
  requestRender(): void;
}

/**
 * Width is the real TUI render width. This preview seam has no viewport-height
 * input, so cycling preserves every ledger line rather than pretending to test
 * clipping or scrolling behavior it cannot control.
 */
export class ReviewSetContentVariantGallery implements Component {
  #activeIndex: number;

  constructor(
    private readonly theme: Theme,
    private readonly tui: RenderRequester,
    initialIndex = 0,
    private readonly onDone?: () => void,
  ) {
    this.#activeIndex =
      ((initialIndex % REVIEW_SET_CONTENT_VARIANTS.length) + REVIEW_SET_CONTENT_VARIANTS.length) %
      REVIEW_SET_CONTENT_VARIANTS.length;
  }

  render(width: number): string[] {
    const variant = REVIEW_SET_CONTENT_VARIANTS[this.#activeIndex]!;
    const ledger = new ExchangeReviewSetResultComponent(variant.details, this.theme);
    return [
      this.theme.fg(
        'accent',
        `Impact Ledger content variant: ${variant.label} (${this.#activeIndex + 1}/${REVIEW_SET_CONTENT_VARIANTS.length})`,
      ),
      this.theme.fg('dim', `reproduce: ${variant.id} · ↑/↓ or j/k previous/next · q returns`),
      '',
      ...ledger.render(width),
    ];
  }

  handleInput(data: string): void {
    if (matchesKey(data, 'q') || matchesKey(data, Key.escape)) {
      this.onDone?.();
      return;
    }
    if (matchesKey(data, Key.down) || matchesKey(data, 'j')) {
      this.#activeIndex = (this.#activeIndex + 1) % REVIEW_SET_CONTENT_VARIANTS.length;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.up) || matchesKey(data, 'k')) {
      this.#activeIndex =
        (this.#activeIndex - 1 + REVIEW_SET_CONTENT_VARIANTS.length) % REVIEW_SET_CONTENT_VARIANTS.length;
      this.tui.requestRender();
    }
  }

  invalidate(): void {}
}

export function previewReviewSetContentVariants(tui: TUI, theme: Theme): Promise<void> {
  return new Promise((resolve) => {
    const component = new ReviewSetContentVariantGallery(theme, tui, 0, () => {
      tui.removeChild(component);
      tui.requestRender();
      resolve();
    });
    tui.addChild(component);
    tui.setFocus(component);
    tui.requestRender();
  });
}
