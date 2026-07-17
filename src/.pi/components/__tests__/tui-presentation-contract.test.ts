import { readFileSync } from 'node:fs';

import { visibleWidth } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { BRUNCH_COMPACT_WORDMARK, formatBrunchProductIdentity } from '../brunch-identity.js';
import { BrunchStartupHeader } from '../chrome-header.js';
import { BrunchWelcomeCard } from '../welcome-card.js';

const taggedTheme = {
  fg: (role: string, text: string) => `<${role}>${text}</${role}>`,
  bold: (text: string) => `<bold>${text}</bold>`,
};

describe('live TUI presentation contract', () => {
  it('renders Welcome through a one-column transparent Box and dims command/control notes', () => {
    const lines = new BrunchWelcomeCard(taggedTheme as never).render(120);

    expect(lines.every((line) => line.startsWith(' '))).toBe(true);
    expect(lines[0]).toContain('<bold>Welcome to Brunch.</bold>');
    expect(lines.slice(2).every((line) => line.includes('<dim>'))).toBe(true);
  });

  it('composes Welcome at the startup header render width with exactly one lateral column', () => {
    const width = 44;
    const lines = new BrunchStartupHeader(
      {
        project: 'Project',
        spec: 'Spec',
        session: 'Session',
        decision: 'newSession',
      },
      { fg: (_role: string, text: string) => text, bold: (text: string) => text } as never,
    ).render(width);
    const welcomeIndex = lines.findIndex((line) => line.includes('Welcome to Brunch.'));

    expect(welcomeIndex).toBeGreaterThan(0);
    expect(lines[welcomeIndex]?.trimEnd()).toBe(' Welcome to Brunch.');
    expect(lines[welcomeIndex]?.startsWith('  ')).toBe(false);
    expect(lines.slice(welcomeIndex).length).toBeGreaterThan(6);
    expect(lines.every((line) => visibleWidth(line) <= width)).toBe(true);
  });

  it('uses terminal-default text for the compact BRUNCH wordmark', () => {
    const lines = formatBrunchProductIdentity({
      logoLines: [],
      version: { version: '1.0.0', dev: null },
      theme: taggedTheme as never,
      piVersion: '0.80.7',
    });

    expect(lines.slice(0, BRUNCH_COMPACT_WORDMARK.length).every((line) => line.startsWith('<text>'))).toBe(
      true,
    );
    expect(lines.join('\n')).not.toContain('<muted>');
  });

  it('maps Pi collapsed thinking text to the dim role in both sealed themes', () => {
    for (const name of ['brunch-dark', 'brunch-light']) {
      const theme = JSON.parse(
        readFileSync(new URL(`../../themes/${name}.json`, import.meta.url), 'utf8'),
      ) as { colors: { dim: unknown; thinkingText: unknown } };
      expect(theme.colors.thinkingText).toEqual(theme.colors.dim);
    }
  });
});
