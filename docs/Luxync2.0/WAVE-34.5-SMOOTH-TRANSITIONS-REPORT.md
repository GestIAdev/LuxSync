# 🎨 WAVE 34.5 - SMOOTH COLOR BLENDING & REBRANDING REPORT

**Fecha**: 2025-12-17  
**Objetivo**: "Transiciones suaves entre paletas + Rebranding UI"

---

## 📋 RESUMEN EJECUTIVO

WAVE 34.5 implementa:
1. **Transiciones suaves** entre paletas de color (Fuego → Hielo con gradiente)
2. **Rebranding** de la pestaña "SIMULATE" → "LUX STAGE"

---

## ✅ CAMBIOS IMPLEMENTADOS

### 1. Control Store - Estado de Transición

**Archivo**: `src/stores/controlStore.ts`

```typescript
// Nuevos campos añadidos
targetPalette: LivingPaletteId | null  // Paleta destino durante transición
transitionProgress: number              // 0-1 (1 = transición completa)

// Nueva acción
updateTransition: (progress: number) => void

// setPalette modificado para iniciar animación
setPalette: (palette) => {
  const current = get().activePalette
  if (palette === current) return
  
  // Inicia transición animada
  set({ targetPalette: palette, transitionProgress: 0 })
  
  // Animación de 2 segundos
  const startTime = Date.now()
  const duration = 2000
  
  const animate = () => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    
    if (progress < 1) {
      get().updateTransition(progress)
      requestAnimationFrame(animate)
    } else {
      // Transición completa: swap palettes
      set({
        activePalette: palette,
        targetPalette: null,
        transitionProgress: 1
      })
    }
  }
  requestAnimationFrame(animate)
}
```

### 2. Frontend Color Engine - Interpolación HSL

**Archivo**: `src/utils/frontendColorEngine.ts`

#### Nuevas funciones helper:

```typescript
// 🔄 lerpHue - Interpola por el camino corto en la rueda de color
function lerpHue(h1: number, h2: number, t: number): number {
  h1 = ((h1 % 360) + 360) % 360
  h2 = ((h2 % 360) + 360) % 360
  
  let diff = h2 - h1
  
  // Si la diferencia es >180, ir por el otro lado
  if (diff > 180) diff -= 360
  else if (diff < -180) diff += 360
  
  let result = h1 + diff * t
  return ((result % 360) + 360) % 360
}

// Linear interpolation para S y L
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Extrae lógica del switch a función reutilizable
function calculatePaletteHSL(
  palette: LivingPaletteId,
  zoneType: ZoneType,
  side: Side,
  timeDrift: number,
  intensity: number
): HSLResult
```

#### getLivingColor actualizado:

```typescript
export function getLivingColor(
  palette: LivingPaletteId,
  intensity: number = 1,
  zone: Side = 'front',
  globalSaturation: number = 1,
  targetPalette: LivingPaletteId | null = null,  // ← NUEVO
  transitionProgress: number = 1                  // ← NUEVO
): RGBColor {
  // Calcula HSL de paleta origen
  const sourceHSL = calculatePaletteHSL(palette, ...)
  
  // Si hay transición en progreso, interpola
  if (targetPalette && transitionProgress < 1) {
    const targetHSL = calculatePaletteHSL(targetPalette, ...)
    
    finalHSL = {
      h: lerpHue(sourceHSL.h, targetHSL.h, transitionProgress),
      s: lerp(sourceHSL.s, targetHSL.s, transitionProgress),
      l: lerp(sourceHSL.l, targetHSL.l, transitionProgress),
    }
  }
  
  return hslToRgb(finalHSL)
}
```

### 3. useFixtureRender - Pasar parámetros de transición

**Archivo**: `src/hooks/useFixtureRender.ts`

```typescript
// Lee del store
const targetPalette = useControlStore(state => state.targetPalette)
const transitionProgress = useControlStore(state => state.transitionProgress)

// Pasa a calculateFixtureRenderValues
return calculateFixtureRenderValues(
  ...,
  targetPalette,
  transitionProgress
)
```

### 4. StageSimulator2 - Pasar parámetros de transición

**Archivo**: `src/components/views/SimulateView/StageSimulator2.tsx`

```typescript
// Lee del store
const targetPalette = useControlStore(state => state.targetPalette);
const transitionProgress = useControlStore(state => state.transitionProgress);

// Pasa a calculateFixtureRenderValues
const { color, intensity, pan, tilt } = calculateFixtureRenderValues(
  ...,
  targetPalette,
  transitionProgress
);

// Dependencias del useMemo actualizadas
}, [..., targetPalette, transitionProgress]);
```

