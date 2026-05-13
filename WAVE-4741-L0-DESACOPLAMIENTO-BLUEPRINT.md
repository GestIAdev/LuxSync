# WAVE 4741 — BLUEPRINT ARQUITECTÓNICO: L0 DESACOPLAMIENTO TOTAL

> **Estado:** DISEÑO — No implementar hasta aprobación de Radwulf  
> **Fecha de diseño:** Mayo 2026  
> **Autor:** PunkOpus  
> **Motivación:** El motor L0 actual es una momia. Ballyhoo tarda 10 segundos  
> en dar una vuelta. La conga es un funeral. El problema NO es de valores numéricos  
> — es de arquitectura fundamental. Duración y velocidad están soldadas al mismo parámetro.

---

## 1. DIAGNÓSTICO FORENSE

### 1.1 El Crimen Original

```typescript
// CÓDIGO ACTUAL — el nudo gordiano
const phasePerBeat = (2 * Math.PI) / PATTERN_PERIOD  // radianes por beat
const phaseDelta = beatsPerSecond * frameDt * phasePerBeat * globalSpeedMultiplier
```

`PATTERN_PERIOD` es UN número que hace DOS cosas incompatibles:

| Responsabilidad | Lo que ocurre con PATTERN_PERIOD |
|---|---|
| **Velocidad del foco** | `phaseDelta = 2π / PATTERN_PERIOD` por beat |
| **Duración en escena** | `selectPattern` rota cada 8 compases FIJOS — ignora el período |

Sin embargo, el **Gearbox** (el control de amplitud por hardware) SÍ usa `patternPeriod`:
```typescript
const maxTravelPerCycle = HARDWARE_MAX_SPEED * secondsPerBeat * patternPeriod
```

Resultado: subir el período para que el foco dure más → el foco se mueve más despacio  
→ el gearbox le da más presupuesto de viaje → amplitud alta → pero velocidad de tortuga.  
Un loop de compensaciones imposible de sintonizar.

### 1.2 El Crimen Secundario: Transiciones de Pared

```typescript
private readonly TRANSITION_DURATION_MS = 2000  // 2 segundos
```

A 90 BPM: 2s = 3 beats de LERP → el foco llega al nuevo por patrón sin ritmo  
A 140 BPM: 2s = 4.67 beats → dos compases perdidos haciendo nada musical  
El LERP empieza en el instante en que el IA cambia de patrón — **sin importar dónde está el foco**.  
Resultado: si el foco estaba en el lado opuesto, lanza un latigazo de 2 segundos.

### 1.3 El Crimen Terciario: Scheduler Sordo

```typescript
const phrase = Math.floor(this.barCount / 8)  // rota cada 8 compases
const patternIndex = phrase % patterns.length
```

El scheduler cambia de patrón cada 8 compases fijos independientemente de:
- Si el patrón ha completado un número musical de ciclos
- Si el foco está en una posición cómoda para transicionar
- Si el BPM ha cambiado

---

## 2. LA SOLUCIÓN: TRES PARÁMETROS EN LUGAR DE UNO

El estándar profesional (GrandMA2/3, Avolites) separa tres conceptos:

```
PATTERN_PERIOD (actual, acoplado)
       ↓ se divide en:
cycleBeats     → velocidad del patrón (cuántos beats por revolución)
phraseDuration → tiempo en escena (cuántos beats antes de ser elegible para cambio)
safeHarbor     → posición segura de transición (en qué fase cambiar sin latigazo)
```

Regla de oro: `phraseDuration = N × cycleBeats` donde N ∈ {1, 2, 3, 4}  
(siempre un múltiplo entero → las transiciones caen en puntos musicales naturales)

---

## 3. NUEVA ESTRUCTURA DE DATOS

### 3.1 `PatternConfig` — El Reemplazo de `PATTERN_PERIOD`

