import { useParams, Link } from '@tanstack/react-router';

export function ExportPreview() {
  const { id } = useParams({ from: '/project/$id/export' });

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link to="/project/$id" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to project
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Export Preview</h1>
      <p className="mt-2 text-muted-foreground">Export coming soon.</p>
    </div>
  );
}
