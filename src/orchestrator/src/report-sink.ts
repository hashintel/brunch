import type { ReportLine, ReportSink } from './types.js';

export class InMemoryReportSink implements ReportSink {
  private lines: ReportLine[] = [];

  append(line: ReportLine): void {
    this.lines.push(line);
  }

  getById(id: string): ReportLine | undefined {
    return this.lines.find((l) => l.id === id);
  }

  getAll(): ReportLine[] {
    return [...this.lines];
  }
}
