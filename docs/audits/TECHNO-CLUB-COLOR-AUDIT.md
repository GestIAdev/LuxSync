# 🎨 AUDITORÍA COMPLETA: TECHNO-CLUB COLOR & MÉTRICAS
## Sistema de Generación de Color y Análisis de Métricas Activas

**Fecha**: 2025-12-26  
**Preset Auditado**: `techno-club` (Default)  
**Objetivo**: Lavado de cara - Evaluar pipeline de color, métricas y asignación por fixture  

---

## 📊 PARTE 1: CONFIGURACIÓN DEL PRESET

### Parámetros Techno-Club (Líneas 493-505)

```typescript
'techno-club': {
  name: 'Techno/Default',
  parGate: 0.05,           // ✅ Sensibilidad máxima (WAVE 113)
  parGain: 6.0,            // ✅ Golpe visual fuerte
  parMax: 0.78,            // ✅ Techo 78% (WAVE 114: Headroom para Snare)
  backParGate: 0.12,       // ✅ Más reactivo para hi-hats
  backParGain: 5.0,        // ✅ Hi-hats potentes
  backParMax: 1.0,         // ✅ Snare tiene permiso para cegar
  moverFloor: 0.0,         // ✅ Sin suelo (oscuridad total en drops)
  melodyThreshold: 0.30,   // ✅ WAVE 120: Subido de 0.25 (sin masking)
  decaySpeed: 2,           // ✅ Rápido (Cuchillo)
  hardClipThreshold: 0.15, // ✅ WAVE 118: Zero Tolerance (elimina 12% fantasma)
}
```

### Estado Actual
- ✅ **Optimizado**: WAVE 113-121 aplicadas
- ✅ **Headroom**: parMax=0.78 para dejar espacio al Snare
- ✅ **Oscuridad total**: moverFloor=0.0 en drops
- ✅ **Clipper activo**: 0.15 threshold (elimina basura)

---

## 🎨 PARTE 2: PIPELINE DE COLOR

### 2.1 Colores Base (Origen: state.colors)

Los colores vienen del **estado de la UI** (`state.colors`), NO se generan en el backend:

```typescript
const color = state.colors?.primary || { r: 0, g: 0, b: 0 }
const secondary = state.colors?.secondary || { r: 0, g: 0, b: 0 }
const accent = state.colors?.accent || color
const ambient = state.colors?.ambient || secondary
```

| Canal | Origen | Fallback | Uso Principal |
|-------|--------|----------|---------------|
| `primary` | UI | Negro | FRONT_PARS |
| `secondary` | UI | Negro | MOVING_LEFT |
| `accent` | UI | primary | STROBES |
| `ambient` | UI | secondary | MOVING_RIGHT |

**⚠️ PROBLEMA IDENTIFICADO**: Si la UI no envía colores, todo es **negro por defecto**.

---

### 2.2 Transformación de Color: BackPar Analogous Twist (WAVE 86)

Para evitar monotonía visual, los **BACK_PARS** usan una variante del `primary`:

```typescript
// Convertir primary (RGB) a HSL
const primaryHsl = rgbToHsl(color.r, color.g, color.b);

// Rotar +25° en el círculo cromático
const backParHsl = { 
  h: (primaryHsl.h + 25) % 360,  // Rojo→Naranja, Naranja→Amarillo
  s: primaryHsl.s, 
  l: Math.max(primaryHsl.l, 40)  // Boost si muy oscuro
};

// Convertir de vuelta a RGB
const backParColor = hslToRgb(backParHsl.h, backParHsl.s, backParHsl.l);
```

**Ejemplos de Transformación**:
| Primary (Hue) | BackPar (Hue) | Efecto Visual |
|---------------|---------------|---------------|
| Rojo (0°) | Naranja (25°) | Calidez progresiva |
| Naranja (30°) | Amarillo (55°) | Brillo creciente |
| Verde (120°) | Verde-Amarillo (145°) | Transición suave |
| Azul (240°) | Azul-Violeta (265°) | Profundidad |

---

## 🎯 PARTE 3: ASIGNACIÓN COLOR POR FIXTURE

