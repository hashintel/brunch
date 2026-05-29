import type { Server as HttpServer } from "node:http"

import { WebSocketServer, type RawData } from "ws"

import { dispatchJsonRpcMessage } from "./protocol.js"
import type { RpcHandlers } from "./handlers.js"

export interface WebRpcTransport {
  close(): Promise<void>
}

export function attachWebRpcTransport(options: {
  server: HttpServer
  path: string
  handlers: RpcHandlers
}): WebRpcTransport {
  const webSocketServer = new WebSocketServer({ noServer: true })

  options.server.on("upgrade", (request, socket, head) => {
    if (request.url !== options.path) {
      socket.destroy()
      return
    }

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit("connection", webSocket, request)
    })
  })

  webSocketServer.on("connection", (webSocket) => {
    webSocket.on("message", (data) => {
      void handleMessage(options.handlers, data).then(
        ({ response, method }) => {
          webSocket.send(JSON.stringify(response))
          if (isProductMutation(method) && !Object.hasOwn(response, "error")) {
            broadcastProductUpdate()
          }
        },
      )
    })
  })

  return {
    async close() {
      for (const client of webSocketServer.clients) {
        client.close()
      }
      await new Promise<void>((resolve, reject) => {
        webSocketServer.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
    },
  }
  function broadcastProductUpdate(): void {
    const notification = JSON.stringify({
      jsonrpc: "2.0",
      method: "brunch.updated",
      params: {
        topics: [
          "workspace.snapshot",
          "session.pendingExchange",
          "session.elicitationExchanges",
          "session.transcriptDisplay",
        ],
      },
    })
    for (const client of webSocketServer.clients) {
      client.send(notification)
    }
  }
}

async function handleMessage(handlers: RpcHandlers, data: RawData) {
  const message = websocketMessageToString(data)
  return {
    response: await dispatchJsonRpcMessage(message, handlers),
    method: requestMethod(message),
  }
}

function requestMethod(message: string): string | undefined {
  try {
    const value = JSON.parse(message) as unknown
    return typeof value === "object" &&
      value !== null &&
      typeof (value as { method?: unknown }).method === "string"
      ? (value as { method: string }).method
      : undefined
  } catch {
    return undefined
  }
}

function isProductMutation(method: string | undefined): boolean {
  return (
    method === "workspace.activate" ||
    method === "session.startElicitation" ||
    method === "elicitation.respond"
  )
}

function websocketMessageToString(data: RawData): string {
  if (typeof data === "string") {
    return data
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8")
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(data)).toString("utf8")
  }
  return Buffer.from(data).toString("utf8")
}
