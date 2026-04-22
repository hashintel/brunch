<!-- CARDS.md — prepared scope-card queue for the active frontier item.
     Frontier: Brownfield workspace-analysis grounding brief (Track A).
     Created by ln-scope. Consumed by ln-build. Delete when queue is exhausted. -->

# Scope Cards — Brownfield workspace-analysis grounding brief

## Card A: Preface skeleton + pending preface threading `done`

### Objective

During streaming, when `present_preface` arrives before `ask_question`, the UI detects the preface tool call in live message parts, threads preface data through the pending-question view model, and renders a preface+question skeleton (then live preface card above question card) instead of the generic generating placeholder.

### Acceptance Criteria

```
✓ findPendingPreface returns PrefaceData when a `tool-present_preface` part has reached `input-available` or later state in the latest assistant message.
✓ PendingQuestionViewModel carries an optional `preface?: PrefaceData` field.
✓ createInterviewControllerViewState threads the pending preface alongside the pending question into the `pending-question` artifact.
✓ GeneratingTurnPlaceholder renders PrefaceCardSkeleton above QuestionCardSkeleton when a pending preface is detected (even before the question tool call arrives).
✓ The `pending-question` artifact in -workspace-stream-projector threads preface data through to the stream artifact type.
✓ WorkspaceTranscriptArtifacts renders PrefaceCard above ActiveQuestionCard in the `pending-question` case when preface is present.
✓ Partial/streaming `present_preface` in `input-streaming` state is ignored (no crash, falls through to generic skeleton).
✓ npm run verify passes.
```

### Verification Approach

```
- Inner: npm run verify (type-check + lint + unit tests + build)
- Middle: manual brownfield walkthrough — observe skeleton → preface → question progression during live streaming
```

### Key files

| File | Change |
| ---- | ------ |
| `src/client/routes/specification/$id/_view/-interview-controller-core.ts` | Add `findPendingPreface`, extend `PendingQuestionViewModel` with optional `preface` |
| `src/client/routes/specification/$id/_view/-interview-controller-core.ts` | `createInterviewControllerViewState`: call `findPendingPreface` alongside `findPendingQuestion`, attach to artifact |
| `src/client/components/question-cards.tsx` | Add `PrefaceCardSkeleton`; update `GeneratingTurnPlaceholder` to accept optional pending preface and render preface skeleton |
| `src/client/routes/specification/$id/_view/-workspace-stream-projector.ts` | Thread preface onto `pending-question` stream artifact type |
| `src/client/routes/specification/$id/_view/-workspace-transcript-artifacts.tsx` | Render `PrefaceCard` above `ActiveQuestionCard` in `pending-question` case |
| `src/client/routes/specification/$id/_view/-interview-controller.ts` | Pass pending preface from view state through to `InterviewControllerBottomArtifactState` |

---

## Card B: Progressive tool activity indicator `next`

### Objective

During the gap between thinking completion and question card streaming, the `GeneratingTurnPlaceholder` shows which external tools the agent is calling (e.g. file paths for `read_file`, glob patterns), with increased visual weight when reasoning text is absent.

### Acceptance Criteria

```
✓ summarizeAssistantActivity (or a companion) extracts the latest dynamic tool's human-readable argument summary (truncated to ≤80 chars) in addition to tool names.
✓ ActivityPlaceholder renders the latest tool argument summary progressively.
✓ When liveReasoningText is empty/absent and tools are active, ActivityPlaceholder has increased visual weight (larger text or more prominent styling) instead of the minimal "Thinking…" line.
✓ Long file paths and sensitive-looking content (tokens, keys) are truncated/filtered in tool argument summaries.
✓ npm run verify passes.
```

### Verification Approach

```
- Inner: npm run verify (type-check + lint + unit tests + build)
- Middle: manual walkthrough — start a brownfield spec, observe tool activity indicators during pre-question generation
```

### Key files

| File | Change |
| ---- | ------ |
| `src/shared/chat.ts` | Enhance `summarizeAssistantActivity` or add `getLatestToolDetail` to extract latest tool argument summary |
| `src/client/components/question-cards.tsx` | Update `ActivityPlaceholder` to render tool detail and increase visual weight when reasoning is absent |
| `src/client/routes/specification/$id/_view/-interview-controller.ts` | Thread enriched activity data through `getLatestAssistantActivity` |
