import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

export interface FixtureBrief {
  schemaVersion: 1
  id: string
  title: string
  kernelTags: string[]
  productBrief: string
  expectedStructuralObservations: string[]
  scriptedUserNotes: string[]
  deferredExpectations?: {
    graph?: string
    coherence?: string
  }
}

export async function loadBriefLibrary(dir: string): Promise<FixtureBrief[]> {
  const files = (await readdir(dir))
    .filter((file) => file.endsWith(".json"))
    .sort()
  const briefs = await Promise.all(
    files.map(async (file) =>
      parseBrief(await readFile(join(dir, file), "utf8"), file),
    ),
  )
  return briefs.sort((left, right) => left.id.localeCompare(right.id))
}

function parseBrief(content: string, source: string): FixtureBrief {
  const parsed = JSON.parse(content) as unknown
  if (!isFixtureBrief(parsed)) {
    throw new Error(`${source} is not a valid fixture brief`)
  }
  return parsed
}

function isFixtureBrief(value: unknown): value is FixtureBrief {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const brief = value as Partial<FixtureBrief>
  return (
    brief.schemaVersion === 1 &&
    typeof brief.id === "string" &&
    /^brief-\d{3}$/u.test(brief.id) &&
    typeof brief.title === "string" &&
    brief.title.length > 0 &&
    isNonEmptyStringArray(brief.kernelTags) &&
    typeof brief.productBrief === "string" &&
    brief.productBrief.length > 0 &&
    isNonEmptyStringArray(brief.expectedStructuralObservations) &&
    isNonEmptyStringArray(brief.scriptedUserNotes)
  )
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.length > 0)
  )
}
