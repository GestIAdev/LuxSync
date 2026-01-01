# 🔮 WAVE 273: THE ELEMENTAL FUSION (SURGICAL INJECTION)

**Fecha:** 1 Enero 2026  
**Status:** ✅ IMPLEMENTADO  
**Tipo:** Surgical Architecture Blueprint  

---

## 🎉 RESUMEN DE IMPLEMENTACIÓN

La WAVE 273 ha sido completada exitosamente. Los 4 elementos zodiacales (Fuego, Tierra, Aire, Agua) ahora modulan la física de cada motor StereoPhysics y el MovementEngine.

### Archivos Creados:
- `src/engine/physics/ElementalModifiers.ts` - Biblia central de coeficientes

### Archivos Modificados:
- `src/hal/physics/TechnoStereoPhysics.ts` - thresholds + brightness
- `src/hal/physics/RockStereoPhysics.ts` - thresholds + brightness
- `src/hal/physics/LatinoStereoPhysics.ts` - thresholds + brightness
- `src/hal/physics/ChillStereoPhysics.ts` - frequency (decay) + amplitude (brightness)
- `src/engine/color/MovementEngine.ts` - jitter (Aire) + smoothing (Agua)
- `src/main/selene-lux-core/SeleneLux.ts` - integración central

### Flujo de Datos:
```
lastTrinityData.key → getModifiersFromKey() → ElementalModifiers
                                                    ↓
                        ┌───────────────────────────┼───────────────────────────┐
                        ↓                           ↓                           ↓
              TechnoStereoPhysics       RockStereoPhysics       MovementEngine
              LatinoStereoPhysics       ChillStereoPhysics
```

---

## ⚠️ CORRECCIÓN CRÍTICA (Historia)

El Blueprint V1 era **demasiado genérico**. Proponía sobrescribir físicas con coeficientes uniformes.

**REALIDAD:** Existen 4 micromotores de precisión calibrados en ~40 WAVEs:
- `TechnoStereoPhysics` (WAVE 129-151)
- `RockStereoPhysics` (WAVE 135-142)  
- `LatinoStereoPhysics` (WAVE 145-165)
- `ChillStereoPhysics` (WAVE 143-146)

**NUEVO ENFOQUE:** El Elemento Zodiacal MODULA parámetros específicos DENTRO de cada motor, sin destruir su lógica interna.

---

## 🏛️ MANIFIESTO V2

> *"No imponemos física genérica. Inyectamos carácter elemental como modificador de coeficientes dentro de los motores existentes."*

**OBJETIVO:** El `ZodiacElement` (Fire/Earth/Air/Water) modifica PARÁMETROS ESPECÍFICOS de cada StereoPhysics sin tocar su lógica de triggers.

**ALCANCE:** 
- ✅ Modificar thresholds/decay/brightness por elemento
- ✅ Añadir jitter en MovementEngine para Air
- ❌ NO reemplazar lógica de detección de drops/kicks
- ❌ NO tocar colores ni estrategias

---

## 📊 INVENTARIO DE MOTORES EXISTENTES

### 1. PhysicsEngine (`src/hal/physics/PhysicsEngine.ts`)

**Estado:** ✅ ACTIVO (WAVE 205)

```typescript
// Core physics: Attack instantáneo, Decay variable
private applyPhysics(target, current, decaySpeed, zoneType): number {
  if (target >= current) return target;  // ATTACK: Siempre instantáneo
  
  // DECAY: Asimétrico
  if (zoneType === 'PAR') {
    dropRate = 0.40 / decaySpeed;  // Flash physics
  } else {
    dropRate = 0.10 / decaySpeed;  // Inertia physics
  }
  return current - dropRate;
}
```

**Parámetros Modificables:**
| Parámetro | Actual | Rango | Efecto |
|-----------|--------|-------|--------|
| `decaySpeed` | 1-10 | 1=corte, 10=líquido | Velocidad de caída |
| `zoneType` | PAR/MOVER | - | Tipo de física |

