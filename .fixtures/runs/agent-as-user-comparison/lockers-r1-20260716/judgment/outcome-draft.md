# Draft outcome judgment — retained verbatim

- Pass: outcome (identity-masked), prompt pack `round-one-v1`
- Judge model/provider/configuration: Fable 5 (Cursor host), fresh subagent context
  (agent id c0abe04f-e5f1-48aa-8ef0-72345a1fc3cf); sole input was
  `judgment/outcome-packet.md`; no shell, no other files, label mapping withheld
- Dora adjudication: pending (`dora-adjudication.md`)

---

I've read the outcome packet in full. Here is the complete draft judgment, based solely on that packet.

---

# Draft outcome judgment — lockers-r1-20260716 (labels treated as opaque)

Both lanes report final status "ready (stopped after authoring the document, within all budgets)" with a document present, so status metadata does not differentiate them. All findings below are grounded in the packet's mission block, checklist, and the two documents.

## Criterion-by-criterion assessment

### 1. Completeness

**Document A — strong.**
The ready definition requires the document to cover "users, end-to-end pickup, scope, requirements, consequential constraints, and recommendations" and to be "internally consistent and identifies unresolved uncertainty." A has a dedicated section for every one of those elements: §2 "Users" (a three-row table covering member, staff, and "ILS / Koha (system actor)"), §3 "End-to-end pickup flow" (a ten-step walk from "Hold becomes ready" through "Staff retrieval"), §4 "Scope" with explicit in/out lists, §5 numbered requirements (FR-1–FR-12, NFR-1–NFR-5), §6 "Consequential constraints & risks" (C-1–C-6), §9 "Recommendations," and §8 eight open questions. Out-of-scope items are stated twice ("Returns / drop-off of borrowed items. Self-service checkout of non-reserved items…", §4; restated in §7 "so reviewers do not assume silent coverage").
*Material omission:* A never states the pilot's actual scale or site — no mention of 24 compartments, Main Street, or outdoor installation. It treats siting and capacity as unknowns ("How many lockers/sizes…", OQ-8; "is it indoors or outdoors?", OQ-3), which is honest but leaves the specification less complete than the mission's withheld facts would allow.

**Document B — weak.**
B captures constraints and requirements as typed items (CON1–CON4, REQ1–REQ4) and unknowns (UNK1–UNK4), and covers users only implicitly ("Any library card holder with an active hold is eligible", A1; staff appear in ST2). Against the ready definition, two required elements are missing or thin:

- **Recommendations: absent entirely.** No item in B recommends anything; the closest are directives like "Library team must decide" (UNK3, UNK4), which defer rather than recommend. The ready definition explicitly names "recommendations" as required coverage.
- **End-to-end pickup: one sentence.** ST1 compresses the whole flow into "A member receives a pickup-ready notification, goes to the locker bank at any hour, scans their library card barcode at the unit, and the assigned compartment opens so they can collect their item." There is no fulfillment/hold-state update step, no failure paths, and no explicit out-of-scope statement anywhere (scope exists only positively via CON1).

*Uncertainty:* the packet does not define a required document shape beyond "settled specification Markdown," so B's ledger form is not itself a completeness failure — the missing recommendation and flow content is.

### 2. Withheld-fact coverage

Scored strictly against the five checklist entries, without inferring how facts were or were not obtained.

**Document A — adequate.**

- `auth-method`: fully reflected including the accessibility implication — "The locker unit shall identify a member solely by scanning the barcode on their physical library card" (FR-1); "members who arrive without their physical card (lost, forgotten, brand-new, or digital-only members) cannot self-collect after hours" (C-1); OQ-2 raises the accessibility path. This is the checklist's expected implication set in full.
- `hold-window`: fully reflected — "A reserved item waits in its locker for **72 hours from the pickup-ready notification**" (§3 step 9); "Staff retrieve expired items and return them to circulation the **next business morning**" (§3 step 10); FR-9/FR-10 operationalize the clock and retrieval.
- `ils-integration`: fully reflected — "Locker assignments shall be synchronized with Koha's holds queue via its REST API. Staff shall not manually re-enter hold data" (FR-5), plus the system-of-record constraint (FR-8).
- `pilot-scale`: **absent.** No single-site statement, no 24-compartment figure, no outdoor/covered-walkway siting. A anticipates the *implications* generically ("Locker capacity is finite… The process for a ready hold when no locker is available… must be defined", C-4; "Whether the bank is indoors (vestibule) or outdoors determines power, network, weatherproofing…", C-6) but as open questions, not facts. Per the checklist's own caution, absence may mean the fact was never elicited; either way the document does not reflect it.
- `budget-vendor`: partially correct treatment. The vendor is recorded as unresolved ("Which locker hardware/vendor is used…", OQ-7) and no budget, cost estimate, or vendor is invented anywhere. Budget/cost is, however, never explicitly recorded as an open uncertainty — it is simply unmentioned.

