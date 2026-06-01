# Brunch Pi extension iteration

This directory is intentionally shaped like a project-local Pi resource tree so Brunch-owned extensions can be hot-reloaded while developing TUI affordances.

```bash
cd src/tui-client
pi
# edit .pi/extensions/... or .pi/components/...
/reload
```

Production Brunch does not rely on ambient discovery from the repository root. The product shell imports these modules explicitly; tests for extensions/components live in `.pi/__tests__/`, not inside auto-discovered resource directories.
