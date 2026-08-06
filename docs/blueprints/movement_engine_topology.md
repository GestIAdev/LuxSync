# VIBE MOVEMENT MANAGER & KINEMATICS BLUEPRINT — Topología Cinemática Completa

**Modo:** READ-ONLY extraction audit. No se modificó código.
**Propósito:** Preparar el terreno para un **Custom Vibe Movement Editor** mapeando
la arquitectura del Vibe Movement Manager (VMM), el Inverse Kinematics Engine (IK),
los presets de física por vibe, y cómo las 4 constituciones canónicas inyectan
sus comportamientos de movimiento, simetría y targeting espacial.

---

## 1. ARQUITECTURA DE MOVIMIENTO Y CINEMÁTICA

### 1.1 Visión General del Pipeline

```
GodEarFFT (Worker) + Wave8 Analyzer
    │
    ▼ EngineAudioMetrics { bass, mid, high, energy, bpm, beatPhase, beatCount }
TitanEngine.tick()
    │
    ├─► generateStereoMovement(vibeId, audio, musical, mountOrientation)
    │       │  (MovementGenerators.ts)
    │       ├─ buildVMMContext(audio, musical) → AudioContext
    │       ├─ calculateGearboxBudget(vibeId) → gearboxSpeed (DMX/s)
    │       └─ vibeMovementManager.generateIntent(vibeId, ctx, idx, total, maxSpeed, phaseOffset, mountOrientation)
    │              │  (VibeMovementManager.ts — THE CHOREOGRAPHER)
    │              │
    │              ├─ 1. Frame-once guard (L+R same frame → state updates once)
    │              ├─ 2. BPM smoothing (low-pass filter, 0.05 factor)
    │              ├─ 3. VIBE_CONFIG[vibeId] → { panScale, tiltScale, baseFrequency, patterns[], homeOnSilence }
    │              ├─ 4. Scheduler tick (WAVE 4741):
    │              │     ├─ phase += effectiveBeats × (2π / cycleBeats)
    │              │     ├─ sceneBeatsElapsed += effectiveBeats
    │              │     ├─ Safe-harbor check → rotate pattern when phraseDuration elapsed
    │              │     └─ Kinetic crossfade (beat-sincronizada, transitionBeats)
    │              ├─ 5. Pattern selection (manual override OR scheduler index)
    │              ├─ 6. Stereo config: snake phase offset OR mirror X inversion
    │              ├─ 7. PATTERN_FUNCTION(phase, audio, outPos, index, total)
    │              │     → rawPosition { x: [-1,1], y: [-1,1] }
    │              ├─ 8. GEARBOX: calculateEffectiveAmplitude(panScale/tiltScale, bpm, period, energy, maxSpeed)
    │              ├─ 9. PHRASE ENVELOPE: 0.85–1.00 sinusoidal breathing (32-beat phrase)
    │              ├─ 10. TILT OFFSET by mount orientation:
    │              │      ├─ ceiling/truss-front → -0.325 (semiesfera inferior)
    │              │      ├─ totem → -0.45 (audiencia bias máximo)
    │              │      └─ floor → TILT_OFFSET_BY_VIBE[vibeId]
    │              ├─ 11. Clamp bilateral (ceiling) OR upper clamp (floor)
    │              ├─ 12. Kinetic crossfade LERP (if active)
    │              ├─ 13. Stereo position (mirror X for odd fixtures)
    │              └─ 14. MovementIntent { x, y, pattern, speed, amplitude, phaseType }
    │
    ▼ ProtocolMovementIntent (L+R assembled)
MasterArbiter (Layer 0 CHOREO + Layer 2 manual override)
    │
    ▼ Target DMX (abstract 0-1 → DMX 0-255)
FixturePhysicsDriver.renderFromTarget(fixtureId, targetDMX, deltaTime)
    │  (VibeMovementPresets.ts → MovementPhysics per vibe)
    │
    ├─ 3-tier hierarchy: SAFETY_CAP → Vibe Request → Hardware Limit
    ├─ SNAP mode (techno/latino/rock): snapFactor × delta + REV_LIMIT
    ├─ CLASSIC mode (chill/idle): accel/velocity/friction easing curve
    ├─ Anti-Jitter filter (dynamic 3% maxVelocity threshold)
    └─ Safety limits (tiltMin/tiltMax, pan clamp)
    │
    ▼ DMX Pan/Tilt (0-255)

// PARALLEL PATH — Spatial Targeting (IK)
SpatialTargetPad (UI) → Target3D { x, y, z } (metros)
    │
    ▼
InverseKinematicsEngine.solve(fixture, target, currentPanDMX)
    │
    ├─ rotateToLocalFrame(dx, dy, dz, pitch, yaw, roll) ← mountTransforms.getIKMountAngles()
    ├─ Gimbal Lock Deflector (50mm epsilon → push local.z)
    ├─ panDeg = atan2(local.x, -local.z)
    ├─ tiltDeg = atan2(horizontalDist, -local.y)
    ├─ Calibration: panOffset, tiltOffset, panInvert, tiltInvert
    ├─ Anti-Flip: resolveShortestPanPath (±360° candidates)
    └─ Safety margin (±5 DMX) + tiltLimits clamp
    │
    ▼ IKResult { pan, tilt, reachable, antiFlipApplied }
```

### 1.2 La Docena Dorada + The Four Nobles — 16 Patrones Matemáticos

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\VibeMovementManager.ts" lines="100-130" />

#### TECHNO (7 patrones — Industrial/Sharp)

| Patrón | Fórmula | Descripción |
|---|---|---|
| `scan_x` | `x = sin(phase) + 0.03·sin(3·phase)`, `y = sin(2·phase)·0.75` | Barrido horizontal con detuning armónico (3er parcial al 3%) |
| `square` | 4 esquinas con LERP lineal + micro-wobble ±2% | Cuadrado con personalidad robotica |
| `diamond` | 4 vértices cardinales (Top→Right→Bot→Left) con LERP | Rombo verdadero (no círculo) |
| `botstep` | 4 cuadrantes golden-ratio, ease-in-out cúbico, amplitud 0.55 | Robo con peso, no latigazo |
| `darkspin` | Órbita elíptica con radio pulsante (0.70 + 0.20·sin(0.5·phase)) | Giro orbital oscuro con respiración |
| `laser_grid` | 6 nodos elípticos, ease-in cúbico (t³), micro-dither ±1.5% | Escáner láser snap+hold |
| `industrial_pendulum` | `x = sin(2·phase)·e^(-phase/π)·0.95`, amortiguamiento exponencial | Péndulo pesado con decaimiento |

