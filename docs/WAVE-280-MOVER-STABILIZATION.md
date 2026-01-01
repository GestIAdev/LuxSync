# 🔧 WAVE 280: MOVER STABILIZATION

**Fecha**: 2026-01-01
**Estado**: ✅ IMPLEMENTADO
**Archivos Modificados**: 
- `src/hal/physics/PhysicsEngine.ts`
- `src/hal/HardwareAbstraction.ts`

---

## 🔬 DIAGNÓSTICO

### El Problema: Movers Epilépticos

Analizando `electroton.md`, encontré evidencia de comportamiento errático:

```
mid=0.31, treble=0.06 → intensity=0.00, state=true   ← WTF?!
mid=0.24, treble=0.05 → intensity=0.00, state=true   ← INCONSISTENTE
mid=0.20, treble=0.03 → intensity=0.00, state=false  ← Finalmente off
mid=0.43, treble=0.09 → intensity=0.23, state=true   ← Vuelve a prender
```

### El Bug Encontrado

En `calculateMoverTarget()` existía esta lógica defectuosa:

```typescript
// ANTES (BUGGY)
if (audioSignal > ACTIVATION_THRESHOLD) {  // 0.10
  nextState = true
  target = 0.2 + ...
} else {
  // ⚠️ BUG: Si audioSignal > 0.05 pero < 0.10
  // El state era TRUE pero target era 0!!!
  nextState = audioSignal > 0.05  // ← Crea state=true con intensity=0
}
```

**Resultado**: `state=true` con `intensity=0.00` → Incoherencia total.

---

## 🏗️ LA SOLUCIÓN: HYSTERESIS REAL

### 1. Nuevos Buffers de Estado

```typescript
// PhysicsEngine.ts
private moverIntensityBuffer = new Map<string, number>()   // Intensity history
private moverStabilityCounter = new Map<string, number>()  // Frame stability

// Constants
private readonly MOVER_HYSTERESIS_MARGIN = 0.12     // 12% gap on/off
private readonly MOVER_INTENSITY_SMOOTHING = 0.7    // 70% previous, 30% new
private readonly MOVER_MIN_STABLE_FRAMES = 3        // Anti-flicker
```

### 2. Hysteresis Zone

```
Señal de Audio (treble × 1.4):

    1.0  ┌────────────────────────────────────────┐
         │                                        │
         │              ENCENDIDO                 │
         │                                        │
    0.10 ├────────────────────────────────────────┤ ← Activation Threshold
         │                                        │
         │         ZONA DE HISTÉRESIS             │ ← Si ya estaba ON, sigue ON
         │         (decay suave 0.85×)            │
         │                                        │
    0.02 ├────────────────────────────────────────┤ ← Deactivation Threshold
         │                                        │
         │              APAGADO                   │
         │                                        │
    0.0  └────────────────────────────────────────┘
```

### 3. Stability Counter

Para evitar parpadeo, el estado debe ser "estable" por 3 frames antes de cambiar:

```typescript
if (shouldBeOn !== moverState) {
  if (stabilityFrames >= MOVER_MIN_STABLE_FRAMES) {
    finalState = shouldBeOn  // Cambio permitido
  } else {
    stabilityCounter++       // Esperar más
    finalState = moverState  // Mantener estado anterior
  }
}
```

### 4. Intensity Smoothing

No más saltos bruscos:

```typescript
if (rawTarget > prevIntensity) {
  // Attack: 70% respuesta (rápido pero no jarring)
  smoothedIntensity = prevIntensity + (rawTarget - prevIntensity) * 0.7
} else {
  // Decay: Suave (70% anterior + 30% nuevo)
  smoothedIntensity = prevIntensity * 0.7 + rawTarget * 0.3
}
```

### 5. Consistency Fix

```typescript
// SIEMPRE: Si intensity = 0, state DEBE ser false
const consistentState = cleanedIntensity > 0 ? finalState : false
```

---

## 📊 COMPORTAMIENTO ESPERADO

### ANTES (WAVE 277):
```
Treble: 0.12 → 0.08 → 0.06 → 0.12
State:  ON   → ON   → OFF  → ON     ← Parpadeo!
Inten:  0.26 → 0.00 → 0.00 → 0.26   ← Saltos bruscos
```

### DESPUÉS (WAVE 280):
```
Treble: 0.12 → 0.08 → 0.06 → 0.12
State:  ON   → ON   → ON   → ON     ← Estable en hysteresis zone
Inten:  0.26 → 0.22 → 0.19 → 0.26   ← Transiciones suaves
```

---

## 🎯 MÉTRICAS DE HYSTERESIS

| Parámetro | Valor | Justificación |
|-----------|-------|---------------|
| Activation Threshold | 0.10 | 10% treble para encender |
| Deactivation Threshold | 0.02 | 2% treble para apagar (MUCHO más bajo) |
| Hysteresis Margin | 0.12 | 12% de gap entre on/off |
| Smoothing Factor | 0.7 | 70% previous, 30% new |
| Min Stable Frames | 3 | ~50ms @ 60fps antes de cambiar |

---

## 🔗 RELACIÓN CON OTRAS WAVES

- **WAVE 275**: Estableció movers = solo treble
- **WAVE 277**: ZERO FLOOR - instant off (demasiado agresivo)
- **WAVE 279.5**: Heart vs Slap para Back Pars
- **WAVE 280**: Estabiliza movers sin sacrificar respuesta
- **WAVE 281** (FUTURO): Delta Force para transient discrimination

---

## 🧪 CÓMO PROBAR

1. Poner electronica con hi-hats consistentes
2. Observar log `[HAL MOVER]` - debe mostrar transiciones suaves
3. No debería haber `state=true, intensity=0.00`
4. Los movers no deberían parpadear durante treble sostenido

---

## 📝 NOTAS

El arquitecto propuso WAVE 280: DELTA FORCE con transient discrimination.

Yo (PunkOpus) propuse primero estabilizar con histéresis básica.

**Razón**: Antes de añadir complejidad (delta tracking), hay que arreglar el fundamento. Delta Force puede ser WAVE 281 sobre una base estable.

> "No puedes construir un rascacielos sobre arena movediza."

---

**Commit sugerido**: `WAVE 280: Mover Stabilization - Anti-epilepsy hysteresis`
