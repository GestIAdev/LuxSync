# WAVE 2179 — AUDIT: PLL FREEWHEEL & SEPARACIÓN OÍDOS/CEREBRO

**Estado**: ARQUITECTURA CONGELADA + AUDIT DE BRECHA  
**Fecha**: 2026-03-09  
**Veredicto**: IntervalBPMTracker.ts y senses.ts están CONGELADOS. El Worker es perfecto.

---

## ⚖️ VETO ARQUITECTÓNICO (PunkArchytect → PunkOpus)

**VETO ABSOLUTO** a meter "meseta de confianza" en `IntervalBPMTracker.ts`.

### Separación de Responsabilidades — DOCTRINA FINAL

```
╔══════════════════════════════════════════════════════════════╗
║  OÍDOS (Worker / senses.ts + IntervalBPMTracker.ts)         ║
║  ─────────────────────────────────────────────────────────  ║
║  • Lee FFT puro cada ~46ms                                  ║
║  • Detecta kicks FÍSICAMENTE (ratio de energía sub-bass)    ║
║  • Reporta conf=0 si no hay bombo → ES HONESTO              ║
║  • NO tiene memoria a largo plazo. NO miente.               ║
║  • CONGELADO. Perfecto. No tocar.                           ║
╚══════════════════════════════════════════════════════════════╝
             │ conf + bpm + onBeat (IPC)
             ▼
╔══════════════════════════════════════════════════════════════╗
║  CEREBRO (TitanOrchestrator + BeatDetector PLL)             ║
║  ─────────────────────────────────────────────────────────  ║
║  • Ve conf=0 del Worker → activa FREEWHEEL                  ║
║  • Retiene el último BPM estable por inercia                ║
║  • pllSmoothedBpm sigue girando en el vacío                 ║
║  • Luces no se enteran del blackout hasta que conf vuelva   ║
║  • AQUÍ VIVE LA MEMORIA HUMANA. AQUÍ ESTÁ LA BRECHA.        ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 🔬 AUDIT TÉCNICO: ¿Qué pasa cuando el reggaetón llega al break?

### Flujo con el reggaetón (dump `regueton_100bpm`):

| Kick # | conf Worker | Acción Orchestrator |
|--------|-------------|---------------------|
| 18–25 | **0.70** ✅ | `setBpm(144)` + PLL locked |
| 26–33 | 0.46→0.31 | `setBpm(144)` — aún > 0.2 |
| 34 | **0.00** ❌ | Nada. `setBpm()` NO se llama. |
| 35–66 | 0.00 | PLL freewheela a 144 BPM en inercia |

### ¿Qué hace actualmente el PLL en FREEWHEEL?

En `BeatDetector.tick()` (línea ~592):
```typescript
// ── Sync PLL BPM to Pacemaker BPM when not locked ──
if (!this.pllIsLocked && this.state.bpm > 0) {
  this.pllSmoothedBpm = this.state.bpm  // ← usa state.bpm (interno del Pacemaker)
}
```

Y en `TitanOrchestrator` (línea ~500):
```typescript
if (workerBpm > 0 && workerConfidence > 0.2) {
  context.bpm = workerBpm        // ← Worker actualiza el contexto
} else if (beatState.bpm > 0 && beatState.confidence > 0) {
  context.bpm = beatState.bpm   // ← Fallback: PLL Pacemaker
}
```

---

## 🚨 BRECHA IDENTIFICADA

Cuando `workerConfidence` cae a `0.000`:

1. **`setBpm()` no se llama** → el BeatDetector interno retiene su último `state.bpm` (viejo, puede ser 120 por defecto si nunca se llamó)
2. **El fallback `beatState.bpm > 0 && beatState.confidence > 0`** usa la confidence **del BeatDetector interno**, NO la del Worker
3. **El BeatDetector nunca recibió kicks directamente** (WAVE 2112 lo demotó a PLL puro) → su `candidateBpm` puede estar en 120 (default), confidence = 0

### Resultado en producción con reggaetón:
- kicks 18–25: Worker conf=0.70 → `context.bpm = 144` ✅ Luces a 144 BPM
- kick 34+: Worker conf=0.00 → **ambas ramas fallan** → `context.bpm` **no se actualiza**
- `context.bpm` retiene el valor del frame anterior (porque TypeScript no lo resetea)
- PLL freewheela, pero `pllIsLocked = false` → `pllSmoothedBpm` se sincroniza con `state.bpm` del Pacemaker (que es 120 por default)
- Resultado: **PLL empieza a girar a 120 BPM en lugar de 144 BPM** → luces descalibradas

---

## ✅ FIX NECESARIO: Retención del último Worker BPM estable

### Localización: `TitanOrchestrator.ts` — bloque WAVE 2112 (~línea 444)

**Concepto**: El Orchestrator debe recordar el último `workerBpm` que recibió con `conf > 0.2`. Cuando el Worker envía `conf=0`, en vez de caer al fallback del Pacemaker interno (que no sabe nada), usa ese último BPM conocido para mantener el PLL girando en la frecuencia correcta.

```typescript
// ESTADO A AGREGAR en TitanOrchestrator (campo privado):
private lastStableWorkerBpm = 0       // Último BPM del Worker con conf > 0.2
private lastStableWorkerBpmAge = 0    // Frame en que fue registrado

