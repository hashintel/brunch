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
// spatial-graph-layout — completed-spec fixture for downstream tooling that
// consumes a completed spec. Source-of-truth: docs/fixtures/spatial-graph-layout-interview.md
//
// Authored to stress a downstream consumer's full behavior — graph read, order
// synthesis, validation. Deliberate stressors:
//   - R7/R8 are non-buildable, constraint-phrased requirements (no verifies edges).
//   - AC6 verifies two requirements (R4 + R1); R2 is verified by three criteria.
//   - No req→req depends_on edges: build ordering must be SYNTHESIZED, not read.
//   - One adversarial req→req refines edge (R5 refines R2) a graph read must ignore.
// ---------------------------------------------------------------------------

type SpatialCaptureMarker = 'g-novelty' | 'g-goal' | 'g-constraints' | 'd-layout' | 'd-persist' | 'd-data';

interface SpatialKnowledgeSpec {
  ref: string;
  kind: KnowledgeKind;
  content: string;
  subtype?: string;
  rationale?: string;
  /** Which interview turn captured this item (supporting knowledge only). */
  capturedAt?: SpatialCaptureMarker;
}

const spatialSupportingKnowledge: readonly SpatialKnowledgeSpec[] = [
  {
    ref: 'G1',
    kind: 'goal',
    capturedAt: 'g-goal',
    content:
      'Grasp intent-graph topology at a glance — clusters, hubs, and relationships — as a spatial peer to the structured-list view.',
  },
  {
    ref: 'T1',
    kind: 'term',
    capturedAt: 'g-goal',
    content:
      'Spatial canvas — a pan/zoom 2D surface where intent items are positioned nodes and relationships are drawn edges.',
  },
  {
    ref: 'T2',
    kind: 'term',
    capturedAt: 'g-goal',
    content:
      'Layout switch — the control that toggles graph mode between structured-list and spatial canvas.',
  },
  {
    ref: 'X1',
    kind: 'context',
    capturedAt: 'g-novelty',
    content:
      'Graph mode already ships a structured-list layout and a graph-launched refinement affordance; this feature is additive on top.',
  },
  {
    ref: 'K1',
    kind: 'constraint',
    capturedAt: 'g-constraints',
    content: 'Node positions are view-state only and never semantic truth.',
  },
  {
    ref: 'K2',
    kind: 'constraint',
    subtype: 'non-goal',
    capturedAt: 'g-constraints',
    content: 'No spatial layout outside graph mode; chat view is unchanged.',
  },
  {
    ref: 'D1',
    kind: 'decision',
    capturedAt: 'd-layout',
    content:
      'Use a deterministic topology-seeded auto-layout (layered/force-directed, fixed seed), not random placement.',
    rationale: 'Yields a readable, stable initial arrangement that does not jump on every reload.',
  },
  {
    ref: 'D2',
    kind: 'decision',
    capturedAt: 'd-persist',
    content: 'Persist node positions per-spec in local .brunch state, not in the intent graph.',
    rationale: 'Keeps positions out of the semantic layer, honoring the view-state-only constraint.',
  },
  {
    ref: 'A1',
    kind: 'assumption',
    capturedAt: 'd-data',
    content:
      'The existing graph data layer can supply all items and typed edges to the canvas without a new query surface.',
  },
];

