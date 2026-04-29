## Problem Statement

The workflow ownership extraction moved semantic write-path logic out of the HTTP shell, but the resulting boundary is still a little leaky and ambiguous in three places.

First, HTTP status mapping infers error-kind unions indirectly and one helper lacks a deterministic fallback. That makes the app shell harder to audit when transition error unions grow.

Second, the chat-route transition helper accepts a bag of optional fields. Call sites currently construct `promptText`, persisted parts, confirmation payloads, and phase-intent payloads independently, so invalid combinations remain representable even though each route action is one command.

Third, the recently touched tests and helpers still mix legacy `project` naming with canonical `specification` naming. The product glossary says `specification` is canonical for browser routes, transport contracts, and durable records, while `project` is legacy for this entity.

## Solution

Make the app shell explicit and boring: it parses HTTP payloads, builds exactly one typed command, maps exported transition error kinds to statuses, catches transition failures at the route boundary, and returns generic mutation errors for unexpected exceptions.

Make the chat transition helper command-shaped: one discriminated command per user action, with each variant carrying exactly the data that action needs. Move shared specification existence lookup to one fail-fast point so the helper does not repeat existence checks across branches.

Align touched tests and helper names to `specification` where they refer to the persisted elicitation run, while leaving `workspace` and genuinely project-wide inventory language alone.

## Commits

1. [done] Align the app test helper and assertion vocabulary from legacy project naming to canonical specification naming for the reviewed surfaces.
2. [done] Import and use the exported transition error-kind union types in the HTTP status helpers, and give both helpers deterministic fallback returns.
3. [done] Narrow the turn-response route exception message to a generic transition failure message while preserving explicit domain error responses.
4. [done] Add route-boundary handling around chat transition application so expected transition errors still map to client errors and unexpected exceptions become JSON mutation failures instead of Express default responses.
5. [done] Replace the chat transition helper's optional-field argument bag with a discriminated command interface, updating tests and route construction one command variant at a time.
6. Collapse duplicate specification existence checks inside the chat transition helper into one fail-fast lookup before command-specific logic.

## Decisions

- The HTTP app shell remains responsible for request validation, command construction, domain-error-to-status mapping, and JSON error responses.
- The chat transition helper owns workflow mutation semantics, not transport parsing or message validation.
- Chat commands are mutually exclusive: phase-closure confirmation, force-close, phase entry, and ordinary continuation.
- Unexpected exceptions from transition helpers are treated as server failures with generic client-facing messages; expected user/action problems stay in typed error unions.
- `specification` is the canonical name for the persisted elicitation run. Legacy `project` wording may remain only where it means the cwd-backed workspace or broader project-wide inventory mode.
- No schema or public route change is intended.

## Testing Decisions

- Keep helper-level tests focused on command semantics: each command variant should prove its success path and representative error path.
- Keep app-level tests focused on transport behavior: invalid IDs and payloads, JSON error status mapping, and route integration around chat / turn-response transitions.
- Existing workflow and review acceptance tests already provide enough characterization coverage for the refactor; no separate characterization-only commit is required.
- The verification gate is `npm run verify`, with `npm run fix` after meaningful edits.

## Out of Scope

- Redesigning the streaming lifecycle or observer capture runtime.
- Renaming database columns or persisted storage fields that still use legacy names.
- Changing API paths, response shapes, or client-facing command payloads.
- Broad cleanup of every remaining legacy `project` word in the repository.
- Resolving informational bot comments beyond noting that they require no code change.
