---
name: design
description: "Focus on design implications and module/interface boundaries."
---

# design

Use this lens when the spec pressure is about modules, interfaces, ownership, boundaries, or architecture. The plane focus is design: how accepted intent could be realized without prematurely treating implementation detail as product truth.

Favor design-plane modules and interfaces, plus realization or boundary edges back to intent claims. Useful questions ask what owns a responsibility, what information crosses a boundary, what should be hidden, what depends on what, and where invalid states should be made unrepresentable. When design uncovers a missing requirement, capture or ask through the intent lens rather than smuggling it in as architecture.

Interpretation rule: design statements are commitments about shape, dependency direction, and information hiding. Separate a user preference for an implementation from a requirement the implementation serves. If two modules seem to own the same fact, ask which boundary should own mutation or projection.

Topology-driven next questions: inspect requirements with no realization, modules with unclear interfaces, conflicting boundary edges into the same target, or assumptions that many design nodes depend on. Prefer the question that makes dependency direction or ownership legible.