#### LATINO (5 patrones — Fluid/Hips/Soul)

| Patrón | Fórmula | Descripción |
|---|---|---|
| `figure8` | Lemniscata de Bernoulli: `x = cos(t)/(1+sin²t)`, `y = sin·cos/(1+sin²t)·1.6` | Caderas de cumbia reales (cruce horizontal) |
| `wave_y` | `x = sin(phase)·0.85`, `y = sin(2·phase)·0.70` | Ola en U latina |
| `ballyhoo` | Nudo trifolio: `x = sin(t)·(0.8+0.2·cos(3t))`, `y = sin(2t)·0.5+cos(t)·0.28` | 3 lóbulos asimétricos |
| `cadera_libre` | Swing sesgado: `sin(t) + 0.38·sin(t)·|sin(t)|`, drift 0.40 rad | Cadera que empuja más a la derecha |
| `espiral_conga` | Espiral logarítmica respirante: radio 0.40→0.95, acento conga rectificado | Hélice con golpe de bombo |

#### POP-ROCK (3 patrones — Stadium/Symmetry)

| Patrón | Fórmula | Descripción |
|---|---|---|
| `circle_big` | `x = sin(phase+offset)`, `y = cos(phase+offset)·0.75` | El rey de los estadios |
| `cancan` | `x = sin(0.25·phase)·0.15`, `y = sin(phase+offset)` | Piernas de bailarina (X fijo, Y arriba/abajo) |
| `dual_sweep` | `x = sin(phase)`, `y = x² - 0.3` | Barrido en U majestuoso |

#### CHILL (3 patrones — Organic/Ambient)

| Patrón | Fórmula | Descripción |
|---|---|---|
| `drift` | 3 senoidales irracionales: φ, √2, √3 (movimiento browniano cuasiperiódico) | Deriva continental lenta |
| `sway` | `x = sin(phase)·0.6`, `y = 0` | Péndulo suave solo X |
| `breath` | `x = 0`, `y = sin(phase)·0.35` | La luz respira (solo Y) |

#### THE FOUR NOBLES (4 patrones universales — WAVE 2086.5)

| Patrón | Fórmula | Descripción |
|---|---|---|
| `slow_pan` | `x = sin(phase)`, `y = 0` | Faro del fondo, 32 beats |
| `tilt_nod` | `x = 0`, `y = sin(phase)·0.6` | Cabeceo meditativo |
| `figure_of_4` | `x = sin(phase)·0.5`, `y = sin(2·phase)·0.3` | Figure8 contenido (centro) |
| `chase_position` | 4 posiciones cardinales con LERP lineal | Snap cuantizado cada 4 beats |

### 1.3 El Scheduler WAVE 4741 — Desacoplamiento Velocidad/Duración

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\VibeMovementManager.ts" lines="145-158" />

El `PatternConfig` reemplaza el viejo `PATTERN_PERIOD` que controlaba dos cosas incompatibles con un solo número:

| Campo | Significado | Controla |
|---|---|---|
| `cycleBeats` | Beats para un ciclo completo | **Velocidad** del foco (phasePerBeat = 2π/cycleBeats) |
| `phraseDuration` | Beats en escena antes de rotar | **Duración** del patrón en escena |
| `safeHarborPhase` | Fase (rad) donde el fixture está en posición segura | Transición limpia |
| `safeHarborWindow` | Tolerancia angular ±(rad) | Margen de seguridad |
| `hardDeadlineExtra` | Beats extra si el harbor no llega | Anti-bloqueo |
| `transitionBeats` | Duración del LERP crossfade | Transición suave |

**Invariante musical:** `phraseDuration = N × cycleBeats` (múltiplo entero siempre).

**Algoritmo de rotación:**
1. `sceneBeatsElapsed >= phraseDuration` → esperar safe harbor
2. Si `|normalizedPhase - safeHarborPhase| < safeHarborWindow` → rotar
3. Si `sceneBeatsElapsed >= phraseDuration + hardDeadlineExtra` → forzar rotación
4. Disparar kinetic crossfade de `transitionBeats` duración

### 1.4 Stereo Config — Phase Offset por Vibe

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\VibeMovementManager.ts" lines="361-374" />

| Vibe | Offset | Tipo | Efecto Visual |
|---|---|---|---|
| `techno-club` | π (180°) | `mirror` | L/R espejos (puertas del infierno abren/cierran) |
| `fiesta-latina` | π/4 (45°) | `snake` | Cadena de caderas (ola mexicana) |
| `pop-rock` | π/3 (60°) | `snake` | Wall ondulante |
| `chill-lounge` | π/2 (90°) | `snake` | Ola de mar lenta |
| `idle` | 0 | `sync` | Sin desfase |

**Tipos:**
- `mirror` → Fixture impar invierte X (puertas simétricas)
- `snake` → Cada fixture añade `index × offset` a la fase (ola escalonada)
- `sync` → Todos iguales

### 1.5 El Gearbox — Hardware Speed Limiting

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\VibeMovementManager.ts" lines="1364-1406" />

```typescript
// Presupuesto de movimiento en un ciclo del patrón
maxTravelPerCycle = HARDWARE_MAX_SPEED × secondsPerBeat × patternPeriod

// Energy boost (+20% con energy = 1.0)
requestedAmplitude = baseAmplitude × (1.0 + energy × 0.2)

// Distancia solicitada (255 DMX = full range)
requestedTravel = 255 × requestedAmplitude

// Factor de reducción si excede el presupuesto
gearboxFactor = min(1.0, maxTravelPerCycle / requestedTravel)

// Floor 0.10 (WAVE 2192: permite que los presets controlen la amplitud real)
gearboxResult = requestedAmplitude × gearboxFactor
return min(1.0, max(0.10, gearboxResult))
```