```typescript
interface PatternConfig {
  // ─── VELOCIDAD ────────────────────────────────────────────────────────
  // Cuántos beats para completar UN ciclo completo de la función de patrón.
  // phasePerBeat = 2π / cycleBeats
  // Ejemplo: cycleBeats=8 a 120 BPM → 4 segundos/vuelta → 0.25 Hz
  cycleBeats: number

  // ─── DURACIÓN EN ESCENA ───────────────────────────────────────────────
  // Cuántos beats ocupa este patrón en el stage antes de que el scheduler
  // pueda proponer un cambio. INDEPENDIENTE de cycleBeats.
  // Siempre debe ser: phraseDuration = multiplier × cycleBeats
  // Ejemplo: cycleBeats=8, phraseDuration=16 → 2 ciclos completos por frase
  phraseDuration: number

  // ─── TRANSICIÓN SEGURA ────────────────────────────────────────────────
  // Fase (en radianes, 0..2π) donde el foco está cerca del centro/ancla.
  // El scheduler ESPERA a que la fase esté cerca de este punto antes de
  // iniciar el LERP de transición.
  // Ejemplo: 0 = inicio del patrón (típicamente cerca del centro)
  safeHarborPhase: number    // radianes

  // Tolerancia angular alrededor del safeHarbor (± radianes).
  // Ventana más grande = transiciones más frecuentes pero menos precisas.
  safeHarborWindow: number   // radianes

  // Si el scheduler lleva más de (phraseDuration + hardDeadlineExtra) 
  // beats esperando el safe harbor, fuerza la transición igualmente.
  // Previene que un patrón se quede atascado esperando un punto que tarda.
  hardDeadlineExtra: number  // beats adicionales de gracia

  // ─── TRANSICIÓN (LERP) ────────────────────────────────────────────────
  // Duración del lerp de transición en BEATS (no milisegundos).
  // A 120 BPM: 1 beat = 0.5s. A 90 BPM: 1 beat = 0.67s.
  // Beat-synced: se siente musical en cualquier tempo.
  transitionBeats: number
}
```

### 3.2 `SchedulerState` — El Reemplazo del barCount + isTransitioning

```typescript
interface SchedulerState {
  // Patrón activo en este momento
  currentPattern: GoldenPattern

  // Acumulador de fase (idéntico al phaseAccumulator actual, sin cambios)
  phase: number              // 0..∞ monotónico

  // Beats transcurridos desde que empezó la frase actual
  // (se resetea cada vez que un nuevo patrón gana el stage)
  sceneBeatsElapsed: number

  // Si hay una transición en marcha, este objeto existe
  transition: {
    incomingPattern: GoldenPattern
    incomingPhase: number    // fase del patrón entrante (empieza en safeHarborPhase del entrante)
    progress: number         // 0..1 (avanza a ritmo de 1/transitionBeats por beat)
  } | null
}
```

---

## 4. TABLA DE VALORES — Los Nuevos Parámetros

### Regla de lectura musical:
- **cycleBeats=4** → 1 revolución cada compás (techno energético)
- **cycleBeats=8** → 1 revolución cada 2 compases (fluido, profesional)  
- **cycleBeats=16** → 1 revolución cada 4 compases (majestuoso, nobles)

### 4.1 TECHNO — Geometría Industrial Agresiva

| Patrón | cycleBeats | phraseDuration | N | safeHarbor | transitionBeats |
|--------|-----------|----------------|---|------------|-----------------|
| scan_x | 4 | 16 | ×4 | 0 (centro) | 1 |
| square | 4 | 16 | ×4 | 0 (vértice inicial) | 1 |
| diamond | 4 | 16 | ×4 | 0 | 1 |
| botstep | 2 | 8 | ×4 | 0 | 0.5 |
| darkspin | 6 | 12 | ×2 | 0 | 1 |

> **Nota techno:** `cycleBeats=4` a 128 BPM = 1.875s/vuelta = 0.533 Hz.  
> Dentro del rango permitido (0.02–0.60 Hz). **Enérgico, no epiléptico.**  
> `phraseDuration=16` da 4 ciclos en escena → el foco hace 4 sweeps/diamonds  
> antes de que el scheduler considere un cambio. **Consistencia de patrón real.**

### 4.2 LATINO — Sensual, Cadencia Verdadera

| Patrón | cycleBeats | phraseDuration | N | safeHarborPhase | transitionBeats |
|--------|-----------|----------------|---|-----------------|-----------------|
| figure8 | 8 | 16 | ×2 | 0 (cruce central del 8) | 1.5 |
| wave_y | 6 | 12 | ×2 | 0 (cima de la ola) | 1 |
| ballyhoo | 8 | 16 | ×2 | 0 (pico de radio máximo) | 2 |
| cadera_libre | 10 | 20 | ×2 | 0 (Lissajous 3:2 cruce) | 2 |
| espiral_conga | 8 | 24 | ×3 | 0 (fase inicial espiral) | 1.5 |

