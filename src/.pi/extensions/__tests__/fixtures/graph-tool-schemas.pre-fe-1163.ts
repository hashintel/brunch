/* oxlint-disable unicorn/no-thenable -- historical schema baseline includes the plan phase key `then`. */
// Recovered by differential review of the literal/TypeBox sources before commit 371da10c.
// The baseline includes both the rewritten read schema and pure-relinked mutation schema.
export const graphToolSchemaBaseline = {
  sourceCommit: 'f90ad47814b7e9e04f2508a84f63621107df889a',
  sourceFile: 'src/.pi/extensions/brunch-data/graph/tool-schemas.ts',
  schemas: {
    read_graph: {
      type: 'object',
      required: ['mode'],
      properties: {
        mode: {
          enum: ['overview', 'neighborhood', 'list_by_kind', 'list_by_band', 'related'],
        },
        show: {
          enum: ['active', 'all'],
          description: 'Graph visibility to read (default: active)',
        },
        nodeCode: {
          type: 'string',
          minLength: 1,
          description:
            'neighborhood: projected code of the anchor node in the selected spec, e.g. G1 or CON2',
        },
        hops: {
          type: 'number',
          description: 'Neighborhood traversal depth (default: 1)',
        },
        kinds: {
          type: 'array',
          items: {
            type: 'string',
          },
          description:
            'list_by_kind: optional node-kind filter. Omit or pass [] for an unfiltered slice; unknown kinds produce an empty slice.',
        },
        readinessBands: {
          type: 'array',
          items: {
            enum: ['grounding', 'elicitation', 'projection', 'commitment'],
          },
          description:
            'list_by_band: optional readiness-band filter. Omit or pass [] for an unfiltered slice; unknown bands produce an empty slice.',
        },
        anchorCodes: {
          type: 'array',
          items: {
            type: 'string',
            minLength: 1,
          },
          minItems: 1,
          description: 'related: one or more projected codes of anchor nodes in the selected spec',
        },
        edgeCategory: {
          enum: [
            'dependency',
            'witness',
            'rationale',
            'realization',
            'refinement',
            'exclusion',
            'composition',
            'cross_reference',
            'supersession',
          ],
          description: 'related: edge category to follow',
        },
        direction: {
          enum: ['outgoing', 'incoming', 'both'],
          description: 'related: traversal direction (default: both)',
        },
      },
      additionalProperties: false,
      description:
        'Read a graph overview, selected-spec node neighborhood, projection-aware flat graph slice, or related nodes. Mode-specific companions are enforced by loud adapter diagnostics: neighborhood requires nodeCode; related requires anchorCodes plus edgeCategory. List modes intentionally treat omitted/empty filters as unfiltered slices; unknown filters produce an empty slice.',
    },
    mutate_graph: {
      type: 'object',
      required: ['ops'],
      properties: {
        createBasis: {
          type: 'string',
          enum: ['explicit', 'implicit'],
          description: 'Basis for newly created nodes and edges in this batch',
        },
        createSettlement: {
          type: 'string',
          enum: ['advisory', 'settled'],
          description:
            'Settlement for newly created nodes and edges in this batch (default: settled). Use "advisory" only for reviewed, source-derived bulk-acquisition material that has not yet been harmonized against inner-band concerns (D99-L) — never for directly-stated user facts.',
        },
        ops: {
          type: 'array',
          items: {
            anyOf: [
              {
                anyOf: [
                  {
                    type: 'object',
                    required: ['op', 'ref', 'title', 'plane', 'kind', 'detail'],
                    properties: {
                      op: {
                        type: 'string',
                        const: 'create_node',
                      },
                      ref: {
                        type: 'string',
                        description: "Temporary batch reference id (e.g. 'n1', 'n2')",
                      },
                      title: {
                        type: 'string',
                        description: 'Node title — must be non-empty',
                      },
                      body: {
                        type: 'string',
                        description: 'Extended description',
                      },
                      source: {
                        type: 'string',
                        description: "Epistemic attribution (e.g. 'stakeholder', 'derived')",
                      },
                      plane: {
                        type: 'string',
                        const: 'intent',
                      },
                      kind: {
                        type: 'string',
                        const: 'decision',
                      },
                      detail: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['chosen_option', 'rejected', 'rationale'],
                        properties: {
                          chosen_option: {
                            type: 'string',
                            description: 'The selected option or position.',
                          },
                          rejected: {
                            type: 'array',
                            minItems: 1,
                            items: {
                              type: 'string',
                            },
                            description: 'Rejected alternatives considered by this decision.',
                          },
                          rationale: {
                            type: 'string',
                            description: 'Why the chosen option won.',
                          },
                        },
                        description: 'Detail required for decision nodes.',
                      },
                    },
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    required: ['op', 'ref', 'title', 'plane', 'kind', 'detail'],
                    properties: {
                      op: {
                        type: 'string',
                        const: 'create_node',
                      },
                      ref: {
                        type: 'string',
                        description: "Temporary batch reference id (e.g. 'n1', 'n2')",
                      },
                      title: {
                        type: 'string',
                        description: 'Node title — must be non-empty',
                      },
                      body: {
                        type: 'string',
                        description: 'Extended description',
                      },
                      source: {
                        type: 'string',
                        description: "Epistemic attribution (e.g. 'stakeholder', 'derived')",
                      },
                      plane: {
                        type: 'string',
                        const: 'intent',
                      },
                      kind: {
                        type: 'string',
                        const: 'term',
                      },
                      detail: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['definition'],
                        properties: {
                          definition: {
                            type: 'string',
                            description: 'Canonical definition for the term.',
                          },
                          aliases: {
                            type: 'array',
                            items: {
                              type: 'string',
                            },
                            description: 'Optional alternate names for the same concept.',
                          },
                        },
                        description: 'Detail required for term nodes.',
                      },
                    },
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    required: ['op', 'ref', 'title', 'plane', 'kind'],
                    properties: {
                      op: {
                        type: 'string',
                        const: 'create_node',
                      },
                      ref: {
                        type: 'string',
                        description: "Temporary batch reference id (e.g. 'n1', 'n2')",
                      },
                      title: {
                        type: 'string',
                        description: 'Node title — must be non-empty',
                      },
                      body: {
                        type: 'string',
                        description: 'Extended description',
                      },
                      source: {
                        type: 'string',
                        description: "Epistemic attribution (e.g. 'stakeholder', 'derived')",
                      },
                      plane: {
                        type: 'string',
                        const: 'intent',
                      },
                      kind: {
                        type: 'string',
                        const: 'requirement',
                      },
                      detail: {
                        anyOf: [
                          {
                            type: 'object',
                            additionalProperties: false,
                            required: ['form'],
                            properties: {
                              form: {
                                const: 'plain',
                                description: 'Plain claim — no structured method payload.',
                              },
                            },
                            description: 'Plain claim form.',
                          },
                          {
                            type: 'object',
                            additionalProperties: false,
                            required: ['form', 'then'],
                            properties: {
                              form: {
                                const: 'gherkin',
                              },
                              given: {
                                type: 'array',
                                items: {
                                  type: 'string',
                                },
                                description: 'Given preconditions.',
                              },
                              when: {
                                type: 'array',
                                items: {
                                  type: 'string',
                                },
                                description: 'When actions.',
                              },
                              then: {
                                type: 'array',
                                minItems: 1,
                                items: {
                                  type: 'string',
                                },
                                description: 'Then outcomes — at least one.',
                              },
                            },
                            description: 'Gherkin Given/When/Then payload.',
                          },
                          {
                            type: 'object',
                            additionalProperties: false,
                            required: ['form', 'language', 'statement'],
                            properties: {
                              form: {
                                const: 'formal',
                              },
                              language: {
                                type: 'string',
                                description: 'Target prover/solver, e.g. lean or dafny.',
                              },
                              statement: {
                                type: 'string',
                                description: 'Formal statement text for round-trip.',
                              },
                            },
                            description: 'Formal verification payload.',
                          },
                        ],
                      },
                    },
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    required: ['op', 'ref', 'title', 'plane', 'kind'],
                    properties: {
                      op: {
                        type: 'string',
                        const: 'create_node',
                      },
                      ref: {
                        type: 'string',
                        description: "Temporary batch reference id (e.g. 'n1', 'n2')",
                      },
                      title: {
                        type: 'string',
                        description: 'Node title — must be non-empty',
                      },
                      body: {
                        type: 'string',
                        description: 'Extended description',
                      },
                      source: {
                        type: 'string',
                        description: "Epistemic attribution (e.g. 'stakeholder', 'derived')",
                      },
                      plane: {
                        type: 'string',
                        const: 'intent',
                      },
                      kind: {
                        type: 'string',
                        const: 'criterion',
                      },
                      detail: {
                        anyOf: [
                          {
                            type: 'object',
                            additionalProperties: false,
                            required: ['form'],
                            properties: {
                              form: {
                                const: 'plain',
                                description: 'Plain claim — no structured method payload.',
                              },
                            },
                            description: 'Plain claim form.',
                          },
                          {
                            type: 'object',
                            additionalProperties: false,
                            required: ['form', 'then'],
                            properties: {
                              form: {
                                const: 'gherkin',
                              },
                              given: {
                                type: 'array',
                                items: {
                                  type: 'string',
                                },
                                description: 'Given preconditions.',
                              },
                              when: {
                                type: 'array',
                                items: {
                                  type: 'string',
                                },
                                description: 'When actions.',
                              },
                              then: {
                                type: 'array',
                                minItems: 1,
                                items: {
                                  type: 'string',
                                },
                                description: 'Then outcomes — at least one.',
                              },
                            },
                            description: 'Gherkin Given/When/Then payload.',
                          },
                          {
                            type: 'object',
                            additionalProperties: false,
                            required: ['form', 'language', 'statement'],
                            properties: {
                              form: {
                                const: 'formal',
                              },
                              language: {
                                type: 'string',
                                description: 'Target prover/solver, e.g. lean or dafny.',
                              },
                              statement: {
                                type: 'string',
                                description: 'Formal statement text for round-trip.',
                              },
                            },
                            description: 'Formal verification payload.',
                          },
                        ],
                      },
                    },
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    required: ['op', 'ref', 'title', 'plane', 'kind'],
                    properties: {
                      op: {
                        type: 'string',
                        const: 'create_node',
                      },
                      ref: {
                        type: 'string',
                        description: "Temporary batch reference id (e.g. 'n1', 'n2')",
                      },
                      title: {
                        type: 'string',
                        description: 'Node title — must be non-empty',
                      },
                      body: {
                        type: 'string',
                        description: 'Extended description',
                      },
                      source: {
                        type: 'string',
                        description: "Epistemic attribution (e.g. 'stakeholder', 'derived')",
                      },
                      plane: {
                        type: 'string',
                        const: 'intent',
                      },
                      kind: {
                        type: 'string',
                        const: 'invariant',
                      },
                      detail: {
                        anyOf: [
                          {
                            type: 'object',
                            additionalProperties: false,
                            required: ['form'],
                            properties: {
                              form: {
                                const: 'plain',
                                description: 'Plain claim — no structured method payload.',
                              },
                            },
                            description: 'Plain claim form.',
                          },
                          {
                            type: 'object',
                            additionalProperties: false,
                            required: ['form', 'then'],
                            properties: {
                              form: {
                                const: 'gherkin',
                              },
                              given: {
                                type: 'array',
                                items: {
                                  type: 'string',
                                },
                                description: 'Given preconditions.',
                              },
                              when: {
                                type: 'array',
                                items: {
                                  type: 'string',
                                },
                                description: 'When actions.',
                              },
                              then: {
                                type: 'array',
                                minItems: 1,
                                items: {
                                  type: 'string',
                                },
                                description: 'Then outcomes — at least one.',
                              },
                            },
                            description: 'Gherkin Given/When/Then payload.',
                          },
                          {
                            type: 'object',
                            additionalProperties: false,
                            required: ['form', 'language', 'statement'],
                            properties: {
                              form: {
                                const: 'formal',
                              },
                              language: {
                                type: 'string',
                                description: 'Target prover/solver, e.g. lean or dafny.',
                              },
                              statement: {
                                type: 'string',
                                description: 'Formal statement text for round-trip.',
                              },
                            },
                            description: 'Formal verification payload.',
                          },
                        ],
                      },
                    },
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    required: ['op', 'ref', 'title', 'plane', 'kind'],
                    properties: {
                      op: {
                        type: 'string',
                        const: 'create_node',
                      },
                      ref: {
                        type: 'string',
                        description: "Temporary batch reference id (e.g. 'n1', 'n2')",
                      },
                      title: {
                        type: 'string',
                        description: 'Node title — must be non-empty',
                      },
                      body: {
                        type: 'string',
                        description: 'Extended description',
                      },
                      source: {
                        type: 'string',
                        description: "Epistemic attribution (e.g. 'stakeholder', 'derived')",
                      },
                      plane: {
                        type: 'string',
                        const: 'intent',
                      },
                      kind: {
                        type: 'string',
                        const: 'context',
                      },
                      detail: {
                        anyOf: [
                          {
                            type: 'object',
                            additionalProperties: false,
                            required: ['form', 'statement'],
                            properties: {
                              form: {
                                const: 'given',
                              },
                              statement: {
                                type: 'string',
                                description: 'Stipulated axiom/given statement.',
                              },
                            },
                            description: 'Axiom/given payload on a context node.',
                          },
                        ],
                      },
                    },
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    required: ['op', 'ref', 'title', 'plane', 'kind'],
                    properties: {
                      op: {
                        type: 'string',
                        const: 'create_node',
                      },
                      ref: {
                        type: 'string',
                        description: "Temporary batch reference id (e.g. 'n1', 'n2')",
                      },
                      title: {
                        type: 'string',
                        description: 'Node title — must be non-empty',
                      },
                      body: {
                        type: 'string',
                        description: 'Extended description',
                      },
                      source: {
                        type: 'string',
                        description: "Epistemic attribution (e.g. 'stakeholder', 'derived')",
                      },
                      plane: {
                        type: 'string',
                        enum: ['intent', 'oracle', 'design', 'plan'],
                      },
                      kind: {
                        type: 'string',
                        enum: [
                          'goal',
                          'thesis',
                          'story',
                          'unknown',
                          'assumption',
                          'constraint',
                          'example',
                          'check',
                          'vv_method',
                          'evidence',
                          'vv_obligation',
                          'module',
                          'interface',
                          'entity',
                          'sketch',
                          'milestone',
                          'frontier',
                        ],
                      },
                    },
                    additionalProperties: false,
                  },
                ],
              },
              {
                anyOf: [
                  {
                    type: 'object',
                    required: ['op', 'category', 'dependency', 'dependent'],
                    properties: {
                      op: {
                        type: 'string',
                        const: 'create_edge',
                      },
                      category: {
                        type: 'string',
                        const: 'dependency',
                      },
                      dependency: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      dependent: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    required: ['op', 'category', 'oracle', 'claim', 'stance'],
                    properties: {
                      op: {
                        type: 'string',
                        const: 'create_edge',
                      },
                      category: {
                        type: 'string',
                        const: 'witness',
                      },
                      oracle: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      claim: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      stance: {
                        type: 'string',
                        enum: ['for', 'against'],
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    required: ['op', 'category', 'support', 'claim', 'stance'],
                    properties: {
                      op: {
                        type: 'string',
                        const: 'create_edge',
                      },
                      category: {
                        type: 'string',
                        const: 'rationale',
                      },
                      support: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      claim: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      stance: {
                        type: 'string',
                        enum: ['for', 'against'],
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    required: ['op', 'category', 'abstract', 'concrete'],
                    properties: {
                      op: {
                        type: 'string',
                        const: 'create_edge',
                      },
                      category: {
                        type: 'string',
                        const: 'realization',
                      },
                      abstract: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      concrete: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    required: ['op', 'category', 'abstract', 'concrete'],
                    properties: {
                      op: {
                        type: 'string',
                        const: 'create_edge',
                      },
                      category: {
                        type: 'string',
                        const: 'refinement',
                      },
                      abstract: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      concrete: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    required: ['op', 'category', 'boundary', 'subject'],
                    properties: {
                      op: {
                        type: 'string',
                        const: 'create_edge',
                      },
                      category: {
                        type: 'string',
                        const: 'exclusion',
                      },
                      boundary: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      subject: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    required: ['op', 'category', 'whole', 'part'],
                    properties: {
                      op: {
                        type: 'string',
                        const: 'create_edge',
                      },
                      category: {
                        type: 'string',
                        const: 'composition',
                      },
                      whole: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      part: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    required: ['op', 'category', 'a', 'b'],
                    properties: {
                      op: {
                        type: 'string',
                        const: 'create_edge',
                      },
                      category: {
                        type: 'string',
                        const: 'cross_reference',
                      },
                      a: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      b: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    required: ['op', 'category', 'successor', 'predecessor'],
                    properties: {
                      op: {
                        type: 'string',
                        const: 'create_edge',
                      },
                      category: {
                        type: 'string',
                        const: 'supersession',
                      },
                      successor: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      predecessor: {
                        anyOf: [
                          {
                            type: 'string',
                            description: "Intra-batch ref (e.g. 'n1')",
                          },
                          {
                            type: 'object',
                            required: ['existingCode'],
                            properties: {
                              existingCode: {
                                type: 'string',
                                description:
                                  'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
                              },
                            },
                            additionalProperties: false,
                          },
                        ],
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    additionalProperties: false,
                  },
                ],
              },
            ],
          },
          description:
            'Create-only graph mutation operations. Edges use role-named endpoints and may reference batch refs or existing node codes.',
        },
      },
      additionalProperties: false,
    },
  },
} as const;
