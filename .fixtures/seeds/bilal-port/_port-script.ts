/**
 * One-off prep step: convert Bilal's spec-elicitation-prototype graph data
 * into the brunch-shaped consolidated seed contract.
 *
 * Throwaway data-prep, not product code. Lives co-located with the data it
 * vendors and produces, under .fixtures/seeds/bilal-port/ (the .fixtures/**
 * tree is excluded from oxlint/oxfmt/build by project config). The product
 * seed loader (src/graph/seed-fixtures.ts) reads ONLY the consolidated <slug>.json
 * output and never knows Bilal's format exists.
 *
 * Run with:
 *   npx tsx .fixtures/seeds/bilal-port/_port-script.ts
 *
 * Source (vendored, read-only):
 *   ./_originals/<slug>/{nodes,edges}.json
 *
 * Output (consolidated seed contract, one file per spec):
 *   ./<slug>.json   →  { spec, nodes, edges }
 *
 * Mapping rules (derived in thread T-019e91ee, summarized below):
 *
 *   Decision hubs (kind=hub, hubType=decision) collapse with their
 *   alternative-spoke neighbors into a single brunch `decision` node
 *   with detail.{chosen_option, rejected[], rationale}. The selected
 *   alternative becomes chosen_option; rejected+considered alternatives
 *   merge into rejected[]; the hub's rationale string becomes
 *   detail.rationale.
 *
 *   Justification hubs (kind=hub, hubType=justification) emit as
 *   `context` nodes — the synthesized claim is the title/body, the
 *   long-form rationale is appended to body. Their incoming/outgoing
 *   edges port normally.
 *
 *   Content nodes map by semanticRole:
 *     goal, context, term, constraint, requirement, criterion
 *       → intent plane / same kind (verbatim)
 *     evidence → oracle plane / evidence
 *       (plus one synthetic check per spec, "Code-audit pass", as the
 *        realization parent of every evidence node)
 *     risk → intent plane / context (per oracle guidance: blanket
 *       risk→assumption would falsify graph mechanics; context is the
 *       safe last-resort bucket. Source field flags for curation.)
 *     design → intent plane / context with source flag for curation
 *       (most are actually decisions or modules but lack the structural
 *        material to prove it; flagged as 'derived-design-statement')
 *     alternative → absorbed into parent decision (never emitted)
 *
 *   Edge type → brunch category:
 *     considered, rejected, selected → absorbed (never emitted)
 *     informed_by → support[for]
 *     produced → realization
 *     consequence → dependency (source = cause/upstream)
 *     derived_from → dependency if target kind is structural-decisional
 *                    (context, term, constraint, decision, goal, thesis,
 *                     requirement, criterion);
 *                    else support[for] (for observational targets:
 *                    evidence, assumption, context-as-risk-rewrite)
 *
 *   Field translation:
 *     authority → source ("stakeholder" | "technical" | "external" |
 *                         "derived")
 *     epistemicStatus: does NOT affect basis. Every ported node is
 *       basis: "explicit" — Bilal authored each item directly, which is
 *       exact per-item approval (brunch "implicit" basis is reserved for
 *       propose-graph-concept acceptance, a notion Bilal's data lacks).
 *       The epistemic flavor survives as source text instead: it is
 *       concatenated to source when not "asserted" (e.g.
 *        "stakeholder-observed", "external-inferred").
 *     displayId → preserved as bracket suffix in source: "stakeholder [Q9]"
 *
 *   Discarded: phase, frameId, lifecycle (all active), reviewStatus
 *     (all clean), provenance (already empty), createdAt.
 *
 * Re-run safely: each <slug>.json is overwritten on each run.
 *
 * Self-validating: before writing each file, the assembled seed is run
 * through the real loader (src/graph/seed-fixtures.ts) against a throwaway
 * in-memory DB, which exercises the same structural validation commitGraph
 * enforces. A seed that would not commit cleanly aborts the run instead of
 * being written, so every <slug>.json on disk is guaranteed loadable.
 *
 * Reproducible: reads from the vendored ./_originals/ tree, not an external
 * checkout. Anyone can regenerate the seed contracts from this directory alone.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDb } from '../../../src/db/connection.js';
import { CommandExecutor } from '../../../src/graph/command-executor.js';
import { seedFixture, type SeedFixture } from '../../../src/graph/seed-fixtures.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ORIGINALS_ROOT = resolve(SCRIPT_DIR, '_originals');
const OUTPUT_ROOT = SCRIPT_DIR;

const SPECS: { source: string; slug: string; displayName: string }[] = [
  { source: 'code-health', slug: 'code-health', displayName: 'Code Health' },
  { source: 'explorer-ui', slug: 'explorer-ui', displayName: 'Explorer UI' },
  { source: 'macro-view', slug: 'macro-view', displayName: 'Macro View' },
];

// ---------------------------------------------------------------------------
// Source shape (Bilal)
// ---------------------------------------------------------------------------

type BilalSemanticRole =
  | 'goal'
  | 'context'
  | 'term'
  | 'constraint'
  | 'requirement'
  | 'criterion'
  | 'evidence'
  | 'risk'
  | 'design'
  | 'alternative';

interface BilalNode {
  id: string; // uuid
  displayId: string;
  specId: string;
  frameId: string;
  phase: string;
  text: string;
  lifecycle: string;
  reviewStatus: { _tag: string };
  provenance: unknown[];
  createdAt: string;
  kind: 'content' | 'hub';
  semanticRole?: BilalSemanticRole | null;
  epistemicStatus?: 'asserted' | 'inferred' | 'observed' | 'assumed' | null;
  authority?: 'external' | 'stakeholder' | 'technical' | 'derived' | null;
  hubType?: 'decision' | 'justification' | null;
  rationale?: string | null;
}

type BilalEdgeType =
  | 'derived_from'
  | 'considered'
  | 'rejected'
  | 'selected'
  | 'informed_by'
  | 'consequence'
  | 'produced';

interface BilalEdge {
  id: string;
  source: { specId: string; nodeId: string };
  target: { specId: string; nodeId: string };
  type: BilalEdgeType;
  rationale: string | null;
  provenance: unknown[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Output shape (brunch-flavored — column names match src/db/schema.ts;
// integer IDs are local-to-spec and treated as placeholders for
// autoincrement at load time)
// ---------------------------------------------------------------------------

type Plane = 'intent' | 'oracle' | 'design' | 'plan';

interface BrunchNodeFixture {
  local_id: number;
  plane: Plane;
  kind: string;
  title: string;
  body: string | null;
  basis: 'explicit';
  source: string | null;
  detail: Record<string, unknown> | null;
}

interface BrunchEdgeFixture {
  category:
    | 'dependency'
    | 'proof'
    | 'support'
    | 'realization'
    | 'boundary'
    | 'composition'
    | 'association'
    | 'supersession';
  source_local_id: number;
  target_local_id: number;
  stance: 'for' | 'against' | null;
  basis: 'explicit';
  rationale: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Brunch decision-detail target kinds (drive derived_from → dependency vs support). */
