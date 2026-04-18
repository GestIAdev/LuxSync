/**
 * =============================================================================
 * STROBE STORM - TORMENTA MULTI-ZONA
 * =============================================================================
 *
 * WAVE 680:    THE ARSENAL — Primera arma de asalto
 * WAVE 1004.4: THE LATINO LADDER — Posicionado en PEAK ZONE (A=0.95)
 * WAVE 2214:   THE REAL STORM — Era un pequeño flash azul. Arreglado.
 * WAVE 2700:   LA VERDADERA TORMENTA — Rediseño total. Caos puro.
 * WAVE 3300:   LA TORMENTA MULTI-ZONA — Reescritura total.
 *              Inspirado en GatlingRaid pero libre y caótico.
 *              NO usamos canal strobe nativo. DIMMER es dios.
 *              Pulsos ultra-rápidos de dimmer simulan strobe
 *              con más control, más musicalidad y sin artefactos
 *              de shutter mecánico.
 *
 * DNA PROFILE (THE LATINO LADDER):
 *   Aggression:  0.98  — PEAK ZONE MÁXIMO
 *   Complexity:  0.90  — Caos multi-zona concurrente
 *   Organicity:  0.10  — Mecánico/Brutal/Industrial
 *   Duration:    SHORT — COLOR PASS-THROUGH movers
 *
 * ARQUITECTURA (WAVE 3300):
 *
 *   FILOSOFÍA DE HARDWARE:
 *   Canal "strobe" nativo de fixtures = shutter mecánico.
 *   No todos los fixtures lo tienen, y los que lo tienen
 *   tienen latencia y artefactos mecánicos (ruido, drift).
 *   Solución: DIMMER es dios. Pulsos on/off de dimmer a
 *   20-30 Hz simulan strobe con precisión de frame.
 *   (misma técnica que GatlingRaid — cero strobeRate en output)
 *
 *   FASES:
 *   1. PRE-BLACKOUT (60ms)
 *      Silencio total. Contraste máximo. La calma antes del caos.
 *
 *   2. VOLLEY BURST (800ms)
 *      7 voleas paralelas e independientes, cada una con su propio
 *      half-cycle determinista. Las zonas no parpadean en sincronía —
 *      la asimetría entre ellas ES la tormenta.
 *
 *      ZONAS (independientes):
 *        front-left    -> volley 0
 *        front-center  -> volley 1
 *        front-right   -> volley 2
 *        back-left     -> volley 3
 *        back-right    -> volley 4
 *        movers-left   -> volley 5 (PASS-THROUGH color)
 *        movers-right  -> volley 6 (PASS-THROUGH color)
 *
 *      Cada volley tiene su propio acumulador de tiempo, su propio
 *      half-cycle y su propia fase inicial (calculada desde BPM y
 *      el índice de zona — determinista, sin Math.random).
 *
 *   3. DECAY (150ms)
 *      Zonas se apagan en cascada (front primero, movers último).
 *      No es una rampa lineal — es un countdown de slots.
 *
 *   NOTAS:
 *   - Sin canal strobeRate en output (dimmer puro)
 *   - Movers: color: undefined -> PASS-THROUGH (Layer 0 manda el color)
 *   - StrobeStorm solo dispara dimmer en movers, nunca reemplaza color
 *   - Chaos engine 100% determinista (BPM + beatPhase + zone index)
 *
 * @module core/effects/library/fiestalatina/StrobeStorm
 * @version WAVE 680, 1004.4, 2214, 2700, 3300
 */

import { BaseEffect } from '../../BaseEffect'
import {
  EffectTriggerConfig,
  EffectFrameOutput,
  EffectPhase,
  EffectCategory,
} from '../../types'

// =============================================================================
// CONFIGURATION
// =============================================================================

interface StrobeStormConfig {
  /** Pre-blackout antes del primer burst (ms) */
  preBlackoutMs: number
  /** Duración del volley burst principal (ms) */
  burstMs: number
  /** Duración del decay en cascada (ms) */
  decayMs: number
  /** Frecuencia base de strobe (Hz) — modulada por BPM */
  burstFrequencyHz: number
  /** Frecuencia máxima permitida (Hz) — techo absoluto de hardware */
  maxFrequencyHz: number
  /** ¿Modo degradado? (forzado por vibe restrictivo) */
  degradedMode: boolean
}

