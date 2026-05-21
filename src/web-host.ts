import { createHash } from "node:crypto"
import { createServer, type Server } from "node:http"
import type { Duplex } from "node:stream"

import { createRpcHandlers } from "./rpc.js"
import type { WorkspaceSessionCoordinator } from "./workspace-session-coordinator.js"

export interface WebHostOptions {
  cwd: string
  port?: number
  hostname?: string
  coordinator?: WorkspaceSessionCoordinator
}

export interface RunningWebHost {
  url: string
  close(): Promise<void>
}

const SHELL_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Brunch</title>
  </head>
  <body>
    <main id="root" data-app="brunch-web-shell">
      <h1>Brunch</h1>
      <p>Native Brunch web shell.</p>
    </main>
  </body>
</html>
`

export async function startWebHost(
  options: WebHostOptions,
): Promise<RunningWebHost> {
  void options.cwd
  const sockets = new Set<Duplex>()
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/") {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      })
      response.end(SHELL_HTML)
      return
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
    response.end("Not found")
  })

  server.on("upgrade", (request, socket) => {
    if (request.url !== "/rpc" || !options.coordinator) {
      socket.destroy()
      return
    }

    const key = request.headers["sec-websocket-key"]
    if (typeof key !== "string") {
      socket.destroy()
      return
    }

    sockets.add(socket)
    socket.once("close", () => sockets.delete(socket))
    socket.write(websocketHandshakeResponse(key))

    const handlers = createRpcHandlers({ coordinator: options.coordinator })
    socket.on("data", (chunk) => {
      const message = readWebSocketTextFrame(chunk)
      if (message === null) {
        socket.end()
        return
      }

      void handlers.handle(JSON.parse(message) as unknown).then((response) => {
        socket.write(writeWebSocketTextFrame(JSON.stringify(response)))
      })
    })
  })

  const hostname = options.hostname ?? "127.0.0.1"
  await listen(server, options.port ?? 0, hostname)
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected Brunch web host to listen on a TCP address")
  }

  return {
    url: `http://${hostname}:${address.port}`,
    async close() {
      for (const socket of sockets) {
        socket.destroy()
      }
      await close(server)
    },
  }
}

function websocketHandshakeResponse(key: string): string {
  const accept = createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64")
  return [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    "",
  ].join("\r\n")
}

function readWebSocketTextFrame(frame: Buffer): string | null {
  const opcode = frame[0]! & 0x0f
  if (opcode === 0x8) {
    return null
  }
  if (opcode !== 0x1) {
    throw new Error("Unsupported WebSocket frame opcode")
  }

  let payloadLength = frame[1]! & 0x7f
  let offset = 2
  if (payloadLength === 126) {
    payloadLength = frame.readUInt16BE(offset)
    offset += 2
  } else if (payloadLength === 127) {
    throw new Error("Unsupported large WebSocket frame")
  }

  const masked = (frame[1]! & 0x80) !== 0
  const mask = masked ? frame.subarray(offset, offset + 4) : null
  if (masked) {
    offset += 4
  }

  const payload = Buffer.from(frame.subarray(offset, offset + payloadLength))
  if (mask) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] = payload[index]! ^ mask[index % 4]!
    }
  }
  return payload.toString("utf8")
}

function writeWebSocketTextFrame(message: string): Buffer {
  const payload = Buffer.from(message, "utf8")
  if (payload.length > 65_535) {
    throw new Error("WebSocket response is too large")
  }

  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x81, payload.length]), payload])
  }

  const header = Buffer.alloc(4)
  header[0] = 0x81
  header[1] = 126
  header.writeUInt16BE(payload.length, 2)
  return Buffer.concat([header, payload])
}

function listen(server: Server, port: number, hostname: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, hostname, () => {
      server.off("error", reject)
      resolve()
    })
  })
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}
