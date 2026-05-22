import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { SessionManager } from "@earendil-works/pi-coding-agent"

import { projectElicitationExchanges } from "./elicitation-exchange.js"
import { SESSION_BINDING_TYPE } from "./session-binding.js"
import {
  createWorkspaceSessionCoordinator,
  verifyWorkspaceSessionStores,
} from "./workspace-session-coordinator.js"

type JsonlLine = {
  type?: string
  customType?: string
}

describe("WorkspaceSessionCoordinator", () => {
  it("creates scoped state, a bound pi session, and derivable chrome state", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })

    const result = await coordinator.createSetupSession({
      specTitle: "Scratch spec",
    })

    expect(result.status).toBe("ready")
    expect(result.chrome.cwd).toBe(cwd)
    expect(result.chrome.spec?.id).toMatch(/^spec-/u)
    expect(result.chrome.spec?.title).toBe("Scratch spec")
    expect(result.chrome.phase).toBe("elicitation")
    expect(result.chrome.chatMode).toBe("responding-to-elicitation")

    const oracle = await verifyWorkspaceSessionStores({
      cwd,
      expectedSessionCount: 1,
    })
    expect(oracle.ok).toBe(true)
    if (!oracle.ok) {
      expect(oracle.errors).toEqual([])
      return
    }
    expect(oracle.specId).toBe(result.spec.id)
    expect(oracle.sessions).toHaveLength(1)
    expect(oracle.sessions[0]?.binding.specId).toBe(result.spec.id)
  })

  it("jsonl coordinator new session reloads same spec", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })

    const first = await coordinator.createSetupSession({
      specTitle: "Scratch spec",
    })
    const second = await coordinator.createSetupSessionForCurrentSpec()

    expect(second.status).toBe("ready")
    if (second.status !== "ready") {
      return
    }
    expect(second.spec.id).toBe(first.spec.id)
    expect(second.session.id).not.toBe(first.session.id)

    const reloadedFirst = SessionManager.open(
      first.session.file,
      undefined,
      cwd,
    )
    const reloadedSecond = SessionManager.open(
      second.session.file,
      undefined,
      cwd,
    )
    const firstBinding = reloadedFirst
      .getEntries()
      .find((entry) => entry.customType === SESSION_BINDING_TYPE)
    const secondBinding = reloadedSecond
      .getEntries()
      .find((entry) => entry.customType === SESSION_BINDING_TYPE)

    expect(firstBinding).toMatchObject({
      data: { specId: first.spec.id, specTitle: "Scratch spec" },
    })
    expect(secondBinding).toMatchObject({
      data: { specId: first.spec.id, specTitle: "Scratch spec" },
    })

    const oracle = await verifyWorkspaceSessionStores({
      cwd,
      expectedSessionCount: 2,
    })
    expect(oracle.ok).toBe(true)
    if (!oracle.ok) {
      expect(oracle.errors).toEqual([])
      return
    }
    expect(oracle.sessions.map((session) => session.binding.specId)).toEqual([
      first.spec.id,
      first.spec.id,
    ])
    expect(oracle.sessions.every((session) => session.bindingCount === 1)).toBe(
      true,
    )
  })

  it("jsonl binding-only coordinator session reloads", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })

    const result = await coordinator.createSetupSession({
      specTitle: "Scratch spec",
    })
    const reloaded = SessionManager.open(result.session.file, undefined, cwd)
    const bindings = reloaded
      .getEntries()
      .filter((entry) => entry.customType === SESSION_BINDING_TYPE)

    expect(bindings).toHaveLength(1)
    expect(bindings[0]).toMatchObject({
      customType: SESSION_BINDING_TYPE,
      data: {
        sessionId: result.session.id,
        specId: result.spec.id,
        specTitle: result.spec.title,
      },
    })
  })

  it("jsonl coordinator pre-assistant flush does not duplicate prefix", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })

    const result = await coordinator.createSetupSession({
      specTitle: "Scratch spec",
    })
    const reloaded = SessionManager.open(result.session.file, undefined, cwd)
    reloaded.appendMessage({ role: "assistant", content: "hello" })
    reloaded.appendMessage({ role: "user", content: "hi" })

    const content = await readFile(result.session.file, "utf8")
    const lines = content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as JsonlLine)

    expect(lines.filter((entry) => entry.type === "session")).toHaveLength(1)
    expect(
      lines.filter((entry) => entry.customType === SESSION_BINDING_TYPE),
    ).toHaveLength(1)
  })

  it("jsonl session reload preserves coordinator binding", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })

    const result = await coordinator.createSetupSession({
      specTitle: "Scratch spec",
    })
    result.session.manager.appendMessage({
      role: "assistant",
      content: "hello",
    })
    result.session.manager.appendMessage({ role: "user", content: "answer" })

    const reloaded = SessionManager.open(result.session.file, undefined, cwd)
    const bindings = reloaded
      .getEntries()
      .filter((entry) => entry.customType === SESSION_BINDING_TYPE)

    expect(bindings).toHaveLength(1)
    expect(bindings[0]).toMatchObject({
      data: {
        sessionId: result.session.id,
        specId: result.spec.id,
        specTitle: "Scratch spec",
      },
    })
  })

  it("does not duplicate pre-assistant entries when flushed after the user message and before assistant persistence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })

    const result = await coordinator.createSetupSession({
      specTitle: "Scratch spec",
    })
    result.session.manager.appendModelChange("test-provider", "test-model")
    result.session.manager.appendThinkingLevelChange("high")
    await coordinator.bindCurrentSpecToReplacementSession(
      result.session.manager,
    )
    result.session.manager.appendMessage({ role: "user", content: "hello" })
    await coordinator.bindCurrentSpecToReplacementSession(
      result.session.manager,
    )
    result.session.manager.appendMessage({ role: "assistant", content: "hi" })

    const content = await readFile(result.session.file, "utf8")
    const sessionHeaderCount = content
      .split("\n")
      .filter((line) => line.includes('"type":"session"')).length
    const oracle = await verifyWorkspaceSessionStores({
      cwd,
      expectedSessionCount: 1,
    })

    expect(sessionHeaderCount).toBe(1)
    expect(oracle.ok).toBe(true)
    if (!oracle.ok) {
      expect(oracle.errors).toEqual([])
    }
  })

  it("jsonl session reload projects the same simple exchange", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })

    const result = await coordinator.createSetupSession({
      specTitle: "Scratch spec",
    })
    result.session.manager.appendMessage({
      role: "assistant",
      content: "Question",
    })
    result.session.manager.appendMessage({ role: "user", content: "Answer" })

    const beforeReload = projectElicitationExchanges(
      result.session.manager.getBranch(),
    )
    const afterReload = projectElicitationExchanges(
      SessionManager.open(result.session.file, undefined, cwd).getBranch(),
    )

    expect(afterReload).toEqual(beforeReload)
    expect(afterReload.exchanges).toHaveLength(1)
  })

  it("binds a pi-created replacement session to the current spec", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })

    const first = await coordinator.createSetupSession({
      specTitle: "Scratch spec",
    })
    const replacementFile = first.session.manager.newSession()
    await coordinator.bindCurrentSpecToReplacementSession(first.session.manager)

    expect(replacementFile).toBeDefined()
    const oracle = await verifyWorkspaceSessionStores({
      cwd,
      expectedSessionCount: 2,
    })
    expect(oracle.ok).toBe(true)
    if (!oracle.ok) {
      expect(oracle.errors).toEqual([])
      return
    }
    expect(
      oracle.sessions.every(
        (session) => session.binding.specId === first.spec.id,
      ),
    ).toBe(true)
    expect(oracle.sessions.every((session) => session.bindingCount === 1)).toBe(
      true,
    )
  })

  it("inspects current defaults, bound specs, and sessions without activation writes", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })

    const first = await coordinator.createSetupSession({ specTitle: "Alpha" })
    first.session.manager.appendMessage({ role: "user", content: "first" })
    const second = await coordinator.createSetupSession({
      specTitle: "Beta",
      createNewSpec: true,
    })
    const beforeState = await readFile(
      join(cwd, ".brunch", "state.json"),
      "utf8",
    )
    const beforeFirst = await readFile(first.session.file, "utf8")
    const beforeSecond = await readFile(second.session.file, "utf8")

    const inventory = await coordinator.inspectWorkspace()

    expect(inventory.cwd).toBe(cwd)
    expect(inventory.needsNewSpec).toBe(false)
    expect(inventory.currentSpec).toEqual(second.spec)
    expect(inventory.currentSessionFile).toBe(second.session.file)
    expect(inventory.specs.map(({ spec }) => spec.title)).toEqual([
      "Alpha",
      "Beta",
    ])
    expect(inventory.specs[0]?.sessions).toEqual([
      expect.objectContaining({
        id: first.session.id,
        file: first.session.file,
        specId: first.spec.id,
        specTitle: "Alpha",
        available: true,
      }),
    ])
    expect(inventory.specs[1]?.sessions).toEqual([
      expect.objectContaining({
        id: second.session.id,
        file: second.session.file,
        specId: second.spec.id,
        specTitle: "Beta",
        available: true,
      }),
    ])
    expect(inventory.unavailableSessions).toEqual([])
    await expect(
      readFile(join(cwd, ".brunch", "state.json"), "utf8"),
    ).resolves.toBe(beforeState)
    await expect(readFile(first.session.file, "utf8")).resolves.toBe(
      beforeFirst,
    )
    await expect(readFile(second.session.file, "utf8")).resolves.toBe(
      beforeSecond,
    )
  })

  it("inspects an empty workspace without creating session files", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })

    const inventory = await coordinator.inspectWorkspace()

    expect(inventory).toMatchObject({
      cwd,
      currentSpec: null,
      currentSessionFile: null,
      needsNewSpec: true,
      specs: [],
      unavailableSessions: [],
    })
    await expect(
      readFile(join(cwd, ".brunch", "sessions", "missing.jsonl"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("marks unbound or incompatible sessions unavailable during inventory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })
    const ready = await coordinator.createSetupSession({ specTitle: "Alpha" })
    const unboundFile = join(cwd, ".brunch", "sessions", "unbound.jsonl")
    const mismatchedFile = join(cwd, ".brunch", "sessions", "mismatched.jsonl")
    await writeFile(
      unboundFile,
      `${JSON.stringify({ type: "session", id: "unbound-session", cwd })}\n`,
      "utf8",
    )
    await writeFile(
      mismatchedFile,
      `${JSON.stringify({ type: "session", id: "header-session", cwd })}\n${JSON.stringify(
        {
          type: "custom",
          customType: SESSION_BINDING_TYPE,
          data: {
            schemaVersion: 1,
            sessionId: "other-session",
            specId: ready.spec.id,
            specTitle: ready.spec.title,
          },
        },
      )}\n`,
      "utf8",
    )
    const beforeUnbound = await readFile(unboundFile, "utf8")
    const beforeMismatched = await readFile(mismatchedFile, "utf8")

    const inventory = await coordinator.inspectWorkspace()

    expect(inventory.specs).toHaveLength(1)
    expect(inventory.specs[0]?.sessions).toHaveLength(1)
    expect(inventory.unavailableSessions).toEqual([
      expect.objectContaining({
        file: mismatchedFile,
        reason: "incompatible_binding",
      }),
      expect.objectContaining({ file: unboundFile, reason: "missing_binding" }),
    ])
    await expect(readFile(unboundFile, "utf8")).resolves.toBe(beforeUnbound)
    await expect(readFile(mismatchedFile, "utf8")).resolves.toBe(
      beforeMismatched,
    )
  })

  it("activates explicit open and continue decisions as the current workspace", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })
    const first = await coordinator.createSetupSession({ specTitle: "Alpha" })
    const second = await coordinator.createSetupSession({
      specTitle: "Beta",
      createNewSpec: true,
    })

    const opened = await coordinator.activateWorkspace({
      action: "openSession",
      specId: first.spec.id,
      sessionFile: first.session.file,
    })

    expect(opened.status).toBe("ready")
    if (opened.status !== "ready") {
      return
    }
    expect(opened.spec).toEqual(first.spec)
    expect(opened.session.id).toBe(first.session.id)
    expect(opened.session.file).toBe(first.session.file)
    expect(opened.chrome.spec).toEqual(first.spec)

    const continued = await coordinator.activateWorkspace({
      action: "continue",
      specId: second.spec.id,
      sessionFile: second.session.file,
    })

    expect(continued.status).toBe("ready")
    if (continued.status !== "ready") {
      return
    }
    expect(continued.spec).toEqual(second.spec)
    expect(continued.session.id).toBe(second.session.id)
    expect(
      JSON.parse(await readFile(join(cwd, ".brunch", "state.json"), "utf8")),
    ).toMatchObject({
      currentSpec: second.spec,
      currentSessionFile: second.session.file,
    })
  })

  it("activates a new session decision as a binding-only session for the selected spec", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })
    const first = await coordinator.createSetupSession({ specTitle: "Alpha" })
    first.session.manager.appendMessage({
      role: "user",
      content: "preserve me",
    })
    const beforeFirst = await readFile(first.session.file, "utf8")

    const created = await coordinator.activateWorkspace({
      action: "newSession",
      specId: first.spec.id,
    })

    expect(created.status).toBe("ready")
    if (created.status !== "ready") {
      return
    }
    expect(created.spec).toEqual(first.spec)
    expect(created.session.id).not.toBe(first.session.id)
    await expect(readFile(first.session.file, "utf8")).resolves.toBe(
      beforeFirst,
    )
    const createdContent = await readFile(created.session.file, "utf8")
    expect(createdContent).toContain(SESSION_BINDING_TYPE)
    expect(createdContent).not.toContain("preserve me")
    const oracle = await verifyWorkspaceSessionStores({
      cwd,
      expectedSessionCount: 2,
    })
    expect(oracle.ok).toBe(true)
  })

  it("activates a new spec decision by creating a bound current session", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })

    const created = await coordinator.activateWorkspace({
      action: "newSpec",
      title: "Gamma",
    })

    expect(created.status).toBe("ready")
    if (created.status !== "ready") {
      return
    }
    expect(created.spec.title).toBe("Gamma")
    expect(created.session.id).toMatch(/[\da-f-]+/iu)
    const oracle = await verifyWorkspaceSessionStores({
      cwd,
      expectedSessionCount: 1,
    })
    expect(oracle.ok).toBe(true)
  })

  it("activates cancel without mutating workspace state or session files", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })
    const ready = await coordinator.createSetupSession({ specTitle: "Alpha" })
    const beforeState = await readFile(
      join(cwd, ".brunch", "state.json"),
      "utf8",
    )
    const beforeSession = await readFile(ready.session.file, "utf8")

    const result = await coordinator.activateWorkspace({ action: "cancel" })

    expect(result.status).toBe("cancelled")
    await expect(
      readFile(join(cwd, ".brunch", "state.json"), "utf8"),
    ).resolves.toBe(beforeState)
    await expect(readFile(ready.session.file, "utf8")).resolves.toBe(
      beforeSession,
    )
  })

  it("refuses to activate mismatched or unavailable sessions", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })
    const ready = await coordinator.createSetupSession({ specTitle: "Alpha" })
    const unavailableFile = join(
      cwd,
      ".brunch",
      "sessions",
      "unavailable.jsonl",
    )
    await writeFile(
      unavailableFile,
      `${JSON.stringify({ type: "session", id: "unavailable-session", cwd })}\n`,
      "utf8",
    )

    const unavailable = await coordinator.activateWorkspace({
      action: "openSession",
      specId: ready.spec.id,
      sessionFile: unavailableFile,
    })
    const mismatched = await coordinator.activateWorkspace({
      action: "openSession",
      specId: "spec-missing",
      sessionFile: ready.session.file,
    })

    expect(unavailable.status).toBe("needs_human")
    expect(mismatched.status).toBe("needs_human")
  })

  it("asks for spec selection when no current spec exists and creation is not allowed", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    await mkdir(join(cwd, ".brunch"), { recursive: true })

    const coordinator = createWorkspaceSessionCoordinator({ cwd })
    const result = await coordinator.openDefaultWorkspace()

    expect(result.status).toBe("select_spec")
    expect(result.chrome.cwd).toBe(cwd)
    expect(result.chrome.spec).toBeNull()
  })
})
