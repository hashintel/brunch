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
import { readWorkspaceContext } from './get-cwd.js';

interface SessionManagerLike {
  getEntries(): readonly FileEntry[];
}

export function registerBrunchContext(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'read_workspace_context',
    label: 'Read Workspace Context',
    description:
      'Read a deterministic kickoff inventory of the current workspace cwd: .brunch presence, session-file sizes, visible top-level tree, and markdown sizes.',
    promptSnippet: 'Read the current workspace cwd kickoff inventory',
    promptGuidelines: [
      'Use read_workspace_context when you need filesystem kickoff context rather than graph or session state.',
      'This is a deterministic workspace inventory: .brunch presence, session-file sizes, visible top-level tree, and markdown sizes.',
      'The tree is gitignore-aware and read-only; ignored paths are excluded from counts and listings.',
    ],
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['cwd_inventory', 'workspace_overview'],
        },
      },
      required: ['mode'],
      additionalProperties: false,
    },
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (params.mode !== 'cwd_inventory' && params.mode !== 'workspace_overview') {
        const details = {
          status: 'structural_illegal' as const,
          diagnostics: [
            { field: 'mode', message: `unsupported workspace context mode: ${String(params.mode)}` },
          ],
        };
        return {
          content: [
            { type: 'text' as const, text: `STRUCTURAL_ILLEGAL\n- mode: ${details.diagnostics[0]!.message}` },
          ],
          details,
        };
      }

      const result = await readWorkspaceContext(params.mode, ctx?.sessionManager);
      return {
        content: [{ type: 'text' as const, text: result.text }],
        details: result.details,
      };
    },
  });

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
