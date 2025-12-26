# 🔷 TECHNO COLOR PIPELINE AUDIT

## WAVE 127 - Auditoría Completa del Flujo de Color para Techno

**Fecha:** 2025  
**Objetivo:** Documentar el pipeline completo desde audio hasta fixtures/UI  
**Contexto:** Esta auditoría mapea cómo fluyen los colores en modo Techno, identificando dónde se generan, modifican y consumen.

---

## ✅ RESOLUCIÓN: OPCIÓN A IMPLEMENTADA

**WAVE 127 centralizó el Techno Prism en SeleneLux.ts (SSOT)**

La discrepancia UI vs Fixtures ha sido **ELIMINADA**. Ahora:

| Componente | Fuente de Datos | Estado |
|------------|-----------------|--------|
| **UI (PalettePreview)** | `selene:truth` → `visualDecision.palette` | ✅ Colores procesados |
| **Fixtures (DMX)** | `state.colors` | ✅ Colores procesados |

Ambos leen del mismo SSOT: `SeleneLux.lastColors`

---

## 📊 RESUMEN EJECUTIVO (POST-WAVE 127)

El flujo de color para Techno ahora tiene **UNA SOLA ETAPA DE PROCESAMIENTO**:

1. **SeleneLux (Generación + Techno Prism)**: El Worker genera colores base, y `updateFromTrinity()` aplica Cold Dictator + Derivación Geométrica + Strobe si el vibe es Techno

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FLUJO UNIFICADO (WAVE 127)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   AUDIO → TRINITY WORKER → SeleneLux.updateFromTrinity()                    │
│                                       ↓                                     │
│                              🔷 TECHNO PRISM (si activeVibe=techno)         │
│                                       ↓                                     │
│                              this.lastColors (SSOT)                         │
│                                       ↓                                     │
│                              getBroadcast()                                 │
│                                       ↓                                     │
│                    ┌──────────────────┴──────────────────┐                  │
│                    ↓                                     ↓                  │
│              UI (Palette)                          DMX (Fixtures)           │
│              MISMOS COLORES                        MISMOS COLORES           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ✅ HALLAZGO POST-WAVE 127

**La UI y los Fixtures ahora muestran LOS MISMOS COLORES**

| Componente | Fuente | Procesamiento |
|------------|--------|---------------|
| **UI (PalettePreview)** | `visualDecision.palette` | Techno Prism en SeleneLux ✅ |
| **Fixtures (DMX)** | `state.colors` | Lee directamente sin override ✅ |

---

## 🏗️ ARQUITECTURA DEL PIPELINE

### NIVEL 1: Tipos de Datos (SeleneProtocol.ts)

```typescript
// El Protocolo Universal define las estructuras de datos
interface SeleneBroadcast {
  sensory: SensoryData;       // Audio crudo: energy, bass, mid, high, fft, beat
  cognitive: CognitiveData;   // Mood, stableEmotion, thermalTemperature, vibe
  musicalDNA: MusicalDNAData; // Key, mode, genre, rhythm, section, prediction
  visualDecision: VisualDecisionData; // ← AQUÍ ESTÁ LA PALETA
  hardwareState: HardwareStateData;
  system: SystemStateData;
}

interface VisualDecisionData {
  palette: {
    primary: UnifiedColor;    // FRONT_PARS (HSL + RGB + HEX)
    secondary: UnifiedColor;  // MOVER L
    accent: UnifiedColor;     // BACK_PARS (strobe detection)
    ambient: UnifiedColor;    // MOVER R
    contrast: UnifiedColor;
    strategy: ColorStrategy;  // 'analogous' | 'triadic' | 'complementary' | etc
    temperature: 'warm' | 'cool' | 'neutral';
    source: 'procedural' | 'memory' | 'fallback';
  };
  // ... intensity, movement, effects
}
```

### NIVEL 2: Generación de Colores (SeleneLux.ts)

**Ubicación:** `src/main/selene-lux-core/SeleneLux.ts`

El Worker (Trinity) genera colores procedurales que se almacenan en `this.lastColors`:

```typescript
// Línea 1538 - Cuando llegan datos del Worker
this.lastColors = {
  primary: { ...palette.primary },     // RGB puro del Worker
  secondary: { ...palette.secondary },
  accent: { ...palette.accent },
  ambient: palette.ambient ? { ...palette.ambient } : { ...palette.secondary },
  intensity: processedIntensity,
  saturation: this.globalSaturation
}
```

**Fuentes de `lastColors`:**

| Contexto | Líneas | Descripción |
|----------|--------|-------------|
| Worker Activo | 1538 | Colores del Trinity Worker (procedural) |
| Flow Mode | 866 | Fallback con presets de Flow |
| Trinity Context | 935 | ColorEngine procedural cuando hay género |
| Brain Output | 661 | Paleta del Brain tras análisis |

