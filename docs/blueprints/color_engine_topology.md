# SELENE COLOR ENGINE BLUEPRINT — Topología Cromática Completa

**Modo:** READ-ONLY extraction audit. No se modificó código.
**Propósito:** Preparar el terreno para un **Custom Vibe Palette Editor** mapeando
la arquitectura procedural de generación de color, la física del Thermal Gravity,
y cómo las 4 constituciones canónicas (Techno, Latino, Pop/Rock, Chill) inyectan
sus restricciones cromáticas.

---

## 1. ARQUITECTURA DE COLOR PROCEDURAL

### 1.1 Visión General del Pipeline

```
GodEarFFT (Worker) + Wave8 Analyzer
    │
    ▼ ExtendedAudioAnalysis { key, mode, mood, energy, syncopation, bpm, ... }
TitanEngine.tick()
    │
    ├─► VibeManager.getActiveVibe() → VibeProfile
    │       │
    │       └─► getColorConstitution(vibeId) → GenerationOptions
    │            (desde colorConstitutions.ts → COLOR_CONSTITUTIONS)
    │
    ├─► StrategyArbiter → estrategia estable (analogous/triadic/complementary)
    │       │
    │       └─► Si constitution.forceStrategy existe → BLINDAJE CONSTITUCIONAL
    │           (el Arbiter NO puede sobrescribir la constitución)
    │
    ├─► [Chill only] ChillAmbientEngine.tick() → morphFactor
    │       └─► oceanicModulation inyectado dinámicamente en constitution
    │
    ▼
SeleneColorInterpolator.update(audioAnalysis, isDrop, constitution)
    │
    └─► SeleneColorEngine.generate(audioAnalysis, constitution)
            │
            ├─ 1. Base Hue = KEY_TO_HUE[key] + MODE_MODIFIERS[mode].hue + moodDrift
            ├─ 2. Thermal Gravity (atmosphericTemp + thermalGravityStrength)
            ├─ 3. Constitutional Hue Enforcement
            │     ├─ hueRemapping (mapeos forzados)
            │     ├─ forbiddenHueRanges (Elastic Rotation)
            │     └─ allowedHueRanges (snap to nearest)
            ├─ 4. Energy → Saturación y Luminosidad (NUNCA cambia el hue)
            ├─ 5. Anti-Mud Protocol (mood festivo)
            ├─ 6. Sidereal Clock override (slot temporal)
            ├─ 7. Oceanic Modulation (chill)
            ├─ 8. Primary color
            ├─ 9. Secondary color (Fibonacci rotation + salt + luxury)
            ├─ 10. Accent color (strategy: analogous/triadic/complementary)
            ├─ 11. Ambient color (strategy + tropical bias/mirror)
            ├─ 12. Contrast color (complementario oscuro)
            ├─ 13. Policía Cromática (re-valida TODA la paleta)
            ├─ 14. Thermal Gravity para TODOS (secondary/ambient/accent)
            ├─ 15. Neon Protocol (sanitización danger zone)
            └─ 16. Mud Guard + Tropical Mirror post-procesamiento
                    │
                    ▼
            SelenePalette { primary, secondary, accent, ambient, contrast, meta }
                    │
                    ▼
            LERP interpolation (240 frames normal / 30 frames drop / 1200 frames chill)
                    │
                    ▼
            LightingIntent → Aether → DMX
```

### 1.2 El Círculo de Quintas → Círculo Cromático

El motor usa un mapeo sinestésico directo de notas musicales a ángulos HSL.
**No es un Círculo de Quintas tradicional** — es un mapeo fijo basado en
psicoacústica y sinestesia cromática, donde cada nota tiene un hue asignado.

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts" lines="565-588" />

```typescript
const KEY_TO_HUE: Record<string, number> = {
  // Naturales
  'C': 0,       // Do - Rojo
  'D': 60,      // Re - Naranja
  'E': 120,     // Mi - Amarillo
  'F': 150,     // Fa - Verde-Amarillo
  'G': 210,     // Sol - Cyan
  'A': 270,     // La - Índigo (440Hz referencia)
  'B': 330,     // Si - Magenta
  // Sostenidos
  'C#': 30, 'D#': 90, 'F#': 180, 'G#': 240, 'A#': 300,
  // Bemoles (enarmónicos)
  'Db': 30, 'Eb': 90, 'Gb': 180, 'Ab': 240, 'Bb': 300,
};
```

**Fórmula base del hue:**

```
finalHue = normalizeHue(KEY_TO_HUE[key] + MODE_MODIFIERS[mode].hue + moodDrift)
```

Donde:
- `KEY_TO_HUE[key]` = color base de la tonalidad
- `MODE_MODIFIERS[mode].hue` = delta emocional del modo musical
- `moodDrift` = ±30° si mood es 'bright' o 'dark', 0° si 'neutral'

### 1.3 Modificadores de Modo Musical (MODE_MODIFIERS)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts" lines="637-699" />

