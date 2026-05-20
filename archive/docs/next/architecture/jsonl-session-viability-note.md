# JSONL Session Viability Spike

## Question

Can `pi` JSONL sessions serve as the durable transcript authority for the Brunch `next` POC while still carrying the extra structured turn and continuity data Brunch wants to store?

The concrete target comes from [the POC PRD](./brunch-poc-architecture-prd.md): preserve raw assistant and user payloads, preserve structured turn artifacts and custom per-turn data on both sides, and preserve continuity metadata such as `lastSeenLsn`, interest sets, and compaction anchors.

## Approach

- Compare the POC transcript requirements in [the PRD](./brunch-poc-architecture-prd.md) against the actual `SessionEntry` shapes in `~/Clones/earendil-works/pi/packages/coding-agent/src/core/session-manager.ts`.
- Check how `buildSessionContext()`, `convertToLlm()`, and compaction treat each entry kind.
- Treat [the later session-format investigation](./artifacts/session-re-extending-sessions.jsonl) as corrective authority where the earlier [architecture transcript](./artifacts/transcript-of-pi-architecture-review.md) speculated beyond what current pi actually exposes.

## Verdict

Yes, conditionally.

`pi` JSONL is viable as the transcript authority for the POC if Brunch adopts one strong rule:

- raw transcript payloads stay in native `message` entries
- Brunch-specific hidden state lives in `custom` entries
- Brunch-specific model-visible injected state lives in `custom_message` entries

That is enough for the POC's session goals.

It is not enough if Brunch needs any of the following to be true in M2:

- a pluggable session storage backend behind `SessionManager`
- arbitrary new top-level session entry kinds without touching pi core
- arbitrary extra fields embedded directly into native `user` or `assistant` messages
- a DB-backed canonical transcript store that pi can use directly without projection

## Corrections To Earlier Speculation

These earlier ideas should be treated as superseded by the later session-format investigation and the current pi source:

- A new top-level session entry kind such as `interest_set` is not currently a public extension seam. Under current pi, Brunch should encode this state in `custom` entries rather than inventing a new entry `type`.
- `display: false` on `custom_message` does not mean "model-hidden". It only affects TUI rendering. `convertToLlm()` still projects the content into a user-role message for the LLM.
- `SessionManager` is not a supported storage adapter seam. It is both the session model and the filesystem persistence implementation.

## Requirement Mapping

| Brunch need | Current pi shape | Verdict | Notes |
| --- | --- | --- | --- |
| Project-local transcript directory | `SessionManager.create(cwd, sessionDir)` | Yes | Brunch can point this at `.brunch/sessions/`. |
| Session identity and lineage | `SessionHeader.id`, `cwd`, `parentSession` | Yes | Enough for project-local session identity and fork lineage. |
| Raw user payloads | `message` entry with `message.role === "user"` | Yes | Native `UserMessage` stores text or text/image blocks. |
| Raw assistant payloads | `message` entry with `message.role === "assistant"` | Yes | Native `AssistantMessage` keeps text, thinking blocks, tool calls, provider, model, usage, stop reason, optional `errorMessage`, and optional `responseId`. |
| Raw tool results | `message` entry with `message.role === "toolResult"` | Yes | This is the one native message type that already has a general `details` slot. |
| Mid-session model changes | `model_change` | Yes | Native entry, already replayed by `buildSessionContext()`. |
| Mid-session thinking-level changes | `thinking_level_change` | Yes | Native entry, already replayed by `buildSessionContext()`. |
| Session title | `session_info` | Yes | Only supports `name`, not arbitrary metadata. |
| User bookmarks / checkpoints | `label` | Partial | Good for human-facing markers, not a general metadata channel. |
| Branching inside one session file | Tree via `id` / `parentId` plus `branch_summary` | Yes | Native fit for branch-aware transcript history. |
| Extracting one branch to a new session file | `createBranchedSession()` | Yes | Keeps path entries and labels. |
| Compaction summaries | `compaction` | Yes | Native fit; `details` gives one structured side channel. |
| Hidden continuity state (`lastSeenLsn`, interest sets, compaction anchors, UI-only metadata) | `custom` | Yes | Best place for Brunch-owned hidden state. `custom` is ignored by `buildSessionContext()`. |
| Model-visible continuity injection (`worldUpdate`, graph snapshot reminders, review artifacts) | `custom_message` | Yes | Best place for Brunch-owned model-visible injected state. `details` stays local; `content` goes to the model. |
| Structured turn metadata for a whole turn | `custom` sidecar written at `turn_end` | Yes | Good POC fit. Append a Brunch turn snapshot after the turn is fully persisted. |
| Structured metadata attached to a specific native `user` or `assistant` message | Sidecar `custom` entry by convention | Partial | Feasible, but native user/assistant messages do not have their own metadata slot. Brunch must maintain the attachment convention itself. |
| Custom session schema as pi's primary storage shape | None | No | Current pi expects the built-in JSONL entry union. |
| Database as pi's primary transcript store | None | No | Requires projection, mirroring, or a pi core change. |

## What Fits Cleanly

### 1. Raw transcript preservation

This is the strongest part of the fit.

- Native `message` entries already preserve the raw user prompt shape.
- Native assistant messages already preserve more than just final text: they carry thinking blocks, tool calls, usage, provider/model identity, stop reason, and optional response identifiers.
- Native tool results already preserve structured `details`, which gives Brunch one built-in place for tool-scoped metadata without inventing its own sidecar.

