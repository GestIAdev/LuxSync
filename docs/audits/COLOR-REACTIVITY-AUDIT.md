# 🩻 COLOR-REACTIVITY-AUDIT.md
## WAVE 138: THE GREAT COLOR AUTOPSY

**Fecha:** 26 de Diciembre de 2025  
**Estado:** AUDITORÍA BRUTAL Y HONESTA  
**Objetivo:** Mapear la realidad del código para una refactorización total.

---

## ⚰️ RESUMEN EJECUTIVO (TL;DR)

**Selene está siendo lobotomizada.**

Tenemos un motor procedural sofisticado (`SeleneColorEngine`) con:
- Círculo de Quintas → Círculo Cromático
- Rotación Fibonacci (φ × 360° ≈ 222.5°)
- Modificadores de Modo Musical (Mayor/Menor/Dórico...)
- Estrategias de Armonía (Analogous/Triadic/Complementary)

**Y lo estamos sobrescribiendo con hardcode directo en 2 bloques gigantes** que ignoran completamente su output.

---

## 🗺️ PARTE I: EL MAPA DEL CRIMEN

### 1.1 Bloques de Bypass Identificados en `SeleneLux.ts`

| Línea | Nombre | Tamaño | ¿Bypassa ColorEngine? |
|-------|--------|--------|----------------------|
| 1598-1742 | **TECHNO PRISM** (WAVE 127-133) | ~145 líneas | ✅ SÍ - TOTAL |
| 1759-1876 | **ROCK STAGE** (WAVE 135-137) | ~117 líneas | ✅ SÍ - TOTAL |

### 1.2 Anatomía del Bypass (TECHNO PRISM)

```typescript
// Línea ~1598
const isTechnoVibe = activeVibe.toLowerCase().includes('techno')

if (isTechnoVibe) {
  // 1. Captura RGB de lastColors (generado por ColorEngine)
  const primaryRgb = this.lastColors.primary
  const primaryHsl = rgbToHsl(primaryRgb)
  let baseHue = primaryHsl.h
  
  // 2. HARDCODE: Filtro "Cold Dictator" (mata cálidos)
  if (isWarm) baseHue = (normalizedHue + 180) % 360  // ❌ Decisión arbitraria
  
  // 3. HARDCODE: Derivación geométrica manual
  const secondaryHue = (baseHue + 60) % 360   // ❌ Número mágico
  const ambientHue = (baseHue + 120) % 360    // ❌ Número mágico
  const accentHue = (baseHue + 180) % 360     // ❌ Número mágico
  
  // 4. HARDCODE: Sanitizador cromático
  const sanitize = (h) => (h > 30 && h < 75) ? 320 : h  // ❌ Números mágicos
  
  // 5. HARDCODE: Strobe logic con umbrales manuales
  const TRIGGER_THRESHOLD = 0.25  // ❌ Número mágico
  const DYNAMIC_FLOOR_FACTOR = 0.6  // ❌ Número mágico
  
  // 6. ⚠️ SOBRESCRITURA DIRECTA (Bypass completo)
  this.lastColors.primary = hslToRgb(primaryHue, 100, 50)
  this.lastColors.secondary = hslToRgb(secondaryHue, 100, 50)
  // ...
}
```

### 1.3 Anatomía del Bypass (ROCK STAGE)

```typescript
// Línea ~1759
const isPopRockVibe = activeVibe.toLowerCase().includes('pop') || 
                      activeVibe.toLowerCase().includes('rock')

if (isPopRockVibe && !isTechnoVibe) {
  // 1. HARDCODE: Filtro "Stage Lighting" 
  if (normalizedHue > 80 && normalizedHue < 160) baseHue = 0  // ❌ Verde→Rojo
  if (normalizedHue > 260 && normalizedHue < 300) baseHue = 40  // ❌ Morado→Ámbar
  
  // 2. HARDCODE: Paleta Stadium Contrast
  const secondaryHue = (baseHue + 180) % 360  // ❌ Número mágico
  const ambientHue = (baseHue + 120) % 360    // ❌ Número mágico
  
  // 3. HARDCODE: Umbrales de detección
  const SNARE_THRESHOLD = 0.32  // ❌ Número mágico
  const KICK_THRESHOLD = 0.35   // ❌ Número mágico
  
  // 4. HARDCODE: Brightness injection
  accentLight = 95  // Snare
  accentLight = 80  // Kick
  
  // 5. ⚠️ SOBRESCRITURA DIRECTA
  this.lastColors.primary = hslToRgbRock(primaryHue, 100, 60)
  // ...
}
```

