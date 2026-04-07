import { Suspense, lazy } from 'react';

const LazyComponentDebug = lazy(async () => {
  const module = await import('./ComponentDebug.js');
  return { default: module.ComponentDebug };
});

export const DebugSurfaceRouteComponent = () => (
  <Suspense fallback={null}>
    <LazyComponentDebug />
  </Suspense>
);