const STRUCTURAL_DECISIONAL_KINDS = new Set([
  'goal',
  'thesis',
  'term',
  'context',
  'requirement',
  'constraint',
  'invariant',
  'decision',
  'criterion',
]);

/** First sentence (≤ N chars) used as a node title when full text is long. */
function deriveTitle(text: string, max = 140): string {
  const trimmed = text.trim();
  const firstSentenceEnd = trimmed.search(/[.!?](\s|$)/);
  const candidate = firstSentenceEnd > 0 ? trimmed.slice(0, firstSentenceEnd + 1) : trimmed;
  if (candidate.length <= max) return candidate;
  return candidate.slice(0, max - 1).trimEnd() + '…';
}

/**
 * Project Bilal authority + epistemicStatus into brunch source + basis.
 *
 * basis is always "explicit": Bilal authored each item directly (exact
 * per-item approval). The epistemic flavor is preserved in source text,
 * not basis. brunch "implicit" basis is reserved for propose-graph-concept
 * acceptance, which Bilal's data has no notion of.
 */
function projectProvenance(node: BilalNode): {
  basis: 'explicit';
  source: string | null;
} {
  const basis = 'explicit' as const;

  const parts: string[] = [];
  if (node.authority) parts.push(node.authority);
  if (node.epistemicStatus && node.epistemicStatus !== 'asserted') {
    parts.push(node.epistemicStatus);
  }
  const flavor = parts.join('-');
  const tag = node.displayId ? ` [${node.displayId}]` : '';
  const source = flavor || tag ? `${flavor}${tag}`.trim() : null;
  return { basis, source };
}

