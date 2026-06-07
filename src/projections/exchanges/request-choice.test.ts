import { describe, expect, it } from 'vitest';

import { projectRequestChoice } from './request-choice.js';

const answeredChoice = {
  id: 'opt-1',
  label: 'Keep the current shell location',
  kind: 'listed',
} as const;

describe('projectRequestChoice next-tool metadata', () => {
  it('derives the capture_choice next step when answering present_options', () => {
    const details = projectRequestChoice({
      exchangeId: 'shell-location',
      respondsToPresentTool: 'present_options',
      status: 'answered',
      choice: answeredChoice,
    });

    expect(details.tool_meta).toEqual({
      prev: 'present_options',
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
      respondsToPresentTool: 'present_options',
      status: 'cancelled',
    });

    expect(cancelled.tool_meta).toEqual({
      prev: 'present_options',
      curr: 'request_choice',
    });
  });
});