### 2. MovementEngine (`src/engine/color/MovementEngine.ts`)

**Estado:** ✅ ACTIVO

```typescript
// Lissajous patterns
const config = {
  freqX: number,      // Frecuencia horizontal
  freqY: number,      // Frecuencia vertical
  phaseShift: number, // Desfase de fase
  amplitude: number   // Amplitud del movimiento
};

// Smoothing
const smoothFactor = this.smoothing * 0.15;
this.lastPan += (pan - this.lastPan) * smoothFactor;
```

**Parámetros Modificables:**
| Parámetro | Actual | Rango | Efecto |
|-----------|--------|-------|--------|
| `smoothing` | 0.8 | 0.0-1.0 | Suavidad (lerp factor) |
| `freqX/Y` | 1-3 | 0.1-5.0 | Velocidad de pattern |
| `amplitude` | 0.5-0.9 | 0.0-1.0 | Rango de movimiento |

### 3. StereoPhysics por Género

**Estado:** ✅ ACTIVOS pero RÍGIDOS

| Motor | Thresholds | Efecto |
|-------|------------|--------|
| `RockStereoPhysics` | SNARE=0.32, KICK=0.35 | Flash tungsteno |
| `TechnoStereoPhysics` | DYNAMIC_FLOOR=0.6 | Strobe neón |
| `ChillStereoPhysics` | BREATH_FREQ=0.2Hz | Respiración |
| `LatinoStereoPhysics` | KICK=0.80, DELTA=0.15 | Solar Flare |

### 4. ZodiacAffinityCalculator (`src/engine/consciousness/ZodiacAffinityCalculator.ts`)

**Estado:** ✅ ACTIVO

```typescript
type ZodiacElement = 'fire' | 'earth' | 'air' | 'water';

// Obtener elemento de un signo
static getElement(position: number): ZodiacElement {
  return this.ZODIAC_SIGNS[position % 12].element;
}

// Signos por elemento
static getSignsByElement(element: ZodiacElement): number[] {
  // fire: [0, 4, 8]  → Aries, Leo, Sagittarius
  // earth: [1, 5, 9] → Taurus, Virgo, Capricorn
  // air: [2, 6, 10]  → Gemini, Libra, Aquarius
  // water: [3, 7, 11] → Cancer, Scorpio, Pisces
}
```

---

## 🔬 ANATOMÍA DE CADA MICROMOTOR

### 1. TechnoStereoPhysics (WAVE 151)

**Responsabilidad:** Detectar drops de treble y disparar STROBE MAGENTA NEÓN

**Lógica de Trigger:**
```typescript
const dynamicFloor = BASE_FLOOR + (bassEnergy * DYNAMIC_FLOOR_FACTOR);  // 0.6
const treblePulse = Math.max(0, treble - dynamicFloor);
const isStrobeActive = (treblePulse > TRIGGER_THRESHOLD) &&  // 0.30
                       (bassEnergy > MIN_BASS_FOR_STROBE);   // 0.80
```

**Parámetros Modificables por Elemento:**
| Parámetro | Valor Base | Fire | Water | Air | Earth |
|-----------|-----------|------|-------|-----|-------|
| `DYNAMIC_FLOOR_FACTOR` | 0.6 | 0.4 | 0.8 | 0.5 | 0.7 |
| `TRIGGER_THRESHOLD` | 0.30 | 0.20 | 0.40 | 0.25 | 0.35 |
| `STROBE_BRIGHTNESS` (L) | 85 | 95 | 70 | 90 | 80 |

**Efecto Elemental:**
- 🔥 **Fire:** Strobe MÁS frecuente y MÁS brillante (piso bajo, trigger bajo)
- 🌊 **Water:** Strobe RARO y SUAVE (piso alto, trigger alto, L bajo)
- 💨 **Air:** Strobe NORMAL pero con micro-variación de L
- 🌍 **Earth:** Strobe PESADO (trigger alto, pero L=80 cuando dispara)

