export interface JsonRpcRequest {
  jsonrpc: "2.0"
  id: number
  method: string
  params?: unknown
}

export interface JsonRpcSuccess<T> {
  jsonrpc: "2.0"
  id: number
  result: T
}

export interface JsonRpcFailure {
  jsonrpc: "2.0"
  id: number
  error: {
    code: number
    message: string
  }
}

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcFailure

type WebSocketLike = Pick<WebSocket, "send" | "close" | "addEventListener">

type WebSocketConstructor = new (url: string) => WebSocketLike

export interface WebSocketRpcClient {
  request<T>(method: string, params?: unknown): Promise<T>
}

export function createWebSocketRpcClient(options: {
  url?: string
  WebSocketImpl?: WebSocketConstructor
}): WebSocketRpcClient {
  const WebSocketImpl = options.WebSocketImpl ?? WebSocket
  const url = options.url ?? defaultRpcUrl()
  let nextId = 1

  return {
    request<T,>(method: string, params?: unknown): Promise<T> {
      const id = nextId
      nextId += 1
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id,
        method,
        ...(params === undefined ? {} : { params }),
      }
      const socket = new WebSocketImpl(url)

      return new Promise<T>((resolve, reject) => {
        socket.addEventListener(
          "open",
          () => {
            socket.send(JSON.stringify(request))
          },
          { once: true },
        )
        socket.addEventListener(
          "message",
          (event) => {
            socket.close()
            const response = JSON.parse(
              String(event.data),
            ) as JsonRpcResponse<T>
            if ("error" in response) {
              reject(new Error(response.error.message))
              return
            }
            resolve(response.result)
          },
          { once: true },
        )
        socket.addEventListener(
          "error",
          () => {
            socket.close()
            reject(new Error("Brunch WebSocket RPC connection failed"))
          },
          { once: true },
        )
      })
    },
  }
}

function defaultRpcUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${window.location.host}/rpc`
}
