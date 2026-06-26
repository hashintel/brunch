import type { EdgeRelation } from '@/shared/api-types.js';
import { createKnowledgeReferenceCode, type KnowledgeKind } from '@/shared/knowledge.js';

import {
  addKnowledgeRelationship,
  advanceHead,
  applyTurnResponseSelections,
  confirmPhaseOutcome,
  createConfirmedPhaseOutcome,
  createKnowledgeItem,
  createOption,
  createPhaseOutcome,
  createTurn,
  linkKnowledgeItemToTurn,
  updateTurn,
  type DB,
} from '../../db.js';
import { supportsKnowledgeRelationship } from '../../knowledge-relationship-policy.js';
import {
  createFixtureReviewQuestionInput,
  serializeFixtureAcceptedReviewUserParts,
  serializeFixturePhaseConfirmationUserParts,
  serializeFixturePhaseProposalAssistantParts,
  serializeFixtureQuestionAssistantParts,
} from '../helpers.js';

const code = createKnowledgeReferenceCode;

// ---------------------------------------------------------------------------
// brunch-meta-spec — the self-referential "huge graph": the whole Brunch v2
// product spec (memory/SPEC.md + PLAN.md) seeded as ONE completed-spec intent
// graph. Source-of-truth: memory/SPEC.md.
//
// This dogfoods the workspace/graph UI against a realistically large graph:
//   - 6 goals, ~22 lexicon terms, 6 context facts, 8 constraints/non-goals,
//     ~21 decisions, ~12 assumptions  (the durable exploration ontology),
//   - all 51 capability requirements (the buildable spine),
//   - all 23 acceptance criteria,
//   - typed edges: criterion --verifies--> requirement (the SPEC's own AC set),
//     constraint --constrains--> requirement, decision/assumption --depends_on-->
//     requirement, a few derived_from provenance edges, and two adversarial
//     req->req `refines` edges that any ordering read must ignore.
//
// Fidelity note: graph fidelity is faithful to SPEC.md; the interview transcript
// is folded into a believable, compact set of phase turns (supporting knowledge
// is captured grouped by topic rather than one item per turn). The 23 acceptance
// criteria are the SPEC's real AC list, so orchestrator/agent-substrate
// requirements that the AC list does not cover carry no `verifies` edge — this
// is faithful, not an omission.
// ---------------------------------------------------------------------------

type CaptureMarker =
  | 'g-novelty'
  | 'g-goal'
  | 'g-terms'
  | 'g-context'
  | 'g-constraints'
  | 'd-workflow'
  | 'd-graph'
  | 'd-provider'
  | 'd-orchestrator'
  | 'd-agent';

interface KSpec {
  ref: string;
  kind: KnowledgeKind;
  content: string;
  subtype?: string;
  rationale?: string;
  capturedAt?: CaptureMarker;
}

// --- Supporting knowledge (durable exploration ontology) -------------------

const goals: readonly KSpec[] = [
  {
    ref: 'G1',
    kind: 'goal',
    capturedAt: 'g-goal',
    content:
      'Turn natural-language goals into structured specifications through an AI-guided four-phase interview: grounding, design, requirements, criteria.',
  },
  {
    ref: 'G2',
    kind: 'goal',
    capturedAt: 'g-goal',
    content:
      'Preserve meaning first: the durable source artifact is an intent spec (commitments, correctness properties, examples, assumptions, accepted evidence, unresolved ambiguity) — a calibrated handoff, not fake closure.',
  },
  {
    ref: 'G3',
    kind: 'goal',
    capturedAt: 'g-goal',
    content:
      'Keep the accumulated intent graph and readiness state visible throughout the interview so the user always sees what has been captured.',
  },
  {
    ref: 'G4',
    kind: 'goal',
    capturedAt: 'g-goal',
    content:
      'Operate locally inside a cwd-backed workspace with user-supplied provider keys and no hosted inference account.',
  },
  {
    ref: 'G5',
    kind: 'goal',
    capturedAt: 'g-goal',
    content:
      'Support greenfield elicitation-first and brownfield analysis-first work, at both whole-product and partial-scope granularity.',
  },
  {
    ref: 'G6',
    kind: 'goal',
    capturedAt: 'g-goal',
    content:
      'Drive a completed spec toward a built artifact through an autonomous cook orchestrator that projects execution back onto the intent graph.',
  },
];

const terms: readonly KSpec[] = [
  {
    ref: 'T1',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'workspace — the cwd-backed software context whose local .brunch/ stores specifications and runtime state.',
  },
  {
    ref: 'T2',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'specification — one elicitation run within a workspace; the canonical term for what older code calls a project.',
  },
  {
    ref: 'T3',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'intent graph — the canonical semantic substrate: typed intent items, intent edges, examples, validation status, and semantic mutation state.',
  },
  {
    ref: 'T4',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'intent item — one durable typed semantic unit in the intent graph (persisted today as knowledge_item).',
  },
  {
    ref: 'T5',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'intent edge — one durable typed semantic relation between intent items (persisted today as knowledge_edge).',
  },
  {
    ref: 'T6',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'reconciliation need — durable process debt saying existing intent truth may need renewed judgment because related truth changed. Not an intent edge.',
  },
  {
    ref: 'T7',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'chat — a conversation container inside one specification; interview, side, reconciliation, qa, and strategy chats own turns without owning semantic truth directly.',
  },
  {
    ref: 'T8',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'secondary chat — a non-primary chat rendered inline inside the workspace; a runtime use of chat, not a separate thread table.',
  },
  {
    ref: 'T9',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'turn — one persisted authored conversational interaction with typed offer/reply parts and parent linkage.',
  },
  {
    ref: 'T10',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'frontier turn — the single actionable durable conversational turn currently awaiting user completion.',
  },
  {
    ref: 'T11',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'proposal turn — an assistant/system-first frontier turn offering a candidate bundle or action; not semantic truth until accepted.',
  },
  {
    ref: 'T12',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'preface card — a turn-internal artifact presenting provisional context from context gathering, paired with a question card and captured only as part of the whole turn.',
  },
  {
    ref: 'T13',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'review set — a synthesized candidate requirements or criteria list with stable reference codes and per-item / full-set review actions.',
  },
  {
    ref: 'T14',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'phase outcome — the durable closure artifact for a phase, including summary text and closure basis.',
  },
  {
    ref: 'T15',
    kind: 'term',
    capturedAt: 'g-terms',
    content: 'closeability — the deterministic minimum bar for whether the user may close a phase now.',
  },
  {
    ref: 'T16',
    kind: 'term',
    capturedAt: 'g-terms',
    content: 'readiness band — a coarse descriptive signal separate from closeability.',
  },
  {
    ref: 'T17',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'exploration knowledge — durable grounding/design knowledge: goal, term, context, constraint, decision, and assumption.',
  },
  {
    ref: 'T18',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'context pack — a scenario-specific semantic briefing derived from intent graph truth, workflow state, provenance, unresolvedness, and relation neighborhoods.',
  },
  {
    ref: 'T19',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'AI runtime provider — the shared server seam resolving configured LLM provider, model names, API-key source, and provider options.',
  },
  {
    ref: 'T20',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'orchestrator — the CLI execution engine (brunch cook) that takes a plan YAML and drives it to completion via agent dispatch and deterministic verification.',
  },
  {
    ref: 'T21',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'engine — an implementation of the Orchestrator interface; two exist: proc (procedural state machine) and petri (Petri-net interpreter).',
  },
  {
    ref: 'T22',
    kind: 'term',
    capturedAt: 'g-terms',
    content:
      'report — one structured event line in reports.jsonl; carries durable content while net tokens carry only pointers.',
  },
];

