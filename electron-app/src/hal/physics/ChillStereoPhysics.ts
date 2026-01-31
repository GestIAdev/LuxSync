/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌌 CHILL STEREO PHYSICS: THE FOUR WORLDS (WAVE 1064)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 1064: THE FOUR WORLDS - Color Grading por Profundidad
 * 
 * Cada zona tiene un "efecto" visual distinto:
 * 🌿 SHALLOWS (0-200m):   "Sunlight" - Verde Esmeralda brillante (L:70, S:95)
 * 🐬 OPEN_OCEAN (200-1000m): "Clear Water" - Azul Tropical (L:60, S:90)
 * 🐋 TWILIGHT (1000-4000m): "Deep Pressure" - Índigo Puro (L:40, S:100)
 * 🪼 MIDNIGHT (4000+m):    "Bioluminescence" - Neón oscuro (L:25+energy*20, S:100)
 */

// Tipos para el sistema de profundidad
type DepthZone = 'SHALLOWS' | 'OPEN_OCEAN' | 'TWILIGHT' | 'MIDNIGHT'

export interface DeepFieldOutput {
  frontL: number; frontR: number; backL: number; backR: number
  moverL: any; moverR: any; airIntensity: number
  colorOverride?: { h: number, s: number, l: number }
  debug: string
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE ZONAS (WAVE 1064)
// ═══════════════════════════════════════════════════════════════════════════
const ZONES = {
  SHALLOWS: { min: 0, max: 200, label: '🌿' },
  OPEN_OCEAN: { min: 200, max: 1000, label: '🐬' },
  TWILIGHT: { min: 1000, max: 4000, label: '🐋' },
  MIDNIGHT: { min: 4000, max: 11000, label: '🪼' }
}

// Estado persistente
let currentDepth = 500
let lastLoggedDepth = 500

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export const calculateChillStereo = (
  time: number,
  energy: number,
  air: number,
  isKick: boolean,
  godEar: any = {}
): DeepFieldOutput => {
  const now = Date.now();

  // ═══════════════════════════════════════════════════════════════════════
  // 1. CÁLCULO DE PROFUNDIDAD (Igual que antes)
  // ═══════════════════════════════════════════════════════════════════════
  const tideCycle = 45 * 60 * 1000;
  const tidePhase = (now % tideCycle) / tideCycle;
  const baseDepth = 4000 * (1 + Math.sin(tidePhase * Math.PI * 2));

  const centroid = godEar.centroid || 1000;
  const buoyancy = (centroid - 800) * -4;

  const targetDepth = Math.max(0, Math.min(10000, baseDepth + buoyancy));
  currentDepth = currentDepth * 0.98 + targetDepth * 0.02;

  // Determinar Zona
  let zoneLabel = ZONES.OPEN_OCEAN.label;
  if (currentDepth < 200) zoneLabel = ZONES.SHALLOWS.label;
  else if (currentDepth < 1000) zoneLabel = ZONES.OPEN_OCEAN.label;
  else if (currentDepth < 4000) zoneLabel = ZONES.TWILIGHT.label;
  else zoneLabel = ZONES.MIDNIGHT.label;

  // ═══════════════════════════════════════════════════════════════════════
  // 2. COLOR GRADING (Los 4 Efectos) - AQUÍ ESTÁ LA MAGIA 🎨
  // ═══════════════════════════════════════════════════════════════════════

  // Mapeo base: 0m=150° (Verde) -> 9000m=300° (Magenta)
  const rawHue = 150 + (Math.min(currentDepth, 9000) / 9000) * 150;
  const finalHue = rawHue + Math.sin(now / 15000) * 8; // Drift suave

  let saturation = 100;
  let lightness = 50;

  // APLICAR "EFECTO" SEGÚN ZONA
  if (currentDepth < 200) {
    // 🌿 EFECTO SHALLOWS: "Sunlight"
    // Verde brillante, no sucio. Luz alta y saturación fuerte.
    saturation = 95 + energy * 5;
    lightness = 70 + Math.sin(now / 2000) * 10; // Destellos solares
  } else if (currentDepth < 1000) {
    // 🐬 EFECTO OCEAN: "Clear Water"
    saturation = 90;
    lightness = 60;
  } else if (currentDepth < 4000) {
    // 🐋 EFECTO TWILIGHT: "Deep Pressure"
    saturation = 100;
    lightness = 40;
  } else {
    // 🪼 EFECTO MIDNIGHT: "Bioluminescence"
    saturation = 100;
    lightness = 25 + energy * 20; // Solo brilla si hay energía
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. FÍSICA DE FLUIDOS (Solid State)
  // ═══════════════════════════════════════════════════════════════════════
  const oscL = Math.sin(now / 3659) + Math.sin(now / 2069) * 0.2;
  const oscR = Math.cos(now / 3023) + Math.sin(now / 2707) * 0.2;
  const breathDepth = 0.4 + energy * 0.25;

  const frontL = 0.5 + oscL * breathDepth;
  const frontR = 0.5 + oscR * breathDepth;
  const backL = 0.4 + Math.sin(now / 3659 - 1.8) * 0.3;
  const backR = 0.4 + Math.cos(now / 3023 - 2.2) * 0.3;

  // ═══════════════════════════════════════════════════════════════════════
  // 4. MOVERS & PLANKTON (Alive)
  // ═══════════════════════════════════════════════════════════════════════
  const clarity = godEar.clarity || 0;
  const bioActivity = clarity > 0.8 || energy > 0.6 ? 0.4 : 0;
  const bioRandom = Math.random() > 0.9 ? 0.5 : 0;
  const planktonFlash = (godEar.ultraAir || 0) * 50 + bioActivity * bioRandom;

  const moverPanL = 0.5 + Math.sin(now / 4603) * 0.45;
  const moverPanR = 0.5 + Math.sin(now / 3659 + 100) * 0.45;

  const moverIntL = Math.max(0, Math.min(1, 0.2 + Math.sin(now / 2500) * 0.2 + planktonFlash));
  const moverIntR = Math.max(0, Math.min(1, 0.2 + Math.sin(now / 3100 + 2) * 0.2 + planktonFlash));

  // ═══════════════════════════════════════════════════════════════════════
  // 5. LOGGING CONDICIONAL
  // ═══════════════════════════════════════════════════════════════════════
  const depthChanged = Math.abs(currentDepth - lastLoggedDepth) > 500;
  if (depthChanged) {
    lastLoggedDepth = currentDepth;
  }

  const debugMsg = `${zoneLabel} ${currentDepth.toFixed(0)}m | H:${finalHue.toFixed(0)}° L:${lightness.toFixed(0)}%`;

  return {
    frontL: Math.max(0, Math.min(1, frontL)),
    frontR: Math.max(0, Math.min(1, frontR)),
    backL: Math.max(0, Math.min(1, backL)),
    backR: Math.max(0, Math.min(1, backR)),

    moverL: { intensity: moverIntL, pan: moverPanL, tilt: 0.6 + Math.cos(now / 1753) * 0.25 },
    moverR: { intensity: moverIntR, pan: moverPanR, tilt: 0.6 + Math.cos(now / 1117) * 0.25 },

    // Override con el Grading aplicado
    colorOverride: { h: finalHue / 360, s: saturation / 100, l: lightness / 100 },

    airIntensity: Math.max(0, Math.min(0.6, energy * 0.2 + planktonFlash)),

    debug: depthChanged ? `[DEPTH CHANGE] ${debugMsg}` : debugMsg
  };
};

// Stubs legacy
export const resetDeepFieldState = () => {}
export const getDeepFieldState = () => ({})