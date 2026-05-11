# WAVE 4718 — HYPERION RE-AUDIT TÉCNICA

**Auditor:** Sonnet (Forensic Code Analysis)
**Fecha:** 2026-05-11
**Mandato:** Re-auditoría post-refactor WAVE 4704 (muerte masterArbiter), WAVE 4716 (Clean Cabin), WAVE 4717 (Cuarentena), WAVE 4719 (Guards Suicidas), WAVE 4720 (Orbit Math).
**Tono:** Implacable. Sin piedad.

**Archivos releídos:**
- `src/bridges/KineticsBridge.ts` (485 líneas, WAVE 4719)
- `src/bridges/ProgrammerAetherBridge.ts` (390 líneas, WAVE 4720)
- `src/core/aether/AetherIPCHandlers.ts` (689 líneas, WAVE 4700/4704)
- `src/core/aether/AetherKineticEngine.ts` (435 líneas, WAVE 4700)
- `src/core/aether/NodeArbiter.ts` (603 líneas, WAVE 4661)
- `src/components/hyperion/kinetics/KineticsCathedral.tsx` (262 líneas, WAVE 4719)
- `src/components/hyperion/controls/TheProgrammer.tsx` (429 líneas, WAVE 4719)
- `src/stores/programmerStore.ts` (681 líneas, WAVE 4716)
- `src/stores/movementStore.ts` (264 líneas)
- `src/engine/movement/VibeMovementManager.ts` (1165 líneas)

---

## 1. BUGS EXTERMINADOS (Victorias Confirmadas de Hoy)

### A. `syncSelection` dejó de mentir — Limpieza de zombies implementada

**Estado anterior:** El JSDoc prometía "Limpia overrides de fixtures deseleccionados". El código solo actualizaba `activeFixtureIds`. `fixtureOverrides` crecía monótonamente.

**Estado actual:** `programmerStore.ts:233-263` implementa CLEAN CABIN. Recorre el Map y `delete` las entradas de fixtures deseleccionados que no tienen overrides activos (`hasActiveOverride === false`).

```typescript
// programmerStore.ts:233-263
syncSelection: (fixtureIds) => {
  set(state => {
    const incomingSet = new Set(fixtureIds)
    const next = new Map(state.fixtureOverrides)
    // ...
    for (const id of state.fixtureOverrides.keys()) {
      if (!incomingSet.has(id)) {
        const ov = state.fixtureOverrides.get(id)!
        const hasActiveOverride = ov.dimmer !== null || ov.pan !== null || ...
        if (!hasActiveOverride) {
          next.delete(id)   // ← ████████ ZOMBIE ELIMINADO ████████
          hadZombies = true
        }
      }
    }
    return { activeFixtureIds: fixtureIds, fixtureOverrides: hadZombies ? next : state.fixtureOverrides }
  })
},
```

**Veredicto:** CORREGIDO. El bridge ya no iterará sobre cientos de entries muertas en cada tick de 44Hz.

### B. `releaseAll()` ya no es un cementerio infinito

**Estado anterior:** `releaseAll` iteraba sobre `fixtureOverrides.keys()` y recreaba un Map con empty objects para TODOS los fixtures tocados en el show.

**Estado actual:** `programmerStore.ts:636-662` ahora conserva solo `activeFixtureIds` con empty objects. Las entradas deseleccionadas ya no se recrean. Combinado con el fix de `syncSelection`, el Map tiene ciclo de vida controlado.

**Veredicto:** CORREGIDO (parcialmente — ver Sección 2.1 para el asterisco).

### G. `hasProgrammerKineticManual` ya no bloquea patrones procedurales

**Estado anterior:** `hasProgrammerKineticManual` incluía `activePattern !== 'none'` en la guardia, confundiendo patrón procedural VMM con override manual. Esto bloqueaba `_flushClassic` y `_flushPattern` simultáneamente.

**Estado actual:** WAVE 4719 eliminó `hasProgrammerKineticManual` y `hasProgrammerL2Manual` (eran idénticas). Ahora existe `hasNonPositionKineticManual` (`KineticsBridge.ts:51-65`) que **excluye explícitamente `pan` y `tilt`** del bloqueo. Solo bloquea por `speed`, `targetX/Y/Z`, y extras `rotation`/`speed`.

```typescript
// KineticsBridge.ts:51-65
function hasNonPositionKineticManual(fixtureIds: string[]): boolean {
  // ... verifica ov.speed, ov.targetX/Y/Z, ov.extras.rotation/speed
  // PAN y TILT NO están en esta lista.
}
```

