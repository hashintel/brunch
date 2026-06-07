import { resolve } from 'node:path';

import type { FileEntry } from '@earendil-works/pi-coding-agent';

import {
  projectWorkspaceCwdContext,
  type WorkspaceContextProjection,
} from '../../../projections/workspace/workspace-context.js';
import { renderWorkspaceContext } from '../../../renderers/workspace/workspace-context.js';
import { inspectWorkspaceCwdSnapshot } from '../../../session/workspace-context.js';

interface SessionManagerLike {
  getEntries(): readonly FileEntry[];
}

export async function readWorkspaceCwdContext(
  sessionManager?: SessionManagerLike,
): Promise<{ readonly text: string; readonly details: WorkspaceContextProjection }> {
  const cwd = resolveWorkspaceCwd(sessionManager);
  const details = projectWorkspaceCwdContext(await inspectWorkspaceCwdSnapshot(cwd));
  return {
    text: renderWorkspaceContext(details),
    details,
  };
}

function resolveWorkspaceCwd(sessionManager?: SessionManagerLike): string {
  const header = sessionManager?.getEntries().find(isSessionHeaderEntry);
  return typeof header?.cwd === 'string' ? resolve(header.cwd) : process.cwd();
}

function isSessionHeaderEntry(
  entry: FileEntry,
): entry is FileEntry & { readonly type: 'session'; readonly cwd: string } {
  return entry.type === 'session' && typeof (entry as { cwd?: unknown }).cwd === 'string';
}
