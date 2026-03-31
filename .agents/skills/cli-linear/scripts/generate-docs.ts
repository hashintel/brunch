#!/usr/bin/env bun

/**
 * Generates markdown documentation from `linear --help` output.
 * Run periodically as the CLI evolves to keep skill references up to date.
 */

import { dirname, join } from "node:path";
import { mkdir, readdir, rm, readFile, writeFile } from "node:fs/promises";

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname);
const SKILL_DIR = join(SCRIPT_DIR, "..");
const REFERENCES_DIR = join(SKILL_DIR, "references");
const SKILL_MD = join(SKILL_DIR, "SKILL.md");
const SKILL_TEMPLATE = join(SKILL_DIR, "SKILL.template.md");

// Files to preserve (not generated from help)
const PRESERVED_FILES = ["organization-features.md"];

// Commands to skip (shell completions, not useful for docs)
const SKIP_COMMANDS = ["completions"];

interface CommandInfo {
  name: string;
  description: string;
  help: string;
  subcommands: CommandInfo[];
}

async function run(cmd: string[]): Promise<{ success: boolean; stdout: string; stderr: string }> {
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1" },
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return {
    success: exitCode === 0,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

function stripAnsi(str: string): string {
  // Remove ANSI escape codes (in case NO_COLOR doesn't work)
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function stripVersion(str: string): string {
  // Remove "Version: X.Y.Z" lines from help output to avoid churn on version bumps
  return str.replace(/^Version:.*\n?/gm, "").replace(/\n+$/, "");
}

function parseCommands(helpText: string): string[] {
  const commands: string[] = [];
  const lines = helpText.split("\n");
  let inCommands = false;
  let foundAnyCommand = false;

  for (const line of lines) {
    if (line.startsWith("Commands:")) {
      inCommands = true;
      continue;
    }
    if (inCommands) {
      // Command lines look like: "  command, alias  - Description"
      // or: "  command  <arg>  - Description"
      // Capture command name (stopping at comma or whitespace)
      const match = line.match(/^\s{2}([a-z][-a-z]*)(?:,|\s)/);
      if (match) {
        commands.push(match[1]!);
        foundAnyCommand = true;
      } else if (foundAnyCommand && line.trim() === "") {
        // Empty line after we've found commands means end of section
        break;
      }
      // Skip empty lines before first command (common in help output)
    }
  }

  return commands;
}

async function getCommandHelp(cmdPath: string[]): Promise<string> {
  const result = await run(["linear", ...cmdPath, "--help"]);
  if (!result.success) {
    return result.stderr || "Command help not available";
  }
  return stripVersion(stripAnsi(result.stdout));
}

async function discoverCommand(cmdPath: string[]): Promise<CommandInfo> {
  const help = await getCommandHelp(cmdPath);
  const name = cmdPath.join(" ");

  // Extract description from help text
  const descMatch = help.match(/Description:\s*\n\s*(.+)/);
  const description = descMatch?.[1]?.trim() ?? "";

  // Find subcommands
  const subcommandNames = parseCommands(help);
  const subcommands: CommandInfo[] = [];

  for (const subcmd of subcommandNames) {
    const subInfo = await discoverCommand([...cmdPath, subcmd]);
    subcommands.push(subInfo);
  }

  return { name, description, help, subcommands };
}

function generateCommandDoc(cmd: CommandInfo): string {
  const lines: string[] = [];
  const cmdName = cmd.name.replace(/^linear /, "");

  lines.push(`# ${cmdName}`);
  lines.push("");
  lines.push(`> ${cmd.description}`);
  lines.push("");
  lines.push("## Usage");
  lines.push("");
  lines.push("```");
  lines.push(cmd.help);
  lines.push("```");

  // Add subcommand details
  if (cmd.subcommands.length > 0) {
    lines.push("");
    lines.push("## Subcommands");

    for (const sub of cmd.subcommands) {
      const subName = sub.name.split(" ").pop()!;
      lines.push("");
      lines.push(`### ${subName}`);
      lines.push("");
      if (sub.description) {
        lines.push(`> ${sub.description}`);
        lines.push("");
      }
      lines.push("```");
      lines.push(sub.help);
      lines.push("```");

      // Handle 3-level deep commands (e.g., issue comment add)
      if (sub.subcommands.length > 0) {
        lines.push("");
        lines.push(`#### ${subName} subcommands`);

        for (const subsub of sub.subcommands) {
          const subsubName = subsub.name.split(" ").pop()!;
          lines.push("");
          lines.push(`##### ${subsubName}`);
          lines.push("");
          lines.push("```");
          lines.push(subsub.help);
          lines.push("```");
        }
      }
    }
  }

  return lines.join("\n");
}

async function main() {
  console.log("Generating Linear CLI documentation...");

  // Check linear is available
  const versionResult = await run(["linear", "--version"]);
  if (!versionResult.success) {
    console.error("Error: linear CLI not found. Is it installed?");
    process.exit(1);
  }
  console.log(`Linear CLI: ${stripAnsi(versionResult.stdout)}`);

  // Auto-discover top-level commands from `linear --help`
  console.log("Discovering commands...");
  const topLevelHelp = await getCommandHelp([]);
  const topLevelCommands = parseCommands(topLevelHelp).filter(
    (cmd) => !SKIP_COMMANDS.includes(cmd),
  );
  console.log(`Found ${topLevelCommands.length} top-level commands`);

  const commands: CommandInfo[] = [];

  for (const cmd of topLevelCommands) {
    console.log(`  Discovering: ${cmd}`);
    const info = await discoverCommand([cmd]);
    commands.push(info);
  }

  // Generate markdown files
  console.log("Generating markdown files...");

  // Ensure references directory exists
  await mkdir(REFERENCES_DIR, { recursive: true });

  // Get list of preserved files to keep
  const preservedPaths = new Set(PRESERVED_FILES.map((f) => join(REFERENCES_DIR, f)));

  // Clean up old generated files (but preserve manual files)
  const entries = await readdir(REFERENCES_DIR);
  for (const entry of entries) {
    const filePath = join(REFERENCES_DIR, entry);
    if (!preservedPaths.has(filePath) && entry.endsWith(".md")) {
      await rm(filePath);
    }
  }

  // Write command documentation
  for (const cmd of commands) {
    const filename = `${cmd.name.replace(/^linear /, "")}.md`;
    const filepath = join(REFERENCES_DIR, filename);
    const content = generateCommandDoc(cmd);
    await writeFile(filepath, content + "\n");
    console.log(`  Generated: ${filename}`);
  }

  // Generate index file
  const indexContent = generateIndex(commands);
  await writeFile(join(REFERENCES_DIR, "commands.md"), indexContent);
  console.log("  Generated: commands.md");

  // Generate SKILL.md from template
  console.log("Generating SKILL.md from template...");
  const skillContent = await generateSkillMd(commands);
  await writeFile(SKILL_MD, skillContent);
  console.log("  Generated: SKILL.md");

  console.log(`\nDone! Generated ${commands.length + 2} files.`);
}

function generateIndex(commands: CommandInfo[]): string {
  const lines: string[] = [];

  lines.push("# Linear CLI Command Reference");
  lines.push("");
  lines.push("## Commands");
  lines.push("");

  for (const cmd of commands) {
    const cmdName = cmd.name.replace(/^linear /, "");
    lines.push(`- [${cmdName}](./${cmdName}.md) - ${cmd.description}`);
  }

  lines.push("");
  lines.push("## Quick Reference");
  lines.push("");
  lines.push("```bash");
  lines.push("# Get help for any command");
  lines.push("linear <command> --help");
  lines.push("linear <command> <subcommand> --help");
  lines.push("```");

  return lines.join("\n") + "\n";
}

function generateCommandsSection(commands: CommandInfo[]): string {
  const lines: string[] = [];
  lines.push("```");

  // Find max command name length for alignment
  const maxLen = Math.max(...commands.map((c) => c.name.length));

  for (const cmd of commands) {
    const padding = " ".repeat(maxLen - cmd.name.length + 2);
    lines.push(`linear ${cmd.name}${padding}# ${cmd.description}`);
  }

  lines.push("```");
  return lines.join("\n");
}

function generateReferenceToc(commands: CommandInfo[]): string {
  const lines: string[] = [];

  for (const cmd of commands) {
    lines.push(`- [${cmd.name}](references/${cmd.name}.md) - ${cmd.description}`);
  }

  return lines.join("\n");
}

async function generateSkillMd(commands: CommandInfo[]): Promise<string> {
  const template = await readFile(SKILL_TEMPLATE, "utf-8");
  return template
    .replace("{{COMMANDS}}", generateCommandsSection(commands))
    .replace("{{REFERENCE_TOC}}", generateReferenceToc(commands));
}

await main();
