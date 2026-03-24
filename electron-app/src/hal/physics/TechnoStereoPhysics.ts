/**
 * ---------------------------------------------------------------------------
 * ?? WAVE 770: TECHNO STEREO PHYSICS - THE BLADE
 * ---------------------------------------------------------------------------
 * 
 * FILOSOFÍA: Convertir la física reactiva en un arma blanca.
 * Eliminar suavizado, maximizar agresión. El techno no perdona.
 * 
 * DIFERENCIAS CON OTROS VIBES:
 * - NO HAY INTENSITY_SMOOTHING (fue erradicado)
 * - Decay instantáneo (1-2 frames, no gradual)
 * - "The Slap": BACK_PAR multiplicador 1.8x + Gate alto
 * - Spectral integration (harshness, flatness)
 * 
 * ARQUITECTURA ZONE:
 * - FRONT PARs = BASS (Bombo 4x4, el corazón del techno)
 * - BACK PARs = MID con "The Slap" (snare/clap, bofetada brutal)
 * - MOVERS = TREBLE vitaminado (leads sintetizados, acid lines)
 * 
 * SPECTRAL FEATURES:
 * - context.spectral.harshness ? Acid colors (0.6+ = toxic green)
 * - context.spectral.flatness ? CO2/White Noise detection (0.7+ = strobe)
 * 
 * * CAMBIOS WAVE 906:
 * - ?? BASS ROIDS: Multiplicador x2.5 post-gate en FrontPars.
 * - ?? STEREO SPLIT: Movers L (Mids) vs Movers R (Treble).
 * - ?? BACK PAR SNIPER: Gate alto para aislar Snares de Melod�as.
 * 
 * @module hal/physics/TechnoStereoPhysics
 * @version WAVE 770 - THE BLADE
 */

import { hslToRgb } from '../../engine/color/SeleneColorEngine';
import type { ElementalModifiers } from '../../engine/physics/ElementalModifiers';

// ===========================================================================
// TYPES - LEGACY API (Colores/Strobe)
// ===========================================================================

interface TechnoPalette {
  primary: { r: number; g: number; b: number };
  secondary: { r: number; g: number; b: number };
  accent: { r: number; g: number; b: number };
}

interface TechnoAudioMetrics {
  normalizedTreble: number;
  normalizedBass: number;
}

interface TechnoLegacyResult {
  palette: TechnoPalette;
  isStrobeActive: boolean;
  debugInfo: Record<string, unknown>;
}

// ===========================================================================
// TYPES - NEW API (Zonas/Intensidades)
// ===========================================================================

export interface TechnoPhysicsInput {
  bass: number
  mid: number
  treble: number
  bpm: number
  melodyThreshold: number
  isRealSilence: boolean
  isAGCTrap: boolean
  isKick?: boolean
  isPLLBeat?: boolean // 🎯 WAVE 2305: LA ENTRADA DIVINA
  sectionType?: string
  harshness?: number
  flatness?: number
  crestFactor?: number // 🔍 WAVE 2340: Pico dinámico (Crest)/RMS para detectar boom vs compresión
  centroid?: number // 🔍 WAVE 2340: Centro de masa espectral (Hz), para frenar saturación aguda
  lowMid?: number // 🔍 WAVE 2340: Energía de medios-graves (808 / bajos sostenidos)
  sub?: number // 💥 WAVE 2363: SubBass RAW (20-60Hz) - rumble de LFOs y bajos continuos
  spectralData?: {
    crestFactor?: number
    flatness?: number
    centroid?: number
  } // 🔍 WAVE 2343: Aggregate spectral metrics object
}

export interface TechnoPhysicsResult {
  strobeActive: boolean
  strobeIntensity: number
  frontParIntensity: number
  backParIntensity: number
  // ?? STEREO SPLIT: Intensidades separadas
  moverIntensityL: number  // Mids (Voces)
  moverIntensityR: number  // Treble (Melodías)
  moverIntensity: number   // Legacy fallback (Max L/R)
  moverActive: boolean
  physicsApplied: 'techno'
  acidMode: boolean
  noiseMode: boolean
}

