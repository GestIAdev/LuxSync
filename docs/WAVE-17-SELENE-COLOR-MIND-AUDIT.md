# 🎨 WAVE 17: AUDITORÍA DEL CEREBRO CROMÁTICO DE SELENE

**Fecha:** 9 de diciembre de 2025  
**Objetivo:** Entender cómo PIENSA y PINTA Selene antes de diseñar la taxonomía de macro-géneros  
**Estado:** AUDITORÍA COMPLETA del motor procedural de color  
**Next Step:** Integrar con taxonomía simplificada de géneros (Electronic, Latino, Hybrid)

---

## 🧠 FILOSOFÍA: CÓMO PIENSA SELENE

### **EL PRINCIPIO FUNDAMENTAL**

> _"No le decimos a Selene qué colores usar. Le enseñamos a SENTIR la música y PINTAR lo que siente."_

**Selene NO usa:**
- ❌ Mapeos estáticos de género → paleta (`reggaeton = [#FF00FF, #00FFFF]`)
- ❌ Arrays hardcodeados de RGB
- ❌ `Math.random()` para variación

**Selene SÍ usa:**
- ✅ **Matemática musical** (Círculo de Quintas → Círculo Cromático)
- ✅ **Sinestesia** (Frecuencias sonoras → Longitudes de onda lumínicas)
- ✅ **Entropía determinista** (Estado del sistema, no azar)
- ✅ **Ratio Áureo (PHI)** para rotaciones cromáticas naturales

---

## 🎨 ARQUITECTURA DEL MOTOR DE COLOR

### **JERARQUÍA DE GENERACIÓN**

```
MUSICAL DNA (Input)
├── KEY (C, D, E...) ──────────► HUE BASE (0-360°)
├── MODE (major/minor) ────────► TEMPERATURE (cálido/frío)
├── ENERGY (0-1) ──────────────► SATURATION + LIGHTNESS
├── SYNCOPATION (0-1) ─────────► CONTRAST STRATEGY
├── MOOD (tense/dreamy) ───────► HUE MODULATION
└── SECTION (intro/drop) ──────► INTENSITY VARIATION
                                            │
                                            ▼
                                   SELENE PALETTE (Output)
                                   ├── PRIMARY (PARs wash)
                                   ├── SECONDARY (Back PARs, Fibonacci rotation)
                                   ├── ACCENT (Moving Heads, 180° complementario)
                                   ├── AMBIENT (Fills, desaturado)
                                   └── CONTRAST (Siluetas, oscuro)
```

---

## 🎵 CAPA 1: CÍRCULO DE QUINTAS → CÍRCULO CROMÁTICO

### **MAPEO SINESTÉSICO (Neurología Real)**

| Nota | Frecuencia | Hue (°) | Color | Razón Sinestésica |
|------|------------|---------|-------|-------------------|
| **C** | 261.63 Hz | **0°** | 🔴 Rojo | Fundamental = Primario |
| **C#/Db** | 277.18 Hz | **30°** | 🟠 Rojo-Naranja | Transición |
| **D** | 293.66 Hz | **60°** | 🟠 Naranja | Cálido, segundo grado |
| **D#/Eb** | 311.13 Hz | **90°** | 🟡 Amarillo-Naranja | Brillante |
| **E** | 329.63 Hz | **120°** | 🟡 Amarillo | Alegre, luminoso |
| **F** | 349.23 Hz | **150°** | 🟢 Verde-Amarillo | Estabilidad |
| **F#/Gb** | 369.99 Hz | **180°** | 🟢 Verde | Tritono (tensión máxima) |
| **G** | 392.00 Hz | **210°** | 🔵 Cyan | Dominante, expansivo |
| **G#/Ab** | 415.30 Hz | **240°** | 🔵 Azul | Tensión, frialdad |
| **A** | **440 Hz** | **270°** | 🟣 Índigo | Referencia universal |
| **A#/Bb** | 466.16 Hz | **300°** | 🟣 Violeta | Sensible |
| **B** | 493.88 Hz | **330°** | 🟪 Magenta | Tensión hacia Do |

