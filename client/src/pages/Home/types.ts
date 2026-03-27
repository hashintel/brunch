// Re-export shared types
export type { Model, ConfidenceLevel, ImpactLevel, ClaudeCall, DoltCommit, DoltChange, DoltDiffRow, SessionMeta } from '../../shared/types';
import type { ConfidenceLevel, ImpactLevel } from '../../shared/types';

export type Assumption = {
    id: string;
    text: string;
    rationale: string;
    confidence: ConfidenceLevel;
    impact: ImpactLevel;
    status: 'pending' | 'confirmed' | 'edited' | 'rejected';
    editedText?: string;
};

export type TestType = 'static_analysis' | 'programmatic_test' | 'llm_review' | 'human_review';

export type TestCase = {
    type: TestType;
    description: string;
};

export type Requirement = {
    id: string;
    title: string;
    definition: string;
    confidence: number;
    stage: 'proposal' | 'approved' | 'completed';
    tests: TestCase[];
    children: Requirement[];
};

export type ClarifyingQuestion = {
    question: string;
    why: string;
    options: { label: string }[];
};

export type ClarifyingAnswer = {
    selectedLabels: string[];
    otherText: string;
    skipped: boolean;
};

export type ClarifyingRound = {
    questions: ClarifyingQuestion[];
    answers: ClarifyingAnswer[];
};

export type Session = {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    prompt: string;
    cwd: string;
    response: string;
    selectedModel: string;
    clarifyingRounds: ClarifyingRound[];
    requirements: Requirement[];
};

export type GoalIteration = {
    goalText: string;
    questions: ClarifyingQuestion[];
    answers: ClarifyingAnswer[];
};

export interface SessionData {
    name: string;
    prompt: string;
    cwd: string;
    response: string;
    selectedModel: string;
    goalIterations: GoalIteration[];
    allQuestions: ClarifyingQuestion[];
    allAnswers: ClarifyingAnswer[];
    questionsExhausted: boolean;
    clarifyingDone: boolean;
    assumptions: Assumption[];
    assumptionsDone: boolean;
    requirements: Requirement[];
    spec: string;
    specProgress: number;
}

export type AssistantMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    context?: { selectedText?: string; elementType?: string };
    timestamp: number;
};


export type FocusedItem =
    | { type: 'assumption'; item: Assumption }
    | { type: 'requirement'; item: Requirement }
    | { type: 'clarifying_question'; item: ClarifyingQuestion };

export type ToolUpdate = {
    tool: string;
    data: Record<string, any>;
    timestamp: number;
};

