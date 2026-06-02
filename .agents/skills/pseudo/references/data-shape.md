# Pseudo: Data-shape

Captures **schemas, types, and instance shape** — what fields a thing has, what types they take, what's optional, what variants exist. Uses **valid YAML** so that comments survive copy-paste, sub-trees can be snippeted in chat, and yamllint/parsers keep working.

## When to use

- Sketching a schema before translating to Zod, TypeScript, JSON Schema, SQL, etc.
- Negotiating field shape with the user via comments and snippeted sub-trees.
- Documenting the shape of an instance for examples or fixtures.
- Capturing a discriminated union or variant set.

## When NOT to use

- Cross-field rules dominate the shape → keep the shape but move rules into `_rules:` block, or split shape + state-machine.
- The "shape" is really a workflow → **state-machine** or **chain**.
- Multiple shapes related by composition or inheritance → multiple data-shape blocks linked by `#id`.

## Canonical form

Each line is `key: type` plus optional trailing comment. Nesting uses YAML indentation. Optional fields take suffix `?`.

```yaml
user:
  id: string          # uuid
  email: string       # unique, lowercased
  tier: enum          # free | paid | trial
  createdAt: datetime
  profile:
    name: string
    avatarUrl: string?     # optional
```

## YAML-validity rule (and what it costs)

Data-shape stays valid YAML so that comments survive copy-paste, sub-trees can be snippeted, and yamllint/parsers keep working. This costs one thing: **the overlay grammar's line-position markers (`+`, `-`, `~`, `!`, `?`) cannot appear at the key position — they must live inside comments.** Every other family allows them on the line itself.

| Marker | Other families (line position) | Data-shape (comment position) |
|---|---|---|
| added | `+ trialEndsAt: datetime?` | `# + trialEndsAt: datetime?` |
| removed | `- legacyPlan: string` | `# - legacyPlan: string` |
| changed | `~ tier: enum` | `# ~ tier: enum (was string)` |
| risk | `! amount: number` | `amount: number   # ! check rounding` |
| proposal | `? trialEndsAt: datetime?` | `# ? trialEndsAt: datetime?` |

## The `?` collision rule

Suffix `?` on a type means *optional field* — it's part of the type vocabulary (`string?`, `datetime?`).

Proposal `?` lives only in the comment-prefix form `# ?`. The two never collide because one is *after* the type and one is *before* a commented-out line.

```yaml
user:
  tier: enum          # free | paid | trial
  # ? trialEndsAt: datetime?    # proposal: required when tier=trial
```

The `# ?` prefix marks proposal; the trailing `?` on `datetime?` marks optional type.

## Type vocabulary (small and stable)

Stay close to this set to keep translation to Zod/TS/SQL mechanical:

```
string  number  boolean  datetime  date  duration
enum                    # values in trailing comment
literal "value"         # for discriminator keys
T?                      # optional T
T[]                     # array of T
map<K, V>               # keyed map
ref<T>                  # foreign reference
oneOf:                  # discriminated union
allOf:                  # intersection
```

Annotate constraints in trailing comments (`# unique`, `# >= 0`, `# regex /.../`) rather than inventing type syntax.

## Variants

### Discriminated union

```yaml
event:
  oneOf:
    - kind: literal "login"
      userId: ref<User>
      ip: string
    - kind: literal "logout"
      userId: ref<User>
    - kind: literal "purchase"
      userId: ref<User>
      sku: string
      amount: number       # cents
```

Each variant gets a discriminator field (`kind:` here) with a `literal` type.

### Defaults, computed, readonly

Mark in trailing comments using a small vocabulary so translation stays mechanical:

```yaml
order:
  id: string             # readonly, uuid
  createdAt: datetime    # default: now()
  slug: string           # computed from title
  status: enum           # default: "draft" | submitted | active
```

### `_rules:` block (cross-field invariants)

When the same constraint touches multiple fields, promote it. Comments become normative only when they live here.

```yaml
user:
  email: string
  tier: enum             # free | paid | trial
  trialEndsAt: datetime?
  avatarUrl: string?

_rules:
  - email is unique
  - trialEndsAt required when tier = "trial"
  - avatarUrl must start with "https://"
```

If `_rules:` grows past ~7 entries, split the shape or escape to a state-machine.

### Refs and collections

