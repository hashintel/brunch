import { appendFileSync, readFileSync, existsSync } from 'node:fs';

import type { ReportLine, ReportSink } from './types.js';

/**
 * Append-only JSONL report sink backed by a file.
 * Also keeps an in-memory index for getById lookups.
 */
export class FileReportSink implements ReportSink {
  private lines: ReportLine[] = [];

  constructor(private readonly path: string) {
    // Load existing lines if file exists (for resumability-readiness)
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf8').trim();
      if (content) {
        for (const line of content.split('\n')) {
          this.lines.push(JSON.parse(line) as ReportLine);
        }
      }
    }
  }

  append(line: ReportLine): void {
    this.lines.push(line);
    appendFileSync(this.path, JSON.stringify(line) + '\n');
    // Stream to stdout — plain JSON per event (§12 POC UX)
    console.log(JSON.stringify(line));
  }

  getById(id: string): ReportLine | undefined {
    return this.lines.find((l) => l.id === id);
  }

  getAll(): ReportLine[] {
    return [...this.lines];
  }
}
