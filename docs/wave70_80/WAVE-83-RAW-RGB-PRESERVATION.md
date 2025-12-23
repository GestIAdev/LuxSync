# 🛡️ WAVE 83: RAW RGB PRESERVATION (Anti-Barro Fix)

## 📅 Fecha: 2025-12-23
## 🎯 Objetivo: Corregir pérdida de vibrancia en colores

---

## 🔍 PROBLEMA IDENTIFICADO

### Síntoma
- **Backend reporta**: `hue=15, sat=94` (naranja vibrante)
- **UI muestra**: `hue=14°, sat=49%, L=36%` (#8B452F = marrón barro)

### Discrepancia
| Fuente | Hue | Sat | Light | Color |
|--------|-----|-----|-------|-------|
| Backend (log) | 15° | 94% | ? | Naranja vibrante |
| UI (screenshot) | 14° | 49% | 36% | Marrón barro 🤮 |

### Causa Raíz

En `SeleneLux.updateFromTrinity()` (líneas 1455-1480):

```typescript
// ANTES (PROBLEMA):
const applyIntensity = (c, mult) => ({
  r: Math.round(c.r * mult),
  g: Math.round(c.g * mult),
  b: Math.round(c.b * mult),
});

this.lastColors = {
  primary: applyIntensity(palette.primary, intensityValue),        // Oscurecido
  secondary: applyIntensity(palette.secondary, intensityValue * 0.8), // Aún más oscuro
  accent: applyIntensity(palette.accent, intensityValue * 0.6),      // Muy oscuro
  ...
}
```

**El problema**: Multiplicar RGB por `intensity` (que puede ser 0.5-0.8 según la energía) **oscurece los colores**. Cuando luego se reconvierten a HSL para la UI:
- **Saturación se reduce** (menos contraste entre canales)
- **Luminosidad se reduce** (valores RGB más bajos)

### Ejemplo Matemático

1. Worker genera HSL vibrante: `H=15, S=94, L=50`
2. Se convierte a RGB: `(255, 100, 0)` naranja brillante
3. Se aplica `intensity = 0.6`: `(153, 60, 0)` naranja oscurecido
4. Se reconvierte a HSL: `H=14, S=?, L=30` - **¡MARRÓN!**

---

## ✅ SOLUCIÓN IMPLEMENTADA

### Cambio en `SeleneLux.ts`

```typescript
// DESPUÉS (WAVE 83):
if (palette) {
  const intensityValue = palette.intensity ?? 1.0
  
  // 🛡️ WAVE 83: Asignar colores PUROS del Worker (sin multiplicar por intensity)
  // La intensity se guarda por separado para uso del dimmer
  this.lastColors = {
    primary: { ...palette.primary },         // RGB PURO
    secondary: { ...palette.secondary },     // RGB PURO
    accent: { ...palette.accent },           // RGB PURO
    ambient: { ...palette.secondary },       // TODO WAVE 84: Calcular independiente
    intensity: intensityValue,               // Para el DIMMER, no para el color
    saturation: this.globalSaturation
  }
}
```

### Cambio en `SeleneColorEngine.ts`

Añadido `light` al log de COLOR_AUDIT para diagnóstico completo:

```typescript
const audit = {
  vibe: vibeId,
  key: currentKey,
  strategy: currentStrategy,
  reason: overrideReason || 'vibe_optimal',
  temp: tempKelvin,
  mood: data.mood || 'neutral',
  hue: Math.round(palette.primary.h),
  sat: Math.round(palette.primary.s),
  light: Math.round(palette.primary.l),  // 🛡️ WAVE 83: NUEVO
  energy: Math.round(data.energy * 100)
};
```

---

## 📊 FLUJO CORREGIDO

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WAVE 83: RGB PRESERVATION                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Worker genera HSL vibrante (Anti-Mud aplicado en WAVE 81)       │
│     └─ H=15, S=94, L=50                                             │
│                                                                     │
│  2. Worker convierte HSL → RGB                                       │
│     └─ RGB = (255, 100, 0) naranja brillante                        │
│                                                                     │
│  3. 🛡️ WAVE 83: Main thread recibe RGB PURO (sin multiplicar)       │
│     └─ lastColors.primary = {r:255, g:100, b:0}                     │
│                                                                     │
│  4. getBroadcast() convierte RGB → HSL para UI                       │
│     └─ H=15, S=94, L=50 ✅ (¡COINCIDE CON BACKEND!)                  │
│                                                                     │
│  5. intensity se usa para DIMMER del fixture                         │
│     └─ fixture.dimmer = 255 * intensity                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 RELACIÓN CON WAVE 81 (ANTI-MUD)

WAVE 81 forzaba colores vibrantes en `SeleneColorEngine.generate()`:
- Zona de peligro (Hue 20-55): `L >= 45`, `S >= 80`
- Contexto festivo: `L >= 30`, `S >= 60`

**Pero el fix de WAVE 81 se perdía** cuando `updateFromTrinity()` oscurecía los RGB.

Ahora con WAVE 83:
1. WAVE 81 genera colores vibrantes ✅
2. WAVE 83 preserva esos colores puros ✅
3. La UI recibe los valores originales ✅

---

## 📝 ARCHIVOS MODIFICADOS

| Archivo | Cambio | Líneas |
|---------|--------|--------|
| `SeleneLux.ts` | Eliminar applyIntensity, usar RGB puros | ~1455-1480 |
| `SeleneColorEngine.ts` | Añadir `light` a COLOR_AUDIT | ~588 |

---

## 🧪 VERIFICACIÓN

Después de este fix, el log `[COLOR_AUDIT]` debería mostrar:

```
[COLOR_AUDIT] 🎨 {"vibe":"fiesta-latina","key":"D","strategy":"complementary",
                  "reason":"vibe_optimal","temp":3020,"mood":"bright",
                  "hue":15,"sat":94,"light":50,"energy":75}
```

Y la UI debería mostrar:
- **HUE**: 15° (igual que backend)
- **SAT**: 94% (igual que backend) 
- **LUM**: 50% (igual que backend)
- **HEX**: Naranja vibrante, NO marrón

---

## ⚠️ NOTA SOBRE INTENSITY

La `intensity` ahora NO modifica el color RGB. Debe usarse para:
- Controlar el **dimmer** del fixture (canal DMX de intensidad)
- Aplicar efectos de respiración/pulsación a nivel de fixture
- NO para cambiar el color HSL

Si los fixtures parecen "más tenues" después de este fix, es correcto - el color es vibrante pero el dimmer puede ser bajo. Ajustar la curva de intensity si es necesario.

---

## 🔜 TODO WAVE 84: AMBIENT INDEPENDIENTE

Actualmente:
```typescript
ambient: { ...palette.secondary }  // Copia de secondary
```

El usuario quiere que `ambient` sea un color calculado independiente. Esto se abordará en WAVE 84.

---

*Documentación WAVE 83 - Preservación de RGB puros*
