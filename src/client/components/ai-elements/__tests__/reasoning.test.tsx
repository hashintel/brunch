// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Reasoning, ReasoningContent, ReasoningTrigger } from '../reasoning.js';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('Reasoning', () => {
  it('auto-opens on the streaming-start transition', () => {
    const rendered = render(
      <Reasoning isStreaming={false}>
        <ReasoningTrigger />
        <ReasoningContent>Some reasoning text</ReasoningContent>
      </Reasoning>,
    );

    const trigger = screen.getByRole('button');
    expect(trigger.getAttribute('data-state')).toBe('closed');

    rendered.rerender(
      <Reasoning isStreaming>
        <ReasoningTrigger />
        <ReasoningContent>Some reasoning text</ReasoningContent>
      </Reasoning>,
    );

    expect(trigger.getAttribute('data-state')).toBe('open');
  });

  it('stays closed after user collapses it while streaming continues', () => {
    const rendered = render(
      <Reasoning isStreaming defaultOpen>
        <ReasoningTrigger />
        <ReasoningContent>Some reasoning text</ReasoningContent>
      </Reasoning>,
    );

    const trigger = screen.getByRole('button');
    expect(trigger.getAttribute('data-state')).toBe('open');

    act(() => {
      fireEvent.click(trigger);
    });
    expect(trigger.getAttribute('data-state')).toBe('closed');

    rendered.rerender(
      <Reasoning isStreaming defaultOpen>
        <ReasoningTrigger />
        <ReasoningContent>Some reasoning text continues</ReasoningContent>
      </Reasoning>,
    );

    expect(trigger.getAttribute('data-state')).toBe('closed');
  });
});
