import { describe, expect, it } from 'vitest';

import { createMultiChoicePickerComponent, type MultiChoicePickerResult } from '../multi-choice-picker.js';
import type { LabTheme } from '../tui-lab/index.js';

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as unknown as LabTheme;

const CHOICES = [
  { id: 'a', label: 'Option A' },
  { id: 'b', label: 'Option B' },
  { id: 'none', label: 'None' },
];

function pickerRun(inputs: readonly string[], exclusiveChoiceIds?: readonly string[]) {
  let result: MultiChoicePickerResult | undefined;
  const component = createMultiChoicePickerComponent({
    prompt: 'Pick any that apply',
    choices: CHOICES,
    ...(exclusiveChoiceIds ? { exclusiveChoiceIds } : {}),
    theme,
    onDone: (picked) => {
      result = picked;
    },
  });
  for (const input of inputs) component.handleInput(input);
  return result;
}

describe('MultiChoicePickerComponent exclusivity', () => {
  it('allows arbitrary combinations without exclusive ids', () => {
    const result = pickerRun([' ', 'j', ' ', 'j', ' ', '\r']);

    expect(result?.choices.map((choice) => choice.id)).toEqual(['a', 'b', 'none']);
  });

  it('clears other selections when an exclusive choice is toggled on', () => {
    const result = pickerRun([' ', 'j', ' ', 'j', ' ', '\r'], ['none']);

    expect(result?.choices.map((choice) => choice.id)).toEqual(['none']);
  });

  it('clears the exclusive choice when any other choice is toggled on', () => {
    const result = pickerRun(['j', 'j', ' ', 'k', 'k', ' ', '\r'], ['none']);

    expect(result?.choices.map((choice) => choice.id)).toEqual(['a']);
  });

  it('lets an exclusive choice be toggled back off', () => {
    const result = pickerRun(['j', 'j', ' ', ' ', 'k', 'k', ' ', '\r'], ['none']);

    expect(result?.choices.map((choice) => choice.id)).toEqual(['a']);
  });
});
