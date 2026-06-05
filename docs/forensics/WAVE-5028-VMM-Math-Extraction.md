# WAVE-5028: VMM Math & Coefficient Forensic Audit
## Objetivo
Auditar las fórmulas trigonométricas y coeficientes de cinemática que producen:
1. **Patrones latinos tipo "scanner plano"** — amplitudes tilt insuficientes
2. **Patrones techno "agresivos"** — latigazos de motor excesivos

---

## TAREA 1: Coeficientes Físicos Globales (VibeMovementPresets.ts)

### `techno-club`
```typescript
'techno-club': {
    physics: {
      maxAcceleration: 850,     // 600→850. Explosivo
      maxVelocity: 380,         // 320→380. ~805°/s
      friction: 0.06,           // 0.08→0.06. Más inercia industrial
      arrivalThreshold: 0.3,    // 0.5→0.3. Esquinas clavadas
      physicsMode: 'snap',
      snapFactor: 1.0,          // Sin cambio
      revLimitPanPerSec: 360,   // 300→360. ~763°/s
      revLimitTiltPerSec: 270,  // 220→270. ~572°/s
    },
    optics: {
      zoomDefault: 30,
      zoomRange: { min: 0, max: 80 },
      focusDefault: 20,
      focusRange: { min: 0, max: 50 },
    },
    behavior: {
      homeOnSilence: false,
      syncToBeat: true,
      allowRandomPos: false,
      smoothFactor: 0.1,        // Movimiento seco
    },
}
```

### `fiesta-latina`
```typescript
'fiesta-latina': {
    physics: {
      maxAcceleration: 650,     // 500→650. Más vida en curvas
      maxVelocity: 310,         // 250→310. ~657°/s
      friction: 0.06,           // 0.07→0.06. Seda pura
      arrivalThreshold: 2.0,    // Sin cambio — overshoot elegante
      physicsMode: 'snap',
      snapFactor: 0.88,         // 0.85→0.88. Más fidelidad
      revLimitPanPerSec: 300,   // 240→300. ~636°/s
      revLimitTiltPerSec: 240,  // 180→240. ~509°/s
    },
    optics: {
      zoomDefault: 150,
      zoomRange: { min: 80, max: 200 },
      focusDefault: 100,
      focusRange: { min: 50, max: 180 },
    },
    behavior: {
      homeOnSilence: false,
      syncToBeat: true,
      allowRandomPos: true,
      smoothFactor: 0.5,        // Movimiento suave
    },
}
```

---

## TAREA 2: Fórmulas Trigonométricas (VibeMovementManager.ts)

### Coeficientes de Escala por Vibe (VIBE_CONFIG)
```typescript
'techno-club': {
    panScale: 0.92,
    tiltScale: 0.60,
    baseFrequency: 0.15,
}
'fiesta-latina': {
    panScale: 0.95,
    tiltScale: 0.60,
    baseFrequency: 0.12,
}
```

### Offset de Tilt por Vibe (TILT_OFFSET_BY_VIBE)
```typescript
const TILT_OFFSET_BY_VIBE: Readonly<Record<string, number>> = {
  'techno-club': -0.35,
  'fiesta-latina': -0.35,
  'pop-rock': -0.30,
  'chill-lounge': -0.25,
  'idle': -0.10,
}
```

### Limitadores de Tilt (seguridad ceiling/floor)
```typescript
const TILT_CEILING = 0.15          // clamp upper bound
const TILT_FLOOR_LIMIT = 0.50      // clamp lower bound (WAVE 4933.3)
const TILT_OFFSET_CEILING = -0.325
```

### Patrón `wave_y`
```typescript
wave_y: (phase, audio) => {
    return {
      x: Math.sin(phase) * 0.80,
      y: Math.cos(phase) * 0.70,
    }
}
```

