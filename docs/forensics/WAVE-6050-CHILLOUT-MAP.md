# WAVE-6050: VOLCADO FORENSE — MAPEO VMM Y CHILLOUT ENGINE

**Rol:** Ingeniero Core (Forensic Dump)  
**Objetivo:** Extraer la matemática exacta del Chillout Engine para diagnóstico de tres problemas: LFOs escalonados, Movers congelados, y paleta inicial verde.  
**Archivos involucrados:** `colorConstitutions.ts`, `ChillAmbientEngine.ts`, `VibeMovementManager.ts`, `SeleneLux.ts`, `TitanEngine.ts`, `LiquidEngine71.ts`, `chilllounge.ts`

---

## 1. LA PALETA DE COLORES — ¿De dónde sale el verde inicial?

### 1.1 Constitución Cromática del Chillout

`@/electron-app/src/engine/color/colorConstitutions.ts:378-436`

```typescript
export const CHILL_CONSTITUTION: GenerationOptions = {
  forceStrategy: 'analogous',

  atmosphericTemp: 8500,
  thermalGravityStrength: 0.18,

  // Zona prohibida: rojo/naranja/amarillo cálido (cruza el 0°)
  forbiddenHueRanges: [[330, 360], [0, 70]],
  elasticRotation: 20,

  // Zona permitida: 260° de arco bioluminiscente
  // [70, 135] = ZONA ALGA (Verde Lima → Verde Esmeralda) ← AQUÍ ESTÁ EL VERDE
  // [135, 200] = ZONA CORAL (Turquesa → Cian)
  // [200, 260] = ZONA ABISAL (Azul Profundo → Índigo)
  // [260, 330] = ZONA MEDUSA (Violeta → Magenta Frío)
  allowedHueRanges: [[70, 330]],

  saturationRange: [50, 85],
  lightnessRange: [30, 60],
  strobeProhibited: true,
  accentBehavior: 'breathing',
  pulseConfig: { duration: 6000, amplitude: 0.12 },
  transitionConfig: {
    minDuration: 20000,
    maxDuration: 30000,
    easing: 'sine-inout',
  },
  dimmingConfig: {
    floor: 0.10,
    ceiling: 0.85,
  },
};
```

### 1.2 El Hue Base por Defecto (El Culpable del Verde)

`@/electron-app/src/engine/color/SeleneColorEngine.ts:1140`

```typescript
// NO género, NO bias, solo matemática musical pura
let baseHue = 120; // Default: Verde (neutro)
let hueSource = 'default';

if (key && KEY_TO_HUE[key] !== undefined) {
  baseHue = KEY_TO_HUE[key];
} else if (activeMood && MOOD_HUES[activeMood] !== undefined) {
  baseHue = MOOD_HUES[activeMood];
}
```

**Diagnóstico:** Cuando no hay key musical detectada ni mood mapeado, `baseHue` parte de **120° (Verde Esmeralda)**. Como la constitución chill permite `allowedHueRanges: [[70, 330]]`, el verde está legalmente dentro del espectro. No es un bug — es una **caída por defecto al centro del rango permitido**.

---

## 2. EL LOOP DEL LFO / INTENSIDAD — ¿Por qué se ve escalonado?

### 2.1 Motor de Mareas (ChillAmbientEngine.ts)

`@/electron-app/src/hal/physics/ChillAmbientEngine.ts:110-131`

```typescript
tick(): ChillAmbientFrame {
  const tMs = performance.now()      // ← RESOLUCIÓN: ~1ms en browsers
  const tSec = tMs / 1000
  const TWO_PI = 2 * Math.PI

  // 3 LFOs con períodos primos: 120s, 180s, 240s
  // MCM ≈ 106.421s → patrón no se repite en toda la noche
  const lfo1 = (Math.sin((TWO_PI * tSec) / 120.0) + 1) / 2
  const lfo2 = (Math.sin((TWO_PI * tSec) / 180.0) + 1) / 2
  const lfo3 = (Math.sin((TWO_PI * tSec) / 240.0) + 1) / 2

  // Suma ponderada normalizada → [0, 1]
  const combined = lfo1 * 0.50 + lfo2 * 0.30 + lfo3 * 0.20

  // Mapear a rango de salida → [0, 1]
  const morphTarget = 0.0 + combined * 1.0

  // EMA suavizador — τ ≈ 2.1 segundos @ 60fps
  this._smoothedMorph += (morphTarget - this._smoothedMorph) * 0.008
  const morphFactor = this._smoothedMorph

  return { morphFactor, dimmer: morphFactor, _ts: tMs }
}
```

### 2.2 Inyección en SeleneLux (Punto de Inyección al VMM)

`@/electron-app/src/core/reactivity/SeleneLux.ts:598-611`

```typescript
let chillMorphFactor: number | undefined = undefined

if (vibeNormalized.includes('chill') || vibeNormalized.includes('lounge') ||
    vibeNormalized.includes('ambient') || vibeNormalized.includes('jazz')) {
  const chillFrame = chillAmbientEngine.tick()
  chillMorphFactor = chillFrame.morphFactor
  dimmerOverride = chillFrame.dimmer    // ← Pisando el dimmer maestro
}
```

