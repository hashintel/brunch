// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@streamdown/cjk', () => ({ cjk: {} }));
vi.mock('@streamdown/math', () => ({ math: {} }));
vi.mock('streamdown', () => ({
  Streamdown: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import {
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchSelector,
  MessageBranchPrevious,
  MessageToolbar,
} from './message.js';

function renderBranchFixture(children: React.ReactNode) {
  return render(
    <MessageBranch>
      <MessageBranchContent>{children}</MessageBranchContent>
      <MessageToolbar>
        <MessageBranchSelector>
          <MessageBranchPrevious />
          <MessageBranchPage />
          <MessageBranchNext />
        </MessageBranchSelector>
      </MessageToolbar>
    </MessageBranch>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MessageBranch', () => {
  it('keeps the active branch index when equal-length branch content is replaced', () => {
    const rendered = renderBranchFixture([
      <div key="alpha">Alpha branch</div>,
      <div key="beta">Beta branch</div>,
    ]);

    fireEvent.click(screen.getByRole('button', { name: /next branch/i }));
    expect(screen.getByText('Beta branch')).toBeTruthy();
    expect(screen.getByText('2 of 2')).toBeTruthy();

    rendered.rerender(
      <MessageBranch>
        <MessageBranchContent>
          <div key="gamma">Gamma branch</div>
          <div key="delta">Delta branch</div>
        </MessageBranchContent>
        <MessageToolbar>
          <MessageBranchSelector>
            <MessageBranchPrevious />
            <MessageBranchPage />
            <MessageBranchNext />
          </MessageBranchSelector>
        </MessageToolbar>
      </MessageBranch>,
    );

    expect(screen.queryByText('Beta branch')).toBeNull();
    expect(screen.getByText('Gamma branch').parentElement?.className).toContain('hidden');
    expect(screen.getByText('Delta branch').parentElement?.className).toContain('block');
    expect(screen.getByText('2 of 2')).toBeTruthy();
  });

  it('clamps the active branch when the branch set shrinks', () => {
    const rendered = renderBranchFixture([
      <div key="alpha">Alpha branch</div>,
      <div key="beta">Beta branch</div>,
    ]);

    fireEvent.click(screen.getByRole('button', { name: /next branch/i }));
    expect(screen.getByText('Beta branch')).toBeTruthy();

    rendered.rerender(
      <MessageBranch>
        <MessageBranchContent>
          <div key="gamma">Only remaining branch</div>
        </MessageBranchContent>
        <MessageToolbar>
          <MessageBranchSelector>
            <MessageBranchPrevious />
            <MessageBranchPage />
            <MessageBranchNext />
          </MessageBranchSelector>
        </MessageToolbar>
      </MessageBranch>,
    );

    expect(screen.getByText('Only remaining branch').parentElement?.className).toContain('block');
    expect(screen.queryByText('2 of 2')).toBeNull();
    expect(screen.queryByRole('button', { name: /next branch/i })).toBeNull();
  });
});
