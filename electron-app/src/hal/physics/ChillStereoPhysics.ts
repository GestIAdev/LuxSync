/**
 *  CHILL STEREO PHYSICS: THE LIVING OCEAN (WAVE 1070.6)
 * 
 * Motor hidrostático que controla profundidad oceánica y triggers de criaturas.
 * 
 * ZONAS OCEÁNICAS:
 *  SHALLOWS (0-1000m):     Superficie - Verde esmeralda
 *  OCEAN (1000-3000m):     Aguas abiertas - Azul tropical  
 *  TWILIGHT (3000-6000m):  Zona crepuscular - Índigo
 *  MIDNIGHT (6000+m):      Abismo profundo - Bioluminiscencia
 * 
 * CRIATURAS:
 * - SolarCaustics: clarity alta en SHALLOWS
 * - SchoolOfFish: transientDensity alta en OCEAN
 * - WhaleSong: bassEnergy alta en TWILIGHT
 * - AbyssalJellyfish: spectralFlatness bajo en MIDNIGHT
 */

// TIPOS
type DepthZone = 'SHALLOWS' | 'OCEAN' | 'TWILIGHT' | 'MIDNIGHT'

export interface OceanicTriggers {
  solarCaustics: boolean
  schoolOfFish: boolean
  whaleSong: boolean
  abyssalJellyfish: boolean
}

export interface DeepFieldOutput {
  frontL: number
  frontR: number
  backL: number
  backR: number
  moverL: { intensity: number; pan: number; tilt: number }
  moverR: { intensity: number; pan: number; tilt: number }
  airIntensity: number
  colorOverride: { h: number; s: number; l: number }
  currentDepth: number
  currentZone: DepthZone
  oceanicTriggers: OceanicTriggers
  debug: string
}

// CONFIGURACIÓN DE ZONAS
const ZONES: Record<DepthZone, { min: number; max: number; label: string }> = {
  SHALLOWS: { min: 0,    max: 1000,  label: '' },
  OCEAN:    { min: 1000, max: 3000,  label: '' },
  TWILIGHT: { min: 3000, max: 6000,  label: '' },
  MIDNIGHT: { min: 6000, max: 10000, label: '' }
}

// CONFIGURACIÓN MOTOR HIDROSTÁTICO
const HYDROSTATIC_CONFIG = {
  TIDE_CYCLE_MS: 12 * 60 * 1000,  // 12 minutos por ciclo completo
  DEBUG_SPEED: 1,
  SURFACE_DEPTH: 0,
  MAX_DEPTH: 10000,
  NEUTRAL_DEPTH: 5000,
  DEPTH_INERTIA: 0.992,
  BUOYANCY_SENSITIVITY: 0,
  BUOYANCY_NEUTRAL_CENTROID: 1200,
}

// CONFIGURACIÓN DE TRIGGERS
const TRIGGER_CONFIG = {
  solarCaustics: {
    cooldownMs: 8000,
    clarityThreshold: 0.75,
    maxDepth: 1000,
  },
  schoolOfFish: {
    cooldownMs: 5000,
    transientThreshold: 0.55,
    minDepth: 1000,
    maxDepth: 3000,
  },
  whaleSong: {
    cooldownMs: 15000,
    bassThreshold: 0.60,
    minDepth: 3000,
    maxDepth: 6000,
  },
  abyssalJellyfish: {
    cooldownMs: 25000,
    flatnessThreshold: 0.35,
    minDepth: 6000,
  },
}

// ESTADO PERSISTENTE
interface OceanState {
  currentDepth: number
  currentZone: DepthZone
  lastLoggedDepth: number
  lastTriggerTime: Record<keyof OceanicTriggers, number>
  startTime: number
}

const state: OceanState = {
  currentDepth: 500,
  currentZone: 'OCEAN',
  lastLoggedDepth: 500,
  lastTriggerTime: {
    solarCaustics: 0,
    schoolOfFish: 0,
    whaleSong: 0,
    abyssalJellyfish: 0,
  },
  startTime: Date.now(),
}

// UTILIDADES
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function getZoneFromDepth(depth: number): DepthZone {
  if (depth < ZONES.SHALLOWS.max) return 'SHALLOWS'
  if (depth < ZONES.OCEAN.max) return 'OCEAN'
  if (depth < ZONES.TWILIGHT.max) return 'TWILIGHT'
  return 'MIDNIGHT'
}

