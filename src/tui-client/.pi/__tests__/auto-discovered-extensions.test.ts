import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  BRUNCH_PRODUCT_EXTENSION_READY,
  discoverBrunchProductExtensionEntries,
} from "../../pi-extension-shell.js"
import alternatives from "../extensions/alternatives.js"
import chrome from "../extensions/chrome.js"
import commandPolicy from "../extensions/command-policy.js"
import mentionAutocomplete from "../extensions/mention-autocomplete.js"
import operationalMode from "../extensions/operational-mode.js"
import sessionLifecycle from "../extensions/session-lifecycle.js"
import structuredExchange from "../extensions/structured-exchange/index.js"
import workspaceDialog from "../extensions/workspace-dialog.js"

const autoDiscoveredExtensions = {
  "alternatives.ts": alternatives,
  "chrome.ts": chrome,
  "command-policy.ts": commandPolicy,
  "mention-autocomplete.ts": mentionAutocomplete,
  "operational-mode.ts": operationalMode,
  "session-lifecycle.ts": sessionLifecycle,
  "structured-exchange/index.ts": structuredExchange,
  "workspace-dialog.ts": workspaceDialog,
}

describe("Pi auto-discovered extensions", () => {
  it("export default factory functions for src/tui-client /.pi iteration", () => {
    for (const [path, factory] of Object.entries(autoDiscoveredExtensions)) {
      expect(factory, path).toEqual(expect.any(Function))
    }
  })

  it("discovers prod-ready Brunch extension entrypoints from local metadata", async () => {
    const entries = await discoverBrunchProductExtensionEntries()

    expect(entries.map((entry) => entry.path)).toEqual([
      "session-lifecycle.ts",
      "chrome.ts",
      "command-policy.ts",
      "operational-mode.ts",
      "mention-autocomplete.ts",
      "alternatives.ts",
      "structured-exchange/index.ts",
      "workspace-dialog.ts",
    ])
    for (const entry of entries) {
      expect(entry.meta.productStatus, entry.path).toBe(
        BRUNCH_PRODUCT_EXTENSION_READY,
      )
      expect(entry.registerProductExtension, entry.path).toEqual(
        expect.any(Function),
      )
    }
  })

  it("does not treat support modules or WIP modules as product extension entrypoints", async () => {
    const entries = await discoverBrunchProductExtensionEntries()
    const paths = entries.map((entry) => entry.path)

    expect(paths).not.toContain("structured-exchange/request-choice.ts")
    expect(paths).not.toContain("structured-exchange/shared/model.ts")
    expect(paths).not.toContain("subagents/config.json")
    expect(paths).not.toContain("auto-compaction-anchors.json")
  })

  it("requires local ready metadata before product loading an entrypoint", async () => {
    const extensionsDir = await mkdtemp(join(tmpdir(), "brunch-extensions-"))
    await writeFile(
      join(extensionsDir, "ready.js"),
      `export const brunchExtensionMeta = { productStatus: "ready" };
       export function registerBrunchProductExtension() {}`,
    )
    await writeFile(
      join(extensionsDir, "implicit.js"),
      `export function registerBrunchProductExtension() {}`,
    )
    await writeFile(
      join(extensionsDir, "wip.js"),
      `export const brunchExtensionMeta = { productStatus: "wip" };
       export function registerBrunchProductExtension() {}`,
    )
    await mkdir(join(extensionsDir, "nested"))
    await writeFile(
      join(extensionsDir, "nested", "index.js"),
      `export const brunchExtensionMeta = { productStatus: "ready", loadOrder: -1 };
       export function registerBrunchProductExtension() {}`,
    )
    await writeFile(
      join(extensionsDir, "nested", "helper.js"),
      `throw new Error("support files must not be imported")`,
    )

    const entries = await discoverBrunchProductExtensionEntries(extensionsDir)

    expect(entries.map((entry) => entry.path)).toEqual([
      "nested/index.js",
      "ready.js",
    ])
  })
})
