import { describe, expect, it } from "vitest"
import * as z from "zod"

import {
  zPresentCandidatesDetails,
  zPresentDetails,
  zPresentOptionsDetails,
  zPresentQuestionDetails,
  zPresentReviewSetDetails,
} from "../extensions/structured-exchange/schemas/present.js"
import {
  zCaptureDetailsHeader,
  zCaptureToolMeta,
  zGraphNodeRef,
  zMarkdown,
  zPresentDetailsHeader,
  zPresentToolMeta,
  zRequestDetailsHeader,
  zRequestToolMeta,
} from "../extensions/structured-exchange/schemas/shared.js"

function expectJsonSchemaExport(schema: z.ZodType) {
  expect(() =>
    z.toJSONSchema(schema, { unrepresentable: "throw" }),
  ).not.toThrow()
}

describe("structured exchange shared schemas", () => {
  it("parses checked details headers and rejects unsupported versions", () => {
    expect(
      zPresentDetailsHeader.parse({
        schema: "brunch.structured_exchange.present",
        v: 1,
        exchange_id: "problem-frame",
      }),
    ).toMatchObject({ exchange_id: "problem-frame" })

    expect(() =>
      zPresentDetailsHeader.parse({
        schema: "brunch.structured_exchange.present",
        v: 2,
        exchange_id: "problem-frame",
      }),
    ).toThrow()
    expect(() =>
      zRequestDetailsHeader.parse({
        schema: "brunch.structured_exchange.request",
        v: 2,
        exchange_id: "problem-frame",
      }),
    ).toThrow()
    expect(() =>
      zCaptureDetailsHeader.parse({
        schema: "brunch.structured_exchange.capture",
        v: 2,
        exchange_id: "problem-frame",
      }),
    ).toThrow()
  })

  it("parses shared markdown, graph refs, and tool sequencing metadata", () => {
    expect(zMarkdown.parse("**markdown**")).toBe("**markdown**")
    expect(zGraphNodeRef.parse({ node_id: "node-1" })).toEqual({
      node_id: "node-1",
    })

    expect(
      zPresentToolMeta.parse({
        curr: "present_options",
        next: "request_choices",
      }),
    ).toEqual({ curr: "present_options", next: "request_choices" })
    expect(
      zRequestToolMeta.parse({
        prev: "present_candidates",
        curr: "request_choice",
        next: "capture_candidate",
      }),
    ).toEqual({
      prev: "present_candidates",
      curr: "request_choice",
      next: "capture_candidate",
    })
    expect(
      zCaptureToolMeta.parse({
        prev: "request_choice",
        curr: "capture_candidate",
      }),
    ).toEqual({ prev: "request_choice", curr: "capture_candidate" })
  })

  it("exports representative shared schemas to JSON Schema", () => {
    expectJsonSchemaExport(zPresentDetailsHeader)
    expectJsonSchemaExport(zRequestDetailsHeader)
    expectJsonSchemaExport(zCaptureDetailsHeader)
    expectJsonSchemaExport(zGraphNodeRef)
    expectJsonSchemaExport(zPresentToolMeta)
    expectJsonSchemaExport(zRequestToolMeta)
    expectJsonSchemaExport(zCaptureToolMeta)
  })
})

describe("structured exchange present schemas", () => {
  const candidateDetails = {
    schema: "brunch.structured_exchange.present",
    v: 1,
    exchange_id: "candidate-direction",
    tool_meta: { curr: "present_candidates", next: "request_choice" },
    display: {
      heading: "Which direction should we take?",
      body: "Pick one candidate.",
    },
    candidates: [
      {
        id: "candidate-local-workbench",
        title: "Local workbench for graph-native specs",
        user_rubric: {
          core_bet: "Make local graph work the thesis.",
          best_fit: "Keeps the POC focused.",
          cost_complexity: "Requires owning local state clearly.",
          covers_well: "Covers chrome, transcript, and graph coherence.",
          main_risks: "Does not solve cloud collaboration.",
          lock_in_constraints: "Commits to local-first semantics.",
          recommendation: "Choose this for the POC.",
        },
        meta_rubric: {
          legibility_cost_of_knowing: "Easy to inspect locally.",
          failure_modes: "May under-test multi-user cases.",
          coverage_range: "Strong for current assumptions.",
          commitment: "Defers cloud concerns.",
        },
        graph_refs: [{ node_id: "node-1" }],
      },
    ],
  }

  it("parses conservative present variants and exact candidate details", () => {
    expect(
      zPresentQuestionDetails.parse({
        schema: "brunch.structured_exchange.present",
        v: 1,
        exchange_id: "problem-frame",
        tool_meta: { curr: "present_question", next: "request_answer" },
        display: {
          heading: "What problem are we solving first?",
          body: "Name the pain.",
          preface: "We need the user-facing pull.",
        },
      }),
    ).toMatchObject({ tool_meta: { curr: "present_question" } })

    expect(
      zPresentOptionsDetails.parse({
        schema: "brunch.structured_exchange.present",
        v: 1,
        exchange_id: "domain-shape",
        tool_meta: { curr: "present_options", next: "request_choices" },
        display: { heading: "Which risks should stay visible?" },
        options: [
          {
            id: "transport",
            content: "Transport contract",
            rationale: "Public RPC is a product seam.",
          },
        ],
      }),
    ).toMatchObject({ tool_meta: { next: "request_choices" } })

    expect(
      zPresentReviewSetDetails.parse({
        schema: "brunch.structured_exchange.present",
        v: 1,
        exchange_id: "review-set-17",
        tool_meta: { curr: "present_review_set", next: "request_review" },
        display: { heading: "Review proposed requirements" },
        review_set: { proposal_entry_id: "entry-review-proposal-17" },
      }),
    ).toMatchObject({
      review_set: { proposal_entry_id: "entry-review-proposal-17" },
    })

    expect(zPresentCandidatesDetails.parse(candidateDetails)).toMatchObject({
      candidates: [{ graph_refs: [{ node_id: "node-1" }] }],
    })
    expect(zPresentDetails.parse(candidateDetails)).toMatchObject({
      tool_meta: { curr: "present_candidates" },
    })
  })

  it("rejects candidate graph refs and rubric drift fields", () => {
    expect(() =>
      zPresentCandidatesDetails.parse({
        ...candidateDetails,
        candidates: [
          {
            ...candidateDetails.candidates[0],
            graph_refs: [{ node_id: "node-1", role: "supporting" }],
          },
        ],
      }),
    ).toThrow()

    expect(() =>
      zPresentCandidatesDetails.parse({
        ...candidateDetails,
        candidates: [
          {
            ...candidateDetails.candidates[0],
            user_rubric: {
              ...candidateDetails.candidates[0].user_rubric,
              confidence: "high",
            },
          },
        ],
      }),
    ).toThrow()
  })

  it("rejects retired present-side control fields", () => {
    for (const field of [
      "phase",
      "status",
      "next_required",
      "schema_version",
    ] as const) {
      expect(() =>
        zPresentCandidatesDetails.parse({
          ...candidateDetails,
          [field]: field === "status" ? "presented" : true,
        }),
      ).toThrow()
    }
  })

  it("exports present schemas to JSON Schema", () => {
    expectJsonSchemaExport(zPresentQuestionDetails)
    expectJsonSchemaExport(zPresentOptionsDetails)
    expectJsonSchemaExport(zPresentReviewSetDetails)
    expectJsonSchemaExport(zPresentCandidatesDetails)
    expectJsonSchemaExport(zPresentDetails)
  })
})
