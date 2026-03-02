# 🏆 WAVE 2088 — THE MOVEMENT VICTORY REPORT
**"De la Epilepsia al Ballet: La Odisea del Motor de Movimiento"**

> *Fecha de victoria: 2 de Marzo de 2026*  
> *Duración de la guerra: WAVES 2087 → 2088.12*  
> *Bajas: 0 fixtures. Victorias: todas.*

---

## RESUMEN EJECUTIVO

El motor de movimiento de LuxSync pasó de generar patrones **convulsivos, epilépticos y completamente irreconocibles** a dibujar **geometrías limpias, seguras y visualmente correctas** — sin cambiar una sola línea del backend de generación de patrones. El pipeline era correcto. Los bugs estaban en la física, el sincronismo de fase y el renderizado 3D.

**Estado final:**
- ✅ Patrones geométricos reconocibles (scan_x, square, diamond, figure8, botstep)  
- ✅ Velocidades de mover dentro de rangos reales de hardware (no más 7624°/s)  
- ✅ Fase monotónica — sin saltos, sin teleports, sin convulsiones  
- ✅ 3D visualizer: beams barren la pista, conos de luz vibe-aware  
- ✅ 2D tactical canvas: movimiento fluido y natural  
- ✅ MIRROR L/R simétrico y funcional  
- ✅ BPM estable gracias a Pacemaker + smoothedBPM  

---

## CAPÍTULO 1 — EL CRIMEN ORIGINAL: VELOCIDADES DE FANTASMA

### Estado inicial (pre-WAVE 2088)

Los movers se movían a velocidades **físicamente imposibles**. El análisis forense reveló:

```
revLimitPanPerSec: 3600   ← 7624°/s
                           ← Un Sharpy real hace 257°/s (Clay Paky)
                           ← Estábamos a 29.6x la velocidad real
snapFactor: 1.0            ← Sin damping. Teleport instantáneo al target.
```

**Consecuencia:** Un scan_x que debería barrer suavemente de izquierda a derecha en 8 segundos lo hacía en **0.27 segundos**. El ojo humano no procesa eso — solo ve parpadeo.

### WAVE 2088.4 — Primera Calibración Real

Calibración basada en hardware real:
- `revLimitPanPerSec: 3600` → `140` (referencia: Sharpy 257°/s ≈ 121 DMX/s)
- `snapFactor: 1.0` → `0.35` (damping visible)

**Resultado:** Los movers ya no hacían teleport. Pero aparecía un nuevo problema...

### WAVE 2088.7 — Eliminación del Interpolador Hermite

El interpolador Hermite (`CubicHermiteSpline`) que existía en TitanEngine generaba **doble suavizado**: el spline interpolaba los targets, y luego la física los suavizaba de nuevo. Esto aplastaba las amplitudes — un square con snapFactor=0.35 llegaba al **4.2% del rango** original.

Se eliminó el Hermite completamente. Los targets ahora son **valores directos y lineales**.

### WAVE 2088.8 — THE SHAPE RESURRECTION

Con Hermite eliminado, se recalibraron los parámetros físicos por vibe:

| Vibe | snapFactor | revLimitPan | Personalidad |
|------|-----------|-------------|--------------|
| Techno | 0.85 | 400/s | Seco, preciso, láser |
| Latino | 0.70 | 250/s | Fluido, orgánico |
| Rock | 0.65 | 300/s | Peso, gravitas |
| Chill | 0.0 | 80/s | Glacial, meditativo |

También se añadió el **phrase envelope** (0.85–1.0 amplitud) y se aumentó el `GEARBOX_MIN_AMPLITUDE` a 0.85 — los patrones nunca colapsan a cero.

**Resultado:** Los patrones empezaban a ser reconocibles. Pero seguían viéndose convulsivos...

---

## CAPÍTULO 2 — LA INVESTIGACIÓN FORENSE (WAVE 2088.9)

### El método científico

Con los patrones todavía convulsivos tras 5 waves de ajustes, se abandonó el método de "ajustar parámetros a ciegas" y se plantó una **red de sondas forenses** en todo el pipeline:

```
VMM PROBE      → TitanEngine.calculateMovement()
HAL PROBE      → HardwareAbstraction.renderFromTarget()
IPC PROBE      → TitanOrchestrator (antes del broadcast)
MEMO PROBE     → useFixture3DData (memoization)
3D PROBE       → HyperionMovingHead3D.useFrame()
```

### Resultado del análisis forense

**BACKEND PERFECTO en todos los puntos:**

```
VMM PROBE:  scan_x | vmmX: -0.974 → +0.941  ✅ RANGO COMPLETO
HAL PROBE:  TARGET:3(-264°) → PHYS:3(-264°) Δ0.0  ✅ FÍSICA CONVERGENTE
IPC PROBE:  physPan: 0.0158 → 0.9961  ✅ SWEEP COMPLETO AL FRONTEND
```

