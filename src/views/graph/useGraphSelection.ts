/**
 * Derive the highlighted/dimmed selection state for a graph model.
 *
 * Given a selected node id, the selected node and its one-hop neighbours (in
 * either edge direction) plus the edges incident to the selected node are
 * highlighted; everything else is dimmed. With no selection, nothing is
 * selected or dimmed. The input model is never mutated — a fresh model with
 * updated `selected`/`dimmed` flags is returned.
 */
import { useMemo } from 'react';

import type { GraphModel } from './buildGraphModel.js';

export function useGraphSelection(model: GraphModel, selectedId: string | null): GraphModel {
  return useMemo(() => {
    if (selectedId == null) {
      return {
        nodes: model.nodes.map((node) => ({
          ...node,
          data: { ...node.data, selected: false, dimmed: false },
        })),
        edges: model.edges.map((edge) => ({
          ...edge,
          data: { ...edge.data, dimmed: false },
        })),
      };
    }

    const highlighted = new Set<string>([selectedId]);
    for (const edge of model.edges) {
      if (edge.source === selectedId) highlighted.add(edge.target);
      if (edge.target === selectedId) highlighted.add(edge.source);
    }

    return {
      nodes: model.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          selected: node.id === selectedId,
          dimmed: !highlighted.has(node.id),
        },
      })),
      edges: model.edges.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          dimmed: edge.source !== selectedId && edge.target !== selectedId,
        },
      })),
    };
  }, [model, selectedId]);
}
