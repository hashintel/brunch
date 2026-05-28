import type { ReportLine, ReportSink } from './types.js';

let seq = 0;

/** Create and append a report line, returning its id. */
export function createReport(sink: ReportSink, fields: Omit<ReportLine, 'id' | 'ts'>): string {
  const id = `rpt-${fields.actor}-${fields.sliceId || fields.epicId}-${Date.now()}-${seq++}`;
  const line: ReportLine = {
    id,
    ts: new Date().toISOString(),
    ...fields,
  };
  sink.append(line);
  return id;
}
