import type { WorkflowPhase } from '@/shared/phase-close.js';

declare module '@tanstack/history' {
  interface HistoryState {
    fromPhase?: WorkflowPhase;
    fromScrollY?: number;
    scrollY?: number;
  }
}