### Patrón `cadera_libre`
```typescript
cadera_libre: (phase, audio, index = 0, total = 1) => {
    // Deriva lenta: 1 ciclo cada ~37 beats
    const drift = Math.sin(phase * 0.137) * 0.18
    return {
      x: Math.sin(phase * 3 + drift) * 0.90,
      y: Math.sin(phase * 2) * 0.65 + Math.sin(phase * 0.5) * 0.12,
    }
}
```

### Patrón `ballyhoo`
```typescript
ballyhoo: (phase, audio, index = 0, total = 1) => {
    const r = 0.75 + 0.25 * Math.cos(phase * 2)   // r ∈ [0.50, 1.00]
    return {
      x: Math.sin(phase * 1.5) * r,
      y: Math.cos(phase) * r,
    }
}
```

### Patrón `botstep`
```typescript
botstep: (phase, audio) => {
    const phi = 1.618033988749
    const totalSteps = 8
    const normalizedPhase = (phase / (Math.PI * 2)) * totalSteps
    const currentStep = Math.floor(normalizedPhase) % totalSteps
    const nextStep = (currentStep + 1) % totalSteps
    const t = normalizedPhase - Math.floor(normalizedPhase)

    const fromX = Math.sin(currentStep * phi * Math.PI) * 0.9
    const fromY = Math.cos(currentStep * phi * phi * Math.PI) * 0.9
    const toX = Math.sin(nextStep * phi * Math.PI) * 0.9
    const toY = Math.cos(nextStep * phi * phi * Math.PI) * 0.9

    return {
      x: fromX + (toX - fromX) * t,
      y: fromY + (toY - fromY) * t,
    }
}
```

---

## TAREA 3: Pipeline de Escalado (generateIntent → posición final)

### 1. Gearbox — `calculateEffectiveAmplitude`
```typescript
private calculateEffectiveAmplitude(
    baseAmplitude: number,
    bpm: number,
    patternPeriod: number,
    energy: number,
    fixtureMaxSpeed: number = 250
): number {
    // Manual override
    if (this.manualAmplitudeOverride !== null) {
      return 0.05 + (this.manualAmplitudeOverride / 100) * 0.95
    }

    const HARDWARE_MAX_SPEED = fixtureMaxSpeed
    const secondsPerBeat = 60 / bpm
    const maxTravelPerCycle = HARDWARE_MAX_SPEED * secondsPerBeat * patternPeriod
    const energyBoost = 1.0 + energy * 0.2
    const requestedAmplitude = baseAmplitude * energyBoost
    const requestedTravel = 255 * requestedAmplitude
    const gearboxFactor = Math.min(1.0, maxTravelPerCycle / requestedTravel)

    const GEARBOX_MIN_AMPLITUDE = 0.10   // WAVE 2192: floor liberado de 0.85
    const gearboxResult = requestedAmplitude * gearboxFactor
    return Math.min(1.0, Math.max(GEARBOX_MIN_AMPLITUDE, gearboxResult))
}
```

### 2. Phrase Envelope (respiración de frase)
```typescript
const phraseBeats = 32
const phraseProgress = (beatCount % phraseBeats) / phraseBeats
const phraseEnvelope = 0.925 + 0.075 * Math.sin(Math.PI * (phraseProgress - 0.15))
const clampedEnvelope = Math.max(0.85, Math.min(1.0, phraseEnvelope))
const finalPanAmplitude  = effectivePanAmplitude  * clampedEnvelope
const finalTiltAmplitude = effectiveTiltAmplitude * clampedEnvelope
```

### 3. Aplicación de escala + offset + clamp
```typescript
const position = {
    x: Math.max(-1, Math.min(1, rawPosition.x * finalPanAmplitude)),
    y: Math.max(-1, Math.min(1, (rawPosition.y * finalTiltAmplitude) + tiltOffset)),
}
// tiltOffset: techno = -0.35, latino = -0.35
// clamp ceiling (floor mount): y = Math.min(y, TILT_CEILING=0.15)
// clamp ceiling mount: y ∈ [-TILT_FLOOR_LIMIT(-0.50), -TILT_CEILING(-0.15)]
```

