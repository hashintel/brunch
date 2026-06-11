import { abbreviateHomePath, APP_NAME, APP_TAGLINE, APP_VERSION } from '../app-meta.js';
import brunchLogo from '../assets/brunch.png';

// ── Global header ─────────────────────────────────────────────────────
//
// Persistent app chrome shown above every route: product identity on the left,
// workspace path on the right. The mark is the canonical brunch logo (a
// sunny-side-up egg), shared with the prior trunk's route-root header.

export function AppHeader({ cwd }: { cwd: string }) {
  return (
    <header className="border-rule flex h-14 shrink-0 items-center gap-3 border-b px-6">
      <img src={brunchLogo} alt="" aria-hidden="true" className="h-7 w-auto shrink-0" />
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="text-ink text-lg font-medium tracking-[-0.02em]">{APP_NAME}</span>
        <span className="text-sub font-mono text-sm">v{APP_VERSION}</span>
        <span aria-hidden="true" className="border-rule h-4 w-px translate-y-0.5 border-r" />
        <span className="text-sub min-w-0 truncate text-base">{APP_TAGLINE}</span>
        <span className="text-sub min-w-0 flex-1 truncate text-right font-mono text-sm">
          {abbreviateHomePath(cwd)}
        </span>
      </div>
    </header>
  );
}
