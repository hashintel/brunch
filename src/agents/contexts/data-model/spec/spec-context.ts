import { table, ul } from 'md-pen';

import type { GraphSlice } from '../../../../graph/index.js';
import type { ElicitationScratchpadItem } from '../../../../session/elicitation-scratchpad.js';
import type { WorkspaceSessionOverview } from '../../../../session/workspace-overview-context.js';
import { joinMarkdownBlocks } from '../../../shared/markdown.js';
import { section } from '../../../shared/section.js';
import { deriveGraphFactSeed, renderGraphFactSeed } from '../../seeds/graph-fact-seed.js';
import { formatElicitationScratchpad } from '../elicitation-scratchpad.js';
import { formatGraphOverview } from '../graph/graph-slice.js';

export interface SpecificationContextRenderInput {
  readonly spec: {
    readonly id: number;
    readonly title: string;
  };
  readonly graph: GraphSlice;
  readonly sessions: readonly WorkspaceSessionOverview[];
  readonly scratchpad: readonly ElicitationScratchpadItem[];
}

export function renderSpecificationContext(input: SpecificationContextRenderInput): string {
  return section(
    'specification',
    joinMarkdownBlocks(
      renderOverview(input),
      renderGraph(input.graph),
      renderGraphFactSeed(deriveGraphFactSeed(input.graph)),
      formatElicitationScratchpad(input.scratchpad),
      renderSessions(input.sessions),
    ),
  );
}

function renderOverview(input: SpecificationContextRenderInput): string {
  return `Overview:\n${ul([`id: ${input.spec.id}`, `title: ${input.spec.title}`])}`;
}

function renderGraph(graph: GraphSlice): string {
  return formatGraphOverview(graph, 'Graph');
}

function renderSessions(sessions: readonly WorkspaceSessionOverview[]): string {
  const rows: Array<Array<string | number>> = [['name', 'file', 'turns']];
  rows.push(...sessions.map((session) => ['—', session.file, session.turnCount]));
  return `Sessions:\n${table(rows)}`;
}
