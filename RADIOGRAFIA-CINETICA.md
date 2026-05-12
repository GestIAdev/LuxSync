# RADIOGRAFÍA CINÉTICA — PARÁMETROS HARDCODEADOS

> Extracción pura. Sin cálculos, sin conclusiones, sin arreglos. Solo los números exactos tal como aparecen en el código fuente actual.

---

## 1. CAPA L2 — Motor Manual (`AetherKineticEngine.ts`)

### Constantes de velocidad
```ts
const SPEED_MIN_HZ = 0.02   // 1 ciclo cada 50 s
const SPEED_MAX_HZ = 0.35   // 1 ciclo cada ~2.9 s
```

### Factor de escala en `tick()`
```ts
const scaledX = x * cfg.amplitude * 0.5
const scaledY = y * cfg.amplitude * 0.5

const panBase  = clamp01(anchorPan  + scaledX)
const tiltBase = clamp01(anchorTilt + scaledY)
```

### Factor de corrección esférica en `circle`
```ts
circle: (p) => ({
  x: Math.sin(p) * 0.5,   // corrección trampa esférica: Pan 540° / Tilt 270° = ratio 2:1
  y: Math.cos(p),
}),
```

### Fallback de ancla (radar)
```ts
const anchorPan  = (l2 && Number.isFinite(l2['pan_base']))  ? l2['pan_base']  : 0.5
const anchorTilt = (l2 && Number.isFinite(l2['tilt_base'])) ? l2['tilt_base'] : 0.5
```

### Clamp de entrada (setManualKinetics / updateScalars)
```ts
const speedClamped     = clamp01(speed)        // [0, 1]
const amplitudeClamped = clamp01(amplitude)    // [0, 1]
const fanClamped       = clampSigned(fan)      // [-1, 1]
```

---

## 2. CAPA L0 — Motor IA / Choreographer (`VibeMovementManager.ts`)

### GrandMaster Speed
```ts
private globalSpeedMultiplier: number = 0.6
setGlobalSpeedMultiplier(mult: number):
  this.globalSpeedMultiplier = Math.max(0.1, Math.min(2.0, mult))
```

### BPM smoothing
```ts
private smoothedBPM: number = 120
private readonly BPM_SMOOTH_FACTOR = 0.05   // 20 frames to converge
```

### Safe BPM clamp
```ts
private getSafeBPM(bpm: number): number {
  if (!bpm || !isFinite(bpm) || bpm <= 0) return 120
  return Math.max(60, Math.min(200, bpm))
}
```

### Per-fixture max speed (Gearbox input)
```ts
fixtureMaxSpeed: number = 250   // default DMX units/s if not provided
```

### Frame timing
```ts
let frameDeltaTime = 0.016     // default 60fps
frameDeltaTime = Math.min((now - this.lastUpdate) / 1000, 0.1)  // cap 100ms
const isSameFrame = (now - this.lastUpdate) < 1   // <1ms = same render frame
```

### Phase delta formula
```ts
const beatsPerSecond = this.smoothedBPM / 60
const phasePerBeat = (2 * Math.PI) / patternPeriod
const chillSedationFactor = vibeId === 'chill-lounge' ? 0.80 : 1.0
const manualSpeedFactor = this.manualSpeedOverride !== null
  ? Math.pow(2, (this.manualSpeedOverride - 50) / 50)
  : 1.0
const phaseDelta = beatsPerSecond * frameDeltaTime * phasePerBeat
  * this.globalSpeedMultiplier * manualSpeedFactor * chillSedationFactor
```

### Phrase envelope (WAVE 2086.3)
```ts
const phraseBeats = 32
const phraseProgress = (beatCount % phraseBeats) / phraseBeats
const phraseEnvelope = 0.925 + 0.075 * Math.sin(Math.PI * (phraseProgress - 0.15))
const clampedEnvelope = Math.max(0.85, Math.min(1.0, phraseEnvelope))
```

### Dancefloor gravity (tilt offset)
```ts
const tiltOffset = vibeId === 'techno-club' ? -0.20 : 0
```

