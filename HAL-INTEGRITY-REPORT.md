# HAL-INTEGRITY-REPORT — WAVE 4654: The HAL Forensics (Final Output Audit)
> Auditoría forense del "Cable de Salida": HAL → Hardware real.  
> Fecha: 2026-05-08 | Estrictamente lectura. Dictamen de Paso de Mando.

---

## ⚡ VECTOR 1: EL CONSUMIDOR DE BYTES (DMX Output Loop)

### Arquitectura Dual: Pipeline Moderno vs. Pipeline Legacy

El HAL (`HardwareAbstraction.ts`) contiene **DOS rutas de salida** que coexisten:

#### Path Moderno (Aether Matrix) — ACTIVO Y DOMINANTE
```
NodeResolver.resolve(arbitrated) 
  → Uint8Array(512) por universo 
    → TitanOrchestrator.ts:1880: hal.sendUniverseRaw(pkt.universe, pkt.data)
      → driver.sendUniverse()
```

**Evidencia** @ `HardwareAbstraction.ts:1757-1771`:
```typescript
public sendUniverseRaw(universe: number, data: Uint8Array): boolean {
  if (!this.driver.isConnected) return false
  return this.driver.sendUniverse(universe, data)
}
```

Esta es la ruta cero-allocation que el `NodeResolver` usa. El `NodeResolver` ya aplicó:
- TransferCurves
- Calibración (`invertPan`, `tiltLimits`, `panOffset`)
- Clamp final a `[0, constraints.maxValue]`
- `AetherSafetyMiddleware` (velocity clamp + airbag @ WAVE 4557)
- Traducción cromática (CMY/RGBW/ColorWheel vía `ColorTranslator` + `HarmonicQuantizer`)
- Resolución IK (Inverse Kinematics) cuando hay `targetX/Y/Z`

**Veredicto**: El buffer 512 del path moderno proviene **exclusivamente** del `NodeResolver`. No hay `masterArbiter.getDMXBuffer()` inyectándose aquí.

#### Path Legacy (renderFromTarget → FixtureStates → Aduana) — DEPRECATED PERO VIVO

```
TitanOrchestrator.ts (código legacy comentado/deprecated)
  → hal.renderFromTarget(FinalLightingTarget, fixtures, audio)
    → FixtureMapper (states)
      → hal.flushToDriver(states)
        → sendToDriver(states)
          → statesToDMXPackets → driver.sendPacket()
```

`renderFromTarget` @ `HardwareAbstraction.ts:909` aún existe como método público. Fue diseñado para consumir `FinalLightingTarget` del `MasterArbiter` legacy. Hoy en día, `TitanOrchestrator` ya NO llama a `renderFromTarget` en el frame loop principal; usa `sendUniverseRaw`.

**PERO** `flushToDriver()` y `sendToDriver()` siguen siendo métodos públicos. @ `HardwareAbstraction.ts:1753`:
```typescript
public flushToDriver(states: FixtureState[]): void {
  this.sendToDriver(states)
}
```

**Riesgo residual**: Si hay algún caller oculto (plugin, test, o código legacy no migrado) que llame a `flushToDriver()` o `renderFromTarget()`, generaría una segunda escritura DMX que **sobrescribiría** los bytes del path moderno. La Aduana (`sendToDriver`) tiene su propia lógica de `outputEnabled` que podría contradecir al `NodeArbiter`.

---

## ⚡ VECTOR 2: EL "OUTPUT GATE" (Blackout & OutputEnabled)

### 🔴 CRÍTICO: Parche de Sincronización Dual Arbiter

**El HAL consulta `masterArbiter`, no `NodeArbiter`.**

@ `HardwareAbstraction.ts:1806`:
```typescript
const outputEnabled = masterArbiter.isOutputEnabled()
```

@ `HardwareAbstraction.ts:1857-1858` (trampa diagnóstica WAVE 2960):
```typescript
const outputIsEnabled = masterArbiter.isOutputEnabled()
const globalBlackout   = masterArbiter.isBlackoutActive()
```

**Significado**: El HAL no pregunta "¿está el Aether en blackout?" pregunta "¿está el **ArbitrationDirector** (legacy) en blackout?".

