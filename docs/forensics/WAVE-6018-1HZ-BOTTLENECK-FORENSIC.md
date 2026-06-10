# WAVE-6018 — FORENSIC AUDIT: El Cuello de Botella de 1Hz
**Auditor:** Cascade (Core Engineer)  
**Date:** 2026-06-09  
**Scope:** Degradación visual/audio tras implementar tubo lento `selene:truth` a 1Hz.  
**Status:** `READ-ONLY FORENSIC MAP — No code changed`

---

## 1. Executive Summary

La UI visual **NO está siendo frenada por React**. Los motores de renderizado de TacticalCanvas (RAF → Web Worker) y VisualizerCanvas (R3F `useFrame`) corren a 60fps nativos. El cuello de botella real es la **fuente de datos**, no el reconciliador de React.

**Hallazgo clave:** `transientStore` (la memoria mutable que alimenta a ambos simuladores) recibe dos tipos de inyecciones:
1. `injectTransientTruth(truth)` — llamado por `useSeleneTruth` cada vez que llega `selene:truth` (ahora **1Hz**).
2. `injectHotFrame(hotFrame)` — llamado por `useSeleneTruth` cada vez que llega `selene:hot-frame` (ahora **MUERTO**, WAVE-6015).

Sin `selene:hot-frame`, los campos dinámicos de audio (`sensory.audio.bass/mid/high/energy`) y las bandas espectrales solo se actualizan cuando llega el truth completo a 1Hz. El RAF lee a 60fps, pero los valores objetivo cambian 1 vez por segundo.

---

## 2. TARGET 1 — El Simulador (TacticalCanvas / VisualizerCanvas)

### 2.1 TacticalCanvas.tsx — Data Pump (RAF a ~22Hz)

**File:** `src/components/hyperion/views/tactical/TacticalCanvas.tsx`  
**Lines:** `624-710`

```typescript
@/electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx:646-657
      if (shouldPack) {
        // Read transient truth — reutilizamos el mismo Map (clear + fill, 0 GC)
        const transientTruth = getTransientTruth()
        const transientFixtures = transientTruth?.hardware?.fixtures
        let transientMap: Map<string, any> | null = null
        if (transientFixtures && Array.isArray(transientFixtures)) {
          transientMapRef.current.clear()
          for (const f of transientFixtures) {
            if (f?.id) transientMapRef.current.set(f.id, f)
          }
          transientMap = transientMapRef.current
        }
```

**Diagnóstico:** El pump lee `getTransientTruth()` directamente del mutable ref (`transientRef.current`). **Cero suscripción a Zustand.** Cero dependencia de `useSeleneTruth`. El RAF corre independientemente de React.

**¿Por qué parece lento?**
- `getTransientTruth()` devuelve `null` hasta que `injectTransientTruth()` sea llamado por primera vez. Eso solo ocurre cuando llega el primer `selene:truth` a 1Hz.
- Hasta ese momento, `transientMap` es `null` → `packFrameDataInto()` recibe fixtures estructurales sin datos dinámicos → envía zeros al worker.
- Una vez que llega el primer truth, `transientRef.current` se establece. El inyector de `GlassCanvas.tsx` (WAVE-6017 Parche 2) muta `transientRef.current.hardware.fixtures` a 44Hz. A partir de ese punto, el pump debería leer datos frescos a ~22Hz.

**Conclusión:** El simulador 2D no está siendo frenado por React. Está en **espera del primer truth** (latencia de arranque de hasta 1s) y luego funciona a velocidad nativa.

---

### 2.2 VisualizerCanvas.tsx / useFixture3DData — R3F useFrame

**File:** `src/components/hyperion/views/visualizer/useFixture3DData.ts`  
**Lines:** `117-227`

```typescript
@/electron-app/src/components/hyperion/views/visualizer/useFixture3DData.ts:125-134
  // 🔥 WAVE 2236: THE DECOUPLING — No reactive hardware subscription
  // BEFORE: useHardware() subscribed to truthStore → useMemo recalculated
  //   Fixture3DData[] at 30fps → new array refs → all 3D children re-mounted.
  // NOW: This hook only reacts to STRUCTURAL changes (fixtures added/removed,
  //   zone changes, selection, overrides). Dynamic values (color, intensity,
  //   pan, tilt) are read by each 3D component directly from transientStore
  //   inside useFrame() at native R3F frame rate.
```

