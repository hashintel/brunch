import { describe, expect, it, spyOn } from "bun:test";

// These imports will fail until the implementation is created.
// The module is expected to export:
//   getVersion(): string   — reads version from package.json
//   run(args: string[]): void — main CLI entry point; honours --version
import { getVersion, run } from "../src/cli.ts";

// The package.json that the implementation must read from.
import pkg from "../package.json" with { type: "json" };

describe("getVersion", () => {
  it("returns a non-empty string", () => {
    const version = getVersion();
    expect(typeof version).toBe("string");
    expect(version.length).toBeGreaterThan(0);
  });

  it("matches the version field in package.json", () => {
    expect(getVersion()).toBe(pkg.version);
  });

  it("looks like a semver string (major.minor.patch)", () => {
    const version = getVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe("run(['--version'])", () => {
  it("writes the version to stdout", () => {
    const writes: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    const spy = spyOn(process.stdout, "write").mockImplementation(
      (chunk: string | Uint8Array) => {
        writes.push(typeof chunk === "string" ? chunk : String(chunk));
        return true;
      },
    );

    try {
      run(["--version"]);
    } finally {
      spy.mockRestore();
    }

    const output = writes.join("");
    expect(output).toContain(pkg.version);
  });

  it("exits with code 0 after printing the version", () => {
    let exitCode: number | undefined;
    const exitSpy = spyOn(process, "exit").mockImplementation((code?: number) => {
      exitCode = code ?? 0;
      return undefined as never;
    });

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      run(["--version"]);
    } finally {
      exitSpy.mockRestore();
      writeSpy.mockRestore();
    }

    // Either exits with 0, or doesn't call process.exit at all (both are acceptable).
    if (exitCode !== undefined) {
      expect(exitCode).toBe(0);
    }
  });

  it("prints nothing to stderr when --version is used", () => {
    const stderrWrites: string[] = [];
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
      (chunk: string | Uint8Array) => {
        stderrWrites.push(typeof chunk === "string" ? chunk : String(chunk));
        return true;
      },
    );
    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    const exitSpy = spyOn(process, "exit").mockImplementation(() => undefined as never);

    try {
      run(["--version"]);
    } finally {
      stderrSpy.mockRestore();
      stdoutSpy.mockRestore();
      exitSpy.mockRestore();
    }

    expect(stderrWrites.join("")).toBe("");
  });
});
