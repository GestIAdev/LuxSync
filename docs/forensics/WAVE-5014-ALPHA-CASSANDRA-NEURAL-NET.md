Forensic Audit: WAVE 5015-ALPHA — Cassandra's Neural Net
🔍 Búsqueda 1: La Fórmula del timeToEvent
Cassandra recibe timeToEventMs a través de tres capas de cálculo. No hay una sola fórmula — hay una bifurcación entre matemática dinámica de BPM y números fijos, según el origen de la predicción.

1A. Origen Pattern-Based (PredictionEngine.ts)


@electron-app/src/core/intelligence/think/PredictionEngine.ts:227-231
// Calcular timing basado en BPM
const beatsToEvent = estimateBeatsToEvent(pattern, matchedPattern)
const msPerBeat = 60000 / pattern.bpm
const estimatedTimeMs = beatsToEvent * msPerBeat


@electron-app/src/core/intelligence/think/PredictionEngine.ts:369-393
function estimateBeatsToEvent(
  pattern: SeleneMusicalPattern,
  matchedPattern: ProgressionPattern
): number {
  // Estimación basada en tipo de predicción
  switch (matchedPattern.predictionType) {
    case 'drop_incoming':
      // Drops suelen venir en 4-8 beats
      return pattern.isBuilding ? 4 : 8
    case 'buildup_starting':
      // Buildups empiezan en 2-4 beats
      return 4
    case 'breakdown_imminent':
      // Breakdowns en 8-16 beats
      return 8
    case 'transition_beat':
      // Transiciones en 4 beats
      return 4
    default:
      return 8
  }
}
Veredicto: estimateBeatsToEvent solo devuelve enteros hardcodeados (4 u 8). Luego se multiplican por 60000 / bpm. Nunca hay matemática dinámica de "cuánto le falta a esta sección actual" — solo lookup por tipo.

1B. Origen Energy-Reactive (PredictionEngine.ts)


@electron-app/src/core/intelligence/think/PredictionEngine.ts:578-604
if (trend === 'spike' && currentEnergy >= spikeThreshold) {
  const remainingEnergy = 1 - currentEnergy
  const framesUntilPeak = velocity > 0 ? Math.ceil(remainingEnergy / velocity) : 60
  const safeBpm = (bpm > 0 && Number.isFinite(bpm)) ? bpm : 120
  const msPerBeat = 60000 / safeBpm
  const beatsUntilPeak = Math.max(2, Math.round((framesUntilPeak / 60) * (safeBpm / 60)))
  return {
    type: 'energy_spike',
    probability: 0.75 + (velocity * 2),
    estimatedTimeMs: beatsUntilPeak * msPerBeat,
    ...
  }
}


@electron-app/src/core/intelligence/think/PredictionEngine.ts:615-661
// TEXTURAL DROP → buildup_starting
if (texturalEnergyOk && texturalRhythmOk && texturalTensionOk && texturalTrendOk) {
  return {
    type: 'buildup_starting',
    estimatedTimeMs: 3000,  // 🩸 hardcodeado
    ...
  }
}


@electron-app/src/core/intelligence/think/PredictionEngine.ts:667-684
if (trend === 'rising' && currentEnergy > risingThreshold) {
  const estimatedBeats = Math.round(8 - (currentEnergy * 4))
  return {
    type: 'buildup_starting',
    estimatedTimeMs: estimatedBeats * msPerBeat,
    ...
  }
}


@electron-app/src/core/intelligence/think/PredictionEngine.ts:707-721
if (pattern.emotionalTension > dropTensionThreshold && trend === 'falling') {
  return {
    type: 'drop_incoming',
    estimatedTimeMs: 4000,  // 🩸 hardcodeado
    ...
  }
}
Veredicto: La energía-reactiva usa matemática dinámica solo para energy_spike (basada en velocity y remainingEnergy). Todo lo demás (drop_incoming, buildup_starting por textura, caída de energía) usa valores fijos (3000, 4000, 8000 ms).

1C. Guard de Infinito (SeleneTitanConscious.ts)


@electron-app/src/core/intelligence/SeleneTitanConscious.ts:1118-1120
predictionTimeMs: (Number.isFinite(prediction.estimatedTimeMs) && prediction.estimatedTimeMs > 0)
  ? prediction.estimatedTimeMs : 4000,
Veredicto: Último escalón antes de Cassandra. Si estimatedTimeMs es Infinity, NaN, negativo o 0, se fuerza a 4000 ms. El ?? operador no serviría aquí porque Infinity ?? 4000 devuelve Infinity.

