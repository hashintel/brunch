import { useNavigate } from '@tanstack/react-router';

import {
  createProjectResponseSchema,
  type CreateProjectRequest,
  type CreateProjectResponse,
} from '../../shared/api-types.js';
import { postJsonMutation, useClientMutation } from './client-mutation.js';

export interface CreateProjectMutationState {
  createProject: (name: string) => Promise<CreateProjectResponse>;
  isPending: boolean;
  errorMessage: string | null;
  clearError: () => void;
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
