import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

import type { WorkspaceState } from '../../projections/workspace/workspace-state.js';

/**
 * Follow explicit workspace-default changes (e.g. a TUI spec switch): when the
 * workspace's selected spec changes and this client is viewing the previously
 * selected spec, navigate to the newly selected one. Clients viewing another
 * spec or the index stay put — web view selection remains client-local
 * otherwise (SPEC assumption 12 corollary).
 */
export function useFollowWorkspaceSpec(state: WorkspaceState): void {
  const router = useRouter();
  const specId = state.spec?.id;
  const previousSpecIdRef = useRef(specId);

  useEffect(() => {
    const previousSpecId = previousSpecIdRef.current;
    previousSpecIdRef.current = specId;
    if (specId === undefined || previousSpecId === undefined || previousSpecId === specId) {
      return;
    }
    if (parseSpecPath(router.state.location.pathname) !== previousSpecId) {
      return;
    }
    void router.navigate({ to: '/spec/$specId', params: { specId: String(specId) } });
  }, [specId, router]);
}

function parseSpecPath(pathname: string): number | undefined {
  const match = /^\/spec\/(\d+)\/?$/u.exec(pathname);
  return match ? Number(match[1]) : undefined;
}
