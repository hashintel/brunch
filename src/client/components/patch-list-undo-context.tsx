import { createContext, useContext, type ReactNode } from 'react';

type PatchListUndoHandler = () => void;

const PatchListUndoContext = createContext<PatchListUndoHandler | null>(null);

export function PatchListUndoProvider({
  children,
  undo,
}: {
  children: ReactNode;
  undo: PatchListUndoHandler;
}): React.ReactElement {
  return <PatchListUndoContext.Provider value={undo}>{children}</PatchListUndoContext.Provider>;
}

export function usePatchListUndoOverride(): PatchListUndoHandler | null {
  return useContext(PatchListUndoContext);
}
