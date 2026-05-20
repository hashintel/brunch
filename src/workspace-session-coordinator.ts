import { randomUUID } from "node:crypto"
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises"
import { join, resolve } from "node:path"

import {
  SessionManager,
  type CustomEntry,
  type SessionHeader,
} from "@earendil-works/pi-coding-agent"

const BRUNCH_DIR = ".brunch"
const STATE_FILE = "state.json"
const SESSION_DIR = "sessions"
const SESSION_BINDING_TYPE = "brunch.session_binding"
const STATE_SCHEMA_VERSION = 1
const BINDING_SCHEMA_VERSION = 1

export interface WorkspaceSpecState {
  id: string
  title: string
}

interface WorkspaceStateFile {
  schemaVersion: 1
  currentSpec: WorkspaceSpecState
}

interface SessionBindingData {
  schemaVersion: 1
  sessionId: string
  specId: string
  specTitle: string
}

type SessionBindingEntry = CustomEntry<SessionBindingData> & {
  customType: typeof SESSION_BINDING_TYPE
  data: SessionBindingData
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

export type WorkspaceSessionState = WorkspaceSessionReadyState | WorkspaceSessionSelectSpecState | WorkspaceSessionNeedsHumanState

export interface WorkspaceSessionCoordinator {
  openExisting(): Promise<WorkspaceSessionState>
  startOrCreate(options?: {
    specTitle?: string
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

  async openExisting(): Promise<WorkspaceSessionState> {
    const state = await readWorkspaceState(this.#cwd)
    if (!state) {
      return {
        status: "select_spec",
        cwd: this.#cwd,
        chrome: chromeState(this.#cwd, null),
      }
    }

    const session = await createBoundSession(this.#cwd, state.currentSpec)
    return readyState(this.#cwd, state.currentSpec, session)
  }

  async startOrCreate(options?: {
    specTitle?: string
  }): Promise<WorkspaceSessionReadyState> {
    await ensureWorkspaceDirs(this.#cwd)
    const existing = await readWorkspaceState(this.#cwd)
    const spec = existing?.currentSpec ?? createSpec(options?.specTitle)
    if (!existing) {
      await writeWorkspaceState(this.#cwd, {
        schemaVersion: STATE_SCHEMA_VERSION,
        currentSpec: spec,
      })
    }

    const session = await createBoundSession(this.#cwd, spec)
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
    manager.appendCustomEntry(SESSION_BINDING_TYPE, {
      schemaVersion: BINDING_SCHEMA_VERSION,
      sessionId: manager.getSessionId(),
      specId: spec.id,
      specTitle: spec.title,
    } satisfies SessionBindingData)
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

async function writeWorkspaceState(
  cwd: string,
  state: WorkspaceStateFile,
): Promise<void> {
  await ensureWorkspaceDirs(cwd)
  await writeFile(statePath(cwd), `${JSON.stringify(state, null, 2)}\n`, "utf8")
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

function isSessionBindingEntry(value: unknown): value is SessionBindingEntry {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { type?: unknown }).type !== "custom" ||
    (value as { customType?: unknown }).customType !== SESSION_BINDING_TYPE
  ) {
    return false
  }

  const data = (value as { data?: unknown }).data
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { schemaVersion?: unknown }).schemaVersion ===
      BINDING_SCHEMA_VERSION &&
    typeof (data as { sessionId?: unknown }).sessionId === "string" &&
    typeof (data as { specId?: unknown }).specId === "string" &&
    typeof (data as { specTitle?: unknown }).specTitle === "string"
  )
}
