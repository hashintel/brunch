import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validatePromptAndModel } from '../middleware/validate.js';
import { streamQueryText, streamQueryTextWithTools, createSetGoalMcpServer } from '../services/claude.js';

const MCP_SERVER_NAME = 'assistant-tools';
const MCP_TOOL_NAMES = new Set([
    `mcp__${MCP_SERVER_NAME}__set_goal`,
]);

const router = Router();

router.post('/stream', asyncHandler(async (req, res) => {
    const modelId = validatePromptAndModel(req, res);
    if (!modelId) return;

    const { prompt, cwd, projectId, assistant } = req.body;
    console.log(`[${modelId}]${cwd ? ` (${cwd})` : ''}${assistant ? ' [assistant]' : ''} ${prompt}`);

    if (assistant) {
        const mcpServer = createSetGoalMcpServer();
        const text = await streamQueryTextWithTools(prompt, modelId, res, cwd, projectId, { [MCP_SERVER_NAME]: mcpServer }, MCP_TOOL_NAMES);
        console.log(`[${modelId}] assistant response: ${text}`);
    } else {
        const text = await streamQueryText(prompt, modelId, res, cwd, projectId);
        console.log(`[${modelId}] response: ${text}`);
    }
}));

export default router;