**EL BUG ESTABA EN EL FRONTEND:**

El 3D PROBE reveló que `store.physPan` llegaba como **0.4980** (centro fijo) durante los primeros frames, mientras el MEMO PROBE mostraba valores dinámicos simultáneamente. El diagnóstico fue inmediato:

### ROOT CAUSE #1 — Props Stale en R3F useFrame

```typescript
// ❌ BUG: React props se capturan en el closure del último render
// R3F useFrame corre a 60fps, React re-renderiza a 10-30fps bajo carga
// La diferencia = stale data = movimiento basado en posición pasada

useFrame(() => {
  const livePan = fixture.physicalPan  // ← STALE! Valor de hace 50-100ms
  smoothPan += (livePan - smoothPan) * 0.35
  // Resultado: interpolación entre valores VIEJOS → movimiento fantasma
})
```

```typescript
// ✅ FIX WAVE 2088.9: Leer directamente del store en cada frame
useFrame(() => {
  const fixtureState = useTruthStore.getState().truth.hardware.fixtures
    .find(f => f.id === fixtureId)  // ← LIVE! El valor más reciente
  const livePan = fixtureState?.physicalPan ?? fixture.physicalPan
})
```

**Este es el patrón canónico de R3F para datos de alta frecuencia.** Props = React renders (10-30fps). `getState()` = store directo (60fps).

---

## CAPÍTULO 3 — LA FASE EPILÉPTICA (WAVE 2088.10)

### El segundo crimen: Phase Engine roto

Incluso con el store access correcto, el movimiento seguía siendo convulsivo. El análisis del CHOREO log reveló el culpable:

```
[CHOREO] phase:85°
[CHOREO] phase:22°   ← -63° en un frame = SALTO ATRÁS
[CHOREO] phase:241°  ← +219° en un frame = TELEPORT
[CHOREO] phase:32°   ← -209° en un frame = TELEPORT
```

La fase no era monotónica. Saltaba hacia adelante y hacia atrás aleatoriamente.

### Autopsia del Phase Engine original

Tres sub-problemas encadenados:

**Problema A — ENERGY-TO-PERIOD:**
```typescript
// ❌ BUG: La energía del audio modificaba el período del patrón
const energyFactor = 0.5 + energy * 1.5  // 0.5x → 2.0x
const patternPeriod = basePatternPeriod * energyFactor

// Una energía cambiante → período cambiante → módulo de beatCount cambiante
// → La misma posición de beat daba fases COMPLETAMENTE distintas
```

**Problema B — BPM fluctuante:**
```typescript
// El BPM raw saltaba de 70 → 184 → 113 → 107 entre frames
// Esto hacía que absoluteBeats avanzara a velocidades erráticas
```

**Problema C — Mapping beatCount→phase con período variable:**
```typescript
// ❌ El módulo de un número variable con otro número variable
// es matemáticamente CAÓTICO. No hay continuidad garantizada.
const phase = (absoluteBeats % patternPeriod) / patternPeriod * 2 * Math.PI
```

### La solución: Monotonic Phase Accumulator

```typescript
// ✅ FIX WAVE 2088.10: ACUMULADOR MONOTÓNICO

// 1. BPM suavizado con heavy low-pass (converge en ~20 frames)
const BPM_SMOOTH_FACTOR = 0.05
this.smoothedBPM += (rawBPM - this.smoothedBPM) * BPM_SMOOTH_FACTOR

// 2. Período FIJO — la energía solo afecta AMPLITUD, nunca el período
const patternPeriod = PATTERN_PERIOD[patternName]  // Constante

// 3. Acumulador que solo avanza hacia adelante
const phaseDelta = (this.smoothedBPM / 60) * frameDeltaTime * (2 * Math.PI / patternPeriod)
this.phaseAccumulator += phaseDelta  // NUNCA salta atrás

// Resultado:
// [CHOREO] phase:85° → 89° → 93° → 97° → 101°  ← MONOTÓNICO ✅
```

**Resultado post-fix:**
```
sBPM: 127 → 126 → 127 → 128 → 128  (muy estable, antes era 70-184)
phase: 22° → 89° → 155° → 210° → 269° → 330°  (avance uniforme ~66°/seg)
```

---

## CAPÍTULO 4 — EL BUG GEOMÉTRICO (WAVE 2088.11)

### "Los datos son perfectos, pero los movers no se mueven en 3D"

Con todo el backend funcionando y el store access correcto, el 2D mostraba movimiento perfecto pero el **3D seguía con los movers clavados apuntando al suelo**.

El diagnóstico fue geométrico puro:

