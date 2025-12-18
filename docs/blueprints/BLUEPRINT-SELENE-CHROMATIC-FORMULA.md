# 🎨 BLUEPRINT: FÓRMULA CROMÁTICA PROCEDURAL DE SELENE

**Fecha:** Diciembre 2025  
**Autor:** Sistema Selene Lux  
**Estado:** Diseño Conceptual + Técnico  
**Objetivo:** Que Selene genere la paleta perfecta para CADA canción basándose en su ADN musical

---

## 🚫 EL PROBLEMA: EL FERRARI EN EL GARAGE

### Lo Que Íbamos a Hacer (MAL)
```typescript
// ANTI-PATRÓN: Mapeo estático aburrido
const GENRE_TO_PALETTE = {
  reggaeton: ['#FF00FF', '#00FFFF', '#FFD700'],  // Siempre igual
  cumbia: ['#FF6B35', '#FFD700', '#32CD32'],     // 4 horas mismo color
  techno: ['#0000FF', '#FF0000', '#FFFFFF'],     // Predecible
};
```

**Resultado:** 4 horas de sesión latina = 4 horas con los mismos colores. ABURRIDO.

### Lo Que Vamos a Hacer (BIEN)
```typescript
// PATRÓN CORRECTO: Generación procedural
const palette = selene.generatePalette({
  key: 'A',           // La
  mode: 'minor',      // Menor (triste)
  syncopation: 0.65,  // Alta (reggaeton)
  energy: 0.8,        // Alta
  section: 'chorus'   // Coro
});

// Resultado: Paleta ÚNICA para este momento musical
// → Base: Índigo profundo (A minor = frío)
// → Acento: Dorado complementario (alta energía)
// → Movimiento: Rápido (syncopation alta)
```

---

## 🎵 FUNDAMENTO TEÓRICO: SINESTESIA MUSICAL

### El Círculo de Quintas Cromático

La sinestesia (ver colores al escuchar música) no es magia - es neurología. Existe una correlación natural entre frecuencias de sonido y longitudes de onda de luz.

```
         C (Do)
          🔴
    F           G
   🟣           🟠
  
 Bb               D
🔵                🟡

  Eb            A
   🔵           🟢
    Ab      E
      🟣  🟢
         B
         🟡

CÍRCULO DE QUINTAS → CÍRCULO CROMÁTICO
```

### Mapeo Key → Color Base (Hue)

| Nota | Grados | Color | Razón Sinestésica |
|------|--------|-------|-------------------|
| C | 0° | Rojo | Do = Fundamental, Rojo = Primario |
| C#/Db | 30° | Rojo-Naranja | Transición |
| D | 60° | Naranja | Re = Segundo, cálido |
| D#/Eb | 90° | Amarillo-Naranja | Brillante |
| E | 120° | Amarillo | Mi = Alegre, luminoso |
| F | 150° | Verde-Amarillo | Fa = Estabilidad |
| F#/Gb | 180° | Verde | Tritono = complementario |
| G | 210° | Cyan | Sol = Dominante, expansivo |
| G#/Ab | 240° | Azul | Tensión |
| A | 270° | Índigo | La = 440Hz, referencia |
| A#/Bb | 300° | Violeta | Sensible |
| B | 330° | Magenta | Si = Tensión hacia Do |

### Fórmula Base

```typescript
function keyToHue(key: string): number {
  const KEY_TO_HUE: Record<string, number> = {
    'C': 0, 'C#': 30, 'Db': 30,
    'D': 60, 'D#': 90, 'Eb': 90,
    'E': 120,
    'F': 150, 'F#': 180, 'Gb': 180,
    'G': 210, 'G#': 240, 'Ab': 240,
    'A': 270, 'A#': 300, 'Bb': 300,
    'B': 330
  };
  return KEY_TO_HUE[key] ?? 0;
}
```

---

## 🌡️ MODIFICADORES DE MODO: LA TEMPERATURA EMOCIONAL

### Escalas Mayores → Calidez
```
MAYOR = Alegre, Abierto, Brillante
  → Saturación: +15%
  → Luminosidad: +10%
  → Temperatura: Shift +15° hacia cálidos
```

### Escalas Menores → Frialdad
```
MENOR = Triste, Introspectivo, Misterioso
  → Saturación: -10%
  → Luminosidad: -15%
  → Temperatura: Shift -15° hacia fríos
```

### Modos Especiales

