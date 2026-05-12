// Shared shape for reconciliation_need rows surfaced to the client.
// Mirrors the durable schema with explicit field types so the client
// doesn't have to import server types.

export type ReconciliationNeedKind = 'supersedes' | 'needs_confirmation';
export type ReconciliationNeedStatus = 'open' | 'resolved';

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
}
