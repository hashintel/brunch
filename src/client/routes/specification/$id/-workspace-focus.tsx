import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { WorkflowPhase } from '@/shared/api-types.js';

interface WorkspaceFocusState {
  readonly focusedPhase: WorkflowPhase | null;
  readonly setFocusedPhase: (phase: WorkflowPhase | null) => void;
}

const WorkspaceFocusContext = createContext<WorkspaceFocusState | null>(null);

export function WorkspaceFocusProvider({ children }: { children: ReactNode }) {
  const [focusedPhase, setFocusedPhase] = useState<WorkflowPhase | null>(null);
  const value = useMemo(() => ({ focusedPhase, setFocusedPhase }), [focusedPhase]);

  return <WorkspaceFocusContext value={value}>{children}</WorkspaceFocusContext>;
}

export function useWorkspaceFocus(): WorkspaceFocusState | null {
  return useContext(WorkspaceFocusContext);
}
