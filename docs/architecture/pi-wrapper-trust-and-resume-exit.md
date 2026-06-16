# Pi wrapper trust prompt and resume-exit line

## Status

Finding only. Do not implement in the current slice.

This note records whether Brunch can suppress Pi's project-trust flow and customize the terminal line Pi prints after quitting an interactive session:

```text
To resume this session: pi --session <id>
```

## Verdict

| Question | Verdict | Path if we need it later |
| --- | --- | --- |
| Can Brunch disable the "trust this folder" flow? | Yes; the Brunch SDK wrapper already bypasses the normal Pi CLI trust prompt path. | Keep the sealed Brunch Pi profile as the authority. If we ever re-enter Pi CLI startup semantics, use Pi's trust override/default-trust seams or a user/global `project_trust` extension. |
| Can Brunch customize the quit-time resume line? | Not through a documented/public Pi option today. | Upstream or fork a small `InteractiveModeOptions` seam for resume-command formatting/suppression. Avoid monkey-patching stdout or pretending extensions can replace the built-in line. |

## Evidence

### Pi trust flow

Pi docs describe project trust as a CLI/resource-loading guard. Interactive startup asks before trusting a cwd when project-local resources/settings/skills exist and no saved decision applies. Trusting permits Pi to load `.pi` resources and execute project extensions; declining skips those inputs.

Relevant Pi seams from docs/source:

- CLI flags: `--approve` / `--no-approve` trust or ignore project-local resources for one run.
- Saved decisions: `~/.pi/agent/trust.json`, managed by `/trust`.
- Extension event: user/global or CLI extensions can handle `project_trust` and return `{ trusted: "yes" | "no" | "undecided" }`.
- Newer Pi docs also describe `defaultProjectTrust: "ask" | "always" | "never"` as a global setting. Treat this as version-sensitive; Brunch should not rely on it until the installed project dependency exposes it.

Brunch's current wrapper path does not enter Pi CLI trust resolution:

- `src/.pi/brunch-pi-settings.ts` builds `SettingsManager.inMemory(BRUNCH_SETTINGS_POLICY)`, not a file-backed settings manager.
- The Brunch resource-loader options set ambient discovery off: `noContextFiles`, `noExtensions`, `noPromptTemplates`, `noSkills`, and `noThemes` are all `true`.
- Brunch injects only explicit `extensionFactories`.
- `src/app/brunch-tui.ts` calls `createAgentSessionServices(...)` directly and does not pass Pi CLI's `resourceLoaderReloadOptions.resolveProjectTrust` hook.

Therefore the trust prompt is not an active Brunch concern unless a future launcher path starts using Pi CLI-style runtime creation or re-enables project-local resource discovery.

### Quit-time resume line

Pi's `InteractiveMode.shutdown()` hardcodes the terminal print after TUI shutdown:

```ts
const resumeCommand = formatResumeCommand(this.sessionManager);
if (resumeCommand) {
  process.stdout.write(`${chalk.dim("To resume this session:")} ${resumeCommand}\n`);
}
```

`formatResumeCommand(sessionManager)` is exported, but the call site is not configurable through `InteractiveModeOptions`. The command is built from Pi's internal `APP_NAME`, optional `--session-dir`, and `--session <session-id>`.

The documented `InteractiveModeOptions` cover startup warnings, initial messages, verbosity, and related startup behavior; they do not include resume-line formatting or suppression.

Extensions receive `session_shutdown`, but that event fires before the built-in print. An extension can add another message during shutdown; it cannot prevent or replace Pi's built-in resume line through the public extension API.

Pi suppresses the line only when `formatResumeCommand()` returns `undefined`, notably when:

- stdout is not a TTY,
- the session is not persisted,
- or the session file cannot be found.

Those conditions are not product-appropriate suppression mechanisms for Brunch because Brunch wants persisted interactive sessions.

## Recommended future seam

If Brunch wants a branded quit line later, prefer a minimal upstream Pi API rather than stdout interception. A sufficient shape would be one of:

```ts
new InteractiveMode(runtime, {
  resumeCommand: {
    visible: true,
    label: "Resume this Brunch session:",
    format: ({ sessionManager }) => `brunch --mode tui --session ${sessionManager.getSessionId()}`,
  },
});
```

or the smaller split:

```ts
new InteractiveMode(runtime, {
  showResumeCommand: false,
  formatResumeCommand: (sessionManager) => /* Brunch command or undefined */,
});
```

Requirements for the seam:

1. Runs at the current `InteractiveMode.shutdown()` print site.
2. Can suppress the line entirely.
3. Can preserve Pi's default behavior when unset.
4. Does not require extensions to write to stdout during shutdown.
5. Does not change session persistence or `SessionManager` semantics.

## Brunch posture

Do not implement now. The trust flow is already neutralized by the sealed Brunch profile, and the resume-line issue is cosmetic/product-shell polish. If it becomes important, make it an upstream Pi option or a very small fork patch; do not add a Brunch compatibility bridge around Pi internals.

## References

- `src/.pi/brunch-pi-settings.ts` — sealed Brunch settings/resource profile.
- `src/app/brunch-tui.ts` — Brunch SDK runtime construction and `InteractiveMode` launch.
- `docs/architecture/pi-ui-extension-patterns.md` — related Pi UI/command containment findings.
- Pi docs: `docs/settings.md`, `docs/sdk.md`, `docs/extensions.md` in `@earendil-works/pi-coding-agent`.
- Pi source: `dist/modes/interactive/interactive-mode.js` for `shutdown()` and `formatResumeCommand()`.
