import {
  parseRequirementLedger,
  type RequirementLedger,
  type RequirementLedgerCell,
} from './traceability-contract.js';

export interface AudienceSafeRequirementLedger {
  readonly schemaVersion: 1;
  readonly studyContractSha256: string;
  readonly rows: readonly {
    readonly id: string;
    readonly publicConcern: string;
    readonly origin: RequirementLedger['rows'][number]['origin'];
    readonly publicWording?: string;
    readonly elicitation: RequirementLedger['rows'][number]['elicitation'];
    readonly handoff: RequirementLedger['rows'][number]['handoff'];
    readonly cells: {
      readonly 'brunch_spec--brunch': RequirementLedgerCell;
      readonly 'brunch_spec--claude_code': RequirementLedgerCell;
      readonly 'claude_spec--brunch': RequirementLedgerCell;
      readonly 'claude_spec--claude_code': RequirementLedgerCell;
    };
  }[];
}

export function redactRequirementLedger(input: RequirementLedger): AudienceSafeRequirementLedger {
  const ledger = parseRequirementLedger(input);
  return {
    schemaVersion: 1,
    studyContractSha256: ledger.studyContractSha256,
    rows: ledger.rows.map((row) => ({
      id: row.id,
      publicConcern: row.publicConcern,
      origin: row.origin,
      ...(row.publicWording === undefined ? {} : { publicWording: row.publicWording }),
      elicitation: row.elicitation,
      handoff: row.handoff,
      cells: {
        'brunch_spec--brunch': redactCell(row.cells['brunch_spec--brunch']),
        'brunch_spec--claude_code': redactCell(row.cells['brunch_spec--claude_code']),
        'claude_spec--brunch': redactCell(row.cells['claude_spec--brunch']),
        'claude_spec--claude_code': redactCell(row.cells['claude_spec--claude_code']),
      },
    })),
  };
}

function redactCell(cell: RequirementLedgerCell): RequirementLedgerCell {
  return {
    implementation: cell.implementation,
    verification: cell.verification,
    assessment: cell.assessment,
    evidence: cell.evidence.filter((evidence) => evidence.audience === 'public'),
  };
}
