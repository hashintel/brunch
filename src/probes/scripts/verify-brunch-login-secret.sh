#!/usr/bin/env bash
set -euo pipefail

# Proves WR15/A2 at the interactive terminal boundary: a real PTY paste into
# `brunch login` does not render the API-key bytes, while Pi-shaped auth storage
# receives the exact key. Uses only bash + Python stdlib pty support.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORK_DIR="${WORK_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/brunch-login-secret.XXXXXX")}"
SUCCESS_AGENT_DIR="$WORK_DIR/success-agent"
CANCEL_AGENT_DIR="$WORK_DIR/cancel-agent"
SUCCESS_CAPTURE="$WORK_DIR/success-terminal.txt"
CANCEL_CAPTURE="$WORK_DIR/cancel-terminal.txt"
SENTINEL_SECRET="${SENTINEL_SECRET:-brunch_secret_WR15_${RANDOM}_$(date +%s)_paste}"
BRUNCH_LOGIN_COMMAND="${BRUNCH_LOGIN_COMMAND:-node --import tsx src/app/brunch.ts login}"
PROBE_TIMEOUT_SECONDS="${PROBE_TIMEOUT_SECONDS:-20}"

unset ANTHROPIC_API_KEY OPENROUTER_API_KEY OPENAI_API_KEY

mkdir -p "$SUCCESS_AGENT_DIR" "$CANCEL_AGENT_DIR"
cd "$ROOT_DIR"

run_pty_login() {
  local agent_dir="$1"
  local capture_file="$2"
  local scenario="$3"

  PI_CODING_AGENT_DIR="$agent_dir" \
  BRUNCH_LOGIN_COMMAND="$BRUNCH_LOGIN_COMMAND" \
  PROBE_TIMEOUT_SECONDS="$PROBE_TIMEOUT_SECONDS" \
  SENTINEL_SECRET="$SENTINEL_SECRET" \
  SCENARIO="$scenario" \
  python3 - <<'PY' >"$capture_file"
import os
import pty
import select
import signal
import subprocess
import sys
import time

command = os.environ["BRUNCH_LOGIN_COMMAND"]
scenario = os.environ["SCENARIO"]
secret = os.environ["SENTINEL_SECRET"]
timeout = float(os.environ["PROBE_TIMEOUT_SECONDS"])

env = os.environ.copy()
master_fd, slave_fd = pty.openpty()
process = subprocess.Popen(
    ["/bin/sh", "-c", command],
    stdin=slave_fd,
    stdout=slave_fd,
    stderr=slave_fd,
    cwd=os.getcwd(),
    env=env,
    close_fds=True,
)
os.close(slave_fd)

captured = bytearray()
sent_provider = False
sent_secret = False
sent_cancel = False
start = time.monotonic()
exit_code = None

try:
    while True:
        if time.monotonic() - start > timeout:
            process.kill()
            raise TimeoutError(f"timed out waiting for brunch login {scenario} flow")

        readable, _, _ = select.select([master_fd], [], [], 0.05)
        if readable:
            try:
                chunk = os.read(master_fd, 4096)
            except OSError:
                chunk = b""
            if chunk:
                captured.extend(chunk)
                text = captured.decode("utf-8", errors="replace")
                if not sent_provider and "Provider number" in text:
                    os.write(master_fd, b"2\n")
                    sent_provider = True
                if scenario == "success" and sent_provider and not sent_secret and "API key" in text:
                    os.write(master_fd, (secret + "\n").encode())
                    sent_secret = True
                if scenario == "cancel" and sent_provider and not sent_cancel and "API key" in text:
                    os.write(master_fd, b"q\n")
                    sent_cancel = True

        exit_code = process.poll()
        if exit_code is not None:
            break
finally:
    try:
        os.close(master_fd)
    except OSError:
        pass

sys.stdout.buffer.write(bytes(captured))
if scenario == "success" and not sent_secret:
    raise SystemExit("probe never reached the hidden API-key prompt")
if scenario == "cancel" and not sent_cancel:
    raise SystemExit("probe never reached the cancellation prompt")
if scenario == "success" and exit_code != 0:
    raise SystemExit(f"expected success exit 0, got {exit_code}")
if scenario == "cancel" and exit_code == 0:
    raise SystemExit("expected cancellation to exit nonzero")
PY
}

if ! command -v python3 >/dev/null 2>&1; then
  echo "FAILED: WR15 PTY probe requires python3 stdlib pty support" >&2
  exit 1
fi

run_pty_login "$SUCCESS_AGENT_DIR" "$SUCCESS_CAPTURE" success

if grep -Fq "$SENTINEL_SECRET" "$SUCCESS_CAPTURE"; then
  echo "FAILED: PTY capture contains pasted API-key sentinel" >&2
  echo "Capture: $SUCCESS_CAPTURE" >&2
  exit 1
fi

if ! grep -Fq "Paste OpenRouter API key (input hidden; or q to cancel):" "$SUCCESS_CAPTURE"; then
  echo "FAILED: PTY capture did not show the hidden-input API-key prompt" >&2
  echo "Capture: $SUCCESS_CAPTURE" >&2
  exit 1
fi

if ! grep -Fq "Brunch will use" "$SUCCESS_CAPTURE"; then
  echo "FAILED: post-entry newline did not reach the success report" >&2
  echo "Capture: $SUCCESS_CAPTURE" >&2
  exit 1
fi

AUTH_JSON="$SUCCESS_AGENT_DIR/auth.json" SECRET="$SENTINEL_SECRET" node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';

const auth = JSON.parse(readFileSync(process.env.AUTH_JSON, 'utf8'));
const actual = auth.openrouter?.key;
if (actual !== process.env.SECRET) {
  console.error('FAILED: auth.json did not receive the exact pasted key');
  console.error(`Expected: ${process.env.SECRET}`);
  console.error(`Actual: ${actual}`);
  process.exit(1);
}
NODE

run_pty_login "$CANCEL_AGENT_DIR" "$CANCEL_CAPTURE" cancel

if [ -s "$CANCEL_AGENT_DIR/auth.json" ] && grep -Fq "api_key" "$CANCEL_AGENT_DIR/auth.json"; then
  echo "FAILED: cancellation wrote API-key auth" >&2
  echo "Auth file: $CANCEL_AGENT_DIR/auth.json" >&2
  exit 1
fi

cat <<EOF
Brunch login secret PTY oracle passed.

Work dir: $WORK_DIR
Success capture: $SUCCESS_CAPTURE
Cancel capture: $CANCEL_CAPTURE
Assertion: terminal bytes exclude the pasted sentinel; PI_CODING_AGENT_DIR/auth.json stores the exact key; cancellation exits nonzero without API-key auth.
EOF
