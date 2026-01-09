/**
 * WAVE 325.7: PRE-GATE SMOOTH 🌊
 * ====================================  // NO e  // 🎯🐻 WAVE 336  // Factor 0.40 = Converge en ~6 frames (100ms)
  // Factor 0.85 = Converge en ~2 frames (33ms)

  // 🎯🐻🍸 WAVE 337: TRIPLE FIX - Decay + Cap + Gain (Cierre Definitivo Chill)
  // DIAGNÓSTICO 336: BACK strobe brutal (delta 0.25) cuando treble desaparece
  // DIAGNÓSTICO 336: FRONT picos 0.09+ por GAIN excesivo (target >0.85)
  // FILOSOFÍA: Cocktail bar = CERO bofetadas visuales, solo flow hipnótico
  // SOLUCIÓN TRIPLE:
  //   1. BACK_DECAY 0.25→0.45: Converge rápido al FLOOR cuando treble cae
  //   2. BACK_CAP 0.85: Limita bofetadas (range 0.25-0.85 = perfecto)
  //   3. FRONT_GAIN 1.4→1.2: Target máximo ~0.83 (sin sobrepasar 0.85)

  // FRONT (Corazón del Océano - Bass) - "Perfección matemática"
  private readonly FRONT_ATTACK = 0.72; // 🐻 WAVE 336: Sweet spot
  private readonly FRONT_DECAY  = 0.60; // ✅ OK - Sigue caídas bruscas

  // BACK (Estrellas/Plancton - Treble) - "Perfección bilateral + anti-bofetadas"
  private readonly BACK_ATTACK  = 0.67; // 🐻 WAVE 336: Sweet spot
  private readonly BACK_DECAY   = 0.45; // 🍸 WAVE 337: Converge rápido al FLOOR (era 0.25)NE - Ni   // 4. SMOOTHING PRE-GATE  constructor() { console.log('[ChillStereoPhysics] WAVE 336 - Goldilocks Zone 🐻🎯✨'); }(WAVE 336 - Triple Filtro Calibrado)
  // 🎯🐻 WAVE 336: GOLDILOCKS FILTERS - Balance perfecto suavidad/reactividad
  // MATEMÁTICA: smooth = smooth * FACTOR + raw * (1 - FACTOR)
  // Bass 0.38 = 95% suavidad + sin lag acumulativo en kicks rápidos
  // Treble 0.28 = 95% anti-strobe + converge correctamente en hi-hats
  private readonly BASS_SMOOTH_FACTOR = 0.38;   // 🐻 WAVE 336: Goldilocks (era 0.40)
  private readonly MID_SMOOTH_FACTOR = 0.20;    // ✅ OK - Filtro suave anti-ruido mid
  private readonly TREBLE_SMOOTH_FACTOR = 0.28; // 🐻 WAVE 336: Goldilocks (era 0.30)do, ni muy lento, PERFECTO
  // DIAGNÓSTICO 335: Ambos zonas sufren LAG ACUMULATIVO en patrones rápidos
  // CAUSA: Smoothing 0.40/0.30 + Attack 0.75/0.70 = TOO SLOW para house kicks
  // PATRÓN: Beat rápidos (kick-kick-kick) no convergen, acumulan lag, explotan
  // SOLUCIÓN: Reducir 2-3% ambos factores = 95% suavidad + 0% lag acumulativo

  // FRONT (Corazón del Océano - Bass) - "Perfección matemática"
  private readonly FRONT_ATTACK = 0.72; // 🐻 WAVE 336: Sweet spot (era 0.75)
  private readonly FRONT_DECAY  = 0.60; // ✅ OK - Sigue caídas bruscas

  // BACK (Estrellas/Plancton - Treble) - "Perfección bilateral"
  private readonly BACK_ATTACK  = 0.67; // 🐻 WAVE 336: Sweet spot (era 0.70)
  private readonly BACK_DECAY   = 0.25; // ✅ OK - Baja lento pri  // Estado   // Estado Interno
  private frontVal = 0.15;
  private backVal = 0.25;  // 🌟 Inicializa con BACK_FLOOR
  private moverVal = 0.15;
  private moverActive = false;
  private bassSmooth = 0.15;   // 🔧 WAVE 325.7: Smoothing buffer bass
  private midSmooth = 0.15;    // 🔧 WAVE 325.7: Smoothing buffer mid
  private trebleSmooth = 0.05; // 🔫 WAVE 335: Smoothing buffer treble (anti-strobe BACK)
  private static logCounter = 0;

  constructor() { console.log('[ChillStereoPhysics] WAVE 335 - Double Barrel Shotgun 🔫🔫💀'); }onstructor() { console.log('[ChillStereoPhysics] WAVE 334 - Front Tamers 🎯🌊'); }
  private frontVal = 0.15;
  private backVal = 0.25;  // 🌟 Inicializa con BACK_FLOOR
  private moverVal = 0.15;
  private moverActive = false;
  private bassSmooth = 0.15;
  private midSmooth = 0.15;
  private static logCounter = 0;

  constructor() { console.log('[ChillStereoPhysics] WAVE 333 - Gate Tuning Final 🎯✨'); }al = 0.15;
  private moverVal = 0.15;
  private moverActive = false;
  private bassSmooth = 0.15;
  private midSmooth = 0.15;
  private static logCounter = 0;

  constructor() { console.log('[ChillStereoPhysics] WAVE 332.5 - Decay Flow + Back Presence 🌊🌟'); }es limpieza de señal ANTES de procesar
  private readonly BASS_SMOOTH_FACTOR = 0.25; // 🎯 Filtro suave anti-ruido bass
  private readonly MID_SMOOTH_FACTOR = 0.20;  // 🎯 Filtro suave anti-ruido mid
  
  // Estado Interno
  private frontVal = 0.15;
  private backVal = 0.25;  // 🌟 WAVE 332: Inicializa con BACK_FLOOR
  private moverVal = 0.15;
  private moverActive = false;
  private bassSmooth = 0.15;
  private midSmooth = 0.15;
  private static logCounter = 0;

  constructor() { console.log('[ChillStereoPhysics] WAVE 337 - Triple Fix 🍸🎯✨ (Decay+Cap+Gain)'); }==========================
 * EL CABALLO GANADOR - SMOOTH EN LA ENTRADA, NO EN LA SALIDA
 * 
 * PROBLEMA RAÍZ (WAVE 325.6):
 * - RAW Bass salta: 0.512 → 0.700 → 0.735 (DELTA +0.188 en 2 frames!)
 * - No es el Attack/Decay - Es el RUIDO del análisis de audio
 * - Los micro-picos del RAW causan parpadeos visibles
 * 
 * SOLUCIÓN WAVE 325.7 - SMOOTH PRE-GATE:
 * - BASS_SMOOTH: 0.00 → 0.25 (Filtro anti-ruido ANTES de gates)
 * - MID_SMOOTH: NUEVO 0.20 (Filtro anti-ruido en movers)
 * - Diferencia crítica: Smooth ANTES de procesar, no después
 * - = Señal limpia entra al sistema physics, no lag artificial en salida
 * 
 * MATEMÁTICA CONVERGENCIA (de WAVE 325.6):
 * - FRONT_ATTACK: 0.38 = 4 frames (67ms) - Subidas graduales
 * - MOVER_ATTACK: 0.30 = 5 frames (83ms) - Flotación ultra-suave
 * - MOVER_DECAY: 0.20 = 5 frames (83ms) - Glaciar profundo
 * ============================================================================
 */

