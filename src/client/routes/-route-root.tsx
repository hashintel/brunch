import { Link, Outlet } from '@tanstack/react-router';

function BrunchBrand() {
  return (
    <>
      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-[linear-gradient(135deg,#3484fa_0%,#2070e6_58%,#1060d6_100%)] shadow-[var(--shadow-card)]">
        <span className="size-2 rounded-[3px] bg-white/90" />
      </span>
      <span className="text-sm font-medium tracking-[-0.02em] text-foreground">Brunch</span>
    </>
  );
}

export function RouteRoot({ cwd }: { cwd: string }) {
  return (
    <div className="flex h-dvh flex-col bg-background font-sans text-foreground antialiased">
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-rule bg-card px-3">
        <Link to="/" className="flex min-w-0 items-center gap-2 text-foreground">
          <BrunchBrand />
          <span className="shrink-0 text-xs text-sub">v{__APP_VERSION__}</span>
          <span className="shrink-0 text-xs text-hint">|</span>
          <span className="truncate text-xs text-sub">AI-guided spec elicitation</span>
        </Link>
        <span className="min-w-0 flex-1 truncate text-right font-mono text-xs text-sub">{cwd}</span>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
