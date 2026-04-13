import { createFileRoute } from '@tanstack/react-router';

import { InterviewView } from './-interview-view.js';

function FramingView() {
  return <InterviewView phase="scope" />;
}

export const Route = createFileRoute('/project/$id/_view/framing')({
  component: FramingView,
});
