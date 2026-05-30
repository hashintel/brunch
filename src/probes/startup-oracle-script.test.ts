import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("startup TUI oracle script", () => {
  it("asserts Brunch identity markers without promoting the host-sensitive probe into verify", async () => {
    const script = await readFile(
      new URL("./scripts/verify-startup-no-resume.sh", import.meta.url),
      "utf8",
    )

    expect(script).toContain("BRUNCH_WORDMARK_TOP")
    expect(script).toContain("built on Pi v")
    expect(script).toContain("Choose or create the spec/session")
    expect(script).toContain("manual/middle-loop oracle")
    expect(script).not.toContain("npm run verify")
  })
})
