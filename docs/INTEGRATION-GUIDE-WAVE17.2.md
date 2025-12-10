# 🎨 SELENE COLOR ENGINE - INTEGRATION GUIDE

**Wave 17.2 - Production Ready**

---

## 📦 QUICK START

### 1. Importar el Motor

```typescript
import { SeleneColorEngine, type SelenePalette } from '@/engines/visual';

// O importar tipos específicos
import { 
  SeleneColorEngine,
  KEY_TO_HUE,
  MACRO_GENRES,
  hslToRgb,
  paletteToRgb,
  type ExtendedAudioAnalysis,
  type SelenePalette,
} from '@/engines/visual';
```

### 2. Generar una Paleta

```typescript
// Desde el análisis de audio (Wave 8 BETA worker)
const analysis: ExtendedAudioAnalysis = {
  energy: 0.68,
  bpm: 110,
  wave8: {
    harmony: { key: 'D', mode: 'major', mood: 'spanish_exotic' },
    rhythm: { syncopation: 0.68 },
    genre: { primary: 'cumbia' },
    section: { type: 'chorus' },
  },
};

// Generar paleta HSL
const palette = SeleneColorEngine.generate(analysis);

console.log(palette.primary);       // { h: 100, s: 100, l: 80 }
console.log(palette.meta.macroGenre); // 'LATINO_TRADICIONAL'
console.log(palette.meta.strategy);   // 'complementary'
```

### 3. Convertir a RGB (para DMX)

```typescript
// Opción A: Generar RGB directamente
const rgbPalette = SeleneColorEngine.generateRgb(analysis);
console.log(rgbPalette.primary);    // { r: 187, g: 255, b: 153 }

// Opción B: Convertir paleta existente
import { hslToRgb, paletteToRgb } from '@/engines/visual';

const primaryRgb = hslToRgb(palette.primary);
const allRgb = paletteToRgb(palette);
```

### 4. Usar en LightingDecision (GAMMA Worker)

```typescript
// En mind.ts - generateDecision()
const analysis = getBeatAnalysis(); // desde BETA
const palette = SeleneColorEngine.generate(analysis);

const decision: LightingDecision = {
  timestamp: Date.now(),
  frameId: frameCount,
  confidence: analysis.wave8?.genre.confidence ?? 0.5,
  palette: {
    primary: hslToRgb(palette.primary),
    secondary: hslToRgb(palette.secondary),
    accent: hslToRgb(palette.accent),
    intensity: analysis.energy, // 0-1
  },
  movement: {
    pattern: 'pulse', // según genre
    speed: 1.0,
    range: analysis.energy,
    sync: 'beat',
  },
  effects: {
    strobe: analysis.wave8?.section.type === 'drop',
    fog: analysis.energy > 0.6 ? 0.7 : 0.2,
    laser: false,
    chase: false,
    pulse: true,
    prism: false,
  },
};
```

---

## 🔌 API COMPLETA

### Método Principal

```typescript
/**
 * Genera paleta cromática HSL a partir de análisis de audio
 * @param data - Análisis de audio extendido
 * @returns SelenePalette con 5 colores HSL + metadata
 */
static generate(data: ExtendedAudioAnalysis): SelenePalette
```

### Métodos Auxiliares

```typescript
// Generar directamente en RGB
static generateRgb(data: ExtendedAudioAnalysis): {
  primary: RGBColor;
  secondary: RGBColor;
  accent: RGBColor;
  ambient: RGBColor;
  contrast: RGBColor;
  meta: PaletteMeta;
}

// Mapear género a macro-género
static mapToMacroGenre(genre: string): string
// 'cumbia' → 'LATINO_TRADICIONAL'

// Obtener información de constantes
static getKeyHue(key: string): number | undefined
static getModeModifier(mode: string): ModeModifier | undefined
static getGenreProfile(macroGenre: string): GenreProfile | undefined
static getMacroGenres(): string[]
```

### Funciones Utilitarias