### Mapa de Zonas y Colores (Techno-Club)

| Fixture | Color Asignado | Origen | Línea Código | Transformación |
|---------|----------------|--------|--------------|----------------|
| **FRONT_PARS** | `primary` | UI directo | 1167 | Ninguna (color puro) |
| **BACK_PARS** | `backParColor` | primary +25° hue | 1225 | WAVE 86 (Analogous Twist) |
| **MOVING_LEFT** | `secondary` | UI directo | 1278 | Ninguna |
| **MOVING_RIGHT** | `ambient` | UI fallback→secondary | 1327 | Ninguna |
| **STROBES** | `accent` | UI fallback→primary | 1334 | Ninguna |

### Diagrama de Flujo de Color

```
UI (state.colors)
    │
    ├─ primary ──────────┬──▶ FRONT_PARS (directo)
    │                    │
    │                    └──▶ BACK_PARS (primary + 25° hue)
    │
    ├─ secondary ────────┬──▶ MOVING_LEFT (directo)
    │                    │
    │                    └──▶ ambient (fallback) ──▶ MOVING_RIGHT
    │
    └─ accent ───────────────▶ STROBES (fallback a primary)
```

---

## 📈 PARTE 4: MÉTRICAS DE AUDIO ACTIVAS

### 4.1 Métricas RAW (Desde audioInput)

| Métrica | Rango | Usado En | Estado | Descripción |
|---------|-------|----------|--------|-------------|
| `rawBass` | 0.0-1.0 | ✅ FRONT_PARS, Movers | **ACTIVO** | Energía 20-250Hz (Kick/Bajo) |
| `rawMid` | 0.0-1.0 | ✅ Movers | **ACTIVO** | Energía 250-2kHz (Vocales/Melodía) |
| `rawTreble` | 0.0-1.0 | ✅ BACK_PARS, Movers | **ACTIVO** | Energía 2k-20kHz (Hi-hats/Platillos) |
| `energy` | 0.0-1.0 | ⚠️ Fallback zones | **PASIVO** | Suma total (legacy) |
| `onBeat` | boolean | ⚠️ STROBES | **PASIVO** | Detección de beat (legacy) |

**Métricas RAW eliminadas en WAVE 113+**: `bass`, `mid`, `treble` fueron reemplazadas por procesamiento manual con `bassPulse` y `treblePulse`.

---

### 4.2 Métricas PROCESADAS (Derivadas)

| Métrica | Fórmula | Usado En | Estado |
|---------|---------|----------|--------|
| `avgNormEnergy` | Worker AGC (~3s rolling avg) | ✅ bassFloor, melodyFloor | **ACTIVO** |
| `bassPulse` | `rawBass - (bassFloor * 0.60)` | ✅ FRONT_PARS | **ACTIVO** |
| `treblePulse` | `rawTreble - 0.10` | ✅ BACK_PARS, Kick Guard | **ACTIVO** |
| `melodySignal` | `max(normMid, normTreble)` | ✅ Movers | **ACTIVO** |
| `melodySum` | `rawMid + rawTreble` | ✅ Context Mode | **ACTIVO** |
| `totalEnergy` | `rawBass + rawMid + rawTreble` | ✅ Silence detection | **ACTIVO** |
| `isAGCTrap` | `rawBass < 0.15 && rawMid < 0.15` | ✅ WAVE 119 (Vanta Black) | **ACTIVO** |

---

### 4.3 Métricas INACTIVAS (No Usadas en Techno-Club)

| Métrica | Última Referencia | Razón de Desactivación |
|---------|-------------------|------------------------|
| `isMelodyDominant` | WAVE 103 (fallback) | Reemplazado por `melodySignal > threshold` |
| `normalizedBass` | Legacy | Reemplazado por `bassPulse` |
| `normalizedMid` | Legacy | Reemplazado por `melodySignal` |
| `normalizedTreble` | Legacy | Reemplazado por `treblePulse` |

---

## 🔧 PARTE 5: LÓGICA DE INTENSIDAD POR FIXTURE

### FRONT_PARS (Líneas 1094-1170)

**Métrica Principal**: `bassPulse`