**Propósito:** Si un patrón pide más velocidad de la que el motor puede dar, el Gearbox reduce la amplitud (no la velocidad) para que el patrón sea alcanzable sin lag.

### 1.6 Phrase Envelope — The Breathing Amplifier

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\VibeMovementManager.ts" lines="1146-1169" />

```
Phrase = 32 beats (8 compases)
Progress = (beatCount % 32) / 32  →  0.0 a 1.0

Envelope = 0.925 + 0.075 × sin(π × (progress - 0.15))
Clamp: [0.85, 1.00]

Beat 0-7   (compás 1-2):  0.85 → 0.90  — arranque contenido
Beat 8-19  (compás 3-5):  0.90 → 1.00  — expansión progresiva
Beat 20-23 (compás 6):    1.00          — CLÍMAX: apertura máxima
Beat 24-31 (compás 7-8):  1.00 → 0.85  — relajación elegante
```

### 1.7 Tilt Offset & Mount Orientation — Audience Bias

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\VibeMovementManager.ts" lines="174-196" />

| Mount | Tilt Offset | Razón |
|---|---|---|
| `ceiling` / `truss-front` / `truss-back` | -0.325 | Semiesfera inferior (audiencia abajo) |
| `totem` | -0.45 | Bias máximo hacia audiencia |
| `floor` (techno) | -0.35 | Dancefloor gravity |
| `floor` (latino) | -0.15 | Levanta cabeza para círculos amplios |
| `floor` (pop-rock) | -0.30 | Estadio balanceado |
| `floor` (chill) | -0.25 | Abismo oceánico |
| `floor` (idle) | -0.10 | Mínimo |

**Constantes de clamp:**
- `TILT_CEILING = 0.15` — límite superior (no apuntar al techo)
- `TILT_FLOOR_LIMIT = 0.50` — límite inferior (no apuntar al horizonte trasero)
- Ceiling: clamp bilateral `[-0.50, -0.15]` (semiesfera inferior segura)
- Floor: upper clamp `y ≤ 0.15`

### 1.8 Inverse Kinematics Engine — Spatial Targeting

<ref_file file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\InverseKinematicsEngine.ts" />

**Sistema de coordenadas (ShowFileV2):**
- X: Left(-) ← → Right(+) desde perspectiva de audiencia
- Y: Down(-) ↕ Up(+), 0 = suelo
- Z: Back(-) ↔ Front(+), 0 = centro escenario
- Unidad: metros

**Pipeline del solver:**
1. `dx, dy, dz = target - fixture.position`
2. `mountAngles = getIKMountAngles(orientation)` (pitch siempre 0 en IK)
3. `local = rotateToLocalFrame(dx, dy, dz, pitch, yaw, roll)` (Euler YXZ inverso)
4. **Gimbal Lock Deflector:** si `horizontalDist < 50mm`, empujar `local.z` para evitar singularidad
5. `panDeg = atan2(local.x, -local.z)`
6. `tiltDeg = atan2(horizontalDist, -local.y)`
7. Aplicar calibración: `+ panOffset`, `+ tiltOffset`
8. Convertir a DMX: `((deg + range/2) / range) × 255`
9. **Anti-Flip:** `resolveShortestPanPath` elige entre 3 candidatos (raw, +360°, -360°) el más cercano al pan actual
10. Aplicar `panInvert` / `tiltInvert` (255 - dmx)
11. Clamp safety margin (±5 DMX) + `tiltLimits`

**Mount Semantics (SSOT — mountTransforms.ts):**

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\mountTransforms.ts" lines="96-105" />

| Orientation | Facing | BackFacing | WallSide | Yaw (IK) |
|---|---|---|---|---|
| `ceiling` | down | false | none | 0 |
| `truss-front` | down | false | none | 0 |
| `truss-back` | down | **true** | none | π (180°) |
| `floor` | up | false | none | 0 |
| `totem` | up | false | none | 0 |
| `wall-left` | down | false | left | π/2 (90°) |
| `wall-right` | down | false | right | -π/2 (-90°) |

**Invariantes IK:**
- `pitchRad` SIEMPRE es 0 — la verticalidad la resuelve el signo de `dy` en `atan2(horizontalDist, -local.y)`
- Solo `yawRad` varía para backFacing y paredes
- `rollRad` siempre 0 en IK

### 1.9 Spatial Fanning — Dispersión Geométrica

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\InverseKinematicsEngine.ts" lines="107-116" />

| Modo | Descripción | Uso |
|---|---|---|
| `converge` | Todos los fixtures apuntan al mismo target | Focus único |
| `line` | Fixtures distribuidos equidistantes en línea perpendicular al vector centroide→target | Wall of light |
| `circle` | Fixtures distribuidos en arco circular alrededor del target | Abrazo espacial |

**Line Fan:** `t = (i / (N-1)) - 0.5` → offset = `t × amplitude` (metros, punta a punta)

---

## 2. PARÁMETROS EXPUESTOS — The Kinematics Sandbox

### 2.1 VIBE_CONFIG — Configuración Core por Vibe

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\VibeMovementManager.ts" lines="84-95" />

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `panScale` | number | 0.0-1.0 | UI Safe | Escala de amplitud Pan (1.0 = full range 540°) |
| `tiltScale` | number | 0.0-1.0 | UI Safe | Escala de amplitud Tilt (1.0 = full range 270°) |
| `baseFrequency` | number | 0.0-1.0 | Advanced | Frecuencia base en Hz (legacy, scheduler usa cycleBeats) |
| `patterns` | GoldenPattern[] | 16 patrones | UI Safe | Patrones disponibles para este vibe |
| `homeOnSilence` | boolean | true/false | UI Safe | Volver a home en silencio (o Ghost Protocol freeze) |

### 2.2 PATTERN_CONFIG — Scheduler por Patrón

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `cycleBeats` | number | 8-512 | UI Safe | Beats por ciclo completo (velocidad del foco) |
| `phraseDuration` | number | 16-1024 | UI Safe | Beats en escena antes de rotar (duración) |
| `safeHarborPhase` | number | 0-2π rad | Advanced | Fase donde el fixture está en posición segura |
| `safeHarborWindow` | number | 0-π rad | Advanced | Tolerancia angular del harbor (default π/4) |
| `hardDeadlineExtra` | number | 8-128 beats | Advanced | Beats extra de gracia anti-bloqueo |
| `transitionBeats` | number | 1-8 beats | UI Safe | Duración del LERP crossfade entre patrones |