---

### 2. RockStereoPhysics (WAVE 142)

**Responsabilidad:** Detectar SNARE y KICK, aplicar flash tungsteno

**Lógica de Trigger:**
```typescript
const midsPulse = Math.max(0, normalizedMid - avgMid);
const bassPulse = Math.max(0, normalizedBass - avgBass);
const isSnareHit = midsPulse > SNARE_THRESHOLD;  // 0.32
const isKickHit = bassPulse > KICK_THRESHOLD;    // 0.35
```

**Parámetros Modificables por Elemento:**
| Parámetro | Valor Base | Fire | Water | Air | Earth |
|-----------|-----------|------|-------|-----|-------|
| `SNARE_THRESHOLD` | 0.32 | 0.25 | 0.45 | 0.30 | 0.35 |
| `KICK_THRESHOLD` | 0.35 | 0.28 | 0.50 | 0.33 | 0.30 |
| `TUNGSTEN_L` | 95 | 100 | 80 | 95 | 90 |
| `KICK_BRIGHTNESS` | 80 | 90 | 65 | 85 | 95 |

**Efecto Elemental:**
- 🔥 **Fire:** TODOS los hits registran (umbrales bajos, brightness max)
- 🌊 **Water:** Solo hits ÉPICOS registran (umbrales altos, brightness suave)
- 💨 **Air:** Hits normales, pero tungsteno parpadea (jitter en L)
- 🌍 **Earth:** KICKS dominan (kick_threshold bajo, brightness alto)

---

### 3. LatinoStereoPhysics (WAVE 165)

**Responsabilidad:** Solar Flare en kicks épicos, Machine Gun blackout

**Lógica de Trigger:**
```typescript
const bassDelta = bassPulse - lastBass;
const isKickMoment = bassPulse > KICK_THRESHOLD &&      // 0.80
                     bassDelta > BASS_DELTA_THRESHOLD;   // 0.15
```

**Parámetros Modificables por Elemento:**
| Parámetro | Valor Base | Fire | Water | Air | Earth |
|-----------|-----------|------|-------|-----|-------|
| `KICK_THRESHOLD` | 0.80 | 0.65 | 0.90 | 0.75 | 0.70 |
| `BASS_DELTA_THRESHOLD` | 0.15 | 0.10 | 0.25 | 0.12 | 0.08 |
| `SOLAR_FLARE_L` | 45 | 60 | 35 | 50 | 55 |
| `NEON_PUMP_COOLDOWN` | 8 | 4 | 16 | 6 | 10 |

**Efecto Elemental:**
- 🔥 **Fire:** Flares CONSTANTES (kick threshold bajo, cooldown corto)
- 🌊 **Water:** Flares RAROS pero PROFUNDOS (thresholds altos, L=35)
- 💨 **Air:** Cambios de neón RÁPIDOS (cooldown corto)
- 🌍 **Earth:** STOMPS pesados (bass_delta bajo = sensible a graves)

---

### 4. ChillStereoPhysics (WAVE 146)

**Responsabilidad:** Breathing Pulse bioluminiscente, PAZ ABSOLUTA

**Lógica de Breathing:**
```typescript
const breathingValue = Math.sin(TWO_PI * BREATH_FREQUENCY_HZ * elapsedSeconds);
const lightnessModulation = breathingValue * LIGHTNESS_AMPLITUDE;  // ±8
```

**Parámetros Modificables por Elemento:**
| Parámetro | Valor Base | Fire | Water | Air | Earth |
|-----------|-----------|------|-------|-----|-------|
| `BREATH_FREQUENCY_HZ` | 0.2 | 0.35 | 0.12 | 0.28 | 0.18 |
| `LIGHTNESS_AMPLITUDE` | 8 | 12 | 5 | 15 | 6 |
| `DIMMER_AMPLITUDE` | 0.15 | 0.25 | 0.10 | 0.20 | 0.12 |
| `DIMMER_CEILING` | 0.85 | 0.95 | 0.75 | 0.90 | 0.80 |

