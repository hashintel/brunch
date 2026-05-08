// Shared test fixture for reconciliation_need rows in client component tests.
// Both patch-list-overlay.test.tsx and pending-review-section.test.tsx (and
// future V3.1 tests) consume this builder so the row shape lives in one place.

import type { ReconciliationNeedRecord } from '@/shared/reconciliation-need.js';

export function makeNeed(overrides: Partial<ReconciliationNeedRecord> = {}): ReconciliationNeedRecord {
  return {
    id: overrides.id ?? 1,
    specification_id: overrides.specification_id ?? 1,
    source_item_id: overrides.source_item_id ?? 10,
    target_item_id: overrides.target_item_id ?? 20,
    kind: overrides.kind ?? 'needs_confirmation',
    status: overrides.status ?? 'open',
    reason: overrides.reason ?? null,
    caused_by_turn_id: overrides.caused_by_turn_id ?? null,
    caused_by_patch_id: overrides.caused_by_patch_id ?? null,
    created_at: overrides.created_at ?? '2026-05-08T00:00:00Z',
    resolved_at: overrides.resolved_at ?? null,
    source_previous_content: overrides.source_previous_content ?? null,
    source_current_content: overrides.source_current_content ?? null,
  };
}