```typescript
let targetIntensity = 0;

// WAVE 117: KICK GUARD - Sidechain Visual
let isolationFactor = 1.0;
if (treblePulse > 0.2) {
  isolationFactor = 0.4; // Snare fuerte → Reducir bass 60%
} else if (treblePulse > 0.1) {
  isolationFactor = 0.7; // Snare suave → Reducir bass 30%
}

// Aplicar gate y gain
if (bassPulse * isolationFactor > preset.parGate) {
  targetIntensity = bassPulse * isolationFactor * preset.parGain;
}

// Clipper + Hard Floor
targetIntensity = applySoftKneeClipper(targetIntensity);
if (targetIntensity < 0.20) targetIntensity = 0; // WAVE 119: Hard Floor
targetIntensity = Math.min(targetIntensity, preset.parMax); // Ceiling 78%
```

**Color**: `primary` (directo de UI)

---

### BACK_PARS (Líneas 1170-1230)

**Métrica Principal**: `treblePulse`

```typescript
let targetIntensity = 0;

// Aplicar gate y gain
if (treblePulse > preset.backParGate) {
  targetIntensity = treblePulse * preset.backParGain;
}

// Clipper + Hard Floor
targetIntensity = applySoftKneeClipper(targetIntensity);
if (targetIntensity < 0.20) targetIntensity = 0; // WAVE 119: Hard Floor
targetIntensity = Math.min(targetIntensity, preset.backParMax); // Ceiling 100%
```

**Color**: `backParColor` (primary + 25° hue twist)

---

### MOVING_LEFT & MOVING_RIGHT (Líneas 1233-1330)

**Métrica Principal**: `melodySignal` (desde `calculateMoverTarget()`)

**Lógica Unificada** (WAVE 120.2):

```typescript
// 1. Detectar género denso (Techno/Latino/Pop)
const isHighDensity = preset.name.includes('Techno');

// 2. Masking (Solo Dubstep/Chill)
let bassMasking = isHighDensity ? 0 : Math.min(0.2, rawBass * 0.25);

// 3. Señal melódica
const melodySignal = Math.max(rawMid, rawTreble * 0.8);

// 4. Umbrales dinámicos
const ON_THRESHOLD = preset.melodyThreshold + bassMasking + 0.10; // ~0.40
const OFF_THRESHOLD = preset.melodyThreshold + bassMasking - 0.05; // ~0.25

// 5. Histéresis ON/OFF
if (!moverState && melodySignal > ON_THRESHOLD) {
  moverState = true;
  target = (melodySignal - effectiveThreshold) / (1 - effectiveThreshold);
} else if (moverState && melodySignal > OFF_THRESHOLD) {
  target = (melodySignal - effectiveThreshold) / (1 - effectiveThreshold);
} else {
  moverState = false;
  target = 0;
}

// 6. WAVE 121: Solidity Enhancement
if (target >= 0.20) {
  target = target * 1.15;        // Confidence Boost +15%
  target = Math.max(0.35, target); // Solid Floor 35%
}
```

**Colores**:
- MOVING_LEFT: `secondary`
- MOVING_RIGHT: `ambient` (fallback a `secondary`)

---

## 🚨 PARTE 6: PROBLEMAS IDENTIFICADOS

### 6.1 Color Pipeline

| Problema | Severidad | Impacto | Solución Sugerida |
|----------|-----------|---------|-------------------|
| **Fallback a Negro** | 🔴 CRÍTICO | Si UI falla, todo es negro | Hardcodear colores default por preset |
| **Ambient = Secondary** | 🟡 MENOR | MOVING_RIGHT no tiene color único | Generar ambient como `secondary + 60° hue` |
| **No hay paleta Techno** | 🟠 MEDIO | Cada usuario elige colores random | Crear paleta Techno (Cian/Magenta/Amarillo industrial) |

---

### 6.2 Métricas Sin Usar

| Métrica | Estado | Recomendación |
|---------|--------|---------------|
| `audioInput.energy` | ❌ Solo en fallback | Eliminar del tipo AudioData |
| `audioInput.onBeat` | ❌ Solo en STROBES | Reemplazar con `treblePulse > 0.3` |
| `isMelodyDominant` | ❌ Legacy | Eliminar variable global |

