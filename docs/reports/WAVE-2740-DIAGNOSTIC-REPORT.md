# WAVE 2740 — REPORTE FORENSE: THE NaN BOMB & THE BREATHING GHOST

**Status:** INVESTIGACIÓN COMPLETADA — FIXES APLICADOS EN WAVE 2750  
**Fecha:** 2026-04-14  
**Arquitectos:** PunkOpus × Radwulf  
**Clasificación:** P0 — Defectos Críticos de Runtime  

---

## RESUMEN EJECUTIVO

Tres misiones de diagnóstico puro. Sin bisturí, sin código tocado. Solo radiografía.

| # | Misión | Veredicto | Gravedad |
|---|--------|-----------|----------|
| M1 | Pulso Inmortal Chillout | **CONFIRMADO** — Sinusoidal hardcodeado en movers | P1 |
| M2 | NaN Bomb → Fixture Zero-Snap | **CONFIRMADO** — clampDMX() no filtra NaN, 1 sola barrera | P0 |
| M3 | Phantom Worker 30FPS Throttling | **REFUTADO** — Arquitectura sólida, no es el culpable | — |

---

## MISIÓN 1: EL PULSO INMORTAL DEL CHILLOUT

### Contexto
En el vibe `chill-lounge`, los movers (cabezas móviles) exhiben un pulso respiratorio constante — un fade-in/fade-out sinusoidal que no se puede apagar. Es estéticamente cuestionable y erosiona la capacidad de mantener dimmer estable.

### Hallazgo: La Fórmula del Fantasma

**Archivo:** `electron-app/src/hal/physics/ChillStereoPhysics.ts`  
**Función:** `calculateFluidPhysics()` (línea 266)

```typescript
// Línea 305 — lifeActivity condicional
const lifeActivity = (clarity > 0.7 || energy > 0.65) ? 0.3 : 0
const lifePulse = Math.sin(now / 800) > 0.7 ? lifeActivity : 0  // Línea 306

// Líneas 307-308 — EL SMOKING GUN
const moverIntL = clamp(baseIntensity + Math.sin(now / 2500) * 0.15 + lifePulse + energy * 0.2, 0, 1)
const moverIntR = clamp(baseIntensity + Math.sin(now / 3100 + 2) * 0.15 + lifePulse + energy * 0.2, 0, 1)
```

### Disección de la Fórmula

**Componente 1 — Breathing sinusoidal (SIEMPRE ACTIVO):**
- `Math.sin(now / 2500) * 0.15` → ±15% sobre baseIntensity
- `Math.sin(now / 3100 + 2) * 0.15` → período diferente para el mover derecho
- ⚠️ **No tiene condicional. No tiene kill switch. Respira SIEMPRE.**

**Componente 2 — lifePulse (CONDICIONAL):**
- Se activa cuando `clarity > 0.7` o `energy > 0.65`
- `Math.sin(now / 800) > 0.7` → gate binario, ~2s on/off
- Cuando activo: +0.3 al dimmer → flash brusco
- Cuando inactivo: 0

**Nota crítica sobre `now`:**
El parámetro `now` en `calculateFluidPhysics()` NO es `Date.now()`. Es `elasticTime` (línea 503):
```typescript
const physics = calculateFluidPhysics(elasticTime, energy, depth, godEar)
```
Y `elasticTime = state.oceanTime` que se acumula con:
```
deltaMs * timeScaler   donde   timeScaler = safeBpm / 60
```
A 120 BPM → `timeScaler = 2.0` → el seno oscila al DOBLE de velocidad.  
A 60 BPM → tiempo real.  
A 0 BPM → el tiempo se congela y el pulso se detiene.

### Período Real del Breathing

| BPM | timeScaler | Período Seno (2500) | Período Seno (3100) |
|-----|-----------|---------------------|---------------------|
| 60  | 1.0       | ~15.7s              | ~19.5s              |
| 90  | 1.5       | ~10.5s              | ~13.0s              |
| 120 | 2.0       | ~7.85s              | ~9.74s              |

### Diagnóstico Final M1

