import { createFileRoute } from '@tanstack/react-router';

import { ProjectList, fetchProjectListLoaderData } from './-project-list.js';

export const Route = createFileRoute('/')({
  loader: fetchProjectListLoaderData,
  component: ProjectList,
});
