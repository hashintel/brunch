import { useMutation } from '@tanstack/react-query';

interface MutationErrorResponse {
  error?: string;
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
    const payload = (await response.json()) as MutationErrorResponse;
    if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
      return payload.error;
    }
  } catch {
    // Fall back to the caller-provided message when the response is not JSON.
  }

  return fallbackMessage;
}

export async function postJsonMutation<TResponse, TRequest>(
  url: string,
  body: TRequest,
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
    return (await response.json()) as TResponse;
  } catch {
    throw new ClientMutationError(fallbackMessage, response.status);
  }
}

export function useClientMutation<TResponse, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TResponse>,
) {
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
