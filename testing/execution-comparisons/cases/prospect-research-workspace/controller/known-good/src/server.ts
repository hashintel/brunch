import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join } from 'node:path';

import Database from 'better-sqlite3';

import { behavior } from './behavior.js';

const port = Number(requiredEnvironment('PORT'));
const databasePath = behavior.durable ? requiredEnvironment('DATABASE_PATH') : ':memory:';
const fixturePath = requiredEnvironment('RESEARCH_FIXTURE_PATH');
const clientRoot = join(process.cwd(), 'dist', 'client');
const database = new Database(databasePath);

database.pragma('journal_mode = WAL');
database.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    icp TEXT NOT NULL,
    approved INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    error TEXT
  );
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    fit_evidence TEXT
  );
  CREATE TABLE IF NOT EXISTS prospects (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    person TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT,
    company_id TEXT NOT NULL,
    role_evidence TEXT,
    confidence REAL NOT NULL,
    automated_status TEXT NOT NULL,
    current_status TEXT NOT NULL,
    suppressed INTEGER NOT NULL DEFAULT 0,
    approved INTEGER NOT NULL DEFAULT 0,
    UNIQUE(project_id, email)
  );
  CREATE TABLE IF NOT EXISTS provenance (
    prospect_id INTEGER NOT NULL,
    source TEXT NOT NULL,
    role_evidence TEXT,
    PRIMARY KEY (prospect_id, source)
  );
  CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY,
    prospect_id INTEGER,
    kind TEXT NOT NULL,
    previous_status TEXT,
    next_status TEXT NOT NULL,
    reason TEXT
  );
  CREATE TABLE IF NOT EXISTS suppressions (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL,
    value TEXT NOT NULL,
    reason TEXT NOT NULL
  );
