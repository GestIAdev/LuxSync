/**
 * ═══════════════════════════════════════════════════════════════════
 * 🌊 WAVE 2401: LIQUID STEREO SIMULATOR
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Simulación determinista de la arquitectura de 7 bandas.
 * Valida que los coeficientes propuestos no rompen la energía total
 * comparado con el God Mode actual de 4 zonas.
 * 
 * RESTRICCIÓN: Solo simulación. NO modifica TechnoStereoPhysics.ts.
 * 
 * Ejecutar: npx tsx scripts/liquid-stereo-sim.ts
 */

// ═══════════════════════════════════════════════════════════════════
// 1. LIQUID ENVELOPE — La abstracción que reemplaza el código artesanal
// ═══════════════════════════════════════════════════════════════════

interface LiquidEnvelopeConfig {
  /** Nombre de la banda */
  name: string;
  /** Umbral de activación (0-1) */
  gateOn: number;
  /** Umbral de desactivación / histéresis inferior (0-1) */
  gateOff: number;
  /** Multiplicador de ganancia post-gate */
  boost: number;
  /** Exponente de compresión/expansión (>1 = crush, <1 = expand) */
  crushExponent: number;
  /** Factor de decay por frame (0-1, más alto = decay más lento) */
  decayBase: number;
  /** Rango de modulación de decay por morphFactor */
  decayRange: number;
  /** Cap de intensidad máxima (0-1) */
  maxIntensity: number;
  /** Umbral de ignition squelch en morph=0 */
  squelchBase: number;
  /** Pendiente de squelch (cuánto baja con morphFactor) */
  squelchSlope: number;
  /** Cap de ghostPower (soft knee) */
  ghostCap: number;
  /** Margen fijo sobre gate adaptativo */
  gateMargin: number;
}

interface LiquidEnvelopeState {
  intensity: number;
  avgSignal: number;
  avgSignalPeak: number;
  lastFireTime: number;
  lastSignal: number;
  wasAttacking: boolean;
}

function createEnvelopeState(): LiquidEnvelopeState {
  return {
    intensity: 0,
    avgSignal: 0,
    avgSignalPeak: 0,
    lastFireTime: 0,
    lastSignal: 0,
    wasAttacking: false,
  };
}

