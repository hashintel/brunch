import { describe, expect, it } from "vitest"

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
})
