import { Markdown, type Component, truncateToWidth } from '@earendil-works/pi-tui';

import { createStructuredExchangeMarkdownTheme } from './exchange-markdown-body.js';

export type ExchangeTerminalStatus = 'answered' | 'cancelled' | 'unavailable' | 'input_rejected';

interface ThemeLike {
  fg?: (color: never, text: string) => string;
  bold?: (text: string) => string;
}

interface ExchangeTerminalResultOptions {
  readonly status: ExchangeTerminalStatus;
  readonly body: string;
  readonly theme?: ThemeLike;
  readonly tool?: string;
}

const STATUS_PRESENTATION = {
  answered: { label: 'Answered', color: 'success' },
  cancelled: { label: 'Cancelled', color: 'muted' },
  unavailable: { label: 'Unavailable', color: 'warning' },
  input_rejected: { label: 'Input rejected', color: 'error' },
} as const;

/** Pi-only presentation wrapper around formatter-owned structured-exchange Markdown. */
export class ExchangeTerminalResultComponent implements Component {
  constructor(private readonly options: ExchangeTerminalResultOptions) {}

  render(width: number): string[] {
    const availableWidth = Math.max(1, width);
    const presentation = STATUS_PRESENTATION[this.options.status];
    const retry =
      this.options.status === 'input_rejected' ? ` · ${this.options.tool ?? 'tool'} · Agent can retry` : '';
    const label = this.options.theme?.bold ? this.options.theme.bold(presentation.label) : presentation.label;
    const railText = `┃ ${label}${retry}`;
    const rail = this.options.theme?.fg
      ? this.options.theme.fg(presentation.color as never, railText)
      : railText;
    const body = new Markdown(
      this.options.body,
      0,
      0,
      createStructuredExchangeMarkdownTheme(this.options.theme),
    ).render(availableWidth);
    return [truncateToWidth(rail, availableWidth), ...body];
  }

  invalidate(): void {}
}
