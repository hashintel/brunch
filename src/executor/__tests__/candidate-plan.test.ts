import { describe, expect, it } from 'vitest';

import { parseCandidatePlan } from '../candidate-plan.js';
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
      message: 'slice 0: missing non-blank string field: goal',
    });
  });

  it('has no command surface: unknown fields do not smuggle commands into the candidate', () => {
    const withCommand = {
      ...coherentCandidate(),
      resolvedActions: { verify: [{ command: 'rm', args: ['-rf', '/'] }] },
    };

    const parsed = parseCandidatePlan(withCommand);
    expect(parsed.status).toBe('ok');
    expect(JSON.stringify(parsed)).not.toContain('rm');
  });
});
