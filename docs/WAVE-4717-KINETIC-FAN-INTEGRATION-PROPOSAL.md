# WAVE 4717 — KINETIC FAN INTEGRATION PROPOSAL
## `fanValue` ↔ VMM Phase Spread · Full Architectural Analysis & Surgical Plan

**Estado:** PROPUESTA — Pendiente aprobación de Radwulf  
**Autor:** PunkOpus  
**Prerequisito:** OPERACIÓN CLEAN CABIN (WAVE 4716) ✅ ya instalada  
**Prioridad:** P1 — gap funcional visible para el usuario  

---

## 1. EL CRIMEN EN UNA FRASE

Cuando el programador activa un patrón VMM (sweep, wave, circle...) y mueve el fader **Fan**, no pasa NADA. El fader Fan controla el dispersión de fase entre fixtures — debería abrir o cerrar el abanico visual del movimiento — pero la señal muere silenciosamente a mitad del pipeline y **nunca llega al motor L0**.

---

## 2. FORENSE COMPLETO — AUTOPSIA DEL PIPELINE

### 2.1 Los dos mundos que no se hablan

El sistema tiene **dos motores de movimiento en paralelo**:

| Motor | Capa | Archivo | Responsable |
|-------|------|---------|-------------|
| KineticSystem (patterns Aether) | L0 | `systems/KineticSystem.ts` | **ABANDONADO en 4651** |
| KineticAdapter + VibeMovementManager | L0 | `adapters/KineticAdapter.ts` + `VibeMovementManager.ts` | **ACTIVO** |
| KineticsBridge `_flushClassic()` | L2 | `bridges/KineticsBridge.ts` | Fan aplicado aquí pero... |

> ⚠️ **NOTA CRÍTICA:** KineticSystem.ts (el "pattern engine de Aether") fue **reemplazado** por el flujo `KineticAdapter → VibeMovementManager` en WAVE 4651/4661. El robus análisis de la sesión anterior sobre KineticSystem.ts es correcto en sus conclusiones sobre el diseño, pero ese archivo ya **no es la ruta de ejecución activa**. La ruta real es KineticAdapter.

### 2.2 La muerte del fanValue — traza completa

```
UI (ProgrammerPanel)
  └─ fader Fan mueve
      └─ movementStore.setFanValue(v)          ← ✅ escribe fanValue (-100..100)
          └─ KineticsBridge (renderer)
              └─ _flushPattern()               ← ❌ NUNCA lee fanValue
              │   └─ window.lux.aether.setManualPattern({
              │         fixtureIds, pattern, speed, amplitude
              │         // ← fanValue AUSENTE
              │     })
              │       └─ IPC: lux:aether:setManualPattern
              │           └─ AetherIPCHandlers.ts (main process)
              │               └─ vibeMovementManager.setManualPattern(pattern)
              │               └─ vibeMovementManager.setManualSpeed(speed)
              │               └─ vibeMovementManager.setManualAmplitude(amplitude)
              │               // ← setManualFanSpread() NO EXISTE
              │
              └─ _flushClassic()               ← ✅ lee fanValue y aplica L2 offset
                  │   (pero está bloqueada)
                  └─ hasProgrammerKineticManual()
                      └─ returns TRUE cuando activePattern !== 'none'
                      └─ → _flushClassic() exits early  ← ❌ fanValue bloqueda
```

**Resultado:** cuando hay un patrón activo, `fanValue` no llega a ningún lado.

### 2.3 La ausencia del fan en VMM

`VibeMovementManager.generateIntent()` acepta:
```typescript
generateIntent(
  vibeId: string,
  audio: AudioContext,
  fixtureIndex: number,
  totalFixtures: number,
  maxPanSpeed?: number,
  phaseOffset?: number,    // ← L/R counterpoint (π para derecha)
): MovementIntent
```

El `phaseOffset` que recibe hoy en `KineticAdapter.process()` es **binario**: `0` para izquierda, `Math.PI` para derecha. No hay escala continua. No hay `fanSpread`.

El phase spread entre fixtures en VMM existe pero viene **sólo de STEREO_CONFIG** (snake/mirror/sync por vibe automático). Eso da el offset base entre L y R — no es algo que el programador pueda controlar.

### 2.4 ¿Qué hace el simulador 3D?

El simulador 3D (`useFixture3DData.ts`) lee de `transientStore`. El `transientStore` es alimentado por `TitanOrchestrator` vía `injectHotFrame()` con:
```typescript
{
  physicalPan:  (f.physicalPan ?? f.pan) / 255,    // NORMALIZADO 0-1
  physicalTilt: (f.physicalTilt ?? f.tilt) / 255,
}
```