**Veredicto:** CORREGIDO. El Radar y el PatternArsenal ya no se auto-bloquean.

### H. `manualOverrideFixtureIds` y `lockedFixtureIds` ahora se limpian en Unlock

**Estado anterior:** `handleUnlockKinetics` en Cathedral y `handleUnlockAll` en Programmer NO limpiaban estos Sets. `manualOverrideFixtureIds` crecía monótonamente y bloqueaba guards de spatial. `lockedFixtureIds` dejaba faders SPEED/AMP disabled permanentemente.

**Estado actual:** WAVE 4719 agregó el "EXORCISMO" en ambos handlers:

```typescript
// KineticsCathedral.tsx:139-143 & TheProgrammer.tsx:275-277
useMovementStore.getState().setManualOverrideForFixtures(selectedIds, false)
useMovementStore.getState().setLockedFixtures(new Set())
```

**Veredicto:** CORREGIDO. Ambos Sets se purgan correctamente en Unlock.

---

## 2. BUGS SUPERVIVIENTES (Lo Que Sigue Roto)

### C. Display values siguen mintiendo en multi-selección

**Archivo:** `programmerStore.ts:~286`
**Estado:** Sin cambios. Los valores display (dimmer, strobe, color, limit) se derivan **exclusivamente del primer fixture** de la selección (`fixtureIds[0]`). Si seleccionas 5 fixtures con dimmer {80%, 60%, 100%, 0%, 50%}, la UI muestra 80% como si fuera universal.

**Impacto:** El operador no puede detectar valores mixtos sin expandir cada fixture individualmente.

### D. `setColor` sigue asesinando white/amber silenciosamente

**Archivo:** `programmerStore.ts:~396-418`
**Estado:** Sin cambios. `setColor` fuerza `white: 0, amber: 0` en cada llamada. El operador que ajusta RGB en un fixture RGBW/Amber destruye los canales auxiliares sin notificación visual.

### E. TacticalCanvas sigue creando `new Map()` en cada frame

**Archivo:** `TacticalCanvas.tsx:~630-639`
**Estado:** Sin cambios. 6.000 instanciaciones de Map/segundo en rigs de 100 fixtures a 60Hz. El GC de V8 puede manejarlo, pero es una vergüenza técnica en un componente que de otro modo es brillante.

### F. TheProgrammer sigue hidratándose en background

**Archivo:** `StageSidebar.tsx` (tabs montados simultáneamente por CSS `display`)
**Estado:** Sin cambios. El `useEffect` de hidratación en `TheProgrammer.tsx:132-203` ejecuta `getL2State` IPC incluso cuando el usuario está en la pestaña GROUPS. Esto consume CPU, genera tráfico IPC innecesario, y puede causar carreras de hidratación si el usuario cambia de pestaña rápidamente.

### I. `spatialReachability` sigue acumulando sin bounds

**Archivo:** `movementStore.ts:153, 180-181`
**Estado:** Sin cambios. `spatialReachability` y `spatialSubTargets` son Records planos que crecen cada vez que se usa spatial target. No hay `clearSpatialReachability()` ni TTL. En un show largo con spatial mode, estos objetos pueden alcanzar decenas de MB.

### J. `usePersistedState` sigue sin schema version

**Archivo:** `HyperionView.tsx`
**Estado:** Sin cambios. Si el schema de persisted state cambia entre versiones, el JSON parseado puede tener campos obsoletos o tipos incompatibles. No hay `__version` ni migración.

### K. `handleCanvasClick` en VisualizerCanvas sigue siendo no-op

**Archivo:** `VisualizerCanvas.tsx:~454-457`
**Estado:** Sin cambios. Click en el aire del canvas 3D no deselecciona fixtures. El operador debe usar Escape o clic en un botón separado. Paridad rota entre 2D y 3D.

---

## 3. EL DIAGNÓSTICO DEL CONGELAMIENTO (Análisis Post-WAVE 4700)

### 3.1 El Guard Suicida está muerto — Pero el Congelamiento mutó

La cirugía de WAVE 4719 eliminó el guard recursivo que bloqueaba `_flushClassic` cuando el Radar escribía `pan`/`tilt` en `programmerStore`. Ese problema específico está resuelto.

**PERO apareció un nuevo mecanismo de congelamiento en WAVE 4700 que es más sutil y más grave:**