> **Nota latino:** `cycleBeats=8` a 100 BPM = 4.8s/vuelta = 0.208 Hz.  
> Ballyhoo da **2 vueltas completas** en 16 beats. A 100 BPM son 9.6 segundos  
> de presencia → fluido, musical, no momificado.  
> `espiral_conga × 3`: 3 congas por frase de 24 beats. **ESO es una conga.**

### 4.3 POP-ROCK — Estadio (Implementación mínima)

| Patrón | cycleBeats | phraseDuration | N | safeHarborPhase | transitionBeats |
|--------|-----------|----------------|---|-----------------|-----------------|
| circle_big | 8 | 16 | ×2 | 0 | 1.5 |
| cancan | 4 | 8 | ×2 | π (fondo del cancan) | 1 |
| dual_sweep | 8 | 16 | ×2 | 0 | 1.5 |

### 4.4 CHILL — Geología (Para reconstruir en otra wave)

| Patrón | cycleBeats | phraseDuration | N | safeHarborPhase | transitionBeats |
|--------|-----------|----------------|---|-----------------|-----------------|
| drift | 64 | 128 | ×2 | 0 | 4 |
| sway | 32 | 64 | ×2 | 0 | 3 |
| breath | 24 | 48 | ×2 | 0 | 3 |

### 4.5 THE FOUR NOBLES — Universales

| Patrón | cycleBeats | phraseDuration | N | safeHarborPhase | transitionBeats |
|--------|-----------|----------------|---|-----------------|-----------------|
| slow_pan | 16 | 32 | ×2 | 0 (centro del pan) | 2 |
| tilt_nod | 8 | 16 | ×2 | 0 (posición neutra tilt) | 1.5 |
| figure_of_4 | 8 | 16 | ×2 | 0 | 1.5 |
| chase_position | 4 | 8 | ×2 | 0 | 1 |

---

## 5. ALGORITMO DEL NUEVO TICK

La lógica central del motor L0 refactorizado, en pseudocódigo legible:

```
CADA FRAME (frameDt segundos, BPM actual):

  beatsThisFrame = (BPM/60) × frameDt × globalSpeedMultiplier

  ── A: AVANZAR FASE ──────────────────────────────────────────────────
  cfg = PATTERN_CONFIG[state.currentPattern]
  phaseDelta = (2π / cfg.cycleBeats) × beatsThisFrame
  state.phase += phaseDelta
  state.sceneBeatsElapsed += beatsThisFrame

  ── B: AVANZAR TRANSICIÓN (si existe) ────────────────────────────────
  if state.transition != null:
    inCfg = PATTERN_CONFIG[state.transition.incomingPattern]
    inPhaseDelta = (2π / inCfg.cycleBeats) × beatsThisFrame
    state.transition.incomingPhase += inPhaseDelta
    state.transition.progress += beatsThisFrame / inCfg.transitionBeats
    
    if state.transition.progress >= 1.0:
      // Promover entrante → activo
      state.currentPattern = state.transition.incomingPattern
      state.phase = state.transition.incomingPhase
      state.sceneBeatsElapsed = 0
      state.transition = null

  ── C: CALCULAR POSICIÓN ─────────────────────────────────────────────
  if state.transition != null:
    posA = PATTERNS[state.currentPattern](state.phase, audio)
    posB = PATTERNS[state.transition.incomingPattern](state.transition.incomingPhase, audio)
    t = easeInOut(state.transition.progress)   // smoothstep(t)
    pos = lerp(posA, posB, t)
  else:
    pos = PATTERNS[state.currentPattern](state.phase, audio)

  ── D: CHECKEar si hay que iniciar TRANSICIÓN ────────────────────────
  if state.transition == null:
    phraseExpired = state.sceneBeatsElapsed >= cfg.phraseDuration
    hardDeadline  = state.sceneBeatsElapsed >= cfg.phraseDuration + cfg.hardDeadlineExtra
    
    if phraseExpired OR hardDeadline:
      // Comprobar safe harbor
      normalizedPhase = state.phase mod (2π)
      distFromHarbor = |normalizedPhase - cfg.safeHarborPhase|
      inHarbor = distFromHarbor < cfg.safeHarborWindow
      
      if inHarbor OR hardDeadline:
        nextPattern = electNextPattern(vibeConfig)    // rotación musical (ver §6)
        inCfg = PATTERN_CONFIG[nextPattern]
        state.transition = {
          incomingPattern: nextPattern,
          incomingPhase:   inCfg.safeHarborPhase,    // ← EMPIEZA EN PUNTO CONOCIDO
          progress:        0.0,
        }
        state.sceneBeatsElapsed = 0   // resetear contador de frase

  return pos
```

