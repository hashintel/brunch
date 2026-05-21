import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { BrunchWebApp } from "./app.js"
import { createWebSocketRpcClient } from "./rpc-client.js"

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("Brunch web shell requires a #root element")
}

createRoot(rootElement).render(
  <StrictMode>
    <BrunchWebApp rpcClient={createWebSocketRpcClient({})} />
  </StrictMode>,
)