🔍 Búsqueda 2: Los Disparadores del Tracker
2A. SimpleSectionTracker — Decisiones de sección pura (TrinityBridge.ts)


@electron-app/src/workers/TrinityBridge.ts:1069-1186
const hasKick = rhythm.drums?.kick && rhythm.drums.kickIntensity > 0.3;
 
const rawWeightedEnergy = 
  (audio.bass * p.frequencyWeights.bass) +
  ((audio.bass + audio.mid) * 0.5 * p.frequencyWeights.midBass) +
  (audio.mid * p.frequencyWeights.mid) +
  (audio.treble * p.frequencyWeights.treble);
const weightedEnergy = Math.max(rawWeightedEnergy, audio.volume * 0.85);
 
const recentEnergy = this.avg(this.energyHistory.slice(-16));
const olderEnergy = this.avg(this.energyHistory.slice(0, 32));
const recentBass = this.avg(this.bassHistory.slice(-16));
const olderBass = this.avg(this.bassHistory.slice(0, 32)) || 0.1;
 
const bassRatio = recentBass / olderBass;
const energyDelta = recentEnergy - olderEnergy;
 
// === DROP ENTER ===
const highBassDirectly = audio.bass > 0.65;
if (!inCooldown && bassRatio > p.dropEnergyRatio && (hasKick || highBassDirectly) && weightedEnergy > 0.30) {
  newSection = 'drop';
  ...
}
// === BUILDUP ===
else if (hysteresisAllows && energyDelta > p.buildupDeltaThreshold && weightedEnergy > 0.4 && bassRatio < 1.15) {
  newSection = 'buildup';
}
// === BREAKDOWN ===
else if (hysteresisAllows && energyDelta < -0.10 && weightedEnergy < p.breakdownEnergyThreshold) {
  newSection = 'breakdown';
  ...
}
// === VERSE (fallback) ===
else if (hysteresisAllows && this.beatsSinceChange > 32) {
  newSection = 'verse';
}
Variables clave evaluadas:

hasKick: rhythm.drums.kickIntensity > 0.3
bassRatio: recentBass / olderBass (ventanas de 16 vs 32 muestras)
energyDelta: recentEnergy - olderEnergy (diferencia de ventanas)
weightedEnergy: Máximo entre suma ponderada de espectro y audio.volume * 0.85
hysteresisAllows: this.framesSinceTransition >= 45 (~1.5s @ 30fps)
Veredicto: Drop se declara por bassRatio + presencia de kick + weightedEnergy. No evalúa RMS ni Z-Score acumulado directamente — usa historial de bass/energy de 64 frames.

2B. PredictionEngine.ts — Disparadores de predicción por sección


@electron-app/src/core/intelligence/think/PredictionEngine.ts:97-191
const PROGRESSION_PATTERNS: ProgressionPattern[] = [
  {
    trigger: ['buildup', 'buildup'],
    nextSection: 'drop',
    probability: 0.90,
    predictionType: 'drop_incoming',
    ...
  },
  {
    trigger: ['verse', 'pre_chorus'],
    nextProbable: 'chorus',
    probability: 0.85,
    predictionType: 'transition_beat',
  },
  ...
]


@electron-app/src/core/intelligence/think/PredictionEngine.ts:336-367
function findMatchingPattern(): ProgressionPattern | null {
  const sortedPatterns = [...PROGRESSION_PATTERNS].sort(
    (a, b) => b.trigger.length - a.trigger.length
  )
  for (const pattern of sortedPatterns) {
    if (matchesTrigger(pattern.trigger)) {
      return pattern
    }
  }
  return null
}
 
function matchesTrigger(trigger: SectionClassification[]): boolean {
  const recentSections = sectionHistory.slice(-trigger.length)
  for (let i = 0; i < trigger.length; i++) {
    if (recentSections[i].section !== trigger[i]) {
      return false
    }
  }
  return true
}
Veredicto: drop_incoming se dispara cuando el historial de secciones termina en ['buildup', 'buildup']. transition_beat se dispara por patrones como ['verse', 'pre_chorus']. Es matching literal de strings contra sectionHistory — ninguna variable de energía o RMS interviene aquí.

🔍 Búsqueda 3: El Cálculo de la Confianza
3A. Confianza base de Pattern (PredictionEngine.ts)