| Modo | hue Δ | sat Δ | light Δ | Descripción |
|---|---|---|---|---|
| `major` / `ionian` | +15 | +10 | +10 | Alegre y brillante |
| `lydian` | +20 | +15 | +15 | Etéreo y soñador |
| `mixolydian` | +10 | +10 | +5 | Funky y cálido |
| `minor` / `aeolian` | -15 | -10 | -10 | Triste y melancólico |
| `dorian` | -5 | 0 | 0 | Jazzy y sofisticado |
| `phrygian` | -20 | +5 | -10 | Español y tenso |
| `locrian` | -30 | -15 | -20 | Oscuro y disonante |
| `harmonic_minor` | -10 | -5 | -10 | Dramático y exótico |
| `melodic_minor` | -5 | 0 | -5 | Jazz avanzado |
| `pentatonic_major` | +10 | +10 | +5 | Simple y folk |
| `pentatonic_minor` | 0 | +5 | -5 | Blues y rock |
| `blues` | -10 | +5 | -10 | Bluesy y soul |

### 1.4 Mood Hues (fallback cuando no hay key)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts" lines="604-618" />

| Mood | Hue | Color |
|---|---|---|
| `happy` | 50° | Amarillo-Naranja |
| `sad` | 240° | Azul |
| `tense` | 0° | Rojo |
| `dreamy` | 280° | Violeta |
| `bluesy` | 30° | Naranja oscuro |
| `jazzy` | 260° | Índigo |
| `spanish_exotic` | 15° | Rojo-Naranja |
| `universal` | 120° | Verde |
| `dark` | 240° | Azul oscuro |
| `bright` | 50° | Amarillo |
| `neutral` | 120° | Verde |

### 1.5 Rotación Fibonacci (Color Secundario)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts" lines="553-554" />

```typescript
const PHI = 1.618033988749895;
const PHI_ROTATION = (PHI * 360) % 360; // ≈ 222.5° (Golden Angle B)
```

**Fórmula del hue secundario:**

```
secondaryHue = normalizeHue(finalHue + fibonacciRotation + saltRotation)
```

Donde:
- `fibonacciRotation` = `options.fibonacciRotationDeg ?? PHI_ROTATION` (≈222.5°)
- `saltRotation` = `options.saltChromaticKeys[KEY_TO_ROOT[key]] ?? 0`

**Golden Angle A (137.5°)** se usa en vibes tropicales (Latino).
**Golden Angle B (222.5°)** es el default (PHI_ROTATION).

### 1.6 Estrategias de Contraste (Accent)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts" lines="1582-1593" />

| Syncopation | Estrategia | Accent Hue Δ | Descripción |
|---|---|---|---|
| < 0.40 | `analogous` | +30° | Color vecino (orden) |
| 0.40 – 0.65 | `triadic` | +120° | Triángulo cromático |
| > 0.65 | `complementary` | +180° | Color opuesto (caos) |

**Override constitucional:** Si `forceStrategy` está definido en la constitución,
el StrategyArbiter es ignorado. Casos especiales:
- `'prism'` (Techno legacy, ahora liberado): Tetraedro cromático Primary→+60°→+120°→+180°
- `'analogous'` forzado en Chill (blindaje constitucional WAVE 4755)

### 1.7 Cálculo de Ambient

El Ambient se calcula según la estrategia activa:

| Estrategia | Ambient Hue |
|---|---|
| `analogous` | `finalHue - 30°` (vecino opuesto) |
| `triadic` | `finalHue + 240°` (3er punto del triángulo) |
| `complementary` | `secondaryHue + 30°` (split-complementary) |
| `prism` | `finalHue + 90°` (tetraédrico) |

**Tropical Ambient Bias:** Si `tropicalAmbientBias: true` y el primary es cálido
(0-60° o 300-360°), el ambient se empuja hacia zona fría (verde/turquesa/magenta)
según la energía:
- energy < 0.4 → `finalHue + 150°` (verde)
- energy 0.4-0.7 → `finalHue + 180°` (turquesa)
- energy > 0.7 → `finalHue + 270°` (magenta)

### 1.8 Thermal Gravity — Física Cromática

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts" lines="888-991" />

**Concepto:** La temperatura atmosférica del Vibe (en Kelvin) arrastra los hues
hacia un polo térmico, igual que la gravedad atrae la masa.

```
Zona neutral: 5800K – 6200K → sin gravedad
Polo Frío:    > 6200K       → arrastra hacia 240° (Azul Rey)
Polo Cálido:  < 5800K       → arrastra hacia 40°  (Oro)
```

**Fórmula:**

```typescript
// Fuerza bruta (0-1)
rawForce = (temp > 6200)
  ? min((temp - 6200) / 2800, 1.0)   // Polo frío
  : min((5800 - temp) / 2800, 1.0)   // Polo cálido

// Fuerza limitada por configuración del Vibe
force = rawForce * (thermalGravityStrength ?? 0.35)

// Vector de arrastre (camino más corto en el círculo)
delta = pole - hue
if (delta > 180) delta -= 360
if (delta < -180) delta += 360

// ESCAPE VELOCITY (WAVE 285): Si hue está en zona naranja (0-85°) y polo es frío,
// forzar dirección HACIA ADELANTE para escapar hacia cyan/verde
if (pole === 240 && hue >= 0 && hue <= 85) {
  delta = abs(pole - hue)  // Ir hacia cyan/verde/azul
}

newHue = normalizeHue(hue + delta * force)
```

