import type { ElicitationGap, GraphSlice } from '../../graph/index.js';
import type { WorkspaceSessionOverview } from '../../session/workspace-overview-context.js';
import { joinMarkdownBlocks, markdownTable, markdownUl } from '../markdown.js';
import { section } from '../section.js';
import { renderSoftReadinessEstimate } from '../session/readiness-estimate.js';
import { renderToonBlock, type ToonRecord } from '../toon.js';

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
    joinMarkdownBlocks(renderOverview(input), renderSessions(input.sessions), renderGaps(input.gaps)),
  );
}

function renderOverview(input: SpecificationContextRenderInput): string {
  return `Overview:\n${markdownUl([
    `id: ${input.spec.id}`,
    `title: ${input.spec.title}`,
    `graph: ${input.graph.nodes.length} nodes, ${input.graph.edges.length} edges (LSN ${input.graph.lsn})`,
    renderSoftReadinessEstimate(input.readinessGaps),
  ])}`;
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