// ---------------------------------------------------------------------------
// Decision hub collapse
// ---------------------------------------------------------------------------

interface DecisionCluster {
  hubId: string;
  hubNode: BilalNode;
  selectedAltIds: string[];
  rejectedAltIds: string[];
  consideredAltIds: string[];
}

/** Index decision hubs and their spoke alternatives. */
function buildDecisionClusters(
  nodes: BilalNode[],
  edges: BilalEdge[],
): { clusters: Map<string, DecisionCluster>; absorbedAltIds: Set<string>; absorbedEdgeIds: Set<string> } {
  const clusters = new Map<string, DecisionCluster>();
  const absorbedAltIds = new Set<string>();
  const absorbedEdgeIds = new Set<string>();

  const hubIds = new Set(nodes.filter((n) => n.kind === 'hub' && n.hubType === 'decision').map((n) => n.id));

  for (const hubId of hubIds) {
    const hubNode = nodes.find((n) => n.id === hubId);
    if (!hubNode) continue;
    clusters.set(hubId, {
      hubId,
      hubNode,
      selectedAltIds: [],
      rejectedAltIds: [],
      consideredAltIds: [],
    });
  }

  // Bilal's spoke-edge direction is asymmetric:
  //   selected, rejected: source = hub,         target = alternative
  //   considered:         source = alternative, target = hub
  // Handle both directions defensively for all three types.
  for (const edge of edges) {
    if (edge.type !== 'selected' && edge.type !== 'rejected' && edge.type !== 'considered') continue;

    const fromHubCluster = clusters.get(edge.source.nodeId);
    const toHubCluster = clusters.get(edge.target.nodeId);
    const cluster = fromHubCluster ?? toHubCluster;
    if (!cluster) continue;
    const altId = fromHubCluster ? edge.target.nodeId : edge.source.nodeId;

    if (edge.type === 'selected') cluster.selectedAltIds.push(altId);
    else if (edge.type === 'rejected') cluster.rejectedAltIds.push(altId);
    else cluster.consideredAltIds.push(altId);

    absorbedAltIds.add(altId);
    absorbedEdgeIds.add(edge.id);
  }

  return { clusters, absorbedAltIds, absorbedEdgeIds };
}

// ---------------------------------------------------------------------------
// Classification: bilal node → brunch (plane, kind, body, detail)
// ---------------------------------------------------------------------------

interface BrunchClassification {
  plane: Plane;
  kind: string;
  title: string;
  body: string | null;
  detail: Record<string, unknown> | null;
  sourceFlag?: string;
}

function classifyContentNode(node: BilalNode): BrunchClassification | null {
  const role = node.semanticRole;
  const text = node.text;

  switch (role) {
    case 'goal':
    case 'context':
    case 'constraint':
    case 'requirement':
    case 'criterion':
      return {
        plane: 'intent',
        kind: role,
        title: deriveTitle(text),
        body: text,
        detail: null,
      };

    case 'term':
      // brunch requires detail.definition for term nodes
      return {
        plane: 'intent',
        kind: 'term',
        title: deriveTitle(text, 80),
        body: null,
        detail: { definition: text },
      };

    case 'evidence':
      return {
        plane: 'oracle',
        kind: 'evidence',
        title: deriveTitle(text),
        body: text,
        detail: null,
      };

    case 'risk':
      return {
        plane: 'intent',
        kind: 'context',
        title: deriveTitle(text),
        body: text,
        detail: null,
        sourceFlag: 'derived-risk-or-question',
      };

    case 'design':
      return {
        plane: 'intent',
        kind: 'context',
        title: deriveTitle(text),
        body: text,
        detail: null,
        sourceFlag: 'derived-design-statement',
      };

    case 'alternative':
      // absorbed at decision-cluster phase; should not reach here
      return null;

    default:
      return null;
  }
}