import type { ElementalModifiers } from '../../engine/physics/ElementalModifiers';

export interface ChillPhysicsInput {
  bass: number; mid: number; treble: number; energy: number;
  isRealSilence: boolean; isAGCTrap: boolean;
}

export interface ChillPhysicsResult {
  frontParIntensity: number; backParIntensity: number;
  moverIntensity: number; moverActive: boolean;
  physicsApplied: 'chill';
}

export class ChillStereoPhysics {

  // 1. PISOS & CAPS (Rango dinámico controlado)
  // 🔧 WAVE 332: BACK tiene su propio piso más alto (ambiente constante)
  // 🍸 WAVE 337: CAP a 0.85 para evitar bofetadas visuales (filosofía cocktail bar)
  private readonly FLOOR = 0.15;      // Piso general (Front, Movers)
  private readonly BACK_FLOOR = 0.25; // 🌟 WAVE 332: Back siempre presente
  private readonly BACK_CAP = 0.85;   // 🍸 WAVE 337: Sin bofetadas, solo flow chill

  // 2. FACTORES DE CONVERGENCIA (0.0 a 1.0)
  // MATEMÁTICA: current += (target - current) * FACTOR
  // Factor 0.70 = Converge en ~3 frames (50ms)
  // Factor 0.40 = Converge en ~6 frames (100ms)
  // Factor 0.85 = Converge en ~2 frames (33ms)

