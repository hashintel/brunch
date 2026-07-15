import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertCampaignDirectiveEvidence,
  runConsequentialFactCampaign,
  type CampaignRunnerPort,
} from '../consequential-fact-campaign-runner.js';
import { parseCampaignManifest } from '../consequential-fact-campaign.js';

const runs = [
  { runId: 'control-1', arm: 'control' },
  { runId: 'ablated-1', arm: 'ablated' },
  { runId: 'control-2', arm: 'control' },
  { runId: 'ablated-2', arm: 'ablated' },
  { runId: 'control-3', arm: 'control' },
  { runId: 'ablated-3', arm: 'ablated' },
] as const;

describe('consequential-fact production campaign entry', () => {
  it('drives startup, exact reveal, review gesture, collection, evaluator verdicts, and aggregate input', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fe1208-campaign-'));
    const actions: unknown[] = [];
    const collected: string[] = [];
    let screenIndex = 0;
    const screens = [
      'New specification title',
      'What compliance or audit constraints are missing?',
      'Review set: retain the source regulator clause identifier verbatim. [ Approve ]',
      '## Review: accepted',
    ];
    const port: CampaignRunnerPort = {
      async start() {
        screenIndex = 0;
        return { logPath: '/replay/provider-tui.log' };
      },
      async screen() {
        return screens[Math.min(screenIndex++, screens.length - 1)]!;
      },
      async act(_name, action) {
        actions.push(action);
      },
      async stop() {},
      async collect(input) {
        collected.push(input.runId);
        expect(input.viewport).toContain('Review: accepted');
        return { runId: input.runId, valid: true, atomicVerdicts: Array(6).fill('pass') };
      },
    };
    const manifest = {
      schemaVersion: 1,
      campaignId: 'fe1208-review-diff-v1',
      scenarioVersion: 'review-diff-source-clause/v1',
      actorVersion: 'review-diff-actor/v1',
      rubricVersion: 'consequential-fact/v1',
      provider: 'anthropic',
      model: 'fixed-model',
      thinking: 'low',
      providerSeed: 'unsupported',
      workspaceSeed: 'consequential-fact-review-diff/v1',
      setupRecipe: 'fresh workspace; create one empty Review Diff spec',
      turnBudget: 8,
      timeoutMs: 1000,
      tui: { cols: 120, rows: 40 },
      directive: { id: 'warrant-before-commit', hash: 'sha256:abc' },
      runs,
      validityRules: ['fresh_workspace', 'provider_request_matches_arm', 'actor_reaches_terminal'],
      replacementRule: 'mechanically invalid only; retain attempt',
      threshold: { controlMinimumPasses: 2, ablatedMaximumPasses: 1 },
      artifactRoot: root,
      boundedClaim: 'Evaluator discrimination only.',
    };

    const parsedManifest = parseCampaignManifest(manifest);
    expect(() =>
      assertCampaignDirectiveEvidence(parsedManifest, 'control', {
        schemaVersion: 1,
        runId: 'control-1',
        directives: [
          {
            id: 'warrant-before-commit',
            category: 'prompt_directive',
            state: ['absent'],
            resource: 'sha256:abc',
          },
        ],
        transcriptEffects: [],
      }),
    ).toThrow('mismatches campaign arm');

    const aggregate = await runConsequentialFactCampaign(parsedManifest, port);

    expect(collected).toEqual(runs.map((run) => run.runId));
    expect(actions).toHaveLength(18);
    expect(actions).toContainEqual({
      kind: 'type_text',
      text: 'Every accepted policy rewrite must retain its source regulator clause identifier verbatim.',
      submit: true,
    });
    expect(actions).toContainEqual({ kind: 'press_key', key: 'Enter' });
    expect(aggregate.control.valid).toBe(3);
    expect(JSON.parse(await readFile(join(root, 'aggregate-input.json'), 'utf8'))).toHaveLength(6);
  });

  it('fails mechanically instead of collecting when runtime screens are unknown', async () => {
    const port: CampaignRunnerPort = {
      async start() {
        return { logPath: '/replay/unknown.log' };
      },
      async screen() {
        return 'unrecognized';
      },
      async act() {},
      async stop() {},
      async collect() {
        throw new Error('must not collect');
      },
    };
    await expect(runConsequentialFactCampaign({ schemaVersion: 1 }, port)).rejects.toThrow('fixed campaign');
  });
});