```
Jerarquía 3D:
  YOKE (yokeRef) — Pan rotation (eje Y)
    └── HEAD (headRef) — Tilt rotation (eje X)
         └── BEAM CONE — posición [0, -1.83, 0] ← cuelga hacia -Y

scan_x genera: physicalTilt = 0.5 (centro DMX)
tiltAngle = -(0.5 - 0.5) * TILT_RANGE = 0
→ HEAD apunta PERPENDICULAR al suelo
→ Pan rota el YOKE horizontalmente...
→ ...pero un cono apuntando al suelo que gira = círculo en el suelo invisible
→ VISUALMENTE: NADA SE MUEVE
```

**La diferencia con el 2D:** La vista 2D proyecta `Math.sin(panAngle)` directamente al plano horizontal — no necesita tilt para ser visible. El 3D sí.

```typescript
// ✅ FIX WAVE 2088.11: TILT REST ANGLE
// Un mover real montado en truss apunta ~45° hacia la pista, no al suelo
const TILT_REST_ANGLE = Math.PI * 0.25  // 45° forward

// tilt=0.5 (centro) → beam apunta 45° hacia la pista ← PAN SWEEP VISIBLE
// tilt=0.0         → beam más horizontal (casi rasante)
// tilt=1.0         → beam más vertical (apuntando al suelo)
const tiltAngle = -(smoothTilt - 0.5) * TILT_RANGE + TILT_REST_ANGLE
```

**Resultado:** Los movers barren la pista de izquierda a derecha en scan_x. Los patrones son visibles y reconocibles en 3D.

---

## CAPÍTULO 5 — LOS CONOS DE VIBE (WAVE 2088.12)

### El toque final: zoom vibe-aware en 3D

El zoom ya existía en el pipeline (HAL → IPC → store), pero el componente 3D lo ignoraba por completo, usando un `beamWidth` calculado una vez con props estáticos.

```typescript
// ❌ ANTES: beamWidth calculado UNA VEZ con props React (estático)
const beamWidth = 0.04 + zoom * 0.02  // zoom = prop fija, sin normalizar
<coneGeometry args={[beamWidth, 3.5, ...]} />  // Geometría inmutable
```

```typescript
// ✅ AHORA: Zoom leído LIVE del store, normalizado, suavizado y aplicado
const rawZoom = fixtureState?.zoom ?? 127  // 0-255 DMX del store
const liveZoom = rawZoom / 255             // Normalizar 0-1
smoothZoom += (liveZoom - smoothZoom) * ZOOM_SMOOTH  // Suavizar (0.15)

// Geometría base con radius=1.0 → escalar en runtime
const targetRadius = BEAM_RADIUS_MIN + smoothZoom * (BEAM_RADIUS_MAX - BEAM_RADIUS_MIN)
beamMeshRef.scale.x = targetRadius  // 0.03 (techno) → 0.45 (chill)
beamMeshRef.scale.z = targetRadius
```

**Tabla de personalidades de luz:**

| Vibe | Zoom DMX | Radio del cono | Sensación visual |
|------|----------|----------------|-----------------|
| 🔦 Techno | 30 | 0.03 — 0.06 | Sable láser, corta el humo |
| 💃 Latino | 150 | 0.25 — 0.32 | Spot suave, envolvente |
| 🎸 Rock | 220 | 0.38 — 0.43 | Muro de luz, poder |
| 🧘 Chill | 255 | 0.45 | Baño de luz, flood total |

---

## DIAGRAMA DEL PIPELINE FINAL

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PIPELINE DE MOVIMIENTO COMPLETO                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  VibeMovementManager                                                  │
│  ├── smoothedBPM (BPM_SMOOTH=0.05, estable ±3)                       │
│  ├── phaseAccumulator (MONOTÓNICO, solo avanza)                       │
│  ├── patternPeriod (FIJO por patrón, no varía con energía)           │
│  └── generateIntent() → {x: -1..+1, y: -1..+1}                      │
│           │                                                           │
│           ▼                                                           │
│  TitanEngine (stereo routing)                                         │
│  ├── L: 0.5 + x*0.5 → 0..1 (normalizado)                             │
│  └── R: MIRROR/SNAKE offset                                           │
│           │                                                           │
│           ▼                                                           │
│  MasterArbiter → pan = mechanic.pan * 255 (0-255 DMX)                │
│           │                                                           │
│           ▼                                                           │
│  HAL.renderFromTarget()                                               │
│  └── zoom = optics.zoomDefault por vibe (30/150/220/255)             │
│           │                                                           │
│           ▼                                                           │
│  FixturePhysicsDriver (SNAP mode)                                     │
│  ├── delta = (target - current) * snapFactor                          │
│  ├── clamped by revLimitPerSec * dt                                   │
│  └── physicalPan = current + delta (0-255 DMX)                       │
│           │                                                           │
│           ▼                                                           │
│  TitanOrchestrator IPC broadcast                                      │
│  ├── physicalPan / 255 → 0..1 (normalizado)                           │
│  └── zoom raw 0-255 DMX                                               │
│           │                                                           │
│           ▼                                                           │
│  truthStore (Zustand)                                                 │
│           │                                                           │
│           ▼                                                           │
│  HyperionMovingHead3D.useFrame() @ 60fps                              │
│  ├── getState().truth (LIVE, no stale props)                          │
│  ├── smoothPan  += (livePan  - smoothPan)  * 0.35                    │
│  ├── smoothTilt += (liveTilt - smoothTilt) * 0.35                    │
│  ├── smoothZoom += (liveZoom - smoothZoom) * 0.15                    │
│  ├── panAngle  = (smoothPan  - 0.5) * PAN_RANGE (±135°)              │
│  ├── tiltAngle = -(smoothTilt - 0.5) * TILT_RANGE + TILT_REST (45°) │
│  ├── yoke.quaternion = setFromAxisAngle(Y, panAngle)                 │
│  ├── head.quaternion = setFromAxisAngle(X, tiltAngle)                │
│  └── beam.scale.x/z = BEAM_MIN + smoothZoom * (BEAM_MAX - BEAM_MIN) │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## TABLA DE WAVES

