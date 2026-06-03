import type { GraphOverview } from '../../../graph/snapshot.js';

export function GraphOverviewPanel(options: { overview: GraphOverview }) {
  const { overview } = options;
  return (
    <section aria-label="Graph overview">
      <h2>Graph overview</h2>
      <p>{`Nodes: ${overview.nodeCount}`}</p>
      <p>{`Edges: ${overview.edgeCount}`}</p>
      <p>{`LSN: ${overview.lsn}`}</p>
      {overview.nodes.length === 0 ? <p>No graph nodes yet.</p> : null}
      {overview.nodes.length > 0 ? (
        <ul>
          {overview.nodes.map((node) => (
            <li key={node.id}>
              <article aria-label={`${node.kind} node`}>
                <strong>{node.title}</strong>
                <p>{`${node.plane} / ${node.kind}`}</p>
                {node.body ? <p>{node.body}</p> : null}
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
