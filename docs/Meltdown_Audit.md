# WAVE 3468 — The Meltdown Hunt

## Auditoria Forense de Core Meltdown, Techno Heavy FX y Cassandra

Fecha: 2026-04-23
Repositorio: LuxSync
Alcance: rastreo de barreras lógicas que impiden o reducen el disparo de Core Meltdown y otros efectos hardcore del arsenal techno.

Archivos auditados principales:
- electron-app/src/core/effects/library/techno/CoreMeltdown.ts
- electron-app/src/core/effects/library/techno/IndustrialStrobe.ts
- electron-app/src/core/effects/library/techno/GatlingRaid.ts
- electron-app/src/core/effects/library/techno/NeonBlinder.ts
- electron-app/src/core/intelligence/think/DecisionMaker.ts
- electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts
- electron-app/src/core/intelligence/integration/DreamEngineIntegrator.ts
- electron-app/src/core/intelligence/conscience/VisualConscienceEngine.ts
- electron-app/src/core/intelligence/conscience/VisualEthicalValues.ts
- electron-app/src/core/intelligence/SeleneTitanConscious.ts
- electron-app/src/core/effects/ContextualEffectSelector.ts
- electron-app/src/core/effects/EffectManager.ts
- electron-app/src/core/mood/MoodController.ts
- electron-app/src/hal/physics/profiles/techno.ts

---

## 1. Dictamen Ejecutivo

### Veredicto corto
Core Meltdown no parece estar muerto por una sola barrera. Está encerrado detrás de un embudo de varias capas:

1. Solo entra en contexto peak/drop o divine real.
2. En buildup queda bloqueado de forma explícita en DNA, Fuzzy y Hunt.
3. En balanced tiene cooldown blando enorme y cooldown duro absoluto.
4. Aunque Dream/Cassandra lo vea, si detecta cooldown activo lo difiere.
5. Aunque la IA lo apruebe, EffectManager puede vetarlo por dictator lock, divine mutex o cooldown gate.

### Sospechoso principal para entorno real
El cuello de botella más fuerte no es PUNK ni el tribunal ético por sí solos. Son estas tres capas combinadas:

- cooldown oficial de ContextualEffectSelector para core_meltdown: 30000 ms base
- cooldown duro absoluto de dictador: 25000 ms
- multiplicador de mood en balanced: 1.8x

Eso deja a Core Meltdown, en balanced, con una ventana práctica de reutilización de 54000 ms, aunque la IA lo siga considerando “correcto”.

### Conclusión de negocio
Si el usuario está probando en entorno real y espera ver Core Meltdown con cierta frecuencia, el sistema actual está calibrado para que sea rarísimo. No está detrás de PUNK de forma binaria, pero PUNK sí reduce varios cerrojos a la vez y lo hace mucho más probable.

---

## 2. Autopsia de Core Meltdown

## 2.1 Definición del efecto
Core Meltdown está definido como un one-shot global de prioridad máxima.

Archivo: electron-app/src/core/effects/library/techno/CoreMeltdown.ts

Parámetros físicos reales:
- priority: 100
- mixBus: global
- isOneShot: true
- durationMs: 1200
- strobeRateHz: 14
- fadeInMs: 0
- fadeOutMs: 150
- intensidad máxima: 1.0
- comportamiento: alternancia binaria magenta nuclear y blanco, sobre todas las zonas

Comentario importante:
El encabezado del archivo dice “Peak/Epic only (E > 0.85, zScore > 3.0)”, pero ese comentario NO es la ley final del sistema. La ley real la decide DecisionMaker y el pipeline de Dream/EffectManager.

---

## 2.2 ADN y posicionamiento dentro del arsenal
Archivo: electron-app/src/core/intelligence/dna/EffectDNA.ts

DNA de core_meltdown:
- aggression: 1.00
- chaos: 0.75
- organicity: 0.00

Esto lo coloca como arma nuclear del espacio techno. En el sistema de heavy arsenal entra en el grupo que solo debería aparecer en:
- divine real
- drop confirmado

Además:
- aparece en DIVINE_ARSENAL de techno-club
- está en HEAVY_ARSENAL_EFFECTS
- está mapeado a zona peak en EffectManager y en el DreamSimulator queda dentro del rango peak por agresión

---

## 2.3 Condiciones exactas de trigger

### Capa 1: DecisionMaker
Archivo: electron-app/src/core/intelligence/think/DecisionMaker.ts

Core Meltdown pertenece al heavy arsenal y por diseño queda restringido a dos contextos válidos:

