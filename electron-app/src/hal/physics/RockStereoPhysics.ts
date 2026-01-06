/**
 * WAVE 306.2: ATOMIC FRONTS + LIQUID BACKS ⚛️�
 * ============================================================================
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
// FRANKENSTEIN CONSTANTS - WAVE 306: HYBRID DRIVE + DELTA FILTER
// ═══════════════════════════════════════════════════════════════════════════

// --- FRONT PARs: HYBRID DRIVE (Anti-Anemia) ---
// WAVE 310: Decay más rápido
const FRONT_TRANSIENT_WEIGHT = 0.35;  // Peso del golpe
const FRONT_WALL_WEIGHT = 0.65;       // Peso de la presión absoluta
const FRONT_TRANSIENT_MULT = 3.0;     // Multiplicador del golpe
const FRONT_WALL_MULT = 1.6;          // Multiplicador del wall
const FRONT_AVG_SMOOTHING = 0.03;     // Suavizado del promedio (necesario para transient)
const FRONT_FLOOR = 0.25;             // Piso mínimo
const FRONT_CAP = 0.95;               // Cap máximo
const FRONT_ATTACK = 0.40;            // Attack para subidas
const FRONT_DECAY_LINEAR = 0.09;      // 🔧 Decay más rápido (era 0.06)

// --- BACK PARs: HÍBRIDO ROCK (Base + Boost) ---
// WAVE 310: FLOOR cuando hay señal - anti-ahogamiento simple
const BACK_GATE = 0.23;               // Gate
const BACK_BASE_GAIN = 1.45;          // Ganancia base
const BACK_BOOST_THRESHOLD = 0.04;    // Delta para boost
const BACK_BOOST_INSTANT = 0.55;      // Boost instantáneo
const BACK_ATTACK = 0.60;             // 🔧 Subida más rápida
const BACK_DECAY_LINEAR = 0.10;       // 🔧 Decay más rápido
const BACK_FLOOR = 0.25;              // 🆕 Floor cuando hay señal activa
const BACK_CAP = 0.90;                // Cap

// --- MOVERS: LATINO COPY (melody following) ---
// WAVE 310: Decay más rápido
const MOVER_GATE = 0.22;              // Gate bajo para melodías
const MOVER_ATTACK = 0.65;            // Subida rápida
const MOVER_DECAY_LINEAR = 0.12;      // 🔧 Decay más rápido (era 0.08)
const MOVER_GAIN = 1.30;              // Ganancia controlada
const MOVER_HYSTERESIS = 0.25;        // Piso de relleno
const MOVER_TREBLE_REJECTION = 0.30;  // Rechazar voces autotune

// ═══════════════════════════════════════════════════════════════════════════
// FRANKENSTEIN CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class RockStereoPhysics {
  // --- Internal State ---
  private frontParIntensity = 0;
  private frontParActive = false;     // Estado para histéresis
  private backParIntensity = 0;
  private moverIntensity = 0;
  
  // 🆕 WAVE 306: Estado para Hybrid Drive + Delta Filter
  private previousTreble = 0;         // Para calcular trebleDelta (Anti-Sustain)
  private avgBass = 0;                // Promedio de bass para Hybrid Drive

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
    // WAVE 308: HYBRID DRIVE (Front PARs) - DECAY LINEAL
    // ═══════════════════════════════════════════════════════════════════════
    
    // Actualizar promedio de bass (necesario para calcular transient)
    this.avgBass = this.avgBass + (bass - this.avgBass) * FRONT_AVG_SMOOTHING;
    
    // Transient = Golpe (bass - promedio)
    const transient = Math.max(0, (bass - this.avgBass) * FRONT_TRANSIENT_MULT);
    
    // Wall = Presión absoluta CON GANANCIA
    const wall = bass * FRONT_WALL_MULT;
    
    // Hybrid = Mezcla ponderada
    let frontTarget = (transient * FRONT_TRANSIENT_WEIGHT) + (wall * FRONT_WALL_WEIGHT);
    
    // SOPORTE VITAL: Si bass > 0.6, NUNCA debajo del floor
    if (bass > 0.6) {
      frontTarget = Math.max(FRONT_FLOOR, frontTarget);
    }
    frontTarget = Math.min(FRONT_CAP, frontTarget);
    
    // 🔧 DECAY LINEAL - Sin smoothing
    let frontInternal = this.frontParIntensity;
    if (frontTarget > frontInternal) {
      // Subiendo → Attack
      frontInternal += (frontTarget - frontInternal) * FRONT_ATTACK;
    } else {
      // Bajando → DECAY LINEAL
      frontInternal = Math.max(0, frontInternal - FRONT_DECAY_LINEAR);
    }
    this.frontParIntensity = frontInternal;
    const front = frontInternal;

    // ═══════════════════════════════════════════════════════════════════════
    // WAVE 308: BACK PARs HÍBRIDOS - DECAY LINEAL + VITAMINAS
    // ═══════════════════════════════════════════════════════════════════════
    
    // Calcular delta de treble (para detectar ataques)
    const trebleDelta = treble - this.previousTreble;
    this.previousTreble = treble;
    
    // 🔧 WAVE 310: LÓGICA SIMPLE - Floor cuando hay señal
    if (mid >= BACK_GATE) {
      // Base: mid normalizado * ganancia
      const normalizedMid = (mid - BACK_GATE) / (1 - BACK_GATE);
      let backTarget = normalizedMid * BACK_BASE_GAIN;
      
      // BOOST INSTANTÁNEO si hay ataque (snare/crash/hi-hat)
      if (trebleDelta > BACK_BOOST_THRESHOLD) {
        backTarget += BACK_BOOST_INSTANT;
      }
      
      // Asegurar floor mínimo cuando hay señal
      backTarget = Math.max(BACK_FLOOR, backTarget);
      backTarget = Math.min(BACK_CAP, backTarget);
      
      // Attack hacia target
      this.backParIntensity += (backTarget - this.backParIntensity) * BACK_ATTACK;
    } else {
      // NO hay señal → DECAY LINEAL
      this.backParIntensity = Math.max(0, this.backParIntensity - BACK_DECAY_LINEAR);
    }
    
    const back = this.backParIntensity;

    // ═══════════════════════════════════════════════════════════════════════
    // WAVE 308: MOVERS - DECAY LINEAL
    // MID PURO con Treble Rejection para voces autotune
    // ═══════════════════════════════════════════════════════════════════════
    const midPuro = Math.max(0, mid - treble * MOVER_TREBLE_REJECTION);
    
    if (midPuro > MOVER_GATE) {
      const boostedTarget = Math.min(1.0, midPuro * MOVER_GAIN);
      this.moverIntensity += (boostedTarget - this.moverIntensity) * MOVER_ATTACK;
    } else {
      // 🔧 DECAY LINEAL (no más factor multiplicativo)
      this.moverIntensity = Math.max(0, this.moverIntensity - MOVER_DECAY_LINEAR);
      
      // Histéresis: piso de relleno para microhuecos
      if (this.moverIntensity > MOVER_HYSTERESIS && 
          this.moverIntensity < MOVER_HYSTERESIS * 1.5) {
        this.moverIntensity = MOVER_HYSTERESIS;
      } else if (this.moverIntensity < 0.05) {
        this.moverIntensity = 0;
      }
    }

    const result: RockZonesResult = {
      front,
      back,  // 🔧 306.7 FIX: Usar valor filtrado, NO el interno
      mover: this.moverIntensity,
    };

    // DEBUG (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[ROCK-310] B=${bass.toFixed(2)} M=${mid.toFixed(2)} T=${treble.toFixed(2)} Δt=${trebleDelta.toFixed(2)} | ` +
        `Front:${front.toFixed(2)} Back:${back.toFixed(2)} Mover:${this.moverIntensity.toFixed(2)}`
      );
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEGACY STATIC METHOD (Backward Compatibility)
  // ─────────────────────────────────────────────────────────────────────────
  static apply(spectrum: SpectrumData, bpm?: number): RockZonesResult {
    const instance = new RockStereoPhysics();
    return instance.applyZones(spectrum, bpm);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESET STATE
  // ─────────────────────────────────────────────────────────────────────────
  reset(): void {
    this.frontParIntensity = 0;
    this.frontParActive = false;
    this.backParIntensity = 0;
    this.moverIntensity = 0;
    this.previousTreble = 0;
    this.avgBass = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════
export default RockStereoPhysics;
