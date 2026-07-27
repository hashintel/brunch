/** The single codec for graph node ids — the `${kind}:${itemId}` format lives only here. */

import type { GraphNodeKind } from '@/client/components/graph/types';

export function encodeNodeId(kind: GraphNodeKind, id: number): string {
  return `${kind}:${id}`;
}

export function parseNodeId(nodeId: string): { kind: GraphNodeKind; id: number } {
  const separator = nodeId.indexOf(':');
  return {
    kind: nodeId.slice(0, separator) as GraphNodeKind,
    id: Number(nodeId.slice(separator + 1)),
  };
}
