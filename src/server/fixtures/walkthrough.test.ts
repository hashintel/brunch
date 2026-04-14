import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getProjectState } from '../core.js';
import { createDb, getEntitiesForProjectOnActivePath } from '../db.js';
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
});