### NIVEL 3: Broadcast al Frontend (SeleneLux.getBroadcast())

**Ubicación:** Líneas 1583-2035

```typescript
public getBroadcast(): SeleneBroadcast {
  // ...
  
  // Línea 1907: Visual Decision se construye desde lastColors
  const visualDecision = {
    palette: {
      primary: colors?.primary ? toUnifiedColor(colors.primary) : defaultColor,
      secondary: colors?.secondary ? toUnifiedColor(colors.secondary) : defaultColor,
      accent: colors?.accent ? toUnifiedColor(colors.accent) : defaultColor,
      ambient: colors?.ambient ? toUnifiedColor(colors.ambient) : defaultColor,
      // ...
    },
    // ...
  }
  
  return { sensory, cognitive, musicalDNA, visualDecision, hardwareState, system };
}
```

**Emisión al Frontend:** (main.ts líneas 390-427)

```typescript
// Universal Truth Broadcast @ 30fps
const truth = selene.getBroadcast();
mainWindow.webContents.send('selene:truth', truth);
```

### NIVEL 4: TECHNO PRISM EN SSOT (SeleneLux.ts) ✅ WAVE 127

**Ubicación:** `updateFromTrinity()` líneas 1548-1648  
**✅ La lógica ahora vive en la Fuente Única de Verdad**

```typescript
// El vibe activo determina si aplicamos Techno Prism
const activeVibe = this.lastTrinityData?.activeVibe ?? 'idle'
const isTechnoVibe = activeVibe.toLowerCase().includes('techno')

if (isTechnoVibe) {
  // 1. CAPTURAR LA INTENCIÓN ORIGINAL DEL BRAIN
  const primaryRgb = this.lastColors.primary
  const primaryHsl = rgbToHsl(primaryRgb)
  let baseHue = primaryHsl.h
  
  // 2. 🧊 THE COLD DICTATOR (Filtro Anti-Cálido)
  const normalizedHue = (baseHue + 360) % 360
  const isWarm = (normalizedHue > 330 || normalizedHue < 90)
  if (isWarm) baseHue = (normalizedHue + 180) % 360
  
  // 3. 📐 THE PRISM (Derivación Geométrica)
  const primaryHue = baseHue
  let secondaryHue = (baseHue + 60) % 360   // MOVER L (+60° Análogo)
  let ambientHue = (baseHue + 120) % 360    // MOVER R (+120° Triádico)
  let accentHue = (baseHue + 180) % 360     // BACK PARS (+180° Complementario)
  
  // 4. 🛡️ SANITIZADOR CROMÁTICO
  const sanitize = (h: number) => (h > 30 && h < 100) ? 320 : h
  secondaryHue = sanitize(secondaryHue)
  ambientHue = sanitize(ambientHue)
  accentHue = sanitize(accentHue)
  
  // 5. ⚡ INDUSTRIAL STROBE LOGIC
  const isSnareExplosion = treblePulse > 0.35 || normalizedTreble > 0.7
  
  // 6. 💾 COMMIT AL SSOT
  this.lastColors.primary = hslToRgb(primaryHue, 100, 50)
  this.lastColors.secondary = hslToRgb(secondaryHue, 100, 50)
  this.lastColors.ambient = hslToRgb(ambientHue, 100, 50)
  this.lastColors.accent = isSnareExplosion 
    ? { r: 255, g: 255, b: 255 }
    : hslToRgb(accentHue, 100, 60)
}
```

### NIVEL 5: main.ts (Lectura Ciega del SSOT) ✅ WAVE 127

**Ubicación:** `electron/main.ts` líneas 1050-1070  
**✅ Ya NO calcula colores, solo lee y aplica**

```typescript
// 🏛️ WAVE 127: COLORES DESDE SSOT
// Ya NO calculamos colores aquí. El Techno Prism vive en SeleneLux.ts.
// Solo leemos state.colors y los aplicamos ciegamente a los fixtures.

const color = state.colors?.primary || { r: 0, g: 0, b: 0 };
const secondary = state.colors?.secondary || color;
const ambient = state.colors?.ambient || secondary;
const backParColor = state.colors?.accent || color;
const accent = state.colors?.accent || color;
```

---

## 🎨 ZONAS DE FIXTURE Y SU MAPEO

| Zona | Color Variable | Derivación (Techno) | UI Swatch |
|------|----------------|---------------------|-----------|
| FRONT_PARS | `color` | Base Fría (Cold Dictator) | primary |
| MOVER_L | `secondary` | +60° Análogo (sanitizado) | secondary |
| MOVER_R | `ambient` | +120° Triádico (sanitizado) | ambient |
| BACK_PARS | `backParColor` | +180° Complementario / White Strobe | accent |