function captureSpatialKnowledge(
  db: DB,
  projectId: number,
  turnId: number,
  marker: SpatialCaptureMarker,
  idByRef: Record<string, number>,
  kindByRef: Record<string, KnowledgeKind>,
): void {
  for (const spec of spatialSupportingKnowledge) {
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

const spatialRequirements: readonly SpatialKnowledgeSpec[] = [
  {
    ref: 'R1',
    kind: 'requirement',
    content:
      'Graph mode exposes a layout switch toggling between the existing structured-list layout and a new spatial canvas; the active choice persists per specification.',
  },
  {
    ref: 'R2',
    kind: 'requirement',
    content:
      'The spatial canvas renders every intent item as a positioned node and every typed relationship as a drawn edge, on a surface that supports pan and zoom.',
  },
  {
    ref: 'R3',
    kind: 'requirement',
    content:
      'On first open of the canvas for a specification, node positions are computed by a deterministic topology-seeded layout so the initial arrangement is readable without manual placement.',
  },
  {
    ref: 'R4',
    kind: 'requirement',
    content:
      'Users can drag nodes to reposition them; positions persist per specification and are restored on reload.',
  },
  {
    ref: 'R5',
    kind: 'requirement',
    content:
      'Canvas edges are visually distinguished by relation kind (depends_on, verifies, refines, derived_from, constrains), documented by a legend.',
  },
  {
    ref: 'R6',
    kind: 'requirement',
    content:
      'Selecting a node on the canvas offers the same graph-launched refinement affordance available from the structured-list route.',
  },
  // R7/R8 are intentionally constraint-phrased (non-buildable) requirements that
  // reproduce the spike's data-quality finding. They carry NO verifies edges.
  {
    ref: 'R7',
    kind: 'requirement',
    content:
      'Node positions are view-state only and must never alter intent-graph semantics, item content, or edges.',
  },
  {
    ref: 'R8',
    kind: 'requirement',
    content:
      'The spatial canvas must not replace or disable the structured-list route; it is an additive layout switch.',
  },
];

const spatialCriteria: readonly SpatialKnowledgeSpec[] = [
  {
    ref: 'AC1',
    kind: 'criterion',
    content: 'Toggling the layout switch swaps between list and canvas without losing the current selection.',
  },
  {
    ref: 'AC2',
    kind: 'criterion',
    content: 'Every intent item in the specification appears as exactly one node on the canvas.',
  },
  {
    ref: 'AC3',
    kind: 'criterion',
    content: 'Every typed relationship in the specification appears as exactly one edge on the canvas.',
  },
  {
    ref: 'AC4',
    kind: 'criterion',
    content:
      "Pan and zoom move and scale the viewport without changing nodes' positions relative to each other.",
  },
  {
    ref: 'AC5',
    kind: 'criterion',
    content:
      'Opening the canvas on a never-positioned specification yields a layout with no overlapping nodes, all within viewport bounds.',
  },
  {
    ref: 'AC6',
    kind: 'criterion',
    content:
      'After dragging nodes and reloading, node positions and the active layout choice are both restored.',
  },
  {
    ref: 'AC7',
    kind: 'criterion',
    content: 'Each relation kind renders with a distinct edge style matching the legend.',
  },
  {
    ref: 'AC8',
    kind: 'criterion',
    content:
      'Selecting a canvas node opens the same refinement affordance as selecting the corresponding row in the structured list.',
  },
];

const spatialEdges: ReadonlyArray<{ source: string; relation: EdgeRelation; target: string }> = [
  // verifies (criterion → requirement) — full coverage of buildable R1–R6.
  { source: 'AC1', relation: 'verifies', target: 'R1' },
  { source: 'AC2', relation: 'verifies', target: 'R2' },
  { source: 'AC3', relation: 'verifies', target: 'R2' },
  { source: 'AC4', relation: 'verifies', target: 'R2' },
  { source: 'AC5', relation: 'verifies', target: 'R3' },
  { source: 'AC6', relation: 'verifies', target: 'R4' },
  { source: 'AC6', relation: 'verifies', target: 'R1' }, // one criterion verifies two requirements
  { source: 'AC7', relation: 'verifies', target: 'R5' },
  { source: 'AC8', relation: 'verifies', target: 'R6' },
  // Epistemic edges (the real graph shape): assumptions/decisions/constraints
  // point AT requirements; never req→req execution order. Projection must ignore
  // these for ordering.
  { source: 'A1', relation: 'depends_on', target: 'R2' },
  { source: 'D1', relation: 'depends_on', target: 'R3' },
  { source: 'D2', relation: 'depends_on', target: 'R4' },
  { source: 'K1', relation: 'constrains', target: 'R2' },
  { source: 'K1', relation: 'constrains', target: 'R4' },
  { source: 'D2', relation: 'derived_from', target: 'K1' },
  // Adversarial: the only req→req edge. A `refines` link is epistemic, NOT build
  // order — a graph read must not synthesize ordering from it.
  { source: 'R5', relation: 'refines', target: 'R2' },
];

function buildSpatialReviewItems(specs: readonly SpatialKnowledgeSpec[], kind: KnowledgeKind) {
  return specs.map((spec, index) => ({
    reviewItemId: `${kind === 'requirement' ? 'requirements' : 'criteria'}:${index + 1}`,
    referenceCode: code(kind, index + 1),
    content: spec.content,
    rationale: `Captured for the spatial-graph-layout spec (${spec.ref}).`,
    grounding: [{ code: code('goal', 1) }],
  }));
}

/**
 * Seeds a completed spatial-graph-layout specification: grounding + design closed,
 * requirements + criteria reviews accepted, 9 supporting knowledge items, 8
 * requirements, 8 criteria, and 16 typed edges. The graph is the completed-spec
 * fixture described in docs/fixtures/spatial-graph-layout-interview.md.
 */
export function seedAcceptedSpatialGraphLayoutSpec(db: DB, projectId: number) {
  const idByRef: Record<string, number> = {};
  const kindByRef: Record<string, KnowledgeKind> = {};

  // ---- Grounding: brownfield + incremental posture, the goal, the hard "must nots" ----
  const gNovelty = createTurn(db, projectId, {
    phase: 'grounding',
    impact: 'high',
    question: 'Is this a fresh idea, or a change to something that already exists in this workspace?',
    answer:
      'Brownfield. Graph mode already ships a structured-list layout and a graph-launched refinement affordance; this adds a second layout.',
  });
  advanceHead(db, projectId, gNovelty.id);
  captureSpatialKnowledge(db, projectId, gNovelty.id, 'g-novelty', idByRef, kindByRef);

  const gPosture = createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: gNovelty.id,
    impact: 'medium',
    question:
      'Are we specifying the whole graph-mode surface end-to-end, or one bounded feature on top of it?',
    answer:
      'Incremental feature — just the spatial layout switch; everything else in graph mode stays as-is.',
  });
  advanceHead(db, projectId, gPosture.id);

  const gGoal = createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: gPosture.id,
    impact: 'high',
    question:
      "What's the user-facing goal — what should someone be able to do after this ships that they can't today?",
    answer:
      'Grasp the topology of their intent graph at a glance — clusters, hubs, and how items relate spatially — instead of scanning a flat list. It is about comprehension of structure.',
  });
  advanceHead(db, projectId, gGoal.id);
  captureSpatialKnowledge(db, projectId, gGoal.id, 'g-goal', idByRef, kindByRef);

  const gConstraints = createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: gGoal.id,
    impact: 'high',
    question: 'Any hard lines — things this must not do?',
    answer:
      "Positions are view-state only — dragging a node never changes the graph's meaning, an item's content, or any edge. It must not replace or disable the structured list; it is additive. And no spatial layout outside graph mode — chat view stays as-is.",
  });
  advanceHead(db, projectId, gConstraints.id);
  captureSpatialKnowledge(db, projectId, gConstraints.id, 'g-constraints', idByRef, kindByRef);

  const groundingProposalTurn = createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: gConstraints.id,
    question: '',
    answer: 'We have enough grounding context',
    assistant_parts: serializeFixturePhaseProposalAssistantParts({
      turnId: gConstraints.id + 1,
      phase: 'grounding',
      summary:
        'Brownfield/incremental posture, the spatial-comprehension goal, canvas/layout-switch terms, and the view-state-only / additive constraints are captured.',
    }),
  });
  advanceHead(db, projectId, groundingProposalTurn.id);
  const groundingOutcome = createPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'grounding',
    proposal_turn_id: groundingProposalTurn.id,
    summary: 'Grounding context for the spatial layout switch is sufficiently captured.',
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

  // ---- Design: deterministic auto-layout, per-.brunch persistence, data-layer assumption ----
  const dLayout = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: groundingConfirmTurn.id,
    impact: 'medium',
    question:
      'For the initial arrangement when a canvas is first opened — computed automatically, or placed by hand?',
    answer:
      'Automatic. On first open it should already be readable — no overlaps, everything in view — via a deterministic topology-seeded layout, not random placement that jumps every reload.',
  });
  advanceHead(db, projectId, dLayout.id);
  captureSpatialKnowledge(db, projectId, dLayout.id, 'd-layout', idByRef, kindByRef);

  const dPersist = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: dLayout.id,
    impact: 'medium',
    question: 'Once it is auto-arranged, can the user adjust it — and where do positions live?',
    answer:
      'Drag to reposition, and positions persist per spec and come back on reload — stored in local .brunch state, not in the intent graph, to keep them out of the semantic layer.',
  });
  advanceHead(db, projectId, dPersist.id);
  captureSpatialKnowledge(db, projectId, dPersist.id, 'd-persist', idByRef, kindByRef);

  const dData = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: dPersist.id,
    impact: 'low',
    question: 'Anything about the data path I should record as an assumption?',
    answer:
      'Assume the existing graph data layer can hand the canvas all items and typed edges without a new query surface.',
  });
  advanceHead(db, projectId, dData.id);
  captureSpatialKnowledge(db, projectId, dData.id, 'd-data', idByRef, kindByRef);

  const designProposalTurn = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: dData.id,
    question: '',
    answer: 'We have enough design context',
    assistant_parts: serializeFixturePhaseProposalAssistantParts({
      turnId: dData.id + 1,
      phase: 'design',
      summary:
        'Deterministic auto-layout, per-spec position persistence in .brunch, and the graph-data-layer assumption are captured.',
    }),
  });
  advanceHead(db, projectId, designProposalTurn.id);
  const designOutcome = createPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'design',
    proposal_turn_id: designProposalTurn.id,
    summary:
      'The design commitments for the spatial layout switch are captured well enough to review requirements.',
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

  // Requirements review (accepted).
  const requirementsReviewTurn = createTurn(db, projectId, {
    phase: 'requirements',
    parent_turn_id: designConfirmTurn.id,
    question: 'Please review the current requirement set.',
    why: 'Review the whole requirement set before moving forward.',
    impact: 'high',
    answer: 'Accept review',
    assistant_parts: serializeFixtureQuestionAssistantParts({
      turnId: 0,
      toolCallId: 'fixture-spatial-requirements-review',
      input: createFixtureReviewQuestionInput({
        phase: 'requirements',
        title: 'Requirements',
        prompt: 'Please review the current requirement set.',
        why: 'Review the whole requirement set before moving forward.',
        items: buildSpatialReviewItems(spatialRequirements, 'requirement'),
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
  for (const spec of spatialRequirements) {
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

  // Criteria review (accepted).
  const criteriaReviewTurn = createTurn(db, projectId, {
    phase: 'criteria',
    parent_turn_id: requirementsReviewTurn.id,
    question: 'Please review the current criterion set.',
    why: 'Review the whole criterion set before moving forward.',
    impact: 'high',
    answer: 'Accept review',
    assistant_parts: serializeFixtureQuestionAssistantParts({
      turnId: 0,
      toolCallId: 'fixture-spatial-criteria-review',
      input: createFixtureReviewQuestionInput({
        phase: 'criteria',
        title: 'Acceptance Criteria',
        prompt: 'Please review the current criterion set.',
        why: 'Review the whole criterion set before moving forward.',
        items: buildSpatialReviewItems(spatialCriteria, 'criterion'),
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
  for (const spec of spatialCriteria) {
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

  // Typed edges (policy-guarded, same posture as seedKnowledgeGraphPermutations).
  for (const edge of spatialEdges) {
    const sourceId = idByRef[edge.source];
    const targetId = idByRef[edge.target];
    if (sourceId === undefined || targetId === undefined) {
      throw new Error(`Spatial-graph-layout fixture references unknown ref: ${edge.source} → ${edge.target}`);
    }
    if (!supportsKnowledgeRelationship(edge.relation, kindByRef[edge.source]!, kindByRef[edge.target]!)) {
      throw new Error(
        `Spatial-graph-layout fixture violates relation policy: ${edge.source} -[${edge.relation}]-> ${edge.target}`,
      );
    }
    addKnowledgeRelationship(db, sourceId, targetId, edge.relation);
  }

  return { requirementsReviewTurn, criteriaReviewTurn, idByRef };
}