### Transition duration
```ts
private readonly TRANSITION_DURATION_MS = 2000   // 2 s LERP entre patrones
```

### Output clamp
```ts
stereoPosition.x = Math.max(-1, Math.min(1, stereoPosition.x))
stereoPosition.y = Math.max(-1, Math.min(1, stereoPosition.y))
```

---

## 3. VIBE CONFIGURATIONS (`VibeMovementManager.ts`)

| Vibe | panScale | tiltScale | baseFrequency (Hz) |
|------|----------|-----------|-------------------|
| `techno-club` | 0.72 | 0.68 | 0.22 |
| `fiesta-latina` | 0.95 | 0.80 | 0.17 |
| `pop-rock` | 0.75 | 0.65 | 0.20 |
| `chill-lounge` | 0.70 | 0.70 | 0.04 |
| `idle` | 0.10 | 0.15 | 0.05 |

---

## 4. PATTERN PERIODS (`VibeMovementManager.ts`)

> Beats por ciclo completo del patrón.

| Patrón | Period (beats) |
|--------|---------------|
| **TECHNO** |
| `scan_x` | 8 |
| `square` | 16 |
| `diamond` | 8 |
| `botstep` | 8 |
| `darkspin` | 12 |
| **LATINO** |
| `figure8` | 16 |
| `wave_y` | 8 |
| `ballyhoo` | 16 |
| `cadera_libre` | 20 |
| `espiral_conga` | 24 |
| **POP-ROCK** |
| `circle_big` | 16 |
| `cancan` | 8 |
| `dual_sweep` | 16 |
| **CHILL** |
| `drift` | 256 |
| `sway` | 128 |
| `breath` | 96 |
| **THE FOUR NOBLES** |
| `slow_pan` | 32 |
| `tilt_nod` | 16 |
| `figure_of_4` | 16 |
| `chase_position` | 16 |

---

## 5. VIBE MOVEMENT PRESETS (`VibeMovementPresets.ts`)

### `techno-club`
```ts
maxAcceleration: 2000
maxVelocity: 600
friction: 0.08
arrivalThreshold: 0.1
physicsMode: 'snap'
snapFactor: 1.0
revLimitPanPerSec: 340
revLimitTiltPerSec: 320
```

### `fiesta-latina`
```ts
maxAcceleration: 1400
maxVelocity: 560
friction: 0.07
arrivalThreshold: 2.0
physicsMode: 'snap'
snapFactor: 0.90
revLimitPanPerSec: 520
revLimitTiltPerSec: 420
```

### `pop-rock`
```ts
maxAcceleration: 1100
maxVelocity: 450
friction: 0.20
arrivalThreshold: 1.0
physicsMode: 'classic'
snapFactor: 0.65
revLimitPanPerSec: 300
revLimitTiltPerSec: 200
```

### `chill-lounge`
```ts
maxAcceleration: 4
maxVelocity: 8
friction: 0.97
arrivalThreshold: 8.0
physicsMode: 'classic'
snapFactor: 0.0
revLimitPanPerSec: 12
revLimitTiltPerSec: 8
```

### `idle`
```ts
maxAcceleration: 200
maxVelocity: 100
friction: 0.50
arrivalThreshold: 1.0
physicsMode: 'classic'
snapFactor: 0.0
revLimitPanPerSec: 120
revLimitTiltPerSec: 80
```

### Óptica (extracto)
| Vibe | zoomDefault | zoomRange | focusDefault | focusRange |
|------|-------------|-----------|--------------|------------|
| techno-club | 30 | 0–80 | 20 | 0–50 |
| fiesta-latina | 150 | 80–200 | 100 | 50–180 |
| pop-rock | 220 | 150–255 | 180 | 100–255 |
| chill-lounge | 255 | 200–255 | 255 | 200–255 |
| idle | 127 | 0–255 | 127 | 0–255 |

### Behavior smoothFactor
| Vibe | smoothFactor |
|------|-------------|
| techno-club | 0.1 |
| fiesta-latina | 0.5 |
| pop-rock | 0.2 |
| chill-lounge | 0.9 |
| idle | 0.3 |