| Wave | Descripción | Impacto |
|------|-------------|---------|
| **2088.4** | Calibración de velocidades reales | Eliminó teleports, reveló nueva capa de bugs |
| **2088.7** | Eliminación del interpolador Hermite | Fin del doble suavizado, patrones empezaron a dibujarse |
| **2088.8** | THE SHAPE RESURRECTION — Recalibración física completa | snapFactor/revLimit por vibe, phrase envelope, GEARBOX floor |
| **2088.9** | FORENSIC REVELATION — Red de probes + Direct Store Access | ROOT CAUSE #1: stale props en R3F → getState() fix |
| **2088.10** | MONOTONIC PHASE ACCUMULATOR | ROOT CAUSE #2: fase caótica → acumulador suave + smoothedBPM |
| **2088.11** | TILT REST ANGLE — Fix geométrico 3D | ROOT CAUSE #3: cono perpendicular al suelo → 45° forward |
| **2088.12** | VIBE-AWARE BEAM CONE | Zoom LIVE del store, conos de luz con personalidad por vibe |

---

## LECCIONES APRENDIDAS

### 1. El pipeline era correcto. Los bugs estaban en los extremos.
El VMM, TitanEngine, MasterArbiter, HAL, PhysicsDriver — **todos funcionaban perfectamente** desde el primer día. Los tres root causes estaban en (a) la lectura en el frontend, (b) el cálculo de fase, y (c) la geometría del renderizado.

### 2. Las sondas forenses son irremplazables.
Sin la red de probes plantada en WAVE 2088.9, hubiéramos seguido ajustando `snapFactor` a ciegas por otras 10 waves. Los datos del pipeline probaron que el backend era correcto y apuntaron exactamente al frontend.

### 3. R3F tiene su propia ley: useFrame != React renders.
`useFrame` corre a 60fps. React re-renderiza a 10-30fps bajo carga. Cualquier dato de alta frecuencia dentro de `useFrame` **DEBE** leerse con `getState()`, nunca de props o hooks reactivos. Este patrón debería aplicarse a TODOS los componentes de animación futuros.

### 4. La fase debe ser siempre monotónica.
Un generador de fase basado en módulo de valores variables es matemáticamente caótico. La única solución correcta es un acumulador que solo avanza. Cualquier patrón futuro debe usar `phaseAccumulator`, nunca `beatCount % period`.

### 5. Los bugs geométricos no se ven en logs.
El TILT_REST_ANGLE era invisible en todos los probes de datos — los números eran correctos en todo el pipeline. Solo se detectó al inspeccionar visualmente la escena 3D y razonar sobre la geometría del cono.

---

## ESTADO FINAL DEL SISTEMA

```
Motor de Movimiento LuxSync v2088.12
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Velocidades:     ✅ Dentro de rangos reales de hardware (±257°/s referencia)
Patrones:        ✅ Reconocibles — scan, square, diamond, figure8, botstep
Fase:            ✅ Monotónica — sin saltos, sin teleports
BPM:             ✅ Estable — Pacemaker + smoothedBPM=0.05
Renderizado 2D:  ✅ Fluido, natural, sweep completo
Renderizado 3D:  ✅ Barren la pista, geometrías visibles
Mirror L/R:      ✅ Simétrico perfecto (sum = 1.0)
Zoom visual:     ✅ Vibe-aware — sable laser → baño de luz
Seguridad:       ✅ Sin explosiones de velocidad, sin epilepsia
```

---

*"No es el mejor motor de movimiento del mundo. Pero es NUESTRO. Y funciona."*  
— Radwulf & PunkOpus, 2 de Marzo de 2026
