import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SessionManager, type SessionEntry } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { openWorkspaceCommandExecutor } from '../../graph/index.js';
import { assistantMessage, userMessage, isCustomEntry } from '../../probes/test-helpers.js';
import { projectSessionExchanges } from '../exchange-projection.js';
import { SESSION_BINDING_TYPE } from '../session-binding.js';
import { decideSpecEstablishmentAsks } from '../spec-establishment.js';
import {
  createWorkspaceSessionCoordinator,
  verifyWorkspaceSessionStores,
} from '../workspace-session-coordinator.js';

type JsonlLine = {
  type?: string;
  customType?: string;
};

describe('WorkspaceSessionCoordinator', () => {
  it('creates scoped state, a bound pi session, and derivable chrome state', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    const result = await coordinator.createSetupSession({
      specTitle: 'Scratch spec',
    });

    expect(result.status).toBe('ready');
    expect(result.chrome.cwd).toBe(cwd);
    expect(result.chrome.spec?.id).toBeTypeOf('number');
    expect(result.chrome.spec?.title).toBe('Scratch spec');
    expect(result.chrome).not.toHaveProperty('phase');
    expect(result.chrome).not.toHaveProperty('chatMode');

    const oracle = await verifyWorkspaceSessionStores({
      cwd,
      expectedSessionCount: 1,
    });
    expect(oracle.ok).toBe(true);
    if (!oracle.ok) {
      expect(oracle.errors).toEqual([]);
      return;
    }
    expect(oracle.specId).toBe(result.spec.id);
    expect(oracle.sessions).toHaveLength(1);
    expect(oracle.sessions[0]?.binding.specId).toBe(result.spec.id);
  });

  it('jsonl coordinator new session reloads same spec', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    const first = await coordinator.createSetupSession({
      specTitle: 'Scratch spec',
    });
    const second = await coordinator.createSetupSessionForCurrentSpec();

    expect(second.status).toBe('ready');
    if (second.status !== 'ready') {
      return;
    }
    expect(second.spec.id).toBe(first.spec.id);
    expect(second.session.id).not.toBe(first.session.id);

    const reloadedFirst = SessionManager.open(first.session.file, undefined, cwd);
    const reloadedSecond = SessionManager.open(second.session.file, undefined, cwd);
    const firstBinding = reloadedFirst
      .getEntries()
      .find((entry) => isCustomEntry(entry) && entry.customType === SESSION_BINDING_TYPE);
    const secondBinding = reloadedSecond
      .getEntries()
      .find((entry) => isCustomEntry(entry) && entry.customType === SESSION_BINDING_TYPE);

    expect(firstBinding).toMatchObject({
      data: { specId: first.spec.id },
    });
    expect(secondBinding).toMatchObject({
      data: { specId: first.spec.id },
    });

    const oracle = await verifyWorkspaceSessionStores({
      cwd,
      expectedSessionCount: 2,
    });
    expect(oracle.ok).toBe(true);
    if (!oracle.ok) {
      expect(oracle.errors).toEqual([]);
      return;
    }
    expect(oracle.sessions.map((session) => session.binding.specId)).toEqual([first.spec.id, first.spec.id]);
    expect(oracle.sessions.every((session) => session.bindingCount === 1)).toBe(true);
  });

  it('jsonl binding-only coordinator session reloads', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    const result = await coordinator.createSetupSession({
      specTitle: 'Scratch spec',
    });
    const reloaded = SessionManager.open(result.session.file, undefined, cwd);
    const bindings = reloaded
      .getEntries()
      .filter((entry) => isCustomEntry(entry) && entry.customType === SESSION_BINDING_TYPE);

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toMatchObject({
      customType: SESSION_BINDING_TYPE,
      data: {
        specId: result.spec.id,
      },
    });
  });

  it('jsonl coordinator pre-assistant flush does not duplicate prefix', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    const result = await coordinator.createSetupSession({
      specTitle: 'Scratch spec',
    });
    const reloaded = SessionManager.open(result.session.file, undefined, cwd);
    reloaded.appendMessage(assistantMessage('hello'));
    reloaded.appendMessage(userMessage('hi'));

    const content = await readFile(result.session.file, 'utf8');
    const lines = content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as JsonlLine);

    expect(lines.filter((entry) => entry.type === 'session')).toHaveLength(1);
    expect(
      lines.filter(
        (entry) =>
          isCustomEntry(entry as unknown as SessionEntry) &&
          (entry as JsonlLine).customType === SESSION_BINDING_TYPE,
      ),
    ).toHaveLength(1);
  });

  it('jsonl session reload preserves coordinator binding', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    const result = await coordinator.createSetupSession({
      specTitle: 'Scratch spec',
    });
    result.session.manager.appendMessage(assistantMessage('hello'));
    result.session.manager.appendMessage(userMessage('answer'));

    const reloaded = SessionManager.open(result.session.file, undefined, cwd);
    const bindings = reloaded
      .getEntries()
      .filter((entry) => isCustomEntry(entry) && entry.customType === SESSION_BINDING_TYPE);

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toMatchObject({
      data: {
        specId: result.spec.id,
      },
    });
  });

  it('does not duplicate pre-assistant entries when flushed after the user message and before assistant persistence', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    const result = await coordinator.createSetupSession({
      specTitle: 'Scratch spec',
    });
    result.session.manager.appendModelChange('test-provider', 'test-model');
    result.session.manager.appendThinkingLevelChange('high');
    await coordinator.bindCurrentSpecToReplacementSession(result.session.manager);
    result.session.manager.appendMessage(userMessage('hello'));
    await coordinator.bindCurrentSpecToReplacementSession(result.session.manager);
    result.session.manager.appendMessage(assistantMessage('hi'));

    const content = await readFile(result.session.file, 'utf8');
    const sessionHeaderCount = content.split('\n').filter((line) => line.includes('"type":"session"')).length;
    const oracle = await verifyWorkspaceSessionStores({
      cwd,
      expectedSessionCount: 1,
    });

    expect(sessionHeaderCount).toBe(1);
    expect(oracle.ok).toBe(true);
    if (!oracle.ok) {
      expect(oracle.errors).toEqual([]);
    }
  });

  it('jsonl session reload projects the same simple exchange', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    const result = await coordinator.createSetupSession({
      specTitle: 'Scratch spec',
    });
    result.session.manager.appendMessage(assistantMessage('Question'));
    result.session.manager.appendMessage(userMessage('Answer'));

    const beforeReload = projectSessionExchanges(result.session.manager.getBranch());
    const afterReload = projectSessionExchanges(
      SessionManager.open(result.session.file, undefined, cwd).getBranch(),
    );

    expect(afterReload).toEqual(beforeReload);
    expect(afterReload.exchanges).toHaveLength(1);
  });

  it('binds a pi-created replacement session to the current spec', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    const first = await coordinator.createSetupSession({
      specTitle: 'Scratch spec',
    });
    const replacementFile = first.session.manager.newSession();
    await coordinator.bindCurrentSpecToReplacementSession(first.session.manager);

    expect(replacementFile).toBeDefined();
    const oracle = await verifyWorkspaceSessionStores({
      cwd,
      expectedSessionCount: 2,
    });
    expect(oracle.ok).toBe(true);
    if (!oracle.ok) {
      expect(oracle.errors).toEqual([]);
      return;
    }
    expect(oracle.sessions.every((session) => session.binding.specId === first.spec.id)).toBe(true);
    expect(oracle.sessions.every((session) => session.bindingCount === 1)).toBe(true);
  });

  it('inspects workspace defaults, DB specs, and sessions without activation writes', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    const first = await coordinator.createSetupSession({ specTitle: 'Alpha' });
    first.session.manager.appendMessage(userMessage('first'));
    const second = await coordinator.createSetupSession({
      specTitle: 'Beta',
      createNewSpec: true,
    });
    const beforeState = await readFile(join(cwd, '.brunch', 'workspace.json'), 'utf8');
    const beforeFirst = await readFile(first.session.file, 'utf8');
    const beforeSecond = await readFile(second.session.file, 'utf8');

    const inventory = await coordinator.inspectWorkspace();
    const oracle = await verifyWorkspaceSessionStores({ cwd, expectedSessionCount: 2 });

    expect(inventory.cwd).toBe(cwd);
    expect(inventory.needsNewSpec).toBe(false);
    expect(inventory.currentSpec).toEqual(second.spec);
    expect(inventory.currentSessionFile).toBe(second.session.file);
    expect(inventory.specs.map(({ spec }) => spec.title)).toEqual(['Alpha', 'Beta']);
    expect(inventory.specs[0]?.sessions).toEqual([
      expect.objectContaining({
        id: first.session.id,
        file: first.session.file,
        specId: first.spec.id,
        specTitle: 'Alpha',
        available: true,
      }),
    ]);
    expect(inventory.specs[1]?.sessions).toEqual([
      expect.objectContaining({
        id: second.session.id,
        file: second.session.file,
        specId: second.spec.id,
        specTitle: 'Beta',
        available: true,
      }),
    ]);
    expect(inventory.unavailableSessions).toEqual([]);
    expect(oracle.ok).toBe(true);
    if (!oracle.ok) return;
    expect(oracle.sessions.map((session) => session.binding.specId).sort((a, b) => a - b)).toEqual([
      first.spec.id,
      second.spec.id,
    ]);
    await expect(readFile(join(cwd, '.brunch', 'workspace.json'), 'utf8')).resolves.toBe(beforeState);
    await expect(readFile(first.session.file, 'utf8')).resolves.toBe(beforeFirst);
    await expect(readFile(second.session.file, 'utf8')).resolves.toBe(beforeSecond);
  });

  it('inspects an empty workspace without creating session files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    const inventory = await coordinator.inspectWorkspace();

    expect(inventory).toMatchObject({
      cwd,
      currentSpec: null,
      currentSessionFile: null,
      needsNewSpec: true,
      specs: [],
      unavailableSessions: [],
    });
    await expect(readFile(join(cwd, '.brunch', 'sessions', 'missing.jsonl'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('lists database specs even when no sessions are bound yet', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const executor = await openWorkspaceCommandExecutor(cwd);
    const alpha = executor.createSpec({ name: 'Alpha', slug: 'alpha' });
    const beta = executor.createSpec({ name: 'Beta', slug: 'beta' });
    expect(alpha.status).toBe('success');
    expect(beta.status).toBe('success');
    if (alpha.status !== 'success' || beta.status !== 'success') return;

    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const inventory = await coordinator.inspectWorkspace();

    expect(inventory).toMatchObject({
      cwd,
      currentSpec: null,
      currentSessionFile: null,
      needsNewSpec: false,
      unavailableSessions: [],
    });
    expect(inventory.specs).toEqual([
      {
        spec: { id: alpha.specId, title: 'Alpha', kind: 'product', origin: null, relatesToSpecId: null },
        sessions: [],
      },
      {
        spec: { id: beta.specId, title: 'Beta', kind: 'product', origin: null, relatesToSpecId: null },
        sessions: [],
      },
    ]);

    const activated = await coordinator.activateWorkspace({ action: 'newSession', specId: beta.specId });

    expect(activated.status).toBe('ready');
    if (activated.status !== 'ready') return;
    expect(activated.spec).toEqual({
      id: beta.specId,
      title: 'Beta',
      kind: 'product',
      origin: null,
      relatesToSpecId: null,
    });
  });

  it('applies a resume-side establish payload before binding (D118-L resume establishment)', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const executor = await openWorkspaceCommandExecutor(cwd);
    const seeded = executor.createSpec({ name: 'Seeded', slug: 'seeded' });
    expect(seeded.status).toBe('success');
    if (seeded.status !== 'success') return;

    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const activated = await coordinator.activateWorkspace({
      action: 'newSession',
      specId: seeded.specId,
      establish: { kind: 'feature', origin: 'brownfield' },
    });

    expect(activated.status).toBe('ready');
    if (activated.status !== 'ready') return;
    expect(activated.spec).toMatchObject({ kind: 'feature', origin: 'brownfield' });
    expect(executor.getSpec(seeded.specId)).toMatchObject({ kind: 'feature', origin: 'brownfield' });
  });

  it('ignores an establish payload on an already-established spec (never re-asked, never clobbered)', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const executor = await openWorkspaceCommandExecutor(cwd);
    const established = executor.createSpec({ name: 'Done', slug: 'done', origin: 'greenfield' });
    expect(established.status).toBe('success');
    if (established.status !== 'success') return;

    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const activated = await coordinator.activateWorkspace({
      action: 'newSession',
      specId: established.specId,
      establish: { kind: 'feature', origin: 'brownfield' },
    });

    expect(activated.status).toBe('ready');
    expect(executor.getSpec(established.specId)).toMatchObject({ kind: 'product', origin: 'greenfield' });
  });

  it('marks unbound or incompatible sessions unavailable during inventory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const ready = await coordinator.createSetupSession({ specTitle: 'Alpha' });
    const unboundFile = join(cwd, '.brunch', 'sessions', 'unbound.jsonl');
    const mismatchedFile = join(cwd, '.brunch', 'sessions', 'mismatched.jsonl');
    const duplicateBindingFile = join(cwd, '.brunch', 'sessions', 'duplicate-binding.jsonl');
    await writeFile(
      unboundFile,
      `${JSON.stringify({ type: 'session', id: 'unbound-session', cwd })}\n`,
      'utf8',
    );
    const bindingEntry = JSON.stringify({
      type: 'custom',
      customType: SESSION_BINDING_TYPE,
      data: {
        schemaVersion: 1,
        specId: ready.spec.id,
      },
    });
    await writeFile(
      mismatchedFile,
      `${JSON.stringify({ type: 'session', id: 'header-session', cwd })}\n${bindingEntry}\n`,
      'utf8',
    );
    await writeFile(
      duplicateBindingFile,
      `${JSON.stringify({ type: 'session', id: 'duplicate-binding-session', cwd })}\n${bindingEntry}\n${bindingEntry}\n`,
      'utf8',
    );
    const beforeUnbound = await readFile(unboundFile, 'utf8');
    const beforeMismatched = await readFile(mismatchedFile, 'utf8');
    const beforeDuplicateBinding = await readFile(duplicateBindingFile, 'utf8');

    const inventory = await coordinator.inspectWorkspace();
    const oracle = await verifyWorkspaceSessionStores({ cwd, expectedSessionCount: 4 });

    expect(inventory.specs).toHaveLength(1);
    expect(inventory.specs[0]?.sessions).toHaveLength(2);
    expect(inventory.specs[0]?.sessions.map((session) => session.file)).toContain(mismatchedFile);
    expect(inventory.unavailableSessions).toEqual([
      expect.objectContaining({ file: duplicateBindingFile, reason: 'incompatible_binding' }),
      expect.objectContaining({ file: unboundFile, reason: 'missing_binding' }),
    ]);
    expect(oracle.ok).toBe(false);
    if (!oracle.ok) {
      expect(oracle.errors).toEqual([
        expect.stringContaining(`${duplicateBindingFile} has 2 ${SESSION_BINDING_TYPE} entries`),
        expect.stringContaining(`${unboundFile} has 0 ${SESSION_BINDING_TYPE} entries`),
      ]);
    }
    await expect(readFile(unboundFile, 'utf8')).resolves.toBe(beforeUnbound);
    await expect(readFile(mismatchedFile, 'utf8')).resolves.toBe(beforeMismatched);
    await expect(readFile(duplicateBindingFile, 'utf8')).resolves.toBe(beforeDuplicateBinding);
  });

  it('reports malformed session files without aborting inventory or store verification', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    await coordinator.createSetupSession({ specTitle: 'Alpha' });
    const corruptedFile = join(cwd, '.brunch', 'sessions', 'corrupted.jsonl');
    await writeFile(
      corruptedFile,
      `${JSON.stringify({ type: 'session', id: 'corrupted-session', cwd })}\n{not json}\n`,
      'utf8',
    );

    const inventory = await coordinator.inspectWorkspace();
    const oracle = await verifyWorkspaceSessionStores({ cwd, expectedSessionCount: 2 });

    expect(inventory.unavailableSessions).toEqual([
      expect.objectContaining({ file: corruptedFile, reason: 'unreadable' }),
    ]);
    expect(oracle.ok).toBe(false);
    if (!oracle.ok) {
      expect(oracle.errors).toEqual([expect.stringContaining(`${corruptedFile} is unreadable`)]);
    }
  });

  it('activates explicit open and continue decisions as workspace defaults', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const first = await coordinator.createSetupSession({ specTitle: 'Alpha' });
    const second = await coordinator.createSetupSession({
      specTitle: 'Beta',
      createNewSpec: true,
    });

    const opened = await coordinator.activateWorkspace({
      action: 'openSession',
      specId: first.spec.id,
      sessionFile: first.session.file,
    });

    expect(opened.status).toBe('ready');
    if (opened.status !== 'ready') {
      return;
    }
    expect(opened.spec).toEqual(first.spec);
    expect(opened.session.id).toBe(first.session.id);
    expect(opened.session.file).toBe(first.session.file);
    expect(opened.chrome.spec).toEqual(first.spec);

    const continued = await coordinator.activateWorkspace({
      action: 'continue',
      specId: second.spec.id,
      sessionFile: second.session.file,
    });

    expect(continued.status).toBe('ready');
    if (continued.status !== 'ready') {
      return;
    }
    expect(continued.spec).toEqual(second.spec);
    expect(continued.session.id).toBe(second.session.id);
    expect(JSON.parse(await readFile(join(cwd, '.brunch', 'workspace.json'), 'utf8'))).toMatchObject({
      defaults: { specId: second.spec.id, sessionId: second.session.id },
    });
  });

  it('activates a new session decision as a binding-only session for the selected spec', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const first = await coordinator.createSetupSession({ specTitle: 'Alpha' });
    first.session.manager.appendMessage(userMessage('preserve me'));
    const beforeFirst = await readFile(first.session.file, 'utf8');

    const created = await coordinator.activateWorkspace({
      action: 'newSession',
      specId: first.spec.id,
    });

    expect(created.status).toBe('ready');
    if (created.status !== 'ready') {
      return;
    }
    expect(created.spec).toEqual(first.spec);
    expect(created.session.id).not.toBe(first.session.id);
    await expect(readFile(first.session.file, 'utf8')).resolves.toBe(beforeFirst);
    const createdContent = await readFile(created.session.file, 'utf8');
    expect(createdContent).toContain(SESSION_BINDING_TYPE);
    expect(createdContent).not.toContain('preserve me');
    const oracle = await verifyWorkspaceSessionStores({
      cwd,
      expectedSessionCount: 2,
    });
    expect(oracle.ok).toBe(true);
  });

  it('activates a new spec decision by creating a bound default session', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    const created = await coordinator.activateWorkspace({
      action: 'newSpec',
      title: 'Gamma',
    });

    expect(created.status).toBe('ready');
    if (created.status !== 'ready') {
      return;
    }
    expect(created.spec.title).toBe('Gamma');
    expect(created.session.id).toMatch(/[\da-f-]+/iu);
    const oracle = await verifyWorkspaceSessionStores({
      cwd,
      expectedSessionCount: 1,
    });
    expect(oracle.ok).toBe(true);
  });

  it('activates a new spec decision carrying establishment-confirmed posture (D118-L, A41-L)', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    const root = await coordinator.activateWorkspace({ action: 'newSpec', title: 'Root spec' });
    if (root.status !== 'ready') throw new Error('unreachable');

    const created = await coordinator.activateWorkspace({
      action: 'newSpec',
      title: 'Feature spec',
      kind: 'feature',
      origin: 'brownfield',
      relatesToSpecId: root.spec.id,
    });

    expect(created.status).toBe('ready');
    if (created.status !== 'ready') throw new Error('unreachable');
    expect(created.spec).toEqual({
      id: created.spec.id,
      title: 'Feature spec',
      kind: 'feature',
      origin: 'brownfield',
      relatesToSpecId: root.spec.id,
    });
  });

  it('A41-L probe: a real multi-spec workspace fixture round-trips the reference-only relates-to shape', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    // A root spec plus two others relating back to it (and to each other) —
    // no spec-to-spec claim model (supersedes/informed_by/depends_on/claims),
    // just a plain integer reference per spec (A41-L bet).
    const root = await coordinator.activateWorkspace({
      action: 'newSpec',
      title: 'Root product spec',
      kind: 'product',
      origin: 'greenfield',
    });
    if (root.status !== 'ready') throw new Error('unreachable');

    const feature = await coordinator.activateWorkspace({
      action: 'newSpec',
      title: 'Feature spec',
      kind: 'feature',
      origin: 'brownfield',
      relatesToSpecId: root.spec.id,
    });
    if (feature.status !== 'ready') throw new Error('unreachable');

    const focusedFunction = await coordinator.activateWorkspace({
      action: 'newSpec',
      title: 'Focused function spec',
      kind: 'function',
      origin: 'brownfield',
      relatesToSpecId: feature.spec.id,
    });
    if (focusedFunction.status !== 'ready') throw new Error('unreachable');

    const inventory = await coordinator.inspectWorkspace();
    const byId = new Map(inventory.specs.map((entry) => [entry.spec.id, entry.spec]));

    expect(byId.get(root.spec.id)?.relatesToSpecId).toBeNull();
    expect(byId.get(feature.spec.id)?.relatesToSpecId).toBe(root.spec.id);
    expect(byId.get(focusedFunction.spec.id)?.relatesToSpecId).toBe(feature.spec.id);

    // Reference-only shape: the spec record surface carries no claim-model
    // vocabulary (supersedes/informed_by/parallel_to/depends_on/claims,
    // docs/design/SPEC_INITIATIVE_MODEL.md's deferred model) — just id/title/
    // kind/origin/relatesToSpecId.
    const featureSpec = byId.get(feature.spec.id);
    expect(featureSpec && Object.keys(featureSpec).sort()).toEqual(
      ['id', 'kind', 'origin', 'relatesToSpecId', 'title'].sort(),
    );
  });

  it('never re-asks establishment for a spec with stored posture; asks once for a posture-unestablished spec (D118-L)', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    // Established via the dialog's posture-carrying decision.
    const established = await coordinator.activateWorkspace({
      action: 'newSpec',
      title: 'Established spec',
      origin: 'greenfield',
    });
    if (established.status !== 'ready') throw new Error('unreachable');

    // Created outside the dialog (e.g. RPC) — posture-unestablished.
    const unestablished = await coordinator.activateWorkspace({
      action: 'newSpec',
      title: 'Unestablished spec',
    });
    if (unestablished.status !== 'ready') throw new Error('unreachable');

    const inventory = await coordinator.inspectWorkspace();
    const establishedSpec = inventory.specs.find((entry) => entry.spec.id === established.spec.id)?.spec;
    const unestablishedSpec = inventory.specs.find((entry) => entry.spec.id === unestablished.spec.id)?.spec;
    if (!establishedSpec || !unestablishedSpec) throw new Error('unreachable');

    expect(
      decideSpecEstablishmentAsks({
        currentOrigin: establishedSpec.origin ?? null,
        workspacePopulated: inventory.workspacePopulated ?? false,
      }),
    ).toEqual([]);
    expect(
      decideSpecEstablishmentAsks({
        currentOrigin: unestablishedSpec.origin ?? null,
        workspacePopulated: inventory.workspacePopulated ?? false,
      }),
    ).toEqual(['confirmOrigin']);
  });

  it('ignores a sibling 0.x brunch.db for posture: a cwd with no code stays bare (2026-07-14 D124-L revision)', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    await mkdir(join(cwd, '.brunch'), { recursive: true });
    await writeFile(join(cwd, '.brunch', 'brunch.db'), 'not a sqlite database');

    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const inventory = await coordinator.inspectWorkspace();

    expect(inventory.workspacePopulated).toBe(false);
    expect(
      decideSpecEstablishmentAsks({
        currentOrigin: null,
        workspacePopulated: inventory.workspacePopulated ?? false,
      }),
    ).toEqual(['confirmOrigin']);
  });

  it('activates cancel without mutating workspace state or session files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const ready = await coordinator.createSetupSession({ specTitle: 'Alpha' });
    const beforeState = await readFile(join(cwd, '.brunch', 'workspace.json'), 'utf8');
    const beforeSession = await readFile(ready.session.file, 'utf8');

    const result = await coordinator.activateWorkspace({ action: 'cancel' });

    expect(result.status).toBe('cancelled');
    await expect(readFile(join(cwd, '.brunch', 'workspace.json'), 'utf8')).resolves.toBe(beforeState);
    await expect(readFile(ready.session.file, 'utf8')).resolves.toBe(beforeSession);
  });

  it('refuses to activate mismatched or unavailable sessions', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const ready = await coordinator.createSetupSession({ specTitle: 'Alpha' });
    const unavailableFile = join(cwd, '.brunch', 'sessions', 'unavailable.jsonl');
    await writeFile(
      unavailableFile,
      `${JSON.stringify({ type: 'session', id: 'unavailable-session', cwd })}\n`,
      'utf8',
    );

    const unavailable = await coordinator.activateWorkspace({
      action: 'openSession',
      specId: ready.spec.id,
      sessionFile: unavailableFile,
    });
    const mismatched = await coordinator.activateWorkspace({
      action: 'openSession',
      specId: 9999,
      sessionFile: ready.session.file,
    });

    expect(unavailable.status).toBe('needs_human');
    expect(mismatched.status).toBe('needs_human');
  });

  it('scaffolds workspace.json and brunch-v1.db when no default spec exists', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));

    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const result = await coordinator.openDefaultWorkspace();

    expect(result.status).toBe('select_spec');
    expect(result.chrome.cwd).toBe(cwd);
    expect(result.chrome.spec).toBeNull();
    await expect(stat(join(cwd, '.brunch', 'brunch-v1.db'))).resolves.toMatchObject({});
    expect(JSON.parse(await readFile(join(cwd, '.brunch', 'workspace.json'), 'utf8'))).toMatchObject({
      project: expect.objectContaining({ name: expect.any(String), slug: expect.any(String) }),
      defaults: null,
      posture: {
        certainty: '',
        stakes: '',
        audience: '',
        horizon: '',
        migration: '',
        dependencies: '',
      },
    });
  });

  it('generates a display name for new sessions and persists it as session_info', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    const first = await coordinator.createSetupSession({
      specTitle: 'Scratch spec',
    });

    // Session should have a display name derived from spec title
    const manager1 = SessionManager.open(first.session.file, undefined, cwd);
    expect(manager1.getSessionName()).toBe('Scratch spec — session 1');

    // Second session for same spec gets ordinal 2
    const second = await coordinator.createSetupSessionForCurrentSpec();
    expect(second.status).toBe('ready');
    if (second.status !== 'ready') return;

    const manager2 = SessionManager.open(second.session.file, undefined, cwd);
    expect(manager2.getSessionName()).toBe('Scratch spec — session 2');
  });

  it('preserves existing display name on session resume', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-ws-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    await coordinator.createSetupSession({
      specTitle: 'My spec',
    });

    // Reopen the same session
    const reopened = await coordinator.openDefaultWorkspace();
    expect(reopened.status).toBe('ready');
    if (reopened.status !== 'ready') return;

    // Name should be unchanged
    const manager = SessionManager.open(reopened.session.file, undefined, cwd);
    expect(manager.getSessionName()).toBe('My spec — session 1');
  });
});