// ===========================================================================
// ?? WAVE 906: TECHNO STEREO PHYSICS ENGINE
// ===========================================================================

export class TechnoStereoPhysics {
  // LEGACY CONSTANTS
  private static readonly STROBE_BASE_THRESHOLD = 0.6;
  private static readonly STROBE_HUE = 300;
  private static readonly STROBE_SATURATION = 100;
  private static readonly STROBE_LIGHTNESS = 85;

  // =========================================================================
  // 🛡️ WAVE 913: PARANOIA GATE - AGC Rebound Protection
  // =========================================================================

  // 🔊 FRONT (BASS) - EL CERROJO ORGÁNICO
  private readonly FRONT_PAR_GATE_ON = 0.50   // 💥 Bajamos un poco para cazar más kicks
  private readonly FRONT_PAR_GATE_OFF = 0.35  // 🔪 Suelo razonable para el decay
  private readonly BASS_VITAMIN_BOOST = 3.0   // 🚀 Empuje para el cuerpo de la luz
  private readonly FRONT_MAX_INTENSITY = 0.80 // 🚨 EL TECHO DEL 80%

  // 🛡️ PARANOIA GATE (Para el rebote del AGC)
  // Durante la recuperación post-silencio, exigimos un 80% de señal para encender
  // Esto filtra el ruido de fondo inflado, pero deja pasar el Drop (100%)
  private readonly RECOVERY_GATE_ON = 0.80    // 🚨 Gate paranoico post-silencio
  private readonly RECOVERY_GATE_OFF = 0.60   // 🚨 Gate off proporcionalmente alto
  private readonly RECOVERY_DURATION = 2000   // 2 segundos de desconfianza

  // 🥁 BACK (SNARE SNIPER) - Resurrección (Importado de Latino)
  private readonly BACK_PAR_GATE = 0.50       // 🔪 Mantenemos el muro alto para que no entre basura
  private readonly BACK_PAR_SLAP_MULT = 5.0   // 🚀 BOOM. De 3.0 a 5.0 para bofetadas nucleares

  // 👯 MOVERS (STEREO SPLIT)
  
  // LEFT (Mid/Voces) - "The Body"
  private readonly MOVER_L_GATE = 0.20
  private readonly MOVER_L_BOOST = 4.0

  // RIGHT (Treble/Hats) - "SCHWARZENEGGER MODE" 🤖
  private readonly MOVER_R_GATE = 0.14        // 📉 Hypersensitive (confirmado)
  private readonly MOVER_R_BOOST = 8.0       // 💪 TERMINATOR BOOST (confirmado)

  // STROBE & MODES
  private readonly STROBE_THRESHOLD = 0.80
  private readonly STROBE_DURATION = 30
  private readonly HARSHNESS_ACID_THRESHOLD = 0.60
  private readonly FLATNESS_NOISE_THRESHOLD = 0.70

  // =========================================================================
  // INTERNAL STATE
  // =========================================================================

  private strobeActive = false
  private strobeStartTime = 0
  private lastLogTime = 0;
  private avgMidProfiler = 0.0;
  private lastFrontParFire = 0 // ⏱️ Memoria del cerrojo dinámico
  private kickEnvelope = 0
  private lastKickTrigger = false // 🔫 WAVE 2306: Memory del One-Shot Edge Detector

  // 🕵️‍♂️ WAVE 913: PARANOIA STATE (AGC Rebound Protection)
  private lastSilenceTime = 0
  private inSilence = false
  
