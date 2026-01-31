# 📊 WAVE 1012: HYBRID SOURCE ARCHITECTURE
## Reporte Técnico Completo

**Fecha:** 2026-01-27  
**Estado:** ✅ IMPLEMENTADO  
**Scope:** Arquitectura de fuentes de audio híbrida para LuxSync  
**Impacto:** Restauración de 30fps visual con precisión FFT

---

## 📋 ÍNDICE

1. [El Problema](#el-problema)
2. [Diagnóstico](#diagnóstico)
3. [Root Cause](#root-cause)
4. [Solución Implementada](#solución-implementada)
5. [Cambios Técnicos](#cambios-técnicos)
6. [Validación](#validación)
7. [Lecciones Aprendidas](#lecciones-aprendidas)

---

## 🔴 El Problema

### Síntoma Inicial
El usuario reportó que todas las vibes de iluminación (Latino, Techno, Rock) estaban funcionando a **muy baja velocidad de fotogramas (FPS)**, lo que se percibía como parpadeo o animaciones entrecortadas.

> "Es como si fuera a 10km/h cuando la pista pide 100"

### Observación Crítica del Usuario
El usuario identificó que:
- **Latino y Rock**: ~95% funcionales (parpadeo casi imperceptible tras horas de entrenamiento visual)
- **Techno**: ~10% funcional (claramente roto)

**Falsa conclusión inicial:** El problema era específico de la vibe Techno.

---

## 🔍 Diagnóstico

### Fase 1: Investigación de Techno

Se investigó `TechnoStereoPhysics.ts` y se descubrió que Techno dependía de dos métricas espectrales:
- `harshness` (0-1): Detecta distorsión/acidez
- `flatness` (0-1): Detecta ruido blanco/pads

Estos activaban modos especiales:
- `acidMode = harshness > 0.60` → Colores ácidos
- `noiseMode = flatness > 0.70` → Strobe mode
- `atmosphericFloor = flatness * 0.3` → Suelo atmosférico
- `isApocalypse = harshness > 0.5 && flatness > 0.5` → Override de rescate

**Hallazgo:** Techno nunca recibía estas métricas desde `SeleneLux.ts`.

### Fase 2: Comparación con Rock

Rock SÍ recibía harshness/flatness en `SeleneLux.ts`:

```typescript
harshness: audioMetrics.harshness ?? 0.35,
spectralFlatness: audioMetrics.spectralFlatness ?? 0.40,
```

Con fallbacks inteligentes. Techno NO los recibía.

### Fase 3: Fix Inicial (INCOMPLETO)

Se agregaron harshness/flatness a Techno:

```typescript
// SeleneLux.ts
harshness: audioMetrics.harshness ?? 0.45,
flatness: audioMetrics.spectralFlatness ?? 0.35
```

**Resultado:** ❌ **NO FUNCIONÓ**

El usuario confirmó que aún funcionaba a 10fps. Esto indicó que el problema NO era específico de Techno.

### Fase 4: Epifanía - EL PROBLEMA GLOBAL

El usuario revisó visualmente las otras vibes y notó que **TAMBIÉN estaban a bajo FPS**. Se había dejado engañar por:
- Mayor cantidad de elementos visuales (instrumentación)
- Movimiento que daba ilusión de suavidad

**Nueva hipótesis:** Fuga de frames **GLOBAL** en el pipeline de audio.

---

## 🧬 Root Cause

### Descubrimiento Crítico

En `useAudioCapture.ts` (Frontend):

```typescript
const METRICS_INTERVAL_MS = 33    // 30fps
const BUFFER_INTERVAL_MS = 100    // 10fps
```

El sistema capturaba audio a DOS frecuencias diferentes:

| Intervalo | Frecuencia | Propósito |
|-----------|-----------|-----------|
| METRICS_INTERVAL_MS | **30fps** | Envía bass/mid/treble simples |
| BUFFER_INTERVAL_MS | **10fps** | Envía buffer FFT crudo al Worker |

### Arquitectura WAVE 1011.9 (DEFECTUOSA)

```
┌─────────────────────────────────────┐
│   Frontend (Cada frame ~ 16ms)      │
│  ├─ audioFrame() [30fps]            │
│  │  └─ bass, mid, treble, energy    │
│  └─ audioBuffer() [10fps]           │
│     └─ Float32Array crudo           │
└─────────────────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│   TitanOrchestrator                 │
│  ├─ processAudioFrame() → IGNORADO  │
│  └─ brain.on('audio-levels')        │
│     └─ Actualiza bass/mid/high solo │
└─────────────────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│   Worker Beta (FFT 4K + AGC)        │
│   Procesa buffer cada 100ms (10fps) │
└─────────────────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│   TitanEngine (30fps loop)          │
│   Pero recibe datos CONGELADOS cada │
│   3 frames = VISUAL a 10fps         │
└─────────────────────────────────────┘
```

### El Problema Específico

WAVE 1011.9 decidió hacer al Worker (10fps) la "ÚNICA fuente de verdad" para bass/mid/high/energy porque estaba tratando de evitar una **race condition** por parpadeo.

Pero esto causó un problema peor: **"Frame starvation"** - el sistema visual corría a la frecuencia más lenta disponible (10fps del Worker).

**Causa raíz:** No es que falle una fuente, es que se usó la fuente **más lenta** como única verdad.

---

## ✅ Solución Implementada

### Principio Fundamental

> "Cuando tienes múltiples fuentes de datos a diferentes frecuencias, no elijas una como 'verdad absoluta'. Combínalas según sus fortalezas."

### Arquitectura WAVE 1012.5: HYBRID SOURCE

```
┌────────────────────────────────────────────┐
│   Frontend (Webapi AudioContext)           │
│   Capturas: 30fps                          │
│  ├─ audioFrame() [30fps]                   │
│  │  └─ bass, mid, treble, energy           │
│  │     (Rápido, menos preciso)             │
│  └─ audioBuffer() [10fps]                  │
│     └─ Float32Array crudo para FFT         │
└────────────────────────────────────────────┘
        ↙                          ↘
   [30fps]                      [10fps]
   FAST                         SLOW
       ↓                           ↓
┌──────────────────┐     ┌─────────────────┐
│ processAudio     │     │ Worker Beta     │
│ Frame()          │     │ (FFT 4K + AGC)  │
│                  │     │                 │
│ Actualiza:       │     │ Produce:        │
│ • bass ✅        │     │ • harshness ✅  │
│ • mid ✅         │     │ • flatness ✅   │
│ • high ✅        │     │ • centroid ✅   │
│ • energy ✅      │     │ • subBass ✅    │
│                  │     │ • lowMid ✅     │
│ (30fps)          │     │ • highMid ✅    │
└──────────────────┘     │ • kick/snare ✅ │
        ↘                │                 │
         ↘               │ (10fps)         │
          ↘              │                 │
           ↘    ┌─────────┴────────┐       │
            └───→│ lastAudioData   │←──────┘
                 │ (HYBRID STORE)  │
                 │                 │
                 │ • bass/mid/high │ ← Frontend 30fps
                 │ • energy        │   (visual fluidity)
                 │ • harshness     │ ← Worker 10fps
                 │ • flatness      │   (spectral precision)
                 │ • centroid      │
                 │ • transients    │
                 └─────────────────┘
                         ↓
                   [30fps Loop]
                   TitanOrchestrator
```

### Estrategia de Asignación de Responsabilidades

#### Frontend (30fps) - "Visual Layer"
**Responsabilidad:** Proporcionar actualizaciones rápidas de energía fundamental

- **bass**: Energía sub-200Hz
- **mid**: Energía 200-4000Hz
- **high/treble**: Energía 4000-20000Hz
- **energy**: Nivel de señal general

**Ventajas:**
- Frecuencia alta (30fps)
- Bajo latency
- Reactivo a cambios rápidos (beats)
- Suficientemente preciso para fluidez visual

**Desventajas:**
- Sin análisis FFT real
- Basado en FilterBank simple
- Menos inteligencia espectral

#### Worker Beta (10fps) - "Spectral Layer"
**Responsabilidad:** Proporcionar análisis FFT profundo y métricas avanzadas

- **harshness**: Ratio energía mid-hi vs total (0-1)
- **spectralFlatness**: Detector de ruido blanco (0-1)
- **spectralCentroid**: Frecuencia dominante (Hz)
- **subBass/lowMid/highMid**: Bandas detalladas
- **kickDetected/snareDetected/hihatDetected**: Transiente detection

**Ventajas:**
- FFT 4K real (Cooley-Tukey Radix-2)
- AGC integrado
- Análisis espectral completo
- Inteligencia musical (beat, genre detection)

**Desventajas:**
- Frecuencia baja (10fps)
- Más latencia de procesamiento
- Overkill para animaciones simples

---

## 🔧 Cambios Técnicos

### 1. TitanOrchestrator.ts - processAudioFrame()

#### ANTES (WAVE 1011.9)
```typescript
processAudioFrame(data: Record<string, unknown>): void {
  if (!this.isRunning || !this.useBrain) return
  
  // ❌ BLOQUEADO - NO actualiza bass/mid/high/energy
  // const bass = typeof data.bass === 'number' ? data.bass : 0
  
  // Solo extrae métricas FFT (que nunca llegan)
  const harshness = typeof data.harshness === 'number' ? data.harshness : undefined
  
  this.lastAudioData = { 
    ...this.lastAudioData,  // Preserva worker data
    // No actualiza core bands
    harshness: harshness ?? this.lastAudioData.harshness,
  }
}
```

#### DESPUÉS (WAVE 1012.5)
```typescript
processAudioFrame(data: Record<string, unknown>): void {
  if (!this.isRunning || !this.useBrain) return
  
  // ✅ RESTAURADO - Frontend como fuente de 30fps
  const bass = typeof data.bass === 'number' ? data.bass : this.lastAudioData.bass
  const mid = typeof data.mid === 'number' ? data.mid : this.lastAudioData.mid
  const high = typeof data.treble === 'number' ? data.treble : 
               typeof data.high === 'number' ? data.high : this.lastAudioData.high
  const energy = typeof data.energy === 'number' ? data.energy : this.lastAudioData.energy
  
  // Métricas FFT (vienen del Worker)
  const harshness = typeof data.harshness === 'number' ? data.harshness : undefined
  const spectralFlatness = typeof data.spectralFlatness === 'number' ? data.spectralFlatness : undefined
  
  this.lastAudioData = { 
    bass,     // ← Frontend 30fps
    mid,      // ← Frontend 30fps
    high,     // ← Frontend 30fps
    energy,   // ← Frontend 30fps
    harshness: harshness ?? this.lastAudioData.harshness,        // ← Worker 10fps
    spectralFlatness: spectralFlatness ?? this.lastAudioData.spectralFlatness,
    // ... rest preserved from Worker
  }
  
  // Frontend también detecta audio real
  this.hasRealAudio = energy > 0.01
  this.lastAudioTimestamp = Date.now()
}
```

**Cambio clave:** Frontend ahora actualiza bass/mid/high/energy a 30fps, dando fluidez visual.

### 2. TitanOrchestrator.ts - brain.on('audio-levels')

#### ANTES (WAVE 1011.9)
```typescript
this.brain.on('audio-levels', (levels) => {
  // ⚠️ Sobrescribe TODA la data del Worker
  this.lastAudioData = {
    ...this.lastAudioData,
    bass: levels.bass,        // ← Actualiza a 10fps
    mid: levels.mid,          // ← Actualiza a 10fps
    high: levels.treble,      // ← Actualiza a 10fps
    energy: levels.energy,    // ← Actualiza a 10fps
    harshness: levels.harshness,
    // ... rest
  }
  this.hasRealAudio = levels.energy > 0.01
})
```

#### DESPUÉS (WAVE 1012.5)
```typescript
this.brain.on('audio-levels', (levels) => {
  // ✅ Worker SOLO actualiza métricas FFT, no core bands
  this.lastAudioData = {
    ...this.lastAudioData,
    
    // Core bands - IGNORADOS (Frontend tiene prioridad a 30fps)
    // bass: levels.bass,     ❌
    // mid: levels.mid,       ❌
    // high: levels.treble,   ❌
    // energy: levels.energy, ❌
    
    // FFT metrics - WORKER AUTHORITATIVE
    harshness: levels.harshness ?? this.lastAudioData.harshness,
    spectralFlatness: levels.spectralFlatness ?? this.lastAudioData.spectralFlatness,
    spectralCentroid: levels.spectralCentroid ?? this.lastAudioData.spectralCentroid,
    subBass: levels.subBass ?? this.lastAudioData.subBass,
    lowMid: levels.lowMid ?? this.lastAudioData.lowMid,
    highMid: levels.highMid ?? this.lastAudioData.highMid,
    kickDetected: levels.kickDetected ?? this.lastAudioData.kickDetected,
    snareDetected: levels.snareDetected ?? this.lastAudioData.snareDetected,
    hihatDetected: levels.hihatDetected ?? this.lastAudioData.hihatDetected,
  }
  
  // NO tocar hasRealAudio ni lastAudioTimestamp - Frontend lo hace
})
```

**Cambio clave:** Worker ahora SOLO actualiza métricas FFT. Frontend gestiona hasRealAudio.

### 3. SeleneLux.ts - Techno Physics

También se agregó harshness/flatness a Techno (fix incompleto de WAVE 1012.0):

```typescript
// WAVE 1012: Techno ahora recibe métricas espectrales
const zonesResult = technoStereoPhysics.applyZones({
  bass: audioMetrics.normalizedBass,
  mid: audioMetrics.normalizedMid,
  treble: audioMetrics.normalizedTreble,
  bpm: vibeContext.bpm ?? 120,
  melodyThreshold: 0.4,
  isRealSilence: audioMetrics.avgNormEnergy < 0.01,
  isAGCTrap: false,
  sectionType: vibeContext.section,
  harshness: audioMetrics.harshness ?? 0.45,      // ← Agregado
  flatness: audioMetrics.spectralFlatness ?? 0.35  // ← Agregado
});
```

### 4. TechnoStereoPhysics.ts - Defaults Inteligentes

```typescript
public applyZones(input: TechnoPhysicsInput): TechnoPhysicsResult {
  const { 
    bass, 
    mid, 
    treble, 
    isRealSilence, 
    isAGCTrap, 
    harshness = 0.45,  // ← Default agresivo
    flatness = 0.35    // ← Default para pads
  } = input
```

---

## 📈 Validación

### Flujo de Datos Validado

1. **Frontend audioFrame()**
   - Frecuencia: 33ms (30fps)
   - Proporciona: bass, mid, treble, energy
   - Destino: processAudioFrame() → lastAudioData

2. **Frontend audioBuffer()**
   - Frecuencia: 100ms (10fps)
   - Proporciona: Float32Array crudo
   - Destino: Trinity → Worker Beta

3. **Worker Beta Senses**
   - Frecuencia: ~10fps
   - Procesa: FFT 4K + AGC
   - Produce: harshness, flatness, centroid, transients
   - Destino: brain.on('audio-levels') → lastAudioData

4. **TitanOrchestrator Loop**
   - Frecuencia: 33ms (30fps)
   - Lee: lastAudioData (híbrido)
   - Usa: Frontend para fluidez + Worker para espectral

### Matriz de Responsabilidad

```
┌──────────────────────┬───────────────┬────────────────────┐
│ Métrica              │ Fuente        │ Frecuencia         │
├──────────────────────┼───────────────┼────────────────────┤
│ bass                 │ Frontend      │ 30fps (33ms)       │
│ mid                  │ Frontend      │ 30fps (33ms)       │
│ high/treble          │ Frontend      │ 30fps (33ms)       │
│ energy               │ Frontend      │ 30fps (33ms)       │
├──────────────────────┼───────────────┼────────────────────┤
│ harshness            │ Worker Beta   │ 10fps (100ms)      │
│ spectralFlatness     │ Worker Beta   │ 10fps (100ms)      │
│ spectralCentroid     │ Worker Beta   │ 10fps (100ms)      │
│ subBass              │ Worker Beta   │ 10fps (100ms)      │
│ lowMid               │ Worker Beta   │ 10fps (100ms)      │
│ highMid              │ Worker Beta   │ 10fps (100ms)      │
│ kickDetected         │ Worker Beta   │ 10fps (100ms)      │
│ snareDetected        │ Worker Beta   │ 10fps (100ms)      │
│ hihatDetected        │ Worker Beta   │ 10fps (100ms)      │
├──────────────────────┼───────────────┼────────────────────┤
│ hasRealAudio         │ Frontend      │ 30fps (33ms)       │
│ lastAudioTimestamp   │ Frontend      │ 30fps (33ms)       │
└──────────────────────┴───────────────┴────────────────────┘
```

---

## 🧠 Lecciones Aprendidas

### 1. El Peligro de "Single Source of Truth"

WAVE 1011.9 intentó resolver una race condition haciendo al Worker la "única fuente de verdad". Pero cuando tienes múltiples fuentes a diferentes frecuencias, **elegir la más lenta como verdad absoluta causa "frame starvation"**.

✅ **Lección:** Asigna responsabilidades según fortalezas, no según "verdad absoluta".

### 2. Race Conditions vs. Frame Starvation

**Race Condition (problema que WAVE 1011.9 intentaba resolver):**
```
Frame N:   Frontend: bass=0.5
           Worker:   bass=0.3  ← Sobrescribió
           
Resultado: parpadeo, valores inconsistentes
```

**Frame Starvation (problema causado por la "solución"):**
```
Frame 1:   Worker envía (10fps)        ← Sistema actualiza
Frame 2:   Frontend envía (30fps)      ← Sistema ignora
Frame 3:   Frontend envía (30fps)      ← Sistema ignora
Frame 4:   Worker envía (10fps)        ← Sistema actualiza
           
Resultado: visual a 10fps en lugar de 30fps
```

✅ **Lección:** Resuelve race conditions sin sacrificar frecuencia de actualización.

### 3. Importancia del Entrenamiento Visual

El usuario se dio cuenta de que visualmente las tres vibes estaban lentas solo después de notar que los movers respondían con poca intensidad. Su "ojo entrenado" lo engañó porque:
- Muchos elementos visuales disimulan bajo FPS
- La mente completa fotogramas faltantes
- Es difícil notar 10fps vs 30fps sin lado a lado

✅ **Lección:** Usa métricas objetivas (framecount) además de observación visual.

### 4. El Valor de la Observación Colaborativa

El usuario no pudo diagnosticar inicialmente porque:
- Vio síntoma en Techno
- Asumió problema específico de Techno
- Codeó una solución para Techno

Pero cuando se dio cuenta de que Latino y Rock también estaban lentos, el diagnóstico cambió completamente. La **observación colaborativa** y **cuestionamiento iterativo** fue clave.

✅ **Lección:** A veces el síntoma inicial apunta a un lugar diferente del problema real.

---

## 📊 Impacto Esperado

### Antes (WAVE 1011.9)
- **FPS Visual:** 10fps (limitado por Worker)
- **Race Condition:** Eliminada ✅
- **Precisión Espectral:** Disponible ✅
- **Fluidez Visual:** Baja ❌

### Después (WAVE 1012.5)
- **FPS Visual:** 30fps (limitado por loop principal) ✅
- **Race Condition:** Eliminada ✅
- **Precisión Espectral:** Disponible ✅
- **Fluidez Visual:** Alta ✅

---

## 🎯 Resumen Ejecutivo

### El Problema
El sistema LuxSync estaba funcionando a 10fps en lugar de 30fps, causando parpadeo y animaciones entrecortadas.

### Causa Raíz
WAVE 1011.9 intentó resolver una race condition haciendo al Worker (10fps) la única fuente de verdad para bass/mid/high/energy. Pero ignoró al Frontend (30fps), causando "frame starvation".

### La Solución
**Arquitectura Híbrida WAVE 1012.5:**
- **Frontend (30fps)** → bass/mid/high/energy (fluidez visual)
- **Worker (10fps)** → harshness/flatness/centroid/transients (precisión FFT)
- **Coexistencia:** Cada fuente se mantiene en su rol, sin sobrescribirse

### Resultado Esperado
- Sistema visual restaurado a **30fps**
- Precisión espectral FFT preservada
- Sin race conditions
- Todas las vibes (Latino, Techno, Rock) funcionando óptimamente

---

## 📁 Archivos Modificados

```
electron-app/src/core/orchestrator/TitanOrchestrator.ts
  ├─ processAudioFrame()          (Restaurado como fuente 30fps)
  └─ brain.on('audio-levels')     (Limitado a métricas FFT)

electron-app/src/core/reactivity/SeleneLux.ts
  └─ applyZones() para Techno     (Agregado harshness/flatness)

electron-app/src/hal/physics/TechnoStereoPhysics.ts
  └─ applyZones()                 (Defaults inteligentes)

docs/
  └─ WAVE-1012-HYBRID-ARCHITECTURE-REPORT.md (Este documento)
```

---

## 🚀 Próximos Pasos

1. **Testing:** Validar que todas las vibes funcionan a 30fps
2. **Monitoreo:** Verificar que no hay race conditions residuales
3. **Calibración:** Si es necesario, ajustar BUFFER_INTERVAL_MS para más frecuencia del Worker
4. **Documentación:** Actualizar guías de arquitectura de audio

---

*"El sistema perfecto no es el que elige UNA verdad absoluta, sino el que combina múltiples verdades según sus fortalezas."* 

— WAVE 1012.5: Hybrid Source Architecture

---

**Documento creado por:** GitHub Copilot  
**Fecha:** 2026-01-27  
**Versión:** 1.0  
**Estado:** Implementado en `main` branch
