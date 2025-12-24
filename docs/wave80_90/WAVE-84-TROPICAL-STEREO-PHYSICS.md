# 🌴 WAVE 84: Tropical Stereo & Energy Physics

> **Fecha**: 2025-01-XX  
> **Objetivo**: Desacoplar colores para 4-way independence + Paleta Tropical para Latinas + High-Energy DROP Detection  
> **Archivos modificados**: `SeleneColorEngine.ts`, `mind.ts`, `SectionTracker.ts`

---

## 📋 RESUMEN EJECUTIVO

WAVE 84 introduce 3 mejoras críticas para el manejo de colores y detección de secciones:

| Feature | Problema | Solución |
|---------|----------|----------|
| **STEREO MODE** | Ambient = copia de Secondary | Ambient calculado independiente según Strategy |
| **TROPICAL PALETTE** | Fiesta Latina = solo rojos/naranjas | Permitir verdes/turquesas/magentas |
| **HIGH-ENERGY PHYSICS** | DROP sticks en tracks comprimidos | Umbrales dinámicos según avgEnergy |

---

## 🎨 TAREA 1A: STEREO MODE - Ambient Independiente

### Problema Detectado
En el código original, `ambient` era calculado como simple rotación de `secondary`:
```typescript
const ambient = { ...secondary };  // ❌ Mismo color!
```

Esto producía **solo 3 colores reales** en escena (Primary, Secondary, Accent).

### Solución Implementada

**Archivo**: `SeleneColorEngine.ts` (líneas ~758-800)

```typescript
// 🌴 WAVE 84: STEREO MODE - Ambient independiente según Strategy
let ambientHue: number;

if (strategy === 'triadic') {
  // 🔺 Triadic: 3er punto del triángulo cromático (120° entre cada color)
  // Primary = 0°, Secondary = 120°, Ambient = 240°
  ambientHue = normalizeHue(finalHue + 240);
  
} else if (strategy === 'complementary') {
  // 🔀 Complementary: Split-complementary para Ambient
  // Primary = 0°, Secondary = 180°, Ambient = 210° (split del complementary)
  ambientHue = normalizeHue(secondaryHue + 30);
  
} else {
  // 🌊 Analogous: Vecino opuesto del Primary
  // Primary = 0°, Secondary = 30°, Ambient = -30°
  ambientHue = normalizeHue(finalHue - 30);
}

const ambient = {
  h: ambientHue,
  s: Math.max(25, primary.s * 0.4),
  l: Math.max(15, primary.l * 0.35),
};
```

### Resultado Visual

| Strategy | Primary | Secondary | Accent | Ambient |
|----------|---------|-----------|--------|---------|
| Triadic | 0° (Red) | 120° (Green) | 60° (Yellow) | 240° (Blue) |
| Complementary | 0° (Red) | 180° (Cyan) | 270° (Purple) | 210° (Azure) |
| Analogous | 0° (Red) | 30° (Orange) | 315° (Pink) | 330° (Rose) |

---

## 🌴 TAREA 1B: TROPICAL PALETTE - Latinas con Fríos

### Problema Detectado
"Fiesta Latina" tenía `palette.thermalBias = 'warm'`, forzando **todo a rojos/naranjas/amarillos**.
Esto eliminaba los colores "selváticos" (verdes, turquesas, magentas) que son esenciales para vibes caribeñas.

### Solución Implementada

**Archivo**: `SeleneColorEngine.ts` (líneas ~800-830)

```typescript
// 🌴 WAVE 84: TROPICAL PALETTE - Permitir fríos en Vibes Latinas
const vibeId = data.vibeId || 'idle';
const isLatinoVibe = vibeId.toLowerCase().includes('latin') || 
                     vibeId.toLowerCase().includes('fiesta');

if (isLatinoVibe) {
  // 🌿 TROPICAL ZONES:
  // - Green Zone: 90° - 160° (selva, palmeras)
  // - Turquoise Zone: 170° - 200° (playa, caribe)
  // - Magenta Zone: 280° - 330° (neón tropical, flamenco)
  
  // Secondary: Rotación +150° lleva rojo→turquesa, naranja→verde, etc.
  const tropicalSecondaryHue = normalizeHue(finalHue + 150);
  
  // Ambient: Rotación +270° lleva a zona Magenta
  const tropicalAmbientHue = normalizeHue(finalHue + 270);
  
  // Aplicar solo si caen en zonas válidas (no modificar si ya son cálidos)
  secondary.h = tropicalSecondaryHue;
  ambientHue = tropicalAmbientHue;
}
```

### Data Flow: vibeId Injection

**Archivo**: `mind.ts` (Worker)

```typescript
// 🌴 WAVE 84: Mover activeVibe arriba para inyectar vibeId
const activeVibe = vibeManager.getActiveVibe();

const stabilizedAnalysis = {
  ...analysis,
  energy: energyOutput.smoothedEnergy,
  mood: constrainedMood,
  vibeId: activeVibe.id,  // 🌴 WAVE 84: Nuevo campo
  wave8: { ... }
} as SeleneExtendedAnalysis;
```

**Interface**: `ExtendedAudioAnalysis` (línea ~204)

```typescript
interface ExtendedAudioAnalysis {
  // ... campos existentes ...
  
  // 🌴 WAVE 84: Vibe ID para paletas contextuales (Tropical/Caribbean)
  vibeId?: string;
}
```

### Resultado Visual - Fiesta Latina

