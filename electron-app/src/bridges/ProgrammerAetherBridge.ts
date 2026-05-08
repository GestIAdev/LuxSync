/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ PROGRAMMER AETHER BRIDGE — WAVE 4529: THE 44Hz PULSE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Singleton que conecta el programmerStore con el NodeArbiter L2 vía IPC.
 *
 * FLUJO:
 *   UI event → programmerStore (sync, in-memory) → dirty flag set
 *   44Hz tick → bridge lee dirty flags → construye payloads → IPC → NodeArbiter L2
 *   → consumeDirty() → flags cleared
 *
 * FAMILIA → NodeId label map:
 *   IMPACT  → 'impact'
 *   COLOR   → 'color'
 *   KINETIC → 'kinetic'
 *   BEAM    → 'beam'
 *   EXTRAS  → 'atmosphere'
 *
 * Los valores en el store ya están normalizados 0-1.
 * El bridge NO hace ninguna transformación de valores.
 *
 * @module bridges/ProgrammerAetherBridge
 * @version WAVE 4529
 */

import { useProgrammerStore, type ProgrammerFamily, type ProgrammerOverrides } from '../stores/programmerStore'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** 44Hz = 1000/44 ≈ 22.7ms */
const TICK_INTERVAL_MS = 1000 / 44

/** Familia → label del nodeId en la Aether Matrix */
const FAMILY_LABEL: Record<ProgrammerFamily, string> = {
  IMPACT:  'impact',
  COLOR:   'color',
  KINETIC: 'kinetic',
  BEAM:    'beam',
  EXTRAS:  'atmosphere',
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANNEL EXTRACTOR — Construye channels Record<string, number> por familia
// ─────────────────────────────────────────────────────────────────────────────

/** Extrae los canales activos (non-null) de la familia IMPACT */
function extractImpact(ov: ProgrammerOverrides): Record<string, number> | null {
  const ch: Record<string, number> = {}
  if (ov.dimmer  !== null) ch['dimmer']  = ov.dimmer
  if (ov.strobe  !== null) ch['strobe']  = ov.strobe
  if (ov.shutter !== null) ch['shutter'] = ov.shutter
  return Object.keys(ch).length > 0 ? ch : null
}

/** Extrae los canales activos de la familia COLOR */
function extractColor(ov: ProgrammerOverrides): Record<string, number> | null {
  const ch: Record<string, number> = {}
  if (ov.red   !== null) ch['red']   = ov.red
  if (ov.green !== null) ch['green'] = ov.green
  if (ov.blue  !== null) ch['blue']  = ov.blue
  if (ov.white !== null) ch['white'] = ov.white
  if (ov.amber !== null) ch['amber'] = ov.amber
  return Object.keys(ch).length > 0 ? ch : null
}

/** Extrae los canales activos de la familia KINETIC */
function extractKinetic(ov: ProgrammerOverrides): Record<string, number> | null {
  const ch: Record<string, number> = {}
  const hasSpatialTarget = ov.targetX !== null && ov.targetY !== null && ov.targetZ !== null
  if (hasSpatialTarget) {
    ch['targetX'] = ov.targetX!
    ch['targetY'] = ov.targetY!
    ch['targetZ'] = ov.targetZ!
  } else {
    if (ov.pan   !== null) ch['pan']   = ov.pan
    if (ov.tilt  !== null) ch['tilt']  = ov.tilt
  }
  if (ov.speed !== null) ch['speed'] = ov.speed
  return Object.keys(ch).length > 0 ? ch : null
}

/** Extrae los canales activos de la familia BEAM */
function extractBeam(ov: ProgrammerOverrides): Record<string, number> | null {
  const ch: Record<string, number> = {}
  if (ov.gobo  !== null) ch['gobo']  = ov.gobo
  if (ov.prism !== null) ch['prism'] = ov.prism
  if (ov.focus !== null) ch['focus'] = ov.focus
  if (ov.zoom  !== null) ch['zoom']  = ov.zoom
  if (ov.iris  !== null) ch['iris']  = ov.iris
  return Object.keys(ch).length > 0 ? ch : null
}

/** Extrae los canales activos de la familia EXTRAS (phantom channels) */
function extractExtras(ov: ProgrammerOverrides): Record<string, number> | null {
  if (ov.extras.size === 0) return null
  const ch: Record<string, number> = {}
  ov.extras.forEach((value, key) => { ch[key] = value })
  return ch
}

const FAMILY_EXTRACTOR: Record<
  ProgrammerFamily,
  (ov: ProgrammerOverrides) => Record<string, number> | null
> = {
  IMPACT:  extractImpact,
  COLOR:   extractColor,
  KINETIC: extractKinetic,
  BEAM:    extractBeam,
  EXTRAS:  extractExtras,
}

// ─────────────────────────────────────────────────────────────────────────────
// BRIDGE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class ProgrammerAetherBridgeClass {
  private _intervalId: ReturnType<typeof setInterval> | null = null
  private _started = false

  /**
   * Inicia el puente. Sólo puede llamarse una vez.
   * Debe llamarse tras la creación del renderer (después de que
   * window.lux.aether esté disponible).
   */
  start(): void {
    if (this._started) {
      console.warn('[ProgrammerAetherBridge] Ya iniciado, ignorando start()')
      return
    }
    this._started = true
    this._intervalId = setInterval(() => this._flush(), TICK_INTERVAL_MS)
    console.log('[ProgrammerAetherBridge] ⚡ Iniciado @ 44Hz')
  }

  /** Detiene el bridge. Para limpieza en unmount o tests. */
  stop(): void {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId)
      this._intervalId = null
    }
    this._started = false
    console.log('[ProgrammerAetherBridge] Detenido')
  }

  /**
   * Tick de 44Hz.
   * Lee dirty flags, construye payloads para las familias sucias,
   * envía vía window.lux.aether y consume los flags.
   */
  private _flush(): void {
    const state = useProgrammerStore.getState()
    const { fixtureOverrides, dirtyFamilies, activeFixtureIds } = state

    if (dirtyFamilies.size === 0) return

    const aether = window.lux?.aether
    if (!aether) {
      // Si IPC no está disponible aún, no consumimos los dirty flags —
      // se reintentará en el próximo tick.
      return
    }

    const dirtySnapshot = new Set(dirtyFamilies)
    const setPayloads: Array<{ nodeId: string; channels: Record<string, number> }> = []
    const clearNodeIds: string[] = []

    for (const fixtureId of activeFixtureIds) {
      const ov = fixtureOverrides.get(fixtureId)

      for (const family of dirtySnapshot) {
        const nodeId = `${fixtureId}:${FAMILY_LABEL[family]}`
        const extractor = FAMILY_EXTRACTOR[family]
        const channels = ov ? extractor(ov) : null

        if (channels !== null) {
          setPayloads.push({ nodeId, channels })
        } else {
          // Sin canales activos = liberar el nodo completamente
          clearNodeIds.push(nodeId)
        }
      }
    }

    // Consume dirty ANTES del IPC (fire-and-forget: no esperamos respuesta)
    state.consumeDirty()

    if (setPayloads.length > 0) {
      aether.setManualOverrides(setPayloads).catch((err: unknown) => {
        console.error('[ProgrammerAetherBridge] setManualOverrides error:', err)
      })
    }

    if (clearNodeIds.length > 0) {
      aether.clearManualOverrides(clearNodeIds).catch((err: unknown) => {
        console.error('[ProgrammerAetherBridge] clearManualOverrides error:', err)
      })
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const ProgrammerAetherBridge = new ProgrammerAetherBridgeClass()