### 4. Crossfade cinético (WAVE 4741)
```typescript
// Smoothstep ease-in-out: t² × (3 − 2t)
const t = Math.min(1.0, this.kineticTransition.progressBeats / this.kineticTransition.totalBeats)
const crossfadeSmoothT = t * t * (3 - 2 * t)
finalPosition = {
    x: fromPosition.x + (position.x - fromPosition.x) * crossfadeSmoothT,
    y: fromPosition.y + (position.y - fromPosition.y) * crossfadeSmoothT,
}
```

### 5. Snake Offset (fiesta-latina usa SNAKE)
```typescript
const stereoConfig = STEREO_CONFIG[vibeId]
if (stereoConfig.type === 'snake' && totalFixtures > 1) {
    const phaseOffset = fixtureIndex * stereoConfig.offset
    const mag = Math.sqrt(finalPosition.x**2 + finalPosition.y**2)
    if (mag > 0.01) {
      const currentAngle = Math.atan2(finalPosition.y, finalPosition.x)
      const newAngle = currentAngle + phaseOffset
      stereoPosition.x = Math.cos(newAngle) * mag
      stereoPosition.y = Math.sin(newAngle) * mag
    }
}
```

---

## Hallazgos Preliminares (sin modificar — solo lectura)

1. **`tiltScale = 0.60` es idéntico** en `techno-club` y `fiesta-latina`. Con `wave_y.y = cos(phase)*0.70` y `tiltScale=0.60`, la excursión máxima real de tilt es `0.70 * 0.60 = 0.42` (±42% del rango DMX). Esto explica el efecto "scanner plano": el patrón nunca explora más del 42% del rango de tilt.

2. **El `tiltOffset = -0.35`** empuja todo el patrón hacia abajo. En el rango normalizado `[-1, +1]`, `y = rawY*0.42 - 0.35` produce un rango efectivo de `[-0.77, +0.07]`. Después del `Math.min(y, TILT_CEILING=0.15)` (floor mount), el rango se recorta a `[-0.77, 0.15]`. Es decir: **solo un 7.5% del ciclo tiene tilt positivo** (apuntando arriba); el 92.5% apunta hacia abajo o al frente.

3. **`cadera_libre.y = sin(2p)*0.65 + sin(0.5p)*0.12`** produce `y_raw ∈ [-0.77, +0.77]`. Pero con `tiltScale=0.60` → `y_scaled ∈ [-0.46, +0.46]`. Tras aplicar `tiltOffset=-0.35` → `y_final ∈ [-0.81, +0.11]`. El límite `TILT_CEILING=0.15` **corta solo +0.11→0.15** (casi nada). El problema no es el clamp: **es que la amplitud de tilt nunca supera +0.11**, dejando el haz casi siempre apuntando hacia la zona baja del escenario.

4. **Patrón `botstep` techno**: `fromY = cos(currentStep * phi² * π) * 0.9`. Con `phi² ≈ 2.618`, la secuencia de pasos recorre `cos(0), cos(2.618π), cos(5.236π)...` que se distribuye pseudoaleatoriamente en `[-0.9, +0.9]`. Transiciones lineales `t` entre pasos consecutivos, combinadas con `tiltScale=0.60` y `tiltOffset=-0.35`, generan saltos brutales de hasta `|Δy| ≈ 0.6*0.9*2 = 1.08` DMX (del límite inferior al superior) en un solo paso del patrón. El `snapFactor=1.0` del modo techno empuja el motor a seguir esos saltos sin suavizado.

5. **Energy boost**: `energyBoost = 1.0 + energy * 0.2`. En drops techno con energy=1.0, el boost es solo 1.2x. Esto es MUY conservador; un drop típico debería disparar amplitud mucho más agresivamente (la física del Gearbox con `fixtureMaxSpeed=250` limita amplitud a valores seguros, pero los saltos de `botstep` dentro de ese rango ya son violentos).
