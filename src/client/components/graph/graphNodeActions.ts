import { createContext, useContext } from 'react';

export interface GraphNodeActions {
  /** Open the detail-panel editor for the given node id. */
  requestEdit: (nodeId: string) => void;
}

const GraphNodeActionsContext = createContext<GraphNodeActions>({ requestEdit: () => {} });

export const GraphNodeActionsProvider = GraphNodeActionsContext.Provider;

export function useGraphNodeActions(): GraphNodeActions {
  return useContext(GraphNodeActionsContext);
}
