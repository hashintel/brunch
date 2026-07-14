import type { CustomMessageEntry, ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { compactionAnchorContract } from './anchor-contract.js';
import { selectCompactionAnchors } from './select-anchors.js';

/**
 * The D43-L compaction hook: Pi's default summary cannot know about Brunch's
 * transcript-native continuity entries, so Brunch owns `session_before_compact`
 * and enforces the anchor contract (I28-L) across the cut.
 *
 * Enforcement is class-split:
 *
 * - `custom` (ledger) anchors need no action — compaction appends a summary
 *   entry and never rewrites the JSONL, and Brunch's ledger projections read
 *   the full entry list, so `session_binding` / `agent_runtime_state` /
 *   `own_mutation`-class anchors survive by construction.
 * - `custom_message` (provider-visible) anchors lose their effect: Pi's
 *   context rebuild drops every pre-cut entry from model context, so the
 *   latest `worldUpdate` / `brunch.context_seed`-class carriers and
 *   unresolved nudges would silently vanish from the model's view while the
 *   file-scoped watermark still says "seen". Those are re-injected after the
 *   compaction entry, byte-stable (same customType/content/display/details,
 *   I28-L), so the model's post-compaction context carries the same
 *   continuity facts and the watermark neither regresses nor falsely
 *   advances (identical LSNs, I45-L).
 *
 * The hook never cancels and never takes over summarization — Pi's summary
 * runs unchanged; Brunch only carries its own entries across the cut. The
 * wider keep/drop compaction definition (what conversational content the
 * summary should retain) remains the design half of PLAN
 * `compaction-and-conflict-widening`.
 */
export function registerBrunchCompactionAnchors(pi: ExtensionAPI): void {
  // One compaction runs at a time per session; `session_before_compact`
  // always overwrites, so a cancelled compaction's stale selection can never
  // leak into a later one.
  let pendingReinjection: CustomMessageEntry[] = [];

  pi.on('session_before_compact', (event) => {
    const selected = selectCompactionAnchors(
      event.branchEntries,
      event.preparation.firstKeptEntryId,
      compactionAnchorContract,
    );
    pendingReinjection = selected
      .map((anchor) => anchor.entry)
      .filter((entry): entry is CustomMessageEntry => entry.type === 'custom_message');
    return undefined;
  });

  pi.on('session_compact', async (event) => {
    const toReinject = pendingReinjection;
    pendingReinjection = [];
    // An extension-provided compaction owns its own preservation semantics.
    if (event.fromExtension || toReinject.length === 0) return;
    for (const entry of toReinject) {
      await pi.sendMessage(
        {
          customType: entry.customType,
          content: entry.content,
          display: entry.display,
          ...(entry.details !== undefined ? { details: entry.details } : {}),
        },
        { deliverAs: 'nextTurn' },
      );
    }
  });
}
