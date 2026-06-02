import process from "node:process"

import { runBrunchTui } from "./brunch-tui.js"

async function main(): Promise<void> {
  await runBrunchTui({ cwd: process.cwd() })
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
