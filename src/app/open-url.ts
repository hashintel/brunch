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
  const { command, args } = openCommandFor(process.platform, url);
  launchDetachedBestEffort(command, args);
}

export function openCommandFor(
  platform: NodeJS.Platform,
  url: string,
): { command: string; args: readonly string[] } {
  if (platform === 'darwin') return { command: 'open', args: [url] };
  if (platform === 'win32') {
    // rundll32 receives the URL as plain argv — no cmd.exe command-line
    // parsing, so `&` in OAuth query strings neither splits the command nor
    // opens an injection seam (PR-299 review finding: unquoted
    // `cmd /c start <url>` breaks at the first `&`).
    return { command: 'rundll32', args: ['url.dll,FileProtocolHandler', url] };
  }
  return { command: 'xdg-open', args: [url] };
}

export function launchDetachedBestEffort(command: string, args: readonly string[]): void {
  const child = spawn(command, [...args], { detached: true, stdio: 'ignore' });
  child.on('error', () => {
    // Best-effort by contract: the caller has already surfaced the URL.
  });
  child.unref();
}
