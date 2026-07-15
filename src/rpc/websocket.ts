import type { IncomingMessage, Server as HttpServer } from 'node:http';

import { WebSocket, WebSocketServer, type RawData } from 'ws';

import type { RpcHandlers } from './handlers.js';
import { createProductUpdateNotification, type ProductUpdatePublisher } from './product-updates.js';
import { dispatchJsonRpcMessage } from './protocol.js';
import type { SessionEventRelay } from './session-event-relay.js';

export interface WebRpcTransport {
  close(): Promise<void>;
}

const handledUpgradeRequests = new WeakSet<IncomingMessage>();

export function isWebRpcUpgradeHandled(request: IncomingMessage): boolean {
  return handledUpgradeRequests.has(request);
}

export function attachWebRpcTransport<TSessionFrame = never>(options: {
  server: HttpServer;
  path: string;
  handlers: RpcHandlers;
  productUpdates?: ProductUpdatePublisher;
  sessionEvents?:
    | Pick<SessionEventRelay, 'subscribe'>
    | {
        subscribe(listener: (frame: TSessionFrame) => void): () => void;
      };
}): WebRpcTransport {
  const webSocketServer = new WebSocketServer({ noServer: true });
  let activeRequests = 0;
  const deferredNotifications: string[] = [];
  const flushDeferredNotifications = () => {
    for (const notification of deferredNotifications.splice(0)) {
      broadcastNotification(notification);
    }
  };
  const publishDeferredNotification = (notification: string) => {
    if (activeRequests > 0) {
      deferredNotifications.push(notification);
      return;
    }
    broadcastNotification(notification);
  };
  const unsubscribeProductUpdates = options.productUpdates?.subscribe((updates) => {
    publishDeferredNotification(JSON.stringify(createProductUpdateNotification(updates)));
  });
  const unsubscribeSessionEvents = options.sessionEvents?.subscribe((frame) => {
    broadcastNotification(JSON.stringify(frame));
  });

  options.server.on('upgrade', (request, socket, head) => {
    if (request.url !== options.path) return;
    handledUpgradeRequests.add(request);

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit('connection', webSocket, request);
    });
  });

  webSocketServer.on('connection', (webSocket) => {
    webSocket.on('message', (data) => {
      recordRequestStarted();
      void handleMessage(options.handlers, data)
        .catch(() => ({
          jsonrpc: '2.0' as const,
          id: null,
          error: { code: -32603, message: 'Internal error' },
        }))
        .then((response) => {
          sendRpcResponse(webSocket, response);
        })
        .finally(recordRequestFinished);
    });
  });

  return {
    async close() {
      unsubscribeProductUpdates?.();
      unsubscribeSessionEvents?.();
      for (const client of webSocketServer.clients) {
        client.close();
      }
      await new Promise<void>((resolve, reject) => {
        webSocketServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
  function recordRequestStarted(): void {
    activeRequests += 1;
  }

  function recordRequestFinished(): void {
    activeRequests -= 1;
    if (activeRequests === 0) {
      flushDeferredNotifications();
    }
  }

  function sendRpcResponse(client: WebSocket, response: Awaited<ReturnType<typeof handleMessage>>): void {
    sendIfOpen(client, JSON.stringify(response));
  }

  function broadcastNotification(notification: string): void {
    for (const client of webSocketServer.clients) {
      sendIfOpen(client, notification);
    }
  }

  function sendIfOpen(client: WebSocket, message: string): void {
    if (!isWebSocketOpen(client)) return;
    try {
      client.send(message);
    } catch {
      // Ignore per-client transport failures; other observers and request
      // accounting must continue.
    }
  }
}

/**
 * A client can receive a frame only while its connection is OPEN. Read the
 * readiness state against the runtime `WebSocket.OPEN` constant from `ws`
 * rather than the per-instance `client.OPEN`, so the contract names the shared
 * protocol constant instead of relying on each socket instance carrying it.
 */
function isWebSocketOpen(client: WebSocket): boolean {
  return client.readyState === WebSocket.OPEN;
}

async function handleMessage(handlers: RpcHandlers, data: RawData) {
  const message = websocketMessageToString(data);
  return dispatchJsonRpcMessage(message, handlers);
}

function websocketMessageToString(data: RawData): string {
  if (typeof data === 'string') {
    return data;
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf8');
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(data)).toString('utf8');
  }
  return Buffer.from(data).toString('utf8');
}