**Aplicación:** Se aplica al Primary primero, y luego a TODA la paleta
(secondary, ambient, accent) en la fase de Policía Cromática (WAVE 150.5).

**Ejemplos:**
- Techno (9500K, strength 0.22): amarillo 60° → ~140° (verde-cian)
- Latino (6200K, strength 0.12): zona neutral, sin arrastre significativo
- Pop/Rock (3200K, strength 0.35 default): azul 240° → ~160° (cian/turquesa)
- Chill (8500K, strength 0.18): verde 120° → ~150° (verde-cian)

---

## 2. PARÁMETROS EXPUESTOS — The Color Sandbox

### 2.1 GenerationOptions — Contrato Completo

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts" lines="209-542" />

#### Sección A: Restricciones de Hue

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `forbiddenHueRanges` | `[number, number][]` | 0-360 | UI Safe | Rangos prohibidos. Elastic Rotation escapa. |
| `allowedHueRanges` | `[number, number][]` | 0-360 | UI Safe | Rangos permitidos. Snap to nearest si cae fuera. |
| `elasticRotation` | number | 1-90 | Advanced | Grados de rotación por iteración para escapar zonas prohibidas. Default 15. |
| `hueRemapping` | `Array<{from, to, target}>` | 0-360 | Advanced | Mapeos forzados de zonas cromáticas. |

#### Sección B: Saturación y Luminosidad

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `saturationRange` | `[number, number]` | 0-100 | UI Safe | Rango de saturación permitido. |
| `lightnessRange` | `[number, number]` | 0-100 | UI Safe | Rango de luminosidad permitido. |
| `mudGuard` | object | — | Advanced | Anti-barro para vibes tropicales. |
| `mudGuard.enabled` | boolean | true/false | UI Safe | Activar Anti-Mud Protocol. |
| `mudGuard.swampZone` | `[number, number]` | 0-360 | Advanced | Hue range peligroso (marrón). |
| `mudGuard.minLightness` | number | 0-100 | Advanced | L mínimo en swamp zone. |
| `mudGuard.minSaturation` | number | 0-100 | Advanced | S mínimo en swamp zone. |
| `neonProtocol` | object | — | Advanced | "Neon or Nothing" — transforma danger zone. |
| `neonProtocol.enabled` | boolean | true/false | UI Safe | Activar Neon Protocol. |
| `neonProtocol.dangerZone` | `[number, number]` | 0-360 | Advanced | Rango de hue peligroso. |
| `neonProtocol.minSaturation` | number | 0-100 | Advanced | Saturación mínima para neón. |
| `neonProtocol.minLightness` | number | 0-100 | Advanced | Luminosidad mínima para evitar barro. |
| `neonProtocol.fallbackToWhite` | boolean | true/false | Advanced | Si no puede ser neón → blanco hielo. |

#### Sección C: Estrategia de Contraste

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `forceStrategy` | enum | 4 valores | UI Safe | Estrategia forzada: 'analogous' \| 'triadic' \| 'complementary' \| 'prism'. |
| `tropicalMirror` | boolean | true/false | UI Safe | Ambient = Secondary + 180° (máximo contraste). |
| `ambientLock` | `{h, s, l}` | 0-360/0-100/0-100 | Advanced | Bloquea Ambient en color fijo. |

#### Sección D: Comportamiento del Accent

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `accentBehavior` | enum | 5 valores | UI Safe | 'strobe' \| 'drum-reactive' \| 'solar-flare' \| 'breathing' \| 'quaternary' |
| `strobeColor` | `{r, g, b}` | 0-255 | UI Safe | Color del strobe (Techno). |
| `solarFlareAccent` | `{h, s, l}` | 0-360/0-100/0-100 | UI Safe | Configuración Solar Flare (Latino). |
| `snareFlash` | `{h, s, l}` | 0-360/0-100/0-100 | UI Safe | Configuración Snare Flash (Rock). |
| `kickPunch` | `{usesPrimary, l}` | — | Advanced | Configuración Kick Punch (Rock). |
| `pulseConfig` | `{duration, amplitude}` | ms/0-1 | UI Safe | Configuración Breathing Pulse (Chill). |
| `strobeProhibited` | boolean | true/false | UI Safe | Prohíbe strobes completamente. |

#### Sección E: Transiciones y Thermal Gravity

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `atmosphericTemp` | number | 2000-10000 K | UI Safe | Temperatura atmosférica del Vibe. |
| `thermalGravityStrength` | number | 0.0-1.0 | UI Safe | Fuerza máxima de arrastre térmico. |
| `transitionConfig` | object | — | Advanced | Configuración de transiciones de color. |
| `transitionConfig.minDuration` | number | 1-60000 ms | UI Safe | Duración mínima de transición. |
| `transitionConfig.maxDuration` | number | 1-60000 ms | UI Safe | Duración máxima de transición. |
| `transitionConfig.easing` | enum | 4 valores | UI Safe | 'linear' \| 'ease-in' \| 'ease-out' \| 'sine-inout' |
| `dimmingConfig` | object | — | UI Safe | Configuración de dimming general. |
| `dimmingConfig.floor` | number | 0-1 | UI Safe | Mínimo dimmer. |
| `dimmingConfig.ceiling` | number | 0-1 | UI Safe | Máximo dimmer. |