| Modo | Modificador S | Modificador L | Shift Hue | Emoción |
|------|---------------|---------------|-----------|---------|
| Ionian (Mayor) | +15% | +10% | +15° | Alegre |
| Dorian | +5% | 0% | -5° | Jazzy, Cool |
| Phrygian | -5% | -10% | -20° | Español, Tenso |
| Lydian | +20% | +15% | +25° | Etéreo, Soñador |
| Mixolydian | +10% | +5% | +10° | Funky, Cálido |
| Aeolian (Menor) | -10% | -15% | -15° | Triste |
| Locrian | -15% | -20% | -30° | Oscuro, Disonante |

### Código de Modificadores

```typescript
interface ModeModifier {
  saturationDelta: number;  // -20 a +20
  lightnessDelta: number;   // -20 a +20
  hueDelta: number;         // Grados de shift
  emotionalWeight: number;  // Para mezclar con otras señales
}

const MODE_MODIFIERS: Record<string, ModeModifier> = {
  'major':      { saturationDelta: 15, lightnessDelta: 10, hueDelta: 15, emotionalWeight: 0.8 },
  'minor':      { saturationDelta: -10, lightnessDelta: -15, hueDelta: -15, emotionalWeight: 0.7 },
  'dorian':     { saturationDelta: 5, lightnessDelta: 0, hueDelta: -5, emotionalWeight: 0.6 },
  'phrygian':   { saturationDelta: -5, lightnessDelta: -10, hueDelta: -20, emotionalWeight: 0.9 },
  'lydian':     { saturationDelta: 20, lightnessDelta: 15, hueDelta: 25, emotionalWeight: 0.7 },
  'mixolydian': { saturationDelta: 10, lightnessDelta: 5, hueDelta: 10, emotionalWeight: 0.6 },
  'locrian':    { saturationDelta: -15, lightnessDelta: -20, hueDelta: -30, emotionalWeight: 0.5 },
};
```

---

## ⚡ ENERGÍA Y SINCOPACIÓN: LA DINÁMICA DEL COLOR

### Principio: Energía → Contraste

| Energía | Estrategia de Color | Razón |
|---------|---------------------|-------|
| Baja (< 0.3) | Análogos (±30°) | Suave, relajante |
| Media (0.3-0.6) | Triádicos (±120°) | Equilibrado |
| Alta (> 0.6) | Complementarios (180°) | Impactante, choque visual |

### Principio: Sincopación → Saturación del Secundario

```
Sincopación Alta (Reggaeton, Funk)
  → Colores secundarios MUY saturados
  → Transiciones rápidas entre colores
  → Feeling: "Punch" visual

Sincopación Baja (Techno, Ambient)
  → Colores secundarios desaturados
  → Transiciones suaves
  → Feeling: Hipnótico
```

### Fórmula de Color Secundario

```typescript
function calculateSecondaryHue(baseHue: number, energy: number, syncopation: number): number {
  // Determinar ángulo de separación según energía
  let separation: number;
  
  if (energy < 0.3) {
    // Baja energía: colores análogos (vecinos)
    separation = 30;
  } else if (energy < 0.6) {
    // Media energía: triádicos
    separation = 120;
  } else {
    // Alta energía: complementarios (opuestos)
    separation = 180;
  }
  
  // La sincopación determina si vamos "hacia adelante" o "hacia atrás" en el círculo
  const direction = syncopation > 0.5 ? 1 : -1;
  
  return (baseHue + (separation * direction) + 360) % 360;
}

function calculateSecondarySaturation(baseSaturation: number, syncopation: number): number {
  // Alta sincopación = más saturación en el secundario (más "punch")
  const saturationBoost = syncopation * 30; // 0-30% extra
  return Math.min(100, baseSaturation + saturationBoost);
}
```

---

## 🎨 LA PALETA COMPLETA: 5 COLORES FUNCIONALES

### Estructura de la Paleta

```typescript
interface SelenePalette {
  // Color principal - Fixtures estáticos, wash general
  primary: HSLColor;
  
  // Color secundario - Moving heads, efectos de acento
  secondary: HSLColor;
  
  // Color de acento - Strobes, flashes, momentos de impacto
  accent: HSLColor;
  
  // Color de ambiente - Backlighting, fills suaves
  ambient: HSLColor;
  
  // Color de contraste - Highlights, siluetas
  contrast: HSLColor;
  
  // Metadata
  metadata: {
    generatedAt: number;
    musicalDNA: MusicalDNA;
    confidence: number;
    transitionSpeed: number;  // ms para cambiar a esta paleta
  };
}

interface HSLColor {
  h: number;  // 0-360
  s: number;  // 0-100
  l: number;  // 0-100
}

interface MusicalDNA {
  key: string;
  mode: string;
  energy: number;
  syncopation: number;
  mood: string;
  section: string;
}
```

