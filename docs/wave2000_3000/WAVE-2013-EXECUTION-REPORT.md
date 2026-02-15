# WAVE 2013: THE LIVING CLIP - EXECUTION REPORT

**Date**: February 9, 2026  
**Status**: ✅ COMPLETED  
**Directive Origin**: PunkOpus Realtime Specialist → Claude Opus (Canvas & Logic)  
**Objective**: Clips que crecen visualmente + edición básica + preparación Stage Simulator  

---

## 📋 EXECUTIVE SUMMARY

**Resultado**: Sistema "Living Clip" completamente implementado:
- ✅ Dynamic Recording: Los clips crecen en tiempo real durante la grabación
- ✅ Clip Editing: Move, Resize, Delete con snap to grid (ya existía, verificado)
- ✅ Stage Simulator Link: ChronosInjector listo para enviar comandos al Stage

---

## 🎬 PHASE 1: DYNAMIC RECORDING (EL CLIP VIVIENTE)

### Objetivo
El usuario ve cómo el bloque de color se "estira" siguiendo al cursor rojo mientras graba.

### Implementación

#### 1. ChronosRecorder.ts - tickActiveClips()
```typescript
// Nuevo método que actualiza clips activos en cada frame
private tickActiveClips(): void {
  if (!this.state.isRecording) return
  
  // Update active Vibe clip (Latch mode - grows until replaced)
  if (this.state.activeVibeClipId) {
    const vibeClip = this.state.clips.find(c => c.id === this.state.activeVibeClipId)
    if (vibeClip) {
      const newDuration = this.state.playheadMs - vibeClip.startMs
      if (newDuration > 0 && newDuration !== vibeClip.durationMs) {
        vibeClip.durationMs = newDuration
        this.emit('clip-growing', { clip: vibeClip })
      }
    }
  }
}
```

**Integración**: Se llama automáticamente desde `updatePlayhead()`:
```typescript
updatePlayhead(positionMs: number): void {
  this.state.playheadMs = positionMs
  this.emit('playhead-update', { playheadMs: positionMs })
  this.tickActiveClips()  // <-- WAVE 2013: Tick the living clip
}
```

#### 2. Nuevo evento: `'clip-growing'`
```typescript
export type RecorderEventType = 
  | 'record-start'
  | 'record-stop'
  | 'clip-added'
  | 'clip-removed'
  | 'clip-updated'   // Latch mode - vibe duration changed
  | 'clip-growing'   // 🆕 WAVE 2013: Real-time clip growth
  | 'playhead-update'
```

#### 3. ChronosLayout.tsx - Event Listener
```typescript
// Handle real-time clip growth during recording
const handleClipGrowing = (data: { clip: RecordedClip }) => {
  const clip = data.clip
  clipState.updateClip(clip.id, {
    endMs: clip.startMs + clip.durationMs,
  })
}

recorder.on('clip-growing', handleClipGrowing)
```

#### 4. ClipRenderer.tsx - Visual Indicator
Nuevo prop `isGrowing`:
```typescript
export interface ClipRendererProps {
  // ... existing props
  isGrowing?: boolean  // WAVE 2013: Active recording pulse
}
```

Efecto visual pulsante en el borde derecho:
```tsx
{isGrowing && (
  <rect
    x={width - 4}
    y={0}
    width={6}
    height={height}
    fill="#ff0055"
    opacity={0.9}
    rx={2}
    ry={2}
  >
    <animate
      attributeName="opacity"
      values="0.9;0.4;0.9"
      dur="0.5s"
      repeatCount="indefinite"
    />
  </rect>
)}
```

#### 5. TimelineCanvas.tsx - Pass Growing State
```typescript
<ClipRenderer
  key={clip.id}
  clip={clip}
  // ... other props
  isGrowing={growingClipId === clip.id}
/>
```

---

## 🖱️ PHASE 2: CLIP EDITING (CORRECCIÓN DE ERRORES)

### Status: Ya Implementado (WAVE 2006-2007)

Las herramientas de edición ya existían en el sistema:

#### Move (Arrastrar izquierda/derecha)
**Hook**: `useTimelineClips.ts → moveClip()`
```typescript
const moveClip = useCallback((clipId: string, newStartMs: number) => {
  const clip = clips.find(c => c.id === clipId)
  if (!clip || clip.locked) return
  
  const duration = clip.endMs - clip.startMs
  const [snappedStart] = snapTime(Math.max(0, newStartMs))
  
  updateClip(clipId, {
    startMs: snappedStart,
    endMs: snappedStart + duration,
  })
}, [clips, snapTime, updateClip])
```