### 3.2 La Guerra de Dos Motores por `pan_base`/`tilt_base`

El refactor WAVE 4700 introdujo `AetherKineticEngine` — un motor nativo L2 que reemplaza a `masterArbiter.setPattern()`. Este motor:

1. Recibe configuración vía IPC `setManualPattern` (`AetherIPCHandlers.ts:315-369`)
2. En cada tick de 44Hz (`AetherKineticEngine.ts:335-411`), calcula la posición del patrón para cada fixture
3. Escribe `pan_base`/`tilt_base` directamente en `NodeArbiter` L2

```typescript
// AetherKineticEngine.ts:397-408
const panBase  = clamp01(0.5 + scaledX * 0.5)
const tiltBase = clamp01(0.5 + scaledY * 0.5)
// ...
rec['pan_base']  = panBase
rec['tilt_base'] = tiltBase
arbiter.setManualOverride(nodeId, rec)
```

**Simultáneamente, el KineticsBridge `_flushClassic` (WAVE 4720) también escribe `pan_base`/`tilt_base` cuando hay patrón activo:**

```typescript
// KineticsBridge.ts:299-300
const panChannel  = hasPattern ? 'pan_base'  : 'pan'
const tiltChannel = hasPattern ? 'tilt_base' : 'tilt'
// ...
return { nodeId: `${id}:kinetic`, channels: { [panChannel]: panFinal, [tiltChannel]: tiltNorm } }
```

**Y el ProgrammerAetherBridge también escribe `pan_base`/`tilt_base` cuando hay patrón activo:**

```typescript
// ProgrammerAetherBridge.ts:113-116
const panCh  = hasActivePattern ? 'pan_base'  : 'pan'
const tiltCh = hasActivePattern ? 'tilt_base' : 'tilt'
if (ov.pan  !== null) ch[panCh]  = ov.pan
if (ov.tilt !== null) ch[tiltCh] = ov.tilt
```

**Resultado: TRES sistemas compiten por el mismo par de canales `pan_base`/`tilt_base` en NodeArbiter L2:**

| Fuente | Frecuencia | Qué escribe |
|--------|-----------|-------------|
| AetherKineticEngine.tick() | 44Hz | Patrón oscilatorio (centro 0.5) |
| KineticsBridge._flushClassic() | ~60Hz (debounce 16ms) | Posición del Radar + fan spread |
| ProgrammerAetherBridge._flush() | 44Hz | Posición del Radar (vía programmerStore) |

### 3.3 El Patrón Ignora al Radar (Desvinculación Funcional)

El motor `AetherKineticEngine` NO recibe la posición del radar como parámetro. Sus únicos inputs son:
- `nodeIds` (qué fixtures)
- `pattern` (circle, figure8, etc.)
- `speed` (0-1)
- `amplitude` (0-1)
- `fan` (-1 a 1)

El cálculo del patrón (`AetherKineticEngine.ts:397-398`) usa **0.5 como anchor fijo**:

```typescript
const panBase  = clamp01(0.5 + scaledX * 0.5)  // ← ANCHOR HARDCODEADO A 0.5
const tiltBase = clamp01(0.5 + scaledY * 0.5)
```

**Esto significa que el patrón SIEMPRE oscila alrededor del centro del universo (0.5, 0.5), sin importar dónde el operador haya posicionado el radar.**

La matemática del NodeArbiter (`NodeArbiter.ts:322-329`) pretende sumar la desviación del LFO sobre la base del radar:
```typescript
if (key === 'pan_base') {
  const l0 = isFiniteChannelValue(record['pan']) ? record['pan'] : 0.5
  const v  = incoming + (l0 - 0.5)
  record['pan'] = clamp01(v)
}
```

PERO como el VMM fue desactivado (`setManualPattern(null)` en `AetherIPCHandlers.ts:356-359`), L0 emite `pan=0.5, tilt=0.5` (home). Entonces:
- `pan = pan_base + (0.5 - 0.5) = pan_base`
- El patrón del motor es exactamente lo que sale por DMX.

**El radar del operador no tiene efecto alguno sobre el patrón manual.** El operador mueve el radar a 270°/135° (centro del escenario), activa "circle", y los fixtures dibujan un círculo alrededor del punto geométrico centro — no alrededor del punto del radar. Si el operador mueve el radar a 100°/50° (esquina inferior izquierda), los fixtures SIGUEN dibujando el círculo en el centro. **El operador ve que los fixtures "ignoran" el radar. Esto se percibe como "congelamiento" porque el control de posición base dejó de funcionar.**

