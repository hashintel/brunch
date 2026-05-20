# Portability Boundaries: backend, runtime, and workspace capabilities

> Design exploration from 2026-04-27.
> Status: **future-facing draft** — recommended direction for making Brunch portable across backend substrates and non-local agent/workspace providers.
> Canonicality: this is a focused design note for portability boundaries, not live product authority. For what is true now and what should happen next, prefer `memory/SPEC.md` and `memory/PLAN.md`.

## Why this note exists

Today, Brunch is intentionally local-first.

That shows up in three product assumptions:

- the frontend expects a local REST backend for reads and mutations
- the interview runtime expects an SSE chat endpoint for streamed assistant output
- brownfield and tool-using agent flows expect direct access to a local workspace directory and local filesystem/shell capabilities

Those assumptions are reasonable for the current product, but they are also the main blockers to a future portable version where:

- the backend may be local, remote, embedded, or adapter-backed
- the streaming transport may be SSE, WebSocket, RPC streaming, or an in-process iterator
- the agent may work against a local filesystem, a sandbox, a checked-out repository, or a hosted analysis substrate

This note maps the current coupling points, evaluates several boundary shapes, and recommends the smallest deep split that makes future portability realistic without prematurely rewriting the app.

## Current coupling map

### 1. Frontend transport coupling

The client currently knows concrete backend routes and fetches them directly.

Examples:

- `src/client/routes/__root.tsx` fetches `/api/config`
- `src/client/routes/-project-list.tsx` fetches `/api/specifications`
- `src/client/routes/specification/$id/-specification-data.ts` fetches specification bundles and entities
- `src/client/mutations/interview-mutations.ts` posts phase-intent and turn-response mutations

This means the browser is coupled not just to a backend interface, but to a particular REST path layout.

### 2. Frontend streaming coupling

The interview controller creates a `DefaultChatTransport` against `/api/specifications/:id/chat`.

That is a stronger assumption than “there is a streaming conversation backend.” It assumes:

- HTTP request/response initiation for chat
- the AI SDK transport contract as the client boundary
- an SSE-compatible streamed response shape behind that endpoint

The same controller also separately triggers observer capture over REST in the specification lifecycle helper.

### 3. Server transport/runtime coupling

`src/server/app.ts` currently mixes several layers that would ideally be separable:

- Express route registration
- request validation and response shaping
- durable workflow mutations
- interviewer turn orchestration
- assistant streaming
- observer capture triggering
- local workspace capability injection

This is the main portability knot. Right now, transport, orchestration, workflow, and local capabilities all meet in one place.

### 4. Local workspace capability coupling

Brownfield prompting and context-gathering are currently expressed in terms of a `cwd` plus local read-only tools.

That assumption lives in `src/server/interview.ts`, where:

- prompts mention “The workspace directory is: ${cwd}”
- exploration capability is derived from “do we have a cwd?”
- tool availability is injected via `createExplorationTools(options.cwd)`

The tool registry in `src/server/tools/index.ts` then binds directly to local implementations such as:

- read/write/edit file
- grep/find/list directory
- bash

This is the key place where “agent portability” differs from “backend portability.” A portable backend can still fail to support portable agent capabilities if it only swaps storage while leaving the runtime tied to local shell and filesystem access.

### 5. Local substrate coupling

The launcher and runtime setup assume local project ownership and local persistence:

- `src/server/project.ts` discovers or creates a `.brunch/` directory
- `src/server/runtime-config.ts` resolves the database path from `cwd`
- `src/server/launcher.ts` mounts the local static client and binds localhost
- `src/server/db.ts` initializes `better-sqlite3` directly

These are valid local adapters, but they should remain adapters rather than becoming the product-level portability contract.

## Existing seams worth preserving

The good news is that several strong seams already exist.

### Shared read-model contract

`src/shared/api-types.ts` already defines the core client/server product contract:

- `SpecificationState`
- `WorkflowState`
- `EntitiesData`
- structured turn payloads
- mutation response types

This is the most important seam to preserve. A future portable backend should still be able to project the same specification/workflow read model even if its storage and runtime differ.

### Read-model projection direction in SPEC

