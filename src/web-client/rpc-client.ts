import type {
  JsonRpcFailure,
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcResponse,
} from "../json-rpc-protocol.js"

export type { JsonRpcRequest, JsonRpcResponse } from "../json-rpc-protocol.js"

type WebSocketEventListener = (event: { data?: unknown }) => void

type WebSocketLike = Pick<WebSocket, "send" | "close"> & {
  addEventListener(event: string, listener: WebSocketEventListener): void
}

type WebSocketConstructor = new (url: string) => WebSocketLike

export interface WebSocketRpcClient {
  request<T>(method: string, params?: unknown): Promise<T>
  close(): void
}

export class JsonRpcClientError extends Error {
  readonly code: number

  constructor(error: JsonRpcFailure["error"]) {
    super(error.message)
    this.name = "JsonRpcClientError"
    this.code = error.code
  }
}

type PendingRequest = {
  resolve(value: unknown): void
  reject(error: Error): void
}

export function createWebSocketRpcClient(options: {
  url?: string
  WebSocketImpl?: WebSocketConstructor
}): WebSocketRpcClient {
  const WebSocketImpl = options.WebSocketImpl ?? WebSocket
  const url = options.url ?? defaultRpcUrl()
  const socket = new WebSocketImpl(url)
  const pending = new Map<JsonRpcId, PendingRequest>()
  const queued: string[] = []
  let nextId = 1
  let isOpen = false
  let isClosed = false

  socket.addEventListener("open", () => {
    isOpen = true
    for (const message of queued.splice(0)) {
      socket.send(message)
    }
  })

  socket.addEventListener("message", (event) => {
    const response = JSON.parse(String(event.data)) as JsonRpcResponse
    const request = pending.get(response.id)
    if (!request) {
      return
    }
    pending.delete(response.id)
    if ("error" in response) {
      request.reject(new JsonRpcClientError(response.error))
      return
    }
    request.resolve(response.result)
  })

  socket.addEventListener("close", () => {
    if (!isClosed) {
      rejectPending(new Error("Brunch WebSocket RPC connection closed"))
    }
    isClosed = true
  })

  socket.addEventListener("error", () => {
    rejectPending(new Error("Brunch WebSocket RPC connection failed"))
  })

  function rejectPending(error: Error): void {
    for (const request of pending.values()) {
      request.reject(error)
    }
    pending.clear()
    queued.length = 0
  }

  return {
    request<T,>(method: string, params?: unknown): Promise<T> {
      if (isClosed) {
        return Promise.reject(new Error("Brunch WebSocket RPC client closed"))
      }

      const id = nextId
      nextId += 1
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id,
        method,
        ...(params === undefined ? {} : { params }),
      }
      const message = JSON.stringify(request)

      return new Promise<T>((resolve, reject) => {
        pending.set(id, {
          resolve: (value) => resolve(value as T),
          reject,
        })
        if (isOpen) {
          socket.send(message)
          return
        }
        queued.push(message)
      })
    },

    close() {
      if (isClosed) {
        return
      }
      isClosed = true
      rejectPending(new Error("Brunch WebSocket RPC client closed"))
      socket.close()
    },
  }
}

function defaultRpcUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${window.location.host}/rpc`
}
