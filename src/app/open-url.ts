import { spawn } from 'node:child_process';
import process from 'node:process';

/**
 * Open a URL in the platform browser, best-effort. Both callers (login OAuth,
 * TUI web sidecar) print the URL before calling this, so a missing opener
 * binary (e.g. no xdg-open on minimal Linux) degrades to "open it manually":
 * the error handler swallows the launch failure instead of letting the
 * unhandled 'error' event crash the process.
 */
export function openUrlBestEffort(url: string): void {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  launchDetachedBestEffort(command, args);
}

export function launchDetachedBestEffort(command: string, args: readonly string[]): void {
  const child = spawn(command, [...args], { detached: true, stdio: 'ignore' });
  child.on('error', () => {
    // Best-effort by contract: the caller has already surfaced the URL.
  });
  child.unref();
}
