/**
 * WAVE 323: THE MORPHINE UPDATE (REFRITO MORFÍNICO) 💊🌊
 * ============================================================================
 * AUTOR: Sonnet 4.5 (Forensic Analysis) + Gemini (Implementation)
 * * FILOSOFÍA: "La naturaleza no es lineal, es logarítmica"
 * * * EL ERROR ANTERIOR (Viscosity/Linear):
 * - Restar un valor fijo (val -= 0.005) crea "escalones" visibles en valores bajos.
 * - Causa parpadeo en monitores rápidos (120Hz).
 * * * LA SOLUCIÓN (Latino/Techno Math):
 * - Usar CONVERGENCIA PROPORCIONAL: `val += (target - val) * FACTOR`
 * - Al acercarse al objetivo, el paso se vuelve microscópico.
 * - Resultado: Suavidad infinita (Asíntota).
 * * * CONFIGURACIÓN "OCÉANO":
 * - ATTACK: Bajo (0.05) -> La luz tarda en subir (Inercia de agua).
 * - DECAY: Minúsculo (0.02) -> La luz tarda una eternidad en bajar.
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
  private readonly FRONT_ATTACK = 0.75; // Subida rápida (marcar golpe de bombo)
  private readonly FRONT_DECAY  = 0.35; // Bajada moderada (líquida pero visible)

  // BACK (Estrellas/Plancton - Treble) - "Brillos ocasionales"
  private readonly BACK_ATTACK  = 0.60; // Subida moderada (aparición suave)
  private readonly BACK_DECAY   = 0.40; // Bajada moderada (estela visible)

  // MOVER (Mantas/Melodía - Mid) - "Flotación constante"
  private readonly MOVER_ATTACK = 0.50; // Subida lenta (ignorar transientes)
  private readonly MOVER_DECAY  = 0.85; // Bajada ultra-líquida (océano)

  // 3. GAINS & GATES (Sensibilidad)
  // FILOSOFÍA CHILL: Sin strobe, sin bofetadas, todo fluido
  // CALIBRADO CON: Deep House comercial (Café del Mar, Kygo, etc.)
  
  private readonly BASS_GATE   = 0.32;  // ✅ PERFECTO - Solo bombos limpios
  private readonly MID_GATE    = 0.12;  // 🔧 BAJADO de 0.18 (rescatar pads sutiles)
  private readonly TREBLE_GATE = 0.08;  // 🔧 BAJADO BRUTAL de 0.15 (treble típico: 0.08-0.23)
  
  private readonly FRONT_GAIN  = 1.4;   // ✅ OK - Punch visible
  private readonly BACK_GAIN   = 3.0;   // 🔧 SUBIDO de 2.8 (compensar gate bajo)
  private readonly MOVER_GAIN  = 2.0;   // 🔧 SUBIDO de 1.9 (más presencia)

  // Estado Interno
  private frontVal = 0.15;
  private backVal = 0.15;
  private moverVal = 0.15;
  private moverActive = false;
  private static logCounter = 0;

  constructor() { console.log('[ChillStereoPhysics] WAVE 323 - Morphine Engine Active'); }

  public applyZones(input: ChillPhysicsInput): ChillPhysicsResult {
    const { bass, mid, treble, isRealSilence, isAGCTrap } = input;

    // TRAMPILLA DE SILENCIO (Modificada para Morphine)
    // Si hay silencio real, forzamos un Decay más rápido (x10) para apagar elegante
    const isSilence = isRealSilence || isAGCTrap;
    const silenceMult = isSilence ? 10.0 : 1.0;

    // 1. CALCULO DE TARGETS (A dónde quiere ir la luz)
    
    // Front (Bass - Corazón)
    const rawFront = (bass > this.BASS_GATE) ? (bass - this.BASS_GATE) / (1 - this.BASS_GATE) : 0;
    const targetFront = Math.max(this.FLOOR, rawFront * this.FRONT_GAIN);

    // Back (Treble - Estrellas brillantes ocasionales)
    const rawBack = (treble > this.TREBLE_GATE) ? ((treble - this.TREBLE_GATE) / (1 - this.TREBLE_GATE)) : 0;
    const targetBack = Math.max(this.FLOOR, rawBack * this.BACK_GAIN);

    // Mover (Mid - Mantas flotantes)
    // ANTI-SNARE: Rechazar mid si hay treble alto (snares = mid+treble)
    const TREBLE_REJECTION_THRESHOLD = 0.25; // Si treble > 0.25, reducir influencia en movers
    const trebleRejection = treble > TREBLE_REJECTION_THRESHOLD 
      ? 1.0 - ((treble - TREBLE_REJECTION_THRESHOLD) * 2.0) // Reduce hasta 50%
      : 1.0;
    const trebleRejectionClamped = Math.max(0.3, Math.min(1.0, trebleRejection)); // Clamp 30%-100%
    
    const rawMover = (mid > this.MID_GATE) ? ((mid - this.MID_GATE) / (1 - this.MID_GATE)) : 0;
    const targetMover = Math.max(this.FLOOR, rawMover * this.MOVER_GAIN * trebleRejectionClamped);

    // 2. APLICACIÓN DE FÍSICA PROPORCIONAL (The Morphine)
    // current += (target - current) * factor
    
    this.frontVal = this.morphineSmooth(this.frontVal, targetFront, this.FRONT_ATTACK, this.FRONT_DECAY * silenceMult);
    this.backVal  = this.morphineSmooth(this.backVal, targetBack, this.BACK_ATTACK, this.BACK_DECAY * silenceMult);
    this.moverVal = this.morphineSmooth(this.moverVal, targetMover, this.MOVER_ATTACK, this.MOVER_DECAY * silenceMult);

    // Activación lógica
    this.moverActive = this.moverVal > (this.FLOOR + 0.05);

    // WAVE 324: DIAGNOSTIC LOGGING (Cada 30 frames = ~500ms)
    ChillStereoPhysics.logCounter++;
    if (ChillStereoPhysics.logCounter % 30 === 0) {
      console.log(`[Morphine 💊] RAW[B:${bass.toFixed(2)} M:${mid.toFixed(2)} T:${treble.toFixed(2)}]`);
      console.log(`[Morphine 🎯] TGT[F:${targetFront.toFixed(2)} B:${targetBack.toFixed(2)} M:${targetMover.toFixed(2)}] TrebleRej:${trebleRejectionClamped.toFixed(2)}`);
      console.log(`[Morphine 💡] OUT[F:${this.frontVal.toFixed(2)} B:${this.backVal.toFixed(2)} M:${this.moverVal.toFixed(2)}]`);
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