function classifyDecisionCluster(
  cluster: DecisionCluster,
  altNodeIndex: Map<string, BilalNode>,
): BrunchClassification {
  const hub = cluster.hubNode;
  const selectedNode = cluster.selectedAltIds
    .map((id) => altNodeIndex.get(id))
    .find((n): n is BilalNode => Boolean(n));

  const rejectedSet = new Set<string>();
  for (const id of [...cluster.rejectedAltIds, ...cluster.consideredAltIds]) {
    if (cluster.selectedAltIds.includes(id)) continue;
    const altNode = altNodeIndex.get(id);
    if (!altNode) continue;
    rejectedSet.add(altNode.text);
  }
  const rejected = [...rejectedSet];
  if (rejected.length === 0) {
    // hub had only selected alternatives; brunch requires ≥1 rejected.
    // mark explicitly so curation can find these.
    rejected.push('(no alternatives recorded in source data)');
  }

  const chosenOption = selectedNode ? selectedNode.text : hub.text;

  return {
    plane: 'intent',
    kind: 'decision',
    title: deriveTitle(hub.text),
    body: hub.text,
    detail: {
      chosen_option: chosenOption,
      rejected,
      rationale: hub.rationale ?? '',
    },
  };
}

function classifyJustificationHub(node: BilalNode): BrunchClassification {
  const bodyParts: string[] = [node.text];
  if (node.rationale) bodyParts.push('', '## Rationale', '', node.rationale);
  return {
    plane: 'intent',
    kind: 'context',
    title: deriveTitle(node.text),
    body: bodyParts.join('\n'),
    detail: null,
    sourceFlag: 'derived-justification-synthesis',
  };
}

// ---------------------------------------------------------------------------
// Edge mapping
// ---------------------------------------------------------------------------

interface EdgeMapping {
  category: BrunchEdgeFixture['category'];
  stance: 'for' | 'against' | null;
}