  // 💥 WAVE 2341: FRONT PAR STATE (Autonomous decay & lockout)
  private bassThr = 0.0  // Auto-calibrating threshold
  private avgBass = 0.0  // 🌊 WAVE 2343: Moving average floor de graves (para detectar hits)
  private frontIntensity = 0.0  // Persistente intensity para decay orgánico
  private frontLockout = 0  // Frame counter para evitar re-triggers
  private bassFloor = 0.0  // 🌊 WAVE 2354: Suelo dinámico para detección adaptativa
  private avgPunch = 0.0  // 💥 WAVE 2371: Auto-gate dinámico analógico
  private avgPunchPeak = 0.0  // 🏔️ WAVE 2377: Memoria del pico de avgPunch (caída ultra-lenta)
  private wasBreakdown = false  // 🔄 WAVE 2378: Estado previo de sección (para detectar transición breakdown→drop)
  private breakdownExitTime = 0  // ⏱️ WAVE 2378: Timestamp de salida del breakdown
  private lastPunch = 0  // 🔬 WAVE 2380: Velocity gate — detecta pads por velocidad de subida lenta
  private lastKickFireTime = 0  // 🌊 WAVE 2385: Tidal Gate — timestamp del último kick real
  private wasAttacking = false  // 🌊 WAVE 2386: Inercia de ataque — 1 frame de gracia post-pico

  constructor() {
    // WAVE 2098: Boot silence
  }

  // ... (LEGACY apply STATIC METHOD MANTENIDO IGUAL) ...
  public static apply(
    palette: TechnoPalette,
    audio: TechnoAudioMetrics,
    mods?: ElementalModifiers
  ): TechnoLegacyResult {
      // (Mismo codigo legacy para compatibilidad de colores)
      const thresholdMod = mods?.thresholdMultiplier ?? 1.0;
      const brightnessMod = mods?.brightnessMultiplier ?? 1.0;
      const normalizedTreble = audio.normalizedTreble ?? 0;
      const normalizedBass = audio.normalizedBass ?? 0;
      const dropRatio = normalizedBass / Math.max(0.01, normalizedTreble);
      const effectiveThreshold = this.STROBE_BASE_THRESHOLD * thresholdMod;
      const isStrobeActive = normalizedTreble > effectiveThreshold && dropRatio < 2.0;
      let outputPalette = { ...palette };
      if (isStrobeActive) {
        const modulatedLightness = Math.min(100, this.STROBE_LIGHTNESS * brightnessMod);
        const strobeRgb = hslToRgb({ h: this.STROBE_HUE, s: this.STROBE_SATURATION, l: modulatedLightness });
        outputPalette.accent = strobeRgb;
      }
      return { palette: outputPalette, isStrobeActive, debugInfo: { normalizedTreble, normalizedBass, dropRatio, effectiveThreshold, strobeTriggered: isStrobeActive } };
  }

  // =========================================================================
  // ?? WAVE 906: NEW API
  // =========================================================================

