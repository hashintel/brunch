/**
 * The full label lookup matrix, executable.
 *
 * Tier 1 enumerates every `(category, anchorRole, stance)` base cell; Tier 2
 * enumerates every refined `(category, sourceKind, targetKind)` cell. Renderers
 * rely on this coverage and never re-assert label text themselves.
 */

import { describe, expect, it } from 'vitest';

import type { EdgeStance } from '../../schema/edges.js';
import type { NodeKind } from '../../schema/nodes.js';
import { edgeLabel } from '../labels.js';
import type { AnchorRole } from '../labels.js';

interface BaseCell {
  readonly category: Parameters<typeof edgeLabel>[0]['category'];
  readonly anchorRole: AnchorRole;
  readonly stance?: EdgeStance;
  readonly label: string;
}

// Tier 1 — every base cell, read from the anchor's perspective.
const BASE_MATRIX: readonly BaseCell[] = [
  { category: 'dependency', anchorRole: 'source', label: 'required by' },
  { category: 'dependency', anchorRole: 'target', label: 'depends on' },

  { category: 'witness', anchorRole: 'source', stance: 'for', label: 'witnesses' },
  { category: 'witness', anchorRole: 'source', stance: 'against', label: 'refutes' },
  { category: 'witness', anchorRole: 'target', stance: 'for', label: 'witnessed by' },
  { category: 'witness', anchorRole: 'target', stance: 'against', label: 'challenged by' },

  { category: 'rationale', anchorRole: 'source', stance: 'for', label: 'supports' },
  { category: 'rationale', anchorRole: 'source', stance: 'against', label: 'argues against' },
  { category: 'rationale', anchorRole: 'target', stance: 'for', label: 'motivated by' },
  { category: 'rationale', anchorRole: 'target', stance: 'against', label: 'opposed by' },

  { category: 'realization', anchorRole: 'source', label: 'realized by' },
  { category: 'realization', anchorRole: 'target', label: 'realizes' },

  { category: 'refinement', anchorRole: 'source', label: 'refined by' },
  { category: 'refinement', anchorRole: 'target', label: 'refines' },

  { category: 'exclusion', anchorRole: 'source', label: 'bounds' },
  { category: 'exclusion', anchorRole: 'target', label: 'bounded by' },

  { category: 'composition', anchorRole: 'source', label: 'contains' },
  { category: 'composition', anchorRole: 'target', label: 'part of' },

  { category: 'supersession', anchorRole: 'source', label: 'supersedes' },
  { category: 'supersession', anchorRole: 'target', label: 'superseded by' },

  { category: 'cross_reference', anchorRole: 'source', label: 'related to' },
  { category: 'cross_reference', anchorRole: 'target', label: 'related to' },
];

interface RefineCell {
  readonly sourceKind: NodeKind;
  readonly targetKind: NodeKind;
  readonly fromSource: string;
  readonly fromTarget: string;
}

// Tier 2 — every refined realization cell (sourceKind → targetKind).
const REFINE_MATRIX: readonly RefineCell[] = [
  { sourceKind: 'requirement', targetKind: 'module', fromSource: 'implemented by', fromTarget: 'implements' },
  { sourceKind: 'interface', targetKind: 'module', fromSource: 'implemented by', fromTarget: 'implements' },
  { sourceKind: 'requirement', targetKind: 'slice', fromSource: 'established by', fromTarget: 'establishes' },
  { sourceKind: 'invariant', targetKind: 'requirement', fromSource: 'expressed by', fromTarget: 'expresses' },
];

describe('edgeLabel — Tier 1 base matrix', () => {
  it.each(BASE_MATRIX)(
    '$category/$anchorRole${stance} → $label',
    ({ category, anchorRole, stance, label }) => {
      expect(edgeLabel({ category, anchorRole, stance })).toBe(label);
    },
  );
});

describe('edgeLabel — Tier 2 refinement matrix', () => {
  it.each(REFINE_MATRIX)(
    'realization $sourceKind→$targetKind reads as $fromTarget / $fromSource',
    ({ sourceKind, targetKind, fromSource, fromTarget }) => {
      expect(edgeLabel({ category: 'realization', anchorRole: 'source', sourceKind, targetKind })).toBe(
        fromSource,
      );
      expect(edgeLabel({ category: 'realization', anchorRole: 'target', sourceKind, targetKind })).toBe(
        fromTarget,
      );
    },
  );

  it('applies refinement only when both endpoint kinds are supplied', () => {
    expect(edgeLabel({ category: 'realization', anchorRole: 'target' })).toBe('realizes');
    expect(edgeLabel({ category: 'realization', anchorRole: 'target', sourceKind: 'requirement' })).toBe(
      'realizes',
    );
  });

  it('falls back to the base heading for an unrefined kind tuple', () => {
    expect(
      edgeLabel({ category: 'realization', anchorRole: 'target', sourceKind: 'goal', targetKind: 'context' }),
    ).toBe('realizes');
  });
});
