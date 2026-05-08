import { createContext, useContext, type ReactNode } from 'react';

export interface PatchListOverlayBridgeValue {
  /** Same subset as the side-chat popover Apply (active item when chat is open; all staged when closed). */
  applyScoped: () => void;
  /** Patch IDs included in `applyScoped`; empty when another item holds all staged work. */
  scopedPatchIds: readonly string[];
}

const PatchListOverlayBridgeContext = createContext<PatchListOverlayBridgeValue | null>(null);

export function PatchListOverlayBridgeProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: PatchListOverlayBridgeValue;
}): React.ReactElement {
  return (
    <PatchListOverlayBridgeContext.Provider value={value}>{children}</PatchListOverlayBridgeContext.Provider>
  );
}

export function usePatchListOverlayBridge(): PatchListOverlayBridgeValue | null {
  return useContext(PatchListOverlayBridgeContext);
}
