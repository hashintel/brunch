import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface SeedFixture {
  spec: {
    slug: string;
    name: string;
  };
  nodes: Array<{
    local_id: number;
    plane: string;
    kind: string;
    title: string;
    body?: string | null;
    basis?: string | null;
    source?: string | null;
    detail?: unknown;
  }>;
  edges: Array<{
    category: string;
    source_local_id: number;
    target_local_id: number;
    stance?: string | null;
    basis?: string | null;
    rationale?: string | null;
  }>;
}

const VARIANT_SLUG = 'macro-view-grounded-intent';
const SOURCE_SLUG = 'macro-view';
const GROUNDED_SOURCE = /^(stakeholder|external-observed|technical-observed)\b/;

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const sourcePath = join(here, '..', 'bilal-port', `${SOURCE_SLUG}.json`);
  const source = JSON.parse(await readFile(sourcePath, 'utf8')) as SeedFixture;
  const kept = source.nodes.filter(
    (node) =>
      node.plane === 'intent' &&
      (node.basis ?? 'explicit') === 'explicit' &&
      node.source !== null &&
      node.source !== undefined &&
      GROUNDED_SOURCE.test(node.source),
  );
  const localId = new Map<number, number>();
  const nodes = kept.map((node, index) => {
    const nextId = index + 1;
    localId.set(node.local_id, nextId);
    return { ...node, local_id: nextId, basis: 'explicit' as const };
  });
  const edges = source.edges.flatMap((edge) => {
    const sourceId = localId.get(edge.source_local_id);
    const targetId = localId.get(edge.target_local_id);
    if (sourceId === undefined || targetId === undefined) return [];
    return [
      {
        ...edge,
        source_local_id: sourceId,
        target_local_id: targetId,
        basis: 'explicit' as const,
      },
    ];
  });
  const variant = {
    spec: {
      slug: VARIANT_SLUG,
      name: 'Macro View — grounded intent base',
    },
    nodes,
    edges,
  } satisfies SeedFixture;

  await mkdir(here, { recursive: true });
  await writeFile(join(here, `${VARIANT_SLUG}.json`), `${JSON.stringify(variant, null, 2)}\n`, 'utf8');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
