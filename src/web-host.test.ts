import { describe, expect, it } from "vitest"

import { startWebHost } from "./web-host.js"

function text(response: Response): Promise<string> {
  return response.text()
}

describe("web host", () => {
  it("serves a native Brunch HTML shell on an ephemeral port", async () => {
    const host = await startWebHost({ cwd: "/tmp/brunch-project", port: 0 })
    try {
      const response = await fetch(host.url)
      const html = await text(response)

      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain("text/html")
      expect(html).toContain("Brunch")
      expect(html).not.toContain("pi-web-ui")
    } finally {
      await host.close()
    }
  })

  it("does not expose product read endpoints over HTTP GET", async () => {
    const host = await startWebHost({ cwd: "/tmp/brunch-project", port: 0 })
    try {
      const response = await fetch(`${host.url}/workspace.snapshot`)

      expect(response.status).toBe(404)
    } finally {
      await host.close()
    }
  })
})
