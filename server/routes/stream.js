import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validatePromptAndModel } from '../middleware/validate.js';
import { streamQueryText } from '../services/claude.js';

const router = Router();

router.post('/stream', asyncHandler(async (req, res) => {
    const modelId = validatePromptAndModel(req, res);
    if (!modelId) return;

    const { prompt, cwd } = req.body;
    console.log(`[${modelId}]${cwd ? ` (${cwd})` : ''} ${prompt}`);

    const text = await streamQueryText(prompt, modelId, res, cwd);
    console.log(`[${modelId}] response: ${text}`);
}));

export default router;