Estos valores vienen de **HAL** (HardwareAbstraction), que aplica física real (momentum, velocity limits) sobre los DMX targets del NodeArbiter. Es decir: **el simulador sí recibe el resultado final correcto del pipeline**, incluyendo el pan/tilt generado por KineticAdapter.

**La conclusión sobre el simulador:** el simulador NO tiene un bug independiente. Si el fanValue no afecta a los movers reales, tampoco afecta al simulador — son el mismo valor. **Root Cause 2 es el mismo Root Cause 1.**

---

## 3. DISEÑO DE LA SOLUCIÓN

### 3.1 Filosofía

> "El fan es un modulador de **phase spread** entre fixtures. En VMM, el phase spread se controla con el `phaseOffset` que recibe `generateIntent()`. Por lo tanto: `fanValue → escala del phaseOffset`."

- `fanValue = 0` → phaseOffset multiplier = 0 → todos los fixtures en fase (Borg mode)  
- `fanValue = 100` → phaseOffset multiplier = 1.0 → spread máximo del sistema STEREO  
- `fanValue = -100` → phaseOffset multiplier = -1.0 → spread inverso (fans en espejo inverso)

No tocamos el sistema STEREO de vibe automático. Sólo **escalamos** el offset que ya existe.

### 3.2 Arquitectura de cambios (mínima incisión quirúrgica)

```
PUNTO A: VibeMovementManager
  + _manualFanSpread: number | null = null
  + setManualFanSpread(v: number | null): void
  + El setter: en `generateIntent()`, si `manualFanSpread !== null`,
    scale el phaseOffset calculado por STEREO_CONFIG

PUNTO B: AetherIPCHandlers.ts
  + leer `fanSpread` del payload de lux:aether:setManualPattern
  + llamar vibeMovementManager.setManualFanSpread(fanSpread)
  + en el reset (pattern=null): setManualFanSpread(null)

PUNTO C: KineticsBridge.ts  
  + _flushPattern(): añadir fanValue al payload IPC
  + el reset de patrón también envía fanValue=0 (reset limpio)

SIN TOCAR: KineticAdapter.ts, BaseSystem.ts, FrameContext
  ← KineticAdapter ya pasa phaseOffset a generateIntent()
  ← La escala ocurre DENTRO de VMM — cero alloc extra, cero cambio de interfaz
```

**Zero-alloc garantizado:** El multiplicador de fan es una operación aritmética de stack dentro de `generateIntent()` que ya corre a 44Hz. No se crea ningún objeto nuevo.

---

## 4. PARCHES QUIRÚRGICOS

### PARCHE A — `VibeMovementManager.ts`

**Localización:** después de `getManualOverrides()`, antes de `hasAnyOverride()`

```typescript
// ─── FAN SPREAD OVERRIDE (WAVE 4717) ─────────────────────────────────────
// fanSpread escala el phase offset entre fixtures en patrones VMM.
// null = auto (STEREO_CONFIG heredado), 0..1 = escala del spread
private _manualFanSpread: number | null = null

setManualFanSpread(spread: number | null): void {
  this._manualFanSpread = spread !== null ? Math.max(-1, Math.min(1, spread)) : null
  console.log(spread !== null
    ? `[CHOREO] Manual FAN SPREAD: ×${spread.toFixed(2)}`
    : `[CHOREO] Fan Spread → AI control`)
}

getManualFanSpread(): number | null {
  return this._manualFanSpread
}
```

**Localización del hot-path:** en `generateIntent()`, en el bloque STEREO PHASE OFFSET (`stereoConfig.type === 'mirror'` / `'snake'`):

```typescript
// ANTES (en el bloque mirror):
const mirrorSign = fixtureIndex % 2 === 0 ? 1 : -1
stereoPosition.x = finalPosition.x * mirrorSign

// DESPUÉS:
const fanScale = this._manualFanSpread !== null ? this._manualFanSpread : 1.0
const mirrorSign = (fixtureIndex % 2 === 0 ? 1 : -1) * fanScale
stereoPosition.x = fanScale === 0
  ? finalPosition.x  // Si fan=0, todos en fase — sin espejo
  : finalPosition.x * mirrorSign
```

```typescript
// ANTES (en el bloque snake):
const phaseOffset = fixtureIndex * stereoConfig.offset

// DESPUÉS:
const fanScale = this._manualFanSpread !== null ? this._manualFanSpread : 1.0
const phaseOffset = fixtureIndex * stereoConfig.offset * fanScale
```

**Importante:** el `phaseOffset` binario que llega como parámetro externo de `KineticAdapter` (L/R counterpoint de WAVE 4645) NO se toca. Ese es el spread físico de posición, no el fan. Lo que escalamos es el spread **generado internamente** por STEREO_CONFIG.

