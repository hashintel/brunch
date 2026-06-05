import { useState } from 'react';

import type { GraphOverview } from '../../../graph/snapshot.js';

export function GraphOverviewPanel(options: { overview: GraphOverview }) {
  const { overview } = options;
  const [focusedNodeId, setFocusedNodeId] = useState<number | null>(null);
  const nodeGroups = groupNodes(overview.nodes);
  const edgeSummary = summarizeEdges(overview.edges);
  const focusedNode =
    focusedNodeId === null ? undefined : overview.nodes.find((node) => node.id === focusedNodeId);

  return (
    <section aria-label="Graph overview">
      <h2>Graph overview</h2>
      <dl aria-label="Graph counts">
        <div>
          <dt>Nodes</dt>
          <dd>{overview.nodeCount}</dd>
        </div>
        <div>
          <dt>Edges</dt>
          <dd>{overview.edgeCount}</dd>
        </div>
        <div>
          <dt>LSN</dt>
          <dd>{overview.lsn}</dd>
        </div>
      </dl>
      {overview.nodes.length === 0 ? (
        <p>{`No graph nodes yet. LSN ${overview.lsn}; 0 nodes; 0 edges.`}</p>
      ) : null}
      {overview.nodes.length > 0 ? (
        <>
          <div aria-label="Edge categories">
            <h3>Edge categories</h3>
            {edgeSummary.length === 0 ? (
              <p>No edges yet.</p>
            ) : (
              <ul>
                {edgeSummary.map(([category, count]) => (
                  <li key={category}>{`${category}: ${count}`}</li>
                ))}
              </ul>
            )}
          </div>
          {nodeGroups.map((group) => (
            <section key={group.label} aria-label={`${group.label} nodes`}>
              <h3>{group.label}</h3>
              <ul>
                {group.nodes.map((node) => (
                  <li key={node.id}>
                    <article aria-label={`${node.kind} node`}>
                      <strong>{node.title}</strong>
                      <p>{`${node.plane} / ${node.kind}`}</p>
                      {node.body ? <p>{node.body}</p> : null}
                      <button type="button" onClick={() => setFocusedNodeId(node.id)}>
                        Focus node
                      </button>
                    </article>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      ) : null}
      {focusedNode ? (
        <p>{`Focused read pending: graph.nodeNeighborhood(${focusedNode.specId}, ${focusedNode.id}, 1)`}</p>
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
