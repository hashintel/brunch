// @vitest-environment happy-dom

import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useTextSelection } from '../use-text-selection.js';

afterEach(() => {
  cleanup();
});

function setSelection(node: Node, start: number, end: number): void {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
}

describe('useTextSelection', () => {
  it('returns null when no selection is active', () => {
    const { result } = renderHook(() => useTextSelection('[data-annotatable]'));
    expect(result.current).toBeNull();
  });

  it('returns snapshot, offsets, and anchor when selection is inside a data-annotatable element', () => {
    render(
      <div data-graph-row data-graph-row-ref="C1" data-item-kind="constraint" data-item-id="7">
        <span data-annotatable>The quick brown fox jumps over the lazy dog.</span>
      </div>,
    );
    const span = document.querySelector('[data-annotatable]')!;
    const textNode = span.firstChild!;

    const { result } = renderHook(() => useTextSelection('[data-annotatable]'));

    act(() => {
      setSelection(textNode, 4, 19); // "quick brown fox"
    });

    expect(result.current).not.toBeNull();
    expect(result.current!.snapshot).toBe('quick brown fox');
    expect(result.current!.start).toBe(4);
    expect(result.current!.end).toBe(19);
    expect(result.current!.anchor).toEqual({
      kind: 'constraint',
      itemId: 7,
      referenceCode: 'C1',
    });
  });

  it('returns null when selection straddles two data-annotatable elements', () => {
    render(
      <>
        <span data-annotatable data-graph-row-ref="C1" data-item-kind="constraint" data-item-id="1">
          first part
        </span>
        <span data-annotatable data-graph-row-ref="C2" data-item-kind="constraint" data-item-id="2">
          second part
        </span>
      </>,
    );
    const spans = document.querySelectorAll('[data-annotatable]');
    const a = spans[0]!.firstChild!;
    const b = spans[1]!.firstChild!;

    const { result } = renderHook(() => useTextSelection('[data-annotatable]'));

    act(() => {
      const range = document.createRange();
      range.setStart(a, 0);
      range.setEnd(b, 5);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });

    expect(result.current).toBeNull();
  });

  it('returns null when selection is collapsed', () => {
    render(
      <span data-annotatable data-graph-row-ref="C1" data-item-kind="constraint" data-item-id="1">
        hello
      </span>,
    );
    const node = document.querySelector('[data-annotatable]')!.firstChild!;
    const { result } = renderHook(() => useTextSelection('[data-annotatable]'));

    act(() => {
      setSelection(node, 2, 2);
    });

    expect(result.current).toBeNull();
  });
});
