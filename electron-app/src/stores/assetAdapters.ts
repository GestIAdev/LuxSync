/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔄 ASSET ADAPTERS — WAVE 4549.1
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Convierte tipos concretos (FixtureDefinition, IIngenioDefinition)
 * al DTO unificado LibraryAsset para el Universal Asset Browser.
 *
 * @module stores/assetAdapters
 * @version WAVE 4549.1
 */

import type { FixtureDefinition, FixtureChannel } from '../types/FixtureDefinition'
import type { IIngenioDefinition, IngenioCategory } from '../core/forge/ingenio/types'

// ═══════════════════════════════════════════════════════════════════════════
// SHARED TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Tipos de asset que el browser puede mostrar */
export type AssetType = 'fixture' | 'ingenio'

/** Fuente del asset */
export type AssetSource = 'system' | 'user'

/**
 * Representación unificada de un asset en la librería.
 * Abstrae las diferencias entre FixtureDefinition e IIngenioDefinition.
 */
export interface LibraryAsset {
  /** ID único del asset */
  readonly id: string
  /** Tipo de asset */
  readonly type: AssetType
  /** Fuente (system = read-only, user = writable) */
  readonly source: AssetSource
  /** Nombre legible */
  readonly name: string
  /** Fabricante (fixtures) o Autor (ingenios) */
  readonly creator: string
  /** Subtipo para display (e.g. "moving-head", "modulation") */
  readonly subtype: string
  /** Tags para filtrado */
  readonly tags: readonly string[]
  /** Resumen corto para la card */
  readonly summary: string
  /** Icono (emoji o lucide icon name) */
  readonly icon: string
  /** Color de acento */
  readonly accentColor: string
  /** Ruta en disco (para operaciones IPC) */
  readonly filePath?: string
  /** Número de canales (fixtures) o nodos internos (ingenios) */
  readonly itemCount: number
  /** Fecha de última modificación */
  readonly updatedAt: number
  /** ¿Es favorito? (persisted via localStorage) */
  readonly isFavorite: boolean
  /** Referencia al objeto original completo */
  readonly _raw: FixtureDefinition | IIngenioDefinition
}

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE → ASSET ADAPTER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deriva tags automáticamente desde los canales del fixture.
 * Analiza channel types y genera tags útiles para filtrado/búsqueda.
 */
export function deriveFixtureTags(fixture: FixtureDefinition): string[] {
  const tags: string[] = []
  const channels: FixtureChannel[] = fixture.channels || []
  const types = new Set(channels.map(ch => ch.type))

  // Tipo del fixture
  if (fixture.type) tags.push(fixture.type)

  // Capacidades de posición
  if (types.has('pan') || types.has('tilt')) tags.push('moving')

  // Capacidades de color
  if (types.has('red') && types.has('green') && types.has('blue')) tags.push('rgb')
  if (types.has('cyan') && types.has('magenta') && types.has('yellow')) tags.push('cmy')
  if (types.has('white')) tags.push('white')
  if (types.has('amber')) tags.push('amber')
  if (types.has('uv')) tags.push('uv')
  if (types.has('color_wheel')) tags.push('wheel')

  // Capacidades ópticas
  if (types.has('gobo')) tags.push('gobo')
  if (types.has('prism')) tags.push('prism')
  if (types.has('zoom')) tags.push('zoom')
  if (types.has('focus')) tags.push('focus')
  if (types.has('frost')) tags.push('frost')

  // Strobe/Shutter
  if (types.has('strobe') || types.has('shutter')) tags.push('strobe')

  // Dimmer
  if (types.has('dimmer')) tags.push('dimmer')

  // 16-bit
  if (channels.some(ch => ch.is16bit || ch.type === 'pan_fine' || ch.type === 'tilt_fine')) {
    tags.push('16bit')
  }

  // Rango de canales
  if (channels.length <= 4) tags.push('compact')
  if (channels.length >= 16) tags.push('extended')

  // WAVE 2084: Ingenios capabilities
  if (types.has('rotation') || channels.some(ch => ch.continuousRotation === true)) {
    tags.push('rotation')
  }
  if (types.has('custom')) tags.push('custom')
  if (types.has('macro')) tags.push('macro')

  return tags
}

/**
 * Genera un resumen corto del fixture para mostrar en la tarjeta.
 */
function getFixtureSummary(fixture: FixtureDefinition): string {
  const channels = fixture.channels || []
  const types = new Set(channels.map(ch => ch.type))

  const parts: string[] = []

  const hasPan = types.has('pan') || types.has('pan_fine')
  const hasTilt = types.has('tilt') || types.has('tilt_fine')
  if (hasPan && hasTilt) parts.push('P/T')

  if (types.has('red') && types.has('green') && types.has('blue')) {
    parts.push(types.has('white') ? 'RGBW' : 'RGB')
  } else if (types.has('cyan') && types.has('magenta') && types.has('yellow')) {
    parts.push('CMY')
  }

  if (types.has('color_wheel')) parts.push('Wheel')
  if (types.has('dimmer')) parts.push('Dim')
  if (types.has('gobo')) parts.push('Gobo')
  if (types.has('strobe') || types.has('shutter')) parts.push('Strb')
  if (types.has('zoom')) parts.push('Zoom')
  if (types.has('prism')) parts.push('Prism')

  return parts.length > 0
    ? `${channels.length}ch • ${parts.join(' • ')}`
    : `${channels.length}ch`
}

