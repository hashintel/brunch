# Brunch Pi extension iteration

This directory is intentionally shaped like a project-local Pi resource tree so Brunch-owned extensions can be hot-reloaded while developing TUI affordances.

```bash
cd src
pi
# edit .pi/extensions/... or .pi/components/...
/reload
```

Production Brunch does not rely on ambient discovery from the repository root. The product shell imports these modules explicitly; tests for extensions/components live in `.pi/__tests__/`, not inside auto-discovered resource directories.

Prompting is adapter-only here: `extensions/prompting.ts` handles Pi `before_agent_start` and delegates composition to `src/agents/compose.ts` with explicit selected-spec/workspace context. Prompt resources and context renderers live under `src/agents/`; `.pi/` must not carry prompt-pack sources.
