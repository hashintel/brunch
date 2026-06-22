# Scope mode: slices (sliced scope files)

Disclosed reference for [`ln-scope`](../SKILL.md). Load when the scope file will hold several pre-scoped vertical cards in sequence (`Mode: slices`) instead of one card.

When the containing seam is settled and the next 2–5 commit-sized steps are obvious, write them as a `Mode: slices` scope file rather than forcing repeated rescoping.

**Hard anti-speculation gate (this rule comes first):** no card in a sequence may depend on implementation findings from earlier cards in the same sequence. If card B's scope would shift based on what you learn while building card A, stop after A. Pre-scoped sequences are for already-legible follow-through, not for guessing ahead.

A slice sequence is appropriate only when all of these are true:

- the work stays inside one existing frontier item (or one coherent dev/tooling concern)
- each card is still small enough to verify and commit independently
- no card is expected to change requirements, assumptions, decisions, or invariants
- the next few cards are sequentially obvious enough that pre-scoping them reduces churn rather than hiding uncertainty
- later cards remain valid even if implementation of earlier cards surprises you

Multi-card preparation is a **bias when these conditions hold**, not a default to maximize. Prefer fewer cards over more. If in doubt, write one card.

Chain discipline:

- keep sequences short — typically 2–5 cards
- keep each card in full or light scope-card format
- mark card status clearly (`next`, `in progress`, `done`, `dropped`, `stale`)
- if any card trips the promotion checklist, reveals a frontier split, or turns out to depend on unknown results from an earlier card, stop the sequence and route back through `ln-spec` or `ln-plan` as appropriate
- delete the scope file when its sequence is exhausted or superseded (per-file deletion only)
