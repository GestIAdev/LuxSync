# WAVE 4523.1 — THE KINETIC TRACE
## Radiografía del Pipeline de Movimiento Legacy (VMM → HAL)

> **Estado:** INVESTIGACIÓN Y DOCUMENTACIÓN — PROHIBIDO proponer diseño de integración Aether.
> **Fecha:** 2026-05-02

---

## 1. ARQUITECTURA GLOBAL

```mermaid
flowchart TB
    subgraph COREO["1. COREÓGRAFO — VMM"]
        V1[generateIntent()<br/>Abstract 2D (-1..+1)]
        V2[Monotonic Phase Accumulator]
        V3[Golden Patterns]
        V4[Gearbox]
        V5[Stereo Config]
    end
    subgraph PUENTE["2. PUENTE — TitanEngine + Arbiter"]
        T1[generateStereoMovement()]
        T2[mechanicsL / mechanicsR]
        A1[Arbiter.getTitanValuesForFixture()]
    end
    subgraph HAL["3. HAL — Física + DMX"]
        H1[renderFromTarget()]
        H2[FixturePhysicsDriver]
        H3[applyCalibrationOffsets()]
        H4[FixtureState]
    end
    subgraph IK["4. IK ENGINE (OFF-MAINLINE)"]
        I1[solve() Target3D → DMX]
        I2[solveGroupWithFan()]
    end
    V2 --> V3 --> V4 --> V5 --> V1
    V1 --> T1 --> T2 --> A1 --> H1
    H1 --> H2 --> H3 --> H4
    I1 -.->|Spatial Target UI| H1
```

---

## 2. EL COREÓGRAFO — VibeMovementManager

### 2.1 Firma de generateIntent()

```typescript
// VibeMovementManager.ts:626
generateIntent(
  vibeId: string,              // techno-club | fiesta-latina | pop-rock | chill-lounge
  audio: AudioContext,         // { energy, bass, mids, highs, bpm, beatPhase, beatCount }
  fixtureIndex: number = 0,    // 0=L, 1=R
  totalFixtures: number = 1,  // STEREO_TOTAL = 2
  fixtureMaxSpeed: number = 250 // DMX/s per-fixture hardware limit
): MovementIntent { x, y, pattern, speed, amplitude, phaseType }
```

### 2.2 Monotonic Phase Accumulator (WAVE 2088.10)

**Problema resuelto:** `phase = (beatCount % patternPeriod) * 2π` causaba teleportes cuando BPM fluctuaba 70→184.

**Solucion:**
```typescript
private phaseAccumulator: number = 0
private smoothedBPM: number = 120
private readonly BPM_SMOOTH_FACTOR = 0.05

const isSameFrame = (now - this.lastUpdate) < 2

if (!isSameFrame) {
  this.smoothedBPM += (safeBPM - this.smoothedBPM) * 0.05
  const beatsPerSecond = this.smoothedBPM / 60
  const phasePerBeat = (2 * Math.PI) / patternPeriod  // FIXED
  const chillSedationFactor = vibeId === 'chill-lounge' ? 0.80 : 1.0
  const phaseDelta = beatsPerSecond * frameDeltaTime * phasePerBeat
                     * globalSpeedMultiplier * chillSedationFactor
  this.phaseAccumulator += phaseDelta
}
```

- `phaseAccumulator` solo avanza (flywheel), nunca teletransporta.
- `patternPeriod` es FIJO por patron. La energia solo modula AMPLITUD (continua), nunca periodo (discontinuo).
- `frameDeltaTime` cappeado a 100ms.

### 2.3 Golden Patterns + The Four Nobles

| Vibe | Patterns | Periodo | Amplitud |
|------|----------|---------|----------|
| **Techno** | scan_x, square, diamond, botstep | 8-16 beats | 0.70 |
| **Latino** | figure8, wave_y, ballyhoo | 8-16 beats | 0.65 |
| **Pop-Rock** | circle_big, cancan, dual_sweep | 8-16 beats | 0.45 |
| **Chill** | drift, sway, breath | 96-256 beats | 0.12 |

### 2.4 Gearbox

