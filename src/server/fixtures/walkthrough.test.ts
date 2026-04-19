import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getProjectState } from '../core.js';
import { createDb, getActivePath, getEntitiesForProjectOnActivePath } from '../db.js';
import { renderExportMarkdown } from '../export.js';
import { captureProjectToManifestScenario } from './corpus.js';
import { loadManifest, seedFromManifest } from './manifest.js';
import { publicScenarios, publicScenarioNames, walkthroughScenarioMatrix } from './scenarios.js';

const issueTrackerManifest = loadManifest('issue-tracker');

function summarizeWorkflow(projectState: NonNullable<ReturnType<typeof getProjectState>>) {
  return {
    scope: projectState.workflow.phases.scope.status,
    design: projectState.workflow.phases.design.status,
    requirements: projectState.workflow.phases.requirements.status,
    criteria: projectState.workflow.phases.criteria.status,
  };
}

function normalizeManifestScenario(manifestScenarioKey: string) {
  const db = createDb();
  try {
    const projectId = seedFromManifest(
      db,
      issueTrackerManifest.scenarios[manifestScenarioKey]!,
      `Normalized ${manifestScenarioKey}`,
    );
    getProjectState(db, projectId);
    return captureProjectToManifestScenario(db, projectId);
  } finally {
    db.$client.close();
  }
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

describe('walkthroughScenarioMatrix', () => {
  it('front-loads the walkthrough workspace scenarios in the public seed catalog', () => {
    expect(publicScenarioNames.slice(0, walkthroughScenarioMatrix.length)).toEqual(
      walkthroughScenarioMatrix.map((entry) => entry.scenarioName),
    );
  });

  for (const entry of walkthroughScenarioMatrix) {
    it(`keeps ${entry.scenarioName} resumable after seeding`, async () => {
      await withReopenedSeededScenario(entry.scenarioName, ({ db, projectId }) => {
        const projectState = getProjectState(db, projectId);

        expect(projectState).not.toBeNull();
        expect(summarizeWorkflow(projectState!)).toEqual(entry.expectedWorkflowSummary);

        if (!entry.manifestScenarioKey) {
          return;
        }

        expect(captureProjectToManifestScenario(db, projectId)).toEqual(
          normalizeManifestScenario(entry.manifestScenarioKey),
        );
      });
    });
  }

  it('seeds kickoff-ready and recovery-ready fixtures from durable authority without legacy control rows', async () => {
    await withReopenedSeededScenario('issue-tracker-design-kickoff-ready', ({ db, projectId }) => {
      expect(getActivePath(db, projectId).at(-1)).toMatchObject({ phase: 'scope', turn_kind: 'question' });
    });

    await withReopenedSeededScenario('issue-tracker-design-recovery', ({ db, projectId }) => {
      expect(getActivePath(db, projectId).at(-1)).toMatchObject({ phase: 'design', turn_kind: 'question' });
    });
  });

  it('materializes the transition-frontier fixtures with the expected derived landings', async () => {
    await withReopenedSeededScenario('issue-tracker-design-kickoff-ready', ({ db, projectId }) => {
      const projectState = getProjectState(db, projectId);
      expect(projectState?.landing).toEqual({ kind: 'kickoff', phase: 'design', mode: 'start' });
    });

    await withReopenedSeededScenario('issue-tracker-design-recovery', ({ db, projectId }) => {
      const projectState = getProjectState(db, projectId);
      expect(projectState?.landing).toEqual({ kind: 'recovery', phase: 'design' });
    });

    await withReopenedSeededScenario('issue-tracker-requirements-ready', ({ db, projectId }) => {
      const projectState = getProjectState(db, projectId);
      expect(projectState?.landing).toMatchObject({ kind: 'frontier-turn', phase: 'requirements' });
      expect(projectState?.landing?.kind === 'frontier-turn' ? projectState.landing.turnId : null).toBeTypeOf(
        'number',
      );
    });

    await withReopenedSeededScenario('issue-tracker-criteria-ready', ({ db, projectId }) => {
      const projectState = getProjectState(db, projectId);
      expect(projectState?.landing).toMatchObject({ kind: 'frontier-turn', phase: 'criteria' });
      expect(projectState?.landing?.kind === 'frontier-turn' ? projectState.landing.turnId : null).toBeTypeOf(
        'number',
      );
    });
  });

  it('round-trips the export-ready walkthrough scenario through seed, reopen, and markdown export', async () => {
    await withReopenedSeededScenario('issue-tracker-all-phases-closed', ({ db, projectId }) => {
      const projectState = getProjectState(db, projectId);

      expect(projectState).not.toBeNull();
      const markdown = renderExportMarkdown(
        projectState!.project.name,
        getEntitiesForProjectOnActivePath(db, projectId),
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

  it('reopens the named brownfield grounding walkthrough with answered and active grounding cards around a substantive turn', async () => {
    await withReopenedSeededScenario('brownfield-grounding-replay', ({ db, projectId }) => {
      const projectState = getProjectState(db, projectId);

      expect(projectState?.project.mode).toBe('brownfield');
      expect(projectState?.turns).toHaveLength(3);
      expect(projectState?.landing).toEqual({
        kind: 'frontier-turn',
        phase: 'scope',
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
