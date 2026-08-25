/**
 * SELENE V3 — STRUCTURAL MASONRY: Sovereign Clock Guard
 *
 * Extracted from SeleneTitanConscious.ts (§5.2 of Due Diligence audit).
 * Contains all pre-buffer safety gates: ARS zone veto, epicness floor,
 * divine gate, pressure veto, heavy/divine re-routing, and the Glass Break sensor.
 *
 * Vibe branches (isTechnoVibe / isLatinVibe) have been migrated to continuous
 * ΠMΔG interpolation — the system is 100% genre-agnostic.
 */

import { getDynamicEffectRegistry, effectDisplayName } from '../../arsenal/DynamicEffectRegistry'
import type { TitanStabilizedState } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface PreBufferedCandidate {
  readonly effect: string
  readonly effectName?: string
  readonly intensity: number
  readonly zones: string[]
  readonly confidence: number
}

export interface PreBufferStatus {
  readonly effectId: string
  readonly predictedEventAt: number
  readonly bufferedAt: number
}

export type SovereignAction = 'fire' | 'abort' | 'wait' | 'clear'

export interface SovereignVerdict {
  readonly action: SovereignAction
  readonly candidate: PreBufferedCandidate | null
  readonly reroutedEffectId: string | null
  /** 🌊 WAVE 7575: ETA-Aware Upgrade — efecto heavy/peak que reemplaza al gentle pre-buffered */
  readonly upgradedEffectId: string | null
  readonly reason: string | null
  readonly trigger: 'sovereign_window' | 'glass_break' | null
}

export interface FluidDescriptorsView {
  readonly percussiveness: number
  readonly melodicity: number
  readonly dirtiness: number
  readonly groove: number
}