### 3.4 Veredicto del Congelamiento

**No es un deadlock ni un guard bloqueando. Es una desvinculación arquitectónica:**

El AetherKineticEngine fue diseñado como reemplazo del `masterArbiter.setPattern()`, pero el `masterArbiter` anterior **SÍ** recibía el anchor del radar como parámetro `center: { pan, tilt }`. El motor nativo nuevo perdió esta capacidad. El comentario en `AetherKineticEngine.ts:371-393` discute el problema, pero la implementación actual (`0.5 + scaledX * 0.5`) hardcodea el anchor.

**Fix requerido:** El motor nativo debe recibir un `anchorPan`/`anchorTilt` normalizado (de `_flushClassic` del Radar) y usarlo en lugar de `0.5`:

```typescript
// Fix propuesto (análisis, no código):
const anchorPan  = this._anchorPan  ?? 0.5   // recibido del radar vía updateAnchor()
const anchorTilt = this._anchorTilt ?? 0.5
const panBase  = clamp01(anchorPan  + scaledX * 0.5 * amplitude)
const tiltBase = clamp01(anchorTilt + scaledY * 0.5 * amplitude)
```

---

## 4. LA PARADOJA DEL UNLOCK (Análisis Post-WAVE 4719)

### 4.1 Veredicto: RESUELTA

WAVE 4719 unificó los flujos de Unlock. Ambos botones ahora ejecutan exactamente la misma secuencia de 6 pasos:

**KineticsCathedral.tsx:122-144:**
1. `programmerStore.releaseAll()` — limpia L2 NodeArbiter
2. `window.lux.aether.setManualPattern({ pattern: null })` — detiene motor nativo + limpia VMM
3. `window.lux.aether.setKineticFanOffsets({})` — limpia offsets residuales (legacy no-op)
4. `movementStore.setActivePattern('none')` — resetea UI
5. `setManualOverrideForFixtures(selectedIds, false)` — purga Set zombificado
6. `setLockedFixtures(new Set())` — libera faders SPEED/AMP

**TheProgrammer.tsx:256-278:**
1. `releaseAll()` — idem
2. `window.lux.aether.clearInhibitLimit(nodeIds)` — limpia caps IMPACT
3-6. Idénticos a la Cathedral

**No hay más discrepancia.** El operador puede pulsar Unlock en cualquier botón y obtener el mismo estado limpio. Los Sets zombificados ya no persisten.

### 4.2 Asterisco: `releaseAll()` sigue creando entries vacías

`programmerStore.ts:636-662`:
```typescript
const next = new Map<string, ProgrammerOverrides>()
for (const id of state.activeFixtureIds) {
  next.set(id, createEmptyOverrides())  // ← zombie vacío
}
```

Aunque `syncSelection` limpia estos zombies al deseleccionar, durante la ventana entre `releaseAll()` y `syncSelection` (o si nunca se llama `syncSelection`), el Map contiene entries vacías que el bridge itera en cada tick. No es un bug funcional, pero es ruido innecesario.

---

## 5. NUEVAS INCONSISTENCIAS INTRODUCIDAS HOY

### 5.1 Tráfico IPC Fantasma (Fan Offsets VMM desconectados)

`KineticsBridge._flushFanPhase()` (`KineticsBridge.ts:398-419`) sigue enviando offsets de fase al IPC `lux:aether:setKineticFanOffsets` en cada cambio de `fanValue`. PERO `AetherIPCHandlers.ts:413-419` convirtió ese handler en **no-op**:

```typescript
ipcMain.handle('lux:aether:setKineticFanOffsets', (_event, _offsets) => {
  // No-op: los fan offsets se calculan nativamente en AetherKineticEngine.tick()
  return { success: true }
})
```

**Impacto:** ~20-60 llamadas IPC no-op por minuto cuando el operador juega con el fader Fan. No rompe nada, pero es ruido de red y CPU innecesario en el renderer→main bridge.

### 5.2 `updateKineticScalars` IPC existe pero nunca se usa

`AetherIPCHandlers.ts:378-392` define un handler `lux:aether:updateKineticScalars` diseñado para cambios en tiempo real de sliders sin reiniciar la fase. PERO `KineticsBridge._flushPattern()` (`KineticsBridge.ts:338-365`) siempre llama `setManualPattern` completo, nunca `updateKineticScalars`.

