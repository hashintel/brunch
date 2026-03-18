export type Model = { id: string; label: string; provider: string };
export type Requirement = { title: string; definition: string; confidence: number };
export type Task = { title: string; definition: string; hours: number; requirementIndex: number };

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
    tasks: Task[];
    summary: string;
};

export type GoalIteration = {
    goalText: string;
    questions: ClarifyingQuestion[];
    answers: ClarifyingAnswer[];
};

export type SessionMeta = Pick<Session, 'id' | 'name' | 'updatedAt'>;

export interface ClaudeCall {
    pk: number;
    model: string;
    caller: string;
    prompt: string | null;
    response: string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    duration_ms: number | null;
    status: string;
    error: string | null;
    created_at: string;
}
