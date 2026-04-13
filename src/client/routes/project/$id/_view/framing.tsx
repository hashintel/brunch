import { createFileRoute } from '@tanstack/react-router';

import { InterviewView } from './-interview-view.js';

export const Route = createFileRoute('/project/$id/_view/framing')({
  component: InterviewView,
});
