import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface PublicPacketReference {
  readonly path: '.brunch/execution-comparison/public';
  readonly packetSha256: string;
  readonly files: readonly { readonly path: 'public-contract.json' | 'spec.md'; readonly sha256: string }[];
}

export interface PublicPacketMaterialization {
  readonly reference: PublicPacketReference;
  readonly contents: readonly {
    readonly path: 'packet-manifest.json' | 'public-contract.json' | 'spec.md';
    readonly value: string;
  }[];
}

export type PublicPacketReadResult =
  | { readonly status: 'absent' }
  | { readonly status: 'present'; readonly packet: PublicPacketMaterialization }
  | { readonly status: 'invalid'; readonly message: string };

export async function readPublicPacket(cwd: string): Promise<PublicPacketReadResult> {
  const sourceResult = await resolvePacketSource(cwd);
  if (sourceResult.status !== 'present') return sourceResult;
  const sourceDir = sourceResult.sourceDir;
  let rawManifest: string;
  try {
    const manifestPath = join(sourceDir, 'packet-manifest.json');
    const manifest = await lstat(manifestPath);
    if (!manifest.isFile() || manifest.isSymbolicLink()) {
      return { status: 'invalid', message: 'Target-visible public packet manifest is invalid.' };
    }
    rawManifest = await readFile(manifestPath, 'utf8');
  } catch {
    return { status: 'invalid', message: 'Target-visible public packet manifest is unreadable.' };
  }

  let value: unknown;
  try {
    value = JSON.parse(rawManifest);
  } catch {
    return { status: 'invalid', message: 'Target-visible public packet manifest is malformed.' };
  }
  if (!isRecord(value) || value['schemaVersion'] !== 1 || !isSha256(value['packetSha256'])) {
    return { status: 'invalid', message: 'Target-visible public packet manifest is malformed.' };
  }
  const manifestFiles = value['files'];
  if (!Array.isArray(manifestFiles) || manifestFiles.length !== 2) {
    return { status: 'invalid', message: 'Target-visible public packet file inventory is invalid.' };
  }
  const files: PublicPacketReference['files'] = manifestFiles.flatMap((file) => {
    if (
      !isRecord(file) ||
      (file['path'] !== 'public-contract.json' && file['path'] !== 'spec.md') ||
      !isSha256(file['sha256'])
    ) {
      return [];
    }
    return [{ path: file['path'], sha256: file['sha256'] }];
  });
  if (
    files.length !== 2 ||
    new Set(files.map((file) => file.path)).size !== 2 ||
    !files.some((file) => file.path === 'public-contract.json') ||
    !files.some((file) => file.path === 'spec.md')
  ) {
    return { status: 'invalid', message: 'Target-visible public packet file inventory is invalid.' };
  }

  const contents: { readonly path: 'public-contract.json' | 'spec.md'; readonly value: string }[] = [];
  for (const file of files) {
    let fileContents: string;
    try {
      const filePath = join(sourceDir, file.path);
      const source = await lstat(filePath);
      if (!source.isFile() || source.isSymbolicLink()) {
        return { status: 'invalid', message: `Target-visible public packet file ${file.path} is invalid.` };
      }
      fileContents = await readFile(filePath, 'utf8');
    } catch {
      return { status: 'invalid', message: `Target-visible public packet file ${file.path} is unreadable.` };
    }
    if (sha256(fileContents) !== file.sha256) {
      return { status: 'invalid', message: `Target-visible public packet file ${file.path} failed hashing.` };
    }
    contents.push({ path: file.path, value: fileContents });
  }
  const packetSha256 = sha256(files.map((file) => `${file.path}:${file.sha256}\n`).join(''));
  if (packetSha256 !== value['packetSha256']) {
    return { status: 'invalid', message: 'Target-visible public packet identity failed hashing.' };
  }
  return {
    status: 'present',
    packet: {
      reference: {
        path: '.brunch/execution-comparison/public',
        packetSha256,
        files,
      },
      contents: [
        {
          path: 'packet-manifest.json',
          value: `${JSON.stringify({ schemaVersion: 1, packetSha256, files }, null, 2)}\n`,
        },
        ...contents,
      ],
    },
  };
}