### 1.4 Flujo de Datos Corrupto

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO ACTUAL (ROTO)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Trinity Worker] ──> [SeleneColorEngine] ──> [lastColors]      │
│                              │                      │           │
│                              │              ┌───────▼───────┐   │
│                              │              │ if (Techno)   │   │
│                              │              │   SOBRESCRIBIR│   │
│                              │              └───────┬───────┘   │
│                              │                      │           │
│                              │              ┌───────▼───────┐   │
│                              │              │ if (PopRock)  │   │
│                              │              │   SOBRESCRIBIR│   │
│                              │              └───────┬───────┘   │
│                              │                      │           │
│                              ▼                      ▼           │
│                        [IGNORADO]            [DMX OUTPUT]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 PARTE II: LA SALUD DEL MOTOR (SeleneColorEngine)

### 2.1 Estado del Archivo

| Aspecto | Estado |
|---------|--------|
| **Ubicación** | `engines/visual/SeleneColorEngine.ts` |
| **Tamaño** | 1323 líneas |
| **Documentación** | ✅ Excelente (WAVE 68.5) |
| **Lógica** | ✅ Completa y funcional |
| **Uso** | ⚠️ PARCIALMENTE DESCONECTADO |

### 2.2 Capacidades del Motor (QUE NO USAMOS)

```typescript
// Constantes definidas y documentadas:
const PHI_ROTATION = 222.5°  // Rotación Fibonacci

const KEY_TO_HUE = {
  'C': 0,    // Do → Rojo
  'D': 60,   // Re → Naranja
  'E': 120,  // Mi → Amarillo
  'F': 150,  // Fa → Verde-Amarillo
  'G': 210,  // Sol → Cyan
  'A': 270,  // La → Índigo
  'B': 330,  // Si → Magenta
}

const MODE_MODIFIERS = {
  'major': { hue: +15, sat: +10, light: +10 },  // Alegre
  'minor': { hue: -15, sat: -10, light: -10 },  // Melancólico
  'dorian': { hue: -5, sat: 0, light: 0 },      // Jazzy
  'phrygian': { hue: -20, sat: +5, light: -10 },// Español
  // ...
}
```

### 2.3 ¿Dónde se Conecta?

```typescript
// SeleneLux.ts línea ~61
import { SeleneColorEngine, SeleneColorInterpolator, ... }

// SeleneLux.ts línea ~180
private colorInterpolator: SeleneColorInterpolator = new SeleneColorInterpolator()

// SeleneLux.ts línea ~966
const proceduralPalette = this.colorInterpolator.update(safeAnalysis, isDrop)
const rgbPalette = paletteToRgb(proceduralPalette)
this.lastColors = { ... rgbPalette ... }  // ✅ SE USA

// PERO LUEGO...
// Línea 1598+: if (isTechnoVibe) { this.lastColors = ... }  // ❌ SOBRESCRITO
// Línea 1759+: if (isPopRockVibe) { this.lastColors = ... }  // ❌ SOBRESCRITO
```

### 2.4 Diagnóstico

**El motor FUNCIONA y genera colores.**
**Pero sus colores son SOBRESCRITOS por bloques hardcodeados 10ms después.**

---

## 🦠 PARTE III: CONTAMINACIÓN GLOBAL

### 3.1 Variables de Estado Compartidas

| Variable | Ubicación | Modificada Por |
|----------|-----------|----------------|
| `this.lastColors` | SeleneLux | ColorEngine, Techno, Rock |
| `this._agcData` | SeleneLux | Techno, Rock (lectura) |
| `activeVibe` | SeleneLux | Todos los bloques |

### 3.2 Umbrales Duplicados/Conflictivos

