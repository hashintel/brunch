import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validatePromptAndModel } from '../middleware/validate.js';
import { queryStructured } from '../services/claude.js';
import { clarifyingQuestionsSchema, formatClarifyingRounds } from '../schemas.js';

const router = Router();

router.post('/clarifyingquestions', asyncHandler(async (req, res) => {
    const modelId = validatePromptAndModel(req, res);
    if (!modelId) return;

    const { prompt, cwd, previousRounds, projectId } = req.body;
    console.log(`[${modelId}] clarifyingquestions`);

    let userContent = `Goal description:\n${prompt}\n\n`;

    const roundsText = formatClarifyingRounds(previousRounds);
    if (roundsText) {
        userContent += `Previous clarifying Q&A:\n${roundsText}\n\n`;
    }

    userContent += `You are a spec elicitation assistant. Based on the goal above${previousRounds?.length ? ' and the previous answers' : ''}, generate 3-5 multi-choice clarifying questions about ambiguities that would change the shape of the specification if answered differently. Each question should have 2-5 options. For each question, explain why it matters for the spec in the "why" field.

If the goal is already clear enough and no more clarification is needed, set "done" to true and return an empty questions array.`;

    const output = await queryStructured(userContent, modelId, clarifyingQuestionsSchema, cwd, projectId);
    res.json(output);
}));

export default router;
