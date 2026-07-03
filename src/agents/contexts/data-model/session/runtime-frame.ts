import type { RuntimeStateProjection } from '../../../../projections/session/runtime-state.js';
import { operationalModeLabel } from '../../../../session/schema/kinds.js';

export type SessionRuntimeFrameRenderInput =
  | RuntimeStateProjection
  | {
      status: 'not_ready';
      reason: 'missing_session_header' | 'missing_binding' | 'non_linear';
      sessionId: string | null;
    };

export function renderRuntimeFrame(input: SessionRuntimeFrameRenderInput): string {
  if (input.status === 'not_ready') {
    return [
      '[Selected session runtime frame]',
      '- status: not_ready',
      `- reason: ${input.reason}`,
      `- session: ${input.sessionId ?? 'unrecorded'}`,
    ].join('\n');
  }

  const lines = [
    '[Selected session runtime frame]',
    '- status: ready',
    `- binding: spec #${input.specId}; session ${input.sessionId}`,
    `- agent: mode=${operationalModeLabel(input.agent.operationalMode)} (id=${input.agent.operationalMode}); role=${input.agent.role}`,
    `- graph mentions: ${renderGraphMentions(input.mentions.graphNodes)}`,
    `- file mentions: ${renderFileMentions(input.mentions.files)}`,
    `- world: graph_lsn=${input.world.graph.latestLsn ?? 'unknown'}; git_head=${input.world.git.head ?? 'unknown'}`,
    `- lifecycle: spec_origin=${input.lifecycle.specOrigin ?? 'unknown'}; session_origin=${input.lifecycle.sessionOrigin ?? 'unknown'}; session_index=${input.lifecycle.sessionIndexInSpec ?? 'unknown'}; first=${renderBoolean(input.lifecycle.isFirstSessionForSpec)}; tenth=${renderBoolean(input.lifecycle.isTenthSessionForSpec)}`,
  ];

  return lines.join('\n');
}

function renderGraphMentions(graphNodes: RuntimeStateProjection['mentions']['graphNodes']): string {
  if (graphNodes.length === 0) return 'none';

  return graphNodes
    .map((mention) => {
      const code = mention.handle ? `#${mention.handle}` : '(unprojected mention)';
      const title = mention.title ? ` ${mention.title}` : '';
      const seen = mention.seenLsn !== undefined ? ` @lsn ${mention.seenLsn}` : '';
      return `${code}${title}${seen}`;
    })
    .join(', ');
}

function renderFileMentions(files: RuntimeStateProjection['mentions']['files']): string {
  if (files.length === 0) return 'none';

  return files
    .map((file) => (file.seenGitHead ? `${file.path} @git ${file.seenGitHead}` : file.path))
    .join(', ');
}

function renderBoolean(value: boolean | null): string {
  return value === null ? 'unknown' : value ? 'yes' : 'no';
}