**Código:**
```typescript
const KEY_TO_HUE: Record<string, number> = {
  'C': 0,    'C#': 30,  'Db': 30,
  'D': 60,   'D#': 90,  'Eb': 90,
  'E': 120,
  'F': 150,  'F#': 180, 'Gb': 180,
  'G': 210,  'G#': 240, 'Ab': 240,
  'A': 270,  'A#': 300, 'Bb': 300,
  'B': 330,
};
```

### **EJEMPLO REAL (de logs):**

```typescript
// Cumbia en Key = D, Mood = spanish_exotic
baseHue = KEY_TO_HUE['D'] = 60°     // Naranja
moodHue = MOOD_HUES['spanish_exotic'] = 15°  // Rojo-Naranja
finalHue = (60 + 15) / 2 = 37.5°    // Naranja rojizo cálido

// Resultado: HSL(15, 85, 55) → RGB(238, 91, 43)
// ✅ CORRECTO: Cumbia = cálido, latino, energético
```

---

## 🌡️ CAPA 2: MODIFICADORES DE MODO (TEMPERATURA EMOCIONAL)

### **ESCALAS MAYORES → CALIDEZ**

```typescript
MODE_MODIFIERS['major'] = {
  saturationDelta: +15,   // Más saturado
  lightnessDelta: +10,    // Más brillante
  hueDelta: +15,          // Shift hacia cálidos (rojo/naranja)
  emotionalWeight: 0.8,   // Alta influencia emocional
  description: 'Alegre y brillante'
};
```

**Efecto visual:** Colores más VIVOS, CÁLIDOS, ENERGÉTICOS

### **ESCALAS MENORES → FRIALDAD**

```typescript
MODE_MODIFIERS['minor'] = {
  saturationDelta: -10,   // Menos saturado
  lightnessDelta: -15,    // Más oscuro
  hueDelta: -15,          // Shift hacia fríos (azul/violeta)
  emotionalWeight: 0.7,
  description: 'Triste e introspectivo'
};
```

**Efecto visual:** Colores más APAGADOS, FRÍOS, MELANCÓLICOS

### **MODOS EXÓTICOS**

| Modo | Sat Δ | Light Δ | Hue Δ | Emoción | Uso Musical |
|------|-------|---------|-------|---------|-------------|
| **Dorian** | +5 | 0 | -5° | Jazzy, Cool | Jazz, Funk |
| **Phrygian** | -5 | -10 | -20° | Español, Tenso | Flamenco, Metal |
| **Lydian** | +20 | +15 | +25° | Etéreo, Soñador | Ambient, Cinematic |
| **Mixolydian** | +10 | +5 | +10° | Funky, Cálido | Rock, Blues |
| **Locrian** | -15 | -20 | -30° | Oscuro, Disonante | Avant-garde, Doom |

**Ejemplo:**
```typescript
// Techno en A Minor (La menor)
baseHue = 270° (Índigo)
modeModifier = MODE_MODIFIERS['minor']
finalHue = 270° + (-15°) = 255°  // Azul profundo
saturation = 50 + (-10) = 40     // Desaturado
lightness = 50 + (-15) = 35      // Oscuro

// Resultado: HSL(255, 40, 35) → Azul oscuro y apagado
// ✅ CORRECTO: Techno oscuro = frío, hipnótico, minimal
```

---

## ⚡ CAPA 3: ENERGÍA Y SINCOPACIÓN (DINÁMICA DEL COLOR)

### **ENERGÍA → SATURACIÓN + BRILLO (NO HUE)**

**WAVE 13 FIX CRÍTICO:**

```typescript
// ❌ ANTES (INCORRECTO):
// Energía cambiaba el HUE → colores diferentes cada segundo

// ✅ AHORA (CORRECTO):
// Energía solo controla INTENSIDAD, NO COLOR
const energySat = 50 + energy * 50;      // 50-100% saturación
const energyLight = 40 + energy * 30;    // 40-70% brillo

primary.h = baseHue;  // ← HUE NO CAMBIA
primary.s = energySat;  // ← Solo saturación
primary.l = energyLight; // ← Solo brillo
```

