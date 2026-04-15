import { useState } from 'react';

// ── Drawer card — reusable card-with-collapsible-drawer ─────────────
//
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
}: {
  header: React.ReactNode;
  summary?: React.ReactNode;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
  /** When true, the header is not clickable and state does not toggle. */
  locked?: boolean;
}) {
  const canToggle = !!children && !locked;
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Determine whether the drawer is showing
  const showDrawer = expanded || !!summary;
  const drawerContent = expanded && children ? children : summary;

  // Header element — button only when toggleable
  const headerEl = canToggle ? (
    <button
      type="button"
      onClick={() => setExpanded((prev) => !prev)}
      className="-m-px w-[calc(100%+2px)] cursor-pointer overflow-hidden rounded-xl border border-rule bg-white p-4 text-left shadow-[var(--shadow-card)]"
    >
      {header}
    </button>
  ) : (
    <div className="-m-px overflow-hidden rounded-xl border border-rule bg-white p-4 shadow-[var(--shadow-card)]">
      {header}
    </div>
  );

  // No drawer content at all — plain card
  if (!showDrawer) {
    return (
      <div className="overflow-hidden rounded-xl border border-rule">
        <div className="rounded-xl bg-white p-4 shadow-[var(--shadow-card)]">{header}</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-tint">
      {headerEl}
      <div className="flex flex-col gap-3 px-4 pt-3 pb-4">{drawerContent}</div>
    </div>
  );
}
