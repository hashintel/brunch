// Recovered from the three literal parameter objects before commit 25dcfdfc.
export const contextToolSchemaBaseline = {
  sourceCommit: '371da10c',
  sourceFile: 'src/.pi/extensions/brunch-data/context/index.ts',
  schemas: {
    read_workspace_context: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['cwd_inventory', 'workspace_overview'],
        },
      },
      required: ['mode'],
      additionalProperties: false,
    },
    read_specification_context: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    read_session_context: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
} as const;
