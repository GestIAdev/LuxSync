# 🔬 WAVE 4644 — THE KINETIC AUDIT (Pre-Diagnóstico)

**Auditor:** Kimi (Cascade AI)
**Fecha:** 2026-05-08
**Scope:** Estrictamente lectura forense de VMM → PhysicsPostProcessor → Aduana.
**Objetivo:** Certificar si es seguro bypassar el PhysicsPostProcessor en la ruta clásica (VMM → L0) asumiendo protección estructural de la Aduana HAL.

---

## ⚡ VEREDICTO EJECUTIVO

**NO es seguro bypassar el PhysicsPostProcessor para la ruta VMM clásica.**

La Aduana (`AetherSafetyMiddleware`) protege contra catástrofes mecánicas (delta-jumps extremos >400 DMX/s), pero **NO puede sustituir la función artística y física del PhysicsPostProcessor**. Sin él, los patrones cuantizados (`square`, `botstep`) pierden su identidad geométrica y los saltos instantáneos del VMM se traducen en vibración mecánica real.

**Las constantes de WAVE 4636 ya liberaron el estrangulamiento.** No hay necesidad de bypass.

---

## 🔍 VECTOR 1: EL ORIGEN (VibeMovementManager + KineticAdapter)

**Archivo:** `src/engine/movement/VibeMovementManager.ts` (líneas 626-966)
**Archivo:** `src/core/aether/adapters/KineticAdapter.ts` (líneas 100-212)

### AmplitudeScale — Calibración por Vibe

| Vibe | amplitudeScale | finalAmplitude típico (con gearbox+envelope) |
|---|---|---|
| `techno-club` | **0.70** | ~0.55 – 0.70 |
| `fiesta-latina` | **0.65** | ~0.50 – 0.65 |
| `pop-rock` | **0.45** | ~0.35 – 0.45 |
| `chill-lounge` | **0.12** | ~0.10 – 0.12 |
| `idle` | **0.10** | ~0.08 – 0.10 |

**Observación:** Los valores son conservadores y seguros. Techno con 0.70 sobre 540° = ~378° de barrido efectivo, dentro del rango mecánico de cualquier mover profesional.

### Gearbox — Protección por hardware (`calculateEffectiveAmplitude`, línea 924)

```typescript
const HARDWARE_MAX_SPEED = fixtureMaxSpeed  // per-fixture desde physicsProfile
const maxTravelPerCycle = HARDWARE_MAX_SPEED * secondsPerBeat * patternPeriod
const requestedTravel = 255 * requestedAmplitude
const gearboxFactor = Math.min(1.0, maxTravelPerCycle / requestedTravel)
```

**Hallazgo crítico:** El gearbox limita **recorrido total por ciclo**, NO velocidad instantánea. Si un patrón `square` o `botstep` cambia de -0.84 a +0.84 en un único frame (0 → 429 DMX de delta), el gearbox dice "el recorrido total del ciclo cabe en la capacidad del motor", pero **no impide que ese recorrido ocurra instantáneamente**.

### Salida al bus L0 (KineticAdapter, línea 201-206)

```typescript
this._valuesDict['pan']  = BaseSystem.clamp01((intent.x + 1) * 0.5)  // [-1,+1] → [0,1]
this._valuesDict['tilt'] = BaseSystem.clamp01((intent.y + 1) * 0.5)
this._valuesDict['speed'] = BaseSystem.clamp01(intent.speed)
```

**Veredicto Vector 1:** El VMM emite señales correctamente normalizadas [0,1], pero **no garantiza continuidad temporal frame-a-frame**. Patrones como `square`, `botstep`, y `chase_position` pueden emitir saltos discretos instantáneos. Eso es por diseño artístico, no un bug.

---

## 🔍 VECTOR 2: EL ESTRANGULADOR (PhysicsPostProcessor)

**Archivo:** `src/core/aether/resolver/PhysicsPostProcessor.ts` (líneas 65-435)

### Estado post-WAVE 4636: CONSTANTES YA LIBERADAS

El usuario ya modificó las constantes en WAVE 4636:

```typescript
const SAFETY_MAX_ACCELERATION_NORM = 20.0   // norm/s² (antes: ~0.0065)
const SAFETY_MAX_VELOCITY_NORM     = 5.0    // norm/s   (antes: ~0.0029)
```

