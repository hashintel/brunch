import { describe, expect, it } from 'vitest';

import { latestSessionOrientation } from '../../../../session/session-orientation.js';
import {
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
  it('presents every §Choice schema label and resolves the matching id', async () => {
    const ui = fakeUi(SESSION_ORIENTATION_MENU.find((item) => item.id === 'ingest')!.label);

    const choice = await runSessionOrientationDialog(ui);

    expect(ui.calls[0]?.options).toEqual(SESSION_ORIENTATION_MENU.map((item) => item.label));
    expect(choice).toBe('ingest');
  });

  it('maps escape/timeout (undefined) to continue', async () => {
    const ui = fakeUi(undefined);

    await expect(runSessionOrientationDialog(ui)).resolves.toBe('continue');
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

  it('writes an entry on every resolution, including escape (entry rule)', async () => {
    const ui = fakeUi(undefined);
    const manager = new FakeSessionManager();

    const choice = await runAndRecordSessionOrientation({
      hasUI: true,
      ui,
      trigger: 'entry',
      manager,
    });

    expect(choice).toBe('continue');
    expect(latestSessionOrientation(manager.entries)?.data).toEqual({
      schemaVersion: 1,
      choice: 'continue',
      trigger: 'entry',
    });
  });

  it('reports a failed append without throwing and still returns the resolved choice', async () => {
    const ui = fakeUi(SESSION_ORIENTATION_MENU.find((item) => item.id === 'ingest')!.label);
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

    expect(choice).toBe('ingest');
    expect(errors).toHaveLength(1);
  });
});
