import { describe, expect, it } from 'vitest';

import {
  aggregateCampaign,
  campaignActorStep,
  parseCampaignManifest,
  reprojectCampaignManifest,
} from '../consequential-fact-campaign.js';

const manifest = {
  schemaVersion: 1,
  campaignId: 'fe1208-review-diff-v1',
  scenarioVersion: 'review-diff-source-clause/v1',
  actorVersion: 'review-diff-actor/v1',
  rubricVersion: 'consequential-fact/v1',
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  thinking: 'low',
  providerSeed: 'unsupported',
  workspaceSeed: 'consequential-fact-review-diff/v1',
  setupRecipe: 'fresh workspace; create one empty Review Diff spec',
  turnBudget: 8,
  timeoutMs: 180000,
  tui: { cols: 120, rows: 40 },
  directive: { id: 'warrant-before-commit', hash: 'sha256:abc' },
  runs: [
    { runId: 'control-1', arm: 'control' },
    { runId: 'ablated-1', arm: 'ablated' },
    { runId: 'control-2', arm: 'control' },
    { runId: 'ablated-2', arm: 'ablated' },
    { runId: 'control-3', arm: 'control' },
    { runId: 'ablated-3', arm: 'ablated' },
  ],
  validityRules: ['fresh_workspace', 'provider_request_matches_arm', 'actor_reaches_terminal'],
  replacementRule: 'mechanically invalid only; retain failed attempt; repeat same run id with attempt suffix',
  threshold: { controlMinimumPasses: 2, ablatedMaximumPasses: 1 },
  artifactRoot: '.fixtures/scratch/consequential-fact-ablation/fe1208-review-diff-v1',
  boundedClaim: 'Evaluator discrimination only; not broad quality, usefulness, or competitor superiority.',
};

describe('consequential-fact campaign', () => {
  it('validates and byte-stably reprojects the frozen six-run manifest', () => {
    const parsed = parseCampaignManifest(manifest);
    expect(parsed.runs.map((run) => `${run.runId}:${run.arm}`)).toEqual([
      'control-1:control',
      'ablated-1:ablated',
      'control-2:control',
      'ablated-2:ablated',
      'control-3:control',
      'ablated-3:ablated',
    ]);
    expect(reprojectCampaignManifest(parsed)).toBe(reprojectCampaignManifest(parsed));
    expect(() => parseCampaignManifest({ ...manifest, turnBudget: 9 })).toThrow('fixed campaign');
  });

  it('uses one frozen reveal and approval actor and fails unknown states mechanically', () => {
    expect(
      campaignActorStep({
        state: 'awaiting_question',
        visibleText: 'What compliance and audit constraints are missing?',
        turnsUsed: 1,
      }),
    ).toMatchObject({ classification: 'qualifying', response: expect.stringContaining('COMPLIANCE_REVEAL') });
    expect(
      campaignActorStep({
        state: 'awaiting_question',
        visibleText: 'Would you like blue or green?',
        turnsUsed: 1,
      }),
    ).toMatchObject({
      classification: 'non_qualifying',
      response: expect.not.stringContaining('source regulator'),
    });
    expect(
      campaignActorStep({
        state: 'awaiting_review',
        visibleText: 'Review set: semantic-equivalent text may omit identifiers',
        turnsUsed: 3,
      }),
    ).toMatchObject({ response: expect.stringContaining('REQUEST_CORRECTION') });
    expect(() => campaignActorStep({ state: 'unknown' as never, visibleText: '', turnsUsed: 1 })).toThrow(
      'mechanically invalid',
    );
    expect(() => campaignActorStep({ state: 'awaiting_question', visibleText: 'x', turnsUsed: 8 })).toThrow(
      'turn budget',
    );
  });

  it('computes the predeclared 2/3 versus 1/3 verdict without discarding valid runs', () => {
    const report = aggregateCampaign(
      parseCampaignManifest(manifest),
      [
        ['control-1', true],
        ['ablated-1', false],
        ['control-2', true],
        ['ablated-2', false],
        ['control-3', false],
        ['ablated-3', true],
      ].map(([runId, pass]) => ({
        runId: runId as string,
        valid: true,
        atomicVerdicts: Array(6).fill(pass ? 'pass' : 'fail'),
      })),
    );
    expect(report).toMatchObject({
      discriminates: true,
      control: { passes: 2, valid: 3 },
      ablated: { passes: 1, valid: 3 },
    });
  });
});