### 5. Rebranding - SIMULATE → LUX STAGE

**Archivo**: `src/stores/navigationStore.ts`

```typescript
{
  id: 'simulate',
  label: 'LUX STAGE',  // ← Cambiado de 'SIMULATE'
  icon: 'monitor',
  shortcut: 'Alt+2',
  description: 'Visualización del escenario - Canvas 2.0',
},
```

---

## 📊 FLUJO DE TRANSICIÓN

```
┌─────────────────────────────────────────────────────────────────┐
│  USER CLICKS "HIELO" (currently on "FUEGO")                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. setPalette('hielo') called                                   │
│     │                                                            │
│     ├── activePalette: 'fuego' (unchanged for now)               │
│     ├── targetPalette: 'hielo'                                   │
│     └── transitionProgress: 0                                    │
│                                                                  │
│  2. Animation loop starts (2000ms duration)                      │
│     │                                                            │
│     │  Frame 0:    progress = 0.00                               │
│     │  Frame 30:   progress = 0.50 → VIOLET MIX                  │
│     │  Frame 60:   progress = 1.00 → PURE ICE                    │
│     │                                                            │
│  3. Interpolation in getLivingColor:                             │
│     │                                                            │
│     │  sourceHSL: { h: 15, s: 100, l: 50 }  (fuego/orange)       │
│     │  targetHSL: { h: 200, s: 85, l: 55 }  (hielo/blue)         │
│     │                                                            │
│     │  At progress = 0.5:                                        │
│     │  h = lerpHue(15, 200, 0.5) = 107.5   (goes through 0/360)  │
│     │  s = lerp(100, 85, 0.5) = 92.5                             │
│     │  l = lerp(50, 55, 0.5) = 52.5                              │
│     │  → Resultado: VERDE-CYAN transitorio                       │
│     │                                                            │
│  4. Animation complete:                                          │
│     ├── activePalette: 'hielo'                                   │
│     ├── targetPalette: null                                      │
│     └── transitionProgress: 1                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 lerpHue - Camino Corto

```
         0° (RED)
           │
   330° ───┼─── 30°
           │
  300° ────┼──── 60°
           │
   270° ───┼─── 90°
           │
  240° ────┼──── 120°
           │
   210° ───┼─── 150°
           │
         180° (CYAN)

FUEGO (15°) → HIELO (200°)

❌ Wrong way: 15 → 60 → 120 → 180 → 200 (185° distance)
✅ Right way: 15 → 0 → 330 → 270 → 200 (175° distance - shorter!)

lerpHue(15, 200, 0.5) = 287.5° (MAGENTA) 👍
```

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---------|--------|
| `src/stores/controlStore.ts` | targetPalette, transitionProgress, updateTransition, animación en setPalette |
| `src/utils/frontendColorEngine.ts` | lerpHue, lerp, calculatePaletteHSL, getLivingColor con transición |
| `src/hooks/useFixtureRender.ts` | Lee y pasa targetPalette/transitionProgress |
| `src/components/views/SimulateView/StageSimulator2.tsx` | Lee y pasa targetPalette/transitionProgress |
| `src/stores/navigationStore.ts` | SIMULATE → LUX STAGE |

---

## 🧪 CÓMO PROBAR

1. **Iniciar LuxSync** y abrir vista "LUX STAGE"
2. **Seleccionar paleta "FUEGO"** (naranja/rojo)
3. **Cambiar a "HIELO"** (azul/cian)
4. **Observar transición**:
   - Duración: ~2 segundos
   - Pasa por colores intermedios (violeta/magenta)
   - Sin saltos bruscos
5. **Verificar rebranding**:
   - La pestaña dice "LUX STAGE" (no "SIMULATE")

---

## 🎯 RESULTADO

| Aspecto | Antes | Después |
|---------|-------|---------|
| Cambio de paleta | Instantáneo (salto) | Transición suave de 2s |
| Interpolación de Hue | N/A | Por camino corto (lerpHue) |
| Nombre de pestaña | SIMULATE | LUX STAGE |
| Parámetros de transición | No existían | targetPalette + transitionProgress |

---

**WAVE 34.5 COMPLETE** ✅

*"De fuego a hielo sin quemarse ni congelarse. Transiciones que respiran."*
