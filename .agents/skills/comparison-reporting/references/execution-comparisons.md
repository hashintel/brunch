# Execution comparisons

Use this procedure for reports about products implementing the same frozen specification in isolated repositories.

## Canonical evidence

Read the case and attempt artifacts rather than reconstructing the run:

1. frozen public specification and public contract;
2. immutable `ExecutionAttempt` record;
3. masked-outcome packet;
4. unblinded-process packet;
5. common command and browser result summaries;
6. final tree and diff;
7. validity, intervention, terminal, and cleanup records; and
8. lane-only diagnostic appendix when authorized.

The FE-1230 owners are:

- `src/dev/execution-comparison/artifact-contract.ts`
- `src/dev/execution-comparison/packet-redaction.ts`
- `testing/execution-comparisons/cases/<case-id>/`

Use `not_assessable` exactly when the immutable attempt says a common metric was unavailable. Do not turn absence into zero, parity, or failure.

## Evidence boundaries

### Public

Safe to share with every lane and in the report:

- frozen specification;
- public runtime, build, delivery, and accessibility contract;
- declared model and budgets when part of the public packet; and
- public packet hash.

### Masked outcome

Safe for identity-blind outcome review:

- opaque lane label;
- public contract and packet hash;
- terminal outcome and validity status;
- final tree and diff;
- common command/browser status; and
- cleanup result.

Do not add product identity, process transcript, intervention explanation, or lane-only diagnostics.

### Unblinded process

Safe for process review:

- lane and product identity;
- provider, model, harness, and actor-recipe versions;
- normalized target-visible events;
- budgets and mechanical interventions;
- terminal reason, validity reasons, and cleanup.

Do not add hidden reasoning or controller-only oracle contents.

### Controller-only

Never publish controller-only oracle details:

- exact hidden fixtures or malformed inputs;
- expected markings or reference-model states;
- exact browser journeys or coordinates;
- selector or label mappings beyond the public accessibility contract;
- oracle installation paths or source;
- reveal material; or
- hidden-oracle hashes when the destination is not an approved controller record.

Report only aggregate results such as “browser oracle passed” or “accessibility-name contract failed,” plus a portable artifact reference appropriate to the audience.

## Validity before quality

An attempt is invalid when its frozen contract says so, including substantive human intervention, controller material entering the lane, budget violation, host landing, or non-equivalent adapter behavior. Preserve the attempt unchanged.

Distinguish:

- target output failure;
- harness or provider runtime failure;
- controller/oracle failure;
- protocol invalidity; and
- cleanup residue.

A failed valid attempt is comparative evidence. An invalid attempt is process evidence but cannot support outcome ranking.

## Common versus diagnostic claims

Common comparison claims may use only the closed fields available to every lane. Brunch Petri journal, generated plan, JSONL, graph, and debug evidence can explain Brunch behavior in an explicitly unblinded diagnostic appendix; it cannot improve Brunch's common score or compensate for a failed common oracle.

One case or one attempt cannot support broad reliability, cost, or speed claims. Report the observed case and sample size.
