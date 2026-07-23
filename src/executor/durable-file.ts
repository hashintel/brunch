import { mkdir, open, rename, rm } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export type DurableFileContents = string | Uint8Array;

export interface DurableDirectoryOperations {
  readonly mkdir: (path: string) => Promise<void>;
  readonly syncDirectory: (path: string) => Promise<void>;
}

const defaultDirectoryOperations: DurableDirectoryOperations = {
  mkdir: async (path) => {
    try {
      await mkdir(path);
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
    }
  },
  syncDirectory: fsyncDirectory,
};

/**
 * Creates a descendant chain one entry at a time and fsyncs every parent
 * after its child entry exists. Resolution means a crash cannot lose a newly
 * created directory entry while later authority has already advanced.
 */
export async function durableEnsureDirectory(
  directory: string,
  durableRoot: string,
  operations: DurableDirectoryOperations = defaultDirectoryOperations,
): Promise<void> {
  const root = resolve(durableRoot);
  const target = resolve(directory);
  const pathFromRoot = relative(root, target);
  if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
    throw new Error('durable directory must descend from trusted root');
  }
  let parent = root;
  await operations.syncDirectory(parent);
  for (const segment of pathFromRoot.split(sep).filter(Boolean)) {
    const child = resolve(parent, segment);
    await operations.mkdir(child);
    await operations.syncDirectory(parent);
    await operations.syncDirectory(child);
    parent = child;
  }
}

/**
 * Replaces one file with complete bytes and does not resolve until both the
 * renamed file and its directory entry are crash-durable.
 */
export async function durableAtomicReplace(path: string, contents: DurableFileContents): Promise<void> {
  const directory = dirname(path);
  const tempPath = `${path}.tmp`;
  await mkdir(directory, { recursive: true });
  const handle = await open(tempPath, 'w', 0o600);
  try {
    await handle.writeFile(contents);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(tempPath, path);
    await fsyncDirectory(directory);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

/**
 * Appends authority bytes and fsyncs both the file and containing directory.
 * Callers still own serialization of concurrent appends.
 */
export async function durableAppend(path: string, contents: DurableFileContents): Promise<void> {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const handle = await open(path, 'a', 0o600);
  try {
    await handle.writeFile(contents);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fsyncDirectory(directory);
}

export async function fsyncDirectory(path: string): Promise<void> {
  const directory = await open(path, 'r');
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST';
}
