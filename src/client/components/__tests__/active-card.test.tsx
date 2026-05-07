// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ActiveCard } from '../active-card.js';

afterEach(() => {
  cleanup();
});

describe('ActiveCard', () => {
  it('renders the reference code, summary, and dismiss button', () => {
    render(
      <ActiveCard
        annotationId={42}
        referenceCode="C1"
        itemKind="constraint"
        summary="household income should be inclusive"
        body=""
        inContext
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText('C1', { exact: false })).toBeTruthy();
    expect(screen.getByText(/household income should be inclusive/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeTruthy();
  });

  it('renders the body when present', () => {
    render(
      <ActiveCard
        annotationId={1}
        referenceCode="C1"
        itemKind="constraint"
        summary="phrase"
        body="my commentary"
        inContext
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText('my commentary')).toBeTruthy();
  });

  it('shows a "not in context" tag when inContext is false', () => {
    render(
      <ActiveCard
        annotationId={1}
        referenceCode="C1"
        itemKind="constraint"
        summary="phrase"
        body=""
        inContext={false}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText(/not in context/i)).toBeTruthy();
  });

  it('calls onDismiss with the annotation id when dismiss is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <ActiveCard
        annotationId={42}
        referenceCode="C1"
        itemKind="constraint"
        summary="phrase"
        body=""
        inContext
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith(42);
  });
});
