import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { SessionManager } from '@earendil-works/pi-coding-agent';

import { openWorkspaceCommandExecutor, type SpecRecord } from '../graph/index.js';
import { discoverProjectIdentity } from './project-identity.js';
import {
  createSessionBindingData,
  isSessionBindingEntry,
  SESSION_BINDING_TYPE,
  type SessionBindingData,
} from './session-binding.js';
import {
  inspectCanonicalSessionFiles,
  verifyCanonicalSessionStore,
} from './workspace-session-coordinator/boot-session-store.js';

const BRUNCH_DIR = '.brunch';
const STATE_FILE = 'workspace.json';
const SESSION_DIR = 'sessions';
const STATE_SCHEMA_VERSION = 1;

export interface WorkspaceSpecState {
  id: number;
  title: string;
}

interface WorkspaceProjectState {
  name: string;
  slug: string;
}

interface WorkspacePostureState {
  certainty: string;
  stakes: string;
  audience: string;
  horizon: string;
  migration: string;
  sourcing: string;
}

interface WorkspaceCurrentState {
  specId: number;
  sessionId: string;
}

interface WorkspaceStateFile {
  schemaVersion: 1;
  project: WorkspaceProjectState;
  current: WorkspaceCurrentState | null;
  posture: WorkspacePostureState;
}

