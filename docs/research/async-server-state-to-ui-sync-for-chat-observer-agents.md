# Async Server-State to UI Sync: Chat + Observer Agent Architecture

## Sync status — 2026-04-22

**Status:** partially live design input for the active query-ownership frontier.

### Still-live inputs

- The chat stream and observer side-effects are different sync problems and should not share one ownership model by accident.
- Observer-created entities belong to query-owned, non-transcript surfaces such as the entity sidebar and graph view.
- In-band data parts on the existing SSE chat stream remain a valid delivery mechanism while observer completion stays in the same request / turn lifecycle.
- TanStack Query remains the right client sync seam for observer-owned state; bridge SSE-delivered observer results into query-owned data via `queryClient`, not ad hoc React local state.

### Not the live question anymore

- A separate out-of-band SSE channel is deferred unless observer completion becomes truly async / off-request.
- TanStack DB evaluation is out of scope for the current refactor.
- The detailed library comparison and `useChat` stale-closure cautions are background notes, not the primary design drivers.
- The current live concern is stricter than “observer results update something somewhere”: entity refresh must stay **outside the transcript-owning subtree**.

## Executive Summary

The architecture described — SSE-based chat streaming via `@ai-sdk/react` `useChat`, plus a background observer agent that creates new data entities — creates two distinct sync problems that should be handled with two different mechanisms. The core chat turn (primary agent response) should stay on the existing `useChat` / AI SDK SSE stream, with observer-created entities surfaced either **in-band** as typed data parts on the same stream, or **out-of-band** via a `queryClient.invalidateQueries` / `queryClient.setQueryData` call triggered from `useChat`'s `onFinish` or `onData` hooks feeding TanStack Query. TanStack DB is real but likely overkill for this use case, as argued below.

***

## The Two Distinct Sync Problems

Before evaluating tools, it's worth being precise about what you actually need to sync:

1. **Primary agent streaming** — token-by-token SSE already handled by `useChat`. This is a solved problem.
2. **Observer side-effects** — after a turn completes, the observer agent may have created new `Decision`, `Assumption`, or dependency-edge entities. These need to surface in other UI panels (an entity graph, a sidebar, a phase tracker, etc.) that are **not** owned by the chat stream.

These two problems have fundamentally different shapes. The first is a write-once, ordered, append-only stream. The second is a set of discrete entity upserts against a relational data model stored in SQLite. Conflating them into one mechanism is the source of complexity.

***

## Option 1: In-Band Data Parts on the Existing SSE Stream (Recommended Starting Point)

The AI SDK's `createUIMessageStream` / `writer.write()` API allows arbitrary typed data to be pushed alongside the LLM token stream. This is the least infrastructure-heavy path.[^1]

### How it works

Your Express adapter, which already translates `DomainEvent` into AI SDK SSE, can intercept `ObserverCompletedEvent` domain events and serialize the resulting entities as typed data parts:

```ts
// server: web adapter
for await (const event of conductTurn(sessionId, userMessage)) {
  if (event.type === 'token') {
    writer.write({ type: 'text-delta', textDelta: event.delta });
  }
  if (event.type === 'observer_completed') {
    writer.write({
      type: 'data-observer-result',
      id: `obs-${event.turnId}`,
      data: {
        decisions: event.decisions,
        assumptions: event.assumptions,
        edges: event.edges,
      },
    });
  }
}
```

On the client, the `onData` callback on `useChat` fires for every data part as it arrives. Transient parts (not stored in message history) are **only** accessible here:[^1]

```tsx
const { messages } = useChat<MyUIMessage>({
  onData: (part) => {
    if (part.type === 'data-observer-result') {
      // push into local zustand / jotai store, or invalidate a TanStack Query
      queryClient.setQueryData(['entities', sessionId], (old) =>
        mergeEntities(old, part.data)
      );
    }
  },
});
```

### Why this is a good default

- **Zero new infrastructure** — no second SSE channel, no WebSocket, no separate polling endpoint
- **Causal ordering** — observer results always arrive after the turn they belong to, because they're emitted in the same stream
- **Already typed** — `createUIMessageStream` supports Schema-validated custom data part types[^1]
- **Persistent vs transient is explicit** — mark observer data as `transient: true` if you don't want it replayed on reconnect[^1]

### Limitations

- Observer results land on the chat-turn SSE connection. If the observer runs significantly after the primary agent finishes (e.g. async queue), you need to hold the SSE connection open, or buffer and flush. With `better-sqlite3` + synchronous observer this is fine; with truly async post-processing it gets awkward.
- `useChat`'s `onFinish` / `onData` side-effect timing has known quirks with stale closures in React. Prefer `queryClient.setQueryData` over setting React state directly inside these callbacks.[^2]

