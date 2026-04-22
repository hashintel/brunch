// @vitest-environment node

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('file-route phase route ownership', () => {
  it('specification workspace route defines the specification-state loader inline and renders the sidebar', () => {
    const specificationLayoutSource = readRepoFile('src/client/routes/specification/$id/route.tsx');
    const generatedRouteTreeSource = readRepoFile('src/client/routeTree.gen.ts');

    expect(specificationLayoutSource).toContain("createFileRoute('/specification/$id')");
    expect(specificationLayoutSource).toContain('primeSpecificationBundle');
    expect(specificationLayoutSource).toContain('PhaseNavigationSidebar');
    expect(specificationLayoutSource).toContain('Outlet');

    expect(generatedRouteTreeSource).toContain("'/specification/$id'");
    expect(generatedRouteTreeSource).toContain("from './routes/specification/$id/route'");
  });

  it('ViewLayout route defines the entity-data loader inline and branches on view search param', () => {
    const viewLayoutSource = readRepoFile('src/client/routes/specification/$id/_view/route.tsx');

    expect(viewLayoutSource).toContain("createFileRoute('/specification/$id/_view')");
    expect(viewLayoutSource).toContain('primeSpecificationEntities');
    expect(viewLayoutSource).toContain('Outlet');

    // ViewLayout must conditionally render based on the ?view search param
    expect(viewLayoutSource).toContain("view: z.enum(['chat', 'graph'])");
    // Graph view must be lazily loaded for code splitting
    expect(viewLayoutSource).toMatch(/import\(.+graph-view/);
  });

  it('keeps phase routes thin — canonical phase screens render InterviewView via colocated support files', () => {
    const phaseRoutes = ['grounding', 'elicitation', 'requirements-review', 'acceptance-review'];

    for (const phase of phaseRoutes) {
      const source = readRepoFile(`src/client/routes/specification/$id/_view/${phase}.tsx`);
      expect(source, `${phase} route should use createFileRoute`).toContain('createFileRoute');
      expect(source, `${phase} route should render InterviewView`).toContain('InterviewView');
    }
  });

  it('retires the legacy framing route file', () => {
    expect(existsSync(join(process.cwd(), 'src/client/routes/specification/$id/_view/framing.tsx'))).toBe(
      false,
    );
  });

  it('keeps the routed interview surface wired through ChatScroll', () => {
    const interviewViewSource = readRepoFile('src/client/routes/specification/$id/_view/-interview-view.tsx');

    expect(interviewViewSource).toContain('import { ChatScroll }');
    expect(interviewViewSource).toContain('<ChatScroll');
  });
});
