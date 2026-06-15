import type { Theme } from '@earendil-works/pi-coding-agent';
import { type Component, truncateToWidth } from '@earendil-works/pi-tui';

import { formatBrunchProductIdentity, readBrunchAnsiLogo } from './brunch-identity.js';
import { resolveBrunchVersion } from './brunch-version.js';
import { supportsTruecolor } from './workspace-dialog/component.js';

export interface BrunchStartupHeaderFacts {
  project: string;
  spec: string;
  session: string;
  sidecarUrl?: string;
}

const HEADER_TOP_PADDING_LINES = 6;
/**
 * Lateral padding in columns, matching Pi's standard `Text` component default
 * (`paddingX = 1`) used for transcript content and Pi's built-in header.
 */
const HEADER_PADDING_X = 1;
const MIN_WIDTH = 20;
const ASSET_DIR = new URL('./workspace-dialog/assets/', import.meta.url);

export class BrunchStartupHeader implements Component {
  constructor(
    private readonly facts: BrunchStartupHeaderFacts,
    private readonly theme: Pick<Theme, 'fg' | 'bold'>,
  ) {}

  invalidate(): void {}

  render(width: number): string[] {
    const safeWidth = Math.max(MIN_WIDTH, width);
    const contentWidth = safeWidth - HEADER_PADDING_X * 2;
    const leftMargin = ' '.repeat(HEADER_PADDING_X);
    return this.collapsedLines().map((line) =>
      line.length > 0 ? leftMargin + truncateToWidth(line, contentWidth, '...') : line,
    );
  }

  private collapsedLines(): string[] {
    return [...this.topPaddingLines(), ...this.identityLines(), '', this.webOrExpandHelpLine()];
  }

  private topPaddingLines(): string[] {
    return Array.from({ length: HEADER_TOP_PADDING_LINES }, () => '');
  }

  private identityLines(): string[] {
    return formatBrunchProductIdentity({
      logoLines: readBrunchAnsiLogo({ assetUrl: ASSET_DIR, truecolor: supportsTruecolor() }),
      version: resolveBrunchVersion(),
      theme: this.theme,
    });
  }

  private webOrExpandHelpLine(): string {
    if (this.facts.sidecarUrl) {
      return this.theme.fg('dim', `web-ui: ${sanitizeText(this.facts.sidecarUrl)}`);
    }
    return this.theme.fg(
      'dim',
      'Graph capture flows through Brunch commands; runtime posture follows mode/strategy/lens.',
    );
  }
}

function sanitizeText(value: string): string {
  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/ +/g, ' ')
    .trim();
}