Cada vez que el operador mueve el slider de Speed o Amplitude, `_flushPattern` envía un `setManualPattern` completo. El motor `setManualKinetics` recibe esto y reemplaza `_config`. Como los `nodeIds` son los mismos, el `_phaseMap` no se reinicia (bien), pero el motor **no sabe** que el cambio fue "solo speed". No hay bug funcional, pero el IPC `updateKineticScalars` es código muerto desde la perspectiva del frontend.

### 5.3 El Patrón Manual no puede coexistir con Posición Absoluta del Radar

En WAVE 4720, `extractKinetic` en `ProgrammerAetherBridge.ts:100-119` fue corregido para emitir `pan_base`/`tilt_base` cuando hay patrón activo. Esto era necesario para evitar que el MANUAL HARD LOCK bloqueara L0.

PERO: Como el AetherKineticEngine ahora escribe `pan_base`/`tilt_base` directamente con el patrón integrado, y el Radar también escribe `pan_base`/`tilt_base` con su posición, hay una condición de carrera en NodeArbiter:

1. Operador mueve radar → `_flushClassic` envía `pan_base=0.7` → NodeArbiter recibe
2. 16ms después, `AetherKineticEngine.tick()` envía `pan_base=0.52` (posición del círculo) → NodeArbiter sobrescribe
3. El operador ve el fixture "saltar" brevemente a la posición del radar y volver al círculo

**Si el operador deja el radar quieto, el patrón gana permanentemente.** El operador no puede "mover el centro del círculo" con el radar. El radar solo funciona en modo absoluto (sin patrón activo).

### 5.4 `AetherKineticEngine` no implementa `updateAnchor()`

El motor nativo tiene `updateScalars()` para speed/amplitude/fan, pero **no tiene `updateAnchor()` para pan/tilt del radar**. La arquitectura del motor asume que el patrón es autocontenido y no necesita un punto de anclaje externo. Esto rompe el diseño original del "orbit math" del NodeArbiter.

---

## 6. PLAN DE CIRUGÍA (Pasos Exactos para Arreglar el Punto 3 y 4)

### Cirugía #1: Anchor del Radar en AetherKineticEngine (CORREGIR CONGELAMIENTO)

**Archivo:** `src/core/aether/AetherKineticEngine.ts`

1. **Agregar campos de anchor al motor:**
   - `private _anchorPan = 0.5`
   - `private _anchorTilt = 0.5`

2. **Agregar método `updateAnchor(panNorm: number, tiltNorm: number)`:**
   ```typescript
   updateAnchor(pan: number, tilt: number): void {
     this._anchorPan = clamp01(pan)
     this._anchorTilt = clamp01(tilt)
   }
   ```

3. **Modificar `tick()` para usar el anchor en lugar de 0.5:**
   ```typescript
   // Reemplazar: const panBase = clamp01(0.5 + scaledX * 0.5)
   const panBase  = clamp01(this._anchorPan  + scaledX * 0.5)
   const tiltBase = clamp01(this._anchorTilt + scaledY * 0.5)
   ```

4. **Modificar `AetherIPCHandlers.ts`:**
   - En `setManualPattern`, pasar el anchor actual del radar (si existe) al motor.
   - O mejor: crear un handler IPC separado `lux:aether:setKineticAnchor` que llame `aetherKineticEngine.updateAnchor()`.

5. **Modificar `KineticsBridge.ts`:**
   - En `_flushClassic`, cuando hay patrón activo, además de escribir `pan_base`/`tilt_base` en NodeArbiter, enviar el anchor al motor nativo vía IPC `setKineticAnchor`.
   - **Alternativa más limpia:** que `_flushClassic` NO escriba `pan_base`/`tilt_base` en NodeArbiter cuando hay patrón activo. En su lugar, solo envíe el anchor al motor nativo. El motor se encarga de todo el cálculo y escritura L2.

### Cirugía #2: Unificar Fan Dispatch (Eliminar Tráfico Fantasma)

**Archivo:** `src/bridges/KineticsBridge.ts`

1. **Eliminar `_flushFanPhase()` y su suscripción.** El fan ahora viaja en `_flushPattern` como parámetro `fan` (ya implementado en WAVE 4700).

2. **O si se prefiere mantener `_flushFanPhase` para compat:** convertirlo en llamada local a `_schedulePatternFlush` con el `fanValue` actual, para que el pattern flush incorpore el fan sin doble IPC.