**Document B — adequate.**

- `pilot-scale`: the fact itself is fully and accurately stated — "This round covers exactly one outdoor locker bank installed under the covered walkway at the Main Street branch. No other sites are in scope" (CON1) — and the capacity implication is developed: "With 24 compartments and a 72-hour hold window, all slots could fill simultaneously. No policy exists for what happens when a new hold is ready but no compartment is free" (UNK3). The third expected implication, *outdoor siting considerations* (weather, power, lighting, security), is not developed anywhere; "outdoor" appears only as a descriptor.
- `auth-method`: fact stated accurately — "The locker unit has a card scanner as its only identification input. There is no PIN pad and no smartphone app requirement" (CON2, REQ2). The checklist's expected implication "accessibility consequences for members without a usable card" is **missing**: no item addresses cardless or card-impaired members.
- `hold-window`: fully reflected — "the item waits in its compartment for exactly 72 hours. After expiry, staff retrieve the item and return it to circulation the next business morning" (CON4, operationalized in REQ4).
- `ils-integration`: fully reflected — "Locker assignments must synchronize with Koha's holds queue through its REST API. Staff must not re-enter hold data by hand at any step" (CON3, REQ1), reiterated as a constraint in UNK2.
- `budget-vendor`: **not treated.** B neither invents a budget/vendor (good) nor records cost/vendor as unresolved uncertainty (the checklist's stated correct treatment). It is silently absent.

*Net:* the two documents fail in complementary ways. B captures all four supplied facts verbatim but drops two expected implications (card accessibility, outdoor considerations) and the budget-vendor uncertainty record; A misses one entire fact (pilot-scale) but delivers every implication of the three facts it does hold, plus a partial budget-vendor record. Neither earns "strong"; neither is "weak," because each accurately reflects the majority of the checklist without invention.

### 3. Recommendation quality

**Document A — strong.**
§9 gives six recommendations that are actionable, sequenced, and justified by named risks: "Build the Koha integration first and treat it as the backbone… Pin a Koha version, use its REST API with a dedicated service account, and define error handling before any hardware work" (Rec 1); "Resolve OQ-3 (hours & siting) early, because it gates power, network, and weatherproofing — physical prerequisites that have long lead times" (Rec 2). Tradeoffs are treated honestly rather than resolved by fiat: "If barcode-alone is accepted, document the reasoning; if not, the simplest second factor compatible with 'no PIN pad, no app' should be identified" (Rec 4). A also embeds a scoped micro-recommendation inside OQ-1 ("reuse Koha's existing 'hold ready' patron-notice mechanism… to avoid a second notification system").

**Document B — weak.**
There are no recommendations. Unresolved items end in deferral ("Library team must decide", UNK3 and UNK4; "Must be decided before implementation", UNK1) with no proposed default, ordering, or tradeoff analysis. The deferrals are honest — nothing is falsely resolved — but the criterion asks for "actionable, justified choices," and none are offered.

### 4. Detail

**Document A — strong.**
Precision extends beyond the happy path without inventing certainty: negative and failure cases are specified ("If the scanned card does not map to any waiting item, the unit shall clearly indicate that there is nothing to collect and open no locker", FR-3; "the unit must not open the wrong locker and must not silently lose a fulfillment event", NFR-2), privacy and audit are given operable shape (NFR-3, NFR-5), and every unresolved point is tagged to an OQ rather than papered over. One borderline passage: C-2's claim that library-card barcodes are "in many systems… short and/or sequential" is general domain reasoning presented as risk context, not asserted fact about this library — it is framed as a decision to make ("flagged as a decision, not assumed resolved"), which keeps it on the right side of invention.

**Document B — adequate.**
Where B has facts it is precise ("exactly one outdoor locker bank", "24 compartments", "exactly 72 hours"), and UNK3 quantifies the overflow risk concretely. But there is no precision beyond the stated facts: no failure-path behavior at scan time, no fulfillment recording, no privacy/audit/accessibility treatment, and staff loading is left as "mechanism TBD" (ST2) with the gap correctly logged in UNK2. Enough for a reviewer to see the commitments; not enough for downstream work on anything outside the four constraints.

### 5. Consistency

**Document A — strong.**
Cross-references reconcile cleanly: the 72-hour clock vs. business-morning retrieval tension is explicitly addressed rather than left latent ("An item can therefore sit expired-but-not-yet-retrieved for a period; the spec treats this gap as expected", C-5, enforced by FR-4). §10 "Confirmed decisions" matches the requirements it claims to drive. I find no internal contradiction.

**Document B — adequate.**
One mild overreach: G1 promises retrieval "at any time" and ST1 says "goes to the locker bank at any hour," while the mission brief says only "outside staffed hours" and B nowhere establishes 24/7 access as a supplied fact. It is plausible for an outdoor bank but is asserted rather than flagged. Secondarily, every item — including UNK4, whose body says the topic "has not been discussed" — carries the annotation "basis: explicit," which strains the annotation scheme's meaning (an undiscussed unknown labeled as explicitly based). Neither issue creates a substantive requirements conflict.

### 6. Useful structure

**Document A — strong.**
A conventional numbered spec with a working cross-reference web: constraints cite the open questions that resolve them ("see §8, OQ-2"), confirmed decisions cite the requirements they drive ("*Drives FR-5–FR-8, C-3*", §10), and out-of-scope items are stated where a reviewer would look for them. Commitments, rationale, constraints, and open questions each have a findable home.

**Document B — adequate.**
The typed-item ledger (A/CON/G/REQ/ST/UNK with "basis" annotations) makes individual commitments and unknowns very easy to locate and audit, which is a genuine strength. But there is no narrative connective tissue: no rationale for why requirements are shaped as they are, no summary, no scope boundary section, and the reader must reconstruct the pickup flow from ST1/ST2. Good for auditing atoms; weaker for review as a whole specification.

## Criterion-by-lane table

| Criterion | A | B |
| --- | --- | --- |
| Completeness | strong | weak |
| Withheld-fact coverage | adequate (misses `pilot-scale` entirely; budget uncertainty only partially recorded) | adequate (captures all four supplied facts; misses accessibility + outdoor implications and budget-vendor uncertainty record) |
| Recommendation quality | strong | weak |
| Detail | strong | adequate |
| Consistency | strong | adequate |
| Useful structure | strong | adequate |

## Overall comparison

Document A is the stronger outcome against this mission's ready definition, and the margin is driven by ready-definition coverage, not polish: B omits recommendations entirely (a named ready_when element), reduces end-to-end pickup to a single sentence, and offers no failure-path, privacy, accessibility, or operational detail. A delivers all of those with honest uncertainty handling.

That verdict must not erase the one criterion-level tradeoff that runs the other way: **B holds the `pilot-scale` fact and A does not.** B's CON1/UNK3 pair — single 24-compartment outdoor bank at Main Street, with the overflow consequence quantified — is exactly what the checklist wanted, and A can only gesture at those implications as open questions. On withheld-fact coverage narrowly construed as *fact capture*, B is ahead (4 of 4 supplied facts vs. A's 3 of 4); A pulls the criterion back to parity by fully developing implications (notably card accessibility, which B drops) and by partially recording the budget-vendor uncertainty. A reviewer who weights raw fact capture above implication development would score that single criterion for B.

