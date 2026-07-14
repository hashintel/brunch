/**
 * Brunch-owned auto-compaction extension (D43-L, I28-L): the externalized
 * anchor preservation contract plus the `session_before_compact` /
 * `session_compact` enforcement that carries Brunch continuity entries
 * across Pi's compaction cut. Public root of the compaction sub-tree.
 */

export {
  compactionAnchorContract,
  type CompactionAnchorContract,
  type CompactionAnchorContractEntry,
  type CompactionAnchorSelect,
} from './anchor-contract.js';
export { registerBrunchCompactionAnchors } from './registrar.js';
export { selectCompactionAnchors, type SelectedCompactionAnchor } from './select-anchors.js';