---

## 6. FIXTURE PHYSICS DRIVER (`FixturePhysicsDriver.ts`)

### Defaults globales (al boot, antes de vibe)
```ts
private physicsConfig: PhysicsConfig = {
  maxAcceleration: 800,
  maxVelocity: 400,
  friction: 0.15,
  arrivalThreshold: 1.0,
  minTransitionTime: 50,
}
```

### Safety Cap (límite absoluto del sistema)
```ts
private readonly SAFETY_CAP = {
  maxAcceleration: 900,   // DMX units/s²
  maxVelocity: 400,       // DMX units/s
}
```

### Pan Safety Margin
```ts
private readonly PAN_SAFETY_MARGIN = 5   // DMX units
```

### Defaults de personalidad (antes de preset)
```ts
private currentSnapFactor: number = 0.0
private currentRevLimitPanPerSec: number = 50
private currentRevLimitTiltPerSec: number = 35
```

### Installation Presets
| Preset | defaultHome | invert | limits (tiltMin, tiltMax) | tiltOffset |
|--------|-------------|--------|---------------------------|------------|
| `ceiling` | {pan:127, tilt:40} | {pan:false, tilt:true} | (20, 200) | -90 |
| `floor` | {pan:127, tilt:127} | {pan:false, tilt:false} | (0, 255) | 0 |
| `truss_front` | {pan:127, tilt:100} | {pan:false, tilt:false} | (30, 220) | -45 |
| `truss_back` | {pan:127, tilt:60} | {pan:true, tilt:false} | (20, 180) | -45 |

### Default Fixture Config (hardcodeada en `registerFixture`)
```ts
range: { pan: 540, tilt: 270 }
maxSpeed: { pan: 300, tilt: 200 }
home: { pan: 127, tilt: 40 }
invert: { pan: false, tilt: true }
limits: { tiltMin: 20, tiltMax: 200 }
mirror: false
```

### Manual REV_LIMIT (modo manual / override)
```ts
const MANUAL_REV_LIMIT = 400   // DMX/s
```

### Anti-Jitter
> Dynamic threshold = 3% of maxVelocity (no hardcoded 5).

### Hardware tier auto-tune (si no hay valores explícitos)
| Tier | maxAcceleration | maxVelocity |
|------|-----------------|-------------|
| `budget` | 1200 × degToDmxFactor | 400 × degToDmxFactor |
| `mid` | 1800 × degToDmxFactor | 600 × degToDmxFactor |
| `pro` | — (no limit beyond SAFETY_CAP) | — |

### Degrees-to-DMX conversion factor
```ts
const degToDmxFactor = 255 / (config.range.pan || 540)   // ≈ 0.472 for 540° pan
```

### Speed factors default
```ts
const speedFactorPan  = profile?.panSpeedFactor  ?? 1.0
const speedFactorTilt = profile?.tiltSpeedFactor ?? 1.0
```

---

## 7. AETHER SAFETY MIDDLEWARE (`AetherSafetyMiddleware.ts`)

### Kinetic Safety Constants
```ts
const KINETIC_SAFETY_CAP_VEL = 600   // DMX units/s max absolute
const KINETIC_DEFAULT_REV_PAN  = 300
const KINETIC_DEFAULT_REV_TILT = 200
const TELEPORT_THRESHOLD_MS = 200
const PAN_AIRBAG_MARGIN  = 5
const TILT_AIRBAG_MARGIN = 5
```

### REV_LIMIT per-vibe
| Vibe | pan (DMX/s) | tilt (DMX/s) |
|------|-------------|--------------|
| `techno-club` | 340 | 320 |
| `fiesta-latina` | 520 | 420 |
| `pop-rock` | 300 | 200 |
| `chill-lounge` | 12 | 8 |
| `idle` | 120 | 80 |

### Throttle
```ts
const THROTTLE_OPEN_DMX_MS = 33   // ~30 Hz
```