```yaml
team:
  id: string
  ownerId: ref<User>
  memberIds: ref<User>[]
  roles: map<ref<User>, enum>     # role values in trailing _rules
```

### Instance / example

Same syntax, but values replace types. Mark the block so readers don't confuse it with a schema.

```yaml
# example: user
user:
  id: "01HXYZ..."
  email: "luke@example.com"
  tier: "trial"
  createdAt: "2026-05-30T12:00:00Z"
```

Pair schema + instance under separate headings (`## Shape` / `## Example`) when both are useful.

## Annotation patterns

- **Top-level keys ARE anchors.** `session:` is referenced from other artifacts as `#session`. No inline anchor syntax — `session: #session` would parse as `session: null` with a stray comment.
- **Diff markers live in comments** (per the YAML-validity rule). Inline before/after:

  ```yaml
  user:
    id: string
    email: string
    tier: enum             # ~ was: string — restricted to enum
    # + trialEndsAt: datetime?
    # - legacyPlan: string
  ```

  Two conventions for inline diff: `# ~` / `# +` / `# -` as *comment prefix* for new/removed lines; `# ~ note` as *trailing comment* on a line whose type changed in place.

- **Risk marker** as trailing comment: `amount: number   # ! check rounding`.
- **Collaborative-edit comments** — the killer move. Both parties edit; file still parses.

  ```yaml
  user:
    email: string
    # luke: lowercase on read or on write?
    tier: enum               # free | paid | trial
    # agent: trial needs an expiry. proposal:
    # + trialEndsAt: datetime?
  ```

## Smell-to-switch tripwires

- **Comments carry business logic.** Promote into `_rules:` or split into shape + state-machine.
- **More than ~3 `oneOf` variants with overlapping fields.** Consider an `allOf:` base plus distinct extensions.
- **Cross-field rules outnumber fields.** The model is really a state-machine or a graph; the shape is just its persistence projection.
- **Mixing schema and instance in one block.** Split into two blocks under separate headings.
- **The same nested structure appears in three+ places.** Extract a named shape with `#id` and reference it.

## Anti-patterns

- **Inventing type syntax** (`string<lowercase>`, `int(>=0)`). Use the small type vocabulary plus trailing-comment constraints.
- **Re-using `?` for both optional and uncertain in the same block.** Always ambiguous. Use the `# ?` comment-prefix convention for proposals.
- **Trailing comments doing real work.** If the comment changes whether code is correct, it's a rule, not a comment.
- **One mega-shape.** If a shape needs more than ~15 fields, it's probably two shapes plus a reference.
- **Mixing styles between siblings.** `userId: string` in one place and `user_id: String` in another. Pick one casing per artifact.

## Escape hatches

- **Multiple shapes linked by `#id`** — almost always beats one large shape.
- **Real schema language** (Zod, TS interface, JSON Schema) — once the shape stabilizes, translate. Pseudo data-shape is a *negotiation form*, not a production artifact.
- **Pair shape + state-machine + `_rules:`** when the data model is genuinely stateful; don't try to encode lifecycle in optionality.

## Worked example: full negotiation cycle

Starting sketch by the user:

```yaml
session:
  id: string
  userId: string
  createdAt: datetime
  expiresAt: datetime
```

Agent's response — proposed changes inline, valid YAML preserved:

```yaml
session:
  id: string                  # uuid
  userId: ref<User>           # was: string
  createdAt: datetime         # default: now()
  expiresAt: datetime
  # agent: tier-dependent expiry. proposal:
  # + tier: enum              # free | paid (frozen at session create)
  # + revokedAt: datetime?    # nullable; set on logout
  # rules?
  # _rules:
  #   - expiresAt > createdAt
  #   - revokedAt > createdAt when set

# ? should sessions know about tier, or look up via userId?
```

Agreed final form:

```yaml
session:
  id: string                  # uuid, readonly
  userId: ref<User>
  createdAt: datetime         # default: now()
  expiresAt: datetime
  revokedAt: datetime?        # set on logout

_rules:
  - expiresAt > createdAt
  - revokedAt > createdAt when set
  - lookup tier via User.tier (not denormalized here)
```

The top-level key `session:` is its own anchor. A state-machine can reference it as `#session` (`active -[expire]-> expired   # of #session`) and a graph can place it as `#session` (`auth -> #session -> store`).