1. Divine Strike
Condiciones reales:
- zScore >= 4.0
- rawEnergy absoluta >= 0.72
- zona distinta de silence o valley
- no hay dictador activo

Notas:
- Antes el comentario histórico habla de gates más altos; en código actual el gate divino es 0.72 de rawEnergy.
- Si el zScore es enorme pero la energía real no pasa 0.72, no hay divine strike. Se hace fallthrough a prioridades musicales inferiores.

2. Drop confirmado
Si no hay divine, el heavy arsenal puede vivir en:
- section === drop
- o prepare_for_drop con prediction suficiente

### Capa 2: Buildup restriction total
DecisionMaker bloquea heavy arsenal en buildup en los tres caminos relevantes:
- DNA Priority 0
- Fuzzy strike
- Hunt worthiness

Esto está hecho expresamente para evitar que core_meltdown estalle antes del clímax.

Resultado práctico:
- si el tema está en buildup y el Dreamer propone core_meltdown, se bloquea
- si Fuzzy quiere strike y el arma cargada por DNA es core_meltdown, se bloquea
- si Hunt ve worthiness alta pero el arma cargada es core_meltdown, también se bloquea

### Capa 3: Breakdown protection
DecisionMaker devuelve hold en breakdown salvo caso divine previo.

Resultado:
Core Meltdown no debería entrar por breakdown normal. Si aparece una sensación de “nunca dispara”, parte del motivo es que buildup y breakdown están severamente blindados.

---

## 2.4 ¿Está bloqueado tras el modo punk?
Respuesta corta: no de forma absoluta.

Respuesta real:
- no existe una regla “solo en PUNK” para core_meltdown
- sí existe una arquitectura donde PUNK reduce casi todos los cerrojos relevantes

Archivo: electron-app/src/core/mood/MoodController.ts

Perfiles:
- calm:
  - core_meltdown está en blockList
  - thresholdMultiplier 2.5
  - cooldownMultiplier 4.0
  - ethicsThreshold 0.95
- balanced:
  - no está bloqueado
  - thresholdMultiplier 1.10
  - cooldownMultiplier 1.8
  - ethicsThreshold 1.20
- punk:
  - no está bloqueado
  - thresholdMultiplier 0.8
  - cooldownMultiplier 0.7
  - ethicsThreshold 0.75
  - minIntensity 0.5

Interpretación:
- en calm está directamente prohibido
- en balanced está permitido, pero caro
- en punk está permitido y además más fácil de aprobar, reusar y overridear

### ¿Cómo entra el sistema en PUNK?
No encontré transición automática a PUNK en la ruta auditada.

Ruta encontrada:
- MoodToggle en UI llama a MoodController.setMood()
- también notifica por IPC a backend
- TitanOrchestrator.setMood() aplica el mood en el singleton

Conclusión:
PUNK parece ser un cambio manual u orquestado por UI/IPC, no una mutación automática basada en audio en esta ruta auditada.

---

## 2.5 Bloqueos reales antes de llegar a luces

### Bloqueo A: Dream gate por worthiness
Archivo: electron-app/src/core/intelligence/integration/DreamEngineIntegrator.ts

El pipeline completo ni siquiera entra a soñar si el worthiness efectivo, después del modificador de mood, queda por debajo de 0.55.

Eso significa:
- raw worthiness mediocre en balanced puede morir antes de que el Dreamer proponga nada
- en punk ese mismo raw score sube más fácil al umbral

### Bloqueo B: filtro de zona y agresión en DreamSimulator
Archivo: electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts

Para peak:
- aggression permitida: 0.70 a 1.00
- core_meltdown entra

Pero además:
- si energyZone es valley o silence y zScore < 0, no se generan candidatos
- en breakdown, arriba en DecisionMaker, ya se bloqueó todo

### Bloqueo C: cooldown conflicts en Cassandra/Dream
DreamSimulator detecta cooldowns activos y:
- resta 0.15 al score del escenario por cada conflicto
- si el bestScenario tiene cooldownConflicts, recommendation pasa a modify en vez de execute

Eso no mata el efecto por nombre, pero sí lo saca del fast path de ejecución.

### Bloqueo D: cooldown oficial y hard minimum
Archivo: electron-app/src/core/effects/ContextualEffectSelector.ts

Core Meltdown tiene dos cooldowns simultáneos:
- EFFECT_COOLDOWNS: 30000 ms
- DICTATOR_HARD_MINIMUM_COOLDOWNS: 25000 ms

