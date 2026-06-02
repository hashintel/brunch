# Pseudo: Matrix

Captures **n×m relationships in a compact grid** — options × criteria, conditions × actions, responsibilities × steps, scenarios × subsystems, source × target. The same pipe-delimited form, but the *semantics* vary by sub-form. Be explicit about which sub-form you're using.

## When to use

- Comparing options against a fixed set of criteria.
- Specifying rules as conditions → actions.
- Capturing who-does-what across steps (responsibility).
- Tracking coverage of scenarios across subsystems.
- Adjacency for dense graphs.

## When NOT to use

- Cells need sentences, not tokens → split into smaller matrices, or escape to prose.
- Row order secretly encodes time or priority → **chain** or **state-machine**.
- Rules nest with conditional sub-branches → decision tree (not in this typology — escape to prose or split into multiple matrices).

## Canonical form

Pipe-delimited grid: header row, separator row, body rows. Cell values are tokens, not sentences.

```
                  | tree | chain | graph | matrix
------------------|------|-------|-------|--------
hierarchy         |  +   |   .   |   ~   |   .
linear flow       |  .   |   +   |   ~   |   .
fan-in / fan-out  |  .   |   .   |   +   |   .
n×m comparison    |  .   |   .   |   .   |   +
diff-friendly     |  +   |   +   |   -   |   +
```

ASCII-friendly cell vocabulary:

```
+    strong fit / yes / required
~    partial / depends / optional
-    poor fit / no / forbidden
?    unknown / TBD
.    intentionally blank (vs typo or unconsidered)
```

The `.` is doing real work: it distinguishes *"considered and not applicable"* from *"haven't thought about it"* (truly blank). Use it.

## Sub-forms (semantically distinct)

### Comparison grid (options × criteria)

Rows are options; columns are criteria; cells are fit values. No ordering implied; no execution semantics. The canonical-form example above is a comparison grid.

### Decision table (conditions → actions)

Rows are rules; left columns are conditions; columns prefixed with `→` are actions/outputs. **Always declare the match policy** above the table:

```
policy: first-match

rule | tier  | age    | → action          | → notify
-----|-------|--------|-------------------|----------
R1   | free  | <30d   | allow             | none
R2   | free  | ≥30d   | prompt-upgrade    | banner
R3   | trial | <14d   | allow             | countdown
R4   | trial | ≥14d   | block             | email
R5   | paid  | any    | allow             | none
```

Match policies:

- **first-match** — rows in order; first matching row wins. Gives priority semantics.
- **exclusive** — at most one rule matches; overlapping rules are a bug.
- **cumulative** — all matching rules apply; effects compose.

Without `policy:`, readers can't tell whether you mean priority, partitioning, or composition.

Use `rule | ...` first column with `#R1`-style IDs so transitions in a state-machine or steps in a chain can reference rules by anchor.

### Responsibility matrix (steps × actors)

Steps as rows; actors as columns. Standard RACI vocabulary (`R` responsible, `A` accountable, `C` consulted, `I` informed), or simpler `R` / `.` if only ownership matters.

```
step          | api | worker | ops
--------------|-----|--------|-----
enqueue       |  R  |   .    |  .
process       |  .  |   R    |  C
retry         |  .  |   R    |  A
dead-letter   |  .  |   .    |  R
```

### Coverage matrix (scenarios × subsystems)

Scenarios as rows; subsystems as columns; `+` marks involvement. Used for test coverage planning, change-impact analysis, regression scope.

```
scenario        | auth | billing | email
----------------|------|---------|------
signup          |  +   |    .    |  +
renewal         |  .   |    +    |  +
password reset  |  +   |    .    |  +
```

### Adjacency matrix (dense graphs)

Escape hatch from **graph** when edge-list exceeds ~30 edges in a densely connected graph. Rows = source, columns = target, cells = edge type (`+` / `~>` / `x>` / `.`).

```
       | http | proc | log | cache | done
-------|------|------|-----|-------|------
http   |  .   |  +   |  .  |   .   |  .
proc   |  .   |  .   |  +  |   ~>  |  .
log    |  .   |  .   |  .  |   .   |  +
cache  |  .   |  .   |  .  |   .   |  +
```

Keep the node-list (from `graph`) above the matrix so node types stay visible.

## Annotation patterns

- **`→` prefix on column headers** marks outputs (decision tables) vs inputs.
- **`rules:` / `examples:` label** at the top of the table to mark normative vs illustrative. Without this, implementers fill gaps as "don't care."
- **`policy:` above decision tables** (mandatory).
- **`#Rn` row anchors** in the first column for cross-reference from other artifacts.
- **`notes:` / `open:` footer** keyed by row anchors for per-row prose.
- **Diff markers `+` / `-` / `~` and risk `!`, uncertain `?`** can prefix the row identifier or sit in cells (where they don't collide with cell vocabulary — be careful here).

```
notes:
  - #R4: should "block" also revoke active sessions, or only block new ones?

open:
  - confirm trial transitions are pure age-based (no grace period)
```

## Smell-to-switch tripwires

- **Row order secretly encodes time** (rows are really steps) → **chain** or **state-machine**.
- **Cells need sentences, not tokens** → split into smaller matrices, or escape to prose.
- **Footnotes proliferate** to handle exceptions → the rule set is wrong; restructure.
- **Reader needs to know *why* a row matched**, not just *that* it did → use anchors + a `notes:` block, or escape to prose.
- **Decision table without policy** → ambiguous semantics; either declare policy or switch to prose.

## Anti-patterns

- **Decision table without `policy:`** — readers infer wrong defaults.
- **Missing `rules:` / `examples:` label** — gaps get implemented as "don't care."
- **Sentences in cells** — split or escape.
- **Mega-matrix** (>10 columns or >20 rows) — split by dimension.
- **Using blank cells and `.` interchangeably** — loses the "considered" vs "unconsidered" distinction.
- **Mixed sub-forms in one table** (comparison values mingled with decision actions). Pick one.

## Escape hatches

- **Decision tree** when rules nest beyond what columns can carry. (Not in this typology; render as a **chain** with guards or as prose.)
- **State-machine** when rules are stateful.
- **Prose** when narrative dominates ("under these special conditions, …").
- **Multiple smaller matrices** linked by anchor — almost always better than one mega-matrix.

## Worked example: decision table with first-match policy

```
policy: first-match
context: signup eligibility

rule | tier  | age    | region | → action          | → notify
-----|-------|--------|--------|-------------------|----------
R1   | -     | -      | EU     | require-consent   | inline
R2   | trial | ≥14d   | any    | block             | email
R3   | trial | <14d   | any    | allow             | countdown
R4   | free  | <30d   | any    | allow             | none
R5   | free  | ≥30d   | any    | prompt-upgrade    | banner
R6   | paid  | any    | any    | allow             | none

notes:
  - #R1: applies regardless of tier; EU consent is the first gate.
  - #R2-R3: trial transitions are pure age-based — confirm with product.

open:
  - what about trial users in EU on day 14? R1 should win under first-match.
```

## Worked example: responsibility matrix

```
context: production deploy steps

step              | dev | release-eng | ops | exec
------------------|-----|-------------|-----|------
write changelog   |  R  |     .       |  .  |  .
cut release       |  C  |     R       |  .  |  I
canary deploy     |  C  |     R       |  A  |  .
full deploy       |  .  |     C       |  R  |  I
incident response |  C  |     .       |  R  |  A
```