const contexts: readonly KSpec[] = [
  {
    ref: 'X1',
    kind: 'context',
    capturedAt: 'g-novelty',
    content:
      'Anthropic direct is the current runtime; Brunch stays user-supplied-key with no hosted inference account for now.',
  },
  {
    ref: 'X2',
    kind: 'context',
    capturedAt: 'g-context',
    content:
      'Current persistence uses chat + turn; a schema-level thread table is deferred until chat/turn proves insufficient.',
  },
  {
    ref: 'X3',
    kind: 'context',
    capturedAt: 'g-context',
    content:
      'The implementation still persists knowledge_item / knowledge_edge for intent item / intent edge during the vocabulary transition.',
  },
  {
    ref: 'X4',
    kind: 'context',
    capturedAt: 'g-novelty',
    content:
      'Brunch is pre-release; optimize for conceptual correctness and domain clarity over backward compatibility with existing local/dev data.',
  },
  {
    ref: 'X5',
    kind: 'context',
    capturedAt: 'g-context',
    content:
      'Two cook engines (proc, petri) implement the same Orchestrator interface behind a shared seam and must pass the same contract test suite.',
  },
  {
    ref: 'X6',
    kind: 'context',
    capturedAt: 'g-context',
    content:
      'reports.jsonl is the append-only durable source log for a cook run; exec-progress.json is a pure idempotent projection over it.',
  },
];

const constraints: readonly KSpec[] = [
  {
    ref: 'K1',
    kind: 'constraint',
    capturedAt: 'g-constraints',
    content:
      'Anthropic direct is the current runtime; Brunch remains user-supplied-key / no hosted inference account (provider work may add OpenRouter or neutral routing later).',
  },
  {
    ref: 'K2',
    kind: 'constraint',
    subtype: 'non-goal',
    capturedAt: 'g-constraints',
    content: 'No collaborative editing.',
  },
  {
    ref: 'K3',
    kind: 'constraint',
    subtype: 'non-goal',
    capturedAt: 'g-constraints',
    content: 'No explicit document-ingestion UX in V1.',
  },
  {
    ref: 'K4',
    kind: 'constraint',
    subtype: 'non-goal',
    capturedAt: 'g-constraints',
    content:
      'No hard turn-tree branching UX in V1; refinement and revisit operate through graph edit mode, multi-chat, and reconciliation surfaces.',
  },
  {
    ref: 'K5',
    kind: 'constraint',
    subtype: 'non-goal',
    capturedAt: 'g-constraints',
    content: 'No automatic cascade deletion; downstream effects are surfaced and re-resolved explicitly.',
  },
  {
    ref: 'K6',
    kind: 'constraint',
    subtype: 'non-goal',
    capturedAt: 'g-constraints',
    content:
      'No task-planning or downstream execution-management surface in V1; Brunch elicits specs and stops at the handoff/export boundary.',
  },
  {
    ref: 'K7',
    kind: 'constraint',
    subtype: 'non-goal',
    capturedAt: 'g-constraints',
    content:
      'No general-purpose inline document editor in review phases; requirements and criteria review stay recommendation-led with lightweight comments.',
  },
  {
    ref: 'K8',
    kind: 'constraint',
    subtype: 'non-goal',
    capturedAt: 'g-constraints',
    content:
      'No offline-first or multi-tab sync layer; the system stays server-authoritative and local-first.',
  },
];

const decisions: readonly KSpec[] = [
  {
    ref: 'D22',
    kind: 'decision',
    capturedAt: 'd-workflow',
    content:
      'Observer-result sync is turn-owned and background by default; chat stream completion must not wait on extraction.',
    rationale: 'Keeps the conversation responsive while extraction runs behind a turn-owned backlog.',
  },
  {
    ref: 'D65',
    kind: 'decision',
    capturedAt: 'd-workflow',
    content:
      'Phase outcomes are explicit durable records; workflow status, closeability, readiness, and closure provenance project from them on the active path.',
  },
  {
    ref: 'D66',
    kind: 'decision',
    capturedAt: 'd-workflow',
    content:
      'Interviewer-recommended and user-forced closes share one transcript-friendly phase-close seam with explicit closure basis.',
  },
  {
    ref: 'D86',
    kind: 'decision',
    capturedAt: 'd-workflow',
    content:
      'The client is organized by phase-addressable routing and three concentric layout shells: AppLayout, SpecificationWorkspaceLayout, ViewLayout.',
  },
  {
    ref: 'D110',
    kind: 'decision',
    capturedAt: 'd-workflow',
    content:
      'The workspace stream is a merged read model: active-path durable turns are the lineage spine; control/activity/phase elements derive from workflow state.',
  },
  {
    ref: 'D124',
    kind: 'decision',
    capturedAt: 'd-workflow',
    content:
      'Interview framing is two-axis: orientation uses workspace novelty (greenfield/brownfield) and delivery posture (end-to-end/incremental).',
  },
  {
    ref: 'D50',
    kind: 'decision',
    capturedAt: 'd-graph',
    content:
      'Knowledge relationships live behind one typed graph seam; persisted graph edges are first-class and drive dependency, derivation, and revisit behavior.',
  },
  {
    ref: 'D80',
    kind: 'decision',
    capturedAt: 'd-graph',
    content:
      'Intent-graph revisit replaces hard turn-tree branching for V1; revisit starts from graph edit surfaces and resolves cascades through reconciliation flows.',
  },
  {
    ref: 'D125',
    kind: 'decision',
    capturedAt: 'd-graph',
    content:
      'Observer capture is a prompt-budgeted graph-delta seam: per-kind item collections plus relationship candidates validated by the server through relation policy.',
  },
  {
    ref: 'D128',
    kind: 'decision',
    capturedAt: 'd-graph',
    content:
      'Graph view becomes an actionable workspace mode through a projection-first, intent-emitting seam; it owns only ephemeral graph-local interaction.',
  },
  {
    ref: 'D134',
    kind: 'decision',
    capturedAt: 'd-graph',
    content:
      'Brunch specs evolve toward recognition-first intent graphs with progressive checkability: typed items, semantic edges, examples, witnesses, validation status.',
  },
  {
    ref: 'D135',
    kind: 'decision',
    capturedAt: 'd-graph',
    content:
      'Semantic mutation history splits from conversational turn history when graph editing becomes first-class; future changesets record semantic mutation history.',
  },
  {
    ref: 'D130',
    kind: 'decision',
    capturedAt: 'd-provider',
    content:
      'First-run setup becomes a product surface, not README-only configuration; dashboard/provider setup replaces project .env docs as the user-facing path.',
  },
  {
    ref: 'D131',
    kind: 'decision',
    capturedAt: 'd-provider',
    content:
      'Provider access moves behind one AI runtime provider seam; interviewer and observer construction consume a shared provider/model resolver.',
  },
  {
    ref: 'D132',
    kind: 'decision',
    capturedAt: 'd-provider',
    content:
      'UI-entered credentials are user-scoped auth state: keys go to XDG-compliant user auth/config, not .brunch/ or project .env by default.',
  },
  {
    ref: 'D133',
    kind: 'decision',
    capturedAt: 'd-provider',
    content:
      '.brunch/ gitignore support is confirm-gated deterministic workspace mutation: previewable, idempotent, and user-confirmed.',
  },
  {
    ref: 'D139',
    kind: 'decision',
    capturedAt: 'd-agent',
    content:
      'The prompt/context scenario substrate is a first-class foundation: prompts/doctrines are markdown assets and context packs are typed server builders.',
  },
  {
    ref: 'D143',
    kind: 'decision',
    capturedAt: 'd-agent',
    content:
      'Brunch owns the agent mutation surface; agent-originated writes route through Brunch-owned mutation handlers and harnesses adapt it as tools.',
  },
  {
    ref: 'D155',
    kind: 'decision',
    capturedAt: 'd-orchestrator',
    content:
      'Dual-engine experiment behind a shared Orchestrator seam: proc and petri implement the same interface to validate whether the Petri substrate earns its complexity.',
  },
  {
    ref: 'D156',
    kind: 'decision',
    capturedAt: 'd-orchestrator',
    content:
      'reports.jsonl is the communication medium, not just an audit log: tokens carry only pointers and transitions communicate by appending/reading lines.',
  },
  {
    ref: 'D164',
    kind: 'decision',
    capturedAt: 'd-orchestrator',
    content:
      'Greenfield/brownfield is spec-derived plan truth, not plan location: the emitted plan.yaml carries mode from specification.mode and cook reads it to choose the worktree strategy.',
  },
  {
    ref: 'D172',
    kind: 'decision',
    capturedAt: 'd-orchestrator',
    content:
      'Execution progress is a durable spec-keyed snapshot (exec-progress.json), derived not logged: a pure projection over plan provenance + reports.jsonl + the result.',
  },
];

