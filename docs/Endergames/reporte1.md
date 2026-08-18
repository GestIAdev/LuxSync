REPORTE DE INVESTIGACIÓN: JERARQUÍA SELENE Y EFECTO FANTASMA
TASK 1: MAPA DE LA JERARQUÍA DE DISPARO
Selene tiene 5 niveles de prioridad que se evalúan en cascada. Cada nivel puede cortocircuitar los inferiores:

Jerarquía completa (de mayor a menor prioridad)


┌─────────────────────────────────────────────────────────────────┐
│  NIVEL 0: 🔮 CASSANDRA SOVEREIGN CLOCK (WAVE 5011)              │
│  Fast path en SeleneTitanConscious.ts:611                       │
│  Si Cassandra tiene un efecto pre-bufferizado cuyo              │
│  executeAt ha llegado → dispara AHORA, sin pasar por            │
│  HuntEngine, Fuzzy, ni ningún gate energético.                  │
│  Sub-modalidades:                                               │
│    • sovereign_window: [predictedAt, predictedAt+500ms]        │
│    • glass_break: drop adelantado detectado por Z-Score+energy │
│  Gates dentro del Sovereign Clock (SovereignClockGuard.ts):    │
│    1. Minion quarantine (organismStatus='alive' → abort)       │
│    2. Acoustic Reality veto (heavy en silence/valley → abort)  │
│    3. Heavy epicness floor + re-route a efecto más ligero      │
│    4. Divine gate + re-route (epicness < 0.50-0.60 → re-route) │
│    5. Pressure veto (presión fuera de pressureRange → abort)   │
│    6. Universal epicness floor (absoluto + combinado)          │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (si no hay sovereign fire)
┌─────────────────────────────────────────────────────────────────┐
│  NIVEL -1: 🌩️ DIVINE MOMENT (DecisionMaker.ts:283)             │
│  Gate: (divinePeakPassed || divineSustainedPassed)             │
│        && divineZPassed                                         │
│  Umbrales (ΠMΔG interpolation, genre-agnostic):                │
│    V3_EPSILON_DIVINE = 0.60 - 0.10·Π·(1−M)                     │
│      techno (Π alto, M bajo) → 0.50 (permisivo)                │
│      ambient (Π bajo o M alto) → 0.60 (estricto)               │
│    DIVINE_SUSTAINED_EPICNESS = 0.50                             │
│    DIVINE_SUSTAINED_RMS_FLOOR = 0.75 - 0.10·G                  │
│      latin (G alto) → 0.65 (permisivo)                         │
│      ambient (G bajo) → 0.75 (estricto)                        │
│    DIVINE_MIN_Z_SCORE = 2.10                                    │
│  Si pasa → return 'divine_strike' (MANDATORY FIRE)             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  NIVEL 0: 🧬 DNA BRAIN (DecisionMaker.ts:327)                  │
│  Si dreamIntegration.approved && dreamIntegration.effect:      │
│    • Si el efecto es divine Y divineGatePassed=false →         │
│      DIVINE LEAK BLOCKED (fall through)                        │
│    • Si section='buildup' y efecto no permitido → fall through │
│    • Else → return 'strike'                                    │
│  NOTA: El DNA Brain es Cassandra/DreamSimulator — el que       │
│  rankea candidatos y propone el mejor.                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  NIVEL 1: 🔴 DROP PREDICHO (DecisionMaker.ts:351)              │
│  Tres caminos al DROP:                                         │
│    a) prediction.type='drop_incoming' && prob>0.65             │
│       && contextualPhase='building'                            │
│    b) pattern.section='drop' && v3Epicness>0.20                │
│    c) prediction.type='energy_spike' && prob>0.75              │
│       && rhythmicIntensity>0.6 && contextualPhase='building'   │
│  → return 'prepare_for_drop'                                   │
│  En generateDropPreparationDecision:                           │
│    DROP_EPICNESS_FLOOR = 0.25 (no 0.60 — ver explicación)     │
│    Arsenal = divineArsenal + heavyArsenal (fallback)           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  NIVEL 4: 📈 BUILDUP/BEAUTY (DecisionMaker.ts:367)             │
│    pattern.section='buildup' ||                                 │
│    (prediction.type='buildup_starting' && prob>0.7)            │
│    → return 'buildup_enhance'                                  │
│  O: beauty.totalBeauty>0.75 && trend='rising'                  │
│    → return 'subtle_shift'                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  NIVEL 5: 🧘 HOLD (DecisionMaker.ts:378)                       │
│  Default — no efecto, esperar.                                 │
└─────────────────────────────────────────────────────────────────┘
El bypass v3Bypass — por qué existe y cómo funciona
Ubicación: SeleneTitanConscious.ts:1489



