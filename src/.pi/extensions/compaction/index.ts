/**
 * Brunch-owned auto-compaction extension (D43-L, I28-L): the externalized
 * anchor preservation contract plus the one-hook native custom compaction
 * result that carries Brunch continuity across Pi's cut. Public root of the
 * compaction sub-tree.
 */

export {
  compactionAnchorContract,
  type CompactionAnchorContract,
  type CompactionAnchorContractEntry,
  type CompactionAnchorSelect,
} from './anchor-contract.js';
export { registerBrunchCompaction } from './registrar.js';
export { selectCompactionAnchors, type SelectedCompactionAnchor } from './select-anchors.js';
