import { createContext, useContext, useState, type ReactNode } from 'react';

import type { WorkflowPhase } from '@/shared/api-types.js';

interface WorkspaceFocusState {
  readonly focusedPhase: WorkflowPhase | null;
  readonly setFocusedPhase: (phase: WorkflowPhase) => void;
}

const WorkspaceFocusContext = createContext<WorkspaceFocusState | null>(null);

export function WorkspaceFocusProvider({ children }: { children: ReactNode }) {
  const [focusedPhase, setFocusedPhase] = useState<WorkflowPhase | null>(null);

  return <WorkspaceFocusContext value={{ focusedPhase, setFocusedPhase }}>{children}</WorkspaceFocusContext>;
}

export function useWorkspaceFocus(): WorkspaceFocusState | null {
  return useContext(WorkspaceFocusContext);
}
