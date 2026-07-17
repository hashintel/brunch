import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';

import { CandidatePlanSchema, parseCandidatePlan } from '../candidate-plan.js';
import { coherentCandidate } from './plan-synthesis-fixture.js';

describe('parseCandidatePlan', () => {
  it('parses a well-formed candidate with provenance intact', () => {
    const candidate = coherentCandidate();

    expect(parseCandidatePlan(candidate)).toEqual({ status: 'ok', candidate });
    expect(parseCandidatePlan(JSON.stringify(candidate))).toEqual({ status: 'ok', candidate });
  });

  it('fails closed on malformed input instead of returning a partial candidate', () => {
    expect(parseCandidatePlan('not json')).toMatchObject({ status: 'malformed_candidate' });
    expect(parseCandidatePlan(null)).toMatchObject({ status: 'malformed_candidate' });
    expect(parseCandidatePlan({ schemaVersion: 2 })).toMatchObject({
      status: 'malformed_candidate',
      message: 'unsupported candidate schema version: 2',
    });
    const missingGoal = {
      ...coherentCandidate(),
      slices: [{ id: 'task-1', epicId: 'F1', title: 'x' }],
    };
    expect(parseCandidatePlan(missingGoal)).toMatchObject({
      status: 'malformed_candidate',
      message: expect.stringMatching(/\/slices\/0.*goal/),
    });
  });

  it('has no command surface: unknown fields fail the canonical candidate schema', () => {
    const withCommand = {
      ...coherentCandidate(),
      resolvedActions: { verify: [{ command: 'rm', args: ['-rf', '/'] }] },
    };

    expect(Value.Check(CandidatePlanSchema, withCommand)).toBe(false);
    expect(parseCandidatePlan(withCommand)).toMatchObject({ status: 'malformed_candidate' });
  });

  it('treats blank or null scopeId as no scope instead of a malformed slice', () => {
    for (const blank of ['', '   ', null]) {
      const candidate = coherentCandidate();
      const input = {
        ...candidate,
        slices: candidate.slices.map((slice) => ({ ...slice, scopeId: blank })),
      };

      const result = parseCandidatePlan(JSON.parse(JSON.stringify(input)));

      expect(result.status).toBe('ok');
      if (result.status === 'ok') {
        expect(result.candidate.slices.every((slice) => slice.scopeId === undefined)).toBe(true);
      }
    }
  });

  it('uses the schema as the sole raw candidate acceptance authority', () => {
    const candidate = coherentCandidate();
    const samples = [
      candidate,
      { ...candidate, schemaVersion: 2 },
      { ...candidate, unexpected: true },
      {
        ...candidate,
        slices: candidate.slices.map((slice) => ({ ...slice, scopeId: null })),
      },
      {
        ...candidate,
        slices: candidate.slices.map((slice) => ({ ...slice, scopeId: '   ' })),
      },
    ];

    for (const sample of samples) {
      expect(parseCandidatePlan(sample).status === 'ok').toBe(Value.Check(CandidatePlanSchema, sample));
    }
  });
});
