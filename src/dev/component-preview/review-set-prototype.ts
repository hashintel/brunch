// PROTOTYPE — delete or absorb after verdict

import { type Component, Key, matchesKey } from '@earendil-works/pi-tui';
import { getBorderCharacters, table, type SpanningCellConfig, type TableUserConfig } from 'table';

import { ExchangeReviewSetResultComponent } from '../../.pi/components/exchange-review-set-result.js';
import { safeLines, type LabTheme } from '../../.pi/components/tui-lab/index.js';
import { projectPresentReviewSet } from '../../exchanges/projections/present-review-set.js';
import type { ReviewSetProposalPayload } from '../../graph/review-set.js';
import type { NodeKind } from '../../graph/schema/nodes.js';

const REVIEW_SET_PAYLOAD = {
  schemaVersion: 1,
  lens: 'design',
  epistemicStatus: 'asserted',
  grounding: {
    summary: 'Review the proposed review-set reading before changing the settlement interaction.',
    support: [
      'FE-1187 asks for a fair current-versus-proposed comparison.',
      'The existing transcript renderer is the current production baseline.',
    ],
  },
  pitch: {
    title: 'Whole-set review readability',
    narrative:
      'Assess these seventeen proposed graph claims and eleven relations as one review-set decision.',
  },
  entityDrafts: [
    {
      draftId: 'goal-review',
      proposedCode: 'G1',
      plane: 'intent',
      kind: 'goal',
      title: 'Review this proposed set as one coherent decision before settlement changes are made',
    },
    {
      draftId: 'req-decision',
      proposedCode: 'REQ1',
      plane: 'intent',
      kind: 'requirement',
      title: 'The settlement interaction should preserve one whole-set decision for reviewers',
    },
    {
      draftId: 'decision-hierarchy',
      proposedCode: 'D1',
      plane: 'intent',
      kind: 'decision',
      title: 'Compare the information hierarchy before committing to a settlement interaction',
    },
    {
      draftId: 'constraint-payload',
      proposedCode: 'CON1',
      plane: 'intent',
      kind: 'constraint',
      title: 'Retain exact persisted details so compact review views never conceal evidence',
    },
    {
      draftId: 'criterion-scan',
      proposedCode: 'AC1',
      plane: 'intent',
      kind: 'criterion',
      title: 'Make the first-pass scope and its consequences legible during review',
    },
    {
      draftId: 'module-review',
      proposedCode: 'MOD1',
      plane: 'design',
      kind: 'module',
      title: 'The review-set result component presents proposed graph changes to a reviewer',
    },
    {
      draftId: 'interface-decision',
      proposedCode: 'API1',
      plane: 'design',
      kind: 'interface',
      title: 'The whole-set decision control records approval, requested changes, or rejection',
    },
    {
      draftId: 'sketch-brief',
      proposedCode: 'SKT1',
      plane: 'design',
      kind: 'sketch',
      title: 'A proposition brief layout tests whether commitments can lead the reading order',
    },
    {
      draftId: 'check-counts',
      proposedCode: 'CH1',
      plane: 'oracle',
      kind: 'check',
      title: 'Render the mixed review set at supported widths and compare its visible inventory',
    },
    {
      draftId: 'evidence-renderer',
      proposedCode: 'E1',
      plane: 'oracle',
      kind: 'evidence',
      title: 'The component-playground comparison showed lifecycle labels were not user-legible',
    },
    {
      draftId: 'obligation-inspection',
      proposedCode: 'O1',
      plane: 'oracle',
      kind: 'vv_obligation',
      title: 'Legacy obligation: prove exact-payload inspection before accepting the renderer',
    },
    {
      draftId: 'method-renderer',
      proposedCode: 'VV1',
      plane: 'oracle',
      kind: 'vv_method',
      title: 'Use fixture inventory comparison plus a normal-width human visual review',
    },
    {
      draftId: 'term-impact',
      proposedCode: 'T1',
      plane: 'intent',
      kind: 'term',
      title: 'Impact means the consequences of accepting the proposed graph set',
      detail: {
        definition: 'The consequences of accepting the proposed graph set as one commitment.',
        aliases: ['review impact'],
      },
    },
    {
      draftId: 'entity-review-item',
      proposedCode: 'ENT1',
      plane: 'design',
      kind: 'entity',
      title: 'A review item carries one proposed code, kind, title, details, and relations',
    },
    {
      draftId: 'milestone-review',
      proposedCode: 'M1',
      plane: 'plan',
      kind: 'milestone',
      title: 'Close the walkthrough chapter after the review interaction is legible and witnessed',
    },
    {
      draftId: 'frontier-fe1187',
      proposedCode: 'F1',
      plane: 'plan',
      kind: 'frontier',
      title: 'FE-1187 compares whole-set review readings before the production interaction changes',
    },
    {
      draftId: 'scope-review',
      proposedCode: 'SCP1',
      plane: 'plan',
      kind: 'scope',
      title: 'Choose and verify one compact concern-grouped review reading',
    },
  ],
  edgeDrafts: [
    {
      category: 'rationale',
      support: { draftId: 'goal-review' },
      claim: { draftId: 'req-decision' },
      stance: 'for',
      rationale: 'The whole-set goal motivates the interaction requirement.',
    },
    {
      category: 'dependency',
      dependency: { draftId: 'constraint-payload' },
      dependent: { draftId: 'decision-hierarchy' },
      rationale: 'Hierarchy must not hide persisted detail.',
    },
    {
      category: 'rationale',
      support: { draftId: 'evidence-renderer' },
      claim: { draftId: 'decision-hierarchy' },
      stance: 'for',
      rationale: 'The observed comparison supports concern-based grouping.',
    },
    {
      category: 'realization',
      abstract: { draftId: 'req-decision' },
      concrete: { draftId: 'module-review' },
      rationale: 'The result component realizes the review requirement.',
    },
    {
      category: 'realization',
      abstract: { draftId: 'req-decision' },
      concrete: { draftId: 'interface-decision' },
      rationale: 'The whole-set control realizes the review requirement.',
    },
    {
      category: 'composition',
      whole: { draftId: 'module-review' },
      part: { draftId: 'entity-review-item' },
      rationale: 'Review items compose the rendered set.',
    },
    {
      category: 'witness',
      oracle: { draftId: 'criterion-scan' },
      claim: { draftId: 'req-decision' },
      stance: 'for',
      rationale: 'The criterion judges the interaction requirement.',
    },
    {
      category: 'realization',
      abstract: { draftId: 'criterion-scan' },
      concrete: { draftId: 'check-counts' },
      rationale: 'The concrete check operationalizes the criterion.',
    },
    {
      category: 'realization',
      abstract: { draftId: 'method-renderer' },
      concrete: { draftId: 'check-counts' },
      rationale: 'The concrete check applies the comparison method.',
    },
    {
      category: 'composition',
      whole: { draftId: 'milestone-review' },
      part: { draftId: 'frontier-fe1187' },
      rationale: 'The frontier is part of walkthrough closure.',
    },
    {
      category: 'composition',
      whole: { draftId: 'frontier-fe1187' },
      part: { draftId: 'scope-review' },
      rationale: 'The review work is one scope inside the frontier.',
    },
  ],
} satisfies ReviewSetProposalPayload;