`memory/SPEC.md` already establishes a few decisions that line up well with portability work:

- D86: client routing is separate from center-pane rendering concerns
- D87: data ownership is partitioned by read-model domain
- D113: lifecycle side effects are specification-scoped, not route-scoped
- D121: client data ownership is moving to query-owned domains

These decisions do not solve portability by themselves, but they do mean the product is already thinking in terms of read-model ownership versus runtime side effects.

### Core server helper seam

`src/server/core.ts` already acts as a partial application/service boundary around:

- specification creation
- active-path loading
- turn preparation and finalization
- specification state projection

It is not yet the full portability seam, but it is the right neighborhood for a durable store/read-model service.

## Design goals

Any portability boundary should preserve these product properties:

1. The shared specification/workflow read model remains stable even if transport or storage changes.
2. Chat view and graph view remain projections over one durable specification truth.
3. The client keeps one specification-scoped runtime view rather than accumulating transport-specific state machines.
4. Brownfield workflows still receive contextual workspace capabilities, but those capabilities are expressed abstractly instead of assuming local filesystem access.
5. Local-first launch remains possible as an adapter, not a permanent architectural center.

## Design A: thin transport gateway

### Shape

Introduce a frontend `BackendClient` that hides direct `fetch()` calls and chat transport creation, but keep the existing server structure largely intact.

Example shape:

```typescript
interface BrunchBackendClient {
  getAppConfig(): Promise<AppConfig>
  listSpecifications(): Promise<SpecificationListItem[]>
  getSpecification(specificationId: string): Promise<SpecificationState>
  getEntities(specificationId: string): Promise<EntitiesData>
  submitPhaseIntent(specificationId: number, request: SubmitPhaseIntentRequest): Promise<SubmitPhaseIntentResponse>
  submitTurnResponse(specificationId: number, turnId: number, request: SubmitTurnResponseRequest): Promise<SubmitTurnResponseResponse>
  captureObserver(specificationId: number, turnId: number): Promise<SubmitObserverCaptureResponse>
  createChatTransport(specificationId: number): ChatTransport
}
```

### What it hides

- concrete `/api/...` path knowledge
- whether the browser uses `fetch`, RPC, or some embedded bridge
- chat transport creation details

### Trade-offs

Pros:

- lowest-risk client extraction
- improves testability of the frontend
- removes hardcoded route layout from UI code

Cons:

- too shallow to solve the real portability problem
- leaves the server runtime coupled to local workspace tools and SQLite/local launch assumptions
- mostly changes “how the browser calls the server,” not “what the portable system is”

### Verdict

Good first step, but not sufficient as the main portability design.

## Design B: split store, runtime, and capabilities

### Shape

Separate the backend into three ports:

1. a durable specification store/read-model service
2. a session runtime that owns interview streaming and observer orchestration
3. a workspace capability provider that supplies agent-facing tools and workspace metadata

Example shape:

```typescript
interface SpecificationStore {
  list(): Promise<SpecificationListItem[]>
  create(input: CreateSpecificationRequest): Promise<Specification>
  readSnapshot(specificationId: number): Promise<SpecificationState>
  readEntities(specificationId: number, mode: EntityProjectionMode): Promise<EntitiesData>
  apply(command: SpecificationCommand): Promise<SpecificationCommandResult>
}

interface InterviewSessionRuntime {
  streamTurn(request: RuntimeTurnRequest): AsyncIterable<BrunchEvent>
  captureObserver(specificationId: number, turnId: number): Promise<CaptureStatus>
}

interface WorkspaceCapabilityProvider {
  describeWorkspace(specificationId: number): Promise<WorkspaceDescriptor>
  createInterviewerTools(context: CapabilityContext): InterviewerTools
  createObserverTools?(context: CapabilityContext): ObserverTools
}
```

### Usage sketch

```typescript
const runtime = createInterviewSessionRuntime({
  store,
  capabilityProvider,
  interviewerFactory,
  observerFactory,
})

for await (const event of runtime.streamTurn(request)) {
  writer.write(event)
}
```

### What it hides

