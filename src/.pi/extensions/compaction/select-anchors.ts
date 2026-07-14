import type { SessionEntry } from '@earendil-works/pi-coding-agent';

import type { CompactionAnchorContract, CompactionAnchorSelect } from './anchor-contract.js';

/**
 * One anchor entry the compaction cut would discard that the contract
 * designates as must-survive. Selection is pure designation: whether an entry
 * needs *action* (re-injection vs already-safe persistence) is the
 * registrar's call, by entry class.
 */
export interface SelectedCompactionAnchor {
  readonly entry: SessionEntry & { type: 'custom' | 'custom_message'; customType: string };
  readonly kind: string;
  readonly select: CompactionAnchorSelect;
}

type AnchorEntry = SelectedCompactionAnchor['entry'];

function isAnchorCandidate(entry: SessionEntry): entry is AnchorEntry {
  return entry.type === 'custom' || entry.type === 'custom_message';
}

/**
 * Apply the anchor contract's select rules to a compaction cut: return the
 * entries in the to-be-discarded region (before `firstKeptEntryId` in branch
 * order) whose effect the contract requires to survive, in original order.
 *
 * A kind whose designated entry already lives in the kept region selects
 * nothing — the cut preserves it for free. An unknown `firstKeptEntryId`
 * selects nothing: Pi never compacts without a valid preparation, so an
 * unmatched id means we cannot locate the cut and must not guess.
 *
 * ceiling: `all-unresolved` and `active-leaves` conservatively designate
 * every discarded match — over-preservation re-shows an already-handled
 * nudge at worst, while under-preservation silently drops an obligation.
 * Add per-kind resolution/supersession predicates when re-announcement
 * noise shows up in real compacted sessions.
 */
export function selectCompactionAnchors(
  branchEntries: readonly SessionEntry[],
  firstKeptEntryId: string,
  contract: CompactionAnchorContract,
): SelectedCompactionAnchor[] {
  const cutIndex = branchEntries.findIndex((entry) => entry.id === firstKeptEntryId);
  if (cutIndex < 0) return [];

  const selected: Array<{ index: number; anchor: SelectedCompactionAnchor }> = [];
  for (const { kind, select } of contract.anchors) {
    const matches: Array<{ index: number; entry: AnchorEntry }> = [];
    branchEntries.forEach((entry, index) => {
      if (isAnchorCandidate(entry) && entry.customType === kind) matches.push({ index, entry });
    });
    if (matches.length === 0) continue;

    const dropped = matches.filter((match) => match.index < cutIndex);
    if (dropped.length === 0) continue;

    let designated: Array<{ index: number; entry: AnchorEntry }>;
    switch (select) {
      case 'first': {
        const first = matches[0]!;
        designated = first.index < cutIndex ? [first] : [];
        break;
      }
      case 'latest': {
        const latest = matches[matches.length - 1]!;
        designated = latest.index < cutIndex ? [latest] : [];
        break;
      }
      case 'active-leaves':
      case 'all-unresolved':
        designated = dropped;
        break;
    }
    for (const match of designated) {
      selected.push({ index: match.index, anchor: { entry: match.entry, kind, select } });
    }
  }

  return selected.sort((a, b) => a.index - b.index).map((item) => item.anchor);
}
