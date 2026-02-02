# 🛡️ WAVE 1101: THE PARANOIA PROTOCOL

**Fecha**: 2 de febrero, 2026  
**Directiva**: SEARCH & DESTROY - Resolución inmediata de TODOS los hallazgos  
**Nivel de Tolerancia**: CERO  
**Status**: ✅ **COMPLETADO**

---

## 📊 RESUMEN EJECUTIVO

| Hallazgo | Archivo | Status |
|----------|---------|--------|
| 🔴 DMX Throttling 44→30Hz | `UniversalDMXDriver.ts` | ✅ RESUELTO |
| 🟡 Pan Safety Margin | `FixturePhysicsDriver.ts` | ✅ RESUELTO |
| 🟡 Braking Clamp → SAFETY_CAP | `FixturePhysicsDriver.ts` | ✅ RESUELTO |
| 🟡 Visual Smoothing | `useFixtureRender.ts` | ✅ RESUELTO |

---

## 🔴 CRÍTICO: DMX OUTPUT THROTTLING

### Diagnóstico
Los movers chinos ($50-200) típicamente solo procesan 20-30Hz en su chip DMX interno. A 44Hz sus buffers se saturan → movimientos erráticos, espasmos, comportamiento impredecible.

### Solución Implementada
```typescript
// UniversalDMXDriver.ts - constructor()
// WAVE 1101: PARANOIA PROTOCOL
this.config = {
  refreshRate: config.refreshRate ?? 30, // Era 44, ahora 30
  // ...
}
```

### Impacto
- **30Hz = 33.3ms/frame** → Seguro para todo el hardware
- Movers profesionales ($1000+) funcionan igual de bien
- Movers baratos dejan de "vibrar" en los límites

---

## 🟡 ADVERTENCIA 1: PAN SAFETY MARGIN

### Diagnóstico
El Pan se mapeaba 0-255 directamente, permitiendo que el motor llegara a los topes físicos → golpes mecánicos, ruido, desgaste.

### Solución Implementada
```typescript
// FixturePhysicsDriver.ts - Nueva constante
private readonly PAN_SAFETY_MARGIN = 5 // ~2% del rango

// applySafetyLimits() - Modificado
return {
  pan: Math.max(this.PAN_SAFETY_MARGIN, 
               Math.min(255 - this.PAN_SAFETY_MARGIN, targetDMX.pan)),
  tilt: Math.max(limits.tiltMin, Math.min(limits.tiltMax, targetDMX.tilt)),
}
```

### Impacto
- **Rango efectivo**: 5-250 (era 0-255)
- El motor NUNCA toca los topes físicos
- Adiós a los "rascazos" mecánicos

---

## 🟡 ADVERTENCIA 2: BRAKING CLAMP → SAFETY_CAP

### Diagnóstico
El clamp de frenado usaba `physicsConfig.maxAcceleration` (dinámico por vibe) en lugar del `SAFETY_CAP` absoluto.

### Solución Implementada
```typescript
// FixturePhysicsDriver.ts - FASE DE FRENADO
acceleration = -(vel * vel) / (2 * safeDistance) * direction
// 🛡️ WAVE 1101: PARANOIA CLAMP - Usa SAFETY_CAP absoluto
acceleration = Math.max(-this.SAFETY_CAP.maxAcceleration, 
                       Math.min(this.SAFETY_CAP.maxAcceleration, acceleration))
```

### Impacto
- Sin importar lo que calcule la física, NUNCA excede 2500 DMX/s²
- Red matemática blindada contra singularidades

---

## 🟡 ADVERTENCIA 3: VISUAL SMOOTHING

### Diagnóstico
Cuando el PC perdía un frame (lag de IPC), el Canvas daba un salto visual, causando desconfianza aunque el hardware real se movía suave.

### Solución Implementada
```typescript
// useFixtureRender.ts - Nuevo
const VISUAL_SMOOTH_FACTOR = 0.3

// Hook modificado
const prevVisualRef = useRef<{ pan: number; tilt: number }>({ pan: 0.5, tilt: 0.5 })

// Visual interpolation
const smoothedPan = prevVisualRef.current.pan + 
  (rawRender.physicalPan - prevVisualRef.current.pan) * VISUAL_SMOOTH_FACTOR
const smoothedTilt = prevVisualRef.current.tilt + 
  (rawRender.physicalTilt - prevVisualRef.current.tilt) * VISUAL_SMOOTH_FACTOR

prevVisualRef.current = { pan: smoothedPan, tilt: smoothedTilt }

return { ...rawRender, physicalPan: smoothedPan, physicalTilt: smoothedTilt }
```

### Impacto
- Canvas fluido como el agua
- Paz mental para el DJ
- Hardware NO afectado (puramente cosmético)

---

## 🏁 ARCHIVOS MODIFICADOS

1. **`electron-app/src/hal/drivers/UniversalDMXDriver.ts`**
   - `refreshRate`: 44 → 30 Hz

2. **`electron-app/src/engine/movement/FixturePhysicsDriver.ts`**
   - Nueva constante `PAN_SAFETY_MARGIN = 5`
   - `applySafetyLimits()`: Pan con airbag 5-250
   - Braking clamp: `physicsConfig` → `SAFETY_CAP`

3. **`electron-app/src/hooks/useFixtureRender.ts`**
   - Import `useRef`
   - Nueva constante `VISUAL_SMOOTH_FACTOR = 0.3`
   - Smoothing via `prevVisualRef` + lerp

---

## 🔐 PROTOCOLO ACTIVO

```
╔═══════════════════════════════════════════════════════════════╗
║           PARANOIA PROTOCOL: ACTIVATED                        ║
║                                                               ║
║   • DMX Rate:     30 Hz  (movers seguros)                     ║
║   • Pan Range:    5-250  (airbag horizontal)                  ║
║   • Braking Cap:  2500   (límite absoluto)                    ║
║   • Visual:       Lerp   (paz mental)                         ║
╚═══════════════════════════════════════════════════════════════╝
```

---

**WAVE 1101 - COMPLETADO**  
*"La paranoia es la forma más pura de cuidado."*