typescript
const v3IgniteBypass = this._v3Ignite
  && isDNADecision
  && ethicsScore >= ethicsThreshold
  && !isHardMinimumBlocked
  && !oceanicProtection
  && !alreadyValidatedByArsenal
  && v3Epic >= v3EpicnessFloor
Qué es: v3Bypass NO es un bypass del sistema — es el gate de aprobación normal del V3 Liquid Cognition. Se llama "bypass" porque bypasea los antiguos cooldowns artificiales (WAVE 2111 los abolió). El V3 Liquid Cognition usa V(t) vapor pressure como mecanismo refractario emergente en lugar de timers fijos.

Por qué el DROP usa floor 0.25 y no 0.59:

El comentario en DecisionMaker.ts:689-698 lo explica explícitamente:

"The DROP path is hierarchically BELOW Divine and Sovereign Clock. It should NOT require divine-level epicness (0.60+). However, it needs a moderate floor to prevent autotuned vocals and compressed drums from triggering drop effects. A floor of 0.25 blocks the 'voz de nariz tapada' case (epicness ~0.18) while allowing real drops (epicness > 0.30) to fire freely."

La lógica de los fallback tiers:

Tier	Floor de epicness	Quién lo usa	Por qué
Divine	0.50-0.60 (ΠMΔG) + Z≥2.10	Divine Moment + Sovereign divine gate	Eventos raros, justificación acústica brutal
Heavy (Sovereign re-route)	max(0.25, rms10s×0.35)	SovereignClockGuard heavy floor	Efectos pesados no-divinos
DROP	0.25	generateDropPreparationDecision	La predicción del drop es la autoridad, no la epicness
Hard/Divine gatekeeper	max(0.15, rms10s×0.20)	SeleneTitanConscious v3EpicnessFloor	Efectos heavy/divine en gatekeeper normal
Ambient gatekeeper	max(0.05, rms10s×0.10)	SeleneTitanConscious v3EpicnessFloor	Efectos ambientales — floor permisivo
El tier de 0.15 que mencionas es el v3EpicnessFloor para efectos hard/divine en el gatekeeper de SeleneTitanConscious.ts:1482:



typescript
const v3EpicnessFloor = isHardForBypass
  ? Math.max(0.15, this.energyConsciousness.getRmsAverage10s() * 0.20)
  : Math.max(0.05, this.energyConsciousness.getRmsAverage10s() * 0.10)
Esto NO es un bypass del divine floor — es el floor del gatekeeper post-decision, que opera después de que DecisionMaker ya eligió el efecto. El divine floor (0.50-0.60) se aplica en determineDecisionType() para decidir si el efecto puede ser propuesto. El floor de 0.15 se aplica en el gatekeeper para decidir si el efecto ya propuesto puede materializarse. Son gates en cascada, no competidores.

TASK 2: AUTOPSIA DE corazon_latino.lfx
DNA del efecto


json
{
  "archetype": "utility",
  "genome": { "aggression": 0.30, "chaos": 0.25, "organicity": 0.65 },
  "textureAffinity": "universal",
  "compatibleVibes": ["fiesta-latina"],
  "validSections": ["ambient", "gentle", "valley", "breakdown"],
  "energyZone": { "min": "gentle", "max": "active" },
  "aggressionRange": { "min": 0.30, "max": 0.30 },
  "pressureRange": { "min": 0, "max": 0.58 },
  "spatialBehavior": "static"
}


json
simulationMeta: {
  "isStrobe": false, "isDivineCandidate": false, "isHeavyCandidate": false,
  "gpuCost": 0.3, "fatigueImpact": 0.06, "cooldownMs": 7000
}
Diagnóstico: por qué Selene nunca lo selecciona
Hay cuatro barreras que lo eliminan sistemáticamente, ninguna de las cuales es un bug — todas son el diseño funcionando correctamente, pero el efecto está mal calibrado para sobrevivir:

