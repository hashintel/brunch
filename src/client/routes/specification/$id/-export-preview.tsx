import { Link, getRouteApi } from '@tanstack/react-router';
import { ArrowLeftIcon, DownloadIcon } from 'lucide-react';

import { MarkdownRenderer } from '@/client/capabilities/markdown-rendering';
import { Button } from '@/client/components/app-shell.js';
import { ScrollArea } from '@/client/components/ui/scroll-area';

const exportPreviewRouteApi = getRouteApi('/specification/$id/export');

const specificationOutputMarkdownClassName = [
  'text-sm leading-7 text-sub',
  '[&_h1]:mb-6 [&_h1]:text-[1.85rem] [&_h1]:leading-tight [&_h1]:font-semibold [&_h1]:text-ink',
  '[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink',
  '[&_p]:my-3',
  '[&_ul]:my-4 [&_ul]:space-y-2 [&_ul]:pl-5',
  '[&_li]:pl-1',
  '[&_strong]:font-semibold [&_strong]:text-ink',
  '[&_code]:rounded-md [&_code]:bg-tint [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.95em] [&_code]:text-ink',
].join(' ');

export function ExportPreview() {
  const { id: specificationId } = exportPreviewRouteApi.useParams();
  const data = exportPreviewRouteApi.useLoaderData();
  const workspaceLink = data?.ready
    ? {
        to: '/specification/$id/grounding' as const,
        label: 'Back to specification workspace',
      }
    : {
        to: '/specification/$id' as const,
        label: 'Return to specification',
      };

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
        <div className="mx-auto max-w-4xl px-6 py-8 sm:px-10">
          <Link
            to={workspaceLink.to}
            params={{ id: specificationId }}
            className="inline-flex items-center gap-1 text-xs text-hint transition-colors hover:text-ink"
          >
            <ArrowLeftIcon className="size-3" />
            <span>{workspaceLink.label}</span>
          </Link>
          <section className="mt-4 rounded-[24px] border border-rule bg-background px-6 py-6 shadow-[var(--shadow-card)] sm:px-8 sm:py-8">
            <p className="text-xs font-semibold tracking-[0.18em] text-hint uppercase">Output</p>
            <h1 className="text-2xl mt-3 font-semibold tracking-tight text-ink">Specification Output</h1>

            {data && !data.ready ? (
              <div className="mt-4 max-w-2xl rounded-2xl border border-rule bg-tint/70 p-4 sm:p-5">
                <p className="text-sm leading-6 text-sub">
                  This completion view unlocks after Grounding, Elicitation, Requirements, and Acceptance
                  Criteria are all closed.
                </p>
              </div>
            ) : (
              <div className="mt-4 max-w-2xl">
                <p className="text-sm leading-6 text-sub">
                  Review the completed specification here, download the markdown output, or step back into the
                  specification workspace whenever you need the underlying interview context.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button variant="primary" onClick={handleDownload}>
                    <DownloadIcon className="mr-1.5 size-3.5" />
                    Download markdown output
                  </Button>
                </div>
              </div>
            )}
          </section>

          {data?.ready && data.markdown && (
            <section className="mt-6 overflow-hidden rounded-[24px] border border-rule bg-background shadow-[var(--shadow-card)]">
              <div className="border-b border-rule bg-tint/60 px-6 py-5 sm:px-8">
                <h2 className="text-base font-semibold text-ink">Completed specification</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-sub">
                  Accepted Requirements and Acceptance Criteria stay first, with supporting context and
                  closure caveats kept nearby.
                </p>
              </div>
              <article className="px-6 py-6 sm:px-8">
                <MarkdownRenderer className={specificationOutputMarkdownClassName}>
                  {data.markdown}
                </MarkdownRenderer>
              </article>
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
