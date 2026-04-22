import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createKnowledgeReferenceCode } from '@/shared/knowledge.js';
import { getPersistedReviewSet } from '@/shared/specification-state.js';
import { getSpecificationRecord } from '@/shared/specification.js';

import { getSpecificationState } from '../core.js';
import { createDb, getActivePath, getEntitiesForSpecificationOnActivePath } from '../db.js';
import { renderExportMarkdown } from '../export.js';
import {
  publicScenarios,
  publicScenarioNames,
  walkthroughScenarioMatrix,
  type WalkthroughScenarioMatrixEntry,
} from './scenarios.js';

function summarizeWorkflow(projectState: NonNullable<ReturnType<typeof getSpecificationState>>) {
  return {
    grounding: projectState.workflow.phases.grounding.status,
    design: projectState.workflow.phases.design.status,
    requirements: projectState.workflow.phases.requirements.status,
    criteria: projectState.workflow.phases.criteria.status,
  };
}

async function withReopenedSeededScenario<T>(
  scenarioName: string,
  run: (context: { db: ReturnType<typeof createDb>; projectId: number }) => Promise<T> | T,
): Promise<T> {
  const tempDir = mkdtempSync(join(tmpdir(), 'brunch-fixture-'));
  const dbPath = join(tempDir, 'fixture.db');
  const scenario = publicScenarios[scenarioName];

  if (!scenario) {
    throw new Error(`Unknown walkthrough scenario "${scenarioName}"`);
  }

  const seedDb = createDb(dbPath);
  let projectId: number;
  try {
    projectId = scenario(seedDb);
  } finally {
    seedDb.$client.close();
  }

  const reopenedDb = createDb(dbPath);
  try {
    return await run({ db: reopenedDb, projectId });
  } finally {
    reopenedDb.$client.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function withReopenedWalkthroughScenario<T>(
  entry: Pick<WalkthroughScenarioMatrixEntry, 'seedScenario'>,
  run: (context: { db: ReturnType<typeof createDb>; projectId: number }) => Promise<T> | T,
): Promise<T> {
  const tempDir = mkdtempSync(join(tmpdir(), 'brunch-fixture-'));
  const dbPath = join(tempDir, 'fixture.db');

  const seedDb = createDb(dbPath);
  let projectId: number;
  try {
    projectId = entry.seedScenario(seedDb);
  } finally {
    seedDb.$client.close();
  }

  const reopenedDb = createDb(dbPath);
  try {
    return await run({ db: reopenedDb, projectId });
  } finally {
    reopenedDb.$client.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function collectVisibleReferenceCodes(
  entities: ReturnType<typeof getEntitiesForSpecificationOnActivePath>,
): Set<string> {
  return new Set(
    [
      ...entities.goals,
      ...entities.contexts,
      ...entities.constraints,
      ...entities.requirements,
      ...entities.criteria,
      ...entities.decisions,
      ...entities.assumptions,
    ]
      .map((item) => item.referenceCode)
      .filter((referenceCode): referenceCode is string => Boolean(referenceCode)),
  );
}

describe('walkthroughScenarioMatrix', () => {
  it('front-loads the walkthrough workspace scenarios in the public seed catalog', () => {
    expect(publicScenarioNames.slice(0, walkthroughScenarioMatrix.length)).toEqual(
      walkthroughScenarioMatrix.map((entry) => entry.scenarioName),
    );
  });

  it('wires every walkthrough entry directly to the public TypeScript builder catalog', () => {
    for (const entry of walkthroughScenarioMatrix) {
      expect(publicScenarios[entry.scenarioName]).toBe(entry.seedScenario);
    }
  });

  for (const entry of walkthroughScenarioMatrix) {
    it(`keeps ${entry.scenarioName} resumable after seeding`, async () => {
      await withReopenedWalkthroughScenario(entry, ({ db, projectId }) => {
        const projectState = getSpecificationState(db, projectId);

        expect(projectState).not.toBeNull();
        expect(summarizeWorkflow(projectState!)).toEqual(entry.expectedWorkflowSummary);
      });
    });
  }

  it('seeds kickoff-ready and recovery-ready fixtures from durable authority without legacy control rows', async () => {
    await withReopenedSeededScenario('issue-tracker-design-kickoff-ready', ({ db, projectId }) => {
      expect(getActivePath(db, projectId).at(-1)).toMatchObject({
        phase: 'grounding',
        turn_kind: 'question',
      });
    });

    await withReopenedSeededScenario('issue-tracker-design-recovery', ({ db, projectId }) => {
      expect(getActivePath(db, projectId).at(-1)).toMatchObject({ phase: 'design', turn_kind: 'question' });
    });
  });

  it('materializes the transition-frontier fixtures with the expected derived landings', async () => {
    await withReopenedSeededScenario('issue-tracker-design-kickoff-ready', ({ db, projectId }) => {
      const projectState = getSpecificationState(db, projectId);
      expect(projectState?.landing).toEqual({ kind: 'kickoff', phase: 'design', mode: 'start' });
    });

    await withReopenedSeededScenario('issue-tracker-design-recovery', ({ db, projectId }) => {
      const projectState = getSpecificationState(db, projectId);
      expect(projectState?.landing).toEqual({ kind: 'recovery', phase: 'design' });
    });

    await withReopenedSeededScenario('issue-tracker-criteria-kickoff-ready', ({ db, projectId }) => {
      const projectState = getSpecificationState(db, projectId);
      const requirementsTurns = projectState?.turns.filter((turn) => turn.phase === 'requirements') ?? [];
      const requirementsTurn = requirementsTurns[0] ?? null;

      expect(projectState?.landing).toEqual({ kind: 'kickoff', phase: 'criteria', mode: 'start' });
      expect(requirementsTurns).toHaveLength(1);
      expect(requirementsTurn?.question).toBe('Please review the current requirement set.');
      expect(requirementsTurn?.assistant_parts).toContain('data-review-set');
      expect(requirementsTurn?.assistant_parts).toContain('data-activity-summary');
      expect(requirementsTurn?.user_parts).toContain('"reviewAction":"accept"');
    });

    await withReopenedSeededScenario('issue-tracker-requirements-ready', ({ db, projectId }) => {
      const projectState = getSpecificationState(db, projectId);
      const requirementsTurns = projectState?.turns.filter((turn) => turn.phase === 'requirements') ?? [];
      const requirementsTurn = requirementsTurns[0] ?? null;

      expect(projectState?.landing).toMatchObject({ kind: 'frontier-turn', phase: 'requirements' });
      expect(projectState?.landing?.kind === 'frontier-turn' ? projectState.landing.turnId : null).toBeTypeOf(
        'number',
      );
      expect(requirementsTurns).toHaveLength(1);
      expect(requirementsTurn?.question).toBe('Please review the current requirement set.');
      expect(requirementsTurn?.assistant_parts).toContain('data-review-set');
      expect(requirementsTurn?.assistant_parts).toContain('data-activity-summary');
    });

    await withReopenedSeededScenario('issue-tracker-criteria-ready', ({ db, projectId }) => {
      const projectState = getSpecificationState(db, projectId);
      const criteriaTurns = projectState?.turns.filter((turn) => turn.phase === 'criteria') ?? [];
      const criteriaTurn = criteriaTurns[0] ?? null;

      expect(projectState?.landing).toMatchObject({ kind: 'frontier-turn', phase: 'criteria' });
      expect(projectState?.landing?.kind === 'frontier-turn' ? projectState.landing.turnId : null).toBeTypeOf(
        'number',
      );
      expect(criteriaTurns).toHaveLength(1);
      expect(criteriaTurn?.question).toBe('Please review the current criterion set.');
      expect(criteriaTurn?.assistant_parts).toContain('data-review-set');
      expect(criteriaTurn?.assistant_parts).toContain('data-activity-summary');
    });
  });

  it('keeps pre-review walkthrough entities non-durable while review-set turns stay self-contained', async () => {
    await withReopenedSeededScenario('issue-tracker-requirements-ready', ({ db, projectId }) => {
      expect(getEntitiesForSpecificationOnActivePath(db, projectId).requirements).toEqual([]);
    });

    await withReopenedSeededScenario('issue-tracker-criteria-ready', ({ db, projectId }) => {
      expect(getEntitiesForSpecificationOnActivePath(db, projectId).criteria).toEqual([]);
    });
  });

  it('seeds truthful grounding inventory for review-ready walkthrough scenarios', async () => {
    await withReopenedSeededScenario('issue-tracker-requirements-ready', ({ db, projectId }) => {
      const projectState = getSpecificationState(db, projectId);
      const requirementsTurn = projectState?.turns.find((turn) => turn.phase === 'requirements');
      const reviewSet = getPersistedReviewSet(requirementsTurn);
      const entities = getEntitiesForSpecificationOnActivePath(db, projectId);
      const visibleCodes = collectVisibleReferenceCodes(entities);

      expect(reviewSet).not.toBeNull();
      for (const groundingCode of reviewSet?.items.flatMap(
        (item) => item.grounding?.map((ref) => ref.code) ?? [],
      ) ?? []) {
        expect(visibleCodes).toContain(groundingCode);
      }
      expect(entities.goals.map((item) => item.referenceCode)).toEqual([
        createKnowledgeReferenceCode('goal', 1),
        createKnowledgeReferenceCode('goal', 2),
      ]);
      expect(entities.contexts.map((item) => item.referenceCode)).toEqual([
        createKnowledgeReferenceCode('context', 1),
        createKnowledgeReferenceCode('context', 2),
      ]);
      expect(entities.constraints.map((item) => item.referenceCode)).toEqual([
        createKnowledgeReferenceCode('constraint', 1),
        createKnowledgeReferenceCode('constraint', 2),
      ]);
      expect(entities.decisions.map((item) => item.referenceCode)).toEqual([
        createKnowledgeReferenceCode('decision', 1),
      ]);
      expect(entities.requirements).toEqual([]);
    });

    await withReopenedSeededScenario('issue-tracker-criteria-ready', ({ db, projectId }) => {
      const projectState = getSpecificationState(db, projectId);
      const criteriaTurn = projectState?.turns.find((turn) => turn.phase === 'criteria');
      const reviewSet = getPersistedReviewSet(criteriaTurn);
      const entities = getEntitiesForSpecificationOnActivePath(db, projectId);
      const visibleCodes = collectVisibleReferenceCodes(entities);

      expect(reviewSet).not.toBeNull();
      for (const groundingCode of reviewSet?.items.flatMap(
        (item) => item.grounding?.map((ref) => ref.code) ?? [],
      ) ?? []) {
        expect(visibleCodes).toContain(groundingCode);
      }
      expect(
        entities.requirements.find(
          (item) => item.referenceCode === createKnowledgeReferenceCode('requirement', 1),
        )?.content,
      ).toBe(
        'Create, edit, and close tickets with required fields: title, description, priority, and assignee',
      );
      expect(entities.assumptions.map((item) => item.referenceCode)).toEqual([
        createKnowledgeReferenceCode('assumption', 1),
      ]);
      expect(entities.criteria).toEqual([]);
    });
  });

  it('round-trips the export-ready walkthrough scenario through seed, reopen, and markdown export', async () => {
    await withReopenedSeededScenario('issue-tracker-all-phases-closed', ({ db, projectId }) => {
      const projectState = getSpecificationState(db, projectId);

      expect(projectState).not.toBeNull();
      const markdown = renderExportMarkdown(
        getSpecificationRecord(projectState!).name,
        getEntitiesForSpecificationOnActivePath(db, projectId),
        projectState!.workflow,
      );

      expect(markdown).toContain(
        'Create, edit, and close tickets with required fields: title, description, priority, and assignee',
      );
      expect(markdown).toContain(
        'Every status change records the actor identity and ISO 8601 timestamp in the audit log',
      );
      expect(markdown).not.toContain('Export ticket data as CSV for reporting');
      expect(markdown).not.toContain(
        'CSV export includes all visible fields and respects role-based visibility filters',
      );
    });
  });

  it('reopens the export-ready walkthrough with self-contained persisted review metadata for both accepted review phases', async () => {
    await withReopenedSeededScenario('issue-tracker-all-phases-closed', ({ db, projectId }) => {
      const projectState = getSpecificationState(db, projectId);
      const requirementsReviewTurn = projectState?.turns.find(
        (turn) =>
          turn.phase === 'requirements' && turn.question === 'Please review the current requirement set.',
      );
      const criteriaReviewTurn = projectState?.turns.find(
        (turn) => turn.phase === 'criteria' && turn.question === 'Please review the current criterion set.',
      );

      expect(requirementsReviewTurn?.user_parts).toContain('"reviewAction":"accept"');
      expect(criteriaReviewTurn?.user_parts).toContain('"reviewAction":"accept"');
      expect(JSON.parse(requirementsReviewTurn?.assistant_parts ?? '[]')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'data-review-set',
            data: expect.objectContaining({
              phase: 'requirements',
              items: expect.arrayContaining([
                expect.objectContaining({ referenceCode: createKnowledgeReferenceCode('requirement', 1) }),
              ]),
            }),
          }),
        ]),
      );
      expect(JSON.parse(criteriaReviewTurn?.assistant_parts ?? '[]')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'data-review-set',
            data: expect.objectContaining({
              phase: 'criteria',
              items: expect.arrayContaining([
                expect.objectContaining({ referenceCode: createKnowledgeReferenceCode('criterion', 1) }),
              ]),
            }),
          }),
        ]),
      );
    });
  });

  it('reopens the named brownfield grounding walkthrough with answered and active grounding cards around a substantive turn', async () => {
    await withReopenedSeededScenario('brownfield-grounding-replay', ({ db, projectId }) => {
      const projectState = getSpecificationState(db, projectId);

      expect(projectState ? getSpecificationRecord(projectState).mode : null).toBe('brownfield');
      expect(projectState?.turns).toHaveLength(3);
      expect(projectState?.landing).toEqual({
        kind: 'frontier-turn',
        phase: 'grounding',
        turnId: projectState!.turns[2]!.id,
      });
      expect(projectState?.turns.map((turn) => turn.question)).toEqual([
        '',
        'Which seam needs another grounding pass before we keep going?',
        '',
      ]);
      expect(JSON.parse(projectState!.turns[0]!.assistant_parts ?? '[]')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'data-activity-summary',
            data: expect.objectContaining({ tools: [] }),
          }),
          expect.objectContaining({
            type: 'data-grounding-card',
            data: expect.objectContaining({
              summary: 'The repo already uses SQLite-backed local persistence.',
            }),
          }),
        ]),
      );
      expect(projectState?.turns[1]?.answer).toBe('The chat-runtime finalization path and replay seam.');
      expect(JSON.parse(projectState!.turns[2]!.assistant_parts ?? '[]')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'data-activity-summary',
            data: expect.objectContaining({ tools: [] }),
          }),
          expect.objectContaining({
            type: 'data-grounding-card',
            data: expect.objectContaining({
              summary: 'Later context gathering narrowed the work to turn-finalization ownership.',
            }),
          }),
        ]),
      );
    });
  });
});