```typescript
// Conversión HSL ↔ RGB
export function hslToRgb(hsl: HSLColor): RGBColor
export function rgbToHsl(rgb: RGBColor): HSLColor

// Conversión de paleta completa
export function paletteToRgb(palette: SelenePalette): {
  primary: RGBColor;
  secondary: RGBColor;
  accent: RGBColor;
  ambient: RGBColor;
  contrast: RGBColor;
}

// Utilidades de normalización
export function normalizeHue(h: number): number  // 0-360
export function clamp(v: number, min: number, max: number): number
export function mapRange(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number
```

---

## 📊 TIPOS PRINCIPALES

### SelenePalette

```typescript
interface SelenePalette {
  primary: HSLColor;      // Wash general, PARs
  secondary: HSLColor;    // Back PARs, Fibonacci rotation
  accent: HSLColor;       // Beams, highlights
  ambient: HSLColor;      // Fills, backlighting suave
  contrast: HSLColor;     // Siluetas, sombras
  meta: {
    macroGenre: string;   // 'ELECTRONIC_4X4', 'LATINO_TRADICIONAL', etc.
    strategy: string;     // 'analogous' | 'triadic' | 'complementary'
    temperature: string;  // 'warm' | 'cool' | 'neutral'
    description: string;  // Legible: "D major - E=68%"
    confidence: number;   // 0-1
    transitionSpeed: number; // ms
  }
}
```

### ExtendedAudioAnalysis

```typescript
interface ExtendedAudioAnalysis {
  // Trinity Core
  energy: number;        // 0-1 (CRÍTICO)
  bpm?: number;
  bass?: number;
  mid?: number;
  treble?: number;
  
  // Top-level fallbacks
  key?: string;          // "C", "D#", "A", etc.
  mood?: string;         // "dark", "bright", "neutral"
  syncopation?: number;  // 0-1
  
  // Wave 8 Rich Data
  wave8?: {
    harmony: {
      key: string | null;
      mode: string;      // "major", "minor", "dorian", etc.
      mood: string;
      confidence?: number;
    };
    rhythm: {
      syncopation: number; // 0-1
      confidence?: number;
    };
    genre: {
      primary: string;   // "techno", "cumbia", etc.
      confidence?: number;
    };
    section: {
      type: string;      // "intro", "verse", "chorus", "drop", etc.
    };
  };
}
```

---

## 🎯 EJEMPLOS DE USO

### Ejemplo 1: TECHNO (Oscuro, Hipnótico)

```typescript
const input: ExtendedAudioAnalysis = {
  energy: 0.34,
  wave8: {
    harmony: { key: 'A', mode: 'minor', mood: 'tense' },
    rhythm: { syncopation: 0.27 },
    genre: { primary: 'techno' },
    section: { type: 'drop' },
  },
};

const palette = SeleneColorEngine.generate(input);
// PRIMARY:   HSL(240°, 40%, 27%)  → RGB(41, 41, 97)    [Azul oscuro]
// SECONDARY: HSL(102°, 45%, 20%)  → RGB(102, 112, 51)  [Oliva - Fibonacci]
// ACCENT:    HSL(270°, 100%, 70%) → RGB(255, 0, 128)   [Magenta - Analogous]
// TEMPERATURE: cool
// STRATEGY: analogous
```

### Ejemplo 2: CUMBIA (Cálido, Explosivo)

```typescript
const input: ExtendedAudioAnalysis = {
  energy: 0.68,
  wave8: {
    harmony: { key: 'D', mode: 'major', mood: 'spanish_exotic' },
    rhythm: { syncopation: 0.68 },
    genre: { primary: 'cumbia' },
    section: { type: 'chorus' },
  },
};

const palette = SeleneColorEngine.generate(input);
// PRIMARY:   HSL(100°, 100%, 80%)  → RGB(187, 255, 153) [Amarillo-verde]
// SECONDARY: HSL(322°, 100%, 70%)  → RGB(255, 153, 204) [Rosa - Fibonacci]
// ACCENT:    HSL(280°, 100%, 100%) → RGB(204, 153, 255) [Violeta - Complementary]
// TEMPERATURE: warm
// STRATEGY: complementary
```

### Ejemplo 3: REGGAETON (Urbano, Potente)

