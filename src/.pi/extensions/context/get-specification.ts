import type { SessionEntry, SessionHeader } from '@earendil-works/pi-coding-agent';

import { renderSpecificationContext } from '../../../renderers/specification/specification-context.js';
import { isSessionBindingEntry } from '../../../session/session-binding.js';
import { inspectSpecificationOverview } from '../../../session/specification-overview-context.js';
import { resolveWorkspaceCwd } from './get-cwd.js';

interface SessionManagerLike {
  getHeader(): SessionHeader | null;
  getEntries(): readonly SessionEntry[];
}

interface SpecificationContextNotReady {
  readonly status: 'not_ready';
  readonly reason: 'missing_session_header' | 'missing_binding';
  readonly sessionId: string | null;
}

export type SpecificationContextResult =
  | {
      readonly status: 'ready';
      readonly text: string;
      readonly details: Awaited<ReturnType<typeof inspectSpecificationOverview>>;
    }
  | {
      readonly status: 'not_ready';
      readonly text: string;
      readonly details: SpecificationContextNotReady;
    };

export async function readSpecificationContext(
  sessionManager?: SessionManagerLike,
): Promise<SpecificationContextResult> {
  const header = sessionManager?.getHeader() ?? undefined;
  if (!header) {
    return notReady({ status: 'not_ready', reason: 'missing_session_header', sessionId: null });
  }

  const binding = sessionManager?.getEntries().find(isSessionBindingEntry);
  if (!binding) {
    return notReady({ status: 'not_ready', reason: 'missing_binding', sessionId: header.id });
  }

  const details = await inspectSpecificationOverview(
    resolveWorkspaceCwd(sessionManager),
    binding.data.specId,
  );
  return { status: 'ready', text: renderSpecificationContext(details), details };
}

function notReady(details: SpecificationContextNotReady): SpecificationContextResult {
  return {
    status: 'not_ready',
    text: `status: not_ready\nreason: ${details.reason}`,
    details,
  };
}
