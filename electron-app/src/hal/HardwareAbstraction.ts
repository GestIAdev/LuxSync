/**
 * 🏛️ WAVE 215: HARDWARE ABSTRACTION FACADE
 * 
 * The "Grand Connector" - The single entry point to all hardware.
 * 
 * COMPOSITION:
 * - PhysicsEngine: Decay, inertia, hysteresis
 * - ZoneRouter: Zone-to-fixture mapping
 * - FixtureMapper: Intent-to-DMX conversion
 * - Driver: USB/ArtNet/Mock output
 * 
 * MASTER METHOD: render(intent, fixtures)
 * Orchestrates the complete pipeline:
 * 1. Router → Determine which fixtures respond
 * 2. Physics → Apply decay/inertia
 * 3. Mapper → Convert to fixture states
 * 4. Driver → Send DMX
 * 
 * 🐟 WAVE 2042.20: BABEL FISH - Color Translation Layer
 * - ColorTranslator integration in renderFromTarget()
 * - Automatic RGB → ColorWheel DMX translation
 * - Profile-based detection of wheel fixtures
 * - Safety layer for debounce/strobe delegation
 * 
 * @layer HAL
 * @version TITAN 2.0 + BABEL FISH
 * 🎵 WAVE 2211: PIPELINE EXORCISM — Real beatPhase injection + Physics profile cache
 */

import {
  type LightingIntent,
  type DMXPacket,
  hslToRgb,
  createEmptyUniverse,
} from '../core/protocol'

import { PhysicsEngine } from './physics/PhysicsEngine'
import { ZoneRouter, type PhysicalZone, type VibeRouteConfig, type ZoneIntensityInput } from './mapping/ZoneRouter'
import { FixtureMapper, type PatchedFixture, type FixtureState, type MovementState } from './mapping/FixtureMapper'
import { type IDMXDriver, type DriverType, MockDMXDriver } from './drivers'
import { USBDMXDriverAdapter } from './drivers/USBDMXDriverAdapter'

// � WAVE 2042.20: BABEL FISH - Color Translation Layer
import { 
  getColorTranslator, 
  type RGB,
  type ColorTranslationResult 
} from './translation/ColorTranslator'
import { 
  getProfile, 
  getProfileByModel,
  needsColorTranslation,
  generateProfileFromDefinition,
  isMechanicalFixture,
  type FixtureProfile 
} from './translation'
import { getHardwareSafetyLayer } from './translation/HardwareSafetyLayer'
import { getDarkSpinFilter } from './translation/DarkSpinFilter'
// 🎵 WAVE 2720: LA LEY UNIVERSAL DEL PÉNDULO — HarmonicQuantizer universal en HAL
import { getHarmonicQuantizer } from './translation/HarmonicQuantizer'

// 🔧 WAVE 338: Movement Physics Driver
import { FixturePhysicsDriver, type PhysicsProfile as DriverPhysicsProfile } from '../engine/movement/FixturePhysicsDriver'
import { getOpticsConfig, type OpticsConfig } from '../engine/movement/VibeMovementPresets'

// � WAVE 2228: DMX ADUANA — Import arbiter for output gate enforcement at HAL level
import { masterArbiter, ControlLayer } from '../core/arbiter'
import * as fs from 'fs'
import * as path from 'path'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Audio metrics required for physics calculations */
export interface AudioMetrics {
  rawBass: number
  rawMid: number
  rawTreble: number
  energy: number
  isRealSilence: boolean
  isAGCTrap: boolean
  // ═══════════════════════════════════════════════════════════════════════
  // 🎵 WAVE 2211: REAL BEAT PHASE — replaces hardcoded 120 BPM assumption
  // Sourced from PLL/Worker in TitanOrchestrator, propagated through HAL
  // for use in applyDynamicOptics() beat-synced effects.
  // ═══════════════════════════════════════════════════════════════════════
  beatPhase?: number   // 0-1, from PLL or Worker (defaults to 0 if absent)
  bpm?: number         // Real BPM for any future beat-duration calculations
  // ═══════════════════════════════════════════════════════════════════════
  // 🎵 WAVE 2720: LA LEY UNIVERSAL DEL PÉNDULO — BPM confidence for HAL
  // Propagated from Worker → TitanOrchestrator → HAL for HarmonicQuantizer
  // universal gating in translateColorToWheel().
  // ═══════════════════════════════════════════════════════════════════════
  bpmConfidence?: number  // 0-1, from IntervalBPMTracker via Worker
}

/** HAL configuration */
export interface HALConfig {
  driverType: DriverType
  installationType: 'floor' | 'ceiling'
  debug: boolean
  /** 🎨 WAVE 686.10: Optional external driver (e.g., ArtNetDriverAdapter) */
  externalDriver?: IDMXDriver
}

/** HAL status for monitoring */
export interface HALStatus {
  isConnected: boolean
  driverType: DriverType
  framesRendered: number
  fixturesActive: number
  avgRenderTime: number
  lastRenderTime: number
}