Barrera 1: pressureRange — EL ASESINO PRINCIPAL
pressureRange: { min: 0, max: 0.58 } significa que corazon_latino solo puede disparar cuando la energía real está por debajo de 0.58. En tu log de fiesta-latina, la energía está consistentemente entre 0.60-0.94:



E:+1.6σ  E:+1.5σ  E:+1.4σ  E:+1.1σ  E:+0.9σ  E:+0.5σ  E:+1.2σ  E:+1.0σ
Esos son Z-scores, pero la energía raw en el log del TitanOrchestrator muestra peak=0.737, peak=0.555, peak=0.604, peak=0.671 — todos > 0.58. El filterByPressure() en EffectDreamSimulator.ts:649 elimina corazon_latino antes de que siquiera entre al ranking.

Incluso si sobreviviera el pressure filter, el SovereignClockGuard tiene un Pressure Veto (línea 280) que abortaría el disparo si currentPressure > pr.max.

Barrera 2: aggressionRange: { min: 0.30, max: 0.30 } — anchura cero
Este es exactamente el bug H2 que arreglamos en WAVE 7520 para LfxClipInstance.toCognitiveDNA(), pero corazon_latino.lfx es un builtin que se guardó antes del fix. Su aggressionRange es un punto, no una banda. El DNAAnalyzer hace matching por distancia euclidiana al Target DNA, y un punto de anchura cero significa que solo matchea cuando el Target DNA tiene aggression exactamente en 0.30 — lo cual es rarísimo en fiesta-latina (reggaeton latino tiene groove alto, energía alta, aggression target típicamente 0.50-0.70).

Barrera 3: Zone filter — corazon cae en zonas de baja energía
Con aggression: 0.30, el filterByZone() lo clasifica en zona silence (max 0.35) o valley (max 0.50). En fiesta-latina con energía 0.60-0.94, la zona derivada es active (0.55-0.70) o intense (0.70-0.85). corazon_latino con A=0.30 no entra en active (min 0.35) ni en intense (min 0.60).

El comentario en la línea 580-581 lo documenta explícitamente:

"corazon_latino (A=0.38) caía en el hueco entre silence(0.30) y active(0.40). Ahora los rangos son contiguos..."

Pero corazon_latino tiene A=0.30, no 0.38 — cae JUSTO en el borde de silence (max 0.35). El WAVE 7170 cerró huecos pero no movió el efecto a una zona más alta.

Barrera 4: SLOW_EFFECTS penalty en drops/spikes
El nombre corazon_latino no contiene ninguna keyword de SLOW_EFFECTS (breath, mist, drift, moon, wave, sweep, ambient, fiber, pulse, shimmer, plankton, whale, caustic), así que esta barrera no le afecta. Tampoco contiene keywords de IMPACT_EFFECTS, así que no recibe boost ni penalty durante drops. Es neutral en este aspecto.

Veredicto de la autopsia
corazon_latino es un efecto fantasma por calibración, no por bug. Sus parámetros lo condenan a solo poder disparar en momentos de baja energía (E<0.58) con baja agresión (A≈0.30) — pero fiesta-latina es un vibe de energía persistentemente alta. El efecto fue diseñado para "corazón latino" (algo romántico, suave) pero el vibe fiesta-latina es literalmente una fiesta.

Las tres causas raíz, en orden de impacto:

pressureRange.max: 0.58 — lo elimina en el filterByPressure antes del ranking. Este es el 90% del problema.
aggressionRange: {0.30, 0.30} — anchura cero, solo matchea un punto exacto del Target DNA.
aggression: 0.30 — lo clasifica en zona silence/valley, incompatible con fiesta-latina que vive en active/intense.
No es un bug del código — es un efecto mal calibrado para el vibe al que está asignado. Si quisieras que corazon_latino disparara en fiesta-latina, necesitaría:

pressureRange: { min: 0, max: 0 } (permisivo, sin gate) o { min: 0, max: 0.85 } (cubrir hasta intense)
aggressionRange: { min: 0.15, max: 0.45 } (banda de tolerancia, no punto)
Posiblemente aggression: 0.40 para caer en zona active
Pero eso cambiaría la identidad del efecto — corazon_latino sonaría como un efecto de fiesta, no como un corazón latino suave. Quizás el efecto simplemente no pertenece en fiesta-latina y debería estar en chill-lounge o un vibe latin-romantic que no existe aún.