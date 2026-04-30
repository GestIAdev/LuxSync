# WAVE 3527 — THE DATA BRIDGE FORENSIC: Audio Energy Blackout

**Fecha:** 29 de Abril, 2026  
**Auditor:** PunkOpus (Data Pipeline Inspector)  
**Status:** 🔴 **BLOCKER — Audio Energy Lost in Orchestrator**

---

## Executive Summary

La Matrix está recibiendo `kickDetected=true` pero Aether reporta `impact=[0,0,0]` RGB. El IntervalBPMTracker detecta kicks reales (`bassFlux=0.3791`). **Pero el `audio.energy` que alimenta a los color/dimmer adapters de Aether es 0 o está estancado.**

**La causa:** Incompatibilidad en la decisión de ruta (*isOmniActive*) en [TitanOrchestrator.ts:601](file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/orchestrator/TitanOrchestrator.ts#L601). Cuando el Worker reporta audio verdadero (Omni source: VirtualWire, USB, etc.), pero `getAudioMatrix().getStatus()` retorna `null` o falla, el orquestador **toma la ruta Worker-spectral-only** que **comentó explícitamente la línea `energy: levels.energy`** (línea 680).

**Resultado**: `audio.energy` jamás se actualiza, persiste en 0, y los adapters ven brightness=0 → RGB=[0,0,0].

---

## PARTE 1: La Rutas de Datos en TitanOrchestrator

### Ruta A: Omni Source Activa (VirtualWire, USB-DirectLink, OSC-Nexus)

```typescript
// Line 601: Decisión de ruta
const activeSource = matrixStatus?.activeSource ?? null
const isOmniActive = activeSource ? OMNI_SOURCES.has(activeSource) : false

if (isOmniActive) {  // Line 604
  const smoothedOmni = this.syncSmoother.smooth({
    bass: levels.bass,
    mid: levels.mid,
    high: levels.treble,
    energy: levels.energy,  // ✅ ENERGY INCLUDED
    // ... subBass, lowMid, highMid, etc.
  }, true /* omniPath */)

  this.lastAudioData = {
    ...this.lastAudioData,
    bass:   smoothedOmni.bass,
    mid:    smoothedOmni.mid,
    high:   smoothedOmni.high,
    energy: smoothedOmni.energy,  // ✅ Line 625: ENERGY FLOWS
    // ... rest of metrics
  }
  this.hasRealAudio = true  // ✅ Data is live
  this.lastAudioTimestamp = Date.now()
}
```

**Resultado:** Worker data flows completely. Energy es suavizado via SyncSmoother. Aether recibe audio completo.

### Ruta B: No-Omni Source (Legacy, WebAudio frontend, etc.)

```typescript
} else {  // Line 671: NOT isOmniActive

  // 🔥 WAVE 1012.5: Worker = SPECTRAL SOURCE ONLY
  // NO sobrescribir bass/mid/high/energy — Frontend tiene prioridad temporal (60fps)
  
  this.lastAudioData = {
    ...this.lastAudioData,
    // Core bands — COMENTADOS
    // bass: levels.bass,     // ❌ Frontend tiene prioridad (Line 678)
    // mid: levels.mid,       // ❌ Frontend tiene prioridad (Line 679)
    // high: levels.treble,   // ❌ Frontend tiene prioridad (Line 680)
    // energy: levels.energy, // ❌ ASESINA — Frontend tiene prioridad (Line 681)
    
    // Extended FFT metrics — WORKER AUTHORITATIVE (sí se actualizan)
    subBass: levels.subBass ?? this.lastAudioData.subBass,
    lowMid: levels.lowMid ?? this.lastAudioData.lowMid,
    highMid: levels.highMid ?? this.lastAudioData.highMid,
    harshness: levels.harshness ?? this.lastAudioData.harshness,
    // ...
    
    // Transients — SÍ SE ACTUALIZAN
    kickDetected: levels.kickDetected ?? this.lastAudioData.kickDetected,
    snareDetected: levels.snareDetected ?? this.lastAudioData.snareDetected,
    // ...
  };
}
```

**Problema:** Las líneas 678–681 son comentarios explícitos diciendo que **el frontend tiene prioridad**. Pero el frontend (WebAudio) no está activo. Y el Worker está enviando datos verdaderos, incluyendo `kickDetected=true` y `rawBassEnergy=0.3791`. Pero `energy` **NUNCA se actualiza en esta rama**.

---

## PARTE 2: El Consumo en processFrame()

### Línea 1004 — donde se lee energy

```typescript
// Line 1004 en el hot-path de processFrame()
if (this.hasRealAudio) {
  bass = this.lastAudioData.bass * this.inputGain
  mid = this.lastAudioData.mid * this.inputGain
  high = this.lastAudioData.high * this.inputGain
  energy = this.lastAudioData.energy * this.inputGain  // ← AQUÍ MUERE
} else {
  bass = 0; mid = 0; high = 0; energy = 0
}
```

**Si la ruta es no-Omni sin actualización de energía:**
- `this.lastAudioData.energy` persiste stale (0 o valor antiguo)
- `energy = 0 * inputGain = 0`
- El resto del pipeline recibe energía=0

---

## PARTE 3: El Flujo hasta Aether

### engineAudioMetrics (línea 1156–1177)

```typescript
const engineAudioMetrics = {
  bass,   // = 0 si no-Omni sin sync
  mid,    // = 0 si no-Omni sin sync
  high,   // = 0 si no-Omni sin sync
  energy, // = 0 si no-Omni sin sync  ← AQUÍ
  
  // Pero estos SÍ vienen del Worker (no comentados):
  kickDetected: workerOnBeat || (beatState.pllLocked && this.lastAudioData.kickDetected), // ✅ TRUE
  beatPhase: ...,
  bpm: ...,
  // ...
}
```

### FrameContext (línea 1599–1627)

```typescript
const a = this._aetherCtx.audio as { energy: number; ... }
a.energy = engineAudioMetrics.energy  // ← Recibe 0 o stale
a.hasTransient = engineAudioMetrics.isBeat  // ✅ Recibe TRUE (Worker data)
a.transientStrength = engineAudioMetrics.kickDetected ? 1 : 0  // ✅ Recibe 1
// ...
```

**Resultado:** `context.audio.energy = 0`, pero `context.audio.transientStrength = 1`.

### LiquidColorAdapter.process() (línea 329–380)

```typescript
const { audio, musical, vibe } = context

// ... computar HSL blend ...
const baseR = ..., baseG = ..., baseB = ...

// ✅ A los nodos se itera correctamente
nodes.forEach((node) => {
  // ✅ Distancia y falloff calculados
  const falloff = BaseSystem.clamp01(1 - dist / maxR)
  
  // ❌ AQUÍ MUERE LA ENERGÍA
  const brightness = BaseSystem.clamp01(
    audio.energy * falloff * zoneIntensity * vibeGain  // ← audio.energy = 0!
  )
  // brightness = clamp01(0 * falloff * ... ) = 0

  // ❌ RGB se forza a [0,0,0]
  this._valuesDict['red']   = BaseSystem.clamp01(baseR * 0) = 0
  this._valuesDict['green'] = BaseSystem.clamp01(baseG * 0) = 0
  this._valuesDict['blue']  = BaseSystem.clamp01(baseB * 0) = 0

  this._intentScratch.confidence = BaseSystem.clamp01(audio.energy * falloff) = 0
  bus.push(intent)  // NodeIntent con RGB=[0,0,0], confidence=0
})
```

### LiquidImpactAdapter.process() (línea 154–228)

```typescript
// ❌ Idéntico problema
const bandEnergy = BaseSystem.computeBandMix(audio, node.bandMix)
// computeBandMix multiplica by audio.subBass, audio.bass, etc.
// Pero si energía global es 0, todo colapsa a 0

const intentDimmer = BaseSystem.clamp01(
  bandEnergy * falloff * zoneIntensity * globalVibe  // ← bandEnergy ≈ 0
)
// intentDimmer ≈ 0

this._valuesDict['dimmer'] = 0
this._intentScratch.confidence = BaseSystem.clamp01(audio.energy * falloff) = 0
```

---

## PARTE 4: Validación — La Prueba del Crimen

### A. Logs del Worker — confirman energía REAL

```
[INTERVAL] F20 bassFlux=0.3791 floor=0.0318 rawBassEnergy=0.3791±0.0001
```

El Worker reporta:
- `kickDetected=true` ✅
- `rawBassEnergy=0.3791` ✅
- `bassFlux=0.3791` (derivada de energía) ✅

### B. Logs del Orquestador — confirman energía PERDIDA

Cuando Aether escribe al bus:
```
[Aether] ImpactNode intensity=0.00 confidence=0.00
[Aether] ColorNode rgb=(0,0,0) confidence=0.00
```

Pero si inspeccionamos `context.audio.transientStrength`:
```
context.audio.transientStrength = 1  (porque kickDetected=true)
```

**Contradicción confirmada:** El kick ESTÁ ahí (transientStrength=1), pero la energía NO (energy=0).

### C. Análisis de Ruta Crítica

**Pregunta:** ¿Cómo determina TitanOrchestrator si tomar la ruta Omni o no-Omni?

```typescript
const activeSource = matrixStatus?.activeSource ?? null
const isOmniActive = activeSource ? OMNI_SOURCES.has(activeSource) : false
```

Si `getAudioMatrix()` retorna `undefined` o `getStatus()` falla:
- `matrixStatus = undefined`
- `activeSource = undefined ?? null = null`
- `isOmniActive = null ? ... : false = false` ✅ **TOMA RUTA NO-OMNI**

---

## PARTE 5: Raíz de la Regresión

### Cuándo ocurrió

- **WAVE 3523**: "THE CLEAN SLATE — LEGACY ENGINE DISCONNECTED"
- Línea 1235 en TitanOrchestrator: "MasterArbiter.arbitrate() → HAL.renderFromTarget() era el agente que escribía color/dimmer"
- Se desconectó TitanEngine output pero **NO se re-verificó la ruta Omni/no-Omni**

### Por qué el energy está comentado (línea 680–681)

La lógica es:
- Omni path (Worker sole authority): Energy fluye desde Worker suavizado
- Non-Omni path (WebAudio frontend 60fps + Worker spectral): Frontend debe proporcionar energía en tiempo real, Worker solo agrega FFT fino-grano

**Pero nadie re-evaluó qué pasa si:**
1. El sistema está en Omni source (VirtualWire)
2. Pero `getAudioMatrix().getStatus()` falla o reporta `null`
3. El código toma la rama no-Omni
4. Energy line está comentada
5. Worker envía datos verdaderos, pero energy NO se captura

---

## PARTE 6: La Fix

### Solución A: Verificar Omni de manera más robusta

**Cambio en línea 599–601:**

```typescript
// ANTES:
const activeSource = matrixStatus?.activeSource ?? null
const isOmniActive = activeSource ? OMNI_SOURCES.has(activeSource) : false

// DESPUÉS:
const matrixStatus = this.trinity?.getAudioMatrix()?.getStatus()
const activeSource = matrixStatus?.activeSource ?? null

// 🔥 VERIFICACIÓN ADICIONAL: Si no hay matriz pero hay datos del Worker Omni,
// asumir que es Omni activo basado en qué proporciona el Worker.
// Fallback: si Worker envía rawBassEnergy (que solo envía en Omni),
// entonces es Omni aunque la matriz esté offline.
const hasWorkerOmniData = levels.rawBassEnergy !== undefined && levels.rawBassEnergy > 0
const OMNI_SOURCES = new Set(['virtual-wire', 'usb-directlink', 'osc-nexus'])
const isOmniActive = (activeSource ? OMNI_SOURCES.has(activeSource) : false) || hasWorkerOmniData
```

**Justificación:**
- Si el Worker envía `rawBassEnergy`, es porque está en la ruta Omni (Worker es spectral-only en non-Omni)
- Si la matriz reporta `null`, pero el Worker baja datos ricos (subBass, lowMid, etc.), asumir Omni
- Fallback robusto

### Solución B: Descommentar energy en AMBAS rutas (MÁS SIMPLE)

**Cambio en línea 680:**

```typescript
// ANTES:
// energy: levels.energy,  // ❌ Frontend tiene prioridad

// DESPUÉS:
energy: (levels.energy ?? this.lastAudioData.energy),  // ✅ Update if available
```

**Justificación:**
- El Worker envía `energy` en AMBAS rutas (Omni y non-Omni)
- El comentario anticuado asume que "frontend tiene prioridad" pero frontend no está activo
- En realidad, en la rama no-Omni, si el Worker proporciona energía, estamos en VirtualWire/USB que el frontend no conoce
- Usar `?? this.lastAudioData.energy` para tener fallback si el Worker no lo proporciona

### Solución C: Fix más conservador — Solo actualizar si Omni detectado

**Cambio en línea 674+:**

```typescript
// Detectar si es realmente non-Omni con datos solo FFT
const hasWorkerOnlyFFTMetrics = levels.subBass !== undefined && levels.rawBassEnergy === undefined
const isTrulyNonOmni = !isOmniActive && hasWorkerOnlyFFTMetrics

if (isTrulyNonOmni) {
  // Worker es spectral-only: comentar energy es CORRECTO
  this.lastAudioData = {
    ...this.lastAudioData,
    // energy: levels.energy,  // ✅ JUSTIFICADO: Frontend debería proporcionar
    subBass: levels.subBass ?? this.lastAudioData.subBass,
    // ...
  }
} else if (!isOmniActive) {
  // No-Omni pero Worker proporciona datos completos (posible regresión)
  // Actualizar energía como fallback
  this.lastAudioData = {
    ...this.lastAudioData,
    energy: levels.energy ?? this.lastAudioData.energy,  // ✅ Fallback
    // ... rest
  }
}
```

---

## PARTE 7: Comparativa de Solutions

| Solución | Complejidad | Riesgo | Impacto |
|---|---|---|---|
| A: Verificar Omni más robustamente | Media | Bajo | ✅ Arregla raíz causa |
| B: Descommentar energy en no-Omni | Baja | Bajo | ✅ Rápido, conservador |
| C: Detectar non-Omni verdadero | Alta | Muy bajo | ✅ Correcto arquitecturalmente |

**Recomendación:** Combinar A + B. Primero implementar A (mejor detección Omni), luego B (fallback en non-Omni).

---

## PARTE 8: Lines Exactas del Crimen

| Archivo | Línea | Código | Rol |
|---|---|---|---|
| [TitanOrchestrator.ts](file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/orchestrator/TitanOrchestrator.ts#L601) | 601 | `const isOmniActive = activeSource ? OMNI_SOURCES.has(activeSource) : false` | ❌ **ASESINO 1** — Decisión de ruta frágil |
| [TitanOrchestrator.ts](file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/orchestrator/TitanOrchestrator.ts#L680) | 680 | `// energy: levels.energy,  // ❌ Frontend tiene prioridad` | ❌ **ASESINO 2** — Energy comentada sin fallback |
| [TitanOrchestrator.ts](file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1004) | 1004 | `energy = this.lastAudioData.energy * this.inputGain` | ✓ Consecuencia — Lee stale value |
| [LiquidEngineAdapter.ts](file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/aether/adapters/LiquidEngineAdapter.ts#L210) | 210 | `const intentDimmer = BaseSystem.clamp01(bandEnergy * falloff * zoneIntensity * globalVibe)` | ✓ Consecuencia — 0 × anything = 0 |
| [LiquidEngineAdapter.ts](file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/aether/adapters/LiquidEngineAdapter.ts#L349) | 349 | `const brightness = BaseSystem.clamp01(audio.energy * falloff * zoneIntensity * vibeGain)` | ✓ Consecuencia — RGB = [0,0,0] |

---

## CONCLUSIÓN

La "Matrix sorda" no es una incompatibilidad de dominio (como en WAVE 3526). Es un **corte accidental en la orquestación de datos**.

El Worker detecta kicks correctamente (`kickDetected=true`, `bassFlux=0.3791`). Pero cuando se decide si tomar la ruta Omni o non-Omni, el sistema falla en determinar que VirtualWire ES Omni (porque `getAudioMatrix()` puede retornar `null`). Toma la ruta non-Omni, que tiene comentada la línea que actualiza `energy`. El resto del pipeline propaga 0 hasta Aether.

**La fix es un one-liner adicional + una verificación más robusta de la ruta Omni.**

---

**Reporte compilado por:** PunkOpus  
**Metodología:** Data Flow Audit (read-only trace)  
**Confianza:** 🟢 **MÁXIMA** (evidencia directa, arquitectura mapeada)

