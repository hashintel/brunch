import { Link, Outlet } from '@tanstack/react-router';

import { HashMark, HashWordmark } from '../components/hash-logo.js';

export function RouteRoot({ cwd }: { cwd: string }) {
  return (
    <div className="flex h-dvh flex-col bg-background font-sans text-foreground antialiased">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-rule bg-card px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <HashMark />
          <HashWordmark />
        </Link>
        <span className="font-mono text-xs text-sub">{cwd}</span>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
