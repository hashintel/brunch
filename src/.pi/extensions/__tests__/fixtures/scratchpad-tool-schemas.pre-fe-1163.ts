// Recovered from the two literal parameter objects before commit 416d73e9.
export const scratchpadToolSchemaBaseline = {
  sourceCommit: '25dcfdfc2ad07ce28d5fb8f320ea432c55c02238',
  sourceFile: 'src/.pi/extensions/brunch-data/elicitation/scratchpad-tools.ts',
  schemas: {
    read_elicitation_scratchpad: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      description:
        'Read the current session-local elicitation scratchpad: obligations the agent has noted still need asking, reconstructed from this session branch. Non-authoritative — durable truth is the graph.',
    },
    update_elicitation_scratchpad: {
      type: 'object',
      additionalProperties: false,
      required: ['operation'],
      properties: {
        operation: {
          enum: ['add', 'resolve', 'update'],
          description:
            "'add' appends a new open obligation; 'resolve' marks an existing obligation resolved; 'update' replaces an obligation's text/rationale/meta",
        },
        id: {
          type: 'string',
          description: 'add: id for the new obligation; resolve/update: id of the existing one',
        },
        obligation: {
          type: 'string',
          description: 'add/update: the obligation text (what still needs asking)',
        },
        rationale: { type: 'string', description: 'add/update: why this obligation exists' },
        meta: {
          type: 'object',
          description: 'add/update: free-form non-authoritative reference data',
        },
      },
      description:
        'Write the session-local elicitation scratchpad. Always appends a full-replacement snapshot of the current scratchpad; never persists to the graph.',
    },
  },
} as const;
