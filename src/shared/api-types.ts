import type { getProjectState, listProjectStates } from '../server/core.js';
import type { getEntitiesForProject } from '../server/db.js';

export type ProjectListItem = ReturnType<typeof listProjectStates>[number];
export type ProjectState = NonNullable<ReturnType<typeof getProjectState>>;
export type ProjectStateTurn = ProjectState['turns'][number];
export type EntitiesData = ReturnType<typeof getEntitiesForProject>;
