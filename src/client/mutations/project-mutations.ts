import type { CreateProjectRequest, CreateProjectResponse } from '@/shared/api-types.js';

import { postJsonMutation, useClientMutation } from './client-mutation.js';

type CreateSpecificationInput = CreateProjectRequest;

export interface CreateSpecificationMutationState {
  readonly createSpecification: (input: CreateSpecificationInput) => Promise<CreateProjectResponse>;
  readonly isPending: boolean;
  readonly errorMessage: string | null;
  readonly clearError: () => void;
}

export function useCreateSpecificationMutation(): CreateSpecificationMutationState {
  const mutation = useClientMutation((variables: CreateProjectRequest) =>
    postJsonMutation<CreateProjectResponse, CreateProjectRequest>(
      '/api/projects',
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