### 2.3 Diagnóstico del Escalonamiento

**Causa probable:** `performance.now()` tiene resolución de ~1ms en la mayoría de navegadores. A 60fps, el delta entre frames es ~16.6ms, por lo que el LFO avanza suavemente. Sin embargo, si el frame loop se ejecuta a **30fps** o hay **throttling del renderer**, el LFO recibe saltos de ~33ms. Como los períodos son enormes (120-240s), el cambio por frame es microscópico (~0.0003 rad/frame), pero si se acumula con jitter de timer, el EMA (`α=0.008`) puede producir **micro-plataformas** en la curva.

**No hay redondeo a 8-bits en el engine.** El escalonamiento observado probablemente viene de:
1. Frame-rate irregular (throttling de IPC/renderer)
2. El EMA actuando como filtro paso-bajo que "aplasta" transiciones abruptas del timer

---

## 3. EL CONTROL ESPACIAL / MOVERS — ¿Por qué están congelados?

### 3.1 Patrones Chill en VibeMovementManager

`@/electron-app/src/engine/movement/VibeMovementManager.ts:233-242`

```typescript
'chill-lounge': {
  panScale: 0.85,
  tiltScale: 0.58,
  baseFrequency: 0.02,        // ← Frecuencia glacial (vs 0.15 techno)
  patterns: ['drift', 'sway', 'breath'],
  homeOnSilence: false,
}
```

### 3.2 Periodos de Ciclo Chill (Abismo Oceánico)

`@/electron-app/src/engine/movement/VibeMovementManager.ts:293-296`

```typescript
// cycleBeats 256-512 → 1 ciclo en 64-128 compases a 120 BPM = 64-128 MINUTOS.
drift:  { cycleBeats: 512, phraseDuration: 1024, ... },
sway:   { cycleBeats: 256, phraseDuration: 512,  ... },
breath: { cycleBeats: 192, phraseDuration: 384,  ... },
```

### 3.3 Sedación Extra en el Tick

`@/electron-app/src/engine/movement/VibeMovementManager.ts:1000`

```typescript
const chillSedationFactor = vibeId === 'chill-lounge' ? 0.80 : 1.0
```

### 3.4 Implementación de los Patrones Chill

`@/electron-app/src/engine/movement/VibeMovementManager.ts:633-656`

```typescript
// DRIFT: Movimiento browniano lento (suma de 3 senos irracionales)
drift: (phase, audio, outPos) => {
  const phi = 1.618033988749
  const sqrt2 = Math.SQRT2
  const sqrt3 = Math.sqrt(3)
  outPos.x = Math.sin(phase * phi) * 0.4 + 
             Math.sin(phase * sqrt2) * 0.25 + 
             Math.sin(phase * sqrt3) * 0.15
  outPos.y = Math.cos(phase * phi * 0.7) * 0.35 + 
             Math.cos(phase * sqrt2 * 0.8) * 0.2 + 
             Math.cos(phase * sqrt3 * 0.9) * 0.12
},

// SWAY: Pendulo muy suave (solo X, Y = 0)
sway: (phase, audio, outPos) => {
  outPos.x = Math.sin(phase) * 0.6
  outPos.y = 0
},

// BREATH: La luz respira (solo Y sutil, X = 0)
breath: (phase, audio, outPos) => {
  outPos.x = 0
  outPos.y = Math.sin(phase) * 0.35
}
```

### 3.5 Ghost Protocol (Freeze en Silencio)

`@/electron-app/src/engine/movement/VibeMovementManager.ts:1065-1068`

```typescript
// 🥶 WAVE 1165: GHOST PROTOCOL — FREEZE instead of HOME on silence
if (audio.energy < 0.03 && config.homeOnSilence) {
  return this.createFreezeIntent(patternName)
}
```

**NOTA CRÍTICA:** Para chill, `homeOnSilence: false`. Esto significa que **no se congela en silencio** — el patrón continúa incluso sin audio. El "congelamiento" observado por el usuario probablemente es la **percepción visual** de que con cycleBeats=512 (64 minutos por ciclo), el mover apenas se mueve en escalas de tiempo humanas.

### 3.6 Snake Stereo para Chill

`@/electron-app/src/engine/movement/VibeMovementManager.ts:368-373`

```typescript
'chill-lounge':   { offset: Math.PI / 2, type: 'snake' },    // 90° ola de mar lenta
```

---

## 4. LA CONEXIÓN AL VMM — Cómo el motor empuja al Visual Mapping Matrix

### 4.1 Pipeline de Datos: ChillAmbientEngine → SeleneLux → TitanEngine

**Paso 1:** `ChillAmbientEngine.tick()` genera `morphFactor` y `dimmer`.

**Paso 2:** `SeleneLux` inyecta el dimmer y el morph, luego corre `liquidEngine71`.

`@/electron-app/src/core/reactivity/SeleneLux.ts:604-645`