  // 🔥🔫 WAVE 335: DOUBLE BARREL SHOTGUN - Lock, Stock & Two Smoking Barrels
  // DIAGNÓSTICO 334: FRONT 90% resuelto, pero drops brutales (0.80→0.55) generan delta 0.09
  // DIAGNÓSTICO 334: BACK tiene DOBLE strobe que FRONT (delta 0.25+ en treble spikes)
  // SOLUCIÓN DOBLE: Ultra-smooth FRONT (0.40/0.75) + Homogeneizar BACK (0.70 como FRONT)

  // FRONT (Corazón del Océano - Bass) - "Ultra-smooth, drops incluidos"
  private readonly FRONT_ATTACK = 0.75; // � WAVE 335: CAÑÓN 1 - Ultra lento (era 0.70)
  private readonly FRONT_DECAY  = 0.60; // ✅ OK - Sigue caídas bruscas

  // BACK (Estrellas/Plancton - Treble) - "Homogéneo con FRONT, sin strobe"
  private readonly BACK_ATTACK  = 0.70; // � WAVE 335: CAÑÓN 2 - Mismo que FRONT (era 0.35)
  private readonly BACK_DECAY   = 0.25; // ✅ OK - Baja lento

  // MOVER (Mantas/Melodía - Mid) - "Reacciona a melodías medias"
  private readonly MOVER_ATTACK = 0.28; // ✅ OK - Suaviza entradas
  private readonly MOVER_DECAY  = 0.92; // ✅ OK - Balance flotación

  // 3. GAINS & GATES (Sensibilidad)
  // 🍸 WAVE 337: FILOSOFÍA COCKTAIL BAR - Cero bofetadas, solo flow
  // CALIBRADO CON: Etnochill, Psydub, Deep House
  
  private readonly BASS_GATE   = 0.42;  // 🔧 WAVE 333: Filtrar fugas
  private readonly MID_GATE    = 0.15;  // 🔧 WAVE 333: Melodías medias
  private readonly TREBLE_GATE = 0.05;  // ✅ OK - BACK presente
  
  private readonly FRONT_GAIN  = 1.2;   // 🍸 WAVE 337: Target máx ~0.83 (era 1.4)
  private readonly BACK_GAIN   = 3.8;   // 🔧 WAVE 332.5: Presencia BACK (con CAP 0.85)
  private readonly MOVER_GAIN  = 2.2;   // ✅ OK - Presencia melodía

  // 4. SMOOTHING PRE-GATE (WAVE 335 - Triple Filtro Anti-Flicker)
  // 🔥🔫 WAVE 335: FILTROS INICIALES - Cortan ruido ANTES de procesar physics
  // MATEMÁTICA: smooth = smooth * FACTOR + raw * (1 - FACTOR)
  // Bass 0.40 = Drops brutales suavizados (0.80→0.55 = delta 0.05 max)
  // Treble 0.30 = Spikes strobe eliminados (0.10→0.23 = converge gradual)
  private readonly BASS_SMOOTH_FACTOR = 0.40;   // � WAVE 335: Ultra-smooth (era 0.35)
  private readonly MID_SMOOTH_FACTOR = 0.20;    // ✅ OK - Filtro suave anti-ruido mid
  private readonly TREBLE_SMOOTH_FACTOR = 0.30; // 🔫 WAVE 335: NUEVO - Anti-strobe BACK
  
  // Estado Interno
  private frontVal = 0.15;
  private backVal = 0.25;  // 🌟 Inicializa con BACK_FLOOR
  private moverVal = 0.15;
  private moverActive = false;
  private bassSmooth = 0.15;   // 🔧 WAVE 325.7: Smoothing buffer bass
  private midSmooth = 0.15;    // 🔧 WAVE 325.7: Smoothing buffer mid
  private trebleSmooth = 0.05; // 🔫 WAVE 335: Smoothing buffer treble (anti-strobe BACK)
  private static logCounter = 0;

