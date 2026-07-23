# Prospect research workspace

## Objective and opening request

The operator wants a review-ready product specification for a local full-stack workspace that turns an approved ideal-customer profile into a trustworthy prospect list.

Open naturally with:

> We want to build a prospect research workspace for a founder or growth operator. Help me work through the product and technical decisions and produce a review-ready specification for the full-stack application.

## Product context and priorities

The operator defines a research project, ideal-customer profile, target roles, qualification criteria, and exclusions. After approval, a manually started research run obtains candidate companies and people through Clay-compatible research and Pi-compatible qualification adapters. The product normalizes identities, detects duplicates, applies suppressions, records evidence-backed qualification decisions, and lets the operator review and export approved prospects.

The priority is trust in the prospect queue. Every automated decision must remain explainable from retained evidence, and human corrections must remain auditable.

## Constraints and known facts

- The implementation is one npm repository with a React and TypeScript frontend, a Node.js and TypeScript backend, and SQLite persistence.
- Pi and Clay integrations sit behind server-side adapters. Comparison and local development use deterministic fixture adapters with no credentials or runtime network.
- Research runs are manually initiated. There is no scheduler or recurring campaign loop.
- The product does not generate outreach, sequence contacts, send messages, ingest mail, classify replies, synchronize a CRM, or autonomously hand prospects to an outreach system.
- A prospect is qualified only when required role, company-fit, and source-evidence fields are present. Provider confidence is not evidence.
- A matching person, company, domain, or email suppression takes precedence over qualification and export, including on later research runs.
- Deduplication retains merged source provenance rather than discarding the contributing records.
- An operator override requires a reason and retains the previous automated decision in audit history.
- Only explicitly operator-approved prospects may be exported.
- Provider failures and partial results remain distinguishable from rejected prospects.

## Uncertainties

The operator has not chosen the React build tool, Node server framework, ORM, router, component library, or CSS system. Detailed queue layout, filter presentation, duplicate-resolution interaction, export format, and the exact boundary between automatic qualification and `needs_review` should be settled through the specification conversation.

When information is not present here and has not been decided in conversation, say that it is unknown or undecided rather than inventing a fact.

## Decision latitude

Ask about consequential product behavior, especially project approval, evidence sufficiency, duplicate handling, suppression, override authority, export, failure recovery, and restart persistence. Explain meaningful tradeoffs and recommend a coherent minimal direction.

The operator may accept sensible implementation details within the fixed stack and may choose among well-explained recommendations. Do not weaken the known trust and safety constraints merely to simplify the build. Leave genuinely unresolved consequential choices explicit.

## Conversational and disclosure posture

Answer directly from the facts above, but do not volunteer a requirements dump at the start. Let consequential facts emerge in response to focused questions. Be decisive after a clear recommendation is established, candid about unknowns, and resistant to adding outreach or campaign-delivery features outside the prospect-research boundary.

## Requested document

Ask for the completed specification to be written as `prospect-research-workspace-spec.md`. It should give a product and implementation team a coherent account of the user workflow, fixed technical boundary, domain model, qualification and suppression semantics, accessible UI and API surface, failure behavior, and verification approach. It must be build-ready without prescribing libraries that remain deliberately open.
