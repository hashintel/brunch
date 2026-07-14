import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { assistantMessage, userMessage } from '../../probes/test-helpers.js';
import { readBrunchSessionEnvelope } from '../brunch-session-envelope.js';
import { createSessionBindingData } from '../session-binding.js';

function appendBinding(manager: SessionManager): void {
  manager.appendCustomEntry('brunch.session_binding', createSessionBindingData({ specId: 1 }));
}

describe('active session branch', () => {
  it('physically reopens a sibling tree on the selected branch and accepts a branch summary', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-active-branch-'));
    const manager = SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
    appendBinding(manager);
    const sharedPromptId = manager.appendMessage(assistantMessage('Choose a path'));
    manager.appendMessage(userMessage('Abandoned answer'));
    manager.branchWithSummary(sharedPromptId, 'The abandoned path chose the old answer.');
    const selectedAnswerId = manager.appendMessage(userMessage('Selected answer'));
    const file = manager.getSessionFile()!;

    const reopened = SessionManager.open(file);
    expect(reopened.getLeafId()).toBe(selectedAnswerId);
    expect(reopened.getBranch().map((entry) => entry.id)).toEqual(
      manager.getBranch().map((entry) => entry.id),
    );

    const result = await readBrunchSessionEnvelope(file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.entries.map((entry) => entry.id)).toEqual(
      reopened.getBranch().map((entry) => entry.id),
    );
    expect(result.envelope.entries.some((entry) => entry.type === 'branch_summary')).toBe(true);
  });

  it('accepts a real branch-derived session header and retains its inherited binding', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-derived-session-'));
    const manager = SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
    appendBinding(manager);
    const leafId = manager.appendMessage(assistantMessage('Inherited prompt'));
    const parentFile = manager.getSessionFile();
    const derivedFile = manager.createBranchedSession(leafId);
    if (!derivedFile) throw new Error('expected a persisted branch-derived session');

    const reopened = SessionManager.open(derivedFile);
    expect(reopened.getHeader()?.parentSession).toBe(parentFile);

    const result = await readBrunchSessionEnvelope(derivedFile);
    expect(result).toMatchObject({
      ok: true,
      envelope: { binding: { schemaVersion: 1, specId: 1 } },
    });
  });
});