#### Resize (Alargar/acortar desde borde)
**Hook**: `useTimelineClips.ts → resizeClip()`
```typescript
const resizeClip = useCallback((clipId: string, edge: 'left' | 'right', newTimeMs: number) => {
  const clip = clips.find(c => c.id === clipId)
  if (!clip || clip.locked) return
  
  const [snappedTime] = snapTime(Math.max(0, newTimeMs))
  const minDuration = 500 // 500ms minimum
  
  if (edge === 'left') {
    const maxStart = clip.endMs - minDuration
    const newStart = Math.min(snappedTime, maxStart)
    updateClip(clipId, { startMs: newStart })
  } else {
    const minEnd = clip.startMs + minDuration
    const newEnd = Math.max(snappedTime, minEnd)
    updateClip(clipId, { endMs: newEnd })
  }
}, [clips, snapTime, updateClip])
```

#### Delete (Click + Supr)
**Hook**: `useTimelineKeyboard.ts`
```typescript
case 'Delete':
case 'Backspace':
  if (selectedIds.size > 0) {
    e.preventDefault()
    onDeleteSelected()
    console.log('[Keyboard] 🗑️ Delete selected clips')
  }
  break
```

**Implementación en useTimelineClips.ts**:
```typescript
const deleteSelected = useCallback(() => {
  setClips(prev => prev.filter(c => !selectedIds.has(c.id)))
  setSelectedIds(new Set())
}, [selectedIds])
```

### Keyboard Shortcuts Disponibles
| Key | Action |
|-----|--------|
| Delete / Backspace | Borrar clips seleccionados |
| Ctrl+C | Copiar clips |
| Ctrl+V | Pegar en playhead |
| Ctrl+D | Duplicar seleccionados |
| Ctrl+A | Seleccionar todos |
| Escape | Deseleccionar |
| Space | Play/Pause |

---

## 🚀 PHASE 3: STAGE SIMULATOR LINK (PREPARACIÓN)

### ChronosInjector.ts - Nuevo Módulo

Puente entre Timeline y Stage Simulator 3D:

```
┌─────────────────────────┐
│     Chronos Timeline    │
│    (clips, playhead)    │
└───────────┬─────────────┘
            │ tick(clips, currentTimeMs)
            ▼
┌─────────────────────────┐
│    CHRONOS INJECTOR     │
│  - Reads active clips   │
│  - State diffing        │
│  - Emits StageCommands  │
└───────────┬─────────────┘
            │ subscribe(listener)
            ▼
┌─────────────────────────┐
│   StageSimulator2 API   │
│  (Three.js / WebGL)     │
└─────────────────────────┘
```

#### API del Injector

**subscribe(listener)**: Registra un listener para comandos de Stage
```typescript
const unsubscribe = injector.subscribe((command: StageCommand) => {
  // Handle command in Stage Simulator
  stageSimulator.processCommand(command)
})
```

**tick(clips, currentTimeMs)**: Procesa clips cada frame
```typescript
// Called in ChronosLayout during playback
if (streaming.isPlaying && !isRecording) {
  injector.tick(clipState.clips, streaming.currentTimeMs)
}
```

**StageCommand Types**:
```typescript
type: 'vibe-change' | 'fx-trigger' | 'fx-stop' | 'intensity-change'
effectId: string
displayName: string
intensity?: number
color?: string
durationMs?: number
timestamp: number
```

#### State Diffing

El Injector solo emite eventos cuando hay CAMBIOS reales:
- Vibe cambia → Emite `'vibe-change'`
- FX nuevo comienza → Emite `'fx-trigger'`
- FX termina → Emite `'fx-stop'`

Esto evita spam de eventos en cada frame.

#### Integración en ChronosLayout

```typescript
// Get injector instance
const injector = useMemo(() => getChronosInjector(), [])

// Tick during playback (not recording)
useEffect(() => {
  if (streaming.isPlaying && !isRecording) {
    injector.tick(clipState.clips, streaming.currentTimeMs)
  }
}, [streaming.currentTimeMs, streaming.isPlaying, isRecording])

// Reset when playback stops
useEffect(() => {
  if (!streaming.isPlaying) {
    injector.reset()
  }
}, [streaming.isPlaying])
```

---

## 🔧 ARCHIVOS MODIFICADOS

### Nuevos
| Archivo | Propósito |
|---------|-----------|
| `src/chronos/core/ChronosInjector.ts` | Bridge a Stage Simulator |

