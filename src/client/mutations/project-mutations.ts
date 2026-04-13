import type { CreateProjectRequest, CreateProjectResponse } from '@/shared/api-types.js';

import { postJsonMutation, useClientMutation } from './client-mutation.js';

type CreateProjectInput = CreateProjectRequest;

export interface CreateProjectMutationState {
  readonly createProject: (input: CreateProjectInput) => Promise<CreateProjectResponse>;
  readonly isPending: boolean;
  readonly errorMessage: string | null;
  readonly clearError: () => void;
}

export function useCreateProjectMutation(): CreateProjectMutationState {
  const mutation = useClientMutation((variables: CreateProjectRequest) =>
    postJsonMutation<CreateProjectResponse, CreateProjectRequest>(
      '/api/projects',
      variables,
      'Failed to create project',
    ),
  );

  return {
    createProject: ({ name, mode }: CreateProjectInput) => mutation.run({ name, ...(mode ? { mode } : {}) }),
    isPending: mutation.isPending,
    errorMessage: mutation.errorMessage,
    clearError: mutation.clearError,
  };
}