```typescript
calculateEffectiveAmplitude(baseAmplitude, bpm, patternPeriod, energy, fixtureMaxSpeed=250):
  HARDWARE_MAX_SPEED = fixtureMaxSpeed
  secondsPerBeat = 60 / bpm
  maxTravelPerCycle = HARDWARE_MAX_SPEED * secondsPerBeat * patternPeriod
  energyBoost = 1.0 + energy * 0.2
  requestedAmplitude = baseAmplitude * energyBoost
  requestedTravel = 255 * requestedAmplitude
  gearboxFactor = min(1.0, maxTravelPerCycle / requestedTravel)
  return min(1.0, max(0.10, requestedAmplitude * gearboxFactor))
```

Pipeline: baseAmplitude → +20% energy boost → compute DMX travel → compare vs hardware maxTravelPerCycle → scale down if needed → floor 0.10.

### 2.5 Phrase Envelope (WAVE 2086.3)

Sobre la amplitud del Gearbox, cada 32 beats:
- Beat 0-7: 0.85→0.90 (arranque contenido)
- Beat 8-19: 0.90→1.00 (expansion)
- Beat 20-23: 1.00 (climax)
- Beat 24-31: 1.00→0.85 (relajacion)

### 2.6 Desfase Estereo

| Vibe | Tipo | Offset | Efecto |
|------|------|--------|--------|
| Techno | mirror | π | Fixture impar invierte X |
| Latino | snake | π/4 | Rotacion de phase 45 por fixture |
| Pop-Rock | snake | π/3 | Ondulacion 60 |
| Chill | snake | π/2 | Ola lenta 90 |
| Idle | sync | 0 | Sin desfase |

**Snake:** rota el vector (x,y) alrededor del centro por `fixtureIndex * offset`.
**Mirror:** `x = x * (fixtureIndex % 2 === 0 ? 1 : -1)`.
**Smooth Transition:** Si patron cambia, 2 segundos de LERP ease-out.

---

## 3. ACOPLAMIENTO LEGACY — TitanEngine + ArbitrationDirector

### 3.1 generateStereoMovement()

Pure module en `MovementGenerators.ts`:
1. `buildVMMContext(audio, musical)` → AudioContext para VMM
2. `calculateGearboxBudget(vibeId)` → `min(vibeMaxVelocity, 400)`
3. `vibeMovementManager.generateIntent(..., 0, 2, gearbox)` → intentL
4. `vibeMovementManager.generateIntent(..., 1, 2, gearbox)` → intentR
5. `assembleStereoMovementIntent(intentL, intentR)`

### 3.2 Conversion de Coordenadas

```typescript
function vmmCoordToProtocol(vmmCoord: number): number {
  return Math.max(0, Math.min(1, 0.5 + vmmCoord * 0.5))
}
```

VMM (-1..+1) → Protocol (0..1): `-1→0`, `0→0.5`, `+1→1.0`.

### 3.3 ProtocolMovementIntent

```typescript
interface MovementIntent {
  pattern: string
  speed: number
  amplitude: number
  centerX: number      // 0-1 promedio L+R
  centerY: number
  beatSync: boolean
  phaseType: 'linear' | 'polar'
  mechanicsL: { pan: number; tilt: number }  // 0-1
  mechanicsR: { pan: number; tilt: number }
}
```

### 3.4 ArbitrationDirector — Routing a Fixtures

`getTitanValuesForFixture()` (ArbitrationDirector.ts:1457):

```typescript
if (intent.movement && isMover(fixture)) {
  let mechanic = null

  if (intent.movement.mechanicsL && intent.movement.mechanicsR) {
    mechanic = isLeftFixture ? intent.movement.mechanicsL : intent.movement.mechanicsR
  }
  if (!mechanic && (intent as any).mechanics?.moverL) {
    mechanic = isLeftFixture ? rootMech.moverL : rootMech.moverR
  }

  if (mechanic) {
    defaults.pan = mechanic.pan * 255
    defaults.tilt = mechanic.tilt * 255
  } else if (moverCount > 1) {
    const spreadFactor = 0.15
    const offset = (moverIndex * spreadFactor) - (totalSpread / 2)
    defaults.pan = clamp01(basePan + offset) * 255
    defaults.tilt = clamp01(baseTilt + offset * 0.3) * 255
  } else {
    defaults.pan = intent.movement.centerX * 255
    defaults.tilt = intent.movement.centerY * 255
  }
}
```

