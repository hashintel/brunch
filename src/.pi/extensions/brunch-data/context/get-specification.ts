import { renderSpecificationContext } from '../../../../agents/contexts/data-model/spec/spec-context.js';
import { inspectSpecificationOverview } from '../../../../session/specification-overview-context.js';
import { resolveWorkspaceCwd } from './get-cwd.js';
import { resolveSelectedSpecBinding, type SessionManagerLike } from './session-binding.js';

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
  const selected = resolveSelectedSpecBinding(sessionManager);
  if (selected.status === 'not_ready') {
    return notReady(selected);
  }

  const details = await inspectSpecificationOverview(
    resolveWorkspaceCwd(sessionManager),
    selected.binding.specId,
    sessionManager?.getEntries() ?? [],
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