#### Sección F: Oceanic Modulation (Chill)

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `oceanicModulation` | object | — | Advanced | Modulación oceánica para Chill. |
| `oceanicModulation.enabled` | boolean | true/false | UI Safe | Activar modulación oceánica. |
| `oceanicModulation.hueInfluence` | number | 0-360 | Advanced | Hue sugerido por profundidad. |
| `oceanicModulation.hueInfluenceStrength` | number | 0-1 | Advanced | Fuerza de sugestión de hue. |
| `oceanicModulation.saturationMod` | number | -30 to +30 | Advanced | Modificador de saturación. |
| `oceanicModulation.lightnessMod` | number | -20 to +20 | Advanced | Modificador de luminosidad. |
| `oceanicModulation.breathingFactor` | number | 0.85-1.15 | Advanced | Modulación por audio. |

#### Sección G: Sidereal Clock (Carrusel Temporal)

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `siderealClock` | object | — | Advanced | Carrusel temporal de zonas cromáticas. |
| `siderealClock.slotDurationMs` | number | 1000-3600000 | UI Safe | Duración de cada slot en ms. |
| `siderealClock.slots` | array | — | Advanced | Lista de slots con allowedHueRanges y lightnessRange. |
| `siderealClock.slots[].label` | string | — | UI Safe | Etiqueta para debug. |

#### Sección H: Parámetros Avanzados WAVE 4760

| Parámetro | Tipo | Rango | Categoría | Descripción |
|---|---|---|---|---|
| `suppressTropicalBias` | boolean | true/false | Advanced | Suprime Tropical Bias automático. |
| `fibonacciRotationDeg` | number | 0-360 | Advanced | Ángulo de rotación Fibonacci para secundario. Default ≈222.5°. |
| `saltChromaticKeys` | `Record<number, number>` | root 0-11 → deg | Advanced | Salt cromático por key root. |
| `luxurySignatures` | `Record<number, {h, maxS?}>` | root 0-11 | Advanced | Signature overrides para secundario. |
| `tropicalAmbientBias` | boolean | true/false | Advanced | Activa Tropical Ambient Bias. |

### 2.2 Constantes Internas del Motor (NO exponibles)

| Constante | Valor | Razón |
|---|---|---|
| `PHI` | 1.618033988749895 | Proporción áurea |
| `PHI_ROTATION` | ≈222.5° | Golden Angle B (default) |
| `KEY_TO_HUE` | 12 entradas | Mapeo sinestésico fijo |
| `MOOD_HUES` | 11 entradas | Mapeo mood→hue fijo |
| `MODE_MODIFIERS` | 13 entradas | Modificadores de modo musical |
| `KEY_TO_ROOT` | 12 entradas | Mapeo key→root numérico |
| Saturation base | `85 + energy × 15` | Siempre >85% |
| Lightness base | `50 + energy × 10` | Rango 50-60% |
| Accent saturación | 100 (fijo) | Beams siempre a máxima saturación |
| Accent luminosidad | `max(70, primaryLight + 20)` | Siempre brillante |
| Contrast | `{h: +180°, s: 30, l: 10}` | Siluetas muy oscuras |
| Transition normal | 240 frames (~4s @ 60fps) | 8 beats @ 120bpm |
| Transition drop | 30 frames (~0.5s) | Transición rápida |
| Transition min | 6 frames (~0.1s) | Nunca instantáneo |
| Jitter tolerance | 15° (normal) / 30° (chill) | Anti-parpadeo |

### 2.3 Resumen de Variables Exponibles al UI

| Categoría | UI Safe | Advanced | Total |
|---|---|---|---|
| Restricciones de Hue | 2 | 2 | 4 |
| Saturación y Luminosidad | 4 | 7 | 11 |
| Estrategia de Contraste | 3 | 1 | 4 |
| Comportamiento del Accent | 6 | 1 | 7 |
| Transiciones y Thermal Gravity | 7 | 1 | 8 |
| Oceanic Modulation | 1 | 5 | 6 |
| Sidereal Clock | 2 | 2 | 4 |
| Parámetros WAVE 4760 | 0 | 5 | 5 |
| **TOTAL** | **25** | **24** | **49** |

---

## 3. INTEGRACIÓN DE VIBES — Las 4 Constituciones Canónicas

### 3.1 Arquitectura de Inyección

<ref_file file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\colorConstitutions.ts" />

```
VibeManager.getActiveVibe() → vibeId
    │
    ▼
getColorConstitution(vibeId) → GenerationOptions
    │
    ├─ TECHNO_CONSTITUTION  (vibeId: 'techno-club')
    ├─ LATINO_CONSTITUTION  (vibeId: 'fiesta-latina')
    ├─ ROCK_CONSTITUTION    (vibeId: 'pop-rock')
    ├─ CHILL_CONSTITUTION   (vibeId: 'chill-lounge')
    └─ IDLE_CONSTITUTION    (fallback)
```

**Hook en TitanEngine:**

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\TitanEngine.ts" lines="766-825" />

