# Kick-time chrome: activity indicator, welcome intro, collapsed thinking

Frontier: n/a (walkthrough doctor-pass fixes; see TESTING_FINDINGS.md F3, F4, F6)
Status:   active
Mode:     slices
Created:  2026-07-02

Three small vertical cards in the TUI-chrome seam. Independent of the origination-seam file except one `?` overlap on `src/app/brunch-tui.ts` wiring — build `walkthrough--kick-prompt-and-origination-record.md` first or coordinate on that file.

---

## Card 1 (done) — F6: thinking blocks render inline instead of collapsed

### Objective

Assistant thinking blocks are hidden/collapsed by default in the Brunch TUI, with a minimal label instead of full inline italic prose.

### Light-card cold-start reads

```
- TESTING_FINDINGS.md — F6 (JSONL confirms proper thinking block; rendering-only defect)
- node_modules/@earendil-works/pi-coding-agent/dist/core/settings-manager.d.ts — hideThinkingBlock
- node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/components/assistant-message.d.ts — hideThinkingBlock + hiddenThinkingLabel params
- src/app/ — createBrunchPiSettings (Brunch's pi settings profile; likely one-line default)
```

### Acceptance Criteria

```
✓ default hidden — a fresh Brunch TUI session renders assistant thinking as a collapsed label, not inline prose
✓ user override — the pi setting remains user-togglable (Brunch sets the default, does not hard-disable)
```

### Verification Approach

```
- Inner: settings-profile unit test asserting hideThinkingBlock default
- Outer: live TUI beat in the walkthrough
```

### Assumption dependency

None — pi already owns the capability; Brunch sets a default.

### Expected touched paths (tentative)

```
src/app/ (createBrunchPiSettings home)   ~
```

### Promotion checklist

All no — stays light.

---

## Card 2 (done) — F4: deterministic "Welcome to Brunch" intro block

### Objective

Before the assistant's first message in a new session, a deterministic, visually distinct intro block renders: what Brunch is, what is about to happen, and the common commands/shortcuts (`/brunch:mode`, alt+m, ctrl-shift-b session switch, web-ui link).

### Light-card cold-start reads

```
- TESTING_FINDINGS.md — F4
- src/.pi/extensions/chrome/index.ts — startupHeader seam (BrunchChromeStartupHeaderState, ~87/184/222)
- src/app/brunch-tui.ts — startupHeaderForActivation (~403) and chromeStateForWorkspace wiring
- memory/SPEC.md — D78-L (intro is deterministic chrome, not a model-generated turn)
```

### Acceptance Criteria

```
✓ new-session intro — seeded new session shows the welcome block before any assistant output, styled distinctly from transcript prose
✓ deterministic — block content comes from chrome state, not the model; renders even if the kick fails
✓ resume suppression — re-opened sessions show a shorter re-entry variant or none (decide with a `decision` value on the startup-header state; current states include 'continue')
✓ commands accurate — listed commands/shortcuts match the live registrations in src/.pi/extensions/commands/index.ts
```

### Verification Approach

```
- Inner: chrome render test (direct-render, like existing chrome tests)
- Outer: live TUI new-session beat
```

### Cross-cutting obligations

- Keep the intro out of the session transcript/provider context — chrome only, no custom entry (the model does not need to see it).

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/.pi/extensions/chrome/index.ts        ~
src/.pi/extensions/chrome/ (render/tests) ~
src/app/brunch-tui.ts                     ?   (startup-header wiring — coordinate with origination-record card)
```

### Promotion checklist

All no — stays light.

---

## Card 3 (light) — F3: no activity indicator between session start and first kick token

### Objective

From the moment a new session's TUI is interactive until the kick turn's first rendered output, a visible activity indicator ("thinking…" spinner or equivalent) tells the user the agent is working.

### Light-card cold-start reads

```
- TESTING_FINDINGS.md — F3
- src/app/brunch-tui.ts — completeAssistantKick fire-and-forget block (~503–523)
- node_modules/@earendil-works/pi-coding-agent/docs/tui.md — loading/streaming indicator surface
- src/.pi/extensions/chrome/index.ts — footer/status line seam if pi's native indicator doesn't cover custom-message turns
```

### Acceptance Criteria

```
✓ indicator visible — during the kick's provider latency window, the TUI shows an activity state (not a static idle screen)
✓ indicator clears — on first streamed output or on kick failure (failure also surfaces the existing formatKickDiagnostic warning)
```

### Verification Approach

```
- Inner: whatever seam the fix lands in gets a direct test (chrome state or session-event handler)
- Outer: live TUI new-session beat; also kill-the-network variant to see the failure path clear the indicator
```

### Assumption dependency

Investigate-first: pi may already render a streaming indicator for `agent_start`-driven turns, and the gap may be specific to `sendCustomMessage({triggerTurn})` turns — in which case the F1 guard work (other scope file) is adjacent evidence but the indicator fix is still chrome-side. If the investigation shows the indicator requires a pi-level change, stop and report back rather than forking pi.

### Expected touched paths (tentative)

```
src/.pi/extensions/chrome/index.ts   ?
src/app/brunch-tui.ts                ?   (session-event attach; coordinate with other cards on this file)
```

### Promotion checklist

All no — stays light (investigate-first note bounds the uncertainty).
