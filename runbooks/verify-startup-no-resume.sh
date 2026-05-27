#!/usr/bin/env bash
set -euo pipefail

# Proves FE-744/I22 at the terminal boundary: Brunch TUI startup shows the
# workspace dialog before any prior transcript is rendered. This runbook uses
# a real pty via `script`; it is intended as a manual/middle-loop oracle rather
# than part of the default verify gate.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="${WORK_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/brunch-startup-oracle.XXXXXX")}"
CAPTURE_RAW="$WORK_DIR/startup.raw"
CAPTURE_STRIPPED="$WORK_DIR/startup.stripped"
STALE_TEXT="BRUNCH_STALE_TRANSCRIPT_SENTINEL_$(date +%s)_$$"

cd "$ROOT_DIR"
npm run build >/dev/null

STALE_TEXT="$STALE_TEXT" WORK_DIR="$WORK_DIR" node --input-type=module <<'NODE'
import { createWorkspaceSessionCoordinator } from './dist/workspace-session-coordinator.js'

const cwd = process.env.WORK_DIR
const staleText = process.env.STALE_TEXT
const coordinator = createWorkspaceSessionCoordinator({ cwd })
const workspace = await coordinator.createSetupSession({
  specTitle: 'Startup Oracle Spec',
})
workspace.session.manager.appendMessage({
  role: 'assistant',
  content: staleText,
})
console.log(`Seeded stale transcript: ${workspace.session.file}`)
NODE

BRUNCH_CMD="cd '$WORK_DIR' && PI_OFFLINE=1 node '$ROOT_DIR/dist/brunch.js' --mode tui"

set +e
if script --version >/dev/null 2>&1; then
  perl -e 'alarm shift; exec @ARGV' 3 script -q -f -c "$BRUNCH_CMD" "$CAPTURE_RAW"
else
  perl -e 'alarm shift; exec @ARGV' 3 script -q -F "$CAPTURE_RAW" /bin/sh -lc "$BRUNCH_CMD"
fi
set -e

perl -CS -pe 's/\e\[[0-?]*[ -\/]*[@-~]//g; s/\e\][^\a]*(\a|\e\\)//g; s/\eP.*?(\a|\e\\)//g; s/\r/\n/g' \
  "$CAPTURE_RAW" > "$CAPTURE_STRIPPED"

if grep -Fq "$STALE_TEXT" "$CAPTURE_STRIPPED"; then
  echo "FAILED: startup rendered stale transcript text before explicit activation" >&2
  echo "Capture: $CAPTURE_STRIPPED" >&2
  exit 1
fi

if ! grep -Eq "Brunch workspace|Choose or create the workspace|New workspace title" "$CAPTURE_STRIPPED"; then
  echo "FAILED: startup capture did not show a stable workspace-dialog marker" >&2
  echo "Capture: $CAPTURE_STRIPPED" >&2
  exit 1
fi

cat <<EOF
Startup no-resume oracle passed.

Workspace: $WORK_DIR
Raw capture: $CAPTURE_RAW
Stripped capture: $CAPTURE_STRIPPED
Assertion: stale transcript sentinel was absent before explicit activation.
EOF