export interface WorkspaceSessionChromeState {
  cwd: string;
  spec: WorkspaceSpecState | null;
  phase: 'select_spec' | 'elicitation';
  chatMode: 'select-spec' | 'responding-to-elicitation';
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

export interface WorkspaceSessionSelectSpecState {
  status: 'select_spec';
  cwd: string;
  chrome: WorkspaceSessionChromeState;
}

export interface WorkspaceSessionNeedsHumanState {
  status: 'needs_human';
  cwd: string;
  reason: string;
  chrome: WorkspaceSessionChromeState;
}

export interface WorkspaceSessionCancelledState {
  status: 'cancelled';
  cwd: string;
  chrome: WorkspaceSessionChromeState;
}

export type WorkspaceSessionState =
  | WorkspaceSessionReadyState
  | WorkspaceSessionSelectSpecState
  | WorkspaceSessionNeedsHumanState;

export interface WorkspaceContinueDecision {
  action: 'continue';
  specId: number;
  sessionFile: string;
}

export interface WorkspaceOpenSessionDecision {
  action: 'openSession';
  specId: number;
  sessionFile: string;
}

export interface WorkspaceNewSessionDecision {
  action: 'newSession';
  specId: number;
}

export interface WorkspaceNewSpecDecision {
  action: 'newSpec';
  title: string;
}

export interface WorkspaceCancelDecision {
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

export interface WorkspaceLaunchSpec {
  spec: WorkspaceSpecState;
  sessions: WorkspaceLaunchSession[];
}

export type WorkspaceUnavailableSessionReason =
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

export interface WorkspaceSetupCoordinator {
  createSetupSession(options?: {
    specTitle?: string;
    createNewSpec?: boolean;
  }): Promise<WorkspaceSessionReadyState>;
  createSetupSessionForCurrentSpec(): Promise<WorkspaceSessionState>;
}

export interface WorkspaceSessionBoundaryCoordinator {
  bindCurrentSpecToReplacementSession(manager: SessionManager): Promise<WorkspaceSessionReadyState>;
}

export interface WorkspaceDefaultChromeCoordinator {
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
      const spec = state ? await currentSpecFromState(this.#cwd, state) : null;
      return {
        status: 'cancelled',
        cwd: this.#cwd,
        chrome: chromeState(this.#cwd, spec),
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
      );
    }

    if (decision.action === 'newSession') {
      const session = await createBoundSession(this.#cwd, spec.spec);
      await writeCurrentWorkspaceState(this.#cwd, spec.spec, session.id);
      return readyState(this.#cwd, spec.spec, session);
    }

    const session = spec.sessions.find((candidate) => candidate.file === decision.sessionFile);
    if (!session) {
      return needsHumanState(
        this.#cwd,
        inventory.currentSpec,
        'Selected session is not available for the selected spec.',
      );
    }

    const manager = SessionManager.open(session.file, sessionDir(this.#cwd), this.#cwd);
    const opened = bindSessionToSpec(manager, spec.spec);
    await writeCurrentWorkspaceState(this.#cwd, spec.spec, opened.id);
    return readyState(this.#cwd, spec.spec, opened);
  }

  async openDefaultWorkspace(): Promise<WorkspaceSessionState> {
    const state = await readOrCreateWorkspaceState(this.#cwd);
    const current = state.current;
    if (!current) {
      return {
        status: 'select_spec',
        cwd: this.#cwd,
        chrome: chromeState(this.#cwd, null),
      };
    }

    const spec = await getSpecState(this.#cwd, current.specId);
    if (!spec) {
      return needsHumanState(this.#cwd, null, 'Current spec is missing from the workspace database.');
    }

    const session = await openCurrentSession(this.#cwd, spec, current.sessionId);
    if (!session) {
      return needsHumanState(this.#cwd, spec, 'Current session is missing or stale.');
    }
    await writeCurrentWorkspaceState(this.#cwd, spec, session.id);
    return readyState(this.#cwd, spec, session);
  }

  async createSetupSession(options?: {
    specTitle?: string;
    createNewSpec?: boolean;
  }): Promise<WorkspaceSessionReadyState> {
    const state = await readOrCreateWorkspaceState(this.#cwd);
    const existing =
      state.current && !options?.createNewSpec ? await getSpecState(this.#cwd, state.current.specId) : null;
    const spec = existing ?? (await createSpec(this.#cwd, options?.specTitle));
    const session = await createBoundSession(this.#cwd, spec);
    await writeCurrentWorkspaceState(this.#cwd, spec, session.id);
    return readyState(this.#cwd, spec, session);
  }

  async createSetupSessionForCurrentSpec(): Promise<WorkspaceSessionState> {
    const state = await readWorkspaceState(this.#cwd);
    const spec = state ? await currentSpecFromState(this.#cwd, state) : null;
    if (!spec) {
      return {
        status: 'needs_human',
        cwd: this.#cwd,
        reason: 'No current spec is selected for this workspace.',
        chrome: chromeState(this.#cwd, null),
      };
    }

    const session = await createBoundSession(this.#cwd, spec);
    await writeCurrentWorkspaceState(this.#cwd, spec, session.id);
    return readyState(this.#cwd, spec, session);
  }

  async bindCurrentSpecToReplacementSession(manager: SessionManager): Promise<WorkspaceSessionReadyState> {
    const state = await readWorkspaceState(this.#cwd);
    const spec = state ? await currentSpecFromState(this.#cwd, state) : null;
    if (!spec) {
      throw new Error('No current spec is selected for this workspace.');
    }

    const session = bindSessionToSpec(manager, spec);
    await writeCurrentWorkspaceState(this.#cwd, spec, session.id);
    return readyState(this.#cwd, spec, session);
  }

  async deriveDefaultChromeState(): Promise<WorkspaceSessionChromeState> {
    const state = await readWorkspaceState(this.#cwd);
    const spec = state ? await currentSpecFromState(this.#cwd, state) : null;
    return chromeState(this.#cwd, spec);
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

async function openCurrentSession(
  cwd: string,
  spec: WorkspaceSpecState,
  currentSessionId: string,
): Promise<WorkspaceSessionReadyState['session'] | null> {
  await ensureWorkspaceDirs(cwd);
  const sessions = await inspectCanonicalSessionFiles(cwd);
  for (const session of sessions) {
    if (session.available && session.id === currentSessionId && session.specId === spec.id) {
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

  flushSessionWithoutAssistant(manager);
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

interface FlushableSessionManager {
  _rewriteFile(): void;
}

function flushSessionWithoutAssistant(manager: SessionManager): void {
  const sessionFile = manager.getSessionFile();
  (manager as unknown as FlushableSessionManager)._rewriteFile();
  if (sessionFile) {
    manager.setSessionFile(sessionFile);
  }
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

function statePath(cwd: string): string {
  return join(brunchDir(cwd), STATE_FILE);
}

async function readWorkspaceState(cwd: string): Promise<WorkspaceStateFile | null> {
  try {
    const parsed = JSON.parse(await readFile(statePath(cwd), 'utf8')) as Partial<WorkspaceStateFile>;
    if (
      parsed.schemaVersion === STATE_SCHEMA_VERSION &&
      isProjectState(parsed.project) &&
      (parsed.current === null || isCurrentState(parsed.current)) &&
      isPostureState(parsed.posture)
    ) {
      return parsed as WorkspaceStateFile;
    }
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function readOrCreateWorkspaceState(cwd: string): Promise<WorkspaceStateFile> {
  const existing = await readWorkspaceState(cwd);
  if (existing) return existing;
  const identity = await discoverProjectIdentity(cwd);
  const state: WorkspaceStateFile = {
    schemaVersion: STATE_SCHEMA_VERSION,
    project: { name: identity.name, slug: identity.slug },
    current: null,
    posture: emptyWorkspacePosture(),
  };
  await writeWorkspaceState(cwd, state);
  await openWorkspaceCommandExecutor(cwd);
  return state;
}

async function currentSpecFromState(
  cwd: string,
  state: WorkspaceStateFile,
): Promise<WorkspaceSpecState | null> {
  return state.current ? getSpecState(cwd, state.current.specId) : null;
}

function isProjectState(value: unknown): value is WorkspaceProjectState {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { name?: unknown }).name === 'string' &&
    typeof (value as { slug?: unknown }).slug === 'string'
  );
}

function isCurrentState(value: unknown): value is WorkspaceCurrentState {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { specId?: unknown }).specId === 'number' &&
    Number.isInteger((value as { specId: number }).specId) &&
    typeof (value as { sessionId?: unknown }).sessionId === 'string'
  );
}

function isPostureState(value: unknown): value is WorkspacePostureState {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { certainty?: unknown }).certainty === 'string' &&
    typeof (value as { stakes?: unknown }).stakes === 'string' &&
    typeof (value as { audience?: unknown }).audience === 'string' &&
    typeof (value as { horizon?: unknown }).horizon === 'string' &&
    typeof (value as { migration?: unknown }).migration === 'string' &&
    typeof (value as { sourcing?: unknown }).sourcing === 'string'
  );
}

function emptyWorkspacePosture(): WorkspacePostureState {
  return { certainty: '', stakes: '', audience: '', horizon: '', migration: '', sourcing: '' };
}

async function inspectWorkspaceInventory(cwd: string): Promise<WorkspaceLaunchInventory> {
  const state = await readOrCreateWorkspaceState(cwd);
  const sessions = await inspectCanonicalSessionFiles(cwd);
  const specsById = new Map<number, WorkspaceLaunchSpec>();
  const unavailableSessions: WorkspaceUnavailableSession[] = [];
  const currentSpec = await currentSpecFromState(cwd, state);

  if (currentSpec) {
    specsById.set(currentSpec.id, {
      spec: currentSpec,
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
      unavailableSessions.push(session);
    }
  }

  const specs = [...specsById.values()]
    .map((spec) => ({
      ...spec,
      sessions: spec.sessions.sort((left, right) => left.file.localeCompare(right.file)),
    }))
    .sort((left, right) => left.spec.title.localeCompare(right.spec.title));

  const currentSessionFile = state.current
    ? (specs.flatMap((spec) => spec.sessions).find((session) => session.id === state.current?.sessionId)
        ?.file ?? null)
    : null;

  return {
    cwd,
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

async function writeWorkspaceState(cwd: string, state: WorkspaceStateFile): Promise<void> {
  await ensureWorkspaceDirs(cwd);
  await writeFile(statePath(cwd), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

async function writeCurrentWorkspaceState(
  cwd: string,
  spec: WorkspaceSpecState,
  currentSessionId: string,
): Promise<void> {
  const existing = await readOrCreateWorkspaceState(cwd);
  await writeWorkspaceState(cwd, {
    ...existing,
    current: { specId: spec.id, sessionId: currentSessionId },
  });
}

function readyState(
  cwd: string,
  spec: WorkspaceSpecState,
  session: WorkspaceSessionReadyState['session'],
): WorkspaceSessionReadyState {
  return {
    status: 'ready',
    cwd,
    spec,
    session,
    chrome: chromeState(cwd, spec),
  };
}

function needsHumanState(
  cwd: string,
  spec: WorkspaceSpecState | null,
  reason: string,
): WorkspaceSessionNeedsHumanState {
  return {
    status: 'needs_human',
    cwd,
    reason,
    chrome: chromeState(cwd, spec),
  };
}

function chromeState(cwd: string, spec: WorkspaceSpecState | null): WorkspaceSessionChromeState {
  return {
    cwd,
    spec,
    phase: spec ? 'elicitation' : 'select_spec',
    chatMode: spec ? 'responding-to-elicitation' : 'select-spec',
  };
}

export interface WorkspaceStoreOracleOptions {
  cwd: string;
  expectedSessionCount?: number;
}

export interface WorkspaceStoreOracleSuccess {
  ok: true;
  specId: number | null;
  sessions: Array<{
    file: string;
    sessionId: string;
    bindingCount: number;
    binding: SessionBindingData;
  }>;
}

export interface WorkspaceStoreOracleFailure {
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
    currentSpecId: state.current?.specId ?? null,
  });
}
