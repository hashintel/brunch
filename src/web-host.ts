import { createServer, type Server } from "node:http"

export interface WebHostOptions {
  cwd: string
  port?: number
  hostname?: string
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

  const hostname = options.hostname ?? "127.0.0.1"
  await listen(server, options.port ?? 0, hostname)
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected Brunch web host to listen on a TCP address")
  }

  return {
    url: `http://${hostname}:${address.port}`,
    close: () => close(server),
  }
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
