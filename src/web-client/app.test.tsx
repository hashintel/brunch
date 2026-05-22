// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { BrunchWebApp, createBrunchWebRuntime } from "./app.js"
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
    close: vi.fn(),
  }
}

describe("Brunch React web app", () => {
  it("renders workspace chrome from workspace.snapshot via the RPC client", async () => {
    const runtime = createBrunchWebRuntime({ rpcClient: rpcClient() })

    render(<BrunchWebApp runtime={runtime} />)

    expect(await screen.findByText("/tmp/brunch-project")).toBeTruthy()
    expect(screen.getByText("Web spec")).toBeTruthy()
    expect(screen.getByText("session-1")).toBeTruthy()
    expect(screen.getByText("elicitation")).toBeTruthy()
    expect(screen.getByText("responding-to-elicitation")).toBeTruthy()
  })

  it("keeps one router and QueryClient across BrunchWebApp re-renders", async () => {
    const runtime = createBrunchWebRuntime({ rpcClient: rpcClient() })
    const initialRouter = runtime.router
    const initialQueryClient = runtime.queryClient
    const { rerender } = render(<BrunchWebApp runtime={runtime} />)
    await screen.findByText("Web spec")

    rerender(<BrunchWebApp runtime={runtime} />)

    expect(runtime.router).toBe(initialRouter)
    expect(runtime.queryClient).toBe(initialQueryClient)
  })

  it("disposes the root-owned RPC client", () => {
    const client = rpcClient()
    const runtime = createBrunchWebRuntime({ rpcClient: client })

    runtime.dispose()

    expect(client.close).toHaveBeenCalledOnce()
  })
})