**isLeft:** `posX < -0.1` OR `name.includes('left')` OR `zone.includes('moving_left')`.

---

## 4. HAL — FISICA Y CALIBRACION

### 4.1 FixturePhysicsDriver

Interpolacion target DMX → physical DMX:
- **CLASSIC:** Curva S con aceleracion/deceleracion
- **SNAP:** `snapFactor * delta + REV_LIMIT` (robotic, techno/rock)

```typescript
this.movementPhysics.translateDMX(
  fixtureId,
  state.pan,       // target DMX 0-255 (del Arbiter)
  state.tilt,
  physicsDt,       // ms real desde ultimo frame
  isManualPosition // fast-track si manual
)
```

Anti-Jitter: umbral dinamico = 3% de maxVelocity.

### 4.2 applyCalibrationOffsets (WAVE 2093.1 / 2603)

Aplicado despues de interpolacion fisica, antes de emitir DMX:
1. INVERT (si calibration.panInvert / tiltInvert)
2. OFFSET grados→DMX: offsetDegrees / 540 * 255 (pan), / 270 * 255 (tilt)
3. TILT LIMITS (physics.tiltLimits.min/max)
4. FINAL CLAMP 0-255

**WAVE 2603 — IK Flag:** Si `state._ikProcessed === true`, se saltan pasos 1-2 (IKEngine ya aplico inversion/offset). TiltLimits y clamp final SIEMPRE.

### 4.3 FixtureState Final

```typescript
interface FixtureState {
  pan: number         // TARGET DMX 0-255 (del Arbiter)
  tilt: number
  physicalPan: number // ACTUAL post-physics interpolation
  physicalTilt: number
  panVelocity: number // DMX/s
  tiltVelocity: number
  speed: number       // 0-255 movement speed channel
}
```

---

## 5. MOTOR CINEMATICO — IKEngine (WAVE 2601)

### 5.1 solve() — Pipeline de 12 Pasos

```typescript
export function solve(
  fixture: IKFixtureProfile,   // position, orientation, limits, calibration
  target: Target3D,           // x,y,z en metros
  currentPanDMX: number | null // para anti-flip
): IKResult { pan, tilt, reachable, antiFlipApplied }
```

| Paso | Operacion |
|------|-----------|
| 1 | Vector fixture.position → target en coords escenario |
| 2 | rotateToLocalFrame() — inversa Euler YXZ de montaje |
| 3 | Gimbal Lock detect (horizontalDist < 0.001m) |
| 4 | panDeg = atan2(local.x, local.z); tiltDeg = atan2(-local.y, horizontalDist) |
| 5 | Aplicar calibracion en grados (panOffset, tiltOffset) |
| 6 | Grados → DMX: ((calibratedDeg + range/2) / range) * 255 |
| 7 | Anti-flip — shortest path: rawDMX vs rawDMX ± 360 equivalente |
| 8 | Aplicar panInvert / tiltInvert |
| 9 | Evaluar reachable |
| 10 | TiltLimits clamp |
| 11 | Pan safety margin (5 DMX units) |
| 12 | Final clamp 0-255 |

### 5.2 Anti-Flip

**Problema:** Pan range 540°. Target cruza frente al fixture → salto 0°→540° (1.5 vueltas violentas).

**Solucion:** Evaluar 3 candidatos DMX (raw, raw ± fullRotationDMX), filtrar los validos (>= -5, <= 260), elegir el mas cercano a currentPanDMX.

```typescript
fullRotationDMX = (360 / panRange) * 255
candidates = [rawDMX, rawDMX + fullRotationDMX, rawDMX - fullRotationDMX]
valid = candidates.filter(c => c >= -5 && c <= 260)
valid.sort((a,b) => abs(a - currentDMX) - abs(b - currentDMX))
return valid[0]
```

### 5.3 solveGroupWithFan()

```typescript
export function solveGroupWithFan(
  fixtures: IKFixtureProfile[],
  target: Target3D,
  fanMode: 'converge' | 'line' | 'circle',
  fanAmplitude: number,      // metros
  currentPanDMXMap: Map<string, number> | null
): Map<string, IKFanResult>  // incluye subTarget por fixture
```

- **converge:** Todos apuntan al mismo target.
- **line:** Sub-targets en linea perpendicular a centroide→target.
- **circle:** Sub-targets en circunferencia alrededor del target (radio = amplitude/2).

