export type Model = { id: string; label: string; provider: string };
export type Requirement = { title: string; definition: string; confidence: number };
export type Task = { title: string; definition: string; hours: number; requirementIndex: number };

export type Session = {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    prompt: string;
    cwd: string;
    response: string;
    selectedModel: string;
    requirements: Requirement[];
    tasks: Task[];
    summary: string;
};

export type SessionMeta = Pick<Session, 'id' | 'name' | 'updatedAt'>;