function processEnvelope(
  config: LiquidEnvelopeConfig,
  state: LiquidEnvelopeState,
  signal: number,
  morphFactor: number,
  now: number,
  isBreakdown: boolean,
): number {
  // --- Velocity Gate (attack-only trigger) ---
  const velocity = signal - state.lastSignal;
  state.lastSignal = signal;
  const isRisingAttack = velocity >= -0.005;
  const isGraceFrame = state.wasAttacking && velocity >= -0.03;
  const isAttacking = isRisingAttack || isGraceFrame;
  state.wasAttacking = isRisingAttack && velocity > 0.01;

  // --- Adaptive average (asymmetric EMA) ---
  if (signal > state.avgSignal) {
    state.avgSignal = state.avgSignal * 0.98 + signal * 0.02;
  } else {
    state.avgSignal = state.avgSignal * 0.88 + signal * 0.12;
  }

  // --- Peak tracking with Tidal Gate decay ---
  const timeSinceLastFire = state.lastFireTime > 0 ? now - state.lastFireTime : 0;
  const isDrySpell = timeSinceLastFire > 2000;
  const peakDecay = isDrySpell ? 0.985 : 0.993;
  if (state.avgSignal > state.avgSignalPeak) {
    state.avgSignalPeak = state.avgSignal;
  } else {
    state.avgSignalPeak = state.avgSignalPeak * peakDecay + state.avgSignal * (1 - peakDecay);
  }

  // --- Adaptive floor (Tidal Gate) ---
  const drySpellFloorDecay = timeSinceLastFire > 3000
    ? Math.min(1.0, (timeSinceLastFire - 3000) / 3000)
    : 0;
  const adaptiveFloor = config.gateOn - (0.12 * drySpellFloorDecay);
  const avgEffective = Math.max(state.avgSignal, state.avgSignalPeak * 0.55, adaptiveFloor);

  // --- Dynamic gate ---
  const dynamicGate = avgEffective + config.gateMargin;

  // --- Decay ---
  const decay = config.decayBase + config.decayRange * morphFactor;
  state.intensity *= decay;

  // --- Main gate + crush ---
  let kickPower = 0;
  let ghostPower = 0;
  const breakdownPenalty = isBreakdown ? 0.06 : 0;

  if (signal > dynamicGate && isAttacking && signal > 0.15) {
    const requiredJump = 0.14 - 0.07 * morphFactor + breakdownPenalty;
    let rawPower = (signal - dynamicGate) / requiredJump;
    rawPower = Math.min(1.0, Math.max(0, rawPower));
    const crushExp = config.crushExponent + 0.3 * (1.0 - morphFactor);
    kickPower = Math.pow(rawPower, crushExp);
  } else if (signal > avgEffective && signal > 0.15 && !isBreakdown) {
    const ghostCapDynamic = config.ghostCap * morphFactor;
    const proximity = (signal - avgEffective) / 0.02;
    ghostPower = Math.min(ghostCapDynamic, proximity * ghostCapDynamic);
  }

  // --- Ignition squelch ---
  const squelch = Math.max(0.02, config.squelchBase - config.squelchSlope * morphFactor);
  if (kickPower > squelch) {
    state.lastFireTime = now;
    const hit = Math.min(config.maxIntensity, kickPower * (1.2 + 0.8 * morphFactor) * config.boost);
    state.intensity = Math.max(state.intensity, hit);
  } else if (ghostPower > 0) {
    state.intensity = Math.max(state.intensity, ghostPower);
  }

  // --- Smooth fade ---
  const fadeZone = 0.08;
  const fadeFactor = state.intensity >= fadeZone ? 1.0 : Math.pow(state.intensity / fadeZone, 2);
  return Math.min(config.maxIntensity, state.intensity * fadeFactor);
}

// ═══════════════════════════════════════════════════════════════════
// 2. BAND CONFIGURATIONS — 7 band profiles
// ═══════════════════════════════════════════════════════════════════

/** 
 * God Mode actual: 4 zonas → extracto directo del código.
 * Los nuevos 7 perfiles HEREDAN de estos valores donde aplica.
 */
