import { useNavigate } from '@tanstack/react-router';

import { createProjectResponseSchema } from '../../shared/api-types.js';
import type { CreateProjectRequest, CreateProjectResponse } from '../../shared/api-types.js';
import { postJsonMutation, useClientMutation } from './client-mutation.js';

export interface CreateProjectMutationState {
  readonly createProject: (name: string) => Promise<CreateProjectResponse>;
  readonly isPending: boolean;
  readonly errorMessage: string | null;
  readonly clearError: () => void;
}

export function useCreateProjectMutation(): CreateProjectMutationState {
  const navigate = useNavigate();
  const mutation = useClientMutation((variables: CreateProjectRequest) =>
    postJsonMutation<CreateProjectResponse, CreateProjectRequest>(
      '/api/projects',
      variables,
      createProjectResponseSchema,
      'Failed to create project',
    ),
  );

  return {
    createProject: async (name: string) => {
      const project = await mutation.run({ name });
      void navigate({ to: '/project/$id', params: { id: String(project.id) } });
      return project;
    },
    isPending: mutation.isPending,
    errorMessage: mutation.errorMessage,
    clearError: mutation.clearError,
  };
}