function mapEdge(edge: BilalEdge, targetBrunchKind: string | null): EdgeMapping | null {
  switch (edge.type) {
    case 'considered':
    case 'rejected':
    case 'selected':
      return null; // absorbed

    case 'informed_by':
      return { category: 'support', stance: 'for' };

    case 'produced':
      return { category: 'realization', stance: null };

    case 'consequence':
      // bilal: source caused target. brunch: source(dependency) → target(dependent)
      return { category: 'dependency', stance: null };

    case 'derived_from':
      if (targetBrunchKind && STRUCTURAL_DECISIONAL_KINDS.has(targetBrunchKind)) {
        return { category: 'dependency', stance: null };
      }
      return { category: 'support', stance: 'for' };

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Per-spec porter
// ---------------------------------------------------------------------------

interface SpecPortResult {
  slug: string;
  brunchNodes: BrunchNodeFixture[];
  brunchEdges: BrunchEdgeFixture[];
  stats: Record<string, number>;
  bilalDisplayIdByLocalId: Map<number, string>;
}

function portSpec(sourceName: string, slug: string, displayName: string): SpecPortResult {
  const sourceDir = resolve(ORIGINALS_ROOT, sourceName);
  const nodes = JSON.parse(readFileSync(resolve(sourceDir, 'nodes.json'), 'utf8')) as BilalNode[];
  const edges = JSON.parse(readFileSync(resolve(sourceDir, 'edges.json'), 'utf8')) as BilalEdge[];

  // Index nodes by bilal uuid for fast lookup
  const nodeIndex = new Map<string, BilalNode>();
  for (const n of nodes) nodeIndex.set(n.id, n);

  // Phase 1: identify decision clusters and absorbed entities
  const { clusters, absorbedAltIds, absorbedEdgeIds } = buildDecisionClusters(nodes, edges);

  // Phase 2: emit brunch nodes, building bilal-uuid → local-id map
  const brunchNodes: BrunchNodeFixture[] = [];
  const bilalUuidToLocalId = new Map<string, number>();
  const localKindByLocalId = new Map<number, string>();
  const bilalDisplayIdByLocalId = new Map<number, string>();
  let nextLocalId = 1;

  // 2a. one synthetic "code-audit pass" check, parent of all oracle/evidence
  let auditCheckLocalId: number | null = null;
  const hasEvidence = nodes.some((n) => n.kind === 'content' && n.semanticRole === 'evidence');
  if (hasEvidence) {
    auditCheckLocalId = nextLocalId++;
    brunchNodes.push({
      local_id: auditCheckLocalId,
      plane: 'oracle',
      kind: 'check',
      title: `${displayName} — code-audit pass`,
      body:
        `Synthetic parent check representing the manual code-audit pass during which ` +
        `evidence nodes were authored. Generated by ` +
        `.fixtures/seeds/bilal-port/_port-script.ts to give imported evidence ` +
        `a structural parent on the oracle plane.`,
      basis: 'explicit',
      source: 'derived-port-synthetic',
      detail: null,
    });
    localKindByLocalId.set(auditCheckLocalId, 'check');
  }

  // 2b. content nodes (skip absorbed alternatives)
  for (const node of nodes) {
    if (node.kind !== 'content') continue;
    if (absorbedAltIds.has(node.id)) continue;

    const classification = classifyContentNode(node);
    if (!classification) continue;

    const { basis, source: provenanceSource } = projectProvenance(node);
    const source = classification.sourceFlag
      ? `${classification.sourceFlag} | ${provenanceSource ?? ''}`.trim().replace(/\| $/, '').trim()
      : provenanceSource;

    const localId = nextLocalId++;
    bilalUuidToLocalId.set(node.id, localId);
    localKindByLocalId.set(localId, classification.kind);
    bilalDisplayIdByLocalId.set(localId, node.displayId);

    brunchNodes.push({
      local_id: localId,
      plane: classification.plane,
      kind: classification.kind,
      title: classification.title,
      body: classification.body,
      basis,
      source,
      detail: classification.detail,
    });
  }

  // 2c. decision hubs (collapsed clusters)
  for (const cluster of clusters.values()) {
    const classification = classifyDecisionCluster(cluster, nodeIndex);
    const { basis, source: provenanceSource } = projectProvenance(cluster.hubNode);

    const localId = nextLocalId++;
    bilalUuidToLocalId.set(cluster.hubId, localId);
    localKindByLocalId.set(localId, classification.kind);
    bilalDisplayIdByLocalId.set(localId, cluster.hubNode.displayId);
    // Also map all absorbed alternative ids to the decision local id,
    // so any external edge referencing an absorbed alternative redirects
    // to the parent decision.
    for (const altId of [...cluster.selectedAltIds, ...cluster.rejectedAltIds, ...cluster.consideredAltIds]) {
      bilalUuidToLocalId.set(altId, localId);
    }

    brunchNodes.push({
      local_id: localId,
      plane: classification.plane,
      kind: classification.kind,
      title: classification.title,
      body: classification.body,
      basis,
      source: provenanceSource,
      detail: classification.detail,
    });
  }

  // 2d. justification hubs (as context)
  for (const node of nodes) {
    if (node.kind !== 'hub' || node.hubType !== 'justification') continue;

    const classification = classifyJustificationHub(node);
    const { basis, source: provenanceSource } = projectProvenance(node);
    const source = classification.sourceFlag
      ? `${classification.sourceFlag} | ${provenanceSource ?? ''}`.trim().replace(/\| $/, '').trim()
      : provenanceSource;

    const localId = nextLocalId++;
    bilalUuidToLocalId.set(node.id, localId);
    localKindByLocalId.set(localId, classification.kind);
    bilalDisplayIdByLocalId.set(localId, node.displayId);

    brunchNodes.push({
      local_id: localId,
      plane: classification.plane,
      kind: classification.kind,
      title: classification.title,
      body: classification.body,
      basis,
      source,
      detail: classification.detail,
    });
  }

  // Phase 3: emit brunch edges
  const brunchEdges: BrunchEdgeFixture[] = [];
  const stats = {
    nodes_in: nodes.length,
    edges_in: edges.length,
    nodes_emitted: brunchNodes.length,
    edges_emitted: 0,
    edges_absorbed: 0,
    edges_dropped_self_after_collapse: 0,
    edges_dropped_unresolved_endpoint: 0,
  };

  // 3a. synthesize one realization edge per evidence node, from the audit check
  if (auditCheckLocalId !== null) {
    for (const node of nodes) {
      if (node.kind !== 'content' || node.semanticRole !== 'evidence') continue;
      const evidenceLocalId = bilalUuidToLocalId.get(node.id);
      if (evidenceLocalId === undefined) continue;
      brunchEdges.push({
        category: 'realization',
        source_local_id: auditCheckLocalId,
        target_local_id: evidenceLocalId,
        stance: null,
        basis: 'explicit',
        rationale: null,
      });
    }
  }

  // 3b. port real edges
  for (const edge of edges) {
    if (absorbedEdgeIds.has(edge.id)) {
      stats.edges_absorbed++;
      continue;
    }
    const sourceLocalId = bilalUuidToLocalId.get(edge.source.nodeId);
    const targetLocalId = bilalUuidToLocalId.get(edge.target.nodeId);
    if (sourceLocalId === undefined || targetLocalId === undefined) {
      stats.edges_dropped_unresolved_endpoint++;
      continue;
    }
    if (sourceLocalId === targetLocalId) {
      // Self-edge after decision-cluster collapse — typically a `consequence`
      // or `derived_from` edge where the original target was the selected
      // alternative of the same decision (now folded into chosen_option).
      // Semantically degenerate after flattening; safe to drop.
      stats.edges_dropped_self_after_collapse++;
      continue;
    }
    const targetKind = localKindByLocalId.get(targetLocalId) ?? null;
    const mapping = mapEdge(edge, targetKind);
    if (!mapping) {
      stats.edges_absorbed++;
      continue;
    }
    brunchEdges.push({
      category: mapping.category,
      source_local_id: sourceLocalId,
      target_local_id: targetLocalId,
      stance: mapping.stance,
      basis: 'explicit',
      rationale: edge.rationale,
    });
  }
  stats.edges_emitted = brunchEdges.length;

  return { slug, brunchNodes, brunchEdges, stats, bilalDisplayIdByLocalId };
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

/** Assemble the consolidated seed contract — one file per spec, atomic seed unit. */
function buildSeed(result: SpecPortResult, displayName: string): SeedFixture {
  return {
    spec: { slug: result.slug, name: displayName, readiness_grade: 'commitments_ready' },
    nodes: result.brunchNodes,
    edges: result.brunchEdges,
  };
}

/**
 * Validate a seed against the real loader before it is written, so every
 * <slug>.json on disk is guaranteed to commit cleanly. This reuses the exact
 * structural checks commitGraph enforces — seedFixture → CommandExecutor
 * .createSpec + .commitGraph → planCommitGraph (node kind/plane/detail and
 * edge category/stance/ref/cycle validation) — against a throwaway in-memory
 * DB. seedFixture throws with diagnostics on any structural rejection.
 */
function validateSeed(seed: SeedFixture): void {
  const executor = new CommandExecutor(createDb(':memory:'));
  seedFixture(executor, seed);
}

function writeSpec(seed: SeedFixture): void {
  writeFileSync(resolve(OUTPUT_ROOT, `${seed.spec.slug}.json`), JSON.stringify(seed, null, 2) + '\n');
}

function writeReadme(results: { slug: string; displayName: string; stats: Record<string, number> }[]): void {
  const lines: string[] = [
    '# `.fixtures/seeds/bilal-port/`',
    '',
    "Ported spec graphs from Bilal's spec-elicitation prototype, transformed",
    'to the brunch graph model. Intended as development seed data — rich,',
    'real spec material to populate a dev SQLite database for UI / agent work.',
    '',
    'Not probe-run artifacts; sits under `.fixtures/seeds/` alongside',
    '`.fixtures/runs/` rather than inside it.',
    '',
    '## Provenance',
    '',
    'Source: vendored under [`_originals/`](./_originals/) — copied from',
    "Bilal's spec-elicitation prototype `spec/<slug>/graph/{nodes,edges}.json`.",
    '',
    'Each `<slug>.json` is generated from `_originals/` by',
    '[`_port-script.ts`](./_port-script.ts) (a throwaway data-prep step,',
    'not product code). Re-runnable from this directory alone; each run',
    'overwrites the `<slug>.json` files.',
    '',
    '## Transformation rules',
    '',
    'See the header docstring of the port script for the full mapping rules,',
    'including: decision-hub-and-spoke collapse, justification-hub absorption,',
    'evidence → oracle plane (with one synthetic per-spec `check`),',
    '`risk` and `design` → `context` with source flags for curation,',
    'and the `derived_from` → dependency-vs-support rule keyed on target kind.',
    '',
    'Curation flags carried in the `source` field:',
    '',
    '- `derived-risk-or-question` — was Bilal `risk` semanticRole; many are',
    '  literally "Open question (Q##): ..." phrased; per the interrogative',
    '  normalization rule in `docs/design/GRAPH_MODEL.md`, curate into',
    '  `assumption`, `criterion`, or keep as `context`.',
    '- `derived-design-statement` — was Bilal `design` semanticRole; lacks',
    '  the structural material to prove a real decision/module; curate into',
    '  `decision` (if alternatives recoverable from history), or design plane',
    '  `module`/`interface` (if it actually names code).',
    '- `derived-justification-synthesis` — was a Bilal `hub:justification`;',
    '  rationale appended to body. Curate per case.',
    '- `derived-port-synthetic` — node minted by the port script itself',
    '  (currently only the per-spec audit `check`).',
    '',
    '## Output layout',
    '',
    '```',
    'bilal-port/',
    '├── README.md         # this file (generated)',
    '├── _port-script.ts   # throwaway prep: _originals/ → <slug>.json',
    '├── _originals/       # vendored Bilal source (reproducibility)',
    '│   └── <slug>/{nodes,edges}.json',
    '└── <slug>.json       # consolidated seed contract (× 3)',
    '```',
    '',
    'Each `<slug>.json` is the seed contract consumed by the loader:',
    '',
    '```',
    '{',
    '  "spec":  { "slug", "name", "readiness_grade" },',
    '  "nodes": [ { "local_id", "plane", "kind", "title", "body?", "basis", "source?", "detail?" } ],',
    '  "edges": [ { "category", "source_local_id", "target_local_id", "stance?", "basis", "rationale?" } ]',
    '}',
    '```',
    '',
    'Node/edge field shape mirrors [`src/db/schema.ts`](../../../src/db/schema.ts)',
    'column names. `local_id` is a placeholder for autoincrement; edges reference',
    'nodes by `local_id`. No LSNs or change-log entries are pre-baked — the loader',
    '([`src/graph/seed-fixtures.ts`](../../../src/graph/seed-fixtures.ts)) wraps each spec',
    'in one `commitGraph` transaction so the graph clock, change log, and lsn',
    "columns stay coherent under brunch's mutation contract.",
    '',
    '## Stats',
    '',
    '| Spec | nodes in | edges in | nodes emitted | edges emitted | edges absorbed | self-after-collapse drops | unresolved-endpoint drops |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const r of results) {
    const s = r.stats;
    lines.push(
      `| ${r.slug} | ${s.nodes_in} | ${s.edges_in} | ${s.nodes_emitted} | ${s.edges_emitted} | ${s.edges_absorbed} | ${s.edges_dropped_self_after_collapse} | ${s.edges_dropped_unresolved_endpoint} |`,
    );
  }
  lines.push('');
  writeFileSync(resolve(OUTPUT_ROOT, 'README.md'), lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  if (!existsSync(ORIGINALS_ROOT)) {
    console.error(`Vendored originals not found at ${ORIGINALS_ROOT}`);
    process.exit(1);
  }

  const summaries: { slug: string; displayName: string; stats: Record<string, number> }[] = [];
  for (const spec of SPECS) {
    console.log(`Porting ${spec.source} → ${spec.slug}.json...`);
    const result = portSpec(spec.source, spec.slug, spec.displayName);
    const seed = buildSeed(result, spec.displayName);
    validateSeed(seed); // throws if the seed would not commit cleanly
    writeSpec(seed);
    summaries.push({ slug: spec.slug, displayName: spec.displayName, stats: result.stats });
    console.log(`  ${JSON.stringify(result.stats)}`);
  }
  writeReadme(summaries);
  console.log(`\nDone. Output at ${OUTPUT_ROOT}`);
}

main();
