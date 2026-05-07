import type { FixtureDefinition } from '../../types/FixtureDefinition'

export type RuntimeFixtureDefinition = FixtureDefinition & {
  channelCount?: number
  filePath?: string
}

const runtimeFixtureLibrary = new Map<string, RuntimeFixtureDefinition>()

export function setRuntimeFixtureLibrary(definitions: readonly RuntimeFixtureDefinition[]): void {
  runtimeFixtureLibrary.clear()
  for (const definition of definitions) {
    if (!definition?.id) continue
    runtimeFixtureLibrary.set(definition.id, definition)
  }
}

export function upsertRuntimeFixtureDefinition(definition: RuntimeFixtureDefinition): void {
  if (!definition?.id) return
  runtimeFixtureLibrary.set(definition.id, definition)
}

export function getRuntimeFixtureDefinition(profileId: string): RuntimeFixtureDefinition | undefined {
  return runtimeFixtureLibrary.get(profileId)
}
