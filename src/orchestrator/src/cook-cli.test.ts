import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createPetrinautStreamSetup,
  parseCookArgs,
  recordCookExitStatus,
  resolveCookMode,
  resolvePetrinautStreamPort,
} from './cook-cli.js';
import type { PetrinautEvent } from './petrinaut-events.js';
import type { SdcpnFile } from './petrinaut-sdcpn.js';
import type { PetrinautStreamBus } from './petrinaut-stream-bus.js';
import type { PetrinautStreamServer } from './petrinaut-stream-server.js';

describe('parseCookArgs', () => {
  it('parses dir only', () => {
    const opts = parseCookArgs(['./fixtures/txt']);
    expect(opts.dir).toContain('fixtures/txt');
    expect(opts.policy).toBe('serial');
    expect(opts.maxRetries).toBe(3);
    expect(opts.verbose).toBe(false);
  });

  it('parses --policy=parallel', () => {
    const opts = parseCookArgs(['./f', '--policy=parallel']);
    expect(opts.policy).toBe('parallel');
  });

  it('parses --policy=serial', () => {
    const opts = parseCookArgs(['./f', '--policy=serial']);
    expect(opts.policy).toBe('serial');
  });

  it('parses --max-retries=5', () => {
    const opts = parseCookArgs(['./f', '--max-retries=5']);
    expect(opts.maxRetries).toBe(5);
  });

  it('throws on missing dir', () => {
    expect(() => parseCookArgs(['--policy=serial'])).toThrow('Usage');
  });

  it('throws on unknown policy', () => {
    expect(() => parseCookArgs(['./f', '--policy=unknown'])).toThrow('Unknown policy');
  });

  it('parses --verbose', () => {
    expect(parseCookArgs(['./f', '--verbose']).verbose).toBe(true);
    expect(parseCookArgs(['./f', '-v']).verbose).toBe(true);
  });

  it("defaults --petrinaut-fold to 'identity'", () => {
    expect(parseCookArgs(['./f']).petrinautFold).toBe('identity');
  });

  it('parses --petrinaut-fold=color', () => {
    expect(parseCookArgs(['./f', '--petrinaut-fold=color']).petrinautFold).toBe('color');
  });

  it('parses --petrinaut-fold=identity', () => {
    expect(parseCookArgs(['./f', '--petrinaut-fold=identity']).petrinautFold).toBe('identity');
  });

  it('throws on unknown --petrinaut-fold value', () => {
    expect(() => parseCookArgs(['./f', '--petrinaut-fold=banana'])).toThrow(/petrinaut-fold/i);
  });

  it('defaults --petrinaut-stream to false and petrinautOpen to true', () => {
    const opts = parseCookArgs(['./f']);
    expect(opts.petrinautStream).toBe(false);
    expect(opts.petrinautBaseUrl).toBeUndefined();
    expect(opts.petrinautOpen).toBe(true);
  });

  it('parses --petrinaut-stream and --petrinaut-base-url=<url>', () => {
    const opts = parseCookArgs([
      './f',
      '--petrinaut-stream',
      '--petrinaut-base-url=https://petrinaut.example/import',
    ]);
    expect(opts.petrinautStream).toBe(true);
    expect(opts.petrinautBaseUrl).toBe('https://petrinaut.example/import');
  });

  it('parses --no-petrinaut-open under --petrinaut-stream', () => {
    const opts = parseCookArgs([
      './f',
      '--petrinaut-stream',
      '--petrinaut-base-url=https://x/',
      '--no-petrinaut-open',
    ]);
    expect(opts.petrinautStream).toBe(true);
    expect(opts.petrinautOpen).toBe(false);
  });

  it('rejects --petrinaut-base-url without --petrinaut-stream', () => {
    expect(() => parseCookArgs(['./f', '--petrinaut-base-url=https://x/'])).toThrow(
      /--petrinaut-base-url requires --petrinaut-stream/i,
    );
  });

  it('rejects --no-petrinaut-open without --petrinaut-stream', () => {
    expect(() => parseCookArgs(['./f', '--no-petrinaut-open'])).toThrow(
      /--no-petrinaut-open requires --petrinaut-stream/i,
    );
  });

  it('parses --spec=<id> and exposes it on opts', () => {
    expect(parseCookArgs(['./f', '--spec=42']).specId).toBe(42);
  });

  it('omits specId when --spec is not passed', () => {
    expect(parseCookArgs(['./f']).specId).toBeUndefined();
  });

  it('rejects non-integer, zero, and negative --spec values', () => {
    expect(() => parseCookArgs(['./f', '--spec=abc'])).toThrow(/--spec/i);
    expect(() => parseCookArgs(['./f', '--spec=0'])).toThrow(/--spec/i);
    expect(() => parseCookArgs(['./f', '--spec=-3'])).toThrow(/--spec/i);
    expect(() => parseCookArgs(['./f', '--spec=1.5'])).toThrow(/--spec/i);
  });

  it('allows --petrinaut-stream + --petrinaut-fold=color together', () => {
    const opts = parseCookArgs([
      './f',
      '--petrinaut-stream',
      '--petrinaut-base-url=https://x/',
      '--petrinaut-fold=color',
    ]);
    expect(opts.petrinautStream).toBe(true);
    expect(opts.petrinautFold).toBe('color');
  });
});

