import { Link } from '@tanstack/react-router';

import { Button } from '@/client/components/ui/button';
import type { ExportLoaderData } from '@/shared/api-types.js';

export function ExportPreviewScreen({ projectId, data }: { projectId: string; data: ExportLoaderData }) {
  const handleDownload = () => {
    if (!data?.ready) return;
    const blob = new Blob([data.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'spec.md';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link
        to="/project/$id"
        params={{ id: projectId }}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to project
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Export Preview</h1>

      {data && !data.ready && (
        <div className="mt-4">
          <p className="text-muted-foreground">
            Export is not available yet. All workflow phases must be closed before exporting.
          </p>
          <Link
            to="/project/$id"
            params={{ id: projectId }}
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
              params={{ id: projectId }}
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