// EN EL BLOQUE DE PROCESAMIENTO (~línea 456):

// Actualizar última referencia estable
if (workerBpm > 0 && workerConfidence > 0.2) {
  this.beatDetector.setBpm(workerBpm)
  this.lastStableWorkerBpm = workerBpm          // ← NUEVO: retener
  this.lastStableWorkerBpmAge = this.frameCount // ← NUEVO: timestamp
}

// FREEWHEEL: si el Worker está sordo pero tenemos memoria reciente (<= 300 frames = ~5s)
const framesWithoutLock = this.frameCount - this.lastStableWorkerBpmAge
if (workerConfidence <= 0.2 && this.lastStableWorkerBpm > 0 && framesWithoutLock <= 300) {
  // No llamamos setBpm() (no queremos confundir el Pacemaker)
  // Pero SÍ alimentamos el PLL con el BPM conocido
  this.beatDetector.freewheelAt(this.lastStableWorkerBpm)  // ← nuevo método en BeatDetector
}

// EN context.bpm:
if (workerBpm > 0 && workerConfidence > 0.2) {
  context.bpm = workerBpm
} else if (this.lastStableWorkerBpm > 0 && framesWithoutLock <= 300) {
  context.bpm = this.lastStableWorkerBpm  // ← FREEWHEEL retiene el BPM real
} else if (beatState.bpm > 0 && beatState.confidence > 0) {
  context.bpm = beatState.bpm  // Último fallback: Pacemaker interno
}
```

### Método `freewheelAt(bpm)` en BeatDetector:

```typescript
/**
 * WAVE 2179: FREEWHEEL MODE — PLL gira en el BPM conocido sin asumir lock.
 * Llamado por TitanOrchestrator cuando Worker conf=0 pero hay memoria reciente.
 * NO activa isLocked, NO hace clustering. Solo actualiza pllSmoothedBpm.
 */
freewheelAt(bpm: number): void {
  if (bpm >= this.minBpm && bpm <= this.maxBpm) {
    this.pllSmoothedBpm = bpm  // Girar a la frecuencia correcta
    // pllIsLocked permanece false — el Pacemaker es honesto sobre su estado
  }
}
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN (WAVE 2179 REAL)

- [ ] Agregar `lastStableWorkerBpm: number = 0` en `TitanOrchestrator`
- [ ] Agregar `lastStableWorkerBpmAge: number = 0` en `TitanOrchestrator`
- [ ] Agregar lógica de retención en el bloque WAVE 2112 del main loop
- [ ] Agregar `freewheelAt(bpm)` en `BeatDetector.ts`
- [ ] Ajustar `context.bpm` fallback chain con la nueva memoria
- [ ] Test: con el dump `regueton_100bpm`, verificar que tras kick #34 (conf=0), el contexto mantiene `bpm=144` y NO cae a 120
- [ ] Test: verificar que tras 5+ segundos sin señal, el sistema SÍ cae al Pacemaker interno (timeout correcto)

---

## 🎯 ESTADO FINAL DE COMPONENTES

| Componente | Estado | Acción |
|---|---|---|
| `IntervalBPMTracker.ts` | 🔒 **CONGELADO** | Tocar JAMÁS |
| `senses.ts` | 🔒 **CONGELADO** | Tocar JAMÁS |
| `BeatDetector.ts` | 🔧 **Pendiente** | Agregar `freewheelAt()` |
| `TitanOrchestrator.ts` | 🔧 **Pendiente** | Retención `lastStableWorkerBpm` |

---

## Score WAVE 2178 (base para 2179)

**54 GREEN | 4 skip (legacy) | 0 FAIL**  
Dance Pocket Folder confirmado en producción.  
Worker: perfecto. Cerebro: necesita el volante de inercia con la frecuencia correcta.