### 2.3 STEREO_CONFIG — Simetría y Desfase

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `offset` | number | 0-π rad | UI Safe | Offset de fase entre fixtures consecutivos |
| `type` | enum | 3 valores | UI Safe | `'sync'` \| `'snake'` \| `'mirror'` |

### 2.4 TILT_OFFSET_BY_VIBE — Audience Bias

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `tiltOffset` (per vibe) | number | -0.50 a 0.0 | UI Safe | Offset de tilt para bias de audiencia |

### 2.5 MovementPhysics — Personalidad Física por Vibe

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\VibeMovementPresets.ts" lines="22-56" />

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `maxAcceleration` | number | 6-900 DMX/s² | UI Safe | Aceleración máxima (capado por SAFETY_CAP 900) |
| `maxVelocity` | number | 12-400 DMX/s | UI Safe | Velocidad máxima (capado por SAFETY_CAP 400) |
| `friction` | number | 0.0-1.0 | UI Safe | Slew rate limit / inercia |
| `arrivalThreshold` | number | 0.5-8.0 DMX | Advanced | Umbral de llegada (overshoot elegante) |
| `physicsMode` | enum | 2 valores | UI Safe | `'snap'` (persecución directa) \| `'classic'` (inercia) |
| `snapFactor` | number | 0.0-1.0 | UI Safe | Factor de snap (1.0 = instantáneo, <1 = smoothing) |
| `revLimitPanPerSec` | number | 15-300 DMX/s | UI Safe | Límite de velocidad pan (protección de correas) |
| `revLimitTiltPerSec` | number | 10-240 DMX/s | UI Safe | Límite de velocidad tilt (protección de correas) |

### 2.6 OpticsConfig — Óptica por Vibe

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `zoomDefault` | number | 0-255 | UI Safe | Zoom default (0=Beam, 255=Wash) |
| `zoomRange` | {min, max} | 0-255 | UI Safe | Rango de zoom permitido |
| `focusDefault` | number | 0-255 | UI Safe | Foco default (0=Sharp, 255=Soft) |
| `focusRange` | {min, max} | 0-255 | UI Safe | Rango de foco permitido |
| `irisDefault` | number | 0-255 | Advanced | Iris default (si existe) |

### 2.7 MovementBehavior — Comportamiento por Vibe

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `homeOnSilence` | boolean | true/false | UI Safe | Volver a home en silencio |
| `syncToBeat` | boolean | true/false | UI Safe | Sincronizar con beat |
| `allowRandomPos` | boolean | true/false | UI Safe | Permitir posiciones random |
| `smoothFactor` | number | 0.0-1.0 | UI Safe | Smoothing extra (0=seco, 1=ultra suave) |

### 2.8 GrandMaster Speed & Chaos (Runtime)

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `globalSpeedMultiplier` | number | 0.1-2.0 | UI Safe | Multiplicador global de velocidad IA |
| `globalChaosAmount` | number | 0.0-1.0 | UI Safe | Amplitud del caos global (slider) |
| `globalChaosSeed` | number | 0-65535 | Advanced | Semilla determinista del caos |
| `manualSpeedOverride` | number \| null | 0-100 | UI Safe | Override manual de velocidad (%) |
| `manualAmplitudeOverride` | number \| null | 0-100 | UI Safe | Override manual de amplitud (%) |
| `manualPatternOverride` | string \| null | 16 patrones | UI Safe | Override manual de patrón |

### 2.9 IK Engine Parameters — Spatial Targeting

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `target` | Target3D | metros | UI Safe | Punto objetivo en espacio del escenario |
| `fixture.position` | Position3D | metros | UI Safe | Posición del fixture |
| `fixture.orientation.installation` | enum | 7 valores | UI Safe | ceiling/truss-front/truss-back/floor/totem/wall-left/wall-right |
| `fixture.orientation.rotation` | Rotation3D | grados | Advanced | Rotación personalizada pitch/yaw/roll |
| `fixture.limits.panRangeDeg` | number | 360-540° | UI Safe | Rango total de pan |
| `fixture.limits.tiltRangeDeg` | number | 180-270° | UI Safe | Rango total de tilt |
| `fixture.limits.tiltLimits` | {min, max} | 0-255 DMX | UI Safe | Límites DMX de seguridad para tilt |
| `fixture.calibration.panOffset` | number | grados | Advanced | Compensación mecánica pan |
| `fixture.calibration.tiltOffset` | number | grados | Advanced | Compensación mecánica tilt |
| `fixture.calibration.panInvert` | boolean | true/false | UI Safe | Eje pan invertido por montaje |
| `fixture.calibration.tiltInvert` | boolean | true/false | UI Safe | Eje tilt invertido por montaje |

### 2.10 Spatial Fan Parameters

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `fanMode` | enum | 3 valores | UI Safe | `'converge'` \| `'line'` \| `'circle'` |
| `fanAmplitude` | number | 0-10 metros | UI Safe | Amplitud total del spread (punta a punta) |

### 2.11 FixturePhysicsDriver — Hardware Limits

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `physicsProfile.maxVelocity` | number | °/s | UI Safe | Velocidad máxima del motor (grados/segundo) |
| `physicsProfile.maxAcceleration` | number | °/s² | UI Safe | Aceleración máxima del motor |
| `physicsProfile.qualityTier` | enum | 3 valores | UI Safe | `'budget'` \| `'mid'` \| `'pro'` (auto-tune) |
| `physicsProfile.panSpeedFactor` | number | 0.1-2.0 | Advanced | Multiplicador de velocidad pan |
| `physicsProfile.tiltSpeedFactor` | number | 0.1-2.0 | Advanced | Multiplicador de velocidad tilt |
| `SAFETY_CAP.maxAcceleration` | number | 900 DMX/s² | **FIXED** | Límite absoluto del sistema (no editable) |
| `SAFETY_CAP.maxVelocity` | number | 400 DMX/s | **FIXED** | Límite absoluto del sistema (no editable) |

