import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { createWebFetchTool } from './web-fetch.js';
import { createWebSearchTool } from './web-search.js';

export { createWebFetchTool, fetchAndExtract, type WebFetchParams } from './web-fetch.js';
export { createWebSearchTool, formatBraveContext, type WebSearchParams } from './web-search.js';

export function registerBrunchWebTools(pi: ExtensionAPI): void {
  pi.registerTool(createWebFetchTool() as never);
  pi.registerTool(createWebSearchTool() as never);
}

export default registerBrunchWebTools;
