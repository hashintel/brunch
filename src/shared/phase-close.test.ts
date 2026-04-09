import { describe, expect, it } from 'vitest';

import {
  createForcedPhaseClosureConfirmation,
  createRecommendedPhaseClosureConfirmation,
  dataConfirmationSchema,
  parsePhaseClosureCommand,
} from './phase-close.js';

describe('phase-close commands', () => {
  it('parses interviewer-recommended proposal confirmations into an explicit command', () => {
    expect(
      parsePhaseClosureCommand({
        turnId: 5,
        phase: 'design',
        confirmed: true,
        closureBasis: 'interviewer_recommended',
      }),
    ).toEqual({
      kind: 'confirm-proposed-phase-closure',
      proposalTurnId: 5,
      phase: 'design',
      closureBasis: 'interviewer_recommended',
    });
  });

  it('parses user-forced phase closes into an explicit command', () => {
    expect(
      parsePhaseClosureCommand({ phase: 'design', confirmed: true, closureBasis: 'user_forced' }),
    ).toEqual({
      kind: 'force-close-active-phase',
      phase: 'design',
      closureBasis: 'user_forced',
    });
  });

  it('treats unconfirmed confirmation payloads as non-commands', () => {
    expect(parsePhaseClosureCommand({ turnId: 5, confirmed: false })).toBeNull();
  });

  it('builds interviewer-recommended confirmation payloads that still validate through the existing schema', () => {
    expect(dataConfirmationSchema.parse(createRecommendedPhaseClosureConfirmation('scope', 7))).toEqual({
      turnId: 7,
      phase: 'scope',
      confirmed: true,
      closureBasis: 'interviewer_recommended',
    });
  });

  it('builds forced-close confirmation payloads that still validate through the existing schema', () => {
    expect(dataConfirmationSchema.parse(createForcedPhaseClosureConfirmation('design'))).toEqual({
      phase: 'design',
      confirmed: true,
      closureBasis: 'user_forced',
    });
  });
});