### Cirugía #3: Usar `updateKineticScalars` para cambios continuos

**Archivo:** `src/bridges/KineticsBridge.ts`

1. **Modificar `_schedulePatternFlush` / `_flushPattern`:**
   - Si el patrón ya está activo y los `fixtureIds` no cambiaron, usar `window.lux.aether.updateKineticScalars({ speed, amplitude, fan })` en lugar de `setManualPattern` completo.
   - Solo llamar `setManualPattern` cuando cambia el patrón o la selección de fixtures.

2. **Esto evita re-validación completa del motor en cada slider move y mantiene la fase continua.**

### Cirugía #4: Resolver la Competencia L2 (ProgrammerAetherBridge vs AetherKineticEngine)

**Archivo:** `src/bridges/ProgrammerAetherBridge.ts`

1. **Modificar `extractKinetic` para que NO emita `pan_base`/`tilt_base` cuando hay patrón activo:**
   ```typescript
   // WAVE 4720 CORRECCIÓN: Cuando hay patrón activo, el motor nativo
   // controla pan_base/tilt_base. El ProgrammerAetherBridge solo emite
   // speed/targetX/Y/Z (si existen).
   if (!hasActivePattern) {
     if (ov.pan  !== null) ch['pan']  = ov.pan
     if (ov.tilt !== null) ch['tilt'] = ov.tilt
   }
   // speed SIEMPRE se emite (es L2 independiente)
   if (ov.speed !== null) ch['speed'] = ov.speed
   ```

2. **Esto elimina la doble escritura.** El AetherKineticEngine es la única fuente de `pan_base`/`tilt_base` cuando hay patrón activo. El ProgrammerAetherBridge solo controla speed (que es L2 override independiente del patrón).

3. **KineticsBridge._flushClassic** también debería dejar de escribir `pan_base`/`tilt_base` cuando hay patrón activo. En vez de eso, debería enviar el anchor al motor nativo.

---

## 7. SÍNTESIS Y PUNTUACIÓN ACTUALIZADA

### Puntuación Técnica Revisada: 7.1/10

| Subsistema | Puntaje Anterior | Puntaje Actual | Razón |
|---|---|---|---|
| Renderizado 2D (Worker) | 9/10 | 9/10 | Sin cambios. Sigue brillante. |
| Renderizado 3D (R3F) | 7.5/10 | 7.5/10 | Sin cambios. |
| Programmer Store / L2 | 4/10 | 6.5/10 | Zombies purgados, syncSelection honesto, releaseAll limpio. Display values y setColor W/A siguen rotos. |
| Puentes IPC | 6.5/10 | 6/10 | KineticsBridge ya no se auto-bloquea. PERO: doble escritura L2, tráfico IPC fantasma, updateKineticScalars muerto. |
| Kinetic Cathedral / Radar | 5/10 | 4/10 | Unlock resuelto, guards resueltos. PERO: patrón ignora radar completamente. Peor que antes en funcionalidad. |
| Motor Cinético Nativo | — | 5/10 | Zero-alloc, determinista, matemáticamente correcto. PERO: sin anchor del radar, el patrón vive en el vacío. |
| Integridad WYSIWYG | 5.5/10 | 5.5/10 | Sin cambios. |

### Hallazgos Críticos Resumidos

1. **[CRÍTICO]** El AetherKineticEngine genera patrones centrados en 0.5, ignorando la posición del radar. El operador no puede mover el centro del patrón. Percepción: "patrón congelado / no responde al radar".

2. **[CRÍTICO]** Tres sistemas compiten por `pan_base`/`tilt_base` en NodeArbiter L2: AetherKineticEngine (44Hz), KineticsBridge (16ms debounce), ProgrammerAetherBridge (44Hz). El último que escribe gana. Timing impredecible.

3. **[MEDIO]** `updateKineticScalars` IPC existe pero el frontend nunca lo usa. Tráfico IPC innecesario con `setManualPattern` completo en cada slider move.

4. **[MEDIO]** `_flushFanPhase` envía offsets a un handler no-op. Tráfico fantasma ~60 calls/min.

5. **[BAJO]** Bugs C, D, E, F, I, J, K de la auditoría original siguen sin tocar.

---

*Fin del informe de regresión. Hemos curado la infección de los guards suicidas, pero el paciente ahora padece de desorientación espacial: el motor cinético nativo orbita alrededor de un punto que no existe.*