const assumptions: readonly KSpec[] = [
  {
    ref: 'A65',
    kind: 'assumption',
    capturedAt: 'd-workflow',
    content:
      'The interviewer can adapt usefully across the full greenfield<>brownfield by end-to-end<>incremental matrix without making kickoff feel bureaucratic.',
  },
  {
    ref: 'A66',
    kind: 'assumption',
    capturedAt: 'd-graph',
    content:
      'Relation-first observer capture will improve revisit, export grounding, and graph-view utility without flooding the graph with speculative edges.',
  },
  {
    ref: 'A67',
    kind: 'assumption',
    capturedAt: 'd-workflow',
    content:
      'Tired/rushed/under-informed users converge faster by reacting to synthesized candidate directions than by continuing a long direct interview.',
  },
  {
    ref: 'A68',
    kind: 'assumption',
    capturedAt: 'd-workflow',
    content:
      'Broad-pass interviewing followed by explicit deepen-detail actions preserves coherence better than a single depth-first drill-down.',
  },
  {
    ref: 'A69',
    kind: 'assumption',
    capturedAt: 'd-graph',
    content:
      'A graph-centric refinement surface can launch side-chats without splitting durable specification truth.',
  },
  {
    ref: 'A75',
    kind: 'assumption',
    capturedAt: 'd-provider',
    content:
      'XDG-compliant user-scoped auth/config storage is acceptable for UI-entered API keys and safer than writing secrets to the project workspace.',
  },
  {
    ref: 'A76',
    kind: 'assumption',
    capturedAt: 'd-provider',
    content:
      'Users will accept Brunch editing .gitignore when the action is explicit, previewable, and idempotent.',
  },
  {
    ref: 'A89',
    kind: 'assumption',
    capturedAt: 'd-agent',
    content:
      'A long-lived local JSONL agent capability CLI can drive the real Brunch interview flow well enough for external LLM-as-user probes to produce credible fixtures.',
  },
  {
    ref: 'A94',
    kind: 'assumption',
    capturedAt: 'd-graph',
    content:
      'Durable secondary chats can replace independent side-chat persistence while preserving reloadable side/reconciliation/qa/strategy chats without a thread table yet.',
  },
  {
    ref: 'A95',
    kind: 'assumption',
    capturedAt: 'd-graph',
    content:
      'Transcript-first context with explicit context snapshots on turns plus active graph-item handles keeps secondary chats useful across multi-chat item changes.',
  },
  {
    ref: 'A97',
    kind: 'assumption',
    capturedAt: 'd-orchestrator',
    content:
      'A completed intent graph can be projected and planned into a valid brunch cook plan.yaml, with execution-order deps coming from an LLM pass plus deterministic reconciliation, not a graph read.',
  },
  {
    ref: 'A102',
    kind: 'assumption',
    capturedAt: 'd-orchestrator',
    content:
      'Requirement-level lifecycle status, with acceptance criteria reported structurally only (coverage, not per-criterion pass/fail), is legible enough for a v1 spec-execution-progress UI.',
  },
];

// --- Requirements (the buildable spine: SPEC capability requirements) ------

