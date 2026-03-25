import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validatePromptAndModel } from '../middleware/validate.js';
import { queryStructured, streamQueryWithTools } from '../services/dispatch.js';
import { specQuestionsSchema, structuredSpecSchema, wizardAssumptionsSchema, wizardRequirementsSchema, addQuestionTool, addAssumptionTool, addRequirementTool, setRequirementsMetaTool } from '../schemas.js';

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
Generate a unique "id" for each question (short kebab-case string).

Call the add_question tool once for each question. Do not output any other text.`;

    await streamQueryWithTools(userContent, modelId, res, [addQuestionTool], cwd, projectId);
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

router.post('/spec-wizard/assumptions', asyncHandler(async (req, res) => {
    const modelId = validatePromptAndModel(req, res);
    if (!modelId) return;

    const { prompt, cwd, projectId, answers } = req.body;
    console.log(`[${modelId}] spec-wizard/assumptions`);

    let userContent = `Project idea:\n${prompt}\n\n`;

    if (answers?.length) {
        const answersText = answers.map(a =>
            `Q: ${a.question}\nA: ${a.skipped ? 'Skipped' : a.selectedLabels.join(', ')}${a.otherText ? ` (${a.otherText})` : ''}`
        ).join('\n\n');
        userContent += `Clarifying answers:\n${answersText}\n\n`;
    }

    userContent += `Based on the project idea and clarifying answers, extract the key assumptions we are making about this project.

For each assumption:
- "id": unique kebab-case identifier
- "label": short label like "Core Assumption" for the first/most important one, or "A1", "A2", "A3", etc. for numbered ones
- "text": the assumption statement (one sentence, clear and specific)
- "rationale": why we're making this assumption based on available information (1-2 sentences)
- "impact": "high" if changing this assumption would fundamentally change the project, "medium" for significant but manageable changes, "low" for minor adjustments
- "confidence": "high" if explicitly stated or strongly implied, "medium" if reasonably inferred, "low" if speculative
- "options": 2-4 alternative options the user could choose instead of this assumption

Generate 5-8 assumptions, ordered by importance (highest impact first).
The first assumption should use label "Core Assumption" and represent the most fundamental assumption.

Call the add_assumption tool once for each assumption. Do not output any other text.`;

    await streamQueryWithTools(userContent, modelId, res, [addAssumptionTool], cwd, projectId);
}));

router.post('/spec-wizard/requirements', asyncHandler(async (req, res) => {
    const modelId = validatePromptAndModel(req, res);
    if (!modelId) return;

    const { prompt, cwd, projectId, answers, assumptions } = req.body;
    console.log(`[${modelId}] spec-wizard/requirements`);

    let userContent = `Project idea:\n${prompt}\n\n`;

    if (answers?.length) {
        const answersText = answers.map(a =>
            `Q: ${a.question}\nA: ${a.skipped ? 'Skipped' : a.selectedLabels.join(', ')}${a.otherText ? ` (${a.otherText})` : ''}`
        ).join('\n\n');
        userContent += `Clarifying answers:\n${answersText}\n\n`;
    }

    if (assumptions?.length) {
        const assumptionsText = assumptions.map((a, i) =>
            `${i + 1}. [${a.status?.toUpperCase() || 'PENDING'}] (impact: ${a.impact}, confidence: ${a.confidence}) ${a.editedText || a.text}`
        ).join('\n');
        userContent += `Confirmed assumptions:\n${assumptionsText}\n\n`;
    }

    userContent += `Based on all available context, generate a hierarchical requirements breakdown.

First, call set_requirements_meta with a concise project title and 1-2 sentence description.
Then, call add_requirement once for each top-level requirement (3-5 total). Each should include:
  - "id": like "R1", "R2", etc.
  - "title": clear requirement statement
  - "status": "ok" for well-defined, "uncertain" for needs-clarification, "decision_node" for requires a decision
  - "checks": array of verification checks, each with "description" and "type" (benchmark, e2e, unit, human_review, static_analysis)
  - "children": array of sub-requirements (2-4 each), with same structure plus their own children (0-3 each)
    - Sub-requirement ids should be like "R1.1", "R1.2"
    - Sub-sub-requirement ids like "R1.1.1", "R1.1.2"
    - Each should have 1-3 checks

Most requirements should have status "ok". 1-2 can be "uncertain". At most 1 "decision_node".
Generate 2-3 checks per top-level requirement.

Do not output any other text.`;

    await streamQueryWithTools(userContent, modelId, res, [setRequirementsMetaTool, addRequirementTool], cwd, projectId);
}));

export default router;
