# 🧨 WAVE 2140 — THE AMNESIA PROTOCOL
## Confidence Decay & Vibe Reset

**Fecha:** 2026-03-06  
**Estado:** ✅ DEPLOYADO — 0 errores TypeScript  
**Autores:** PunkArchytect (diseño) + PunkOpus (implementación)

---

## 🎯 PROBLEMA DIAGNOSTICADO

El motor 1163.5 detectaba correctamente `raw=86 BPM` en géneros latinos, pero la State Machine se negaba a soltar el `161 BPM` del track anterior.

**Raíz del problema: DOBLE amnesia fallida**
1. **Confirmation Bias:** `stableConfidence` atascado en `0.833` → el dictador 161 nunca perdía su trono aunque nadie lo respaldara.
2. **Ghost Memory:** Al cambiar de Vibe (`lux:setVibe: fiesta-latina`), el Pacemaker mantenía toda su historia del track anterior en memoria.

---

## 💉 LA CIRUGÍA — 5 ARCHIVOS, 0 HACKS

### ARCHIVO 1: `PacemakerV2.ts` — Confidence Bleed

**Ubicación:** `updateBpmFromClusters()`, Step 4

**Mecanismo:**
```
Antes (democracia ciega):
  currentConfidence = dominanceRatio  ← siempre se recarga sin importar divergencia

Después (democracia con memoria):
  Si rawBpm diverge de stableBpm (> BPM_STABILITY_DELTA):
    currentConfidence *= 0.95   ← el dictador sangra 5% por clustering call
    Si rawConfidence > currentConfidence:
      → CAMBIO DE TRONO (log explícito)
      currentConfidence = rawConfidence
  Si rawBpm coincide:
    currentConfidence = rawConfidence  ← recarga normal
```

**Matemática:** Con divergencia sostenida, el 161 BPM pierde su confianza así:
- Frame 1: `0.833 × 0.95 = 0.791`
- Frame 5: `0.833 × 0.95^5 = 0.651`
- Frame 14: `0.833 × 0.95^14 = 0.395`
- Frame 20: `0.833 × 0.95^20 = 0.301`

Si `rawConfidence = 0.5` (clustering dominante para 86 BPM), el cambio se dispara en ~**10 clustering calls** (≈ 10 beats a 86 BPM = ~7 segundos). Sin parches, sin Math.random().

---

### ARCHIVO 2: `WorkerProtocol.ts` — Nuevo MessageType

```typescript
// 🧨 WAVE 2140: AMNESIA PROTOCOL — Hard reset on Vibe change
RESET_PACEMAKER = 'reset_pacemaker'
```

Añadido entre `SET_BPM` y `SYSTEM_SLEEP`. Sigue el mismo patrón que todos los demás tipos del protocolo.

---

### ARCHIVO 3: `TrinityOrchestrator.ts` — Método `resetPacemaker()`

```typescript
resetPacemaker(): void {
  const beta = this.nodes.get('beta');
  if (beta?.worker) {
    this.sendToWorker('beta', MessageType.RESET_PACEMAKER, {}, MessagePriority.HIGH);
  }
}
```

Patrón idéntico a `setBpm()` y `setVibe()`. Mínima superficie de API.

---

### ARCHIVO 4: `senses.ts` (Worker BETA) — Handler `RESET_PACEMAKER`

```typescript
case MessageType.RESET_PACEMAKER:
  pacemakerV2.reset();
  console.log('[BETA] 🧨 WAVE 2140: PacemakerV2 HARD RESET — Amnesia Protocol executed');
  break;
```

`pacemakerV2.reset()` ya existía y ya borraba: intervals[], stableBpm, confidence, kickLevel, energyHistory, todo. No necesitamos crear nada nuevo.

---

### ARCHIVO 5: `TitanOrchestrator.ts` — `setVibe()` dispara el reset

```typescript
// DENTRO de setVibe(), tras propagar a HAL:

// 🧨 WAVE 2140: AMNESIA PROTOCOL
if (this.trinity) {
  this.trinity.resetPacemaker()
}
```

**Flujo completo activado por `lux:setVibe`:**
```
IPC: lux:setVibe('fiesta-latina')
  → TitanOrchestrator.setVibe()
    → engine.setVibe()        ← Comportamiento
    → trinity.setVibe()       ← SectionTracker
    → hal.setVibe()           ← Física de movimiento
    → trinity.resetPacemaker() ← 🧨 NUEVO: Borra ghost BPM
      → BETA Worker recibe RESET_PACEMAKER
        → pacemakerV2.reset()  ← Todo en blanco
```

---

## 📊 RESULTADO ESPERADO

| Escenario | Antes | Después |
|-----------|-------|---------|
| Track latino sigue al techno | 161 BPM atascado ∞ | Lock en 86 BPM en ~7s |
| DJ cambia Vibe manualmente | Ghost del track anterior | Pizarra en blanco inmediata |
| Chronos dispara setVibe | Ídem | Ídem |
| Track mismo género | Sin cambio | Sin cambio (stable se recarga) |

---

## 🔗 CADENA DE CAUSALIDAD

```
Confidence Bleed:  stableBpm diverge → -5%/call → rawConfidence gana → trono cambia
Vibe Hard Reset:   setVibe() → resetPacemaker() → pacemakerV2.reset() → escucha limpia
```

Los dos mecanismos son **complementarios y no mutuamente excluyentes:**
- El Bleed funciona aunque no haya cambio de Vibe (mismo track, diferente sección)
- El Reset funciona aunque el Bleed aún no haya terminado su trabajo

**PERFECTION FIRST. No MVPs. Full medicine.**