`);

const server = createServer(async (request, response) => {
  try {
    await route(request, response);
  } catch (error) {
    json(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, '127.0.0.1', () => process.stdout.write(`ready:${port}\n`));
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => {
      database.close();
      process.exit(0);
    });
  });
}

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
  if (method === 'GET' && url.pathname === '/api/health') {
    json(response, 200, { status: 'ready' });
    return;
  }
  if (method === 'GET' && url.pathname === '/api/state') {
    json(response, 200, state());
    return;
  }
  if (method === 'POST' && url.pathname === '/api/projects') {
    const body = await jsonBody(request);
    const result = database
      .prepare('INSERT INTO projects (name, icp) VALUES (?, ?)')
      .run(requiredString(body, 'name'), requiredString(body, 'icp'));
    json(response, 201, { id: Number(result.lastInsertRowid) });
    return;
  }
  const projectAction = url.pathname.match(/^\/api\/projects\/(\d+)\/(approve|research)$/u);
  if (method === 'POST' && projectAction) {
    const projectId = Number(projectAction[1]);
    if (projectAction[2] === 'approve') {
      database.prepare('UPDATE projects SET approved = 1 WHERE id = ?').run(projectId);
      json(response, 200, { approved: true });
      return;
    }
    await research(response, projectId);
    return;
  }
  const prospectAction = url.pathname.match(/^\/api\/prospects\/(\d+)\/(approve|suppress|override)$/u);
  if (method === 'POST' && prospectAction) {
    await mutateProspect(response, Number(prospectAction[1]), prospectAction[2]!, await jsonBody(request));
    return;
  }
  if (method === 'GET' && url.pathname === '/api/export') {
    const where = behavior.approvedOnlyExport ? 'WHERE p.approved = 1 AND p.suppressed = 0' : '';
    const exported = database
      .prepare(
        `SELECT p.person, p.email, p.role, c.name AS company
         FROM prospects p JOIN companies c ON c.id = p.company_id ${where} ORDER BY p.email`,
      )
      .all();
    response.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="approved-prospects.json"',
    });
    response.end(`${JSON.stringify(exported, null, 2)}\n`);
    return;
  }
  await staticFile(url.pathname, response);
}

async function research(response: ServerResponse, projectId: number): Promise<void> {
  const project = database.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as
    | { approved: number }
    | undefined;
  if (project === undefined) {
    json(response, 404, { error: 'project not found' });
    return;
  }
  if (!project.approved && !behavior.allowUnapprovedResearch) {
    json(response, 409, { error: 'project approval required' });
    return;
  }
  const run = database.prepare("INSERT INTO runs (project_id, status) VALUES (?, 'running')").run(projectId);
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as Record<string, unknown>;
  if (record(fixture['error'])) {
    const rawMessage = fixture['error']['message'];
    const message = typeof rawMessage === 'string' ? rawMessage : 'provider failure';
    if (behavior.honestProviderFailure) {
      database
        .prepare("UPDATE runs SET status = 'failed', error = ? WHERE id = ?")
        .run(message, run.lastInsertRowid);
      json(response, 503, { error: message });
      return;
    }
    database.prepare("UPDATE runs SET status = 'completed' WHERE id = ?").run(run.lastInsertRowid);
    database
      .prepare(
        "INSERT INTO decisions (prospect_id, kind, previous_status, next_status, reason) VALUES (NULL, 'automated', NULL, 'rejected', 'provider unavailable')",
      )
      .run();
    json(response, 200, { imported: 0 });
    return;
  }

  const companies = requiredArray(fixture, 'companies');
  for (const company of companies) {
    database
      .prepare(
        `INSERT INTO companies (id, name, domain, fit_evidence) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, domain = excluded.domain,
           fit_evidence = excluded.fit_evidence`,
      )
      .run(company['id'], company['name'], company['domain'], company['fitEvidence'] ?? null);
  }
  const companyById = new Map(companies.map((company) => [String(company['id']), company]));
  for (const candidate of requiredArray(fixture, 'prospects')) {
    const email = String(candidate['email']).toLowerCase();
    const company = companyById.get(String(candidate['companyId']));
    if (company === undefined) throw new Error('candidate references unknown company');
    const evidenceComplete = Boolean(
      candidate['role'] && candidate['roleEvidence'] && company['fitEvidence'],
    );
    const automatedStatus =
      evidenceComplete || (behavior.confidenceOnlyQualification && Number(candidate['confidence']) >= 0.9)
        ? 'qualified'
        : 'needs_review';
    let prospect = database
      .prepare('SELECT id, suppressed FROM prospects WHERE project_id = ? AND email = ?')
      .get(projectId, email) as { id: number; suppressed: number } | undefined;
    if (prospect === undefined) {
      const inserted = database
        .prepare(
          `INSERT INTO prospects
            (project_id, person, email, role, company_id, role_evidence, confidence, automated_status, current_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          projectId,
          candidate['person'],
          email,
          candidate['role'] ?? null,
          candidate['companyId'],
          candidate['roleEvidence'] ?? null,
          candidate['confidence'],
          automatedStatus,
          automatedStatus,
        );
      prospect = { id: Number(inserted.lastInsertRowid), suppressed: 0 };
      database
        .prepare(
          "INSERT INTO decisions (prospect_id, kind, previous_status, next_status) VALUES (?, 'automated', NULL, ?)",
        )
        .run(prospect.id, automatedStatus);
    } else {
      database
        .prepare(
          `UPDATE prospects SET person = ?, role = ?, company_id = ?, role_evidence = ?, confidence = ?,
             automated_status = ?, current_status = ?, suppressed = ? WHERE id = ?`,
        )
        .run(
          candidate['person'],
          candidate['role'] ?? null,
          candidate['companyId'],
          candidate['roleEvidence'] ?? null,
          candidate['confidence'],
          automatedStatus,
          automatedStatus,
          behavior.suppressionDominates ? prospect.suppressed : 0,
          prospect.id,
        );
    }
    if (behavior.retainProvenance) {
      database
        .prepare('INSERT OR IGNORE INTO provenance (prospect_id, source, role_evidence) VALUES (?, ?, ?)')
        .run(prospect.id, candidate['source'], candidate['roleEvidence'] ?? null);
    }
  }
  database.prepare("UPDATE runs SET status = 'completed' WHERE id = ?").run(run.lastInsertRowid);
  json(response, 200, { imported: requiredArray(fixture, 'prospects').length });
}

