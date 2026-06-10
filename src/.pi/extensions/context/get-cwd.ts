import { resolve } from 'node:path';

import type { SessionHeader } from '@earendil-works/pi-coding-agent';

import {
  projectWorkspaceCwdContext,
  projectWorkspaceOverviewContext,
  type WorkspaceContextProjection,
} from '../../../projections/workspace/workspace-context.js';
import { renderWorkspaceContext } from '../../../renderers/workspace/workspace-context.js';
import {
  inspectWorkspaceCwdInventory,
  inspectWorkspaceOverview,
} from '../../../session/workspace-context.js';

// The session cwd lives on the Pi header, which is reachable only via
// getHeader() — not getEntries() (SessionEntry[], header excluded). Searching
// getEntries() for it previously always missed, silently falling back to
// process.cwd() and inventorying the wrong directory.
interface SessionManagerLike {
  getHeader(): SessionHeader | null;
}

export async function readWorkspaceContext(
  mode: 'cwd_inventory' | 'workspace_overview',
  sessionManager?: SessionManagerLike,
): Promise<{ readonly text: string; readonly details: WorkspaceContextProjection }> {
  const cwd = resolveWorkspaceCwd(sessionManager);
  const details =
    mode === 'workspace_overview'
      ? projectWorkspaceOverviewContext(await inspectWorkspaceOverview(cwd))
      : projectWorkspaceCwdContext(await inspectWorkspaceCwdInventory(cwd));
  return {
    text: renderWorkspaceContext(details),
    details,
  };
}

function resolveWorkspaceCwd(sessionManager?: SessionManagerLike): string {
  const header = sessionManager?.getHeader();
  return typeof header?.cwd === 'string' ? resolve(header.cwd) : process.cwd();
}