| Primary (Audio) | Secondary (Tropical) | Ambient (Tropical) |
|-----------------|---------------------|-------------------|
| 30° (Orange) | 180° (Cyan) | 300° (Magenta) |
| 0° (Red) | 150° (Mint) | 270° (Purple) |
| 60° (Yellow) | 210° (Sky Blue) | 330° (Rose) |

---

## ⚡ TAREA 2: HIGH-ENERGY PHYSICS - Loudness War Fix

### Problema Detectado
Tracks con **mastering agresivo** (reggaetón, EDM, pop moderno) tienen energía "aplastada":
- avgEnergy permanece > 0.7 constantemente
- Para que `ratio > 1.4` se cumpla, necesitaría saltar de 0.7 → 0.98 (¡imposible!)
- Resultado: DROP **nunca se detecta** o se queda **stuck forever**

### Solución Implementada

**Archivo**: `SectionTracker.ts` (líneas ~553-580)

```typescript
// 🌴 WAVE 84: HIGH-ENERGY PHYSICS (Loudness War Tracks)
// ═══════════════════════════════════════════════════════════════════════
// Problema: Tracks "comprimidos" tienen avgEnergy > 0.7 permanente,
// haciendo imposible que ratio > 1.4 se cumpla.
// Solución: Umbrales dinámicos según el nivel de compresión del track.
// ═══════════════════════════════════════════════════════════════════════
const isHighEnergyTrack = this.avgEnergy > 0.7;

// 🔥 WAVE 84: Umbrales adaptativos
// - Track dinámico (avgEnergy ≤ 0.7): ratio 1.4, abs 0.75 (original)
// - Track comprimido (avgEnergy > 0.7): ratio 1.15, abs 0.90 (más sensible)
const dynamicRatio = isHighEnergyTrack ? 1.15 : 1.4;
const dynamicAbsThreshold = isHighEnergyTrack ? 0.90 : 0.75;

// 🚀 DETECCIÓN DE DROP (La Subida Explosiva)
// 🌴 WAVE 84: Usar umbrales dinámicos en lugar de constantes
if (ratio > dynamicRatio && this.instantEnergy > dynamicAbsThreshold) {
  // ... lógica de DROP existente ...
}
```

### Comparación de Umbrales

| Track Type | avgEnergy | dynamicRatio | dynamicAbsThreshold |
|------------|-----------|--------------|---------------------|
| **Dinámico** (Jazz, Clásica) | ≤ 0.7 | 1.4 (40% jump) | 0.75 |
| **Comprimido** (EDM, Reggaetón) | > 0.7 | 1.15 (15% jump) | 0.90 |

### Matemáticas

**Track Dinámico** (avgEnergy = 0.5):
- Para DROP: `instant > 0.5 * 1.4 = 0.70` AND `instant > 0.75`
- Necesita: **instant > 0.75** (alcanzable)

**Track Comprimido** (avgEnergy = 0.75):
- Con umbral OLD: `instant > 0.75 * 1.4 = 1.05` (¡imposible!)
- Con umbral NEW: `instant > 0.75 * 1.15 = 0.86` AND `instant > 0.90`
- Necesita: **instant > 0.90** (difícil pero posible en pico real)

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambio | Líneas |
|---------|--------|--------|
| `SeleneColorEngine.ts` | STEREO_MODE + TROPICAL_PALETTE | ~758-830 |
| `SeleneColorEngine.ts` | Interface `vibeId` field | ~204 |
| `mind.ts` | vibeId injection en stabilizedAnalysis | ~489, 493 |
| `SectionTracker.ts` | HIGH-ENERGY PHYSICS umbrales dinámicos | ~553-580 |

---

## 🧪 TESTING RECOMENDADO

### Test 1: STEREO MODE (4 colores distintos)
1. Cargar cualquier track
2. Verificar en el visualizer que Primary, Secondary, Accent y Ambient son **distintos**
3. Cambiar strategy (triadic → complementary → analogous)
4. Verificar que Ambient cambia según la strategy

### Test 2: TROPICAL PALETTE
1. Seleccionar Vibe "Fiesta Latina"
2. Cargar track con mood BRIGHT (cálido)
3. Verificar que Secondary muestra **turquesas/verdes** (no solo naranjas)
4. Verificar que Ambient muestra **magentas/púrpuras** (no solo rojos)

### Test 3: HIGH-ENERGY PHYSICS
1. Cargar track **muy comprimido** (reggaetón comercial, EDM festival)
2. Verificar en consola: `avgEnergy > 0.7` en la mayoría del track
3. Verificar que DROP se detecta cuando hay buildup → climax real
4. Verificar que no se queda stuck en DROP durante 30+ segundos

---

## 🔮 FUTURAS MEJORAS

1. **STEREO LERP**: Transición suave para Ambient cuando cambia strategy
2. **TROPICAL ZONES CONFIGURABLE**: Permitir ajustar zonas de hue por Vibe en vibes.json
3. **ADAPTIVE COOLDOWN**: Reducir cooldown de DROP para tracks comprimidos (hay más drops)
4. **ENERGY NORMALIZATION**: Normalizar energía al inicio del track para detectar rango dinámico real

---

## ✅ WAVE 84 COMPLETADA

- [x] STEREO MODE: Ambient independiente según strategy
- [x] TROPICAL PALETTE: Verdes/Turquesas/Magentas en Latinas
- [x] vibeId data flow: Worker → Analysis → Engine
- [x] HIGH-ENERGY PHYSICS: Umbrales dinámicos para Loudness War
- [x] Documentación WAVE-84