### 5.4 Sistema de Coordenadas del Escenario

```
X: Left(-) ← → Right(+)    desde perspectiva de audiencia
Y: Down(-)  ↕  Up(+)        0 = suelo
Z: Back(-)  ↔  Front(+)     0 = centro escenario
Unidad: metros
```

---

## 6. LA BRECHA — VMM 2D vs IK 3D

### 6.1 Paradigma VMM (Relativo 2D)

- Coordenadas abstractas (-1..+1) en plano normalizado.
- `x` = horizontal relativo (pan conceptual), `y` = vertical relativo (tilt conceptual).
- No conoce posicion fisica del fixture, orientacion de montaje, ni limites mecanicos.
- Fixture-agnostico: mismo valor a todos los fixtures de una zona, diferenciado solo por stereo offset.

### 6.2 Paradigma IKEngine (Absoluto 3D)

- Punto 3D absoluto en metros dentro del escenario real.
- Necesita `fixture.position`, `orientation.installation`, `limits.panRangeDeg`, `calibration`.
- Resultado unico por fixture: dos movers en distintas posiciones apuntando al mismo target producen pan/tilt distintos.

### 6.3 Discrepancias Fundamentales

| Aspecto | VMM | IKEngine |
|---------|-----|----------|
| Espacio | Plano abstracto (-1,+1) | Escenario 3D (metros) |
| Referencia | Relativo al fixture | Absoluto al escenario |
| Fixture-aware | NO | SI |
| Output | x,y abstractos | pan, tilt DMX calibrados |
| Stereo | Phase offset / mirror | Fanning espacial |
| Entrada | AudioContext (bpm, energy) | Target3D + IKFixtureProfile[] |

### 6.4 Estado Actual de Integracion

**VMM → Arbiter → HAL** es el flujo principal para movimiento automatizado. IKEngine NO participa.

**IKEngine** se invoca solo por la Spatial Target Pad (UI manual) y Group Formation UI:
- `applySpatialTarget()` construye Target3D + IKFixtureProfile[], llama `ikSolveGroupWithFan()`.
- Resultado se inyecta como Manual Override (Layer2) con source 'ui_joystick'.
- `_ikProcessed = true` marca que calibration ya esta aplicada.

**No existe conversion VMM→IK.** Para fusionarlos se necesitaria convertir (x,y) abstracto a Target3D proyectado desde la posicion del fixture, o redisenar VMM para generar Target3D espaciales.

### 6.5 Mapa de Archivos

| Archivo | Responsabilidad Movimiento |
|---------|---------------------------|
| `engine/movement/VibeMovementManager.ts` | Coreografia musical pura |
| `engine/generators/MovementGenerators.ts` | Ensamblaje estereo + conversion a protocolo |
| `engine/movement/FixturePhysicsDriver.ts` | Interpolacion fisica target→actual |
| `engine/movement/InverseKinematicsEngine.ts` | Cinematica inversa 3D |
| `core/arbiter/ArbitrationDirector.ts` | Routing mechanicsL/R a fixtures + IK trigger manual |
| `hal/HardwareAbstraction.ts` | Physics interpolation + calibration + DMX |

---

## 7. GLOSARIO

| Termino | Definicion |
|---------|-----------|
| Monotonic Phase Accumulator | Acumulador de fase que solo avanza, nunca salta. Evita teleportes cuando BPM fluctua. |
| Gearbox | Limitador de amplitud basado en velocidad maxima fisica del fixture (DMX/s). |
| Frame-Once Guard | Proteccion contra doble actualizacion de estado cuando TitanEngine llama generateIntent() dos veces por frame (L+R). |
| Mirror Stereo | Fixtures impares invierten eje X → efecto puertas que se abren/cierran. |
| Snake Stereo | Cada fixture rota el vector posicion alrededor del centro por un offset angular fijo. |
| Phrase Envelope | Modulacion de amplitud sobre 32 beats (0.85→1.0→0.85) para dar respiracion al movimiento. |
| Anti-Flip | Selecciona la representacion de pan (±360) que minimiza distancia DMX respecto a posicion actual. |
| Gimbal Lock | Cuando target esta directamente arriba/abajo del fixture, pan es indeterminado. Se preserva ultimo pan conocido. |