***

## Option 2: Separate Out-of-Band SSE Channel + TanStack Query Invalidation

If the observer runs truly asynchronously (after the HTTP response has already closed), or if you want to push entity updates from *any* server-side trigger (not just after a chat turn), a dedicated server-push channel is the right abstraction.

This pattern — a persistent `EventSource` connection managed in a React context, bridged to TanStack Query via `queryClient.invalidateQueries` or `queryClient.setQueryData` — is well-established. A GitHub Discussion on TanStack Query explicitly shows this webhook/SSE → invalidation pattern as the canonical approach:[^3][^4]

```tsx
// SSEContext.tsx — a lightweight pub/sub bridge
export function SSEProvider({ url, children }) {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('entity_created', (e) => {
      const payload = JSON.parse(e.data);
      // Option A: invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['entities', payload.sessionId] });
      // Option B: push directly into cache
      queryClient.setQueryData(['entities', payload.sessionId], (old) =>
        mergeEntities(old, payload)
      );
    });

    return () => es.close();
  }, [url, queryClient]);

  return <>{children}</>;
}
```

### Trade-offs

| Concern | In-Band (Option 1) | Out-of-Band SSE (Option 2) |
|---|---|---|
| Infrastructure | None (reuses chat SSE) | Separate `/api/events` endpoint |
| Causal ordering | Guaranteed (same stream) | Must implement turn correlation |
| Async observer support | Only if observer is sync/same-request | Works with any async backend |
| Cache coherence | Manual via `onData` → `setQueryData` | Same, slightly cleaner separation |
| Reconnection | Handled by `useChat` | Must handle `EventSource` reconnect |
| Complexity | Low | Medium |

For your architecture, where the observer is "invoked by core after turn completion" synchronously, **Option 1 is the right starting point**. Option 2 becomes compelling if you later move the observer to a background queue (e.g., a Temporal workflow step).

***

## The TanStack Query Layer (Regardless of Delivery Mechanism)

Either way, the right place to cache entity state on the client is TanStack Query (`@tanstack/react-query`), because you're already familiar with it. The pattern is:[^5][^6]