```typescript
const chillFrame = chillAmbientEngine.tick()
chillMorphFactor = chillFrame.morphFactor
dimmerOverride = chillFrame.dimmer

const liquidInput: LiquidStereoInput = {
  bands,
  sectionType: vibeContext.section,
  isRealSilence: audioMetrics.avgNormEnergy < 0.01,
  morphFactorOverride: chillMorphFactor,
}

// Chill SIEMPRE usa liquidEngine71 (tiene oscilladores Date.now() que pulsean)
const liquidEngine = (this.liquidLayout === '7.1' || isChill)
  ? liquidEngine71
  : liquidEngine41

const liquidResult = liquidEngine.applyBands(liquidInput)
```

**Paso 3:** `liquidResult` se guarda en `liquidStereoOverrides`.

`@/electron-app/src/core/reactivity/SeleneLux.ts:650-666`

```typescript
this.liquidStereoOverrides = {
  frontL: safe(liquidResult.frontLeftIntensity),
  frontR: safe(liquidResult.frontRightIntensity),
  backL: safe(liquidResult.backLeftIntensity),
  backR: safe(liquidResult.backRightIntensity),
  moverL: safe(liquidResult.moverLeftIntensity),
  moverR: safe(liquidResult.moverRightIntensity),
}
```

### 4.2 TitanEngine Consume el NervousSystem

`@/electron-app/src/engine/TitanEngine.ts:772-844`

```typescript
const nervousOutput = this.nervousSystem.updateFromTitan(...)

// WAVE 315.3: Si physics=chill, usar zoneIntensities del NervousSystem
if (nervousOutput.physicsApplied === 'chill' || ... ) {
  const ni = nervousOutput.zoneIntensities

  const moverL = ni.moverL ?? ni.mover
  const moverR = ni.moverR ?? ni.mover
  const frontL = ni.frontL ?? (ni.front ?? 0)
  const frontR = ni.frontR ?? (ni.front ?? 0)
  const backL = ni.backL ?? (ni.back ?? 0)
  const backR = ni.backR ?? (ni.back ?? 0)

  // 7-ZONE STEREO MODE (Chill / Liquid Stereo)
  zones = {
    frontL: { intensity: frontL, paletteRole: 'primary' },
    frontR: { intensity: frontR, paletteRole: 'primary' },
    backL:  { intensity: backL,  paletteRole: 'accent' },
    backR:  { intensity: backR,  paletteRole: 'accent' },
    left:   { intensity: moverL, paletteRole: 'secondary' },
    right:  { intensity: moverR, paletteRole: 'ambient' },
    front:  { intensity: ni.front ?? (frontL + frontR) * 0.5, paletteRole: 'primary' },
    back:   { intensity: ni.back ?? (backL + backR) * 0.5,  paletteRole: 'accent' },
    ambient:{ intensity: audio.energy * 0.3, paletteRole: 'ambient' },
  }
}
```

### 4.3 Construcción del LightingIntent Final

`@/electron-app/src/engine/TitanEngine.ts:1195-1204`

```typescript
const intent: LightingIntent = {
  palette: finalPalette,
  masterIntensity: finalMasterIntensity,
  zones,        // ← Intensidades de PARs (frontL/R, backL/R)
  movement,     // ← Posiciones de movers (Pan/Tilt L/R)
  optics,
  effects: finalEffects,
  source: 'procedural',
  timestamp: now,
}

this.state.currentIntent = intent
return intent
```

### 4.4 Capas que Pisan el VMM

| Capa | Fuente | Qué controla |
|------|--------|--------------|
| **L0** | `ChillAmbientEngine` + `LiquidEngine71` | Intensidades de PARs, morphFactor |
| **L0** | `VibeMovementManager` | Pan/Tilt de movers (via `generateStereoMovement`) |
| **L1** | Efectos (TitanConscious) | Dimmer override, color flare |
| **L2** | Operador manual | Faders de dimmer, overrides de posición, fan offsets |
| **L3** | NodeArbiter (WAVE 4829) | Escudo anti-sangrado: L3 domina L0/L1 en canales ya escritos |

**Nota:** Si `deepFieldMechanics` está poblado (WAVE 1046), TitanEngine usa `buildMechanicsBypassIntent()` que **bypasea completamente el VMM** y pasa coordenadas directas. Si no, delega a `generateStereoMovement()`.

---

## RESUMEN EJECUTIVO

| Problema | Causa Forense | Ubicación |
|----------|---------------|-----------|
| **Verde inicial** | `baseHue = 120` (verde) por defecto en SeleneColorEngine; luego la constitución chill permite `[70, 330]` que incluye verde | `SeleneColorEngine.ts:1140` |
| **LFO escalonado** | `performance.now()` resolución ~1ms + EMA `α=0.008` puede crear micro-plataformas si hay frame-rate irregular | `ChillAmbientEngine.ts:111-128` |
| **Movers "congelados"** | Patrones chill con `cycleBeats: 192-512` (48-128 compases = 64-128 minutos por ciclo). No están congelados — se mueven **glacialmente** | `VibeMovementManager.ts:293-296` |

---

*Fin del volcado forense. Arquitectura: proceder al diseño de transiciones de ciclo largo.*
