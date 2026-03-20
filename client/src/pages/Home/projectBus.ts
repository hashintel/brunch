import type { Assumption, Requirement } from './types';

export type AssumptionUpdate = {
    id: string;
    text?: string;
    status?: string;
    confidence?: string;
    impact?: string;
};

export type RequirementUpdate = {
    id: string;
    title?: string;
    definition?: string;
    confidence?: number;
    stage?: string;
};

/**
 * Lightweight mutable bus for cross-cutting concerns.
 * Methods are reassigned each render in index.tsx so hooks always
 * call the latest implementation (no stale-closure issues).
 */
export type ProjectBus = {
    error(msg: string): void;
    callHistoryChanged(): void;
    setGoal(text: string): void;
    updateAssumption(update: AssumptionUpdate): void;
    updateRequirement(update: RequirementUpdate): void;
};

export function createProjectBus(): ProjectBus {
    const noop = () => {};
    return {
        error: noop,
        callHistoryChanged: noop,
        setGoal: noop,
        updateAssumption: noop,
        updateRequirement: noop,
    };
}
