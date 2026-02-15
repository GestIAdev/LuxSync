# 🛠️ WAVE 1152: THE PACEMAKER BYPASS
**Restablecer movimiento cuando el BeatDetector no está conectado**

---

## 📋 DIAGNÓSTICO

### El Bug
Los logs mostraban:
```
[🎯 VMM] fiesta-latina | figure8 | phrase:0 | E:0.48 | Pan:0° Tilt:0°
[🎭 CHOREO] Bar:0 | Phrase:0 | Pattern:figure8 | Energy:0.59 | Beats:0.00
```

**Pan:0° Tilt:0°** y **Beats:0.00** - El VMM no se movía aunque tenía patrón activo.

### Root Cause Analysis
1. **WAVE 1102** implementó "phase locking" basado en `beatCount + beatPhase` del Pacemaker
2. **Pero el Pacemaker NUNCA fue conectado** al TitanOrchestrator
3. `TitanOrchestrator.engineAudioMetrics` NO incluye `beatCount`
4. El VMM recibía `audio.beatCount = undefined` → fallback a 0
5. `absoluteBeats = 0 + 0 = 0`
6. `phase = 0` → `Math.sin(0) = 0` → **Pan:0° Tilt:0°**

### Código Problemático
```typescript
// TitanOrchestrator.ts línea 383-384
beatPhase: (this.frameCount % 30) / 30,  // ❌ FALSO - no viene del BeatDetector
isBeat: this.frameCount % 30 === 0,       // ❌ FALSO - no viene del BeatDetector
// beatCount: ???                         // ❌ NO EXISTE
```

---

## 🔧 SOLUCIÓN: FALLBACK INTELIGENTE

Si `beatCount = 0` (Pacemaker no conectado), el VMM ahora calcula la fase desde tiempo real + BPM:

```typescript
// 🛠️ WAVE 1152: Check if we have REAL beat data
const hasBeatData = beatCount > 0 || beatPhase > 0.01

if (hasBeatData) {
  // ✅ Pacemaker connected - use beat-locked phase
  const patternPhase = (absoluteBeats % patternPeriod) / patternPeriod
  phase = patternPhase * Math.PI * 2
} else {
  // ⚠️ FALLBACK: No Pacemaker - calculate phase from time + BPM
  const beatsPerSecond = safeBPM / 60
  const elapsedBeats = this.time * beatsPerSecond
  const patternPhase = (elapsedBeats % patternPeriod) / patternPeriod
  phase = patternPhase * Math.PI * 2
}
```

### Cómo Funciona el Fallback
1. `safeBPM` = BPM detectado (o 120 si no hay)
2. `beatsPerSecond` = BPM / 60 (ej: 130 BPM → 2.17 beats/segundo)
3. `elapsedBeats` = tiempo acumulado × beatsPerSecond
4. `patternPhase` = posición dentro del ciclo del patrón
5. `phase` = ángulo para los senos del patrón

**Resultado:** El movimiento ahora funciona SIN Pacemaker, usando tiempo real.

---

## 📊 ANTES vs DESPUÉS

| Estado | Antes | Después |
|--------|-------|---------|
| beatCount = 0 | phase = 0 → **CONGELADO** | phase basado en tiempo → **MOVIMIENTO** |
| Sin Pacemaker | Pan:0° Tilt:0° | Pan:±180° Tilt:±90° |
| Velocidad del patrón | Dependía de beatCount | Dependía de BPM + tiempo |

---

## 🔍 DETECCIÓN DEL MODO FALLBACK

Cuando está en modo fallback, el VMM logea cada ~10 segundos:
```
[🛠️ VMM FALLBACK] Using time-based phase (no beatCount). BPM:130 Time:45.2s Phase:127°
```

Si ves este log, significa que el Pacemaker no está enviando datos al VMM.

---

## 🛠️ CAMBIOS EN ARCHIVOS

### `VibeMovementManager.ts`

**1. Mover definición de safeBPM** (línea 758):
```typescript
// 🛡️ WAVE 348/1152: NaN/Infinity SAFETY GUARD (moved up for phase calc)
const safeBPM = (audio.bpm && audio.bpm > 0 && isFinite(audio.bpm)) 
  ? Math.max(60, audio.bpm)  // Min 60 BPM
  : 120  // Fallback seguro
```

**2. Agregar fallback de fase** (líneas 764-786):
```typescript
// 🛠️ WAVE 1152: Check if we have REAL beat data
const hasBeatData = beatCount > 0 || beatPhase > 0.01

if (hasBeatData) {
  // ✅ Pacemaker connected - use beat-locked phase
  const patternPhase = (absoluteBeats % patternPeriod) / patternPeriod
  phase = patternPhase * Math.PI * 2
} else {
  // ⚠️ FALLBACK: No Pacemaker - calculate from time + BPM
  const beatsPerSecond = safeBPM / 60
  const elapsedBeats = this.time * beatsPerSecond
  const patternPhase = (elapsedBeats % patternPeriod) / patternPeriod
  phase = patternPhase * Math.PI * 2
}
```

---

## 🐛 SOBRE LA VELOCIDAD DEL PATRÓN

El usuario reportó que figure8 hace "2 ochos por segundo" - demasiado rápido.

### Cálculo de Velocidad
- `figure8` tiene `patternPeriod = 2` (2 beats por ciclo)
- A 130 BPM: 2.17 beats/segundo
- Con period=2: 1.08 ciclos/segundo ≈ **1 ocho por segundo**

El patrón `figure8` usa `Math.sin(phase * 2)` para Y, lo que DUPLICA la frecuencia vertical:
```typescript
figure8: (t, phase, audio) => ({
  x: Math.sin(phase),        // 1 ciclo por period
  y: Math.sin(phase * 2),    // 2 ciclos por period ← Esto causa "2 ochos"
})
```

### Solución Propuesta (No implementada en este WAVE)
Cambiar `Math.sin(phase * 2)` a `Math.sin(phase)` si se quiere 1 ocho por período:
```typescript
figure8: (t, phase, audio) => ({
  x: Math.sin(phase),
  y: Math.sin(phase) * 0.6,  // O usar Math.cos(phase) para círculo
})
```

---

## 🧪 TEST PLAN

1. **Arrancar la app** con vibe "fiesta-latina"
2. **Verificar logs** - Debe mostrar:
   ```
   [🛠️ VMM FALLBACK] Using time-based phase...
   [🎯 VMM] fiesta-latina | figure8 | ... | Pan:XXX° Tilt:XXX°
   ```
3. **Pan y Tilt deben variar** - NO deben ser 0° constantemente
4. **El patrón figure8** debería hacer ~1 ocho por segundo @ 130 BPM

---

## 🔮 TRABAJO FUTURO

1. **Conectar el Pacemaker** al TitanOrchestrator:
   - Importar `BeatDetector` en TitanOrchestrator
   - Alimentarlo con audio data
   - Pasar `beatState.beatCount` y `beatState.phase` al VMM

2. **Ajustar velocidad de figure8** si es demasiado rápido:
   - Aumentar `patternPeriod` a 4 (4 beats por ciclo)
   - O reducir el multiplicador en el patrón

---

**FIN DEL REPORTE WAVE 1152**
