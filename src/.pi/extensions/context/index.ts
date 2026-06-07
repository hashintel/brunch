import type { ExtensionAPI, FileEntry } from '@earendil-works/pi-coding-agent';

import {
  projectSessionRuntimeState,
  type RuntimeStateProjection,
} from '../../../projections/session/runtime-state.js';
import {
  renderRuntimeFrame,
  type SessionRuntimeFrameRenderInput,
} from '../../../renderers/session/runtime-frame.js';
import {
  NonLinearTranscriptError,
  type BrunchSessionEnvelope,
} from '../../../session/brunch-session-envelope.js';
import { isSessionBindingEntry } from '../../../session/session-binding.js';

interface SessionManagerLike {
  getEntries(): readonly FileEntry[];
}

export function registerBrunchContext(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'read_session_context',
    label: 'Read Session Context',
    description:
      'Read the selected session runtime frame: binding, current agent posture, mention handles, world watermarks, and lifecycle facts.',
    promptSnippet: 'Read the selected session runtime frame and binding',
    promptGuidelines: [
      'Use read_session_context when you need the current selected session frame rather than a graph slice.',
      'This reads the runtime frame only: binding, posture, mention handles, world watermarks, and lifecycle facts.',
      'Do not treat this as the per-turn AUTO choice surface; it reports the durable runtime frame the session is operating under.',
      'Graph-node mentions render as projected handles such as #D12 when available, not raw ids.',
    ],
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const details = projectSessionContext(ctx?.sessionManager);
      return {
        content: [{ type: 'text' as const, text: renderRuntimeFrame(details) }],
        details,
      };
    },
  });
}

export default registerBrunchContext;

function projectSessionContext(
  sessionManager: SessionManagerLike | undefined,
): RuntimeStateProjection | SessionRuntimeFrameRenderInput {
  const entries = sessionManager?.getEntries() ?? [];
  const header = entries.find(isSessionHeaderEntry);
  if (!header) {
    return { status: 'not_ready', reason: 'missing_session_header', sessionId: null };
  }

  const binding = entries.find(isSessionBindingEntry);
  if (!binding) {
    return { status: 'not_ready', reason: 'missing_binding', sessionId: header.id };
  }

  try {
    return projectSessionRuntimeState({
      header,
      binding: binding.data,
      entries: [...entries],
    });
  } catch (error) {
    if (error instanceof NonLinearTranscriptError) {
      return { status: 'not_ready', reason: 'non_linear', sessionId: header.id };
    }
    throw error;
  }
}

function isSessionHeaderEntry(entry: FileEntry): entry is BrunchSessionEnvelope['header'] {
  return entry.type === 'session' && typeof entry.id === 'string';
}
