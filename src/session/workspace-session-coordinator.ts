import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { SessionManager } from '@earendil-works/pi-coding-agent';

import { BRUNCH_DIR, SESSION_DIR } from '../constants.js';
import { openWorkspaceCommandExecutor, type SpecRecord } from '../graph/index.js';
import type { SpecKind, SpecOrigin } from '../graph/schema/kinds.js';
import { inspectWorkspaceCwdInventory } from '../workspace/cwd-inventory.js';
import { slugify } from '../workspace/project-identity.js';
import {
  readOrCreateWorkspaceState as readOrCreateWorkspaceStateFile,
  readWorkspaceState,
  writeWorkspaceDefaults,
  type WorkspaceProjectState,
  type WorkspaceStateFile,
} from '../workspace/workspace-state-store.js';
import { flushSessionManagerToFile } from './flush-session-manager.js';
import {
  createSessionBindingData,
  isSessionBindingEntry,
  SESSION_BINDING_TYPE,
  type SessionBindingData,
} from './session-binding.js';
import {
  inspectCanonicalSessionFiles,
  verifyCanonicalSessionStore,
} from './workspace-session-coordinator/canonical-session-files.js';

interface WorkspaceSpecState {
  id: number;
  title: string;
  /**
   * Spec posture (D118-L). Optional so existing chrome/display fixtures
   * unrelated to posture establishment (`{id, title}` only) stay valid —
   * every coordinator-sourced spec state populates these.
   */
  kind?: SpecKind;
  /** Spec posture origin; `null`/absent means posture is not yet established. */
  origin?: SpecOrigin | null;
  /** Reference-only relates-to-spec (A41-L); `null`/absent means no relation. */
  relatesToSpecId?: number | null;
}

export type { WorkspacePostureState, WorkspaceProjectState } from '../workspace/workspace-state-store.js';

export interface WorkspaceSessionChromeState {
  cwd: string;
  project?: WorkspaceProjectState;
  spec: WorkspaceSpecState | null;
}

export interface WorkspaceSessionReadyState {
  status: 'ready';
  cwd: string;
  spec: WorkspaceSpecState;
  session: {
    id: string;
    file: string;
    name?: string;
    manager: SessionManager;
  };
  chrome: WorkspaceSessionChromeState;
}

interface WorkspaceSessionSelectSpecState {
  status: 'select_spec';
  cwd: string;
  chrome: WorkspaceSessionChromeState;
}

interface WorkspaceSessionNeedsHumanState {
  status: 'needs_human';
  cwd: string;
  reason: string;
  chrome: WorkspaceSessionChromeState;
}

interface WorkspaceSessionCancelledState {
  status: 'cancelled';
  cwd: string;
  chrome: WorkspaceSessionChromeState;
}

export type WorkspaceSessionState =
  | WorkspaceSessionReadyState
  | WorkspaceSessionSelectSpecState
  | WorkspaceSessionNeedsHumanState;

/**
 * Resume-side posture establishment payload (D118-L resume half). Present
 * only when the dialog just ran the establishment step for a spec whose
 * posture was unestablished (`origin: null` — e.g. created by a seed or via
 * RPC). Applied establish-once before binding; an already-established spec
 * ignores it (the never-re-asked rule holds at the command boundary too).
 */
export interface SpecPostureEstablishPayload {
  kind?: SpecKind;
  origin: SpecOrigin;
  relatesToSpecId?: number;
}

interface WorkspaceContinueDecision {
  action: 'continue';
  specId: number;
  sessionFile: string;
  establish?: SpecPostureEstablishPayload;
}

interface WorkspaceOpenSessionDecision {
  action: 'openSession';
  specId: number;
  sessionFile: string;
  establish?: SpecPostureEstablishPayload;
}

interface WorkspaceNewSessionDecision {
  action: 'newSession';
  specId: number;
  establish?: SpecPostureEstablishPayload;
}

interface WorkspaceNewSpecDecision {
  action: 'newSpec';
  title: string;
  /**
   * Posture confirmed by the establishment step (D118-L). Optional so specs
   * created outside the dialog (e.g. via RPC) remain posture-unestablished
   * and get the establishment step at next resume, rather than widening the
   * public RPC decision contract (`rpc/methods/workspace.ts`) for this slice.
   */
  kind?: SpecKind;
  origin?: SpecOrigin;
  relatesToSpecId?: number;
}