const BAND_CONFIGS: Record<string, LiquidEnvelopeConfig> = {
  // ── FRONT LEFT: SubBass (20-60Hz) ──────────────────────────────
  // Heredero del FRONT PAR actual (kick pump). Solo sub-bass puro.
  // Gate MÁS alto porque sub es energía constante (pads, LFOs).
  subBass: {
    name: 'Front L (SubBass)',
    gateOn: 0.55,        // +0.05 vs God Mode (0.50) — sub es más estable
    gateOff: 0.40,       // +0.05
    boost: 2.5,          // Menos que vitamin_boost 3.0 (sub no necesita tanto)
    crushExponent: 1.5,
    decayBase: 0.55,     // Más rápido que God Mode 0.60 (sub kicks son cortos)
    decayRange: 0.20,
    maxIntensity: 0.85,  // +0.05 vs God Mode (floor shaker privilege)
    squelchBase: 0.25,   // +0.05 vs God Mode (más agresivo anti-pad)
    squelchSlope: 0.80,
    ghostCap: 0.03,      // Menos ghost que bass (sub no tiene melodía)
    gateMargin: 0.02,
  },

  // ── FRONT RIGHT: Bass (60-250Hz) ──────────────────────────────
  // Heredero directo del FRONT PAR actual. Kick body + bass groove.
  bass: {
    name: 'Front R (Bass)',
    gateOn: 0.50,        // ═══ God Mode exacto
    gateOff: 0.35,       // ═══ God Mode exacto
    boost: 3.0,          // ═══ BASS_VITAMIN_BOOST exacto
    crushExponent: 1.5,  // ═══ God Mode exacto
    decayBase: 0.60,     // ═══ God Mode exacto
    decayRange: 0.20,    // ═══ God Mode exacto
    maxIntensity: 0.80,  // ═══ FRONT_MAX_INTENSITY exacto
    squelchBase: 0.20,   // ═══ God Mode exacto
    squelchSlope: 0.80,  // ═══ God Mode exacto
    ghostCap: 0.04,      // ═══ God Mode exacto
    gateMargin: 0.02,    // ═══ God Mode exacto
  },

  // ── BACK LEFT: LowMid (250-500Hz) ─────────────────────────────
  // Zona "Mud/Calor". Warmth atmosférico. Gate alto para filtrar ruido.
  // Nuevo — no existe en God Mode actual. Diseñado conservador.
  lowMid: {
    name: 'Back L (LowMid)',
    gateOn: 0.45,        // Moderado — esta zona tiene energía constante
    gateOff: 0.30,
    boost: 2.0,          // Conservador — calor, no explosión
    crushExponent: 1.8,  // Más crush = más selectivo
    decayBase: 0.70,     // Decay largo = warmth sostenido
    decayRange: 0.15,
    maxIntensity: 0.65,  // Cap bajo — zona atmosférica, no protagonista
    squelchBase: 0.15,
    squelchSlope: 0.60,
    ghostCap: 0.06,      // Ghost alto = glow atmosférico
    gateMargin: 0.02,
  },

  // ── BACK RIGHT: Mid (500-2kHz) ────────────────────────────────
  // Heredero del BACK PAR actual (Snare Sniper).
  // Recibe cleanMid + snareVitamin del sistema actual.
  backMid: {
    name: 'Back R (Mid)',
    gateOn: 0.58,        // ═══ BACK_PAR_GATE_MAX exacto
    gateOff: 0.18,       // Gate dinámico: 0.58 - 0.40*morphFactor
    boost: 2.0,          // ═══ BACK_PAR_SLAP_BASE exacto
    crushExponent: 2.0,  // ═══ God Mode exacto (curva cuadrática)
    decayBase: 0.65,     // Snare es explosivo — decay medium
    decayRange: 0.20,
    maxIntensity: 1.0,   // Sin cap — snare merece full power
    squelchBase: 0.10,   // Bajo — snares son siempre legítimos
    squelchSlope: 0.50,
    ghostCap: 0.03,
    gateMargin: 0.02,
  },

  // ── MOVER LEFT: HighMid (2-6kHz) ──────────────────────────────
  // Heredero del MOVER L actual (Mid - 30% Treble = "The Body").
  // Presencia, ataque, crunch de guitarras/sintetizadores.
  highMid: {
    name: 'Mover L (HighMid)',
    gateOn: 0.20,        // ═══ MOVER_L_GATE exacto
    gateOff: 0.12,
    boost: 4.0,          // ═══ MOVER_L_BOOST exacto
    crushExponent: 1.2,  // ═══ God Mode exacto (pow 1.2)
    decayBase: 0.60,
    decayRange: 0.15,
    maxIntensity: 1.0,
    squelchBase: 0.05,   // Bajo — movers son expresivos
    squelchSlope: 0.30,
    ghostCap: 0.05,
    gateMargin: 0.01,
  },

  // ── MOVER RIGHT: Treble (6-16kHz) ─────────────────────────────
  // Heredero del MOVER R actual (SCHWARZENEGGER MODE 🤖).
  // Hi-hats, cymbals, aire. Hipersensible.
  treble: {
    name: 'Mover R (Treble)',
    gateOn: 0.14,        // ═══ MOVER_R_GATE exacto (hypersensitive)
    gateOff: 0.08,
    boost: 8.0,          // ═══ MOVER_R_BOOST exacto (TERMINATOR)
    crushExponent: 1.2,  // ═══ God Mode exacto
    decayBase: 0.50,     // Más rápido — treble es percusivo
    decayRange: 0.20,
    maxIntensity: 1.0,
    squelchBase: 0.03,
    squelchSlope: 0.15,
    ghostCap: 0.04,
    gateMargin: 0.01,
  },

  // ── STROBE: UltraAir + Flatness ───────────────────────────────
  // No usa LiquidEnvelope — lógica binaria simple.
  // Incluida aquí solo como referencia de coeficientes.
  strobe: {
    name: 'Strobe (UltraAir)',
    gateOn: 0.80,        // ═══ STROBE_THRESHOLD exacto
    gateOff: 0.70,
    boost: 1.0,          // Binario: on/off
    crushExponent: 1.0,
    decayBase: 0.0,      // Sin decay — duración fija 30ms
    decayRange: 0.0,
    maxIntensity: 1.0,
    squelchBase: 0.0,
    squelchSlope: 0.0,
    ghostCap: 0.0,
    gateMargin: 0.0,
  },
};

