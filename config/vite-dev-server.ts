import { resolve } from 'node:path';

export const defaultDevServerPort = 5173;
export const serverRuntimeBuildMode = 'server-runtime';

export const resolveDevServerPort = (argv: string[]) => {
  const inlinePortFlag = argv.find((arg) => arg.startsWith('--port='));

  if (inlinePortFlag) {
    const port = Number.parseInt(inlinePortFlag.slice('--port='.length), 10);

    if (Number.isInteger(port) && port > 0) {
      return port;
    }
  }

  const portFlagIndex = argv.findIndex((arg) => arg === '--port');

  if (portFlagIndex !== -1) {
    const port = Number.parseInt(argv[portFlagIndex + 1] ?? '', 10);

    if (Number.isInteger(port) && port > 0) {
      return port;
    }
  }

  return defaultDevServerPort;
};

export const getViteCacheDir = (rootDir: string, command: 'build' | 'serve', argv: string[], mode?: string) =>
  resolve(
    rootDir,
    command === 'serve'
      ? `node_modules/.vite-${resolveDevServerPort(argv)}`
      : mode === serverRuntimeBuildMode
        ? 'node_modules/.vite-build-server'
        : 'node_modules/.vite-build',
  );