interface WorkspaceCancelDecision {
  action: 'cancel';
}

export type SpecSessionActivationDecision =
  | WorkspaceContinueDecision
  | WorkspaceOpenSessionDecision
  | WorkspaceNewSessionDecision
  | WorkspaceNewSpecDecision
  | WorkspaceCancelDecision;

export type WorkspaceActivationState =
  | WorkspaceSessionReadyState
  | WorkspaceSessionNeedsHumanState
  | WorkspaceSessionCancelledState;

export interface WorkspaceLaunchSession {
  id: string;
  file: string;
  specId: number;
  specTitle: string;
  name?: string;
  available: true;
}

interface WorkspaceLaunchSpec {
  spec: WorkspaceSpecState;
  sessions: WorkspaceLaunchSession[];
}

type WorkspaceUnavailableSessionReason =
  | 'missing_header'
  | 'missing_binding'
  | 'incompatible_binding'
  | 'unreadable';

export interface WorkspaceUnavailableSession {
  file: string;
  reason: WorkspaceUnavailableSessionReason;
  available: false;
}

export interface WorkspaceLaunchInventory {
  cwd: string;
  project?: WorkspaceProjectState;
  currentSpec: WorkspaceSpecState | null;
  currentSessionFile: string | null;
  needsNewSpec: boolean;
  specs: WorkspaceLaunchSpec[];
  unavailableSessions: WorkspaceUnavailableSession[];
  /**
   * Whether cwd holds product code beyond `.brunch/` (D118-L establishment
   * branch). Optional so existing fixtures unrelated to posture establishment
   * stay valid; coordinator-sourced inventories always populate it.
   */
  workspacePopulated?: boolean;
}

export interface SpecSessionActivationCoordinator {
  inspectWorkspace(): Promise<WorkspaceLaunchInventory>;
  activateWorkspace(decision: SpecSessionActivationDecision): Promise<WorkspaceActivationState>;
}

export interface DefaultWorkspaceCoordinator {
  openDefaultWorkspace(): Promise<WorkspaceSessionState>;
}

export interface WorkspaceSetupSessionOptions {
  specTitle?: string;
  createNewSpec?: boolean;
  specKind?: SpecKind;
  specOrigin?: SpecOrigin;
  relatesToSpecId?: number;
}

interface WorkspaceSetupCoordinator {
  createSetupSession(options?: WorkspaceSetupSessionOptions): Promise<WorkspaceSessionReadyState>;
  createSetupSessionForCurrentSpec(): Promise<WorkspaceSessionState>;
}

export interface WorkspaceSessionBoundaryCoordinator {
  bindCurrentSpecToReplacementSession(manager: SessionManager): Promise<WorkspaceSessionReadyState>;
}

interface WorkspaceDefaultChromeCoordinator {
  deriveDefaultChromeState(): Promise<WorkspaceSessionChromeState>;
}

export interface WorkspaceSessionCoordinator
  extends
    SpecSessionActivationCoordinator,
    DefaultWorkspaceCoordinator,
    WorkspaceSetupCoordinator,
    WorkspaceSessionBoundaryCoordinator,
    WorkspaceDefaultChromeCoordinator {}

export function createWorkspaceSessionCoordinator(options?: { cwd?: string }): WorkspaceSessionCoordinator {
  const cwd = resolve(options?.cwd ?? process.cwd());
  return new FileWorkspaceSessionCoordinator(cwd);
}

class FileWorkspaceSessionCoordinator implements WorkspaceSessionCoordinator {
  readonly #cwd: string;

  constructor(cwd: string) {
    this.#cwd = cwd;
  }