@electron-app/src/core/intelligence/think/PredictionEngine.ts:396-417
function adjustProbabilityByContext(
  baseProbability: number,
  pattern: SeleneMusicalPattern
): number {
  let adjusted = baseProbability
  if (pattern.isBuilding) {
    adjusted *= 1.1
  }
  if (pattern.emotionalTension > 0.7) {
    adjusted *= 1.05
  }
  if (pattern.syncopation > 0.7) {
    adjusted *= 0.95
  }
  return Math.min(1, Math.max(0, adjusted))
}
Veredicto: La confianza base es hardcodeada por patrón (0.90, 0.75, 0.85…). Luego se multiplica por 1.1 si isBuilding, 1.05 si tension > 0.7, o 0.95 si syncopation > 0.7. No depende del PLL confidence ni del tiempo en sección.

3B. Confianza reactiva por energía (PredictionEngine.ts)


@electron-app/src/core/intelligence/think/PredictionEngine.ts:594
probability: 0.75 + (velocity * 2), // Mayor velocidad = mayor certeza


@electron-app/src/core/intelligence/think/PredictionEngine.ts:632
probability: Math.min(0.65, texturalProb),  // texturalProb = 0.55 + (currentEnergy * 0.12) + (pattern.emotionalTension * 0.08)


@electron-app/src/core/intelligence/think/PredictionEngine.ts:676
probability: 0.55 + (currentEnergy * 0.2), // 55-75% según energía


@electron-app/src/core/intelligence/think/PredictionEngine.ts:712
probability: 0.60 + (pattern.emotionalTension * 0.2),
3C. Boost espectral (PredictionEngine.ts)


@electron-app/src/core/intelligence/think/PredictionEngine.ts:814-826
if (spectralScore > 0.4) {
  if (bestPrediction.type === 'buildup_starting' || 
      bestPrediction.type === 'drop_incoming' ||
      bestPrediction.type === 'energy_spike') {
    const spectralBoost = (spectralScore - 0.4) * 0.5 // Max +0.3 para score=1.0
    bestPrediction = {
      ...bestPrediction,
      probability: Math.min(0.95, bestPrediction.probability + spectralBoost),
      ...
    }
  }
}
3D. Gate final antes de Cassandra (DreamEngineIntegrator.ts)


@electron-app/src/core/intelligence/integration/DreamEngineIntegrator.ts:483-517
const realProbability = context.predictionProbability ?? 0
const hasStrongPrediction = realProbability > 0.5
      
const musicalPrediction: MusicalPrediction = {
  predictedEnergy: energy,
  // ...
  confidence: hasStrongPrediction ? realProbability : (predictionType !== 'none' ? 0.5 : 0.3),
  // ...
  timeToEventMs: timeToEvent,
  oracleProbability: realProbability,
  ...
}
Veredicto: La confianza que Cassandra recibe es:

Si probability > 0.5 → passthrough directo del valor del Oráculo
Si probability <= 0.5 pero hay predicción → forzada a 0.5
Si no hay predicción → 0.3
No depende del bloqueo del PLL. No depende del tiempo en sección actual. Es un remap de prediction.probability con un piso de 0.5 para "predicciones débiles".

📊 Resumen Ejecutivo
Parámetro	¿Hardcode?	¿Dinámico?	Fuentes
timeToEventMs (pattern)	✅ 4-8 beats fijos	⚠️ Solo 60000 / bpm	estimateBeatsToEvent()
timeToEventMs (energy)	✅ 3000/4000/8000	✅ velocity, remainingEnergy, currentEnergy	predictFromEnergy()
timeToEventMs (Cassandra)	✅ Fallback 4000	✅ Passthrough del Oráculo	SeleneTitanConscious.ts
Triggers de sección	✅ Matching literal ['buildup','buildup']	✅ bassRatio, energyDelta, hasKick	SimpleSectionTracker + PredictionEngine
Confianza (Oráculo)	✅ Base 0.65-0.90	✅ velocity*2, energy*0.2, tension*0.2	PROGRESSION_PATTERNS + predictFromEnergy()
Confianza (Cassandra)	✅ Piso 0.5/0.3	⚠️ Passthrough condicional	DreamEngineIntegrator.ts
Hallazgo crítico para WAVE 5015-ALPHA: El sistema Next-Gen (Drop Collision Sensor) debería reemplazar la heurística de estimateBeatsToEvent() (enteros fijos) y el matching literal de secciones por un modelo que cruce BPM real + duración real de la sección actual + estructura detectada del audio en lugar de confiar en sectionHistory con strings.