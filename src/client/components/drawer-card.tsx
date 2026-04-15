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
}: {
  header: React.ReactNode;
  summary?: React.ReactNode;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const canToggle = !!children;
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Static card — no children means no toggle, no drawer
  if (!canToggle) {
    // Still show summary strip if provided (non-toggleable peek)
    if (summary) {
      return (
        <div className="overflow-hidden rounded-xl border border-rule bg-tint">
          <div className="-m-px overflow-hidden rounded-xl border border-rule bg-white p-4 shadow-[var(--shadow-card)]">
            {header}
          </div>
          <div className="flex flex-col gap-3 px-4 pt-3 pb-4">{summary}</div>
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-xl border border-rule">
        <div className="rounded-xl bg-white p-4 shadow-[var(--shadow-card)]">{header}</div>
      </div>
    );
  }

  // Collapsed state: show summary strip if provided, otherwise fully closed
  const showDrawer = expanded || !!summary;

  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-tint">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="-m-px w-[calc(100%+2px)] cursor-pointer overflow-hidden rounded-xl border border-rule bg-white p-4 text-left shadow-[var(--shadow-card)]"
      >
        {header}
      </button>

      {showDrawer && (
        <div className="flex flex-col gap-3 px-4 pt-3 pb-4">{expanded ? children : summary}</div>
      )}
    </div>
  );
}
