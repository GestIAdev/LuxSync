/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌌 CHILL STEREO PHYSICS: THE ABYSSAL CHRONICLES (WAVE 1060)
 * ═══════════════════════════════════════════════════════════════════════════
 * "Cuanto más profundo vas, más extraña es la luz."
 * * SISTEMA DE PROFUNDIDAD DINÁMICA:
 * 1. ⚛️ RELOJ ISOTÓPICO: Ciclo base de ~45 min basado en Date.now().
 * 2. 🩻 GOD EAR MODULATION: 
 * - Centroid alto (>2000Hz) -> Flotabilidad positiva (hacia superficie).
 * - Centroid bajo (<500Hz) -> Presión negativa (hacia el fondo).
 * 3. 🎨 COLOR SYNTHESIS: Genera HSL nativo basado en la profundidad.
 * 4. 🪼 BIOLUMINISCENCIA: Reactiva a UltraAir (16-22kHz).
 */

// Tipos para el sistema de profundidad
type DepthZone = 'SHALLOWS' | 'OPEN_OCEAN' | 'TWILIGHT' | 'MIDNIGHT'

export interface DeepFieldOutput {
  frontL: number; frontR: number; backL: number; backR: number
  moverL: any; moverR: any; airIntensity: number
  colorOverride?: { h: number, s: number, l: number } // Nuevo canal de color
  debug: string
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Configuración de las zonas de profundidad (Metros virtuales)
const ZONES = {
  SHALLOWS: { min: 0, max: 200, hue: 160, speed: 1.5, label: '🌿' },    // Verde Agua
  OPEN_OCEAN: { min: 200, max: 1000, hue: 200, speed: 1.0, label: '🐬' }, // Cian/Azul
  TWILIGHT: { min: 1000, max: 4000, hue: 250, speed: 0.6, label: '🐋' },  // Índigo
  MIDNIGHT: { min: 4000, max: 11000, hue: 290, speed: 0.3, label: '🪼' }  // UV/Magenta
}

// Estado persistente mínimo (para suavizado de profundidad)
let currentDepth = 500 // Empezamos en Open Ocean
let lastLoggedDepth = 500 // Control de logging (evita spam)

export const calculateChillStereo = (
  time: number,      
  energy: number,    
  air: number,       
  isKick: boolean,
  godEar: any = {} // Recibimos telemetría completa
): DeepFieldOutput => {
  
  const now = Date.now(); // Milisegundos absolutos (FIX: Evita saltos cuánticos)
  
  // ═══════════════════════════════════════════════════════════════════════
  // 1. CÁLCULO DE PROFUNDIDAD (La Narrativa)
  // ═══════════════════════════════════════════════════════════════════════
  
  // A. El Ciclo de Marea (Reloj de 45 minutos)
  // Oscila entre 0m y 8000m lentamente
  const tideCycle = 45 * 60 * 1000 // 45 min en milisegundos
  const tidePhase = (now % tideCycle) / tideCycle // 0.0 a 1.0
  const baseDepth = 4000 * (1 + Math.sin(tidePhase * Math.PI * 2)) // 0 a 8000m
  
  // B. Modulación Espectral (God Ear) - La "Flotabilidad"
  // Centroid alto (voces, hihats) nos sube. Bajos profundos nos hunden.
  const centroid = godEar.centroid || 1000
  const buoyancy = (centroid - 800) * -2 // -2m por cada Hz arriba de 800
  
  // Integración suave (Lerp) para evitar saltos bruscos
  const targetDepth = clamp(baseDepth + buoyancy, 0, 10000)
  currentDepth = currentDepth * 0.99 + targetDepth * 0.01 // Inercia hidrodinámica
  
  // Determinar Zona Actual
  let zone: DepthZone = 'OPEN_OCEAN'
  let zoneConfig = ZONES.OPEN_OCEAN
  
  if (currentDepth < ZONES.SHALLOWS.max) { zone = 'SHALLOWS'; zoneConfig = ZONES.SHALLOWS }
  else if (currentDepth < ZONES.OPEN_OCEAN.max) { zone = 'OPEN_OCEAN'; zoneConfig = ZONES.OPEN_OCEAN }
  else if (currentDepth < ZONES.TWILIGHT.max) { zone = 'TWILIGHT'; zoneConfig = ZONES.TWILIGHT }
  else { zone = 'MIDNIGHT'; zoneConfig = ZONES.MIDNIGHT }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. SÍNTESIS DE COLOR (Cromatografía de Presión)
  // ═══════════════════════════════════════════════════════════════════════
  
  // El color base depende de la profundidad exacta, no solo de la zona (gradiente)
  // Mapeamos 0-10000m a un rango de HUE (150 - 320)
  // 0m = 150 (Verde) -> 10000m = 300 (Magenta)
  const depthHue = 150 + (Math.min(currentDepth, 8000) / 8000) * 150
  
  // Variación "Bioluminiscente": Ondulación lenta del matiz
  const hueDrift = Math.sin(now * 0.1) * 10
  const finalHue = depthHue + hueDrift
  
  // Saturación y Luz bajan con la profundidad (más oscuro y monocromático abajo)
  const saturation = clamp(100 - (currentDepth / 500), 60, 100)
  const lightness = clamp(60 - (currentDepth / 300), 20, 60) // Nunca negro total

  // ═══════════════════════════════════════════════════════════════════════
  // 3. FÍSICA DE FLUIDOS (SOLID STATE - NO FLICKER)
  // ═══════════════════════════════════════════════════════════════════════
  
  // Usamos divisores PRIMOS CONSTANTES en ms. La energía NO toca el tiempo.
  
  // LEFT: Ciclo ~23 segundos
  const oscL = Math.sin(now / 3659) + (Math.sin(now / 2069) * 0.2);
  
  // RIGHT: Ciclo ~19 segundos (Desfasado)
  const oscR = Math.cos(now / 3023) + (Math.sin(now / 2707) * 0.2);
  
  // Modulador de Amplitud (Respiración): La energía solo afecta la altura de la ola
  const breathDepth = 0.4 + (energy * 0.2); 
  
  const frontL = 0.5 + (oscL * breathDepth);
  const frontR = 0.5 + (oscR * breathDepth);
  
  // Back: Eco con retraso fijo
  const backL = 0.4 + (Math.sin((now / 3659) - 1.8) * 0.3);
  const backR = 0.4 + (Math.cos((now / 3023) - 2.2) * 0.3);

  // ═══════════════════════════════════════════════════════════════════════
  // 4. MOVERS & PLANKTON (Los Habitantes)
  // ═══════════════════════════════════════════════════════════════════════
  
  // Plankton: Reactivo a UltraAir (16-22kHz)
  // Si estamos profundos (TWILIGHT/MIDNIGHT), el plankton brilla más
  const planktonSensitivity = currentDepth > 1000 ? 50 : 10
  const planktonFlash = (godEar.ultraAir || 0) * planktonSensitivity
  
  // Movers (Movimiento lento constante basado en ms)
  const moverPanL = 0.5 + Math.sin(now / 4603) * 0.45; 
  const moverPanR = 0.5 + Math.sin((now / 3659) + 100) * 0.45; 
  
  // Intensidad Movers (Divisores lentos en ms)
  const moverIntL = clamp(0.3 + (Math.sin(now / 2500) * 0.3) + planktonFlash, 0, 1)
  const moverIntR = clamp(0.3 + (Math.sin(now / 3100 + 2) * 0.3) + planktonFlash, 0, 1)

  // ═══════════════════════════════════════════════════════════════════════
  // 5. SALIDA
  // ═══════════════════════════════════════════════════════════════════════

  // 🔍 LOGGING CONDICIONAL: Solo logea si profundidad cambió >500m
  const depthChanged = Math.abs(currentDepth - lastLoggedDepth) > 500
  if (depthChanged) {
    lastLoggedDepth = currentDepth
  }
  
  const debugMsg = `${zoneConfig.label} ${zone} ${currentDepth.toFixed(0)}m | H:${finalHue.toFixed(0)}° S:${saturation.toFixed(0)}% L:${lightness.toFixed(0)}%`

  return {
    frontL: clamp(frontL, 0, 1),
    frontR: clamp(frontR, 0, 1),
    backL:  clamp(backL, 0, 1),
    backR:  clamp(backR, 0, 1),
    
    moverL: { intensity: moverIntL, pan: moverPanL, tilt: 0.6 + Math.cos(now*0.1)*0.2 },
    moverR: { intensity: moverIntR, pan: moverPanR, tilt: 0.6 + Math.cos(now*0.11)*0.2 },
    
    // Inyectamos el COLOR CALCULADO para que el Arbiter lo use
    colorOverride: { h: finalHue / 360, s: saturation / 100, l: lightness / 100 },
    
    airIntensity: clamp(energy * 0.2 + planktonFlash, 0, 0.5),
    
    // 🔍 LOG CON FLAG DE CUANDO LOGEAR (depthChanged = true si varió >500m)
    debug: depthChanged ? `[DEPTH CHANGE] ${debugMsg}` : `${debugMsg}`
  }
}

// Stubs legacy
export const resetDeepFieldState = () => {}
export const getDeepFieldState = () => ({})