const requirements: readonly KSpec[] = [
  // Runtime & persistence
  {
    ref: 'R1',
    kind: 'requirement',
    content:
      'npx brunch in a project directory with configured supported LLM provider credentials opens a working app in the browser with state in local .brunch/.',
  },
  {
    ref: 'R2',
    kind: 'requirement',
    content: 'Closing and reopening the browser resumes the specification from persisted state.',
  },
  {
    ref: 'R3',
    kind: 'requirement',
    content: 'The dashboard shows multiple specifications / elicitation runs within one .brunch/ directory.',
  },
  {
    ref: 'R4',
    kind: 'requirement',
    content:
      'First-run setup detects missing expected LLM provider credentials before the user starts a specification, makes the missing-key state visible on the dashboard, and offers a guided setup path.',
  },
  {
    ref: 'R5',
    kind: 'requirement',
    content:
      'If Brunch accepts an API key through the UI, it stores credentials outside the project workspace in XDG-compliant user auth/config state; project .env files and .brunch/ never become the default secret-storage target.',
  },
  {
    ref: 'R6',
    kind: 'requirement',
    content:
      'LLM provider configuration is owned by a shared AI runtime provider seam, so interviewer and observer model creation do not encode direct provider imports or environment-variable reads as product truth.',
  },
  {
    ref: 'R7',
    kind: 'requirement',
    content:
      'Workspace hygiene detects whether local .brunch/ is git-ignored and, with explicit user confirmation, can add an idempotent .gitignore entry, creating .gitignore when absent.',
  },
  // Interview workflow
  {
    ref: 'R8',
    kind: 'requirement',
    content:
      'Starting a new specification asks only for the specification name before entering the workspace; greenfield / brownfield grounding strategy is chosen through grounding entry states inside the workspace.',
  },
  {
    ref: 'R9',
    kind: 'requirement',
    content:
      'Brownfield grounding can use read-only workspace analysis to ground the opening flow and first substantive question.',
  },
  {
    ref: 'R10',
    kind: 'requirement',
    content:
      'Structured responses support turn-appropriate option selections or explicit action submissions, an explicit none-of-the-above path, and one attached response note; one turn may carry multiple assistant-part artifacts rendered as stacked cards with one unified response submission.',
  },
  {
    ref: 'R11',
    kind: 'requirement',
    content:
      'Users can see thinking, tool usage, and streaming progress in real time; replay keeps concise durable activity metadata for live-only artifacts instead of dropping them.',
  },
  {
    ref: 'R12',
    kind: 'requirement',
    content: 'Each workflow mode has deterministic closeability plus a separate readiness signal.',
  },
  { ref: 'R13', kind: 'requirement', content: 'Phase close records summary text and closure basis.' },
  {
    ref: 'R14',
    kind: 'requirement',
    content:
      'Partial-scope elicitation works for a feature or bounded sub-area, not just whole-workspace greenfield specs.',
  },
  {
    ref: 'R15',
    kind: 'requirement',
    content:
      'Each phase exposes an explicit kickoff, frontier, recovery, handoff, or completion affordance; the UI must not strand the user with a bare generic composer as the only visible action.',
  },
  {
    ref: 'R16',
    kind: 'requirement',
    content:
      'Open interview phases default to a projected kickoff card, current frontier turn, visible generation state, or projected recovery affordance; closed phases terminate in a projected handoff or completion artifact.',
  },
  {
    ref: 'R17',
    kind: 'requirement',
    content: 'The first phase is grounding in both product language and canonical workflow identifiers.',
  },
  {
    ref: 'R18',
    kind: 'requirement',
    content:
      'The interviewer may invoke context-gathering capabilities such as workspace analysis in any phase when the workspace directory is available; outputs appear as visible preface cards paired with question cards.',
  },
  {
    ref: 'R19',
    kind: 'requirement',
    content:
      'Preface cards are provisional context rendered as turn-internal artifacts, so observer capture uses the whole validated unit: preface context + question + user response.',
  },
  {
    ref: 'R20',
    kind: 'requirement',
    content:
      'Each phase section opens with a projected header that states phase purpose and captured knowledge kinds.',
  },
  {
    ref: 'R21',
    kind: 'requirement',
    content:
      'Review revisions stack in turn lineage but visually render only the current revision live with a version badge; prior revisions collapse to compact answered-turn summaries.',
  },
  {
    ref: 'R22',
    kind: 'requirement',
    content:
      'Grounding prompts use hint-guided, priority-ordered topics with example question shapes rather than generating every question from scratch.',
  },
  {
    ref: 'R23',
    kind: 'requirement',
    content:
      'Observer capture treats the full turn — including preface/revision artifacts, offer, and user response — as one atomic validated unit.',
  },
  {
    ref: 'R24',
    kind: 'requirement',
    content:
      'Grounding captures both workspace novelty (greenfield / brownfield) and delivery posture (end-to-end build / incremental feature).',
  },
  {
    ref: 'R25',
    kind: 'requirement',
    content:
      'Users can request a turn-owned candidate-spec set during grounding or design; accepting a direction may steer the next interview move and materialize intent items, but does not itself close the phase.',
  },
  {
    ref: 'R26',
    kind: 'requirement',
    content:
      'Interview detail can proceed as a progressive broad-pass-to-detail flow with explicit next-level-of-detail actions.',
  },
  {
    ref: 'R27',
    kind: 'requirement',
    content:
      'Specifications can evolve through multiple chat-local strategies rather than one global interviewer mode; each active/resumable chat has at most one open frontier turn, and only proposal acceptance may apply semantic changes.',
  },
  {
    ref: 'R28',
    kind: 'requirement',
    content:
      'The workspace runtime can host secondary chats (side, reconciliation, qa, strategy) inline with the primary interview chat while keeping transcript replay, explicit turn-level context snapshots, graph-item handle refresh, and semantic mutations server-authoritative.',
  },
  // Knowledge / intent graph
  {
    ref: 'R29',
    kind: 'requirement',
    content: 'The observer extracts typed intent items and intent edges from answered turns.',
  },
  {
    ref: 'R30',
    kind: 'requirement',
    content: 'The accumulated knowledge layer and readiness state stay visible during the interview.',
  },
  {
    ref: 'R31',
    kind: 'requirement',
    content:
      'Users can revisit knowledge through edit mode, cascade preview, and reconciliation / secondary-chat surfaces.',
  },
  {
    ref: 'R32',
    kind: 'requirement',
    content:
      'Grounding and elicitation persist only the durable exploration ontology (goal, term, context, constraint, decision, assumption); non-goal is a constraint subtype, and requirements / criteria become durable only through accepted review outputs.',
  },
  {
    ref: 'R33',
    kind: 'requirement',
    content:
      'The knowledge/intent ontology is defined once and projected consistently through schema, shared registries, observer prompts, API types, fixtures, and UI copy.',
  },
  {
    ref: 'R34',
    kind: 'requirement',
    content:
      'Observer extraction treats typed relationships as first-class across the ontology and records them when reasonably supported while abstaining when support is weak.',
  },
  {
    ref: 'R35',
    kind: 'requirement',
    content:
      'The product ontology should expand beyond current exploration + review kinds to support invariant and example as first-class durable knowledge kinds.',
  },
  {
    ref: 'R36',
    kind: 'requirement',
    content:
      'Specifications can own multiple durable chat containers below the specification; turns belong to chats while legacy spec-scoped pointers remain transitional. Reconciliation needs remain process debt, separate from semantic intent edges.',
  },
  // Review & export
  {
    ref: 'R37',
    kind: 'requirement',
    content:
      'Requirements review synthesizes a candidate requirement set from the knowledge layer, presents stable item reference codes, supports per-item comments, and resolves through explicit accept review / request changes submission.',
  },
  {
    ref: 'R38',
    kind: 'requirement',
    content:
      'Criteria review synthesizes a candidate verification set from accepted requirements plus the knowledge layer, presents stable item reference codes, and supports the same per-item commenting and full-set review seam.',
  },
  {
    ref: 'R39',
    kind: 'requirement',
    content:
      'Export is available only when workflow closure, accepted review outputs, and staleness rules are satisfied.',
  },
  // Workspace / graph UI
  {
    ref: 'R40',
    kind: 'requirement',
    content:
      'The homepage surfaces workspace (CWD) binding so the user understands listed specifications and the new-spec affordance are scoped to the current project directory.',
  },
  {
    ref: 'R41',
    kind: 'requirement',
    content:
      'Graph view is a first-class alternative to chat view, accessed as a peer route, and projects the intent graph as a navigable workspace with visible relationship topology and graph-launched refinement; the first ship is a structured-list layout, with a spatial canvas as a later layout switch.',
  },
  // Orchestrator (cook)
  {
    ref: 'R42',
    kind: 'requirement',
    content:
      'brunch cook [dir] takes a plan YAML (epics → slices) and executes it end-to-end by dispatching agents through a name-keyed ActionRegistry; dir is optional and defaults to the launch cwd.',
  },
  {
    ref: 'R43',
    kind: 'requirement',
    content:
      'Two engines (proc and petri) implement the same Orchestrator interface and must pass the same contract test suite.',
  },
  {
    ref: 'R44',
    kind: 'requirement',
    content:
      'reports.jsonl is the communication medium: tokens carry only pointers, all event content lives in the append-only log.',
  },
  {
    ref: 'R45',
    kind: 'requirement',
    content:
      'Each run gets worktree isolation at <cwd>/.brunch/cook/runs/<runId>/worktree/; the fixture directory and source repo stay untouched.',
  },
  {
    ref: 'R46',
    kind: 'requirement',
    content:
      'A mode-driven resolver locates the plan, then reads the plan-s spec-derived mode to choose the worktree strategy: greenfield → empty worktree; brownfield → clone the cwd repo (requires a clean git working tree). Mode is carried in plan.yaml, not inferred from plan location.',
  },
  {
    ref: 'R47',
    kind: 'requirement',
    content:
      'A cook run projects execution progress back onto the spec-s intent graph: a durable, spec-keyed artifact records per-requirement lifecycle status and per-criterion structural coverage (never an unverified per-criterion pass/fail), consumable by a later UI.',
  },
  // Provider / agent substrate
  {
    ref: 'R48',
    kind: 'requirement',
    content:
      'Prompt and context engineering are first-class server subsystems: prompts and reusable policy doctrines live as inspectable markdown assets, while typed context-pack builders derive scenario-specific intent-graph renderings.',
  },
  {
    ref: 'R49',
    kind: 'requirement',
    content:
      'Agent-heavy future capabilities can be tested before product UI exists through a lightweight scenario substrate that runs prompt/context packs against seeded graphs or transcript fixtures, captures outputs, and supports harness comparison.',
  },
  {
    ref: 'R50',
    kind: 'requirement',
    content:
      'Agent-originated mutations of Brunch data use one typed server-owned mutation surface regardless of caller; agents and harnesses may not mutate durable Brunch state by calling the ORM directly.',
  },
  {
    ref: 'R51',
    kind: 'requirement',
    content:
      'A local agent capability CLI can expose Brunch-owned capability contracts over long-lived JSONL stdin/stdout so an external probe runner or harness can drive the real specification flow without privileged ORM access.',
  },
];

