/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎹 PROGRAMMER STORE — WAVE 4529: THE PLUMBING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Estado centralizado del Programmer. Reemplaza los useState locales
 * dispersos en TheProgrammer.tsx y sus secciones hijas.
 *
 * PRINCIPIO: La UI habla humano (%, grados, 0-255).
 *            El store normaliza a 0-1 internamente.
 *            El ProgrammerAetherBridge lee los valores normalizados.
 *
 * DIRTY FLAGS: Permiten al bridge saber qué familias enviarse en el
 * próximo tick de 44Hz. Se limpian con consumeDirty() tras cada flush.
 *
 * @module stores/programmerStore
 * @version WAVE 4529
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Target3D } from '../engine/movement/InverseKinematicsEngine'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Familias de canales que el bridge conoce */
export type ProgrammerFamily = 'IMPACT' | 'COLOR' | 'KINETIC' | 'BEAM' | 'EXTRAS'

/**
 * Overrides normalizados (0-1) para un fixture.
 * null = canal no en override (AI controla).
 */
export interface ProgrammerOverrides {
  // IMPACT family
  dimmer: number | null
  strobe: number | null
  shutter: number | null
  limit: number | null  // Inhibit limit 0-1 — enviado vía IPC dedicado lux:aether:setInhibitLimit (WAVE 4531)

  // COLOR family
  red: number | null
  green: number | null
  blue: number | null
  white: number | null
  amber: number | null

  // KINETIC family
  pan: number | null    // 0-1 (0-540° → /540)
  tilt: number | null   // 0-1 (0-270° → /270)
  speed: number | null
  targetX: number | null
  targetY: number | null
  targetZ: number | null

  // BEAM family
  gobo: number | null
  prism: number | null
  focus: number | null
  zoom: number | null
  iris: number | null

  // EXTRAS (phantom channels) — channelKey → normalized 0-1
  extras: Map<string, number>
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE + ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

interface ProgrammerState {
  /** Overrides per fixture (sparse — solo fixtures con overrides activos) */
  fixtureOverrides: Map<string, ProgrammerOverrides>

  /** Qué familias tienen datos nuevos para el bridge */
  dirtyFamilies: Set<ProgrammerFamily>

  /** IDs de los fixtures actualmente seleccionados */
  activeFixtureIds: string[]

  // ── Display values (raw, sin normalizar — para alimentar la UI) ──
  displayDimmer: number   // 0-100
  displayStrobe: number   // 0-100
  displayLimit: number    // 0-100
  displayColor: { r: number; g: number; b: number }  // 0-255 cada uno
}

interface ProgrammerActions {
  /** Sincroniza la selección activa. Limpia overrides de fixtures deseleccionados. */
  syncSelection: (fixtureIds: string[]) => void

  /**
   * WAVE 4653: Hidrata estado local desde snapshot L2 del NodeArbiter.
   * No marca dirty flags: solo refleja estado ya existente en backend.
   */
  hydrateFromL2: (
    fixtureIds: string[],
    overridesByNodeId: Record<string, Record<string, number> | null>,
  ) => void

  /** Set dimmer para todos los fixtures activos (value 0-100%) */
  setDimmer: (percent: number) => void

  /** Release dimmer → AI controla */
  releaseDimmer: () => void

  /** Set strobe para todos los fixtures activos (value 0-100%) */
  setStrobe: (percent: number) => void

  /** Release strobe */
  releaseStrobe: () => void

  /** Set inhibit limit (value 0-100%) */
  setLimit: (percent: number) => void

  /** Release inhibit limit */
  releaseLimit: () => void

  /** Set color RGB (r, g, b en 0-255) */
  setColor: (r: number, g: number, b: number) => void

  /** Release color → AI controla */
  releaseColor: () => void

  /** Set posición pan/tilt (pan 0-540°, tilt 0-270°) */
  setPosition: (pan: number, tilt: number) => void

  /** Set target espacial en metros para KINETIC (ruta IK pura) */
  setSpatialPosition: (target: Target3D) => void

  /** Set posición individual por fixture (para formation mode) */
  setPositionPerFixture: (positions: Array<{ fixtureId: string; pan: number; tilt: number }>) => void

  /** Release posición */
  releasePosition: () => void

  /** Set velocidad cinemática (percent 0-100) → normalizado 0-1 → L2 KINETIC 44Hz */
  setKineticSpeed: (percent: number) => void

  /** Release velocidad cinemática */
  releaseKineticSpeed: () => void

