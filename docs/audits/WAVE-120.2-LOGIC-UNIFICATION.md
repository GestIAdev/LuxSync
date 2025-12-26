# WAVE 120.2: LOGIC UNIFICATION
## Función Matemática Pura para Movers

**Fecha**: 2025-12-25  
**Arquitecto**: GeminiPunk  
**Implementador**: PunkOpus  
**Estado**: ✅ COMPLETADO

---

## 🎯 PROBLEMA

El **MOVING_LEFT se quedaba "pegado"** (bloqueado en estado ON) mientras MOVING_RIGHT funcionaba correctamente.

### Causa Raíz
- Código **duplicado** con lógica **divergente** entre LEFT y RIGHT
- LEFT tenía un boost de `1.2x` que causaba que `melodyVal` siempre superara el `OFF_THRESHOLD`
- RIGHT tenía diferente cálculo de `isRealMelody`
- Ambos usaban constantes globales que ya no existían (`MOVER_ON_THRESHOLD`, `MOVER_OFF_THRESHOLD`)

---

## 💡 SOLUCIÓN: calculateMoverTarget()

Una **única función matemática pura** que calcula intensidad y estado para AMBOS movers.

### Ubicación
`electron/main.ts` - Líneas ~640-720 (después de las constantes de histéresis)

### Firma
```typescript
interface MoverCalcResult {
  intensity: number;   // 0.0 a 1.0
  newState: boolean;   // true = encendido
}

function calculateMoverTarget(
  preset: { name: string; melodyThreshold: number },
  rawMid: number,
  rawBass: number,
  rawTreble: number,
  moverState: boolean,
  isRealSilence: boolean,
  isAGCTrap: boolean
): MoverCalcResult
```

---

## 🔧 LÓGICA INTERNA

### A. Silencio/AGC Trap
```typescript
if (isRealSilence || isAGCTrap) {
  return { intensity: 0, newState: false };
}
```

### B. Detección de Género Denso
```typescript
const isHighDensity = preset.name.includes('Techno') || 
                      preset.name.includes('Latino') ||
                      preset.name.includes('Pop');
```

### C. Masking (Solo Dubstep/Chill)
```typescript
let bassMasking = 0;
if (!isHighDensity) {
  bassMasking = Math.min(0.2, rawBass * 0.25);
}
```

### D. Señal Melódica (SIN boost 1.2x - causaba bloqueo)
```typescript
const melodySignal = Math.max(rawMid, rawTreble * 0.8);
```

### E. Umbrales Dinámicos
```typescript
const effectiveThreshold = preset.melodyThreshold + bassMasking;
const ON_THRESHOLD = effectiveThreshold + 0.10;  // Cuesta encender
const OFF_THRESHOLD = effectiveThreshold - 0.05; // Cuesta apagar
```

### F. Bass Dominance Gate
```typescript
if (!isHighDensity && rawMid < rawBass * 0.5) {
  return { intensity: 0, newState: false };
}
```

### G. Histéresis Unificada
```typescript
if (!moverState) {
  // APAGADO: Necesita superar ON_THRESHOLD para encender
  if (melodySignal > ON_THRESHOLD) {
    nextState = true;
    target = (melodySignal - effectiveThreshold) / (1 - effectiveThreshold);
  }
} else {
  // ENCENDIDO: Se mantiene hasta bajar de OFF_THRESHOLD
  if (melodySignal > OFF_THRESHOLD) {
    target = (melodySignal - effectiveThreshold) / (1 - effectiveThreshold);
  } else {
    nextState = false;
    target = 0;
  }
}
```

### H. Minimum Beam Integrity
```typescript
if (target > 0 && target < 0.20) target = 0;
if (target >= 0.20) target = Math.max(0.25, target);
```

### I. Clipper Final
```typescript
target = applySoftKneeClipper(target);
```

---

## 📊 ANTES vs DESPUÉS

### ANTES (Código Duplicado)
| Zona | Líneas | Variables | Boost | isRealMelody |
|------|--------|-----------|-------|--------------|
| MOVING_LEFT | ~100 | wasOn, melodyVal, boostedMelody | 1.2x | isHighDensity \|\| rawMid > rawBass*0.8 |
| MOVING_RIGHT | ~100 | wasOnR, melodyValR, boostedMelodyR | 1.2x | rawMid > rawBass*0.8 |

**Problema**: Lógica divergente, difícil de mantener, bugs ocultos.

### DESPUÉS (Función Unificada)
| Zona | Líneas | Llamada | Identidad Preservada |
|------|--------|---------|---------------------|
| MOVING_LEFT | ~30 | `calculateMoverTarget(...)` | Color: SECONDARY |
| MOVING_RIGHT | ~30 | `calculateMoverTarget(...)` | Color: AMBIENT |

**Beneficio**: Una sola fuente de verdad, imposible que diverjan.

---

## 🔗 CAMBIOS ELIMINADOS

Se eliminaron de ambas zonas:
- `isHighDensityGenre` / `isHighDensityGenreR` → Ahora dentro de función
- `bassMasking` → Ahora dentro de función
- `effectiveThreshold` → Ahora dentro de función
- `melodyFloor` / `melodyFloorR` → **ELIMINADO** (causaba boost)
- `boostedMelody` / `boostedMelodyR` → **ELIMINADO** (causaba bloqueo)
- `isRealMelody` / `isRealMelodyR` → Ahora dentro de función
- `melodyVal` / `melodyValR` → Ahora dentro de función
- `MOVER_ON_THRESHOLD` → Ahora dinámico dentro de función
- `MOVER_OFF_THRESHOLD` → Ahora dinámico dentro de función

---

## 📁 ARCHIVOS MODIFICADOS

- `electron/main.ts`:
  - Líneas ~640-720: Nueva función `calculateMoverTarget()`
  - Líneas ~1215-1260: MOVING_LEFT refactorizado (de ~100 a ~30 líneas)
  - Líneas ~1267-1310: MOVING_RIGHT refactorizado (de ~100 a ~30 líneas)

---

## 🎛️ CONSTRAINT CRÍTICO

> **NO TOCAR COLOR NI MOVIMIENTO**

La función `calculateMoverTarget` solo calcula **intensidad y estado**.
- LEFT mantiene `fixtureColor = secondary`
- RIGHT mantiene `fixtureColor = ambient`
- El pan invertido para RIGHT sigue intacto

---

## 🏛️ FILOSOFÍA

> "Código duplicado es bug duplicado. Una función, una verdad."

> "Los movers LEFT y RIGHT son gemelos - misma matemática, diferente personalidad (color)."

---

*Documentación generada por PunkOpus como parte del flujo WAVE 120.2*