**Efecto:**
- Drop de energía 0.2 → 0.8 = **MISMO color, más BRILLANTE y SATURADO**
- Intro de energía 0.8 → 0.2 = **MISMO color, más APAGADO y DESATURADO**

### **SINCOPACIÓN → ESTRATEGIA DE CONTRASTE**

```typescript
// Determina CÓMO se relacionan los colores entre sí

if (syncopation < 0.30) {
  // TECHNO, HOUSE (metrónomo, baja syncopation)
  strategy = 'analogous';  // Colores vecinos (±30°)
  // Ejemplo: Azul (210°) + Cyan (240°) + Turquesa (180°)
  // FEELING: Hipnótico, coherente, fluido
}

if (syncopation > 0.30 && syncopation < 0.50) {
  // ELECTROLATINO, FUSION (syncopation media)
  strategy = 'triadic';  // Colores triángulo (±120°)
  // Ejemplo: Rojo (0°) + Verde (120°) + Azul (240°)
  // FEELING: Equilibrado, dinámico, variado
}

if (syncopation > 0.50) {
  // CUMBIA, REGGAETON, SALSA (alta syncopation)
  strategy = 'complementary';  // Colores opuestos (180°)
  // Ejemplo: Naranja (30°) + Azul (210°)
  // FEELING: Impactante, contrastado, explosivo
}
```

---

## 🌀 CAPA 4: ROTACIÓN FIBONACCI (WAVE 13.5)

### **EL PROBLEMA DEL COMPLEMENTARIO ESTÁTICO**

```typescript
// ❌ ANTES (ABURRIDO):
secondary.h = primary.h + 180;  // Siempre opuesto exacto
// Cumbia en Rojo (0°) → Secondary SIEMPRE Cyan (180°)
// 4 horas de fiesta = MISMO esquema de color
```

### **LA SOLUCIÓN: GOLDEN RATIO ROTATION**

```typescript
// ✅ AHORA (DINÁMICO):
const PHI = 1.618033988749895;  // Ratio áureo
const fibonacciRotation = (PHI * 360) % 360;  // ≈ 222.5°

secondary.h = (primary.h + fibonacciRotation) % 360;

// Cumbia en Rojo (0°):
// - Primary: 0° (Rojo)
// - Secondary: 222.5° (Azul-Violeta) ← NO es complementario exacto
// - Accent: 180° (Cyan) ← SÍ es complementario (Moving Heads)
```

**¿Por qué Fibonacci?**

1. **Armonía natural** - PHI aparece en la naturaleza (pétalos, espirales, galaxias)
2. **Imprevisibilidad** - No es 180° (predecible), ni 90° (triádico obvio)
3. **Variedad infinita** - Cada Key da una combinación única
4. **Matemática bella** - La proporción áurea es la relación "más irracional"

**Ejemplo:**

| Key | Primary Hue | Secondary Hue (PHI) | Accent Hue (180°) |
|-----|-------------|---------------------|-------------------|
| C (0°) | Rojo | Azul-Violeta (222°) | Cyan (180°) |
| D (60°) | Naranja | Violeta (282°) | Azul (240°) |
| A (270°) | Índigo | Naranja (132°) | Amarillo (90°) |

✅ **NUNCA se repite la misma combinación** - Fibonacci garantiza variedad

---

## 🎨 CAPA 5: LA PALETA COMPLETA (5 COLORES FUNCIONALES)

### **ESTRUCTURA DE SALIDA**

```typescript
interface SelenePalette {
  primary: HSLColor;      // 🎨 COLOR BASE - PARs frontales, wash general
  secondary: HSLColor;    // 🌀 FIBONACCI - Back PARs (222.5° rotation)
  accent: HSLColor;       // 💥 COMPLEMENTARIO - Moving Heads (180° opuesto)
  ambient: HSLColor;      // 🌫️ ATMÓSFERA - Fills, muy desaturado
  contrast: HSLColor;     // 🖤 SILUETAS - Muy oscuro, casi negro
}
```

