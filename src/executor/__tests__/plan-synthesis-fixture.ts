import type { CandidatePlan } from '../candidate-plan.js';
import type { CapabilityProvider } from '../capability-providers.js';
import type { PlanningProjection } from '../planning-projection.js';

export const item = (itemId: string, nodeId: number, content: string) => ({
  itemId,
  nodeId,
  title: content,
  content,
  dependsOn: [] as const,
});

export const PYTEST_PROVIDER: CapabilityProvider = {
  id: 'python-pytest',
  capabilities: {
    'python.pytest': {
      domain: 'verify-runner',
      actions: { setup: [], build: [], verify: [{ command: 'pytest', args: [] }] },
    },
  },
};

// A scope-bearing projection whose DEC1 commitment names a Python stack (oracle 6 seed).
export const projection: PlanningProjection = {
  schemaVersion: 1,
  specId: '7',
  mode: 'greenfield',
  requirements: [
    { ...item('REQ1', 1, 'Build feature'), frontierId: 'F1' },
    { ...item('REQ2', 2, 'Wire feature'), dependsOn: ['REQ1'], frontierId: 'F1' },
  ],
  criteria: [
    { ...item('AC1', 3, 'Feature is visible'), verifiesRequirements: ['REQ1'], verifiesFrontiers: [] },
    {
      ...item('AC2', 4, 'Feature wired end to end'),
      verifiesRequirements: ['REQ2'],
      verifiesFrontiers: ['F1'],
    },
  ],
  frontiers: [
    {
      ...item('F1', 5, 'Deliver feature'),
      requirementIds: ['REQ1', 'REQ2'],
      verificationCriterionIds: ['AC2'],
    },
  ],
  scopes: [
    {
      ...item('SCP1', 6, 'Deliver the feature scope.'),
      frontierIds: ['F1'],
      requirementIds: ['REQ1', 'REQ2'],
      criteria: [
        { ...item('AC1', 3, 'Feature is visible'), verifiesRequirements: ['REQ1'], verifiesFrontiers: [] },
        {
          ...item('AC2', 4, 'Feature wired end to end'),
          verifiesRequirements: ['REQ2'],
          verifiesFrontiers: ['F1'],
        },
      ],
      design: [item('MOD1', 7, 'Feature module')],
      verification: [item('CH1', 8, 'Smoke test')],
    },
  ],
  commitments: {
    constraints: [],
    invariants: [],
    decisions: [item('DEC1', 9, 'Implementation and verification run on Python with pytest.')],
  },
};

export function coherentCandidate(): CandidatePlan {
  return {
    schemaVersion: 1,
    specId: '7',
    epics: [{ id: 'F1', title: 'Deliver feature', dependsOn: [], verificationCriterionIds: ['AC2'] }],
    slices: [
      {
        id: 'task-1',
        epicId: 'F1',
        scopeId: 'SCP1',
        title: 'Build feature',
        goal: 'Build the feature core.',
        doneCriteria: ['Feature core compiles and is importable.'],
        requirementIds: ['REQ1'],
        criterionIds: ['AC1'],
        dependsOn: [],
        designItemIds: ['MOD1'],
        verificationItemIds: ['CH1'],
      },
      {
        id: 'task-2',
        epicId: 'F1',
        scopeId: 'SCP1',
        title: 'Wire feature',
        goal: 'Wire the feature end to end.',
        doneCriteria: [],
        requirementIds: ['REQ2'],
        criterionIds: ['AC2'],
        dependsOn: ['task-1'],
        designItemIds: ['MOD1'],
        verificationItemIds: ['CH1'],
      },
    ],
    requiredCapabilities: [{ id: 'python.pytest', sourceItemId: 'DEC1' }],
  };
}
