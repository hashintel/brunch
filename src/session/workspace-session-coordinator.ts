import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { SessionManager } from '@earendil-works/pi-coding-agent';

import { BRUNCH_DIR, SESSION_DIR } from '../constants.js';
import { openWorkspaceCommandExecutor, type SpecRecord } from '../graph/index.js';
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

interface WorkspaceContinueDecision {
  action: 'continue';
  specId: number;
  sessionFile: string;
}

interface WorkspaceOpenSessionDecision {
  action: 'openSession';
  specId: number;
  sessionFile: string;
}

interface WorkspaceNewSessionDecision {
  action: 'newSession';
  specId: number;
}

interface WorkspaceNewSpecDecision {
  action: 'newSpec';
  title: string;
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
}

export interface SpecSessionActivationCoordinator {
  inspectWorkspace(): Promise<WorkspaceLaunchInventory>;
  activateWorkspace(decision: SpecSessionActivationDecision): Promise<WorkspaceActivationState>;
}

export interface DefaultWorkspaceCoordinator {
  openDefaultWorkspace(): Promise<WorkspaceSessionState>;
}

interface WorkspaceSetupCoordinator {
  createSetupSession(options?: {
    specTitle?: string;
    createNewSpec?: boolean;
  }): Promise<WorkspaceSessionReadyState>;
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

    if (decision.action === 'newSession') {
      const session = await createBoundSession(this.#cwd, spec.spec);
      await writeWorkspaceDefaults(this.#cwd, spec.spec.id, session.id);
      return readyState(this.#cwd, spec.spec, session, inventory.project);
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
    const opened = bindSessionToSpec(manager, spec.spec);
    await writeWorkspaceDefaults(this.#cwd, spec.spec.id, opened.id);
    return readyState(this.#cwd, spec.spec, opened, inventory.project);
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

  async createSetupSession(options?: {
    specTitle?: string;
    createNewSpec?: boolean;
  }): Promise<WorkspaceSessionReadyState> {
    const state = await readOrCreateWorkspaceState(this.#cwd);
    const existing =
      state.defaults && !options?.createNewSpec ? await getSpecState(this.#cwd, state.defaults.specId) : null;
    const spec = existing ?? (await createSpec(this.#cwd, options?.specTitle));
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

async function createSpec(cwd: string, title = 'Untitled spec'): Promise<WorkspaceSpecState> {
  const executor = await openWorkspaceCommandExecutor(cwd);
  const result = executor.createSpec({ name: title, slug: slugifySpecName(title) });
  if (result.status !== 'success') {
    throw new Error(`Unable to create spec: ${result.diagnostics.map((d) => d.message).join(', ')}`);
  }
  return { id: result.specId, title };
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
  return { id: spec.id, title: spec.name };
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
  const [currentSpec, dbSpecs] = await Promise.all([defaultSpecFromState(cwd, state), listSpecStates(cwd)]);

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
  };
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
