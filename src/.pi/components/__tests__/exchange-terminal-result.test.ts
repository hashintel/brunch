import { visibleWidth } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { ExchangeTerminalResultComponent } from '../exchange-terminal-result.js';

const theme = {
  fg: (color: string, text: string) => `<${color}>${text}</${color}>`,
  bold: (text: string) => `**${text}**`,
};

describe('ExchangeTerminalResultComponent', () => {
  it('renders pairwise-distinct compact terminal rails while retaining the markdown body', () => {
    const statuses = ['answered', 'cancelled', 'unavailable'] as const;
    const rendered = statuses.map((status) =>
      new ExchangeTerminalResultComponent({ status, body: '**Canonical body**', theme })
        .render(32)
        .join('\n'),
    );

    expect(new Set(rendered).size).toBe(statuses.length);
    expect(rendered[0]).toContain('Answered');
    expect(rendered[1]).toContain('Cancelled');
    expect(rendered[2]).toContain('Unavailable');
    for (const output of rendered) expect(output).toContain('Canonical body');
  });

  it('bounds the rail and markdown body to the available width', () => {
    const lines = new ExchangeTerminalResultComponent({
      status: 'answered',
      body: 'A canonical body that must wrap at narrow widths.',
      theme,
    }).render(18);

    expect(lines.every((line) => visibleWidth(line) <= 18)).toBe(true);
  });
});
