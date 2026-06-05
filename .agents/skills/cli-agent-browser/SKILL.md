---
name: cli-agent-browser
description: 'Browser automation via the agent-browser CLI — a daemon-backed Chrome controller with persistent state across shell calls. Primary choice for browser tasks inside the agent-safehouse sandbox. Use when interacting with web pages — navigating, snapshotting, clicking, filling forms, taking screenshots. Triggers on: browse a page, automate browser, take a screenshot, fill a form, click a button, scrape a page, test a web app.'
---

# agent-browser

The most reliable browser CLI for agents running inside the **`agent-safehouse`**
sandbox. A persistent daemon (sockets, pid, state in `~/.agent-browser/`)
spawns Chrome with the right flags and survives across one-shot Bash calls —
the daemon model that `chrome-devtools-axi` and `cdp-cli launch` cannot achieve
under sandboxing.

## Prerequisites

This skill's pinned launch invocation depends on two Safehouse features being
enabled in `~/.config/zsh/agents.zsh` `safe`: `agent-browser` (allows Chrome
to dlopen its framework and reach Mach ports) and `process-control` (allows
daemon liveness checks). If they're missing, `agent-browser open` fails with
`Auto-launch failed: CDP response channel closed`.

## First Launch: Pin the Args

Chrome inside `agent-safehouse` **must** be launched with `--no-sandbox`
(Safehouse's outer Seatbelt blocks Chrome's inner sandbox from re-initializing)
and `--ignore-certificate-errors` (the Cloudflare Zero Trust CA is plumbed to
Node but not Chrome). Pass both via `--args` on the first call after a fresh
shell or after `agent-browser close`:

```bash
agent-browser --args "--no-sandbox,--ignore-certificate-errors" open https://example.com
```

**Args stick to the running daemon.** Subsequent calls do not need `--args`
and will warn "daemon already running" if you pass them anyway. To change
launch args, run `agent-browser close` first, then re-open with new args.

## Core Workflow

After `open`, every command targets the live page:

```bash
agent-browser snapshot                     # AX tree with @ref handles
agent-browser click @e2                    # click ref from snapshot
agent-browser fill @e5 "user@example.com"
agent-browser type "search query"
agent-browser press Enter
agent-browser screenshot /tmp/out.png
agent-browser open <new-url>               # navigate same daemon
agent-browser close                        # tear down
```

Refs (`@e1`, `@e2`, …) come from the most recent `snapshot` and are stable
within the page; re-snapshot after navigation or DOM mutations.

## Upstream Skills (Authoritative Reference)

The CLI ships its own version-matched documentation. Load the upstream skill
for the full command reference and patterns:

```bash
agent-browser skills get core --full       # full command reference + templates
agent-browser skills list                  # specialized skills (Electron, Slack, …)
```

Prefer the upstream skill over guessing from `agent-browser --help`. This
file's job is just to pin the sandbox-correct launch invocation and explain
the daemon-args lifecycle.

## When Not to Use This Skill

- **Need to drive an existing user Chrome session** (cookies, logged-in
  state, extensions) — agent-browser uses its own clean profile. Use
  [cli-cdp](../cli-cdp/SKILL.md) in attach mode against a Chrome the user
  launched manually.
- **One-shot screenshot or PDF with no follow-up interaction, in a context
  without MCP browser tools** — [cli-playwright](../cli-playwright/SKILL.md)'s
  stateless `screenshot`/`pdf` commands are lighter than spinning up the
  daemon.
- **MCP browser tools are available** (e.g. Amp's `mcp__chrome_devtools__*`)
  — those run outside the sandbox and have richer DevTools coverage.