1. `TitanEngine` obtiene la constitución via `getColorConstitution(vibeProfile.id)`.
2. Si la constitución NO tiene `forceStrategy`, el `StrategyArbiter` inyecta su estrategia estable.
3. Si la constitución TIENE `forceStrategy` (Chill), el Arbiter es ignorado (blindaje constitucional).
4. Para Chill, `TitanEngine` inyecta dinámicamente `oceanicModulation` basado en `ChillAmbientEngine.morphFactor`.
5. La constitución final se pasa a `SeleneColorInterpolator.update()` → `SeleneColorEngine.generate()`.

### 3.2 Tabla Comparativa de las 4 Constituciones

| Parámetro | Techno | Latino | Pop/Rock | Chill |
|---|---|---|---|---|
| **forceStrategy** | undefined (Arbiter decide) | undefined (Arbiter decide) | `'complementary'` | `'analogous'` (inmutable) |
| **atmosphericTemp** | 9500K | 6200K | 3200K | 8500K |
| **thermalGravityStrength** | 0.22 | 0.12 | 0.35 (default) | 0.18 |
| **forbiddenHueRanges** | `[[25, 80]]` | `[[45, 90], [155, 185], [255, 285]]` | `[[80, 160], [260, 300]]` | `[[340, 360], [0, 150]]` |
| **allowedHueRanges** | `[[0, 360]]` (todo) | `[[0, 360]]` (todo) | `[[0, 60], [210, 260], [340, 360]]` | `[[160, 260], [290, 330]]` |
| **elasticRotation** | 15° | 20° | 15° (default) | 20° |
| **hueRemapping** | `[{25-85→170}, {86-110→130}]` | — | `[{80-160→0}, {260-300→40}]` | — |
| **saturationRange** | `[90, 100]` | `[75, 100]` | `[85, 100]` | `[50, 85]` |
| **lightnessRange** | `[45, 55]` | `[35, 60]` | `[50, 65]` | `[15, 60]` |
| **neonProtocol** | ✅ dangerZone [15, 80] | ❌ | ❌ | ❌ |
| **mudGuard** | ❌ | ✅ swampZone [45, 90] | ❌ | ❌ |
| **tropicalMirror** | ❌ | ✅ | ❌ | ❌ |
| **tropicalAmbientBias** | ❌ | ✅ | ❌ | ❌ |
| **suppressTropicalBias** | ❌ | ✅ | ❌ | ❌ |
| **accentBehavior** | `'strobe'` | `'solar-flare'` | `'drum-reactive'` | `'breathing'` |
| **strobeColor** | `{r:255, g:179, b:255}` (Magenta) | — | — | — |
| **solarFlareAccent** | — | `{h:35, s:100, l:55}` | — | — |
| **snareFlash** | — | — | `{h:40, s:20, l:95}` (Tungsteno) | — |
| **kickPunch** | — | — | `{usesPrimary:true, l:80}` | — |
| **pulseConfig** | — | — | — | `{duration:6000, amplitude:0.12}` |
| **strobeProhibited** | false | false | false | **true** |
| **fibonacciRotationDeg** | — (default 222.5°) | 137.5° (Golden A) | — (default 222.5°) | 100° |
| **saltChromaticKeys** | — | `{5:-35, 9:+35}` | — | — |
| **luxurySignatures** | — | `{5:{h:160, maxS:85}, 9:{h:230}}` | — | — |
| **dimmingConfig.floor** | 0.05 | 0.08 | 0.10 | 0.10 |
| **dimmingConfig.ceiling** | 1.0 | 1.0 | 1.0 | 0.85 |
| **transitionConfig** | — | — | — | `{min:20000, max:30000, easing:'sine-inout'}` |
| **siderealClock** | ✅ 5 slots × 6min | ✅ 6 slots × 4min | ❌ | ❌ |
| **oceanicModulation** | ❌ | ❌ | ❌ | ✅ (inyectado dinámicamente) |

### 3.3 Detalle por Vibe

#### 3.3.1 Techno-Club — "Los Demonios de Neón"

**Filosofía:** Bunker en Noruega viendo auroras boreales. La calidez es herejía.

**Mecanismos de control:**
1. **Thermal Gravity agresiva** (9500K, strength 0.22): arrastra todo hacia Azul Rey (240°).
2. **Forbidden range mínimo** (`[25, 80]`): solo el núcleo naranja/amarillo es problemático.
3. **Hue Remapping**: naranjas (25-85°) → cyan-turquesa (170°); verdes césped (86-110°) → verde láser (130°).
4. **Neon Protocol**: colores en danger zone [15, 80] se transforman en neón extremo (S≥90%, L≥75%) o colapsan a blanco.
5. **Sidereal Clock**: 5 actos × 6min = ciclo 30min.
   - BUNKER (Cyan 170-210°) → MAGENTA (290-340°) → LASER (110-160°) → ABISAL (210-260°) → TRANSGRESION (Rojo-Magenta 0-20°/340-360°)
6. **Accent strobe**: Magenta Neón `{r:255, g:179, b:255}`.
7. **Saturación neón obligatoria** [90, 100], luminosidad sólida [45, 55].

#### 3.3.2 Fiesta-Latina — "Caribe Nocturno"