/**
 * Mapea un tipo de fixture a un emoji representativo.
 */
function getFixtureTypeEmoji(type: string): string {
  const t = (type || '').toLowerCase()
  if (t.includes('moving') || t.includes('beam') || t.includes('spot')) return '🔦'
  if (t.includes('wash') || t.includes('par')) return '💡'
  if (t.includes('bar')) return '📏'
  if (t.includes('strobe') || t.includes('blinder')) return '⚡'
  if (t.includes('laser')) return '🔴'
  if (t.includes('fan')) return '🌀'
  if (t.includes('fog') || t.includes('haze')) return '🌫️'
  if (t.includes('mirror')) return '🪩'
  if (t.includes('scanner')) return '📡'
  if (t.includes('effect')) return '✨'
  return '💡'
}

/**
 * Mapea un tipo de fixture a un color de acento.
 */
function getFixtureTypeColor(type: string): string {
  const t = (type || '').toLowerCase()
  if (t.includes('moving') || t.includes('beam') || t.includes('spot')) return '#00f3ff'
  if (t.includes('wash') || t.includes('par')) return '#39ff14'
  if (t.includes('strobe') || t.includes('blinder')) return '#ffb800'
  if (t.includes('laser')) return '#ff2d55'
  if (t.includes('effect')) return '#bf5af2'
  return '#71717a'
}

/**
 * Convierte un fixture + source a un LibraryAsset unificado.
 */
export function fixtureToAsset(
  fixture: FixtureDefinition,
  source: AssetSource,
  filePath?: string,
  isFavorite: boolean = false,
): LibraryAsset {
  return {
    id: fixture.id,
    type: 'fixture',
    source,
    name: fixture.name,
    creator: fixture.manufacturer || 'Unknown',
    subtype: fixture.type || 'generic',
    tags: deriveFixtureTags(fixture),
    summary: getFixtureSummary(fixture),
    icon: getFixtureTypeEmoji(fixture.type),
    accentColor: getFixtureTypeColor(fixture.type),
    filePath,
    itemCount: fixture.channels?.length ?? 0,
    updatedAt: Date.now(),
    isFavorite,
    _raw: fixture,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INGENIO → ASSET ADAPTER
// ═══════════════════════════════════════════════════════════════════════════

/** Mapea categoría de Ingenio a emoji */
function getIngenioCategoryEmoji(category: IngenioCategory): string {
  switch (category) {
    case 'modulation': return '∿'
    case 'dynamics':   return '〰️'
    case 'audio':      return '🎵'
    case 'sequencer':  return '🔢'
    case 'logic':      return '🔀'
    case 'utility':    return '🔧'
    case 'effect':     return '✨'
    default:           return '📦'
  }
}

/** Mapea categoría de Ingenio a color de acento */
function getIngenioCategoryColor(category: IngenioCategory): string {
  switch (category) {
    case 'modulation': return '#39ff14'
    case 'dynamics':   return '#00f3ff'
    case 'audio':      return '#ff6b35'
    case 'sequencer':  return '#ffb800'
    case 'logic':      return '#ffb800'
    case 'utility':    return '#71717a'
    case 'effect':     return '#bf5af2'
    default:           return '#bf5af2'
  }
}

/**
 * Convierte un IIngenioDefinition + source a un LibraryAsset unificado.
 */
export function ingenioToAsset(
  ingenio: IIngenioDefinition,
  source: AssetSource,
  isFavorite: boolean = false,
): LibraryAsset {
  const inCount = ingenio.exposedPorts.filter(p => p.direction === 'in').length
  const outCount = ingenio.exposedPorts.filter(p => p.direction === 'out').length

  return {
    id: ingenio.id,
    type: 'ingenio',
    source,
    name: ingenio.name,
    creator: ingenio.author,
    subtype: ingenio.category,
    tags: [...ingenio.tags],
    summary: `${inCount} in • ${outCount} out • ${ingenio.meta.internalNodeCount} nodes`,
    icon: ingenio.icon || getIngenioCategoryEmoji(ingenio.category),
    accentColor: ingenio.accentColor || getIngenioCategoryColor(ingenio.category),
    itemCount: ingenio.meta.internalNodeCount,
    updatedAt: new Date(ingenio.meta.updatedAt).getTime(),
    isFavorite,
    _raw: ingenio,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH HELPER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verifica si un asset coincide con una query de búsqueda.
 * Busca en nombre, creator, subtipo, tags y summary.
 */
export function matchesSearch(asset: LibraryAsset, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    asset.name.toLowerCase().includes(q) ||
    asset.creator.toLowerCase().includes(q) ||
    asset.subtype.toLowerCase().includes(q) ||
    asset.tags.some(t => t.toLowerCase().includes(q)) ||
    asset.summary.toLowerCase().includes(q)
  )
}
