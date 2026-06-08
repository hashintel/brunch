#!/usr/bin/env node
import { runBrunchCli } from "../dist/app/brunch.js"

runBrunchCli()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
