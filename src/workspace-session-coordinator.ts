import { randomUUID } from "node:crypto"
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises"
import { join, resolve } from "node:path"

import {
  SessionManager,
  type SessionHeader,
} from "@earendil-works/pi-coding-agent"

import {
  createSessionBindingData,
  isSessionBindingEntry,
  SESSION_BINDING_TYPE,
  type SessionBindingData,
} from "./session-binding.js"

const BRUNCH_DIR = ".brunch"
const STATE_FILE = "state.json"
const SESSION_DIR = "sessions"
const STATE_SCHEMA_VERSION = 1

export interface WorkspaceSpecState {
  id: string
  title: string
}

interface WorkspaceStateFile {
  schemaVersion: 1
  currentSpec: WorkspaceSpecState
  currentSessionFile?: string
}

export interface WorkspaceSessionChromeState {
  cwd: string
  spec: WorkspaceSpecState | null
  phase: "select_spec" | "elicitation"
  chatMode: "select-spec" | "responding-to-elicitation"
}

export interface WorkspaceSessionReadyState {
  status: "ready"
  cwd: string
  spec: WorkspaceSpecState
  session: {
    id: string
    file: string
    manager: SessionManager
  }
  chrome: WorkspaceSessionChromeState
}

export interface WorkspaceSessionSelectSpecState {
  status: "select_spec"
  cwd: string
  chrome: WorkspaceSessionChromeState
}

export interface WorkspaceSessionNeedsHumanState {
  status: "needs_human"
  cwd: string
  reason: string
  chrome: WorkspaceSessionChromeState
}

export interface WorkspaceSessionCancelledState {
  status: "cancelled"
  cwd: string
  chrome: WorkspaceSessionChromeState
}

export type WorkspaceSessionState = WorkspaceSessionReadyState | WorkspaceSessionSelectSpecState | WorkspaceSessionNeedsHumanState

export interface WorkspaceContinueDecision {
  action: "continue"
  specId: string
  sessionFile: string
}

export interface WorkspaceOpenSessionDecision {
  action: "openSession"
  specId: string
  sessionFile: string
}

export interface WorkspaceNewSessionDecision {
  action: "newSession"
  specId: string
}

export interface WorkspaceNewSpecDecision {
  action: "newSpec"
  title: string
}

export interface WorkspaceCancelDecision {
  action: "cancel"
}

export type WorkspaceSwitchDecision = WorkspaceContinueDecision | WorkspaceOpenSessionDecision | WorkspaceNewSessionDecision | WorkspaceNewSpecDecision | WorkspaceCancelDecision

export type WorkspaceActivationState = WorkspaceSessionReadyState | WorkspaceSessionNeedsHumanState | WorkspaceSessionCancelledState

export interface WorkspaceLaunchSession {
  id: string
  file: string
  specId: string
  specTitle: string
  name?: string
  available: true
}

export interface WorkspaceLaunchSpec {
  spec: WorkspaceSpecState
  sessions: WorkspaceLaunchSession[]
}

export type WorkspaceUnavailableSessionReason = "missing_header" | "missing_binding" | "incompatible_binding"

export interface WorkspaceUnavailableSession {
  file: string
  reason: WorkspaceUnavailableSessionReason
  available: false
}

export interface WorkspaceLaunchInventory {
  cwd: string
  currentSpec: WorkspaceSpecState | null
  currentSessionFile: string | null
  needsNewSpec: boolean
  specs: WorkspaceLaunchSpec[]
  unavailableSessions: WorkspaceUnavailableSession[]
}

export interface WorkspaceSessionCoordinator {
  inspectWorkspace(): Promise<WorkspaceLaunchInventory>
  activateWorkspace(
    decision: WorkspaceSwitchDecision,
  ): Promise<WorkspaceActivationState>
  openExisting(): Promise<WorkspaceSessionState>
  startOrCreate(options?: {
    specTitle?: string
    createNewSpec?: boolean
  }): Promise<WorkspaceSessionReadyState>
  createNewSessionForCurrentSpec(): Promise<WorkspaceSessionState>
  bindCurrentSpecToSession(
    manager: SessionManager,
  ): Promise<WorkspaceSessionReadyState>
  deriveChromeState(): Promise<WorkspaceSessionChromeState>
}