---

### 6.3 BackPar Analogous Twist

| Aspecto | Valor Actual | Problema | Sugerencia |
|---------|--------------|----------|------------|
| **Hue Shift** | +25° | Funciona bien | ✅ Mantener |
| **Lightness Boost** | `max(l, 40)` | Puede sobreexponer | Bajar a `max(l, 35)` |
| **Saturation** | Sin cambio | BackPars muy saturados en rojo | Reducir a `s * 0.85` |

---

## 🎨 PARTE 7: RECOMENDACIONES PARA "LAVADO DE CARA"

### 7.1 Paleta de Color Techno por Defecto

Crear colores hardcodeados para cuando UI no responde:

```typescript
const TECHNO_PALETTE = {
  primary: { r: 0, g: 255, b: 255 },    // Cian industrial
  secondary: { r: 255, g: 0, b: 128 },  // Magenta neón
  accent: { r: 255, g: 255, b: 0 },     // Amarillo eléctrico
  ambient: { r: 128, g: 0, b: 255 }     // Violeta profundo
};

const color = state.colors?.primary || TECHNO_PALETTE.primary;
```

---

### 7.2 Ambient Unique Color

Generar `ambient` como complementario de `secondary`:

```typescript
// Crear ambient: Secondary + 60° twist (Complementario aproximado)
const secondaryHsl = rgbToHsl(secondary.r, secondary.g, secondary.b);
const ambientHsl = { 
  h: (secondaryHsl.h + 60) % 360,  // Magenta→Violeta
  s: secondaryHsl.s * 0.9,         // 10% menos saturación
  l: secondaryHsl.l 
};
const ambient = hslToRgb(ambientHsl.h, ambientHsl.s, ambientHsl.l);
```

---

### 7.3 BackPar Analogous Refinement

Ajustar saturación para evitar oversaturation:

```typescript
const backParHsl = { 
  h: (primaryHsl.h + 25) % 360, 
  s: primaryHsl.s * 0.85,  // 🆕 Reducir saturación 15%
  l: Math.max(primaryHsl.l, 35)  // 🆕 Bajar lightness floor
};
```

---

### 7.4 Eliminar Métricas Legacy

Limpiar código removiendo variables no usadas:

```diff
- const isMelodyDominant = melodySignal > (bassFloor * 1.5);
- const normalizedBass = audioInput.bass / (bassFloor || 0.5);
```

---

## 📋 PARTE 8: RESUMEN EJECUTIVO

### Estado Actual del Sistema

| Aspecto | Estado | Calificación |
|---------|--------|--------------|
| **Preset Techno-Club** | ✅ Optimizado (WAVE 113-121) | 🟢 9/10 |
| **Pipeline de Color** | ⚠️ Depende 100% de UI | 🟡 6/10 |
| **Métricas Activas** | ✅ Bien implementadas | 🟢 8/10 |
| **Asignación Fixtures** | ✅ Clara y funcional | 🟢 9/10 |
| **Código Legacy** | ⚠️ Hay variables muertas | 🟡 7/10 |

### Prioridades de Mejora

1. 🔴 **CRÍTICO**: Agregar paleta Techno por defecto (evitar negro total)
2. 🟠 **ALTO**: Generar `ambient` único (no duplicar `secondary`)
3. 🟡 **MEDIO**: Refinar BackPar saturation (evitar oversaturation)
4. 🟢 **BAJO**: Limpiar métricas legacy (code hygiene)

---

## 🎯 PRÓXIMOS PASOS

1. **Crear TECHNO_PALETTE** hardcodeada en línea ~1009
2. **Generar ambient dinámicamente** (secondary + 60° hue)
3. **Ajustar backParHsl.s** a `* 0.85`
4. **Eliminar variables** `isMelodyDominant`, `normalizedBass`
5. **Testear** con UI desconectada (verificar fallback)

---

*Auditoría generada por PunkOpus - 2025-12-26*
*Documento vivo - Actualizar después de implementar cambios*
