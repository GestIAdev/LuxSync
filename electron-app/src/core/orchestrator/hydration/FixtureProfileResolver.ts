/**
 * WAVE 4960.1 PHASE 5b — FixtureProfileResolver
 * Extracted from TitanOrchestrator.ts (~lines 2976-3239).
 *
 * Stateless normalization helpers for fixture definitions, channels, types, and zones.
 * Used by FixtureHydrationEngine during Aether sync.
 */

import { resolveRuntimeFixtureDefinition } from '../../library/RuntimeFixtureLibrary'
import type { FixtureDefinition, FixtureChannel, FixtureType } from '../../../types/FixtureDefinition'
import type { FixtureV2 } from '../../stage/ShowFileV2'

export class FixtureProfileResolver {
  // ── Definition resolution ────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolveFixtureDefinitionForAether(fixture: any): FixtureDefinition | null {
    const profileId = this.resolveFixtureProfileId(fixture)
    const runtimeDefinition = resolveRuntimeFixtureDefinition([
      profileId,
      fixture.profileId,
      fixture.definitionId,
      fixture.fixtureDefId,
      fixture.definitionPath,
      fixture.model,
      fixture.name,
    ])

    if (runtimeDefinition) {
      return this.normalizeFixtureDefinitionForAether(runtimeDefinition, fixture, profileId)
    }

    if (Array.isArray(fixture.channels) && fixture.channels.length > 0) {
      return this.normalizeFixtureDefinitionForAether({
        id: profileId ?? fixture.id,
        name: fixture.name ?? fixture.id ?? 'Unknown Fixture',
        manufacturer: fixture.manufacturer ?? 'Unknown',
        type: this.normalizeFixtureType(fixture.type),
        channels: fixture.channels,
        physics: fixture.physics,
        capabilities: fixture.capabilities,
        wheels: fixture.wheels,
      } as FixtureDefinition, fixture, profileId)
    }