**Conversión a DMX real:**
- `5.0 norm/s × 255 = 1275 DMX/s`
- Para un motor de 540°/s: `Math.min(540°/s × 1/540, 5.0) = 1.0 norm/s = 255 DMX/s`
- Para un motor de 250°/s: `0.463 norm/s = 118 DMX/s`
- A 44 Hz (dt ≈ 0.023 s): movimiento máximo por frame = 118 × 0.023 = **~2.7 DMX por frame**

**Impacto:** Con estas constantes, el PhysicsPostProcessor ya NO estrangula. Permite movimientos rápidos pero controlados. El estrangulamiento de WAVE 4635 (0.74 DMX/s) fue eliminado.

### Función física real del PhysicsPostProcessor

No es solo "seguridad". Es **modelado físico de trayectoria**:

```typescript
// _applyClassicAxis (línea 560-611)
// 1. Calcular distancia al target (delta)
// 2. Calcular distancia de frenado: d_brake = v² / (2 * maxAcc)
// 3. Si |delta| > d_brake → acelerar (hasta maxVel)
// 4. Si |delta| <= d_brake → frenar (hasta 0)
// 5. Integrar posición: pos += vel * dt
```

Este algoritmo convierte un target instantáneo (ej. square de 0→1) en una **curva-S físicamente realista**: aceleración suave, velocidad de crucero, deceleración anticipada.

**Veredicto Vector 2:** El PhysicsPostProcessor ya no estrangula (constantes liberadas). Su función actual es **artística y mecánica**: suaviza los saltos del VMM para que los motores físicos no sufran vibración y para que los patrones cuantizados tengan un movimiento "pesado" realista en lugar de teleportación.

---

## 🔍 VECTOR 3: EL PARACAÍDAS (AetherSafetyMiddleware / Aduana)

**Archivo:** `src/core/aether/egress/AetherSafetyMiddleware.ts` (líneas 20-349)

### Arquitectura de protección de la Aduana

La Aduana opera en **Fase 1 (intra-resolve)**, después de que NodeResolver convierte normalizados → DMX:

```typescript
// NodeResolver.ts:492-500
if (this._safetyMiddleware && node.family === NodeFamily.KINETIC) {
  if (PAN_CHANNELS.has(chDef.type) && chDef.type === PAN_COARSE) {
    dmxValue = this._safetyMiddleware.clampKineticSingleAxis(node.nodeId, true, dmxValue)
    dmxValue = this._safetyMiddleware.applyAirbag(dmxValue, true)
  }
  // ... tilt idem
}
```

### `clampKineticSingleAxis` — Rate Limiter por eje (líneas 198-230)

```typescript
// Inicialización: KS_LAST_PAN = 128, KS_LAST_TILT = 128 (centro)
// Límite por frame: maxPerFrame = rev * dtSec
// rev = VIBE_REV_LIMITS[this._vibeId] (techno: 400, chill: 12)
// KINETIC_SAFETY_CAP_VEL = 400 DMX/s
```

**Límites per-vibe a 44Hz:**
| Vibe | Pan limit | Tilt limit | DMX por frame (pan) | DMX por frame (tilt) |
|---|---|---|---|---|
| `techno-club` | 400 | 400 | ~9.1 | ~9.1 |
| `fiesta-latina` | 380 | 280 | ~8.6 | ~6.4 |
| `pop-rock` | 300 | 200 | ~6.8 | ~4.5 |
| `chill-lounge` | 12 | 8 | ~0.27 | ~0.18 |
| `idle` | 120 | 80 | ~2.7 | ~1.8 |

### `applyAirbag` — Límites mecánicos absolutos (líneas 236-241)

```typescript
const PAN_AIRBAG_MARGIN  = 5   // DMX
const TILT_AIRBAG_MARGIN = 5   // DMX
```
Evita que pan/tilt choquen contra los finales de carrera mecánicos (0 o 255).

### `clampKineticVelocity` — Versión par-eje (líneas 157-196)

Usado en la ruta IK. Similar pero opera sobre pan+tilt simultáneamente. No se usa en la ruta clásica actual.

---

## ⚖️ ANÁLISIS COMPARATIVO: PhysicsPostProcessor vs Aduana

| Capacidad | PhysicsPostProcessor | Aduana (`clampKineticSingleAxis`) |
|---|---|---|
| **Dominio** | Normalizado [0,1] | DMX [0,255] |
| **Modelo** | Inercia física (masa, vel, acc) | Rate limiter (delta max por frame) |
| **Estado** | Stateful (velocidad persistente) | Stateful (último DMX por eje) |
| **Suavizado** | Curva-S con aceleración/frenado | Clamp lineal por delta |
| **Patrón square** | Convierte 0→1 en curva-S realista | Limita a ~9 DMX/frame → tarda ~28 frames |
| **Patrón sweep** | Aplica inercia natural al seno | No altera (el sweep ya es suave) |
| **Protección motor** | Medio-alta (respeto de vel/acc) | Media (cap a 400 DMX/s, puede exceder capacidad de motores budget) |
| **Identidad artística** | Preserva forma con peso físico | Destruye forma cuantizada (square→blob) |