- whether storage is SQLite, Postgres, in-memory, or something else
- whether streaming is delivered over SSE, WebSocket, or another transport
- whether workspace exploration hits a local repo, remote sandbox, or hosted analysis layer
- whether observer capture runs inline, deferred, or via a background job

### Trade-offs

Pros:

- gives durable state, runtime orchestration, and workspace capabilities separate ownership
- aligns well with the existing distinction between read-model truth and lifecycle side effects
- keeps local-first operation as one adapter family instead of the whole architecture
- makes “portable backend” and “portable agent capabilities” separable concerns

Cons:

- introduces three explicit interfaces rather than one minimal facade
- requires real extraction work in `app.ts`
- pushes some naming and command-model decisions earlier than a pure transport cleanup would

### Verdict

This is the best fit for the current codebase. It is deep enough to hide the right complexity without collapsing everything into one giant adapter.

## Design C: one substrate adapter

### Shape

Create one broad `BrunchPlatform` or `PortableWorkspace` interface that owns storage, streaming, workspace description, tool provision, and runtime operations.

Example shape:

```typescript
interface BrunchPlatform {
  listSpecifications(): Promise<SpecificationListItem[]>
  createSpecification(input: CreateSpecificationRequest): Promise<Specification>
  readSpecification(specificationId: number): Promise<SpecificationState>
  readEntities(specificationId: number, mode: EntityProjectionMode): Promise<EntitiesData>
  streamTurn(request: RuntimeTurnRequest): AsyncIterable<BrunchEvent>
  captureObserver(specificationId: number, turnId: number): Promise<CaptureStatus>
  describeWorkspace(specificationId: number): Promise<WorkspaceDescriptor>
}
```

### What it hides

- almost everything

### Trade-offs

Pros:

- easiest interface to explain at a very high level
- could work well for a fully embedded or fully hosted product shell

Cons:

- too broad to be a good design seam right now
- encourages mixing durable truth, ephemeral runtime state, and capability injection behind one opaque facade
- risks turning into a god object with shallow internals instead of a deep module with crisp sub-boundaries

### Verdict

Too coarse for the current stage.

## Recommended design

Recommend **Design B: split store, runtime, and capabilities**.

The core idea is:

- keep the **specification read model** as the stable product contract
- isolate **session runtime orchestration** from HTTP/SSE transport
- express **workspace/agent access** as capabilities, not as “there is a local cwd”

This design draws the portability line low enough to matter, but not so low that every implementation detail must be rethought immediately.

## Recommended boundary map

### 1. Frontend boundary: `BrunchBackendClient`

The frontend should stop importing backend route knowledge directly.

That client should own:

- read operations for config, list, bundle, entities, export
- mutation operations for phase intent and turn response
- streaming transport construction for interview chat
- observer capture request initiation

This does not yet make the system portable by itself, but it makes the browser depend on a coherent interface rather than a concrete REST layout.

### 2. Durable boundary: `SpecificationStore`

This service should own durable truth and read-model projection.

Responsibilities:

- specification CRUD and snapshot loading
- workflow/read-model projection
- entity projections
- command application to durable state

It should not know about Express, SSE, browser transports, or local filesystem tools.

### 3. Runtime boundary: `InterviewSessionRuntime`

This service should own the turn/session behavior that `app.ts` currently coordinates:

- prepare/resolve/finalize turn flow
- interviewer streaming
- inline or deferred observer capture
- phase summary and activity event emission
- idempotent runtime concerns around in-flight operations

The important design point is that the runtime should emit portable events or parts, not directly write HTTP responses.

### 4. Capability boundary: `WorkspaceCapabilityProvider`

This is the key to making agent access portable.

Instead of asking “do we have a `cwd`?” the runtime should ask:

- what workspace is bound to this specification?
- what descriptive metadata can be surfaced to the agent?
- what exploration or mutation capabilities are available?
- what limitations or trust boundaries apply?

That allows several adapters to exist later:

- local repo + local filesystem tools
- read-only sandbox copy
- hosted repository mirror
- API-backed remote workspace analysis

The existing local tool registry remains useful, but only as one concrete provider implementation.

### 5. Local adapter boundary

Keep these explicitly local and adapter-scoped:

