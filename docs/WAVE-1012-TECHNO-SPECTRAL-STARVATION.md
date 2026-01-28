# 🎛️ WAVE 1012: HYBRID SOURCE ARCHITECTURE

## 📅 Fecha: 2026-01-27

---

## � WAVE 1012.0: TECHNO SPECTRAL STARVATION (INCOMPLETO)

### Síntoma Original
> "SOLO OCURRE EN LA VIBE DE TECHNO"

### Diagnóstico Inicial
Techno no recibía `harshness`/`flatness` y tenía defaults de CERO.

### Fix Aplicado
- SeleneLux.ts: Pasar harshness/flatness a Techno
- TechnoStereoPhysics.ts: Defaults inteligentes (0.45/0.35)

### ❌ RESULTADO: NO FUNCIONÓ

---

## � WAVE 1012.5: EL VERDADERO PROBLEMA - FRAME STARVATION

### Nueva Observación
> "Latino y Rock TAMBIÉN funcionan a bajo FPS... me engañó mi ojo entrenado"

### Root Cause REAL

El problema NO era específico de Techno. Era **GLOBAL** - una **fuga de frames**.

**Descubrimiento:**

```typescript
// useAudioCapture.ts
const METRICS_INTERVAL_MS = 33    // ← Frontend envía métricas a 30fps
const BUFFER_INTERVAL_MS = 100    // ← PERO el buffer FFT solo va a 10fps!
```

**Arquitectura WAVE 1011.9 (rota):**

```
Frontend (30fps) → [bass/mid/high] → IGNORADO ❌
Worker (10fps)   → [bass/mid/high + FFT] → ÚNICA fuente ✅
```

**Resultado:** Sistema visual corriendo a **10fps** en lugar de **30fps**.

### Solución: HYBRID SOURCE ARCHITECTURE

```
Frontend (30fps) → bass/mid/high/energy → Fluidez visual ✅
Worker (10fps)   → harshness/flatness/centroid/transients → Precisión FFT ✅
```

**Cada fuente tiene su rol:**

| Fuente | Frecuencia | Proporciona | Prioridad |
|--------|------------|-------------|-----------|
| Frontend | 30fps | bass, mid, high, energy | **VISUAL** (fluidez) |
| Worker | 10fps | harshness, flatness, centroid, subBass, lowMid, highMid, kicks, snares, hihats | **SPECTRAL** (precisión) |

### Implementación

**1. processAudioFrame() - Frontend como fuente de alta frecuencia:**

```typescript
processAudioFrame(data: Record<string, unknown>): void {
  // Core bands - FRONTEND SOURCE (30fps)
  const bass = typeof data.bass === 'number' ? data.bass : this.lastAudioData.bass
  const mid = typeof data.mid === 'number' ? data.mid : this.lastAudioData.mid
  // ...
  
  this.lastAudioData = { 
    bass, mid, high, energy,  // ← Frontend (30fps)
    harshness: harshness ?? this.lastAudioData.harshness,  // ← Worker (preservado)
    // ...
  }
  this.hasRealAudio = energy > 0.01
}
```

**2. brain.on('audio-levels') - Worker como fuente de métricas FFT:**

```typescript
this.brain.on('audio-levels', (levels) => {
  this.lastAudioData = {
    ...this.lastAudioData,
    // Core bands - IGNORADOS (Frontend es más rápido)
    // bass: levels.bass,  ❌
    
    // FFT metrics - WORKER AUTHORITATIVE
    harshness: levels.harshness,  // ✅
    spectralFlatness: levels.spectralFlatness,  // ✅
    // ...
  }
})
```

---

## 📁 Archivos Modificados

1. `electron-app/src/core/orchestrator/TitanOrchestrator.ts`
   - `processAudioFrame()`: Restaurado como fuente de bass/mid/high/energy (30fps)
   - `brain.on('audio-levels')`: Ahora solo actualiza métricas FFT extendidas

2. `electron-app/src/core/reactivity/SeleneLux.ts`
   - Techno ahora recibe harshness/flatness

3. `electron-app/src/hal/physics/TechnoStereoPhysics.ts`
   - Defaults inteligentes para harshness/flatness

---

## 🧠 LECCIÓN APRENDIDA

> "Cuando tienes dos fuentes de datos a diferentes frecuencias, NO elijas una como 'verdad absoluta'. Combínalas según sus fortalezas."

- **Frontend**: Rápido (30fps) pero impreciso espectralmente
- **Worker**: Lento (10fps) pero preciso espectralmente
- **Solución**: Híbrido - cada uno aporta lo que mejor hace

---

*"El agua del río no fluye por un solo canal."* - WAVE 1012.5
