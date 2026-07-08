import { type Component } from '@earendil-works/pi-tui';

import type { PresentCandidatesDetails } from '../../exchanges/schemas/index.js';
import { renderExchangeMarkdownBodyLines } from './exchange-markdown-body.js';
import { projectRoundedBox } from './rounded-box.js';

interface ThemeLike {
  readonly fg?: (color: never, text: string) => string;
  readonly bold?: (text: string) => string;
}

const CARD_STATUS = 'Recognition proposal';

export class ExchangeCandidatesResultComponent implements Component {
  constructor(
    private readonly details: PresentCandidatesDetails,
    private readonly theme?: ThemeLike,
  ) {}

  invalidate(): void {}

  render(width: number): string[] {
    const bodyWidth = Math.max(1, width);
    const lines = [
      ...renderMarkdownLines(this.details.display.heading, this.theme, bodyWidth),
      ...renderMarkdownLines(this.details.display.body, this.theme, bodyWidth),
    ];

    for (const [index, candidate] of this.details.candidates.entries()) {
      if (lines.length > 0) lines.push('');
      lines.push(
        ...projectRoundedBox(
          [
            `Status: ${CARD_STATUS}`,
            `Summary: ${summaryFor(candidate)}`,
            `Core bet: ${candidate.user_rubric.core_bet}`,
            `Main risks: ${candidate.user_rubric.main_risks}`,
          ].map((line) => truncatePlain(line, Math.max(1, width - 4))),
          {
            topLabel:
              this.theme?.bold?.(`${index + 1}. ${candidate.title}`) ?? `${index + 1}. ${candidate.title}`,
            labelAlign: 'left',
          },
          width,
          (text) => (this.theme?.fg ? this.theme.fg('accent' as never, text) : text),
        ),
      );
    }

    return lines;
  }
}

function summaryFor(candidate: PresentCandidatesDetails['candidates'][number]): string {
  return candidate.user_rubric.recommendation ?? candidate.user_rubric.core_bet;
}

function truncatePlain(text: string, width: number): string {
  if (text.length <= width) return text;
  if (width <= 1) return '…';
  return `${text.slice(0, width - 1)}…`;
}

function renderMarkdownLines(
  body: string | undefined,
  theme: ThemeLike | undefined,
  width: number,
): string[] {
  return renderExchangeMarkdownBodyLines(body, theme, width).map((line) => line.trimEnd());
}
