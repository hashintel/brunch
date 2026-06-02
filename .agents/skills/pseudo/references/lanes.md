# Pseudo: Lanes

Captures **actors over time** — request/response, async handoff between services, conversational protocols, ownership boundaries. The family for the relation `chain` and `graph` can't cleanly express: *who* does *what*, *when*, *to whom*.

## When to use

- More than one actor or system in the flow.
- Request/response order matters.
- Async handoff with timing implications.
- Conversational protocol (client ↔ server, multi-party).
- Chain is collapsing because lane boundaries matter ("who owns this step?").

## When NOT to use

- Single-actor sequence → **chain**.
- Pure dependency structure, time doesn't matter → **graph**.
- Lifecycle of a single resource (its named modes) → **state-machine** on that actor.

## Canonical form

One message per line, in time order. Each line is `sender <edge> recipient: message [#anchor]`. Actor names are bare words.

```
client -> api:    POST /login         #S1
api    -> db:     SELECT user         #S2
api    -> hasher: verify(password)    #S3
api    ~> mailer: send notification   #S4   # async
api    <- client: 200 SessionDTO      #S5
```

Edge types (same set as elsewhere):

- `->`  synchronous request
- `~>`  async / fire-and-forget
- `<-`  response (sender on left = responder)
- `x>`  error / rejection / timeout

## Variants

### Numbered messages

`#Sn` step anchors let other artifacts reference specific messages. Use when cross-referencing matters — e.g. a state-machine transition triggered by `#S3`, or a chain that handles the `#S2` response.

### With actor declarations

Declare actors when type matters or names need disambiguation. Same pattern as `graph` node typing.

```
actors:
  client: browser
  api:    service
  worker: job
  db:     store
  mailer: external

messages:
  client -> api:    POST /login         #S1
  api    -> db:     SELECT user         #S2
  api    -> client: 202 accepted        #S3
  api    ~> worker: enqueue(notify)     #S4
  worker ~> mailer: send                #S5
```

### Parallel / async fork

Async messages on the same originating step don't need to wait. Stack them without indenting.

```
api -> db:     INSERT order       #S1
api ~> mailer: confirmation       #S2  # parallel async
api ~> ledger: record             #S3  # parallel async
api <- client: 202 accepted       #S4
```

If join semantics matter (waiting for both async results), escape to **graph** with explicit join.

### Loops and conditional blocks

Group messages under a labeled block. Indent the block body by two spaces.

```
client -> api: POST /upload   #S1

loop while not complete:
  client -> api: PUT chunk N  #S2
  api    -> client: 200 ack   #S3

client -> api: POST /commit   #S4
api    -> client: 201 created #S5
```

```
client -> api: POST /login         #S1

alt success:
  api -> client: 200 SessionDTO    #S2a
alt invalid:
  api -> client: 401 unauthorized  #S2b
alt locked:
  api -> client: 423 locked        #S2c
```

### Time annotations

When relative or absolute time matters, use trailing comments:

```
client -> api: POST /charge       #S1
api    -> psp: capture            #S2  # blocking, ≤2s budget
api    ~> ledger: record          #S3  # async
api    -> client: 200 ok          #S4  # T+~300ms typical
```

## Annotation patterns

- **`#Sn` step anchors** for cross-reference from other artifacts.
- **`actors:` block** for typed actor declarations when needed.
- **`# note`** trailing comments for local context.
- **Diff markers `+` / `-` / `~`** as line prefix when comparing versions of a protocol.
- **`?` for uncertain timing/order, `!` for risk** (e.g. "this leaks PII over the wire").
- **`notes:` / `open:` footer** keyed by step anchors.

```
notes:
  - #S2: PSP capture is the only blocking dependency in the hot path
  - #S3: ledger write is eventually consistent; reconcile via separate job

open:
  - confirm idempotency key flows through #S2 → PSP
```

## Smell-to-switch tripwires

- **Single actor** — only one column has any messages → **chain**.
- **Time genuinely doesn't matter**, only dependency → **graph**.
- **An actor has rich named modes** (its behavior depends on its state) → **state-machine** on that actor, referenced from lanes.
- **Many actors with similar roles** (e.g. `worker1`, `worker2`, `worker3`) → typed **graph** with multiplicity, not lanes.
- **Sequence becomes a tangle of arrows crossing back and forth** → escape to Mermaid `sequenceDiagram` or split scenarios.

## Anti-patterns

- **Sync and async with the same arrow.** Use `->` / `~>` / `x>` consistently.
- **Omitting the response** for synchronous calls. Reader can't tell if it's fire-and-forget.
- **Mixing logical actors and physical processes** in one diagram (`Frontend` next to `nginx worker #3`). Pick one level.
- **Too-fine granularity** — every internal function call as a message. Lanes are for cross-actor messages; intra-actor calls belong in a **chain**.
- **Too-coarse granularity** — `client -> server: do the thing`. Useless. Name the message.

## Escape hatches

- **Mermaid `sequenceDiagram`** when actor count > 5 or message count > 20, or when activation/lifeline rendering would actively help.
- **Multiple lanes diagrams** for distinct scenarios (login vs renewal vs error-recovery). Linked by anchor.
- **State-machine on one actor** + lanes around it, when that actor's modes drive the protocol.
- **Graph + lanes pair** — the graph shows static dependencies; lanes show the runtime conversation across the same actors.

## Worked example: OAuth login

```
actors:
  user:     human
  app:      service       # our service
  provider: external      # OAuth provider
  db:       store

messages:
  user     -> app:      click "Login with Provider"   #S1
  app      -> user:     302 to provider/authorize     #S2
  user     -> provider: GET authorize?...             #S3
  provider -> user:     consent screen                #S4
  user     -> provider: approve                       #S5
  provider -> user:     302 to app/callback?code=...  #S6
  user     -> app:      GET /callback?code=...        #S7
  app      -> provider: POST token (exchange code)    #S8
  app      <- provider: { access_token, id_token }    #S9
  app      -> db:       upsert user                   #S10
  app      ~> ledger:   log auth event                #S11   # async
  app      -> user:     302 to /home + session cookie #S12

notes:
  - #S8: server-to-server; never expose code or secret to the browser.
  - #S11: failure here does not block login.

open:
  - PKCE flow variant — separate diagram?
```

## Worked example: retry with backoff between services

```
actors:
  api:    service
  worker: job
  db:     store
  dlq:    queue

messages:
  api    -> worker: enqueue(task #t42)         #S1
  worker -> db:     UPDATE task running        #S2
  worker x> db:     transient error            #S3   # attempt 1
  worker -> worker: backoff 1s                 #S4
  worker x> db:     transient error            #S5   # attempt 2
  worker -> worker: backoff 2s                 #S6
  worker -> db:     UPDATE task success        #S7   # attempt 3 ok
  worker ~> api:    callback complete          #S8

# Failure path (alternative scenario, ≥3 attempts fail):
  worker x> db:     transient error            #S5'
  worker -> dlq:    push task #t42             #S6'
  worker ~> api:    callback failed            #S7'

notes:
  - retry counts and backoff schedule live in the worker config, not in this diagram
```
