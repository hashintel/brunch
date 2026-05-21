import { Link, Outlet } from '@tanstack/react-router';

import brunchLogo from '@/client/assets/brunch.png';

export function RouteRoot({ cwd }: { cwd: string }) {
  return (
    <div className="flex h-dvh flex-col bg-background font-sans text-foreground antialiased">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-rule bg-card px-3">
        <Link to="/" className="flex shrink-0 items-baseline gap-2 text-foreground">
          <img src={brunchLogo} alt="brunch" className="h-7 w-auto shrink-0" />
        </Link>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <Link to="/" className="flex shrink-0 items-baseline gap-2">
            <span className="text-lg font-medium tracking-[-0.02em] text-foreground">brunch</span>
            <span className="font-mono text-sm text-sub">v{__APP_VERSION__}</span>
          </Link>
          <div className="h-4 w-px translate-y-0.5 border-r border-rule" />
          <span className="min-w-0 truncate text-base text-sub">AI-guided spec elicitation</span>
          <span className="min-w-0 flex-1 truncate text-right font-mono text-sm text-sub">{cwd}</span>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