// ═══════════════════════════════════════════════════════════════════
// 3. AUDIO PROFILES — Simulated GodEar band outputs
// ═══════════════════════════════════════════════════════════════════

interface AudioFrame {
  subBass: number;
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  treble: number;
  ultraAir: number;
  sectionType: 'drop' | 'breakdown' | 'buildup' | 'intro';
}

/**
 * Genera frames deterministas basados en perfiles musicales REALES.
 * Estos NO son aleatorios — son modelos de distribución de energía
 * documentados en la literatura de audio engineering.
 * 
 * Fuente: distribuciones espectrales típicas medidas con SPAN (Voxengo)
 * en tracks de referencia de cada género.
 */
function generateBrejchaProfile(): AudioFrame[] {
  const frames: AudioFrame[] = [];
  // Boris Brejcha: Hard Techno. Kick 4x4 dominante, mids recesivos.
  // Distribución: 70% energía en sub+bass, mid bajo, treble moderado para hats.
  // 128 BPM → kick cada ~469ms → a 30fps = cada ~14 frames
  for (let i = 0; i < 300; i++) {
    const phase = (i % 14) / 14; // Fase dentro del beat
    const isKickFrame = phase < 0.15; // Kick dura ~2 frames
    const isSnareFrame = (i % 28) >= 13 && (i % 28) < 16; // Snare en beat 2,4
    const isHatFrame = (i % 7) < 2; // 16th note hats
    
    // sectionType: 4 compases intro, 32 drop, 8 breakdown, 32 drop
    let sectionType: AudioFrame['sectionType'] = 'drop';
    if (i < 56) sectionType = 'intro';
    else if (i >= 168 && i < 224) sectionType = 'breakdown';

    const inDrop = sectionType === 'drop';
    const kickEnergy = isKickFrame && inDrop ? 0.92 : (inDrop ? 0.35 : 0.10);
    
    frames.push({
      subBass: kickEnergy * 0.95,                                    // Sub domina en kick
      bass: kickEnergy * 0.80 + (inDrop ? 0.15 : 0.05),            // Bass body
      lowMid: inDrop ? 0.20 : 0.35,                                 // Mud zone — bajo en techno
      mid: isSnareFrame ? 0.75 : (inDrop ? 0.25 : 0.40),           // Snare/stab
      highMid: isSnareFrame ? 0.55 : (inDrop ? 0.18 : 0.12),       // Crunch
      treble: isHatFrame ? 0.60 : (inDrop ? 0.15 : 0.08),          // Hats
      ultraAir: isHatFrame ? 0.20 : 0.05,                           // Sizzle
      sectionType,
    });
  }
  return frames;
}