### 2.12 Resumen de Variables Exponibles al UI

| Categoría | UI Safe | Advanced | FIXED | Total |
|---|---|---|---|---|
| VIBE_CONFIG | 4 | 1 | 0 | 5 |
| PATTERN_CONFIG | 3 | 3 | 0 | 6 |
| STEREO_CONFIG | 2 | 0 | 0 | 2 |
| TILT_OFFSET | 1 | 0 | 0 | 1 |
| MovementPhysics | 7 | 1 | 0 | 8 |
| OpticsConfig | 4 | 1 | 0 | 5 |
| MovementBehavior | 4 | 0 | 0 | 4 |
| GrandMaster & Chaos | 4 | 1 | 0 | 5 |
| IK Engine | 6 | 2 | 0 | 8 |
| Spatial Fan | 2 | 0 | 0 | 2 |
| Hardware Limits | 3 | 2 | 0 | 5 |
| SAFETY_CAP | 0 | 0 | 2 | 2 |
| **TOTAL** | **40** | **11** | **2** | **53** |

---

## 3. INTEGRACIÓN DE VIBES — Las 4 Constituciones Canónicas de Movimiento

### 3.1 Tabla Comparativa de las 4 Constituciones

| Parámetro | Techno | Latino | Pop/Rock | Chill |
|---|---|---|---|---|
| **VIBE_CONFIG** | | | | |
| `panScale` | 0.92 | 0.95 | 0.90 | 0.85 |
| `tiltScale` | 0.60 | 0.85 | 0.59 | 0.58 |
| `baseFrequency` | 0.15 | 0.12 | 0.14 | 0.02 |
| `patterns` | 7 (scan_x, square, diamond, botstep, darkspin, laser_grid, industrial_pendulum) | 5 (figure8, wave_y, ballyhoo, cadera_libre, espiral_conga) | 3 (circle_big, cancan, dual_sweep) | 3 (drift, sway, breath) |
| `homeOnSilence` | false | false | true | false |
| **STEREO_CONFIG** | | | | |
| `offset` | π (180°) | π/4 (45°) | π/3 (60°) | π/2 (90°) |
| `type` | `mirror` | `snake` | `snake` | `snake` |
| **TILT_OFFSET (floor)** | -0.35 | -0.15 | -0.30 | -0.25 |
| **MovementPhysics** | | | | |
| `maxAcceleration` | 500 | 650 | 700 | 6 |
| `maxVelocity` | 300 | 310 | 280 | 12 |
| `friction` | 0.08 | 0.06 | 0.15 | 0.95 |
| `arrivalThreshold` | 0.5 | 2.0 | 1.0 | 8.0 |
| `physicsMode` | `snap` | `snap` | `classic` | `classic` |
| `snapFactor` | 0.85 | 0.88 | 0.70 | 0.0 |
| `revLimitPanPerSec` | 280 | 300 | 260 | 15 |
| `revLimitTiltPerSec` | 220 | 240 | 200 | 10 |
| **OpticsConfig** | | | | |
| `zoomDefault` | 30 (beam) | 150 (spot suave) | 220 (wash) | 255 (wash total) |
| `zoomRange` | [0, 80] | [80, 200] | [150, 255] | [200, 255] |
| `focusDefault` | 20 (nítido) | 100 (medio) | 180 (difuso) | 255 (nebulosa) |
| `focusRange` | [0, 50] | [50, 180] | [100, 255] | [200, 255] |
| **MovementBehavior** | | | | |
| `homeOnSilence` | false | false | true | false |
| `syncToBeat` | true | true | false | false |
| `allowRandomPos` | false | true | false | true |
| `smoothFactor` | 0.1 | 0.5 | 0.2 | 0.9 |

### 3.2 Detalle por Vibe

#### 3.2.1 Techno-Club — "Catedral Industrial de Neón"

**Filosofía:** Geometría dura, cortes precisos, barridos enormes. Bunker noruego viendo auroras boreales.

**Movimiento:**
- **7 patrones** — el catálogo más amplio. Geometría industrial: barridos, cuadrados, rombos, robos cuantizados, órbitas oscuras, escáneres láser, péndulos pesados.
- **panScale 0.92** — barrido enorme (92% del pan = ~497°).
- **tiltScale 0.60** — tilt contenido (no apuntar al techo).
- **Stereo mirror (180°)** — L/R espejos: las puertas del infierno abren y cierran simétricamente.
- **Tilt offset -0.35** — dancefloor gravity (apuntar a la pista).
- **Períodos 16-32 beats** — majestuosidad industrial, no epilepsia.
- **Ghost Protocol:** NO vuelve a home en silencio (mantiene posición en breakdown).

**Física:**
- **Snap mode** — persecución directa del target con snapFactor 0.85 (onda cuadrada redondeada).
- **maxVelocity 300 DMX/s** (~636°/s) — rápido pero realista.
- **friction 0.08** — frenado rápido para latigazos controlados.
- **revLimitPan 280 / tilt 220** — protección de correas.

**Óptica:**
- **Zoom 30 (beam cerrado)** — láser, corte limpio.
- **Focus 20 (nítido)** — bordes definidos.

#### 3.2.2 Fiesta-Latina — "Catedral Sensual del Caribe Nocturno"

**Filosofía:** Curvas, fluidez, caderas, alma. El reguetón moderno pide oscuridad y contraste.

**Movimiento:**
- **5 patrones** — fluidos y sensuales: lemniscata, ola en U, nudo trifolio, cadera sesgada, espiral conga.
- **panScale 0.95** — full stage pan (95% = ~513°).
- **tiltScale 0.85** — tilt abierto (85% = ~229°) para círculos amplios.
- **Stereo snake (45°)** — cadena de caderas, ola mexicana entre fixtures.
- **Tilt offset -0.15** — levanta la cabeza para hacer círculos amplios.
- **Períodos 12-48 beats** — cadencia relajada, meditativa.
- **Ghost Protocol:** NO vuelve a home (sigue bailando).

