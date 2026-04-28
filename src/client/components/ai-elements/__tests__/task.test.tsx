// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Task, TaskContent, TaskItem, TaskTrigger } from '../task.js';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('Task', () => {
  it('opens while tool work is running, then auto-collapses and disables reopening when work completes', () => {
    vi.useFakeTimers();

    const rendered = render(
      <Task isRunning>
        <TaskTrigger showIcon={false} title="Tools: read file" />
        <TaskContent>
          <TaskItem>src/client/components/question-cards.tsx</TaskItem>
        </TaskContent>
      </Task>,
    );

    const trigger = screen.getByRole('button', { name: 'Tools: read file' });
    const content = screen
      .getByText('src/client/components/question-cards.tsx')
      .closest('[data-slot="collapsible-content"]');

    expect(trigger.getAttribute('data-state')).toBe('open');
    expect(content?.getAttribute('data-state')).toBe('open');

    rendered.rerender(
      <Task isRunning={false}>
        <TaskTrigger showIcon={false} title="Tools: read file" />
        <TaskContent>
          <TaskItem>src/client/components/question-cards.tsx</TaskItem>
        </TaskContent>
      </Task>,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(trigger.getAttribute('data-state')).toBe('closed');
    expect(content?.getAttribute('data-state')).toBe('closed');
    expect(trigger.hasAttribute('disabled')).toBe(true);
    expect(trigger.querySelector('svg')).toBeNull();
  });

  it('stays closed after user collapses it while work is still running', () => {
    const rendered = render(
      <Task isRunning>
        <TaskTrigger showIcon={false} title="Tools: read file" />
        <TaskContent>
          <TaskItem>src/client/components/question-cards.tsx</TaskItem>
        </TaskContent>
      </Task>,
    );

    const trigger = screen.getByRole('button', { name: 'Tools: read file' });
    expect(trigger.getAttribute('data-state')).toBe('open');

    act(() => {
      fireEvent.click(trigger);
    });
    expect(trigger.getAttribute('data-state')).toBe('closed');

    rendered.rerender(
      <Task isRunning>
        <TaskTrigger showIcon={false} title="Tools: read file" />
        <TaskContent>
          <TaskItem>src/client/components/question-cards.tsx</TaskItem>
        </TaskContent>
      </Task>,
    );

    expect(trigger.getAttribute('data-state')).toBe('closed');
  });
});