---

## 6. EL SCHEDULER MUSICAL

### El Problema Actual

```typescript
// ACTUAL: blind rotation cada 8 compases fijos
const phrase = Math.floor(this.barCount / 8)
const patternIndex = phrase % patterns.length
```

Esto ignora si el patrón actual ha completado su `phraseDuration` y genera cambios  
en tiempos arbitrarios respeto al patrón en ejecución.

### La Solución: Rotación Beat-Aware

El scheduler del nuevo motor NO decide en base a wall-clock ni barCount fijo.  
Decide en base a `sceneBeatsElapsed >= phraseDuration` (fase D del algoritmo anterior).

Selección del patrón entrante — dos estrategías posibles:

**Estrategia A (simple, recomendada para implementación):**
```
electNextPattern:
  patternQueue = vibeConfig.patterns (lista circular)
  return patternQueue[(currentIndex + 1) % patternQueue.length]
```
→ rotación determinista y musical. Un ciclo completo de 5 patrones latinos = 5 frases.

**Estrategia B (avanzada, para una wave futura):**
```
electNextPattern:
  // Selección afectiva: el siguiente patrón depende de la energía del audio
  if audio.energy > 0.7 → preferir patrones de alta frecuencia (scan_x, botstep)
  if audio.energy < 0.3 → preferir patrones suaves (sway, breath)
  else → rotación estándar
```
→ La IA "elije" el patrón más apropiado para la energía del momento.  
**No para ahora. Anotar para WAVE 4750.**

---

## 7. GEARBOX REFACTORIZADO

### El Problema

```typescript
// ACTUAL: usa patternPeriod (era válido cuando period = velocidad)
const maxTravelPerCycle = HARDWARE_MAX_SPEED * secondsPerBeat * patternPeriod
```

### La Solución

```typescript
// NUEVO: usa cycleBeats (la velocidad real del ciclo)
const maxTravelPerCycle = HARDWARE_MAX_SPEED * secondsPerBeat * patternConfig.cycleBeats
```

El gearbox pregunta: *"¿Puede este hardware físicamente ejecutar esta amplitude  
a esta velocidad de ciclo?"* — que es la pregunta correcta.

> **Invariante preservado:** El gearbox sigue siendo el guardián del hardware.  
> Si `cycleBeats=4` a 140 BPM → 1.71s/ciclo → el gearbox reduce amplitud si el  
> hardware no puede hacer el viaje en ese tiempo. La física no cambia.

---

## 8. ELIMINACIÓN DE `TRANSITION_DURATION_MS`

```typescript
// ELIMINAR ESTO:
private readonly TRANSITION_DURATION_MS = 2000  // semáforo de pared ❌
private isTransitioning: boolean = false
private transitionStartTime: number = 0
```

### Por qué 2000ms es el problema

| BPM | 2000ms en beats | Comentario |
|-----|-----------------|------------|
| 90 | 3.0 beats | 3/4 de compás "perdidos" en LERP |
| 120 | 4.0 beats | 1 compás entero de LERP |
| 140 | 4.67 beats | >1 compás en LERP visual |

### El reemplazo: `transitionBeats` beat-synced

```typescript
// NUEVO: progreso de transición avanza a ritmo de beats
// progress += beatsThisFrame / cfg.transitionBeats
// El LERP dura siempre la misma cantidad MUSICAL independiente del BPM.
```

| Patrón | transitionBeats | A 120 BPM | A 90 BPM |
|--------|-----------------|-----------|----------|
| scan_x | 1 beat | 0.5s | 0.67s |
| ballyhoo | 2 beats | 1.0s | 1.33s |
| cadera_libre | 2 beats | 1.0s | 1.33s |

