import type { GraphSlice } from '../../../graph/queries.js';
import { CountBadge, KindBadge, nodeRefCode, RefBadge } from '../../components/node-card.js';

type GraphNode = GraphSlice['nodes'][number];

export function GraphOverviewPanel(options: { overview: GraphSlice }) {
  const { overview } = options;
  const nodeGroups = groupNodes(overview.nodes);
  const edgeSummary = summarizeEdges(overview.edges);

  return (
    <section
      aria-label="Graph overview"
      className="border-rule overflow-hidden rounded-xl border bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xxs text-hint font-mono">Selected spec</p>
          <h2 className="text-ink mt-0.5 text-base font-medium">Graph overview</h2>
        </div>
        <dl aria-label="Graph counts" className="flex items-end gap-5">
          <CountStat label="Nodes" value={overview.nodes.length} />
          <CountStat label="Edges" value={overview.edges.length} />
          <CountStat label="LSN" value={overview.lsn} />
        </dl>
      </div>

      {overview.nodes.length === 0 ? (
        <p className="border-rule bg-tint text-sub mt-4 rounded-lg border border-dashed p-4 text-sm">
          {`No graph nodes yet. LSN ${overview.lsn}; 0 nodes; 0 edges.`}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          <div aria-label="Edge categories" className="border-rule bg-tint rounded-lg border p-3">
            <h3 className="text-xxs text-hint font-mono">Edge categories</h3>
            {edgeSummary.length === 0 ? (
              <p className="text-sub mt-2 text-sm">No edges yet.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {edgeSummary.map(([category, count]) => (
                  <li key={category}>
                    <RefBadge code={`${category}: ${count}`} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {nodeGroups.map((group) => (
            <section key={group.label} aria-label={`${group.label} nodes`} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <KindBadge kind={group.nodes[0]!.kind} plane={group.nodes[0]!.plane} />
                <span className="text-xxs text-hint font-mono">{group.label}</span>
                <CountBadge count={group.nodes.length} />
              </div>
              <ul className="flex flex-col gap-2">
                {group.nodes.map((node) => (
                  <li key={node.id}>
                    <NodeCard node={node} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function NodeCard({ node }: { node: GraphNode }) {
  return (
    <article
      aria-label={`${node.kind} node`}
      className="border-rule rounded-lg border bg-white p-3 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-hint shrink-0 font-mono text-xs font-medium">
          {nodeRefCode(node.kind, node.kindOrdinal)}
        </span>
        <strong className="text-xs-plus text-ink font-medium">{node.title}</strong>
      </div>
      {node.body ? <p className="text-sub mt-1.5 text-xs">{node.body}</p> : null}
    </article>
  );
}

function CountStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <dd className="text-ink text-base font-medium">{value}</dd>
      <dt className="text-xxs text-hint font-mono">{label}</dt>
    </div>
  );
}

function groupNodes(nodes: GraphSlice['nodes']): Array<{ label: string; nodes: GraphNode[] }> {
  const groups = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const label = `${node.plane} / ${node.kind}`;
    const group = groups.get(label);
    if (group) group.push(node);
    else groups.set(label, [node]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, groupedNodes]) => ({ label, nodes: groupedNodes }));
}

function summarizeEdges(edges: GraphSlice['edges']): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.category, (counts.get(edge.category) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
}