const PROJECTED_REVIEW_SET = projectPresentReviewSet({
  exchangeId: 'review-set-fe-1187-r10',
  payload: REVIEW_SET_PAYLOAD,
});
const REVIEW_SET = PROJECTED_REVIEW_SET.details.review_set;

const VARIANTS = [
  { name: 'Current production · card wall', bet: 'The actual production renderer, unchanged.' },
  { name: 'Proposition brief', bet: 'Commitment first; scope and consequences follow.' },
  { name: 'Change outline', bet: 'Projected claim kinds become the scan spine.' },
  { name: 'Impact ledger', bet: 'User concerns separate the consequences of accepting the set.' },
  {
    name: 'Grouped impact table',
    bet: 'Four concern groups make graph items and compact relations scannable.',
  },
] as const;

type ReviewGroup = 'Intent' | 'Implementation' | 'Assurance' | 'Planning';

const REVIEW_GROUP_BY_KIND = {
  goal: 'Intent',
  thesis: 'Intent',
  story: 'Intent',
  constraint: 'Intent',
  assumption: 'Intent',
  invariant: 'Intent',
  decision: 'Intent',
  unknown: 'Intent',
  context: 'Intent',
  evidence: 'Intent',
  example: 'Intent',
  term: 'Intent',
  requirement: 'Implementation',
  interface: 'Implementation',
  module: 'Implementation',
  entity: 'Implementation',
  sketch: 'Implementation',
  criterion: 'Assurance',
  vv_method: 'Assurance',
  check: 'Assurance',
  vv_obligation: 'Assurance',
  milestone: 'Planning',
  frontier: 'Planning',
  scope: 'Planning',
} as const satisfies Record<NodeKind, ReviewGroup>;

