/**
 * Empty-state surface for the graph view.
 *
 * When the graph has no knowledge entities to render, the view reuses the list
 * view's existing orientation card rather than inventing a separate empty
 * surface. This keeps the "knowledge appears as the interview progresses"
 * message and back-to-chat action consistent across both views.
 */

import type { ReactNode } from 'react';

import { EmptyStateCard } from '@/client/routes/specification/$id/-structured-list-view.js';

/** Renders the shared orientation card for the empty graph state. */
export function GraphEmptyState({ action }: { action?: ReactNode }) {
  return (
    <EmptyStateCard
      state="no-items"
      title="No knowledge captured yet"
      description="Knowledge appears here as the interview progresses. Start a turn to populate the graph."
      action={action}
    />
  );
}