describe('resolvePetrinautStreamPort', () => {
  it('returns undefined (dynamic) when PORT is unset or blank', () => {
    expect(resolvePetrinautStreamPort({})).toBeUndefined();
    expect(resolvePetrinautStreamPort({ PORT: '' })).toBeUndefined();
    expect(resolvePetrinautStreamPort({ PORT: '   ' })).toBeUndefined();
  });

  it('returns the parsed port when PORT is a valid integer', () => {
    expect(resolvePetrinautStreamPort({ PORT: '56493' })).toBe(56493);
    expect(resolvePetrinautStreamPort({ PORT: ' 8080 ' })).toBe(8080);
  });

  it('throws on a non-integer or out-of-range PORT', () => {
    expect(() => resolvePetrinautStreamPort({ PORT: 'abc' })).toThrow('Invalid PORT value: abc');
    expect(() => resolvePetrinautStreamPort({ PORT: '70000' })).toThrow('Invalid PORT value: 70000');
    expect(() => resolvePetrinautStreamPort({ PORT: '3.5' })).toThrow('Invalid PORT value: 3.5');
  });
});

describe('recordCookExitStatus', () => {
  const originalExitCode = process.exitCode;

  afterEach(() => {
    process.exitCode = originalExitCode;
  });

  it('records the intended process status without exiting synchronously', () => {
    recordCookExitStatus(true);
    expect(process.exitCode).toBe(0);

    recordCookExitStatus(false);
    expect(process.exitCode).toBe(1);
  });
});