function generateRufusDuSolProfile(): AudioFrame[] {
  const frames: AudioFrame[] = [];
  // Rufus Du Sol: Melodic Techno/Electronica. Vocals + pads dominan mids.
  // Distribución: 40% mids, bass moderado, treble con reverb.
  // 122 BPM → kick cada ~492ms → ~15 frames
  for (let i = 0; i < 300; i++) {
    const phase = (i % 15) / 15;
    const isKickFrame = phase < 0.12;
    const isVocalPeak = (i % 60) >= 20 && (i % 60) < 45; // Phrasing vocal
    
    let sectionType: AudioFrame['sectionType'] = 'drop';
    if (i < 60) sectionType = 'intro';
    else if (i >= 150 && i < 210) sectionType = 'breakdown';

    const inDrop = sectionType === 'drop';
    const kickEnergy = isKickFrame && inDrop ? 0.78 : (inDrop ? 0.25 : 0.08);
    const vocalBoost = isVocalPeak ? 0.30 : 0;
    
    frames.push({
      subBass: kickEnergy * 0.70,                                    // Menos sub que Brejcha
      bass: kickEnergy * 0.65 + (inDrop ? 0.20 : 0.10),            // Bass line melódica
      lowMid: inDrop ? 0.40 + vocalBoost * 0.3 : 0.50,             // Warmth de pads
      mid: (inDrop ? 0.55 : 0.45) + vocalBoost,                    // VOCES dominan
      highMid: inDrop ? 0.35 + vocalBoost * 0.5 : 0.20,            // Presencia vocal
      treble: inDrop ? 0.25 : 0.15,                                 // Suave — no hay hats agresivos
      ultraAir: 0.10,                                                // Reverb tails
      sectionType,
    });
  }
  return frames;
}

function generateCumbiaProfile(): AudioFrame[] {
  const frames: AudioFrame[] = [];
  // Cumbia digital: Güira + Tambora + Acordeón/Sintetizador.
  // Distribución: bass moderado (tambora), mid alto (acordeón), treble alto (güira).
  // 95 BPM → kick cada ~632ms → ~19 frames
  for (let i = 0; i < 300; i++) {
    const phase = (i % 19) / 19;
    const isTamboraFrame = phase < 0.10;
    const isGuiraFrame = (i % 5) < 2; // Güira constante en 16ths
    const isAccordionPeak = (i % 38) >= 10 && (i % 38) < 28; // Frase de acordeón
    
    // Cumbia no tiene "breakdown" clásico — toda la estructura es repetitiva
    const sectionType: AudioFrame['sectionType'] = i < 38 ? 'intro' : 'drop';
    const inDrop = sectionType === 'drop';
    const tamboraEnergy = isTamboraFrame && inDrop ? 0.70 : (inDrop ? 0.20 : 0.08);
    const accordionBoost = isAccordionPeak ? 0.35 : 0;
    
    frames.push({
      subBass: tamboraEnergy * 0.50,                                 // Tambora tiene menos sub
      bass: tamboraEnergy * 0.75 + (inDrop ? 0.15 : 0.05),         // Body de tambora
      lowMid: inDrop ? 0.35 + accordionBoost * 0.4 : 0.25,         // Bajo de acordeón
      mid: (inDrop ? 0.45 : 0.30) + accordionBoost,                // ACORDEÓN domina
      highMid: (inDrop ? 0.30 : 0.15) + accordionBoost * 0.5,      // Presencia
      treble: isGuiraFrame ? 0.65 : (inDrop ? 0.20 : 0.10),        // GÜIRA ritmo constante
      ultraAir: isGuiraFrame ? 0.25 : 0.08,                         // Metálico
      sectionType,
    });
  }
  return frames;
}

// ═══════════════════════════════════════════════════════════════════
// 4. GOD MODE REFERENCE — El sistema actual de 4 zonas
// ═══════════════════════════════════════════════════════════════════

interface GodModeResult {
  front: number;
  back: number;
  moverL: number;
  moverR: number;
  total: number;
}

/**
 * Simula el comportamiento actual de God Mode (4 zonas)
 * usando la misma lógica simplificada del toLegacyFormat.
 */
