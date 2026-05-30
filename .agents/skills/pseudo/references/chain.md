# Pseudo: Chain

Captures **linear flow, call stack, mainline reasoning** — one thing leading to the next, with shallow branching for fallbacks, errors, and fire-and-forget side effects. Top-down indented with arrows as the line prefix.

## When to use

- Call graph from a single entry point.
- Mainline happy-path with a few exceptions or async side effects.
- Step-by-step pseudocode or reasoning.
- Layered composition (handler → service → repo → driver).
- Paired flows (production vs test, happy vs error) — same form, two named blocks.

## When NOT to use

- Multiple actors hand off requests/responses → **lanes**.
- More than one meaningful branch that rejoins → **graph**.
- Order between independent steps doesn't matter → **graph**.
- Persistent state with named modes → **state-machine**.

## Canonical form

Top-down, two-space indent per level, edge marker as the line prefix.

```
HTTP handler
  -> AuthService.verify
    -> TokenStore.lookup
      -> Redis GET
      x> Postgres SELECT       # fallback on miss
    -> User.load
  <- 200 SessionDTO
```

Top-down is canonical. Left-to-right chains are harder to edit, harder to wrap, and don't compose with nesting; treat them as a rendering, not a source form.

## Variants

### Guarded chain (conditional branches)

```
POST /login
  -> validate
    x> 400 invalid           # error branch terminates
  -> Auth.verify
    -> Token.issue
  <- 200 SessionDTO
```

### Async side-effect chain

`~>` for fire-and-forget side effects that don't block the mainline.

```
POST /order
  -> Order.create
  ~> Analytics.track          # async
  ~> Mailer.confirmation      # async
  <- 202 accepted
```

### Fork/join-lite (mainline + parallel side-work)

If the join semantics matter (waiting for all branches), switch to **graph** or **lanes**.

```
Process request
  -> Order.save
  ~> Email.send
  ~> Analytics.emit
  <- 202 accepted             # no join — fire-and-forget
```

### Input/output chain (shape transforms)

When types change through the chain and the transformation is the point:

```
req: LoginRequest
  -> validate
  -> normalizeEmail
  -> Auth.verify
  <- SessionDTO
```

### Paired chains (prod / test, happy / error)

Two named blocks under separate headings, same form. The pattern from your Final call graph example.

```
### Production
HTTP handler
  -> LinkCatalog.layerDurableObject
    -> Effect RPC over Durable Object fetch
      -> LinkCatalog.layer
        -> LinkCatalogCoordinator
          -> LinkCatalogStore
            -> LinkCatalogSqlExecutor
          -> PublicRedirectIndexService

### Tests
HTTP handler
  -> linkCatalogMemoryLayer
    -> LinkCatalog.layer
      -> LinkCatalogCoordinator
        -> LinkCatalogStore.layerMemory
        -> PublicRedirectIndexService.layerMemory
```

## Annotation patterns

- **`#id` on a step** makes it linkable: `-> Auth.verify #verify` → referenced from a graph or matrix as `#verify`.
- **`[tag]` column** for compact metadata aligned to the right.
- **Trailing `# note`** for local context; promote into structure if it changes control flow.
- **Diff markers `+` / `-` / `~`** as line prefix or marker before the arrow.
- **`?`** for uncertain step, **`!`** for risky/hotspot.
- **`@owner`** when ownership shifts between steps.
- **`notes:` / `open:` footer** keyed by anchors.

## Smell-to-switch tripwires

The universal rule applies sharpest here:

> **If a side note changes control flow, concurrency, ownership, or error semantics, it is not a footnote anymore — switch families.**

Concrete tripwires:

- **More than one meaningful branch at a step.** → **graph** or **lanes**.
- **Branches rejoin** (you need a join node). → **graph**.
- **"Who does this step?" becomes interesting.** → **lanes**.
- **Timeouts, retries, backpressure become first-class.** → **graph** with typed nodes, or **state-machine**.
- **You start writing parenthetical "(also calls X)" notes.** → branching has exceeded chain capacity.
- **Sync/async distinction matters and you keep forgetting which is which.** → use `~>` consistently, or escape to **lanes**.

## Anti-patterns

- **Mixing sync and async edges with the same arrow.** Use `->` / `~>` / `x>` consistently or readers infer wrong defaults.
- **Implicit fan-out via parentheticals.** The "(also calls X)" smell — that's the family-switch trigger.
- **Left-to-right diagrams that wrap.** Unreadable; not editable.
- **Chains longer than a screen.** Split by anchor reference; link the sub-chains.
- **Mixing levels of abstraction** in one chain (HTTP handler → SQL query → byte buffer). Pick one level per chain.

## Escape hatches

- **Graph** when branching exceeds chain capacity (>1 meaningful branch, joins matter).
- **Lanes** when more than one actor is in play.
- **State-machine** when the chain is really a transition with retries/timeouts.
- **Split + anchor** when length exceeds a screen.

## Worked example: HTTP login with guards and async logging

```
POST /login                                          #login
  -> validate body
    x> 400 invalid_request
  -> Auth.verify
    -> TokenStore.lookup
      -> Redis GET
      x> Postgres SELECT          # fallback on cache miss
    -> User.load
    x> 401 invalid_credentials
  -> Session.issue
  ~> Audit.log                    # async, fire-and-forget
  <- 200 SessionDTO

open:
  - #login: should Audit.log failure surface as 500 or stay silent?
```

## Worked example: production / test pairing

See the Paired chains variant above (Final call graph example). Same form, two named blocks. The shared steps in both blocks are the contract; the divergence is the layer substitution under test.
