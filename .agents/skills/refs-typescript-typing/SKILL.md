---
name: refs-typescript-typing
description: Enforce source-of-truth typing in TypeScript. Use when writing, reviewing, or refactoring TS types so app code imports or derives canonical types instead of re-declaring DTOs, unions, schema-backed shapes, or local projections.
argument-hint: "[files, module, or diff to audit for duplicated/shadowed types]"
---

# Source-of-Truth TypeScript

Types do not fork. **Import, infer, index, project. Never restate.**

Every type has an owner. Parnas's information hiding, Evans's ubiquitous language, and Minsky's invalid-state discipline all push the same way: do not duplicate a state space that already has a source of truth.

Prefer the owning seam:
- library exports own library types
- schemas, const registries, and runtime contracts own derived app types
- shared contracts own transport DTOs
- local modules own only genuinely local semantics

Before declaring a type, ask in order:
1. Can I **import** it?
2. Can I **infer** it? (`z.infer`, `InferSelectModel`, `ComponentProps`, `ReturnType`, `Awaited`, `typeof X[number]`)
3. Can I **project** it? (`T['k']`, `Pick`, `Omit`, `Extract`, `Exclude`, mapped or conditional types)
4. Am I introducing a **new semantic boundary**? If not, do not declare it.

Strong smells:
- literal unions repeated across files
- DTOs restated in both producer and consumer
- schema-backed interfaces written by hand
- widened placeholders like `string` where a finite union exists
- local types later "proved" with `satisfies SharedType`
- fixtures, seeds, and tests wider than production contracts

Legitimate local types:
- persistence-row types owned by storage
- true local view models or adapters that rename or compress a boundary
- new semantic distinctions not present upstream
- temporary characterization helpers in tests, only when they cannot derive from the real seam

When reviewing or refactoring:
- trace each questionable type to its owner
- replace redeclarations with imports or derivations
- narrow widened types back to their finite source
- make fixtures, seeds, and tests derive from the same seam as production code
- if two modules need the same shape and neither owns it, extract the owner first

Skip steps you consider unnecessary.

## Input

Area to audit: $ARGUMENTS

If unspecified, inspect the current diff or recently changed TypeScript files.

## Output

Present findings as numbered candidates:

```md
## Type source-of-truth review: [area]

1. **[Description]** — canonical source: `[module/type]` — action: import|infer|project|keep-local
   [Why this shadows or duplicates the owner, and the smallest safe replacement]

2. ...
```

Recommend the highest-leverage collapse first.