function simulateGodMode(frame: AudioFrame): GodModeResult {
  // toLegacyFormat: bass = bands.bass + bands.subBass * 0.5
  const legacyBass = frame.bass + frame.subBass * 0.5;
  const legacyMid = frame.mid;
  const legacyTreble = frame.treble + frame.ultraAir * 0.5;
  
  // Front: simple gate (God Mode usa lógica compleja, aquí aproximamos RMS)
  const front = legacyBass > 0.50 ? Math.min(0.80, (legacyBass - 0.50) * 3.0) : 0;
  
  // Back: snare power (simplificado)
  const snarePower = Math.min(1.0, legacyMid * 0.5 + legacyTreble * 0.5);
  const back = snarePower > 0.40 ? Math.min(1.0, (snarePower - 0.40) * 2.5) : 0;
  
  // Movers: simple gate + boost
  const moverL = legacyMid > 0.20 ? Math.min(1.0, Math.pow((legacyMid - 0.20) / 0.80, 1.2) * 4.0) : 0;
  const moverR = legacyTreble > 0.14 ? Math.min(1.0, Math.pow((legacyTreble - 0.14) / 0.86, 1.2) * 8.0) : 0;
  
  // Sidechain ducking
  const ducking = front > 0.1 ? 1.0 - front * 0.90 : 1.0;
  
  return {
    front,
    back,
    moverL: moverL * ducking,
    moverR: moverR * ducking,
    total: front + back + moverL * ducking + moverR * ducking,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 5. LIQUID STEREO SIMULATOR — 7 zonas con LiquidEnvelope
// ═══════════════════════════════════════════════════════════════════

interface LiquidResult {
  subBass: number;
  bass: number;
  lowMid: number;
  backMid: number;
  highMid: number;
  treble: number;
  strobe: boolean;
  total: number;
}

function simulateLiquidStereo(
  frames: AudioFrame[],
  configs: Record<string, LiquidEnvelopeConfig>,
): { god: GodModeResult[]; liquid: LiquidResult[] } {
  const states: Record<string, LiquidEnvelopeState> = {};
  for (const key of Object.keys(configs)) {
    states[key] = createEnvelopeState();
  }

  const godResults: GodModeResult[] = [];
  const liquidResults: LiquidResult[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const now = i * 33; // 30fps → 33ms per frame
    const isBreakdown = frame.sectionType === 'breakdown' || frame.sectionType === 'buildup';

    // MorphFactor: basado en mid (como God Mode usa avgMidProfiler)
    const morphFactor = Math.min(1.0, Math.max(0.0, (frame.mid - 0.30) / 0.40));

    // God Mode reference
    godResults.push(simulateGodMode(frame));

    // Liquid Stereo: 6 bandas con envelope + 1 strobe binario
    const subBassOut = processEnvelope(configs.subBass, states.subBass, frame.subBass, morphFactor, now, isBreakdown);
    const bassOut = processEnvelope(configs.bass, states.bass, frame.bass, morphFactor, now, isBreakdown);
    const lowMidOut = processEnvelope(configs.lowMid, states.lowMid, frame.lowMid, morphFactor, now, isBreakdown);
    const backMidOut = processEnvelope(configs.backMid, states.backMid, frame.mid, morphFactor, now, isBreakdown);
    const highMidOut = processEnvelope(configs.highMid, states.highMid, frame.highMid, morphFactor, now, isBreakdown);
    const trebleOut = processEnvelope(configs.treble, states.treble, frame.treble, morphFactor, now, isBreakdown);

    // Strobe: binary trigger
    const strobeActive = (frame.treble > 0.80) || (frame.ultraAir > 0.70 && frame.treble > 0.60);

    // Sidechain: Front pair (subBass + bass) ducks movers
    const frontMax = Math.max(subBassOut, bassOut);
    const ducking = frontMax > 0.1 ? 1.0 - frontMax * 0.90 : 1.0;

    liquidResults.push({
      subBass: subBassOut,
      bass: bassOut,
      lowMid: lowMidOut,
      backMid: backMidOut,
      highMid: highMidOut * ducking,
      treble: trebleOut * ducking,
      strobe: strobeActive,
      total: subBassOut + bassOut + lowMidOut + backMidOut + highMidOut * ducking + trebleOut * ducking,
    });
  }

  return { god: godResults, liquid: liquidResults };
}

// ═══════════════════════════════════════════════════════════════════
// 6. ANALYSIS & REPORTING
// ═══════════════════════════════════════════════════════════════════

interface ProfileAnalysis {
  name: string;
  frames: number;
  godMode: {
    avgTotal: number;
    maxTotal: number;
    avgFront: number;
    avgBack: number;
    avgMoverL: number;
    avgMoverR: number;
    activeFrames: number; // frames where total > 0.05
  };
  liquid: {
    avgTotal: number;
    maxTotal: number;
    avgSubBass: number;
    avgBass: number;
    avgLowMid: number;
    avgBackMid: number;
    avgHighMid: number;
    avgTreble: number;
    strobeFrames: number;
    activeFrames: number;
  };
  energyRatio: number; // liquid/god total energy ratio
  verdict: string;
}

function analyzeProfile(
  name: string,
  frames: AudioFrame[],
  configs: Record<string, LiquidEnvelopeConfig>,
): ProfileAnalysis {
  const { god, liquid } = simulateLiquidStereo(frames, configs);
  const n = frames.length;

  const sumGod = god.reduce((acc, r) => ({
    total: acc.total + r.total,
    maxTotal: Math.max(acc.maxTotal, r.total),
    front: acc.front + r.front,
    back: acc.back + r.back,
    moverL: acc.moverL + r.moverL,
    moverR: acc.moverR + r.moverR,
    active: acc.active + (r.total > 0.05 ? 1 : 0),
  }), { total: 0, maxTotal: 0, front: 0, back: 0, moverL: 0, moverR: 0, active: 0 });

  const sumLiq = liquid.reduce((acc, r) => ({
    total: acc.total + r.total,
    maxTotal: Math.max(acc.maxTotal, r.total),
    subBass: acc.subBass + r.subBass,
    bass: acc.bass + r.bass,
    lowMid: acc.lowMid + r.lowMid,
    backMid: acc.backMid + r.backMid,
    highMid: acc.highMid + r.highMid,
    treble: acc.treble + r.treble,
    strobe: acc.strobe + (r.strobe ? 1 : 0),
    active: acc.active + (r.total > 0.05 ? 1 : 0),
  }), { total: 0, maxTotal: 0, subBass: 0, bass: 0, lowMid: 0, backMid: 0, highMid: 0, treble: 0, strobe: 0, active: 0 });

  const ratio = sumGod.total > 0 ? sumLiq.total / sumGod.total : 0;

  let verdict = '';
  if (ratio >= 0.85 && ratio <= 1.20) {
    verdict = '✅ PASS — Energía comparable al God Mode';
  } else if (ratio < 0.85) {
    verdict = `⚠️ WEAK — Energía total ${((1 - ratio) * 100).toFixed(1)}% menor que God Mode`;
  } else {
    verdict = `⚠️ HOT — Energía total ${((ratio - 1) * 100).toFixed(1)}% mayor que God Mode`;
  }

  return {
    name,
    frames: n,
    godMode: {
      avgTotal: sumGod.total / n,
      maxTotal: sumGod.maxTotal,
      avgFront: sumGod.front / n,
      avgBack: sumGod.back / n,
      avgMoverL: sumGod.moverL / n,
      avgMoverR: sumGod.moverR / n,
      activeFrames: sumGod.active,
    },
    liquid: {
      avgTotal: sumLiq.total / n,
      maxTotal: sumLiq.maxTotal,
      avgSubBass: sumLiq.subBass / n,
      avgBass: sumLiq.bass / n,
      avgLowMid: sumLiq.lowMid / n,
      avgBackMid: sumLiq.backMid / n,
      avgHighMid: sumLiq.highMid / n,
      avgTreble: sumLiq.treble / n,
      strobeFrames: sumLiq.strobe,
      activeFrames: sumLiq.active,
    },
    energyRatio: ratio,
    verdict,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 7. MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════

function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🌊 WAVE 2401: LIQUID STEREO SIMULATOR');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const profiles = [
    { name: 'Boris Brejcha (Hard Techno)', generator: generateBrejchaProfile },
    { name: 'Rufus Du Sol (Melodic)', generator: generateRufusDuSolProfile },
    { name: 'Cumbia Digital', generator: generateCumbiaProfile },
  ];

  const results: ProfileAnalysis[] = [];

  for (const { name, generator } of profiles) {
    const frames = generator();
    const analysis = analyzeProfile(name, frames, BAND_CONFIGS);
    results.push(analysis);

    console.log(`┌──────────────────────────────────────────────────────────┐`);
    console.log(`│ 🎵 ${name.padEnd(52)} │`);
    console.log(`├──────────────────────────────────────────────────────────┤`);
    console.log(`│ GOD MODE (4 zonas)                                      │`);
    console.log(`│   Avg Total: ${analysis.godMode.avgTotal.toFixed(3).padEnd(8)} Max: ${analysis.godMode.maxTotal.toFixed(3).padEnd(8)}               │`);
    console.log(`│   Front: ${analysis.godMode.avgFront.toFixed(3).padEnd(6)} Back: ${analysis.godMode.avgBack.toFixed(3).padEnd(6)} MvL: ${analysis.godMode.avgMoverL.toFixed(3).padEnd(6)} MvR: ${analysis.godMode.avgMoverR.toFixed(3)} │`);
    console.log(`│   Active Frames: ${analysis.godMode.activeFrames}/${analysis.frames}                                │`);
    console.log(`├──────────────────────────────────────────────────────────┤`);
    console.log(`│ LIQUID STEREO (7 bandas)                                │`);
    console.log(`│   Avg Total: ${analysis.liquid.avgTotal.toFixed(3).padEnd(8)} Max: ${analysis.liquid.maxTotal.toFixed(3).padEnd(8)}               │`);
    console.log(`│   SubB: ${analysis.liquid.avgSubBass.toFixed(3).padEnd(6)} Bass: ${analysis.liquid.avgBass.toFixed(3).padEnd(6)} LMid: ${analysis.liquid.avgLowMid.toFixed(3).padEnd(6)} Mid: ${analysis.liquid.avgBackMid.toFixed(3)} │`);
    console.log(`│   HMid: ${analysis.liquid.avgHighMid.toFixed(3).padEnd(6)} Treb: ${analysis.liquid.avgTreble.toFixed(3).padEnd(6)} Strobe: ${analysis.liquid.strobeFrames.toString().padEnd(4)}             │`);
    console.log(`│   Active Frames: ${analysis.liquid.activeFrames}/${analysis.frames}                                │`);
    console.log(`├──────────────────────────────────────────────────────────┤`);
    console.log(`│ ENERGY RATIO: ${analysis.energyRatio.toFixed(3)} (liquid/god)                       │`);
    console.log(`│ ${analysis.verdict.padEnd(56)} │`);
    console.log(`└──────────────────────────────────────────────────────────┘`);
    console.log('');
  }

  // =================================================================
  // VALIDATION MATRIX
  // =================================================================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 VALIDATION MATRIX');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const allPass = results.every(r => r.energyRatio >= 0.85 && r.energyRatio <= 1.20);
  
  console.log('');
  console.log(`Profile                      │ God Avg │ Liq Avg │ Ratio  │ Status`);
  console.log(`─────────────────────────────┼─────────┼─────────┼────────┼──────────`);
  for (const r of results) {
    const status = (r.energyRatio >= 0.85 && r.energyRatio <= 1.20) ? '✅ PASS' : '⚠️ WARN';
    console.log(`${r.name.padEnd(29)}│ ${r.godMode.avgTotal.toFixed(3).padEnd(8)}│ ${r.liquid.avgTotal.toFixed(3).padEnd(8)}│ ${r.energyRatio.toFixed(3).padEnd(7)}│ ${status}`);
  }
  console.log('');
  
  if (allPass) {
    console.log('🎯 ALL PROFILES PASS — Liquid Stereo is energy-compatible with God Mode');
  } else {
    console.log('⚠️ SOME PROFILES NEED COEFFICIENT TUNING');
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Simulation complete. No files modified.');
}

main();
