import type { Theme } from '@earendil-works/pi-coding-agent';
import { type Component, truncateToWidth } from '@earendil-works/pi-tui';

import { formatBrunchProductIdentity, readBrunchAnsiLogo } from './brunch-identity.js';
import { resolveBrunchVersion } from './brunch-version.js';
import { BRUNCH_MODE_PICKER_SHORTCUT, BRUNCH_MODE_SHORTCUT } from './chrome-shortcuts.js';
import { projectRoundedBox } from './rounded-box.js';
import { supportsTruecolor } from './workspace-dialog/component.js';

export interface BrunchStartupHeaderResumeFacts {
  readonly specTitle?: string;
  readonly nodeCount?: number;
  readonly edgeCount?: number;
  readonly modeLabel?: string;
}

export interface BrunchStartupHeaderFacts {
  project: string;
  spec: string;
  session: string;
  decision?: 'continue' | 'openSession' | 'newSpec' | 'newSession';
  sidecarUrl?: string;
  /**
   * Facts sampled at boot time for the resume state/status block (F16a).
   * Rendered only when `decision === 'openSession'`.
   */
  resumeFacts?: BrunchStartupHeaderResumeFacts;
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
    return this.collapsedLines(contentWidth).map((line) =>
      line.length > 0 ? leftMargin + truncateToWidth(line, contentWidth, '...') : line,
    );
  }

  private collapsedLines(contentWidth: number): string[] {
    return [
      ...this.topPaddingLines(),
      ...this.identityLines(),
      '',
      ...this.welcomeBlockLines(contentWidth),
      ...this.resumeBlockLines(contentWidth),
      '',
      this.webOrExpandHelpLine(),
    ];
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

  private welcomeBlockLines(contentWidth: number): string[] {
    if (this.facts.decision !== 'newSpec' && this.facts.decision !== 'newSession') return [];
    const inner = [
      this.theme.bold('Welcome to Brunch.'),
      'Brunch helps you and the agent co-author this specification as a local graph.',
      'The assistant is about to open with a grounded question from the seeded workspace context.',
      `Commands: /brunch:menu opens spec/session; /brunch:mode or ${BRUNCH_MODE_PICKER_SHORTCUT} opens mode picker; ${BRUNCH_MODE_SHORTCUT} cycles mode.`,
    ];
    return projectRoundedBox(inner, { topLabel: 'welcome', labelAlign: 'left' }, contentWidth, (text) =>
      this.theme.fg('accent', text),
    );
  }

  private resumeBlockLines(contentWidth: number): string[] {
    if (this.facts.decision !== 'openSession') return [];
    const resume = this.facts.resumeFacts;
    const specLabel = resume?.specTitle ?? this.facts.spec;
    const inner = [
      this.theme.bold(`Resumed spec: ${specLabel}`),
      this.formatResumeStats(resume),
      'Use /brunch:consult to reopen orientation; /brunch:menu opens spec/session.',
    ];
    return projectRoundedBox(inner, { topLabel: 'resumed', labelAlign: 'left' }, contentWidth, (text) =>
      this.theme.fg('accent', text),
    );
  }

  private formatResumeStats(resume: BrunchStartupHeaderResumeFacts | undefined): string {
    const parts: string[] = [];
    if (resume?.modeLabel) parts.push(`mode ${resume.modeLabel}`);
    if (resume?.nodeCount !== undefined) parts.push(`${resume.nodeCount} nodes`);
    if (resume?.edgeCount !== undefined) parts.push(`${resume.edgeCount} edges`);
    return parts.length > 0 ? parts.join(' · ') : this.theme.fg('dim', 'graph facts not yet sampled');
  }

  private webOrExpandHelpLine(): string {
    if (this.facts.sidecarUrl) {
      return this.theme.fg('dim', `web-ui: ${sanitizeText(this.facts.sidecarUrl)}`);
    }
    return this.theme.fg('dim', 'Graph capture flows through Brunch commands and structured exchanges.');
  }
}

function sanitizeText(value: string): string {
  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/ +/g, ' ')
    .trim();
}