**Efecto Elemental:**
- 🔥 **Fire:** Respiración RÁPIDA y AMPLIA (nervio, no paz)
- 🌊 **Water:** Respiración ULTRA LENTA y SUAVE (meditación profunda)
- 💨 **Air:** Respiración IRREGULAR (variación en frecuencia)
- 🌍 **Earth:** Respiración ESTABLE, BAJA (ritmo de la tierra)

---

## 🏗️ ARQUITECTURA DE INYECCIÓN

### Opción A: ElementalModifier como Parámetro (RECOMENDADA)

```typescript
// Nuevo interface
interface ElementalModifiers {
  thresholdMultiplier: number;    // 0.5-1.5 (modifica umbrales)
  brightnessMultiplier: number;   // 0.7-1.2 (modifica L)
  decayMultiplier: number;        // 0.5-2.0 (modifica decay/cooldown)
  jitterAmplitude: number;        // 0.0-0.2 (solo para Air)
}

// Cada motor acepta modifiers opcionales
TechnoStereoPhysics.apply(palette, audio, elementalModifiers?);
RockStereoPhysics.apply(palette, audio, hue, elementalModifiers?);
LatinoStereoPhysics.apply(palette, audio, bpm?, elementalModifiers?);
ChillStereoPhysics.apply(palette, audio, elementalModifiers?);
```

### Mapeo Key → Elemento → Modifiers

```typescript
// 1. Key musical → Signo zodiacal (escala cromática)
const KEY_TO_ZODIAC: Record<string, number> = {
  'C': 0,  'C#': 1, 'D': 2,  'D#': 3,
  'E': 4,  'F': 5,  'F#': 6, 'G': 7,
  'G#': 8, 'A': 9,  'A#': 10, 'B': 11,
};

// 2. Signo → Elemento (ZodiacAffinityCalculator.getElement())
// 3. Elemento → Modifiers
const ELEMENTAL_MODIFIERS: Record<ZodiacElement, ElementalModifiers> = {
  fire: {
    thresholdMultiplier: 0.7,   // Triggers más fáciles
    brightnessMultiplier: 1.15, // Más brillante
    decayMultiplier: 0.6,       // Decay rápido / cooldown corto
    jitterAmplitude: 0.03,      // Micro-temblor de llama
  },
  water: {
    thresholdMultiplier: 1.3,   // Triggers difíciles
    brightnessMultiplier: 0.85, // Más suave
    decayMultiplier: 1.8,       // Decay lento / cooldown largo
    jitterAmplitude: 0.0,       // Sin jitter (fluido)
  },
  air: {
    thresholdMultiplier: 0.9,   // Triggers normales
    brightnessMultiplier: 1.0,  // Brillo normal
    decayMultiplier: 0.8,       // Decay moderado
    jitterAmplitude: 0.15,      // MUCHO jitter (viento)
  },
  earth: {
    thresholdMultiplier: 0.8,   // Sensible a graves
    brightnessMultiplier: 0.95, // Ligeramente más oscuro
    decayMultiplier: 1.2,       // Decay medio
    jitterAmplitude: 0.0,       // Sin jitter (sólido)
  },
};
```

---

## 🔧 PUNTOS DE INYECCIÓN QUIRÚRGICOS

### 1. TechnoStereoPhysics.apply()

