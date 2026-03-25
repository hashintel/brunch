import { getModelBackend } from '../models.js';
import * as claude from './claude.js';
import * as opencode from './opencode.js';

function svc(modelId) {
    return getModelBackend(modelId) === 'opencode' ? opencode : claude;
}

export const streamQueryText = (p, m, ...rest) => svc(m).streamQueryText(p, m, ...rest);
export const queryStructured = (p, m, ...rest) => svc(m).queryStructured(p, m, ...rest);
export const streamQueryTextWithTools = (p, m, ...rest) => svc(m).streamQueryTextWithTools(p, m, ...rest);
export const streamQueryWithTools = (p, m, ...rest) => svc(m).streamQueryWithTools(p, m, ...rest);
export { createAssistantMcpServer } from './claude.js';
