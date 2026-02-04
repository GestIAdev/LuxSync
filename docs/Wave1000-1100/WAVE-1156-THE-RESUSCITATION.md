# WAVE 1156: THE RESUSCITATION 💓

**Status:** ✅ PARTIAL SUCCESS  
**Fecha:** 2026-02-04  
**Autor:** PunkOpus  
**Categoría:** BUG FIX (Critical)

---

## 🎯 PROBLEMA ORIGINAL

### 1. El Pacemaker Sordo (BPM Eterno 120)

**Síntoma:**
```
[💓 PACEMAKER] bass=0.43 | kicks=330 | bpm=120 (raw:120) | beats=297
[💓 PACEMAKER] bass=0.61 | kicks=340 | bpm=120 (raw:120) | beats=305
```

El BPM **NUNCA** se actualizaba, quedando congelado en 120 eternamente.

**Root Cause:**
```typescript
// BeatDetector.ts - ANTES
private kickThreshold = 0.65  // ❌ ABSURDO
```

**Matemática del desastre:**
- Audio normalizado por AGC: valores típicos **0.0 - 0.8**
- Transiente real de kick: bass salta de `0.2 → 0.5` = **delta 0.3**
- Condición: `bassTransient > 0.65` ❌
- Resultado: **0.3 < 0.65 → NUNCA SE DETECTA KICK**
- Sin kicks → sin intervalos → sin clustering → **BPM frozen at 120**

---

## 🛠️ SOLUCIÓN IMPLEMENTADA

### Paso 1: Thresholds Realistas

```typescript
// WAVE 1156: Thresholds corregidos basados en audio normalizado
private kickThreshold = 0.15   // Era 0.65 - kick real: ~0.2-0.4
private snareThreshold = 0.12  // Era 0.55 - snare real: ~0.15-0.3
private hihatThreshold = 0.08  // Era 0.45 - hihat real: ~0.1-0.2
```

### Paso 2: Niveles Mínimos Ajustados

```typescript
// ANTES: Niveles mínimos demasiado altos
this.state.kickDetected = bassTransient > 0.65 && metrics.bass > 0.45

// DESPUÉS: Niveles realistas para audio normalizado
this.state.kickDetected = bassTransient > 0.15 && metrics.bass > 0.25
this.state.snareDetected = midTransient > 0.12 && metrics.mid > 0.20
this.state.hihatDetected = trebleTransient > 0.08 && metrics.treble > 0.15
```

### Paso 3: Diagnóstico Añadido

```typescript
// Log cada 2 segundos (~60 frames @ 30fps)
if (this.diagnosticFrames % 60 === 0) {
  console.log(`[💓 PACEMAKER] bass=${metrics.bass.toFixed(2)} transient=${bassTransient.toFixed(3)} | kicks=${this.kicksDetectedTotal} | bpm=${this.state.bpm.toFixed(0)} (raw:${this.state.rawBpm.toFixed(0)}) | beats=${this.state.beatCount}`)
}
```

### Paso 4: Diagnóstico de Intervalos

```typescript
// Log cada 4 segundos mostrando intervalos detectados
if (this.diagnosticFrames % 120 === 0 && intervals.length > 0) {
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
  console.log(`[💓 INTERVALS] valid=${intervals.length} rejected=${rejectedIntervals} | avg=${avgInterval.toFixed(0)}ms (${(60000/avgInterval).toFixed(0)}bpm)`)
}
```

---

## 📊 RESULTADOS (Log Real)

### ✅ **MÚSICA LENTA (Psydub ~85-105 BPM)**

```
[💓 PACEMAKER] bass=0.75 transient=-0.005 | kicks=129 | bpm=105 (raw:71) | beats=109
[💓 PACEMAKER] bass=0.52 transient=0.036 | kicks=129 | bpm=105 (raw:71) | beats=109
[💓 PACEMAKER] bass=0.53 transient=0.000 | kicks=139 | bpm=85 (raw:85) | beats=119
```

**✅ FUNCIONA CORRECTAMENTE:**
- BPM detecta 105 → luego cambia a 85
- Beats aumentan: 109 → 111 → 119 → 121
- Sistema **SE ACTUALIZA**

### ❌ **MÚSICA RÁPIDA (Techno ~162 BPM)**

