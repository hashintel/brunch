import { readFile } from "node:fs/promises"
import { createServer, type Server } from "node:http"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { createRpcHandlers } from "./rpc.js"
import { attachWebRpcTransport } from "./web-rpc-transport.js"
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
    <script type="module" src="/assets/brunch-web.js"></script>
  </body>
</html>
`

export async function startWebHost(
  options: WebHostOptions,
): Promise<RunningWebHost> {
  void options.cwd
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/") {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      })
      response.end(SHELL_HTML)
      return
    }

    if (request.method === "GET" && request.url === "/assets/brunch-web.js") {
      void readWebAsset("assets/brunch-web.js").then(
        (asset) => {
          response.writeHead(200, {
            "content-type": "text/javascript; charset=utf-8",
            "cache-control": "no-store",
          })
          response.end(asset)
        },
        () => {
          response.writeHead(404, {
            "content-type": "text/plain; charset=utf-8",
          })
          response.end("Not found")
        },
      )
      return
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
    response.end("Not found")
  })

  const rpcTransport = options.coordinator
    ? attachWebRpcTransport({
        server,
        path: "/rpc",
        handlers: createRpcHandlers({ coordinator: options.coordinator }),
      })
    : null

  const hostname = options.hostname ?? "127.0.0.1"
  await listen(server, options.port ?? 0, hostname)
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected Brunch web host to listen on a TCP address")
  }

  return {
    url: `http://${hostname}:${address.port}`,
    async close() {
      await rpcTransport?.close()
      await close(server)
    },
  }
}

async function readWebAsset(relativePath: string): Promise<Buffer> {
  return readFile(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "dist-web",
      relativePath,
    ),
  )
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
