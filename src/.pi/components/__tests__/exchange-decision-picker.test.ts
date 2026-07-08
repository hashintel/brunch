import { describe, expect, it } from 'vitest';

import { ExchangeDecisionPickerComponent } from '../exchange-decision-picker.js';
import { MultiChoicePickerComponent } from '../multi-choice-picker.js';
import type { LabTheme } from '../tui-lab/index.js';

const theme: LabTheme = {
  fg: (_color, text) => text,
  bold: (text) => text,
  getFgAnsi: () => '',
};

describe('ExchangeDecisionPickerComponent', () => {
  it('renders bordered prompt, numbered choices, active marker, help text, and scroll thumb', () => {
    const picker = new ExchangeDecisionPickerComponent({
      prompt: 'Pick the next move',
      choices: Array.from({ length: 12 }, (_, index) => ({
        id: `option-${index}`,
        label: `Option ${index}`,
      })),
      theme,
      onDone: () => {},
    });

    const rendered = picker.render(80);
    const text = rendered.join('\n');

    expect(rendered[0]).toContain('╭');
    expect(rendered.at(-2)).toContain('╯');
    expect(text).toContain('Pick the next move');
    expect(text).toContain('› 1. Option 0');
    expect(text).toContain('  2. Option 1');
    expect(text).toContain('↑/↓ or j/k move · enter commits · esc/q cancels');
    expect(text).toContain('▐');
  });

  it('commits and cancels stable choice ids', () => {
    const results: Array<{ readonly id: string } | undefined> = [];
    const picker = new ExchangeDecisionPickerComponent({
      prompt: 'Pick one',
      choices: [
        { id: 'first-id', label: 'Duplicate' },
        { id: 'second-id', label: 'Duplicate' },
      ],
      theme,
      onDone: (result) => results.push(result),
    });

    picker.handleInput('\x1b[B');
    picker.handleInput('\r');
    picker.handleInput('q');

    expect(results).toEqual([{ id: 'second-id' }, undefined]);
  });

  it('navigates and commits under kitty keyboard-protocol encodings (Ghostty regression)', () => {
    const results: Array<{ readonly id: string } | undefined> = [];
    const picker = new ExchangeDecisionPickerComponent({
      prompt: 'Pick one',
      choices: [
        { id: 'first-id', label: 'First' },
        { id: 'second-id', label: 'Second' },
      ],
      theme,
      onDone: (result) => results.push(result),
    });

    // Kitty "report event types" press encodings: down arrow, enter, escape.
    picker.handleInput('\x1b[1;1:1B');
    picker.handleInput('\x1b[13;1:1u');
    picker.handleInput('\x1b[27;1:1u');

    expect(results).toEqual([{ id: 'second-id' }, undefined]);
  });
});

describe('MultiChoicePickerComponent bordered treatment', () => {
  it('renders inside the same rounded-border shell while preserving toggle and commit behavior', () => {
    const results: unknown[] = [];
    const picker = new MultiChoicePickerComponent({
      prompt: 'Pick priorities',
      choices: [
        { id: 'speed', label: 'Move quickly' },
        { id: 'safety', label: 'Keep the transcript safe' },
      ],
      theme,
      onDone: (result) => results.push(result),
    });

    const text = picker.render(44).join('\n');
    expect(text).toContain('╭');
    expect(text).toContain('Pick priorities');
    expect(text).toContain('[ ] Move quickly');

    picker.handleInput(' ');
    picker.handleInput('\r');

    expect(results).toEqual([{ choices: [{ id: 'speed', label: 'Move quickly' }] }]);
  });

  it('toggles and commits under kitty keyboard-protocol encodings (Ghostty regression)', () => {
    const results: unknown[] = [];
    const picker = new MultiChoicePickerComponent({
      prompt: 'Pick priorities',
      choices: [
        { id: 'speed', label: 'Move quickly' },
        { id: 'safety', label: 'Keep the transcript safe' },
      ],
      theme,
      onDone: (result) => results.push(result),
    });

    // Kitty press encodings: down arrow, space, enter.
    picker.handleInput('\x1b[1;1:1B');
    picker.handleInput('\x1b[32;1:1u');
    picker.handleInput('\x1b[13;1:1u');

    expect(results).toEqual([{ choices: [{ id: 'safety', label: 'Keep the transcript safe' }] }]);
  });
});
