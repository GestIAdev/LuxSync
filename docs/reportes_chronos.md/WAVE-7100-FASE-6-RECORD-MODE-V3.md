# WAVE 7100 — FASE 6: Record Mode V3

> **Fecha:** 29 Jun 2026
> **Premisa:** Record mode captura efectos del ArsenalDock en tiempo real durante la reproducción. Los FX clips se graban con Diamond Data embebido.
> **Estado:** ✅ Plomería de datos completada. tsc: 0 errores. 22/22 tests verdes.

---

## 1. Objetivos

1. Extender `RecordedClipType` a `'vibe' | 'fx'` + campos FX opcionales
2. Implementar `ChronosRecorder.recordFX()` con `HephAutomationClipV3` embebido
3. Wire `CustomFXPad.handleClick` en REC mode → `recordFX()`
4. Branch FX en `ChronosLayout.handleClipRecorded` → `createHephFXClip()`

---

## 2. Cambios

### 2.1 — ChronosRecorder.ts

**Tipos extendidos:**
```typescript
export type RecordedClipType = 'vibe' | 'fx'

export interface RecordedClip {
  // ... campos existentes ...
  // ── FX-only fields (opcionales) ──
  hephClip?: HephAutomationClipV3   // Diamond Data embebido
  hephFilePath?: string              // referencia .lfx
  zones?: string[]                   // zonas objetivo
  priority?: number                  // prioridad de blend
}
```

**Nuevo método `recordFX()`:**
- Snap a beat grid con `snapToGrid()`
- Crea `RecordedClip` con `clipType: 'fx'`, duración fija del `.lfx`
- Color derivado de `hephClip.mixBus` vía `MIXBUS_CLIP_COLORS`
- Track ID: `zone-{zones[0]}` o `zone-all` como fallback
- Emite `'clip-added'` para que ChronosLayout cree el `FXClip` en el timeline
- FX clips NO crecen (duración fija, a diferencia de vibe clips que son "living")

### 2.2 — ChronosLayout.tsx (handleClipRecorded)

**Antes:** Siempre creaba un `VibeClip` sin importar el tipo.

**Ahora (FASE 6):**
```typescript
if (clip.clipType === 'fx') {
  const timelineClip: FXClip = createHephFXClip(
    clip.displayName, clip.hephFilePath, clip.startMs,
    clip.durationMs, clip.trackId,
    clip.hephClip?.effectType ?? 'heph-custom',
    clip.hephClip, clip.zones, clip.priority,
  )
  clipState.addClip(timelineClip)
} else {
  // Vibe clip (existente)
}
```

### 2.3 — CustomFXDock.tsx (handleClick)

**Antes:** `// TODO: Preview momentáneo del clip` — no grababa nada.

**Ahora (FASE 6):**
```typescript
if (isRecording && cachedClip) {
  const recorder = getChronosRecorder()
  recorder.recordFX(
    cachedClip, clip.filePath, clip.name, clip.durationMs,
    cachedClip.spatialZones, cachedClip.priority,
  )
} else {
  onClick?.(clip)  // EDIT mode: preview (TODO futuro)
}
```

---

## 3. Flujo Record Mode V3

```
ARSENAL DOCK (REC MODE)
  │
  ├─ Click pad FX → recordFX(hephClip, filePath, name, duration, zones, priority)
  │   → snapToGrid(playhead) → RecordedClip { clipType: 'fx', hephClip, ... }
  │   → emit('clip-added')
  │
  └─ Click vibe card → recordVibe(vibeType, name, duration, color, icon)
      → snapToGrid(playhead) → LATCH close previous → RecordedClip { clipType: 'vibe' }
      → emit('clip-added')

CHRONOS LAYOUT (handleClipRecorded)
  │
  ├─ clip.clipType === 'fx' → createHephFXClip() → clipState.addClip(FXClip)
  └─ clip.clipType === 'vibe' → VibeClip → clipState.addClip(VibeClip)

TIMELINE CANVAS
  ├─ Vibe clip: crece en tiempo real (living clip, tickActiveClips)
  └─ FX clip: aparece con duración fija + Diamond Data embebido
```

---

## 4. Arquitectura de Capas (Record + Whisper)

```
1. Whisper (vibeBase) → L0 automático (90% del show)
2. ARM REC → operador graba overrides sobre la base
3. VibeClips grabados → L1 (cambian vibe temporalmente)
4. FXClips grabados → L3/Hephaestus (efectos puntuales con curvas)
5. Stop REC → clips quedan en timeline, editables
6. Guardar .lux V3 → todo persiste: vibeBase + clips + análisis
```

---

## 5. Pendiente

- **Hardware trigger:** MIDI Note On → `recordFX(efectoMapeado)` vía `useMidiLearn` (futuro)
- **Quantize to transient:** snap a transients del GodEar FFT además de beat grid (futuro)
- **Punch in/out:** grabación por regiones (futuro)
- **Auto-stop al finalizar audio:** si el audio termina mientras REC está activo (cosmético)
- **Undo wired a Ctrl+Z en REC mode** (cosmético)

---

## 6. Verificación

```
tsc --noEmit: 0 errores
vitest LuxFileV3: 22/22 passed
```