**Conclusión clave:** La Aduana es un **paracaídas**, no un **ala**. Frena caídas mortales (>400 DMX/s) pero no puede volar. El PhysicsPostProcessor es el **ala**: da forma aerodinámica a los movimientos.

---

## 🎯 DICTAMEN FINAL: ¿Es seguro bypassar?

### Respuesta: **NEGATIVO.**

Razones:

1. **La Aduana destruye patrones cuantizados.** Un `square` o `botstep` que salta 200 DMX instantáneamente quedaría suavizado linealmente durante ~22 frames (~0.5s). El patrón pierde sus esquinas duras y se convierte en un ovalo indistinto.

2. **La Aduana NO modela física.** Es un rate limiter sin concepto de inercia. Un motor real necesita aceleración y deceleración. Saltos instantáneos (aunque rate-limited a 400 DMX/s) generan vibración mecánica, desgaste de engranajes, y eventual fallo de servo.

3. **La Aduana puede exceder la capacidad de motores budget.** `techno-club` permite 400 DMX/s = ~847°/s. Un motor con `maxPanSpeed = 150°/s` (budget mover) no puede seguir comandos a 847°/s. El PhysicsPostProcessor respeta `node.maxPanSpeed`; la Aduana ignora el hardware individual y usa límites globales por vibe.

4. **El VMM NO garantiza continuidad temporal.** El gearbox protege recorrido total por ciclo, no velocidad instantánea. Sin PhysicsPostProcessor, los saltos frame-a-frame irían crudos a la Aduana.

5. **Las constantes de WAVE 4636 ya resuelven el problema original.** `SAFETY_MAX_VELOCITY_NORM = 5.0` y `SAFETY_MAX_ACCELERATION_NORM = 20.0` eliminan el estrangulamiento de WAVE 4635. No se necesita bypass.

---

## 🔧 RECOMENDACIÓN OPERATIVA

**NO bypassar el PhysicsPostProcessor.**

**Acciones correctas:**
1. **Verificar que las constantes WAVE 4636 estén en producción:** `SAFETY_MAX_VELOCITY_NORM = 5.0`, `SAFETY_MAX_ACCELERATION_NORM = 20.0`.
2. **Ajustar `node.maxPanSpeed` / `node.maxTiltSpeed` en el perfil físico** de cada fixture para reflejar su capacidad real (ej. 250°/s, 500°/s). El PhysicsPostProcessor usa estos valores como `Math.min(node.maxPanSpeed * DEG_PER_SEC_TO_NORM_PER_SEC, SAFETY_MAX_VELOCITY_NORM)`.
3. **Si se desean movimientos más "nítidos" en square/botstep:** Cambiar `this._mode` a `'snap'` en el PhysicsPostProcessor (ya soportado, vía `setPhysicsMode`). Snap aplica interpolación fraccional directa con clamp por REV_LIMIT, sin curva-S completa.
4. **Si se desea bypass parcial para pruebas:** Solo considerar bypass en modo `'snap'`, nunca en modo `'classic'`.

---

## 📋 RESUMEN DE CULPABILIDAD (AUDITORÍA WAVE 4644)

| Componente | Rol en la cadena cinética | Veredicto |
|---|---|---|
| **VMM (VibeMovementManager)** | Genera señales calibradas pero con saltos instantáneos en patrones cuantizados. | ✅ Inocente (por diseño) |
| **KineticAdapter** | Traduce [-1,+1] → [0,1] sin mutar. | ✅ Inocente |
| **PhysicsPostProcessor** | **Modelado físico necesario.** Ya liberado (WAVE 4636). No estrangula más. | ✅ Inocente / **Protegido** |
| **Aduana (AetherSafetyMiddleware)** | Paracaídas anti-catástrofe. NO sustituto de Physics. | ✅ Inocente / **Insuficiente** |
| **NodeResolver** | Escribe DMX. Aplica Aduana en Fase 1. | ✅ Inocente |

**Dictamen final:** Bypassar el PhysicsPostProcessor expone los motores a vibración mecánica y destruye la identidad de patrones cuantizados. La Aduana no compensa. **Mantener PhysicsPostProcessor activo.**
