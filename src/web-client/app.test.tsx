// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { BrunchWebApp } from "./app.js"
import type { WebSocketRpcClient } from "./rpc-client.js"

function rpcClient(): WebSocketRpcClient {
  return {
    async request(method) {
      expect(method).toBe("workspace.snapshot")
      return {
        status: "ready",
        cwd: "/tmp/brunch-project",
        spec: { id: "spec-1", title: "Web spec" },
        session: { id: "session-1", file: "/tmp/session.jsonl" },
        chrome: {
          phase: "elicitation",
          chatMode: "responding-to-elicitation",
        },
      }
    },
  }
}

describe("Brunch React web app", () => {
  it("renders workspace chrome from workspace.snapshot via the RPC client", async () => {
    render(<BrunchWebApp rpcClient={rpcClient()} />)

    expect(await screen.findByText("/tmp/brunch-project")).toBeTruthy()
    expect(screen.getByText("Web spec")).toBeTruthy()
    expect(screen.getByText("session-1")).toBeTruthy()
    expect(screen.getByText("elicitation")).toBeTruthy()
    expect(screen.getByText("responding-to-elicitation")).toBeTruthy()
  })
})