También hay que añadir `setManualFanSpread(null)` al reset en `getManualOverrides()` cleanup (si viene pattern=null):

```typescript
// En setManualPattern(null):
// YA existe:
this.manualPatternOverride = null

// AÑADIR:
// El fan spread se resetea con el patrón
// (NO lo reseteamos aquí — el caller AetherIPCHandlers lo decide)
```

---

### PARCHE B — `AetherIPCHandlers.ts`

**Localización:** handler `lux:aether:setManualPattern`

```typescript
// ANTES:
ipcMain.handle(
  'lux:aether:setManualPattern',
  (_event, { fixtureIds, pattern, speed, amplitude }: {
    fixtureIds: string[]
    pattern: string | null
    speed: number
    amplitude: number
  }) => {
    ...
    // En el reset:
    vibeMovementManager.setManualPattern(null)
    vibeMovementManager.setManualSpeed(null)
    vibeMovementManager.setManualAmplitude(null)
    ...
    // En el set:
    vibeMovementManager.setManualPattern(pattern)
    vibeMovementManager.setManualSpeed(speed)
    vibeMovementManager.setManualAmplitude(amplitude)

// DESPUÉS:
ipcMain.handle(
  'lux:aether:setManualPattern',
  (_event, { fixtureIds, pattern, speed, amplitude, fanSpread }: {
    fixtureIds: string[]
    pattern: string | null
    speed: number
    amplitude: number
    fanSpread?: number   // ← NUEVO: -1..1, opcional (undefined = sin cambio)
  }) => {
    ...
    // En el reset:
    vibeMovementManager.setManualPattern(null)
    vibeMovementManager.setManualSpeed(null)
    vibeMovementManager.setManualAmplitude(null)
    vibeMovementManager.setManualFanSpread(null)    // ← NUEVO
    ...
    // En el set:
    vibeMovementManager.setManualPattern(pattern)
    vibeMovementManager.setManualSpeed(speed)
    vibeMovementManager.setManualAmplitude(amplitude)
    if (fanSpread !== undefined) {
      vibeMovementManager.setManualFanSpread(fanSpread) // ← NUEVO
    }
```

---

### PARCHE C — `KineticsBridge.ts`

**Localización:** función `_flushPattern()`

```typescript
// ANTES:
await window.lux?.aether?.setManualPattern({
  fixtureIds,
  pattern: enginePattern,
  speed: patternSpeed,
  amplitude: patternAmplitude,
})

// DESPUÉS:
const { fanValue } = useMovementStore.getState()
const fanSpread = fanValue / 100  // -100..100 → -1..1
await window.lux?.aether?.setManualPattern({
  fixtureIds,
  pattern: enginePattern,
  speed: patternSpeed,
  amplitude: patternAmplitude,
  fanSpread,              // ← NUEVO
})
```

**Localización:** donde se actualiza el patrón en reacción a cambios del store (la suscripción de fanValue). Actualmente: cuando `fanValue` cambia y hay un patrón activo → ya hay una suscripción? Revisar…

**Revisión de suscripciones en KineticsBridge:**

La suscripción 2 (pan/tilt/fan/chaos) ya escucha cambios de `fanValue`. Cuando hay un patrón activo, `_flushClassic()` sale early. **El mecanismo de suscripción para re-disparar `_flushPattern()` cuando cambia `fanValue` NO existe** — el bridge no tiene un `subscribe(fanValue, () => _flushPattern())`.

**FIX ADICIONAL necesario en KineticsBridge:**  

En la suscripción que escucha cambios de fan/chaos (suscripción 2), añadir un dispatch a `_flushPattern()` cuando hay patrón activo:

```typescript
// En la suscripción 2 del bridge, donde reacciona a cambios de fanValue:
// AÑADIR al final del handler:
const { activePattern } = useMovementStore.getState()
if (activePattern && activePattern !== 'none' && activePattern !== 'static') {
  // Re-flush el patrón con el nuevo fanSpread
  this._flushPattern()  // esto ya re-enviará fanSpread actualizado
}
```

> ⚠️ Verificar que `_flushPattern()` es idempotente ante llamadas frecuentes (debería serlo ya que sólo llama a IPC con los mismos valores de store).

---

## 5. IMPACTO EN EL SIMULADOR 3D

**Veredicto final:** No requiere cambios.

El simulador lee `physicalPan/physicalTilt` de `transientStore`, que viene de HAL sobre los valores DMX finales del NodeArbiter. Una vez que KineticAdapter → VibeMovementManager calculen el spread de fase correctamente con el fanValue, ese resultado se propagará automáticamente a través de:

