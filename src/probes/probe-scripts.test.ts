import { access } from "node:fs/promises"
import { constants } from "node:fs"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { describe, expect, it } from "vitest"

const execFileAsync = promisify(execFile)

describe("M1 probe script", () => {
  it("runs and prints expected plus actual outputs", async () => {
    await access("src/probes/scripts/verify-m1.sh", constants.X_OK)

    const { stdout } = await execFileAsync(
      "./src/probes/scripts/verify-m1.sh",
      {
        timeout: 120_000,
        maxBuffer: 1024 * 1024 * 4,
      },
    )

    expect(stdout).toContain("Expected outputs")
    expect(stdout).toContain("Actual outputs")
    expect(stdout).toContain("Human review prompts")
    expect(stdout).toContain("brief-001")
    expect(stdout).toContain("workspace.snapshot")
    expect(stdout).toContain("session.elicitationExchanges")
  })
})
