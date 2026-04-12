import { Outlet } from '@tanstack/react-router';

export function RouteRoot() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <Outlet />
    </div>
  );
}