async function mutateProspect(
  response: ServerResponse,
  prospectId: number,
  action: string,
  body: Record<string, unknown>,
): Promise<void> {
  if (action === 'approve') {
    database.prepare('UPDATE prospects SET approved = 1 WHERE id = ?').run(prospectId);
    json(response, 200, { approved: true });
    return;
  }
  const prospect = database.prepare('SELECT * FROM prospects WHERE id = ?').get(prospectId) as
    | { email: string; current_status: string }
    | undefined;
  if (prospect === undefined) {
    json(response, 404, { error: 'prospect not found' });
    return;
  }
  const reason = typeof body['reason'] === 'string' ? body['reason'].trim() : '';
  if (action === 'suppress') {
    if (!reason) {
      json(response, 400, { error: 'suppression reason required' });
      return;
    }
    database.prepare('UPDATE prospects SET suppressed = 1 WHERE id = ?').run(prospectId);
    database
      .prepare("INSERT INTO suppressions (kind, value, reason) VALUES ('email', ?, ?)")
      .run(prospect.email, reason);
    json(response, 200, { suppressed: true });
    return;
  }
  if (!reason && behavior.reasonRequired) {
    json(response, 400, { error: 'override reason required' });
    return;
  }
  database.prepare("UPDATE prospects SET current_status = 'qualified' WHERE id = ?").run(prospectId);
  if (!behavior.preserveOverrideHistory) {
    database.prepare('DELETE FROM decisions WHERE prospect_id = ?').run(prospectId);
  }
  database
    .prepare(
      "INSERT INTO decisions (prospect_id, kind, previous_status, next_status, reason) VALUES (?, 'override', ?, 'qualified', ?)",
    )
    .run(prospectId, behavior.preserveOverrideHistory ? prospect.current_status : null, reason || null);
  json(response, 200, { status: 'qualified' });
}

function state() {
  const projects = database
    .prepare('SELECT id, name, icp, approved FROM projects ORDER BY id')
    .all()
    .map((project) => ({
      ...(project as Record<string, unknown>),
      approved: Boolean((project as { approved: number }).approved),
    }));
  const runs = database
    .prepare('SELECT id, project_id AS projectId, status, error FROM runs ORDER BY id')
    .all();
  const prospects = database
    .prepare(
      `SELECT p.id, p.person, p.email, p.role, c.name AS company,
        p.automated_status AS automatedStatus, p.current_status AS currentStatus,
        p.suppressed, p.approved
       FROM prospects p JOIN companies c ON c.id = p.company_id ORDER BY p.email`,
    )
    .all()
    .map((value) => {
      const prospect = value as Record<string, unknown> & {
        id: number;
        suppressed: number;
        approved: number;
      };
      return {
        ...prospect,
        suppressed: Boolean(prospect.suppressed),
        approved: Boolean(prospect.approved),
        sources: (
          database
            .prepare('SELECT source FROM provenance WHERE prospect_id = ? ORDER BY source')
            .all(prospect.id) as {
            source: string;
          }[]
        ).map(({ source }) => source),
      };
    });
  const decisions = database
    .prepare(
      'SELECT kind, previous_status AS previousStatus, next_status AS nextStatus, reason FROM decisions ORDER BY id',
    )
    .all();
  return { projects, runs, prospects, decisions, externalRuntimeRequest: behavior.externalRuntimeRequest };
}

async function staticFile(pathname: string, response: ServerResponse): Promise<void> {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  if (relative.includes('..')) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const path = join(clientRoot, relative);
    const body = await readFile(path);
    response.writeHead(200, { 'content-type': contentType(extname(path)) }).end(body);
  } catch {
    const body = await readFile(join(clientRoot, 'index.html'));
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body);
  }
}

async function jsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as unknown;
  if (!record(value)) throw new Error('JSON body must be an object');
  return value;
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const selected = value[key];
  if (typeof selected !== 'string' || !selected.trim()) throw new Error(`${key} is required`);
  return selected.trim();
}

function requiredArray(value: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const selected = value[key];
  if (!Array.isArray(selected) || !selected.every(record)) throw new Error(`${key} must be an array`);
  return selected;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function contentType(extension: string): string {
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.js') return 'text/javascript; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  return 'application/octet-stream';
}
