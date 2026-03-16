export type Model = { id: string; label: string; provider: string };
export type Requirement = { title: string; definition: string; confidence: number };
export type Task = { title: string; definition: string; hours: number; requirementIndex: number };
