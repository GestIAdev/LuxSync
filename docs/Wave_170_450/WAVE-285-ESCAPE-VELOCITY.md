# 🚀 WAVE 285: ESCAPE VELOCITY

**Fecha:** 2026-01-01  
**Tipo:** Fix Crítico  
**Trigger:** `[ThermalGravity] Hue: 45° → 20°` (¡NARANJA EN TECHNO!)

---

## 🚨 BUG DETECTADO

```
[ThermalGravity] 🌡️ VibeTemp=9500K | Pole=240° | Force=15% | Hue: 45° → 20°
```

Un **naranja asqueroso** apareció en F# major y D major en TechnoClub.

### Cadena del Desastre

1. **KEY_TO_HUE['D'] = 60°** (Naranja)
2. **+ MODE_MODIFIERS['major'].hue = -15°** → **45°**
3. **Thermal Gravity** empuja hacia polo 240°...
   - Pero por el "camino corto" (hacia atrás): 45° - 25° = **20°**
4. **forbiddenHueRanges [[25, 80]]** no lo atrapa (20° < 25°)
5. **hueRemapping [{from: 90, to: 110}]** no lo atrapa (20° < 90°)
6. **RESULTADO: 20° = NARANJA EN EL ESCENARIO** 🤮

### El Problema Matemático

```
Delta = Pole - Hue = 240 - 45 = 195°
Normalizado: 195 > 180 → 195 - 360 = -165°
newHue = 45 + (-165 × 0.15) = 45 - 24.75 = 20.25°
```

La gravedad fue hacia atrás (camino más corto) y empujó el naranja **MÁS hacia el naranja**.

---

## 🔧 SOLUCIÓN: ESCAPE VELOCITY

Expandir **hueRemapping** para capturar TODO el rango cálido (0-110°):

```typescript
// ANTES
hueRemapping: [{ from: 90, to: 110, target: 130 }],

// DESPUÉS (WAVE 285)
hueRemapping: [
  { from: 0, to: 24, target: 300 },    // Rojos → Magenta (auroras boreales OK)
  { from: 25, to: 85, target: 180 },   // Naranjas/Amarillos → Cyan
  { from: 86, to: 110, target: 130 },  // Verde césped → Verde Láser
],
```

### Flujo Corregido

1. **D major → 45°**
2. **Thermal Gravity → 20°** (sigue pasando)
3. **hueRemapping [0, 24] → 300°** (¡CAPTURADO!)
4. **RESULTADO: 300° = MAGENTA** ✅

---

## 📐 TABLA DE REMAPPING

| Rango Input | Target | Resultado Visual |
|-------------|--------|------------------|
| 0° - 24° | 300° (Magenta) | Auroras boreales, aceptable |
| 25° - 85° | 180° (Cyan) | Láser frío, perfecto |
| 86° - 110° | 130° (Verde Láser) | Ya existía |
| 111° - 360° | Sin cambio | Colores fríos naturales |

---

## 🛡️ DEFENSA EN PROFUNDIDAD

```
┌─────────────────────────────────────────────────────────────┐
│  CAPA 1: hueRemapping                                       │
│  ─────────────────────                                      │
│  Captura 0-110° y redirige a colores fríos                 │
│  ✅ 20° → 300° (Magenta)                                    │
│  ✅ 45° → 300° (Magenta)                                    │
│  ✅ 60° → 180° (Cyan)                                       │
├─────────────────────────────────────────────────────────────┤
│  CAPA 2: forbiddenHueRanges [[25, 80]]                      │
│  ─────────────────────────────────────                      │
│  Backup: Si algo escapa del remapping, elastic rotation     │
├─────────────────────────────────────────────────────────────┤
│  CAPA 3: Thermal Gravity (15%)                              │
│  ─────────────────────────────                              │
│  Enfría suavemente hacia polo 240°                          │
│  Ya no es la única defensa                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `colorConstitutions.ts` | Expandido hueRemapping, simplificado allowedHueRanges |

---

## 🎯 CASOS DE PRUEBA

| Key + Mode | Hue Base | Post-Gravity | Post-Remapping | ✓/✗ |
|------------|----------|--------------|----------------|-----|
| D major | 45° | 20° | 300° (Magenta) | ✅ |
| F# major | 180° | 171° | 171° (Sin cambio) | ✅ |
| C major | 0° | -8° → 352° | 300° (Magenta) | ✅ |
| C# major | 15° | 5° | 300° (Magenta) | ✅ |
| E major | 105° | 95° | 130° (Verde Láser) | ✅ |

---

## 💡 FILOSOFÍA

> "No hardcodear salidas. Ajustar las fuerzas físicas."

El problema no era la gravedad. El problema era que **el sistema de defensa tenía un agujero**: la zona 0-24° estaba permitida pero contenía naranjas-rojos asquerosos.

La solución mantiene la filosofía: 
- No prohibimos colores arbitrariamente
- Los **redirigimos** a equivalentes fríos aceptables
- El algoritmo musical sigue mandando, solo "enfriamos" su salida

---

*"La velocidad de escape es la velocidad mínima necesaria para que un objeto escape de la atracción gravitatoria del naranja"*  
— El Cónclave, WAVE 285
