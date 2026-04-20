import {
  createProjectRequestSchema,
  createProjectResponseSchema,
  projectListItemSchema,
  projectListItemsSchema,
  projectModeSchema,
  projectSchema,
  projectStateSchema,
  projectStateTurnSchema,
  type CreateProjectRequest,
  type CreateProjectResponse,
  type Project,
  type ProjectListItem,
  type ProjectMode,
  type ProjectState,
  type ProjectStateTurn,
} from './api-types.js';

export const specificationModeSchema = projectModeSchema;
export const specificationSchema = projectSchema;
export const specificationTurnSchema = projectStateTurnSchema;
export const specificationListItemSchema = projectListItemSchema;
export const specificationListSchema = projectListItemsSchema;
export const specificationStateSchema = projectStateSchema;
export const createSpecificationRequestSchema = createProjectRequestSchema;
export const createSpecificationResponseSchema = createProjectResponseSchema;

export type SpecificationMode = ProjectMode;
export type Specification = Project;
export type SpecificationTurn = ProjectStateTurn;
export type SpecificationListItem = ProjectListItem;
export type SpecificationState = ProjectState;
export type CreateSpecificationRequest = CreateProjectRequest;
export type CreateSpecificationResponse = CreateProjectResponse;