  public applyZones(input: TechnoPhysicsInput): TechnoPhysicsResult {
    // 🔥 WAVE 1012: Defaults inteligentes para métricas espectrales
    // Sin estos, acidMode/noiseMode/atmosphericFloor quedan MUERTOS
    const { 
      bass, 
      mid, 
      treble, 
      isRealSilence, 
      isAGCTrap, 
      isKick = false,
      harshness = 0.45,  // 🎛️ Default agresivo (Techno = duro)
      flatness = 0.35    // 🎛️ Default para pads/atmos
    } = input
    const now = Date.now()

    // =======================================================================
    // 🧬 1. MORFOLOGÍA LÍQUIDA: VISCOSIDAD ASIMÉTRICA (WAVE 2340)
    // =======================================================================
    
    // Inercia orgánica: Emoción rápida (Ataque 0.85), Caída densa (Decay 0.98)
    if (mid > this.avgMidProfiler) {
        this.avgMidProfiler = (this.avgMidProfiler * 0.85) + (mid * 0.15); 
    } else {
        this.avgMidProfiler = (this.avgMidProfiler * 0.98) + (mid * 0.02); 
    }
    
    // UMBRAL SAGRADO: Suelo en 0.30, techo en 0.70.
    const morphFactor = Math.min(1.0, Math.max(0.0, (this.avgMidProfiler - 0.30) / 0.40));
    const dynamicSlapMult = this.BACK_PAR_SLAP_MULT * (1.0 - (morphFactor * 0.5));

    // GATES LÍQUIDOS: Bajamos los umbrales base para cazar el Melodic Techno
    // Front: de 0.55 (Hard) a 0.35 (Melodic)
    const currentFrontGate = 0.55 - (0.20 * morphFactor); 
    // Back: de 0.52 (Hard) a 0.28 (Melodic) -- Bajamos para rescatar claps sutiles
    const currentBackGate = 0.52 - (0.17 * morphFactor);

    // 🕵️‍♂️ MODOS Y SILENCIO
    const acidMode = harshness > this.HARSHNESS_ACID_THRESHOLD;
    const noiseMode = flatness > this.FLATNESS_NOISE_THRESHOLD;

    if (isRealSilence || isAGCTrap) {
      this.inSilence = true;
      this.lastSilenceTime = now;
      return this.handleSilence(acidMode, noiseMode);
    } else if (this.inSilence) {
      this.inSilence = false;
    }

    // 🛡️ AGC REBOUND PROTECTION (WAVE 2376)
    // Los primeros 2 segundos tras un silencio, el AGC está recalibrando y
    // la señal llega inflada. Aplicamos un atenuador que va de 0.0 a 1.0
    // linealmente durante RECOVERY_DURATION para que la luz suba suave.
    const timeSinceSilence = now - this.lastSilenceTime;
    const isRecovering = this.lastSilenceTime > 0 && timeSinceSilence < this.RECOVERY_DURATION;
    const recoveryFactor = isRecovering 
      ? Math.min(1.0, timeSinceSilence / this.RECOVERY_DURATION) 
      : 1.0;

    // =======================================================================
    // 🔍 MORPHOLOGÍA LÍQUIDA EXPANDIDA (Zona 0.30 - 0.70)
    // =======================================================================
    // (avgMidProfiler ya actualizado arriba)
    // 🛡️ LIMITADOR DE INTENSIDAD GLOBAL (Opción 1)
    // Si la morfología sube (Buildup/Melodic), bajamos el techo de luz
    // En Anyma/Psytrance, el multiplicador bajará de 5.0 a ~2.5 automáticamente.

    // =======================================================================
    // 🥁 2. BACK PAR: LA PUERTA AL 0.44 Y CERO COMPETENCIA
    // =======================================================================
    const transientImpact = Math.min(1.0, (treble * 1.3) + ((harshness ?? 0) * 0.8));
    
    // Filtro de voces original (Se mantiene idéntico, es seguro)
    const cleanMid = Math.max(0, mid - (1.0 - transientImpact) * mid * 0.7);
    
    const pureHarshness = (harshness ?? 0);
    const snareVitamin = pureHarshness * treble * (4.5 + 2.5 * morphFactor);

    const snarePower = Math.min(1.0, 
      (cleanMid * 0.05) + 
      (transientImpact * (1.1 + 1.2 * morphFactor)) + 
      snareVitamin 
    );

    let backParIntensity = 0;
    // 🔒 LA PUERTA BAJA A 0.44 (A petición del Arquitecto para no perder snares)
    // En modo Anyma caerá a 0.22, súper sensible pero limpio gracias al exponente 3.5
    const dynamicBackGate = 0.44 - (0.22 * morphFactor); 

    if (snarePower > dynamicBackGate) {
        const gated = (snarePower - dynamicBackGate) / (1.0 - dynamicBackGate);
        backParIntensity = Math.pow(gated, 3.5) * dynamicSlapMult;
    }

    // =======================================================================
    // 💥 3. FRONT PAR: SOFT KNEE + BREAKDOWN SHIELD (WAVE 2377)
    // =======================================================================
    
    const punch = bass; 
    const rumble = input.sub ?? 0; 
    const sectionType = input.sectionType ?? 'drop';
    const isBreakdown = sectionType === 'breakdown' || sectionType === 'buildup';
    
    // 🔬 WAVE 2380/2381: Velocity Gate — cinemática de ataque puro.
    //
    // WAVE 2380: Los pads suben lento (velocity baja), los bombos explotan (velocity alta).
    //   isPadSwell bloquea pads en secciones tranquilas.
    //
    // WAVE 2381: Attack-Only Trigger — la reverberación acústica del bombo cae lentamente
    //   por encima del gate, haciendo que el motor genere nanorrestos (KickP:0.7, 0.3, 0.12...)
    //   mientras la onda BAJA. Solución puramente física: solo disparamos luz cuando la onda
    //   está CRECIENDO (atacando). Si baja, el decay orgánico se encarga de la cola.
    //   Margen de -0.005 para absorber micro-fluctuaciones de cuantización.
    // 🌊 WAVE 2386: The Undertow — inercia de ataque.
    //   Un kick real dura 2-3 frames. Con isAttacking estricto, solo el frame de subida
    //   disparaba. Boris Brejcha: P:0.95 (frame 1, dispara) → P:0.90 (frame 2, NO dispara
    //   porque velocity < 0). Si el frame ANTERIOR fue ataque genuino (velocity > 0.01),
    //   permitimos 1 frame de gracia con caída moderada (velocity > -0.03).
    const velocity = punch - (this.lastPunch ?? 0);
    this.lastPunch = punch;
    const isRisingAttack = velocity >= -0.005;
    const isGraceFrame = this.wasAttacking && velocity >= -0.03;
    const isAttacking = isRisingAttack || isGraceFrame;
    this.wasAttacking = isRisingAttack && velocity > 0.01;
    const isQuietSection = isBreakdown || sectionType === 'intro';
    const isPadSwell = isQuietSection && velocity < 0.02;
    
    // 1. EL SUELO DE HORMIGÓN (Intocable - Creador del Groove)
    // 🌊 WAVE 2386: The Undertow — decay asimétrico AGRESIVO.
    // Boris Brejcha tiene subgrave rodante que NUNCA baja de P:0.75.
    // Con decay 0.95/0.05 anterior, avgPunch subía a ~0.82 y el gate quedaba en 0.84,
    // bloqueando el 80% de los kicks (solo P:0.96+ pasaba).
    // Decay 0.88/0.12 permite que avgPunch baje en los micro-valles entre kicks.
    // Kickloop no se rompe porque sus valles son profundos (P:0.45-0.60).
    if (punch > (this.avgPunch ?? 0)) {
        this.avgPunch = ((this.avgPunch ?? 0) * 0.98) + (punch * 0.02);
    } else {
        this.avgPunch = ((this.avgPunch ?? 0) * 0.88) + (punch * 0.12);
    }

    // 🏔️ MEMORIA DE PICO (avgPunchPeak)
    // 🌊 WAVE 2385: Tidal Gate — decay condicional. Cuando no hay kicks durante
    // mucho tiempo, el pico se libera más rápido para que el gate baje a encontrar
    // los kicks de la siguiente pista en la mezcla.
    //   Normal (kicks activos): 0.993 → ~4.7s para caer 50%
    //   Seco (>2s sin kick):    0.985 → ~1.5s para caer 50%
    // Hadtechnominimal: gate se quedaba en 0.44 durante 200+ frames porque
    // avgPunchPeak de la pista anterior no caía, mientras kickloop no se ve
    // afectado porque sus kicks constantes mantienen lastKickFireTime fresco.
    const timeSinceLastKick = this.lastKickFireTime > 0 ? now - this.lastKickFireTime : 0;
    const isDrySpell = timeSinceLastKick > 2000;
    const peakDecay = isDrySpell ? 0.985 : 0.993;
    if (this.avgPunch > this.avgPunchPeak) {
        this.avgPunchPeak = this.avgPunch;
    } else {
        this.avgPunchPeak = (this.avgPunchPeak * peakDecay) + (this.avgPunch * (1.0 - peakDecay));
    }

    // El gate efectivo nunca cae por debajo del 55% del pico reciente.
    // 🌊 WAVE 2386: The Undertow — reducido de 70% a 55%.
    // Con peak 0.95: antes floor=0.665, ahora floor=0.523.
    // Esto da ~0.14 de headroom extra para que kicks de P:0.83-0.88 pasen.
    // 🏗️ WAVE 2378: GATE FLOOR ABSOLUTO — El gate NUNCA baja de 0.42.
    // Sub-bass pads de psytrance (P:0.44-0.47) ya no pasan el gate.
    // 🌊 WAVE 2385: Floor adaptativo — degrada el floor de 0.42 → 0.30 cuando
    // no hay kicks durante 3+ segundos. Esto permite que mezclas de minimal
    // techno con kicks sutiles (P:0.50-0.65) pasen el gate.
    //   Sin dry spell: floor = 0.42 (protección psytrance intacta)
    //   3s sin kick:   floor empieza a bajar
    //   6s sin kick:   floor = 0.30 (captura kicks sutiles de mezcla)
    const drySpellFloorDecay = timeSinceLastKick > 3000
      ? Math.min(1.0, (timeSinceLastKick - 3000) / 3000)
      : 0;
    const adaptiveFloor = 0.42 - (0.12 * drySpellFloorDecay);
    const avgPunchEffective = Math.max(this.avgPunch, this.avgPunchPeak * 0.55, adaptiveFloor);

    const isVoiceLeak = mid > 0.50 && mid > (punch * 0.80);

    // 2. LA PUERTA CON MEMORIA
    // 🔬 WAVE 2383: Smart Crusher — revert gateMargin a 0.02 fijo.
    // WAVE 2382 subía el margen a 0.045 en Minimal para bloquear sintes,
    // pero Boris Brejcha (subgrave rodante P:0.73-0.77) inflaba avgPunch
    // y el gate quedaba en 0.77, BLOQUEANDO bombos reales.
    // Nuevo enfoque: gate bajo (deja pasar), exponente alto (aplasta lo débil).
    const dynamicGate = avgPunchEffective + 0.02;
    
    let kickPower = 0;
    let ghostPower = 0;

    // 3. EL COMPRESOR DINÁMICO (Dynamic Divisor)
    // En breakdowns/buildups, exigimos el doble de salto para activar front PAR.
    // Los sintes no deberían encender los focos del bombo.
    const breakdownPenalty = isBreakdown ? 0.06 : 0;
    
    if (punch > dynamicGate && !isVoiceLeak && !isPadSwell && isAttacking && punch > 0.15) {
        const requiredJump = 0.14 - (0.07 * morphFactor) + breakdownPenalty; 
        
        let rawPower = (punch - dynamicGate) / requiredJump;
        rawPower = Math.min(1.0, Math.max(0, rawPower)); 
        
        // � WAVE 2387: Return to Origins — exponente reducido a 1.5-1.8.
        // WAVE 2381 (golden reference) usaba 1.5 FIJO. Funcionaba perfecto.
        // WAVEs 2383-2384 subieron a 2.0-2.5 para "aplastar synths" pero
        // crearon DOBLE CASTIGO: gate inflado + crush agresivo. Un bombo con
        // rawPower 0.3 pasaba de pow(0.3,1.5)=0.164 a pow(0.3,2.5)=0.049.
        // Invisible. Con 1.5-1.8 recuperamos el rango de WAVE 2381:
        //   rawPower 0.3 → pow(0.3, 1.5) = 0.164 / pow(0.3, 1.8) = 0.099 (visible ✓)
        //   rawPower 0.5 → pow(0.5, 1.5) = 0.354 / pow(0.5, 1.8) = 0.287 (sólido ✓)
        //   rawPower 0.7 → pow(0.7, 1.5) = 0.586 / pow(0.7, 1.8) = 0.530 (fuerte ✓)
        //   Sinte staccato rawPower 0.15 → pow(0.15, 1.8) = 0.035 (aplastado ✓)
        const crushExponent = 1.5 + (0.3 * (1.0 - morphFactor));
        kickPower = Math.pow(rawPower, crushExponent);
    } else if (punch > avgPunchEffective && punch > 0.15 && !isVoiceLeak && !isBreakdown) {
        // 👻 RODILLA SUAVE (Soft Knee) — Solo activa fuera de breakdowns.
        // 🔬 WAVE 2383: ghostPower restaurado SIN morphFactor.
        // El glow tenue (max 4%) conecta las melodías y evita negro absoluto.
        // WAVE 2382 lo multiplicaba por morphFactor, cortándolo en Minimal.
        // Esto provocaba parpadeo epiléptico al pasar por la guillotina 0.08.
        const proximity = (punch - avgPunchEffective) / 0.02;
        ghostPower = Math.min(0.04, proximity * 0.04);
    }

    // 4. MORFOLOGÍA LÍQUIDA: DECAY
    const frontDecay = 0.60 + (0.20 * morphFactor);
    this.frontIntensity = (this.frontIntensity ?? 0) * frontDecay; 

    // 5. RENDERIZADO RÍTMICO
    if (kickPower > 0.02) {
        this.lastKickFireTime = now; // 🌊 WAVE 2385: Resetear timer de Tidal Gate
        const hit = Math.min(1.0, kickPower * (1.2 + 0.8 * morphFactor));
        this.frontIntensity = Math.max(this.frontIntensity, hit);
    } else if (ghostPower > 0) {
        // 👻 FUGA FANTASMA: brillo mínimo que mantiene la melodía viva
        this.frontIntensity = Math.max(this.frontIntensity, ghostPower);
    }

    // 6. MATERIA OSCURA (Muro Subgrave)
    const auraCap = 0.25 * Math.pow(morphFactor, 2); 
    const progressivePulse = rumble * auraCap;
    
    if (kickPower < 0.2) {
        this.frontIntensity = Math.max(this.frontIntensity, progressivePulse);
    }

    // 🔬 WAVE 2383: Reemplazar guillotina binaria por smooth fade.
    // La guillotina (> 0.08 ? x : 0) creaba saltos bruscos de 0.07→0.00
    // que destruían el glow del ghostPower y el decay natural.
    // Smooth fade: por debajo de 0.08 se atenúa cuadráticamente → fundido suave.
    const fadeZone = 0.08;
    const fadeFactor = this.frontIntensity >= fadeZone ? 1.0 : Math.pow(this.frontIntensity / fadeZone, 2);
    let frontParIntensity = this.frontIntensity * fadeFactor;

    // TELEMETRÍA (mantener formato original)
    if (now - this.lastLogTime > 33) {
       console.log(
         `[F] P:${punch.toFixed(2)} R:${rumble.toFixed(2)} Gate:${dynamicGate.toFixed(2)} KickP:${kickPower.toFixed(3)} OUT:${frontParIntensity.toFixed(2)} | ` +
         `[B] M:${mid.toFixed(2)} T:${treble.toFixed(2)} SnP:${snarePower.toFixed(2)} OUT:${backParIntensity.toFixed(2)} | ` +
         `[M] Morph:${morphFactor.toFixed(2)}`
       );
       this.lastLogTime = now;
    }

    const rawLeft = Math.max(0, mid - (treble * 0.3));
    let moverL = this.calculateMoverChannel(rawLeft, this.MOVER_L_GATE, this.MOVER_L_BOOST);

    const rawRight = Math.max(0, treble - (mid * 0.2));
    let moverR = this.calculateMoverChannel(rawRight, this.MOVER_R_GATE, this.MOVER_R_BOOST);

    // =======================================================================
    // 3. THE SIDECHAIN GUILLOTINE & APOCALYPSE MODE
    // =======================================================================
    if (frontParIntensity > 0.1) {
      // 🔪 LEY ABSOLUTA: Solo aplasta los MOVERS (Sables). 
      // ¡EL BACK PAR ES LIBRE! ducking exterminado para el snare.
      const ducking = 1.0 - (frontParIntensity * 0.90);
      moverL *= ducking;
      moverR *= ducking;
    } else {
      // 🚨 APOCALIPSIS: Solo se permite cuando el bombo está en silencio (Buildups)
      const isApocalypse = harshness > 0.55 && (input.spectralData?.flatness ?? 0) > 0.55;
      if (isApocalypse) {
        const chaosEnergy = Math.max(mid, treble);
        backParIntensity = Math.max(backParIntensity, chaosEnergy);
        moverL = Math.max(moverL, chaosEnergy);
        moverR = Math.max(moverR, chaosEnergy);
      }
    }

    // Strobe (Treble peaks + Noise)
    const strobeResult = this.calculateStrobe(treble, noiseMode)

    // 🛡️ AGC REBOUND ATTENUATION (WAVE 2376)
    // Si estamos en recuperación post-silencio, atenuar todas las zonas progresivamente.
    // recoveryFactor va de 0.0 (silencio acaba de terminar) a 1.0 (recuperación completa).
    if (isRecovering) {
      frontParIntensity *= recoveryFactor;
      backParIntensity *= recoveryFactor;
      moverL *= recoveryFactor;
      moverR *= recoveryFactor;
    }

    return {
      strobeActive: strobeResult.active,
      strobeIntensity: strobeResult.intensity,
      frontParIntensity,
      backParIntensity,
      moverIntensityL: moverL,
      moverIntensityR: moverR,
      moverIntensity: Math.max(moverL, moverR),
      moverActive: (moverL > 0.1 || moverR > 0.1),
      physicsApplied: 'techno',
      acidMode,
      noiseMode
    }
  }