const REVIEW_KIND_ORDER = [
  'goal',
  'thesis',
  'story',
  'constraint',
  'assumption',
  'invariant',
  'decision',
  'unknown',
  'context',
  'evidence',
  'example',
  'term',
  'requirement',
  'interface',
  'module',
  'entity',
  'sketch',
  'criterion',
  'vv_method',
  'check',
  'vv_obligation',
  'milestone',
  'frontier',
  'scope',
] as const satisfies readonly NodeKind[];

const REVIEW_KIND_RANK = new Map<NodeKind, number>(REVIEW_KIND_ORDER.map((kind, index) => [kind, index]));
const REVIEW_GROUPS: readonly ReviewGroup[] = ['Intent', 'Implementation', 'Assurance', 'Planning'];

function isNodeKind(kind: string): kind is NodeKind {
  return Object.hasOwn(REVIEW_GROUP_BY_KIND, kind);
}

export class ReviewSetPrototypeComponent implements Component {
  #variant = 0;
  #showPayload = false;

  constructor(
    private readonly theme: LabTheme,
    private readonly done: () => void,
  ) {}

  render(width: number): string[] {
    const safeWidth = Math.max(1, width);
    const variant = VARIANTS[this.#variant]!;
    const lines = [
      this.theme.fg(
        'accent',
        this.theme.bold?.('FE-1187 · R10 whole-set review') ?? 'FE-1187 · R10 whole-set review',
      ),
      this.theme.fg('muted', `Variant ${this.#variant + 1}/${VARIANTS.length} · ${variant.name}`),
      this.theme.fg('dim', `Design bet: ${variant.bet}`),
      this.theme.fg(
        'success',
        `${REVIEW_SET.nodes.length} proposed graph items · ${REVIEW_SET.edges.length} proposed relations · one decision`,
      ),
      '',
      ...(this.#showPayload ? this.#payloadLines() : this.#variantLines(safeWidth)),
      '',
      this.theme.fg('accent', '[ approve whole set ]  [ request changes ]  [ reject whole set ]'),
      this.theme.fg('dim', '←/→ or 1/2/3/4/5 variant · i exact payload · esc/q close'),
    ];
    return safeLines(lines, safeWidth);
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, 'q')) return this.done();
    if (matchesKey(data, 'i')) this.#showPayload = !this.#showPayload;
    if (matchesKey(data, Key.right)) this.#variant = (this.#variant + 1) % VARIANTS.length;
    if (matchesKey(data, Key.left)) this.#variant = (this.#variant - 1 + VARIANTS.length) % VARIANTS.length;
    if (matchesKey(data, '1')) this.#variant = 0;
    if (matchesKey(data, '2')) this.#variant = 1;
    if (matchesKey(data, '3')) this.#variant = 2;
    if (matchesKey(data, '4')) this.#variant = 3;
    if (matchesKey(data, '5')) this.#variant = 4;
  }