// --- Acceptance criteria (the SPEC's 23-item AC list) ----------------------

const criteria: readonly KSpec[] = [
  {
    ref: 'AC1',
    kind: 'criterion',
    content: 'npx brunch can start from a workspace directory with local-first persistence in .brunch/.',
  },
  {
    ref: 'AC2',
    kind: 'criterion',
    content:
      'Greenfield and brownfield grounding both work, with brownfield able to start from workspace analysis and converge into the same grounding phase purpose.',
  },
  {
    ref: 'AC3',
    kind: 'criterion',
    content: 'Structured turns support rich responses without losing semantic fidelity.',
  },
  {
    ref: 'AC4',
    kind: 'criterion',
    content: 'The intent layer stays visible, typed, and linked through graph relationships.',
  },
  {
    ref: 'AC5',
    kind: 'criterion',
    content: 'Phase closeability, readiness, and closure provenance stay legible to the user.',
  },
  {
    ref: 'AC6',
    kind: 'criterion',
    content:
      'Requirements and criteria review remain explicit, lightweight, durable at the turn level, and export-relevant.',
  },
  {
    ref: 'AC7',
    kind: 'criterion',
    content:
      'Revisit can invalidate intent, surface cascade through the reconciliation_need queue, and re-resolve without a separate modal-only substrate.',
  },
  {
    ref: 'AC8',
    kind: 'criterion',
    content:
      'The routed UI stays stable across dashboard, phase views, sidebar intent graph, and graph view.',
  },
  { ref: 'AC9', kind: 'criterion', content: 'Resume works from persisted state.' },
  { ref: 'AC10', kind: 'criterion', content: 'The verification gate passes.' },
  {
    ref: 'AC11',
    kind: 'criterion',
    content:
      'Structural kickoff / recovery / handoff / completion affordances project without a bare generic composer.',
  },
  {
    ref: 'AC12',
    kind: 'criterion',
    content:
      'Hydrated transcripts preserve interviewer-side structure plus stable durable activity summaries for live-only artifacts.',
  },
  {
    ref: 'AC13',
    kind: 'criterion',
    content:
      'Open phases bottom-load one visible next action; completed turns replay as answered-turn records; closed phases bottom-load handoff/completion artifacts.',
  },
  {
    ref: 'AC14',
    kind: 'criterion',
    content:
      'Preface cards render as turn-internal artifacts paired with question cards, so observer capture uses the whole validated turn.',
  },
  {
    ref: 'AC15',
    kind: 'criterion',
    content:
      'Grounding and elicitation persist only the durable exploration ontology, with non-goal represented as a constraint subtype.',
  },
  {
    ref: 'AC16',
    kind: 'criterion',
    content:
      'Observer prompt, shared kind registry, schema/API types, fixtures, and UI copy describe the same ontology.',
  },
  {
    ref: 'AC17',
    kind: 'criterion',
    content: 'The interview can orient anywhere in the two-axis workspace novelty × delivery posture matrix.',
  },
  {
    ref: 'AC18',
    kind: 'criterion',
    content: 'Observer capture records useful intent edges while abstaining under weak support.',
  },
  {
    ref: 'AC19',
    kind: 'criterion',
    content:
      'Users can request candidate directions with explained tradeoffs and refine by reacting to them.',
  },
  {
    ref: 'AC20',
    kind: 'criterion',
    content: 'The interview can stop at a broad pass and deepen selected areas incrementally.',
  },
  {
    ref: 'AC21',
    kind: 'criterion',
    content:
      'Graph view renders the intent graph as a navigable workspace with visible edges and node-launched refinement flows.',
  },
  {
    ref: 'AC22',
    kind: 'criterion',
    content:
      'First-run setup makes missing provider credentials visible and recoverable without hand-editing project .env files.',
  },
  {
    ref: 'AC23',
    kind: 'criterion',
    content:
      'Brunch can help users keep .brunch/ out of version control through explicit, idempotent .gitignore confirmation.',
  },
];

// --- Typed edges -----------------------------------------------------------