  public reset(): void {
    this.strobeActive = false
    this.strobeStartTime = 0
    this.kickEnvelope = 0
  }

  // =========================================================================
  // PRIVATE CALCULATIONS
  // =========================================================================

  private handleSilence(acidMode: boolean, noiseMode: boolean): TechnoPhysicsResult {
    // A clean silence resets the sidechain envelope to avoid ghosting.
    this.kickEnvelope = 0

    return {
      strobeActive: false,
      strobeIntensity: 0,
      frontParIntensity: 0, // ?? Silencio absoluto instantáneo
      backParIntensity: 0,
      moverIntensityL: 0,
      moverIntensityR: 0,
      moverIntensity: 0,
      moverActive: false,
      physicsApplied: 'techno',
      acidMode,
      noiseMode
    }
  }

  
  /**
   * 🥁 BACK PAR - THE CLEANER (NOISE GATE MODE)
   * 🧹 WAVE 911: Media geométrica + Curva supresora de ruido
   * 
   * Matemática:
   * - Signal ya viene como sqrt(mid * treble) desde applyZones
   * - Solo valores altos (Snare completo) pasan el gate 0.25
  /**
   * 👯 MOVER CHANNEL - GENERIC GATE + BOOST
   * 🧹 WAVE 911: THE CLEANER
   * 
   * @param signal - Señal ya procesada con sustracción:
   *                 LEFT: Mid - 30% Treble (The Body)
   *                 RIGHT: Treble - 20% Mid (SCHWARZENEGGER MODE 🤖)
   * @param gate - Umbral de activación (RIGHT: 0.14 hypersensitive)
   * @param boost - Multiplicador de ganancia (RIGHT: x10.0 TERMINATOR)
   * 
   * NOTA: En "Wall of Sound", estos valores se reducen por ducking (sidechain)
   */
  private calculateMoverChannel(signal: number, gate: number, boost: number): number {
    if (signal < gate) return 0

    const gated = (signal - gate) / (1 - gate)
    
    // Boost masivo y curva rápida
    const intensity = Math.pow(gated, 1.2) * boost

    return Math.min(1.0, Math.max(0, intensity))
  }

  private calculateStrobe(treble: number, noiseMode: boolean): { active: boolean; intensity: number } {
    const now = Date.now()
    if (this.strobeActive && now - this.strobeStartTime > this.STROBE_DURATION) {
      this.strobeActive = false
    }
    
    const effectiveThreshold = noiseMode ? this.STROBE_THRESHOLD * 0.80 : this.STROBE_THRESHOLD
    
    if (treble > effectiveThreshold && !this.strobeActive) {
      this.strobeActive = true
      this.strobeStartTime = now
    }
    return { active: this.strobeActive, intensity: this.strobeActive ? 1.0 : 0 }
  }
}

export const technoStereoPhysics = new TechnoStereoPhysics()

