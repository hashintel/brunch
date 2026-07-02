import { describe, expect, it } from 'vitest';

import { projectRequestChoice } from '../request-choice.js';

const answeredChoice = {
  id: 'opt-1',
  label: 'Keep the current shell location',
  kind: 'listed',
} as const;
const answeredOptions = [{ id: 'opt-1', content: 'Keep the current shell location' }] as const;

describe('projectRequestChoice next-tool metadata', () => {
  it('derives the capture_choice next step when answering present_question options', () => {
    const details = projectRequestChoice({
      exchangeId: 'shell-location',
      respondsToPresentTool: 'present_question',
      status: 'answered',
      choice: answeredChoice,
      options: answeredOptions,
    });

    expect(details.tool_meta).toEqual({
      prev: 'present_question',
      curr: 'request_choice',
      next: 'capture_choice',
    });
  });

  it('derives the capture_candidate next step when answering present_candidates', () => {
    const details = projectRequestChoice({
      exchangeId: 'candidate-pick',
      respondsToPresentTool: 'present_candidates',
      status: 'answered',
      choice: answeredChoice,
      options: answeredOptions,
    });

    expect(details.tool_meta).toEqual({
      prev: 'present_candidates',
      curr: 'request_choice',
      next: 'capture_candidate',
    });
  });

  it('omits the next step for non-answered outcomes', () => {
    const cancelled = projectRequestChoice({
      exchangeId: 'shell-location',
      respondsToPresentTool: 'present_question',
      status: 'cancelled',
    });

    expect(cancelled.tool_meta).toEqual({
      prev: 'present_question',
      curr: 'request_choice',
    });
  });
});