// MOTOR HIDROSTÁTICO
function calculateHydrostaticDepth(now: number, godEar: any): number {
  const config = HYDROSTATIC_CONFIG
  const effectiveTime = (now - state.startTime) * config.DEBUG_SPEED
  const tidePhase = (effectiveTime % config.TIDE_CYCLE_MS) / config.TIDE_CYCLE_MS
  const tideWave = (1 - Math.cos(tidePhase * Math.PI * 2)) / 2
  const tideDepth = config.SURFACE_DEPTH + tideWave * config.MAX_DEPTH
  
  // Inercia suave
  state.currentDepth = state.currentDepth * config.DEPTH_INERTIA + 
                       tideDepth * (1 - config.DEPTH_INERTIA)
  
  return state.currentDepth
}

// COLOR GRADING POR PROFUNDIDAD
function calculateColorGrading(depth: number, energy: number, now: number): { hue: number; saturation: number; lightness: number } {
  const zone = getZoneFromDepth(depth)
  
  let baseHue: number, baseSat: number, baseLightness: number
  
  if (zone === 'SHALLOWS') {
    // Verde esmeralda brillante
    baseHue = 160 + Math.sin(now / 5000) * 20
    baseSat = 75 + energy * 15
    baseLightness = 55 + energy * 10
  } else if (zone === 'OCEAN') {
    // Azul tropical
    baseHue = 200 + Math.sin(now / 6000) * 15
    baseSat = 70 + energy * 20
    baseLightness = 50 + energy * 15
  } else if (zone === 'TWILIGHT') {
    // Índigo profundo
    baseHue = 240 + Math.sin(now / 7000) * 20
    baseSat = 65 + energy * 15
    baseLightness = 35 + energy * 10
  } else {
    // Bioluminiscencia (magenta/cyan alternando)
    baseHue = 290 + Math.sin(now / 8000) * 60
    baseSat = 85 + energy * 10
    baseLightness = 25 + energy * 15
  }
  
  return {
    hue: baseHue,
    saturation: clamp(baseSat, 0, 100),
    lightness: clamp(baseLightness, 0, 100),
  }
}

// FÍSICA DE FLUIDOS
function calculateFluidPhysics(
  now: number,
  energy: number,
  depth: number,
  godEar: any
): {
  frontL: number; frontR: number; backL: number; backR: number;
  moverL: { intensity: number; pan: number; tilt: number };
  moverR: { intensity: number; pan: number; tilt: number };
  airIntensity: number;
} {
  const zone = getZoneFromDepth(depth)
  const pressureFactor = 1 - (depth / HYDROSTATIC_CONFIG.MAX_DEPTH) * 0.5
  
  // Osciladores con números primos
  const oscL = Math.sin(now / 3659) + Math.sin(now / 2069) * 0.25
  const oscR = Math.cos(now / 3023) + Math.sin(now / 2707) * 0.25
  
  const breathDepth = (0.35 + energy * 0.3) * pressureFactor
  
  const frontL = clamp(0.5 + oscL * breathDepth, 0, 1)
  const frontR = clamp(0.5 + oscR * breathDepth, 0, 1)
  const backL = clamp(0.4 + Math.sin(now / 4007 - 1.8) * 0.35 * pressureFactor, 0, 1)
  const backR = clamp(0.4 + Math.cos(now / 3511 - 2.2) * 0.35 * pressureFactor, 0, 1)
  
  // Movers
  const moverPanL = 0.5 + Math.sin(now / 5003) * 0.4 * pressureFactor
  const moverPanR = 0.5 + Math.sin(now / 4003 + Math.PI) * 0.4 * pressureFactor
  
  const baseTilt = zone === 'MIDNIGHT' ? 0.7 : zone === 'TWILIGHT' ? 0.6 : 0.5
  const moverTiltL = baseTilt + Math.cos(now / 2503) * 0.2
  const moverTiltR = baseTilt + Math.cos(now / 1753 + 0.5) * 0.2
  
  const baseIntensity = zone === 'SHALLOWS' ? 0.5 : 
                        zone === 'OCEAN' ? 0.4 :
                        zone === 'TWILIGHT' ? 0.25 : 0.15
  
  const clarity = godEar.clarity || 0
  const lifeActivity = (clarity > 0.7 || energy > 0.65) ? 0.3 : 0
  const lifePulse = Math.sin(now / 800) > 0.7 ? lifeActivity : 0
  
  const moverIntL = clamp(baseIntensity + Math.sin(now / 2500) * 0.15 + lifePulse + energy * 0.2, 0, 1)
  const moverIntR = clamp(baseIntensity + Math.sin(now / 3100 + 2) * 0.15 + lifePulse + energy * 0.2, 0, 1)
  
  const airBase = zone === 'SHALLOWS' ? 0.4 : zone === 'OCEAN' ? 0.25 : 0.1
  const airIntensity = clamp(airBase + energy * 0.2 + lifePulse * 0.5, 0, 0.7)
  
  return {
    frontL, frontR, backL, backR,
    moverL: { intensity: moverIntL, pan: moverPanL, tilt: moverTiltL },
    moverR: { intensity: moverIntR, pan: moverPanR, tilt: moverTiltR },
    airIntensity,
  }
}