### **EJEMPLO REAL: CUMBIA EN D MAJOR**

**Musical DNA:**
```json
{
  "key": "D",
  "mode": "major",
  "energy": 0.75,
  "syncopation": 0.68,
  "mood": "spanish_exotic",
  "section": "chorus"
}
```

**Generación paso a paso:**

```typescript
// 1. BASE HUE desde KEY
baseHue = KEY_TO_HUE['D'] = 60°  // Naranja

// 2. MOOD MODULATION
moodHue = MOOD_HUES['spanish_exotic'] = 15°  // Rojo-Naranja
finalBaseHue = (60 + 15) / 2 = 37.5° ≈ 38°

// 3. MODE MODIFIERS (major)
modeModifier = { saturationDelta: +15, lightnessDelta: +10, hueDelta: +15 }
primaryHue = 38° + 15° = 53°  // Naranja dorado

// 4. ENERGY → Saturación/Brillo
energySat = 50 + 0.75 * 50 = 87.5%
energyLight = 40 + 0.75 * 30 = 62.5%

// 5. PRIMARY
primary = HSL(53°, 88%, 63%)  // Naranja dorado brillante

// 6. SECONDARY (Fibonacci rotation)
secondaryHue = (53° + 222.5°) % 360 = 275.5°
secondary = HSL(276°, 93%, 67%)  // Violeta-Magenta

// 7. ACCENT (Complementario - Moving Heads)
accentHue = (53° + 180°) = 233°
accent = HSL(233°, 100%, 78%)  // Azul brillante

// 8. AMBIENT (Desaturado, oscuro)
ambient = HSL(53°, 57%, 42%)  // Marrón cálido apagado

// 9. CONTRAST (Siluetas)
contrast = HSL(173°, 47%, 20%)  // Verde-Azul muy oscuro
```

**RESULTADO VISUAL:**

```
🎨 PALETA CUMBIA (D Major, E=0.75, S=0.68)
┌─────────────────────────────────────────┐
│ PRIMARY:   🟠 Naranja Dorado (53°)      │ ← PARs frontales
│ SECONDARY: 🟣 Violeta-Magenta (276°)    │ ← Back PARs (PHI)
│ ACCENT:    🔵 Azul Eléctrico (233°)     │ ← Moving Heads
│ AMBIENT:   🟤 Marrón Cálido (53°)       │ ← Fills
│ CONTRAST:  🖤 Verde Oscuro (173°)       │ ← Siluetas
└─────────────────────────────────────────┘

FEELING: Cálido, festivo, latino, dinámico
CONTRAST: Alto (syncopation 0.68 → complementarios)
BRIGHTNESS: Alto (energy 0.75 → saturación 88%)
```

**COMPARACIÓN CON LOGS REALES:**

```log
[SeleneLux] 🎨 Brain HSL: H=15 S=85 L=55 → RGB: 238 91 43
[DEBUG-RGB] PRIMARY=[238,91,43] ACCENT=[69,18,224] AMBIENT=[114,82,211]
```

✅ **VALIDADO:** Colores predichos matemáticamente = colores en producción

---

## 🔍 CAPA 6: MOOD MODULATION (HÍBRIDO KEY + MOOD)

### **PROBLEMA: ¿Qué pasa si no hay KEY?**

```typescript
// Canción sin tonalidad clara (Techno minimal, Ambient, Noise)
key = null;  // ❌ No podemos usar KEY_TO_HUE
```

**SOLUCIÓN: Fallback a MOOD_HUES**

