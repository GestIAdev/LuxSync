/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌿 VibeGraftRegistry.ts — THE GRAFTING LAYER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Injerta un `FusedVibeBundle` en los 7 registries canónicos de motor para
 * que el pipeline entero (Liquid + Color + Movement) acepte la clave
 * sintética `custom:...` sin una sola línea modificada en la lógica de motor.
 *
 * ── EL PROBLEMA DE PATTERN_CONFIG ──────────────────────────────────────────
 * A diferencia de los otros 6 registries (que son keyed por vibe y por tanto
 * el injerto es aditivo y no destructivo), `PATTERN_CONFIG` es GLOBAL: un
 * único `Record<GoldenPattern, PatternConfig>` compartido por TODOS los vibes.
 *
 * Si un custom vibe muta `scan_x.cycleBeats`, ese cambio afecta a TODOS los
 * vibes que usan `scan_x`. Por eso el graft registry:
 *   1. Antes de injertar, hace BACKUP de los PatternConfigs que se van a
 *      sobrescribir (sólo esos, no los 22).
 *   2. Al hacer `ungraft`, RESTAURA esos backups exactos.
 *
 * Esto garantiza que desactivar un custom vibe devuelve el motor a su estado
 * canónico, sin contaminación.
 *
 * ── REGISTRO DE INJERTOS ───────────────────────────────────────────────────
 * Se mantiene un `Map<CustomVibeKey, GraftRecord>` para saber qué claves
 * están injertadas y poder revertirlas. Cada registro guarda:
 *   - La key injertada.
 *   - El backup de los PatternConfigs sobrescritos (para restore).
 *
 * @module engine/vibe/custom/VibeGraftRegistry
 * @version FASE 1B — The Fusion Core
 */

import type {
  CustomVibeKey,
  FusedVibeBundle,
  GoldenPatternId,
  GraftablePatternConfig,
} from '../../../types/CustomVibe'
import { isCustomVibeKey } from '../../../types/CustomVibe'

import { VIBE_REGISTRY } from '../../vibe/profiles/index'
import { normalizeVibeId } from '../../vibe/profiles/index'
import { PROFILE_REGISTRY } from '../../../hal/physics/profiles/index'
import { COLOR_CONSTITUTIONS } from '../../color/colorConstitutions'
import {
  VIBE_CONFIG,
  STEREO_CONFIG,
  TILT_OFFSET_BY_VIBE,
  PATTERN_CONFIG,
} from '../../movement/VibeMovementManager'
import { MOVEMENT_PRESETS } from '../../movement/VibeMovementPresets'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Registro de un injerto activo.
 * Guarda lo necesario para revertir el injerto limpiamente.
 */
