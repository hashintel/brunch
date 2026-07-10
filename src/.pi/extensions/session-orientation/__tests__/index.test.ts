import { describe, expect, it } from 'vitest';

import { formatSessionOrientationSeed } from '../../../../agents/contexts/data-model/session-orientation.js';
import { latestSessionOrientation } from '../../../../session/session-orientation.js';
import {
  CODE_SESSION_ORIENTATION_MENU,
  runAndRecordSessionOrientation,
  runSessionOrientationDialog,
  SESSION_ORIENTATION_MENU,
} from '../index.js';

function fakeUi(response: string | undefined) {
  const calls: Array<{ title: string; options: string[] }> = [];
  return {
    calls,
    select: async (title: string, options: string[]) => {
      calls.push({ title, options });
      return response;
    },
  };
}

class FakeSessionManager {
  entries: Array<{ type: 'custom'; customType: string; data: unknown }> = [];

  appendCustomEntry(customType: string, data: unknown) {
    this.entries.push({ type: 'custom', customType, data });
  }
}

describe('runSessionOrientationDialog', () => {
  it('presents every §Choice schema label under the menu-owned title and resolves the matching id', async () => {
    const ui = fakeUi(SESSION_ORIENTATION_MENU.items.find((item) => item.id === 'ingest')!.label);

    const choice = await runSessionOrientationDialog(ui);

    expect(ui.calls[0]).toEqual({
      title: SESSION_ORIENTATION_MENU.title,
      options: SESSION_ORIENTATION_MENU.items.map((item) => item.label),
    });
    expect(choice).toBe('ingest');
  });

  it('maps escape/timeout (undefined) to the inert dismissed on every menu', async () => {
    const specUi = fakeUi(undefined);
    const codeUi = fakeUi(undefined);

    await expect(runSessionOrientationDialog(specUi)).resolves.toBe('dismissed');
    await expect(runSessionOrientationDialog(codeUi, { menu: CODE_SESSION_ORIENTATION_MENU })).resolves.toBe(
      'dismissed',
    );
  });

  it('keeps SPEC and CODE menu labels disjoint and gives CODE an execute-specific title', async () => {
    const specLabels = new Set<string>(SESSION_ORIENTATION_MENU.items.map((item) => item.label));
    const codeLabels = CODE_SESSION_ORIENTATION_MENU.items.map((item) => item.label);
    const ui = fakeUi(undefined);

    await runSessionOrientationDialog(ui, { menu: CODE_SESSION_ORIENTATION_MENU });

    expect(codeLabels.filter((label) => specLabels.has(label))).toEqual([]);
    expect(ui.calls[0]?.title).toContain('Execute');
    expect(ui.calls[0]?.title).not.toBe(SESSION_ORIENTATION_MENU.title);
  });

  it('keeps surface chrome labels and role-specific menu content on the descriptors', () => {
    expect(SESSION_ORIENTATION_MENU.topLabel).toBe('[ Specify ]');
    expect(SESSION_ORIENTATION_MENU.noKickChoice).toBe('continue');
    expect(SESSION_ORIENTATION_MENU.items.at(-1)).toMatchObject({
      id: 'continue',
      label: 'Wait for me',
    });
    expect(SESSION_ORIENTATION_MENU.items.map((item) => item.id)).toEqual([
      'elicit_decisions',
      'elicit_examples',
      'propose_intent',
      'propose_design',
      'propose_oracle',
      'ingest',
      'continue',
    ]);

    expect(CODE_SESSION_ORIENTATION_MENU.topLabel).toBe('[ Execute ]');
    expect(CODE_SESSION_ORIENTATION_MENU.items.map((item) => item.id)).toEqual([
      'prepare_execution',
      'compile_plan',
      'execute_plan',
    ]);
    expect(CODE_SESSION_ORIENTATION_MENU.items.map((item) => item.id)).not.toContain('proceed');
    expect(CODE_SESSION_ORIENTATION_MENU.items.map((item) => item.id)).not.toContain('backfill');
    expect(CODE_SESSION_ORIENTATION_MENU.items.map((item) => item.id)).not.toContain('design_first');
    expect(CODE_SESSION_ORIENTATION_MENU.items.map((item) => item.id)).not.toContain('oracle_first');
    expect(CODE_SESSION_ORIENTATION_MENU.items.map((item) => item.id)).not.toContain('project_plan');
  });

  it.each([
    {
      id: 'prepare_execution',
      label: 'Design / oracle / commit work',
      directive: /assessing design, oracle, and commitment evidence; recommend one next preparation path/i,
    },
    {
      id: 'compile_plan',
      label: 'Plan compilation readiness',
      directive: /assessing plan-compilation readiness.*offer compile-now versus backfill-first/i,
    },
    {
      id: 'execute_plan',
      label: 'Plan execution',
      directive: /validating that the compiled plan is fresh.*begin only the next safe scoped unit/i,
    },
  ] as const)(
    'keeps Execute %s visible menu, persisted id, and context seed semantically aligned',
    async (row) => {
      const ui = fakeUi(row.label);
      const manager = new FakeSessionManager();

      const result = await runAndRecordSessionOrientation({
        hasUI: true,
        ui,
        trigger: 'consult',
        manager,
        menu: CODE_SESSION_ORIENTATION_MENU,
      });

      expect(result).toEqual({ choice: row.id, recorded: true });
      expect(latestSessionOrientation(manager.entries)?.data).toEqual({
        schemaVersion: 1,
        choice: row.id,
        trigger: 'consult',
      });
      expect(formatSessionOrientationSeed(row.id)).toContain(`chosen: ${row.id}`);
      expect(formatSessionOrientationSeed(row.id)).toMatch(row.directive);
    },
  );
});

describe('runAndRecordSessionOrientation', () => {
  it('does not show the dialog or write an entry when hasUI is false (degraded mode)', async () => {
    const ui = fakeUi('ingest');
    const manager = new FakeSessionManager();

    const choice = await runAndRecordSessionOrientation({
      hasUI: false,
      ui,
      trigger: 'entry',
      manager,
    });

    expect(choice).toBeUndefined();
    expect(ui.calls).toEqual([]);
    expect(manager.entries).toEqual([]);
  });

  it('writes an entry on every resolution, including an escape dismissal (entry rule)', async () => {
    const ui = fakeUi(undefined);
    const manager = new FakeSessionManager();

    const choice = await runAndRecordSessionOrientation({
      hasUI: true,
      ui,
      trigger: 'entry',
      manager,
    });

    expect(choice).toEqual({ choice: 'dismissed', recorded: true });
    expect(latestSessionOrientation(manager.entries)?.data).toEqual({
      schemaVersion: 1,
      choice: 'dismissed',
      trigger: 'entry',
    });
  });

  it('reports a failed append without throwing and marks the resolution unrecorded', async () => {
    const ui = fakeUi(SESSION_ORIENTATION_MENU.items.find((item) => item.id === 'ingest')!.label);
    const manager: { appendCustomEntry: () => void } = {
      appendCustomEntry: () => {
        throw new Error('ledger write failed');
      },
    };
    const errors: unknown[] = [];

    const choice = await runAndRecordSessionOrientation({
      hasUI: true,
      ui,
      trigger: 'consult',
      manager,
      onAppendError: (error) => errors.push(error),
    });

    expect(choice).toEqual({ choice: 'ingest', recorded: false });
    expect(errors).toHaveLength(1);
  });
});
