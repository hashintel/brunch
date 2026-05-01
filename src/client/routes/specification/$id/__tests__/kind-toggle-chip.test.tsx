// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { knowledgeKindRegistry } from '@/shared/knowledge.js';

import { KindToggleChip } from '../-kind-toggle-chip';

const goalEntry = knowledgeKindRegistry.find((e) => e.kind === 'goal')!;

afterEach(() => cleanup());

describe('KindToggleChip', () => {
  it('renders body and toggle as separate buttons', () => {
    render(
      <KindToggleChip
        entry={goalEntry}
        count={3}
        isHidden={false}
        onNavigate={() => {}}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /scroll to/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /hide/i })).toBeTruthy();
  });

  it('body click invokes onNavigate only', async () => {
    const onNavigate = vi.fn();
    const onToggle = vi.fn();
    render(
      <KindToggleChip
        entry={goalEntry}
        count={3}
        isHidden={false}
        onNavigate={onNavigate}
        onToggle={onToggle}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /scroll to/i }));
    expect(onNavigate).toHaveBeenCalledWith(goalEntry.kind);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('toggle click invokes onToggle only', async () => {
    const onNavigate = vi.fn();
    const onToggle = vi.fn();
    render(
      <KindToggleChip
        entry={goalEntry}
        count={3}
        isHidden={false}
        onNavigate={onNavigate}
        onToggle={onToggle}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /hide/i }));
    expect(onToggle).toHaveBeenCalledWith(goalEntry.kind);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('toggle aria-pressed reflects !isHidden', () => {
    const { rerender } = render(
      <KindToggleChip
        entry={goalEntry}
        count={3}
        isHidden={false}
        onNavigate={() => {}}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByRole('button', { pressed: true })).toBeTruthy();
    rerender(
      <KindToggleChip
        entry={goalEntry}
        count={3}
        isHidden={true}
        onNavigate={() => {}}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByRole('button', { pressed: false })).toBeTruthy();
  });
});