const DEFAULT_CONFIG: StrobeStormConfig = {
  preBlackoutMs:    60,   // Silencio quirúrgico antes del caos
  burstMs:          800,  // 800ms de infierno multi-zona
  decayMs:          150,  // Cascada de apagado por zona
  burstFrequencyHz: 22,   // 22Hz base — agresivamente latino
  maxFrequencyHz:   28,   // Techo (debajo del límite perceptivo ~30Hz)
  degradedMode:     false,
}

// Zonas que participan en la tormenta y su orden de decay.
// Índice 0..6 — usado como semilla para el chaos engine (determinista).
const STORM_ZONES = [
  'front-left',    // 0
  'front-center',  // 1
  'front-right',   // 2
  'back-left',     // 3
  'back-right',    // 4
  'movers-left',   // 5 — COLOR PASS-THROUGH
  'movers-right',  // 6 — COLOR PASS-THROUGH
] as const

type StormZone = (typeof STORM_ZONES)[number]

// Zonas de movers que NO reciben color (pass-through)
const MOVER_ZONES: ReadonlySet<string> = new Set(['movers-left', 'movers-right'])

// =============================================================================
// VOLLEY STATE — un "cañón" independiente por zona
// =============================================================================

interface VolleyState {
  accMs: number       // Acumulador de tiempo dentro del half-cycle
  isOn: boolean       // Estado del flash en esta zona
  halfCycleMs: number // Duración de cada mitad del ciclo (calculada en init)
}

// =============================================================================
// STROBE STORM CLASS
// =============================================================================

export class StrobeStorm extends BaseEffect {
  // ---------------------------------------------------------------------------
  // ILightEffect required properties
  // ---------------------------------------------------------------------------

  readonly effectType = 'strobe_storm'
  readonly name = 'Strobe Storm'
  readonly category: EffectCategory = 'physical'
  readonly priority                  = 90
  readonly mixBus = 'global' as const  // Dictador — suprime Layer 0 durante tormenta

  // ---------------------------------------------------------------------------
  // Internal state
  // ---------------------------------------------------------------------------

  private config: StrobeStormConfig
  private phaseStartMs = 0

  // Un estado de volley independiente por zona
  private volleys: VolleyState[] = []

  // Qué zonas siguen activas en la fase decay (se apagan en cascada)
  private activeInDecay: boolean[] = []

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  constructor(config?: Partial<StrobeStormConfig>) {
    super('strobe_storm')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // ---------------------------------------------------------------------------
  // PUBLIC: Vibe constraints (called by EffectManager before trigger)
  // ---------------------------------------------------------------------------

  public setVibeConstraints(maxHz: number, degraded: boolean): void {
    this.config.maxFrequencyHz = maxHz > 0 ? maxHz : DEFAULT_CONFIG.maxFrequencyHz
    this.config.degradedMode   = degraded
  }

  // ---------------------------------------------------------------------------
  // ILightEffect implementation
  // ---------------------------------------------------------------------------

  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    this.phase        = 'attack'  // attack = pre-blackout
    this.phaseStartMs = this.elapsedMs

    // Inicializar volleys — un cañón por zona, con phase offset determinista.
    // Derivado del BPM y del índice de zona — sin Math.random.
    //   offset = (i × beatsub32) % halfCycleMs
    //   donde beatsub32 = período de un 32avo de beat en ms
    const bpm         = this.getCurrentBpm(128)
    const baseHz      = Math.min(this.config.burstFrequencyHz, this.config.maxFrequencyHz)
    const baseHalfMs  = 500 / baseHz

    this.volleys = STORM_ZONES.map((_, i) => {
      const beatsub32Ms   = (60000 / bpm) / 32
      const phaseOffsetMs = (i * beatsub32Ms) % baseHalfMs

      return {
        accMs:       phaseOffsetMs,  // Arrancar ya desincronizadas
        isOn:        i % 2 === 0,    // Alternar estado inicial por índice
        halfCycleMs: this.computeHalfCycle(i),
      }
    })

    this.activeInDecay = STORM_ZONES.map(() => true)

    const mode = this.config.degradedMode ? ' [DEGRADED]' : ''
    console.log(
      `[StrobeStorm] TRIGGERED! baseHz=${baseHz} maxHz=${this.config.maxFrequencyHz} zones=${STORM_ZONES.length}${mode}`
    )
  }

  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return

