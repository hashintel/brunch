# Draft process judgment — retained verbatim

- Pass: process (unblinded), prompt pack `round-one-v1`
- Judge model/provider/configuration: Fable 5 (Cursor host), fresh subagent context
  (agent id 86d3d849-ec6a-4ac7-9b88-30ea39a56fae); sole input was
  `judgment/process-packet.md`; no shell, no other files, no final documents
- Dora adjudication: pending (`dora-adjudication.md`)

---

I've read the process packet in full, and only that file. Here is the complete draft process judgment.

---

# Draft process judgment — lockers-r1-20260716 (unblinded, process-only pass)

**Inputs used:** the supplied process packet only (public mission, matched budgets, reveal-condition identifiers, final lane status, declared interventions/validity notes, and the two normalized lane records). No target internals, hidden fact values beyond those visibly revealed in lane records, final documents, or Brunch-only diagnostics were consulted.

---

## Lane-by-lane assessment

### Brunch TUI (brunch-b2)

**Criterion 1 — question count and materiality: STRONG**

Observed conduct: the target asked questions in two visible rounds.

- Turn 1 (~18:17), a three-part grounding questionnaire: "(1) who uses the service, (2) end-to-end flow, (3) hard constraints (hardware/access, hold window, locations, offline, prior decisions)".
- Turn 2 (~18:21), "two consequential gaps: staff loading workflow; capacity overflow policy".

That is five distinct visible asks. Materiality by item: Q2 and Q3 were highly material — the ledger shows they unlocked `ils-integration` and `pilot-scale` + `auth-method` + `hold-window` respectively, each of which plausibly changes the specification's integration design, deployment shape, unlock flow, and expiry behavior. The turn-2 questions (staff loading, capacity overflow) match no withheld fact but are operationally consequential for a locker spec; the actor's response ("both undecided, record as open uncertainty") confirms they probed genuinely open ground. The weak spot is Q1 ("who uses the service"), which the actor answered with a "public-brief restatement" — the brief already says "library members collect reserved books," so this sub-question had low marginal materiality.

Inference (marked as such): I infer materiality from the reveal-condition mapping and the mission's ready criteria; I cannot verify from the packet how much each fact actually altered the final document, since documents are out of scope for this pass.

Uncertainty: the exact wording of the target's questions is paraphrased in the normalized table; I am trusting the normalizer's qualification calls.

**Criterion 2 — non-inferable-fact seeking: STRONG**

Observed conduct: the target's questions hit 4 of the 5 reveal conditions (`ils-integration`, `pilot-scale`, `auth-method`, `hold-window`) — all information absent from the public brief and not cheaply inferable. The turn-2 questions (staff loading workflow, capacity overflow) also sought consequential non-brief information even though no withheld fact existed for them, and the target correctly received them as non-answers.

Gap: the target never asked a `budget-vendor`-matching question (budget, cost ceiling, procurement, vendor), so that condition's designed non-answer was never triggered. Q1 of the grounding questionnaire re-asked material already in the brief.

Inference: hitting 4/5 conditions with one grounding questionnaire suggests systematic constraint-elicitation rather than luck, but the packet cannot show whether this was product scaffolding (a fixed grounding template) or mission-specific reasoning. The verdict does not depend on which it was — the prompt judges visible process, and the visible process sought the right things.

**Criterion 3 — budget use: ADEQUATE (with a normalization caveat)**

Observed conduct and ledger rows: `target_turns: 5/8`; `elapsed_minutes: ~12.5/20`; `mechanical_interventions: 0 takeovers; all actor inputs were policy actions`. Turn and time budgets were used efficiently and comfortably obeyed.

The qualifying-questions line is the complication: "4 facts revealed against a budget of 3 … all four were direct matches to one three-part grounding question the target asked unprompted; no compound-question gaming by the target." Nominally the fact yield exceeded the 3-question budget. The packet declares this as an actor/normalization treatment ("a question matching multiple conditions receives all matched facts") applied identically to both lanes, and explicitly clears the target of gaming. I treat this as: the target's conduct was compliant (it asked one questionnaire, not four questions), but the lane's information intake was budget-inflated by the crediting rule, not by target discipline. That is a validity limitation, not a conduct violation — hence adequate rather than strong.

