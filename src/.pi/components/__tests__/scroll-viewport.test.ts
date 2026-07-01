import { describe, expect, it } from 'vitest';

import { projectScrollViewport } from '../scroll-viewport.js';

function items(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `item ${i}`);
}

describe('projectScrollViewport', () => {
  it('returns content unchanged with no thumb rows when it fits within height', () => {
    const content = ['a', 'b', 'c'];
    const result = projectScrollViewport(content, 5);

    expect(result.lines).toEqual(content);
    expect(result.offset).toBe(0);
    expect(result.isThumbRow).toEqual([false, false, false]);
  });

  it('windows content centered around keepVisible', () => {
    const result = projectScrollViewport(items(20), 5, 10);

    // centered: offset = keepVisible - floor(height/2) = 10 - 2 = 8
    expect(result.offset).toBe(8);
    expect(result.lines).toEqual(['item 8', 'item 9', 'item 10', 'item 11', 'item 12']);
  });

  it('clamps the window at the start of the content', () => {
    const result = projectScrollViewport(items(20), 5, 0);

    expect(result.offset).toBe(0);
    expect(result.lines).toEqual(['item 0', 'item 1', 'item 2', 'item 3', 'item 4']);
  });

  it('clamps the window at the end of the content', () => {
    const result = projectScrollViewport(items(20), 5, 19);

    expect(result.offset).toBe(15);
    expect(result.lines).toEqual(['item 15', 'item 16', 'item 17', 'item 18', 'item 19']);
  });

  it('keeps the selected row inside the window for every index across the full list', () => {
    const content = items(20);
    for (let selected = 0; selected < content.length; selected++) {
      const result = projectScrollViewport(content, 5, selected);
      expect(result.offset).toBeLessThanOrEqual(selected);
      expect(selected).toBeLessThan(result.offset + result.lines.length);
    }
  });

  it('marks a proportional thumb window that moves from top to bottom as the offset scrolls', () => {
    const atTop = projectScrollViewport(items(20), 5, 0);
    const atBottom = projectScrollViewport(items(20), 5, 19);

    expect(atTop.isThumbRow[0]).toBe(true);
    expect(atTop.isThumbRow.at(-1)).toBe(false);
    expect(atBottom.isThumbRow[0]).toBe(false);
    expect(atBottom.isThumbRow.at(-1)).toBe(true);
    // thumb size: max(1, floor(5/20 * 5)) = max(1, floor(1.25)) = 1
    expect(atTop.isThumbRow.filter(Boolean)).toHaveLength(1);
  });

  it('defaults to the start of content when no keepVisible index is given', () => {
    const result = projectScrollViewport(items(20), 5);

    expect(result.offset).toBe(0);
    expect(result.lines).toEqual(['item 0', 'item 1', 'item 2', 'item 3', 'item 4']);
  });

  it('returns an empty window for empty content', () => {
    const result = projectScrollViewport([], 5);

    expect(result.lines).toEqual([]);
    expect(result.isThumbRow).toEqual([]);
  });

  it('treats a list exactly at the height boundary as non-scrolling', () => {
    const result = projectScrollViewport(items(5), 5, 4);

    expect(result.lines).toHaveLength(5);
    expect(result.isThumbRow).toEqual([false, false, false, false, false]);
  });
});
