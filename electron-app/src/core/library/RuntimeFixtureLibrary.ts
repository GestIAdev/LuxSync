import type { FixtureDefinition } from '../../types/FixtureDefinition'

export type RuntimeFixtureDefinition = FixtureDefinition & {
  channelCount?: number
  filePath?: string
}

const runtimeFixtureLibrary = new Map<string, RuntimeFixtureDefinition>()
const runtimeFixtureLibraryNormalized = new Map<string, RuntimeFixtureDefinition>()

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase()
}

function extractBasename(value: string): string {
  const parts = value.split(/[\\/]/)
  return parts[parts.length - 1] || value
}

function stripExtension(value: string): string {
  const idx = value.lastIndexOf('.')
  return idx > 0 ? value.slice(0, idx) : value
}

function buildCandidateKeys(value: string): string[] {
  const normalized = normalizeLookupKey(value)
  const basename = normalizeLookupKey(extractBasename(value))
  const stem = normalizeLookupKey(stripExtension(basename))
  return [normalized, basename, stem]
}

function indexDefinition(definition: RuntimeFixtureDefinition): void {
  runtimeFixtureLibrary.set(definition.id, definition)
  for (const key of buildCandidateKeys(definition.id)) {
    runtimeFixtureLibraryNormalized.set(key, definition)
  }
}

export function setRuntimeFixtureLibrary(definitions: readonly RuntimeFixtureDefinition[]): void {
  runtimeFixtureLibrary.clear()
  runtimeFixtureLibraryNormalized.clear()
  for (const definition of definitions) {
    if (!definition?.id) continue
    indexDefinition(definition)
  }
}

export function upsertRuntimeFixtureDefinition(definition: RuntimeFixtureDefinition): void {
  if (!definition?.id) return
  indexDefinition(definition)
}

export function getRuntimeFixtureDefinition(profileId: string): RuntimeFixtureDefinition | undefined {
  return resolveRuntimeFixtureDefinition([profileId])
}

export function resolveRuntimeFixtureDefinition(
  candidates: readonly (string | null | undefined)[],
): RuntimeFixtureDefinition | undefined {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string') continue
    const direct = runtimeFixtureLibrary.get(candidate)
    if (direct) return direct

    for (const key of buildCandidateKeys(candidate)) {
      const normalized = runtimeFixtureLibraryNormalized.get(key)
      if (normalized) return normalized
    }
  }
  return undefined
}
