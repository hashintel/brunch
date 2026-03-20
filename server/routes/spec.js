import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validatePromptAndModel } from '../middleware/validate.js';
import { queryStructured } from '../services/claude.js';
import { specSchema, formatClarifyingRounds, formatAssumptionsContext } from '../schemas.js';

const router = Router();

router.post('/generatespec', asyncHandler(async (req, res) => {
    const modelId = validatePromptAndModel(req, res);
    if (!modelId) return;

    const { prompt, cwd, projectId, clarifyingRounds, assumptions, requirements } = req.body;
    console.log(`[${modelId}] generatespec`);

    let userContent = `Goal description:\n${prompt}\n\n`;

    const roundsText = formatClarifyingRounds(clarifyingRounds);
    if (roundsText) {
        userContent += `Clarifying Q&A:\n${roundsText}\n\n`;
    }

    const assumptionsText = formatAssumptionsContext(assumptions);
    if (assumptionsText) {
        userContent += `Assumptions:\n${assumptionsText}\n\n`;
    }

    if (requirements?.length) {
        const reqText = requirements.map((r, i) =>
            `${i + 1}. ${r.title}: ${r.definition} (confidence: ${Math.round(r.confidence * 100)}%)`
        ).join('\n');
        userContent += `Requirements:\n${reqText}\n\n`;
    }

    userContent += `You are a spec-driven development assistant. Based on all available context above, produce a comprehensive markdown specification document.

The spec should include (as applicable based on available information):
- **Overview**: Brief project summary and goals
- **Scope**: What is and isn't included
- **User Stories / Use Cases**: Key user interactions
- **Functional Requirements**: Detailed feature descriptions
- **Non-Functional Requirements**: Performance, security, scalability constraints
- **Technical Architecture**: High-level technical decisions and constraints
- **Data Model**: Key entities and relationships
- **API Design**: Endpoints or interfaces (if applicable)
- **Open Questions**: Unresolved items that need clarification

Also estimate the spec completeness as a progress percentage (0-100):
- 10-20%: Only have the goal, very rough outline
- 30-50%: Have goal + clarifying Q&A, moderate detail
- 50-70%: Have goal + Q&A + assumptions, good structure
- 80-100%: Have everything including requirements, comprehensive spec

Return the full markdown spec and the progress estimate.`;

    const output = await queryStructured(userContent, modelId, specSchema, cwd, projectId);
    res.json(output);
}));

export default router;