  /** Set beam channel (channel key, value 0-255) */
  setBeam: (channel: 'gobo' | 'prism' | 'focus' | 'zoom' | 'iris', value: number) => void

  /** Release todos los canales beam */
  releaseBeam: () => void

  /** Set phantom/extra channel (channelKey = label o type, value 0-255) */
  setExtra: (channelKey: string, value: number) => void

  /** Release todos los phantom channels */
  releaseExtras: () => void

  /** Release TODAS las familias para los fixtures activos (UNLOCK ALL) */
  releaseAll: () => void

  /** El bridge llama esto tras hacer flush de las dirty families */
  consumeDirty: () => void

  /** Limpia solo las familias enviadas con éxito (evita borrar cambios nuevos). */
  consumeDirtyFamilies: (families: ProgrammerFamily[]) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function createEmptyOverrides(): ProgrammerOverrides {
  return {
    dimmer: null,
    strobe: null,
    shutter: null,
    limit: null,
    red: null,
    green: null,
    blue: null,
    white: null,
    amber: null,
    pan: null,
    tilt: null,
    speed: null,
    targetX: null,
    targetY: null,
    targetZ: null,
    gobo: null,
    prism: null,
    focus: null,
    zoom: null,
    iris: null,
    extras: new Map(),
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function getNorm(channels: Record<string, number> | null | undefined, key: string): number | null {
  const value = channels?.[key]
  return typeof value === 'number' ? clamp01(value) : null
}

function getNormAny(
  channels: Record<string, number> | null | undefined,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = channels?.[key]
    if (typeof value === 'number') return clamp01(value)
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const useProgrammerStore = create<ProgrammerState & ProgrammerActions>()(
  subscribeWithSelector((set, get) => ({
    // ── Estado inicial ──
    fixtureOverrides: new Map(),
    dirtyFamilies: new Set(),
    activeFixtureIds: [],
    displayDimmer: 100,
    displayStrobe: 0,
    displayLimit: 100,
    displayColor: { r: 255, g: 255, b: 255 },

    // ── SELECTION ──

    syncSelection: (fixtureIds) => {
      set(state => {
        // CLEAN CABIN: purgar del Map los fixtures que ya no están en la selección.
        // Esto elimina overrides zombie que el bridge seguiría enviando a 44Hz
        // para fixtures deseleccionados sin override activo visible.
        const incomingSet = new Set(fixtureIds)
        const next = new Map(state.fixtureOverrides)
        const dirty = new Set(state.dirtyFamilies)
        let hadZombies = false
        for (const id of state.fixtureOverrides.keys()) {
          if (!incomingSet.has(id)) {
            // Solo eliminar si todos los valores son null (sin override real activo).
            // Si el fixture tiene valores activos, conservar para que el bridge
            // envíe el clear explícito al NodeArbiter antes de liberar el Map.
            const ov = state.fixtureOverrides.get(id)!
            const hasActiveOverride =
              ov.dimmer !== null || ov.strobe !== null || ov.shutter !== null ||
              ov.red !== null || ov.green !== null || ov.blue !== null ||
              ov.white !== null || ov.amber !== null ||
              ov.pan !== null || ov.tilt !== null || ov.speed !== null ||
              ov.focus !== null || ov.zoom !== null || ov.gobo !== null ||
              ov.prism !== null || ov.extras.size > 0
            if (!hasActiveOverride) {
              next.delete(id)
              hadZombies = true
            }
          }
        }
        return { activeFixtureIds: fixtureIds, fixtureOverrides: hadZombies ? next : state.fixtureOverrides }
      })
    },

    hydrateFromL2: (fixtureIds, overridesByNodeId) => {
      set(state => {
        // Guard de carrera: no hidratar si la selección cambió en paralelo.
        if (state.activeFixtureIds.join(',') !== fixtureIds.join(',')) {
          return {}
        }

        const next = new Map(state.fixtureOverrides)

        for (const fixtureId of fixtureIds) {
          const base = next.get(fixtureId) ?? createEmptyOverrides()

          const impact = overridesByNodeId[`${fixtureId}:impact`]
          const color = overridesByNodeId[`${fixtureId}:color`]
          const kinetic = overridesByNodeId[`${fixtureId}:kinetic`]
          const beam = overridesByNodeId[`${fixtureId}:beam`]
          const extras = overridesByNodeId[`${fixtureId}:atmosphere`]

          next.set(fixtureId, {
            ...base,
            dimmer: getNorm(impact, 'dimmer'),
            strobe: getNorm(impact, 'strobe'),
            shutter: getNorm(impact, 'shutter'),

            red: getNormAny(color, ['red', 'r']),
            green: getNormAny(color, ['green', 'g']),
            blue: getNormAny(color, ['blue', 'b']),
            white: getNorm(color, 'white'),
            amber: getNorm(color, 'amber'),

            pan: getNorm(kinetic, 'pan'),
            tilt: getNorm(kinetic, 'tilt'),
            speed: getNorm(kinetic, 'speed'),
            targetX: getNorm(kinetic, 'targetX'),
            targetY: getNorm(kinetic, 'targetY'),
            targetZ: getNorm(kinetic, 'targetZ'),

            gobo: getNorm(beam, 'gobo') ?? getNorm(extras, 'gobo'),
            prism: getNorm(beam, 'prism') ?? getNorm(extras, 'prism'),
            focus: getNorm(beam, 'focus'),
            zoom: getNorm(beam, 'zoom'),
            iris: getNorm(beam, 'iris'),

            extras: new Map(
              Object.entries(extras ?? {}).map(([k, v]) => [k, clamp01(v)]),
            ),
          })
        }

        const firstFixture = fixtureIds[0]
        const firstOv = firstFixture ? next.get(firstFixture) : null

        const displayDimmer = firstOv?.dimmer !== null && firstOv?.dimmer !== undefined
          ? Math.round(firstOv.dimmer * 100)
          : 100
        const displayStrobe = firstOv?.strobe !== null && firstOv?.strobe !== undefined
          ? Math.round(firstOv.strobe * 100)
          : 0
        const displayColor = {
          r: firstOv?.red !== null && firstOv?.red !== undefined ? Math.round(firstOv.red * 255) : 255,
          g: firstOv?.green !== null && firstOv?.green !== undefined ? Math.round(firstOv.green * 255) : 255,
          b: firstOv?.blue !== null && firstOv?.blue !== undefined ? Math.round(firstOv.blue * 255) : 255,
        }

        return {
          fixtureOverrides: next,
          displayDimmer,
          displayStrobe,
          displayColor,
        }
      })
    },

    // ── IMPACT ──

    setDimmer: (percent) => {
      const normalized = clamp01(percent / 100)
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          next.set(id, { ...ov, dimmer: normalized })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('IMPACT')
        return { fixtureOverrides: next, dirtyFamilies: dirty, displayDimmer: percent }
      })
    },

    releaseDimmer: () => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id)
          if (ov) next.set(id, { ...ov, dimmer: null })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('IMPACT')
        return { fixtureOverrides: next, dirtyFamilies: dirty, displayDimmer: 100 }
      })
    },

    setStrobe: (percent) => {
      const normalized = clamp01(percent / 100)
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          next.set(id, { ...ov, strobe: normalized })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('IMPACT')
        return { fixtureOverrides: next, dirtyFamilies: dirty, displayStrobe: percent }
      })
    },