  constructor() { console.log('[ChillStereoPhysics] WAVE 331.5 - Anti-Snare Activado �✨'); }

  public applyZones(input: ChillPhysicsInput): ChillPhysicsResult {
    const { bass, mid, treble, isRealSilence, isAGCTrap } = input;

    // TRAMPILLA DE SILENCIO (Modificada para Morphine)
    // Si hay silencio real, forzamos un Decay más rápido (x10) para apagar elegante
    const isSilence = isRealSilence || isAGCTrap;
    const silenceMult = isSilence ? 10.0 : 1.0;

    // 🎯🔫 WAVE 335: TRIPLE PRE-GATE SMOOTHING (Filtros anti-ruido en la ENTRADA)
    // Smooth ANTES de gates = señal limpia sin micro-picos ni spikes
    // Bass 0.40 = Drops brutales suavizados
    // Mid 0.20 = Melodías limpias
    // Treble 0.30 = NUEVO - Elimina strobe en BACK
    this.bassSmooth = this.bassSmooth * this.BASS_SMOOTH_FACTOR + bass * (1 - this.BASS_SMOOTH_FACTOR);
    this.midSmooth = this.midSmooth * this.MID_SMOOTH_FACTOR + mid * (1 - this.MID_SMOOTH_FACTOR);
    this.trebleSmooth = this.trebleSmooth * this.TREBLE_SMOOTH_FACTOR + treble * (1 - this.TREBLE_SMOOTH_FACTOR);
    
    // Usar valores suavizados para cálculos (en vez de RAW)
    const bassClean = this.bassSmooth;
    const midClean = this.midSmooth;
    const trebleClean = this.trebleSmooth; // 🔫 WAVE 335: Ahora TAMBIÉN suavizado (anti-strobe)

    // 1. CALCULO DE TARGETS (A dónde quiere ir la luz)
    
    // Front (Bass - Corazón) - USANDO BASS SUAVIZADO
    const rawFront = (bassClean > this.BASS_GATE) ? (bassClean - this.BASS_GATE) / (1 - this.BASS_GATE) : 0;
    const targetFront = Math.min(1.0, Math.max(this.FLOOR, rawFront * this.FRONT_GAIN));

    // Back (Treble - Ambiente + Brillos) - USANDO BACK_FLOOR PROPIO
    // 🍸 WAVE 337: Back oscila entre 0.25-0.85 (cocktail bar - cero bofetadas)
    const rawBack = (trebleClean > this.TREBLE_GATE) ? ((trebleClean - this.TREBLE_GATE) / (1 - this.TREBLE_GATE)) : 0;
    const targetBack = Math.min(this.BACK_CAP, Math.max(this.BACK_FLOOR, rawBack * this.BACK_GAIN)); // � Cap at 0.85

    // Mover (Mid - Mantas flotantes) - USANDO MID SUAVIZADO
    // 🔥 WAVE 331.5: ANTI-SNARE AGRESIVO
    // Snares/Hi-hats = Mid+Treble simultáneo. Si treble sube, reducir movers.
    // DIAGNÓSTICO: threshold 0.25 NUNCA se activaba (treble rara vez > 0.22)
    const TREBLE_REJECTION_THRESHOLD = 0.10; // 🔧 Activar con cualquier treble notable
    const trebleRejection = trebleClean > TREBLE_REJECTION_THRESHOLD 
      ? 1.0 - ((trebleClean - TREBLE_REJECTION_THRESHOLD) * 3.0) // 🔧 Factor 3x más agresivo
      : 1.0;
    const trebleRejectionClamped = Math.max(0.2, Math.min(1.0, trebleRejection)); // 🔧 Puede reducir hasta 80%
    
    const rawMover = (midClean > this.MID_GATE) ? ((midClean - this.MID_GATE) / (1 - this.MID_GATE)) : 0;
    const targetMover = Math.min(1.0, Math.max(this.FLOOR, rawMover * this.MOVER_GAIN * trebleRejectionClamped)); // 🔥 Clamp anti-overshoot

    // 2. APLICACIÓN DE FÍSICA PROPORCIONAL (The Morphine)
    // current += (target - current) * factor
    
    this.frontVal = this.morphineSmooth(this.frontVal, targetFront, this.FRONT_ATTACK, this.FRONT_DECAY * silenceMult);
    this.backVal  = this.morphineSmooth(this.backVal, targetBack, this.BACK_ATTACK, this.BACK_DECAY * silenceMult);
    this.moverVal = this.morphineSmooth(this.moverVal, targetMover, this.MOVER_ATTACK, this.MOVER_DECAY * silenceMult);

    // Activación lógica
    this.moverActive = this.moverVal > (this.FLOOR + 0.05);

    // WAVE 324.6: MACROLOG - CADA FRAME (60fps full capture)
    // WAVE 325.7: Mostrar valores RAW y SMOOTH para debugging
    ChillStereoPhysics.logCounter++;
    if (ChillStereoPhysics.logCounter % 1 === 0) {  // EVERY FRAME
      const frontDelta = Math.abs(targetFront - this.frontVal);
      const backDelta = Math.abs(targetBack - this.backVal);
      const moverDelta = Math.abs(targetMover - this.moverVal);
      
      console.log(`[💊] RAW[B:${bass.toFixed(3)} M:${mid.toFixed(3)} T:${treble.toFixed(3)}]`);
      console.log(`[🌊] SMOOTH[B:${bassClean.toFixed(3)} M:${midClean.toFixed(3)}]`);
      console.log(`[🎯] TGT[F:${targetFront.toFixed(3)} B:${targetBack.toFixed(3)} M:${targetMover.toFixed(3)}]`);
      console.log(`[💡] OUT[F:${this.frontVal.toFixed(3)} B:${this.backVal.toFixed(3)} M:${this.moverVal.toFixed(3)}]`);
      console.log(`[�] DELTA[F:${frontDelta.toFixed(3)} B:${backDelta.toFixed(3)} M:${moverDelta.toFixed(3)}] TrebleRej:${trebleRejectionClamped.toFixed(2)}`);
    }

    return { 
      frontParIntensity: Math.min(1.0, this.frontVal), 
      backParIntensity: Math.min(1.0, this.backVal), 
      moverIntensity: Math.min(1.0, this.moverVal), 
      moverActive: this.moverActive, 
      physicsApplied: 'chill' 
    };
  }

