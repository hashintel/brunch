import { mkdir, mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  createWorkspaceSessionCoordinator,
  verifyWorkspaceSessionStores,
} from "./workspace-session-coordinator.js"

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

  it("creates a same-spec new session without mutating the first session binding", async () => {
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

  it("does not duplicate the binding when pi later flushes the first assistant message", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })

    const result = await coordinator.startOrCreate({
      specTitle: "Scratch spec",
    })
    result.session.manager.appendMessage({
      role: "assistant",
      content: "hello",
    })

    const oracle = await verifyWorkspaceSessionStores({
      cwd,
      expectedSessionCount: 1,
    })
    expect(oracle.ok).toBe(true)
    if (!oracle.ok) {
      expect(oracle.errors).toEqual([])
      return
    }
    expect(oracle.sessions[0]?.bindingCount).toBe(1)
  })

  it("does not duplicate pre-assistant entries when the coordinator flushes before agent start", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-ws-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })

    const result = await coordinator.startOrCreate({
      specTitle: "Scratch spec",
    })
    result.session.manager.appendModelChange("test-provider", "test-model")
    result.session.manager.appendThinkingLevelChange("high")
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
