import { describe, expect, it } from 'vitest';

import type { CandidatePlan } from '../candidate-plan.js';
import type { CapabilityProvider } from '../capability-providers.js';
import { validateCandidatePlan } from '../plan-validation.js';
import type { PlanningProjection } from '../planning-projection.js';
import { coherentCandidate, item, projection, PYTEST_PROVIDER } from './plan-synthesis-fixture.js';

const NODE_TEST_PROVIDER: CapabilityProvider = {
  id: 'node-test',
  capabilities: {
    'node.script.test': {
      domain: 'verify-runner',
      actions: { setup: [], build: [], verify: [] },
    },
  },
};
const providers = [PYTEST_PROVIDER, NODE_TEST_PROVIDER];

function validate(candidate: CandidatePlan, detected = [] as never[]) {
  return validateCandidatePlan({ candidate, projection, detected, providers });
}

function codes(candidate: CandidatePlan) {
  return validate(candidate).findings.map((finding) => finding.code);
}

describe('validateCandidatePlan', () => {
  it('validates a fully coherent candidate with zero error findings', () => {
    const result = validate(coherentCandidate());

    expect(result.findings).toEqual([]);
    expect(result.executionContract.resolvedActions.verify).toEqual([
      { capabilityId: 'python.pytest', providerId: 'python-pytest', command: 'pytest', args: [] },
    ]);
  });

  it('rejects a candidate bound to a different spec', () => {
    expect(codes({ ...coherentCandidate(), specId: '8' })).toContain('spec_id_mismatch');
  });

  it('flags membership defects: unknown epic, missing scope, unknown scope', () => {
    const base = coherentCandidate();
    expect(codes({ ...base, slices: [{ ...base.slices[0]!, epicId: 'F9' }, base.slices[1]!] })).toContain(
      'slice_epic_unknown',
    );
    const { scopeId: _dropped, ...scopeless } = base.slices[0]!;
    expect(codes({ ...base, slices: [scopeless, base.slices[1]!] })).toContain('slice_scope_missing');
    expect(codes({ ...base, slices: [{ ...base.slices[0]!, scopeId: 'SCP9' }, base.slices[1]!] })).toContain(
      'slice_scope_unknown',
    );
  });

  it('flags unknown ids across requirements, criteria, design, verification, and dependencies', () => {
    const base = coherentCandidate();
    expect(
      codes({ ...base, slices: [{ ...base.slices[0]!, requirementIds: ['REQ9'] }, base.slices[1]!] }),
    ).toContain('unknown_requirement');
    expect(
      codes({ ...base, slices: [{ ...base.slices[0]!, criterionIds: ['AC9'] }, base.slices[1]!] }),
    ).toContain('unknown_criterion');
    expect(
      codes({ ...base, slices: [{ ...base.slices[0]!, designItemIds: ['MOD9'] }, base.slices[1]!] }),
    ).toContain('unknown_design_item');
    expect(
      codes({ ...base, slices: [{ ...base.slices[0]!, verificationItemIds: ['CH9'] }, base.slices[1]!] }),
    ).toContain('unknown_verification_item');
    expect(
      codes({ ...base, slices: [base.slices[0]!, { ...base.slices[1]!, dependsOn: ['task-9'] }] }),
    ).toContain('dependency_unknown');
  });

  it('rejects scoped slices whose worker context would fail at execution', () => {
    const base = coherentCandidate();
    const first = base.slices[0]!;
    const aggregateCoveragePreserved = {
      ...base,
      slices: [
        { ...first, criterionIds: [] },
        { ...base.slices[1]!, criterionIds: ['AC1', 'AC2'] },
      ],
    };

    expect(codes(aggregateCoveragePreserved)).toContain('slice_without_criterion');
    expect(codes(aggregateCoveragePreserved)).not.toContain('criterion_dropped');
    expect(codes({ ...base, slices: [{ ...first, designItemIds: [] }, base.slices[1]!] })).toContain(
      'slice_without_design_context',
    );
    expect(codes({ ...base, slices: [{ ...first, verificationItemIds: [] }, base.slices[1]!] })).toContain(
      'slice_without_verification_context',
    );
  });

  it('flags dependency cycles through the shared cycle helper', () => {
    const base = coherentCandidate();
    const cyclic = {
      ...base,
      slices: [
        { ...base.slices[0]!, dependsOn: ['task-2'] },
        { ...base.slices[1]!, dependsOn: ['task-1'] },
      ],
    };

    const findings = validate(cyclic).findings.filter((finding) => finding.code === 'dependency_cycle');
    expect(
      findings.map((finding) => finding.itemId).sort((left = '', right = '') => left.localeCompare(right)),
    ).toEqual(['task-1', 'task-2']);
  });

  it('sequences every shared greenfield root carrier after one project foundation slice', () => {
    const foundation = item('MOD_ROOT', 20, 'Project foundation');
    const firstScope = projection.scopes[0]!;
    const sharedRootProjection: PlanningProjection = {
      ...projection,
      scopes: [
        { ...firstScope, design: [...firstScope.design, foundation] },
        {
          ...firstScope,
          itemId: 'SCP2',
          nodeId: 21,
          title: 'Second scope',
          design: [...firstScope.design, foundation],
        },
      ],
    };
    const base = coherentCandidate();
    const parallelRootCarriers: CandidatePlan = {
      ...base,
      slices: [
        {
          ...base.slices[0]!,
          title: 'Initialize the repository and feature core',
          designItemIds: ['MOD1', 'MOD_ROOT'],
        },
        {
          ...base.slices[1]!,
          scopeId: 'SCP2',
          dependsOn: [],
          designItemIds: ['MOD1', 'MOD_ROOT'],
        },
      ],
    };
    const validateSharedRoot = (candidate: CandidatePlan) =>
      validateCandidatePlan({
        candidate,
        projection: sharedRootProjection,
        detected: [],
        providers,
      }).findings.map((finding) => finding.code);

    expect(validateSharedRoot(parallelRootCarriers)).toContain('shared_foundation_unsequenced');
    const sequenced = validateSharedRoot({
      ...parallelRootCarriers,
      slices: [
        parallelRootCarriers.slices[0]!,
        {
          ...parallelRootCarriers.slices[1]!,
          dependsOn: [parallelRootCarriers.slices[0]!.id],
          designItemIds: ['MOD1'],
        },
      ],
    });
    expect(sequenced).not.toContain('shared_foundation_unsequenced');
    expect(sequenced).not.toContain('design_dropped');
  });

  it('requires one integrated terminal slice for frontier-verified multi-slice epics', () => {
    const base = coherentCandidate();
    const first = base.slices[0]!;
    const terminal = base.slices[1]!;
    const independent = {
      ...base,
      slices: [first, { ...terminal, dependsOn: [] }],
    };
    const terminalDropsFrontierCriterion = {
      ...base,
      slices: [
        { ...first, criterionIds: ['AC1', 'AC2'] },
        { ...terminal, criterionIds: ['AC1'] },
      ],
    };

    expect(codes(independent)).toContain('epic_integration_unreconciled');
    expect(codes(terminalDropsFrontierCriterion)).toContain('epic_integration_unreconciled');
    expect(codes(base)).not.toContain('epic_integration_unreconciled');
    expect(
      codes({
        ...base,
        slices: [
          {
            ...terminal,
            requirementIds: ['REQ1', 'REQ2'],
            criterionIds: ['AC1', 'AC2'],
            dependsOn: [],
          },
        ],
      }),
    ).not.toContain('epic_integration_unreconciled');

    const requirementOnlyProjection = {
      ...projection,
      criteria: projection.criteria.map((criterion) => ({
        ...criterion,
        verifiesFrontiers: [],
      })),
    };
    expect(
      validateCandidatePlan({
        candidate: independent,
        projection: requirementOnlyProjection,
        detected: [],
        providers,
      }).findings.map((finding) => finding.code),
    ).not.toContain('epic_integration_unreconciled');
  });

  it('flags dropped scope obligations: uncovered requirement, dropped criterion/design/verification', () => {
    const base = coherentCandidate();
    const oneSlice = { ...base, slices: [base.slices[0]!] };

    const found = codes(oneSlice);
    expect(found).toContain('scope_requirement_uncovered');
    expect(found).toContain('criterion_dropped');
  });

  it('fails a rival that drops the elicited stack commitment (oracle 6)', () => {
    const base = coherentCandidate();
    const rival = { ...base, requiredCapabilities: [] };

    expect(codes(rival)).toContain('no_verification_capability');
  });

  it('blocks unsupported and conflicting capabilities instead of resolving them', () => {
    const base = coherentCandidate();
    expect(codes({ ...base, requiredCapabilities: [{ id: 'ruby.rspec', sourceItemId: 'DEC1' }] })).toContain(
      'capability_unsupported',
    );
    expect(
      validateCandidatePlan({
        candidate: base,
        projection,
        detected: [{ id: 'node.script.test', source: { kind: 'detected', path: 'package.json' } }],
        providers,
      }).findings.map((finding) => finding.code),
    ).toContain('capability_conflict');
    expect(
      codes({ ...base, requiredCapabilities: [{ id: 'python.pytest', sourceItemId: 'DEC9' }] }),
    ).toContain('unknown_commitment_source');
  });

  it('flags structural hygiene defects: duplicates, empty epics, zero coverage', () => {
    const base = coherentCandidate();
    expect(codes({ ...base, epics: [...base.epics, ...base.epics] })).toContain('duplicate_id');
    expect(
      codes({
        ...base,
        epics: [...base.epics, { id: 'F2', title: 'Empty', dependsOn: [], verificationCriterionIds: [] }],
      }),
    ).toContain('epic_empty');
    expect(
      codes({
        ...base,
        slices: base.slices.map((slice) => ({ ...slice, requirementIds: [] })),
      }),
    ).toEqual(expect.arrayContaining(['slice_without_requirement', 'zero_coverage']));
  });

  it('accepts verification citations of projection-level V&V commitments without scopes', () => {
    const scopeless = {
      ...projection,
      scopes: [],
      commitments: {
        ...projection.commitments,
        verification: [item('CH9', 30, 'Given fresh clone, cargo build exits 0')],
      },
    };
    const candidate = coherentCandidate();
    const cited = {
      ...candidate,
      slices: candidate.slices.map(({ scopeId: _scopeId, ...slice }) => ({
        ...slice,
        designItemIds: [],
        verificationItemIds: ['CH9'],
      })),
    };

    const result = validateCandidatePlan({
      candidate: cited,
      projection: scopeless,
      detected: [],
      providers: [PYTEST_PROVIDER],
    });

    expect(result.findings.filter((f) => f.code === 'unknown_verification_item')).toEqual([]);
  });
});