- **`queryClient.setQueryData`** for push-driven updates (from SSE events) — synchronously updates the cache without a network round-trip[^7]
- **`queryClient.invalidateQueries`** for pull-driven updates (when you know something changed but don't have the new data) — triggers background refetch[^6]
- **`useQuery`** for initial load and stale-while-revalidate on mount

This gives you normalized, component-level reactive subscriptions to entity collections across the entire React tree, with zero extra dependencies.

***

## Should You Use TanStack DB?

**Probably not yet.** Here's the honest assessment:

TanStack DB is a **client-side normalized relational store** powered by differential dataflow, designed for sub-millisecond live queries across large in-memory collections. Its main value proposition is:[^8][^9][^10]

- Eliminating endpoint sprawl by loading normalized data and joining client-side[^8]
- Optimistic mutations with automatic rollback[^11]
- Sub-millisecond incremental query updates for 100k+ row collections[^10]

For your use case, TanStack DB would add real value if:
- Observer entities are joined with chat turns, phases, and user data in complex cross-collection queries in the UI
- You want automatic optimistic writes (e.g., user edits a `Decision` inline)
- You're adopting a sync engine (ElectricSQL, PowerSync) for the SQLite backend — this is where TanStack DB genuinely shines[^12][^8]

It would be **overkill** if:
- Observer entities are rendered in isolated panels with simple list queries
- Your entity collections stay small (< a few thousand items)
- You don't have multi-tab or offline requirements

TanStack DB is also still in beta (0.5 as of late 2025), and its `queryCollectionOptions` REST integration requires replacing your existing `useQuery` calls. Given you already have `@ai-sdk/react` + TanStack Query working, the migration cost isn't justified until you hit a specific scaling or DX wall.[^13][^9]

The specific claim in the TanStack DB overview that makes it warrant consideration for your case is: *"When a mutation triggers cascading changes across tables, all affected data syncs automatically without manual cache invalidation"* — but this only holds with a sync engine (Electric, PowerSync) as the data source. With a REST API backend, you still need manual invalidation.[^8]

***

## Recommended Architecture

Given the constraints (SSE/`useChat` already in place, synchronous observer, SQLite backend, single-user session), the recommended approach:

### Immediate (low effort, covers the observer use case cleanly)

1. **Emit observer results as typed data parts** on the existing AI SDK stream from your Express adapter, after `conductTurn()` yields observer domain events.
2. **Bridge to TanStack Query** in `useChat`'s `onData` callback via `queryClient.setQueryData(['entities', sessionId], ...)`.
3. **Render entity panels** with standard `useQuery(['entities', sessionId])` — they'll reactively update whenever the cache is set.
4. Optionally mark observer parts as `transient: true` if you don't need them replayed on page reload (load from SQLite instead on mount).

### If/when observer goes async

- Add a lightweight `/api/events/:sessionId` SSE endpoint in Express (5-10 lines with the standard `res.write` pattern)[^14]
- Move the `queryClient.setQueryData` bridge into an `SSEProvider` context wrapping the app
- No other changes needed

### If you need optimistic edits + complex joins across entities

- Evaluate TanStack DB at that point, ideally alongside adopting ElectricSQL for the SQLite sync layer
- The `LocalOnlyCollection` type in TanStack DB could be useful for ephemeral observer results that don't need server persistence[^1]

***

## What to Avoid

- **Triggering side effects from `useChat`'s `onFinish`** with direct `setState` calls — this has well-documented stale-closure issues in `@ai-sdk/react`. Route through `queryClient` instead.[^2]
- **Polling** `/api/entities` on an interval — this is unnecessary given SSE is already in place and creates inconsistent latency.
- **Storing observer results only in React state** (e.g., a `useState` in a parent component) — this doesn't survive navigation, can't be shared across component subtrees without prop drilling, and can't be server-populated on reload.
- **Reaching for TanStack DB as a general-purpose state manager** — it's designed for normalized collections with live queries, not as a drop-in for Zustand/Jotai for UI state.

---

## References

1. [Server-Sent Events (SSE) Protocol | TanStack AI Docs](https://tanstack.com/ai/latest/docs/protocol/sse-protocol) - Server-Sent Events (SSE) is a standard HTTP-based protocol for server-to-client streaming. It provid...

2. [useChat onFinish accesses an old state of messages #550 - GitHub](https://github.com/vercel/ai/issues/550) - When I console.log(messages) within the onFinish callback, I get the previous state of messages from...

3. [Adding event-based invalidation support · TanStack query - GitHub](https://github.com/TanStack/query/discussions/8618) - We listen to webhook events for update events to various entities, and in case an update matches the...

4. [Using Websockets with React Query - Jon Bellah](https://jonbellah.com/articles/websockets-with-react-query) - If you just need to fetch some data you can use useQuery and be on your way, but as your application...

5. [Introduction to TanStack DB and React Query - PARA-Garden](https://www.agenthicks.com/videos/react-query-vs-tanstack-db) - PARA-Garden: A hybrid personal content management system

6. [How to invalidate queries in React Query - CoreUI](https://coreui.io/answers/how-to-invalidate-queries-in-react-query/) - The most reliable approach is using queryClient.invalidateQueries in mutation callbacks to automatic...

7. [QueryClient | TanStack Query Docs](https://tanstack.com/query/v4/docs/reference/QueryClient) - setQueriesData is a synchronous function that can be used to immediately update cached data of multi...

8. [TanStack DB 0.5 . Query-Driven Sync](https://tanstack.com/blog/tanstack-db-0.5-query-driven-sync) - Your component's query is now the API call. No custom endpoint, no GraphQL resolver, no backend chan...

9. [TanStack DB Enters Beta with Reactive Queries, Optimistic ... - InfoQ](https://www.infoq.com/news/2025/08/tanstack-db-beta/) - Introducing TanStack DB: a groundbreaking embedded client-side database that revolutionizes frontend...

10. [Stop Re-Rendering. TanStack DB, the Embedded Client Database ...](https://tanstack.com/blog/tanstack-db-0.1-the-embedded-client-database-for-tanstack-query) - Your React dashboard shouldn't grind to a halt because one TODO gets checked. TanStack DB is a clien...

11. [Tanstack Query vs Tanstack DB: Optimism and Pessimism - LinkedIn](https://www.linkedin.com/posts/coryhouse_a-big-difference-between-tanstack-query-and-activity-7369350686028820480-y9nt) - A big difference between Tanstack Query and Tanstack DB: Tanstack Query is pessimistic by default. I...

12. [Super-fast apps on sync with Electric and TanStack DB](https://electric-sql.com/blog/2025/07/29/super-fast-apps-on-sync-with-tanstack-db)

13. [Tanstack DB 0.5 Query-Driven Sync: Loading data will never be the ...](https://blog.logrocket.com/tanstack-db-0-5-query-driven-sync/) - Explore TanStack DB's new feature, Query-Driven Sync, and how you can leverage it to build efficient...

14. [How to Implement Server-Sent Events (SSE) in React - OneUptime](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view) - A comprehensive guide to implementing Server-Sent Events in React applications for real-time data st...