| Concepto | TECHNO | ROCK | ¿Consistente? |
|----------|--------|------|---------------|
| Strobe Trigger | `treblePulse > 0.25` | `midsPulse > 0.32` | ❌ Lógica diferente |
| Bass Requirement | `bassEnergy > 0.80` | `bassPulse > 0.35` | ❌ Nombres diferentes |
| Dynamic Floor | `0.15 + bass*0.6` | No tiene | ❌ Solo en Techno |
| Hue Sanitizer | `30-75 → 320` | `80-160 → 0, 260-300 → 40` | ❌ Completamente distinto |

### 3.3 ¿Afecta a Fiesta Latina?

**NO directamente** - Los bloques tienen guards:
- Techno: `if (isTechnoVibe)`
- Rock: `if (isPopRockVibe && !isTechnoVibe)`

**PERO** Fiesta Latina hereda el comportamiento "fallback" del ColorEngine,
que es el único que **NO** sobrescribimos. Esto significa:

| Género | Usa ColorEngine Real? |
|--------|----------------------|
| Techno | ❌ NO (bypass total) |
| Pop/Rock | ❌ NO (bypass total) |
| **Fiesta Latina** | ✅ SÍ |
| **Chill Lounge** | ✅ SÍ |
| **Idle** | ✅ SÍ |

---

## 🎛️ PARTE IV: VIBES - CONFIGURACIÓN vs REALIDAD

### 4.1 Estructura de VibeProfile (LA TEORÍA)

```typescript
// electron-app/src/types/VibeProfile.ts

interface VibeProfile {
  id: VibeId;
  name: string;
  
  // CONSTRAINTS (Restricciones que Selene DEBERÍA respetar)
  mood: VibeMoodConstraints;     // allowed: MoodType[]
  color: VibeColorConstraints;   // strategies, temperature, saturation
  drop: VibeDropConstraints;     // sensitivity, thresholds, curves
  dimmer: VibeDimmerConstraints; // floor, ceiling
  movement: VibeMovementConstraints;
  effects: VibeEffectsConstraints;
}
```

### 4.2 Ejemplo: TechnoClubProfile.ts (LA REALIDAD)

```typescript
// electron-app/src/engines/context/presets/TechnoClubProfile.ts

export const VIBE_TECHNO_CLUB: VibeProfile = {
  color: {
    strategies: ['monochromatic', 'analogous', 'complementary'],  // ❌ IGNORADO
    temperature: { min: 4000, max: 9000 },  // ❌ IGNORADO
    saturation: { min: 0.3, max: 0.85 },    // ❌ IGNORADO
    maxHueShiftPerSecond: 30,               // ❌ IGNORADO
  },
  // ...
}
```

### 4.3 ¿Se Usan Estos Perfiles?

| Perfil | Existe | Se Carga | Se Respeta |
|--------|--------|----------|------------|
| TechnoClubProfile | ✅ | ✅ | ❌ **BYPASS TOTAL** |
| PopRockProfile | ✅ | ✅ | ❌ **BYPASS TOTAL** |
| FiestaLatinaProfile | ✅ | ✅ | ✅ (por defecto) |
| ChillLoungeProfile | ✅ | ✅ | ✅ (por defecto) |
| IdleProfile | ✅ | ✅ | ✅ (por defecto) |

---

## 📊 PARTE V: INVENTARIO DE NÚMEROS MÁGICOS

### 5.1 En el Bloque TECHNO (líneas 1598-1742)

| Línea | Número | Significado | ¿En VibeProfile? |
|-------|--------|-------------|------------------|
| 1617 | 75° | Límite de zona cálida | ❌ NO |
| 1630 | +60° | Rotación secondary | ❌ NO |
| 1633 | +120° | Rotación ambient | ❌ NO |
| 1636 | +180° | Rotación accent | ❌ NO |
| 1648 | 30-75° | Rango "amarillo prohibido" | ❌ NO |
| 1648 | 320° | Magenta de escape | ❌ NO |
| 1688 | 0.6 | Dynamic floor factor | ❌ NO |
| 1698 | 0.25 | Trigger threshold | ❌ NO |
| 1702 | 0.80 | Bass requirement | ❌ NO |
| 1726 | 100, 50 | S, L fijos | ❌ NO |

### 5.2 En el Bloque ROCK (líneas 1759-1876)