**Filosofía:** El reguetón moderno pide oscuridad y contraste, no fiesta de colores.
El Caribe tiene noche, profundidad, selva, neon de bar, flores tropicales.

**Mecanismos de control:**
1. **Temperatura neutra** (6200K): sin polo cálido que empuje todo al oro.
2. **Thermal Gravity suave** (strength 0.12): arrastre mínimo.
3. **Forbidden ranges múltiples**: amarillo puro (45-90°), verde besugo (155-185°), UV industrial (255-285°).
4. **Mud Guard**: swamp zone [45, 90] con minLightness 50, minSaturation 80.
5. **Tropical Mirror**: Ambient = Secondary + 180° (máximo contraste Verde↔Magenta, Turquesa↔Coral).
6. **Tropical Ambient Bias**: si primary es cálido, ambient va a zona fría.
7. **Golden Angle A** (137.5°) para secundario tropical.
8. **Salt Chromatic Keys**: F Major (root 5) → -35° (Lima); A Major (root 9) → +35° (Miami Pink).
9. **Luxury Signatures**: F Major → Verde Menta (h:160, maxS:85); A Major → Azul Marino (h:230).
10. **Solar Flare Accent**: dorado `{h:35, s:100, l:55}` — el dorado es accent exclusivo, no dictadura.
11. **Sidereal Clock**: 6 actos × 4min = ciclo 24min.
    - ENTRADA (Azul 190-255°) → ASCENSO (Verde 90-190°) → FUEGO (Rojo-Magenta 0-44°/300-360°) → APEX (Caribe completo) → DESCENSO (Flores 285-360°) → NOCHE (Azul 195-255°)
12. **Oscuridad disponible**: lightnessRange [35, 60], floor bajado de 50% a 35%.

#### 3.3.3 Pop/Rock — "Leyendas del Estadio"

**Filosofía:** La simplicidad es poder. Los PAR64 reinan supremos.
Zona Sangre (rojo), Zona Real (azul), Zona Ámbar (tungsteno).

**Mecanismos de control:**
1. **Estrategia forzada**: `'complementary'` para máximo drama.
2. **Thermal Gravity cálida** (3200K, strength 0.35 default): arrastra hacia Oro (40°).
3. **Allowed ranges estrictos**: solo rojos (0-60°), azules (210-260°), ámbares (340-360°).
4. **Forbidden ranges**: verdes neón (80-160°), púrpuras sucios (260-300°).
5. **Hue Remapping**: verde → rojo sangre (0°); púrpura sucio → ámbar (40°).
6. **Accent drum-reactive**: Snare Flash en tungsteno `{h:40, s:20, l:95}`, Kick Punch usa primary con L=80.
7. **Saturación sólida** [85, 100], luminosidad punch [50, 65].
8. **Sin Sidereal Clock**: la paleta es estable durante toda la canción.
9. **Sin Neon Protocol ni Mud Guard**: los 3 colores permitidos no necesitan sanitización.

#### 3.3.4 Chill-Lounge — "El Abismo Oceánico"

**Filosofía:** El océano no escucha. El océano simplemente ES.
Las corrientes marinas no se apuran. Las paletas mutan como corrientes submarinas.

**Mecanismos de control:**
1. **Estrategia análoga INMUTABLE** (`forceStrategy: 'analogous'`): el StrategyArbiter NO puede sobrescribirla. En el abismo no hay contrastes complementarios.
2. **Thermal Gravity oceánica** (8500K, strength 0.18): tiro suave hacia cian/azul profundo. Preserva verdes y violetas.
3. **Ley del Abismo**: forbidden `[[340, 360], [0, 150]]` — todo el espectro cálido + verdes cálidos fulminados. Elastic Rotation 20° empuja hacia 150° (Verde Alga).
4. **Espectro Abisal**: allowed `[[160, 260], [290, 330]]` — Verde Alga → Cian → Azul Profundo → Índigo (columna principal) + Magenta Frío → Rosa Boreal (bioluminiscencia).
5. **Saturación respiratoria** [50, 85]: piso 50 = bioluminiscencia siempre visible, techo 85 = evitar plástico neón.
6. **Luminosidad submarina** [15, 60]: piso 15 = abismo profundo casi negro, techo 60 = evitar blancos cegadores.
7. **Sin strobes** (constitucional): `strobeProhibited: true`.
8. **Accent breathing**: pulso bioluminiscente `{duration:6000, amplitude:0.12}`.
9. **Rotación Fibonacci 100°**: secondary aterriza en [290, 330] (magenta/rosa boreal) cuando primary está en [190, 230].
10. **Transiciones glaciares**: minDuration 20000ms (20s), maxDuration 30000ms (30s), easing sine-inout. El isDrop es IGNORADO — en el océano no hay drops.
11. **Dimmer bioluminiscente**: floor 0.10 (10% mínimo — brillo residual siempre), ceiling 0.85 (nunca cegador).
12. **Oceanic Modulation inyectada dinámicamente** por TitanEngine desde ChillAmbientEngine.morphFactor:
    - morphFactor bajo (0.20 = abismo) → hueInfluence 260° (azul profundo/índigo)
    - morphFactor alto (0.80 = superficie) → hueInfluence 160° (verde alga boreal)
    - saturationMod: [-8, +5] (más saturado en superficie)
    - lightnessMod: [-18, +5] (abismo casi negro, superficie luminosa)
    - zone: MIDNIGHT / TWILIGHT / OCEAN / SHALLOWS