**Física:**
- **Snap mode** — snapFactor 0.88 (más fidelidad de seguimiento que techno).
- **maxVelocity 310 DMX/s** (~657°/s) — caderas con alma auténtica.
- **friction 0.06** — seda pura, mínima resistencia.
- **revLimitPan 300 / tilt 240** — espiral conga real.

**Óptica:**
- **Zoom 150 (spot suave)** — medio entre beam y wash.
- **Focus 100 (medio)** — foco medio.

#### 3.2.3 Pop-Rock — "Catedral Épica del Estadio"

**Filosofía:** Simetría, majestuosidad, wall of light. Los PAR64 reinan supremos.

**Movimiento:**
- **3 patrones** — simétricos y majestuosos: círculo gigante, cancan, barrido en U.
- **panScale 0.90** — arcos enormes de estadio (90% = ~486°).
- **tiltScale 0.59** — tilt contenido para wall of light horizontal.
- **Stereo snake (60°)** — wall ondulante, simetría de estadio.
- **Tilt offset -0.30** — estadio balanceado.
- **Períodos 8-32 beats** — monumentalidad solemne.
- **Home on silence:** SÍ — vuelve a home en breakdown (wall of light se apaga elegantemente).

**Física:**
- **Classic mode** — física con inercia, aceleración y frenado. Headbang con masa.
- **snapFactor 0.70** — reactividad en golpes pero con inercia.
- **maxVelocity 280 DMX/s** (~594°/s) — arcos potentes.
- **friction 0.15** — menos fricción = más inercia visual.
- **revLimitPan 260 / tilt 200** — arcos potentes con punch.

**Óptica:**
- **Zoom 220 (wash abierto)** — wall of light difuso.
- **Focus 180 (suave)** — difuso para baño de color.

#### 3.2.4 Chill-Lounge — "Catedral Submarina del Abismo Oceánico"

**Filosofía:** Glacial, nebuloso, meditativo. La medusa flota en corrientes submarinas. El océano no escucha, simplemente ES.

**Movimiento:**
- **3 patrones** — orgánicos y ambientales: deriva browniana, péndulo suave, respiración.
- **panScale 0.85** — la medusa abarca más océano.
- **tiltScale 0.58** — tilt contenido (no cegar).
- **Stereo snake (90°)** — ola de mar lenta entre fixtures.
- **Tilt offset -0.25** — abismo oceánico.
- **Períodos 192-512 beats** — velocidad de catedral submarina (64-128 segundos por ciclo a 120 BPM).
- **Chill sedation factor 0.80** — reduce effectiveBeats al 80% (movimiento aún más lento).
- **Ghost Protocol:** NO vuelve a home (flota eternamente).

**Física:**
- **Classic mode** — inercia oceánica, agua densa.
- **snapFactor 0.0** — sin snap, pura navegación.
- **maxVelocity 12 DMX/s** (~25°/s) — medusa con corriente mínima.
- **maxAcceleration 6 DMX/s²** — arranque imperceptible.
- **friction 0.95** — agua densa pero no gelatina.
- **arrivalThreshold 8.0** — importa flotar, no llegar.
- **revLimitPan 15 / tilt 10** — ~32°/s y ~21°/s (glacial).

**Óptica:**
- **Zoom 255 (wash total)** — nebulosa completa.
- **Focus 255 (desenfocado)** — difuso máximo.

### 3.3 IDLE — "El Limbo"

Estado neutro de espera. Respiración imperceptible.
- 1 patrón (`breath`), panScale 0.15, tiltScale 0.20, baseFrequency 0.04.
- Classic mode, maxVelocity 60 DMX/s, snapFactor 0.0.
- Home on silence: SÍ. Sync to beat: NO.

---

## 4. ARQUITECTURA DE CLASES

```
VibeMovementManager (singleton, stateful — THE CHOREOGRAPHER)
├── VIBE_CONFIG: Record<vibeId, VibeConfig>  (5 vibes)
├── PATTERN_PERIOD: Record<GoldenPattern, number>  (legacy fallback)
├── PATTERN_CONFIG: Record<GoldenPattern, PatternConfig>  (WAVE 4741)
├── STEREO_CONFIG: Record<vibeId, StereoConfig>  (5 vibes)
├── TILT_OFFSET_BY_VIBE: Record<vibeId, number>  (5 vibes)
├── PATTERNS: Record<GoldenPattern, PatternFunction>  (16 patrones)
├── UI_TO_GOLDEN_PATTERN: Record<string, GoldenPattern>  (Babel Fish)
├── schedulerState: { patternIndex, phase, sceneBeatsElapsed }
├── kineticTransition: { active, fromPattern, fromPhaseSnapshot, progressBeats, totalBeats }
├── smoothedBPM, globalSpeedMultiplier, globalChaosAmount/Seed
├── manualSpeedOverride, manualAmplitudeOverride, manualPatternOverride
├── _l2Active, _l2PhaseOverrides (fan distribute)
├── generateIntent(vibeId, audio, idx, total, maxSpeed, phaseOffset, mountOrientation)
├── selectPattern(config, audio)
├── calculateEffectiveAmplitude(base, bpm, period, energy, maxSpeed)  [Gearbox]
├── setGlobalSpeedMultiplier(mult)
├── setGlobalChaos(amount, seed)
├── setManualSpeed/Amplitude/Pattern(override)
├── setL2Active(active), setKineticFanOffsets(offsets)
├── getCurrentPatternName(), getVibeConfig(vibeId), getAvailablePatterns()
└── resetTime()

VibeMovementPresets (static)
├── MOVEMENT_PRESETS: Record<vibeId, MovementPreset>  (5 vibes)
├── getMovementPreset(vibeId) → MovementPreset
├── getMovementPhysics(vibeId) → MovementPhysics
├── getOpticsConfig(vibeId) → OpticsConfig
├── getMovementBehavior(vibeId) → MovementBehavior
└── getAvailableVibeIds()

InverseKinematicsEngine (pure functions)
├── solve(fixture, target, currentPanDMX) → IKResult
├── solveInto(out, fixture, target, currentPanDMX)  [zero-alloc]
├── solveGroup(fixtures, target, currentPanDMXMap) → Map<id, IKResult>
├── solveGroupWithFan(fixtures, target, fanMode, amplitude) → IKFanResult[]
├── computeLineFanOffsets(positions, target, amplitude)
├── computeCircleFanOffsets(positions, target, amplitude)
├── buildIKFixtureProfile(fixture) → IKFixtureProfile
├── rotateToLocalFrame(dx, dy, dz, pitch, yaw, roll)  [Euler YXZ inverso]
├── resolveShortestPanPath(rawDMX, currentDMX, panRange)  [anti-flip]
├── dmxToDegrees(dmx, rangeDeg)
└── setIKDebug(enabled), isIKDebug()

mountTransforms (SSOT — pure)
├── MOUNT_SEMANTICS: Readonly<Record<Orientation, MountSemantics>>  (7 orientaciones)
├── getMountSemantics(orientation) → MountSemantics
├── getIKMountAngles(orientation) → MountTransform  [pitch siempre 0]
└── getVisualMountTransform(orientation) → MountTransform  [pitch π para floor/totem]

FixturePhysicsDriver (stateful, per-fixture)
├── configs: Map<fixtureId, FixtureConfig>
├── currentPositions, velocities, _antiJitterState
├── SAFETY_CAP: { maxAcceleration: 900, maxVelocity: 400 }  [FIXED]
├── INSTALLATION_PRESETS: Record<type, FixtureConfig>
├── setVibe(vibeId) → aplica MovementPhysics del preset
├── registerFixture(fixtureId, config)
├── setPhysicsProfile(fixtureId, profile)
├── renderFromTarget(fixtureId, targetDMX, deltaTime) → Position2D
├── getEffectivePhysicsLimits(config)  [3-tier: SAFETY_CAP → Vibe → Hardware]
├── _applyAntiJitterSmooth(fixtureId, rawPan, rawTilt)
├── abstractToTargetDMX(x, y, config)
├── applySafetyLimits(targetDMX, config)
└── getDebugInfo()

MovementGenerators (pure helpers)
├── vmmCoordToProtocol(vmmCoord) → 0-1
├── calculateGearboxBudget(vibeId) → DMX/s
├── buildVMMContext(audio, musical) → AudioContext
├── assembleStereoMovementIntent(intentL, intentR) → ProtocolMovementIntent
├── generateStereoMovement(vibeId, audio, musical, mountOrientation) → ProtocolMovementIntent
└── buildMechanicsBypassIntent(mechL, mechR) → ProtocolMovementIntent  [DEEP FIELD]
```