---

## 🔍 DIAGRAMA DE FLUJO DETALLADO

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                  AUDIO INPUT                                         │
│                        (Micrófono/Sistema via wasapi)                                │
└────────────────────────────────────────┬─────────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                            TRINITY WORKER (GAMMA)                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│  │ • Key Detection (La, Do, Re, etc.)                                              │ │
│  │ • Mode Detection (major/minor)                                                  │ │
│  │ • Section Tracking (verse/chorus/drop)                                          │ │
│  │ • Mood Arbitration (energetic/dark/playful...)                                  │ │
│  │ • Vibe Context (techno-club, latino, etc.)                                      │ │
│  │                                                                                 │ │
│  │ OUTPUT: trinityData { key, mode, mood, sectionDetail, activeVibe, palette... } │ │
│  └─────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────┬─────────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                               SELENE LUX CORE                                        │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│  │ SeleneLux.onTrinityData(data):                                                  │ │
│  │                                                                                 │ │
│  │   1. Recibe palette del Worker                                                  │ │
│  │   2. Aplica Noise Gate (intensity < 0.15 → 0)                                   │ │
│  │   3. Almacena en this.lastColors {primary, secondary, accent, ambient}          │ │
│  │                                                                                 │ │
│  │ SeleneLux.getBroadcast():                                                       │ │
│  │                                                                                 │ │
│  │   1. Construye SeleneBroadcast                                                  │ │
│  │   2. visualDecision.palette = toUnifiedColor(this.lastColors.*)                 │ │
│  │   3. Retorna el Truth completo                                                  │ │
│  └─────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────┬─────────────────────────────────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    │                                         │
                    ▼                                         ▼
┌───────────────────────────────────────┐   ┌────────────────────────────────────────┐
│          FRONTEND (React)             │   │           DMX RENDER LOOP              │
│  ┌─────────────────────────────────┐  │   │  ┌──────────────────────────────────┐  │
│  │ ipcRenderer.on('selene:truth')  │  │   │  │ for (const fixture of fixtures)  │  │
│  │           ↓                     │  │   │  │           ↓                      │  │
│  │ useTruthPalette() hook          │  │   │  │ if (preset.includes('Techno'))   │  │
│  │           ↓                     │  │   │  │           ↓                      │  │
│  │ PalettePreview.tsx              │  │   │  │   ═══════════════════════════    │  │
│  │                                 │  │   │  │   🔷 TECHNO PRISM OVERRIDE 🔷    │  │
│  │ Muestra: primary, secondary,    │  │   │  │   ═══════════════════════════    │  │
│  │          ambient, accent        │  │   │  │                                  │  │
│  │                                 │  │   │  │   1. Cold Dictator               │  │
│  │ SIN MODIFICACIONES              │  │   │  │   2. sanitizeTechnoColor()       │  │
│  │ (Colores puros del Engine)      │  │   │  │   3. Derivación Geométrica       │  │
│  └─────────────────────────────────┘  │   │  │   4. Strobe Taming               │  │
│                                       │   │  │           ↓                      │  │
│  ⚠️ UI MUESTRA COLORES ORIGINALES    │   │  │   Fixtures reciben colores       │  │
│                                       │   │  │   DIFERENTES a los de la UI      │  │
└───────────────────────────────────────┘   │  └──────────────────────────────────┘  │
                                            │                                        │
                                            │  ⚠️ DMX USA COLORES MODIFICADOS       │
                                            └────────────────────────────────────────┘
```

---

## 📁 ARCHIVOS CLAVE

| Archivo | Ubicación | Responsabilidad |
|---------|-----------|-----------------|
| `SeleneProtocol.ts` | `src/types/` | Definición de tipos (SeleneBroadcast, UnifiedColor, etc.) |
| `SeleneLux.ts` | `src/main/selene-lux-core/` | Orquestador principal, genera `lastColors` y `getBroadcast()` |
| `main.ts` | `electron/` | Render loop DMX, Techno Prism Override |
| `PalettePreview.tsx` | `src/renderer/components/` | UI que muestra la paleta (sin override) |
| `useTruthPalette.ts` | `src/renderer/hooks/` | Hook que consume `selene:truth` |

---

## 🔧 WAVE 125.1 - TECHNO PRISM DETALLADO

### Cold Dictator (Líneas 1079-1086)

```
Entrada: baseHue (del primaryColor del Engine)

Si hue está en zona CÁLIDA (330° < hue < 90°):
  → Invertir +180° hacia espectro FRÍO