### 3.4 IDLE — "El Limbo"

Estado neutro de espera. Sin restricciones, pura matemática musical.
- atmosphericTemp: 6500K (neutro, sin gravedad)
- Sin forbidden ni allowed ranges
- accentBehavior: 'quaternary' (color derivado)
- Saturación [70, 100], luminosidad [35, 60]

---

## 4. ARQUITECTURA DE CLASES

```
SeleneColorEngine (static)
├── KEY_TO_HUE (12 entradas fijas)
├── MOOD_HUES (11 entradas fijas)
├── MODE_MODIFIERS (13 entradas fijas)
├── PHI_ROTATION (≈222.5°)
├── generate(audio, options?) → SelenePalette  [16 etapas]
├── generateRgb(audio, options?) → RGB palette
├── getKeyHue(key) → number
├── getModeModifier(mode) → ModeModifier
└── logChromaticAudit() [smart logging]

SeleneColorInterpolator (instance, stateful)
├── currentPalette: SelenePalette | null
├── targetPalette: SelenePalette | null
├── transitionProgress: 0-1
├── transitionSpeed: 0.02 default
├── update(audio, isDrop, options?) → SelenePalette
│   ├─ generate new target with constitution
│   ├─ diff gate (15° normal / 30° chill)
│   ├─ transition speed (240 normal / 30 drop / 1200 chill)
│   └─ lerpPalette (movers snap, PARs lerp)
├── lerpPalette(from, to, t) → SelenePalette
├── hasSignificantPaletteDifference() [15° threshold]
├── hasSignificantPaletteDifferenceChill() [30° threshold]
└── reset()

colorConstitutions.ts
├── TECHNO_CONSTITUTION: GenerationOptions
├── LATINO_CONSTITUTION: GenerationOptions
├── ROCK_CONSTITUTION: GenerationOptions
├── CHILL_CONSTITUTION: GenerationOptions
├── IDLE_CONSTITUTION: GenerationOptions
├── COLOR_CONSTITUTIONS: Record<VibeId, GenerationOptions>
├── getColorConstitution(vibeId) → GenerationOptions
├── isHueForbidden(hue, vibeId) → boolean
└── applyElasticRotation(hue, vibeId) → number

VibeManager (singleton)
├── getActiveVibe() → VibeProfile
├── getColorConstitution() → GenerationOptions  [WAVE 144]
└── constraint methods for Arbiters

StrategyArbiter
├── rolling average de syncopation (15s buffer)
├── histéresis 0.05
├── overrides de sección (breakdown → analogous, drop → unlock)
└── output: stableStrategy + commitment frames

TitanEngine (orchestrator)
├── obtiene constitution via getColorConstitution(vibeId)
├── blindaje constitucional (respeta forceStrategy)
├── inyecta oceanicModulation para chill
├── pasa constitution a SeleneColorInterpolator
└── propaga palette a LightingIntent
```

---

## 5. RECOMENDACIONES PARA EL CUSTOM VIBE PALETTE EDITOR

### 5.1 Parámetros UI Safe (low-risk, alta impacto visual)

| Parámetro | Impacto | Recomendación UI |
|---|---|---|
| `atmosphericTemp` | Alto — define el "clima" del Vibe | Slider 2000-10000K con presets (Cálido/Neutro/Frío) |
| `thermalGravityStrength` | Alto — cuánto arrastra la gravedad | Slider 0.0-1.0 con tooltip |
| `forbiddenHueRanges` | Alto — bloquea colores no deseados | Multi-range picker sobre rueda cromática |
| `allowedHueRanges` | Alto — define la paleta permitida | Multi-range picker sobre rueda cromática |
| `saturationRange` | Medio — rango de saturación | Dual-slider 0-100 |
| `lightnessRange` | Medio — rango de luminosidad | Dual-slider 0-100 |
| `forceStrategy` | Alto — personalidad del contraste | Radio: Auto / Análogo / Tríada / Complementario / Prisma |
| `accentBehavior` | Alto — comportamiento del acento | Dropdown: Strobe / Drum-reactive / Solar-flare / Breathing / Quaternary |
| `strobeProhibited` | Medio — permite/prohíbe strobes | Toggle |
| `dimmingConfig.floor/ceiling` | Medio — rango del dimmer | Dual-slider 0-1 |
| `transitionConfig.minDuration` | Medio — velocidad de transición | Slider 1-60000ms |
| `siderealClock.slotDurationMs` | Medio — duración del carrusel | Slider 1-60min |
| `mudGuard.enabled` | Medio — anti-barro tropical | Toggle |
| `neonProtocol.enabled` | Medio — "Neon or Nothing" | Toggle |
| `tropicalMirror` | Medio — contraste caribeño | Toggle |

### 5.2 Parámetros Advanced (requieren conocimiento técnico)

