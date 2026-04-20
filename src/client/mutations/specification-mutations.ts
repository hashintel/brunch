import type { CreateSpecificationRequest, CreateSpecificationResponse } from '@/shared/specification.js';

import { postJsonMutation, useClientMutation } from './client-mutation.js';

type CreateSpecificationInput = CreateSpecificationRequest;

export interface CreateSpecificationMutationState {
  readonly createSpecification: (input: CreateSpecificationInput) => Promise<CreateSpecificationResponse>;
  readonly isPending: boolean;
  readonly errorMessage: string | null;
  readonly clearError: () => void;
}

export function useCreateSpecificationMutation(): CreateSpecificationMutationState {
  const mutation = useClientMutation((variables: CreateSpecificationRequest) =>
    postJsonMutation<CreateSpecificationResponse, CreateSpecificationRequest>(
      '/api/specifications',
      variables,
      'Failed to create specification',
    ),
  );

  return {
    createSpecification: ({ name, mode }: CreateSpecificationInput) =>
      mutation.run({ name, ...(mode ? { mode } : {}) }),
    isPending: mutation.isPending,
    errorMessage: mutation.errorMessage,
    clearError: mutation.clearError,
  };
}
