import { describe, expect, it } from 'vitest';

import type { ExecutablePlanDraft } from '../executable-plan-draft.js';
import { previewPlan } from '../plan-preview.js';

const draft: ExecutablePlanDraft = {
  schemaVersion: 2,
  specId: '7',
  mode: 'brownfield',
  epics: [
    {
      id: 'frontier-1',
      title: 'Implement projected requirements',
      sliceIds: ['task-1'],
      dependsOn: [],
      verification: [],
    },
  ],
  slices: [
    {
      id: 'task-1',
      epicId: 'frontier-1',
      scopeId: 'SCP1',
      title: 'Build feature',
      definition: 'Build the feature.',
      requirementId: 'REQ1',
      requirementIds: ['REQ1'],
      dependsOn: [],
      designContext: [{ itemId: 'MOD1', title: 'Feature module', content: 'Feature module' }],
      verificationContext: [{ itemId: 'CH1', title: 'Smoke test', content: 'Smoke test' }],
      verification: [{ kind: 'criterion', criterionId: 'AC1', target: 'Feature is visible.' }],
    },
  ],
  sideEffects: [],
};

describe('previewPlan', () => {
  it('maps executable draft data into the old cook Plan shape without side effects', () => {
    expect(previewPlan(draft)).toMatchObject({
      schemaVersion: 2,
      mode: 'brownfield',
      scope_handoff_required: true,
      spec: {
        spec_id: '7',
        requirements: [{ item_id: 'REQ1', content: 'Build the feature.' }],
        criteria: [{ item_id: 'AC1', content: 'Feature is visible.', verifies: ['REQ1'] }],
      },
      epics: [
        { id: 'frontier-1', summary: 'Implement projected requirements', depends_on: [], verification: [] },
      ],
      slices: [
        {
          id: 'task-1',
          scope_id: 'SCP1',
          epic_id: 'frontier-1',
          definition: 'Build the feature.',
          depends_on: [],
          verification: [{ kind: 'criterion', target: 'Feature is visible.' }],
          derived_from: ['REQ1'],
          design_context: [{ item_id: 'MOD1', content: 'Feature module' }],
          verification_context: [{ item_id: 'CH1', content: 'Smoke test' }],
        },
      ],
      sideEffects: [],
    });
  });

  it('rejects a v1 executable draft instead of previewing an incompatible shape', () => {
    expect(() => previewPlan({ ...draft, schemaVersion: 1 } as unknown as ExecutablePlanDraft)).toThrow(
      'Unsupported executable plan draft schema version: 1',
    );
  });

  it('leaves old runner fields absent when the executable draft cannot derive them truthfully', () => {
    const preview = previewPlan(draft);

    expect(preview).not.toHaveProperty('profile');
    expect(preview).not.toHaveProperty('harnessNotes');
    expect(preview.epics[0]).not.toHaveProperty('probe');
    expect(preview.epics[0]).not.toHaveProperty('reachability');
    expect(preview.slices[0]).not.toHaveProperty('writes');
  });

  it('keeps per-requirement content and criterion coverage truthful for multi-requirement scopes', () => {
    const preview = previewPlan({
      ...draft,
      slices: [
        {
          ...draft.slices[0],
          definition: 'Build the combined feature scope.',
          requirementIds: ['REQ1', 'REQ2'],
          verification: [
            {
              kind: 'criterion',
              criterionId: 'AC1',
              target: 'Feature entry is visible.',
              verifies: ['REQ1'],
            },
            {
              kind: 'criterion',
              criterionId: 'AC2',
              target: 'Shortcut opens the feature.',
              verifies: ['REQ2'],
            },
          ],
          requirements: [
            { itemId: 'REQ1', title: 'Build feature', content: 'Render the feature entry point.' },
            { itemId: 'REQ2', title: 'Add shortcut', content: 'Ship the keyboard shortcut.' },
          ],
        },
      ],
    } as unknown as ExecutablePlanDraft);

    expect(preview.spec.requirements).toEqual([
      { item_id: 'REQ1', title: 'Build feature', content: 'Render the feature entry point.' },
      { item_id: 'REQ2', title: 'Add shortcut', content: 'Ship the keyboard shortcut.' },
    ]);
    expect(preview.spec.criteria).toEqual([
      { item_id: 'AC1', content: 'Feature entry is visible.', verifies: ['REQ1'] },
      { item_id: 'AC2', content: 'Shortcut opens the feature.', verifies: ['REQ2'] },
    ]);
  });
});
