/**
 * Verifies the node color mapping exposed for card accenting.
 *
 * Slice: provide the `nodeColor` mapping by knowledge kind in
 * `src/graph/nodeColor.ts`, reusing/exposing the existing accent palette so
 * cards and graph nodes share one source of truth.
 *
 * Tested through the public surface only (`@/views/graph/nodeColor`); the assertions
 * survive any internal refactor of where the palette literally lives.
 */

import { describe, expect, it } from 'vitest';

import { knowledgeKinds, type KnowledgeKind } from '@/shared/knowledge.js';
import { nodeColor, nodeColorByKind } from '@/views/graph/nodeColor';

// The canonical accent palette this mapping must reuse/expose. These are the
// existing per-kind accent hexes used for card accenting; the slice's job is to
// surface exactly these from a single shared module — not invent new colors.
const expectedAccentHex: Record<KnowledgeKind, string> = {
  goal: '#2563eb',
  term: '#5b5b5b',
  context: '#0891b2',
  constraint: '#ec4899',
  requirement: '#16a34a',
  criterion: '#22c55e',
  decision: '#9333ea',
  assumption: '#d97706',
};

const hexColor = /^#[0-9a-f]{6}$/;

describe('nodeColor mapping by knowledge kind', () => {
  it('resolves every knowledge kind to a valid hex accent color', () => {
    for (const kind of knowledgeKinds) {
      expect(nodeColor(kind).toLowerCase()).toMatch(hexColor);
    }
  });

  it('reuses the existing accent palette for each kind', () => {
    for (const kind of knowledgeKinds) {
      expect(nodeColor(kind).toLowerCase()).toBe(expectedAccentHex[kind].toLowerCase());
    }
  });

  it('exposes a mapping record covering exactly the eight knowledge kinds', () => {
    expect(Object.keys(nodeColorByKind).sort()).toEqual([...knowledgeKinds].sort());
  });

  it('keeps the mapping record and accessor in agreement', () => {
    for (const kind of knowledgeKinds) {
      expect(nodeColorByKind[kind]).toBe(nodeColor(kind));
    }
  });

  it('gives every distinct kind a distinct color so accents are visually separable', () => {
    const colors = knowledgeKinds.map((kind) => nodeColor(kind).toLowerCase());
    expect(new Set(colors).size).toBe(knowledgeKinds.length);
  });
});
