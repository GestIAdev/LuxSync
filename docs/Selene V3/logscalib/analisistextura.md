engo el panorama completo. Hay dos problemas distintos:

Problema 1: Doble guardado
Cómo funciona:

Boot carga builtins desde src/core/arsenal/builtins/ → source: 'builtin'
Luego carga userData/arsenal/ → source: 'user'
El registry sobrescribe por ID: userdata gana en runtime
Pero HephFileIO.saveClip() (@/electron-app/src/core/hephaestus/HephFileIO.ts:190) solo escribe a userData/arsenal/
El builtin del repo nunca se actualiza
Resultado: Tu edición local funciona en runtime, pero el archivo del repo sigue stale. Si borras userdata o empaquetas, resucita el builtin viejo.

Problema 2: isDivineCandidate / isHeavyCandidate no editables desde la UI
El DnaRail (@DnaRail.tsx) tiene 5 archetypes visibles (strobe, ambient, heavy, divine, utility), pero:

onSimMetaChange está en las props pero NUNCA se desestructura ni se llama (línea 217-221)
isDivineCandidate y isHeavyCandidate viven en simulationMeta, no en cognitiveDNA
El archetype visual solo afecta los bias de sliders ACO y zonas energéticas
No hay ningún UI para editar simulationMeta
Por eso Solar Flare disparó como divino: el .lfx del repo tiene isDivineCandidate: true hardcoded (línea 169) y no puedes cambiarlo desde la UI.

Divine/Heavy Arsenal — No editable desde la UI
Causa raíz: DnaRail.tsx recibe simMeta y onSimMetaChange como props pero nunca las usa.

@/electron-app/src/components/views/HephaestusView/dna/DnaRail.tsx:217-221:



tsx
export const DnaRail: React.FC<DnaRailProps> = ({
  dna,
  onDnaChange,
  onEnableDna,
}) => {
Faltan simMeta y onSimMetaChange en la desestructuración. El LabTab.tsx las pasa (líneas 320-322), pero DnaRail las ignora completamente.

Consecuencia: No hay ningún UI para editar:

isDivineCandidate
isHeavyCandidate
isStrobe
cooldownMs
fatigueImpact
zScoreGuards (minimumZ, minimumEnergy, requireRising)
gpuCost
beautyWeights
Los 5 botones de archetype (strobe/ambient/heavy/divine/utility) solo afectan:

Los bias de sliders ACO (rangos min/max)
Las zonas energéticas permitidas
NO escriben isDivineCandidate ni isHeavyCandidate en simulationMeta
Por eso Solar Flare disparó como divino: el .lfx del repo tenía isDivineCandidate: true hardcoded y no podías cambiarlo desde la UI. Ahora lo he puesto a false.

-----------------------
--------------------------

Fix #2: Anti-monopoly con zonas adyacentes ✅
Cambio en @/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:604-637

Antes: Si el pool de zona active tenía < 4 efectos, se añadían todos los efectos restantes sin importar su zona. Amazon Mist (aggression 0.12, zona silence) entraba en el pool de active.

Ahora: La expansión solo trae efectos cuya aggression cae en zonas ±1 adyacentes:

active (0.35-0.80) → solo puede traer de gentle (0-0.85) o intense (0.60-1.00)
silence (0-0.35) → solo puede traer de valley (0-0.50)
peak (0.70-1.00) → solo puede traer de intense (0.60-1.00)
Amazon Mist (0.12 → zona silence) ya no puede entrar en active. Ghost Breath (0.10 → zona silence) tampoco.

Sobre isStrobe
isStrobe no es un modificador de curvas. Es un flag de metadata que usa el Dream Simulator para 3 cosas:

Strobe Guard (zScore): Si isStrobe=true y el zScore ≤ 0 (energía descendiendo), el efecto se descarta. Los strobes solo deben disparar cuando la energía está subiendo.
@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:880-885
Safety Declaration automática: HephFileIO lo usa para inferir containsRapidFlash: true si el autor no declaró safety manualmente.
@/electron-app/src/core/hephaestus/HephFileIO.ts:167-168
High Severity Classification: isHighSeverityEffect() lo consulta junto con isHeavyCandidate e isDivineCandidate para determinar si un efecto es de alta severidad (afecta refractory lock).
@/electron-app/src/core/intelligence/SeleneTitanConscious.ts:136
En resumen: Tú decides el strobe con las curvas (track strobe), pero isStrobe le dice al simulador que trate el efecto con guards especiales (no disparar en energía descendente, declarar safety automática, contar como alta severidad).

Sobre organicity y chaos en el Dream Simulator
Sí se usan los 3 alelos. El Dream Simulator no solo evalúa con aggression. El flujo es:

filterByZone — filtra por aggression únicamente (es un filtro rápido de pre-selección, no un scoring)
calculateRelevance (líneas 1229-1243) — calcula la distancia euclidiana 3D en el espacio (aggression, chaos, organicity) entre el efecto y un Target DNA derivado del contexto musical:


dA = effDna.aggression - targetDNA.aggression
dC = effDna.chaos    - targetDNA.chaos
dO = effDna.organicity - targetDNA.organicity
distance = √(dA² + dC² + dO²)
relevance = 1 - (distance / √3)
Ranking final (línea 1558) — la fórmula es:


score = relevance × 0.35    // 🧬 DNA (usa los 3 alelos)
      + diversity × 0.20    // 🎲 variedad
      + vibeCoherence × 0.15
      + (1 - risk) × 0.13
      + ...
El problema de percepción: filterByZone es lo que decide qué efectos entran al pool. Ese filtro solo usa aggression. Si un efecto no pasa el filtro de aggression, nunca llega al scoring 3D. Por eso parece que solo importa aggression — es la puerta de entrada. Una vez dentro, los 3 alelos determinan el ranking.

Qué hace cada alelo en el Target DNA:

Aggression: target derivado de la energía actual
Chaos: target derivado de harshness/flatness espectral (música sucia → más chaos)
Organicity: target derivado de groove/melodicity (música orgánica → más organicity)
El efecto cuya "personalidad genética" (A, C, O) esté más cerca del "ADN musical del momento" gana el ranking.