### Algoritmo de Generación

```typescript
function generatePalette(dna: MusicalDNA): SelenePalette {
  // 1. COLOR BASE desde la tonalidad
  const baseHue = keyToHue(dna.key);
  
  // 2. MODIFICADORES desde el modo
  const modeModifier = MODE_MODIFIERS[dna.mode] ?? MODE_MODIFIERS['major'];
  
  // 3. PRIMARY - El color base modificado
  const primary: HSLColor = {
    h: (baseHue + modeModifier.hueDelta + 360) % 360,
    s: clamp(70 + modeModifier.saturationDelta, 20, 100),
    l: clamp(50 + modeModifier.lightnessDelta, 20, 80),
  };
  
  // 4. SECONDARY - Según energía y sincopación
  const secondaryHue = calculateSecondaryHue(primary.h, dna.energy, dna.syncopation);
  const secondary: HSLColor = {
    h: secondaryHue,
    s: calculateSecondarySaturation(primary.s, dna.syncopation),
    l: primary.l + (dna.energy > 0.5 ? 10 : -10), // Más claro si alta energía
  };
  
  // 5. ACCENT - Siempre complementario para impacto máximo
  const accent: HSLColor = {
    h: (primary.h + 180) % 360,
    s: Math.min(100, primary.s + 20), // Muy saturado
    l: Math.min(90, primary.l + 20),  // Brillante
  };
  
  // 6. AMBIENT - Desaturado, más oscuro
  const ambient: HSLColor = {
    h: primary.h,
    s: Math.max(20, primary.s - 40), // Muy desaturado
    l: Math.max(15, primary.l - 25), // Oscuro
  };
  
  // 7. CONTRAST - El más oscuro para siluetas
  const contrast: HSLColor = {
    h: (primary.h + 30) % 360, // Ligeramente diferente
    s: 30,
    l: 10,
  };
  
  // 8. VELOCIDAD DE TRANSICIÓN según energía
  const transitionSpeed = mapRange(dna.energy, 0, 1, 2000, 300);
  // Baja energía = 2 segundos suaves
  // Alta energía = 300ms rápidos
  
  return {
    primary,
    secondary,
    accent,
    ambient,
    contrast,
    metadata: {
      generatedAt: Date.now(),
      musicalDNA: dna,
      confidence: calculatePaletteConfidence(dna),
      transitionSpeed,
    },
  };
}
```

---

## 🔄 CUÁNDO GENERAR NUEVA PALETA

### Triggers de Regeneración

| Evento | Acción | Razón |
|--------|--------|-------|
| **Cambio de Key** | Regenerar TODO | Nueva canción probable |
| **Cambio de Modo** | Regenerar Primary + Secondary | Cambio emocional |
| **Cambio de Sección** | Ajustar Intensidades | Verso vs Coro |
| **Cambio de Energía >30%** | Regenerar Secondary + Accent | Dinámica |
| **Drop Detectado** | Flash de Accent → Nueva paleta | Impacto máximo |

### Histéresis Anti-Flicker

```typescript
class PaletteManager {
  private currentPalette: SelenePalette;
  private lastKeyChange: number = 0;
  private lastModeChange: number = 0;
  
  // Mínimo tiempo entre cambios de paleta (anti-flicker)
  private readonly MIN_PALETTE_CHANGE_INTERVAL = 5000; // 5 segundos
  private readonly MIN_KEY_CHANGE_INTERVAL = 10000;    // 10 segundos
  
  shouldRegeneratePalette(newDNA: MusicalDNA): boolean {
    const now = Date.now();
    const currentDNA = this.currentPalette.metadata.musicalDNA;
    
    // Cambio de Key = cambio de canción
    if (newDNA.key !== currentDNA.key) {
      if (now - this.lastKeyChange > this.MIN_KEY_CHANGE_INTERVAL) {
        this.lastKeyChange = now;
        return true;
      }
    }
    
    // Cambio de modo significativo
    if (newDNA.mode !== currentDNA.mode) {
      if (now - this.lastModeChange > this.MIN_PALETTE_CHANGE_INTERVAL) {
        this.lastModeChange = now;
        return true;
      }
    }
    
    // Cambio de energía > 30%
    if (Math.abs(newDNA.energy - currentDNA.energy) > 0.3) {
      return true;
    }
    
    return false;
  }
}
```

---

## 🎯 SECCIONES: VARIACIÓN SIN CAMBIO TOTAL

### El Problema del "Monotono"

4 horas de reggaeton ≠ 4 horas del mismo color.  
Pero tampoco queremos un epiléptico cambio cada 10 segundos.

