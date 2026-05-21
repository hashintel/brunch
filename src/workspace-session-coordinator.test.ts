import { mkdir, mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { SessionManager } from "@earendil-works/pi-coding-agent"

import { projectElicitationExchanges } from "./elicitation-exchange.js"
import {
  createWorkspaceSessionCoordinator,
  verifyWorkspaceSessionStores,
} from "./workspace-session-coordinator.js"

const SESSION_BINDING_TYPE = "brunch.session_binding"

type JsonlLine = {
  type?: string
  customType?: string
}

describe("WorkspaceSessionCoordinator", () => {
  it("creates scoped state, a bound pi session, and derivable chrome state", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })

    const result = await coordinator.startOrCreate({
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

    const first = await coordinator.startOrCreate({ specTitle: "Scratch spec" })
    const second = await coordinator.createNewSessionForCurrentSpec()

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

    const result = await coordinator.startOrCreate({
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

    const result = await coordinator.startOrCreate({
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

    const result = await coordinator.startOrCreate({
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

    const result = await coordinator.startOrCreate({
      specTitle: "Scratch spec",
    })
    result.session.manager.appendModelChange("test-provider", "test-model")
    result.session.manager.appendThinkingLevelChange("high")
    await coordinator.bindCurrentSpecToSession(result.session.manager)
    result.session.manager.appendMessage({ role: "user", content: "hello" })
    await coordinator.bindCurrentSpecToSession(result.session.manager)
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

    const result = await coordinator.startOrCreate({
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

    const first = await coordinator.startOrCreate({ specTitle: "Scratch spec" })
    const replacementFile = first.session.manager.newSession()
    await coordinator.bindCurrentSpecToSession(first.session.manager)

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

  it("asks for spec selection when no current spec exists and creation is not allowed", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    await mkdir(join(cwd, ".brunch"), { recursive: true })

    const coordinator = createWorkspaceSessionCoordinator({ cwd })
    const result = await coordinator.openExisting()

    expect(result.status).toBe("select_spec")
    expect(result.chrome.cwd).toBe(cwd)
    expect(result.chrome.spec).toBeNull()
  })
})