```typescript
// ANTES (línea ~130)
const dynamicFloor = this.BASE_FLOOR + (bassEnergy * this.DYNAMIC_FLOOR_FACTOR);
const isStrobeActive = (treblePulse > this.TRIGGER_THRESHOLD) && ...;

// DESPUÉS
const floorFactor = this.DYNAMIC_FLOOR_FACTOR * (mods?.thresholdMultiplier ?? 1);
const dynamicFloor = this.BASE_FLOOR + (bassEnergy * floorFactor);

const trigger = this.TRIGGER_THRESHOLD * (mods?.thresholdMultiplier ?? 1);
const isStrobeActive = (treblePulse > trigger) && ...;

// Y el color del strobe:
const strobeL = 85 * (mods?.brightnessMultiplier ?? 1);
const neonMagenta = hslToRgb({ h: 300, s: 100, l: strobeL });
```

### 2. LatinoStereoPhysics.apply()

```typescript
// ANTES (línea ~200)
const isKickMoment = bassPulse > LatinoStereoPhysics.KICK_THRESHOLD &&
                     bassDelta > LatinoStereoPhysics.BASS_DELTA_THRESHOLD;

// DESPUÉS  
const kickThresh = LatinoStereoPhysics.KICK_THRESHOLD * (mods?.thresholdMultiplier ?? 1);
const deltaThresh = LatinoStereoPhysics.BASS_DELTA_THRESHOLD * (mods?.thresholdMultiplier ?? 1);
const isKickMoment = bassPulse > kickThresh && bassDelta > deltaThresh;

// Y el cooldown del neon pump:
const cooldown = LatinoStereoPhysics.NEON_PUMP_COOLDOWN_FRAMES * (mods?.decayMultiplier ?? 1);
```

### 3. ChillStereoPhysics.apply()

```typescript
// ANTES (línea ~140)
const breathingValue = Math.sin(TWO_PI * BREATH_FREQUENCY_HZ * elapsedSeconds);

// DESPUÉS
const freqMod = this.BREATH_FREQUENCY_HZ / (mods?.decayMultiplier ?? 1);  // Water = más lento
const breathingValue = Math.sin(TWO_PI * freqMod * elapsedSeconds);

const ampMod = this.LIGHTNESS_AMPLITUDE * (mods?.brightnessMultiplier ?? 1);
const lightnessModulation = breathingValue * ampMod;

// Air element jitter:
if (mods?.jitterAmplitude > 0) {
  lightnessModulation += Math.sin(now * 0.01) * mods.jitterAmplitude * 10;
}
```

### 4. MovementEngine.calculate()

```typescript
// ANTES (línea ~235)
const smoothFactor = this.smoothing * 0.15;
this.lastPan += (pan - this.lastPan) * smoothFactor;

// DESPUÉS
let smoothFactor = this.smoothing * 0.15;

// Air element: jitter en posición
if (this.elementalMods?.jitterAmplitude > 0) {
  const jitX = Math.sin(Date.now() * 0.003) * this.elementalMods.jitterAmplitude;
  const jitY = Math.cos(Date.now() * 0.004) * this.elementalMods.jitterAmplitude;
  pan += jitX;
  tilt += jitY;
}

// Water element: smoothing más alto
smoothFactor *= (2 - (this.elementalMods?.decayMultiplier ?? 1));  // Water = más suave

this.lastPan += (pan - this.lastPan) * smoothFactor;
```

---

## 🔄 FLUJO DE DATOS