### Solución: Variaciones por Sección

```typescript
interface SectionVariation {
  primaryLightnessShift: number;
  secondaryLightnessShift: number;
  accentIntensity: number;
  ambientPresence: number;
}

const SECTION_VARIATIONS: Record<string, SectionVariation> = {
  'intro': {
    primaryLightnessShift: -20,     // Más oscuro
    secondaryLightnessShift: -15,
    accentIntensity: 0.3,           // Poco acento
    ambientPresence: 0.7,           // Mucho ambiente
  },
  'verse': {
    primaryLightnessShift: -10,
    secondaryLightnessShift: -5,
    accentIntensity: 0.5,
    ambientPresence: 0.5,
  },
  'pre_chorus': {
    primaryLightnessShift: 0,
    secondaryLightnessShift: 5,
    accentIntensity: 0.7,           // Buildup
    ambientPresence: 0.4,
  },
  'chorus': {
    primaryLightnessShift: 15,      // Más brillante
    secondaryLightnessShift: 20,
    accentIntensity: 1.0,           // Full acento
    ambientPresence: 0.3,
  },
  'drop': {
    primaryLightnessShift: 20,
    secondaryLightnessShift: 25,
    accentIntensity: 1.0,
    ambientPresence: 0.1,           // Sin ambiente, puro impacto
  },
  'bridge': {
    primaryLightnessShift: -5,
    secondaryLightnessShift: 10,
    accentIntensity: 0.6,
    ambientPresence: 0.6,
  },
  'outro': {
    primaryLightnessShift: -15,
    secondaryLightnessShift: -20,
    accentIntensity: 0.2,
    ambientPresence: 0.8,           // Fade out
  },
};
```

### Aplicación de Variación

```typescript
function applySection Variation(
  palette: SelenePalette, 
  section: string
): SelenePalette {
  const variation = SECTION_VARIATIONS[section] ?? SECTION_VARIATIONS['verse'];
  
  return {
    ...palette,
    primary: {
      ...palette.primary,
      l: clamp(palette.primary.l + variation.primaryLightnessShift, 10, 95),
    },
    secondary: {
      ...palette.secondary,
      l: clamp(palette.secondary.l + variation.secondaryLightnessShift, 10, 95),
    },
    accent: {
      ...palette.accent,
      s: palette.accent.s * variation.accentIntensity,
    },
    ambient: {
      ...palette.ambient,
      l: palette.ambient.l * variation.ambientPresence,
    },
  };
}
```

---

## 🌈 CASOS PRÁCTICOS

### Caso 1: Reggaeton en A Menor (Bad Bunny)

```typescript
const dna: MusicalDNA = {
  key: 'A',
  mode: 'minor',
  energy: 0.85,
  syncopation: 0.7,
  mood: 'aggressive',
  section: 'chorus'
};

// Resultado:
// Key A → Hue 270° (Índigo)
// Minor → Shift -15° → 255° (Azul profundo)
// Alta energía → Secondary complementario (180°)
// Alta syncopation → Secondary muy saturado

{
  primary: { h: 255, s: 60, l: 35 },     // Azul profundo
  secondary: { h: 75, s: 95, l: 55 },    // Amarillo verdoso saturado (PUNCH)
  accent: { h: 75, s: 100, l: 70 },      // Amarillo brillante (para el drop)
  ambient: { h: 255, s: 20, l: 10 },     // Azul casi negro
  contrast: { h: 285, s: 30, l: 10 },    // Púrpura oscuro
}

// ¡NO es neón genérico! Es una paleta ÚNICA para esta canción
```

### Caso 2: Cumbia en G Mayor (Alegre)

```typescript
const dna: MusicalDNA = {
  key: 'G',
  mode: 'major',
  energy: 0.6,
  syncopation: 0.5,
  mood: 'happy',
  section: 'verse'
};

// Resultado:
// Key G → Hue 210° (Cyan)
// Major → Shift +15° → 225° + saturation boost
// Media energía → Secondary triádico (120°)
// Media syncopation → Secondary saturación normal

{
  primary: { h: 225, s: 85, l: 60 },     // Cyan brillante
  secondary: { h: 345, s: 80, l: 55 },   // Rosa salmón
  accent: { h: 45, s: 100, l: 70 },      // Dorado
  ambient: { h: 225, s: 30, l: 25 },     // Cyan oscuro
  contrast: { h: 255, s: 30, l: 10 },    // Azul profundo
}

// ¡Colores cálidos y festivos para la cumbia!
```

### Caso 3: Techno en F# Menor (Oscuro)

