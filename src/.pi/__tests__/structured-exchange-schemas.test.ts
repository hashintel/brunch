import { describe, expect, it } from "vitest"
import * as z from "zod"

import {
  zCaptureAnswerDetails,
  zCaptureCandidateDetails,
  zCaptureChoiceDetails,
  zCaptureChoicesDetails,
  zCaptureDetails,
  zCaptureDetailsHeader,
  zCaptureReviewDetails,
  zCaptureToolMeta,
  zGraphNodeRef,
  zMarkdown,
  zPresentCandidatesDetails,
  zPresentDetails,
  zPresentDetailsHeader,
  zPresentOptionsDetails,
  zPresentQuestionDetails,
  zPresentReviewSetDetails,
  zPresentToolMeta,
  zRequestAnswerDetails,
  zRequestChoiceDetails,
  zRequestChoicesDetails,
  zRequestDetails,
  zRequestDetailsHeader,
  zRequestReviewDetails,
  zRequestToolMeta,
} from "../extensions/structured-exchange/schemas/index.js"

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

describe("structured exchange request schemas", () => {
  const answerBase = {
    schema: "brunch.structured_exchange.request",
    v: 1,
    exchange_id: "problem-frame",
    tool_meta: {
      prev: "present_question",
      curr: "request_answer",
      next: "capture_answer",
    },
  }

  it("parses answered, cancelled, and unavailable outcomes", () => {
    expect(
      zRequestAnswerDetails.parse({
        ...answerBase,
        answered: {
          text: "The hard part is coherence across sessions.",
        },
      }),
    ).toMatchObject({
      answered: { text: "The hard part is coherence across sessions." },
    })

    expect(
      zRequestAnswerDetails.parse({
        schema: "brunch.structured_exchange.request",
        v: 1,
        exchange_id: "problem-frame",
        tool_meta: { prev: "present_question", curr: "request_answer" },
        cancelled: { message: "User cancelled." },
      }),
    ).toMatchObject({ cancelled: { message: "User cancelled." } })

    expect(
      zRequestAnswerDetails.parse({
        schema: "brunch.structured_exchange.request",
        v: 1,
        exchange_id: "problem-frame",
        tool_meta: { prev: "present_question", curr: "request_answer" },
        unavailable: { message: "request_answer requires interactive UI." },
      }),
    ).toMatchObject({
      unavailable: { message: "request_answer requires interactive UI." },
    })
  })

  it("rejects missing or multiple terminal outcomes", () => {
    expect(() => zRequestAnswerDetails.parse(answerBase)).toThrow()
    expect(() =>
      zRequestAnswerDetails.parse({
        ...answerBase,
        answered: { text: "Yes." },
        cancelled: { message: "User cancelled." },
      }),
    ).toThrow()
  })

  it("keeps comment on answered payloads and message on terminal runtime payloads", () => {
    expect(
      zRequestChoiceDetails.parse({
        schema: "brunch.structured_exchange.request",
        v: 1,
        exchange_id: "domain-shape",
        tool_meta: {
          prev: "present_options",
          curr: "request_choice",
          next: "capture_choice",
        },
        answered: {
          choice: {
            id: "local-first",
            label: "Local-first app",
            kind: "listed",
          },
          comment: "This fits the POC constraints.",
        },
      }),
    ).toMatchObject({ answered: { comment: "This fits the POC constraints." } })

    expect(() =>
      zRequestChoiceDetails.parse({
        schema: "brunch.structured_exchange.request",
        v: 1,
        exchange_id: "domain-shape",
        tool_meta: { prev: "present_options", curr: "request_choice" },
        cancelled: { message: "User cancelled." },
        comment: "human text in the wrong place",
      }),
    ).toThrow()

    expect(() =>
      zRequestChoiceDetails.parse({
        schema: "brunch.structured_exchange.request",
        v: 1,
        exchange_id: "domain-shape",
        tool_meta: { prev: "present_options", curr: "request_choice" },
        answered: {
          choice: {
            id: "local-first",
            label: "Local-first app",
            kind: "listed",
          },
          message: "runtime text in the wrong place",
        },
      }),
    ).toThrow()
  })

  it("supports candidate choices and requires comments for other or none choices", () => {
    expect(
      zRequestChoiceDetails.parse({
        schema: "brunch.structured_exchange.request",
        v: 1,
        exchange_id: "candidate-direction",
        tool_meta: {
          prev: "present_candidates",
          curr: "request_choice",
          next: "capture_candidate",
        },
        answered: {
          choice: {
            id: "candidate-local-workbench",
            label: "Local workbench for graph-native specs",
            kind: "listed",
          },
        },
      }),
    ).toMatchObject({ tool_meta: { prev: "present_candidates" } })

    expect(() =>
      zRequestChoiceDetails.parse({
        schema: "brunch.structured_exchange.request",
        v: 1,
        exchange_id: "domain-shape",
        tool_meta: { prev: "present_options", curr: "request_choice" },
        answered: {
          choice: { id: "none", label: "None of these", kind: "none" },
        },
      }),
    ).toThrow()
  })

  it("parses multiple choices and requires comments for other or none selections", () => {
    expect(
      zRequestChoicesDetails.parse({
        schema: "brunch.structured_exchange.request",
        v: 1,
        exchange_id: "open-risks",
        tool_meta: {
          prev: "present_options",
          curr: "request_choices",
          next: "capture_choices",
        },
        answered: {
          choices: [
            { id: "transport", label: "Transport contract", kind: "listed" },
            {
              id: "other",
              label: "Schema source-of-truth drift",
              kind: "other",
            },
          ],
          comment: "Keep schema drift visible.",
        },
      }),
    ).toMatchObject({
      answered: { choices: [{ id: "transport" }, { id: "other" }] },
    })

    expect(() =>
      zRequestChoicesDetails.parse({
        schema: "brunch.structured_exchange.request",
        v: 1,
        exchange_id: "open-risks",
        tool_meta: { prev: "present_options", curr: "request_choices" },
        answered: {
          choices: [{ id: "none", label: "None of these", kind: "none" }],
        },
      }),
    ).toThrow()
  })

  it("requires a comment for request_changes review decisions", () => {
    expect(
      zRequestReviewDetails.parse({
        schema: "brunch.structured_exchange.request",
        v: 1,
        exchange_id: "review-set-17",
        tool_meta: {
          prev: "present_review_set",
          curr: "request_review",
          next: "capture_review",
        },
        answered: {
          decision: "approve",
          comment: "This is ready to commit.",
        },
      }),
    ).toMatchObject({ answered: { decision: "approve" } })

    expect(() =>
      zRequestReviewDetails.parse({
        schema: "brunch.structured_exchange.request",
        v: 1,
        exchange_id: "review-set-17",
        tool_meta: { prev: "present_review_set", curr: "request_review" },
        answered: { decision: "request_changes" },
      }),
    ).toThrow()
  })

  it("exports request schemas to JSON Schema", () => {
    expectJsonSchemaExport(zRequestAnswerDetails)
    expectJsonSchemaExport(zRequestChoiceDetails)
    expectJsonSchemaExport(zRequestChoicesDetails)
    expectJsonSchemaExport(zRequestReviewDetails)
    expectJsonSchemaExport(zRequestDetails)
  })
})

