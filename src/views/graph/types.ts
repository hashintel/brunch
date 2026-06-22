/**
 * Shared TypeScript types for the graph view.
 *
 * Root type module for the graph feature: other graph modules import node and
 * edge data shapes from here. The literal unions mirror the knowledge schema's
 * `knowledge_item.kind` and `knowledge_edge.relation` enums.
 */

/** The kind of knowledge entity a graph node represents. */
export type GraphNodeKind =
  | 'goal'
  | 'term'
  | 'context'
  | 'constraint'
  | 'requirement'
  | 'criterion'
  | 'decision'
  | 'assumption';

/** The relationship type a graph edge represents. */
export type GraphEdgeRelationship = 'depends_on' | 'derived_from' | 'constrains' | 'verifies' | 'refines';

/** Render data carried by a graph node. */
export interface GraphNodeData {
  /** The knowledge entity kind this node represents. */
  kind: GraphNodeKind;
  /** Number of edges incident to this node. */
  degree: number;
  /** Whether this node is currently selected. */
  selected: boolean;
  /** Whether this node is visually de-emphasized. */
  dimmed: boolean;
  /** Short reference code identifying the knowledge item (e.g. "R3"). */
  referenceCode: string;
  /** The knowledge item's content or name. */
  content: string;
  /** The rationale behind the knowledge item. */
  rationale: string;
}

/** Render data carried by a graph edge. */
export interface GraphEdgeData {
  /** The relationship type this edge represents. */
  relationship: GraphEdgeRelationship;
}
