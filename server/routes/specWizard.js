import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validatePromptAndModel } from '../middleware/validate.js';
import { queryStructured } from '../services/dispatch.js';
import { specQuestionsSchema, structuredSpecSchema } from '../schemas.js';

const router = Router();

router.post('/spec-wizard/questions', asyncHandler(async (req, res) => {
    const modelId = validatePromptAndModel(req, res);
    if (!modelId) return;

    const { prompt, cwd, projectId, previousAnswers } = req.body;
    console.log(`[${modelId}] spec-wizard/questions`);

    let userContent = `Project idea:\n${prompt}\n\n`;

    if (previousAnswers?.length) {
        const answersText = previousAnswers.map((a, i) =>
            `Q${i + 1}: ${a.question}\nA: ${a.skipped ? 'Skipped' : a.selectedLabels.join(', ')}${a.otherText ? ` (${a.otherText})` : ''}`
        ).join('\n\n');
        userContent += `Previous answers:\n${answersText}\n\n`;
    }

    userContent += `You are a project spec wizard. Generate 5-8 clarifying questions to build a comprehensive project specification.

Each question should:
- Have an "impact" level: "high" for questions that fundamentally shape the project, "medium" for important details, "low" for nice-to-have clarifications
- Have a "selectionType": "single" for mutually exclusive choices, "multi" for questions where multiple options can apply
- Have 2-5 concrete options
- Include a "why" explanation of why this question matters for the spec

Focus on questions about: target users, core features, technical constraints, success criteria, timeline, and risks.
Generate a unique "id" for each question (short kebab-case string).`;

    const output = await queryStructured(userContent, modelId, specQuestionsSchema, cwd, projectId);
    res.json(output);
}));

router.post('/spec-wizard/generate', asyncHandler(async (req, res) => {
    const modelId = validatePromptAndModel(req, res);
    if (!modelId) return;

    const { prompt, cwd, projectId, answers } = req.body;
    console.log(`[${modelId}] spec-wizard/generate`);

    let userContent = `Project idea:\n${prompt}\n\n`;

    if (answers?.length) {
        const answersText = answers.map(a =>
            `Q: ${a.question}\nA: ${a.skipped ? 'Skipped' : a.selectedLabels.join(', ')}${a.otherText ? ` (${a.otherText})` : ''}`
        ).join('\n\n');
        userContent += `Clarifying answers:\n${answersText}\n\n`;
    }

    userContent += `Based on the project idea and any answers provided, generate a structured project specification.

Return a JSON object with:
- "overallConfidence": a number 0-100 representing how complete/confident the spec is
- "sections": an array of spec sections, each with:
  - "type": one of "purpose", "success_criteria", "deliverables", "risks"
  - "confidence": 0-100 confidence for this section
  - "content": a brief paragraph summary
  - "items": array of bullet point strings (for success_criteria and deliverables)
  - "risks": array of {risk, severity, mitigation} objects (only for risks section)
  - "assumptions": array of assumption strings (optional, for any section)

Confidence guidelines:
- With just the idea: 15-30%
- With 1-2 answers: 30-50%
- With 3-5 answers: 50-70%
- With all questions answered: 70-90%

Always include all four section types. Be specific and actionable.`;

    const output = await queryStructured(userContent, modelId, structuredSpecSchema, cwd, projectId);
    res.json(output);
}));

export default router;