**Criterion 4 — readiness behavior: STRONG (with one attribution caveat)**

Observed conduct:

- Uncertainty handled honestly: non-answers recorded as open ("offline recorded open"; staff loading and overflow "both undecided, record as open uncertainty"), and the settlement report enumerates "16 committed nodes (goal, stories, constraints, requirements, assumption, four open unknowns) + four blocker recommendations."
- Stopping discipline: after the actor's Confirm and "No changes.", the target settled at turn 5 of 8 with time remaining — no premature stop (it had first closed the major fact gaps) and no endless iteration.
- Recovery: the turn-4 internal `TOOL_INPUT_INVALID` ×2 was self-recovered with no intervention debit.

Attribution caveat on "authored the named document": the ready artifact was acquired by the **actor** at 18:29 via `npm run dev-cli -- document-export … --out <ephemeral-workspace>/locker-pickup-spec.md` "from settled graph state," after the session was killed. The target authored the settled content but did not itself visibly write `locker-pickup-spec.md`; the packet frames the export as a "frozen acquisition seam" (a product-architecture normalization). Under that declared seam I still score readiness strong, but I note the evidence for the "authored the named document" sub-criterion is mediated in this lane in a way it is not in the Claude lane.

---

### Claude Code CLI (claude-c5)

**Criterion 1 — question count and materiality: ADEQUATE**