| Línea | Número | Significado | ¿En VibeProfile? |
|-------|--------|-------------|------------------|
| 1771 | 80-160° | Rango verde prohibido | ❌ NO |
| 1773 | 260-300° | Rango morado prohibido | ❌ NO |
| 1771 | 0° | Rojo destino | ❌ NO |
| 1773 | 40° | Ámbar destino | ❌ NO |
| 1781 | +180° | Rotación secondary | ❌ NO |
| 1784 | +120° | Rotación ambient | ❌ NO |
| 1810 | 0.32 | Snare threshold | ❌ NO |
| 1811 | 0.35 | Kick threshold | ❌ NO |
| 1825 | 95 | Lightness snare | ❌ NO |
| 1830 | 80 | Lightness kick | ❌ NO |
| 1861 | 60 | Lightness primary | ❌ NO |
| 1862 | 55 | Lightness secondary | ❌ NO |

**TOTAL: 22+ números mágicos hardcodeados que deberían estar en VibeProfile.**

---

## 💀 PARTE VI: DIAGNÓSTICO FINAL

### 6.1 El Problema Real

1. **SeleneColorEngine es un motor brillante** con teoría musical sólida (Quintas, Fibonacci, Modos).

2. **VibeProfile es una estructura limpia** que define restricciones por género.

3. **PERO en SeleneLux.ts**, hemos construido dos "tumores" de código:
   - TECHNO PRISM (145 líneas)
   - ROCK STAGE (117 líneas)
   
   Estos tumores:
   - Ignoran `VibeProfile.color.strategies`
   - Ignoran `VibeProfile.color.temperature`
   - Ignoran `VibeProfile.color.saturation`
   - Sobrescriben el output de `SeleneColorEngine`
   - Usan umbrales de reactividad hardcodeados
   - Contienen 22+ números mágicos sin documentar

### 6.2 Consecuencias

| Problema | Impacto |
|----------|---------|
| **Inmantenible** | Cada ajuste requiere editar código en SeleneLux.ts |
| **Inconsistente** | Techno y Rock tienen lógicas completamente diferentes |
| **No configurable** | El DJ no puede ajustar parámetros sin recompilar |
| **Viola SRP** | SeleneLux hace color + detección + strobe + reactividad |
| **No escalable** | Añadir Hip-Hop requiere otro bloque de 100+ líneas |
| **Sin tests** | Los números mágicos no tienen validación |

### 6.3 El Vibe Engine Desvirtuado

La idea original era:

```
[Audio] → [Trinity] → [VibeManager] → [Constraints] → [ColorEngine] → [DMX]
                           ↓
                      "Techno: frío"
                      "Rock: cálido"
                      "Latin: tropical"
```

Lo que tenemos:

```
[Audio] → [Trinity] → [ColorEngine] → [lastColors] → if(Techno){OVERWRITE}
                                                   → if(Rock){OVERWRITE}
                                                   → [DMX]
```

---

## 📋 APÉNDICE A: Archivos Relevantes

| Archivo | Líneas | Rol |
|---------|--------|-----|
| `SeleneLux.ts` | 2363 | Cerebro (hinchado) |
| `SeleneColorEngine.ts` | 1323 | Motor procedural (ignorado) |
| `VibeProfile.ts` | 360 | Tipos de constraints |
| `VibeManager.ts` | 592 | Gestor de vibes |
| `TechnoClubProfile.ts` | 124 | Preset Techno (ignorado) |
| `PopRockProfile.ts` | ~120 | Preset Rock (ignorado) |
| `FiestaLatinaProfile.ts` | ~120 | Preset Latino (funciona) |

---

## 📋 APÉNDICE B: Waves Involucradas

| Wave | Nombre | Daño Causado |
|------|--------|--------------|
| 127 | TETRADIC PRISM | Primer bypass de Techno |
| 128 | ACID INJECTION | Más hardcode en Techno |
| 129 | WHITE-HOT THRESHOLD | Strobe hardcodeado |
| 130-133 | STROBE CALIBRATION | Más números mágicos |
| 135 | ROCK STAGE | Primer bypass de Rock |
| 136 | STADIUM SEPARATION | Más hardcode en Rock |
| 137 | ANALOG GAIN | Aún más números mágicos |

---

*Documento generado automáticamente por WAVE 138: THE GREAT COLOR AUTOPSY*
*Este documento es un informe de estado, NO una propuesta de solución.*
