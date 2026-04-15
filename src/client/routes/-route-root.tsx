import { Link, Outlet } from '@tanstack/react-router';

import { Separator } from '@/client/components/ui/separator';

function BrunchBrand() {
  return (
    <>
      <span className="size-5 shrink-0 rounded-md bg-zinc-300" />
      <span className="text-base font-medium tracking-[-0.02em] text-foreground">Brunch</span>
    </>
  );
}

export function RouteRoot({ cwd }: { cwd: string }) {
  return (
    <div className="flex h-dvh flex-col bg-background font-sans text-foreground antialiased">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-rule bg-card px-3">
        <Link to="/" className="flex min-w-0 items-center gap-2 text-foreground">
          <BrunchBrand />
          <span className="shrink-0 font-mono text-sm text-sub">v{__APP_VERSION__}</span>
        </Link>
        <Separator orientation="vertical" className="h-4" />
        <span className="truncate text-base text-sub">AI-guided spec elicitation</span>
        <span className="min-w-0 flex-1 truncate text-right font-mono text-sm text-sub">{cwd}</span>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
