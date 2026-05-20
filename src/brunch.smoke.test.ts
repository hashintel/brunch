import { describe, expect, it } from "vitest"

import {
  createAgentSession,
  SessionManager,
} from "@earendil-works/pi-coding-agent"

describe("pi-coding-agent import surface", () => {
  it("exposes createAgentSession and SessionManager", () => {
    expect(typeof createAgentSession).toBe("function")
    expect(typeof SessionManager).toBe("function")
    expect(typeof SessionManager.inMemory).toBe("function")
    expect(typeof SessionManager.create).toBe("function")
  })
})
