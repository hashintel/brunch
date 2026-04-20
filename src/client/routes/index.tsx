import { createFileRoute } from '@tanstack/react-router';

import { SpecificationList, fetchSpecificationListLoaderData } from './-project-list.js';

export const Route = createFileRoute('/')({
  loader: fetchSpecificationListLoaderData,
  component: SpecificationList,
});
