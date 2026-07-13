import { describe, expect, it } from 'vitest';

import type { CandidatePlan } from '../candidate-plan.js';
import { defaultCapabilityProviders } from '../capability-providers.js';
import { validateCandidatePlan } from '../plan-validation.js';
import { coherentCandidate, projection, PYTEST_PROVIDER } from './plan-synthesis-fixture.js';

const providers = [...defaultCapabilityProviders(), PYTEST_PROVIDER];

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
    expect(findings.map((finding) => finding.itemId).sort()).toEqual(['task-1', 'task-2']);
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
        detected: [{ id: 'node.npm-test', source: { kind: 'detected', path: 'package.json' } }],
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
});
