export const MODELS = [
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', provider: 'Anthropic', backend: 'claude' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', provider: 'Anthropic', backend: 'claude' },
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', provider: 'Anthropic', backend: 'claude' },
    { id: 'big-pickle', label: 'Big Pickle', provider: 'OpenCode', backend: 'opencode' },
    { id: 'gpt-5-nano', label: 'GPT-5 Nano', provider: 'OpenCode', backend: 'opencode' },
    { id: 'nemotron-3-super-free', label: 'Nemotron 3 Super', provider: 'OpenCode', backend: 'opencode' },
    { id: 'minimax-m2.5-free', label: 'MiniMax M2.5', provider: 'OpenCode', backend: 'opencode' },
];

export const VALID_MODEL_IDS = new Set(MODELS.map(m => m.id));
export const DEFAULT_MODEL = MODELS[0].id;

export function getModelBackend(modelId) {
    const model = MODELS.find(m => m.id === modelId);
    return model?.backend ?? 'claude';
}
