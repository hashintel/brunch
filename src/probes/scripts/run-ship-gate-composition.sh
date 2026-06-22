#!/usr/bin/env bash
set -euo pipefail

npm run build
node dist/probes/ship-gate-composition-proof.js