describe("structured exchange capture schemas", () => {
  it("parses the agreed minimal capture variants", () => {
    expect(
      zCaptureAnswerDetails.parse({
        schema: "brunch.structured_exchange.capture",
        v: 1,
        exchange_id: "problem-frame",
        tool_meta: { prev: "request_answer", curr: "capture_answer" },
      }),
    ).toMatchObject({ tool_meta: { curr: "capture_answer" } })

    expect(
      zCaptureChoiceDetails.parse({
        schema: "brunch.structured_exchange.capture",
        v: 1,
        exchange_id: "domain-shape",
        tool_meta: { prev: "request_choice", curr: "capture_choice" },
      }),
    ).toMatchObject({ tool_meta: { curr: "capture_choice" } })

    expect(
      zCaptureChoicesDetails.parse({
        schema: "brunch.structured_exchange.capture",
        v: 1,
        exchange_id: "open-risks",
        tool_meta: { prev: "request_choices", curr: "capture_choices" },
      }),
    ).toMatchObject({ tool_meta: { curr: "capture_choices" } })

    expect(
      zCaptureReviewDetails.parse({
        schema: "brunch.structured_exchange.capture",
        v: 1,
        exchange_id: "review-set-17",
        tool_meta: { prev: "request_review", curr: "capture_review" },
      }),
    ).toMatchObject({ tool_meta: { curr: "capture_review" } })

    expect(
      zCaptureCandidateDetails.parse({
        schema: "brunch.structured_exchange.capture",
        v: 1,
        exchange_id: "candidate-direction",
        tool_meta: { prev: "request_choice", curr: "capture_candidate" },
      }),
    ).toMatchObject({ tool_meta: { curr: "capture_candidate" } })
  })

  it("rejects graph payloads and analysis/provenance fields", () => {
    for (const field of [
      "committed_graph_nodes",
      "graph_edges",
      "lsn",
      "command_result",
      "assumptions",
      "caveats",
      "observations",
      "selected_candidate_id",
    ] as const) {
      expect(() =>
        zCaptureCandidateDetails.parse({
          schema: "brunch.structured_exchange.capture",
          v: 1,
          exchange_id: "candidate-direction",
          tool_meta: { prev: "request_choice", curr: "capture_candidate" },
          [field]: field,
        }),
      ).toThrow()
    }
  })

  it("exports capture schemas to JSON Schema", () => {
    expectJsonSchemaExport(zCaptureAnswerDetails)
    expectJsonSchemaExport(zCaptureChoiceDetails)
    expectJsonSchemaExport(zCaptureChoicesDetails)
    expectJsonSchemaExport(zCaptureReviewDetails)
    expectJsonSchemaExport(zCaptureCandidateDetails)
    expectJsonSchemaExport(zCaptureDetails)
  })
})
