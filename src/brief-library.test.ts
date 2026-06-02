import { describe, expect, it } from "vitest"

import { loadBriefLibrary } from "./brief-library.js"

describe("fixture brief library", () => {
  it("loads the first three deterministic product briefs", async () => {
    const briefs = await loadBriefLibrary(".brunch-fixtures/briefs")

    expect(briefs.map((brief) => brief.id)).toEqual([
      "brief-001",
      "brief-002",
      "brief-003",
    ])
    expect(briefs).toEqual(
      Array.from({ length: 3 }, () =>
        expect.objectContaining({
          schemaVersion: 1,
          title: expect.any(String),
          kernelTags: expect.arrayContaining([expect.any(String)]),
          productBrief: expect.stringMatching(/\w/u),
          expectedStructuralObservations: expect.arrayContaining([
            expect.any(String),
          ]),
          scriptedUserNotes: expect.arrayContaining([expect.any(String)]),
        }),
      ),
    )
    expect(briefs[0]?.productBrief).not.toContain("assert")
  })
})
