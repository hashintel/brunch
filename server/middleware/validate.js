import { VALID_MODEL_IDS, DEFAULT_MODEL } from '../models.js';

export function validatePromptAndModel(req, res) {
    const modelId = req.body.model ?? DEFAULT_MODEL;
    if (!req.body.prompt?.trim()) {
        res.status(400).json({ error: 'prompt is required' });
        return null;
    }
    if (!VALID_MODEL_IDS.has(modelId)) {
        res.status(400).json({ error: `invalid model: ${modelId}` });
        return null;
    }
    return modelId;
}

export function validateRequirementAndModel(req, res) {
    const modelId = req.body.model ?? DEFAULT_MODEL;
    if (!req.body.requirement?.title) {
        res.status(400).json({ error: 'requirement is required' });
        return null;
    }
    if (!VALID_MODEL_IDS.has(modelId)) {
        res.status(400).json({ error: `invalid model: ${modelId}` });
        return null;
    }
    return modelId;
}