  /**
   * EL MOTOR DE MORFINA
   * Suavizado proporcional asimétrico.
   * Elimina el parpadeo porque los cambios son siempre un % de la distancia restante.
   */
  private morphineSmooth(current: number, target: number, attackFactor: number, decayFactor: number): number {
    if (target > current) {
      // SUBIENDO (Attack)
      // Si factor es 0.05, sube un 5% de la distancia restante en cada frame.
      return current + (target - current) * attackFactor;
    } else {
      // BAJANDO (Decay)
      // Si factor es 0.01, baja un 1% de la distancia restante.
      // Cuanto más cerca del objetivo, más pequeño el paso. SUPER SUAVE.
      return current + (target - current) * decayFactor;
    }
  }

  // Legacy & Reset
  public apply(palette: any, metrics: any, _mods?: any, _bpm?: number): any {
    // Llamar a applyZones para obtener las intensidades
    const result = this.applyZones({
      bass: metrics.normalizedBass,
      mid: metrics.normalizedMid,
      treble: metrics.normalizedTreble,
      energy: metrics.normalizedEnergy,
      isRealSilence: false,
      isAGCTrap: false
    });

    // Devolver estructura compatible con SeleneLux (legacy API)
    return {
      palette: palette, // Pasar paleta sin modificar
      breathPhase: 0,
      isStrobe: false,
      dimmerModulation: 0,
      zoneIntensities: {
        front: result.frontParIntensity,
        back: result.backParIntensity,
        moverL: result.moverIntensity,  // Movers en estéreo (mismo valor)
        moverR: result.moverIntensity   // Movers en estéreo (mismo valor)
      },
      debugInfo: {
        bassHit: result.frontParIntensity > 0.30,
        midHit: result.backParIntensity > 0.30,
        padActive: result.moverActive,
        twilightPhase: 0,
        crossFadeRatio: 0
      }
    };
  }
  
  public reset(): void { 
    this.frontVal = this.FLOOR; 
    this.backVal = this.FLOOR; 
    this.moverVal = this.FLOOR; 
  }
}

export const chillStereoPhysics = new ChillStereoPhysics();
