import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { BrunchWebApp, createBrunchWebRuntime } from './app.js';
import { createWebSocketRpcClient } from './rpc-client.js';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Brunch web shell requires a #root element');
}

const runtime = createBrunchWebRuntime({
  rpcClient: createWebSocketRpcClient({}),
});
window.addEventListener('pagehide', () => runtime.dispose(), { once: true });

createRoot(rootElement).render(
  <StrictMode>
    <BrunchWebApp runtime={runtime} />
  </StrictMode>,
);
