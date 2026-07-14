/**
 * tui-driver — agent-drivable PTY harness for manual TUI walkthroughs.
 *
 * The sandboxed-agent fallback named in `docs/praxis/manual-testing.md`:
 * cmux/agent-tui/shellwright all need a daemon socket that agent sandboxes
 * deny, while `expect` only needs a PTY. The expect pump (`tui-driver/
 * driver.exp`) stays dumb (PTY→log, fifo→keys, heartbeat); this side owns
 * named sessions, guarded control writes, true screen rendering through a
 * headless xterm, and wait-for-text.
 *
 * CLI (dev-only, runs from source): `npm run tui-driver -- <subcommand>`
 *
 *   start  --name <n> [--cols 120] [--rows 40] -- <command...>
 *   send   --name <n> [--key Enter]... [--type "text"]...
 *   wait   --name <n> --text <substring> [--timeout-ms 30000]
 *   screen --name <n>
 *   log    --name <n> [--bytes 4000]     raw tail for debugging the pump itself
 *   list
 *   stop   --name <n>
 *   rm     --name <n> [--force]
 *
 * Sessions live under `.fixtures/scratch/tui-driver/<name>/` (gitignored
 * dev-loop scratch; never durable evidence).
 */

import { readFileSync, statSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { renderScreenFromLog, waitForScreenText } from './tui-driver/screen.js';
import {
  listSessions,
  removeSession,
  sendKeys,
  sendText,
  sessionStatus,
  startSession,
  stopSession,
} from './tui-driver/session.js';

export { TUI_DRIVER_KEYS, isTuiDriverKey, type TuiDriverKey } from './tui-driver/keys.js';
export {
  TuiScreen,
  renderScreenFromLog,
  waitForScreenText,
  type WaitForScreenTextResult,
} from './tui-driver/screen.js';
export {
  isSessionAlive,
  listSessions,
  removeSession,
  sendKeys,
  sendText,
  sessionStatus,
  startSession,
  stopSession,
  tuiDriverRoot,
  type TuiDriverSessionMeta,
  type TuiDriverSessionStatus,
} from './tui-driver/session.js';

const USAGE = `tui-driver — agent-drivable PTY harness for manual TUI walkthroughs

usage: npm run tui-driver -- <subcommand>

  start  --name <n> [--cols 120] [--rows 40] -- <command...>
  send   --name <n> [--key Enter]... [--type "text"]...
  wait   --name <n> --text <substring> [--timeout-ms 30000]
  screen --name <n>
  log    --name <n> [--bytes 4000]
  list
  stop   --name <n>
  rm     --name <n> [--force]

keys: Enter Esc Up Down Right Left Tab Space Backspace C-c C-d
sessions: .fixtures/scratch/tui-driver/<name>/`;

function requireSession(name: string) {
  const status = sessionStatus(name);
  if (!status) throw new Error(`No session named "${name}" (see: npm run tui-driver -- list)`);
  return status;
}

function printScreen(lines: string[]): void {
  console.log(lines.map((line) => `│${line}`).join('\n'));
}

export async function runTuiDriverCli(argv: readonly string[]): Promise<number> {
  const [subcommand, ...rest] = argv;
  switch (subcommand) {
    case 'start': {
      const separator = rest.indexOf('--');
      if (separator < 0) throw new Error('start requires the command after `--`');
      const { values } = parseArgs({
        args: rest.slice(0, separator),
        options: {
          name: { type: 'string' },
          cols: { type: 'string' },
          rows: { type: 'string' },
        },
      });
      if (!values.name) throw new Error('start requires --name');
      const status = await startSession({
        name: values.name,
        command: rest.slice(separator + 1),
        ...(values.cols ? { cols: Number(values.cols) } : {}),
        ...(values.rows ? { rows: Number(values.rows) } : {}),
      });
      console.log(`started "${status.name}" (${status.cols}x${status.rows}) pid=${status.driverPid}`);
      console.log(`dir: ${status.dir}`);
      return 0;
    }
    case 'send': {
      const { values } = parseArgs({
        args: rest,
        options: {
          name: { type: 'string' },
          key: { type: 'string', multiple: true },
          type: { type: 'string', multiple: true },
        },
      });
      if (!values.name) throw new Error('send requires --name');
      const texts = values.type ?? [];
      const keys = values.key ?? [];
      if (texts.length === 0 && keys.length === 0) throw new Error('send requires --key and/or --type');
      // Text first, then keys — the common gesture is "type the value, press Enter".
      for (const text of texts) sendText(values.name, text);
      if (keys.length > 0) sendKeys(values.name, keys);
      console.log(`sent ${texts.length} text(s), ${keys.length} key(s) to "${values.name}"`);
      return 0;
    }
    case 'wait': {
      const { values } = parseArgs({
        args: rest,
        options: {
          name: { type: 'string' },
          text: { type: 'string' },
          'timeout-ms': { type: 'string' },
        },
      });
      if (!values.name || !values.text) throw new Error('wait requires --name and --text');
      const status = requireSession(values.name);
      const result = await waitForScreenText(
        status.logPath,
        status.cols,
        status.rows,
        values.text,
        values['timeout-ms'] ? { timeoutMs: Number(values['timeout-ms']) } : {},
      );
      printScreen(result.screen);
      if (!result.matched) {
        console.error(`\nwait: "${values.text}" did not appear (screen above is the last render)`);
        return 1;
      }
      return 0;
    }
    case 'screen': {
      const { values } = parseArgs({ args: rest, options: { name: { type: 'string' } } });
      if (!values.name) throw new Error('screen requires --name');
      const status = requireSession(values.name);
      printScreen(await renderScreenFromLog(status.logPath, status.cols, status.rows));
      return 0;
    }
    case 'log': {
      const { values } = parseArgs({
        args: rest,
        options: { name: { type: 'string' }, bytes: { type: 'string' } },
      });
      if (!values.name) throw new Error('log requires --name');
      const status = requireSession(values.name);
      const bytes = Number(values.bytes ?? 4000);
      const size = statSync(status.logPath).size;
      const raw = readFileSync(status.logPath);
      console.log(raw.subarray(Math.max(0, size - bytes)).toString('utf8'));
      return 0;
    }
    case 'list': {
      const sessions = listSessions();
      if (sessions.length === 0) {
        console.log('no sessions');
        return 0;
      }
      for (const session of sessions) {
        console.log(
          `${session.alive ? 'RUNNING' : 'stopped'}  ${session.name}  ${session.cols}x${session.rows}  ${session.command.join(' ')}`,
        );
      }
      return 0;
    }
    case 'stop': {
      const { values } = parseArgs({ args: rest, options: { name: { type: 'string' } } });
      if (!values.name) throw new Error('stop requires --name');
      const stopped = await stopSession(values.name);
      console.log(
        stopped ? `stopped "${values.name}"` : `stop requested; "${values.name}" did not confirm exit`,
      );
      return stopped ? 0 : 1;
    }
    case 'rm': {
      const { values } = parseArgs({
        args: rest,
        options: { name: { type: 'string' }, force: { type: 'boolean' } },
      });
      if (!values.name) throw new Error('rm requires --name');
      removeSession(values.name, { force: values.force ?? false });
      console.log(`removed "${values.name}"`);
      return 0;
    }
    case 'help':
    case undefined: {
      console.log(USAGE);
      return subcommand === 'help' ? 0 : 1;
    }
    default:
      throw new Error(`Unknown subcommand "${subcommand}" (try: npm run tui-driver -- help)`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTuiDriverCli(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
