import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validatePromptAndModel } from '../middleware/validate.js';
import { queryStructured } from '../services/claude.js';
import { assumptionsSchema, formatClarifyingRounds } from '../schemas.js';

const router = Router();

router.post('/assumptions', asyncHandler(async (req, res) => {
    const modelId = validatePromptAndModel(req, res);
    if (!modelId) return;

    const { prompt, cwd, previousRounds, projectId } = req.body;
    console.log(`[${modelId}] assumptions`);

    let userContent = `Goal description:\n${prompt}\n\n`;

    const roundsText = formatClarifyingRounds(previousRounds);
    if (roundsText) {
        userContent += `Clarifying Q&A:\n${roundsText}\n\n`;
    }

    userContent += `You are a spec elicitation assistant. Based on the goal and clarifying answers above, surface 5-10 key assumptions you intend to build the specification on, ordered by importance.

For each assumption:
- "text": the assumption statement
- "rationale": why you are making this assumption and how it affects the spec
- "confidence": "high" (derived directly from user input), "medium" (inferred from patterns or context), or "low" (best guess with limited information)
- "impact": "high" (large portion of the spec depends on this), "medium" (affects several requirements), or "low" (minor impact on spec shape)

Focus on assumptions that, if wrong, would significantly change the specification. Include assumptions about technology choices, user expectations, scope boundaries, and constraints.`;

    const output = await queryStructured(userContent, modelId, assumptionsSchema, cwd, projectId);
    res.json(output);
}));

export default router;