---

## 5. RECOMENDACIONES PARA EL CUSTOM VIBE MOVEMENT EDITOR

### 5.1 Parámetros UI Safe (low-risk, alta impacto visual)

| Parámetro | Impacto | Recomendación UI |
|---|---|---|
| `panScale` | Alto — alcance horizontal | Slider 0-1 con preview del arco |
| `tiltScale` | Alto — alcance vertical | Slider 0-1 con preview del arco |
| `patterns[]` | Alto — vocabulario de movimiento | Multi-select de 16 patrones con preview animado |
| `homeOnSilence` | Medio — comportamiento en silencio | Toggle (Ghost Protocol vs Home) |
| `stereo.type` | Alto — simetría del ensemble | Radio: Sync / Snake / Mirror |
| `stereo.offset` | Alto — desfase entre fixtures | Slider 0-180° con visualización de ola |
| `tiltOffset` (floor) | Alto — bias de audiencia | Slider -0.50 a 0.0 con preview |
| `physicsMode` | Alto — personalidad del motor | Radio: Snap / Classic |
| `maxVelocity` | Alto — velocidad máxima | Slider 12-400 DMX/s con preset por tier |
| `maxAcceleration` | Alto — punch del motor | Slider 6-900 DMX/s² |
| `friction` | Medio — inercia/suavizado | Slider 0-1 |
| `snapFactor` | Alto — fidelidad de seguimiento | Slider 0-1 (solo si mode=snap) |
| `revLimitPanPerSec` | Medio — protección de correas | Slider 15-300 DMX/s |
| `revLimitTiltPerSec` | Medio — protección de correas | Slider 10-240 DMX/s |
| `zoomDefault` | Alto — tipo de haz | Slider 0-255 (Beam ↔ Wash) |
| `focusDefault` | Medio — nitidez del haz | Slider 0-255 (Sharp ↔ Soft) |
| `zoomRange` | Medio — rango de zoom | Dual-slider 0-255 |
| `focusRange` | Medio — rango de foco | Dual-slider 0-255 |
| `syncToBeat` | Medio — sincronización rítmica | Toggle |
| `allowRandomPos` | Bajo — variación orgánica | Toggle |
| `smoothFactor` | Medio — suavizado extra | Slider 0-1 |
| `cycleBeats` | Alto — velocidad del patrón | Slider 8-512 beats |
| `phraseDuration` | Alto — duración en escena | Slider 16-1024 beats |
| `transitionBeats` | Medio — suavidad de transición | Slider 1-8 beats |
| `globalSpeedMultiplier` | Alto — velocidad global IA | Slider 0.1-2.0 |
| `globalChaosAmount` | Alto — caos del ensemble | Slider 0-1 |
| `fanMode` | Alto — dispersión espacial | Radio: Converge / Line / Circle |
| `fanAmplitude` | Alto — amplitud del fan | Slider 0-10 metros |
| `qualityTier` | Medio — auto-tune de hardware | Dropdown: Budget / Mid / Pro |

### 5.2 Parámetros Advanced (requieren conocimiento técnico)

| Parámetro | Razón |
|---|---|
| `baseFrequency` | Legacy — el scheduler usa cycleBeats ahora |
| `safeHarborPhase` | Fase matemática — requiere entender el patrón |
| `safeHarborWindow` | Tolerancia angular — default π/4 es correcto |
| `hardDeadlineExtra` | Anti-bloqueo — default cycleBeats es correcto |
| `arrivalThreshold` | Umbral técnico de llegada |
| `irisDefault` | Solo si el fixture tiene iris físico |
| `globalChaosSeed` | Semilla determinista — debug avanzado |
| `fixture.orientation.rotation` | Rotación personalizada pitch/yaw/roll |
| `fixture.calibration.panOffset/tiltOffset` | Compensación mecánica — calibración física |
| `physicsProfile.panSpeedFactor/tiltSpeedFactor` | Multiplicadores técnicos de velocidad |