> El LERP de ballyhoo dura exactamente 2 beats en cualquier tempo.  
> A 90 BPM un beat de salsa se siente majestuoso. A 120 BPM un beat de house  
> se siente como un corte limpio. **Eso es musicalidad programada.**

---

## 9. EL SAFE HARBOR — Cirugía Anti-Latigazo

### Por qué el latigazo ocurre

Actualmente el LERP empieza desde `lastPosition` (posición arbitraria)  
hacia `position` (posición actual del nuevo patrón en fase acumulada).

El problema: si el foco estaba en pan=-0.8 y el nuevo patrón en t=0 vale pan=+0.7,  
el LERP tiene que cruzar TODO el escenario en 2 segundos. **Latigazo visual.**

### La solución en dos partes

**Parte 1: El entrante EMPIEZA en su safeHarborPhase**

```typescript
state.transition = {
  incomingPattern: nextPattern,
  incomingPhase: PATTERN_CONFIG[nextPattern].safeHarborPhase,  // ← no 0, no la fase acumulada
  progress: 0.0,
}
```

El safeHarborPhase de la mayoría de patrones es 0 (inicio del patrón).  
A fase=0 la mayoría de funciones retornan x=0, y∈[pequeño, cómodo].  
→ el LERP siempre va hacia un punto conocido y predecible.

**Parte 2: El saliente ESPERA a su safeHarborPhase**

```typescript
// Solo iniciar transición cuando el patrón actual esté cerca de su harbor
const normalizedPhase = state.phase % TWO_PI
const dist = Math.abs(normalizedPhase - cfg.safeHarborPhase)
const inHarbor = dist < cfg.safeHarborWindow  // e.g. window = 0.4 rad ≈ 23°

if (inHarbor || hardDeadline) {
  // AHORA sí: el foco está en una posición predecible para despegar
  startTransition(nextPattern)
}
```

> **Resultado:** El foco termina el sweep actual, llega al punto más cómodo,  
> y desde ahí va suavemente al inicio del nuevo patrón. Coste visual: casi cero.

### Valores de safeHarbor por tipo de patrón

| Tipo de patrón | safeHarborPhase | Razonamiento |
|----------------|-----------------|--------------|
| Oscilatorios (scan_x, wave_y) | `0` | En fase=0 x≈0, posición central |
| Orbitales (circle, eight) | `0` | En fase=0 el foco está en el "norte" del orbit |
| Ballyhoo (polar) | `0` | Radio máximo, posición definida |
| Espiral_conga | `0` | Inicio de hélice, posición coherente |
| Botstep | `π` | En π el foco está en la segunda posición estable |

---

## 10. IMPACTO SOBRE EL CÓDIGO EXISTENTE

### Cambios mínimos necesarios (solo VMM — nada más)

| Componente | Cambio |
|---|---|
| `PATTERN_PERIOD` | Reemplazar por `PATTERN_CONFIG: Record<GoldenPattern, PatternConfig>` |
| `phaseAccumulator` | Sin cambio — sigue siendo el acumulador monotónico |
| `barCount / 8` en `selectPattern` | Reemplazar por check de `sceneBeatsElapsed >= phraseDuration` |
| `TRANSITION_DURATION_MS` / `isTransitioning` | Reemplazar por el objeto `transition` en SchedulerState |
| `transitionStartTime` | Eliminar — ya no se usa tiempo de pared |
| Gearbox `calculateEffectiveAmplitude` | `patternPeriod` → `patternConfig.cycleBeats` |
| **Nada más** | L2, FixturePhysicsDriver, IPC, presets → intactos |

### Lo que NO cambia

- Las funciones de patrón (`PATTERNS` dict) — sin tocar.
- El `phaseAccumulator` — sigue siendo monotónico, sin teleportaciones.
- El `globalSpeedMultiplier` — sigue existiendo como multiplicador sobre `cycleBeats`.
- El `manualSpeedFactor` — potencia de dos desde slider, igual que hoy.
- El `chillSedationFactor` — sigue viviendo para `chill-lounge`.
- Los offsets de stereo/snake (`phaseOffset`) — sin cambio.
- La lógica de `homeOnSilence` y `createFreezeIntent` — sin cambio.
- Todo el stack de rendering (HAL, FixturePhysicsDriver, AetherSafetyMiddleware).

