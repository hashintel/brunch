import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validatePromptAndModel, validateRequirementAndModel } from '../middleware/validate.js';
import { queryStructured } from '../services/claude.js';
import { requirementJsonSchema, generateChildrenSchema, generateTestsSchema, formatClarifyingRounds, formatAssumptionsContext } from '../schemas.js';

const router = Router();

router.post('/streamrequirements', asyncHandler(async (req, res) => {
    const modelId = validatePromptAndModel(req, res);
    if (!modelId) return;

    const { prompt, cwd, clarifyingRounds, assumptions } = req.body;
    console.log(`[${modelId}] streamrequirements: ${prompt}`);

    let fullPrompt = prompt;
    const roundsContext = formatClarifyingRounds(clarifyingRounds);
    if (roundsContext) {
        fullPrompt = `${prompt}\n\nClarifying Q&A context:\n${roundsContext}`;
    }
    const assumptionsContext = formatAssumptionsContext(assumptions);
    if (assumptionsContext) {
        fullPrompt += `\n\nReviewed assumptions (use CONFIRMED and EDITED assumptions as foundations for the spec, IGNORE REJECTED ones):\n${assumptionsContext}`;
    }

    const output = await queryStructured(fullPrompt, modelId, requirementJsonSchema, cwd);
    res.json(output);
}));

router.post('/generatechildren', asyncHandler(async (req, res) => {
    const modelId = validateRequirementAndModel(req, res);
    if (!modelId) return;

    const { requirement, prompt, cwd } = req.body;
    console.log(`[${modelId}] generatechildren: ${requirement.title}`);

    const userContent = `You are a spec elicitation assistant breaking a requirement into sub-requirements.

Project goal:
${prompt || 'Not specified'}

Requirement to decompose:
Title: ${requirement.title}
Definition: ${requirement.definition}

Generate sub-requirements that break this requirement down into smaller, more specific parts. Each sub-requirement should have a title, definition, and confidence score (0-1). Generate 2-5 sub-requirements if the requirement is complex enough to warrant decomposition, or an empty array if it's already atomic.`;

    const output = await queryStructured(userContent, modelId, generateChildrenSchema, cwd);
    res.json(output);
}));

router.post('/generatetests', asyncHandler(async (req, res) => {
    const modelId = validateRequirementAndModel(req, res);
    if (!modelId) return;

    const { requirement, prompt, cwd } = req.body;
    console.log(`[${modelId}] generatetests: ${requirement.title}`);

    const userContent = `You are a spec elicitation assistant generating verification tests for a requirement.

Project goal:
${prompt || 'Not specified'}

Requirement to generate tests for:
Title: ${requirement.title}
Definition: ${requirement.definition}

Generate verification tests for this requirement. Each test has a "type" (one of: static_analysis, programmatic_test, llm_review, human_review) and a "description" explaining what to check. Choose the most appropriate test types — use static_analysis for linting/type checks, programmatic_test for unit/integration tests, llm_review for AI-based assessment, human_review for manual verification. Generate 1-4 tests.`;

    const output = await queryStructured(userContent, modelId, generateTestsSchema, cwd);
    res.json(output);
}));

export default router;
