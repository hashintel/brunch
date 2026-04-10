import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';

export function ExportPreview() {
  const { id } = useParams({ from: '/project/$id/export' });

  const { data, isLoading } = useQuery({
    queryKey: ['export', id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}/export`);
      if (!res.ok) throw new Error('Failed to load export');
      return res.json() as Promise<{ ready: boolean; markdown?: string }>;
    },
  });

  const handleDownload = () => {
    if (!data?.markdown) return;
    const blob = new Blob([data.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spec.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link to="/project/$id" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to project
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Export Preview</h1>

      {isLoading && <p className="mt-4 text-muted-foreground">Loading...</p>}

      {data && !data.ready && (
        <div className="mt-4">
          <p className="text-muted-foreground">
            Export is not available yet. All workflow phases must be closed before exporting.
          </p>
          <Link
            to="/project/$id"
            params={{ id }}
            className="mt-2 inline-block text-sm text-primary hover:underline"
          >
            Return to interview →
          </Link>
        </div>
      )}

      {data?.ready && data.markdown && (
        <div className="mt-4">
          <div className="flex items-center gap-3">
            <Button onClick={handleDownload}>Download .md</Button>
            <Link
              to="/project/$id/knowledge"
              params={{ id }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Review knowledge →
            </Link>
          </div>
          <pre className="mt-4 overflow-auto rounded-md border bg-muted p-4 text-sm whitespace-pre-wrap">
            {data.markdown}
          </pre>
        </div>
      )}
    </div>
  );
}
