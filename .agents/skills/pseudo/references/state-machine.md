# Pseudo: State-machine

Captures **durable states and the transitions between them** — workflow phases, lifecycle, protocol modes. Use only when the system *stores* the named states; if it doesn't, you have a chain or a sequence pretending to be a machine.

## When to use

- Persistent lifecycle (`draft → pending → active → archived`).
- Protocol modes (`disconnected → connecting → connected → reconnecting`).
- Resource status that drives behavior elsewhere.
- Workflows where transitions have guards, effects, or both.

## When NOT to use

- "States" are actually actions (`submit`, `approve`, `notify`) → **chain**.
- Process steps that don't persist anywhere → **chain** or **lanes**.
- Multiple independent state dimensions → **multiple machines**, not one flattened machine.
- Guards dominate every transition → **matrix** decision table referenced from the machine.

## Canonical form

Two shapes are canonical; pick by transition complexity.

### Arrow form (≲8 transitions, few guards)

```
draft   -[submit]->  pending
pending -[approve]-> active
pending -[reject]->  draft
active  -[archive]-> archived
active  -[expire after 90d]-> expired
expired -[renew (if tier=paid)]-> active
```

`-[label]->` for normal transitions; `x[label]->` for failure/rejection transitions (parallels the **graph** edge syntax).

### Table form (guards or effects multiply)

```
states: draft, pending, active, archived, expired

transitions:

from     | event    | to        | guard          | effect
---------|----------|-----------|----------------|------------------
draft    | submit   | pending   |                | notify reviewer
pending  | approve  | active    | hasReviewer    | issue token
pending  | reject   | draft     |                | clear submission
active   | archive  | archived  |                |
active   | expire   | expired   | age ≥ 90d      | revoke token
expired  | renew    | active    | tier = paid    | reissue token
```

Either form is canonical; the table form scales better past ~8 transitions.

## Variants

### States block + transitions block (structure first)

Declare the state set explicitly when the machine has more than ~5 states or composite states. Then transitions reference them:

```
states:
  draft
  pending
  active
  archived
  expired

transitions:
  draft   -[submit]-> pending
  ...
```

Avoids surprise states that exist only as a typo in the transitions block.

### Composite / nested states

Don't flatten a hierarchy that has meaning. Declare nesting:

```
states:
  draft
  pending
  active/
    normal
    suspended
  archived

transitions:
  active.normal    -[suspend]-> active.suspended
  active.suspended -[resume]->  active.normal
  active           -[archive]-> archived    # from any sub-state
```

Transitions on the parent (`active`) apply from any sub-state.

### Entry / exit / invariant hooks

When effects always run on entering or leaving a state, hoist them out of every transition:

```
state: active
  on-enter:  issueToken
  on-exit:   revokeToken
  invariant: hasReviewer
```

Then individual transitions don't need to repeat `issue token` / `revoke token`.

### Wildcard / default transitions

Use sparingly — `*` matches any source state:

```
* -[timeout]-> expired       # any state can expire on timeout
* -[purge]->   archived      # admin override from anywhere
```

### Orthogonal dimensions (multiple machines)

When state has independent dimensions, do **not** flatten them. Define separate machines:

```
## connection machine
disconnected -[connect]-> connecting
connecting   -[ok]->      connected
connecting   x[fail]->    disconnected
connected    -[drop]->    reconnecting
reconnecting -[ok]->      connected

## auth machine
unauthenticated -[login]->  authenticated
authenticated   -[logout]-> unauthenticated
authenticated   -[expire]-> unauthenticated

## sync machine
clean -[edit]->   dirty
dirty -[push]->   syncing
syncing -[ok]->   clean
syncing x[fail]-> dirty
```

Cross-machine guards reference other machines by name: `guard: connection.connected`.

## Annotation patterns

- **`#id` on states or transitions** for cross-reference. Transition IDs (`#T7`) let a matrix or chain say "see transition #T7."
- **`[tag]` column** on transition rows (table form) for metadata.
- **Diff markers `+` / `-` / `~`** as line prefix on transition lines.
- **`?` for uncertain transitions, `!` for risky/hotspot transitions.**
- **`@owner`** when ownership of a state's invariants varies.
- **`notes:` / `open:` footer** keyed by anchors.

```
transitions:
  pending -[approve]-> active   #T7   ! requires audit log
  active  -[expire]-> expired   #T8

notes:
  - #T7: who issues the audit entry — the API or the worker?
```

## Smell-to-switch tripwires

- **"Where does this state live?"** — can't answer → it's a **chain** or **lanes**, not a state-machine. Good test.
- **State names are verbs / actions** (`submit`, `approve`, `notify`) → **chain**.
- **Orthogonal dimensions multiply states** into combos like `review_pending_billing_active_sync_dirty` → split into multiple machines.
- **Every transition has a long guard expression** → the guards belong in a **matrix** decision table; the machine references it.
- **Transitions are really "calls"** to other components → **chain** or **graph**.
- **You can't list the state set explicitly** without scanning all transitions → declare states first.

## Anti-patterns

- **Flattening orthogonal dimensions** into one Cartesian-product state set. Always wrong.
- **Modeling a workflow as states when the system doesn't store them.** The reader will look for the state column in the DB and find nothing.
- **Mixing event names and condition expressions** in the event column. Events name *what happened*; conditions go in `guard`.
- **Forgetting effects.** State changed AND something else happened (token issued, email sent). Capture both; effects are first-class.
- **Wildcard `*` everywhere.** If most transitions are wildcards, the structure isn't pulling its weight.

## Escape hatches

- **Multiple state machines** for orthogonal dimensions — almost always.
- **Matrix decision table** for guard-heavy transitions; the machine row references rule IDs.
- **Lanes** when the "states" are really protocol modes between two actors.
- **Chain** when the "states" are really sequential steps.

## Worked example: subscription lifecycle

```
states:
  trial
  active
  past_due
  canceled
  expired

transitions:

from     | event           | to        | guard           | effect
---------|-----------------|-----------|-----------------|---------------------
trial    | upgrade         | active    | payment ok      | provision; bill
trial    | expire          | expired   | age ≥ 14d       | suspend access
active   | payment_fail    | past_due  |                 | notify; retry sched
past_due | payment_ok      | active    |                 | clear flag
past_due | exhaust_retries | canceled  | retries ≥ 3     | revoke access
active   | cancel_user     | canceled  |                 | end of period
canceled | resubscribe     | active    | within 30d      | reactivate; bill
canceled | purge           | expired   | age ≥ 30d       | delete data

notes:
  - guard `within 30d`: measured from canceled-at timestamp on the row.
  - `expired` is terminal in this machine; renewal goes through a fresh trial.
```

## Worked example: orthogonal dimensions

```
## sync machine (per document)

states: clean, dirty, syncing, conflict

clean    -[local-edit]->   dirty
dirty    -[push]->         syncing
syncing  -[ok]->           clean
syncing  x[remote-change]-> conflict
conflict -[resolve]->      dirty

## presence machine (per user)

states: away, active, focused

away    -[input]->     active
active  -[focus-app]-> focused
focused -[blur]->      active
active  -[idle 5m]->   away
focused -[idle 5m]->   away

# These two machines are independent. Don't flatten into
# { clean+away, clean+active, ..., conflict+focused } — 12 combos no one wants.
```
