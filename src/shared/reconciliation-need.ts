// Shared shape for reconciliation_need rows surfaced to the client.
// Mirrors the durable schema with explicit field types so the client
// doesn't have to import server types.

export type ReconciliationNeedKind = 'supersedes' | 'needs_confirmation';
export type ReconciliationNeedStatus = 'open' | 'resolved';
// V3.1 slice 4: reconciliation-classifier lifecycle. The label vocabulary
// is bounded by I114 (lifecycle + label vocabulary + structural recoverability).
// `null` means the row has never been classified (default for both new and
// legacy rows); `queued`/`classifying` are in-flight states; `classified`
// pairs with a non-null `agent_classification`; `failed` pairs with a
// `agent_proposal` that carries the parse error or thrown message.
export type ReconciliationNeedAgentStatus = 'queued' | 'classifying' | 'classified' | 'failed';
export type ReconciliationNeedAgentClassification = 'auto-confirm' | 'auto-edit' | 'substantive';

export interface ReconciliationNeedRecord {
  id: number;
  specification_id: number;
  source_item_id: number;
  target_item_id: number;
  kind: ReconciliationNeedKind;
  status: ReconciliationNeedStatus;
  reason: string | null;
  caused_by_turn_id: number | null;
  caused_by_patch_id: number | null;
  created_at: string;
  resolved_at: string | null;
  // V3.1 setup (card 1): nullable source content snapshots captured by the
  // cascade producer at open time; used by the Pending review row to render
  // the source diff inline (card 2) and as the pre-image for the V3.1
  // classifier (deferred). Null on legacy rows or any open path that
  // bypasses the cascade producer.
  source_previous_content: string | null;
  source_current_content: string | null;
  // V3.1 setup (card 3): the listing endpoint joins each need against its
  // target knowledge_item to expose the live current content. NOT a column
  // on reconciliation_need — read-time enrichment only. Null when the
  // target item has been deleted (FK cascade has taken care of the row in
  // most cases, but guard for race / partial states); the Edit-target
  // affordance is hidden in that case and the user falls back to Resolve.
  target_current_content: string | null;
  // V3.1 slice 4 (memory/CARDS.md): reconciliation-classifier output. Null
  // until the run-agent route picks the row up. See ReconciliationNeedAgentStatus
  // for the lifecycle and ReconciliationNeedAgentClassification for the label
  // vocabulary. agent_proposal is text-only; the client renders it as a
  // diff for `auto-edit` and a note for `substantive`, but never auto-applies.
  agent_status: ReconciliationNeedAgentStatus | null;
  agent_classification: ReconciliationNeedAgentClassification | null;
  agent_proposal: string | null;
}
