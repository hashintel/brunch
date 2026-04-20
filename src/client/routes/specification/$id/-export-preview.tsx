import { Link, getRouteApi } from '@tanstack/react-router';
import { ArrowLeftIcon, BookOpenIcon, DownloadIcon } from 'lucide-react';

import { Button } from '@/client/components/app-shell.js';
import { ScrollArea } from '@/client/components/ui/scroll-area';

const exportPreviewRouteApi = getRouteApi('/specification/$id/export');

export function ExportPreview() {
  const { id: specificationId } = exportPreviewRouteApi.useParams();
  const data = exportPreviewRouteApi.useLoaderData();

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
    <div className="flex h-full flex-col overflow-hidden">
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-3xl px-10 py-8">
          <Link
            to="/specification/$id"
            params={{ id: specificationId }}
            className="inline-flex items-center gap-1 text-xs text-hint transition-colors hover:text-ink"
          >
            <ArrowLeftIcon className="size-3" />
            <span>Back to specification</span>
          </Link>
          <h1 className="mt-4 text-sm-plus font-medium text-ink">Export Preview</h1>

          {data && !data.ready && (
            <div className="mt-4">
              <p className="text-sm text-sub">
                Export is not available yet. All workflow phases must be closed before exporting.
              </p>
              <Link
                to="/specification/$id"
                params={{ id: specificationId }}
                className="mt-2 inline-flex items-center gap-1 text-sm text-hint transition-colors hover:text-ink"
              >
                <ArrowLeftIcon className="size-3" />
                <span>Return to specification</span>
              </Link>
            </div>
          )}

          {data?.ready && data.markdown && (
            <div className="mt-4">
              <div className="flex items-center gap-3">
                <Button variant="primary" onClick={handleDownload}>
                  <DownloadIcon className="mr-1.5 size-3.5" />
                  Download .md
                </Button>
                <Link
                  to="/specification/$id/grounding"
                  params={{ id: specificationId }}
                  className="inline-flex items-center gap-1 text-sm text-hint transition-colors hover:text-ink"
                >
                  <BookOpenIcon className="size-3.5" />
                  <span>Review specification knowledge</span>
                </Link>
              </div>
              <pre className="mt-4 overflow-auto rounded-xl border border-rule bg-tint p-4 text-sm whitespace-pre-wrap text-sub shadow-[var(--shadow-card)]">
                {data.markdown}
              </pre>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
