import { useState } from 'react';

// ── Drawer card — reusable card-with-collapsible-drawer ─────────────
//
// Ported from the prior trunk (../brunch/src/client/components/drawer-card.tsx).
// Toggle is always collapsed ↔ expanded. What "collapsed" looks like
// depends on whether a summary is provided:
//
//   children | summary | Collapsed          | Expanded
//   ---------|---------|--------------------|---------
//   no       | —       | Static card        | —
//   yes      | no      | Fully closed       | Full drawer
//   yes      | yes     | Summary strip      | Full drawer

export function DrawerCard({
  header,
  summary,
  children,
  defaultExpanded = false,
  locked = false,
  compact = false,
}: {
  header: React.ReactNode;
  summary?: React.ReactNode;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
  /** When true, the header is not clickable and state does not toggle. */
  locked?: boolean;
  /** Tighter padding for sidebar/compact contexts. */
  compact?: boolean;
}) {
  const canToggle = !!children && !locked;
  const [expanded, setExpanded] = useState(defaultExpanded);

  const showDrawer = expanded || !!summary;
  const drawerContent = expanded && children ? children : summary;

  const headerPadding = compact ? 'p-2.5' : 'p-4';
  const drawerPadding = compact ? 'px-2.5 pt-2 pb-2.5' : 'px-4 pt-3 pb-4';
  const drawerGap = compact ? 'gap-2' : 'gap-3';

  const headerEl = canToggle ? (
    <button
      type="button"
      onClick={() => setExpanded((prev) => !prev)}
      className={`border-rule -m-px w-[calc(100%+2px)] cursor-pointer overflow-hidden rounded-xl border bg-white ${headerPadding} text-left shadow-[var(--shadow-card)]`}
    >
      {header}
    </button>
  ) : (
    <div
      className={`border-rule -m-px overflow-hidden rounded-xl border bg-white ${headerPadding} shadow-[var(--shadow-card)]`}
    >
      {header}
    </div>
  );

  if (!showDrawer) {
    return (
      <div className="border-rule overflow-hidden rounded-xl border shadow-[var(--shadow-card)]">
        <div className={`rounded-xl bg-white ${headerPadding} shadow-[var(--shadow-card)]`}>{header}</div>
      </div>
    );
  }

  return (
    <div className="border-rule bg-tint overflow-hidden rounded-xl border shadow-[var(--shadow-card)]">
      {headerEl}
      <div className={`flex flex-col ${drawerGap} ${drawerPadding}`}>{drawerContent}</div>
    </div>
  );
}
