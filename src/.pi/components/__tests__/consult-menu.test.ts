import { describe, expect, it } from 'vitest';

import { createTestLabTheme } from '../../__tests__/support/tui-theme.js';
import { ConsultMenuComponent } from '../consult-menu.js';
import { stripAnsi } from '../editor-lines.js';
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
      title: 'Choose how Specify mode should work',
      topLabel: '[ Specify ]',
      bottomLabel: '"Alpha"',
      choices: [
        { id: 'interrogate', label: 'Work via intent', description: 'Surface product intent.' },
        { id: 'move_to_execution', label: 'Move to execution', description: 'Switch modes.' },
      ],
      theme: recording.theme,
      onDone: () => {},
    });

    const rendered = menu.render(80);
    const text = rendered.join('\n');

    expect(rendered[0]).toContain('[ Specify ]');
    expect(rendered.at(-2)).toContain('"Alpha"');
    expect(text).toContain('Choose how Specify mode should work');
    expect(text).toContain('› 1. Work via intent');
    expect(text).toContain('Surface product intent.');
    expect(text).toContain('  2. Move to execution');
    expect(text).toContain('Switch modes.');
    expect(text).not.toContain('[ Consult ]');
    expect(recording.colors).toContain('borderAccent');
    expect(recording.colors).toContain('dim');
  });

  it('marks and initially selects the current style while explaining inert Escape', () => {
    const menu = new ConsultMenuComponent({
      title: 'Consult',
      initialSelectedId: 'disambiguate',
      choices: [
        { id: 'interrogate', label: 'Work via intent', description: 'Intent description.' },
        {
          id: 'disambiguate',
          label: 'Work via examples',
          description: 'Examples description.',
          current: true,
        },
        { id: 'propose', label: 'Work via proposals', description: 'Proposal description.' },
      ],
      theme: createTestLabTheme(),
      onDone: () => {},
    });

    const rendered = menu.render(80).join('\n');
    const plain = stripAnsi(rendered);
    expect(plain).toContain('› 2. Work via examples (current)');
    expect(plain).toContain('esc/q dismisses; give another instruction');
    expect(rendered).not.toMatch(/\bWait\b/);
  });

  it('shows a visible scroll thumb when choices overflow the consult viewport', () => {
    const menu = new ConsultMenuComponent({
      title: 'Choose a process move for Execute mode',
      topLabel: '[ Execute ]',
      choices: Array.from({ length: 12 }, (_, index) => ({
        id: `choice-${index + 1}`,
        label: `Choice ${index + 1}`,
        description: `Description ${index + 1}`,
      })),
      theme: createTestLabTheme(),
      onDone: () => {},
    });

    const rendered = menu.render(80).join('\n');

    expect(rendered).toContain('▐');
    expect(rendered).toContain('Choice 1');
    expect(rendered).not.toContain('Choice 12');
  });

  it('commits stable item ids and treats escape as an inert cancel', () => {
    const results: Array<{ readonly id: string } | undefined> = [];
    const menu = new ConsultMenuComponent({
      title: 'Consult',
      choices: [
        { id: 'prepare_execution', label: 'Prepare execution' },
        { id: 'compile_plan', label: 'Compile a plan' },
      ],
      theme: createTestLabTheme(),
      onDone: (result) => results.push(result),
    });

    menu.handleInput('j');
    menu.handleInput('\r');
    menu.handleInput('\x1b');

    expect(results).toEqual([{ id: 'compile_plan' }, undefined]);
  });
});
