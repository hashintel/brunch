# Seed pattern — concrete brunch scaffolding

Brunch-specific mechanics for authoring a completed-spec fixture. The notes below
are the parts that are easy to get wrong.

## Contents
- [Find a template scenario](#find-a-template-scenario)
- [Knowledge schema quick reference](#knowledge-schema-quick-reference)
- [Relationship-policy direction table](#relationship-policy-direction-table)
- [Seed structure](#seed-structure)
- [Key APIs](#key-apis)
- [Turn impact rubric](#turn-impact-rubric)
- [Load + delete-then-reseed](#load--delete-then-reseed)
- [In-memory verification template](#in-memory-verification-template)

## Find a template scenario

Scan for an existing all-phases-closed seed and mirror its shape rather than
re-deriving the turn and phase-closure machinery. Look in
`src/server/fixtures/scenarios/` (prior completed-spec fixtures, one per file) and
in `src/server/fixtures/scenarios.ts` (walkthrough scenarios). A good template
creates `requirement` + `criterion` items, calls `createConfirmedPhaseOutcome` for
`requirements` and `criteria`, and confirms grounding/design outcomes. The notes
below cover the parts that aren't obvious from reading one.

## Knowledge schema quick reference

`src/server/schema.ts` / `src/shared/api-types.ts`:

- **Kinds**: `goal | term | context | constraint | requirement | criterion | decision | assumption`
- **Edge relations**: `depends_on | derived_from | constrains | verifies | refines`
- Requirements + criteria become durable through accepted review; the other six
  kinds are the durable exploration ontology. `non-goal` is a `constraint` subtype.
- `kind_ordinal` auto-increments per (spec, kind), so reference codes are stable in
  creation order: create R1…Rn in order → `code('requirement', 1..n)`.

## Relationship-policy direction table

From `src/server/knowledge-relationship-policy.ts`. Every edge **must** pass
`supportsKnowledgeRelationship(relation, sourceKind, targetKind)` or it is silently
dropped. Allowed `source → target` kinds per relation:

| relation | source kinds | target kinds | typical use |
| --- | --- | --- | --- |
| `verifies` | criterion | requirement | criterion → requirement it verifies |
| `depends_on` | decision, assumption, requirement, criterion | goal, context, constraint, decision, assumption, requirement | epistemic dep (e.g. assumption → requirement) |
| `derived_from` | context, constraint, requirement, criterion, decision, assumption | goal, term, context, constraint, decision, assumption, requirement | decision → constraint it came from |
| `constrains` | constraint | goal, decision, requirement, criterion | constraint → requirement it bounds |
| `refines` | any | any | sharpening edge (adversarial req→req here) |

**Guard every edge** before inserting:

```ts
if (!supportsKnowledgeRelationship(edge.relation, kindByRef[edge.source]!, kindByRef[edge.target]!)) {
  throw new Error(`fixture violates relation policy: ${edge.source} -[${edge.relation}]-> ${edge.target}`);
}
addKnowledgeRelationship(db, idByRef[edge.source]!, idByRef[edge.target]!, edge.relation);
```

Drive nodes + edges from data arrays keyed by a stable `ref` (e.g. `R1`, `AC6`,
`K1`), tracking `idByRef` and `kindByRef` as you create items, then loop the edge
list. This keeps the seed declarative and the policy guard trivial.

## Seed structure

`seedAccepted<Feature>Spec(db, projectId)` builds, in order:

1. **Grounding turns** — one `createTurn({ phase: 'grounding', impact, question, answer })`
   per substantive Q&A (no options/parts needed; the question card renders from
   `turn.*`). `advanceHead` after each. Capture supporting knowledge at the turn
   that elicits it (`linkKnowledgeItemToTurn(db, item.id, turnId, 'captured')`).
2. **Grounding closure** — a proposal turn (`serializeFixturePhaseProposalAssistantParts`,
   `question: ''`), `createPhaseOutcome`, a confirmation turn
   (`serializeFixturePhaseConfirmationUserParts`), `confirmPhaseOutcome`.
3. **Design turns + closure** — same shape, `phase: 'design'`.
4. **Requirements review** — one review turn carrying the candidate set
   (`serializeFixtureQuestionAssistantParts` + `createFixtureReviewQuestionInput`,
   `impact: 'high'`), accept it (`createOption` ×2 → `applyTurnResponseSelections([0])`
   → `updateTurn` with `serializeFixtureAcceptedReviewUserParts`), then create the
   `requirement` items (`'reviewed'` link), `createConfirmedPhaseOutcome`, `advanceHead`.
5. **Criteria review** — same shape, `phase: 'criteria'`, creating `criterion` items.
6. **Edges** — policy-guarded loop (above).

Capture supporting knowledge with a small helper keyed by a per-turn marker so
each goal/term/context/constraint/decision/assumption lands on the turn that
elicits it.

Put the seed in its own file `src/server/fixtures/scenarios/<name>.ts` (imports:
`../../db.js`, `../../knowledge-relationship-policy.js`, `../helpers.js`,
`@/shared/...`). Then in `src/server/fixtures/scenarios.ts` import it and add the
scenario to the `scenarios` record:

```ts
// scenarios.ts
import { seedAccepted<Feature>Spec } from './scenarios/<name>.js';

'<name>-all-phases-closed': (db, name = '<Feature> (all phases closed)') => {
  const project = createSpecification(db, name, { mode: 'brownfield' });
  seedAccepted<Feature>Spec(db, project.id);
  return project.id;
},
```

`publicScenarios` spreads `scenarios`, so the new scenario is automatically exposed
to `npm run seed`.

## Key APIs

- `src/server/db/intent-graph-store.ts`: `createKnowledgeItem(db, specId, kind, content, { subtype?, rationale? })`,
  `addKnowledgeRelationship(db, fromId, toId, relation)`, `linkKnowledgeItemToTurn(db, itemId, turnId, relation)`.
- `src/server/db/specification-store.ts`: `createSpecification(db, name, { mode })`.
- turn/phase (from `../db.js`): `createTurn`, `createOption`, `applyTurnResponseSelections`,
  `updateTurn`, `createPhaseOutcome`, `createConfirmedPhaseOutcome`, `confirmPhaseOutcome`, `advanceHead`.
- fixture part serializers (`./helpers.js`): `serializeFixtureQuestionAssistantParts`,
  `createFixtureReviewQuestionInput`, `serializeFixtureAcceptedReviewUserParts`,
  `serializeFixturePhaseProposalAssistantParts`, `serializeFixturePhaseConfirmationUserParts`.
- `code = createKnowledgeReferenceCode` for review-item reference codes.

## Turn impact rubric

`src/server/prompts/interviewer-grounding.md`: impact reflects *"how much the answer
shapes downstream choices."*

- `high` — strategic forks (greenfield/brownfield), the core goal, binding constraints.
- `medium` — scope narrowing, localized design choices.
- `low` — assumptions to validate later.

Read by `src/client/components/question-cards.tsx` as `turn.impact ?? 'low'`, so an
unset column shows "Low Impact". Avoid making everything `high` — the spread is the
signal. (Distinct from the `none|soft|hard` edit-impact tier in `edit-impact.ts`.)

## Load + delete-then-reseed

Re-seeding is additive (new spec row each run). To replace rather than duplicate,
delete the prior spec(s) for this feature first. Specs have no `ON DELETE CASCADE`
to `specification`, and `chat`↔`turn` is circular, so delete with FK off across the
spec-scoped tables in one session:

```bash
IDS=$(sqlite3 .brunch/brunch.db "SELECT id FROM specification WHERE name LIKE '<Feature>%';" | paste -sd, -)
sqlite3 .brunch/brunch.db <<SQL
PRAGMA foreign_keys=OFF;
DELETE FROM knowledge_edge WHERE from_item_id IN (SELECT id FROM knowledge_item WHERE specification_id IN ($IDS)) OR to_item_id IN (SELECT id FROM knowledge_item WHERE specification_id IN ($IDS));
DELETE FROM turn_knowledge_item WHERE item_id IN (SELECT id FROM knowledge_item WHERE specification_id IN ($IDS)) OR turn_id IN (SELECT id FROM turn WHERE specification_id IN ($IDS));
DELETE FROM option WHERE turn_id IN (SELECT id FROM turn WHERE specification_id IN ($IDS));
DELETE FROM annotation WHERE specification_id IN ($IDS);
DELETE FROM reconciliation_need WHERE specification_id IN ($IDS);
DELETE FROM phase_outcome WHERE specification_id IN ($IDS);
DELETE FROM knowledge_item WHERE specification_id IN ($IDS);
DELETE FROM turn WHERE specification_id IN ($IDS);
DELETE FROM chat WHERE specification_id IN ($IDS);
DELETE FROM specification WHERE id IN ($IDS);
PRAGMA foreign_keys=ON;
PRAGMA foreign_key_check;
SQL
npm run seed -- <name>-all-phases-closed
```

`PRAGMA foreign_key_check` should print nothing. Spec-scoped tables to clear:
`turn`, `knowledge_item`, `phase_outcome`, `annotation`, `chat`,
`reconciliation_need` (+ item-scoped `knowledge_edge`, `turn_knowledge_item`, and
turn-scoped `option`). Re-confirm the table list with:
`SELECT t.name FROM sqlite_master t JOIN pragma_table_info(t.name) c ON 1=1 WHERE t.type='table' AND c.name='specification_id';`

## In-memory verification template

Write to `scripts/_verify_<name>.ts`, run with `npx tsx`, then delete it.

```ts
import { createDb } from '@/server/db.js';
import { scenarios } from '@/server/fixtures/scenarios.js';
import * as schema from '@/server/schema.js';
import { eq } from 'drizzle-orm';

const db = createDb(); // in-memory, auto-migrated
const specId = scenarios['<name>-all-phases-closed']!(db);

const items = db.select().from(schema.knowledgeItem).where(eq(schema.knowledgeItem.specification_id, specId)).all();
const edges = db.select().from(schema.knowledgeEdge).all();
const byKind: Record<string, number> = {};
for (const i of items) byKind[i.kind] = (byKind[i.kind] ?? 0) + 1;
const byRelation: Record<string, number> = {};
for (const e of edges) byRelation[e.relation] = (byRelation[e.relation] ?? 0) + 1;
console.log('items', JSON.stringify(byKind), 'edges', JSON.stringify(byRelation));
// Assert the profile's stressors: e.g. verifies coverage, a 2-target criterion,
// non-buildable requirements with no verifies, zero req→req depends_on.
```
