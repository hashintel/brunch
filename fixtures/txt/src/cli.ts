import pkg from "../package.json" with { type: "json" };

export function getVersion(): string {
  return pkg.version;
}

export function run(args: string[]): void {
  if (args.includes("--version")) {
    process.stdout.write(getVersion() + "\n");
  }
}