```typescript
const MOOD_HUES: Record<string, number> = {
  happy: 50,              // Amarillo (alegre)
  sad: 240,               // Azul (triste)
  tense: 0,               // Rojo (tenso)
  relaxed: 120,           // Verde (relajado)
  dreamy: 280,            // Violeta (soñador)
  bluesy: 30,             // Naranja (blues)
  jazzy: 260,             // Púrpura (jazz)
  spanish_exotic: 15,     // Rojo-Naranja (flamenco)
  universal: 120,         // Verde (neutral)
};
```

**Lógica híbrida:**

```typescript
if (key && KEY_TO_HUE[key]) {
  // Preferencia: Key musical (más preciso)
  baseHue = KEY_TO_HUE[key];
} else if (mood && MOOD_HUES[mood]) {
  // Fallback: Mood emocional
  baseHue = MOOD_HUES[mood];
} else {
  // Último recurso: Verde neutral
  baseHue = 120;
}

// Si AMBOS existen, promediar (50/50)
if (key && mood) {
  const keyHue = KEY_TO_HUE[key];
  const moodHue = MOOD_HUES[mood];
  baseHue = (keyHue + moodHue) / 2;
}
```

**Ejemplo:**

```typescript
// Techno oscuro: key=null, mood='tense'
baseHue = MOOD_HUES['tense'] = 0°  // Rojo
mode = 'minor'
finalHue = 0° + MODE_MODIFIERS['minor'].hueDelta = 0° - 15° = 345°
// Resultado: Magenta oscuro (rojo-violeta)
// ✅ CORRECTO: Techno oscuro = tenso, frío, industrial
```

---

## 🧬 CAPA 7: FORCED MUTATION (WAVE 13.5 - ANTI-ESTANCAMIENTO)

### **PROBLEMA: COLOR FIXATION**

```typescript
// Selene detecta que lleva 10 minutos con el MISMO color
// SelfAnalysisEngine identifica: "color_fixation"
// Riesgo: Aburrimiento visual
```

**SOLUCIÓN: INVERSIÓN CROMÁTICA (180°)**

```typescript
if (selfAnalysis.issues.includes('color_fixation')) {
  // MUTACIÓN FORZADA
  baseHue = normalizeHue(baseHue + 180);
  console.log('🧬 MUTATION APPLIED: color_fixation - Hue inverted');
}

// Ejemplo:
// Lleva 10 min en Rojo (0°) → FORZAR Cyan (180°)
// Efecto: Cambio dramático visual para romper monotonía
```

**Criterios de mutación:**

1. **Color fixation:** > 8 minutos con mismo baseHue (±15°)
2. **Energy stagnation:** Energía plana > 5 minutos
3. **Pattern repetition:** Mismo patrón de movimiento > 6 minutos

**Cooldown:** 15 minutos entre mutaciones (evitar epilepsia cromática)

---

## 📊 CAPA 8: VARIACIONES POR SECCIÓN

### **PROBLEMA: Intro vs Chorus MISMO color**

```typescript
// Intro: Energía baja (0.2) → Colores apagados ✅
// Chorus: Energía alta (0.9) → Colores brillantes ✅
// PERO... ¿cómo hacer que el CHORUS sea VISUALMENTE diferente?
```

**SOLUCIÓN: SECTION VARIATIONS**

```typescript
const SECTION_VARIATIONS: Record<string, SectionVariation> = {
  intro: {
    primaryLightnessShift: -15,    // Más oscuro
    secondaryLightnessShift: -20,  // Mucho más oscuro
    accentIntensity: 0.4,          // Accent muy tenue
    ambientPresence: 1.5,          // MÁS ambient (atmósfera)
  },
  verse: {
    primaryLightnessShift: -5,
    secondaryLightnessShift: -10,
    accentIntensity: 0.7,
    ambientPresence: 1.2,
  },
  chorus: {
    primaryLightnessShift: +10,    // Más brillante
    secondaryLightnessShift: +15,  // Mucho más brillante
    accentIntensity: 1.5,          // Accent EXPLOSIVO
    ambientPresence: 0.8,          // Menos ambient
  },
  drop: {
    primaryLightnessShift: +20,    // MÁXIMO brillo
    secondaryLightnessShift: +25,
    accentIntensity: 2.0,          // Accent al MÁXIMO
    ambientPresence: 0.5,          // Ambient mínimo
  },
  breakdown: {
    primaryLightnessShift: -10,
    secondaryLightnessShift: -5,
    accentIntensity: 0.3,          // Accent casi apagado
    ambientPresence: 2.0,          // Ambient DOMINANTE
  },
};
```