Con mood:
- calm: 30000 x 4.0 = 120000 ms
- balanced: 30000 x 1.8 = 54000 ms
- punk: 30000 x 0.7 = 21000 ms

Pero incluso el override DNA no puede saltarse el hard minimum absoluto de 25000 ms.

### Bloqueo E: global cooldown del cerebro
Archivo: electron-app/src/core/intelligence/SeleneTitanConscious.ts

Existe además:
- GLOBAL_EFFECT_COOLDOWN_MS = 7000

Esto no es específico de core_meltdown, pero añade otra pared temporal entre oportunidades.

### Bloqueo F: DNA override con temporal guard
Archivo: electron-app/src/core/intelligence/SeleneTitanConscious.ts

Aunque el ethicsScore sea alto, el override DNA solo puede saltar cooldown si:
- ethicsScore >= ethicsThreshold del mood actual
- no es efecto oceánico protegido
- se cumple temporal guard del override
- no viola hard cooldown absoluto

Guardas del override:
- 12000 ms entre overrides en general
- 20000 ms si repite el mismo efecto

Conclusión:
PUNK ayuda porque baja ethicsThreshold a 0.75, pero core_meltdown sigue encarcelado por el hard minimum de 25 s.

### Bloqueo G: EffectManager Gatekeeper
Archivo: electron-app/src/core/effects/EffectManager.ts

Antes del trigger real, EffectManager vuelve a consultar disponibilidad y puede bloquear por:
- cooldown gate
- global dictator lock
- zone mutex
- divine mutex peak/intense
- shield/vibe rules

Especialmente relevante:
- si hay otro dictador global activo, bloquea nuevos dictadores
- peak e intense son mutuamente excluyentes por divine mutex

Esto significa que aunque DecisionMaker lo elija, todavía puede morir al final del pipeline.

---

## 2.6 El Tribunal Ético: ¿veta sistemáticamente a Core Meltdown?

### Respuesta corta
No encontré una regla ética con nombre propio que diga “core_meltdown prohibido en techno”.

### Respuesta real
El tribunal lo puede hundir indirectamente por score compuesto.

Archivos:
- electron-app/src/core/intelligence/conscience/VisualConscienceEngine.ts
- electron-app/src/core/intelligence/conscience/VisualEthicalValues.ts

Veredicto de aprobación:
- aprobado solo si ethicalScore >= threshold y violations.length === 0
- threshold base: 0.5
- threshold en epilepsyMode: 0.7

Factores que lo penalizan de forma real:
- mood compliance: si calm, queda casi muerto por violación crítica
- fatigue_protection: si audienceFatigue alta y el efecto es intenso
- luminosity_budget: si la suma reciente de intensidades supera presupuesto por minuto
- intense_effect_rate_limit: si otro intenso ocurrió hace < 2000 ms
- epilepsy_protection: si el sistema está en epilepsy mode y el efecto se considera strobe

Importante:
Core Meltdown no aparece con veto específico de vibe techno en ética. El tribunal no parece el castrador principal. El castrador principal es temporal, no moral.

---

## 2.7 Sospecha descartada: bug histórico de “se ve en UI pero no llega a hardware”
Audité la ruta actual de salida y en el código presente TitanOrchestrator ya hace flushToDriver después del procesamiento global.

Conclusión:
no veo evidencia directa en esta auditoría de que el viejo bug de “efecto fantasma” siga siendo el bloqueo primario de Core Meltdown en el código actual auditado. El problema dominante hoy parece de selección/gating, no de flush tardío.

---

## 3. Auditoría de tiempos y flashes — arsenal techno principal

## 3.1 Core Meltdown
Archivo: electron-app/src/core/effects/library/techno/CoreMeltdown.ts

Parámetros:
- duración total: 1200 ms
- strobe: 14 Hz
- fade in: 0 ms
- fade out: 150 ms
- duty: alternancia binaria on/off por half-period calculado
- color: magenta y blanco alternando
- ámbito: todas las zonas
- mixBus: global

Dónde se modifica:
- hardcodeado en DEFAULT_CONFIG del propio archivo

---

## 3.2 Industrial Strobe
Archivo: electron-app/src/core/effects/library/techno/IndustrialStrobe.ts

Parámetros:
- flashCount: 4
- preDuckMs: 80
- firstFlashDurationMs: 60
- flashDurationMs: 40 para flashes 2-4
- gaps: 55 / 45 / 55 ms
- maxFrequencyHz: 10
- fadeOutMs: 100

Duración total efectiva:
- 80 + 60 + 40 + 40 + 40 + 55 + 45 + 55 = 415 ms

