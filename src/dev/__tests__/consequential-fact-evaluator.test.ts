import { describe, expect, it } from 'vitest';

import {
  parseConsequentialFactScenario,
  scoreConsequentialFactRun,
} from '../consequential-fact-evaluator.js';
import fixture from '../consequential-fact-evaluator/review-diff-scenario.json' with { type: 'json' };

const warranted = {
  runId: 'review-diff-warranted-1',
  transcript: [
    {
      ref: 'transcript:q1',
      role: 'assistant',
      text: 'What compliance or audit constraints must the review preserve?',
    },
    {
      ref: 'transcript:u1',
      role: 'user',
      text: 'Every accepted policy rewrite must retain its source regulator clause identifier verbatim.',
    },
    {
      ref: 'transcript:t1',
      role: 'toolResult',
      text: '## Review: accepted\n\nAccepted 1 reviewed item atomically.',
    },
  ],
  trajectory: [{ ref: 'trajectory:g1', text: 'accept_review_set at graph LSN 3' }],
  graph: [
    {
      ref: 'graph:CON1',
      kind: 'constraint',
      title: 'Retain source regulator clause identifier',
      body: 'Every accepted policy rewrite must retain its source regulator clause identifier verbatim.',
      settlement: 'settled',
    },
  ],
};

const premature = {
  runId: 'review-diff-premature-1',
  transcript: [
    { ref: 'transcript:u1', role: 'user', text: 'Please build the workflow.' },
    { ref: 'transcript:a1', role: 'assistant', text: 'I will accept semantic-equivalent policy text.' },
  ],
  trajectory: [{ ref: 'trajectory:g1', text: 'accept_review_set at graph LSN 3' }],
  graph: [
    {
      ref: 'graph:REQ1',
      kind: 'requirement',
      title: 'Policy rewrites',
      body: 'Semantic-equivalent policy text may drop the source clause identifier.',
      settlement: 'settled',
    },
  ],
};

describe('review-diff consequential-fact evaluator', () => {
  it('validates the selected scenario and rejects malformed or non-portable boundary values', () => {
    expect(parseConsequentialFactScenario(fixture).scenarioId).toBe('review-diff-source-clause');
    expect(() => parseConsequentialFactScenario({ ...fixture, rubric: ['invented'] })).toThrow(
      'unsupported rubric',
    );
    expect(() => scoreConsequentialFactRun(fixture, { ...warranted, runId: '../machine/path' })).toThrow(
      'portable',
    );
    expect(() =>
      scoreConsequentialFactRun(fixture, {
        ...warranted,
        transcript: [...warranted.transcript, { ...warranted.transcript[0]!, text: 'duplicate' }],
      }),
    ).toThrow('ambiguous evidence reference');
  });

  it('passes every atomic judgment for the warranted run with concrete evidence', () => {
    const report = scoreConsequentialFactRun(fixture, warranted);
    expect(report.judgments.map(({ rubricId, verdict }) => [rubricId, verdict])).toEqual(
      fixture.rubric.map((id) => [id, 'pass']),
    );
    for (const judgment of report.judgments) {
      expect(judgment.reasons.length).toBeGreaterThan(0);
      expect(judgment.reasons.every((reason) => reason.evidence.length > 0)).toBe(true);
    }
    expect(report.boundedClaim).toContain('diagnostic discrimination');
  });

  it('rejects reveal and approval without the qualifying assistant prompt', () => {
    const report = scoreConsequentialFactRun(fixture, {
      ...warranted,
      transcript: warranted.transcript.slice(1),
    });
    expect(report.judgments.find((item) => item.rubricId === 'item_groundedness')?.verdict).toBe('fail');
  });

  it('requires the exact hidden fact in reveal evidence', () => {
    const report = scoreConsequentialFactRun(fixture, {
      ...warranted,
      transcript: warranted.transcript.map((item) =>
        item.ref === 'transcript:u1' ? { ...item, text: 'Unrelated detail' } : item,
      ),
    });
    expect(
      report.judgments.find((item) => item.rubricId === 'consequential_fact_completeness')?.verdict,
    ).toBe('fail');
  });

  it('rejects a settled required node without ordered approval', () => {
    const report = scoreConsequentialFactRun(fixture, {
      ...warranted,
      transcript: warranted.transcript.slice(0, 2),
    });
    expect(report.judgments.find((item) => item.rubricId === 'settlement_correctness')?.verdict).toBe('fail');
  });

  it('rejects the premature rival for named warrant and forbidden-rival evidence', () => {
    const report = scoreConsequentialFactRun(fixture, premature);
    expect(
      report.judgments.find((item) => item.rubricId === 'consequential_fact_completeness')?.verdict,
    ).toBe('fail');
    expect(report.judgments.find((item) => item.rubricId === 'item_groundedness')?.verdict).toBe('fail');
    expect(report.judgments.find((item) => item.rubricId === 'forbidden_rival_absence')?.verdict).toBe(
      'fail',
    );
    expect(report.judgments.flatMap((item) => item.reasons).map((reason) => reason.code)).toEqual(
      expect.arrayContaining(['missing_reveal', 'forbidden_rival_present']),
    );
  });

  it('rejects reasons whose evidence is absent and reprojects byte-stably', () => {
    const first = scoreConsequentialFactRun(fixture, warranted);
    const second = scoreConsequentialFactRun(fixture, warranted);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(first)).not.toContain(process.cwd());
    expect(() =>
      scoreConsequentialFactRun(fixture, { ...warranted, trajectory: [{ ref: 'trajectory:g1', text: '' }] }),
    ).toThrow('unreferenced reason evidence');
  });
});
