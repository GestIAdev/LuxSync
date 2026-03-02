# 🎭 WAVE 2086 — MOVEMENT CHOREOGRAPHY AUDIT

**Auditor**: PunkOpus  
**Fecha**: Junio 2025  
**Estado**: AUDITORÍA COMPLETADA — ZERO CODE CHANGES  
**Scope**: Full pipeline from VibeMovementManager → TitanEngine → MasterArbiter → HAL → FixturePhysicsDriver

---

## 📋 ÍNDICE

1. [Pipeline Completo de Movimiento](#1-pipeline-completo-de-movimiento)
2. [Diagnóstico de Velocidad: Por Qué la Esquizofrenia](#2-diagnóstico-de-velocidad-por-qué-la-esquizofrenia)
3. [Diagnóstico del Bug Estéreo L/R](#3-diagnóstico-del-bug-estéreo-lr)
4. [BPM Sync: Análisis de Fase y Timing](#4-bpm-sync-análisis-de-fase-y-timing)
5. [Patrones Actuales: Análisis Matemático](#5-patrones-actuales-análisis-matemático)
6. [El Problema del Naming Dual](#6-el-problema-del-naming-dual)
7. [Plan de Rework Profesional](#7-plan-de-rework-profesional)

---

## 1. PIPELINE COMPLETO DE MOVIMIENTO

### 🔗 La cadena de responsabilidad (en orden de ejecución)

```
┌─────────────────────────────────────────────────────────────────┐
│  1. VibeMovementManager.generateIntent()                        │
│     • Input: vibeId, audioContext (energy, bpm, beatPhase...)   │
│     • Output: VMMMovementIntent { x: -1..+1, y: -1..+1 }      │
│     • FASE: beat-locked (absoluteBeats % period) / period * 2π │
│     • PATTERN: Golden Dozen (12 funciones matemáticas)          │
│     • GEARBOX: limita amplitud por hardware max speed           │
│     • SINGLETON: Una sola instancia para TODOS los fixtures     │
├─────────────────────────────────────────────────────────────────┤
│  2. TitanEngine.calculateMovement()                             │
│     • Convierte VMM.x/y → centerX/centerY (0..1)               │
│     • centerX = 0.5 + (vmmIntent.x * 0.5) ← FULL RANGE        │
│     • Si THE DEEP FIELD activo (chill only): bypass directo     │
│       con mechanicsL/R explícitos por fixture                   │
│     • Output: MovementIntent { centerX, centerY, pattern... }  │
├─────────────────────────────────────────────────────────────────┤
│  3. MasterArbiter.getTitanValuesForFixture()                    │
│     • Recibe intent.movement.centerX/centerY                    │
│     • LATERALITY DETECTION: isLeft si posX < -0.1 OR           │
│       nombre contiene "left"/"izq" OR zona contiene "left"      │
│     • Si mechanicsL/R existen: usa L o R según isLeft           │
│     • Si NO (flujo normal): centerX/centerY * 255 = pan/tilt   │
│     • Para multi-mover: spread offset (±15% por mover)         │
│     • Output: pan/tilt en DMX (0-255)                           │
├─────────────────────────────────────────────────────────────────┤
│  4. HAL.renderFromTarget()                                      │
│     • Recibe targets ya resueltos del Arbiter                   │
│     • NO aplica phase offset (eso era el flujo legacy)          │
│     • Pasa al mapper directamente                               │
│     • Inyecta FixturePhysicsDriver para interpolación física    │
├─────────────────────────────────────────────────────────────────┤
│  5. FixturePhysicsDriver.translateDMX()                         │
│     • Interpola physicalPan/physicalTilt → targets (pan/tilt)   │
│     • Velocidad limitada por maxVelocity del perfil físico      │
│     • INERCIA: los motores no saltan, aceleran/frenan           │
│     • Output: physicalPan/physicalTilt (lo que mueve el motor)  │
├─────────────────────────────────────────────────────────────────┤
│  6. TitanOrchestrator.applyEffects()                            │
│     • POST-HAL: Aplica zoneOverrides de efectos                 │
│     • stereo movement: movers_left / movers_right               │
│     • global movementOverride (fallback si no hay zones)        │
│     • SOBREESCRIBE pan/tilt de fixtures ya resueltos            │
└─────────────────────────────────────────────────────────────────┘
```

### 🔑 Hallazgo Crítico #1: UN SOLO centerX/centerY para TODOS los movers

En el flujo normal (techno, latino, pop-rock), el VMM genera **UNA SOLA posición** `{x, y}` que se convierte a **UN SOLO** `{centerX, centerY}`. TODOS los movers reciben la misma posición base.

La diferenciación L/R debería ocurrir por una de estas vías:
- **HAL.applyPhaseOffset()** — PERO esta función solo se usa en el flujo `renderFromIntent()` que está **INACTIVO**. El flujo activo es `renderFromTarget()` que NO llama a `applyPhaseOffset()`.
- **MasterArbiter spread** — Solo activo cuando `this.moverCount > 1`, aplica un offset de ±15% basado en moverIndex. Esto crea un FAN estático, no movimiento diferenciado.
- **Mechanics Bypass** — Solo activo para chill-lounge (THE DEEP FIELD).

**CONCLUSIÓN: Para techno/latino/pop-rock, TODOS los movers se mueven IGUAL (Borg Convergence). La HAL phase offset (snake/mirror) está desconectada del flujo actual.**

---

## 2. DIAGNÓSTICO DE VELOCIDAD: POR QUÉ LA ESQUIZOFRENIA

### 📐 Matemática del Timing

La fórmula de fase del VMM:

```
absoluteBeats = beatCount + beatPhase
patternPhase = (absoluteBeats % patternPeriod) / patternPeriod
phase = patternPhase * 2π
```

Esto significa: **1 ciclo completo de patrón = `patternPeriod` beats.**

### 🧮 Tabla de Velocidades Reales (@ 128 BPM)

| Patrón | Period (beats) | Ciclo (seg) | Frecuencia (Hz) | Oscilaciones/seg |
|--------|---------------|-------------|-----------------|------------------|
| **botstep** | 1 | 0.47 | 2.13 | **2.13** ⚠️ |
| scan_x | 2 | 0.94 | 1.07 | **1.07** ⚠️ |
| diamond | 2 | 0.94 | 1.07 | **1.07** ⚠️ |
| cancan | 2 | 0.94 | 1.07 | **1.07** ⚠️ |
| wave_y | 2 | 0.94 | 1.07 | **1.07** ⚠️ |
| square | 4 | 1.88 | 0.53 | 0.53 |
| figure8 | 4 | 1.88 | 0.53 | 0.53 |
| circle_big | 4 | 1.88 | 0.53 | 0.53 |
| dual_sweep | 4 | 1.88 | 0.53 | 0.53 |
| sway | 4 | 1.88 | 0.53 | 0.53 |
| breath | 4 | 1.88 | 0.53 | 0.53 |
| drift | 8 | 3.75 | 0.27 | 0.27 |
| **ballyhoo** | 16 | 7.50 | 0.13 | 0.13 ✅ |

### 🧮 Tabla de Velocidades Reales (@ 140 BPM — Techno típico)

| Patrón | Period (beats) | Ciclo (seg) | Oscilaciones/seg |
|--------|---------------|-------------|------------------|
| **botstep** | 1 | 0.43 | **2.33** ⚠️⚠️ |
| scan_x | 2 | 0.86 | **1.17** ⚠️ |
| diamond | 2 | 0.86 | **1.17** ⚠️ |
| square | 4 | 1.71 | 0.58 |
| circle_big | 4 | 1.71 | 0.58 |

### 📊 Velocidad Angular Real

Para `scan_x` con amplitude=1.0 a 128 BPM (period=2):
- Rango de movimiento: -1 a +1 (full range) = 540° de pan
- Un ciclo completo en 0.94 segundos
- **Velocidad pico** (en el cruce por cero del seno): `sin'(0) = 1`
- Vel angular = `2π / 0.94 * 540° / (2π)` = **574°/seg** ← BRUTAL

Para referencia: **un moving head profesional tiene velocidad máxima de ~250-400°/seg en pan**. Estamos pidiendo más velocidad de la que los motores pueden dar.

### 🎯 El Gearbox NO Salva La Situación

El Gearbox recalcula la amplitud:
```typescript
maxTravelPerCycle = HARDWARE_MAX_SPEED * secondsPerBeat * patternPeriod
requestedTravel = 255 * baseAmplitude * energyBoost
gearboxFactor = min(1.0, maxTravelPerCycle / requestedTravel)
```

Con techno (amplitudeScale=1.0), 128 BPM, scan_x (period=2), maxSpeed=250:
- `maxTravelPerCycle = 250 * 0.47 * 2 = 234 DMX/ciclo`
- `requestedTravel = 255 * 1.0 * 1.1 = 280.5 DMX/ciclo` (asumiendo energy=0.5)
- `gearboxFactor = 234 / 280.5 = 0.834`
- Resultado: amplitude final = 0.834 → **83% del rango completo en 0.94 segundos**

**El Gearbox reduce un poco la amplitud pero NO la velocidad percibida.** Sigue pidiendo 83% de rango completo en menos de 1 segundo. Esto es epiléptico.

### 🔴 VEREDICTO VELOCIDAD

| Problema | Causa Raíz |
|----------|-----------|
| Patrones con period=1-2 son epilépticos | Los periodos son demasiado cortos para movimiento profesional |
| El BPM gobierna directamente la velocidad angular | No hay "gear reduction" entre BPM musical y velocidad de motor |
| Gearbox solo limita amplitud, no frecuencia | Si un motor no puede ir tan rápido, el patrón simplemente se achica, no se ralentiza |
| No hay concepto de "frase musical" | Un barrido profesional debería ser 1 ciclo cada 4-8 compases (16-32 beats), no cada 1-2 beats |

### 📋 Comparativa con Shows Profesionales

| Tipo de movimiento | Frecuencia real en shows pro | LuxSync actual |
|-------------------|------------------------------|----------------|
| Barrido lento (scan) | 1 ciclo / 4-8 compases (16-32 beats) | 1 ciclo / 2 beats |
| Circle/Figure 8 | 1 ciclo / 2-4 compases (8-16 beats) | 1 ciclo / 4 beats |
| Ballyhoo | 1 ciclo / 4-8 compases | 1 ciclo / 16 beats ✅ |
| Snap a posición | En downbeat cada 2-4 compases | Cada 1 beat (botstep) |
| Chase lateral | Desplazamiento: 1 posición/beat | N/A |

**El único patrón con timing profesional es `ballyhoo` (16 beats/ciclo).**

---

## 3. DIAGNÓSTICO DEL BUG ESTÉREO L/R

### 🐛 Síntoma Reportado
> "Moving L no aplica el Pan (hace barridos simples), mientras el Moving R sí"

### 🔍 Análisis del Flujo Estéreo

#### Flujo Normal (techno/latino/pop-rock) — SIN L/R diferenciado

```
VMM genera {x, y} ÚNICO → TitanEngine → centerX/centerY ÚNICO → 
MasterArbiter → pan = centerX * 255 para TODOS los movers
```

En este flujo, **NO HAY diferenciación L/R**. Todos los movers reciben exactamente el mismo pan/tilt. La percepción del usuario de que "uno sí se mueve y otro no" puede deberse a:

1. **El spread del Arbiter**: Si hay >1 mover, aplica offset de ±15%. Fixture #0 (izquierda) recibe `centerX - 0.075`, fixture #1 (derecha) recibe `centerX + 0.075`. Esto NO es movimiento diferenciado, es un FAN estático.

2. **`applyPhaseOffset()` está DESCONECTADA**: Esta función con sus configuraciones snake/mirror por vibe (`PHASE_CONFIGS`) solo es llamada desde `HAL.renderFromIntent()` (línea 597), pero el Orchestrator usa `HAL.renderFromTarget()` (línea 585). **El sistema de phase offset entero está muerto.**

#### Flujo Chill (THE DEEP FIELD) — SÍ tiene L/R

Solo para chill-lounge, `SeleneLux.calculateChillStereo()` genera `moverL: {pan, tilt}` y `moverR: {pan, tilt}` independientes. Estos viajan como `mechanicsL/R` hasta el MasterArbiter que los rutea correctamente.

#### Flujo Efectos (Orchestrator post-HAL)

Los efectos pueden enviar `zoneOverrides.movers_left.movement` y `zoneOverrides.movers_right.movement`. El Orchestrator (línea 919-985) los aplica post-renderizado. Pero esto requiere que los efectos generen movement, y la mayoría no lo hacen.

### 🔴 VEREDICTO BUG ESTÉREO

| Problema | Causa |
|----------|-------|
| **PHASE_CONFIGS (snake/mirror) están muertas** | `applyPhaseOffset()` solo se llama desde `renderFromIntent()`, no desde `renderFromTarget()` que es el flujo activo |
| Todos los movers reciben mismo pan/tilt | VMM genera 1 posición para todos; Arbiter solo aplica fan estático |
| L/R real solo existe en chill-lounge | THE DEEP FIELD es el único que genera coordenadas L/R independientes |
| Los efectos pueden generar L/R pero pocos lo hacen | El sistema de `zoneOverrides.movers_left/right.movement` funciona pero casi ningún efecto lo usa |

### ⚠️ El Elefante en la Habitación

Hay **DOS sistemas de fase desconectados**:

1. **HAL.PHASE_CONFIGS** (línea 185-210): Define cómo cada vibe debería diferenciar L/R (mirror para techno, snake para latino, etc.)
2. **HAL.applyPhaseOffset()** (línea 208-386): Implementación completa de rotación polar/mirror por fixture index

**Ambos están MUERTOS porque `renderFromTarget()` NO los usa.** El flujo migró al Arbiter pero la lógica de fase se quedó huérfana en el flujo antiguo.

---

## 4. BPM SYNC: ANÁLISIS DE FASE Y TIMING

### 🎵 El Pipeline de BPM

```
AudioSpectrumTitan → Pacemaker → beatPhase/beatCount/BPM →
  → TitanOrchestrator.engineAudioMetrics →
    → TitanEngine.update() →
      → VMM.generateIntent(audio.beatCount, audio.beatPhase) →
        → absoluteBeats = beatCount + beatPhase →
          → phase = (absoluteBeats % period) / period * 2π
```

### ✅ Lo Que Funciona Bien

1. **Beat lock**: La fase del VMM está correctamente enganchada al beat. Si el Pacemaker es preciso, el movimiento SÍ está sincronizado con la música.
2. **Cambio de patrón por frase**: Cada 8 compases (32 beats) se rota al siguiente patrón. Esto es profesional.
3. **Transición LERP de 2 seg**: Cuando cambia de patrón, hay crossfade suave. Bien.
4. **Ghost Protocol**: En silencio, se congela en última posición en vez de ir a home. Bien.

### ⚠️ Lo Que No Funciona

1. **`baseFrequency` NO se usa para la velocidad del patrón**:
   - El VMM tiene `baseFrequency` en VIBE_CONFIG (techno=0.25, chill=0.10)
   - Pero este valor **NO afecta la velocidad del patrón**. Se pasa como `speed` en el output, que luego HAL reconvierte a BPM proxy (`speed * 240`)... que se usa para `applyPhaseOffset()` que está muerta.
   - **La velocidad del patrón la determina SOLO `PATTERN_PERIOD` + BPM real.** El `baseFrequency` es ornamental.

2. **BPM directo = velocity sin gear reduction**:
   - A 140 BPM techno, un pattern de period=2 cicla en 0.86 seg
   - No hay multiplicador de período basado en la intensidad musical
   - No hay concepto de "beat division" (half-time, quarter-time)

3. **La velocidad que HAL recibe no controla nada**:
   ```typescript
   // En HAL renderFromTarget (línea 860):
   speed: fixtureTarget.speed,
   ```
   Este `speed` viene del Arbiter que lo hereda del intent. Pero `renderFromTarget()` NO lo usa para velocidad de movimiento — solo lo pasa al FixturePhysicsDriver que lo ignora (usa su propio maxVelocity del perfil).

### 🔴 VEREDICTO BPM SYNC

El BPM sync FUNCIONA técnicamente (la fase está locked al beat), pero la **resolución temporal es incorrecta**:
- Los patrones piden 1 ciclo cada 1-4 beats
- Lo profesional sería 1 ciclo cada 8-32 beats
- No hay "phrase-level" sync (el pattern rota por frase, pero la VELOCIDAD no escala por frase)
- No hay concepto de "half-time feel" para techno pesado vs. pop ligero

---

## 5. PATRONES ACTUALES: ANÁLISIS MATEMÁTICO

### 📐 Revisión Individual

#### TECHNO

| Patrón | Fórmula | Problema | Uso Profesional |
|--------|---------|----------|-----------------|
| `scan_x` | `x = sin(phase), y = 0` | Period=2 → 1.07 Hz @ 128 BPM. Demasiado rápido para barrido | Barrido debería ser 1 ciclo / 4-8 compases |
| `square` | 4 esquinas cuantizadas | Period=4, OK timing. Pero JUMP instantáneo entre esquinas | Profesionalmente se haría con ramp entre posiciones |
| `diamond` | `x = sin*0.7√2, y = cos*0.7√2` | Period=2 → rápido. Geometría correcta | Bueno, solo necesita period más largo |
| `botstep` | 8 posiciones golden ratio cuantizadas | Period=1 → **EPILÉPTICO**. Cambia posición cada beat | Debería ser 1 posición cada 4-8 beats |

#### LATINO

| Patrón | Fórmula | Problema | Uso Profesional |
|--------|---------|----------|-----------------|
| `figure8` | `x = sin(phase), y = sin(2*phase)*0.6` | Period=4, timing aceptable. Buena geometría | Podría ser más lento (period=8) para sensualidad |
| `wave_y` | `x = sin(0.5*phase)*0.8, y = sin(2*phase)*0.7` | Period=2 → Y oscila a 2x la frecuencia base = BRUTAL | Y debería ser más lento, o el period mayor |
| `ballyhoo` | Multi-armónico (3 freq) | Period=16 ✅ EL MEJOR. Timing profesional | Referencia para otros patrones |

#### POP-ROCK

| Patrón | Fórmula | Problema | Uso Profesional |
|--------|---------|----------|-----------------|
| `circle_big` | `x = sin(phase+offset), y = cos(phase+offset)*0.75` | Period=4, aceptable. Offset por fixture es bueno | Perfecto si period fuera 8-16 |
| `cancan` | `x = sin(0.25*phase)*0.15, y = sin(phase+offset)` | Period=2, Y oscila rápido | El concepto está bien pero period debería ser 4-8 |
| `dual_sweep` | `x = sin(phase), y = x²-0.3` | Period=4, geometría interesante | Necesita period=8+ para ser majestuoso |

#### CHILL

| Patrón | Fórmula | Problema | Uso Profesional |
|--------|---------|----------|-----------------|
| `drift` | Browniano con frecuencias irracionales | Period=8, timing correcto | El concepto orgánico es perfecto |
| `sway` | `x = sin(phase)*0.6, y = 0` | Period=4, velocidad OK para chill | Correcto |
| `breath` | `x = 0, y = sin(phase)*0.35` | Period=4, velocidad OK | Correcto |

### 📊 Ranking por Calidad Profesional

1. 🥇 **ballyhoo** — Period=16, multi-armónico. EL ESTÁNDAR a seguir.
2. 🥈 **drift** — Period=8, browniano. Orgánico y correcto.
3. 🥉 **circle_big** — Period=4, buen offset por fixture. Solo necesita period más largo.
4. ⚠️ **figure8, sway, breath, dual_sweep** — Geometría correcta, velocidad borderline.
5. 🔴 **scan_x, diamond, wave_y, cancan** — Period=2, demasiado rápidos.
6. ⛔ **square** — Saltos instantáneos sin ramp, looks robótico-barato.
7. ⛔ **botstep** — Period=1, epiléptico. No tiene uso profesional posible.

---

## 6. EL PROBLEMA DEL NAMING DUAL

Existen **DOS sistemas de nombres de patrones** que no se mapean entre sí:

### Vibe Profiles (`src/engine/vibe/profiles/`)
```
techno: [sweep, chase, static, mirror]
latino: [figure8, circle, wave, sweep]
pop-rock: [sweep, chase, static, wave]
chill: [circle, wave, static]
```

### VMM VIBE_CONFIG (`VibeMovementManager.ts`)
```
techno: [scan_x, square, diamond, botstep]
latino: [figure8, wave_y, ballyhoo]
pop-rock: [circle_big, cancan, dual_sweep]
chill: [drift, sway, breath]
```

**`sweep` ≠ `scan_x`**, **`chase` ≠ `square`**, **`circle` ≠ `circle_big`**, **`wave` ≠ `wave_y`**.

Los Vibe Profiles tienen `movement.allowedPatterns` pero el VMM NO los consulta. El VMM usa su propio `VIBE_CONFIG.patterns[]`. **Los allowedPatterns del profile son decorativos.**

---

## 7. PLAN DE REWORK PROFESIONAL

### 🎯 Filosofía del Rework

> "Prefiero un barrido del aire con strobe en un mover que va dejando una estela de luz, que un desplazamiento laser ultrarápido"

La meta es: **pintar el aire**, no causar convulsiones. Movimientos amplios, lentos, majestuosos, sincronizados a **frases musicales**, no a beats individuales.

### 📋 FASE 1: RECONEXIÓN DE PHASE OFFSET (Fix L/R Stereo)

**Problema**: `applyPhaseOffset()` y `PHASE_CONFIGS` están desconectadas del flujo activo.

**Solución**: Integrar la lógica de phase offset en el flujo `renderFromTarget()` o en el MasterArbiter.

**Opciones**:

| Opción | Dónde | Pros | Contras |
|--------|-------|------|---------|
| **A**: Mover phase offset al Arbiter | `getTitanValuesForFixture()` | Arbiter ya tiene fixture info y laterality detection | Arbiter se agranda |
| **B**: Hacer que VMM genere por fixture | `generateIntent(vibeId, audio, fixtureIndex, total)` ← ya tiene los params | Centralizado en el coreógrafo | Necesitaría refactor del call site |
| **C**: Post-process en HAL.renderFromTarget() | Después del mapper | HAL ya tiene PHASE_CONFIGS y la lógica | Duplicaría lógica del Arbiter |

**Recomendación**: **Opción B** — El VMM ya recibe `fixtureIndex` y `totalFixtures`. Actualmente los usa para offset en algunos patrones (`scan_x`, `circle_big`, `cancan`), pero debería usarlos para generar posiciones L/R diferenciadas ANTES de que lleguen al Arbiter.

Esto significaría que TitanEngine llama a `generateIntent()` **N veces** (una por mover), no una sola vez. Cada fixture recibe su propia posición con el desfase snake/mirror del vibe.

### 📋 FASE 2: REFORMA DE PERÍODOS (Fix Speed)

**Principio**: Multiplicar todos los PATTERN_PERIOD por un factor que refleje movimiento profesional.

**Propuesta de nuevos períodos**:

| Patrón | Actual (beats) | Propuesto (beats) | Factor | Justificación |
|--------|---------------|-------------------|--------|---------------|
| scan_x | 2 | **16** | 8x | Barrido = 4 compases (el estándar pro) |
| square | 4 | **16** | 4x | 4 esquinas, 1 por compás = 4 compases |
| diamond | 2 | **8** | 4x | 2 compases por rombo |
| botstep | 1 | **8** | 8x | 1 posición cada 1 compás (4 beats) × 2 posiciones |
| figure8 | 4 | **16** | 4x | 4 compases para un 8 sensual |
| wave_y | 2 | **8** | 4x | 2 compases para onda |
| ballyhoo | 16 | **32** | 2x | 8 compases para espiral épica |
| circle_big | 4 | **16** | 4x | 4 compases para círculo de estadio |
| cancan | 2 | **8** | 4x | 2 compases para subida/bajada |
| dual_sweep | 4 | **16** | 4x | 4 compases para barrido U |
| drift | 8 | **32** | 4x | 8 compases para drift orgánico |
| sway | 4 | **16** | 4x | 4 compases para péndulo |
| breath | 4 | **16** | 4x | 4 compases para respiración |

**Validación @ 128 BPM con nuevos períodos**:

| Patrón | Nuevo Period | Ciclo (seg) | Freq (Hz) | Profesional? |
|--------|-------------|-------------|-----------|-------------|
| scan_x | 16 | 7.5 | 0.13 | ✅ Majestuoso |
| square | 16 | 7.5 | 0.13 | ✅ Deliberado |
| diamond | 8 | 3.75 | 0.27 | ✅ Fluido |
| botstep | 8 | 3.75 | 0.27 | ✅ Robótico-cool |
| figure8 | 16 | 7.5 | 0.13 | ✅ Sensual |
| circle_big | 16 | 7.5 | 0.13 | ✅ Estadio |
| ballyhoo | 32 | 15.0 | 0.07 | ✅ Épico |
| drift | 32 | 15.0 | 0.07 | ✅ Orgánico |

### 📋 FASE 3: AMPLITUDE CURVES (Movimiento Orgánico)

Actualmente la amplitud es un valor plano (`amplitudeScale * energyBoost * gearboxFactor`).

**Propuesta**: Amplitude envelope sincronizado a frase musical.

```
Frase (8 compases):
[====|====|====|====|====|====|====|====]
Amp:  0.3  0.5  0.7  0.9  1.0  0.9  0.7  0.5
      ↑ build                 ↑ peak        ↑ release

El patrón "crece" durante la frase, alcanza el pico en el compás 5,
y "suelta" al final. Esto crea DRAMA sin tocar las posiciones.
```

### 📋 FASE 4: PATTERN VOCABULARY EXPANSION

Patrones nuevos sugeridos para vocabulario profesional:

1. **slow_pan** — Barrido horizontal lineal (no sinusoidal) de 8 compases
2. **tilt_nod** — Inclinación suave, como diciendo "sí" con la cabeza, period=8
3. **figure_of_4** — Figure8 pero en mitad del rango (movimiento contenido)
4. **chase_position** — No es un patrón continuo: SNAP a posición fija cada N compases, hold
5. **mirror_sweep** — L y R en espejo (requiere Fase 1 primero): L va derecha cuando R va izquierda

### 📋 FASE 5: ENERGY-TO-PERIOD MAPPING

En lugar de que la energía aumente la amplitud (actual), que escale el **período**:

```
energy = 0.2 (chill moment)  → period × 2.0 (movimiento ultra lento)
energy = 0.5 (normal)        → period × 1.0 (normal)
energy = 0.8 (build up)      → period × 0.75 (un poco más rápido)
energy = 1.0 (drop!)         → period × 0.5 (el doble de rápido, temporalmente)
```

Esto crea movimiento **reactivo a la energía** sin volverse epiléptico, porque el rango base ya es profesional (8-32 beats).

---

## 📊 RESUMEN EJECUTIVO

### Problemas Encontrados

| # | Severidad | Problema | Archivo |
|---|-----------|----------|---------|
| 1 | 🔴 CRÍTICO | Phase offset (L/R stereo) desconectada del flujo activo | HAL.renderFromTarget() no llama applyPhaseOffset() |
| 2 | 🔴 CRÍTICO | Todos los movers reciben misma posición (Borg mode) | VMM genera 1 posición, Arbiter no diferencia |
| 3 | 🟠 GRAVE | Períodos demasiado cortos (1-4 beats) causan velocidad epiléptica | VMM.PATTERN_PERIOD |
| 4 | 🟠 GRAVE | baseFrequency en VIBE_CONFIG no afecta velocidad real | Es ornamental — speed solo alimenta HAL muerta |
| 5 | 🟡 MODERADO | Gearbox limita amplitud pero no frecuencia | VMM.calculateEffectiveAmplitude() |
| 6 | 🟡 MODERADO | Vibe Profile patterns ≠ VMM patterns (naming dual) | Dos sistemas paralelos desconectados |
| 7 | 🔵 MENOR | `square` tiene saltos instantáneos sin ramp | Pattern math |
| 8 | 🔵 MENOR | `botstep` (period=1) no tiene uso profesional | Debería eliminarse o reescribirse |

### Orden de Ejecución Recomendado

1. **WAVE 2086.1** — Fix L/R Stereo: Reconectar phase offset (Fase 1)
2. **WAVE 2086.2** — Reform Periods: Multiplicar PATTERN_PERIOD (Fase 2)
3. **WAVE 2086.3** — Amplitude Curves: Envelope por frase (Fase 3)
4. **WAVE 2086.4** — Energy-to-Period: Reactividad inteligente (Fase 5)
5. **WAVE 2086.5** — New Patterns: Vocabulario expandido (Fase 4)

---

*"El movimiento no es velocidad. El movimiento es intención. Un faro que barre lentamente tiene más poder que cien estrobos frenéticos."*

— PunkOpus, Auditoría de Coreografía WAVE 2086