const edges: ReadonlyArray<{ source: string; relation: EdgeRelation; target: string }> = [
  // verifies (criterion → requirement) — the SPEC's own AC coverage.
  { source: 'AC1', relation: 'verifies', target: 'R1' },
  { source: 'AC2', relation: 'verifies', target: 'R8' },
  { source: 'AC2', relation: 'verifies', target: 'R9' },
  { source: 'AC2', relation: 'verifies', target: 'R24' },
  { source: 'AC3', relation: 'verifies', target: 'R10' },
  { source: 'AC4', relation: 'verifies', target: 'R29' },
  { source: 'AC4', relation: 'verifies', target: 'R30' },
  { source: 'AC5', relation: 'verifies', target: 'R12' },
  { source: 'AC5', relation: 'verifies', target: 'R13' },
  { source: 'AC6', relation: 'verifies', target: 'R37' },
  { source: 'AC6', relation: 'verifies', target: 'R38' },
  { source: 'AC6', relation: 'verifies', target: 'R39' },
  { source: 'AC7', relation: 'verifies', target: 'R31' },
  { source: 'AC7', relation: 'verifies', target: 'R36' },
  { source: 'AC8', relation: 'verifies', target: 'R3' },
  { source: 'AC8', relation: 'verifies', target: 'R40' },
  { source: 'AC8', relation: 'verifies', target: 'R41' },
  { source: 'AC9', relation: 'verifies', target: 'R2' },
  // AC10 ("the verification gate passes") is a process gate, not tied to a
  // product requirement — intentionally carries no verifies edge.
  { source: 'AC11', relation: 'verifies', target: 'R15' },
  { source: 'AC11', relation: 'verifies', target: 'R16' },
  { source: 'AC12', relation: 'verifies', target: 'R11' },
  { source: 'AC13', relation: 'verifies', target: 'R16' },
  { source: 'AC13', relation: 'verifies', target: 'R21' },
  { source: 'AC14', relation: 'verifies', target: 'R18' },
  { source: 'AC14', relation: 'verifies', target: 'R19' },
  { source: 'AC14', relation: 'verifies', target: 'R23' },
  { source: 'AC15', relation: 'verifies', target: 'R32' },
  { source: 'AC16', relation: 'verifies', target: 'R33' },
  { source: 'AC16', relation: 'verifies', target: 'R35' },
  { source: 'AC17', relation: 'verifies', target: 'R14' },
  { source: 'AC17', relation: 'verifies', target: 'R24' },
  { source: 'AC18', relation: 'verifies', target: 'R34' },
  { source: 'AC19', relation: 'verifies', target: 'R25' },
  { source: 'AC20', relation: 'verifies', target: 'R26' },
  { source: 'AC21', relation: 'verifies', target: 'R41' },
  { source: 'AC22', relation: 'verifies', target: 'R4' },
  { source: 'AC22', relation: 'verifies', target: 'R5' },
  { source: 'AC23', relation: 'verifies', target: 'R7' },

  // constrains (constraint → requirement) — non-goals bound feature scope.
  { source: 'K1', relation: 'constrains', target: 'R6' },
  { source: 'K1', relation: 'constrains', target: 'R4' },
  { source: 'K2', relation: 'constrains', target: 'R28' },
  { source: 'K3', relation: 'constrains', target: 'R9' },
  { source: 'K4', relation: 'constrains', target: 'R31' },
  { source: 'K5', relation: 'constrains', target: 'R31' },
  { source: 'K6', relation: 'constrains', target: 'R39' },
  { source: 'K7', relation: 'constrains', target: 'R37' },
  { source: 'K7', relation: 'constrains', target: 'R38' },
  { source: 'K8', relation: 'constrains', target: 'R28' },
  { source: 'K8', relation: 'constrains', target: 'R2' },

  // depends_on (decision → requirement) — decisions point AT the requirements
  // they shape; never req→req execution order.
  { source: 'D22', relation: 'depends_on', target: 'R29' },
  { source: 'D65', relation: 'depends_on', target: 'R13' },
  { source: 'D66', relation: 'depends_on', target: 'R13' },
  { source: 'D86', relation: 'depends_on', target: 'R41' },
  { source: 'D86', relation: 'depends_on', target: 'R15' },
  { source: 'D110', relation: 'depends_on', target: 'R16' },
  { source: 'D124', relation: 'depends_on', target: 'R24' },
  { source: 'D50', relation: 'depends_on', target: 'R29' },
  { source: 'D80', relation: 'depends_on', target: 'R31' },
  { source: 'D125', relation: 'depends_on', target: 'R34' },
  { source: 'D128', relation: 'depends_on', target: 'R41' },
  { source: 'D134', relation: 'depends_on', target: 'R35' },
  { source: 'D135', relation: 'depends_on', target: 'R36' },
  { source: 'D130', relation: 'depends_on', target: 'R4' },
  { source: 'D131', relation: 'depends_on', target: 'R6' },
  { source: 'D132', relation: 'depends_on', target: 'R5' },
  { source: 'D133', relation: 'depends_on', target: 'R7' },
  { source: 'D139', relation: 'depends_on', target: 'R48' },
  { source: 'D143', relation: 'depends_on', target: 'R50' },
  { source: 'D155', relation: 'depends_on', target: 'R43' },
  { source: 'D156', relation: 'depends_on', target: 'R44' },
  { source: 'D164', relation: 'depends_on', target: 'R46' },
  { source: 'D172', relation: 'depends_on', target: 'R47' },

  // depends_on (assumption → requirement) — assumptions underwrite requirements.
  { source: 'A65', relation: 'depends_on', target: 'R24' },
  { source: 'A66', relation: 'depends_on', target: 'R34' },
  { source: 'A67', relation: 'depends_on', target: 'R25' },
  { source: 'A68', relation: 'depends_on', target: 'R26' },
  { source: 'A69', relation: 'depends_on', target: 'R41' },
  { source: 'A75', relation: 'depends_on', target: 'R5' },
  { source: 'A76', relation: 'depends_on', target: 'R7' },
  { source: 'A89', relation: 'depends_on', target: 'R51' },
  { source: 'A94', relation: 'depends_on', target: 'R28' },
  { source: 'A95', relation: 'depends_on', target: 'R28' },
  { source: 'A97', relation: 'depends_on', target: 'R42' },
  { source: 'A102', relation: 'depends_on', target: 'R47' },

  // derived_from (provenance) — decisions/assumptions trace to constraints and
  // each other; context traces to goals.
  { source: 'D132', relation: 'derived_from', target: 'K1' },
  { source: 'D133', relation: 'derived_from', target: 'K8' },
  { source: 'A75', relation: 'derived_from', target: 'D132' },
  { source: 'A76', relation: 'derived_from', target: 'D133' },
  { source: 'X1', relation: 'derived_from', target: 'G4' },
  { source: 'X4', relation: 'derived_from', target: 'G2' },

  // refines (any → any) — adversarial epistemic edges. The ONLY req→req edges;
  // a graph read must NOT synthesize build ordering from them.
  { source: 'R9', relation: 'refines', target: 'R8' },
  { source: 'R47', relation: 'refines', target: 'R42' },
];

function captureKnowledge(
  db: DB,
  projectId: number,
  turnId: number,
  marker: CaptureMarker,
  idByRef: Record<string, number>,
  kindByRef: Record<string, KnowledgeKind>,
): void {
  for (const spec of [...goals, ...terms, ...contexts, ...constraints, ...decisions, ...assumptions]) {
    if (spec.capturedAt !== marker) continue;
    const item = createKnowledgeItem(db, projectId, spec.kind, spec.content, {
      subtype: spec.subtype ?? null,
      rationale: spec.rationale ?? null,
    });
    linkKnowledgeItemToTurn(db, item.id, turnId, 'captured');
    idByRef[spec.ref] = item.id;
    kindByRef[spec.ref] = spec.kind;
  }
}

