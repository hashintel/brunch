import { Outlet, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <Outlet />
    </div>
  ),
});
