Informe: La Energy Ladder — Cómo se usan las Zonas Energéticas
La Escalera (The Ladder)
Definida en @/electron-app/src/core/intelligence/EnergyConsciousnessEngine.ts:96-135:

Zona	Rango	Ancho	Efectos típicos
SILENCE	0.00 – 0.15	15%	DeepBreath, SonarPing
VALLEY	0.15 – 0.30	15%	VoidMist, FiberOptics
AMBIENT	0.30 – 0.45	15%	DigitalRain, AcidSweep
GENTLE	0.45 – 0.60	15%	AmbientStrobe, BinaryGlitch
ACTIVE	0.60 – 0.75	15%	CyberDualism, SeismicSnap
INTENSE	0.75 – 0.90	15%	SkySaw, AbyssalRise
PEAK	0.90 – 1.00	10%	Gatling, CoreMeltdown
Flujo de datos — Cómo la zona viaja por el sistema
1. Cálculo: EnergyConsciousnessEngine.determineZone()
@/electron-app/src/core/intelligence/EnergyConsciousnessEngine.ts:412-438

El motor recibe rawEnergy (0-1) y aplica asimetría temporal:

Bajar a zonas bajas: usa smoothed (lento, ~500ms) — evita falsos valles por micro-gaps entre kicks
Subir desde zonas bajas: usa raw (instantáneo, ~50ms) — detecta spikes sin lag
2. Inyección en SeleneTitanConscious
@/electron-app/src/core/intelligence/SeleneTitanConscious.ts:1137



typescript
const energyContext = this.energyConsciousness.process(state.rawEnergy, {...})
El energyContext.zone se cachea en this.lastEnergyZone (línea 1381) y se inyecta en el context que alimenta a EffectDreamSimulator y DecisionMaker.

3. Filtrado de candidatos: EffectDreamSimulator.filterByZone()
@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:538-570

Filtra efectos por DNA aggression vs zona actual:



typescript
const aggressionLimits = {
  'silence': { min: 0, max: 0.30 },
  'valley':  { min: 0, max: 0.50 },
  'ambient': { min: 0, max: 0.65 },
  'gentle':  { min: 0, max: 0.80 },
  'active':  { min: 0, max: 0.85 },
  'intense': { min: 0.35, max: 1.00 },
  'peak':    { min: 0.70, max: 1.00 },
}
Un efecto con aggression = 0.9 (ej: Gatling) no puede dispararse en zona 'gentle' (max 0.80). Y un efecto con aggression = 0.2 (ej: DeepBreath) no aparece en zona 'peak' (min 0.70).

4. Protección de valles: EffectDreamSimulator.generateCandidates()
@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:646-651



typescript
if ((energyZone === 'valley' || energyZone === 'silence') && zScore < 0) {
  return [] // No generar candidatos — la música está muriendo
}
Doble gate: zona baja AND Z-Score negativo = cero candidatos. Pero notá: esto está en EffectDreamSimulator, NO en el Sovereign Clock. Por eso Abyssal Rise (zona INTENSE) pudo disparar con Z=-1.4 — el Sovereign Clock bypassa este filtro.

5. Oracle Vision (proyección de zona futura)
@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:685-703

Cuando Cassandra predice un drop_incoming, el DreamSimulator overridea la zona actual:



typescript
const projectedZone = isFutureHeavyEvent ? 'peak'
  : isFutureBuildup ? 'intense'
  : energyZone
Esto permite que efectos pesados (aggression > 0.85) sean candidatos antes de que el drop llegue, preparándose durante el buildup.

6. DecisionMaker: gating por zona
@/electron-app/src/core/intelligence/think/DecisionMaker.ts:272, 525

El energyContext.zone se usa en:

DIVINE STRIKE: log de zona para auditoría (zone=${energyContext?.zone})
DetermineDecisionType: la zona influye en si se aprueba un DIVINE vs un HEAVY vs un LIGHT
7. DynamicEffectRegistry: catálogo por zona
@/electron-app/src/core/arsenal/DynamicEffectRegistry.ts:305, 415

Cada efecto en el registry tiene energyZone: { min, max } (rango de zonas donde es elegible). El catálogo IPC expone energyZone.max (zona pico representativa) para UI y MIDI learn.

8. Theia atoms: matching por zona
@/electron-app/src/types/theiaTypes.ts:61-69, 106-107

Los átomos de video .theia declaran energyZone: { min, max } y el TheiaRegistry.findBestMatch() valida range.min ≤ currentZone ≤ range.max usando ENERGY_ZONE_ORDINAL (mapa numérico O(1)).

Por qué son fundamentales para el plan de rediseño
El problema central: La Energy Ladder clasifica exclusivamente por energía total raw (0-1). Es decir:

Un "drop hacia arriba" (graves ↓, agudos ↑↑) produce rawEnergy ≈ 0.35 → zona AMBIENT. El filtro filterByZone bloquea efectos de aggression > 0.65. Selene ve un momento de tensión vocal extrema como si fuera un momento suave.
Un chillido vocal con energía total moderada (0.55) → zona GENTLE. Solo efectos suaves son candidatos. El "shriek" es invisible.
La zona alimenta el phaseModifier indirectamente: ContextualMemory.inferNarrativePhase mapea sectionType → fase, y CognitiveFluidState multiplica epicness por phaseModifier. Si la zona dijera "valley" pero la sección dijera "drop", hay un conflicto no resuelto.
Para el rediseño (Estrato 1 y 3): La Energy Ladder necesita dejar de ser un simple umbral de rawEnergy y convertirse en un clasificador multi-espectral que reconozca:

Z_low cae + Z_high sube → tensión aguda (no valley)
Z_low sube + Z_mid estable → drop clásico (peak)
crestFactor alto + Z_high alto → pico vocal/sintético (intense/peak)
La ladder actual es la columna vertebral de todo el pipeline de selección de efectos. Rediseñarla cambia el input de filterByZone, DecisionMaker, TheiaRegistry, y el EffectDreamSimulator simultáneamente.