### Float32Array slots per kinetic node
```ts
const KS_LAST_PAN = 0, KS_LAST_TILT = 1, KS_LAST_TIME = 2, KS_INIT = 3
const KS_SLOTS = 4
```

---

## 8. FIXTURE PROFILES / HARDWARE DEFINITIONS

### `FixtureProfiles.ts` — perfiles predefinidos

| Profile | maxPanSpeed (°/s) | maxTiltSpeed (°/s) |
|-----------|-------------------|---------------------|
| `BEAM_2R_PROFILE` | 180 | 120 |
| `LED_WASH_PROFILE` | 200 | 150 |

### `ShowFileV2.ts` — DEFAULT_PHYSICS_PROFILES

| MotorType | maxAcceleration | maxVelocity | safetyCap | homePosition | tiltLimits |
|-----------|-----------------|-------------|-----------|--------------|------------|
| `servo-pro` | 4000 | 800 | false | {pan:127, tilt:127} | (20, 200) |
| `stepper-quality` | 2500 | 600 | true | {pan:127, tilt:127} | (20, 200) |
| `stepper-cheap` | 1500 | 400 | true | {pan:127, tilt:127} | (30, 180) |
| `unknown` | 2000 | 500 | true | {pan:127, tilt:127} | (20, 200) |

### Forge auto-generation (`FixtureProfiles.ts` — `generateProfileFromDefinition`)
```ts
const panSpeed  = maxVelocity > 0 ? Math.round(maxVelocity * 0.45) : 180
const tiltSpeed = maxVelocity > 0 ? Math.round(maxVelocity * 0.35) : 120
```

### Forge default physics (FixtureForgeEmbedded.tsx)
```ts
const [physics, setPhysics] = useState<PhysicsProfile>(DEFAULT_PHYSICS_PROFILES['stepper-quality'])
```

### Wheel motor speed default
```ts
const [wheelMinChangeTimeMs, setWheelMinChangeTimeMs] = useState<number>(500)
```

---

## 9. ADUANA / EGRESO — Otros parámetros cinéticos

### `HardwareAbstraction.ts` — phase offset para patrones sinusoidales
```ts
// Para wave, figure8, circle, sweep: offset temporal, no recálculo de trayectoria
const defaultAngle = Math.atan2(amplitudeY, amplitudeX)
const defaultPhaseAngle = phaseOffset
const defaultNewAngle = defaultAngle + defaultPhaseAngle
```

### `HardwareAbstraction.ts` — detuning de figure8
```ts
pan  = Math.round(centerPan + Math.sin(phase) * amplitude)
tilt = Math.round(centerTilt + Math.sin(phase * 2) * amplitude * 0.5)
```

---

## ÍNDICE DE ARCHIVOS CONSULTADOS

| Archivo | Líneas relevantes |
|---------|-------------------|
| `src/core/aether/AetherKineticEngine.ts` | 59–75, 154–226, 287–323, 459–504 |
| `src/engine/movement/VibeMovementManager.ts` | 131–179, 195–226, 580–591, 740–919, 999–1022, 1065–1114, 1111–1113 |
| `src/engine/movement/VibeMovementPresets.ts` | 83–249 |
| `src/engine/movement/FixturePhysicsDriver.ts` | 123–185, 199–202, 228–248, 265–272, 383–387, 580–758 |
| `src/core/aether/egress/AetherSafetyMiddleware.ts` | 22–45, 56–58 |
| `src/hal/translation/FixtureProfiles.ts` | 135–182, 221–246, 551–560 |
| `src/core/stage/ShowFileV2.ts` | 182–215 |
| `src/components/views/ForgeView/FixtureForgeEmbedded.tsx` | 461–463, 473–475 |
| `src/hal/HardwareAbstraction.ts` | 359–373, 449–455 |

---

> **Nota del auditor:** Este documento es una fotografía exacta del estado del código en el momento de la extracción. Cualquier número aquí listado puede haber sido modificado por Waves posteriores. Verificar siempre contra el fuente antes de usar para tuning.