---

## 11. VERIFICACIÓN NUMÉRICA — ¿Funciona la música?

### Test: Ballyhoo a 100 BPM (antes vs después)

| Parámetro | Antes (WAVE 4740) | Después (WAVE 4741) |
|---|---|---|
| PATTERN_PERIOD | 16 beats | — |
| cycleBeats | — | 8 beats |
| phraseDuration | — | 16 beats |
| Velocidad (100 BPM) | 9.6s/vuelta = 0.104 Hz | **4.8s/vuelta = 0.208 Hz** |
| Ciclos en escena | 1 por frase | **2 por frase** |
| Latigazo en cambio | posible (2s wall-clock) | **mínimo (harbor + 2 beats)** |

### Test: Espiral Conga a 100 BPM

| Parámetro | Antes | Después |
|---|---|---|
| cycleBeats | 24 (= PATTERN_PERIOD) | **8** |
| phraseDuration | 24 (implícita) | **24** |
| Velocidad (100 BPM) | 14.4s/vuelta = 0.069 Hz 💀 | **4.8s/vuelta = 0.208 Hz** 🔥 |
| Congas por frase | 1 (funeral) | **3 (CONGA REAL)** |

### Test: Scan_x techno a 128 BPM

| Parámetro | Antes | Después |
|---|---|---|
| cycleBeats | 8 (= PATTERN_PERIOD) | **4** |
| phraseDuration | 8 (implícita) | **16** |
| Velocidad (128 BPM) | 3.75s/vuelta = 0.267 Hz | **1.875s/vuelta = 0.533 Hz** |
| Sweeps por frase | 1 | **4 sweeps en 7.5 segundos** |

---

## 12. RESUMEN EJECUTIVO — Lo que cambia para el usuario

**Ahora mismo:**
> Radwulf activa latina → espiral_conga se mueve como medusa dopada. Un ciclo  
> cada 14 segundos. Cuando Ballyhoo cambia a figure8, el foco atraviesa el escenario  
> en diagonal durante 2 segundos (latigazo). El barCount fijo de 8 compases hace  
> que los patrones cortos (scan_x) no terminen justo y los largos (cadera_libre)  
> se corten a la mitad.

**Tras WAVE 4741:**
> Latina activa → espiral_conga da 3 vueltas en 24 beats (músicamente correcto).  
> Ballyhoo completa 2 figuras en la frase de 16 beats y cuando termina, el foco  
> espera al punto central del patrón (safe harbor) y transiciona en 2 beats  
> hacia el inicio definido del siguiente patrón. Sin sorpresas.  
> La velocidad de cada patrón refleja su naturaleza musical, no su duración en escena.

---

## 13. ORDEN DE IMPLEMENTACIÓN SUGERIDO

1. **Definir `PatternConfig` y `PATTERN_CONFIG`** — tabla completa con todos los patrones
2. **Añadir `SchedulerState` por fixture** — reemplazar `phase`, `sceneBeatsElapsed`, `transition`
3. **Refactorizar tick interno** — los 4 pasos del algoritmo §5
4. **Eliminar** `TRANSITION_DURATION_MS`, `transitionStartTime`, `isTransitioning`
5. **Eliminar** `barCount / 8` del `selectPattern` — reemplazar por lógica del scheduler
6. **Refactorizar Gearbox** — `patternPeriod` → `patternConfig.cycleBeats`
7. **Tests manuales** — activar latina 100 BPM / techno 128 BPM / noblesverify timing

> **NOTA:** Si el SchedulerState actualmente vive en la instancia VMM (único estado  
> compartido), habrá que decidir si se hace per-fixture (cada foco en su propio  
> ciclo) o global (todos synced). La arquitectura actual es global (1 phaseAccumulator).  
> Recomendación: mantener global para la transición → simplifica enormemente.  
> Per-fixture queda como WAVE futura (modo "chaos/stagger").

---

*Este documento es el contrato arquitectónico de WAVE 4741.*  
*Cuando Radwulf dé luz verde, se implementa. Hasta entonces, no se toca ni una coma.*
