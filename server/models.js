export const MODELS = [
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', provider: 'Anthropic' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', provider: 'Anthropic' },
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', provider: 'Anthropic' },
];

export const VALID_MODEL_IDS = new Set(MODELS.map(m => m.id));
export const DEFAULT_MODEL = MODELS[0].id;
