# Shared baseline: prepared-run landing

The repository contains an execution system that produces immutable run metadata and a promoted review
reference. A successful execution lane stops at `promotion_prepared`; it does not mutate the host branch.

The user-facing Brunch TUI is the public interaction surface. The landing workflow is addressed as
`/brunch:land` and requires explicit confirmation after a read-only preflight.

Landing must work for both:

- a brownfield run rooted at an existing host commit; and
- a greenfield run whose complete promoted tree is materialized into a missing or empty target.

Implementation structure, module names, ports, and internal APIs are not part of the contract.
