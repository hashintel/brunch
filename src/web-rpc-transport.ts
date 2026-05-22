import type { Server as HttpServer } from "node:http"

import { WebSocketServer, type RawData } from "ws"

import {
  createJsonRpcFailure,
  isJsonRpcRequest,
  jsonRpcRequestId,
  parseJsonRpcMessage,
} from "./json-rpc-protocol.js"
import type { RpcHandlers } from "./rpc.js"

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
      void handleMessage(options.handlers, data).then((response) => {
        webSocket.send(JSON.stringify(response))
      })
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
}

async function handleMessage(handlers: RpcHandlers, data: RawData) {
  const message = websocketMessageToString(data)
  const parsed = parseJsonRpcMessage(message)
  if (!parsed.ok) {
    return parsed.response
  }

  try {
    return await handlers.handle(parsed.value)
  } catch {
    const id = isJsonRpcRequest(parsed.value)
      ? jsonRpcRequestId(parsed.value)
      : null
    return createJsonRpcFailure(id, -32603, "Internal error")
  }
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