interface GraftRecord {
  /** La clave sintética injertada. */
  readonly key: CustomVibeKey
  /** Backup de los PatternConfigs sobrescritos (sólo los tocados). */
  readonly patternConfigBackup: Map<GoldenPatternId, GraftablePatternConfig>
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTADO DEL REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mapa de injertos activos: `custom:...` → GraftRecord.
 * Múltiples custom vibes pueden estar injertados simultáneamente.
 */
const graftedKeys = new Map<CustomVibeKey, GraftRecord>()

// ═══════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Injerta un `FusedVibeBundle` en los 7 registries canónicos.
 *
 * Después de llamar a esta función, `normalizeVibeId(bundle.key)` devuelve
 * la key, `getColorConstitution(bundle.key)` devuelve la constitución
 * fusionada, y `getMovementPreset(bundle.key)` no emite el warn de fallback.
 *
 * Si la key ya estaba injertada, se re-injerta (actualiza los valores).
 *
 * @param bundle El bundle fusionado por `VibeFusionResolver`.
 * @returns `true` si el injerto fue exitoso.
 */
export function graft(bundle: FusedVibeBundle): boolean {
  if (!isCustomVibeKey(bundle.key)) {
    console.error(`[VibeGraftRegistry] Key inválida: "${bundle.key}". Debe empezar con "custom:".`)
    return false
  }

  // Si ya estaba injertada, primero la desaplicamos (restore de PATTERN_CONFIG).
  if (graftedKeys.has(bundle.key)) {
    ungraft(bundle.key)
  }

  // ── 1. BACKUP de PatternConfigs que se van a sobrescribir ────────────
  const patternConfigBackup = new Map<GoldenPatternId, GraftablePatternConfig>()
  if (bundle.patternConfigs) {
    for (const [patternId, newConfig] of Object.entries(bundle.patternConfigs)) {
      if (!newConfig) continue
      const pid = patternId as GoldenPatternId
      // Backup del estado CANÓNICO actual (que puede ser de un injerto previo
      // de OTRO custom vibe — pero ese es el estado que debemos restaurar
      // cuando ESTE vibe se desaplique).
      const current = PATTERN_CONFIG[pid as keyof typeof PATTERN_CONFIG]
      if (current) {
        patternConfigBackup.set(pid, { ...current })
      }
      // Aplicar el nuevo config
      ;(PATTERN_CONFIG as Record<string, unknown>)[pid] = { ...newConfig }
    }
  }

  // ── 2. Injertar en los 6 registries keyed por vibe ───────────────────
  // Estos son aditivos: añadir la key no destruye nada.
  ;(VIBE_REGISTRY as Record<string, unknown>)[bundle.key] = bundle.vibeProfile
  ;(PROFILE_REGISTRY as Record<string, unknown>)[bundle.key] = bundle.liquidProfile
  ;(COLOR_CONSTITUTIONS as Record<string, unknown>)[bundle.key] = bundle.colorConstitution
  ;(VIBE_CONFIG as Record<string, unknown>)[bundle.key] = bundle.vibeConfig
  ;(STEREO_CONFIG as Record<string, unknown>)[bundle.key] = bundle.stereoConfig
  ;(MOVEMENT_PRESETS as Record<string, unknown>)[bundle.key] = bundle.movementPreset
  // TILT_OFFSET_BY_VIBE es Readonly en TS pero mutable en runtime.
  ;(TILT_OFFSET_BY_VIBE as Record<string, number>)[bundle.key] = bundle.tiltOffset

  // ── 3. Registrar el injerto ──────────────────────────────────────────
  graftedKeys.set(bundle.key, {
    key: bundle.key,
    patternConfigBackup,
  })

  return true
}

/**
 * Desaplica un injerto: elimina la key de los 7 registries y restaura
 * los PatternConfigs desde el backup.
 *
 * @param key La clave sintética a desaplicar.
 * @returns `true` si la key estaba injertada y se desaplicó.
 */
export function ungraft(key: CustomVibeKey): boolean {
  const record = graftedKeys.get(key)
  if (!record) return false

  // ── 1. Restaurar PatternConfigs desde el backup ──────────────────────
  for (const [patternId, backupConfig] of record.patternConfigBackup) {
    ;(PATTERN_CONFIG as Record<string, unknown>)[patternId] = { ...backupConfig }
  }

  // ── 2. Eliminar la key de los 6 registries keyed por vibe ────────────
  delete (VIBE_REGISTRY as Record<string, unknown>)[key]
  delete (PROFILE_REGISTRY as Record<string, unknown>)[key]
  delete (COLOR_CONSTITUTIONS as Record<string, unknown>)[key]
  delete (VIBE_CONFIG as Record<string, unknown>)[key]
  delete (STEREO_CONFIG as Record<string, unknown>)[key]
  delete (MOVEMENT_PRESETS as Record<string, unknown>)[key]
  delete (TILT_OFFSET_BY_VIBE as Record<string, number>)[key]

  // ── 3. Eliminar del registro ─────────────────────────────────────────
  graftedKeys.delete(key)

  return true
}

/**
 * Desaplica TODOS los injertos activos. Usado al cerrar el Vibe Lab.
 */
export function ungraftAll(): void {
  for (const key of Array.from(graftedKeys.keys())) {
    ungraft(key)
  }
}

/**
 * Lista las claves custom injertadas actualmente.
 */
export function listGrafted(): readonly CustomVibeKey[] {
  return Array.from(graftedKeys.keys())
}

/**
 * Verifica si una clave está injertada.
 */
export function isGrafted(key: string): boolean {
  return graftedKeys.has(key as CustomVibeKey)
}

/**
 * Verifica que una clave injertada es reconocida por `normalizeVibeId`.
 * Usado por los tests para confirmar que el pipeline acepta la key.
 */
export function isKeyNormalized(key: CustomVibeKey): boolean {
  return normalizeVibeId(key) !== null
}

/**
 * Recupera el registro de injerto de una clave, si existe.
 * Para debugging e inspección.
 */
export function getGraftRecord(key: CustomVibeKey): GraftRecord | undefined {
  return graftedKeys.get(key)
}
