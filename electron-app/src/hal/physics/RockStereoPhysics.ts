/**
 * WAVE 306.2: ATOMIC FRONTS + LIQU// FRONT = Bass puro (sin transient detection, solo volumen)
const FRONT_GAIN = 1.5;              // Ganancia bass
const FRONT_GATE = 0.15;             // Gate BAJO
const FRONT_ATTACK = 0.50;           // Attack
const FRONT_DECAY_LINEAR = 0.08;     // Decay lineal

// BACK = MID agresivo (más sensible que Movers)
const BACK_GAIN = 2.2;               // 🔧 MÁS ganancia (era 1.8)
const BACK_GATE = 0.15;              // 🔧 Gate MÁS BAJO (era 0.18)
const BACK_ATTACK = 0.70;            // 🔧 Attack MÁS RÁPIDO
const BACK_DECAY_LINEAR = 0.12;      // Decay lineal

// MOVERS = Mid suave (melodía de fondo)
const MOVER_GAIN = 1.4;              // 🔧 Menos gain (era 1.5)
const MOVER_GATE = 0.20;             // 🔧 Gate MÁS ALTO (era 0.18)
const MOVER_ATTACK = 0.50;           // 🔧 Attack MÁS LENTO
const MOVER_DECAY_LINEAR = 0.10;     // Decay lineal============================================================================
 * 
 * PROBLEMA 306.1: 
 *   - Front PARs aún anémicos (0.54-0.73 con bass 0.78)
 *   - Back PARs binarios (0.95 o 0.00 sin transición)
 * 
 * SOLUCIÓN 306.2:
 *   FRONT PARs → WALL_MULT subido a 1.6, FLOOR a 0.35
 *                TRANSIENT_MULT subido a 3.0 para más punch
 *                Más reactivo (smoothing 0.08)
 *   
 *   BACK PARs  → DECAY líquido (0.70) - ya no salta a 0
 *                Floor mínimo 0.15 para relleno
 *                Decae suavemente entre golpes
 * 
 * FILOSOFÍA: El rock necesita PRESENCIA constante, no silencio entre golpes
 * 
 * ============================================================================
 */

// --- Input Interface ---
export interface SpectrumData {
  bass: number;
  mid: number;
  treble: number;
}

// --- Result Interface ---
export interface RockZonesResult {
  front: number;  // Kicks/Bass → Front PARs
  back: number;   // Snare → Back PARs (TECHNO LOGIC)
  mover: number;  // Guitar/Melody → Movers (LATINO LOGIC)
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 311: MURO DE SONIDO - Filosofía Gemini + Decay Lineal
// ═══════════════════════════════════════════════════════════════════════════

// FRONT = Bass puro (sin transient detection, solo volumen)
const FRONT_GAIN = 1.5;              // Ganancia bass
const FRONT_GATE = 0.15;             // Gate BAJO
const FRONT_ATTACK = 0.50;           // Attack
const FRONT_DECAY_LINEAR = 0.08;     // Decay lineal

// BACK = MID como los Movers (si funciona allí, funciona aquí)
const BACK_GAIN = 1.8;               // Ganancia moderada
const BACK_GATE = 0.23;              // Gate como Movers (0.18)
const BACK_ATTACK = 0.65;            // Attack rápido
const BACK_DECAY_LINEAR = 0.12;      // Decay lineal

// MOVERS = Mid puro (guitarra/voz)
const MOVER_GAIN = 1.5;              // Ganancia mid
const MOVER_GATE = 0.10;             // Gate bajo
const MOVER_ATTACK = 0.60;           // Attack
const MOVER_DECAY_LINEAR = 0.10;     // Decay lineal

// ═══════════════════════════════════════════════════════════════════════════
// FRANKENSTEIN CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class RockStereoPhysics {
  // --- Internal State ---
  private frontParIntensity = 0;
  private backParIntensity = 0;
  private moverIntensity = 0;

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN PROCESSING: applyZones()
  // ─────────────────────────────────────────────────────────────────────────
  applyZones(spectrum: SpectrumData, _bpm?: number): RockZonesResult {
    // Safety check
    if (!spectrum || typeof spectrum.bass !== 'number' || 
        typeof spectrum.mid !== 'number' || typeof spectrum.treble !== 'number') {
      return { front: 0, back: 0, mover: 0 };
    }

    const { bass, mid, treble } = spectrum;

    // ═══════════════════════════════════════════════════════════════════════
    // WAVE 311: MURO DE SONIDO - Front PARs (Bass puro)
    // ═══════════════════════════════════════════════════════════════════════
    if (bass >= FRONT_GATE) {
      const normalizedBass = (bass - FRONT_GATE) / (1 - FRONT_GATE);
      const frontTarget = normalizedBass * FRONT_GAIN;
      this.frontParIntensity += (frontTarget - this.frontParIntensity) * FRONT_ATTACK;
    } else {
      this.frontParIntensity = Math.max(0, this.frontParIntensity - FRONT_DECAY_LINEAR);
    }
    const front = Math.min(1.0, this.frontParIntensity);

    // ═══════════════════════════════════════════════════════════════════════
    // WAVE 312: Back = MID (como Movers - si funciona allí, funciona aquí)
    // ═══════════════════════════════════════════════════════════════════════
    if (mid >= BACK_GATE) {
      const normalizedMid = (mid - BACK_GATE) / (1 - BACK_GATE);
      const backTarget = normalizedMid * BACK_GAIN;
      this.backParIntensity += (backTarget - this.backParIntensity) * BACK_ATTACK;
    } else {
      this.backParIntensity = Math.max(0, this.backParIntensity - BACK_DECAY_LINEAR);
    }
    const back = Math.min(1.0, this.backParIntensity);

    // ═══════════════════════════════════════════════════════════════════════
    // WAVE 311: MURO DE SONIDO - Movers (Mid puro - guitarra/voz)
    // ═══════════════════════════════════════════════════════════════════════
    if (mid >= MOVER_GATE) {
      const normalizedMid = (mid - MOVER_GATE) / (1 - MOVER_GATE);
      const moverTarget = normalizedMid * MOVER_GAIN;
      this.moverIntensity += (moverTarget - this.moverIntensity) * MOVER_ATTACK;
    } else {
      this.moverIntensity = Math.max(0, this.moverIntensity - MOVER_DECAY_LINEAR);
    }
    const mover = Math.min(1.0, this.moverIntensity);

    const result: RockZonesResult = {
      front,
      back,
      mover,
    };

    // DEBUG (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[ROCK-313] B=${bass.toFixed(2)} M=${mid.toFixed(2)} T=${treble.toFixed(2)} | ` +
        `Front:${front.toFixed(2)} Back:${back.toFixed(2)} Mover:${mover.toFixed(2)}`
      );
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESET STATE
  // ─────────────────────────────────────────────────────────────────────────
  reset(): void {
    this.frontParIntensity = 0;
    this.backParIntensity = 0;
    this.moverIntensity = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════
export default RockStereoPhysics;