// TEXTURE MONITOR - Detección de Criaturas
function checkOceanicTriggers(godEar: any, depth: number, now: number): OceanicTriggers {
  const clarity = godEar.clarity || 0
  const transientDensity = godEar.transientDensity || 0
  const spectralFlatness = godEar.spectralFlatness ?? 0.5
  const bassEnergy = godEar.bassEnergy || godEar.bass || 0
  
  const triggers: OceanicTriggers = {
    solarCaustics: false,
    schoolOfFish: false,
    whaleSong: false,
    abyssalJellyfish: false,
  }
  
  //  SOLAR CAUSTICS
  const causticsConfig = TRIGGER_CONFIG.solarCaustics
  if (
    depth < causticsConfig.maxDepth &&
    clarity > causticsConfig.clarityThreshold &&
    now - state.lastTriggerTime.solarCaustics > causticsConfig.cooldownMs
  ) {
    triggers.solarCaustics = true
    state.lastTriggerTime.solarCaustics = now
  }
  
  //  SCHOOL OF FISH
  const fishConfig = TRIGGER_CONFIG.schoolOfFish
  if (
    depth >= fishConfig.minDepth &&
    depth < fishConfig.maxDepth &&
    transientDensity > fishConfig.transientThreshold &&
    now - state.lastTriggerTime.schoolOfFish > fishConfig.cooldownMs
  ) {
    triggers.schoolOfFish = true
    state.lastTriggerTime.schoolOfFish = now
  }
  
  //  WHALE SONG
  const whaleConfig = TRIGGER_CONFIG.whaleSong
  if (
    depth >= whaleConfig.minDepth &&
    depth < whaleConfig.maxDepth &&
    bassEnergy > whaleConfig.bassThreshold &&
    now - state.lastTriggerTime.whaleSong > whaleConfig.cooldownMs
  ) {
    triggers.whaleSong = true
    state.lastTriggerTime.whaleSong = now
  }
  
  //  ABYSSAL JELLYFISH
  const jellyConfig = TRIGGER_CONFIG.abyssalJellyfish
  if (
    depth >= jellyConfig.minDepth &&
    spectralFlatness < jellyConfig.flatnessThreshold &&
    now - state.lastTriggerTime.abyssalJellyfish > jellyConfig.cooldownMs
  ) {
    triggers.abyssalJellyfish = true
    state.lastTriggerTime.abyssalJellyfish = now
  }
  
  return triggers
}

