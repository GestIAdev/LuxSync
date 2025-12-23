# 🏛️ WAVE 72: SINGLE SOURCE OF TRUTH
## Refactorización de SeleneLux.ts - Eliminación del Dual Color Engine Syndrome

---

## 📋 RESUMEN EJECUTIVO

**Problema:** El "Dual Color Engine Syndrome" identificado en WAVE 71 causaba flickering y violación de Vibe Constraints porque `SeleneLux.ts` tenía un `SeleneColorInterpolator` local que recalculaba colores en paralelo al Worker, sobrescribiendo `lastColors` caóticamente.

**Solución:** Implementar Single Source of Truth (SSOT) donde el Worker es la única fuente de verdad para colores en modo Selene.

---

## ✅ CAMBIOS IMPLEMENTADOS

### 1. 🔍 Nuevo Helper: `isWorkerActive()`
```typescript
// Líneas 190-195 - Detecta si el Worker está enviando datos activamente
private isWorkerActive(): boolean {
  if (!this.lastTrinityData?.timestamp) return false;
  const age = Date.now() - this.lastTrinityData.timestamp;
  return age < 2000; // 2 segundos de gracia
}
```

### 2. 🎭 Nuevo Helper: `getSafeFallbackForVibe()`
```typescript
// Líneas 198-211 - Fallback emocional consciente del Vibe activo
private getSafeFallbackForVibe(vibeId: string): 'BRIGHT' | 'DARK' | 'NEUTRAL' {
  const id = vibeId.toLowerCase();
  // Vibes latinos/festivos → BRIGHT (prohibe DARK)
  if (id.includes('latin') || id.includes('fiesta') || id.includes('pop')...) {
    return 'BRIGHT';
  }
  // Vibes electrónicos oscuros → NEUTRAL (permite DARK pero no fuerza)
  if (id.includes('techno') || id.includes('minimal')...) {
    return 'NEUTRAL';
  }
  return 'NEUTRAL';
}
```

### 3. 🛑 Guard en `processAudioFrame()` - Líneas 843-866
**Antes:**
```typescript
// Siempre recalculaba con colorInterpolator.update()
if (hasTrinityContext) {
  const proceduralPalette = this.colorInterpolator.update(...)  // 🔥 CONFLICTO
  this.lastColors = ...  // Sobrescribía datos del Worker
}
```

**Después:**
```typescript
const workerIsActive = this.isWorkerActive()
const isSeleneMode = this.mode === 'selene' || this.mode === 'locked'

if (workerIsActive && isSeleneMode) {
  // 🏛️ WAVE 72: Worker activo → NO interferir
  // lastColors ya fue actualizado por updateFromTrinity()
  // Solo construimos finalPalette para metadata (no sobrescribimos lastColors)
  finalPalette = {
    ...rgbToHsl(this.lastColors...),
    strategy: 'worker_passthrough' as const,
    description: 'Worker-driven (SSOT)',
  }
} else if (this.mode === 'flow' || !workerIsActive) {
  // Modo FLOW o Worker inactivo → Usar motor local
  // ...lógica original preservada...
}
```

### 4. 🎭 Fallback Emocional Corregido - Línea 1729
**Antes:**
```typescript
stableEmotion: (trinityData?.mood?.stableEmotion ?? 'NEUTRAL')  // ❌ Peligroso
```

**Después:**
```typescript
stableEmotion: (trinityData?.mood?.stableEmotion ?? 
                this.getSafeFallbackForVibe(trinityData?.activeVibe ?? 'idle'))  // ✅ Seguro
```

### 5. 📝 Documentación de `updateFromTrinity()`
Actualizado JSDoc para indicar que este método es el ÚNICO escritor autorizado de `lastColors` en modo Selene.

---

## 🔄 FLUJO DE DATOS POST-WAVE 72

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WORKER (mind.ts)                                │
│  SeleneColorInterpolator.update() → palette RGB → LightingDecision          │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        │ postMessage('LIGHTING_DECISION')
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             main.ts (Bridge)                                 │
│  selene.updateFromTrinity(decision.debugInfo, decision.palette)             │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SeleneLux.ts (Main)                                │
│                                                                              │
│  updateFromTrinity():                                                        │
│    └─▶ workerColorState.interpolate(palette)                                │
│    └─▶ this.lastColors = interpolated  ← ÚNICO ESCRITOR (modo Selene)       │
│                                                                              │
│  processAudioFrame():                                                        │
│    └─▶ if (workerIsActive && isSeleneMode) {                                │
│          // 🏛️ NO TOCAR lastColors - Worker tiene control                   │
│        } else {                                                              │
│          // Modo Flow - usar motor local                                     │
│        }                                                                     │
│                                                                              │
│  getBroadcast():                                                             │
│    └─▶ stableEmotion = data ?? getSafeFallbackForVibe(vibe)                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 MATRIZ DE IMPACTO

| Componente | Cambio | Riesgo | Validación |
|------------|--------|--------|------------|
| `processAudioFrame()` | Guard SSOT | Bajo | Worker activo → skip local |
| `updateFromTrinity()` | Documentación | Ninguno | Ya era SSOT desde 69.5 |
| `getBroadcast()` | Fallback inteligente | Bajo | Vibes latinos → BRIGHT |
| Modo Flow | Sin cambios | Ninguno | Preservado 100% |

---

## 🧪 CÓMO VALIDAR

### Log de Confirmación
Cada 5 segundos verás en consola:
```
[SeleneLux] 🏛️ WAVE 72: Worker SSOT active - skipping local recalc
```

### Test Manual
1. Activar Vibe "Fiesta Latina"
2. Reproducir música con sección DARK detectada
3. **Esperado:** Colores permanecen BRIGHT/warm (no DARK)
4. **Antes WAVE 72:** Podía aparecer cian/azul (DARK)

### Test de Flickering
1. En modo Selene con Worker activo
2. Observar Chromatic Core por 30 segundos
3. **Esperado:** Transiciones suaves, sin parpadeos
4. **Antes WAVE 72:** Flickering frecuente por dual engine

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Líneas | Tipo de Cambio |
|---------|--------|----------------|
| `electron-app/src/main/selene-lux-core/SeleneLux.ts` | 190-211 | ➕ Nuevos helpers |
| `electron-app/src/main/selene-lux-core/SeleneLux.ts` | 843-935 | 🔧 Guard SSOT |
| `electron-app/src/main/selene-lux-core/SeleneLux.ts` | 1408-1425 | 📝 Documentación |
| `electron-app/src/main/selene-lux-core/SeleneLux.ts` | 1729-1731 | 🔧 Fallback emocional |

---

## 🎯 RESULTADO ESPERADO

- ✅ **Modo Selene:** Cero flickering. Color suave (interpolado por Worker). Moods consistentes con Vibe.
- ✅ **Modo Flow:** Funciona igual que siempre (usando motor local).
- ✅ **Fallback:** NEUTRAL ya no permite DARK en vibes latinos.

---

**Generado por:** GitHub Copilot  
**Fecha:** WAVE 72  
**Prerequisito:** WAVE 71 (THE BROKEN BLUEPRINT - auditoría forense)