function buildReviewItems(specs: readonly KSpec[], kind: 'requirement' | 'criterion') {
  return specs.map((spec, index) => ({
    reviewItemId: `${kind === 'requirement' ? 'requirements' : 'criteria'}:${index + 1}`,
    referenceCode: code(kind, index + 1),
    content: spec.content,
    rationale: `Captured for the Brunch self-spec (${spec.ref}).`,
    grounding: [{ code: code('goal', 1) }],
  }));
}

/**
 * Seeds the Brunch self-spec: the entire Brunch v2 product spec (SPEC.md) as one
 * completed-spec intent graph — grounding + design closed, requirements + criteria
 * reviews accepted, ~75 supporting knowledge items, 51 requirements, 23 criteria,
 * and ~90 typed edges. This is the "huge graph" used to dogfood the workspace and
 * graph views against a realistically large specification.
 */
export function seedAcceptedBrunchMetaSpec(db: DB, projectId: number) {
  const idByRef: Record<string, number> = {};
  const kindByRef: Record<string, KnowledgeKind> = {};

  // ---- Grounding: novelty/posture, the goals, the lexicon, context, constraints ----
  const gNovelty = createTurn(db, projectId, {
    phase: 'grounding',
    impact: 'high',
    question: 'Is this a fresh idea, or a change to something that already exists in this workspace?',
    answer:
      'Brownfield, whole-product. Brunch v2 already exists — this specification is Brunch describing itself: an AI-guided spec elicitation tool, pre-release, Anthropic-direct, user-supplied-key.',
  });
  advanceHead(db, projectId, gNovelty.id);
  captureKnowledge(db, projectId, gNovelty.id, 'g-novelty', idByRef, kindByRef);

  const gGoal = createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: gNovelty.id,
    impact: 'high',
    question: "What's the core of what Brunch is for — the goals someone should be able to count on?",
    answer:
      'Turn natural-language goals into structured specs through a four-phase interview; preserve meaning first as an intent spec; keep the intent graph and readiness visible; run locally with user keys; support greenfield and brownfield, whole and partial scope; and eventually drive a completed spec to a built artifact via the cook orchestrator.',
  });
  advanceHead(db, projectId, gGoal.id);
  captureKnowledge(db, projectId, gGoal.id, 'g-goal', idByRef, kindByRef);

  const gTerms = createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: gGoal.id,
    impact: 'medium',
    question: 'What vocabulary do we need to fix so everyone means the same thing?',
    answer:
      'Workspace, specification, intent graph / item / edge, reconciliation need, chat and secondary chat, turn / frontier turn / proposal turn, preface card, review set, phase outcome, closeability, readiness band, exploration knowledge, context pack, AI runtime provider, and the orchestrator terms: engine, report.',
  });
  advanceHead(db, projectId, gTerms.id);
  captureKnowledge(db, projectId, gTerms.id, 'g-terms', idByRef, kindByRef);

  const gContext = createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: gTerms.id,
    impact: 'medium',
    question: 'What existing facts about the codebase should I record as context?',
    answer:
      'Persistence is chat + turn (thread table deferred); intent items/edges still persist as knowledge_item/knowledge_edge; pre-release posture favors conceptual correctness over back-compat; two cook engines (proc, petri) sit behind a shared seam; reports.jsonl is the append-only source log.',
  });
  advanceHead(db, projectId, gContext.id);
  captureKnowledge(db, projectId, gContext.id, 'g-context', idByRef, kindByRef);

  const gConstraints = createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: gContext.id,
    impact: 'high',
    question: 'Any hard lines — things V1 must not do?',
    answer:
      'User-supplied key / no hosted inference; no collaborative editing; no document-ingestion UX; no hard turn-tree branching; no automatic cascade deletion; no task-planning/execution surface (stop at handoff/export); no general-purpose inline doc editor in review; no offline-first/multi-tab sync.',
  });
  advanceHead(db, projectId, gConstraints.id);
  captureKnowledge(db, projectId, gConstraints.id, 'g-constraints', idByRef, kindByRef);

  const groundingProposalTurn = createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: gConstraints.id,
    question: '',
    answer: 'We have enough grounding context',
    assistant_parts: serializeFixturePhaseProposalAssistantParts({
      turnId: gConstraints.id + 1,
      phase: 'grounding',
      summary:
        'Brownfield whole-product posture, the six product goals, the core lexicon, the codebase context facts, and the eight V1 constraints/non-goals are captured.',
    }),
  });
  advanceHead(db, projectId, groundingProposalTurn.id);
  const groundingOutcome = createPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'grounding',
    proposal_turn_id: groundingProposalTurn.id,
    summary: 'Grounding context for the Brunch self-spec is sufficiently captured.',
  });
  const groundingConfirmTurn = createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: groundingProposalTurn.id,
    question: '',
    answer: 'Confirm grounding closure',
    user_parts: serializeFixturePhaseConfirmationUserParts({
      phase: 'grounding',
      proposalTurnId: groundingProposalTurn.id,
    }),
  });
  confirmPhaseOutcome(db, groundingOutcome.id, groundingConfirmTurn.id);
  advanceHead(db, projectId, groundingConfirmTurn.id);

  // ---- Design: workflow runtime, intent graph, provider, orchestrator, agents ----
  const dWorkflow = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: groundingConfirmTurn.id,
    impact: 'high',
    question: 'How is the interview workflow and workspace projection structured?',
    answer:
      'Phase outcomes are explicit durable records; one phase-close seam handles recommended and forced closes; the client is three layout shells with phase-addressable routing; the center pane is a merged read-model stream; interview framing is two-axis; observer sync is turn-owned and background.',
  });
  advanceHead(db, projectId, dWorkflow.id);
  captureKnowledge(db, projectId, dWorkflow.id, 'd-workflow', idByRef, kindByRef);

  const dGraph = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: dWorkflow.id,
    impact: 'high',
    question: 'How does the intent graph, semantic mutation, and review work?',
    answer:
      'Relationships live behind one typed graph seam; revisit replaces turn-tree branching; observer capture is a prompt-budgeted graph-delta seam; graph view is a projection-first intent-emitting mode; specs evolve toward recognition-first graphs with progressive checkability; semantic mutation history splits from turn history.',
  });
  advanceHead(db, projectId, dGraph.id);
  captureKnowledge(db, projectId, dGraph.id, 'd-graph', idByRef, kindByRef);

  const dProvider = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: dGraph.id,
    impact: 'medium',
    question: 'How are provider setup and credentials handled?',
    answer:
      'First-run setup is a product surface; provider access moves behind one AI runtime provider seam; UI-entered keys are user-scoped XDG auth state, not workspace state; .gitignore support is confirm-gated, idempotent workspace mutation.',
  });
  advanceHead(db, projectId, dProvider.id);
  captureKnowledge(db, projectId, dProvider.id, 'd-provider', idByRef, kindByRef);

  const dOrchestrator = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: dProvider.id,
    impact: 'high',
    question: 'How does the cook orchestrator work?',
    answer:
      'A dual-engine experiment (proc, petri) behind a shared seam; reports.jsonl is the communication medium; greenfield/brownfield is spec-derived plan truth, not plan location; execution progress is a durable spec-keyed projection, derived not logged.',
  });
  advanceHead(db, projectId, dOrchestrator.id);
  captureKnowledge(db, projectId, dOrchestrator.id, 'd-orchestrator', idByRef, kindByRef);

  const dAgent = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: dOrchestrator.id,
    impact: 'medium',
    question: 'How is the provider / prompt / agent substrate organized?',
    answer:
      'A first-class prompt/context scenario substrate (markdown prompts + typed context-pack builders); Brunch owns the agent mutation surface and harnesses adapt it as tools; a local JSONL agent capability CLI exposes capability contracts.',
  });
  advanceHead(db, projectId, dAgent.id);
  captureKnowledge(db, projectId, dAgent.id, 'd-agent', idByRef, kindByRef);

  const designProposalTurn = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: dAgent.id,
    question: '',
    answer: 'We have enough design context',
    assistant_parts: serializeFixturePhaseProposalAssistantParts({
      turnId: dAgent.id + 1,
      phase: 'design',
      summary:
        'Workflow-runtime, intent-graph, provider, orchestrator, and agent-substrate design commitments and assumptions are captured.',
    }),
  });
  advanceHead(db, projectId, designProposalTurn.id);
  const designOutcome = createPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'design',
    proposal_turn_id: designProposalTurn.id,
    summary:
      'The design commitments for the Brunch self-spec are captured well enough to review requirements.',
  });
  const designConfirmTurn = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: designProposalTurn.id,
    question: '',
    answer: 'Confirm elicitation closure',
    user_parts: serializeFixturePhaseConfirmationUserParts({
      phase: 'design',
      proposalTurnId: designProposalTurn.id,
    }),
  });
  confirmPhaseOutcome(db, designOutcome.id, designConfirmTurn.id);
  advanceHead(db, projectId, designConfirmTurn.id);

  // ---- Requirements review (accepted) ----
  const requirementsReviewTurn = createTurn(db, projectId, {
    phase: 'requirements',
    parent_turn_id: designConfirmTurn.id,
    question: 'Please review the current requirement set.',
    why: 'Review the whole requirement set before moving forward.',
    impact: 'high',
    answer: 'Accept review',
    assistant_parts: serializeFixtureQuestionAssistantParts({
      turnId: 0,
      toolCallId: 'fixture-brunch-meta-requirements-review',
      input: createFixtureReviewQuestionInput({
        phase: 'requirements',
        title: 'Requirements',
        prompt: 'Please review the current requirement set.',
        why: 'Review the whole requirement set before moving forward.',
        items: buildReviewItems(requirements, 'requirement'),
      }),
    }),
  });
  const requirementsAcceptOption = createOption(db, requirementsReviewTurn.id, {
    position: 0,
    content: 'Accept review',
    is_recommended: true,
  });
  createOption(db, requirementsReviewTurn.id, { position: 1, content: 'Request changes' });
  applyTurnResponseSelections(db, requirementsReviewTurn.id, [0]);
  updateTurn(db, requirementsReviewTurn.id, {
    user_parts: serializeFixtureAcceptedReviewUserParts({
      turnId: requirementsReviewTurn.id,
      selectedOptionIds: [requirementsAcceptOption.id],
    }),
  });
  for (const spec of requirements) {
    const item = createKnowledgeItem(db, projectId, 'requirement', spec.content);
    linkKnowledgeItemToTurn(db, item.id, requirementsReviewTurn.id, 'reviewed');
    idByRef[spec.ref] = item.id;
    kindByRef[spec.ref] = 'requirement';
  }
  createConfirmedPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'requirements',
    proposal_turn_id: requirementsReviewTurn.id,
    confirmation_turn_id: requirementsReviewTurn.id,
    summary: 'The reviewed requirement set is accepted and ready for acceptance criteria.',
  });
  advanceHead(db, projectId, requirementsReviewTurn.id);

  // ---- Criteria review (accepted) ----
  const criteriaReviewTurn = createTurn(db, projectId, {
    phase: 'criteria',
    parent_turn_id: requirementsReviewTurn.id,
    question: 'Please review the current criterion set.',
    why: 'Review the whole criterion set before moving forward.',
    impact: 'high',
    answer: 'Accept review',
    assistant_parts: serializeFixtureQuestionAssistantParts({
      turnId: 0,
      toolCallId: 'fixture-brunch-meta-criteria-review',
      input: createFixtureReviewQuestionInput({
        phase: 'criteria',
        title: 'Acceptance Criteria',
        prompt: 'Please review the current criterion set.',
        why: 'Review the whole criterion set before moving forward.',
        items: buildReviewItems(criteria, 'criterion'),
      }),
    }),
  });
  const criteriaAcceptOption = createOption(db, criteriaReviewTurn.id, {
    position: 0,
    content: 'Accept review',
    is_recommended: true,
  });
  createOption(db, criteriaReviewTurn.id, { position: 1, content: 'Request changes' });
  applyTurnResponseSelections(db, criteriaReviewTurn.id, [0]);
  updateTurn(db, criteriaReviewTurn.id, {
    user_parts: serializeFixtureAcceptedReviewUserParts({
      turnId: criteriaReviewTurn.id,
      selectedOptionIds: [criteriaAcceptOption.id],
    }),
  });
  for (const spec of criteria) {
    const item = createKnowledgeItem(db, projectId, 'criterion', spec.content);
    linkKnowledgeItemToTurn(db, item.id, criteriaReviewTurn.id, 'reviewed');
    idByRef[spec.ref] = item.id;
    kindByRef[spec.ref] = 'criterion';
  }
  createConfirmedPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'criteria',
    proposal_turn_id: criteriaReviewTurn.id,
    confirmation_turn_id: criteriaReviewTurn.id,
    summary: 'The reviewed criteria set is accepted and the specification is ready for output.',
  });
  advanceHead(db, projectId, criteriaReviewTurn.id);

  // ---- Typed edges (policy-guarded) ----
  for (const edge of edges) {
    const sourceId = idByRef[edge.source];
    const targetId = idByRef[edge.target];
    if (sourceId === undefined || targetId === undefined) {
      throw new Error(`Brunch-meta-spec fixture references unknown ref: ${edge.source} → ${edge.target}`);
    }
    if (!supportsKnowledgeRelationship(edge.relation, kindByRef[edge.source]!, kindByRef[edge.target]!)) {
      throw new Error(
        `Brunch-meta-spec fixture violates relation policy: ${edge.source} -[${edge.relation}]-> ${edge.target}`,
      );
    }
    addKnowledgeRelationship(db, sourceId, targetId, edge.relation);
  }

  return { requirementsReviewTurn, criteriaReviewTurn, idByRef };
}