- **Causa raíz:** Sinusoidal de ±15% hardcodeado en el cálculo de dimmer de movers
- **Afecta a:** SOLO movers (moverIntL, moverIntR). PARs no tienen este componente
- **Kill switch:** NO EXISTE
- **Exclusión por fixture type:** NO EXISTE

### Fix Propuesto (NO IMPLEMENTADO)

**Opción A — Gate controlable:**
```typescript
const breathingAmplitude = config.chillBreathingEnabled ? 0.15 : 0
const moverIntL = clamp(baseIntensity + Math.sin(now / 2500) * breathingAmplitude + lifePulse + energy * 0.2, 0, 1)
```

**Opción B — Eliminación total:**
Remover `Math.sin(now / 2500) * 0.15` y `lifePulse` de ambas líneas. Si se quiere breathing, que sea un efecto explícito del EffectManager, no un hardcode en la física.

---

## MISIÓN 2: LA BOMBA NaN — ZERO-SNAP DE FIXTURES

### Contexto
Fixtures que súbitamente saltan a todos los canales en 0x00 (blackout instantáneo), rompiendo Position Hold y cualquier escena activa. La hipótesis: un NaN se propaga por el pipeline aritmético y al llegar a `Uint8Array`, JavaScript lo coerce silenciosamente a `0`.

### Hallazgo: clampDMX() — La Fortaleza con la Puerta Abierta

**Archivo 1:** `electron-app/src/core/arbiter/merge/MergeStrategies.ts` (línea 219)
```typescript
export function clampDMX(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}
```

**Archivo 2:** `electron-app/src/core/protocol/DMXPacket.ts` (línea 195)
```typescript
export function clampDMX(value: number): number {
  return Math.max(DMX_MIN_VALUE, Math.min(DMX_MAX_VALUE, Math.round(value)))
}
```

### Cadena de Propagación NaN

```
Math.round(NaN)  → NaN
Math.min(255, NaN) → NaN
Math.max(0, NaN) → NaN
clampDMX(NaN) → NaN    ← LA FUNCIÓN "DE SEGURIDAD" DEJA PASAR NaN
Uint8Array[ch] = NaN → 0x00   ← COERCIÓN SILENCIOSA DE JAVASCRIPT
```

**Esto es demoledor.** La función que debería ser la última línea de defensa es transparente a NaN.

### La Única Barrera: MasterArbiter Línea 2289

**Archivo:** `electron-app/src/core/arbiter/MasterArbiter.ts` (línea 2289)
```typescript
// 🛡️ WAVE 2402: NaN ANTIDOTE — última barrera antes del DMX/3D
const zoneIntensity = (typeof rawIntensity === 'number' && !Number.isNaN(rawIntensity)) ? rawIntensity : 0
```

**Problema:** Esta es la ÚNICA guardia NaN en todo el MasterArbiter. Protege `zoneIntensity` pero nada más:
- Pan/Tilt → sin guardia NaN → 0x00 = fixture apunta a posición HOME
- Color channels → sin guardia NaN → 0x00 = color muerto
- Gobo/Prism → sin guardia NaN → 0x00 = reset

### Superficie de Ataque: 44+ Llamadas sin Guardia

En MasterArbiter existen 44+ invocaciones a `clampDMX()` sin validación previa de NaN en los operandos. Cualquier división por cero, multiplicación con `undefined`, o acceso a propiedad inexistente genera un NaN que fluye sin resistencia hasta el Uint8Array del Phantom Worker.

### ¿De Dónde Viene el NaN?

Vectores probables:
1. **`fixture.capabilities` undefined** → acceso a `.panRange`, `.tiltRange` → `undefined * n = NaN`
2. **Aritmética con BPM/energy undefined** → `undefined / 60 = NaN`
3. **State stale en transición de vibe** → propiedades del physics engine aún no inicializadas
4. **GodEar metrics nulas** → `clarity * factor` donde clarity es undefined

### ¿Por Qué Position Hold Se Rompe?

