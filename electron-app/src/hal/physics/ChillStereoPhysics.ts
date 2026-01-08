/**
 * WAVE 325.7: PRE-GATE SMOOTH ��🌊
 * ============================================================================
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

  // 1. PISO DE FLOTACIÓN (Bioluminiscencia residual)
  private readonly FLOOR = 0.15; // Nunca bajamos de aquí. Oscuridad = Miedo.

  // 2. FACTORES DE CONVERGENCIA (0.0 a 1.0)
  // MATEMÁTICA: current += (target - current) * FACTOR
  // Factor 0.70 = Converge en ~3 frames (50ms)
  // Factor 0.40 = Converge en ~6 frames (100ms)
  // Factor 0.85 = Converge en ~2 frames (33ms)

  // FRONT (Corazón del Océano - Bass) - "Corazón que late"
  private readonly FRONT_ATTACK = 0.65; // � WAVE 325.9: Golden (0.75 ajustado - marca bombos sin flicker)
  private readonly FRONT_DECAY  = 0.35; // 🏆 WAVE 325.9: Golden (moderado - líquido visible)

  // BACK (Estrellas/Plancton - Treble) - "Brillos ocasionales"
  private readonly BACK_ATTACK  = 0.60; // 🏆 WAVE 325.9: Golden (aparición suave)
  private readonly BACK_DECAY   = 0.40; // 🏆 WAVE 325.9: Golden (estela visible)

  // MOVER (Mantas/Melodía - Mid) - "Flotación constante"
  private readonly MOVER_ATTACK = 0.50; // � WAVE 325.9: Golden (ignora transientes)
  private readonly MOVER_DECAY  = 0.85; // � WAVE 325.9: Golden (ultra-líquido océano)

  // 3. GAINS & GATES (Sensibilidad)
  // FILOSOFÍA CHILL: Sin strobe, sin bofetadas, todo fluido
  // CALIBRADO CON: Deep House comercial (Café del Mar, Kygo, etc.)
  // OBJETIVO: Luz total, rellenar hueco visual entre Front y Movers
  
  private readonly BASS_GATE   = 0.32;  // 🏆 WAVE 325.9: Golden (solo bombos limpios)
  private readonly MID_GATE    = 0.12;  // 🏆 WAVE 325.9: Golden (rescata pads sutiles)
  private readonly TREBLE_GATE = 0.08;  // 🏆 WAVE 325.9: Golden (filtrar hi-hats)
  
  private readonly FRONT_GAIN  = 1.4;   // ✅ OK - Punch visible
  private readonly BACK_GAIN   = 3.8;   // 🔧 WAVE 325.9: Subido de 3.0 (más luz back)
  private readonly MOVER_GAIN  = 2.0;   // ✅ OK - Presencia flotante

  // 4. SMOOTHING PRE-GATE (WAVE 325.7 - Anti-flicker en la fuente)
  // 🔥 WAVE 325.7: SMOOTH EN LA ENTRADA (filtro anti-ruido del análisis)
  // NO es lag artificial - es limpieza de señal ANTES de procesar
  private readonly BASS_SMOOTH_FACTOR = 0.25; // 🎯 Filtro suave anti-ruido bass
  private readonly MID_SMOOTH_FACTOR = 0.20;  // 🎯 Filtro suave anti-ruido mid
  
  // Estado Interno
  private frontVal = 0.15;
  private backVal = 0.15;
  private moverVal = 0.15;
  private moverActive = false;
  private bassSmooth = 0.15; // 🔧 WAVE 325.7: Smoothing buffer bass
  private midSmooth = 0.15;  // 🔧 WAVE 325.7: Smoothing buffer mid
  private static logCounter = 0;

  constructor() { console.log('[ChillStereoPhysics] WAVE 325.9 - Golden Return �✨'); }

  public applyZones(input: ChillPhysicsInput): ChillPhysicsResult {
    const { bass, mid, treble, isRealSilence, isAGCTrap } = input;

    // TRAMPILLA DE SILENCIO (Modificada para Morphine)
    // Si hay silencio real, forzamos un Decay más rápido (x10) para apagar elegante
    const isSilence = isRealSilence || isAGCTrap;
    const silenceMult = isSilence ? 10.0 : 1.0;

    // 🎯 WAVE 325.7: PRE-GATE SMOOTHING (Filtro anti-ruido en la ENTRADA)
    // Smooth ANTES de gates = señal limpia sin micro-picos
    // NO es lag artificial - es limpieza de señal del análisis de audio
    this.bassSmooth = this.bassSmooth * this.BASS_SMOOTH_FACTOR + bass * (1 - this.BASS_SMOOTH_FACTOR);
    this.midSmooth = this.midSmooth * this.MID_SMOOTH_FACTOR + mid * (1 - this.MID_SMOOTH_FACTOR);
    
    // Usar valores suavizados para cálculos (en vez de RAW)
    const bassClean = this.bassSmooth;
    const midClean = this.midSmooth;
    const trebleClean = treble; // Treble no necesita smooth (ya es suave por naturaleza)

    // 1. CALCULO DE TARGETS (A dónde quiere ir la luz)
    
    // Front (Bass - Corazón) - USANDO BASS SUAVIZADO
    const rawFront = (bassClean > this.BASS_GATE) ? (bassClean - this.BASS_GATE) / (1 - this.BASS_GATE) : 0;
    const targetFront = Math.min(1.0, Math.max(this.FLOOR, rawFront * this.FRONT_GAIN)); // 🔥 Clamp anti-overshoot

    // Back (Treble - Estrellas brillantes ocasionales)
    const rawBack = (trebleClean > this.TREBLE_GATE) ? ((trebleClean - this.TREBLE_GATE) / (1 - this.TREBLE_GATE)) : 0;
    const targetBack = Math.min(1.0, Math.max(this.FLOOR, rawBack * this.BACK_GAIN)); // 🔥 Clamp anti-overshoot

    // Mover (Mid - Mantas flotantes) - USANDO MID SUAVIZADO
    // ANTI-SNARE: Rechazar mid si hay treble alto (snares = mid+treble)
    const TREBLE_REJECTION_THRESHOLD = 0.25; // Si treble > 0.25, reducir influencia en movers
    const trebleRejection = trebleClean > TREBLE_REJECTION_THRESHOLD 
      ? 1.0 - ((trebleClean - TREBLE_REJECTION_THRESHOLD) * 2.0) // Reduce hasta 50%
      : 1.0;
    const trebleRejectionClamped = Math.max(0.3, Math.min(1.0, trebleRejection)); // Clamp 30%-100%
    
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