Observed conduct: one visible elicitation round only — at ~18:53 the target "announces question-budget strategy, opens 3-part structured form: (1) unlock method, (2) ILS integration, (3) first-version scope." Q1 and Q2 were material (matched `auth-method` and `ils-integration`; both plausibly change the spec's unlock flow and integration design). Q3 ("first-version scope") "matches no reveal fact," and the actor's answer was "pickup-of-holds-only scope (restating public brief)" — the brief already limits the service to collecting reserved books, so this question had low marginal materiality.

The count itself is compliant (3 questions against a budget of 3, asked in one turn), but one of the three slots was spent on largely inferable ground, and the target asked nothing further in its remaining 4+ turns.

Inference: the announced "question-budget strategy" indicates the single-form design was deliberate front-loading under the cap, not an oversight. That is a reasonable strategy; the cost was concrete — see criterion 2.

**Criterion 2 — non-inferable-fact seeking: ADEQUATE**

Observed conduct: 2 of 3 questions sought consequential non-brief facts and earned reveals (`auth-method`, `ils-integration`). Never asked: anything matching `pilot-scale` ("never revealed (no matching question asked)" per the ledger), `hold-window`, or `budget-vendor`. `hold-window` arrived anyway, but only by declared actor error: "72h hold window volunteered without a matching question — see validity note."

So the target's own seeking covered 2/5 reveal conditions versus Brunch's 4/5. Partially offsetting this, the target's stop report shows it *knew* what it lacked: it "enumerates what it deliberately did not guess (notification channel, cardless members, barcode strength, siting/offline/capacity)" — siting/capacity is exactly the `pilot-scale` territory it never asked about. Recognizing a gap and declaring it is honest, but the criterion asks whether questions *sought* the information; with 5 unused questions-worth of turns remaining, it did not.

Uncertainty: I cannot tell from the packet whether the target believed its question budget was exhausted after the form (3/3 used) and therefore treated further asking as prohibited. If it did, not asking about pilot-scale was rule-obedience, not passivity. The packet does not record the target's understanding of the budget state after the mishap-plus-recovery.

**Criterion 3 — budget use: STRONG (target conduct); the lane's one intervention debit is actor-caused**

Ledger rows: `target_turns: 4/8`; `elapsed_minutes: ~11/20`; `qualifying_questions: 2 matched reveals + 1 volunteered by actor error`; `mechanical_interventions: 1 (form-widget decline mishap + free-text recovery); 0 substantive takeovers`.

Observed conduct: the target's own budget behavior was exemplary — it explicitly announced a budget strategy, spent exactly its 3 nominal questions in one efficient turn, drafted, wrote, and stopped at 4/8 turns and ~11/20 minutes. The single mechanical intervention was consumed by the *actor's* "form navigation … registers as 'User declined to answer questions'" mishap and recovery; the packet attributes it to "actor input error on the form widget; no content supplied." No debit reflects target misconduct. All budgets obeyed.

**Criterion 4 — readiness behavior: STRONG**

Observed conduct:

- The target authored the named document itself, in its own working directory: "target writes `locker-pickup-spec.md` (13371 bytes)" at ~19:01, after asking permission at ~18:59–19:01 (approved by named key).
- It stopped exactly per the ready rule: "reports stop per mission ready rule" — no premature stop (it had its answers in hand) and no post-write iteration.
- Uncertainty handled honestly at the visible level: the enumerated did-not-guess list (notification channel, cardless members, barcode strength, siting/offline/capacity) directly satisfies the mission rule "Treat non-answers as uncertainty, not permission to invent" — at least in its visible reporting.

Caveat carried over from criterion 2: "sought enough information" is the softest element of this verdict. The target proceeded to ready with one designed reveal condition never probed. It compensated by declaring the gap rather than inventing, which is the honest half of readiness; the seeking half is weaker. I hold the overall verdict at strong because the stopping and authorship evidence is unambiguous and the mission's `ready_when` explicitly permits identified unresolved uncertainty.

One resilience note in the target's favor: after visibly receiving "User declined to answer questions" on its only elicitation attempt, the target did not invent answers or spiral; the interaction recovered cleanly once the actor pasted the free-text answer.

---

### Cursor CLI

**All four criteria: NOT ASSESSABLE.** Final lane status: "skipped (best-effort lane; CLI binary broken/uninstalled; no attempt launched)." There is no visible interaction to judge. This is an environment outcome, not target conduct, and should not be read as a process failure of the product.

---

## Criterion-by-lane table

| Criterion | Brunch TUI (brunch-b2) | Claude Code CLI (claude-c5) | Cursor CLI |
|---|---|---|---|
| Question count & materiality | **Strong** — 5 asks over 2 rounds; grounding Q2/Q3 unlocked 4 facts ("Q2 matches `ils-integration`; Q3 matches `pilot-scale` + `auth-method` + `hold-window`"); turn-2 "staff loading workflow; capacity overflow policy" probed consequential open ground. Weak spot: Q1 answered by "public-brief restatement." | **Adequate** — one 3-part form; Q1/Q2 material ("Q1 matches `auth-method`; Q2 matches `ils-integration`"); Q3 "first-version scope … matches no reveal fact," answered by "restating public brief." | Not assessable — "no attempt launched" |
| Non-inferable-fact seeking | **Strong** — own questions hit 4/5 reveal conditions; plus two consequential no-fact probes taken as non-answers. Missed: `budget-vendor`. | **Adequate** — own questions hit 2/5 conditions; `pilot-scale` "never revealed (no matching question asked)"; `hold-window` arrived only as actor error ("volunteered without a matching question"); `budget-vendor` never probed. Gap partly acknowledged in the did-not-guess list. | Not assessable |
| Budget use | **Adequate** — 5/8 turns, ~12.5/20 min, "0 takeovers"; but "4 facts revealed against a budget of 3" via compound-question crediting (declared normalization; "no compound-question gaming by the target"). | **Strong** (target conduct) — announced budget strategy; 4/8 turns, ~11/20 min; the lane's 1/1 mechanical intervention was "actor input error on the form widget," not target conduct. | Not assessable |
| Readiness behavior | **Strong** — non-answers recorded open; settlement "16 committed nodes … four open unknowns + four blocker recommendations"; stopped at turn 5 with budget remaining. Caveat: named document produced by actor-run export seam post-kill ("frozen acquisition seam"), not a visible target write. | **Strong** — "target writes `locker-pickup-spec.md` (13371 bytes)," "reports stop per mission ready rule," "enumerates what it deliberately did not guess." Soft spot: proceeded to ready with `pilot-scale` never probed. | Not assessable |

---

## Notable process tradeoffs (not converted to an outcome score)

- **Iterative grounding vs single-shot form.** Brunch spent more turns (5 vs 4) on a two-round elicitation that swept more reveal conditions and surfaced two extra open uncertainties; Claude front-loaded one form and converted to a document fast. The Brunch style extracts more; the Claude style finishes sooner and spends fewer interaction risks. Neither is inherently better process — they trade information coverage against interaction economy.
- **Question-slot allocation.** Claude spent one of three capped slots on a scope question the brief already answered; Brunch spent one grounding sub-question the same way ("who uses the service"). The symmetric lesson: both products used part of their scarce elicitation on confirmation rather than discovery, but Brunch's remaining asks covered more withheld ground.
- **Where the named document comes from.** Claude's ready artifact is a visible in-session target write; Brunch's is an actor-run export from settled graph state. Both are declared-valid under the packet's seams, but they produce asymmetric direct evidence for the "authored the named document" sub-criterion.
- **Widget-heavy vs free-text interaction.** Both lanes had one interaction-surface incident (Brunch: internal `TOOL_INPUT_INVALID` ×2, self-recovered at no cost; Claude: form-widget navigation registering as a decline, costing the lane's one mechanical intervention). Structured UI surfaces created friction in both lanes; only in the Claude lane did it consume budget, and there by actor error.

---

## Validity concerns and likely effect

1. **Compound-question crediting (Brunch).** "4 facts revealed against a budget of 3" via one three-part question, under a declared rule that a multi-matching question receives all matched facts. Likely effect: inflates Brunch's apparent fact-seeking superiority. The treatment was declared identical for both lanes, but it only *benefited* Brunch, because Claude's third form item happened not to match any condition. My criterion-2 gap (4/5 vs 2/5) would narrow — though not close — under a stricter one-fact-per-question rule.
2. **Volunteered `hold-window` fact (Claude).** Actor error injected a withheld fact without a matching question. Likely effect on *this* pass: it removes the chance to observe whether Claude would eventually have asked, slightly depressing our ability to assess its fact-seeking ceiling; it does not credit Claude's process. (It would matter more in a document-quality pass, which this is not.)
3. **Mishap perturbation (Claude).** The target visibly received "User declined to answer questions" before the recovery. Likely effect: unknown but plausibly strategy-altering — a target told its questions were declined may become more conservative about asking again, which bears directly on why it never probed `pilot-scale`. This is my largest uncertainty about the Claude criterion-2 verdict.
4. **Attempt-selection asymmetry.** brunch-b1 was budget-exhausted "by actor observation error before any question was answered"; claude-c1–c4 were "launch/auth-environment failures with no logged-in mission exchange." Both retained and declared. Likely effect: minimal for process judgment of the valid attempts, but both lanes' judged attempts are survivors of harness failures, so per-lane single-attempt evidence is thin.
5. **Single sequential controller session.** Declared "no cross-lane content carryover," but actor learning effects (e.g., improved answer phrasing in the second-run lane) cannot be excluded. The packet does not state which lane ran first; timestamps (Brunch ~18:16, Claude ~18:52) suggest Brunch first, so any actor-practice effect would favor Claude.
6. **Normalization opacity.** Question wording is paraphrased and qualification calls are the normalizer's; times are approximate (~). Likely effect: small, but all materiality judgments above inherit the normalizer's matching decisions.
7. **Cursor lane absent.** Any comparative claim covers two lanes only.

---

## Confidence and closest rival interpretation

**Confidence: moderate-to-high** on the within-lane verdicts (the ledger rows and quoted events are internally consistent and the declared interventions are specific); **moderate** on any cross-lane contrast, because the two largest evidentiary asymmetries — compound-question crediting and the form-widget mishap — both push in the same direction (flattering Brunch's elicitation breadth, muting Claude's).

**Closest plausible rival interpretation:** Claude's process was near-parity with Brunch's, not a step behind. Under this reading, Claude's single 3-part form was the *optimal* play against a hard 3-question cap (announce strategy, spend all slots at once, convert immediately), its failure to probe `pilot-scale` was rational budget-obedience after visibly spending 3/3 questions — possibly reinforced by the "User declined" signal — and Brunch's 4-fact haul reflects a lenient crediting rule applied to a product whose grounding questionnaire is standing scaffolding rather than mission-specific judgment. If that interpretation is right, Brunch's criterion-2 verdict softens toward adequate and the lanes are best described as two disciplined, budget-respecting processes with different elicitation shapes rather than a strong/adequate split. I do not adopt it as primary because the packet shows Brunch *also* asked two consequential follow-ups beyond its questionnaire (staff loading, capacity overflow) — evidence of mission-specific gap-seeking that the scaffolding explanation does not cover — but it is the reading I would test first with additional attempts per lane.
