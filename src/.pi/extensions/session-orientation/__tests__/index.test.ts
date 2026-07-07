import { describe, expect, it } from 'vitest';

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
