// Shared types used across both Home and CreateSpec pages

export type Model = { id: string; label: string; provider: string };

export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type ImpactLevel = 'high' | 'medium' | 'low';

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

export interface SessionMeta {
    id: string;
    name: string;
    updatedAt: string;
}