describe('createPetrinautStreamSetup', () => {
  // Minimal SdcpnFile fixture — the setup hook treats it opaquely (passes
  // through to createPetrinautStreamBus), so an empty net is enough to
  // exercise the open / no-open / CI / failure paths.
  const sdcpnFile: SdcpnFile = {
    version: 1,
    meta: { generator: 'test' },
    title: 'test net',
    places: [],
    transitions: [],
    types: [],
    differentialEquations: [],
    parameters: [],
    scenarios: [],
    metrics: [],
  };

  type FakeServer = PetrinautStreamServer & {
    started: boolean;
    stopped: boolean;
    startCalls: number;
    stopCalls: number;
  };

  function makeFakeServer(streamUrl = 'http://127.0.0.1:9999/stream'): FakeServer {
    const srv = {
      started: false,
      stopped: false,
      startCalls: 0,
      stopCalls: 0,
      async start() {
        this.startCalls++;
        this.started = true;
        return { host: '127.0.0.1', port: 9999, streamUrl };
      },
      async stop() {
        this.stopCalls++;
        this.stopped = true;
      },
      connectionCount: () => 0,
    } as FakeServer;
    return srv;
  }

  it('composes the launcher URL and opens it when shouldOpen=true', async () => {
    const fakeServer = makeFakeServer();
    const openedUrls: string[] = [];
    const logged: string[] = [];

    const setup = createPetrinautStreamSetup({
      baseUrl: 'https://petrinaut.example/import',
      shouldOpen: true,
      openUrl: (url) => {
        openedUrls.push(url);
      },
      log: (line) => logged.push(line),
      createServer: () => fakeServer,
    });

    const onEvent = await setup.setupHook({ runId: 'run-test', sdcpnFile });
    expect(fakeServer.startCalls).toBe(1);
    expect(openedUrls).toHaveLength(1);
    const launcherUrl = new URL(openedUrls[0]!);
    expect(launcherUrl.origin).toBe('https://petrinaut.example');
    expect(launcherUrl.searchParams.get('runId')).toBe('run-test');
    expect(launcherUrl.searchParams.get('mode')).toBe('actual');
    expect(launcherUrl.searchParams.get('sse')).toBe('http://127.0.0.1:9999/stream');
    // Launcher URL is also printed.
    expect(logged.some((l) => l.includes(openedUrls[0]!))).toBe(true);
    // The returned callback is the bus publish.
    expect(typeof onEvent).toBe('function');

    await setup.stop();
    expect(fakeServer.stopCalls).toBe(1);
  });

  it('prints the URL but does NOT open when shouldOpen=false', async () => {
    const fakeServer = makeFakeServer();
    const openedUrls: string[] = [];
    const logged: string[] = [];

    const setup = createPetrinautStreamSetup({
      baseUrl: 'https://petrinaut.example/import',
      shouldOpen: false,
      openUrl: (url) => {
        openedUrls.push(url);
      },
      log: (line) => logged.push(line),
      createServer: () => fakeServer,
    });

    await setup.setupHook({ runId: 'run-test', sdcpnFile });
    expect(openedUrls).toHaveLength(0);
    // URL still printed in some log line.
    expect(logged.some((l) => l.includes('launcher'))).toBe(true);
    await setup.stop();
  });

  it('continues without failing when openUrl throws (warns and proceeds)', async () => {
    const fakeServer = makeFakeServer();
    const logged: string[] = [];

    const setup = createPetrinautStreamSetup({
      baseUrl: 'https://petrinaut.example/import',
      shouldOpen: true,
      openUrl: () => {
        throw new Error('xdg-open not found');
      },
      log: (line) => logged.push(line),
      createServer: () => fakeServer,
    });

    const onEvent = await setup.setupHook({ runId: 'run-test', sdcpnFile });
    expect(typeof onEvent).toBe('function');
    expect(logged.some((l) => l.includes("Couldn't auto-open"))).toBe(true);
    await setup.stop();
  });

  it('rejects setup when server.start() rejects (so engine.run never emits)', async () => {
    const failing: FakeServer = {
      ...makeFakeServer(),
      startCalls: 0,
      async start(): Promise<never> {
        this.startCalls++;
        throw new Error('EADDRINUSE');
      },
    };

    const setup = createPetrinautStreamSetup({
      baseUrl: 'https://petrinaut.example/import',
      shouldOpen: false,
      openUrl: () => {
        throw new Error('should not be called');
      },
      createServer: () => failing,
    });

    await expect(setup.setupHook({ runId: 'run-test', sdcpnFile })).rejects.toThrow('EADDRINUSE');
    expect(failing.startCalls).toBe(1);
    // stop() is still safe to call on a never-started server.
    await setup.stop();
  });

  it('hook returns a callback that publishes through the bus (subscribers see frames)', async () => {
    const fakeServer = makeFakeServer();
    const capturedBus: PetrinautStreamBus[] = [];

    const setup = createPetrinautStreamSetup({
      baseUrl: 'https://x/',
      shouldOpen: false,
      openUrl: () => {},
      log: () => {},
      createServer: (bus) => {
        capturedBus.push(bus);
        return fakeServer;
      },
    });

    const onEvent = await setup.setupHook({ runId: 'r', sdcpnFile });
    expect(capturedBus).toHaveLength(1);

    // Subscriber attached after setup but before publish sees the initial
    // `definition` frame from the bus's eager materialization. After
    // publishing a terminal event we expect a terminal frame too.
    const seenKinds: string[] = [];
    capturedBus[0]!.subscribe((f) => seenKinds.push(f.kind));
    expect(seenKinds[0]).toBe('definition');

    const terminal: PetrinautEvent = {
      kind: 'net_halted',
      runId: 'r',
      ts: new Date().toISOString(),
    };
    onEvent!(terminal);
    expect(seenKinds).toContain('terminal');

    await setup.stop();
  });
});