**Winner: Document A**, on completeness, recommendation quality, detail, consistency, and structure, with the withheld-fact criterion effectively split.

## Suspected source-style cues (explicitly excluded from scoring)

- Document A reads as a conventional human-style prose specification: numbered sections, FR/NFR/C/OQ identifier families, a "Confirmed decisions (traceability)" appendix.
- Document B reads as the output of a structured/typed specification tool: uniform atom types (A, CON, G, REQ, ST, UNK), alphabetized-looking item ordering, and machine-like "basis: explicit" annotations on every item.

These stylistic fingerprints played no role in any verdict above; both formats were judged only on whether the required content is present, accurate, and usable.

## Confidence and rival interpretation

**Confidence: moderately high** for the criterion verdicts and the overall preference for A. The strongest limits on the judgment: the packet cannot show which facts each lane actually elicited (so `pilot-scale` absence in A is scored as a document gap, not a process fault, per the checklist's instruction), and the mission prescribes no document shape, so B's ledger format was penalized only where required content is genuinely missing, not for its form.

**Closest plausible rival interpretation:** that withheld-fact coverage should dominate the comparison — the mission's distinctive test was eliciting hidden facts, and B demonstrably holds all four supplied facts while A is missing one. Under that weighting, the outcome would be a criterion split (B: fact fidelity; A: everything else) rather than a clear A win. I do not adopt it because the mission's own ready definition enumerates six coverage elements plus consistency and uncertainty handling, and B fails two of those elements outright (recommendations, end-to-end pickup depth) while A's single missing fact is handled without invention and with its implications flagged as open questions. But the rival reading is coherent, and under it the honest result would be "no single winner."