    return null
  }

  // ── Definition normalization ─────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  normalizeFixtureDefinitionForAether(
    definition: FixtureDefinition,
    fixture: any,
    profileId: string | null,
  ): FixtureDefinition {
    const rawChannelsOriginal = Array.isArray(definition.channels) && definition.channels.length > 0
      ? definition.channels
      : Array.isArray(fixture.channels) ? fixture.channels : []

    const hasZeroBased = rawChannelsOriginal.some((ch: any) => ch && ch.index === 0)
    const rawChannels = hasZeroBased
      ? rawChannelsOriginal.map((ch: any) => ch ? { ...ch, index: ch.index + 1 } : ch)
      : rawChannelsOriginal
    // Migration log silenced — fires on every setFixtures call

    const hasNodeGraph = !!(definition as any).nodeGraph || !!(fixture as any).forgeGraph || !!(fixture as any).nodeGraph
    if (hasNodeGraph) {
      return {
        ...definition,
        id: profileId ?? definition.id ?? fixture.id,
        name: definition.name ?? fixture.name ?? profileId ?? fixture.id ?? 'Unknown Fixture',
        manufacturer: definition.manufacturer ?? fixture.manufacturer ?? 'Unknown',
        type: this.normalizeFixtureType(definition.type ?? fixture.type),
        channels: rawChannels as FixtureChannel[],
        physics: definition.physics ?? fixture.physics,
        capabilities: definition.capabilities ?? fixture.capabilities,
        wheels: definition.wheels ?? fixture.wheels,
        nodeGraph: (definition as any).nodeGraph,
      } as FixtureDefinition
    }

    const channels: FixtureChannel[] = rawChannels
      .filter((channel: any) => channel)
      .map((channel: any, idx: number) => {
        const type = this.normalizeFixtureChannelType(channel.type, channel.name ?? channel.customName)
        return {
          index: this.normalizeFixtureChannelIndex(channel.index, idx + 1),
          name: channel.name ?? channel.customName ?? type,
          type,
          defaultValue: this.resolveAetherChannelDefaultValue(type, channel.defaultValue),
          is16bit: channel.is16bit === true,
          ...(channel.customName ? { customName: channel.customName } : {}),
          ...(channel.continuousRotation === true ? { continuousRotation: true } : {}),
        }
      })

    const indexSet = new Set(channels.map(ch => ch.index))
    const hasDuplicateIndices = indexSet.size < channels.length
    if (hasDuplicateIndices) {
      console.warn(
        `[FixtureProfileResolver] ⚠️ WAVE 4674: fixture "${fixture.id ?? profileId}" tiene índices de canal duplicados ` +
        `(${channels.map(c => c.index).join(',')}) — reasignando posicionalmente (1-based) para evitar colisión DMX.`,
      )
    }
    const finalChannels = hasDuplicateIndices
      ? channels.map((ch, i) => ({ ...ch, index: i + 1 }))
      : channels

    return {
      ...definition,
      id: profileId ?? definition.id ?? fixture.id,
      name: definition.name ?? fixture.name ?? profileId ?? fixture.id ?? 'Unknown Fixture',
      manufacturer: definition.manufacturer ?? fixture.manufacturer ?? 'Unknown',
      type: this.normalizeFixtureType(definition.type ?? fixture.type),
      channels: finalChannels,
      physics: definition.physics ?? fixture.physics,
      capabilities: definition.capabilities ?? fixture.capabilities,
      wheels: definition.wheels ?? fixture.wheels,
    }
  }

  // ── FixtureV2 builder ────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildFixtureV2ForAether(fixture: any, definition: FixtureDefinition): FixtureV2 {
    const profileId = this.resolveFixtureProfileId(fixture) ?? definition.id
    return {
      id: fixture.id,
      name: fixture.name ?? definition.name ?? fixture.id,
      model: fixture.model ?? definition.name ?? fixture.name ?? fixture.id,
      manufacturer: fixture.manufacturer ?? definition.manufacturer ?? 'Unknown',
      type: this.normalizeFixtureType(fixture.type ?? definition.type),
      address: fixture.dmxAddress ?? fixture.address ?? 1,
      universe: fixture.universe ?? 0,
      channelCount: definition.channels.length,
      profileId,
      position: fixture.position ?? { x: 0, y: 0, z: 0 },
      rotation: fixture.rotation ?? { x: 0, y: 0, z: 0 },
      orientation: fixture.orientation ?? fixture.installationType ?? 'ceiling',
      isPlaced: fixture.isPlaced ?? false,
      physics: fixture.physics ?? {
        motorType: 'stepper',
        maxAcceleration: 0,
        safetyCap: false,
      },
      zone: this.normalizeAetherZone(fixture.zone),
      definitionPath: fixture.definitionPath,
      enabled: fixture.enabled ?? true,
      isVirtual: fixture.isVirtual ?? false,
      channels: definition.channels,
      capabilities: fixture.capabilities ?? definition.capabilities,
      calibration: fixture.calibration,
    } as FixtureV2
  }

  // ── Profile ID ───────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolveFixtureProfileId(fixture: any): string | null {
    const rawProfileId = fixture.profileId || fixture.definitionId || fixture.fixtureDefId || fixture.id
    return typeof rawProfileId === 'string' && rawProfileId.length > 0 ? rawProfileId : null
  }

  // ── Channel normalization ────────────────────────────────────────────────

  normalizeFixtureChannelIndex(rawIndex: unknown, fallback: number): number {
    if (typeof rawIndex === 'number' && Number.isFinite(rawIndex)) {
      return rawIndex > 0 ? Math.trunc(rawIndex) : fallback
    }

    if (typeof rawIndex === 'string') {
      const parsed = Number.parseInt(rawIndex, 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed
      }
    }

    return fallback
  }

  normalizeFixtureChannelType(type: unknown, name?: unknown): FixtureChannel['type'] {
    const normalized = typeof type === 'string' ? type.toLowerCase() : this.inferFixtureChannelTypeFromName(name)
    switch (normalized) {
      case 'dimmer':
      case 'strobe':
      case 'shutter':
      case 'red':
      case 'green':
      case 'blue':
      case 'white':
      case 'amber':
      case 'uv':
      case 'cyan':
      case 'magenta':
      case 'yellow':
      case 'color_wheel':
      case 'pan':
      case 'pan_fine':
      case 'tilt':
      case 'tilt_fine':
      case 'gobo':
      case 'gobo_rotation':
      case 'prism':
      case 'prism_rotation':
      case 'focus':
      case 'zoom':
      case 'frost':
      case 'speed':
      case 'macro':
      case 'control':
      case 'rotation':
      case 'custom':
        return normalized
      default:
        return 'unknown'
    }
  }

  inferFixtureChannelTypeFromName(name: unknown): string {
    if (typeof name !== 'string') return 'unknown'
    const normalizedName = name.toLowerCase()
    if (normalizedName.includes('dimmer') || normalizedName.includes('intensity')) return 'dimmer'
    if (normalizedName.includes('shutter')) return 'shutter'
    if (normalizedName.includes('strobe')) return 'strobe'
    if (normalizedName.includes('pan')) return 'pan'
    if (normalizedName.includes('tilt')) return 'tilt'
    if (normalizedName === 'red' || normalizedName.includes(' red')) return 'red'
    if (normalizedName === 'green' || normalizedName.includes(' green')) return 'green'
    if (normalizedName === 'blue' || normalizedName.includes(' blue')) return 'blue'
    if (normalizedName === 'white' || normalizedName.includes(' white')) return 'white'
    return 'unknown'
  }

  resolveAetherChannelDefaultValue(type: FixtureChannel['type'], value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value < 0) return 0
      if (value > 255) return 255
      return Math.round(value)
    }

    if (type === 'pan' || type === 'tilt') return 128
    if (type === 'shutter' || type === 'strobe') return 255
    return 0
  }

  // ── Type normalization ───────────────────────────────────────────────────

  normalizeFixtureType(type: unknown): FixtureType {
    switch (typeof type === 'string' ? type.toLowerCase() : 'generic') {
      case 'moving-head':
      case 'scanner':
      case 'par':
      case 'bar':
      case 'wash':
      case 'strobe':
      case 'effect':
      case 'laser':
      case 'blinder':
      case 'fan':
      case 'fog':
      case 'mirror-ball':
      case 'pyro':
      case 'generic':
        return (typeof type === 'string' ? type.toLowerCase() : 'generic') as FixtureType
      case 'spot':
        return 'moving-head'
      default:
        return 'generic'
    }
  }

  // ── Zone normalization ───────────────────────────────────────────────────

  normalizeAetherZone(zone: unknown): string {
    if (typeof zone !== 'string' || zone.length === 0) return 'unassigned'
    return zone
  }
}
