# 🎨 WAVE 725: PROJECT POLYCHROME - ZONE OVERRIDES ARCHITECTURE

## ✅ STATUS: COMPLETE

**Fecha:** 2026-01-18
**Prioridad:** CRÍTICA (BLOCKER)
**Estado:** ✅ IMPLEMENTADO

---

## 📜 EL PROBLEMA

LuxSync tenía una **"BROCHA GORDA"**:

```typescript
// ANTES: Un solo color para todas las zonas
getOutput(): EffectFrameOutput {
  return {
    colorOverride: { h: 120, s: 100, l: 50 },  // Verde para TODOS
    zones: ['front', 'back'],                   // Todos reciben el mismo verde
  }
}
```

**Resultado:** Imposible hacer efectos como TropicalPulse (ROJO front, AZUL back) o GhostBreath (UV solo atrás).

---

## 🎯 LA SOLUCIÓN: PINCELES FINOS

Nueva arquitectura con `zoneOverrides`:

```typescript
// AHORA: Colores DIFERENTES por zona
getOutput(): EffectFrameOutput {
  return {
    zones: ['front', 'back'],
    zoneOverrides: {
      'front': { color: { h: 0, s: 100, l: 50 }, dimmer: 0.9 },    // ROJO
      'back':  { color: { h: 240, s: 100, l: 50 }, dimmer: 0.8 },  // AZUL
    }
  }
}
```

---

## 📦 CAMBIOS IMPLEMENTADOS

### 1. `types.ts` - Nueva interfaz `zoneOverrides`

```typescript
interface EffectFrameOutput {
  // ... campos existentes ...
  
  // ✅ NUEVO (WAVE 725):
  zoneOverrides?: {
    [zoneId: string]: {
      color?: { h: number; s: number; l: number }
      dimmer?: number
      white?: number
      amber?: number
      movement?: { pan?: number; tilt?: number; isAbsolute?: boolean }
    }
  }
}
```

También en `CombinedEffectOutput` para la mezcla de múltiples efectos.

### 2. `EffectManager.ts` - Merge inteligente de zone overrides

- **HTP (Highest Takes Precedence)** para `dimmer`, `white`, `amber`
- **LTP (Latest Takes Precedence)** por prioridad para `color` y `movement`
- Combina zoneOverrides de múltiples efectos activos

### 3. `TitanOrchestrator.ts` - Render por zona

Nuevo flujo de decisión:

```
1. ¿Hay zoneOverrides?
   → SÍ: Procesar PINCEL FINO (cada zona su color)
   → NO: Usar legacy BROCHA GORDA (colorOverride global)

2. Para cada fixture:
   → Buscar qué zona le corresponde
   → Aplicar el override específico de esa zona
```

Nuevo helper method:
```typescript
fixtureMatchesZone(fixtureZone: string, targetZone: string): boolean
```

### 4. `TropicalPulse.ts` - Prueba de concepto

**Antes:** Un solo color para front y back
**Ahora:** 
- Front → ROJO TROPICAL (h:0)
- Back → AZUL CARIBEÑO (h:240)

### 5. `GhostBreath.ts` - RESUCITADO

**Antes:** Afectaba todas las zonas (incluso front = blanco molesto)
**Ahora:**
- Back → UV / Deep Purple
- Movers → UV más sutil
- Front → **SIN OVERRIDE** (mantiene la paleta base)

---

## 🗺️ ZONAS SOPORTADAS

| Zone ID | Legacy Canvas | Constructor 3D |
|---------|---------------|----------------|
| `front` | FRONT_PARS | floor-front |
| `back` | BACK_PARS | floor-back |
| `movers` | MOVING_LEFT, MOVING_RIGHT | ceiling-* |
| `pars` | *_PARS | floor-* |
| `left` | MOVING_LEFT | ceiling-left |
| `right` | MOVING_RIGHT | ceiling-right |
| `all` | Todo | Todo |

---

## 🔄 COMPATIBILIDAD HACIA ATRÁS

| Efecto | Usa `zoneOverrides` | Funciona? |
|--------|---------------------|-----------|
| SolarFlare | ❌ (usa globalOverride) | ✅ SÍ |
| TropicalPulse | ✅ NUEVO | ✅ SÍ |
| GhostBreath | ✅ NUEVO | ✅ SÍ |
| StrobeStorm | ❌ (legacy) | ✅ SÍ |
| TidalWave | ❌ (legacy) | ✅ SÍ |

---

## 📊 PRIORIDAD DE APLICACIÓN

```
1. Si efecto tiene zoneOverrides → Usar PINCELES FINOS
2. Si efecto tiene globalOverride=true → Override TOTAL (SolarFlare)
3. Si efecto tiene colorOverride → BROCHA GORDA (legacy)
```

---

## ✅ CRITERIOS DE ÉXITO (CUMPLIDOS)

- [x] TypeScript compila sin errores
- [x] TropicalPulse: ROJO en front, AZUL en back simultáneamente
- [x] GhostBreath: Solo afecta back/movers, front INTACTO
- [x] SolarFlare sigue funcionando (compatibilidad)

---

## 🎉 WAVE 725 COMPLETE

**La era de la Brocha Gorda ha terminado.**
**Bienvenidos los Pinceles Finos.** 🎨
