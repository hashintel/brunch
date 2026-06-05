---
name: cli-playwright
description: 'One-shot browser captures via the Playwright CLI — screenshots and PDFs of arbitrary URLs with no daemon. Best stateless option for agents that need to capture a page but lack MCP browser tools. Use when you need a single screenshot or PDF of a URL without follow-up interaction. Triggers on: screenshot a page, save page as pdf, capture web page, snapshot a url.'
---

# Playwright CLI (one-shot)

For agents without MCP browser tools that need a **single page capture** with
no interaction loop. Each invocation launches Chromium, performs one action,
and exits — no daemon to manage. Inside `agent-safehouse`, the `playwright-chrome`
Safehouse feature has already injected `PLAYWRIGHT_MCP_SANDBOX=false` into
the environment, so Chromium starts cleanly without you setting anything.

For multi-step interaction loops use [cli-agent-browser](../cli-agent-browser/SKILL.md)
instead — its daemon persists state across calls; Playwright one-shots do not.

## Two Binaries on PATH

This skill is about the **test-runner `playwright`** (from `@playwright/test`),
which exposes one-shot commands like `screenshot` and `pdf`. The other
binary, `playwright-cli` (from a separate package), is a daemon wrapper
around Playwright-MCP — its `--ignore-https-errors` plumbing through config
files is finicky in this environment, so prefer `agent-browser` for
daemon-style work.

## Prerequisites

- Safehouse `playwright-chrome` feature must be enabled (auto-injects
  `PLAYWRIGHT_MCP_SANDBOX=false`). Confirm with `echo $PLAYWRIGHT_MCP_SANDBOX`
  — should print `false`.
- Chromium browser must be installed in `~/Library/Caches/ms-playwright/`.
  If `playwright screenshot` errors with "Executable doesn't exist", run:
  ```bash
  playwright install chromium
  ```
  This downloads to a cached location Safehouse already permits, no `sudo`.

## Core Commands

```bash
# Screenshot — always pass --ignore-https-errors for Cloudflare-gated sites
playwright screenshot --ignore-https-errors https://example.com /tmp/out.png

# Full-page screenshot
playwright screenshot --ignore-https-errors --full-page <url> <file>

# PDF (uses Chromium printing pipeline)
playwright pdf --ignore-https-errors <url> /tmp/out.pdf

# Wait for content before capturing
playwright screenshot --ignore-https-errors \
  --wait-for-selector ".loaded" \
  --wait-for-timeout 5000 \
  <url> <file>

# Emulate device / color scheme
playwright screenshot --ignore-https-errors \
  --device "iPhone 11" --color-scheme dark \
  <url> <file>
```

## Always Pass `--ignore-https-errors`

The `safe` function forwards the Cloudflare Zero Trust root CA to Node
(`NODE_EXTRA_CA_CERTS`), but **Chromium does not honor that env var** — it
uses its own cert store, which doesn't include the Cloudflare gateway CA.
Without `--ignore-https-errors`, any HTTPS URL routed through the gateway
fails with `net::ERR_CERT_AUTHORITY_INVALID`.

## Common Pitfalls

- **`playwright open <url>` is interactive** and will hang the Bash tool —
  use `screenshot` or `pdf` for one-shot capture, or `cli-agent-browser`
  for interactive flows.
- **`playwright codegen`** records user actions — useless from an
  agent shell.
- **`playwright test`** runs a `playwright.config.ts` test suite — not a
  general-purpose browser CLI.