    releaseStrobe: () => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id)
          if (ov) next.set(id, { ...ov, strobe: null })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('IMPACT')
        return { fixtureOverrides: next, dirtyFamilies: dirty, displayStrobe: 0 }
      })
    },

    setLimit: (percent) => {
      const normalized = clamp01(percent / 100)
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          // WAVE 4531: Solo persiste el limit en el override.
          // El cap real lo aplica el NodeArbiter post-arbitraje vía setInhibitLimit IPC.
          // El dimmer NO se escala aquí.
          next.set(id, { ...ov, limit: normalized })
        }
        // El limit no pertenece a ninguna dirty family del bridge —
        // se envía por su propio canal IPC desde TheProgrammer.tsx.
        return { fixtureOverrides: next, displayLimit: percent }
      })
    },

    releaseLimit: () => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id)
          if (ov) next.set(id, { ...ov, limit: null })
        }
        return { fixtureOverrides: next, displayLimit: 100 }
      })
    },

    // ── COLOR ──

    setColor: (r, g, b) => {
      const nr = clamp01(r / 255)
      const ng = clamp01(g / 255)
      const nb = clamp01(b / 255)
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          // Forzar actualización RGB completa y limpiar canales auxiliares
          // para evitar contaminación de presets por overrides previos RGBW/Amber.
          next.set(id, {
            ...ov,
            red: nr,
            green: ng,
            blue: nb,
            white: 0,
            amber: 0,
          })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('COLOR')
        return { fixtureOverrides: next, dirtyFamilies: dirty, displayColor: { r, g, b } }
      })
    },

    releaseColor: () => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id)
          if (ov) next.set(id, { ...ov, red: null, green: null, blue: null, white: null, amber: null })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('COLOR')
        return { fixtureOverrides: next, dirtyFamilies: dirty, displayColor: { r: 255, g: 255, b: 255 } }
      })
    },

    // ── KINETIC ──

    setPosition: (panDeg, tiltDeg) => {
      const normPan = clamp01(panDeg / 540)
      const normTilt = clamp01(tiltDeg / 270)
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          next.set(id, {
            ...ov,
            pan: normPan,
            tilt: normTilt,
            targetX: null,
            targetY: null,
            targetZ: null,
          })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('KINETIC')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    setSpatialPosition: (target) => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          next.set(id, {
            ...ov,
            pan: null,
            tilt: null,
            targetX: target.x,
            targetY: target.y,
            targetZ: target.z,
          })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('KINETIC')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    setPositionPerFixture: (positions) => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const { fixtureId, pan, tilt } of positions) {
          const ov = next.get(fixtureId) ?? createEmptyOverrides()
          next.set(fixtureId, {
            ...ov,
            pan: clamp01(pan / 540),
            tilt: clamp01(tilt / 270),
            targetX: null,
            targetY: null,
            targetZ: null,
          })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('KINETIC')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    releasePosition: () => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id)
          if (ov) next.set(id, {
            ...ov,
            pan: null,
            tilt: null,
            speed: null,
            targetX: null,
            targetY: null,
            targetZ: null,
          })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('KINETIC')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    setKineticSpeed: (percent) => {
      const normalized = clamp01(percent / 100)
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          next.set(id, { ...ov, speed: normalized })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('KINETIC')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    releaseKineticSpeed: () => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id)
          if (ov) next.set(id, { ...ov, speed: null })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('KINETIC')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    // ── BEAM ──

    setBeam: (channel, value) => {
      const normalized = clamp01(value / 255)
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          next.set(id, { ...ov, [channel]: normalized })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('BEAM')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    releaseBeam: () => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id)
          if (ov) next.set(id, { ...ov, gobo: null, prism: null, focus: null, zoom: null, iris: null })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('BEAM')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    // ── EXTRAS (phantom channels) ──

    setExtra: (channelKey, value) => {
      const normalized = clamp01(value / 255)
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id) ?? createEmptyOverrides()
          const extras = new Map(ov.extras)
          extras.set(channelKey, normalized)
          next.set(id, { ...ov, extras })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('EXTRAS')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    releaseExtras: () => {
      set(state => {
        const next = new Map(state.fixtureOverrides)
        for (const id of state.activeFixtureIds) {
          const ov = next.get(id)
          if (ov) next.set(id, { ...ov, extras: new Map() })
        }
        const dirty = new Set(state.dirtyFamilies)
        dirty.add('EXTRAS')
        return { fixtureOverrides: next, dirtyFamilies: dirty }
      })
    },

    // ── UNLOCK ALL ──

    releaseAll: () => {
      set(state => {
        // CLEAN CABIN: RELEASE ALL vacía el Map completamente.
        // El bridge detectará que fixtureOverrides está vacío y enviará
        // clearManualOverrides para cada nodeId conocido antes de limpiar.
        // Usar un Map vacío (no keys con empty objects) elimina el set de
        // zombies null-value que crecía monótonamente durante el show.
        const next = new Map<string, ProgrammerOverrides>()
        // Conservar solo los fixtures de la selección activa que PUEDEN tener
        // overrides nuevos inmediatamente después — se inicializan vacíos
        // para que el bridge pueda enviar el clear al NodeArbiter.
        for (const id of state.activeFixtureIds) {
          next.set(id, createEmptyOverrides())
        }
        const allFamilies: Set<ProgrammerFamily> = new Set([
          'IMPACT', 'COLOR', 'KINETIC', 'BEAM', 'EXTRAS',
        ])
        return {
          fixtureOverrides: next,
          dirtyFamilies: allFamilies,
          displayDimmer: 100,
          displayStrobe: 0,
          displayLimit: 100,
          displayColor: { r: 255, g: 255, b: 255 },
        }
      })
    },

    // ── BRIDGE CONTROL ──

    consumeDirty: () => {
      set({ dirtyFamilies: new Set() })
    },

    consumeDirtyFamilies: (families) => {
      set(state => {
        const next = new Set(state.dirtyFamilies)
        for (const family of families) {
          next.delete(family)
        }
        return { dirtyFamilies: next }
      })
    },
  }))
)