describe('resolveCookMode', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  function makeTmpDir(prefix = 'cook-resolve-'): string {
    const d = mkdtempSync(join(tmpdir(), prefix));
    dirs.push(d);
    return d;
  }

  function initCleanGitRepo(dir: string): void {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
    writeFileSync(join(dir, 'README.md'), 'seed\n');
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', ['commit', '-q', '-m', 'initial'], { cwd: dir });
  }

  it('resolves fixture mode when <dir>/plan.yaml exists', () => {
    const d = makeTmpDir();
    writeFileSync(join(d, 'plan.yaml'), 'epics: []\nslices: []\n');

    const result = resolveCookMode(d);
    expect(result.mode).toBe('fixture');
    if (result.mode === 'fixture') {
      expect(result.planPath).toBe(join(d, 'plan.yaml'));
    }
  });

  it('resolves codebase mode when <dir>/.brunch/cook/plan.yaml exists and git working tree is clean', () => {
    const d = makeTmpDir();
    initCleanGitRepo(d);
    mkdirSync(join(d, '.brunch', 'cook'), { recursive: true });
    writeFileSync(join(d, '.brunch', 'cook', 'plan.yaml'), 'epics: []\nslices: []\n');

    const result = resolveCookMode(d);
    expect(result.mode).toBe('codebase');
    if (result.mode === 'codebase') {
      expect(result.planPath).toBe(join(d, '.brunch', 'cook', 'plan.yaml'));
      expect(result.sourceDir).toBe(d);
    }
  });

  it('refuses codebase mode when working tree has uncommitted changes', () => {
    const d = makeTmpDir();
    initCleanGitRepo(d);
    mkdirSync(join(d, '.brunch', 'cook'), { recursive: true });
    writeFileSync(join(d, '.brunch', 'cook', 'plan.yaml'), 'epics: []\nslices: []\n');
    // Introduce dirty state: modify the committed README
    writeFileSync(join(d, 'README.md'), 'modified\n');

    const result = resolveCookMode(d);
    expect(result.mode).toBe('error');
    if (result.mode === 'error') {
      expect(result.message).toMatch(/uncommitted|dirty|working tree/i);
    }
  });

  it('refuses codebase mode when <dir> is not a git repo', () => {
    const d = makeTmpDir();
    mkdirSync(join(d, '.brunch', 'cook'), { recursive: true });
    writeFileSync(join(d, '.brunch', 'cook', 'plan.yaml'), 'epics: []\nslices: []\n');

    const result = resolveCookMode(d);
    expect(result.mode).toBe('error');
    if (result.mode === 'error') {
      expect(result.message).toMatch(/git/i);
    }
  });

  it('returns error when no plan found at either location', () => {
    const d = makeTmpDir();

    const result = resolveCookMode(d);
    expect(result.mode).toBe('error');
    if (result.mode === 'error') {
      expect(result.message).toMatch(/plan/i);
    }
  });

  it('resolves explicit --spec=<id> from .brunch/cook/specs/<id>/plan.yaml', () => {
    const d = makeTmpDir();
    initCleanGitRepo(d);
    const specDir = join(d, '.brunch', 'cook', 'specs', '7');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(join(specDir, 'plan.yaml'), 'epics: []\nslices: []\n');

    const result = resolveCookMode(d, 7);
    expect(result.mode).toBe('codebase');
    if (result.mode === 'codebase') {
      expect(result.planPath).toBe(join(specDir, 'plan.yaml'));
    }
  });

  it('errors when explicit --spec=<id> plan is missing', () => {
    const d = makeTmpDir();
    initCleanGitRepo(d);

    const result = resolveCookMode(d, 99);
    expect(result.mode).toBe('error');
    if (result.mode === 'error') {
      expect(result.message).toMatch(/spec 99/);
    }
  });

  it('auto-picks the newest spec plan by mtime when no --spec is given', () => {
    const d = makeTmpDir();
    initCleanGitRepo(d);
    const older = join(d, '.brunch', 'cook', 'specs', '1');
    const newer = join(d, '.brunch', 'cook', 'specs', '2');
    mkdirSync(older, { recursive: true });
    mkdirSync(newer, { recursive: true });
    writeFileSync(join(older, 'plan.yaml'), 'epics: []\nslices: []\n');
    writeFileSync(join(newer, 'plan.yaml'), 'epics: []\nslices: []\n');
    // Force mtime ordering deterministically: older = 60s ago.
    const past = new Date(Date.now() - 60_000);
    utimesSync(join(older, 'plan.yaml'), past, past);

    const result = resolveCookMode(d);
    expect(result.mode).toBe('codebase');
    if (result.mode === 'codebase') {
      expect(result.planPath).toBe(join(newer, 'plan.yaml'));
    }
  });

  it('falls back to legacy .brunch/cook/plan.yaml when no spec plans exist', () => {
    const d = makeTmpDir();
    initCleanGitRepo(d);
    mkdirSync(join(d, '.brunch', 'cook'), { recursive: true });
    writeFileSync(join(d, '.brunch', 'cook', 'plan.yaml'), 'epics: []\nslices: []\n');

    const result = resolveCookMode(d);
    expect(result.mode).toBe('codebase');
    if (result.mode === 'codebase') {
      expect(result.planPath).toBe(join(d, '.brunch', 'cook', 'plan.yaml'));
    }
  });

  it('prefers a newer spec plan over the legacy top-level plan', () => {
    const d = makeTmpDir();
    initCleanGitRepo(d);
    mkdirSync(join(d, '.brunch', 'cook'), { recursive: true });
    writeFileSync(join(d, '.brunch', 'cook', 'plan.yaml'), 'epics: []\nslices: []\n');
    const specDir = join(d, '.brunch', 'cook', 'specs', '5');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(join(specDir, 'plan.yaml'), 'epics: []\nslices: []\n');

    const result = resolveCookMode(d);
    expect(result.mode).toBe('codebase');
    if (result.mode === 'codebase') {
      expect(result.planPath).toBe(join(specDir, 'plan.yaml'));
    }
  });
});
