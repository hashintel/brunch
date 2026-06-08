import type { JsonRpcFailure, JsonRpcId, JsonRpcRequest, JsonRpcResponse } from '../rpc/protocol.js';

type WebSocketEventListener = (event: { data?: unknown }) => void;

type WebSocketLike = Pick<WebSocket, 'send' | 'close'> & {
  addEventListener(event: string, listener: WebSocketEventListener): void;
};

type WebSocketConstructor = new (url: string) => WebSocketLike;

export interface WebSocketRpcClient {
  request<T>(method: string, params?: unknown): Promise<T>;
  subscribe(listener: WebSocketRpcNotificationListener): () => void;
  close(): void;
}

export interface WebSocketRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

export type WebSocketRpcNotificationListener = (notification: WebSocketRpcNotification) => void;

export class JsonRpcClientError extends Error {
  readonly code: number;

  constructor(error: JsonRpcFailure['error']) {
    super(error.message);
    this.name = 'JsonRpcClientError';
    this.code = error.code;
  }
}

type PendingRequest = {
  resolve(value: unknown): void;
  reject(error: Error): void;
};

interface ResponseFrameSuccess {
  ok: true;
  value: JsonRpcResponse | WebSocketRpcNotification;
}

interface ResponseFrameFailure {
  ok: false;
}

type ResponseFrameParseResult = ResponseFrameSuccess | ResponseFrameFailure;

export function createWebSocketRpcClient(options: {
  url?: string;
  WebSocketImpl?: WebSocketConstructor;
}): WebSocketRpcClient {
  const WebSocketImpl = options.WebSocketImpl ?? WebSocket;
  const url = options.url ?? defaultRpcUrl();
  const socket = new WebSocketImpl(url);
  const pending = new Map<JsonRpcId, PendingRequest>();
  const notificationListeners = new Set<WebSocketRpcNotificationListener>();
  const queued: string[] = [];
  let nextId = 1;
  let isOpen = false;
  let isClosed = false;
  let terminalError: Error | null = null;

  socket.addEventListener('open', () => {
    isOpen = true;
    for (const message of queued.splice(0)) {
      socket.send(message);
    }
  });

  socket.addEventListener('message', (event) => {
    const parsed = parseResponseFrame(event.data);
    if (!parsed.ok) {
      failProtocol();
      return;
    }

    if (isJsonRpcNotification(parsed.value)) {
      for (const listener of notificationListeners) {
        listener(parsed.value);
      }
      return;
    }

    const response = parsed.value;
    const request = pending.get(response.id);
    if (!request) {
      failProtocol();
      return;
    }
    pending.delete(response.id);
    if ('error' in response) {
      request.reject(new JsonRpcClientError(response.error));
      return;
    }
    request.resolve(response.result);
  });

  socket.addEventListener('close', () => {
    if (!isClosed) {
      rejectPending(new Error('Brunch WebSocket RPC connection closed'));
    }
    isClosed = true;
  });

  socket.addEventListener('error', () => {
    terminalError = new Error('Brunch WebSocket RPC connection failed');
    isClosed = true;
    rejectPending(terminalError);
  });

  function failProtocol(): void {
    // A malformed, uncorrelatable, or otherwise invalid server frame means the
    // client cannot trust response correlation anymore. Close this attachment,
    // reject pending calls, and make future requests fail immediately.
    terminalError = new Error('Brunch WebSocket RPC protocol failure');
    isClosed = true;
    rejectPending(terminalError);
    socket.close();
  }

  function rejectPending(error: Error): void {
    for (const request of pending.values()) {
      request.reject(error);
    }
    pending.clear();
    queued.length = 0;
  }

  return {
    request<T>(method: string, params?: unknown): Promise<T> {
      if (terminalError) {
        return Promise.reject(terminalError);
      }
      if (isClosed) {
        return Promise.reject(new Error('Brunch WebSocket RPC client closed'));
      }

      const id = nextId;
      nextId += 1;
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        ...(params === undefined ? {} : { params }),
      };
      const message = JSON.stringify(request);

      return new Promise<T>((resolve, reject) => {
        pending.set(id, {
          resolve: (value) => resolve(value as T),
          reject,
        });
        if (isOpen) {
          socket.send(message);
          return;
        }
        queued.push(message);
      });
    },

    subscribe(listener: WebSocketRpcNotificationListener) {
      notificationListeners.add(listener);
      return () => {
        notificationListeners.delete(listener);
      };
    },

    close() {
      if (isClosed) {
        return;
      }
      isClosed = true;
      rejectPending(new Error('Brunch WebSocket RPC client closed'));
      socket.close();
    },
  };
}

function parseResponseFrame(data: unknown): ResponseFrameParseResult {
  try {
    const value = JSON.parse(String(data)) as unknown;
    return isJsonRpcResponse(value) || isJsonRpcNotification(value) ? { ok: true, value } : { ok: false };
  } catch {
    return { ok: false };
  }
}

function isJsonRpcNotification(value: unknown): value is WebSocketRpcNotification {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { jsonrpc?: unknown }).jsonrpc === '2.0' &&
    typeof (value as { method?: unknown }).method === 'string' &&
    !Object.hasOwn(value, 'id')
  );
}

function isJsonRpcResponse(value: unknown): value is JsonRpcResponse {
  if (
    typeof value !== 'object' ||
    value === null ||
    (value as { jsonrpc?: unknown }).jsonrpc !== '2.0' ||
    !isJsonRpcId((value as { id?: unknown }).id)
  ) {
    return false;
  }

  if ('error' in value) {
    const error = (value as { error?: unknown }).error;
    return (
      typeof error === 'object' &&
      error !== null &&
      typeof (error as { code?: unknown }).code === 'number' &&
      typeof (error as { message?: unknown }).message === 'string'
    );
  }

  return Object.hasOwn(value, 'result');
}

function isJsonRpcId(value: unknown): value is JsonRpcId {
  return value === null || typeof value === 'string' || typeof value === 'number';
}

function defaultRpcUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/rpc`;
}