Ejemplo:
  Rojo (0°) → Cyan (180°)
  Amarillo (60°) → Azul (240°)
  Naranja (30°) → Teal (210°)
```

### Sanitize Helper (Líneas 1088-1094)

```
Entrada: hue derivado

Si hue cae en zona PROHIBIDA (30° - 100°):
  → Forzar a Magenta Neón (320°)

Esto elimina:
  • Naranja sucio
  • Amarillo pollo
  • Verde pantano
```

### Derivación Geométrica (Líneas 1096-1108)

```
Base Fría (FRONT_PARS):     hue = baseHue (ya enfriado)
Análogo (MOVER L):          hue = (baseHue + 60°) % 360 → sanitizado
Triádico (MOVER R):         hue = (baseHue + 120°) % 360 → sanitizado
Complementario (BACK_PARS): hue = (baseHue + 180°) % 360

Saturación: 100% (Neón máximo)
Luminosidad: 50% (Colores puros)
```

### Strobe Taming - WAVE 124 (Líneas 1115-1122)

```
Trigger: treblePulse > 0.6 (detección de snare/clap)

Si treblePulse > 0.6:
  → BACK_PARS = Blanco puro (255, 255, 255)
Else:
  → BACK_PARS = Color Complementario
```

---

## ⚠️ DISCREPANCIA UI vs FIXTURES

### El Problema

La **UI** muestra los colores que genera el **Engine** (SeleneLux).  
Los **Fixtures** reciben los colores **modificados** por el **Techno Prism**.

### Ejemplo Práctico

```
Engine genera: Key = La menor
  → primaryColor = Magenta (320°, 80%, 50%)

UI muestra:
  primary: Magenta 320°
  secondary: (lo que venga del Engine)
  ambient: (lo que venga del Engine)
  accent: (lo que venga del Engine)

Techno Prism procesa:
  baseHue = 320° (no es cálido, OK)
  FRONT_PARS: Magenta 320°
  MOVER L: (320 + 60) = 380 → 20° → SANITIZADO → 320° Magenta
  MOVER R: (320 + 120) = 440 → 80° → SANITIZADO → 320° Magenta
  BACK_PARS: (320 + 180) = 500 → 140° → Cyan/Verde 140°
```

---

## 📋 VERIFICACIÓN DE FLUJO

### Para verificar que la UI refleja la realidad:

1. **Logs en main.ts** (habilitar debug WAVE125.1):
   ```
   console.log(`[WAVE125.1] 🔷 COLD PRISM | Base:${baseHue}° | Secondary:${secondaryHue}° | Ambient:${ambientHue}° | Accent:${accentHue}°`);
   ```

2. **Logs en SeleneLux** (habilitar debug):
   ```
   console.log(`[SeleneLux] lastColors: ${JSON.stringify(this.lastColors)}`);
   ```

3. **Comparar**:
   - `this.lastColors.primary` (lo que ve la UI)
   - `color` en main.ts (lo que ve el fixture)

---

## 🎯 CONCLUSIONES (POST-WAVE 127)

1. **El Engine (SeleneLux) genera colores basados en Key musical** - CORRECTO
2. **SeleneLux aplica Techno Prism si el vibe es Techno** - ✅ NUEVO
3. **La UI lee colores ya procesados** - ✅ SINCRONIZADA
4. **Los fixtures leen colores ya procesados** - ✅ SINCRONIZADOS
5. **UI = Fixtures** - ✅ DISCREPANCIA ELIMINADA

### Cambios WAVE 127

| Antes (WAVE 125.1) | Después (WAVE 127) |
|--------------------|---------------------|
| Techno Prism en `main.ts` (override) | Techno Prism en `SeleneLux.ts` (SSOT) |
| UI mostraba colores base | UI muestra colores procesados |
| Fixtures mostraban colores modificados | Fixtures muestran colores procesados |
| Discrepancia UI vs Fixtures | Paridad total |

---

## 📝 NOTAS ADICIONALES

- **WAVE 123.2**: Estableció la derivación geométrica desde Primary (SSOT)
- **WAVE 124**: Cambió strobe de bass > 0.85 a treblePulse > 0.6 (snare detection)
- **WAVE 125.1**: Añadió Cold Dictator y sanitizeTechnoColor() para spectrum frío
- **WAVE 126**: Reescribió PalettePreview.tsx para consumir truth directamente
- **WAVE 127**: ✅ Centralizó Techno Prism en SeleneLux.ts (Opción A del audit)

---

*Documento generado como parte de WAVE 127 - Pipeline Audit*
*Actualizado tras implementación de Opción A (SSOT Unification)*
