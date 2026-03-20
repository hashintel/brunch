export type Model = { id: string; label: string; provider: string };

export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type ImpactLevel = 'high' | 'medium' | 'low';

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

export type SessionMeta = Pick<Session, 'id' | 'name' | 'updatedAt'>;

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
}

export type AssistantMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    context?: { selectedText?: string; elementType?: string };
    timestamp: number;
};

export interface DoltCommit {
    commit_hash: string;
    committer: string;
    message: string;
    date: string;
}

export interface DoltChange {
    table_name: string;
    staged: boolean;
    status: string;
}

export interface DoltDiffRow {
    diff_type: 'added' | 'modified' | 'removed' | 'deleted';
    [key: string]: any;
}

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
    cwd: string | null;
    turns: number | null;
}
