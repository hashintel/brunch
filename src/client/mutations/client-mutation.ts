import { useMutation } from '@tanstack/react-query';
import type { ZodType } from 'zod/v4';

import { mutationErrorResponseSchema } from '../../shared/api-types.js';
import type { MutationErrorResponse } from '../../shared/api-types.js';

export interface ClientMutationState<TResponse, TVariables> {
  readonly run: (variables: TVariables) => Promise<TResponse>;
  readonly isPending: boolean;
  readonly errorMessage: string | null;
  readonly clearError: () => void;
}

export class ClientMutationError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ClientMutationError';
    this.status = status;
  }
}

async function readMutationErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const payload = mutationErrorResponseSchema.parse((await response.json()) as MutationErrorResponse);
    if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
      return payload.error;
    }
  } catch {
    // Fall back to the caller-provided message when the response is not JSON or does not match the contract.
  }

  return fallbackMessage;
}

export async function postJsonMutation<TResponse, TRequest>(
  url: string,
  body: TRequest,
  responseSchema: ZodType<TResponse>,
  fallbackMessage: string,
): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ClientMutationError(fallbackMessage);
  }

  if (!response.ok) {
    throw new ClientMutationError(await readMutationErrorMessage(response, fallbackMessage), response.status);
  }

  try {
    return responseSchema.parse(await response.json());
  } catch {
    throw new ClientMutationError(fallbackMessage, response.status);
  }
}

export function useClientMutation<TResponse, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TResponse>,
): ClientMutationState<TResponse, TVariables> {
  const mutation = useMutation<TResponse, ClientMutationError, TVariables>({ mutationFn });

  return {
    run: async (variables: TVariables) => {
      mutation.reset();
      return mutation.mutateAsync(variables);
    },
    isPending: mutation.isPending,
    errorMessage: mutation.error?.message ?? null,
    clearError: mutation.reset,
  };
}