```typescript
@/electron-app/src/components/hyperion/views/visualizer/useFixture3DData.ts:226
        const fixtureState = getTransientFixture(fixture.id)
```

**Diagnóstico:** `useFixture3DData` lee `getTransientFixture(id)` como **snapshot no reactivo** dentro de `useMemo`. Los valores dinámicos (color, pan, tilt) los leen los componentes hijos (`HyperionMovingHead3D`, `HyperionPar3D`) dentro de `useFrame()` de R3F, directamente desde `transientStore`.

**Conclusión:** Al igual que TacticalCanvas, el visualizador 3D **no depende de renders de React**. Los meshes se animan a 60fps leyendo la memoria mutable. La lentitud percibida es la misma causa: `transientStore` vacío hasta el primer truth a 1Hz.

---

## 3. TARGET 2 — El Spectrum Analyzer (Audio)

### 3.1 AudioSpectrumTitan.tsx — RAF Engine Puro

**File:** `src/components/views/SensoryView/AudioSpectrumTitan.tsx`  
**Lines:** `161-322`

```typescript
@/electron-app/src/components/views/SensoryView/AudioSpectrumTitan.tsx:165-176
    const tick = (now: number) => {
      // 🔥 WAVE 2405: Read TRANSIENT store — updated every IPC frame
      const truth = getTransientTruth()
      if (!truth) { frameId = requestAnimationFrame(tick); return }
      const audio = truth.sensory.audio
      const beat = truth.sensory.beat

      // 🎵 WAVE 3250: TEMPORAL LERP
      smoothBass.current += (audio.bass - smoothBass.current) * AUDIO_LERP
      smoothMid.current += (audio.mid - smoothMid.current) * AUDIO_LERP
      smoothHigh.current += (audio.high - smoothHigh.current) * AUDIO_LERP
```

**Diagnóstico:** El componente renderiza **una sola vez** en mount. Luego un RAF loop muta el DOM directamente vía refs. Lee `getTransientTruth()` en cada frame. El LERP local suaviza las transiciones.

**El problema:** `audio.bass`, `audio.mid`, `audio.high` provienen de `transientRef.current.sensory.audio`. Esta referencia solo se actualiza de dos maneras:

1. `injectTransientTruth(truth)` — ahora a **1Hz** (desde `selene:truth`).
2. `injectHotFrame(hotFrame)` — ahora **MUERTO** (líneas 244-249 de `transientStore.ts`):

```typescript
@/electron-app/src/stores/transientStore.ts:241-249
  // 🎵 WAVE 3250: UNLEASH THE SPECTRUM — Patch audio bands from hot-frame (22Hz)
  // Antes: bass/mid/high/energy solo llegaban en selene:truth (~7Hz).
  // AudioSpectrumTitan leía valores idénticos 8-9 frames → escalones visibles.
  if (transientRef.current.sensory?.audio && hotFrame.bass !== undefined) {
    transientRef.current.sensory.audio.bass = hotFrame.bass
    transientRef.current.sensory.audio.mid = hotFrame.mid
    transientRef.current.sensory.audio.high = hotFrame.high
    transientRef.current.sensory.audio.energy = hotFrame.energy
  }
```

Como `selene:hot-frame` fue erradicado en WAVE-6015, `injectHotFrame()` nunca se ejecuta. Los valores de audio en `transientStore` solo cambian cuando llega el truth completo (1Hz). El RAF del spectrum analyzer corre a 60fps, pero el valor objetivo al que hace LERP solo se mueve 1 vez por segundo.

**Resultado observable:** Las barras del espectro se congelan y dan saltos bruscos cada segundo. No es un lag de render — es un **lag de datos**.

---

## 4. Mapeo de Causas Raíz