export interface SovereignClockContext {
  readonly now: number
  readonly bufferStatus: PreBufferStatus | null
  readonly candidate: PreBufferedCandidate | null
  readonly titanState: TitanStabilizedState
  readonly currentZScore: number
  readonly minEnergySinceLastEffect: number
  readonly isWarmedUp: boolean
  readonly epicness: number
  readonly acousticReality: {
    readonly zone: { readonly label: string }
    readonly phase: { readonly phase: string }
  } | null
  readonly rmsAverage10s: number
  readonly effectHistory: { type: string; timestamp: number }[]
  readonly descriptors: FluidDescriptorsView
  /**
   * 🪟 TRUE CREST DETECTOR: ¿hubo un transitorio real (CF>2) en este frame?
   * Evidencia física directa, latencia cero. Endurece/relaja el umbral Z del
   * Glass Break, no lo bypasea (ver evaluate()).
   */
  readonly crestEvent?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// Utils
// ═══════════════════════════════════════════════════════════════════════════

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 7574: RE-ROUTE VARIETY — selección aleatoria controlada
// En lugar de elegir siempre el primero de la lista ordenada (que produce
// re-routes repetitivos al mismo efecto), selecciona aleatoriamente entre
// los 3 primeros candidatos válidos (no en cooldown).
// ═══════════════════════════════════════════════════════════════════════════

interface RerouteCandidate {
  readonly id: string
  readonly dna: { readonly aggression?: number }
  readonly organismId?: string
  readonly organismStatus?: string
  readonly simMeta: { readonly isDivineCandidate?: boolean; readonly isHeavyCandidate?: boolean }
}

/**
 * Selecciona un candidato de re-route con variedad controlada.
 * 1. Filtra: no divine, no heavy, aggression <= 0.70, no minion vivo
 * 2. Ordena por aggression descendente
 * 3. Descarta los que están en cooldown (disparados en los últimos 8s)
 * 4. Selecciona aleatoriamente entre los 3 primeros válidos
 * 5. Si todos están en cooldown, selecciona aleatoriamente entre los 3 primeros
 * @returns effectId del candidato seleccionado, o null si no hay candidatos
 */
function selectRerouteCandidate(
  arsenal: readonly RerouteCandidate[],
  effectHistory: readonly { type: string; timestamp: number }[],
  now: number,
): string | null {
  const lighter = arsenal.filter(e =>
    !e.simMeta.isDivineCandidate &&
    !e.simMeta.isHeavyCandidate &&
    (e.dna.aggression ?? 0) <= 0.70 &&
    (!e.organismId || e.organismStatus !== 'alive')
  )
  if (lighter.length === 0) return null

  // 🩸 WAVE 7599.1: Selección aleatoria de TODO el pool, no solo top 3.
  // Antes: sort por aggression DESC + pick entre top 3 → siempre el más
  // agresivo de los light → no es downgrade real + repetitivo.
  // Ahora: pick aleatorio de todos los candidatos válidos (no en cooldown).
  const notInCooldown = lighter.filter(e =>
    !effectHistory.some(h => h.type === e.id && (now - h.timestamp) < 8000)
  )

  const pool = notInCooldown.length > 0 ? notInCooldown : lighter
  const pick = pool[Math.floor(Math.random() * pool.length)]
  return pick.id
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌊 WAVE 7575: ETA-AWARE UPGRADE — selección de candidato heavy/peak
// Espejo del selectRerouteCandidate pero en sentido inverso: cuando el
// DreamSimulator pre-bufferizó un efecto gentle/ambient (porque Cassandra
// predijo breakdown_imminent/energy_drop) PERO en el momento del disparo
// hay clímax real (bass > 0.55, Z > 1.5, ETA > 2500ms), selecciona un
// efecto heavy/peak para aprovechar el pico energético en vez de desperdiciarlo.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Selecciona un candidato heavy/peak para el upgrade.
 * 1. Filtra: isHeavyCandidate OR isDivineCandidate OR aggression > 0.80
 * 2. Ordena por aggression descendente (más agresivo primero)
 * 3. Descarta los que están en cooldown (disparados en los últimos 8s)
 * 4. Selecciona aleatoriamente entre los 3 primeros válidos
 * @returns effectId del candidato seleccionado, o null si no hay candidatos
 *
 * 🩸 WAVE 7599: Exported for reuse by the HUNT UPGRADE path in
 * SeleneTitanConscious — the normal hunt path needs the same heavy/peak
 * selector as the Sovereign Clock's ETA-Aware Upgrade.
 */
export function selectUpgradeCandidate(
  arsenal: readonly RerouteCandidate[],
  effectHistory: readonly { type: string; timestamp: number }[],
  now: number,
): string | null {
  const heavier = arsenal.filter(e =>
    (e.simMeta.isHeavyCandidate || e.simMeta.isDivineCandidate || (e.dna.aggression ?? 0) > 0.80)
    && (!e.organismId || e.organismStatus !== 'alive')
  )
  if (heavier.length === 0) return null

  const sorted = [...heavier].sort((a, b) => (b.dna.aggression ?? 0) - (a.dna.aggression ?? 0))

  // Candidatos no en cooldown (no disparados en los últimos 8s)
  const notInCooldown = sorted.filter(e =>
    !effectHistory.some(h => h.type === e.id && (now - h.timestamp) < 8000)
  )

  const pool = notInCooldown.length > 0 ? notInCooldown : sorted
  // Seleccionar aleatoriamente entre los 3 primeros del pool
  const topN = Math.min(3, pool.length)
  const pick = pool[Math.floor(Math.random() * topN)]
  return pick.id
}

// ═══════════════════════════════════════════════════════════════════════════
// Sovereign Clock Guard
// ═══════════════════════════════════════════════════════════════════════════

export class SovereignClockGuard {
  private readonly SOVEREIGN_WINDOW_MS = 500

  /**
   * Evaluate the pre-buffered candidate against all safety gates.
   * Returns a verdict telling the orchestrator what to do.
   */
  evaluate(ctx: SovereignClockContext): SovereignVerdict {
    const { bufferStatus } = ctx
    if (!bufferStatus) {
      return { action: 'wait', candidate: null, reroutedEffectId: null, upgradedEffectId: null, reason: null, trigger: null }
    }

    const timeToEvent = bufferStatus.predictedEventAt - ctx.now

    // ── Glass Break Sensor (WAVE 5016 + WAVE 6040 Regla del Valle) ──
    // 🪟 TRUE CREST DETECTOR: un Z-Score se calcula sobre una ventana de 30s y
    // difumina los transitorios; un evento de cresta CF>2 es evidencia física
    // de que ALGO acaba de golpear en este frame. Corrobora la anomalía, así que
    // relaja el umbral Z medio sigma — nunca lo bypasea (una cresta sola ocurre
    // ~4 veces por segundo en techno; no es un drop).
    const valleyBreath = ctx.minEnergySinceLastEffect <= 0.45
    const crestCorroboration = ctx.crestEvent === true ? 0.5 : 0
    const GLASS_BREAK_Z = Math.max(2.0, (valleyBreath ? 2.5 : 3.5) - crestCorroboration)
    const glassBreak =
      timeToEvent > 0 &&
      ctx.isWarmedUp &&
      ctx.currentZScore >= GLASS_BREAK_Z &&
      ctx.titanState.rawEnergy > 0.55

    const withinSovereignWindow = timeToEvent <= 0 && timeToEvent >= -this.SOVEREIGN_WINDOW_MS

    if (!withinSovereignWindow && !glassBreak) {
      if (timeToEvent < -this.SOVEREIGN_WINDOW_MS) {
        return { action: 'clear', candidate: null, reroutedEffectId: null, upgradedEffectId: null, reason: null, trigger: null }
      }
      return { action: 'wait', candidate: null, reroutedEffectId: null, upgradedEffectId: null, reason: null, trigger: null }
    }

    const trigger: 'sovereign_window' | 'glass_break' = glassBreak ? 'glass_break' : 'sovereign_window'
    const candidate = ctx.candidate
    if (!candidate) {
      return { action: 'clear', candidate: null, reroutedEffectId: null, upgradedEffectId: null, reason: null, trigger: null }
    }

    // ── Minion Quarantine ──
    const registryEntry = getDynamicEffectRegistry().getEntry(candidate.effect)
    if (registryEntry?.organismStatus === 'alive') {
      return {
        action: 'abort',
        candidate: null,
        reroutedEffectId: null,
        upgradedEffectId: null,
        reason: `Minion quarantine enforced — "${candidate.effectName ?? candidate.effect}" blocked from live fire`,
        trigger,
      }
    }

    // ── ΠMΔG Interpolated Thresholds (replacing isTechnoVibe / isLatinVibe) ──
    const Π = ctx.descriptors.percussiveness
    const M = ctx.descriptors.melodicity
    const G = ctx.descriptors.groove
    // 🔬 WAVE 7542: Divine threshold lowered 0.60 → 0.50 (Divine Resuscitation).
    const V3_EPSILON_DIVINE = 0.50 - 0.10 * clamp01(Π * (1 - M))
    // Divine RMS floor: lower for high-groove (latin), higher for ambient
    const SOVEREIGN_DIVINE_RMS_FLOOR = 0.75 - 0.10 * clamp01(G)
    // 🔬 WAVE 7542: Sustained epicness lowered 0.50 → 0.40.
    const SOVEREIGN_DIVINE_EPICNESS = 0.40
    const SOVEREIGN_DIVINE_MIN_Z = 2.10

    const v3EpicnessNow = ctx.epicness
    const ars = ctx.acousticReality
    const isHeavyEffect = registryEntry?.simMeta.isHeavyCandidate
      || registryEntry?.simMeta.isDivineCandidate
      || (registryEntry?.dna.aggression ?? 0) > 0.7

    // ═══════════════════════════════════════════════════════════════════════
    // 🩸 WAVE 7543: UNIVERSAL SPECTRAL BASS GATE (Anti-Autotune Veto)
    // 🩸 WAVE 7553: REVERTED to simple bass <= 0.35. Purgado de zL/vocal/ratio.
    // 🩸 WAVE 7574: ENDURECIDO 0.35→0.45 — la resonancia del autotune grave vive
    //   en 0.30-0.40. Un bombo real de reggaeton/techno dispara a 0.75-0.90.
    //   0.45 deja la voz nasal fuera y solo deja pasar golpes físicos reales.
    // ═══════════════════════════════════════════════════════════════════════
    const BASS_GATE_THRESHOLD = 0.42
    const hasSubstantialBass = ctx.titanState.bass > BASS_GATE_THRESHOLD

    let aborted = false
    let abortReason = ''
    let heavyRerouted = false
    let reroutedEffectId: string | null = null

    // ── UNIVERSAL CLAMP: Heavy effect in silence/valley = ABORT ──
    // 🩸 WAVE 7543: Also abort if bass gate fails (vocal/autotune false positive)
    if (isHeavyEffect) {
      // Bass Gate veto — applies to ALL heavy effects (heavy, divine, aggression > 0.7)
      if (!hasSubstantialBass) {
        aborted = true
        abortReason =
          `Bass Gate veto (bass=${ctx.titanState.bass.toFixed(3)} ≤ ${BASS_GATE_THRESHOLD})` +
          ` — heavy effect "${candidate.effectName ?? candidate.effect}" suppressed (vocal/autotune false positive)`
      } else if (ars) {
        const zoneLabel = ars.zone.label
        const phaseLabel = ars.phase.phase
        const inLowZone = zoneLabel === 'silence' || zoneLabel === 'valley'
        const hasHiddenTension = phaseLabel === 'textural'

        if (inLowZone && !hasHiddenTension) {
          aborted = true
          abortReason =
            `Acoustic Reality veto (Zone: ${zoneLabel}, Phase: ${phaseLabel})` +
            ` — heavy effect "${candidate.effectName ?? candidate.effect}" cannot fire in low energy`
        }
      } else {
        const energyTooLow = ctx.titanState.rawEnergy < 0.35
        // 🩸 WAVE 7543: Raised from -0.5 to 1.0 — heavy effects need statistical significance.
        const zTooLow = ctx.currentZScore < 1.0
        if (energyTooLow || zTooLow) {
          aborted = true
          abortReason =
            `Fallback energy veto (E=${ctx.titanState.rawEnergy.toFixed(2)}` +
            `${energyTooLow ? ' < 0.35' : ''}` +
            `${zTooLow ? ` OR Z=${ctx.currentZScore.toFixed(2)} < 1.0` : ''})` +
            ` — heavy effect "${candidate.effectName ?? candidate.effect}" suppressed`
        }
      }
    }

    // ── HEAVY EPICNESS FLOOR + RE-ROUTE ──
    if (!aborted && registryEntry && !registryEntry.simMeta.isDivineCandidate && isHeavyEffect) {
      const HEAVY_EPICNESS_FLOOR = Math.max(0.25, ctx.rmsAverage10s * 0.35)
      // 🩸 WAVE 7543: HEAVY Z-SCORE FLOOR — heavy effects require statistical significance.
      // 🩸 WAVE 7574: ENDURECIDO 1.0→1.5 — exige que el golpe sea una anomalía real
      //   (un drop), no un ruido sostenido. Z=1.0 es "un poquito above average";
      //   Z=1.5 es "claramente inusual".
      const SOVEREIGN_HEAVY_MIN_Z = 1.5
      const heavyZBlocked = ctx.currentZScore < SOVEREIGN_HEAVY_MIN_Z
      if (v3EpicnessNow < HEAVY_EPICNESS_FLOOR || heavyZBlocked) {
        const vibeArsenal = getDynamicEffectRegistry().getEffectsForVibe(ctx.titanState.vibeId ?? '')
        // 🩸 WAVE 7574: RE-ROUTE VARIETY — selección aleatoria entre top 3
        reroutedEffectId = selectRerouteCandidate(vibeArsenal, ctx.effectHistory, ctx.now)
        if (reroutedEffectId) {
          heavyRerouted = true
          console.log(
            `[Sovereign Clock 🔄] HEAVY RE-ROUTE: "${candidate.effectName ?? candidate.effect}" → "${effectDisplayName(reroutedEffectId)}"` +
            ` | epicness=${v3EpicnessNow.toFixed(3)} < floor=${HEAVY_EPICNESS_FLOOR.toFixed(3)}` +
            `${heavyZBlocked ? ` OR Z=${ctx.currentZScore.toFixed(2)}σ < ${SOVEREIGN_HEAVY_MIN_Z}` : ''}` +
            ` (rms10s=${ctx.rmsAverage10s.toFixed(2)})` +
            ` — autotune/vocal transient: prediction preserved, effect downgraded`
          )
        } else {
          aborted = true
          abortReason =
            `HEAVY FLOOR: epicness=${v3EpicnessNow.toFixed(3)} < floor=${HEAVY_EPICNESS_FLOOR.toFixed(3)}` +
            `${heavyZBlocked ? ` OR Z=${ctx.currentZScore.toFixed(2)}σ < ${SOVEREIGN_HEAVY_MIN_Z}` : ''}` +
            ` (rms10s=${ctx.rmsAverage10s.toFixed(2)})` +
            ` — heavy effect "${candidate.effectName ?? candidate.effect}" suppressed` +
            ` (no lighter candidates available)`
        }
      }
    }

    // ── DIVINE GATE + RE-ROUTE ──
    if (!aborted && registryEntry?.simMeta.isDivineCandidate) {
      const energyTooLow = ctx.titanState.rawEnergy < 0.50
      const divineZoneVeto = ars
        ? (ars.zone.label === 'silence' || ars.zone.label === 'valley')
          && ars.phase.phase !== 'textural'
        : false
      const divinePeakPassed = v3EpicnessNow > V3_EPSILON_DIVINE
      const divineSustainedPassed = v3EpicnessNow > SOVEREIGN_DIVINE_EPICNESS && ctx.rmsAverage10s > SOVEREIGN_DIVINE_RMS_FLOOR
      const divineZPassed = ctx.currentZScore >= SOVEREIGN_DIVINE_MIN_Z
      const divineEpicnessBlocked = (!divinePeakPassed && !divineSustainedPassed) || !divineZPassed
      // 🩸 WAVE 7543: Bass gate already checked in isHeavyEffect block above,
      // but we include it in the divine gate log for diagnostic completeness.
      if (divineEpicnessBlocked || energyTooLow || divineZoneVeto) {
        const vibeArsenalDivine = getDynamicEffectRegistry().getEffectsForVibe(ctx.titanState.vibeId ?? '')
        // 🩸 WAVE 7574: RE-ROUTE VARIETY — selección aleatoria entre top 3
        reroutedEffectId = selectRerouteCandidate(vibeArsenalDivine, ctx.effectHistory, ctx.now)
        if (reroutedEffectId) {
          heavyRerouted = true
          console.log(
            `[Sovereign Clock 🔄] DIVINE RE-ROUTE: "${candidate.effectName ?? candidate.effect}" → "${effectDisplayName(reroutedEffectId)}"` +
            ` | epicness=${v3EpicnessNow.toFixed(3)} (peak>${V3_EPSILON_DIVINE.toFixed(2)}? ${divinePeakPassed}; sustained>${SOVEREIGN_DIVINE_EPICNESS}+rms>${SOVEREIGN_DIVINE_RMS_FLOOR.toFixed(2)}? ${divineSustainedPassed})` +
            ` Z=${ctx.currentZScore.toFixed(2)}σ ≥ ${SOVEREIGN_DIVINE_MIN_Z}? ${divineZPassed}` +
            ` — divine gate blocked, prediction preserved, effect downgraded`
          )
        } else {
          aborted = true
          abortReason =
            `DIVINE ABORT: V3 epicness=${v3EpicnessNow.toFixed(3)}` +
            ` (peak>${V3_EPSILON_DIVINE.toFixed(2)}? ${divinePeakPassed}; sustained>${SOVEREIGN_DIVINE_EPICNESS}+rms>${SOVEREIGN_DIVINE_RMS_FLOOR.toFixed(2)}? ${divineSustainedPassed})` +
            ` Z=${ctx.currentZScore.toFixed(2)}σ ≥ ${SOVEREIGN_DIVINE_MIN_Z}? ${divineZPassed}` +
            `${energyTooLow ? ` OR energy=${ctx.titanState.rawEnergy.toFixed(2)} < 0.50` : ''}` +
            `${divineZoneVeto ? ` OR ARS zone=${ars!.zone.label}` : ''}` +
            ` → buffer cleared, divine effect suppressed (no lighter candidates)`
        }
      }
    }

    // ── PRESSURE VETO ──
    if (!aborted && registryEntry) {
      const pr = registryEntry.pressureRange
      if (!(pr.min === 0 && pr.max === 0)) {
        const currentPressure = ctx.titanState.rawEnergy
        if (currentPressure < pr.min || currentPressure > pr.max) {
          aborted = true
          abortReason =
            `Pressure veto (Pressure=${currentPressure.toFixed(2)} outside allowed range [${pr.min}, ${pr.max}])`
        }
      }
    }

    // ── UNIVERSAL EPICNESS FLOOR (DYNAMIC) ──
    const sovereignRms10s = ctx.rmsAverage10s
    const SOVEREIGN_EPICNESS_ABSOLUTE_FLOOR = Math.max(0.02, sovereignRms10s * 0.08)
    const SOVEREIGN_EPICNESS_FLOOR = Math.max(0.05, sovereignRms10s * 0.12)
    const SOVEREIGN_ENERGY_FLOOR = 0.40

    if (!aborted) {
      if (v3EpicnessNow < SOVEREIGN_EPICNESS_ABSOLUTE_FLOOR) {
        aborted = true
        abortReason =
          `Universal epicness absolute floor (epicness=${v3EpicnessNow.toFixed(3)} < ${SOVEREIGN_EPICNESS_ABSOLUTE_FLOOR.toFixed(3)} rms10s=${sovereignRms10s.toFixed(2)})` +
          ` — liquid cognition denies any acoustic justification`
      } else if (v3EpicnessNow < SOVEREIGN_EPICNESS_FLOOR && ctx.titanState.rawEnergy < SOVEREIGN_ENERGY_FLOOR) {
        aborted = true
        abortReason =
          `Universal epicness floor (epicness=${v3EpicnessNow.toFixed(3)} < ${SOVEREIGN_EPICNESS_FLOOR.toFixed(3)}` +
          ` AND energy=${ctx.titanState.rawEnergy.toFixed(2)} < ${SOVEREIGN_ENERGY_FLOOR})` +
          ` — no acoustic justification for Sovereign Clock fire`
      }
    }

    if (aborted) {
      return {
        action: 'abort',
        candidate: null,
        reroutedEffectId: null,
        upgradedEffectId: null,
        reason: abortReason,
        trigger,
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🌊 WAVE 7575: ETA-AWARE UPGRADE — Light → Heavy cuando el clímax es real
    // ═══════════════════════════════════════════════════════════════════════
    // El DreamSimulator pre-bufferizó un efecto gentle/ambient porque Cassandra
    // predijo breakdown_imminent/energy_drop. PERO a veces el DJ lanza el clímax
    // JUSTO en el momento del disparo. Si hay bass real (>0.55, no vocal), Z alto
    // (>1.5), y el breakdown aún está lejos (ETA > 2500ms), aprovechamos el pico
    // y disparamos un heavy/peak en vez de desperdiciar el clímax con un gentle.
    //
    // Condiciones (TODAS deben cumplirse):
    //   1. El candidato es gentle/ambient (aggression <= 0.70, no heavy, no divine)
    //   2. ETA > 2500ms (el breakdown NO es inminente — hay margen para el heavy)
    //   3. bass > 0.55 (bombo real, no autotune — más estricto que el gate de 0.45)
    //   4. Z > 1.5 (anomalía estadística real)
    //   5. rawEnergy > 0.70 (energía física alta)
    // ═══════════════════════════════════════════════════════════════════════
    let upgradedEffectId: string | null = null
    if (!heavyRerouted && registryEntry) {
      const isGentleCandidate = !registryEntry.simMeta.isHeavyCandidate
        && !registryEntry.simMeta.isDivineCandidate
        && (registryEntry.dna.aggression ?? 0) <= 0.70

      const UPGRADE_ETA_MIN_MS = 2500
      const UPGRADE_BASS_MIN = 0.55
      const UPGRADE_Z_MIN = 1.5
      const UPGRADE_ENERGY_MIN = 0.70

      const etaMs = bufferStatus.predictedEventAt - ctx.now
      const canUpgrade = isGentleCandidate
        && etaMs > UPGRADE_ETA_MIN_MS
        && ctx.titanState.bass > UPGRADE_BASS_MIN
        && ctx.currentZScore > UPGRADE_Z_MIN
        && ctx.titanState.rawEnergy > UPGRADE_ENERGY_MIN

      if (canUpgrade) {
        const vibeArsenal = getDynamicEffectRegistry().getEffectsForVibe(ctx.titanState.vibeId ?? '')
        upgradedEffectId = selectUpgradeCandidate(vibeArsenal, ctx.effectHistory, ctx.now)
        if (upgradedEffectId) {
          console.log(
            `[Sovereign Clock ⚡] ETA-AWARE UPGRADE: "${candidate.effectName ?? candidate.effect}" → "${effectDisplayName(upgradedEffectId)}"` +
            ` | ETA=${etaMs.toFixed(0)}ms > ${UPGRADE_ETA_MIN_MS}` +
            ` bass=${ctx.titanState.bass.toFixed(3)} > ${UPGRADE_BASS_MIN}` +
            ` Z=${ctx.currentZScore.toFixed(2)}σ > ${UPGRADE_Z_MIN}` +
            ` E=${ctx.titanState.rawEnergy.toFixed(3)} > ${UPGRADE_ENERGY_MIN}` +
            ` — clímax real detectado, breakdown lejos, aprovechar el pico`
          )
        }
      }
    }

    // ── FIRE ──
    return {
      action: 'fire',
      candidate,
      reroutedEffectId: heavyRerouted ? reroutedEffectId : null,
      upgradedEffectId,
      reason: null,
      trigger,
    }
  }
}
