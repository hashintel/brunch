# Prospect Research Workspace

## Product Summary

Build a local full-stack workspace that turns an approved ideal-customer profile into a reviewable, evidence-backed prospect list. A founder or growth operator manually starts research, reviews qualification decisions, applies suppressions or reasoned overrides, approves selected prospects, and exports only that approved subset.

## Product Boundary

The application researches and qualifies prospects. It does not generate outreach, sequence contacts, send messages, ingest mail, classify replies, schedule recurring runs, synchronize a CRM, or autonomously hand prospects to another system.

## Core Workflow

1. The operator creates a research project with a name and ideal-customer profile.
2. The operator approves the project before research can run.
3. A manual research run reads deterministic candidates from the configured Clay-compatible adapter.
4. The application normalizes people and companies, merges duplicates while retaining provenance, and applies suppressions.
5. The Pi-compatible qualification adapter assigns `qualified`, `needs_review`, or `rejected` from criterion-level evidence.
6. The operator reviews evidence and audit history, may suppress or override with a reason, and explicitly approves prospects.
7. Export contains only explicitly approved, non-suppressed prospects.

## Qualification And Safety

- Required role, company-fit, and source-evidence fields must be present before qualification.
- Provider confidence is metadata, not qualifying evidence.
- Suppressing a prospect takes precedence over qualification, approval, export, and later imports of that prospect.
- Overrides preserve the prior automated decision and record the operator's reason.
- Provider failure never silently becomes prospect rejection.

## Technical Boundary

Use a React and TypeScript frontend, Node.js and TypeScript backend, SQLite durable store, and server-side Pi/Clay-compatible adapter interfaces. The regression mode uses deterministic local fixtures and performs no runtime network access. The public contract fixes the HTTP and SQLite evidence surfaces used by the regression oracle; build tool, server framework, ORM, router, component library, and CSS system remain implementation choices.

## Success

The prototype succeeds when the operator can approve one project, run fixture-backed research, inspect deduplicated and suppressed prospects, understand evidence-backed decisions, apply an audited override, approve a subset, export only that subset, observe provider failures honestly, and restart without losing durable state.
