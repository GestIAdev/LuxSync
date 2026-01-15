# WAVE 265: STALENESS DETECTION - ANTI-SIMULACIÓN

**Fecha**: 2025-01-XX
**Estado**: ✅ IMPLEMENTADA

## 🎯 Problema

Cuando el frontend de audio muere (loop de `requestAnimationFrame` colapsa), el backend (TitanOrchestrator) seguía procesando con **datos congelados** del último frame de audio. Esto viola el **Axioma Anti-Simulación**: el sistema estaba "animando" luces basándose en audio viejo, creando una ilusión falsa de reactividad.

**Síntomas observados:**
- Frontend envía audio hasta frame ~1382 IPC (~23 segundos)
- Después de eso, el backend sigue con valores idénticos (`Energy=0.20`, `bass=0.75`)
- Las luces siguen "moviendo" basándose en audio muerto

## ✅ Solución Implementada

### 1. Staleness Detection en TitanOrchestrator

**Archivo**: `src/core/orchestrator/TitanOrchestrator.ts`

```typescript
// 🗡️ WAVE 265: STALENESS DETECTION
private lastAudioTimestamp = 0
private readonly AUDIO_STALENESS_THRESHOLD_MS = 500 // 500ms sin audio = stale
```

### 2. Verificación en processFrame()

En cada frame, se verifica si el audio es fresco:

```typescript
// 🗡️ WAVE 265: STALENESS DETECTION - Verificar frescura del audio
const now = Date.now()
if (this.hasRealAudio && (now - this.lastAudioTimestamp) > this.AUDIO_STALENESS_THRESHOLD_MS) {
  if (shouldLog) {
    console.warn(`[TitanOrchestrator] ⚠️ AUDIO STALE - no data for ${now - this.lastAudioTimestamp}ms, switching to silence`)
  }
  this.hasRealAudio = false
  // Reset lastAudioData para no mentir con datos viejos
  this.lastAudioData = { bass: 0, mid: 0, high: 0, energy: 0 }
}
```

### 3. Actualización de timestamp en recepción

Cada vez que llega audio nuevo, se actualiza el timestamp:

**En processAudioFrame():**
```typescript
// 🗡️ WAVE 265: Update timestamp para staleness detection
this.lastAudioTimestamp = Date.now()
```

**En processAudioBuffer():**
```typescript
// 🗡️ WAVE 265: Update timestamp - el buffer llegando ES la señal de que el frontend vive
this.lastAudioTimestamp = Date.now()
```

## 📊 Resultado

### Antes de WAVE 265:
- Backend continúa con `Energy=0.20`, `bass=0.75` infinitamente
- **SIMULACIÓN IMPLÍCITA** - datos falsos

### Después de WAVE 265:
- Si no hay audio en 500ms, se resetea a ceros
- `Energy=0.00`, `bass=0.00`, `mid=0.00`
- **SILENCIO REAL** - honestidad total

## 🔍 Problema Pendiente: Muerte del Frontend

El frontend de audio sigue muriendo después de ~23-53 segundos. Esto no es problema de staleness (eso ya está manejado), sino de **memory leak o GC pressure** en el hook `useAudioCapture.ts`.

### Observaciones:
- `[IPC 📡] audioBuffer` deja de llegar después de 1000-3000 IPCs
- El loop de `requestAnimationFrame` parece colapsar
- Sin logs de error visibles

### Próxima investigación (WAVE 266+):
1. Agregar heartbeat IPC para detectar muerte del renderer
2. Profiling de memoria del hook useAudioCapture
3. Posible causa: TypedArray allocation en getFloatTimeDomainData?

## 🏛️ Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `src/core/orchestrator/TitanOrchestrator.ts` | lastAudioTimestamp, staleness check, timestamp updates |

## 🎭 Axioma Anti-Simulación

> "Se prohíbe el uso de [...] mocks, demos, simulaciones para simular la lógica de negocio. Toda función debe ser real, medible y determinista, o no debe existir."

Esta wave cumple el axioma: cuando no hay audio REAL, el sistema muestra **CEROS REALES**, no una animación falsa.
