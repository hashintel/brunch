import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  assertControllerIsolation,
  loadEndToEndStudyContract,
  parseEndToEndStudyContract,
  type EndToEndStudyContract,
} from '../study-contract.js';

const HASH = `sha256:${'a'.repeat(64)}`;

function study(): EndToEndStudyContract {
  return {
    schemaVersion: 1,
    id: 'minimal-petri-net-editor-e2e-v1',
    caseId: 'minimal-petri-net-editor-v1',
    mission: {
      path: 'testing/comparisons/missions/minimal-petri-net-editor.md',
      sha256: HASH,
    },
    sharedBaseline: {
      path: 'testing/end-to-end-comparisons/cases/minimal-petri-net-editor/shared-baseline.md',
      sha256: HASH,
    },
    requirementRegistry: {
      path: 'testing/end-to-end-comparisons/cases/minimal-petri-net-editor/controller/requirement-registry.json',
      sha256: HASH,
    },
    executionContractTemplate: {
      path: 'testing/execution-comparisons/cases/minimal-petri-net-editor/public-contract.json',
      sha256: HASH,
    },
    oracle: {
      id: 'minimal-petri-net-editor-oracles-v2',
      manifestPath:
        'testing/execution-comparisons/cases/minimal-petri-net-editor/controller/oracle-manifest.json',
      manifestSha256: HASH,
    },
    budgets: {
      elicitation: {
        qualifyingQuestions: 8,
        targetTurns: 16,
        elapsedMinutes: 45,
        mechanicalInterventions: 2,
      },
      execution: { elapsedMinutes: 90, mechanicalInterventions: 2, substantiveHumanInterventions: 0 },
    },
    actorRecipes: {
      elicitation: 'agent-as-user-comparison/v1',
      execution: {
        brunch: 'brunch-empty-dir/v1',
        claude_code: 'claude-code-empty-dir/v1',
      },
    },
    specSources: ['brunch_spec', 'claude_spec'],
    executors: ['brunch', 'claude_code'],
  };
}

describe('end-to-end study contract', () => {
  it('loads the tracked case only when every frozen artifact hash still matches', async () => {
    const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
    const loaded = await loadEndToEndStudyContract({
      repositoryRoot,
      contractPath: fileURLToPath(
        new URL(
          '../../../../testing/end-to-end-comparisons/cases/minimal-petri-net-editor/study-contract.json',
          import.meta.url,
        ),
      ),
    });
    expect(loaded.contract.id).toBe('minimal-petri-net-editor-e2e-v1');
    expect(loaded.contractSha256).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it('loads the content-addressed prospect research study', async () => {
    const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
    const loaded = await loadEndToEndStudyContract({
      repositoryRoot,
      contractPath: fileURLToPath(
        new URL(
          '../../../../testing/end-to-end-comparisons/cases/prospect-research-workspace/study-contract.json',
          import.meta.url,
        ),
      ),
    });

    expect(loaded.contract).toMatchObject({
      id: 'prospect-research-workspace-e2e-v1',
      caseId: 'prospect-research-workspace-v1',
      oracle: { id: 'prospect-research-workspace-oracles-v1' },
      specSources: ['brunch_spec', 'claude_spec'],
      executors: ['brunch', 'claude_code'],
    });
  });

  it('accepts the frozen two-by-two study shape', () => {
    expect(parseEndToEndStudyContract(study())).toEqual(study());
  });

  it('rejects incomplete lanes, duplicate lanes, unsafe paths, and malformed identities', () => {
    expect(() => parseEndToEndStudyContract({ ...study(), specSources: ['brunch_spec'] })).toThrow(
      'invalid end-to-end study contract',
    );
    expect(() => parseEndToEndStudyContract({ ...study(), executors: ['brunch', 'brunch'] })).toThrow(
      'invalid end-to-end study contract',
    );
    expect(() =>
      parseEndToEndStudyContract({
        ...study(),
        mission: { ...study().mission, path: '../private-mission.md' },
      }),
    ).toThrow('invalid end-to-end study contract');
    expect(() =>
      parseEndToEndStudyContract({
        ...study(),
        sharedBaseline: { ...study().sharedBaseline, sha256: 'not-a-sha' },
      }),
    ).toThrow('invalid end-to-end study contract');
  });

  it('requires controller and target roots to be structurally disjoint', () => {
    expect(() =>
      assertControllerIsolation({
        controllerRoot: '/tmp/campaign/controller',
        targetRoots: ['/tmp/campaign/controller/targets/brunch'],
      }),
    ).toThrow('controller and target roots must be disjoint');
    expect(() =>
      assertControllerIsolation({
        controllerRoot: '/tmp/campaign/controller',
        targetRoots: ['/tmp/campaign'],
      }),
    ).toThrow('controller and target roots must be disjoint');
    expect(() =>
      assertControllerIsolation({
        controllerRoot: '/tmp/campaign/controller',
        targetRoots: ['/tmp/campaign/targets/brunch', '/tmp/campaign/targets/claude'],
      }),
    ).not.toThrow();
  });
});