// ═══════════════════════════════════════════════════════════════════════════
// HARDWARE ABSTRACTION CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class HardwareAbstraction {
  // Composed modules
  private physics: PhysicsEngine
  private router: ZoneRouter
  private mapper: FixtureMapper
  private driver: IDMXDriver
  
  // 🔧 WAVE 338: Movement Physics Driver for Pan/Tilt
  private movementPhysics: FixturePhysicsDriver
  private currentVibeId: string = 'idle'
  private currentOptics: OpticsConfig
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🗑️ WAVE 2211: PHYSICS PROFILE INJECTION CACHE
  // translateToDriverPhysicsProfile() was called 60×/sec PER FIXTURE,
  // creating a new DriverPhysicsProfile object each time even though
  // the fixture's physics profile NEVER changes at runtime.
  // Cache: Set<fixtureId> tracks which fixtures have already been injected.
  // Cleared on vibe change (setVibe()) to re-inject with new vibe config.
  // ═══════════════════════════════════════════════════════════════════════
  private injectedPhysicsProfiles = new Set<string>()
  
  //  WAVE 2042.20: BABEL FISH - Color Translation Singletons
  private colorTranslator = getColorTranslator()
  private safetyLayer = getHardwareSafetyLayer()
  // 🌑 WAVE 2690: DARK-SPIN — Blackout transitorio durante cambios de rueda de color
  private darkSpinFilter = getDarkSpinFilter()
  // 🎵 WAVE 2720: LA LEY UNIVERSAL DEL PÉNDULO — HarmonicQuantizer universal
  private harmonicQuantizer = getHarmonicQuantizer()
  private profileCache = new Map<string, FixtureProfile | null>()
  
  // 🎵 WAVE 2672: BPM cache per frame (set in renderFromTarget, read in translateColorToWheel)
  private currentFrameBpm = 0
  private currentFrameBpmConfidence = 0
  
  // 🔧 WAVE 340.2: Smoothed optics state (evita saltos bruscos)
  private smoothedZoomMod: number = 0
  private smoothedFocusMod: number = 0
  
  // 🔬 WAVE 2960: ONE-SHOT file logger — sin spam en consola
  // DISABLED: Sonda desactivada post-WAVE 2961 (color coherence fix confirmed)
  // private static readonly _w2960LogPath = path.join(process.cwd(), 'logs', 'w2960-last-mile.log')
  // 🔬 WAVE 2960 v2: rate-limit por tiempo en lugar de one-shot por clave
  // private readonly _w2960LastLogTime = new Map<string, number>()
  // private static readonly _W2960_HAL_COOLDOWN_MS = 1000  // 1s de cooldown por clave
  // private _w2960DirReady = false
  // private _w2960Log(key: string, msg: string): void {
  //   const now = Date.now()
  //   const last = this._w2960LastLogTime.get(key) ?? 0
  //   if (now - last < HardwareAbstraction._W2960_HAL_COOLDOWN_MS) return
  //   this._w2960LastLogTime.set(key, now)
  //   if (!this._w2960DirReady) {
  //     try { fs.mkdirSync(path.dirname(HardwareAbstraction._w2960LogPath), { recursive: true }) } catch { /* ok */ }
  //     this._w2960DirReady = true
  //   }
  //   const line = `[${new Date().toISOString()}] ${msg}\n`
  //   try { fs.appendFileSync(HardwareAbstraction._w2960LogPath, line, 'utf-8') } catch { /* nunca bloquear */ }
  // }

  // Configuration
  private config: HALConfig
  
  // State
  private framesRendered = 0
  private lastRenderTime = 0
  private renderTimes: number[] = []
  private universeBuffers = new Map<number, Uint8Array>()
  private lastFixtureStates: FixtureState[] = []
  private lastDebugTime = 0  // WAVE 256.7: For throttled debug logging
  // 🏎️ WAVE 2074.2: Real deltaTime measurement for physics
  private lastPhysicsFrameTime = 0
  // (BPM fields declared above — WAVE 2720)

  
  // Current vibe preset (for physics)
  // 🔥 WAVE 279.5: HEART vs SLAP - Filosofía de zonas
  // FRONT PARS (Bass/Heart): bom bom bom - presión en el pecho, no agresivo
  // BACK PARS (Mid/Snare): PAF! - bofetada en la cara, explosivo
  // 🎚️ WAVE 287: TECHNO BASS GATE - Subir gate para ignorar bass constante
  //    El techno tiene bass 24/7, necesitamos reaccionar solo a KICKS reales
  private currentPreset: VibeRouteConfig = {
    parGate: 0.15,           // 🎚️ WAVE 287: Subido (era 0.08) - ignora bass de fondo
    parGain: 2.5,            // 🎚️ WAVE 287: Bajado (era 3.5) - menos saturación
    parMax: 0.78,            // Heart: techo limitado (dejar espacio a backs)
    backParGate: 0.15,       // Slap: ignora ruido de fondo
    backParGain: 2.8,        // Slap: ganancia para rango dinámico
    backParMax: 1.0,         // Slap: ¡BOFETADA COMPLETA! PAF!
    melodyThreshold: 0.10,   // Movers: activan fácil con melodía
    decaySpeed: 2,
    moverDecaySpeed: 3,
  }
  
  constructor(config: Partial<HALConfig> = {}) {
    this.config = {
      driverType: config.driverType ?? 'mock',
      installationType: config.installationType ?? 'floor',
      debug: config.debug ?? true,
      externalDriver: config.externalDriver,
    }
    
    // Instantiate composed modules
    this.physics = new PhysicsEngine()
    this.router = new ZoneRouter()
    this.mapper = new FixtureMapper()
    
    // 🔧 WAVE 338: Movement Physics Driver
    this.movementPhysics = new FixturePhysicsDriver()
    this.currentOptics = getOpticsConfig('idle')
    
    // 🔥 WAVE 2100: Si hay externalDriver (ej. CompositeDMXDriver), usarlo SIEMPRE.
    // El Composite ya tiene USB + ArtNet internamente, no crear otro adaptador USB.
    if (this.config.externalDriver) {
      this.driver = this.config.externalDriver
    } else if ((this.config.driverType as unknown as string) === 'usb' || (this.config.driverType as unknown as string) === 'usb-serial') {
      this.driver = this.createDriver('usb')
    } else {
      this.driver = this.createDriver(this.config.driverType)
    }
    
    // Configure mapper
    this.mapper.setInstallationType(this.config.installationType)
    
    // Initialize universe 1 (extract Uint8Array from DMXUniverse)
    this.universeBuffers.set(1, createEmptyUniverse(1).channels)
    
    // WAVE 2098: Boot silence
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🐍 WAVE 340.1 PASO 2: PHASE OFFSET (SNAKE FORMULA)
  // Convierte soldados sincronizados en bailarines desfasados
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Configuración de phase offset por vibe
   * Cada vibe tiene su estilo de desfase
   */
  private readonly PHASE_CONFIGS: Record<string, { offset: number; type: 'sync' | 'snake' | 'mirror' }> = {
    'techno-club':    { offset: Math.PI,     type: 'mirror' },   // Alternado par/impar
    'fiesta-latina':  { offset: Math.PI / 4, type: 'snake' },    // 45° cadena de caderas
    'pop-rock':       { offset: Math.PI / 3, type: 'snake' },    // 60° wall ondulante
    'chill-lounge':   { offset: Math.PI / 2, type: 'snake' },    // 90° ola de mar lenta
    'idle':           { offset: 0,           type: 'sync' },     // Sin movimiento
  }
  
  /**
   * 🐍 Aplica phase offset por fixture para crear efecto serpiente
   * 
   * @deprecated WAVE 2100 — CÓDIGO MUERTO INTENCIONAL
   * Este método SOLO es llamado desde renderFromIntent() (línea ~597),
   * flujo que está INACTIVO desde WAVE 2086.1 cuando se migró a 
   * renderFromTarget() como único flujo de renderizado activo.
   * 
   * NO ELIMINAR: Se mantiene como referencia arquitectónica para una
   * posible reactivación del flujo intent-based si se implementa
   * el motor de patrones procedurales (roadmap post-beta).
   * 
   * Última auditoría: WAVE 2100 — Confirmado dead code.
   * 
   * @param baseX - Posición X base del Engine (0-1)
   * @param baseY - Posición Y base del Engine (0-1)
   * @param pattern - Patrón de movimiento activo
   * @param fixtureIndex - Índice del fixture (para calcular offset)
   * @param zone - Zona del fixture (para mirror: MOVING_LEFT vs MOVING_RIGHT)
   * @param timeSeconds - Tiempo actual en segundos
   * @param bpm - BPM actual para frecuencia
   * @param phaseType - 🔧 WAVE 350: 'linear' = bypass, 'polar' = rotar (default)
   * @returns Posición modificada con phase offset
   */
  private applyPhaseOffset(
    baseX: number,
    baseY: number,
    pattern: string,
    fixtureIndex: number,
    zone: string,
    timeSeconds: number,
    bpm: number,
    phaseType: 'linear' | 'polar' = 'polar'
  ): { x: number; y: number } {
    // 🔧 WAVE 350: LINEAR BYPASS
    // Si phaseType === 'linear', el patrón ya aplicó desfase internamente
    if (phaseType === 'linear') {
      if (fixtureIndex === 0 && this.framesRendered % 30 === 0) {
        const inPan = Math.round((baseX - 0.5) * 540)
        const inTilt = Math.round((baseY - 0.5) * 270)
        console.log(`[🔬 LINEAR BYPASS] Pan:${inPan}° Tilt:${inTilt}° | Pattern:${pattern}`)
      }
      return { x: baseX, y: baseY }
    }
    
    const config = this.PHASE_CONFIGS[this.currentVibeId] || { offset: 0, type: 'sync' }
    
    // Si es sync, devolver posición sin modificar
    if (config.type === 'sync') {
      return { x: baseX, y: baseY }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔧 WAVE 341.4: PHASE OFFSET CORRECTO
    // 
    // ANTES: HAL recalculaba el pattern entero (duplicando trabajo de TitanEngine)
    // AHORA: HAL solo aplica un desfase TEMPORAL al movimiento base
    // 
    // La idea es que TitanEngine calcula "dónde debería estar el mover AHORA"
    // y HAL aplica un offset de tiempo para que cada mover esté en un punto
    // DIFERENTE de la misma trayectoria (efecto snake)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Calcular phase offset basado en fixture index
    const phaseOffset = fixtureIndex * config.offset
    const freq = Math.max(60, bpm) / 120
    
    // Amplitud desde la posición base (distancia al centro) - SIN reducir!
    const amplitudeX = baseX - 0.5  // -0.5 a +0.5 (lo que TitanEngine generó)
    const amplitudeY = baseY - 0.5
    
    // Magnitud del movimiento (para preservar la amplitud original)
    const magnitude = Math.sqrt(amplitudeX * amplitudeX + amplitudeY * amplitudeY)
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔍 DEBUG WAVE 341.5: Log SÍNCRONO con TitanEngine (cada 30 frames)
    // ═══════════════════════════════════════════════════════════════════════
    const shouldLog = fixtureIndex === 0 && this.framesRendered % 30 === 0
    if (shouldLog) {
      const inPan = Math.round((baseX - 0.5) * 540)
      const inTilt = Math.round((baseY - 0.5) * 270)
      console.log(`[🔬 PHASE IN] Pan:${inPan}° Tilt:${inTilt}° | Pattern:${pattern} | Mag:${magnitude.toFixed(3)}`)
    }
    
    // Si no hay movimiento, devolver centro
    if (magnitude < 0.01) {
      return { x: 0.5, y: 0.5 }
    }
    
    // Para patterns sinusoidales (wave, figure8, circle, sweep)
    // Solo aplicamos un offset TEMPORAL, no recalculamos la trayectoria
    switch (pattern) {
      // ═══════════════════════════════════════════════════════════════════
      // 🌊 WAVE, 💃 FIGURE8, 💫 CIRCLE, SWEEP: 
      // Mismo principio: desfase temporal, preservar amplitud de TitanEngine
      // ═══════════════════════════════════════════════════════════════════
      case 'wave':
      case 'figure8':
      case 'circle':
      case 'sweep':
        // En vez de recalcular el sin/cos, aplicamos el offset como rotación
        // de la posición alrededor del centro
        const angle = Math.atan2(amplitudeY, amplitudeX)  // Ángulo actual
        const phaseAngle = phaseOffset  // Offset en radianes
        
        // Rotar la posición por el phase offset
        const newAngle = angle + phaseAngle
        const resultX = 0.5 + Math.cos(newAngle) * magnitude
        const resultY = 0.5 + Math.sin(newAngle) * magnitude
        
        // 🔍 DEBUG WAVE 341.5: Log salida SÍNCRONO
        if (shouldLog) {
          const outPan = Math.round((resultX - 0.5) * 540)
          const outTilt = Math.round((resultY - 0.5) * 270)
          console.log(`[🔬 PHASE OUT] Pan:${outPan}° Tilt:${outTilt}° | Δ=${Math.round((resultX - baseX) * 540)}° (fixture 0 should be 0)`)
        }
        
        return { x: resultX, y: resultY }
      
      // ═══════════════════════════════════════════════════════════════════
      // 🏃 CHASE: Persecución láser (offset grande)
      // ═══════════════════════════════════════════════════════════════════
      case 'chase':
        const chasePhase = fixtureIndex * (Math.PI / 2)  // 90° entre fixtures
        // Para chase, sí recalculamos X pero preservamos el rango de TitanEngine
        return {
          x: 0.5 + Math.sin(timeSeconds * Math.PI * 2 * freq * 2 + chasePhase) * Math.abs(amplitudeX),
          y: baseY  // Tilt sigue el valor base (bass)
        }
      
      // ═══════════════════════════════════════════════════════════════════
      // 🪞 MIRROR: Puertas del infierno techno
      // MOVING_LEFT y MOVING_RIGHT se mueven en direcciones opuestas (SOLO PAN)
      // TILT es el mismo para ambos (búsqueda + bass punch)
      // ═══════════════════════════════════════════════════════════════════
      case 'mirror':
        // Determinar si es izquierda o derecha basado en zona
        const isLeftZone = zone.includes('LEFT') || zone.includes('left')
        const isRightZone = zone.includes('RIGHT') || zone.includes('right')
        
        // Si no es zona de mover, usar par/impar
        let mirrorSign = 1
        if (isLeftZone) {
          mirrorSign = 1   // LEFT mantiene dirección original
        } else if (isRightZone) {
          mirrorSign = -1  // RIGHT invierte PAN
        } else {
          // Fallback: par/impar
          mirrorSign = fixtureIndex % 2 === 0 ? 1 : -1
        }
        
        // 🔍 DEBUG: Log mirror logic (once per second)
        if (fixtureIndex < 2 && this.framesRendered % 30 === 0) {
          const finalX = 0.5 + amplitudeX * mirrorSign
          console.log(`[🪞 MIRROR] Fixture ${fixtureIndex} | Zone: "${zone}" | Sign=${mirrorSign} | baseX=${baseX.toFixed(3)} baseY=${baseY.toFixed(3)} → x=${finalX.toFixed(3)} y=${baseY.toFixed(3)}`)
        }
        
        // 🔥 WAVE 342.8: Solo invertir PAN (horizontal)
        // TILT es compartido (ambos apuntan al mismo nivel vertical)
        // Esto crea el efecto de puertas que se abren/cierran horizontalmente
        return {
          x: 0.5 + amplitudeX * mirrorSign,  // PAN invertido para espejo
          y: baseY                            // TILT compartido
        }
      
      // ═══════════════════════════════════════════════════════════════════
      // 🧘 STATIC: Respiración con phase offset sutil
      // ═══════════════════════════════════════════════════════════════════
      case 'static':
        const breathPhase = fixtureIndex * (Math.PI / 3)  // 60° offset
        return {
          x: baseX,
          y: 0.5 + Math.sin(timeSeconds * Math.PI * 0.2 + breathPhase) * 0.02 + amplitudeY
        }
      
      // ═══════════════════════════════════════════════════════════════════
      // DEFAULT: Para cualquier otro pattern, aplicar rotación de phase
      // ═══════════════════════════════════════════════════════════════════
      default:
        // Aplicar phase offset como rotación (igual que wave/figure8/circle)
        const defaultAngle = Math.atan2(amplitudeY, amplitudeX)
        const defaultPhaseAngle = phaseOffset
        const defaultNewAngle = defaultAngle + defaultPhaseAngle
        return {
          x: 0.5 + Math.cos(defaultNewAngle) * magnitude,
          y: 0.5 + Math.sin(defaultNewAngle) * magnitude
        }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 👁️ WAVE 340.2: DYNAMIC OPTICS CON SMOOTHING
  // Las ópticas RESPIRAN con el movimiento - suave, sin saltos
  // ═══════════════════════════════════════════════════════════════════════
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🏎️ WAVE 2074.2: REAL DELTATIME — NO MORE HARDCODED 16ms
  // ⚡ WAVE 2750: WOODSTOCK PURGE — monotonic performance.now()
  //
  // Mide el tiempo real entre frames para que la física sea frame-rate
  // independent. Cap de 200ms para evitar explosiones numéricas en pausa.
  // Primer frame usa 16ms como semilla segura.
  // ═══════════════════════════════════════════════════════════════════════
  private measurePhysicsDeltaTime(): number {
    const now = performance.now()
    if (this.lastPhysicsFrameTime === 0) {
      this.lastPhysicsFrameTime = now
      return 16  // Primer frame: semilla segura
    }
    const dt = Math.min(200, now - this.lastPhysicsFrameTime)
    this.lastPhysicsFrameTime = now
    return Math.max(1, dt)  // Nunca 0 (protección div/0)
  }

  /**
   * 👁️ Aplica óptica dinámica basada en vibe y movimiento
   * 🔧 WAVE 340.2: Con SMOOTHING para evitar oscilaciones locas
   * 
   * @param movementIntensity - Qué tan lejos está del centro (0-1)
   * @param beatPhase - Fase del beat (0-1, 0=inicio del beat)
   * @param timeSeconds - Tiempo actual para breathing
   * @returns Modificadores de zoom y focus SUAVIZADOS
   */
  private applyDynamicOptics(
    movementIntensity: number,
    beatPhase: number,
    timeSeconds: number
  ): { zoomMod: number; focusMod: number } {
    
    // Calcular target basado en vibe
    let targetZoomMod = 0
    let targetFocusMod = 0
    
    // Factor de smoothing por vibe (más bajo = más lento)
    // 0.02 = muy suave (20+ frames para estabilizar)
    // 0.1 = moderado (10 frames)
    // 0.3 = rápido (3-4 frames)
    let smoothFactor = 0.05  // Default: suave
    
    switch (this.currentVibeId) {
      // ═══════════════════════════════════════════════════════════════════
      // 🍸 CHILL: Zoom RESPIRA muy lento (20s ciclo, smooth máximo)
      // ═══════════════════════════════════════════════════════════════════
      case 'chill-lounge':
        const breathCycle = Math.sin(timeSeconds * Math.PI * 0.1)  // 20s ciclo
        targetZoomMod = breathCycle * 8 + movementIntensity * 10  // Reducido: 8+10 max
        targetFocusMod = 15  // Siempre soft (nebuloso)
        smoothFactor = 0.02  // Ultra suave para chill
        break
      
      // ═══════════════════════════════════════════════════════════════════
      // 🎸 ROCK: Focus PUNCH en beat (más sutil, smooth rápido)
      // ═══════════════════════════════════════════════════════════════════
      case 'pop-rock':
        if (beatPhase < 0.15) {
          targetZoomMod = -5      // Reducido de -10
          targetFocusMod = -25    // Reducido de -50
        }
        smoothFactor = 0.15  // Rápido para el punch
        break
      
      // ═══════════════════════════════════════════════════════════════════
      // 🎛️ TECHNO: Beam pulsa suave (no epiléptico)
      // ═══════════════════════════════════════════════════════════════════
      case 'techno-club':
        const technoPhase = Math.pow(1 - beatPhase, 2)
        targetZoomMod = -10 * technoPhase  // Reducido de -20
        targetFocusMod = -5                 // Reducido de -10
        smoothFactor = 0.1  // Moderado
        break
      
      // ═══════════════════════════════════════════════════════════════════
      // 💃 LATINO: Zoom sigue baile (suave, orgánico)
      // ═══════════════════════════════════════════════════════════════════
      case 'fiesta-latina':
        targetZoomMod = movementIntensity * 15  // Reducido de 30
        targetFocusMod = 0
        smoothFactor = 0.05  // Suave como caderas
        break
      
      default:
        break
    }
    
    // 🔧 WAVE 340.2: Aplicar smoothing (exponential moving average)
    // newValue = oldValue + (target - oldValue) * smoothFactor
    this.smoothedZoomMod += (targetZoomMod - this.smoothedZoomMod) * smoothFactor
    this.smoothedFocusMod += (targetFocusMod - this.smoothedFocusMod) * smoothFactor
    
    return {
      zoomMod: Math.round(this.smoothedZoomMod),
      focusMod: Math.round(this.smoothedFocusMod)
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // MAIN RENDER PIPELINE
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🎯 MASTER METHOD: Render a LightingIntent to hardware.
   * 
   * This orchestrates the complete HAL pipeline:
   * 1. Calculate zone intensities using router + audio
   * 2. Apply physics (decay/inertia) to smooth values
   * 3. Map to fixture states (colors, movement)
   * 4. Apply effects and overrides
   * 5. Send to DMX driver
   * 
   * @param intent - Abstract lighting intent from Engine
   * @param fixtures - Patched fixture configuration
   * @param audio - Current audio metrics for physics
   * @returns Array of final fixture states (for UI broadcast)
   */
  public render(
    intent: LightingIntent,
    fixtures: PatchedFixture[],
    audio: AudioMetrics
  ): FixtureState[] {
    const startTime = performance.now()
    
    // Build audio input for router
    const audioInput = this.buildAudioInput(audio)
    
    // Process each fixture through the pipeline
    const fixtureStates = fixtures.map((fixture, fixtureIndex) => {
      const zone = (fixture.zone || 'UNASSIGNED') as PhysicalZone
      
      // 🔥 WAVE 290.1: Usar intent.zones como fuente de verdad
      // Mapeo: BACK_PARS→back, MOVING_LEFT→left, MOVING_RIGHT→right, FRONT_PARS→front
      // 🌊 WAVE 1035: 7-ZONE STEREO - Mapeo estéreo por posición X de fixture
      const intentZoneMap: Record<string, keyof typeof intent.zones> = {
        'BACK_PARS': 'back',
        'FRONT_PARS': 'front',
        'MOVING_LEFT': 'left',
        'MOVING_RIGHT': 'right',
        'AMBIENT': 'ambient',
      };
      
      // 🌊 WAVE 1035: 7-ZONE STEREO ROUTING
      // Si hay zonas estéreo disponibles (frontL/R, backL/R), usar posición X
      // para determinar si la fixture está a la izquierda o derecha
      const fixtureX = fixture.position?.x ?? 0;  // Negativo = izquierda, Positivo = derecha
      const isLeftSide = fixtureX < 0;
      
      // Determinar si tenemos datos estéreo de Chill
      const hasChillStereo = intent.zones.frontL !== undefined || intent.zones.frontR !== undefined;
      
      let intentZoneKey: keyof typeof intent.zones | undefined;
      
      if (hasChillStereo) {
        // 🌊 7-ZONE MODE: Usar zonas estéreo basadas en posición X
        if (zone === 'FRONT_PARS') {
          intentZoneKey = isLeftSide ? 'frontL' : 'frontR';
        } else if (zone === 'BACK_PARS') {
          intentZoneKey = isLeftSide ? 'backL' : 'backR';
        } else {
          // Movers y otras zonas usan mapeo normal
          intentZoneKey = intentZoneMap[zone];
        }
      } else {
        // LEGACY MODE: Mapeo mono tradicional
        intentZoneKey = intentZoneMap[zone];
      }
      
      const intentZoneValue = intentZoneKey ? intent.zones[intentZoneKey] : null;
      
      // 1. ROUTER: Si el Intent tiene intensidad para esta zona, úsala. Si no, calcula.
      let rawIntensity: number;
      if (intentZoneValue && intentZoneValue.intensity !== undefined) {
        rawIntensity = intentZoneValue.intensity;
      } else {
        rawIntensity = this.calculateZoneIntensity(zone, audioInput);
      }
      
      // 2. PHYSICS: Apply decay/inertia
      const physicsKey = `${fixture.dmxAddress}-${zone}`
      const zoneConfig = this.router.getZoneConfig(zone)
      const physicsType = zoneConfig?.physics.type || 'PAR'
      const decaySpeed = physicsType === 'MOVER' 
        ? this.router.getEffectiveMoverDecay(this.currentPreset)
        : this.currentPreset.decaySpeed
      
      const finalIntensity = this.physics.applyDecayWithPhysics(
        physicsKey,
        rawIntensity,
        decaySpeed,
        physicsType
      )
      
      // 3. MAPPER: Convert to fixture state
      // MovementIntent uses centerX/centerY (0-1), we map to pan/tilt
      // 🐍 WAVE 340.1 PASO 2: Apply phase offset for snake effect
      // Sin desfase = soldados marchando | Con desfase = bailarines
      const baseX = intent.movement?.centerX ?? 0.5
      const baseY = intent.movement?.centerY ?? 0.5
      const pattern = intent.movement?.pattern || 'static'
      
      // Get time for phase offset calculation
      // ⚡ WAVE 2750: WOODSTOCK PURGE — performance.now() monotónico, no epoch-based
      const timeSeconds = performance.now() / 1000
      // Use movement speed as BPM proxy (speed 0.5 = ~120 BPM)
      // TitanEngine calculates speed from actual BPM, so we reverse-engineer it
      const speedToBpm = (intent.movement?.speed || 0.5) * 240  // 0.5 → 120 BPM
      const bpm = Math.max(60, Math.min(180, speedToBpm))  // Clamp to reasonable range
      
      // 🔍 WAVE 347: Debug movement input
      if (fixtureIndex === 0 && this.framesRendered % 30 === 0) {
        const inputPan = Math.round((baseX - 0.5) * 540)
        const inputTilt = Math.round((baseY - 0.5) * 270)
        console.log(`[🔍 HAL INPUT] baseX:${baseX.toFixed(3)} baseY:${baseY.toFixed(3)} | Pan:${inputPan}° Tilt:${inputTilt}° | Amp:${intent.movement?.amplitude?.toFixed(2)}`)
      }
      
      // Apply phase offset based on fixture index
      // Uses this.currentVibeId which is set by the main render loop
      // 🔧 WAVE 350: Pass phaseType from intent
      const phaseOffsetted = this.applyPhaseOffset(
        baseX,
        baseY,
        pattern,
        fixtureIndex,
        zone,
        timeSeconds,
        bpm,
        intent.movement?.phaseType || 'polar'  // WAVE 350: Default 'polar' si no especificado
      )
      
      // Convert {x, y} to {pan, tilt} for MovementState
      const movement: MovementState = {
        pan: phaseOffsetted.x,
        tilt: phaseOffsetted.y,
      }
      
      return this.mapper.mapFixture(fixture, intent, finalIntensity, movement)
    })
    
    // 4. EFFECTS: Apply global effects and manual overrides
    const finalStates = this.mapper.applyEffectsAndOverrides(fixtureStates, performance.now())
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🎛️ WAVE 339.6: INJECT PHYSICS STATE INTO FIXTURE STATES
    // This adds the interpolated (physical) positions from the physics driver
    // So the frontend can visualize actual movement, not just targets
    // Uses REAL fixture IDs (from library) not synthetic ones
    // 👁️ WAVE 340.1 PASO 3: Also apply dynamic optics here
    // ═══════════════════════════════════════════════════════════════════════
    
    // Get timing info for dynamic optics
    const opticsTimeSeconds = performance.now() / 1000
    // 🎵 WAVE 2211: USE REAL BEAT PHASE from AudioMetrics (injected by orchestrator)
    // BEFORE: Calculated fake beatPhase from movement speed → erratic optics
    // AFTER: Real PLL/Worker beatPhase or 0 if no audio
    const beatPhase = audio.beatPhase ?? 0
    
    // 🏎️ WAVE 2074.2: Measure real deltaTime ONCE per frame (not per fixture)
    const physicsDt = this.measurePhysicsDeltaTime()
    
    const statesWithPhysics = finalStates.map((state, index) => {
      // 🔥 WAVE 339.6: Use real fixture ID from the fixtures array
      // This matches the ID registered in setFixtures() → registerMover()
      const fixture = fixtures[index]
      const fixtureId = fixture?.id || `fallback_mover_${index}`
      
      // Only apply physics to moving fixtures
      const isMovingFixture = state.zone.includes('MOVING') || 
                              state.type?.toLowerCase().includes('moving') ||
                              state.type?.toLowerCase().includes('spot') ||
                              state.type?.toLowerCase().includes('beam') ||
                              fixture?.hasMovementChannels
      
      // 👁️ WAVE 340.1 PASO 3: Calculate movement intensity for dynamic optics
      // How far from center (0.5, 0.5) is this fixture?
      const panNorm = state.pan / 255  // 0-1
      const tiltNorm = state.tilt / 255  // 0-1
      const movementIntensity = Math.sqrt(
        Math.pow(panNorm - 0.5, 2) + Math.pow(tiltNorm - 0.5, 2)
      ) * 2  // 0-1 (max at corners)
      
      // Apply dynamic optics (breathing zoom, focus punch, etc.)
      const opticsMod = this.applyDynamicOptics(movementIntensity, beatPhase, opticsTimeSeconds)
      
      // Calculate final zoom/focus with dynamic modifications
      const finalZoom = Math.max(0, Math.min(255, state.zoom + opticsMod.zoomMod))
      const finalFocus = Math.max(0, Math.min(255, state.focus + opticsMod.focusMod))
      
      if (isMovingFixture) {
        // 🧠 WAVE 2061 + 2088.6: INYECCIÓN DE PERFIL FÍSICO (CON TRADUCTOR)
        // 🗑️ WAVE 2211: Cached — only inject once per fixture (cleared on vibe change)
        if (!this.injectedPhysicsProfiles.has(fixtureId)) {
          const profile = this.getFixtureProfileCached(fixture)
          const rawPhysics = profile?.physics || (profile as any)?.physicsProfile || profile
          const driverProfile = this.translateToDriverPhysicsProfile(rawPhysics)
          if (driverProfile) {
            this.movementPhysics.updatePhysicsProfile(fixtureId, driverProfile)
          }
          this.injectedPhysicsProfiles.add(fixtureId)
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 🔧 WAVE 340.6 + 2074.2: DIRECT DMX INTERPOLATION
        // TitanEngine already generates target positions in DMX space (0-255)
        // We pass them DIRECTLY to physics without double-conversion
        // 🏎️ WAVE 2074.2: Using real measured deltaTime instead of hardcoded 16ms
        // ═══════════════════════════════════════════════════════════════════════
        
        // Run physics simulation with DMX target directly (no abstract conversion!)
        // 🔥 WAVE 2785: Detect manual position control → fast-track physics
        const sources = state._controlSources as Record<string, number> | undefined
        const isManualPosition = sources !== undefined && (
          sources['pan'] === ControlLayer.MANUAL || sources['tilt'] === ControlLayer.MANUAL
        )
        this.movementPhysics.translateDMX(fixtureId, state.pan, state.tilt, physicsDt, isManualPosition)
        
        // Get interpolated state
        const physicsState = this.movementPhysics.getPhysicsState(fixtureId)
        
        // 🔧 WAVE 2093.1 + 2603: Apply calibration offsets + tilt limits
        // 🎯 WAVE 2603: Pass ikProcessed flag to skip double-calibration
        const calibrated = this.applyCalibrationOffsets(
          physicsState.physicalPan,
          physicsState.physicalTilt,
          fixture,
          state._ikProcessed ?? false
        )
        
        return {
          ...state,
          zoom: finalZoom,     // 👁️ Dynamic optics
          focus: finalFocus,   // 👁️ Dynamic optics
          physicalPan: calibrated.pan,
          physicalTilt: calibrated.tilt,
          panVelocity: physicsState.panVelocity,
          tiltVelocity: physicsState.tiltVelocity,
        }
      }
      
      // Non-moving fixtures: physical = target (but still apply optics)
      return {
        ...state,
        zoom: finalZoom,     // 👁️ Dynamic optics
        focus: finalFocus,   // 👁️ Dynamic optics
        physicalPan: state.pan,
        physicalTilt: state.tilt,
        panVelocity: 0,
        tiltVelocity: 0,
      }
    })
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔍 WAVE 340.4: HAL DEBUG LOGGING para calibración
    // Log cada ~500ms (30 frames), compacto para ver movimiento real
    // ═══════════════════════════════════════════════════════════════════════
    if (this.framesRendered % 30 === 0) {
      // Encontrar primer mover para debug
      const movers = statesWithPhysics.filter(s => 
        s.zone.includes('MOVING') || s.type?.toLowerCase().includes('moving')
      )
      
      if (movers.length > 0) {
        const m = movers[0]
        const panDeg = Math.round(((m.pan / 255) - 0.5) * 540)
        const tiltDeg = Math.round(((m.tilt / 255) - 0.5) * 270)
        const physPanDeg = Math.round(((m.physicalPan / 255) - 0.5) * 540)
        const physTiltDeg = Math.round(((m.physicalTilt / 255) - 0.5) * 270)
        
        console.log(`[👁️ HAL] ${this.currentVibeId} | Target:${panDeg}°/${tiltDeg}° → Phys:${physPanDeg}°/${physTiltDeg}° | Z:${m.zoom} F:${m.focus}`)
      }
    }
    
    // 5. DRIVER: Send to hardware
    this.sendToDriver(statesWithPhysics)
    
    // Update stats
    this.framesRendered++
    this.lastRenderTime = performance.now() - startTime
    this.renderTimes.push(this.lastRenderTime)
    if (this.renderTimes.length > 100) this.renderTimes.shift()
    
    // Store for UI broadcast
    this.lastFixtureStates = statesWithPhysics
    
    // Debug logging (1% sample rate)
    if (this.config.debug && Math.random() < 0.01) {
      const activeCount = statesWithPhysics.filter(f => f.dimmer > 0).length
      console.log(
        `[HAL] 🔧 Render #${this.framesRendered} | ` +
        `Active: ${activeCount}/${statesWithPhysics.length} | ` +
        `Time: ${this.lastRenderTime.toFixed(2)}ms`
      )
    }
    
    return statesWithPhysics
  }
  
  /**
   * Simplified render for STUB/demo mode (uses intent directly).
   */
  public renderSimple(intent: LightingIntent): void {
    this.framesRendered++
    
    const primaryRGB = hslToRgb(intent.palette.primary)
    const intensity = (intent.masterIntensity * 100).toFixed(0)
    const zoneCount = Object.keys(intent.zones).length
    
    console.log(
      `[HAL] 🔧 Render #${this.framesRendered} | ` +
      `Intensity: ${intensity}% | ` +
      `RGB(${primaryRGB.r},${primaryRGB.g},${primaryRGB.b}) | ` +
      `Zones: ${zoneCount}`
    )
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎭 WAVE 374: RENDER FROM ARBITRATED TARGET
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🎭 WAVE 374: Render from MasterArbiter's FinalLightingTarget
   * 
   * This method accepts pre-arbitrated lighting values from MasterArbiter.
   * The arbiter has already merged:
   * - Layer 0: AI intent from TitanEngine
   * - Layer 1: Consciousness (CORE 3)
   * - Layer 2: Manual overrides
   * - Layer 3: Effects (strobe, flash)
   * - Layer 4: Blackout
   * 
   * HAL's responsibility now is ONLY:
   * - Apply physics (movement interpolation)
   * - Apply dynamic optics
   * - Send to DMX driver
   * 
   * @param target - Pre-arbitrated lighting target from MasterArbiter
   * @param fixtures - Patched fixture configuration
   * @param audio - Current audio metrics for physics
   * @returns Array of final fixture states (for UI broadcast)
   */
  public renderFromTarget(
    target: import('../core/arbiter').FinalLightingTarget,
    fixtures: PatchedFixture[],
    audio: AudioMetrics
  ): FixtureState[] {
    const startTime = performance.now()
    
    // 🎵 WAVE 2720: LA LEY UNIVERSAL DEL PÉNDULO — Cache BPM per frame
    // for HarmonicQuantizer in translateColorToWheel()
    this.currentFrameBpm = audio.bpm ?? 120
    this.currentFrameBpmConfidence = audio.bpmConfidence ?? 0
    
    // 🚫 BLACKOUT CHECK (arbiter already handled dimmer=0, but we can short-circuit)
    if (target.globalEffects.blackoutActive) {
      const blackoutStates: FixtureState[] = fixtures.map(fixture => ({
        fixtureId: fixture.id || fixture.name,  // 🔧 WAVE 2049.1: Propagate fixtureId
        name: fixture.name,
        type: fixture.type || 'generic',
        zone: (fixture.zone || 'UNASSIGNED') as PhysicalZone,
        dmxAddress: fixture.dmxAddress,
        universe: fixture.universe ?? 0,  // 🔥 WAVE 1219: ArtNet 0-indexed
        dimmer: 0,
        r: 0,
        g: 0,
        b: 0,
        pan: 128,
        tilt: 128,
        zoom: 128,
        focus: 128,
        physicalPan: 128,
        physicalTilt: 128,
        panVelocity: 0,
        tiltVelocity: 0,
      }))
      this.sendToDriver(blackoutStates)
      this.framesRendered++
      this.lastFixtureStates = blackoutStates
      return blackoutStates
    }
    
    // Map arbitrated targets to fixture states
    // 🎵 WAVE 2672: Cache BPM for HarmonicQuantizer (used in translateColorToWheel)
    this.currentFrameBpm = audio.bpm ?? 0
    this.currentFrameBpmConfidence = audio.bpmConfidence ?? 0
    
    const fixtureStates: FixtureState[] = fixtures.map((fixture, index) => {
      const fixtureId = fixture.id || fixture.name
      const zone = (fixture.zone || 'UNASSIGNED') as PhysicalZone
      
      // 🎨 WAVE 686.11: Normalize DMX address (ShowFileV2 uses "address", legacy uses "dmxAddress")
      const dmxAddress = fixture.dmxAddress || (fixture as any).address
      
      // 🎨 WAVE 687: Get channel definitions for dynamic mapping
      const channels = fixture.channels || []
      
      // Find this fixture's target from arbiter output
      const fixtureTarget = target.fixtures.find(t => t.fixtureId === fixtureId)
      
      if (fixtureTarget) {
        // Use arbitrated values directly
        const baseState: FixtureState = {
          fixtureId,  // 🔧 WAVE 2049.1: Propagate fixtureId to state (was undefined!)
          name: fixture.name,
          type: fixture.type || 'generic',
          zone,
          dmxAddress,  // 🎨 WAVE 686.11: Use normalized address
          universe: fixture.universe ?? 0,  // 🔥 WAVE 1219: ArtNet 0-indexed
          dimmer: fixtureTarget.dimmer,
          r: fixtureTarget.color.r,
          g: fixtureTarget.color.g,
          b: fixtureTarget.color.b,
          pan: fixtureTarget.pan,
          tilt: fixtureTarget.tilt,
          zoom: fixtureTarget.zoom,
          focus: fixtureTarget.focus,
          // 🔥 WAVE 1008.4: Movement speed from arbiter
          speed: fixtureTarget.speed,
          // 🎨 WAVE 1008.6: Color wheel position from arbiter (THE WHEELSMITH)
          colorWheel: fixtureTarget.color_wheel,
          // 🎨 WAVE 687: Include channel definitions for dynamic DMX mapping
          channels,
          // 🎨 WAVE 687: Default values for additional controls
          // 🔥 WAVE 2190: shutter UNDEFINED — Let FixtureMapper fall through to
          // channel.defaultValue ?? 255 (Open). Hardcoding 0 = CLOSED = blackout
          // on any fixture with a mechanical shutter channel.
          gobo: 0,
          prism: 0,
          strobe: 0,
          // 🔥 WAVE 2084: PHANTOM PANEL — Canales extra desde el Arbiter
          phantomChannels: fixtureTarget.phantomChannels,
          // 🚧 WAVE 2228: DMX ADUANA — Propagate control sources for HAL gate
          _controlSources: fixtureTarget._controlSources as Record<string, number>,
          // 🎯 WAVE 2603: Propagate IK processed flag to FixtureState
          _ikProcessed: fixtureTarget._ikProcessed ?? false,
        }
        
        // 🐟 WAVE 2042.20: BABEL FISH - Translate RGB to Color Wheel if needed
        // This is the KEY integration point: if fixture has color wheel profile,
        // convert the RGB values from Selene/Arbiter to the nearest wheel color DMX
        const translatedState = this.translateColorToWheel(
          baseState, 
          fixture, 
          fixtureTarget.color_wheel
        )
        
        return translatedState
      }
      
      // Fallback: fixture not in arbiter output (shouldn't happen)
      return {
        fixtureId,  // 🔧 WAVE 2049.1: Propagate fixtureId to state
        name: fixture.name,
        type: fixture.type || 'generic',
        zone,
        dmxAddress,  // 🎨 WAVE 686.11: Use normalized address
        universe: fixture.universe || 0,
        dimmer: 0,
        r: 0,
        g: 0,
        b: 0,
        pan: 128,
        tilt: 128,
        zoom: 128,
        focus: 128,
        // 🔥 WAVE 1008.4: Fast movement by default
        speed: 0,
        // 🎨 WAVE 1008.6: Color wheel off by default
        colorWheel: 0,
        // 🎨 WAVE 687: Include channel definitions for dynamic DMX mapping
        channels,
        shutter: 255,
        gobo: 0,
        prism: 0,
        strobe: 0,
      } as FixtureState
    })
    
    // Apply physics and dynamic optics (same as render())
    const opticsTimeSeconds = performance.now() / 1000
    // ═══════════════════════════════════════════════════════════════════════
    // 🎵 WAVE 2211: USE REAL BEAT PHASE — KILL THE FAKE 120 BPM
    //
    // BEFORE: beatDuration = 0.5 (hardcoded 120 BPM assumption)
    //         beatPhase = (time % 0.5) / 0.5 → constant 2 pulses/sec
    //         This made chill-lounge optics pulse at rock speed!
    //
    // AFTER:  beatPhase comes from PLL/Worker via AudioMetrics.
    //         If no real beat data, fall back to 0 (no pulsing).
    //         Optics now sync to ACTUAL music tempo, not a fake metronome.
    // ═══════════════════════════════════════════════════════════════════════
    const beatPhase = audio.beatPhase ?? 0
    
    // 🏎️ WAVE 2074.2: Measure real deltaTime ONCE per frame (not per fixture)
    const physicsDt = this.measurePhysicsDeltaTime()
    
    const statesWithPhysics = fixtureStates.map((state, index) => {
      const fixture = fixtures[index]
      const fixtureId = fixture?.id || `fallback_mover_${index}`
      
      const isMovingFixture = state.zone.includes('MOVING') || 
                              state.type?.toLowerCase().includes('moving') ||
                              state.type?.toLowerCase().includes('spot') ||
                              state.type?.toLowerCase().includes('beam') ||
                              fixture?.hasMovementChannels
      
      // Calculate movement intensity for optics
      const panNorm = state.pan / 255
      const tiltNorm = state.tilt / 255
      const movementIntensity = Math.sqrt(
        Math.pow(panNorm - 0.5, 2) + Math.pow(tiltNorm - 0.5, 2)
      ) * 2
      
      // Apply dynamic optics
      const opticsMod = this.applyDynamicOptics(movementIntensity, beatPhase, opticsTimeSeconds)
      const finalZoom = Math.max(0, Math.min(255, state.zoom + opticsMod.zoomMod))
      const finalFocus = Math.max(0, Math.min(255, state.focus + opticsMod.focusMod))
      
      if (isMovingFixture) {
        // 🧠 WAVE 2061 + 2088.6: INYECCIÓN DE PERFIL FÍSICO (CON TRADUCTOR)
        // 🗑️ WAVE 2211: Only inject on first encounter or after vibe change.
        // The fixture's physical profile (motor type, max velocity) doesn't change
        // at runtime. Re-translating + re-injecting 60×/sec was pure GC waste.
        if (!this.injectedPhysicsProfiles.has(fixtureId)) {
          const profile = this.getFixtureProfileCached(fixture)
          const rawPhysics = profile?.physics || (profile as any)?.physicsProfile || profile
          const driverProfile = this.translateToDriverPhysicsProfile(rawPhysics)
          if (driverProfile) {
            this.movementPhysics.updatePhysicsProfile(fixtureId, driverProfile)
          }
          this.injectedPhysicsProfiles.add(fixtureId)
        }

        // 🏎️ WAVE 2074.2: Apply physics interpolation with real deltaTime
        // 🔥 WAVE 2785.3: Detect manual position control → fast-track physics
        // BUGFIX: This was missing in renderFromTarget() — only existed in render()
        // Without this, manual overrides (Layer 2 pan/tilt) were interpolated through
        // vibe physics (Chill = maxVelocity 8 DMX/s = glacial), ignoring the operator.
        const sources = state._controlSources as Record<string, number> | undefined
        const isManualPosition = sources !== undefined && (
          sources['pan'] === ControlLayer.MANUAL || sources['tilt'] === ControlLayer.MANUAL
        )
        this.movementPhysics.translateDMX(fixtureId, state.pan, state.tilt, physicsDt, isManualPosition)
        const physicsState = this.movementPhysics.getPhysicsState(fixtureId)



        // 🔧 WAVE 2093.1 + 2603: Apply calibration offsets + tilt limits
        // 🎯 WAVE 2603: Pass ikProcessed flag to skip double-calibration
        const calibrated = this.applyCalibrationOffsets(
          physicsState.physicalPan,
          physicsState.physicalTilt,
          fixture,
          state._ikProcessed ?? false
        )
        
        return {
          ...state,
          zoom: finalZoom,
          focus: finalFocus,
          physicalPan: calibrated.pan,
          physicalTilt: calibrated.tilt,
          panVelocity: physicsState.panVelocity,
          tiltVelocity: physicsState.tiltVelocity,
        }
      }
      
      return {
        ...state,
        zoom: finalZoom,
        focus: finalFocus,
        physicalPan: state.pan,
        physicalTilt: state.tilt,
        panVelocity: 0,
        tiltVelocity: 0,
      }
    })
    
    // Send to hardware
    this.sendToDriver(statesWithPhysics)
    
    // Update stats
    this.framesRendered++
    this.lastRenderTime = performance.now() - startTime
    this.renderTimes.push(this.lastRenderTime)
    if (this.renderTimes.length > 100) this.renderTimes.shift()
    
    this.lastFixtureStates = statesWithPhysics
    
    return statesWithPhysics
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // � WAVE 2093.1: CALIBRATION INJECTION LAYER
  // Connects CalibrationLab offsets & PhysicsProfile tiltLimits to the
  // actual DMX output pipeline. Without this, calibration was "write-only".
  //
  // Applied AFTER FixturePhysicsDriver interpolation, BEFORE DMX emission.
  // Order of operations:
  //   1. Invert (flip axis direction if calibration says so)
  //   2. Offset (shift by degrees converted to DMX units)
  //   3. TiltLimits clamp (prevent aiming at audience)
  //   4. Final 0-255 clamp (never exceed DMX range)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * 🔧 WAVE 2093.1: Apply calibration offsets + tilt limits to physics-interpolated positions
   * 🎯 WAVE 2603: ikProcessed flag — skip invert/offset when IK already calibrated
   * 
   * @param physicalPan  - Raw interpolated pan from FixturePhysicsDriver (0-255)
   * @param physicalTilt - Raw interpolated tilt from FixturePhysicsDriver (0-255)
   * @param fixture      - The PatchedFixture (carries calibration + physics from ShowFileV2)
   * @param ikProcessed  - If true, skip INVERT and OFFSET (IK already applied them).
   *                        TiltLimits and final clamp are ALWAYS applied for safety.
   * @returns Calibrated { pan, tilt } clamped to 0-255
   */
  private applyCalibrationOffsets(
    physicalPan: number,
    physicalTilt: number,
    fixture: PatchedFixture,
    ikProcessed: boolean = false
  ): { pan: number; tilt: number } {
    // --- Read calibration data (from ShowFileV2.FixtureV2.calibration) ---
    // 🔧 WAVE 2093.3 (CW-AUDIT-9): Now properly typed in PatchedFixture — no more `as any`
    const cal = fixture.calibration

    // --- Read physics tilt limits (from ShowFileV2.FixtureV2.physics) ---
    // 🔧 WAVE 2093.3 (CW-AUDIT-9): Now properly typed in PatchedFixture — no more `as any`
    const physics = fixture.physics

    let pan = physicalPan
    let tilt = physicalTilt

    if (cal) {
      // 🎯 WAVE 2603: When IK has already processed calibration (invert + offset),
      // skip steps 1-2 to prevent double-calibration.
      // TiltLimits (step 3) and final clamp (step 4) are ALWAYS applied for safety.
      if (!ikProcessed) {
        // ── STEP 1: INVERT ──
        // If the fixture is mounted backwards/upside-down, flip the axis
        if (cal.panInvert) {
          pan = 255 - pan
        }
        if (cal.tiltInvert) {
          tilt = 255 - tilt
        }

        // ── STEP 2: OFFSET (degrees → DMX) ──
        // Pan range: typically 540° mapped to 0-255 DMX
        // Tilt range: typically 270° mapped to 0-255 DMX
        // Conversion: offsetDMX = (offsetDegrees / totalDegrees) × 255
        // 🔧 WAVE 2093.3 (CW-AUDIT-9): Industry-standard defaults, no `as any` casts
        if (cal.panOffset && cal.panOffset !== 0) {
          const PAN_RANGE_DEG = 540   // Standard moving head pan range
          const panOffsetDMX = (cal.panOffset / PAN_RANGE_DEG) * 255
          pan += panOffsetDMX
        }
        if (cal.tiltOffset && cal.tiltOffset !== 0) {
          const TILT_RANGE_DEG = 270  // Standard moving head tilt range
          const tiltOffsetDMX = (cal.tiltOffset / TILT_RANGE_DEG) * 255
          tilt += tiltOffsetDMX
        }
      }
    }

    // ── STEP 3: TILT LIMITS (CW-8 fix) ──
    // PhysicsProfile.tiltLimits defines the safe DMX range for tilt
    // This prevents the fixture from aiming at the audience
    if (physics?.tiltLimits) {
      tilt = Math.max(physics.tiltLimits.min, Math.min(physics.tiltLimits.max, tilt))
    }

    // ── STEP 4: FINAL CLAMP ──
    // No DMX value can ever leave the 0-255 range
    pan = Math.max(0, Math.min(255, Math.round(pan)))
    tilt = Math.max(0, Math.min(255, Math.round(tilt)))

    return { pan, tilt }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // �🐟 WAVE 2042.20: BABEL FISH - COLOR TRANSLATION LAYER
  // Translates RGB commands to Color Wheel DMX for fixtures that need it
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🐟 BABEL FISH: Get or create fixture profile (cached)
   */
  private getFixtureProfileCached(fixture: PatchedFixture): any {
    const cacheKey = fixture.profileId || fixture.name || fixture.id || 'unknown'
    
    // Si ya lo procesamos, devolverlo de la caché silenciosamente (ADIÓS SPAM)
    if (this.profileCache.has(cacheKey)) {
      return this.profileCache.get(cacheKey)
    }
    
    let profile: FixtureProfile | null = null;
    
    // 1. JSON inyectado en vivo desde la Forja
    // 🔧 WAVE 2093.3 (CW-AUDIT-9): Usa generateProfileFromDefinition para obtener un
    // FixtureProfile completo (con .safety, .shutter, etc.) en lugar del cast directo
    // que producía TypeError: Cannot read properties of undefined (reading 'blackoutOnColorChange')
    if (fixture.capabilities || fixture.wheels || fixture.physics) {
      profile = generateProfileFromDefinition({
        id: fixture.profileId || fixture.id || cacheKey,
        name: fixture.name || 'Unknown Fixture',
        type: fixture.type,
        channels: fixture.channels,
        capabilities: fixture.capabilities,
        wheels: fixture.wheels,
        physics: fixture.physics,
      }) ?? null;
    } 
    // 2. Búsqueda por ID formal
    else if (fixture.profileId) {
      profile = getProfile(fixture.profileId) ?? null;
    } 
    // 3. Heurística por nombre (Salvavidas)
    else if (fixture.name) {
      profile = getProfileByModel(fixture.name) ?? null;
    }
    
    // 4. 🔧 WAVE 2093.3 (CW-AUDIT-6): Auto-generate HAL profile from inline data
    //    If steps 1-3 failed but the fixture has channels/capabilities, derive a profile
    // 🔧 WAVE 2093.3 (CW-AUDIT-9): Now typed in PatchedFixture — no more `as any`
    if (!profile && ((fixture.channels?.length ?? 0) > 0 || fixture.capabilities)) {
      profile = generateProfileFromDefinition({
        id: fixture.profileId || fixture.id || cacheKey,
        name: fixture.name || 'Unknown Fixture',
        type: fixture.type,
        channels: fixture.channels,
        capabilities: fixture.capabilities,
        wheels: fixture.wheels,
        physics: fixture.physics,
      }) ?? null;
    }
    
    // Guardar en caché para no volver a calcularlo ni printearlo en el próximo frame
    this.profileCache.set(cacheKey, profile);
    return profile;
  }

  /**
   * 🔥 WAVE 2183: GHOST EXORCISM — Invalidate profile caches across HAL + Mapper
   * Called when a library profile is renamed, updated, or deleted.
   * Purges stale cached profiles so the next render frame fetches fresh data.
   * @param profileId - Specific profile ID to invalidate, or omit to clear all
   */
  invalidateProfileCache(profileId?: string): void {
    if (profileId) {
      this.profileCache.delete(profileId)
    } else {
      this.profileCache.clear()
    }
    // Also clear injected physics profiles so they re-inject on next frame
    if (profileId) {
      this.injectedPhysicsProfiles.delete(profileId)
    } else {
      this.injectedPhysicsProfiles.clear()
    }
    // Cascade to FixtureMapper's own cache
    this.mapper.invalidateProfileCache(profileId)
    console.log(`[HAL] 🔥 WAVE 2183: Profile cache invalidated${profileId ? ` for "${profileId}"` : ' (ALL)'}`)
  }
  
  /**
   * � WAVE 2088.6: BABEL FISH PHYSICS — Traductor universal de perfiles de motor
   * 
   * Problema: Existen 3 formatos de PhysicsProfile incompatibles:
   *   A) ShowFileV2.PhysicsProfile: motorType='stepper-cheap', maxVelocity=400 (DMX/s)
   *   B) FixtureProfiles.movement: type='stepper', maxPanSpeed=180 (grados/s)
   *   C) FixturePhysicsDriver.PhysicsProfile: panSpeedFactor=0.5, qualityTier='budget'
   * 
   * Este método normaliza CUALQUIER formato al formato C que el Driver entiende.
   * Sin él, los límites de la Forja NUNCA llegaban al motor de físicas.
   */
  private translateToDriverPhysicsProfile(rawProfile: any): DriverPhysicsProfile | null {
    if (!rawProfile) return null
    
    // ═══════════════════════════════════════════════════════════════════════
    // FUENTE A: ShowFileV2.PhysicsProfile (from fixture.physics)
    // Tiene: motorType='servo-pro'|'stepper-quality'|'stepper-cheap'|'unknown'
    //        maxAcceleration, maxVelocity (ya en DMX/s)
    // ═══════════════════════════════════════════════════════════════════════
    if (rawProfile.motorType && rawProfile.maxVelocity !== undefined && rawProfile.orientation !== undefined) {
      const motorTypeMap: Record<string, 'stepper' | 'servo' | 'unknown'> = {
        'servo-pro': 'servo',
        'stepper-quality': 'stepper',
        'stepper-cheap': 'stepper',
        'unknown': 'unknown',
      }
      const qualityMap: Record<string, 'budget' | 'mid' | 'pro'> = {
        'servo-pro': 'pro',
        'stepper-quality': 'mid',
        'stepper-cheap': 'budget',
        'unknown': 'budget',
      }
      
      // maxVelocity del ShowFileV2 está en DMX/s.
      // El REF_SPEED para calcular speedFactor: Robe Robin = ~142 DMX/s
      const REF_SPEED_DMX = 142
      const speedFactor = Math.min(1.0, rawProfile.maxVelocity / REF_SPEED_DMX)
      
      return {
        motorType: motorTypeMap[rawProfile.motorType] ?? 'unknown',
        maxAcceleration: rawProfile.maxAcceleration,
        maxVelocity: rawProfile.maxVelocity,
        panSpeedFactor: speedFactor,
        tiltSpeedFactor: speedFactor * 0.7, // Tilt siempre más lento (carga vertical)
        qualityTier: qualityMap[rawProfile.motorType] ?? 'budget',
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // FUENTE B: FixtureProfiles.movement (from getProfile/getProfileByModel)
    // Tiene: movement.type='stepper', movement.maxPanSpeed=180 (grados/s)
    // ═══════════════════════════════════════════════════════════════════════
    if (rawProfile.movement && rawProfile.movement.maxPanSpeed !== undefined) {
      const mov = rawProfile.movement
      
      // Convertir grados/s a speedFactor relativo a Robe Robin (300°/s)
      const REF_SPEED_DEG = 300
      const panFactor = Math.min(1.0, mov.maxPanSpeed / REF_SPEED_DEG)
      const tiltFactor = Math.min(1.0, (mov.maxTiltSpeed ?? mov.maxPanSpeed * 0.7) / (REF_SPEED_DEG * 0.7))
      
      // Inferir qualityTier por velocidad
      let qualityTier: 'budget' | 'mid' | 'pro' = 'budget'
      if (mov.maxPanSpeed >= 250) qualityTier = 'pro'
      else if (mov.maxPanSpeed >= 160) qualityTier = 'mid'
      
      const motorTypeMap: Record<string, 'stepper' | 'servo' | 'unknown'> = {
        'stepper': 'stepper',
        'servo': 'servo',
        'galvo': 'servo',
      }
      
      return {
        motorType: motorTypeMap[mov.type] ?? 'stepper',
        maxAcceleration: undefined, // El profile de FixtureProfiles no tiene accel
        maxVelocity: undefined,     // Se usará speedFactor en su lugar
        panSpeedFactor: panFactor,
        tiltSpeedFactor: tiltFactor,
        qualityTier,
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // FUENTE C: Ya es un DriverPhysicsProfile (passthrough)
    // Tiene: panSpeedFactor o qualityTier directamente
    // ═══════════════════════════════════════════════════════════════════════
    if (rawProfile.panSpeedFactor !== undefined || rawProfile.qualityTier !== undefined) {
      return rawProfile as DriverPhysicsProfile
    }
    
    return null
  }
  
  /**
   * �🐟 BABEL FISH: Translate RGB to Color Wheel DMX if fixture needs it
   * @returns Modified state with colorWheel set (or original state if no translation needed)
   */
  private translateColorToWheel(
    state: FixtureState, 
    fixture: PatchedFixture,
    existingColorWheel: number
  ): FixtureState {
    // 🔧 WAVE 2770: FIX — Zero guard was treating color_wheel=0 (OPEN/WHITE)
    // as "no override", causing Babel Fish to re-translate and destroy
    // the operator's explicit choice. The correct test: check _controlSources.
    // If color_wheel came from a MANUAL override, respect it regardless of value.
    const colorWheelSource = (state as any)._controlSources?.color_wheel
    if (colorWheelSource === ControlLayer.MANUAL || existingColorWheel > 0) {
      return state
    }
    
    // Get fixture profile
    const profile = this.getFixtureProfileCached(fixture)
    if (!profile) {
      return state // No profile = assume RGB fixture, pass-through
    }
    
    // Check if fixture needs color translation (has color wheel)
    if (!needsColorTranslation(profile)) {
      return state // RGB/CMY fixture, no translation needed
    }
    
    // 🐟 TRANSLATE RGB → PHYSICAL COLOR (wheel/RGBW/CMY)
    const targetRGB: RGB = { r: state.r, g: state.g, b: state.b }
    const translation = this.colorTranslator.translate(targetRGB, profile)
    
    // If not translated (shouldn't happen if needsColorTranslation=true), pass-through
    if (!translation.wasTranslated) {
      return state
    }
    
    // ─────────────────────────────────────────────────────────────────
    // 🎨 WAVE 2096.1: RGBW fixtures — populate white channel directly
    // No SafetyLayer needed (no mechanical wheel to protect)
    // ─────────────────────────────────────────────────────────────────
    if (translation.rgbw) {
      return {
        ...state,
        r: translation.rgbw.r,
        g: translation.rgbw.g,
        b: translation.rgbw.b,
        white: translation.rgbw.w,
      }
    }
    
    // ─────────────────────────────────────────────────────────────────
    // 🎨 WAVE 2096.1: CMY fixtures — pass CMY values through
    // The HAL DMX writer should read cmy from state if available
    // For now, CMY fixtures keep RGB (DMX mapping handles the rest)
    // ─────────────────────────────────────────────────────────────────
    if (translation.cmy) {
      return {
        ...state,
        // CMY fixtures: keep original RGB for UI, DMX layer reads profile
        r: state.r,
        g: state.g,
        b: state.b,
      }
    }
    
    // ─────────────────────────────────────────────────────────────────
    // 🐟 COLOR WHEEL fixtures — full WAVE 2672 pipeline:
    //   ColorTranslator → HarmonicQuantizer → SafetyLayer → DarkSpinFilter
    // ─────────────────────────────────────────────────────────────────
    
    const fixtureId = fixture.id || fixture.name || `fixture-${state.dmxAddress}`
    
    // ─────────────────────────────────────────────────────────────────
    // 🎵 WAVE 2720: LA LEY UNIVERSAL DEL PÉNDULO — HarmonicQuantizer
    // Gate color changes to BPM-harmonic intervals BEFORE SafetyLayer.
    // This is THE universal gate: every color command to a mechanical
    // fixture passes through here, regardless of source layer
    // (Titan, Chronos, Manual, Timeline — ALL are gated here).
    //
    // Pipeline: ColorTranslator → [QUANTIZER] → SafetyLayer → DarkSpin
    //
    // If the quantizer blocks the change, we feed the SafetyLayer
    // the PREVIOUS color → it sees no change → DarkSpin sees no change
    // → no blackout, no motor movement. Elegant and invisible.
    // ─────────────────────────────────────────────────────────────────
    let quantizedColorDmx = translation.colorWheelDmx ?? 0
    
    if (isMechanicalFixture(profile)) {
      const minChangeTimeMs = profile.colorEngine.colorWheel?.minChangeTimeMs ?? 500
      const targetRGB = { r: state.r, g: state.g, b: state.b }
      const quantizerResult = this.harmonicQuantizer.quantize(
        fixtureId,
        targetRGB,
        this.currentFrameBpm,
        this.currentFrameBpmConfidence,
        minChangeTimeMs
      )
      
      if (!quantizerResult.colorAllowed) {
        // Gate cerrado: usar el último color permitido por el SafetyLayer
        // (feeding the same DMX value makes SafetyLayer + DarkSpin see "no change")
        const lastState = this.safetyLayer.getLastColor(fixtureId)
        if (lastState !== undefined) {
          quantizedColorDmx = lastState
        }
        // If no lastState yet, pass through (first frame)
      }
    }
    
    // Apply safety filter (debounce)
    const safetyResult = this.safetyLayer.filter(
      fixtureId,
      quantizedColorDmx,
      profile,
      state.dimmer
    )
    
    // Debug logging (throttled - every ~2 seconds per fixture)
    const now = performance.now()
    if (now - this.lastDebugTime > 2000) {
      this.lastDebugTime = now
      const qTag = (isMechanicalFixture(profile) && quantizedColorDmx === (this.safetyLayer.getLastColor(fixtureId) ?? quantizedColorDmx)) ? ' [Q-HOLD]' : ''
      const sTag = safetyResult.wasBlocked ? ' [S-BLOCK]' : ''
      console.log(`[🐟 BABEL FISH] ${fixture.name}: RGB(${state.r},${state.g},${state.b}) → ${translation.colorName} (DMX ${safetyResult.finalColorDmx})${qTag}${sTag}`)
    }
    
    // ─────────────────────────────────────────────────────────────────
    // 🌑 WAVE 2690: DARK-SPIN — Blackout transitorio durante tránsito de rueda
    // Si el color cambió, el fixture se apaga durante minChangeTimeMs.
    // Bajo ninguna circunstancia el público debe ver el cristal intermedio.
    // ─────────────────────────────────────────────────────────────────
    const darkSpin = profile.safety?.blackoutOnColorChange
      ? this.darkSpinFilter.filter(
          fixtureId,
          safetyResult.finalColorDmx,
          profile,
          state.dimmer
        )
      : { dimmer: state.dimmer, inTransit: false, transitRemainingMs: 0 }
    
    // Return translated state
    return {
      ...state,
      r: translation.outputRGB.r,
      g: translation.outputRGB.g,
      b: translation.outputRGB.b,
      colorWheel: safetyResult.finalColorDmx,
      // 🌑 WAVE 2690: Dimmer forzado a 0 durante tránsito de rueda
      dimmer: darkSpin.dimmer,
      // � WAVE 2711: Strobe delegation ELIMINADA — strobe es siempre el del estado
      strobe: state.strobe,
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // ZONE INTENSITY CALCULATION
  // ═══════════════════════════════════════════════════════════════════════
  
  private calculateZoneIntensity(zone: PhysicalZone, audio: ZoneIntensityInput): number {
    switch (zone) {
      case 'FRONT_PARS':
        return this.router.calculateFrontParIntensity(audio, this.currentPreset)
      
      case 'BACK_PARS':
        return this.router.calculateBackParIntensity(audio, this.currentPreset)
      
      case 'MOVING_LEFT':
      case 'MOVING_RIGHT': {
        // Use mover calculation from physics engine
        const hystKey = `${zone}-hyst`
        const wasOn = this.physics.getMoverHysteresisState(hystKey)
        
        const result = this.physics.calculateMoverTarget({
          moverKey: hystKey,  // 🔧 WAVE 280: Unique key for state buffer
          presetName: 'Default',  // Would come from VibeManager
          melodyThreshold: this.currentPreset.melodyThreshold,
          rawMid: audio.rawMid,
          rawBass: audio.rawBass,
          rawTreble: audio.rawTreble,
          moverState: wasOn,
          isRealSilence: audio.isRealSilence,
          isAGCTrap: audio.isAGCTrap,
        })
        
        // WAVE 256.7: Debug log for movers - every 2 seconds
        if (performance.now() - this.lastDebugTime > 2000 && zone === 'MOVING_LEFT') {
          console.log(`[HAL MOVER] ${zone}: mid=${audio.rawMid.toFixed(2)}, treble=${audio.rawTreble.toFixed(2)}, bass=${audio.rawBass.toFixed(2)} → intensity=${result.intensity.toFixed(2)}, state=${result.newState}`)
          this.lastDebugTime = performance.now()
        }
        
        this.physics.setMoverHysteresisState(hystKey, result.newState)
        return result.intensity
      }
      
      case 'STROBES':
        // Strobes only on beat with high bass
        return (audio.bassPulse > 0.8) ? 1.0 : 0
      
      // 🌊 WAVE 2020.1: AIR ZONE FALLBACK
      // Hereda comportamiento de MOVING_RIGHT (treble-driven) con decay acelerado
      // Futuro: Conectar a God Ear ultraAir band (16k-22kHz)
      case 'AIR': {
        const hystKey = `${zone}-hyst`
        const wasOn = this.physics.getMoverHysteresisState(hystKey)
        
        const result = this.physics.calculateMoverTarget({
          moverKey: hystKey,
          presetName: 'Default',
          melodyThreshold: this.currentPreset.melodyThreshold,
          rawMid: audio.rawMid,
          rawBass: audio.rawBass,
          rawTreble: audio.rawTreble,
          moverState: wasOn,
          isRealSilence: audio.isRealSilence,
          isAGCTrap: audio.isAGCTrap,
        })
        
        // Aplicar decay acelerado para respuesta rápida (cymbal wash)
        return result.intensity * 0.8
      }
      
      // 🌊 WAVE 2020.1: CENTER ZONE FALLBACK
      // Hereda comportamiento de STROBES (beat-driven)
      case 'CENTER':
        return (audio.bassPulse > 0.8) ? 1.0 : 0
      
      default:
        return audio.melodySignal * 0.5
    }
  }
  
  private buildAudioInput(audio: AudioMetrics): ZoneIntensityInput {
    // WAVE 256.5: Calculate derived values with REDUCED thresholds for better reactivity
    // Previous bassFloor=0.5 was killing most audio signal
    const bassFloor = 0.15  // Was 0.5 - now much more sensitive
    const bassPulse = Math.max(0, audio.rawBass - bassFloor)  // Was bassFloor * 0.6
    const treblePulse = Math.max(0, audio.rawTreble - 0.05)   // Was 0.15
    const melodySignal = Math.max(audio.rawMid * 1.2, audio.rawTreble)  // Boosted mid
    const isMelodyDominant = audio.rawMid + audio.rawTreble > audio.rawBass * 1.5
    
    return {
      rawBass: audio.rawBass,
      rawMid: audio.rawMid,
      rawTreble: audio.rawTreble,
      bassPulse,
      treblePulse,
      melodySignal,
      isRealSilence: audio.isRealSilence,
      isAGCTrap: audio.isAGCTrap,
      isMelodyDominant,
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // DRIVER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════
  
  private createDriver(type: DriverType | 'usb-serial'): IDMXDriver {
    switch (type) {
      case 'mock':
        // WAVE 252: Silent mock driver
        return new MockDMXDriver({ debug: false })
      
      case 'usb-serial':
      case 'usb':
        // 🔥 ARQUITECTURA LIMPIA: Usamos el adaptador oficial (HAL ⇄ Hydra)
        return new USBDMXDriverAdapter()
      
      case 'artnet':
        // For now, fall back to silent mock
        return new MockDMXDriver({ debug: false })
      
      default:
        // WAVE 252: Default to silent mock (no spam)
        return new MockDMXDriver({ debug: false })
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎛️ DMX OUTPUT CONTROL
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🛡️ WAVE 2085: SAFE MOTOR SEND — Applies physics before DMX dispatch.
   * 
   * Used by TitanOrchestrator after applying Hephaestus/effects parameter overlays.
   * The states may have NEW pan/tilt targets, but physicalPan/physicalTilt must be
   * interpolated by the physics engine before reaching the DMX driver.
   * 
   * NON-MOVEMENT params (dimmer, color, white, etc.) are sent immediately.
   * MOVEMENT params (pan/tilt) go through FixturePhysicsDriver.translateDMX().
   * 
   * REPLACES the old sendStates() which was a physics-bypass backdoor.
   */
  public sendStatesWithPhysics(states: FixtureState[]): void {
    // Apply physics interpolation to all moving fixtures
    const physicsDt = this.measurePhysicsDeltaTime()
    
    const safeStates = states.map((state) => {
      // Detect if this is a moving fixture
      const isMovingFixture = state.zone?.includes('MOVING') || 
                              state.type?.toLowerCase().includes('moving') ||
                              state.type?.toLowerCase().includes('spot') ||
                              state.type?.toLowerCase().includes('beam')
      
      if (!isMovingFixture) return state
      
      // 🛡️ Run physics: interpolate pan/tilt targets → smooth physicalPan/physicalTilt
      const fixtureId = state.fixtureId || `fixture-${state.dmxAddress}`
      this.movementPhysics.translateDMX(fixtureId, state.pan, state.tilt, physicsDt)
      const physicsState = this.movementPhysics.getPhysicsState(fixtureId)
      
      return {
        ...state,
        physicalPan: physicsState.physicalPan,
        physicalTilt: physicsState.physicalTilt,
        panVelocity: physicsState.panVelocity,
        tiltVelocity: physicsState.tiltVelocity,
      }
    })
    
    this.sendToDriver(safeStates)
  }
  
  private sendToDriver(states: FixtureState[]): void {
    // 🧟 WAVE 1208: ZOMBIE KILLER - NO auto-connect!
    // If driver is not connected, silently drop packets.
    if (!this.driver.isConnected) {
      if (this.framesRendered % 100 === 0) {
        console.warn(`[HAL] ⚠️ Driver not connected, dropping frames`)
      }
      return
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 🚧 WAVE 2228: DMX ADUANA — Last-mile output gate
    // 🔒 WAVE 2229: + physicalPan/physicalTilt also gated
    // 🔥 WAVE 2231: Physics runs 100% always. The Aduana is the ONLY gate.
    //   No more pausePhysics/resumePhysics. HyperionView 3D stays alive.
    //   The physics engine feeds both the 3D preview and the DMX output.
    //   The Aduana filters at the DMX boundary, microseconds before hardware.
    //
    // When outputEnabled=false (ARMED, not LIVE):
    //   - Channels controlled by MANUAL (Layer 2) → pass through (calibration)
    //   - ALL other channels → safe values (dimmer=0, color=black, pos=center)
    //   - physicalPan/physicalTilt also gated (WAVE 2229)
    //
    // This is the ONLY place DMX gets filtered. The Arbiter is now pure brain.
    // Physics always runs. The Aduana is the sole gate.
    // ═══════════════════════════════════════════════════════════════════════════
    const outputEnabled = masterArbiter.isOutputEnabled()

    // 🔬 WAVE 2960 v3: PRE-ADUANA SNAPSHOT — captura dimmer ANTES de que la Aduana lo modifique.
    // Así sabemos si el dimmer=0 viene del Arbiter o lo impone la Aduana.
    // Solo frame 181 y cada 5 segundos (rate-limit por clave 'pre-aduana:fid').
    // DISABLED: Sonda desactivada post-WAVE 2961 diagnosis
    // if (this.framesRendered > 180) {
    //   try {
    //     for (const state of states) {
    //       const fid = state.fixtureId ?? `addr:${state.dmxAddress}`
    //       this._w2960Log(`pre-aduana:${fid}`,
    //         `[HAL TRAP W2960 v3] PRE-ADUANA STATE\n` +
    //         `  fixture=${fid}  addr=${state.dmxAddress}\n` +
    //         `  frame=${this.framesRendered}  outputEnabled=${outputEnabled}\n` +
    //         `  dimmer=${state.dimmer}  r=${state.r ?? 0}  g=${state.g ?? 0}  b=${state.b ?? 0}\n` +
    //         `  _controlSources=${JSON.stringify(state._controlSources ?? null)}`
    //       )
    //     }
    //   } catch { /* nunca bloquear */ }
    // }

    if (!outputEnabled) {
      states = states.map(state => {
        const sources = state._controlSources
        if (!sources) {
          // No source metadata → full blackout for safety
          return { ...state, dimmer: 0, r: 0, g: 0, b: 0, pan: 128, tilt: 128, physicalPan: 128, physicalTilt: 128 }
        }

        // Check if ANY channel is manual — if none, full blackout shortcut
        const hasAnyManual = Object.values(sources).some(v => v === ControlLayer.MANUAL)
        if (!hasAnyManual) {
          return { ...state, dimmer: 0, r: 0, g: 0, b: 0, pan: 128, tilt: 128, physicalPan: 128, physicalTilt: 128 }
        }

        // Per-channel gate: manual channels pass, rest → safe values
        // 🚧 WAVE 2229: physicalPan/physicalTilt MUST also be gated.
        // The FixtureMapper reads physicalPan/physicalTilt with priority over pan/tilt.
        // If we only gate pan/tilt but leave physicalPan/physicalTilt untouched,
        // physics-interpolated values leak to DMX hardware.
        //
        // WAVE 2961: COLOR COHERENCE — when the operator has manual control of
        // the dimmer, the fixture's computed color (r/g/b/white/color_wheel) MUST
        // also pass through, even if those channels are tagged as TITAN_AI.
        // Reason: wheel-based movers (EL1140, etc.) have color driven by Titan's
        // RGB->wheel translation. The operator set dimmer+pan+tilt manually to
        // calibrate a position with light. If we zero r/g/b, BabelFish receives
        // {r:0,g:0,b:0} -> wheel snaps to white/open -> the mover flashes on
        // GO-off. The intended behavior: if you own the dimmer, you own the color.
        //
        // WAVE 2980: BABELFISH SELLO — Color coherence ONLY for mechanical fixtures
        // (those with a physical color wheel). LED PARs and RGB panels have no wheel
        // mechanics, so they MUST be allowed to receive absolute zero on all channels.
        // Allowing Titan color to leak through for LED fixtures produces a residual
        // color base (e.g. 2% red) even when the fixture should be completely dark.
        // Guard: dimmerIsManual color pass-through is gated behind hasColorWheel.
        const dimmerIsManual = sources['dimmer'] === ControlLayer.MANUAL
        const hasMechanicalWheel = state.hasColorWheel === true
        const panSafe = sources['pan'] === ControlLayer.MANUAL
        const tiltSafe = sources['tilt'] === ControlLayer.MANUAL
        // For mechanical fixtures: dimmer ownership implies color ownership (anti-wheel-snap).
        // For LED fixtures: color channels must zero independently — no wheel to protect.
        const colorPassFromDimmer = dimmerIsManual && hasMechanicalWheel
        return {
          ...state,
          dimmer: dimmerIsManual ? state.dimmer : 0,
          r: (sources['red'] === ControlLayer.MANUAL || colorPassFromDimmer) ? state.r : 0,
          g: (sources['green'] === ControlLayer.MANUAL || colorPassFromDimmer) ? state.g : 0,
          b: (sources['blue'] === ControlLayer.MANUAL || colorPassFromDimmer) ? state.b : 0,
          white: (sources['white'] === ControlLayer.MANUAL || colorPassFromDimmer) ? state.white : 0,
          colorWheel: (sources['color_wheel'] === ControlLayer.MANUAL || colorPassFromDimmer) ? state.colorWheel : undefined,
          pan: panSafe ? state.pan : 128,
          tilt: tiltSafe ? state.tilt : 128,
          physicalPan: panSafe ? state.physicalPan : 128,
          physicalTilt: tiltSafe ? state.physicalTilt : 128,
        }
      })
    }
    
    // ⚒️ WAVE 2030.22g: Debug white values before DMX conversion
    const withWhite = states.filter(s => s.white !== undefined && s.white > 0)
    // Removed noisy retina-killing log: [HAL] 🔆 WHITE PRE-DMX
    // If you need this debug info, enable it temporarily or use a debug flag.

    // ═══════════════════════════════════════════════════════════════════════
    // 🔬 WAVE 2960: HARDWARE BUFFER TRAP — Last Mile Interceptor
    //
    // Guard post-boot: solo activo después de 180 frames (~3s a 60fps).
    // El sistema arranca con dimmer=0 legítimamente — ignorar esos frames.
    // Dispara ÚNICAMENTE cuando outputEnabled=true (LIVE) y hay manual override
    // activo pero el valor final es 0. Eso sí es un espasmo ilegítimo.
    // ═══════════════════════════════════════════════════════════════════════
    // 🔬 WAVE 2960: ONE-SHOT logger — solo escribe a fichero la primera vez
    // que cada fixture llega con un valor sospechoso. Cero spam en consola.
    if (this.framesRendered > 180) {
      try {
        const outputIsEnabled = masterArbiter.isOutputEnabled()
        const globalBlackout   = masterArbiter.isBlackoutActive()

        // 🔬 WAVE 2960 v3: ADUANA TRAP — loguear SIEMPRE (con o sin outputEnabled)
        // cuando un fixture tiene dimmer=0 post-Aduana. Así capturamos si el problema
        // es la Aduana (ARMED) o algo más profundo (LIVE pero con ceros).
        // Rate-limit 5000ms por fixture para no llenar el log.
        // DISABLED: Sonda desactivada post-WAVE 2961 diagnosis
        // for (const state of states) {
        //   if (state.dimmer === 0) {
        //     const fid = state.fixtureId ?? `addr:${state.dmxAddress}`
        //     const src = state._controlSources
        //     this._w2960Log(`aduana:${fid}`,
        //       `[HAL TRAP W2960 v3] POST-ADUANA DIMMER=0\n` +
        //       `  fixture=${fid}  addr=${state.dmxAddress}\n` +
        //       `  frame=${this.framesRendered}  outputEnabled=${outputIsEnabled}  globalBlackout=${globalBlackout}\n` +
        //       `  pre-aduana-dimmer=??? (ya aplicada)  r=${state.r ?? 0}  g=${state.g ?? 0}  b=${state.b ?? 0}\n` +
        //       `  _controlSources=${JSON.stringify(src ?? null)}\n` +
        //       `  hasSources=${src != null}  hasManual=${src ? Object.values(src).some(v => v === 2) : false}`
        //     )
        //   }
        // }

        if (outputIsEnabled && !globalBlackout) {
          // ═══════════════════════════════════════════════════════════════
          // 🔬 WAVE 2960 v2: MASS BLACKOUT DETECTOR
          //
          // El error anterior: requerir ControlLayer.MANUAL excluía todos
          // los fixtures bajo control Titan AI — que son los afectados por
          // la Transition Anomaly. La sonda era ciega al bug real.
          //
          // Estrategia correcta: detectar colapso global de dimmer sin
          // importar la fuente de control. Si >60% de los fixtures activos
          // tienen dimmer=0 simultáneamente sin blackout → eso ES el espasmo.
          // Loggear TODOS los estados en ese frame con sus controlSources.
          // ═══════════════════════════════════════════════════════════════
          const activeStates = states.filter(s => {
            // Un fixture "activo" es uno que en frames anteriores tenía dimmer>0
            // No podemos saber eso aquí, así que usamos: addr asignada y fixtureId presente
            return s.fixtureId != null
          })
          const darkCount = activeStates.filter(s => s.dimmer === 0).length
          const totalActive = activeStates.length

          if (totalActive > 0 && darkCount > 0 && darkCount >= Math.ceil(totalActive * 0.6)) {
            // Mass blackout detectado — loggear una snapshot completa del frame
            // DISABLED: Sonda desactivada post-WAVE 2961 diagnosis
            // const frameKey = `mass-blackout:${this.framesRendered}`
            // const snapshotLines = activeStates.map(s =>
            //   `    fid=${s.fixtureId}  dimmer=${s.dimmer}  r=${s.r ?? 0}  g=${s.g ?? 0}  b=${s.b ?? 0}` +
            //   `  pan=${s.pan ?? 0}  tilt=${s.tilt ?? 0}` +
            //   `  src_dim=${s._controlSources?.['dimmer'] ?? '?'}  src_r=${s._controlSources?.['red'] ?? '?'}`
            // ).join('\n')
            // this._w2960Log(frameKey,
            //   `[HAL TRAP W2960 v2] *** MASS BLACKOUT *** frame=${this.framesRendered}\n` +
            //   `  darkCount=${darkCount}/${totalActive} fixtures con dimmer=0  outputEnabled=${outputIsEnabled}  globalBlackout=${globalBlackout}\n` +
            //   `  snapshot fixtures:\n${snapshotLines}\n` +
            //   `  stack=${new Error().stack?.split('\n').slice(1, 6).join(' | ')}`
            // )
          }

          // WAVE 2960: Individual dimmer=0 trap (DISABLED — _w2960Log is commented out)
          // for (const state of states) {
          //   const src = state._controlSources
          //   const fid = state.fixtureId ?? `addr:${state.dmxAddress}`
          //   if (state.dimmer === 0) {
          //     this._w2960Log(`dim:${fid}`,
          //       `[HAL TRAP W2960 v2] DIMMER=0 fixture=${fid}\n` +
          //       `  dimmer=${state.dimmer}  r=${state.r ?? 0}  g=${state.g ?? 0}  b=${state.b ?? 0}\n` +
          //       `  frame=${this.framesRendered}\n` +
          //       `  controlSources: dimmer=${src?.['dimmer'] ?? '?'}  r=${src?.['red'] ?? '?'}  g=${src?.['green'] ?? '?'}\n` +
          //       `  stack=${new Error().stack?.split('\n').slice(1, 6).join(' | ')}`
          //     )
          //   }
          // }
        }
      } catch {
        // nunca bloquear el output — la trampa es observadora, no tiene poder de veto
      }
    }

    // Convert states to DMX packets
    const packets = this.mapper.statesToDMXPackets(states)

    // ═══════════════════════════════════════════════════════════════════════
    // � WAVE 3000: INYECTAR PACKETS EN BUFFERS DEL DRIVER
    // Sin esto, sendAll() envía buffers vacíos/stale.
    // Cada DMXPacket tiene {universe, address, channels[]} que se escribe
    // en la posición correcta del buffer del universo correspondiente.
    // ═══════════════════════════════════════════════════════════════════════
    for (const packet of packets) {
      this.driver.send(packet)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // �🔎 FORENSIC TRACE (CP3): HAL mutation check (states → DMXPacket)
    // Enabled via env: LUXSYNC_TRACE_DMX=1 (optional LUXSYNC_TRACE_DMX_EVERY)
    // Optional focus: LUXSYNC_TRACE_FIXTURE_ID=<fixtureId>
    // ═══════════════════════════════════════════════════════════════════════
    try {
      const traceEnabled = String(process?.env?.LUXSYNC_TRACE_DMX ?? '') === '1'
      if (traceEnabled) {
        const everyRaw = Number.parseInt(String(process?.env?.LUXSYNC_TRACE_DMX_EVERY ?? ''), 10)
        const every = Number.isFinite(everyRaw) && everyRaw > 0 ? everyRaw : 60
        if (this.framesRendered % every === 0) {
          const traceFixtureId =
            process?.env?.LUXSYNC_TRACE_FIXTURE_ID
              ? String(process.env.LUXSYNC_TRACE_FIXTURE_ID)
              : undefined

          // 🔎 TRACE CP3 DISABLED: States→Packets mapper trace (too detailed). Check CP4 serial boundary instead.
          // const universes = Array.from(new Set(packets.map(p => p.universe))).sort((a, b) => a - b)
          // console.log('[TRACE CP3] HAL states→DMXPacket', {...})
        }
      }
    } catch {
      // never block output
    }

    // 🔎 WAVE 1219.4: HAL packets preview (disabled to reduce noise)
    // Used for debugging packet mutations; re-enable if tracing color/position divergence
    // if (this.framesRendered % 120 === 0) {
    //   console.log('[TRACE HAL] packets', {...})
    // }

    // Fire and forget - we don't await because render loop is sync
    if (this.driver.sendAll) {
      void this.driver.sendAll()
    }
  }

  /**
   * Connect to DMX hardware.
   */
  public async connect(): Promise<boolean> {
    console.log(`[HAL] 🔌 Connecting to ${this.config.driverType} driver...`)
    return await this.driver.connect()
  }
  
  /**
   * Disconnect from hardware.
   */
  public async disconnect(): Promise<void> {
    console.log('[HAL] 🔌 Disconnecting...')
    await this.driver.close()
  }
  
  /**
   * Switch to a different driver type.
   */
  public async switchDriver(type: DriverType): Promise<boolean> {
    console.log(`[HAL] 🔄 Switching driver to: ${type}`)
    
    // Close existing driver
    await this.driver.close()
    
    // Create new driver
    this.driver = this.createDriver(type)
    this.config.driverType = type
    
    // Connect new driver
    return await this.driver.connect()
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Update vibe preset for physics calculations.
   */
  public setVibePreset(preset: VibeRouteConfig): void {
    this.currentPreset = preset
  }
  
  /**
   * 🔧 WAVE 338: Set active vibe for movement physics + optics
   * This updates both the intensity physics (router) and movement physics (driver)
   */
  public setVibe(vibeId: string): void {
    if (this.currentVibeId === vibeId) return
    
    this.currentVibeId = vibeId
    
    // Update movement physics (pan/tilt acceleration, velocity, friction)
    this.movementPhysics.setVibe(vibeId)
    
    // 🗑️ WAVE 2211: Invalidate physics profile injection cache on vibe change.
    // FixturePhysicsDriver.setVibe() changes the physics mode (snap/classic),
    // but the per-fixture speed factors need re-injection too since the new
    // vibe's rev limits interact differently with fixture capabilities.
    this.injectedPhysicsProfiles.clear()
    
    // Update optics defaults (zoom, focus)
    this.currentOptics = getOpticsConfig(vibeId)
    
    // 🔍 WAVE 338.2: Pass optics to FixtureMapper
    this.mapper.setCurrentOptics({
      zoom: this.currentOptics.zoomDefault,
      focus: this.currentOptics.focusDefault,
    })
    
    console.log(`[HAL] 🎛️ WAVE 338: Vibe "${vibeId}" - Zoom:${this.currentOptics.zoomDefault} Focus:${this.currentOptics.focusDefault}`)
  }
  
  /**
   * Get current vibe ID
   */
  public getCurrentVibe(): string {
    return this.currentVibeId
  }
  
  /**
   * Get current optics configuration
   */
  public getCurrentOptics(): OpticsConfig {
    return this.currentOptics
  }
  
  /**
   * 🔧 WAVE 338: Register a mover fixture with the physics driver
   */
  public registerMover(fixtureId: string, installationType: string = 'ceiling'): void {
    this.movementPhysics.registerFixture(fixtureId, { installationType })
    console.log(`[HAL] 🔧 Registered mover "${fixtureId}" (${installationType})`)
  }
  
  /**
   * 🔧 WAVE 338: Translate abstract position to DMX for a mover
   * @param fixtureId - Fixture identifier
   * @param x - Abstract X position (-1 to +1)
   * @param y - Abstract Y position (-1 to +1)
   * @param deltaTime - Time since last frame in ms
   */
  public translateMovement(fixtureId: string, x: number, y: number, deltaTime: number = 16) {
    return this.movementPhysics.translate({ fixtureId, x, y }, deltaTime)
  }

  /**
   * Set blackout mode.
   */
  public setBlackout(active: boolean): void {
    this.mapper.setBlackout(active)
    if (active) {
      this.driver.blackout()
    }
  }
  
  /**
   * Set manual override for a fixture.
   */
  public setManualOverride(fixtureId: string, override: Record<string, number>): void {
    this.mapper.setManualOverride(fixtureId, override)
  }
  
  /**
   * Clear all manual overrides.
   */
  public clearOverrides(): void {
    this.mapper.clearAllOverrides()
  }
  
  /**
   * Set effect active state.
   */
  public setEffect(effect: 'strobe' | 'blinder' | 'police' | 'rainbow', active: boolean): void {
    this.mapper.setEffect(effect, active)
  }
  
  /**
   * Reset all physics state (for mode changes).
   */
  public resetPhysics(): void {
    this.physics.reset()
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // STATUS & MONITORING
  // ═══════════════════════════════════════════════════════════════════════
  
  public getStatus(): HALStatus {
    const avgRenderTime = this.renderTimes.length > 0
      ? this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length
      : 0
    
    return {
      isConnected: this.driver.isConnected,
      driverType: this.config.driverType,
      framesRendered: this.framesRendered,
      fixturesActive: this.lastFixtureStates.filter(f => f.dimmer > 0).length,
      avgRenderTime,
      lastRenderTime: this.lastRenderTime,
    }
  }
  
  public getLastFixtureStates(): FixtureState[] {
    return this.lastFixtureStates
  }
  
  get isConnected(): boolean {
    return this.driver.isConnected
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════
  
  public async destroy(): Promise<void> {
    console.log('[HAL] 🛑 Destroying HardwareAbstraction...')
    
    this.physics.destroy()
    this.router.destroy()
    this.mapper.destroy()
    await this.driver.close()
    
    this.universeBuffers.clear()
    this.lastFixtureStates = []
    
    console.log('[HAL] ✅ Destroyed')
  }
}

// Export singleton for easy use
export const hardwareAbstraction = new HardwareAbstraction({ driverType: 'usb' })