```
┌─────────────────────────────────────────────────────────────────┐
│                        TitanEngine                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  1. getStabilizedState() → key: "A minor"               │   │
│  │  2. extractNote("A minor") → "A"                        │   │
│  │  3. KEY_TO_ZODIAC["A"] → 9 (Capricorn)                  │   │
│  │  4. ZodiacAffinityCalculator.getElement(9) → "earth"    │   │
│  │  5. ELEMENTAL_MODIFIERS["earth"] → { thresh: 0.8, ... } │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│            ┌───────────────────────────────────┐               │
│            │        SeleneLux.ts               │               │
│            │   applyGenrePhysics(mods)         │               │
│            └──────────────┬────────────────────┘               │
│                           │                                     │
│         ┌─────────────────┼─────────────────┐                  │
│         ▼                 ▼                 ▼                  │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│  │   Techno    │   │   Latino    │   │   Chill     │          │
│  │ .apply(..., │   │ .apply(..., │   │ .apply(..., │          │
│  │   mods)     │   │   mods)     │   │   mods)     │          │
│  └─────────────┘   └─────────────┘   └─────────────┘          │
│         │                 │                 │                  │
│         └─────────────────┼─────────────────┘                  │
│                           ▼                                     │
│                   ┌───────────────┐                            │
│                   │ MovementEngine│                            │
│                   │ .setMods(mods)│                            │
│                   └───────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Core Types (src/engine/physics/ElementalModifiers.ts)
- [x] Crear `ElementalModifiers` interface
- [x] Crear `ELEMENTAL_MODIFIERS` constant con los 4 elementos
- [x] Crear `KEY_TO_ZODIAC` mapping
- [x] Crear `getModifiersFromKey(key: string): ElementalModifiers` function

### Fase 2: Modificar StereoPhysics
- [x] `TechnoStereoPhysics.apply()` → acepta `mods?: ElementalModifiers`
- [x] `RockStereoPhysics.apply()` → acepta `mods?: ElementalModifiers`
- [x] `LatinoStereoPhysics.apply()` → acepta `mods?: ElementalModifiers`
- [x] `ChillStereoPhysics.apply()` → acepta `mods?: ElementalModifiers`

### Fase 3: Modificar MovementEngine
- [x] Recibir `mods?: ElementalModifiers` en `calculate()`
- [x] Aplicar jitter para Air element en `calculate()` (determinista con Date.now)
- [x] Aplicar smoothing modificado para Water element (effectiveSmoothFactor / decayMod)

### Fase 4: Integración en SeleneLux
- [x] Import `getModifiersFromKey` y `ElementalModifiers`
- [x] Calcular `mods` desde `lastTrinityData.key` en flujo de physics
- [x] Cachear en `lastElementalMods` para MovementEngine
- [x] Pasar `mods` a cada StereoPhysics.apply()
- [x] Pasar `mods` a MovementEngine.calculate()

### Fase 5: Documentación
- [x] Actualizar blueprint con estado IMPLEMENTADO

---

## 🎯 EJEMPLOS DE COMPORTAMIENTO ESPERADO

### Techno + Fire (Key: C major = Aries)
```
Thresholds BAJOS → Strobe FRECUENTE
Brightness ALTA → Magenta NUCLEAR
Decay RÁPIDO → Parpadeo AGRESIVO
```

### Latino + Water (Key: G minor = Scorpio)
```
Thresholds ALTOS → Solo MEGA-KICKS disparan Solar Flare
Brightness BAJA → Oro PROFUNDO (no blanco)
Decay LENTO → Flare persiste más tiempo
```

### Chill + Air (Key: D minor = Gemini)
```
Frecuencia ALTA → Respiración NERVIOSA
Jitter ALTO → Brightness IRREGULAR
Dimmer VARIABLE → Sensación de viento
```

### Rock + Earth (Key: A major = Capricorn)
```
KICK_THRESHOLD BAJO → Sensible a GRAVES
Brightness ALTA en kicks → STOMP visual
Sin jitter → Movimiento SÓLIDO
```

---

## ⚠️ RESTRICCIONES ABSOLUTAS

1. **NO modificar lógica de triggers** - Solo multiplicar parámetros
2. **NO tocar colores base** - Solo brightness/L de efectos
3. **NO cambiar algoritmos** - Solo coeficientes
4. **Retrocompatibilidad** - Si `mods` es undefined, comportamiento normal
5. **Determinista** - Jitter usa Date.now(), no Math.random()

---

**Status:** ✅ IMPLEMENTADO - 1 Enero 2026

*"No operamos con bisturí genérico. Cada órgano tiene su cirujano especializado."*