```
[💓 PACEMAKER] bass=0.43 transient=-0.002 | kicks=330 | bpm=120 (raw:120) | beats=297
[💓 PACEMAKER] bass=0.58 transient=0.024 | kicks=332 | bpm=120 (raw:120) | beats=298
[💓 PACEMAKER] bass=0.66 transient=0.005 | kicks=350 | bpm=120 (raw:120) | beats=314
```

**❌ SIGUE CONGELADO:**
- Kicks detectados: 330 → 332 → 350 (✅ aumenta)
- Beats detectados: 297 → 298 → 314 (✅ aumenta)
- BPM: **120 → 120 → 120** (❌ congelado)

**Hipótesis:**
1. **Transientes negativos/débiles** → AGC comprimiendo picos en música rápida
2. **Intervalos inconsistentes** → Clustering no encuentra patrón dominante
3. **Histéresis nunca se completa** → Necesita 45 frames estables @ ±2.5 BPM

---

## 🔬 ANÁLISIS TÉCNICO

### Por qué funciona en Dub pero no en Techno

| Factor | Dub (85-105 BPM) | Techno (160+ BPM) |
|--------|------------------|-------------------|
| **Intervalo kick** | 570-700ms | 370ms |
| **Compresión AGC** | Baja (picos naturales) | Alta (todo suena fuerte) |
| **Transientes** | +0.036 (claros) | -0.002 (aplastados) |
| **Consistencia** | Alta (kick groove simple) | Baja (fills, hi-hats, variaciones) |

**Techno es DIFÍCIL porque:**
- Los kicks están **rodeados de hi-hats** (cada 185ms)
- El AGC "aplasta" los picos → bass siempre alto → transientes débiles
- Los intervalos oscilan: 370ms (kick) + 185ms (hi-hat) = **caos para clustering**

---

## 🎯 PRÓXIMOS PASOS (WAVE 1157?)

### Opción 1: Adaptive Thresholds
```typescript
// Bajar threshold si no detectamos kicks en 5 segundos
if (kicksLast5s < 10 && this.kickThreshold > 0.08) {
  this.kickThreshold *= 0.9  // Bajar 10%
}
```

### Opción 2: Tempo Range Hint
```typescript
// Pasar hint de rango esperado desde UI
constructor(config: AudioConfig & { tempoRange?: 'slow' | 'normal' | 'fast' }) {
  if (tempoRange === 'fast') {
    this.MIN_INTERVAL_MS = 200  // 300 BPM max
  }
}
```

### Opción 3: Pre-process AGC Output
```typescript
// Expandir dinámicamente antes de BeatDetector
const expandedBass = Math.pow(metrics.bass, 0.7)  // Restaurar picos
```

### Opción 4: Multi-band Kick Detection
```typescript
// Usar subBass (20-60Hz) en lugar de bass (60-250Hz)
const kickTransient = metrics.subBass - this.prevSubBass
```

---

## 📝 ARCHIVOS MODIFICADOS

- `electron-app/src/engine/audio/BeatDetector.ts`
  - Línea 136-138: Thresholds 0.65/0.55/0.45 → 0.15/0.12/0.08
  - Línea 199-203: Niveles mínimos reducidos
  - Línea 205-208: Diagnóstico añadido
  - Línea 224: Fallback threshold 0.35 → 0.10
  - Línea 274-281: Log de intervalos para debugging

---

## ✅ CONCLUSIÓN

**PARTIAL SUCCESS:**
- ✅ Música lenta (60-120 BPM): **FUNCIONA**
- ❌ Música rápida (160+ BPM): **REQUIERE MÁS TRABAJO**

El problema del **BPM Eterno 120** está **parcialmente resuelto**. Los thresholds absurdos eran la causa principal, pero Techno expone un **problema arquitectónico más profundo**: el AGC está "aplastando" los transientes que el BeatDetector necesita.

**Radwulf:** Necesitamos decidir:
1. ¿Implementar WAVE 1157 con adaptive thresholds?
2. ¿Usar subBass para kicks (bypass AGC)?
3. ¿Pre-procesamiento de expansión dinámica?

---

**STATUS:** 🟡 Parcialmente funcional - Techno requiere iteración adicional
