import { readFile } from 'node:fs/promises';

interface ResearchFixture {
  readonly companies: readonly {
    readonly id: string;
    readonly name: string;
    readonly domain: string;
    readonly fitEvidence?: string;
  }[];
  readonly prospects: readonly {
    readonly source: string;
    readonly person: string;
    readonly email: string;
    readonly role?: string;
    readonly companyId: string;
    readonly roleEvidence?: string;
    readonly confidence: number;
  }[];
}

export interface ExpectedProspect {
  readonly person: string;
  readonly company: string;
  readonly email: string;
  readonly automatedStatus: 'qualified' | 'needs_review';
  readonly sources: readonly string[];
}

export async function expectedResearchState(path: string): Promise<readonly ExpectedProspect[]> {
  const fixture = parseFixture(JSON.parse(await readFile(path, 'utf8')) as unknown);
  const companies = new Map(fixture.companies.map((company) => [company.id, company]));
  const prospects = new Map<string, ExpectedProspect>();
  for (const candidate of fixture.prospects) {
    const company = companies.get(candidate.companyId);
    if (company === undefined) throw new Error(`fixture references unknown company ${candidate.companyId}`);
    const key = candidate.email.toLowerCase();
    const prior = prospects.get(key);
    const automatedStatus =
      candidate.role && candidate.roleEvidence && company.fitEvidence ? 'qualified' : 'needs_review';
    prospects.set(key, {
      person: candidate.person,
      company: company.name,
      email: key,
      automatedStatus,
      sources: [...new Set([...(prior?.sources ?? []), candidate.source])].sort(),
    });
  }
  return [...prospects.values()].sort((left, right) => left.email.localeCompare(right.email));
}

function parseFixture(value: unknown): ResearchFixture {
  if (!record(value) || !Array.isArray(value['companies']) || !Array.isArray(value['prospects'])) {
    throw new Error('invalid deterministic research fixture');
  }
  return value as unknown as ResearchFixture;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
