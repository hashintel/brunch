import { describe, expect, it } from 'vitest';

import { createTestLabTheme } from '../../__tests__/support/tui-theme.js';
import { projectMenuShell } from '../menu-shell.js';

describe('projectMenuShell', () => {
  it('gives navigation menus one blue surface-identity border', () => {
    const colors: string[] = [];
    const theme = {
      ...createTestLabTheme(),
      fg: (color: string, text: string) => {
        colors.push(color);
        return text;
      },
    } as never;

    const lines = projectMenuShell(['Choose a specification'], 60, theme);

    expect(lines.join('\n')).toContain('Choose a specification');
    expect(colors).toContain('borderAccent');
  });
});