Cadencia:
- ráfaga corta con cuatro golpes irregulares
- pensado como martillo de drop / impacto industrial

Dónde se modifica:
- hardcodeado en DEFAULT_CONFIG del archivo

---

## 3.3 Gatling Raid
Archivo: electron-app/src/core/effects/library/techno/GatlingRaid.ts

Parámetros:
- bulletCount: 6
- bulletDurationMs: 30
- bulletGapMs: 35
- sweepCount: 3
- pattern default: linear
- fadeOutMs: 200

Duración total efectiva:
- 6 x (30 + 35) x 3 = 1170 ms

Cadencia:
- 1 bala cada 65 ms
- 18 disparos visibles en total si no hay frame starvation

Dónde se modifica:
- hardcodeado en DEFAULT_CONFIG del archivo

Gate extra relevante:
- DreamSimulator exige para gatling_raid intensidad >= 0.65 y zScore >= 0.8
- eso lo hace más frecuente que core_meltdown, pero no libre

---

## 3.4 Neon Blinder
Archivo: electron-app/src/core/effects/library/techno/NeonBlinder.ts

Parámetros:
- duración total: 1000 ms
- strobePhaseMs: 175
- strobeHz: 22
- attackMs: 50

Cadencia:
- fase 1: latigazo de estrobo a 22 Hz durante 175 ms
- fase 2: melt exponencial de color hasta completar 1000 ms

Dónde se modifica:
- hardcodeado en DEFAULT_CONFIG del archivo

---

## 3.5 ¿Viven estos tiempos en techno.ts?
Respuesta: no, no los gordos.

Archivo: electron-app/src/hal/physics/profiles/techno.ts

Ese archivo gobierna la física reactiva techno y contiene, entre otras, estas variables:
- strobeThreshold: 0.80
- strobeDuration: 30
- strobeNoiseDiscount: 0.80

Pero esas no son la duración del Core Meltdown ni del Industrial Strobe one-shot. Los heavy FX viven con sus parámetros en cada archivo de efecto, no en techno.ts.

Conclusión:
- heavy FX techno: tiempos hardcodeados por efecto
- techno.ts: perfil de física reactiva, no repositorio central de duraciones de one-shot techno

---

## 4. Cassandra — ¿ve los drops y los descarta?

## 4.1 Qué es Cassandra en este código
No existe un archivo Cassandra.ts.

Cassandra es el subsistema de pre-buffer dentro de:
- EffectDreamSimulator
- SeleneTitanConscious
- DreamEngineIntegrator

Función:
- anticipar eventos de Oracle/PredictionEngine
- guardar un efecto “sellado” antes del drop
- liberarlo por fast path cuando el evento ya está muy cerca

---

## 4.2 Reglas de pre-buffer
Archivo: electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts

Para guardar un pre-buffer:
- oracleProbability >= 0.65
- timeToEvent >= 2000 ms
- no existir preBuffer previo

Expiración del buffer:
- 5000 ms

Fast path:
- si timeToEvent < 1500 ms
- y isUrgent = true
- usa el efecto pre-bufferizado

Blindaje anti-disparo prematuro:
- si acaba de bufferizar un efecto, recommendation baja de execute a modify
- evita que un core_meltdown almacenado para un drop en 3.9 s se dispare en pleno buildup

Conclusión:
Cassandra sí ve el drop y sí intenta reservar el arma para más tarde. Ese sistema no parece el culpable principal de prematurez hoy; de hecho está parcheado para diferir.

---

## 4.3 Cómo Cassandra puede descartar o degradar el heavy FX
Sí, puede.

Mecanismos:

1. cooldownConflicts
Si el efecto está en activeCooldowns:
- detectCooldownConflicts lo marca
- el ranking resta 0.15 por conflicto
- generateRecommendation devuelve modify en vez de execute

2. ranking multi-factor
El score final incluye:
- projectedRelevance
- diversityScore
- vibeCoherence
- riesgo
- simulationConfidence
- explorationBoost
- penalizaciones por cooldownConflicts y hardwareConflicts

3. relevance mínima
Si el bestScenario tiene projectedRelevance < 0.30, también cae a modify

Conclusión:
Sí: Cassandra puede ver el drop y aun así no soltar Core Meltdown si el escenario llega con cooldown activo o relevancia insuficiente.

---

## 5. Cuellos de botella lógicos ordenados por severidad

## 5.1 Bottleneck 1 — Cooldown práctico excesivo en balanced
Severidad: crítica