### Modificados
| Archivo | Cambios |
|---------|---------|
| `ChronosRecorder.ts` | Añadido `tickActiveClips()`, evento `'clip-growing'`, getter `activeVibeClipId` |
| `ChronosLayout.tsx` | Import ChronosInjector, listener para `'clip-growing'`, injector.tick() useEffect |
| `TimelineCanvas.tsx` | Nuevo prop `growingClipId` |
| `ClipRenderer.tsx` | Nuevo prop `isGrowing`, animación SVG pulsante |

### Verificación
```
✅ TypeScript check: 0 errores en módulos Chronos
✅ Todos los archivos compilan correctamente
```

---

## 🎯 TESTING SCENARIOS

### Test 1: Living Clip Growth
```
1. Cargar audio, establecer BPM
2. Click ARM → Estado "Armed"
3. Play → Starts recording
4. Click Vibe TECHNO → Clip aparece con pulso rojo pulsante
5. Observe → Clip crece horizontalmente en tiempo real
6. Click Vibe CHILL → TECHNO se congela, CHILL empieza a crecer
7. Stop → CHILL se congela
```

### Test 2: Clip Move with Snap
```
1. Tener clip en timeline
2. Hover sobre clip → Cursor cambia a pointer
3. Drag horizontalmente → Clip se mueve
4. Soltar cerca de beat → Snap magnético a grid
```

### Test 3: Clip Resize
```
1. Hover sobre borde derecho de clip
2. Cursor cambia a ew-resize
3. Drag derecha → Clip se alarga
4. Drag izquierda → Clip se acorta (min 500ms)
```

### Test 4: Delete Clip
```
1. Click en clip → Selected (halo blanco)
2. Press Delete/Backspace → Clip eliminado
3. Console: "[Keyboard] 🗑️ Delete selected clips"
```

### Test 5: Stage Injector (durante playback)
```
1. Tener clips grabados en timeline
2. Stop recording
3. Press Play
4. Console shows:
   - "[ChronosInjector] 🎭 VIBE → TECHNO"
   - "[ChronosInjector] ⚡ FX ON → Industrial Strobe"
   - "[ChronosInjector] ⬛ FX OFF → (clip ended)"
```

---

## 📊 ARCHITECTURAL DIAGRAM

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         CHRONOS STUDIO - WAVE 2013                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────┐    events     ┌──────────────┐    props    ┌──────────┐ │
│  │  Chronos     │──────────────▶│  Chronos     │────────────▶│ Timeline │ │
│  │  Recorder    │  clip-added   │  Layout      │   clips[]   │ Canvas   │ │
│  │              │  clip-updated │              │  growingId  │          │ │
│  │  tick()      │  clip-growing │  handles     │             │  renders │ │
│  │  ────────    │               │  events      │             │  clips   │ │
│  │  updates     │               │              │             │          │ │
│  │  activeVibe  │               │              │             │          │ │
│  └──────────────┘               └──────────────┘             └──────────┘ │
│         │                              │                                   │
│         │                              │ tick(clips, time)                │
│         │                              ▼                                   │
│         │                       ┌──────────────┐                          │
│         │                       │  Chronos     │                          │
│         │                       │  Injector    │                          │
│         │                       │              │                          │
│         │                       │  diff state  │                          │
│         │                       │  emit cmds   │                          │
│         │                       └──────────────┘                          │
│         │                              │                                   │
│         │                              │ subscribe()                      │
│         │                              ▼                                   │
│         │                       ┌──────────────┐                          │
│         │                       │    Stage     │                          │
│         │                       │  Simulator2  │                          │
│         │                       │  (future)    │                          │
│         │                       └──────────────┘                          │
│         │                                                                  │
│         │                       ┌──────────────┐                          │
│         └──────────────────────▶│    Clip      │                          │
│            activeVibeClipId     │  Renderer    │                          │
│                                 │              │                          │
│                                 │  isGrowing   │                          │
│                                 │  ▓▓▓▓▓▓▓█    │ ← pulse animation       │
│                                 └──────────────┘                          │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 💭 PUNK NOTES

WAVE 2013 trae la **VIDA** a los clips.

Antes, grabas un vibe y aparece como un bloque estático.
Ahora, grabas y VES el clip crecer como si estuviera respirando.

El pulso rojo en el borde derecho es el heartbeat del clip.
Cuando para de latir, el clip se congela. Congelado pero vivo.

El Injector es el mensajero silencioso.
Lee los clips, detecta cambios, susurra al Stage.
Cuando el Stage Simulator esté listo, solo tiene que suscribirse.

Los clips pueden moverse. Pueden estirarse. Pueden morir.
Eso es lo que hace un DAW real.
Eso es lo que LuxSync está empezando a ser.

---

**Signed**: PunkOpus  
**For**: Radwulf & Chronos Studio  
**Date**: 2026-02-09