export async function materializePublicPacket(args: {
  readonly packet: PublicPacketMaterialization;
  readonly sliceWorktreeDir: string;
}): Promise<
  readonly (
    | { readonly kind: 'mkdir'; readonly path: string }
    | { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' }
  )[]
> {
  const packet = validatePublicPacketMaterialization(args.packet);
  if (!packet) throw new Error('pinned public packet metadata is invalid');
  const destination = await ensurePacketDirectory(args.sliceWorktreeDir);
  const allowedFiles = new Set(packet.contents.map((file) => file.path));
  const unexpected = (await readdir(destination)).find(
    (file) => !allowedFiles.has(file as PublicPacketMaterialization['contents'][number]['path']),
  );
  if (unexpected) throw new Error(`public packet destination contains unexpected file ${unexpected}`);
  const effects: (
    | { readonly kind: 'mkdir'; readonly path: string }
    | { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' }
  )[] = [{ kind: 'mkdir', path: destination }];
  for (const file of packet.contents) {
    const destinationFile = join(destination, file.path);
    try {
      const existing = await lstat(destinationFile);
      if (!existing.isFile() || existing.isSymbolicLink()) {
        throw new Error(`public packet destination ${file.path} is not a regular file`);
      }
      if ((await readFile(destinationFile, 'utf8')) !== file.value) {
        throw new Error(`public packet destination ${file.path} differs from the pinned run packet`);
      }
      continue;
    } catch (error) {
      if ((error as { readonly code?: unknown }).code !== 'ENOENT') throw error;
    }
    await writeFile(destinationFile, file.value, { encoding: 'utf8', flag: 'wx' });
    effects.push({ kind: 'write_file', path: destinationFile, ifExists: 'overwrite' });
  }
  return effects;
}

export function validatePublicPacketMaterialization(value: unknown): PublicPacketMaterialization | undefined {
  if (!isRecord(value) || !Array.isArray(value['contents'])) return undefined;
  const reference = validatePublicPacketReference(value['reference']);
  if (!reference) return undefined;
  const files = reference.files;
  const contents = value['contents'];
  if (
    contents.length !== 3 ||
    !contents.every(
      (file) =>
        isRecord(file) &&
        (file['path'] === 'packet-manifest.json' ||
          file['path'] === 'public-contract.json' ||
          file['path'] === 'spec.md') &&
        typeof file['value'] === 'string',
    ) ||
    new Set(contents.map((file) => (file as { path: string }).path)).size !== 3
  ) {
    return undefined;
  }
  const contentByPath = new Map(
    contents.map((file) => [(file as { path: string }).path, (file as { value: string }).value]),
  );
  for (const file of files as { path: 'public-contract.json' | 'spec.md'; sha256: string }[]) {
    const contentsForFile = contentByPath.get(file.path);
    if (contentsForFile === undefined || sha256(contentsForFile) !== file.sha256) return undefined;
  }
  const packetSha256 = sha256(
    (files as { path: string; sha256: string }[]).map((file) => `${file.path}:${file.sha256}\n`).join(''),
  );
  if (packetSha256 !== reference.packetSha256) return undefined;
  let manifest: unknown;
  try {
    manifest = JSON.parse(contentByPath.get('packet-manifest.json') ?? '');
  } catch {
    return undefined;
  }
  if (
    !isRecord(manifest) ||
    new Set(Object.keys(manifest)).size !== 3 ||
    !['files', 'packetSha256', 'schemaVersion'].every((key) => Object.hasOwn(manifest, key)) ||
    manifest['schemaVersion'] !== 1 ||
    manifest['packetSha256'] !== packetSha256 ||
    !Array.isArray(manifest['files']) ||
    manifest['files'].length !== files.length ||
    !manifest['files'].every(
      (file, index) =>
        isRecord(file) && file['path'] === files[index]!.path && file['sha256'] === files[index]!.sha256,
    )
  ) {
    return undefined;
  }
  return value as unknown as PublicPacketMaterialization;
}

export function validatePublicPacketReference(value: unknown): PublicPacketReference | undefined {
  if (
    !isRecord(value) ||
    value['path'] !== '.brunch/execution-comparison/public' ||
    !isSha256(value['packetSha256']) ||
    !Array.isArray(value['files']) ||
    value['files'].length !== 2
  ) {
    return undefined;
  }
  const files = value['files'];
  if (
    !files.every(
      (file) =>
        isRecord(file) &&
        (file['path'] === 'public-contract.json' || file['path'] === 'spec.md') &&
        isSha256(file['sha256']),
    ) ||
    new Set(files.map((file) => (file as { path: string }).path)).size !== 2
  ) {
    return undefined;
  }
  const packetSha256 = sha256(
    (files as { path: string; sha256: string }[]).map((file) => `${file.path}:${file.sha256}\n`).join(''),
  );
  return packetSha256 === value['packetSha256'] ? (value as unknown as PublicPacketReference) : undefined;
}

async function resolvePacketSource(
  cwd: string,
): Promise<
  | { readonly status: 'absent' }
  | { readonly status: 'present'; readonly sourceDir: string }
  | { readonly status: 'invalid'; readonly message: string }
> {
  let current = cwd;
  for (const segment of ['.brunch', 'execution-comparison', 'public']) {
    current = join(current, segment);
    try {
      const source = await lstat(current);
      if (!source.isDirectory() || source.isSymbolicLink()) {
        return { status: 'invalid', message: 'Target-visible public packet directory is invalid.' };
      }
    } catch (error) {
      return (error as { readonly code?: unknown }).code === 'ENOENT'
        ? { status: 'absent' }
        : { status: 'invalid', message: 'Target-visible public packet directory is unreadable.' };
    }
  }
  return { status: 'present', sourceDir: current };
}

async function ensurePacketDirectory(sliceWorktreeDir: string): Promise<string> {
  const root = await lstat(sliceWorktreeDir);
  if (!root.isDirectory() || root.isSymbolicLink()) {
    throw new Error('slice worktree root is not a regular directory');
  }
  let current = sliceWorktreeDir;
  for (const segment of ['.brunch', 'execution-comparison', 'public']) {
    current = join(current, segment);
    try {
      const existing = await lstat(current);
      if (!existing.isDirectory() || existing.isSymbolicLink()) {
        throw new Error(`public packet destination ${segment} is not a regular directory`);
      }
    } catch (error) {
      if ((error as { readonly code?: unknown }).code !== 'ENOENT') throw error;
      await mkdir(current);
    }
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/u.test(value);
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