    this.elapsedMs    += deltaMs
    const phaseElapsed = this.elapsedMs - this.phaseStartMs

    switch (this.phase) {
      case 'attack':
        if (phaseElapsed >= this.config.preBlackoutMs) {
          this.transitionPhase('sustain')
          // Recalcular halfCycles con BPM actualizado al inicio del burst
          this.volleys.forEach((v, i) => {
            v.halfCycleMs = this.computeHalfCycle(i)
          })
        }
        break

      case 'sustain':
        this.advanceAllVolleys(deltaMs)
        // Recalcular halfCycles cada frame (BPM puede cambiar en vivo)
        this.volleys.forEach((v, i) => {
          v.halfCycleMs = this.computeHalfCycle(i)
        })
        if (phaseElapsed >= this.config.burstMs) {
          this.transitionPhase('decay')
        }
        break

      case 'decay': {
        this.advanceAllVolleys(deltaMs)
        // Apagar zonas en cascada: front primero (índice bajo), movers último (índice alto)
        const decayProgress = Math.min(1, phaseElapsed / this.config.decayMs)
        const slotSize       = 1 / STORM_ZONES.length
        STORM_ZONES.forEach((_, i) => {
          if (decayProgress >= slotSize * (i + 1)) {
            this.activeInDecay[i] = false
          }
        })
        if (decayProgress >= 1) {
          this.transitionPhase('finished')
          console.log(`[StrobeStorm] Impact complete — ${this.elapsedMs.toFixed(0)}ms total`)
        }
        break
      }
    }
  }

  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null

    // PRE-BLACKOUT: silencio total — contraste máximo antes del primer flash
    if (this.phase === 'attack') {
      return this.buildBlackoutOutput()
    }

    // DEGRADED: pulso duro de 2 beats cuando el vibe lo restringe
    if (this.config.degradedMode) {
      return this.getDegradedOutput()
    }

    return this.buildStormOutput()
  }

  // ---------------------------------------------------------------------------
  // Volley engine
  // ---------------------------------------------------------------------------

  private advanceAllVolleys(deltaMs: number): void {
    for (let i = 0; i < this.volleys.length; i++) {
      const v = this.volleys[i]
      // En decay, no avanzar las zonas ya apagadas
      if (this.phase === 'decay' && !this.activeInDecay[i]) continue

      v.accMs += deltaMs
      while (v.accMs >= v.halfCycleMs) {
        v.accMs -= v.halfCycleMs
        v.isOn   = !v.isOn
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Half-cycle computation — CHAOS ENGINE (determinista, sin Math.random)
  //
  // El "caos" es musical: nace del BPM (ritmo real de la pista),
  // del beatPhase (posición exacta dentro del beat), y del índice
  // de zona (desincronización geográfica de los fixtures).
  //
  // Cada zona tiene un half-cycle ligeramente diferente, creando
  // la asimetría visual que percibimos como "tormenta".
  // ---------------------------------------------------------------------------

  private computeHalfCycle(zoneIndex: number): number {
    const bpm       = this.getCurrentBpm(128)
    const beatPhase = this.musicalContext?.beatPhase ?? 0

    // Frecuencia base modulada por intensidad de trigger
    const baseHz = Math.min(
      this.config.burstFrequencyHz * this.triggerIntensity,
      this.config.maxFrequencyHz
    )

    // Asimetría determinista por beatPhase (misma lógica que WAVE 2700)
    // beatPhase oscila 0→1 cada beat; fracturamos en 32nds
    const subGrid  = (beatPhase * 32) % 1  // posición dentro de un 32nd
    const beatAsym = subGrid < 0.5 ? 1.10 : 0.85

    // Desincronización geográfica: cada zona desvía +N% respecto a la base.
    // Zona 0: +0%, zona 1: +6.25% (1/16 de beat), zona 2: +12.5%, etc.
    // Períodos de subdivisión de beat — musicalmente coherente.
    const zoneDetuneRatio = 1 + ((zoneIndex % 4) * 0.0625)

    const effectiveHz = Math.min(baseHz * beatAsym * zoneDetuneRatio, this.config.maxFrequencyHz)
    const clampedHz   = Math.max(effectiveHz, 1)  // mínimo 1 Hz (evitar div/0)

    return 500 / clampedHz
  }

  // ---------------------------------------------------------------------------
  // Output builders
  // ---------------------------------------------------------------------------

  private buildBlackoutOutput(): EffectFrameOutput {
    return {
      effectId:          this.id,
      category:          this.category,
      phase:             this.phase,
      progress:          0,
      zones:             this.zones,
      intensity:         0,
      dimmerOverride:    0,
      globalComposition: 1.0,
      zoneOverrides: {
        front:        { dimmer: 0, blendMode: 'replace' },
        back:         { dimmer: 0, blendMode: 'replace' },
        'all-movers': { dimmer: 0, blendMode: 'replace' },
      },
    }
  }

  private buildStormOutput(): EffectFrameOutput {
    const progress = this.calculateProgress()

    // Intensidad global del frame: si alguna zona está ON, el output no es cero
    const anyOn = this.volleys.some((v, i) =>
      v.isOn && (this.phase !== 'decay' || this.activeInDecay[i])
    )
    const globalIntensity = anyOn ? this.triggerIntensity : 0

    // Construir zoneOverrides para cada zona de la tormenta.
    // CLAVE: NO enviamos strobeRate — usamos dimmer puro.
    //   El canal shutter/strobe nativo queda en 0 (desactivado).
    //   El HAL/HarmonicQuantizer pasa dimmer inmediatamente (no cuantizado).
    const zoneOverrides: Record<string, {
      color?: { h: number; s: number; l: number } | undefined
      dimmer: number
      blendMode: 'replace'
    }> = {}

    STORM_ZONES.forEach((zone, i) => {
      const volley  = this.volleys[i]
      const active  = this.phase !== 'decay' || this.activeInDecay[i]
      const dimmer  = active && volley.isOn ? this.triggerIntensity : 0
      const isMover = MOVER_ZONES.has(zone)

      zoneOverrides[zone] = {
        // Movers: PASS-THROUGH — Layer 0 aporta el color base del vibe.
        // StrobeStorm solo controla el dimmer de los movers.
        // PAR/wash front+back: blanco puro (máximo impacto fotónico).
        color:     isMover ? undefined : { h: 0, s: 0, l: 100 },
        dimmer,
        blendMode: 'replace',
      }
    })

    return {
      effectId:          this.id,
      category:          this.category,
      phase:             this.phase,
      progress,
      zones:             this.zones,
      intensity:         globalIntensity,
      // Sin strobeRate — dimmer es el canal de control exclusivo
      dimmerOverride:    globalIntensity,
      globalComposition: 1.0,
      zoneOverrides,
    }
  }

  private getDegradedOutput(): EffectFrameOutput {
    // Modo degradado (vibe restrictivo). Corte duro ON/OFF cada 2 beats.
    // Sin sinusoide, sin rampa. Degradado no es cariñoso.
    const bpm         = this.getCurrentBpm(120)
    const msPerBeat   = 60000 / bpm
    const cutPeriodMs = msPerBeat * 2
    const pos         = (this.elapsedMs % cutPeriodMs) / cutPeriodMs
    const dimmer      = pos < 0.5 ? this.triggerIntensity : 0

    return {
      effectId:          this.id,
      category:          this.category,
      phase:             this.phase,
      progress:          this.calculateProgress(),
      zones:             this.zones,
      intensity:         dimmer,
      dimmerOverride:    dimmer,
      globalComposition: 1.0,
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private transitionPhase(newPhase: EffectPhase): void {
    this.phase        = newPhase
    this.phaseStartMs = this.elapsedMs
  }

  private calculateProgress(): number {
    const total = this.config.preBlackoutMs + this.config.burstMs + this.config.decayMs
    return Math.min(1, this.elapsedMs / total)
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createStrobeStorm(config?: Partial<StrobeStormConfig>): StrobeStorm {
  return new StrobeStorm(config)
}