export function createWorkspaceSessionCoordinator(options?: {
  cwd?: string
}): WorkspaceSessionCoordinator {
  const cwd = resolve(options?.cwd ?? process.cwd())
  return new FileWorkspaceSessionCoordinator(cwd)
}

class FileWorkspaceSessionCoordinator implements WorkspaceSessionCoordinator {
  readonly #cwd: string

  constructor(cwd: string) {
    this.#cwd = cwd
  }

  async inspectWorkspace(): Promise<WorkspaceLaunchInventory> {
    return inspectWorkspaceInventory(this.#cwd)
  }

  async activateWorkspace(
    decision: WorkspaceSwitchDecision,
  ): Promise<WorkspaceActivationState> {
    if (decision.action === "cancel") {
      const state = await readWorkspaceState(this.#cwd)
      return {
        status: "cancelled",
        cwd: this.#cwd,
        chrome: chromeState(this.#cwd, state?.currentSpec ?? null),
      }
    }

    if (decision.action === "newSpec") {
      return this.startOrCreate({
        specTitle: decision.title,
        createNewSpec: true,
      })
    }

    const inventory = await inspectWorkspaceInventory(this.#cwd)
    const spec = inventory.specs.find(
      (candidate) => candidate.spec.id === decision.specId,
    )

    if (!spec) {
      return needsHumanState(
        this.#cwd,
        inventory.currentSpec,
        "Selected spec is not available in this workspace.",
      )
    }

    if (decision.action === "newSession") {
      const session = await createBoundSession(this.#cwd, spec.spec)
      await writeCurrentWorkspaceState(this.#cwd, spec.spec, session.file)
      return readyState(this.#cwd, spec.spec, session)
    }

    const session = spec.sessions.find(
      (candidate) => candidate.file === decision.sessionFile,
    )
    if (!session) {
      return needsHumanState(
        this.#cwd,
        inventory.currentSpec,
        "Selected session is not available for the selected spec.",
      )
    }

    const manager = SessionManager.open(
      session.file,
      sessionDir(this.#cwd),
      this.#cwd,
    )
    const opened = bindSessionToSpec(manager, spec.spec)
    await writeCurrentWorkspaceState(this.#cwd, spec.spec, opened.file)
    return readyState(this.#cwd, spec.spec, opened)
  }

  async openExisting(): Promise<WorkspaceSessionState> {
    const state = await readWorkspaceState(this.#cwd)
    if (!state) {
      return {
        status: "select_spec",
        cwd: this.#cwd,
        chrome: chromeState(this.#cwd, null),
      }
    }

    const session = await openCurrentSession(
      this.#cwd,
      state.currentSpec,
      state.currentSessionFile,
    )
    await writeCurrentWorkspaceState(this.#cwd, state.currentSpec, session.file)
    return readyState(this.#cwd, state.currentSpec, session)
  }

  async startOrCreate(options?: {
    specTitle?: string
    createNewSpec?: boolean
  }): Promise<WorkspaceSessionReadyState> {
    await ensureWorkspaceDirs(this.#cwd)
    const existing = await readWorkspaceState(this.#cwd)
    const spec =
      existing && !options?.createNewSpec
        ? existing.currentSpec
        : createSpec(options?.specTitle)
    const session = await createBoundSession(this.#cwd, spec)
    await writeCurrentWorkspaceState(this.#cwd, spec, session.file)
    return readyState(this.#cwd, spec, session)
  }

  async createNewSessionForCurrentSpec(): Promise<WorkspaceSessionState> {
    const state = await readWorkspaceState(this.#cwd)
    if (!state) {
      return {
        status: "needs_human",
        cwd: this.#cwd,
        reason: "No current spec is selected for this workspace.",
        chrome: chromeState(this.#cwd, null),
      }
    }

    const session = await createBoundSession(this.#cwd, state.currentSpec)
    await writeCurrentWorkspaceState(this.#cwd, state.currentSpec, session.file)
    return readyState(this.#cwd, state.currentSpec, session)
  }

  async bindCurrentSpecToSession(
    manager: SessionManager,
  ): Promise<WorkspaceSessionReadyState> {
    const state = await readWorkspaceState(this.#cwd)
    if (!state) {
      throw new Error("No current spec is selected for this workspace.")
    }

    const session = bindSessionToSpec(manager, state.currentSpec)
    await writeCurrentWorkspaceState(this.#cwd, state.currentSpec, session.file)
    return readyState(this.#cwd, state.currentSpec, session)
  }

  async deriveChromeState(): Promise<WorkspaceSessionChromeState> {
    const state = await readWorkspaceState(this.#cwd)
    return chromeState(this.#cwd, state?.currentSpec ?? null)
  }
}

function createSpec(title = "Untitled spec"): WorkspaceSpecState {
  return { id: `spec-${randomUUID()}`, title }
}

async function createBoundSession(
  cwd: string,
  spec: WorkspaceSpecState,
): Promise<WorkspaceSessionReadyState["session"]> {
  await ensureWorkspaceDirs(cwd)
  const manager = SessionManager.create(cwd, sessionDir(cwd))
  const sessionFile = manager.getSessionFile()
  if (!sessionFile) {
    throw new Error("Pi SessionManager did not create a persisted session file")
  }
  return bindSessionToSpec(manager, spec)
}

async function openCurrentSession(
  cwd: string,
  spec: WorkspaceSpecState,
  currentSessionFile: string | undefined,
): Promise<WorkspaceSessionReadyState["session"]> {
  await ensureWorkspaceDirs(cwd)
  const files = await listSessionFiles(cwd)
  const manager = currentSessionFile
    ? SessionManager.open(currentSessionFile, sessionDir(cwd), cwd)
    : files.length === 0
      ? SessionManager.create(cwd, sessionDir(cwd))
      : SessionManager.continueRecent(cwd, sessionDir(cwd))
  const sessionFile = manager.getSessionFile()
  if (!sessionFile) {
    throw new Error("Pi SessionManager did not open a persisted session file")
  }
  return bindSessionToSpec(manager, spec)
}

function bindSessionToSpec(
  manager: SessionManager,
  spec: WorkspaceSpecState,
): WorkspaceSessionReadyState["session"] {
  const sessionFile = manager.getSessionFile()
  if (!sessionFile) {
    throw new Error("Pi SessionManager did not create a persisted session file")
  }

  const existingBindings = manager.getEntries().filter(isSessionBindingEntry)
  if (existingBindings.length === 0) {
    manager.appendCustomEntry(
      SESSION_BINDING_TYPE,
      createSessionBindingData({
        sessionId: manager.getSessionId(),
        specId: spec.id,
        specTitle: spec.title,
      }),
    )
  } else if (
    existingBindings.length !== 1 ||
    existingBindings[0]?.data.sessionId !== manager.getSessionId() ||
    existingBindings[0].data.specId !== spec.id
  ) {
    throw new Error(
      "Session already has an incompatible Brunch session binding",
    )
  }

  flushSessionWithoutAssistant(manager)
  return { id: manager.getSessionId(), file: sessionFile, manager }
}

interface FlushableSessionManager {
  _rewriteFile(): void
}

function flushSessionWithoutAssistant(manager: SessionManager): void {
  const sessionFile = manager.getSessionFile()
  ;(manager as unknown as FlushableSessionManager)._rewriteFile()
  if (sessionFile) {
    manager.setSessionFile(sessionFile)
  }
}

async function ensureWorkspaceDirs(cwd: string): Promise<void> {
  await mkdir(sessionDir(cwd), { recursive: true })
}

function brunchDir(cwd: string): string {
  return join(cwd, BRUNCH_DIR)
}

function sessionDir(cwd: string): string {
  return join(brunchDir(cwd), SESSION_DIR)
}

function statePath(cwd: string): string {
  return join(brunchDir(cwd), STATE_FILE)
}

async function readWorkspaceState(
  cwd: string,
): Promise<WorkspaceStateFile | null> {
  try {
    const parsed = JSON.parse(
      await readFile(statePath(cwd), "utf8"),
    ) as Partial<WorkspaceStateFile>
    if (
      parsed.schemaVersion === STATE_SCHEMA_VERSION &&
      typeof parsed.currentSpec?.id === "string" &&
      typeof parsed.currentSpec.title === "string"
    ) {
      return parsed as WorkspaceStateFile
    }
    return null
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null
    }
    throw error
  }
}

async function inspectWorkspaceInventory(
  cwd: string,
): Promise<WorkspaceLaunchInventory> {
  const state = await readWorkspaceState(cwd)
  const files = await listSessionFiles(cwd)
  const specsById = new Map<string, WorkspaceLaunchSpec>()
  const unavailableSessions: WorkspaceUnavailableSession[] = []

  if (state) {
    specsById.set(state.currentSpec.id, {
      spec: state.currentSpec,
      sessions: [],
    })
  }

  for (const file of files) {
    const session = await inspectSessionFile(file)
    if (session.available) {
      const spec = getOrCreateLaunchSpec(specsById, {
        id: session.specId,
        title: session.specTitle,
      })
      spec.sessions.push(session)
    } else {
      unavailableSessions.push(session)
    }
  }

  const specs = [...specsById.values()]
    .map((spec) => ({
      ...spec,
      sessions: spec.sessions.sort((left, right) =>
        left.file.localeCompare(right.file),
      ),
    }))
    .sort((left, right) => left.spec.title.localeCompare(right.spec.title))

  return {
    cwd,
    currentSpec: state?.currentSpec ?? null,
    currentSessionFile: state?.currentSessionFile ?? null,
    needsNewSpec: specs.length === 0,
    specs,
    unavailableSessions: unavailableSessions.sort((left, right) =>
      left.file.localeCompare(right.file),
    ),
  }
}

type InspectedSessionFile = WorkspaceLaunchSession | WorkspaceUnavailableSession

async function inspectSessionFile(file: string): Promise<InspectedSessionFile> {
  const entries = await readJsonl(file)
  const header = entries.find(isSessionHeader)
  if (!header) {
    return { file, reason: "missing_header", available: false }
  }

  const bindings = entries.filter(isSessionBindingEntry)
  if (bindings.length === 0) {
    return { file, reason: "missing_binding", available: false }
  }

  const binding = bindings[0]!
  if (bindings.length !== 1 || binding.data.sessionId !== header.id) {
    return { file, reason: "incompatible_binding", available: false }
  }

  return {
    id: header.id,
    file,
    specId: binding.data.specId,
    specTitle: binding.data.specTitle,
    available: true,
  }
}

function getOrCreateLaunchSpec(
  specsById: Map<string, WorkspaceLaunchSpec>,
  spec: WorkspaceSpecState,
): WorkspaceLaunchSpec {
  const existing = specsById.get(spec.id)
  if (existing) {
    return existing
  }
  const created = { spec, sessions: [] }
  specsById.set(spec.id, created)
  return created
}

async function writeWorkspaceState(
  cwd: string,
  state: WorkspaceStateFile,
): Promise<void> {
  await ensureWorkspaceDirs(cwd)
  await writeFile(statePath(cwd), `${JSON.stringify(state, null, 2)}\n`, "utf8")
}

async function writeCurrentWorkspaceState(
  cwd: string,
  spec: WorkspaceSpecState,
  currentSessionFile: string,
): Promise<void> {
  await writeWorkspaceState(cwd, {
    schemaVersion: STATE_SCHEMA_VERSION,
    currentSpec: spec,
    currentSessionFile,
  })
}

function readyState(
  cwd: string,
  spec: WorkspaceSpecState,
  session: WorkspaceSessionReadyState["session"],
): WorkspaceSessionReadyState {
  return {
    status: "ready",
    cwd,
    spec,
    session,
    chrome: chromeState(cwd, spec),
  }
}

function needsHumanState(
  cwd: string,
  spec: WorkspaceSpecState | null,
  reason: string,
): WorkspaceSessionNeedsHumanState {
  return {
    status: "needs_human",
    cwd,
    reason,
    chrome: chromeState(cwd, spec),
  }
}

function chromeState(
  cwd: string,
  spec: WorkspaceSpecState | null,
): WorkspaceSessionChromeState {
  return {
    cwd,
    spec,
    phase: spec ? "elicitation" : "select_spec",
    chatMode: spec ? "responding-to-elicitation" : "select-spec",
  }
}

export interface WorkspaceStoreOracleOptions {
  cwd: string
  expectedSessionCount?: number
}

export interface WorkspaceStoreOracleSuccess {
  ok: true
  specId: string
  sessions: Array<{
    file: string
    sessionId: string
    bindingCount: number
    binding: SessionBindingData
  }>
}

export interface WorkspaceStoreOracleFailure {
  ok: false
  errors: string[]
}

export type WorkspaceStoreOracleResult = WorkspaceStoreOracleSuccess | WorkspaceStoreOracleFailure

export async function verifyWorkspaceSessionStores(
  options: WorkspaceStoreOracleOptions,
): Promise<WorkspaceStoreOracleResult> {
  const cwd = resolve(options.cwd)
  const errors: string[] = []
  const state = await readWorkspaceState(cwd)
  if (!state) {
    return { ok: false, errors: ["Missing or invalid .brunch/state.json"] }
  }

  const files = await listSessionFiles(cwd)
  if (
    options.expectedSessionCount !== undefined &&
    files.length !== options.expectedSessionCount
  ) {
    errors.push(
      `Expected ${options.expectedSessionCount} session file(s), found ${files.length}`,
    )
  }

  const sessions: WorkspaceStoreOracleSuccess["sessions"] = []

  for (const file of files) {
    const entries = await readJsonl(file)
    const header = entries.find(isSessionHeader)
    const bindings = entries.filter(isSessionBindingEntry)
    if (!header) {
      errors.push(`${file} has no session header`)
      continue
    }
    if (bindings.length !== 1) {
      errors.push(
        `${file} has ${bindings.length} ${SESSION_BINDING_TYPE} entries`,
      )
      continue
    }
    const binding = bindings[0]!.data
    if (binding.specId !== state.currentSpec.id) {
      errors.push(
        `${file} binding spec ${binding.specId} does not match state ${state.currentSpec.id}`,
      )
    }
    if (binding.sessionId !== header.id) {
      errors.push(
        `${file} binding session ${binding.sessionId} does not match header ${header.id}`,
      )
    }
    sessions.push({
      file,
      sessionId: header.id,
      bindingCount: bindings.length,
      binding,
    })
  }

  return errors.length === 0
    ? { ok: true, specId: state.currentSpec.id, sessions }
    : { ok: false, errors }
}

async function listSessionFiles(cwd: string): Promise<string[]> {
  try {
    const entries = await readdir(sessionDir(cwd), { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
      .map((entry) => join(sessionDir(cwd), entry.name))
      .sort()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return []
    }
    throw error
  }
}

async function readJsonl(file: string): Promise<unknown[]> {
  const content = await readFile(file, "utf8")
  return content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown)
}

function isSessionHeader(value: unknown): value is SessionHeader {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "session" &&
    typeof (value as { id?: unknown }).id === "string"
  )
}
