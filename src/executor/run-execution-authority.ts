import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

const executions = new Map<string, Promise<unknown>>();

export async function withRunExecutionAuthority<Result>(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly execute: () => Promise<Result>;
  readonly onContended?: () => Promise<Result> | Result;
}): Promise<Result> {
  const key = JSON.stringify([await canonicalPath(args.cwd), args.runId]);
  const active = executions.get(key);
  if (active) return args.onContended ? args.onContended() : (active as Promise<Result>);

  const owned = Promise.resolve().then(args.execute);
  executions.set(key, owned);
  try {
    return await owned;
  } finally {
    if (executions.get(key) === owned) executions.delete(key);
  }
}

async function canonicalPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return resolve(path);
  }
}