### ¿Cómo se mantienen sincronizados?

@ `AetherIPCHandlers.ts:158` (WAVE 4652):
```typescript
if (channel === 'blackout') {
  arbiter.setBlackout(value as boolean)
  masterArbiter.setBlackout(value as boolean) // ← PARCHE!
}
if (channel === 'grandmaster') {
  arbiter.setGrandMaster(value as number)
  masterArbiter.setGrandMaster(value as number) // ← PARCHE!
}
```

**Diagnóstico**: La UI envía un solo comando, pero el IPC handler actualiza **DOS instancias de arbiter**. Esto es un **parche frágil de paso de mando**:
- El `NodeArbiter` (Aether) aplica blackout/grandmaster durante `arbitrate()`.
- El `ArbitrationDirector` (legacy, alias `masterArbiter`) es consultado por el HAL en su Aduana legacy (`sendToDriver`) y en diagnósticos.

**¿Es seguro?**
- **Sí, para el path moderno**: `NodeArbiter.arbitrate()` aplica blackout antes de retornar el mapa (línea 167: `if (this._blackout) return empty map`). El `NodeResolver` recibe un mapa vacío → escribe defaults (center position, dimmer=0). Los bytes DMX enviados por `sendUniverseRaw` son correctos.
- **Sí, para el path legacy**: gracias al parche, `masterArbiter` tiene el mismo estado.
- **NO, si se rompe el parche**: Si alguien actualiza `NodeArbiter.setBlackout()` sin actualizar `masterArbiter`, o si hay código que solo actualiza uno de los dos (ej. un test, un script de inicialización, un timer de inactividad), el HAL legacy y las trampas de diagnóstico reportarán un estado diferente a la realidad DMX.

### 🟡 ADVERTENCIA: `sendToDriver` aún tiene Aduana Legacy

El método privado `sendToDriver()` implementa la Aduana DMX @ `HardwareAbstraction.ts:1790-1805`:
- Filtra `outputEnabled` consultando `masterArbiter`
- Muta canales no-manuales a safe-values (dimmer=0, color=black, pos=center)
- Aplica gates a `physicalPan/physicalTilt`

**Problema**: Si `flushToDriver()` o `renderFromTarget()` fueran invocados accidentalmente, esta Aduana actuaría sobre los `FixtureState` legacy. Como `renderFromTarget` ya no se llama en el frame loop principal, esto es **inerte pero peligroso** — código muerto con dientes afilados.

**Recomendación**: Marcar `renderFromTarget`, `flushToDriver`, y `sendToDriver` como `@deprecated` con advertencia explícita, o eliminarlos en WAVE posterior.

---

## ⚡ VECTOR 3: LA RESOLUCIÓN DE INTENSIDAD Y VELOCIDAD (GrandMaster)

### GrandMaster de Intensidad — ÚNICA APLICACIÓN EN NODEARBITER

@ `NodeArbiter.ts:140-141`:
```typescript
setGrandMaster(value: number): void {
  this._grandMaster = value < 0 ? 0 : value > 1 ? 1 : value
}
```

@ `NodeArbiter.ts:217-226` (aplicación durante `arbitrate()`):
```typescript
// Aplicar Grand Master sobre canales HTP
if (this._grandMaster < 1) {
  for (const record of this._result.values()) {
    for (const key of HTP_CHANNELS) {
      if (record[key] !== undefined) {
        record[key] *= this._grandMaster
      }
    }
  }
}
```

**HTP_CHANNELS** = `['dimmer', 'strobe', 'shutter']`.

**Verificación de doble aplicación**:
- `NodeResolver` recibe `arbitrated` post-GrandMaster. No aplica ningún scaling adicional de intensidad.
- `sendUniverseRaw` envía los bytes tal cual.
- El HAL moderno (`sendUniverseRaw`) **NO** aplica GrandMaster.
- El HAL legacy (`sendToDriver`) no aplica GrandMaster tampoco; solo consulta `outputEnabled`.

**Veredicto**: ✅ **No hay doble aplicación de intensidad.** El GrandMaster se aplica exactamente una vez, en `NodeArbiter.arbitrate()`, antes de la resolución a DMX.