```typescript
const dna: MusicalDNA = {
  key: 'F#',
  mode: 'minor',
  energy: 0.75,
  syncopation: 0.1,  // Techno = baja sincopación
  mood: 'dark',
  section: 'drop'
};

// Resultado:
// Key F# → Hue 180° (Verde/Cyan)
// Minor → Shift -15° → 165°
// Alta energía → Complementario
// Baja syncopation → Secundario desaturado

{
  primary: { h: 165, s: 60, l: 35 },     // Verde azulado oscuro
  secondary: { h: 345, s: 45, l: 25 },   // Magenta desaturado
  accent: { h: 345, s: 100, l: 60 },     // Magenta puro (para strobes)
  ambient: { h: 165, s: 20, l: 8 },      // Verde casi negro
  contrast: { h: 195, s: 30, l: 5 },     // Negro azulado
}

// Paleta industrial, hipnótica - perfecta para techno oscuro
```

---

## 🏗️ ARQUITECTURA DE IMPLEMENTACIÓN

### Archivo: `mapping/ProceduralPaletteGenerator.ts`

```
ProceduralPaletteGenerator
├── keyToHue(key: string): number
├── applyModeModifiers(hsl: HSL, mode: string): HSL
├── calculateSecondaryStrategy(energy: number): 'analogous' | 'triadic' | 'complementary'
├── generatePalette(dna: MusicalDNA): SelenePalette
├── applySectionVariation(palette: SelenePalette, section: string): SelenePalette
└── Events:
    ├── 'palette-generated': SelenePalette
    ├── 'palette-variation': { section, variation }
    └── 'palette-transition': { from, to, duration }
```

### Integración con MusicalContextEngine

```typescript
// En MusicalContextEngine:
private paletteGenerator: ProceduralPaletteGenerator;

process(audio: AudioFeatures): MusicalContext {
  // ... análisis existente ...
  
  // Generar paleta procedural
  const musicalDNA: MusicalDNA = {
    key: this.harmony.key,
    mode: this.harmony.mode,
    energy: this.calculateEnergy(),
    syncopation: this.rhythm.syncopation,
    mood: this.synthesizeMood(),
    section: this.section.current,
  };
  
  const palette = this.paletteGenerator.generatePalette(musicalDNA);
  
  return {
    ...context,
    palette,  // ← Nueva propiedad
  };
}
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Fase 5 Modificada: Paleta Procedural

- [ ] **5.1** Crear `mapping/ProceduralPaletteGenerator.ts` (~400 líneas)
  - [ ] `KEY_TO_HUE` mapping (12 notas)
  - [ ] `MODE_MODIFIERS` constante
  - [ ] `keyToHue(key)` método
  - [ ] `applyModeModifiers(hsl, mode)` método
  - [ ] `calculateSecondaryStrategy(energy)` método
  - [ ] `generatePalette(dna)` método principal
  - [ ] `applySectionVariation(palette, section)` método

- [ ] **5.2** Crear `mapping/PaletteManager.ts` (~200 líneas)
  - [ ] Control de histéresis anti-flicker
  - [ ] Triggers de regeneración
  - [ ] Cache de paleta actual
  - [ ] Interpolación suave entre paletas

- [ ] **5.3** Tests
  - [ ] Test: C Mayor → Hue ~0-15° (rojo cálido)
  - [ ] Test: A Menor → Hue ~255° (índigo frío)
  - [ ] Test: Alta energía → Colores complementarios
  - [ ] Test: Baja sincopación → Secundario desaturado
  - [ ] Test: Cambio de sección → Variación aplicada
  - [ ] Test: Anti-flicker: no regenera antes de 5s

---

## 🎉 CONCLUSIÓN: SELENE LIBRE

Con este sistema, Selene:

1. **NUNCA** tendrá la misma paleta para dos canciones diferentes
2. **SIEMPRE** respetará el ADN musical de lo que suena
3. **VARIARÁ** dentro de una canción según la sección
4. **IMPACTARÁ** con acentos complementarios en drops
5. **RELAJARÁ** con análogos desaturados en intros

### El Principio Fundamental

> "No le decimos a Selene qué colores usar.  
> Le enseñamos a SENTIR la música y PINTAR lo que siente."

---

## 📚 REFERENCIAS

- **Sinestesia Musical:** Cytowic, R. E. (2002). Synesthesia: A Union of the Senses
- **Teoría del Color:** Itten, Johannes. The Art of Color
- **Círculo de Quintas:** Musicología básica
- **HSL Color Model:** CSS Color Module Level 4

---

*Blueprint creado para Selene Lux - La Reina de las Luces que PINTA música*