  invalidate(): void {}

  #variantLines(width: number): string[] {
    switch (this.#variant) {
      case 0:
        return new ExchangeReviewSetResultComponent(PROJECTED_REVIEW_SET.details, this.theme).render(width);
      case 1:
        return this.#propositionBrief();
      case 2:
        return this.#changeOutline();
      case 3:
        return this.#impactLedger(width);
      default:
        return this.#groupedImpactTable(width);
    }
  }

  #propositionBrief(): string[] {
    return [
      this.theme.fg('text', PROJECTED_REVIEW_SET.details.display.heading),
      this.theme.fg('muted', PROJECTED_REVIEW_SET.details.display.body ?? ''),
      '',
      this.#heading('Scope'),
      this.#item('Proposed claims', `${REVIEW_SET.nodes.length} persisted node details`),
      this.#item('Proposed relations', `${REVIEW_SET.edges.length} persisted edge details`),
      this.#heading('Consequences if accepted'),
      ...this.#reviewGroupSummary(),
      this.#heading('Confidence'),
      this.#item('Exact inspection', 'The persisted present_review_set details remain one keypress away.'),
    ];
  }

  #changeOutline(): string[] {
    const groups = new Map<string, typeof REVIEW_SET.nodes>();
    for (const node of REVIEW_SET.nodes) groups.set(node.kind, [...(groups.get(node.kind) ?? []), node]);
    return [
      this.#heading('Claims by projected kind'),
      ...[...groups].flatMap(([kind, nodes]) => [
        this.theme.fg('accent', `${kind.toUpperCase()} · ${nodes.length}`),
        ...nodes.map((node) => `  ${node.proposed_code}  ${node.title}`),
      ]),
      this.#heading('Projected relation categories'),
      ...this.#edgeCategorySummary(),
    ];
  }

  #impactLedger(width: number): string[] {
    const connectionsByNode = this.#symbolicConnectionsByNode();
    const kindWidth = Math.max(...REVIEW_SET.nodes.map((node) => this.#kindLabel(node.kind).length));
    const codeWidth = Math.max(...REVIEW_SET.nodes.map((node) => node.proposed_code.length));
    const terms = this.#nodesInReviewGroup('Intent').filter((node) => node.kind === 'term');
    return [
      this.#heading('Terms'),
      '',
      ...this.#renderBorderlessLedger(width, kindWidth, codeWidth, terms, connectionsByNode, true),
      '',
      ...REVIEW_GROUPS.flatMap((group) => {
        const groupedNodes = this.#nodesInReviewGroup(group);
        const visibleNodes = groupedNodes.filter((node) => node.kind !== 'term');
        return [
          this.#heading(group),
          '',
          ...this.#renderBorderlessLedger(
            width,
            kindWidth,
            codeWidth,
            visibleNodes,
            connectionsByNode,
            false,
          ),
          '',
        ];
      }),
    ];
  }

  #renderBorderlessLedger(
    width: number,
    kindWidth: number,
    codeWidth: number,
    nodes: readonly (typeof REVIEW_SET.nodes)[number][],
    connectionsByNode: ReadonlyMap<string, readonly string[]>,
    showTermDefinition: boolean,
  ): string[] {
    if (nodes.length === 0) return [this.theme.fg('muted', 'None')];
    const contentWidth = Math.max(8, width - kindWidth - codeWidth - 6);
    let previousKind: string | undefined;
    const rows = nodes.flatMap((node) => {
      const kind = this.#kindLabel(node.kind);
      const kindCell = kind === previousKind ? '' : this.theme.fg('muted', kind);
      previousKind = kind;
      const content = showTermDefinition ? this.#termDefinition(node) : node.title;
      const connections = connectionsByNode.get(node.draft_id) ?? [];
      const itemRow = [
        kindCell,
        this.theme.fg('syntaxKeyword', node.proposed_code),
        this.theme.fg('text', content),
      ];
      return connections.length > 0
        ? [itemRow, ['', '', this.theme.fg('muted', `refs: ${connections.join(', ')}`)]]
        : [itemRow];
    });
    return table(rows, {
      border: getBorderCharacters('void'),
      columnDefault: { paddingLeft: 0, paddingRight: 2, wrapWord: true },
      columns: [{ width: kindWidth }, { width: codeWidth }, { width: contentWidth }],
      drawHorizontalLine: () => false,
    })
      .trimEnd()
      .split('\n');
  }

  #termDefinition(node: (typeof REVIEW_SET.nodes)[number]): string {
    if (
      typeof node.detail === 'object' &&
      node.detail !== null &&
      'definition' in node.detail &&
      typeof node.detail.definition === 'string'
    ) {
      return node.detail.definition;
    }
    return node.title;
  }

  #symbolicConnectionsByNode(): ReadonlyMap<string, readonly string[]> {
    const nodesByDraftId = new Map(REVIEW_SET.nodes.map((node) => [node.draft_id, node]));
    const connections = new Map<string, string[]>();
    const add = (
      host: { readonly draft_id?: string; readonly existing_code?: string },
      other: { readonly draft_id?: string; readonly existing_code?: string },
    ) => {
      if (!host.draft_id) return;
      const proposedNode = nodesByDraftId.get(other.draft_id ?? '');
      const otherCode = other.existing_code ?? proposedNode?.proposed_code;
      if (!otherCode) return;
      connections.set(host.draft_id, [...(connections.get(host.draft_id) ?? []), otherCode]);
    };

    for (const edge of REVIEW_SET.edges) {
      switch (edge.category) {
        case 'dependency':
          add(edge.dependency, edge.dependent);
          break;
        case 'witness':
          add(edge.claim, edge.oracle);
          break;
        case 'rationale':
          add(edge.claim, edge.support);
          break;
        case 'realization':
          add(edge.abstract, edge.concrete);
          break;
        case 'refinement':
          add(edge.abstract, edge.concrete);
          break;
        case 'exclusion':
          add(edge.boundary, edge.subject);
          break;
        case 'composition':
          add(edge.whole, edge.part);
          break;
        case 'cross_reference':
          add(edge.a, edge.b);
          break;
        case 'supersession':
          add(edge.predecessor, edge.successor);
          break;
      }
    }

    const connectionCount = [...connections.values()].flat().length;
    if (connectionCount !== REVIEW_SET.edges.length) {
      throw new Error(`Impact ledger rendered ${connectionCount}/${REVIEW_SET.edges.length} connections`);
    }
    return connections;
  }

  #groupedImpactTable(width: number): string[] {
    const nodesByDraftId = new Map(REVIEW_SET.nodes.map((node) => [node.draft_id, node]));
    const relationsByNode = new Map<string, string[]>();
    const detachedRelations: string[] = [];

    for (const edge of REVIEW_SET.edges) {
      const relation = this.#compactRelation(edge, nodesByDraftId);
      if (relation.hostDraftId) {
        relationsByNode.set(relation.hostDraftId, [
          ...(relationsByNode.get(relation.hostDraftId) ?? []),
          relation.text,
        ]);
      } else {
        detachedRelations.push(relation.text);
      }
    }
    const renderedRelationCount = [...relationsByNode.values()].flat().length + detachedRelations.length;
    if (renderedRelationCount !== REVIEW_SET.edges.length) {
      throw new Error(
        `Grouped impact table rendered ${renderedRelationCount}/${REVIEW_SET.edges.length} relations`,
      );
    }

    return [
      ...REVIEW_GROUPS.flatMap((group) => {
        const nodes = this.#nodesInReviewGroup(group);
        const visibleNodes = nodes.filter((node) => node.kind !== 'term');
        return [
          this.#heading(`${group} · ${nodes.length} items`),
          ...this.#renderReviewTable(width, visibleNodes, relationsByNode),
          ...this.#vocabularySignal(nodes),
          '',
        ];
      }),
      ...detachedRelations.map((relation) => this.theme.fg('text', `Detached relation · ${relation}`)),
    ];
  }

  #renderReviewTable(
    width: number,
    nodes: readonly (typeof REVIEW_SET.nodes)[number][],
    relationsByNode: ReadonlyMap<string, readonly string[]>,
  ): string[] {
    const rows = [
      [this.theme.fg('text', 'Type'), this.theme.fg('text', 'Item'), this.theme.fg('text', 'Relations')],
    ];
    const spanningCells: SpanningCellConfig[] = [];
    let row = 1;
    for (let index = 0; index < nodes.length; ) {
      const kind = nodes[index]!.kind;
      const sameKind = nodes.slice(index).filter((node) => node.kind === kind);
      spanningCells.push({ row, col: 0, rowSpan: sameKind.length, verticalAlignment: 'top', wrapWord: true });
      for (const node of sameKind) {
        rows.push([
          this.theme.fg('text', this.#kindLabel(kind)),
          `${this.theme.fg('syntaxKeyword', node.proposed_code)}: ${this.theme.fg('text', node.title)}`,
          this.theme.fg('text', (relationsByNode.get(node.draft_id) ?? []).join('\n')),
        ]);
        row += 1;
      }
      index += sameKind.length;
    }

    return table(rows, this.#reviewTableConfig(width, spanningCells)).trimEnd().split('\n');
  }

  #reviewTableConfig(width: number, spanningCells: SpanningCellConfig[]): TableUserConfig {
    // ceiling: below 37 columns, the three required columns are safely clipped; widen the preview for legible relations.
    const contentWidth = Math.max(27, width - 10);
    const typeWidth = Math.max(7, Math.min(16, Math.floor(contentWidth * 0.22)));
    const relationWidth = Math.max(12, Math.floor(contentWidth * 0.34));
    return {
      border: this.#mutedSingleLineBorder(),
      columns: [
        { width: typeWidth, wrapWord: true },
        { width: Math.max(8, contentWidth - typeWidth - relationWidth), wrapWord: true },
        { width: relationWidth, wrapWord: true },
      ],
      spanningCells,
    };
  }

  #mutedSingleLineBorder(): NonNullable<TableUserConfig['border']> {
    const glyph = (character: string) => this.theme.fg('dim', character);
    return {
      topLeft: glyph('┌'),
      topRight: glyph('┐'),
      topBody: glyph('─'),
      topJoin: glyph('┬'),
      bottomLeft: glyph('└'),
      bottomRight: glyph('┘'),
      bottomBody: glyph('─'),
      bottomJoin: glyph('┴'),
      joinLeft: glyph('├'),
      joinRight: glyph('┤'),
      joinBody: glyph('─'),
      joinJoin: glyph('┼'),
      joinMiddleUp: glyph('┴'),
      joinMiddleDown: glyph('┬'),
      joinMiddleLeft: glyph('┤'),
      joinMiddleRight: glyph('├'),
      headerJoin: glyph('┼'),
      bodyLeft: glyph('│'),
      bodyRight: glyph('│'),
      bodyJoin: glyph('│'),
    };
  }

  #compactRelation(
    edge: (typeof REVIEW_SET.edges)[number],
    nodesByDraftId: ReadonlyMap<string, (typeof REVIEW_SET.nodes)[number]>,
  ): { readonly hostDraftId?: string; readonly text: string } {
    const endpointCode = (ref: { readonly draft_id?: string; readonly existing_code?: string }) =>
      ref.existing_code ?? nodesByDraftId.get(ref.draft_id ?? '')?.proposed_code ?? ref.draft_id ?? 'unknown';
    const endpointKind = (ref: { readonly draft_id?: string; readonly existing_code?: string }) =>
      nodesByDraftId.get(ref.draft_id ?? '')?.kind;
    const render = (
      host: { readonly draft_id?: string; readonly existing_code?: string },
      verb: string,
      other: { readonly draft_id?: string; readonly existing_code?: string },
    ) => ({
      ...('draft_id' in host ? { hostDraftId: host.draft_id } : {}),
      text: `${verb} → ${endpointCode(other)}`,
    });

    switch (edge.category) {
      case 'dependency':
        return render(edge.dependent, 'depends on', edge.dependency);
      case 'witness':
        return render(edge.oracle, 'witnesses', edge.claim);
      case 'rationale':
        return render(edge.support, edge.stance === 'against' ? 'argues against' : 'supports', edge.claim);
      case 'realization': {
        const abstractKind = endpointKind(edge.abstract);
        const verb =
          abstractKind === 'criterion' || abstractKind === 'vv_method' ? 'operationalizes' : 'realizes';
        return render(edge.concrete, verb, edge.abstract);
      }
      case 'refinement':
        return render(edge.concrete, 'refines', edge.abstract);
      case 'exclusion':
        return render(edge.boundary, 'excludes', edge.subject);
      case 'composition':
        return render(edge.part, 'part of', edge.whole);
      case 'cross_reference':
        return render(edge.a, 'relates to', edge.b);
      case 'supersession':
        return render(edge.successor, 'supersedes', edge.predecessor);
    }
  }

  #payloadLines(): string[] {
    return [
      this.#heading('Exact persisted present_review_set details · inspection only'),
      ...JSON.stringify(PROJECTED_REVIEW_SET.details, null, 2)
        .split('\n')
        .map((line) => this.theme.fg('syntaxKeyword', line)),
    ];
  }

  #reviewGroupSummary(): string[] {
    return REVIEW_GROUPS.map((group) =>
      this.#item(group, `${this.#nodesInReviewGroup(group).length} proposed items`),
    );
  }

  #nodesInReviewGroup(group: ReviewGroup): typeof REVIEW_SET.nodes {
    return REVIEW_SET.nodes
      .filter((node) => this.#reviewGroup(node) === group)
      .sort(
        (a, b) =>
          this.#reviewKindRank(a.kind) - this.#reviewKindRank(b.kind) ||
          a.proposed_code.localeCompare(b.proposed_code),
      );
  }

  #reviewGroup(node: (typeof REVIEW_SET.nodes)[number]): ReviewGroup {
    if (!isNodeKind(node.kind)) throw new Error(`No review group mapping for fixture kind: ${node.kind}`);
    return REVIEW_GROUP_BY_KIND[node.kind];
  }

  #reviewKindRank(kind: string): number {
    if (!isNodeKind(kind)) throw new Error(`No review kind order for fixture kind: ${kind}`);
    return REVIEW_KIND_RANK.get(kind) ?? Number.MAX_SAFE_INTEGER;
  }

  #vocabularySignal(nodes: typeof REVIEW_SET.nodes): string[] {
    const terms = nodes.filter((node) => node.kind === 'term');
    if (terms.length === 0) return [];
    const codes = terms.map((node) => node.proposed_code).join(', ');
    return [
      this.theme.fg(
        'muted',
        `Vocabulary · ${terms.length} proposed ${terms.length === 1 ? 'change' : 'changes'} · ${codes} · i for definitions`,
      ),
    ];
  }

  #kindLabel(kind: string): string {
    if (kind === 'vv_method') return 'method';
    if (kind === 'vv_obligation') return 'obligation';
    return kind;
  }

  #edgeCategorySummary(): string[] {
    const counts = new Map<string, number>();
    for (const edge of REVIEW_SET.edges) counts.set(edge.category, (counts.get(edge.category) ?? 0) + 1);
    return [...counts].map(([category, count]) => `${category} · ${count}`);
  }

  #heading(text: string): string {
    return this.theme.fg('accent', this.theme.bold?.(text) ?? text);
  }

  #item(label: string, detail: string): string {
    return `${this.theme.fg('text', `• ${label}`)} ${this.theme.fg('muted', `— ${detail}`)}`;
  }
}
