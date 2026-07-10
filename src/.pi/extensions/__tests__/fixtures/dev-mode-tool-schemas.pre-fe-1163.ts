// Recovered from devToolParameters at the recorded pre-FE-1163 commit.
// The legacy and shared adapters both call z.toJSONSchema with unrepresentable: throw.
export const devModeToolSchemaBaseline = {
  sourceCommit: 'ba24510fbd23fcf261cd393e49d0f0bb9b28df44',
  sourceAdapter: 'src/.pi/extensions/shared/pi-tool-schema.ts',
  schemas: {
    brunch_introspect_query: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        find: {
          type: 'object',
          properties: {
            capture: {
              type: 'string',
              const: 'latest',
            },
            turnId: {
              type: 'string',
            },
            nth: {
              type: 'number',
              minimum: 1,
            },
          },
          additionalProperties: false,
        },
        select: {
          anyOf: [
            {
              type: 'string',
            },
            {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          ],
        },
        maxBytes: {
          type: 'number',
          minimum: 1,
        },
        format: {
          type: 'string',
          enum: ['json', 'text'],
        },
      },
      additionalProperties: false,
    },
    brunch_session_query: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        find: {
          type: 'object',
          properties: {
            role: {
              type: 'string',
              enum: [
                'user',
                'assistant',
                'toolResult',
                'custom',
                'bashExecution',
                'branchSummary',
                'compactionSummary',
              ],
            },
            toolName: {
              type: 'string',
            },
            toolCallId: {
              type: 'string',
            },
            customType: {
              type: 'string',
            },
            isError: {
              type: 'boolean',
            },
            contains: {
              type: 'string',
            },
            last: {
              type: 'number',
              minimum: 1,
            },
            range: {
              type: 'array',
              prefixItems: [
                {
                  type: 'number',
                  minimum: 0,
                },
                {
                  type: 'number',
                  minimum: 0,
                },
              ],
            },
          },
          additionalProperties: false,
        },
        select: {
          anyOf: [
            {
              type: 'string',
            },
            {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          ],
        },
        maxBytes: {
          type: 'number',
          minimum: 1,
        },
        format: {
          type: 'string',
          enum: ['json', 'text'],
        },
      },
      required: ['find'],
      additionalProperties: false,
    },
  },
} as const;
