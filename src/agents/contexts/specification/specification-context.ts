import type { ElicitationGap, GraphSlice } from '../../../graph/index.js';
import type { WorkspaceSessionOverview } from '../../../session/workspace-overview-context.js';
import { formatGraphOverview } from '../graph/graph-slice.js';
import { joinMarkdownBlocks, markdownTable, markdownUl } from '../primitives/markdown.js';
import { section } from '../primitives/section.js';
import { renderToonBlock, type ToonRecord } from '../primitives/toon.js';
import { renderSoftReadinessEstimate } from '../session/readiness-estimate.js';

export interface SpecificationContextRenderInput {
  readonly spec: {
    readonly id: number;
    readonly title: string;
  };
  readonly graph: GraphSlice;
  readonly sessions: readonly WorkspaceSessionOverview[];
  readonly gaps: readonly ElicitationGap[];
  readonly readinessGaps: readonly ElicitationGap[];
}

export function renderSpecificationContext(input: SpecificationContextRenderInput): string {
  return section(
    'specification',
    joinMarkdownBlocks(
      renderOverview(input),
      renderGraph(input.graph),
      renderGaps(input.gaps),
      renderSessions(input.sessions),
    ),
  );
}

function renderOverview(input: SpecificationContextRenderInput): string {
  return `Overview:\n${markdownUl([
    `id: ${input.spec.id}`,
    `title: ${input.spec.title}`,
    renderSoftReadinessEstimate(input.readinessGaps),
  ])}`;
}

function renderGraph(graph: GraphSlice): string {
  return formatGraphOverview(graph, 'Graph');
}

function renderSessions(sessions: readonly WorkspaceSessionOverview[]): string {
  const rows: Array<Array<string | number>> = [['name', 'file', 'turns']];
  rows.push(...sessions.map((session) => ['—', session.file, session.turnCount]));
  return `Sessions:\n${markdownTable(rows)}`;
}

function renderGaps(gaps: readonly ElicitationGap[]): string {
  return `Gaps:\n${renderToonBlock(gaps.map(toGapRecord))}`;
}

function toGapRecord(gap: ElicitationGap): ToonRecord {
  return {
    id: gap.id,
    band: gap.band,
    refersTo: gap.refersTo,
    importance: gap.importance,
    coverage: gap.coverage,
    question: gap.question,
  };
}