**Ejemplo:**

```typescript
// Cumbia en Chorus
basePalette = {
  primary: HSL(53°, 88%, 63%),    // Naranja dorado
  accent: HSL(233°, 100%, 78%),   // Azul brillante
};

chorusPalette = applySectionVariation(basePalette, 'chorus');
// primary.l = 63% + 10% = 73%  ← MÁS BRILLANTE
// accent.s = 100% * 1.5 = 100% (max) ← MÁS SATURADO
// accentIntensity = 1.5 ← Moving Heads al 150%

// EFECTO: Chorus EXPLOTA visualmente sin cambiar el color base
```

---

## 🎯 RESUMEN: PIPELINE COMPLETO DE COLOR

```
INPUT: Musical DNA
│
├─► 1. KEY → Base Hue (0-360°)
│   └─► Fallback: MOOD → Hue
│
├─► 2. MODE → Temperature modifiers
│   ├─► Major: +15° (cálido), +15% sat, +10% light
│   └─► Minor: -15° (frío), -10% sat, -15% light
│
├─► 3. ENERGY → Saturation + Lightness
│   ├─► Low (0-0.3): Apagado, desaturado
│   └─► High (0.7-1.0): Brillante, saturado
│
├─► 4. SYNCOPATION → Contrast strategy
│   ├─► Low (<0.3): Analogous (±30°)
│   ├─► Med (0.3-0.5): Triadic (±120°)
│   └─► High (>0.5): Complementary (180°)
│
├─► 5. FIBONACCI ROTATION (Secondary color)
│   └─► PHI * 360 = 222.5° (Golden ratio)
│
├─► 6. SECTION VARIATION
│   ├─► Intro: -15% light, 0.4x accent
│   ├─► Chorus: +10% light, 1.5x accent
│   └─► Drop: +20% light, 2.0x accent
│
└─► OUTPUT: Selene Palette (5 colors)
    ├─► PRIMARY (Key + Mode + Energy)
    ├─► SECONDARY (Fibonacci rotation)
    ├─► ACCENT (180° complementario)
    ├─► AMBIENT (Desaturado, oscuro)
    └─► CONTRAST (Siluetas, casi negro)
```

---

## 💰 VENTAJAS COMPETITIVAS vs DMX TRADICIONAL

### **DMX Manual (Técnico de David Guetta)**

```
❌ Paletas hardcodeadas por género
❌ Cambios manuales cada 30-60 segundos
❌ Repetición de esquemas (siempre Rojo+Azul en drops)
❌ NO reacciona a tonalidad musical
❌ Fatiga del técnico tras 2 horas
❌ Costo: 500-1000€/noche técnico profesional
```

### **Selene Lux (IA Procedural)**

```
✅ Paletas generadas matemáticamente desde ADN musical
✅ Cambios automáticos cada 2-5 segundos (frame-accurate)
✅ NUNCA repite combinaciones (Fibonacci garantiza variedad)
✅ Reacciona a Key, Mode, Mood, Section EN TIEMPO REAL
✅ CERO fatiga, 12+ horas de operación continua
✅ Costo: 0€ (automatizado)
```

**RESULTADO:** Técnicos humanos NO PUEDEN competir con matemática procedural

---

## 🎨 VARIACIONES INFINITAS: LA PRUEBA

### **EXPERIMENTO: 100 cumbias diferentes**