```
VMM.generateIntent() con fanSpread correcto
  → KineticAdapter emite pan/tilt correctos al IntentBus
    → NodeArbiter decide pan/tilt DMX final
      → HAL aplica física → physicalPan/physicalTilt
        → TitanOrchestrator → injectHotFrame()
          → transientStore
            → useFixture3DData + useFrame() → simulador renderiza
```

El simulador es downstream correcto. El fix en VMM se refleja automáticamente.

---

## 6. RESUMEN EJECUTIVO DE ARCHIVOS A TOCAR

| Archivo | Tipo de cambio | Líneas estimadas |
|---------|---------------|-----------------|
| `electron-app/src/engine/movement/VibeMovementManager.ts` | + campo `_manualFanSpread` + método `setManualFanSpread()` + aplicación en hot-path `generateIntent()` | ~25 líneas |
| `electron-app/src/core/aether/AetherIPCHandlers.ts` | + `fanSpread?` en payload + forward a VMM en set y reset | ~8 líneas |
| `electron-app/src/bridges/KineticsBridge.ts` | + leer `fanValue` en `_flushPattern()` + re-trigger cuando fanValue cambia con patrón activo | ~10 líneas |

**Archivos NO tocados:**
- `KineticAdapter.ts` — no necesario
- `BaseSystem.ts` / `FrameContext` — no necesario
- `KineticSystem.ts` — rueda inactiva, no tocar
- Simulador 3D — downstream correcto

**TypeScript errors esperados tras el parche:** 0

---

## 7. ORDEN DE IMPLEMENTACIÓN

```
1. VibeMovementManager.ts  — campo + setter + hot-path  (el núcleo)
2. AetherIPCHandlers.ts    — ampliar payload IPC          (el cable)
3. KineticsBridge.ts       — leer fanValue + re-trigger   (el gatillo)
```

Orden inverso de implementación = dependency order. Implementar del núcleo hacia afuera.

---

## 8. ADVERTENCIAS / EDGE CASES

### 8.1 Patrón `circle_big` y fixtures con `fixtureOffset`
`circle_big` tiene su propio `fixtureOffset = (index / total) * Math.PI * 2` — esto **no** es el mismo offset que STEREO_CONFIG. Ese offset vive dentro de `PATTERNS.circle_big()` como parámetro `index`. Cuando el fan escala el STEREO_CONFIG, el spread interno de `circle_big` **no se ve afectado**. Esto es correcto: el spread interno del patrón es la "forma" del patrón; el fan escala la diferenciación L/R, no la forma.

### 8.2 fanScale = 0 (fan centrado)
Cuando `fanValue = 0`, `fanScale = 0`. En el bloque `mirror`, esto haría que todos los fixtures tengan `mirrorSign = 0`, y `finalPosition.x * 0 = 0` — todos clavan el pan en centro. Esto es correcto y útil (concentrar todos los movers hacia el centro).

Para `snake`, `phaseOffset = 0` para todos → todos en sincronía (Borg mode). También correcto.

### 8.3 fanValue negativo (fan invertido)
`fanValue = -100` → `fanSpread = -1`. En mirror: los fixtures impares tendrían `mirrorSign = -1 * -1 = 1` → invierten la inversión → mismo resultado que fanSpread=1. Esto **podría ser** útil como efecto (invert-fan) o confuso. Decisión de Radwulf.

Alternativa segura: usar `Math.abs(fanSpread)` en mirror y usar el signo para controlar la orientación de la ola en snake (ola hacia delante vs hacia atrás). Pero eso es complejidad extra. **Propuesta por defecto: usar el valor directo y dejar que el negativo invierta el efecto.**

### 8.4 Debounce en el re-trigger del fan
Si el fader Fan genera eventos muy rápido (60/s), el re-trigger de `_flushPattern()` podría enviar muchos IPCs. **Pero:** ya hay confirmado que la suscripción 2 del bridge tiene throttle/debounce para el fan. Verificar que ese throttle se respeta también para el nuevo re-trigger.

---

## 9. ¿QUÉ QUEDA FUERA DEL SCOPE DE ESTA WAVE?

- **Fan en KineticSystem.ts (viejo engine Aether):** el sistema de `node.stereoIndex * WAVE_PHASE_INCREMENT` en `KineticSystem.ts` sigue sin fan — pero ese engine está inactivo. Si se reactiva en el futuro, esa es otra wave.
- **Fan independiente por fixture:** actualmente el fan es global para todos los fixtures en el patrón. Un fanValue por fixture requeriría un array de phaseOffsets en VMM. Fuera de scope.
- **Presets de fan persistentes:** guardar el fanValue como parte del show/escena. Fuera de scope.

---

*Propuesta lista para implementación quirúrgica cuando Radwulf diga GO.*  
*PunkOpus — WAVE 4717*
