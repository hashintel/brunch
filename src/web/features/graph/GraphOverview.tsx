import { useState } from 'react';

import type { GraphOverview } from '../../../graph/queries.js';

export function GraphOverviewPanel(options: { overview: GraphOverview }) {
  const { overview } = options;
  const [focusedNodeId, setFocusedNodeId] = useState<number | null>(null);
  const nodeGroups = groupNodes(overview.nodes);
  const edgeSummary = summarizeEdges(overview.edges);
  const focusedNode =
    focusedNodeId === null ? undefined : overview.nodes.find((node) => node.id === focusedNodeId);

  return (
    <section
      aria-label="Graph overview"
      className="border-brunch-graph/25 rounded-[2rem] border bg-[#f9f6ec]/80 p-5 shadow-[0_18px_70px_rgb(19_72_77_/_0.12)]"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-brunch-graph font-mono text-xs tracking-[0.28em] uppercase">Selected spec</p>
          <h2 className="text-brunch-ink mt-2 text-3xl font-semibold tracking-[-0.04em]">Graph overview</h2>
        </div>
        <dl aria-label="Graph counts" className="grid grid-cols-3 gap-2 md:min-w-80">
          <div className="rounded-2xl bg-white/65 p-4 text-center">
            <dt className="text-brunch-muted font-mono text-[0.68rem] tracking-[0.22em] uppercase">Nodes</dt>
            <dd className="text-brunch-ink mt-1 text-3xl font-semibold">{overview.nodeCount}</dd>
          </div>
          <div className="rounded-2xl bg-white/65 p-4 text-center">
            <dt className="text-brunch-muted font-mono text-[0.68rem] tracking-[0.22em] uppercase">Edges</dt>
            <dd className="text-brunch-ink mt-1 text-3xl font-semibold">{overview.edgeCount}</dd>
          </div>
          <div className="rounded-2xl bg-white/65 p-4 text-center">
            <dt className="text-brunch-muted font-mono text-[0.68rem] tracking-[0.22em] uppercase">LSN</dt>
            <dd className="text-brunch-ink mt-1 text-3xl font-semibold">{overview.lsn}</dd>
          </div>
        </dl>
      </div>
      {overview.nodes.length === 0 ? (
        <p className="border-brunch-rule text-brunch-muted mt-6 rounded-2xl border border-dashed bg-white/55 p-6 text-sm">
          {`No graph nodes yet. LSN ${overview.lsn}; 0 nodes; 0 edges.`}
        </p>
      ) : null}
      {overview.nodes.length > 0 ? (
        <div className="mt-6 space-y-6">
          <div aria-label="Edge categories" className="bg-brunch-graph/10 rounded-2xl p-4">
            <h3 className="text-brunch-graph text-sm font-semibold tracking-[0.16em] uppercase">
              Edge categories
            </h3>
            {edgeSummary.length === 0 ? (
              <p className="text-brunch-muted mt-2 text-sm">No edges yet.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {edgeSummary.map(([category, count]) => (
                  <li
                    key={category}
                    className="border-brunch-graph/20 text-brunch-graph rounded-full border bg-white/65 px-3 py-1 font-mono text-xs"
                  >
                    {`${category}: ${count}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {nodeGroups.map((group) => (
            <section key={group.label} aria-label={`${group.label} nodes`} className="space-y-3">
              <h3 className="text-brunch-muted font-mono text-xs tracking-[0.24em] uppercase">
                {group.label}
              </h3>
              <ul className="grid gap-3 md:grid-cols-2">
                {group.nodes.map((node) => (
                  <li key={node.id}>
                    <article
                      aria-label={`${node.kind} node`}
                      className="border-brunch-rule/70 hover:border-brunch-graph/40 h-full rounded-2xl border bg-white/70 p-4 transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgb(19_72_77_/_0.10)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    >
                      <strong className="text-brunch-ink text-lg leading-tight font-semibold">
                        {node.title}
                      </strong>
                      <p className="text-brunch-graph mt-2 font-mono text-xs">{`${node.plane} / ${node.kind}`}</p>
                      {node.body ? <p className="text-brunch-muted mt-3 text-sm">{node.body}</p> : null}
                      <button
                        type="button"
                        className="bg-brunch-ink text-brunch-paper hover:bg-brunch-graph mt-4 rounded-full px-4 py-2 text-sm font-semibold transition motion-reduce:transition-none"
                        onClick={() => setFocusedNodeId(node.id)}
                      >
                        Focus node
                      </button>
                    </article>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
      {focusedNode ? (
        <p className="border-brunch-graph/25 text-brunch-graph mt-6 rounded-2xl border bg-white/65 p-4 font-mono text-xs">
          {`Focused read pending: graph.nodeNeighborhood(${focusedNode.specId}, ${focusedNode.id}, 1)`}
        </p>
      ) : null}
    </section>
  );
}

function groupNodes(nodes: GraphOverview['nodes']): Array<{
  label: string;
  nodes: GraphOverview['nodes'];
}> {
  const groups = new Map<string, Array<GraphOverview['nodes'][number]>>();
  for (const node of nodes) {
    const label = `${node.plane} / ${node.kind}`;
    const group = groups.get(label);
    if (group) {
      group.push(node);
    } else {
      groups.set(label, [node]);
    }
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, groupedNodes]) => ({ label, nodes: groupedNodes }));
}

function summarizeEdges(edges: GraphOverview['edges']): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.category, (counts.get(edge.category) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
}