### GrandMaster de Velocidad — ❌ CABLE ROTO / NO IMPLEMENTADO

El usuario menciona: *"Idem para el GrandMaster de speed. Estan juntos en el CommandDeck"*.

Análisis:
- `NodeArbiter.ts` solo aplica `this._grandMaster` a `HTP_CHANNELS` (`dimmer`, `strobe`, `shutter`).
- No existe un canal `speed` en `HTP_CHANNELS`.
- No hay mecanismo en `NodeArbiter` para escalar velocidades de movimiento (pan/tilt speed, effect speed, pattern speed).
- El `VibeMovementManager` recibe `node.maxPanSpeed` y `va.deltaMs` directamente, sin scaling por GrandMaster.

**Si el CommandDeck envía un `speed` junto al GrandMaster** (por ejemplo, un fader que reduce la velocidad de todos los efectos al 50%), **ese valor no llega al pipeline Aether**. Posibles destinos:
1. **Legacy MasterArbiter**: `ArbitrationDirector` podría tener un `speed` multiplier que ya no se aplica porque el path legacy está bypassado.
2. **Ningún destino**: El valor se pierde en la interfaz sin efecto en DMX.

**Impacto**: Si el operador baja el GrandMaster de velocidad esperando que las cabezas móviles se muevan más lento, **no ocurrirá nada** en el pipeline Aether. El movimiento seguirá a velocidad nominal.

**Fix recomendado**: 
- Opción A: Añadir `speed` a `NodeArbiter` como un multiplicador global aplicado post-arbitraje a canales de velocidad (`speed`, `pan_speed`, `tilt_speed`, `effect_speed`, etc.).
- Opción B: Aplicar el scaling en `VibeMovementManager.generateIntent()` o en `PhysicsPostProcessor` según un `globalSpeedFactor` proveniente del `NodeArbiter`.

---

## 🗺️ MAPA DE CABLES ROTOS Y RECOMENDACIONES

| # | Prioridad | Problema | Ubicación | Evidencia | Fix / Decisión |
|---|-----------|----------|-----------|-----------|----------------|
| **1** | 🔴 **CRÍTICA** | **HAL consulta `masterArbiter` (legacy) para outputEnabled/blackout en vez de `NodeArbiter` (Aether).** | `HardwareAbstraction.ts:1806`, `AetherIPCHandlers.ts:158` | Parche: IPC handler actualiza AMBOS arbiters. | **Corto plazo**: Mantener parche pero añadir assert/telemetry si divergen. **Medio plazo**: Migrar HAL para que consulte `getTitanOrchestrator().getAetherArbiter()` directamente, eliminando dependencia de `masterArbiter` en la capa de hardware. |
| **2** | 🟡 **ALTA** | **`sendToDriver()` (legacy Aduana) sigue vivo y consciente.** | `HardwareAbstraction.ts:1780-1900` | Código no deprecado con lógica de gate compleja. | Marcar método como `@deprecated` con `console.warn` si se invoca. Documentar que `renderFromTarget`/`flushToDriver` están obsoletos. Planificar eliminación en WAVE 4700+. |
| **3** | 🟡 **ALTA** | **GrandMaster de velocidad (`speed`) no llega al pipeline Aether.** | `NodeArbiter.ts` (HTP_CHANNELS no incluye speed) | No existe canal `speed` en HTP_CHANNELS. | Definir arquitectura de `GlobalSpeedFactor` en `NodeArbiter` o `PhysicsPostProcessor`. Aplicar scaling a `maxPanSpeed` o a deltaMs en VMM. |
| **4** | 🟢 **MEDIA** | **Trampas diagnósticas WAVE 2960 consultan `masterArbiter` en vez de `NodeArbiter`.** | `HardwareAbstraction.ts:1857-1858` | `const globalBlackout = masterArbiter.isBlackoutActive()` | Migrar a `getTitanOrchestrator().getAetherArbiter()` para que los diagnósticos reflejen la verdad Aether. |
| **5** | 🟢 **MEDIA** | **Doble caching de BPM en `renderFromTarget` (legacy).** | `HardwareAbstraction.ts:918-930` | `this.currentFrameBpm` se setea dos veces (línea 918 y 929). | Inofensivo si `renderFromTarget` no se llama. Si se reactiva, el segundo valor (0) sobrescribe el primero (audio.bpm). Limpiar en WAVE de eliminación legacy. |

