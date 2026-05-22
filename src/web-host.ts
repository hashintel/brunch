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
  webAssetRoot?: string
}

export interface RunningWebHost {
  url: string
  close(): Promise<void>
}

const MISSING_WEB_BUNDLE_MESSAGE =
  "Brunch web bundle is missing. Run npm run build:web before starting web mode."

export async function startWebHost(
  options: WebHostOptions,
): Promise<RunningWebHost> {
  void options.cwd
  const webAssetRoot = options.webAssetRoot ?? defaultWebAssetRoot()
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/") {
      void readWebAsset(webAssetRoot, "index.html").then(
        (asset) => {
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
          })
          response.end(asset)
        },
        () => {
          response.writeHead(500, {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
          })
          response.end(MISSING_WEB_BUNDLE_MESSAGE)
        },
      )
      return
    }

    if (request.method === "GET" && request.url?.startsWith("/assets/")) {
      const relativePath = request.url.slice(1)
      void readWebAsset(webAssetRoot, relativePath).then(
        (asset) => {
          response.writeHead(200, {
            "content-type": contentTypeForAsset(relativePath),
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

function defaultWebAssetRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "dist-web")
}

async function readWebAsset(
  webAssetRoot: string,
  relativePath: string,
): Promise<Buffer> {
  return readFile(join(webAssetRoot, relativePath))
}

function contentTypeForAsset(relativePath: string): string {
  if (relativePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8"
  }
  if (relativePath.endsWith(".css")) {
    return "text/css; charset=utf-8"
  }
  return "application/octet-stream"
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
