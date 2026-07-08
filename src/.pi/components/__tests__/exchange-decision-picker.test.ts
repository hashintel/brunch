import { describe, expect, it } from 'vitest';

import { ExchangeDecisionPickerComponent } from '../exchange-decision-picker.js';
import { MultiChoicePickerComponent } from '../multi-choice-picker.js';
import type { LabTheme } from '../tui-lab/index.js';

const theme: LabTheme = {
  fg: (_color, text) => text,
  bold: (text) => text,
  getFgAnsi: () => '',
};

function createRecordingTheme() {
  const colors: string[] = [];
  const recordingTheme = {
    fg: (color: string, text: string) => {
      colors.push(color);
      return `\u001b[31m${text}\u001b[0m`;
    },
    bold: (text: string) => text,
    getFgAnsi: () => '',
  } as unknown as LabTheme;
  return { colors, theme: recordingTheme };
}

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

  it('renders an optional themed markdown body inside the box above the scrollable choices', () => {
    const recording = createRecordingTheme();
    const picker = new ExchangeDecisionPickerComponent({
      prompt: 'Pick the next move',
      body: '# Why this matters\n\n> Read the local evidence.\n\n- Keep scope tight',
      choices: Array.from({ length: 12 }, (_, index) => ({
        id: `option-${index}`,
        label: `Option ${index}`,
      })),
      topLabel: '[ Specify ]',
      bottomLabel: '"Alpha"',
      theme: recording.theme,
      onDone: () => {},
    });

    const rendered = picker.render(80);
    const text = rendered.join('\n');

    expect(rendered[0]).toContain('[ Specify ]');
    expect(rendered.at(-2)).toContain('"Alpha"');
    expect(recording.colors).toContain('mdHeading');
    expect(recording.colors).toContain('mdQuote');
    expect(recording.colors).toContain('mdListBullet');
    expect(text.indexOf('Keep scope tight')).toBeLessThan(text.indexOf('Option 0'));
    expect(text.indexOf('Option 7')).toBeGreaterThan(-1);
    expect(text).not.toContain('Option 8');
    expect(text.trimEnd()).toContain('↑/↓ or j/k move · enter commits · esc/q cancels');
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

  it('renders choice descriptions as dim second lines without blank rows for choices without descriptions', () => {
    const recording = createRecordingTheme();
    const picker = new ExchangeDecisionPickerComponent({
      prompt: 'Pick the next move',
      choices: [
        { id: 'local', label: 'Local workbench', description: 'Keeps the proof close to fixtures.' },
        { id: 'relay', label: 'Agent relay' },
      ],
      theme: recording.theme,
      onDone: () => {},
    });

    const rendered = picker.render(80).join('\n');

    expect(rendered).toContain('Local workbench');
    expect(rendered).toContain('Keeps the proof close to fixtures.');
    expect(renderingLine(rendered, 'Keeps the proof close to fixtures.')).toContain('    ');
    expect(recording.colors).toContain('dim');
    expect(rendered).toContain('  2. Agent relay');
    expect(rendered).not.toContain('Agent relay\n│');
  });

  it('pages long two-line choice lists by rendered rows while keeping the active choice visible', () => {
    const picker = new ExchangeDecisionPickerComponent({
      prompt: 'Pick the next move',
      choices: Array.from({ length: 12 }, (_, index) => ({
        id: `option-${index}`,
        label: `Option ${index}`,
        description: `Description ${index}`,
      })),
      theme,
      onDone: () => {},
    });

    for (let step = 0; step < 9; step += 1) picker.handleInput('j');
    const rendered = picker.render(80).join('\n');

    expect(rendered).toContain('Option 9');
    expect(rendered).toContain('Description 9');
    expect(rendered).not.toContain('Option 0');
    expect(rendered).toContain('▐');
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
  it('renders the shared optional markdown body and border labels inside the same rounded-border shell', () => {
    const recording = createRecordingTheme();
    const picker = new MultiChoicePickerComponent({
      prompt: 'Pick priorities',
      body: '## Review\n\n> Choose every true statement.\n\n- Multiple answers allowed',
      choices: [
        { id: 'speed', label: 'Move quickly' },
        { id: 'safety', label: 'Keep the transcript safe' },
      ],
      topLabel: '[ Ask ]',
      bottomLabel: '"Beta"',
      theme: recording.theme,
      onDone: () => {},
    });

    const rendered = picker.render(52);
    const text = rendered.join('\n');

    expect(rendered[0]).toContain('[ Ask ]');
    expect(rendered.at(-2)).toContain('"Beta"');
    expect(recording.colors).toContain('mdHeading');
    expect(recording.colors).toContain('mdQuote');
    expect(recording.colors).toContain('mdListBullet');
    expect(text.indexOf('Multiple answers allowed')).toBeLessThan(text.indexOf('Move quickly'));
  });

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

  it('renders choice descriptions below labels with checkbox column preserved', () => {
    const recording = createRecordingTheme();
    const picker = new MultiChoicePickerComponent({
      prompt: 'Pick priorities',
      choices: [
        { id: 'speed', label: 'Move quickly', description: 'Useful when the path is already settled.' },
        { id: 'safety', label: 'Keep the transcript safe' },
      ],
      theme: recording.theme,
      onDone: () => {},
    });

    const rendered = picker.render(80).join('\n');
    const description = renderingLine(rendered, 'Useful when the path is already settled.');

    expect(rendered).toContain('Move quickly');
    expect(description).toContain('    Useful when the path is already settled.');
    expect(recording.colors).toContain('dim');
    expect(rendered).toContain('Keep the transcript safe');
  });

  it('pages long two-line checkbox lists by rendered rows while keeping the active choice visible', () => {
    const picker = new MultiChoicePickerComponent({
      prompt: 'Pick priorities',
      choices: Array.from({ length: 12 }, (_, index) => ({
        id: `option-${index}`,
        label: `Option ${index}`,
        description: `Description ${index}`,
      })),
      theme,
      onDone: () => {},
    });

    for (let step = 0; step < 9; step += 1) picker.handleInput('j');
    const rendered = picker.render(80).join('\n');

    expect(rendered).toContain('Option 9');
    expect(rendered).toContain('Description 9');
    expect(rendered).not.toContain('Option 0');
    expect(rendered).toContain('▐');
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

function renderingLine(rendered: string, needle: string): string {
  const line = rendered.split('\n').find((candidate) => candidate.includes(needle));
  if (!line) throw new Error(`Unable to find rendered line containing ${needle}`);
  return line;
}