```
selene:truth (1Hz) ─────┬──→ useSeleneTruth ──→ injectTransientTruth() ──→ transientRef.current
                        │                                                     (base truth + fixtures)
                        │
selene:hot-frame (DEAD) ├──→ injectHotFrame() ──→ transientRef.current.sensory.audio  ❌ MUERTO
                        │                         transientRef.current.hardware.fixtures ❌ MUERTO
                        │
GlassCanvas inyector    ├──→ muta transientRef.current.hardware.fixtures a 44Hz  ✅ ACTIVO
   (WAVE-6017 P2)       │    (requiere que transientRef.current ya exista)
                        │
                        ▼
TacticalCanvas RAF pump     → lee transientRef.current.hardware.fixtures a ~22Hz  ✅ OK tras 1er truth
VisualizerCanvas useFrame   → lee transientRef.current.hardware.fixtures a 60fps   ✅ OK tras 1er truth
AudioSpectrumTitan RAF      → lee transientRef.current.sensory.audio a 60fps    ❌ 1Hz (sin hot-frame)
```

---

## 5. Conclusiones

### 5.1 Los simuladores NO están siendo frenados por React

**TacticalCanvas** y **VisualizerCanvas** leen de `transientStore` (mutable ref) en sus bucles nativos (RAF / `useFrame`). No suscriben a Zustand para datos dinámicos. La arquitectura WAVE-2236 / WAVE-2510 ya desacopló esto. 

La "degradación a 1Hz" que se percibe en los simuladores es, en realidad, un **efecto de arranque**: hasta que no llegue el primer `selene:truth`, `transientRef.current` es `null` y los canvas reciben zeros. Una vez que llega el primer truth, el inyector de GlassCanvas mantiene los datos a 44Hz.

### 5.2 El Spectrum Analyzer SÍ está realmente degradado a 1Hz

El RAF corre a 60fps, pero la **fuente de datos** (`audio.bass/mid/high`) solo se actualiza a 1Hz. Antes recibía parches a ~22Hz vía `selene:hot-frame` → `injectHotFrame()`. Esa tubería está desconectada.

**Opciones de arquitectura (para discusión, no implementación):**
- **Opción A:** Extender el payload de `selene:truth` lean para incluir `sensory.audio` (ya lo incluye, pero a 1Hz).
- **Opción B:** Crear un segundo inyector en `GlassCanvas.tsx` (o en `TickEngine.ts` vía `BufferPoolManager`) que escriba los valores de audio directamente en `transientRef.current.sensory.audio` a 44Hz. Requiere que el backend envíe audio metrics en el `Float32Array` o en un SAB paralelo.
- **Opción C:** Reactivar `selene:hot-frame` **solo para audio bands** (no para fixtures), manteniendo los fixtures puramente por GlassBridge.

### 5.3 El Cold Start sigue siendo un problema UX

Con `_outputEnabled = false` por defecto y la UI dependiendo del primer truth a 1Hz para mostrar el estado del gate, el usuario puede experimentar hasta 1 segundo de "pantalla negra" al arrancar antes de que cualquier dato aparezca. Esto es aceptable si el arquitecto lo aprueba, pero debe documentarse.

---

## 6. Files Referenced

- `src/components/hyperion/views/tactical/TacticalCanvas.tsx:624-710` — RAF data pump (mutable ref read)
- `src/components/hyperion/views/visualizer/useFixture3DData.ts:117-227` — Hook no reactivo para scaffold 3D
- `src/components/views/SensoryView/AudioSpectrumTitan.tsx:161-322` — RAF engine leyendo audio de transientStore
- `src/stores/transientStore.ts:77-133` — `injectTransientTruth()` (llamado a 1Hz)
- `src/stores/transientStore.ts:150-281` — `injectHotFrame()` (llamado a 0Hz — desconectado)
- `src/stores/transientStore.ts:241-249` — Parche de audio bands desde hot-frame (desconectado)
- `src/hooks/useSeleneTruth.ts:92-199` — Suscriptor a `selene:truth` y `selene:hot-frame` (este últico muerto)
- `src/components/GlassCanvas.tsx:62-92` — Inyector 44Hz a transientStore (solo fixtures, no audio)

---

*End of forensic audit. No code modified. Awaiting architect directive on whether to reactivate an audio-specific high-frequency channel or extend the GlassBridge payload.*