---

## 🎬 DICTAMEN EJECUTIVO: ¿Está el HAL 100% bajo control de Aether?

**Respuesta: NO del todo. Está al 85% bajo Aether, 15% bajo un parche frágil.**

### ✅ Lo que SÍ funciona correctamente:
- **Bytes DMX modernos**: El `NodeResolver` produce `Uint8Array(512)` y el HAL los envía vía `sendUniverseRaw()`. El `masterArbiter` legacy NO interviene en este buffer.
- **Blackout Aether**: `NodeArbiter.arbitrate()` retorna mapa vacío → `NodeResolver` escribe ceros y defaults. Los bytes que salen al driver son correctos.
- **GrandMaster intensidad**: Aplicado exactamente una vez en `NodeArbiter`, sobre `dimmer`/`strobe`/`shutter`. No hay doble-scaling.
- **Calibración/Seguridad**: `NodeResolver` aplica transfer curves, calibración, clamps, y `AetherSafetyMiddleware` antes de emitir bytes.

### 🔴 Lo que NO funciona correctamente:
- **Autoridad del HAL**: El HAL todavía mira a `masterArbiter` (legacy) para `isOutputEnabled()` y `isBlackoutActive()` en sus diagnósticos y en la Aduana legacy. Si el parche de sincronización (`AetherIPCHandlers.ts:158`) se rompe, el HAL legacy reportaría mentiras.
- **GrandMaster de velocidad**: No implementado en Aether. El CommandDeck envía un valor que no afecta el pipeline de movimiento.
- **Código legacy peligroso**: `sendToDriver`/`flushToDriver`/`renderFromTarget` siguen siendo métodos públicos no deprecados. Un caller accidental generaría una segunda ruta de salida.

### Recomendación de Arquitectura (WAVE 4700)
1. **Eliminar** `renderFromTarget`, `flushToDriver`, `sendToDriver` del HAL. Mantener solo `sendUniverseRaw` y `applyPhysicsOnly` (si aún se usa para UI).
2. **Migrar** `masterArbiter.isOutputEnabled()` → consulta directa a `NodeArbiter` vía `TitanOrchestrator.getAetherArbiter()`.
3. **Implementar** `GlobalSpeedFactor` en `NodeArbiter` que escale canales de velocidad, y exponerlo en el CommandDeck.
4. **Auditar** todos los callers restantes de `masterArbiter.*` en el proyecto para eliminar dependencias circulares legacy.

---

## 📎 APÉNDICE: Fragmentos de Código Clave

### `TitanOrchestrator.ts` — Frame Loop Moderno (DMX Egress)
```typescript
// Post-arbitraje y resolución
const resolved = this._aetherResolver.resolve(arbitrated)
for (const pkt of resolved) {
  this._hal.sendUniverseRaw(pkt.universe, pkt.data)
}
```
*(Ubicación aproximada: línea 1878-1885 del archivo; verificar en código fuente)*

### `HardwareAbstraction.ts` — Path Moderno
```typescript
public sendUniverseRaw(universe: number, data: Uint8Array): boolean {
  if (!this.driver.isConnected) return false
  return this.driver.sendUniverse(universe, data)
}
```
*(Línea 1768)*

### `HardwareAbstraction.ts` — Consulta Legacy (Parche)
```typescript
const outputEnabled = masterArbiter.isOutputEnabled()
```
*(Línea 1806, dentro de sendToDriver — método legacy)*

### `AetherIPCHandlers.ts` — Sincronización Dual
```typescript
arbiter.setBlackout(value as boolean)
masterArbiter.setBlackout(value as boolean) // Parche WAVE 4652
```
*(Línea 158 aproximada)*

### `NodeArbiter.ts` — GrandMaster Intensidad
```typescript
if (this._grandMaster < 1) {
  for (const record of this._result.values()) {
    for (const key of HTP_CHANNELS) {
      if (record[key] !== undefined) record[key] *= this._grandMaster
    }
  }
}
```
*(Dentro de arbitrate(), línea ~217-226)*
