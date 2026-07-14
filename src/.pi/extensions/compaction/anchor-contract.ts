export type CompactionAnchorSelect = 'first' | 'latest' | 'active-leaves' | 'all-unresolved';

export interface CompactionAnchorContractEntry {
  kind: string;
  select: CompactionAnchorSelect;
  rationale: string;
}

export interface CompactionAnchorContract {
  version: 1;
  anchors: readonly CompactionAnchorContractEntry[];
}

/**
 * Canonical anchor preservation contract for the auto-compaction extension
 * (D43-L, I28-L). Reviewable without SPEC churn.
 *
 * Selection rules:
 * - `first`: first matching entry in branch order (singletons like session_binding)
 * - `latest`: most recent matching entry (singleton-by-recency)
 * - `active-leaves`: matching entries that are leaves of their supersedes chain and not yet terminal
 * - `all-unresolved`: matching entries whose effect has not yet been consumed by the agent or settled by user action
 */
export const compactionAnchorContract = {
  version: 1,
  anchors: [
    {
      kind: 'brunch.session_binding',
      select: 'first',
      rationale:
        'I8-L — exactly one binding per session; must survive compaction byte-stable to keep the JSONL self-describing.',
    },
    {
      kind: 'brunch.agent_runtime_state',
      select: 'latest',
      rationale:
        'D40-L — turn preparation reconstructs operational mode and foreground role from the latest valid runtime-state snapshot; losing it after compaction breaks I25-L.',
    },
    {
      kind: 'brunch.establishment_offer',
      select: 'latest',
      rationale:
        'PLAN compaction-and-conflict-widening — ambient-affordance chrome reads the latest establishment offer to render the current orientation surface.',
    },
    {
      kind: 'brunch.side_task_result',
      select: 'all-unresolved',
      rationale:
        'D15-L, I12-L — succeeded side-task results awaiting next-turn-boundary delivery must remain deliverable after compaction; mid-turn delivery remains forbidden.',
    },
    {
      kind: 'brunch.mention_staleness_hint',
      select: 'all-unresolved',
      rationale:
        'D14-L, I9-L — staleness hints the agent has not yet acted upon must survive so the re-read affordance is not silently dropped.',
    },
    {
      kind: 'brunch.context_seed',
      select: 'latest',
      rationale:
        'D76-L, I47-L — boot/context seeds carry the assistant-visible snapshot LSN; the latest seed must survive compaction so the projected watermark does not regress.',
    },
    {
      kind: 'brunch.graph_overview_snapshot',
      select: 'latest',
      rationale:
        'D76-L, I47-L — whole-spec overview reads are global watermark carriers; the latest carrier must survive compaction alongside worldUpdate.',
    },
    {
      kind: 'brunch.own_mutation',
      select: 'latest',
      rationale:
        'D76-L, I47-L — own graph mutations are already assistant-visible watermark carriers and must not be re-announced after compaction.',
    },
    {
      kind: 'worldUpdate',
      select: 'latest',
      rationale:
        'R13, I4-L, D76-L, I47-L — the latest cross-session graph delta is one watermark carrier, not the whole carrier family; preserving it prevents re-deriving world state from an outdated snapshot.',
    },
  ],
} as const satisfies CompactionAnchorContract;
