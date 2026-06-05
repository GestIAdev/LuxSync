// @/electron-app/src/core/intelligence/think/DecisionMaker.ts

// ═══════════════════════════════════════════════════════════════════════
// 🐘 WAVE 5001: ABSOLUTE ENERGY GATE — Calibración Latino Montecarlo
// ═══════════════════════════════════════════════════════════════════════
// RAÍZ DEL PROBLEMA: Con bufferSize=300 (5s), un valle breve seguido de un
// bombo único genera Z=8σ porque la media se calcula sobre el silencio reciente.
// Con bufferSize=1800 (30s) el Z se modera, pero aun así puede que el Z sea
// estadísticamente alto mientras la energía absoluta es inferior al 60% del pico.
//
// PROBLEMA 2 (Electro-Latino / WAVE 5001): Tienen energía sostenida alta.
// Los "redobles" bajan temporalmente al ~50%. El AbsGate en 0.60 ahoga
// los disparos al clímax. Bajando a 0.48 permitimos el impacto tras el
// redoble sin habilitar en verdaderos silencios (< 30%).
// ═══════════════════════════════════════════════════════════════════════
const ABSOLUTE_ENERGY_GATE_RATIO = 0.48 // 📉 WAVE 5001: 0.60 → 0.48
const ABSOLUTE_ENERGY_GATE_FALLBACK = 0.40 // 📉 WAVE 5001: 0.45 → 0.40

// ... (y más abajo en el path de DROP) ...

    const dropGateThreshold = dropMaxHistoric !== null
      ? dropMaxHistoric * 0.48 // 📉 WAVE 5001: 0.60 → 0.48
      : 0.40 // 📉 WAVE 5001: 0.45 → 0.40


// ═══════════════════════════════════════════════════════════════════════
// 🌴 WAVE 4864 + 5001: SPECTRAL GATE — Anti-Bad-Bunny & Alta Fidelidad
// ═══════════════════════════════════════════════════════════════════════
// SOLUCIÓN: En latino/dembow, exigir presencia física del bajo/bombo:
//   • hasHeavyKick:   lowBand >= maxHistoric * 0.55  (bombo empujando fuerte)
//   • isNotJustVocals: lowBand >= midBand * 0.95     (WAVE 5001 Spotify Fix)
//
// Spotify a 320kbps eleva la banda MID. Exigir 1.2 o 1.5 en el multiplicador
// aniquilaba los disparos al requerir que los graves ahogaran excesivamente
// la parte vocal/melódica. 0.95 garantiza un bajo sólido y comparable al MID.
// ═══════════════════════════════════════════════════════════════════════
  const _vId = pattern.vibeId ?? ''
  const isLatinoVibeForSpectral = _vId.includes('latino') || _vId.includes('latina') || _vId.includes('dembow')
  let spectralGateOpen = true
  if (isLatinoVibeForSpectral && energyGateOpen) {
    const lowBand = pattern.bassPresenceSustained ?? pattern.bassPresence ?? 0
    const midBand = pattern.midPresence ?? 0
    const kickThreshold = (maxHistoric ?? 0) * 0.75
    const hasHeavyKick = lowBand >= kickThreshold
    // 🔪 WAVE 5001: Bajar multiplicador a 0.95 para pistas Hi-Fi y Spotify
    const isNotJustVocals = lowBand >= (midBand * 0.95)
    spectralGateOpen = hasHeavyKick && isNotJustVocals
  }

// ... (y repetirlo igual abajo en la validación DROP) ...

      // 🔪 WAVE 5001: Bajar multiplicador a 0.95 para pistas Hi-Fi y Spotify
      const isNotJustVocals = lowBand >= (midBand * 0.95)
      dropSpectralGateOpen = hasHeavyKick && isNotJustVocals



// @/electron-app/src/core/mood/MoodController.ts

  // ═══════════════════════════════════════════════════════════════════════
  // ⚖️ BALANCED - "Fiesta normal, el DJ está sobrio"
  // ═══════════════════════════════════════════════════════════════════════
  // 🎯 WAVE 5001: LATINO MONTECARLO CALIBRATION
  // Un thresholdMultiplier en 1.10 matemáticamente fuerza a que el drop tenga 
  // un raw worthiness de al menos 0.605. Ajustando a 1.05 logramos que un drop
  // de 0.85 de energía pueda sobrevivir a la puerta sin desbaratar la 
  // estabilidad general del modo BALANCED.
  // ═══════════════════════════════════════════════════════════════════════
  balanced: {
    name: 'balanced',
    description: 'El profesional. El DJ está sobrio. 🎧',
    emoji: '⚖️',
    thresholdMultiplier: 1.05,     // 📉 WAVE 5001: 1.10 → 1.05 (Worthiness gate breathing room)
    cooldownMultiplier: 2.2,       // 🩸 WAVE 4829: 1.8→2.2 — más aire en latino, objetivo 3-4 EPM
    ethicsThreshold: 1.0,          // 🔪 WAVE 4992: 1.20→1.0. Ya no es un hack mágico.
    allowEthicsOverride: false,     // 🔪 WAVE 4992: Override DESACTIVADO en BALANCED. Cooldowns son ley.
    maxIntensity: 1.0,             // Sin límite
    minIntensity: undefined,       // Los pads tienen su propio dimmer mínimo
    blockList: [],                 // Nada bloqueado
  },


// @/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts

    // (Nota: no existían los términos explícitos bassIsDominant o midBand 
    // en EffectDreamSimulator.ts, la lógica espectral primaria vive 
    // estrictamente en el DecisionMaker y HuntEngine para Selene. 
    // Por ende, la refactorización principal se confina a DecisionMaker y MoodController).