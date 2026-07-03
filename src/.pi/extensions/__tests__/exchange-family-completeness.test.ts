import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { formatPresentCandidates } from '../../../agents/contexts/exchanges/present-candidates.js';
import { formatPresentQuestion } from '../../../agents/contexts/exchanges/present-question.js';
import { formatPresentReviewSet } from '../../../agents/contexts/exchanges/present-review-set.js';
import {
  formatRequestAnswer,
  formatRequestChoice,
  formatRequestChoices,
  formatRequestReview,
} from '../../../agents/contexts/exchanges/request-response.js';
import { COMPONENT_PREVIEW_REGISTRY } from '../../../dev/component-preview/registry.js';
import {
  PRESENT_CANDIDATES_TOOL,
  PRESENT_QUESTION_TOOL,
  PRESENT_REVIEW_SET_TOOL,
  REQUEST_RESPONSE_TOOL,
  registerStructuredExchange,
} from '../exchanges/index.js';

function registeredToolNames() {
  const tools = new Map<string, unknown>();
  registerStructuredExchange({
    registerTool(definition: { readonly name: string }) {
      tools.set(definition.name, definition);
    },
  } as never);
  return [...tools.keys()];
}

const snapshotRoot = join(process.cwd(), 'src/agents/contexts/exchanges/__snapshots__');

interface SnapshotCoverage {
  readonly file: string;
  readonly markers: readonly string[];
}

const exchangeFamilyCoverage = [
  {
    tool: PRESENT_QUESTION_TOOL,
    family: 'present_question',
    formatter: formatPresentQuestion,
    previewId: 'present-question',
    snapshots: [
      { file: 'question-tuples.md', markers: ['# free-text answered', '# single-choice answered'] },
    ],
  },
  {
    tool: PRESENT_CANDIDATES_TOOL,
    family: 'present_candidates',
    formatter: formatPresentCandidates,
    previewId: 'present-candidates',
    snapshots: [{ file: 'candidates-tuples.md', markers: ['# candidate selected'] }],
  },
  {
    tool: PRESENT_REVIEW_SET_TOOL,
    family: 'present_review_set',
    formatter: formatPresentReviewSet,
    previewId: 'present-review-set',
    snapshots: [
      { file: 'review-set-tuples.md', markers: ['# accepted', '# changes requested', '# rejected'] },
      { file: 'structural-illegal.md', markers: ['# STRUCTURAL_ILLEGAL'] },
    ],
  },
  {
    tool: REQUEST_RESPONSE_TOOL,
    family: 'request_answer',
    formatter: formatRequestAnswer,
    previewId: 'request-answer',
    snapshots: [{ file: 'question-tuples.md', markers: ['## Answer\n\nMake it clear.'] }],
  },
  {
    tool: REQUEST_RESPONSE_TOOL,
    family: 'request_choice',
    formatter: formatRequestChoice,
    previewId: 'request-choice',
    snapshots: [
      { file: 'question-tuples.md', markers: ['# single-choice answered', '- [x] 2. __Kitty__'] },
      { file: 'candidates-tuples.md', markers: ['# candidate selected', '- [x] 1. __Local workbench__'] },
    ],
  },
  {
    tool: REQUEST_RESPONSE_TOOL,
    family: 'request_choices',
    formatter: formatRequestChoices,
    previewId: 'request-choices',
    snapshots: [
      {
        file: 'question-tuples.md',
        markers: ['# multi-choice answered with write-in', '*Other:* Schema source-of-truth drift'],
      },
    ],
  },
  {
    tool: REQUEST_RESPONSE_TOOL,
    family: 'request_review',
    formatter: formatRequestReview,
    previewId: 'request-review',
    snapshots: [
      { file: 'review-set-tuples.md', markers: ['## Review: accepted', '## Review: changes requested'] },
    ],
  },
] as const;

describe('structured exchange family completeness', () => {
  it('keeps the coverage table in sync with registered exchange tools', () => {
    expect(registeredToolNames()).toEqual([
      PRESENT_QUESTION_TOOL,
      PRESENT_REVIEW_SET_TOOL,
      PRESENT_CANDIDATES_TOOL,
      REQUEST_RESPONSE_TOOL,
    ]);
    expect(new Set(exchangeFamilyCoverage.map((row) => row.tool))).toEqual(new Set(registeredToolNames()));
  });

  it('covers every registered exchange family with a formatter, preview entry, and snapshot', () => {
    const previewIds = new Set(COMPONENT_PREVIEW_REGISTRY.map((entry) => entry.id));

    for (const row of exchangeFamilyCoverage) {
      expect(row.formatter, `${row.family} formatter`).toEqual(expect.any(Function));
      expect(previewIds.has(row.previewId), `${row.family} preview ${row.previewId}`).toBe(true);
      for (const snapshot of row.snapshots) {
        expectSnapshotMarkers(row.family, snapshot);
      }
    }
  });
});

function expectSnapshotMarkers(family: string, snapshot: SnapshotCoverage) {
  const text = readFileSync(join(snapshotRoot, snapshot.file), 'utf8');
  for (const marker of snapshot.markers) {
    expect(text, `${family} snapshot ${snapshot.file} marker ${marker}`).toContain(marker);
  }
}