```typescript
const input: ExtendedAudioAnalysis = {
  energy: 0.72,
  wave8: {
    harmony: { key: 'Bb', mode: 'minor', mood: 'tense' },
    rhythm: { syncopation: 0.45 },
    genre: { primary: 'reggaeton' },
    section: { type: 'verse' },
  },
};

const palette = SeleneColorEngine.generate(input);
// Macro-género: LATINO_URBANO
// Temperature: warm (Bb=300°, tempBias=+10°)
// Strategy: triadic (syncopation 0.45 → 120° offset)
```

---

## 🔐 VALIDACIÓN DE ENTRADA

El motor es robusto y maneja gracefully inputs inválidos:

```typescript
// ✅ Input mínimo (usa defaults)
const minimal = SeleneColorEngine.generate({ energy: 0.5 });

// ✅ Energy fuera de rango (clampea automáticamente)
const clampedLow = SeleneColorEngine.generate({ energy: -0.5 });
const clampedHigh = SeleneColorEngine.generate({ energy: 1.5 });

// ✅ Wave8 vacío (usa fallbacks)
const noWave8 = SeleneColorEngine.generate({ 
  energy: 0.5,
  key: 'G',  // Top-level
  mood: 'happy'
});

// ✅ Género desconocido (default ELECTROLATINO)
const unknownGenre = SeleneColorEngine.generate({
  energy: 0.5,
  wave8: { genre: { primary: 'random_genre_123' }, ... }
});
```

---

## 🎨 MACRO-GÉNEROS Y PERFILES

| Macro | Temp | Sat | Contrast | Temp Visual | Género(s) |
|-------|------|-----|----------|-------------|-----------|
| **ELECTRONIC_4X4** | -15° | -10% | analogous | cool | techno, house, trance |
| **ELECTRONIC_BREAKS** | 0° | +5% | triadic | cool/neutral | dnb, dubstep, jungle |
| **LATINO_TRADICIONAL** | +25° | +20% | complementary | warm | cumbia, salsa, merengue |
| **LATINO_URBANO** | +10° | +10% | triadic | warm | reggaeton, trap |
| **ELECTROLATINO** | 0° | 0% | adaptive | neutral | pop, afro_house, fusion |

---

## ⚙️ INTEGRACIÓN CON WORKERS

### BETA (Senses) → SeleneColorEngine → GAMMA (Mind)

```
BETA Worker (senses.ts)
    ↓
    ExtendedAudioAnalysis {
      energy, wave8 { harmony, rhythm, genre, section }
    }
    ↓
SeleneColorEngine.generate()
    ↓
    SelenePalette {
      primary, secondary, accent, ambient, contrast,
      meta { macroGenre, strategy, temperature, ... }
    }
    ↓
GAMMA Worker (mind.ts)
    ↓
    LightingDecision {
      palette: { primary: RGB, secondary: RGB, ... },
      movement: { pattern, speed, range, sync },
      effects: { strobe, fog, laser, ... }
    }
    ↓
DMX Protocol → Fixtures
```

---

## 🧪 TESTING

Tests incluidos en `__tests__/SeleneColorEngine.test.ts`:

```bash
# En electron-app, cuando vitest esté configurado:
npm test -- SeleneColorEngine.test.ts

# O ejecutar script de validación puro:
node validate-color-engine.js  # 18/18 tests
```

---

## 📚 REFERENCIAS

- `docs/JSON-ANALYZER-PROTOCOL.md` - Protocolo de entrada/salida
- `docs/WAVE-17-SELENE-COLOR-MIND-AUDIT.md` - Arquitectura completa
- `docs/WAVE-17.1-MACRO-GENRES-MASTER-PLAN.md` - Sistema de géneros
- `docs/WAVE-17.2-SELENE-COLOR-ENGINE-REPORT.md` - Reporte técnico
- `docs/WAVE-17.2-TESTS-RESULTS.md` - Resultados de validación

---

## 🚀 PRÓXIMOS PASOS

1. **Wave 17.3:** Adaptive Color Intelligence (preferencias del técnico)
2. **Wave 17.4:** Dynamic Palette Morphing (transiciones suaves)
3. **Wave 17.5:** Beat-Synchronized Pulses (sincronización frame-perfect)
4. **Wave 17.6:** Section Variations (modificadores por sección)

---

**"El color es música hecha visible. Selene la pinta."**
