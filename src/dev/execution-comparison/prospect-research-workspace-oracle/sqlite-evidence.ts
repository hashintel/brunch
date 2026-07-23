import Database from 'better-sqlite3';

export interface SqliteSnapshot {
  readonly tables: Readonly<Record<string, readonly Record<string, unknown>[]>>;
}

export function snapshotSqlite(path: string): SqliteSnapshot {
  const database = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const names = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[];
    return {
      tables: Object.fromEntries(
        names.map(({ name }) => [
          name,
          database.prepare(`SELECT * FROM ${quoteIdentifier(name)}`).all() as Record<string, unknown>[],
        ]),
      ),
    };
  } finally {
    database.close();
  }
}

export function rows(snapshot: SqliteSnapshot, table: string): readonly Record<string, unknown>[] {
  const selected = snapshot.tables[table];
  if (selected === undefined) throw new Error(`SQLite evidence missing table ${table}`);
  return selected;
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
