// Recovered from the two literal parameter objects before commit 90470eeb.
export const reconciliationToolSchemaBaseline = {
  sourceCommit: '416d73e9e38904f7eeb4246f1898aaeedbbe7503',
  sourceFile: 'src/.pi/extensions/brunch-data/reconciliation/index.ts',
  schemas: {
    read_reconciliation_needs: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      description: 'Read the open reconciliation-need agenda for the selected spec.',
    },
    update_reconciliation_needs: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: {
          enum: ['create', 'resolve'],
          description: "One write per call: 'create' records a new impasse; 'resolve' closes one.",
        },
        needKind: {
          enum: ['edge_revalidation', 'possible_relation', 'possible_duplicate', 'semantic_conflict'],
          description: 'create: kind of reconciliation need to record.',
        },
        target: {
          oneOf: [
            {
              type: 'object',
              additionalProperties: false,
              required: ['kind', 'edgeId'],
              properties: { kind: { const: 'edge' }, edgeId: { type: 'number' } },
            },
            {
              type: 'object',
              additionalProperties: false,
              required: ['kind', 'aId', 'bId'],
              properties: {
                kind: { const: 'node_pair' },
                aId: { type: 'number' },
                bId: { type: 'number' },
              },
            },
          ],
          description: 'create: existing edge or pair of existing nodes this impasse is about.',
        },
        reason: {
          type: 'string',
          description: 'create: brief reason for the impasse. Do not encode replacement graph truth here.',
        },
        needId: {
          type: 'string',
          description: 'resolve: id of the reconciliation need to close.',
        },
      },
      description:
        'Update the reconciliation register for the selected spec: create or resolve one impasse per call.',
    },
  },
} as const;
