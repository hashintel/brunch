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
export type CreateAssumptionInput = {
    id?: string;
    text: string;
    rationale: string;
    confidence: string;
    impact: string;
};

export type CreateRequirementInput = {
    id?: string;
    title: string;
    definition: string;
    confidence?: number;
    parent_id?: string;
};

export type ProjectBus = {
    error(msg: string): void;
    callHistoryChanged(): void;
    setGoal(text: string): void;
    updateAssumption(update: AssumptionUpdate): void;
    createAssumption(input: CreateAssumptionInput): void;
    deleteAssumption(id: string): void;
    updateRequirement(update: RequirementUpdate): void;
    createRequirement(input: CreateRequirementInput): void;
    deleteRequirement(id: string): void;
};

export function createProjectBus(): ProjectBus {
    const noop = () => {};
    return {
        error: noop,
        callHistoryChanged: noop,
        setGoal: noop,
        updateAssumption: noop,
        createAssumption: noop,
        deleteAssumption: noop,
        updateRequirement: noop,
        createRequirement: noop,
        deleteRequirement: noop,
    };
}
