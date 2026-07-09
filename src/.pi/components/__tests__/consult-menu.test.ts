import { describe, expect, it } from 'vitest';

import { createTestLabTheme } from '../../__tests__/support/tui-theme.js';
import { ConsultMenuComponent } from '../consult-menu.js';
import type { LabTheme } from '../tui-lab/index.js';

function createRecordingTheme() {
  const colors: string[] = [];
  const theme = {
    fg: (color: string, text: string) => {
      colors.push(color);
      return text;
    },
    bold: (text: string) => text,
    getFgAnsi: () => '',
  } as unknown as LabTheme;
  return { colors, theme };
}

describe('ConsultMenuComponent', () => {
  it('renders a bordered two-line consult menu with a surface-identity border role', () => {
    const recording = createRecordingTheme();
    const menu = new ConsultMenuComponent({
      title: 'How should this session continue?',
      choices: [
        { id: 'continue', label: 'Continue', description: 'Wait for my next instruction.' },
        { id: 'propose_oracle', label: 'Design verification', description: 'Project the oracle path.' },
      ],
      theme: recording.theme,
      onDone: () => {},
    });

    const rendered = menu.render(80);
    const text = rendered.join('\n');

    expect(rendered[0]).toContain('[ Consult ]');
    expect(text).toContain('How should this session continue?');
    expect(text).toContain('› 1. Continue');
    expect(text).toContain('Wait for my next instruction.');
    expect(text).toContain('  2. Design verification');
    expect(text).toContain('Project the oracle path.');
    expect(recording.colors).toContain('borderAccent');
    expect(recording.colors).toContain('dim');
  });

  it('commits stable item ids and treats escape as an inert cancel', () => {
    const results: Array<{ readonly id: string } | undefined> = [];
    const menu = new ConsultMenuComponent({
      title: 'Consult',
      choices: [
        { id: 'continue', label: 'Continue' },
        { id: 'propose_oracle', label: 'Design verification' },
      ],
      theme: createTestLabTheme(),
      onDone: (result) => results.push(result),
    });

    menu.handleInput('j');
    menu.handleInput('\r');
    menu.handleInput('\x1b');

    expect(results).toEqual([{ id: 'propose_oracle' }, undefined]);
  });
});
