#!/usr/bin/env bash
set -u -o pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TSX_LOADER="$ROOT/node_modules/tsx/dist/loader.mjs"
export ROOT TSX_LOADER
cd "$ROOT" || exit 1

failures=0
TMP_WORKSPACE=""

record_failure() {
  echo "FAIL: $*"
  failures=$((failures + 1))
}

run_check() {
  local label="$1"
  shift
  printf "\n## %s\n" "$label"
  if "$@"; then
    printf "\nPASS: %s\n" "$label"
  else
    local status=$?
    record_failure "$label exited $status"
  fi
}

cleanup() {
  if [[ -n "$TMP_WORKSPACE" && -d "$TMP_WORKSPACE" ]]; then
    rm -rf "$TMP_WORKSPACE"
  fi
}
trap cleanup EXIT

echo "# M1 mode shell and fixture driver runbook"
echo
echo "## Expected outputs"
echo "- Each committed scripted bundle has one brunch.session_binding whose specTitle matches its brief title."
echo "- Each committed bundle metadata projection summary matches projection from its JSONL transcript."
echo "- Print mode emits a product-shaped workspace snapshot for a selected runbook spec."
echo "- RPC workspace.snapshot and session.elicitationExchanges return product-shaped JSON-RPC results."
echo "- Human review remains responsible for brief quality and golden-capture representativeness."
echo
echo "## Actual outputs"

run_check "Per-brief binding/title alignment and metadata/projection parity" \
  node --import "$TSX_LOADER" --input-type=module <<'NODE'
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { loadBriefLibrary } from "./src/brief-library.ts"
import { loadJsonlTranscriptEntries, projectElicitationExchanges } from "./src/elicitation-exchange.ts"

const briefs = await loadBriefLibrary(".brunch-fixtures/briefs")
const expected = new Map(briefs.map((brief) => [brief.id, brief.title]))
const briefIds = ["brief-001", "brief-002", "brief-003"]
const seenSpecIds = new Set()

for (const briefId of briefIds) {
  const runId = "scripted-001"
  const runDir = join(".brunch-fixtures", briefId, runId)
  const jsonlFile = join(runDir, `${runId}.jsonl`)
  const metaFile = join(runDir, `${runId}.meta.json`)
  const entries = await loadJsonlTranscriptEntries(jsonlFile)
  const bindings = entries.filter((entry) => entry?.customType === "brunch.session_binding")
  if (bindings.length !== 1) {
    throw new Error(`${briefId}: expected one session binding, found ${bindings.length}`)
  }
  const binding = bindings[0]
  const expectedTitle = expected.get(briefId)
  if (binding.data.specTitle !== expectedTitle) {
    throw new Error(`${briefId}: binding title ${binding.data.specTitle} did not match ${expectedTitle}`)
  }
  if (seenSpecIds.has(binding.data.specId)) {
    throw new Error(`${briefId}: reused spec id ${binding.data.specId}`)
  }
  seenSpecIds.add(binding.data.specId)

  const metadata = JSON.parse(await readFile(metaFile, "utf8"))
  const projection = projectElicitationExchanges(entries)
  const actualSummary = {
    status: projection.status,
    exchangeCount: projection.exchanges.length,
    openPrompt: projection.openPrompt !== null,
  }
  if (JSON.stringify(actualSummary) !== JSON.stringify(metadata.projectionSummary)) {
    throw new Error(`${briefId}: projection summary mismatch`)
  }
  if (metadata.artifacts.graph.status !== "deferred" || metadata.artifacts.coherence.status !== "deferred") {
    throw new Error(`${briefId}: graph/coherence artifacts should be deferred in M1`)
  }
  console.log(`${briefId}: ${binding.data.specTitle}; exchanges=${actualSummary.exchangeCount}; graph=${metadata.artifacts.graph.status}; coherence=${metadata.artifacts.coherence.status}`)
}
NODE

TMP_WORKSPACE="$(mktemp -d "${TMPDIR:-/tmp}/brunch-m1-runbook.XXXXXX")"
export TMP_WORKSPACE
node --import "$TSX_LOADER" --input-type=module <<'NODE'
import { createWorkspaceSessionCoordinator } from "./src/workspace-session-coordinator.ts"

const cwd = process.env.TMP_WORKSPACE
const coordinator = createWorkspaceSessionCoordinator({ cwd })
const workspace = await coordinator.createSetupSession({ specTitle: "M1 runbook smoke" })
workspace.session.manager.appendCustomMessageEntry(
  "brunch.elicitation_prompt",
  "Runbook prompt: confirm the M1 mode shell is product-shaped.",
  true,
)
workspace.session.manager.appendMessage({ role: "user", content: "Runbook response" })
await coordinator.bindCurrentSpecToReplacementSession(workspace.session.manager)
NODE

run_check "Print-mode smoke output" \
  bash -c 'cd "$TMP_WORKSPACE" && node --import "$TSX_LOADER" "$ROOT/src/brunch.ts" --mode print | tee "$TMP_WORKSPACE/print.out" && grep -q "M1 runbook smoke" "$TMP_WORKSPACE/print.out"'

run_check "RPC workspace.snapshot smoke output" \
  bash -c 'cd "$TMP_WORKSPACE" && printf "%s\n" "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"workspace.snapshot\"}" | node --import "$TSX_LOADER" "$ROOT/src/brunch.ts" --mode rpc > "$TMP_WORKSPACE/workspace-rpc.out" && node -e "const fs=require(\"node:fs\"); const path=process.env.TMP_WORKSPACE + \"/workspace-rpc.out\"; console.log(JSON.stringify(JSON.parse(fs.readFileSync(path, \"utf8\")), null, 2))" && grep -q "M1 runbook smoke" "$TMP_WORKSPACE/workspace-rpc.out" && grep -q "\"session\"" "$TMP_WORKSPACE/workspace-rpc.out"'

run_check "RPC session.elicitationExchanges smoke output" \
  bash -c 'cd "$TMP_WORKSPACE" && printf "%s\n" "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"session.elicitationExchanges\"}" | node --import "$TSX_LOADER" "$ROOT/src/brunch.ts" --mode rpc > "$TMP_WORKSPACE/exchanges-rpc.out" && node -e "const fs=require(\"node:fs\"); const path=process.env.TMP_WORKSPACE + \"/exchanges-rpc.out\"; console.log(JSON.stringify(JSON.parse(fs.readFileSync(path, \"utf8\")), null, 2))" && grep -q "\"status\":\"ready\"" "$TMP_WORKSPACE/exchanges-rpc.out" && grep -q "promptEntryIds" "$TMP_WORKSPACE/exchanges-rpc.out"'

echo
echo "## Human review prompts"
echo "- Brief quality: Do briefs #1-#3 read like useful product briefs rather than implementation-shaped test fixtures?"
echo "- Golden-capture representativeness: Does at least one scripted-001 JSONL/meta bundle look plausible as a replay seed?"
echo "- Product shape: Do print/RPC outputs expose workspace/session/exchange concepts rather than generic file dumps?"

if [[ "$failures" -gt 0 ]]; then
  echo
  echo "Runbook failed with $failures structural failure(s)."
  exit 1
fi

echo
echo "Runbook structural checks passed; complete the human review prompts above before final M1 acceptance."