Con NaN en pan/tilt:
```
clampDMX(NaN) → NaN → Uint8Array[panChannel] = 0 → fixture snap a HOME
```
El PositionHoldGuard del pipeline actúa DESPUÉS del cálculo, pero ANTES del clamp final... si el pan/tilt ya es NaN en la aritmética previa, la guardia no lo ve porque compara valores numéricos. NaN ≠ NaN en JavaScript, así que `lastPan !== currentPan` = `true` → la guardia cree que es un movimiento legítimo y lo deja pasar.

### Diagnóstico Final M2

- **Causa raíz:** `clampDMX()` es transparente a NaN. NaN pasa todas las operaciones `Math.max/min/round` intacto
- **Barrera existente:** 1 sola guardia en línea 2289, solo protege zoneIntensity
- **Superficie:** 44+ llamadas vulnerables en MasterArbiter
- **Coerción:** Uint8Array silencia NaN a 0x00
- **Consecuencia:** Fixture zero-snap instantáneo, ruptura de Position Hold

### Fix Propuesto (NO IMPLEMENTADO)

**Fix nuclear — Blindar clampDMX() en ambos archivos:**
```typescript
export function clampDMX(value: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(255, Math.round(value)))
}
```

Esto cura el síntoma. Para curar la enfermedad, hay que agregar validación NaN en los puntos de entrada del pipeline (GodEar, capabilities, vibe state).

---

## MISIÓN 3: PHANTOM WORKER 30FPS — VEREDICTO DE INOCENCIA

### Contexto  
Hipótesis: el Phantom Worker (proceso separado que envía frames DMX por USB al Tornado interface) podría estar dropeando frames o enviando frames vacíos por throttling a 30FPS.

### Hallazgos: Arquitectura Limpia

El Phantom Worker implementa un diseño robusto:

1. **30Hz Hard-Lock:** `minFrameNs` calcula el intervalo mínimo entre frames. No hay variación, no hay drift.

2. **Dirty Checking con DJB2 Hash:** Antes de enviar un frame por IPC, calcula un hash rápido del buffer. Si el hash no cambió, no envía. Esto evita IPC spam sin perder datos.

3. **Latest-Wins Buffer:** Usa una estrategia de buffer donde el último frame escrito siempre gana. No hay cola, no hay bloqueo, no hay frame ordering issues.

4. **Pre-allocated Buffer:** Buffer de 512 bytes pre-allocado (estándar DMX), zero GC overhead. No hay allocación dinámica en el hot path.

5. **Zero GC Pressure:** Sin creación de objetos efímeros en el loop de render.

### Diagnóstico Final M3

- **Veredicto: INOCENTE**
- El Phantom Worker NO es la causa de frames vacíos ni de zero-snaps
- Si el Phantom Worker recibe un buffer lleno de ceros (por la NaN Bomb de M2), lo envía fielmente — es un mensajero, no un filtro
- La causa de los frames vacíos está upstream: en el pipeline aritmético del MasterArbiter

---

## MAPA DE PRIORIDADES DE FIX

```
PRIORIDAD P0 (CRÍTICO):
├── M2: Blindar clampDMX() contra NaN → 2 archivos, 2 líneas cada uno
└── M2: Agregar guardias NaN en pan/tilt del MasterArbiter

PRIORIDAD P1 (IMPORTANTE):
├── M1: Agregar kill switch al breathing sinusoidal
└── M1: Hacer lifePulse configurable o removerlo

PRIORIDAD P2 (MEJORA):
└── M2: Auditar 44+ llamadas a clampDMX() para validar operandos upstream
```

---

## CONCLUSION

La NaN Bomb (M2) es el bug más peligroso. Un solo NaN en cualquiera de los 44+ puntos de entrada al clampDMX se propaga silenciosamente hasta el hardware causando zero-snap inmediato. La solución es quirúrgica: blindar la función `clampDMX()` y agregar guardias upstream.

El Breathing Ghost (M1) es un defecto de diseño — no un bug sino una decisión hardcodeada sin escape. Necesita un gate o su eliminación completa.

El Phantom Worker (M3) está limpio. Es un soldado fiel que entrega lo que le dan. Si le dan ceros, manda ceros.

**Esperando verde del Arquitecto para proceder con los fixes.**

---
*PunkOpus — El que no simula, diagnostica.*