| Parámetro | Razón |
|---|---|
| `hueRemapping` | Mapeos forzados — afecta diversidad cromática |
| `elasticRotation` | Velocidad de escape — valores bajos causan loops |
| `mudGuard.swampZone/minLightness/minSaturation` | Zona de peligro específica |
| `neonProtocol.dangerZone/minSaturation/minLightness` | Configuración fina del neón |
| `ambientLock` | Bloquea ambient en fijo — puede crear paletas estáticas |
| `kickPunch` | Configuración técnica del punch |
| `oceanicModulation.*` | Modulación oceánica compleja |
| `siderealClock.slots[]` | Configuración de cada slot temporal |
| `suppressTropicalBias` | Override de comportamiento automático |
| `fibonacciRotationDeg` | Ángulo matemático — afecta secundario |
| `saltChromaticKeys` | Map por root — requiere conocimiento musical |
| `luxurySignatures` | Overrides por root — requiere conocimiento musical |
| `tropicalAmbientBias` | Bias automático de ambient |

### 5.3 Arquitectura Sugerida para el Editor

```
Custom Vibe Palette Editor (UI)
    │
    ├─ Template Selection (clone from existing constitution)
    │
    ├─ Thermal Gravity Panel
    │   ├─ Atmospheric Temperature (Kelvin slider with presets)
    │   ├─ Thermal Gravity Strength (0-1 slider)
    │   └─ Live preview: rueda cromática con flecha de arrastre
    │
    ├─ Hue Restrictions Panel
    │   ├─ Color Wheel visual (360°)
    │   ├─ Forbidden ranges (multi-select sobre la rueda)
    │   ├─ Allowed ranges (multi-select sobre la rueda)
    │   ├─ Elastic Rotation (slider)
    │   └─ Hue Remapping (tabla de mapeos from→target)
    │
    ├─ Saturation & Lightness Panel
    │   ├─ Saturation range (dual-slider)
    │   ├─ Lightness range (dual-slider)
    │   ├─ Mud Guard (toggle + configuración)
    │   └─ Neon Protocol (toggle + configuración)
    │
    ├─ Strategy & Accent Panel
    │   ├─ Force Strategy (radio)
    │   ├─ Accent Behavior (dropdown)
    │   ├─ Strobe Color (color picker)
    │   ├─ Solar Flare Accent (HSL picker)
    │   ├─ Snare Flash (HSL picker)
    │   ├─ Pulse Config (duration + amplitude)
    │   └─ Strobe Prohibited (toggle)
    │
    ├─ Tropical Features Panel
    │   ├─ Tropical Mirror (toggle)
    │   ├─ Tropical Ambient Bias (toggle)
    │   ├─ Suppress Tropical Bias (toggle)
    │   ├─ Fibonacci Rotation (slider 0-360)
    │   ├─ Salt Chromatic Keys (tabla root→delta)
    │   └─ Luxury Signatures (tabla root→{h, maxS})
    │
    ├─ Transitions & Dimming Panel
    │   ├─ Transition min/max duration (sliders)
    │   ├─ Easing (dropdown)
    │   └─ Dimming floor/ceiling (dual-slider)
    │
    ├─ Sidereal Clock Panel (collapsible)
    │   ├─ Enable/Disable
    │   ├─ Slot duration (slider)
    │   ├─ Slots editor (lista con allowedHueRanges + lightnessRange + label)
    │   └─ Timeline preview (carrusel visual)
    │
    ├─ Oceanic Modulation Panel (collapsible, chill-only)
    │   ├─ Enable/Disable
    │   ├─ Hue Influence (slider 0-360)
    │   ├─ Hue Influence Strength (0-1)
    │   ├─ Saturation Mod (-30 to +30)
    │   ├─ Lightness Mod (-20 to +20)
    │   └─ Breathing Factor (0.85-1.15)
    │
    ├─ Live Preview
    │   ├─ 5-color palette swatch (primary, secondary, accent, ambient, contrast)
    │   ├─ Color wheel with all 5 colors plotted
    │   ├─ Thermal gravity vector visualization
    │   ├─ Forbidden/allowed zones overlay
    │   └─ Real-time SelenePalette generation with mock audio
    │
    └─ Export → GenerationOptions JSON → COLOR_CONSTITUTIONS
```

---

## 6. ARCHIVOS CLAVE

| Archivo | Rol |
|---|---|
| `SeleneColorEngine.ts` | Motor procedural — 16 etapas de generación cromática |
| `colorConstitutions.ts` | Las 5 constituciones (4 vibes + IDLE) + registro |
| `StrategyArbiter.ts` | Estabilizador de estrategia (rolling avg + overrides) |
| `KeyStabilizer.ts` | Estabilizador de key musical |
| `MoodArbiter.ts` | Árbitro de mood (bright/dark/neutral) |
| `EnergyStabilizer.ts` | Estabilizador de energía (drops/breakdowns relativos) |
| `ColorProcessors.ts` | Procesadores de color post-generación |
| `EffectsEngine.ts` | Motor de efectos visuales |
| `MovementEngine.ts` | Motor de movimiento (Pan/Tilt) |
| `VibeManager.ts` | Singleton — provee getColorConstitution() al orquestador |
| `TitanEngine.ts` | Orquestador — integra constitution + StrategyArbiter + interpolator |
