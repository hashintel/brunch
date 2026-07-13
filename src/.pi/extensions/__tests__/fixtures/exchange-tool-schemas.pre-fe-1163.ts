// Recovered from the legacy piSchema output at the recorded pre-FE-1163 commit.
// That adapter delegated to z.toJSONSchema(..., { unrepresentable: 'throw' });
// the four Zod schema sources are unchanged between this commit and fixture capture.
export const exchangeToolSchemaBaseline = {
  sourceCommit: 'ba24510fbd23fcf261cd393e49d0f0bb9b28df44',
  sourceAdapter: 'src/.pi/extensions/exchanges/pi-schema.ts',
  schemas: {
    ask: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        topLabel: {
          type: 'string',
          minLength: 1,
          description: 'Optional rounded-box top border label.',
        },
        bottomLabel: {
          type: 'string',
          minLength: 1,
          description: 'Optional rounded-box bottom border label.',
        },
        exchangeId: {
          type: 'string',
          minLength: 1,
          description: 'Stable id for this one-shot ask result. Omit when continuing an offer by reference.',
        },
        continues: {
          type: 'string',
          minLength: 1,
          description: 'Exchange id of an offer whose details declare the ask payload to collect.',
        },
        preface: {
          type: 'string',
          minLength: 1,
          description:
            'Optional model-authored preface for a reference-based continuation; not part of the payload.',
        },
        body: {
          type: 'string',
          minLength: 1,
          description: 'Markdown question body rendered and persisted with the answer.',
        },
        options: {
          minItems: 1,
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                minLength: 1,
                pattern: '^[^>\\r\\n]+$',
              },
              label: {
                type: 'string',
                minLength: 1,
              },
              description: {
                type: 'string',
              },
            },
            required: ['id', 'label'],
            additionalProperties: false,
          },
          description: 'Finite response options. Omit for a free-text answer.',
        },
        multiple: {
          type: 'boolean',
          description: 'When options are present, allow one-or-more selections.',
        },
        allowOther: {
          type: 'boolean',
          description: 'Whether the user may choose Other for option responses.',
        },
        allowNone: {
          type: 'boolean',
          description: 'Whether the user may choose None for option responses.',
        },
        commentPrompt: {
          type: 'string',
          minLength: 1,
          description:
            'Prompt for an optional trailing comment; omit to skip the optional-comment step. Comments the response schema requires (Other/None selections) are always collected.',
        },
      },
      additionalProperties: false,
    },
    present_review_set: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        exchangeId: {
          type: 'string',
          minLength: 1,
          description: 'Stable id tying this review-set proposal to the later request_response review.',
        },
        proposalEntryId: {
          type: 'string',
          description: 'Optional transcript/proposal entry id to carry into later acceptance audit.',
        },
        payload: {
          type: 'object',
          properties: {
            schemaVersion: {
              type: 'number',
              const: 1,
            },
            lens: {
              type: 'string',
              enum: ['intent', 'design', 'oracle', 'plan'],
            },
            epistemicStatus: {
              type: 'string',
              enum: ['inferred', 'assumed', 'asserted', 'observed'],
            },
            grounding: {
              type: 'object',
              properties: {
                summary: {
                  type: 'string',
                  minLength: 1,
                  description: 'Short grounding summary for the proposal.',
                },
                support: {
                  minItems: 1,
                  type: 'array',
                  items: {
                    type: 'string',
                    minLength: 1,
                  },
                  description: 'Concrete support/evidence strings.',
                },
              },
              required: ['summary', 'support'],
              additionalProperties: false,
            },
            pitch: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  minLength: 1,
                  description: 'Review-set title.',
                },
                narrative: {
                  type: 'string',
                  minLength: 1,
                  description: 'Why this batch should be reviewed together.',
                },
              },
              required: ['title', 'narrative'],
              additionalProperties: false,
            },
            entityDrafts: {
              minItems: 1,
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  draftId: {
                    type: 'string',
                    minLength: 1,
                  },
                  plane: {
                    type: 'string',
                    enum: ['intent', 'oracle', 'design', 'plan'],
                  },
                  kind: {
                    type: 'string',
                    minLength: 1,
                  },
                  proposedCode: {
                    type: 'string',
                    minLength: 1,
                  },
                  title: {
                    type: 'string',
                    minLength: 1,
                  },
                  body: {
                    type: 'string',
                  },
                  detail: {},
                },
                required: ['draftId', 'plane', 'kind', 'title'],
                additionalProperties: false,
              },
            },
            edgeDrafts: {
              type: 'array',
              items: {
                anyOf: [
                  {
                    type: 'object',
                    properties: {
                      category: {
                        type: 'string',
                        const: 'dependency',
                      },
                      dependency: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      dependent: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    required: ['category', 'dependency', 'dependent'],
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    properties: {
                      category: {
                        type: 'string',
                        const: 'witness',
                      },
                      oracle: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      claim: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      stance: {
                        type: 'string',
                        enum: ['for', 'against'],
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    required: ['category', 'oracle', 'claim', 'stance'],
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    properties: {
                      category: {
                        type: 'string',
                        const: 'rationale',
                      },
                      support: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      claim: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      stance: {
                        type: 'string',
                        enum: ['for', 'against'],
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    required: ['category', 'support', 'claim', 'stance'],
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    properties: {
                      category: {
                        type: 'string',
                        const: 'realization',
                      },
                      abstract: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      concrete: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    required: ['category', 'abstract', 'concrete'],
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    properties: {
                      category: {
                        type: 'string',
                        const: 'refinement',
                      },
                      abstract: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      concrete: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    required: ['category', 'abstract', 'concrete'],
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    properties: {
                      category: {
                        type: 'string',
                        const: 'exclusion',
                      },
                      boundary: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      subject: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    required: ['category', 'boundary', 'subject'],
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    properties: {
                      category: {
                        type: 'string',
                        const: 'composition',
                      },
                      whole: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      part: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    required: ['category', 'whole', 'part'],
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    properties: {
                      category: {
                        type: 'string',
                        const: 'cross_reference',
                      },
                      a: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      b: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    required: ['category', 'a', 'b'],
                    additionalProperties: false,
                  },
                  {
                    type: 'object',
                    properties: {
                      category: {
                        type: 'string',
                        const: 'supersession',
                      },
                      successor: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      predecessor: {
                        anyOf: [
                          {
                            type: 'object',
                            properties: {
                              draftId: {
                                type: 'string',
                                minLength: 1,
                                description: 'Review-set-local draft id.',
                              },
                            },
                            required: ['draftId'],
                            additionalProperties: false,
                          },
                          {
                            type: 'object',
                            properties: {
                              existingCode: {
                                type: 'string',
                                minLength: 1,
                                description: 'Projected graph node code from read_graph.',
                              },
                            },
                            required: ['existingCode'],
                            additionalProperties: false,
                          },
                        ],
                        description: 'Endpoint reference: exactly one of draftId or existingCode.',
                      },
                      rationale: {
                        type: 'string',
                      },
                    },
                    required: ['category', 'successor', 'predecessor'],
                    additionalProperties: false,
                  },
                ],
                description: 'Role-named edge draft; companion endpoint fields are determined by category.',
              },
            },
            proposalVersion: {
              type: 'integer',
              exclusiveMinimum: 0,
              maximum: 9007199254740991,
            },
            supersedes: {
              type: 'string',
              minLength: 1,
            },
          },
          required: ['schemaVersion'],
          additionalProperties: {},
          description:
            'Review-set proposal payload. Required by the graph validator: schemaVersion, lens, epistemicStatus, grounding {summary, support[]}, pitch {title, narrative}, entityDrafts[], edgeDrafts[].',
        },
      },
      required: ['exchangeId', 'payload'],
      additionalProperties: false,
    },
    present_candidates: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        exchangeId: {
          type: 'string',
          minLength: 1,
          description: 'Stable id tying this candidate presentation to the later request_response call.',
        },
        heading: {
          type: 'string',
          minLength: 1,
          description: 'Candidate comparison heading.',
        },
        body: {
          type: 'string',
          description: 'Markdown body for context before the candidate list.',
        },
        candidates: {
          minItems: 1,
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                minLength: 1,
              },
              title: {
                type: 'string',
                minLength: 1,
              },
              user_rubric: {
                type: 'object',
                properties: {
                  core_bet: {
                    type: 'string',
                  },
                  best_fit: {
                    type: 'string',
                  },
                  cost_complexity: {
                    type: 'string',
                  },
                  covers_well: {
                    type: 'string',
                  },
                  main_risks: {
                    type: 'string',
                  },
                  lock_in_constraints: {
                    type: 'string',
                  },
                  recommendation: {
                    type: 'string',
                  },
                },
                required: [
                  'core_bet',
                  'best_fit',
                  'cost_complexity',
                  'covers_well',
                  'main_risks',
                  'lock_in_constraints',
                ],
                additionalProperties: false,
              },
              meta_rubric: {
                type: 'object',
                properties: {
                  legibility_cost_of_knowing: {
                    type: 'string',
                  },
                  failure_modes: {
                    type: 'string',
                  },
                  coverage_range: {
                    type: 'string',
                  },
                  commitment: {
                    type: 'string',
                  },
                },
                additionalProperties: false,
              },
              graph_refs: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    node_id: {
                      type: 'string',
                      minLength: 1,
                    },
                  },
                  required: ['node_id'],
                  additionalProperties: false,
                },
              },
            },
            required: ['id', 'title', 'user_rubric', 'meta_rubric', 'graph_refs'],
            additionalProperties: false,
          },
          description:
            'Recognition-only candidate expressions to compare and choose from; selection records fan-in intent but does not commit graph truth.',
        },
      },
      required: ['exchangeId', 'heading', 'candidates'],
      additionalProperties: false,
    },
    present_digest: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        exchangeId: {
          type: 'string',
          minLength: 1,
          description: 'Stable id tying this digest presentation to the later request_response review.',
        },
        heading: {
          type: 'string',
          minLength: 1,
          description: 'Digest heading.',
        },
        body: {
          type: 'string',
          description: 'Markdown body for context before the digest.',
        },
        digest: {
          type: 'object',
          properties: {
            abstract: {
              type: 'string',
            },
            analysis: {
              type: 'string',
            },
            recommendation: {
              type: 'string',
            },
          },
          required: ['abstract'],
          additionalProperties: false,
          description:
            'Prose-only digest material: abstract plus optional analysis and recommendation. Do not include graph nodes, edges, draft ids, command payloads, or review-set material.',
        },
      },
      required: ['exchangeId', 'heading', 'digest'],
      additionalProperties: false,
    },
  },
} as const;