- `.brunch/` project discovery
- localhost binding
- local static serving
- SQLite persistence
- direct filesystem/shell tools

These remain valid for the local product, but they should no longer define what “a Brunch backend” or “a Brunch workspace” means in general.

## A more portable workspace concept

The current API/config shape exposes `cwd` and `homedir` because the local app wants to render that in the chrome.

A portable version will need a more abstract workspace descriptor.

Example shape:

```typescript
interface WorkspaceDescriptor {
  id: string
  label: string
  substrate: 'local-fs' | 'sandbox' | 'remote-repo' | 'hosted-project'
  displayPath?: string
  capabilities: {
    canReadFiles: boolean
    canWriteFiles: boolean
    canRunShell: boolean
    canSearchCode: boolean
  }
}
```

The important part is not the exact type. It is that the UI and prompts should depend on a descriptive workspace binding, not directly on the presence of a local cwd.

## Incremental extraction path

This is intentionally staged so portability can improve without a rewrite.

### Slice 1: client transport gateway

Introduce a `BrunchBackendClient` on the frontend and route all existing reads/mutations through it.

Primary targets:

- `src/client/routes/__root.tsx`
- `src/client/routes/-project-list.tsx`
- `src/client/routes/specification/$id/-specification-data.ts`
- `src/client/mutations/interview-mutations.ts`
- `src/client/routes/specification/$id/_view/-interview-controller.ts`
- `src/client/routes/specification/$id/_view/-specification-lifecycle.ts`

This is the safest first extraction because it is mostly a dependency inversion on the client side.

### Slice 2: extract a transport-free interview runtime

Move the orchestration logic out of `src/server/app.ts` into a dedicated runtime service that returns portable events.

The Express route should become:

- validate request
- call runtime
- adapt runtime events to HTTP/SSE response transport

### Slice 3: extract workspace capabilities from `cwd`

Replace `cwd`-driven tool injection in `src/server/interview.ts` with a provider-driven capability model.

Short-term, the local provider can still be implemented entirely in terms of `cwd` and the existing tools. The important move is expressing that as one provider instead of as baseline product truth.

### Slice 4: isolate local storage/launch adapters

Push `.brunch`, launcher, and SQLite assumptions behind explicit local adapters.

At that point, a remote or embedded backend can implement the same store/runtime/capability interfaces without inheriting local project-discovery semantics.

## What should stay stable

The following should remain as stable as possible across substrate changes:

- `SpecificationState`
- `EntitiesData`
- workflow and turn semantics
- streamed assistant/activity/observer event semantics
- graph-view and chat-view projection over shared durable truth

In other words: portability should change *where the truth comes from and how capabilities are supplied*, not the core user-facing meaning of a specification workspace.

## What should become swappable

The following should become adapter-selected implementation details:

- REST vs RPC vs embedded in-process backend calls
- SSE vs WebSocket vs another streaming mechanism
- SQLite vs another durable store
- local filesystem tools vs sandboxed repository capabilities
- localhost launcher vs hosted runtime shell

## Open questions

1. Should streamed chat remain the canonical browser-facing transport contract, or should the client eventually depend on a more generic async-event stream interface and let SSE be only one adapter?
2. How much of the current AI SDK `DefaultChatTransport` contract should remain part of the long-term client boundary versus being wrapped immediately?
3. For portable brownfield work, what is the minimum workspace capability set required for a good interviewer experience: file reads, search, directory listing, shell, or some higher-level analysis interface?
4. Should observer capture remain a separate runtime action, or should a more portable runtime hide that distinction entirely behind one session event stream?
5. Does a future hosted version need multi-tenant/session identity in the shared API contracts, or can that remain outside the specification/workflow model for now?

## Recommendation summary

If the goal is a future portable Brunch, the first real boundary should not be “replace REST.”

It should be:

- **stable read-model contract**
- **transport-free interview runtime**
- **capability-oriented workspace provider**
- **adapter-scoped local substrate**

That is the smallest design that cleanly separates:

- what Brunch *is*
- how the browser talks to it
- where the durable truth lives
- what kind of workspace the agents are allowed to touch