// FUNCIÓN PRINCIPAL
export const calculateChillStereo = (
  time: number,
  energy: number,
  air: number,
  isKick: boolean,
  godEar: any = {}
): DeepFieldOutput => {
  const now = Date.now()
  
  const depth = calculateHydrostaticDepth(now, godEar)
  const zone = getZoneFromDepth(depth)
  state.currentZone = zone
  
  const color = calculateColorGrading(depth, energy, now)
  const physics = calculateFluidPhysics(now, energy, depth, godEar)
  const oceanicTriggers = checkOceanicTriggers(godEar, depth, now)
  
  const depthChanged = Math.abs(depth - state.lastLoggedDepth) > 500
  if (depthChanged) {
    state.lastLoggedDepth = depth
  }
  
  //  TELEMETRÍA SUBMARINA (Cada ~2 segundos)
  if (Math.floor(now / 1000) % 2 === 0 && Math.sin(now / 100) > 0.95) {
    const centroid = godEar.centroid || 0
    console.log(
      `[ SUBMARINE] Z:${ZONES[zone].label} |  ${depth.toFixed(0)}m | ` +
      ` C:${centroid.toFixed(0)} |  H:${color.hue.toFixed(0)} L:${color.lightness.toFixed(0)}% | ` +
      ` E:${(energy * 100).toFixed(0)}%`
    )
  }
  
  // Log de triggers
  if (oceanicTriggers.solarCaustics) {
    console.log(`[ TRIGGER] Solar Caustics! Depth:${depth.toFixed(0)}m Clarity:${(godEar.clarity || 0).toFixed(2)}`)
  }
  if (oceanicTriggers.schoolOfFish) {
    console.log(`[ TRIGGER] School of Fish! Depth:${depth.toFixed(0)}m Transients:${(godEar.transientDensity || 0).toFixed(2)}`)
  }
  if (oceanicTriggers.whaleSong) {
    console.log(`[ TRIGGER] Whale Song! Depth:${depth.toFixed(0)}m BassEnergy:${(godEar.bassEnergy || 0).toFixed(2)}`)
  }
  if (oceanicTriggers.abyssalJellyfish) {
    console.log(`[ TRIGGER] Abyssal Jellyfish! Depth:${depth.toFixed(0)}m Flatness:${(godEar.spectralFlatness ?? 0.5).toFixed(2)}`)
  }
  
  const debugMsg = `${ZONES[zone].label} ${depth.toFixed(0)}m | H:${color.hue.toFixed(0)} L:${color.lightness.toFixed(0)}%`
  
  return {
    frontL: physics.frontL,
    frontR: physics.frontR,
    backL: physics.backL,
    backR: physics.backR,
    moverL: physics.moverL,
    moverR: physics.moverR,
    colorOverride: {
      h: color.hue / 360,
      s: color.saturation / 100,
      l: color.lightness / 100,
    },
    airIntensity: physics.airIntensity,
    currentDepth: depth,
    currentZone: zone,
    oceanicTriggers,
    debug: depthChanged ? `[DEPTH CHANGE] ${debugMsg}` : debugMsg,
  }
}

// API DE ESTADO
export const resetDeepFieldState = () => {
  state.currentDepth = 500
  state.currentZone = 'OCEAN'
  state.lastLoggedDepth = 500
  state.lastTriggerTime = { solarCaustics: 0, schoolOfFish: 0, whaleSong: 0, abyssalJellyfish: 0 }
  state.startTime = Date.now()
  console.log('[ OCEAN] State reset - returning to surface')
}

export const getDeepFieldState = () => ({
  depth: state.currentDepth,
  zone: state.currentZone,
  triggers: state.lastTriggerTime,
  uptime: Date.now() - state.startTime,
})

// DEPTH VALIDATION
export const isOceanicEffectValidForDepth = (effectType: string): { valid: boolean; reason: string } => {
  const depth = state.currentDepth
  const zone = state.currentZone
  
  switch (effectType) {
    case 'solar_caustics':
      if (depth > TRIGGER_CONFIG.solarCaustics.maxDepth) {
        return { 
          valid: false, 
          reason: ` DEPTH BLOCK: solar_caustics requiere depth<1000m, actual=${Math.round(depth)}m (${zone})`
        }
      }
      return { valid: true, reason: '' }
      
    case 'school_of_fish':
      if (depth < TRIGGER_CONFIG.schoolOfFish.minDepth || depth > TRIGGER_CONFIG.schoolOfFish.maxDepth) {
        return {
          valid: false,
          reason: ` DEPTH BLOCK: school_of_fish requiere 1000-3000m, actual=${Math.round(depth)}m (${zone})`
        }
      }
      return { valid: true, reason: '' }
      
    case 'whale_song':
      if (depth < TRIGGER_CONFIG.whaleSong.minDepth || depth > TRIGGER_CONFIG.whaleSong.maxDepth) {
        return {
          valid: false,
          reason: ` DEPTH BLOCK: whale_song requiere 3000-6000m, actual=${Math.round(depth)}m (${zone})`
        }
      }
      return { valid: true, reason: '' }
      
    case 'abyssal_jellyfish':
      if (depth < TRIGGER_CONFIG.abyssalJellyfish.minDepth) {
        return {
          valid: false,
          reason: ` DEPTH BLOCK: abyssal_jellyfish requiere depth>6000m, actual=${Math.round(depth)}m (${zone})`
        }
      }
      return { valid: true, reason: '' }
      
    default:
      return { valid: true, reason: '' }
  }
}

// Exportar configuración para UI/debug
export const OCEAN_CONFIG = {
  ZONES,
  HYDROSTATIC: HYDROSTATIC_CONFIG,
  TRIGGERS: TRIGGER_CONFIG,
}