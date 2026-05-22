// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ElicitationExchangeProjection } from "../elicitation-exchange.js"
import type { WorkspaceSnapshot } from "../print-snapshot.js"
import { BrunchWebApp, createBrunchWebRuntime } from "./app.js"
import type { WebSocketRpcClient } from "./rpc-client.js"

interface RpcCall {
  method: string
  params?: unknown
}

const readySnapshot: WorkspaceSnapshot = {
  status: "ready",
  cwd: "/tmp/brunch-project",
  spec: { id: "spec-1", title: "Web spec" },
  session: { id: "session-1", file: "/tmp/session.jsonl" },
  chrome: {
    phase: "elicitation",
    chatMode: "responding-to-elicitation",
  },
}

const selectSpecSnapshot: WorkspaceSnapshot = {
  status: "select_spec",
  cwd: "/tmp/brunch-project",
  spec: null,
  chrome: {
    phase: "select_spec",
    chatMode: "select-spec",
  },
}

const readyProjection: ElicitationExchangeProjection = {
  status: "ready",
  exchanges: [
    {
      promptRange: { start: "prompt-1", end: "prompt-1" },
      responseRange: { start: "response-1", end: "response-1" },
      promptEntryIds: ["prompt-1"],
      responseEntryIds: ["response-1"],
    },
  ],
  openPrompt: null,
}

function rpcClient(options?: {
  snapshot?: WorkspaceSnapshot
  projection?: ElicitationExchangeProjection
  projectionError?: Error
  calls?: RpcCall[]
}): WebSocketRpcClient {
  const snapshot = options?.snapshot ?? readySnapshot
  const projection = options?.projection ?? readyProjection
  const calls = options?.calls
  return {
    async request(method, params) {
      calls?.push(params === undefined ? { method } : { method, params })
      if (method === "workspace.snapshot") {
        return snapshot
      }
      if (method === "session.elicitationExchanges") {
        if (options?.projectionError) {
          throw options.projectionError
        }
        return projection
      }
      throw new Error(`unexpected RPC method ${method}`)
    },
    close: vi.fn(),
  }
}

afterEach(() => cleanup())

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

  it("requests the selected session projection explicitly", async () => {
    const calls: RpcCall[] = []
    const runtime = createBrunchWebRuntime({ rpcClient: rpcClient({ calls }) })

    render(<BrunchWebApp runtime={runtime} />)

    expect(await screen.findByText("1 exchange")).toBeTruthy()
    expect(screen.getByText("Transcript status: ready")).toBeTruthy()
    expect(calls).toContainEqual({ method: "workspace.snapshot" })
    expect(calls).toContainEqual({
      method: "session.elicitationExchanges",
      params: { sessionId: "session-1", specId: "spec-1" },
    })
  })

  it("renders open-prompt projection state", async () => {
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        projection: {
          status: "open_prompt",
          exchanges: [],
          openPrompt: {
            promptRange: { start: "prompt-open", end: "prompt-open" },
            promptEntryIds: ["prompt-open"],
          },
        },
      }),
    })

    render(<BrunchWebApp runtime={runtime} />)

    expect(await screen.findByText("0 exchanges")).toBeTruthy()
    expect(screen.getByText("Transcript status: open_prompt")).toBeTruthy()
    expect(screen.getByText("Open prompt: prompt-open")).toBeTruthy()
  })

  it("does not request session projection when no session is selected", async () => {
    const calls: RpcCall[] = []
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ snapshot: selectSpecSnapshot, calls }),
    })

    render(<BrunchWebApp runtime={runtime} />)

    expect(await screen.findByText("No Brunch session selected.")).toBeTruthy()
    expect(calls).toEqual([{ method: "workspace.snapshot" }])
  })

  it("renders read-only session projection errors", async () => {
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        projectionError: new Error("Brunch session transcript is non-linear"),
      }),
    })

    render(<BrunchWebApp runtime={runtime} />)

    expect(
      await screen.findByText(
        "Transcript unavailable: Brunch session transcript is non-linear",
      ),
    ).toBeTruthy()
  })

  it("keeps one router and QueryClient across BrunchWebApp re-renders", async () => {
    const runtime = createBrunchWebRuntime({ rpcClient: rpcClient() })
    const initialRouter = runtime.router
    const initialQueryClient = runtime.queryClient
    const { rerender } = render(<BrunchWebApp runtime={runtime} />)
    await screen.findAllByText("Web spec")

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