### 5.3 Parámetros FIXED (NO exponibles — son seguridad del sistema)

| Parámetro | Valor | Razón |
|---|---|---|
| `SAFETY_CAP.maxAcceleration` | 900 DMX/s² | Límite absoluto — protege todos los motores |
| `SAFETY_CAP.maxVelocity` | 400 DMX/s | Límite absoluto — protege todas las correas |
| `TILT_CEILING` | 0.15 | Límite superior de tilt — no apuntar al techo |
| `TILT_FLOOR_LIMIT` | 0.50 | Límite inferior de tilt — no apuntar al horizonte trasero |
| `TILT_OFFSET_CEILING` | -0.325 | Offset de ceiling — centrado en semiesfera inferior |
| `GIMBAL_LOCK_EPSILON` | 50mm | Zona de singularidad blindada del IK |
| `PAN_SAFETY_MARGIN` | 5 DMX | Margen de seguridad pan — nunca golpear topes |
| `BPM_SMOOTH_FACTOR` | 0.05 | Filtro paso-bajo BPM — estabilidad temporal |
| `GEARBOX_MIN_AMPLITUDE` | 0.10 | Floor del gearbox — permite presets controlen amplitud |
| `Phrase Envelope range` | [0.85, 1.00] | Breathing amplifier — mantiene identidad geométrica |

### 5.4 Arquitectura Sugerida para el Editor

```
Custom Vibe Movement Editor (UI)
    │
    ├─ Template Selection (clone from existing vibe)
    │
    ├─ Pattern Vocabulary Panel
    │   ├─ Available patterns (multi-select de 16 patrones)
    │   ├─ Pattern order (drag & drop para reordenar rotación)
    │   ├─ Per-pattern config:
    │   │   ├─ cycleBeats (slider 8-512)
    │   │   ├─ phraseDuration (slider 16-1024, múltiplo de cycleBeats)
    │   │   └─ transitionBeats (slider 1-8)
    │   └─ Live preview (animación del patrón en mini-canvas)
    │
    ├─ Amplitude & Range Panel
    │   ├─ panScale (slider 0-1 con preview del arco horizontal)
    │   ├─ tiltScale (slider 0-1 con preview del arco vertical)
    │   ├─ tiltOffset (slider -0.50 a 0.0 con preview de bias)
    │   └─ Mount orientation preview (floor/ceiling/totem/truss/wall)
    │
    ├─ Stereo & Symmetry Panel
    │   ├─ Type (radio: Sync / Snake / Mirror)
    │   ├─ Offset (slider 0-180° con visualización de ola entre fixtures)
    │   └─ Live preview (4-8 fixtures simulados con desfase)
    │
    ├─ Physics Personality Panel
    │   ├─ physicsMode (radio: Snap / Classic)
    │   ├─ maxVelocity (slider 12-400 DMX/s)
    │   ├─ maxAcceleration (slider 6-900 DMX/s²)
    │   ├─ friction (slider 0-1)
    │   ├─ snapFactor (slider 0-1, solo si mode=snap)
    │   ├─ revLimitPanPerSec (slider 15-300)
    │   ├─ revLimitTiltPerSec (slider 10-240)
    │   ├─ arrivalThreshold (slider 0.5-8.0)
    │   └─ Hardware tier dropdown (budget/mid/pro → auto-tune)
    │
    ├─ Optics Panel
    │   ├─ zoomDefault (slider 0-255, Beam ↔ Wash)
    │   ├─ zoomRange (dual-slider 0-255)
    │   ├─ focusDefault (slider 0-255, Sharp ↔ Soft)
    │   ├─ focusRange (dual-slider 0-255)
    │   └─ Beam preview (visualización del haz resultante)
    │
    ├─ Behavior Panel
    │   ├─ homeOnSilence (toggle: Ghost Protocol vs Home)
    │   ├─ syncToBeat (toggle)
    │   ├─ allowRandomPos (toggle)
    │   └─ smoothFactor (slider 0-1)
    │
    ├─ Spatial Targeting Panel (IK)
    │   ├─ Fan mode (radio: Converge / Line / Circle)
    │   ├─ Fan amplitude (slider 0-10 metros)
    │   ├─ Stage visualization (top-down view con fixtures y target)
    │   └─ Per-fixture IK preview (rayos al sub-target calculado)
    │
    ├─ GrandMaster Panel (runtime overrides)
    │   ├─ globalSpeedMultiplier (slider 0.1-2.0)
    │   ├─ globalChaosAmount (slider 0-1)
    │   └─ Manual overrides (pattern/speed/amplitude — null = AI control)
    │
    ├─ Live Preview
    │   ├─ 3D stage view con fixtures simulados
    │   ├─ Trayectoria del patrón activo (trail visualization)
    │   ├─ Stereo ensemble view (4-8 fixtures con desfase)
    │   ├─ Gearbox budget indicator (velocidad pico vs límite hardware)
    │   ├─ Phrase envelope visualization (breathing amplifier)
    │   └─ Real-time MovementIntent generation con mock audio
    │
    └─ Export → VIBE_CONFIG + PATTERN_CONFIG + MovementPreset JSON
```

---

## 6. ARCHIVOS CLAVE

| Archivo | Rol |
|---|---|
| `VibeMovementManager.ts` | THE CHOREOGRAPHER — genera trayectorias, scheduler, gearbox, stereo |
| `VibeMovementPresets.ts` | Presets de física + óptica + comportamiento por vibe |
| `InverseKinematicsEngine.ts` | Solver IK puro — Target3D → Pan/Tilt DMX |
| `mountTransforms.ts` | SSOT de semántica de montaje (IK + visual) |
| `FixturePhysicsDriver.ts` | Driver de física per-fixture (snap/classic, anti-jitter, safety) |
| `MovementGenerators.ts` | Helpers puros — generateStereoMovement, gearbox budget |
| `FixtureManager.ts` | Gestión de fixtures registrados |
| `ChaosHash.ts` | Hash determinista para caos per-nodo |
| `index.ts` | Barrel export del módulo movement |