For replay, export, and session resume, this is already the shape pi understands.

### 2. Hidden Brunch session state

`custom` entries are the right place for Brunch-owned state that should survive reload but should not enter model context.

This covers the POC's continuity metadata directly:

- `lastSeenLsn`
- interest-set snapshots
- compaction anchors
- UI-only annotations
- any Brunch bookkeeping needed to reconstruct per-turn state on reload

Because `custom` entries are append-only, Brunch should treat them as a log where the latest snapshot for a given `customType` wins.

### 3. Model-visible injected state

`custom_message` entries are the right place for between-turn messages such as `worldUpdate`.

This matches the corrected transcript architecture well:

- `prepareNextTurn` decides whether relevant graph changes occurred
- Brunch creates a `custom_message`
- `convertToLlm()` projects it into a normal user-role message for the next model call

This is a natural fit for continuity repair, graph snapshot reminders, and other Brunch-authored synthetic context.

## Sharp Constraints

### `custom_message` is not hidden from the model

This is the easiest mistake to make.

`custom_message.display` only affects TUI rendering. The content still goes through `createCustomMessage()` and `convertToLlm()`, which means it becomes a user-role message in the next LLM payload.

Rule: if the model must not see it, use `custom`, not `custom_message`.

### Native `user` and `assistant` messages do not have a freeform metadata field

`toolResult` has `details`. `user` and `assistant` do not.

So Brunch-specific per-message metadata for those roles must live in an adjacent sidecar entry, not inside the native message object.

That is acceptable for the POC, but it means Brunch needs a convention for attaching sidecars to raw message entries.

### `message_end` is not the cleanest place to attach sidecars

Inside `AgentSession`, extension and listener events are emitted before the `SessionManager.appendMessage(event.message)` persistence step for `message_end`.

That means the easiest reliable seam for Brunch-owned transcript sidecars is usually `turn_end`, when the raw turn messages have already been persisted.

Implication:

- turn-level sidecars are easy in the POC
- precise per-message sidecars are still possible, but Brunch may need a slightly more deliberate wrapper or a small pi seam if exact entry IDs become important

### There is no supported `SessionStore` abstraction

The later session investigation was right to call this out. `SessionManager` is not just a repository interface. It owns filesystem persistence directly.

Implication:

- JSONL-first is viable for M2
- JSONL-as-canonical with DB projection is viable later
- DB-as-primary-through-pi is not a native path today

## Recommended POC Conventions

### Use one Brunch namespace per concern

Suggested `customType` values:

- `brunch/session_state/v1`
- `brunch/turn_meta/v1`
- `brunch/world_update/v1`
- `brunch/compaction_anchor/v1`

### Prefer turn-level sidecars over per-message sidecars in M2

For the first proof, store one structured Brunch snapshot at `turn_end` instead of trying to decorate every native message independently.

That keeps the POC simple while still allowing:

- raw native messages for faithful transcript replay
- structured Brunch-owned turn metadata for reload
- later escalation to finer-grained attachment if needed

### Keep graph truth out of JSONL

Use JSONL only for transcript truth and transcript-adjacent continuity state.

The graph remains in SQLite. JSONL should not become a shadow graph database.

## Suggested Entry Shapes

```json
{
  "type": "custom",
  "customType": "brunch/session_state/v1",
  "data": {
    "lastSeenLsn": 481,
    "interestSet": {
      "direct": ["intent:123", "design:456"],
      "mentioned": ["intent:789"]
    },
    "compactionAnchor": {
      "summaryEntryId": "f6g7h8i9"
    }
  }
}
```

```json
{
  "type": "custom",
  "customType": "brunch/turn_meta/v1",
  "data": {
    "turnIndex": 12,
    "kind": "assistant_turn",
    "artifacts": {
      "contextPackIds": ["cp_12"],
      "graphRefs": ["intent:123", "design:456"]
    }
  }
}
```

```json
{
  "type": "custom_message",
  "customType": "brunch/world_update/v1",
  "content": "Since your last turn, 2 relevant graph items changed and coherence is now degraded.",
  "display": true,
  "details": {
    "lastSeenLsn": 481,
    "currentLsn": 493,
    "changedRefs": ["intent:123", "design:456"],
    "coherence": "degraded"
  }
}
```

## M2 Proof Checklist

If Brunch wants to validate this direction before implementation spreads, M2 should prove these exact cases:

1. Raw user, assistant, and tool-result payloads survive save, reload, and resume with no information loss that matters to replay.
2. A `brunch/session_state/v1` `custom` entry survives reload and can restore `lastSeenLsn` and interest-set snapshots.
3. A `brunch/world_update/v1` `custom_message` can be injected through the next-turn seam and reliably reaches the model as intended.
4. A `brunch/turn_meta/v1` sidecar survives branch, compaction, and resume well enough for POC turn reconstruction.
5. The POC can decide whether turn-level sidecars are enough, or whether exact per-message sidecars justify a small pi seam.

## Recommendation

Proceed with the POC on a JSONL-first basis.

The burden of proof is no longer "can pi store transcripts at all?" It clearly can. The real M2 question is narrower:

- can Brunch live with sidecar conventions around native messages
- and is turn-level structured metadata enough for the first proof

If the answer to either becomes no, the next move should be a canonical richer transcript substrate with pi JSONL projection, not trying to stretch `SessionManager` into a generic storage backend.