  async inspectWorkspace(): Promise<WorkspaceLaunchInventory> {
    return inspectWorkspaceInventory(this.#cwd);
  }

  async activateWorkspace(decision: SpecSessionActivationDecision): Promise<WorkspaceActivationState> {
    if (decision.action === 'cancel') {
      const state = await readWorkspaceState(this.#cwd);
      const spec = state ? await defaultSpecFromState(this.#cwd, state) : null;
      return {
        status: 'cancelled',
        cwd: this.#cwd,
        chrome: chromeState(this.#cwd, spec, state?.project),
      };
    }

    if (decision.action === 'newSpec') {
      return this.createSetupSession({
        specTitle: decision.title,
        createNewSpec: true,
        ...(decision.kind ? { specKind: decision.kind } : {}),
        ...(decision.origin ? { specOrigin: decision.origin } : {}),
        ...(decision.relatesToSpecId !== undefined ? { relatesToSpecId: decision.relatesToSpecId } : {}),
      });
    }

    const inventory = await inspectWorkspaceInventory(this.#cwd);
    const spec = inventory.specs.find((candidate) => candidate.spec.id === decision.specId);

    if (!spec) {
      return needsHumanState(
        this.#cwd,
        inventory.currentSpec,
        'Selected spec is not available in this workspace.',
        inventory.project,
      );
    }

    // Resume-side establishment (D118-L): apply the dialog's confirmed
    // posture before binding, only while the spec is still unestablished.
    const specState =
      decision.establish && spec.spec.origin === null
        ? await establishSpecPostureState(this.#cwd, spec.spec.id, decision.establish)
        : spec.spec;

    if (decision.action === 'newSession') {
      const session = await createBoundSession(this.#cwd, specState);
      await writeWorkspaceDefaults(this.#cwd, specState.id, session.id);
      return readyState(this.#cwd, specState, session, inventory.project);
    }

    const session = spec.sessions.find((candidate) => candidate.file === decision.sessionFile);
    if (!session) {
      return needsHumanState(
        this.#cwd,
        inventory.currentSpec,
        'Selected session is not available for the selected spec.',
        inventory.project,
      );
    }

    const manager = SessionManager.open(session.file, sessionDir(this.#cwd), this.#cwd);
    const opened = bindSessionToSpec(manager, specState);
    await writeWorkspaceDefaults(this.#cwd, specState.id, opened.id);
    return readyState(this.#cwd, specState, opened, inventory.project);
  }

  async openDefaultWorkspace(): Promise<WorkspaceSessionState> {
    const state = await readOrCreateWorkspaceState(this.#cwd);
    const defaults = state.defaults;
    if (!defaults) {
      return {
        status: 'select_spec',
        cwd: this.#cwd,
        chrome: chromeState(this.#cwd, null, state.project),
      };
    }

    const spec = await getSpecState(this.#cwd, defaults.specId);
    if (!spec) {
      return needsHumanState(
        this.#cwd,
        null,
        'Default spec is missing from the workspace database.',
        state.project,
      );
    }

    const session = await openDefaultSession(this.#cwd, spec, defaults.sessionId);
    if (!session) {
      return needsHumanState(this.#cwd, spec, 'Default session is missing or stale.', state.project);
    }
    await writeWorkspaceDefaults(this.#cwd, spec.id, session.id);
    return readyState(this.#cwd, spec, session, state.project);
  }

  async createSetupSession(options?: WorkspaceSetupSessionOptions): Promise<WorkspaceSessionReadyState> {
    const state = await readOrCreateWorkspaceState(this.#cwd);
    const existing =
      state.defaults && !options?.createNewSpec ? await getSpecState(this.#cwd, state.defaults.specId) : null;
    const spec =
      existing ??
      (await createSpec(this.#cwd, options?.specTitle, {
        ...(options?.specKind !== undefined ? { kind: options.specKind } : {}),
        ...(options?.specOrigin !== undefined ? { origin: options.specOrigin } : {}),
        ...(options?.relatesToSpecId !== undefined ? { relatesToSpecId: options.relatesToSpecId } : {}),
      }));
    const session = await createBoundSession(this.#cwd, spec);
    await writeWorkspaceDefaults(this.#cwd, spec.id, session.id);
    return readyState(this.#cwd, spec, session, state.project);
  }

  async createSetupSessionForCurrentSpec(): Promise<WorkspaceSessionState> {
    const state = await readWorkspaceState(this.#cwd);
    const spec = state ? await defaultSpecFromState(this.#cwd, state) : null;
    if (!spec) {
      return {
        status: 'needs_human',
        cwd: this.#cwd,
        reason: 'No default spec is selected for this workspace.',
        chrome: chromeState(this.#cwd, null, state?.project),
      };
    }

    const session = await createBoundSession(this.#cwd, spec);
    await writeWorkspaceDefaults(this.#cwd, spec.id, session.id);
    return readyState(this.#cwd, spec, session, state?.project);
  }

  async bindCurrentSpecToReplacementSession(manager: SessionManager): Promise<WorkspaceSessionReadyState> {
    const state = await readWorkspaceState(this.#cwd);
    const spec = state ? await defaultSpecFromState(this.#cwd, state) : null;
    if (!spec) {
      throw new Error('No default spec is selected for this workspace.');
    }

    const session = bindSessionToSpec(manager, spec);
    await writeWorkspaceDefaults(this.#cwd, spec.id, session.id);
    return readyState(this.#cwd, spec, session, state?.project);
  }

  async deriveDefaultChromeState(): Promise<WorkspaceSessionChromeState> {
    const state = await readWorkspaceState(this.#cwd);
    const spec = state ? await defaultSpecFromState(this.#cwd, state) : null;
    return chromeState(this.#cwd, spec, state?.project);
  }
}

async function createSpec(
  cwd: string,
  title = 'Untitled spec',
  posture: { kind?: SpecKind; origin?: SpecOrigin; relatesToSpecId?: number } = {},
): Promise<WorkspaceSpecState> {
  const executor = await openWorkspaceCommandExecutor(cwd);
  const result = executor.createSpec({
    name: title,
    slug: slugifySpecName(title),
    ...(posture.kind !== undefined ? { kind: posture.kind } : {}),
    ...(posture.origin !== undefined ? { origin: posture.origin } : {}),
    ...(posture.relatesToSpecId !== undefined ? { relatesToSpecId: posture.relatesToSpecId } : {}),
  });
  if (result.status !== 'success') {
    throw new Error(`Unable to create spec: ${result.diagnostics.map((d) => d.message).join(', ')}`);
  }
  const spec = executor.getSpec(result.specId);
  if (!spec) {
    throw new Error('Unable to read back the spec just created');
  }
  return specStateFromRecord(spec);
}

/**
 * Apply a resume-side establishment payload (D118-L) and return the fresh
 * spec state. A concurrent establishment between inventory read and this
 * write loses harmlessly: the command refuses, and the read-back reflects
 * whichever posture landed first.
 */
async function establishSpecPostureState(
  cwd: string,
  specId: number,
  establish: SpecPostureEstablishPayload,
): Promise<WorkspaceSpecState> {
  const executor = await openWorkspaceCommandExecutor(cwd);
  executor.establishSpecPosture({
    specId,
    origin: establish.origin,
    ...(establish.kind !== undefined ? { kind: establish.kind } : {}),
    ...(establish.relatesToSpecId !== undefined ? { relatesToSpecId: establish.relatesToSpecId } : {}),
  });
  const spec = executor.getSpec(specId);
  if (!spec) {
    throw new Error('Unable to read back the spec after posture establishment');
  }
  return specStateFromRecord(spec);
}

async function getSpecState(cwd: string, specId: number): Promise<WorkspaceSpecState | null> {
  const executor = await openWorkspaceCommandExecutor(cwd);
  const spec = executor.getSpec(specId);
  return spec ? specStateFromRecord(spec) : null;
}

async function listSpecStates(cwd: string): Promise<WorkspaceSpecState[]> {
  const executor = await openWorkspaceCommandExecutor(cwd);
  return executor.listSpecs().map(specStateFromRecord);
}

function specStateFromRecord(spec: SpecRecord): WorkspaceSpecState {
  return {
    id: spec.id,
    title: spec.name,
    kind: spec.kind,
    origin: spec.origin,
    relatesToSpecId: spec.relatesToSpecId,
  };
}

function slugifySpecName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'spec';
}

async function createBoundSession(
  cwd: string,
  spec: WorkspaceSpecState,
): Promise<WorkspaceSessionReadyState['session']> {
  await ensureWorkspaceDirs(cwd);
  const existingSessionCount = await countSessionsForSpec(cwd, spec.id);
  const manager = SessionManager.create(cwd, sessionDir(cwd));
  const sessionFile = manager.getSessionFile();
  if (!sessionFile) {
    throw new Error('Pi SessionManager did not create a persisted session file');
  }
  return bindSessionToSpec(manager, spec, existingSessionCount + 1);
}

async function countSessionsForSpec(cwd: string, specId: number): Promise<number> {
  const sessions = await inspectCanonicalSessionFiles(cwd);
  return sessions.filter((session) => session.available && session.specId === specId).length;
}

async function openDefaultSession(
  cwd: string,
  spec: WorkspaceSpecState,
  defaultSessionId: string,
): Promise<WorkspaceSessionReadyState['session'] | null> {
  await ensureWorkspaceDirs(cwd);
  const sessions = await inspectCanonicalSessionFiles(cwd);
  for (const session of sessions) {
    if (session.available && session.id === defaultSessionId && session.specId === spec.id) {
      const manager = SessionManager.open(session.file, sessionDir(cwd), cwd);
      return bindSessionToSpec(manager, spec);
    }
  }
  return null;
}

function bindSessionToSpec(
  manager: SessionManager,
  spec: WorkspaceSpecState,
  sessionOrdinal?: number,
): WorkspaceSessionReadyState['session'] {
  const sessionFile = manager.getSessionFile();
  if (!sessionFile) {
    throw new Error('Pi SessionManager did not create a persisted session file');
  }

  const existingBindings = manager.getEntries().filter(isSessionBindingEntry);
  if (existingBindings.length === 0) {
    manager.appendCustomEntry(
      SESSION_BINDING_TYPE,
      createSessionBindingData({
        specId: spec.id,
      }),
    );
    // Generate and persist a display name for new sessions
    if (sessionOrdinal !== undefined) {
      const displayName = sessionDisplayName(spec.title, sessionOrdinal);
      manager.appendSessionInfo(displayName);
    }
  } else if (existingBindings.length !== 1 || existingBindings[0]?.data.specId !== spec.id) {
    throw new Error('Session already has an incompatible Brunch session binding');
  }

  flushSessionManagerToFile(manager);
  const sessionName = manager.getSessionName();
  return {
    id: manager.getSessionId(),
    file: sessionFile,
    ...(sessionName != null ? { name: sessionName } : {}),
    manager,
  };
}

export function sessionDisplayName(specTitle: string, ordinal: number): string {
  return `${specTitle} — session ${ordinal}`;
}

async function ensureWorkspaceDirs(cwd: string): Promise<void> {
  await mkdir(sessionDir(cwd), { recursive: true });
}

function brunchDir(cwd: string): string {
  return join(cwd, BRUNCH_DIR);
}

function sessionDir(cwd: string): string {
  return join(brunchDir(cwd), SESSION_DIR);
}

async function readOrCreateWorkspaceState(cwd: string): Promise<WorkspaceStateFile> {
  const state = await readOrCreateWorkspaceStateFile(cwd);
  await openWorkspaceCommandExecutor(cwd);
  return state;
}

async function defaultSpecFromState(
  cwd: string,
  state: WorkspaceStateFile,
): Promise<WorkspaceSpecState | null> {
  return state.defaults ? getSpecState(cwd, state.defaults.specId) : null;
}

async function inspectWorkspaceInventory(cwd: string): Promise<WorkspaceLaunchInventory> {
  const state = await readOrCreateWorkspaceState(cwd);
  const sessions = await inspectCanonicalSessionFiles(cwd);
  const specsById = new Map<number, WorkspaceLaunchSpec>();
  const unavailableSessions: WorkspaceUnavailableSession[] = [];
  const [currentSpec, dbSpecs, workspacePopulated] = await Promise.all([
    defaultSpecFromState(cwd, state),
    listSpecStates(cwd),
    isWorkspacePopulated(cwd),
  ]);

  for (const dbSpec of dbSpecs) {
    specsById.set(dbSpec.id, {
      spec: dbSpec,
      sessions: [],
    });
  }

  for (const session of sessions) {
    if (session.available) {
      const dbSpec = await getSpecState(cwd, session.specId);
      if (!dbSpec) {
        unavailableSessions.push({ file: session.file, reason: 'incompatible_binding', available: false });
        continue;
      }
      const spec = getOrCreateLaunchSpec(specsById, dbSpec);
      spec.sessions.push({ ...session, specTitle: dbSpec.title });
    } else {
      unavailableSessions.push({ file: session.file, reason: session.reason, available: false });
    }
  }

  const specs = [...specsById.values()]
    .map((spec) => ({
      ...spec,
      sessions: spec.sessions.sort((left, right) => left.file.localeCompare(right.file)),
    }))
    .sort((left, right) => left.spec.title.localeCompare(right.spec.title));

  const currentSessionFile = state.defaults
    ? (specs.flatMap((spec) => spec.sessions).find((session) => session.id === state.defaults?.sessionId)
        ?.file ?? null)
    : null;

  return {
    cwd,
    project: state.project,
    currentSpec,
    currentSessionFile,
    needsNewSpec: specs.length === 0,
    specs,
    unavailableSessions: unavailableSessions.sort((left, right) => left.file.localeCompare(right.file)),
    workspacePopulated,
  };
}

/**
 * Whether cwd holds product code beyond `.brunch/` — the D118-L establishment
 * branch signal. Distinct from `.brunch/workspace.json`'s posture stub
 * (unchanged, D118-L): this reads the filesystem, not stored workspace state.
 *
 * A sibling 0.x `.brunch/brunch.db` deliberately does NOT count (2026-07-14
 * revision of D124-L mechanic 3): prior Brunch state is not product code, so
 * a cwd with no code is treated the same as a new workspace regardless of
 * legacy databases. I63-L's fail-safe open guard is unaffected.
 */
async function isWorkspacePopulated(cwd: string): Promise<boolean> {
  const inventory = await inspectWorkspaceCwdInventory(cwd);
  return (inventory.topology.children ?? []).some(
    (entry) => entry.name !== BRUNCH_DIR && entry.fileCount > 0,
  );
}

function getOrCreateLaunchSpec(
  specsById: Map<number, WorkspaceLaunchSpec>,
  spec: WorkspaceSpecState,
): WorkspaceLaunchSpec {
  const existing = specsById.get(spec.id);
  if (existing) {
    return existing;
  }
  const created = { spec, sessions: [] };
  specsById.set(spec.id, created);
  return created;
}

function readyState(
  cwd: string,
  spec: WorkspaceSpecState,
  session: WorkspaceSessionReadyState['session'],
  project?: WorkspaceProjectState,
): WorkspaceSessionReadyState {
  return {
    status: 'ready',
    cwd,
    spec,
    session,
    chrome: chromeState(cwd, spec, project),
  };
}

function needsHumanState(
  cwd: string,
  spec: WorkspaceSpecState | null,
  reason: string,
  project?: WorkspaceProjectState,
): WorkspaceSessionNeedsHumanState {
  return {
    status: 'needs_human',
    cwd,
    reason,
    chrome: chromeState(cwd, spec, project),
  };
}

function chromeState(
  cwd: string,
  spec: WorkspaceSpecState | null,
  project?: WorkspaceProjectState,
): WorkspaceSessionChromeState {
  return {
    cwd,
    project: project ?? projectStateFromCwd(cwd),
    spec,
  };
}

function projectStateFromCwd(cwd: string): WorkspaceProjectState {
  const name = cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? 'project';
  return { name, slug: slugify(name) };
}

export interface WorkspaceStoreOracleOptions {
  cwd: string;
  expectedSessionCount?: number;
}

interface WorkspaceStoreOracleSuccess {
  ok: true;
  specId: number | null;
  sessions: Array<{
    file: string;
    sessionId: string;
    bindingCount: number;
    binding: SessionBindingData;
  }>;
}

interface WorkspaceStoreOracleFailure {
  ok: false;
  errors: string[];
}

export type WorkspaceStoreOracleResult = WorkspaceStoreOracleSuccess | WorkspaceStoreOracleFailure;

export async function verifyWorkspaceSessionStores(
  options: WorkspaceStoreOracleOptions,
): Promise<WorkspaceStoreOracleResult> {
  const cwd = resolve(options.cwd);
  const state = await readWorkspaceState(cwd);
  if (!state) {
    return { ok: false, errors: ['Missing or invalid .brunch/workspace.json'] };
  }

  return verifyCanonicalSessionStore({
    cwd,
    expectedSessionCount: options.expectedSessionCount,
    defaultSpecId: state.defaults?.specId ?? null,
  });
}