Core Meltdown:
- base cooldown: 30000 ms
- balanced multiplier: 1.8x
- cooldown efectivo: 54000 ms
- hard minimum absoluto: 25000 ms

Esto, por sí solo, ya lo convierte en arma rarísima.

## 5.2 Bottleneck 2 — Heavy arsenal restriction en buildup
Severidad: crítica

Si el usuario prueba mucho en pre-drop, buildup o transiciones largas, Core Meltdown nunca debería salir. Está bloqueado a propósito en DNA, Fuzzy y Hunt.

## 5.3 Bottleneck 3 — Global/Divine mutex de EffectManager
Severidad: alta

Si ya hay un peak o intense activo, otro hard effect no entra.
Eso crea competencia directa entre:
- industrial_strobe
- gatling_raid
- core_meltdown
- neon_blinder
- abyssal_rise
- sky_saw
- surgical_strike

## 5.4 Bottleneck 4 — Dream/Oracle ve el momento, pero cooldown lo convierte en modify
Severidad: alta

Cassandra no ignora cooldown. Si ve que el arma está ocupada, la recomendación deja de ser execute.

## 5.5 Bottleneck 5 — Mood como multiplicador de accesibilidad
Severidad: alta

No bloquea en balanced, pero:
- hace más difícil pasar thresholds que en punk
- alarga cooldown a 1.8x
- exige ethicsThreshold 1.20 para override DNA

## 5.6 Bottleneck 6 — Tribunal ético situacional
Severidad: media

No parece el verdugo principal de Core Meltdown en techno normal, pero sí lo puede hundir cuando:
- hay audienceFatigue alta
- hay epilepsyMode
- el presupuesto de luminosidad ya está alto
- acaba de dispararse otro intenso muy reciente

---

## 6. Respuesta directa a la sospecha del usuario

### ¿Está el Meltdown vetado por lógica interna?
Sí, pero no por una sola línea. Está vetado por diseño narrativo y temporal:
- no en buildup
- no en breakdown
- no seguido de otro peak/intense
- no si sigue en cooldown
- no si el mood no ayuda
- no si la ética lo deja borderline o rechazado

### ¿Está “detrás de PUNK”?
No en sentido literal.
Sí en sentido práctico.

PUNK hace tres cosas que liberan a la bestia:
- baja thresholdMultiplier
- baja cooldownMultiplier
- baja ethicsThreshold para override DNA

### ¿Cassandra lo está viendo y descartando?
Sí puede ocurrir.
No porque Cassandra “odie” Core Meltdown, sino porque:
- lo pre-bufferiza para más tarde
- lo degrada a modify si ve cooldownConflicts
- nunca le permite saltarse hard minimum por sí sola

---

## 7. Conclusión final

Core Meltdown está vivo en el código, bien definido y aún considerado parte del arsenal APEX de techno.

Pero en runtime real está sometido a demasiadas capas de contención simultánea:
- divine/drop-only en la práctica
- buildup wall total
- cooldown blando enorme en balanced
- hard minimum absoluto de dictador
- global cooldown del cerebro
- divine mutex de peak/intense
- downgrade de Cassandra por cooldown conflict
- ética situacional

Si el síntoma de campo es “casi nunca dispara”, el sistema actual confirma que ese comportamiento es coherente con la arquitectura.

Si el síntoma exacto es “otros hard FX sí salen pero Core Meltdown no”, entonces el principal sospechoso no es el tribunal ético sino la suma de:
- cooldown de 54 s en balanced
- hard minimum de 25 s
- bloqueo en buildup
- competencia contra industrial_strobe, neon_blinder y gatling_raid dentro del mismo territorio peak

---

## 8. Variables a tocar en una futura cirugía
No se ha modificado código en esta auditoría. Solo se señalan los diales.

Para hacer visible Core Meltdown en una futura intervención, los puntos clave están en:
- electron-app/src/core/effects/library/techno/CoreMeltdown.ts
- electron-app/src/core/effects/ContextualEffectSelector.ts
- electron-app/src/core/mood/MoodController.ts
- electron-app/src/core/intelligence/think/DecisionMaker.ts
- electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts
- electron-app/src/core/effects/EffectManager.ts

Prioridad probable de cirugía futura:
1. bajar cooldown efectivo de core_meltdown en balanced
2. revisar competencia peak entre core_meltdown, neon_blinder, industrial_strobe y gatling_raid
3. revisar si la ventana drop-confirmed llega demasiado tarde respecto al global cooldown
4. revisar si Cassandra debería considerar mejor el “arma reservada” frente a candidatos menos brutales
