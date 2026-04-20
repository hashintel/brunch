import { Link } from '@tanstack/react-router';

import { cn } from '@/client/lib/utils';

export function WorkspaceArtifactRow({
  activity,
  children,
  errorMessage,
  className,
  testId,
}: {
  activity?: React.ReactNode;
  children: React.ReactNode;
  errorMessage?: string | null;
  className?: string;
  testId?: string;
}) {
  return (
    <div className={cn('flex flex-col', className)} {...(testId ? { 'data-testid': testId } : {})}>
      {activity}
      {children}
      {errorMessage ? <WorkspaceArtifactErrorMessage message={errorMessage} /> : null}
    </div>
  );
}

export function WorkspaceArtifactErrorMessage({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-3 text-sm text-destructive">
      {message}
    </p>
  );
}

export function WorkspaceArtifactActionLink({
  specificationId,
  to,
  children,
  className,
}: {
  specificationId: string;
  to: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to as '/project/$id/grounding'}
      params={{ id: specificationId }}
      className={cn(
        'inline-flex h-7 items-center rounded-md border border-rule bg-white px-2.5 text-xs-plus font-medium text-ink shadow-[var(--shadow-card-ring)] transition-colors hover:bg-tint',
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function WorkspaceWorkflowCompleteCard({
  specificationId,
  summary,
}: {
  specificationId: string;
  summary: string | null;
}) {
  return (
    <div
      className="flex min-h-[120px] flex-col items-start justify-center gap-3 rounded-xl border border-rule bg-tint px-6 py-5"
      data-testid="workspace-state-card"
    >
      <p className="text-sm font-medium text-ink">The interview workspace is complete</p>
      <p className="text-xs-plus leading-relaxed text-sub">
        {summary ?? 'All phases are closed. Review the export to inspect the current structured spec output.'}
      </p>
      <WorkspaceArtifactActionLink
        specificationId={specificationId}
        to="/project/$id/export"
        className="mt-1"
      >
        Open export preview
      </WorkspaceArtifactActionLink>
    </div>
  );
}