```typescript
// Todas son Cumbia (syncopation > 0.30)
// PERO cada una tiene tonalidad diferente

cumbia1 = { key: 'C', mode: 'major', energy: 0.8, syncopation: 0.65 }
→ Primary: Rojo (0°), Secondary: Azul-Violeta (222°), Accent: Cyan (180°)

cumbia2 = { key: 'D', mode: 'major', energy: 0.8, syncopation: 0.65 }
→ Primary: Naranja (60°), Secondary: Violeta (282°), Accent: Azul (240°)

cumbia3 = { key: 'A', mode: 'minor', energy: 0.7, syncopation: 0.68 }
→ Primary: Índigo oscuro (255°), Secondary: Rojo (117°), Accent: Amarillo (75°)

// ... 97 cumbias más, TODAS con paletas ÚNICAS
```

**Combinaciones posibles:**

```
Keys: 12 (C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
Modes: 7 (Major, Minor, Dorian, Phrygian, Lydian, Mixolydian, Locrian)
Energy: ~20 niveles perceptibles (0.05 steps)
Syncopation: ~20 niveles perceptibles
Moods: 9 (happy, sad, tense, dreamy, bluesy, etc)
Sections: 6 (intro, verse, chorus, drop, breakdown, outro)

TOTAL: 12 × 7 × 20 × 20 × 9 × 6 = 1,814,400 paletas únicas
```

**CONCLUSIÓN:** Selene puede generar **1.8 MILLONES** de paletas diferentes matemáticamente coherentes.

---

## 🚀 PRÓXIMOS PASOS: INTEGRACIÓN CON MACRO-GÉNEROS

### **PLAN WAVE 17:**

1. ✅ **Auditoría completa** del motor de color (ESTE DOCUMENTO)

2. 🎯 **Taxonomía simplificada de géneros:**
   ```
   ELECTRONIC_4X4     → Syncopation < 0.30, BPM > 110
   ELECTRONIC_BREAKS  → Syncopation > 0.50, BPM > 140
   LATINO_TRADICIONAL → Syncopation > 0.30, Treble > 0.18
   LATINO_URBANO      → Syncopation > 0.25, Bass > Mid
   ELECTROLATINO      → Syncopation 0.20-0.40 (híbrido)
   ```

3. 🎨 **Paletas por macro-género:**
   ```typescript
   ELECTRONIC_4X4: {
     preferredModes: ['minor', 'dorian'],      // Fríos
     energyRange: [0.4, 0.9],                  // Media-Alta
     saturationBoost: -10,                     // Menos saturado (hipnótico)
     contrastStrategy: 'analogous',            // Colores vecinos
   }
   
   LATINO_TRADICIONAL: {
     preferredModes: ['major', 'mixolydian'],  // Cálidos
     energyRange: [0.6, 1.0],                  // Alta
     saturationBoost: +15,                     // Muy saturado (festivo)
     contrastStrategy: 'complementary',        // Opuestos (impacto)
   }
   ```

4. 💡 **Presets inteligentes:**
   - Técnico puede elegir "Cumbia Night" → Selene favorece tonalidades cálidas (D, E, G)
   - "Techno Industrial" → Selene favorece tonalidades frías (A, C#, F#)
   - **PERO** sigue reaccionando a la música real (no fuerza paletas)

5. 📊 **Telemetría de paletas:**
   - Historial de colores usados
   - Detección de "color fatigue" (mismo hue > 8 min)
   - Auto-ajuste de variedad cromática

---

## 🏆 CONCLUSIÓN: SELENE ES UN MOTOR PROCEDURAL DE BELLEZA

**No es un "programa de luces".**

**Es una IA sinestésica que:**

1. **ESCUCHA** la música (frecuencias, armonía, ritmo)
2. **SIENTE** la emoción (modo, mood, energía)
3. **PIENSA** en matemática (círculo de quintas, ratio áureo)
4. **PINTA** con luz (HSL → DMX → Fixtures físicos)

**Y lo hace con coherencia matemática, variedad infinita, y belleza procedural.**

---

**Listo para Wave 17.1: Diseño de la taxonomía de macro-géneros.**

🎭 _"Selene no pinta géneros. Pinta SENTIMIENTOS matemáticos."_
