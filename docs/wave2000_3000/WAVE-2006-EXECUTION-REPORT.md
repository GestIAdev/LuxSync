# WAVE 2006: THE INTERACTIVE CANVAS
## Execution Report - Interactive Clips & Magnetic Snapping

**Date:** 2024-12-XX  
**Architect:** PunkOpus  
**Wave Version:** 2006  
**Status:** ✅ COMPLETE

---

## 🎯 OBJECTIVE

> "Quiero poder arrastrar un bloque 'Techno' desde la derecha, soltarlo en el segundo 10, y que se quede pegado al beat perfectamente"
> — Radwulf

Transform the static timeline into a **fully interactive editing surface** where clips can be dragged, dropped, selected, moved, resized, and magnetically snap to the beat grid.

---

## 📦 DELIVERABLES

### 1. TYPE SYSTEM - `TimelineClip.ts`
**Path:** `src/chronos/core/TimelineClip.ts`

```typescript
// Clip Types
type ClipType = 'vibe' | 'fx'
type VibeType = 'chillout' | 'techno' | 'ambient' | 'rock' | 'electronic' | 'ballad' | 'fiesta-latina' | 'hiphop'
type FXType = 'strobe' | 'sweep' | 'pulse' | 'chase' | 'fade' | 'blackout' | 'color-wash' | 'intensity-ramp'

// Core interfaces
interface VibeClip extends BaseClip {
  type: 'vibe'
  vibeType: VibeType
  label: string
  color: string
  intensity: number
  fadeInMs: number
  fadeOutMs: number
}

interface FXClip extends BaseClip {
  type: 'fx'
  fxType: FXType
  color: string
  keyframes: FXKeyframe[]
}
```

**Key Exports:**
- `VIBE_COLORS` - Color mapping for all vibe types
- `FX_COLORS` - Color mapping for all effect types
- `createVibeClip()` - Factory function for vibe clips
- `createFXClip()` - Factory function for effect clips
- `calculateBeatGrid()` - Generate beat positions from BPM
- `snapToGrid()` - Find nearest beat with threshold
- `serializeDragPayload()` / `deserializeDragPayload()` - For dataTransfer

---

### 2. ARSENAL PANEL - Draggable Items
**Path:** `src/chronos/ui/arsenal/ArsenalPanel.tsx`

**Features:**
- 8 VIBE presets (CHILLOUT, TECHNO, AMBIENT, ROCK, ELECTRONIC, BALLAD, FIESTA, HIP-HOP)
- 8 FX presets (STROBE, SWEEP, PULSE, CHASE, FADE, BLACKOUT, COLOR-WASH, INTENSITY)
- Color-coded icons
- `draggable="true"` with proper dataTransfer setup
- Ghost image during drag

```tsx
// Drag setup
onDragStart={(e) => {
  const payload: DragPayload = {
    clipType: item.type,
    vibeType: item.type === 'vibe' ? item.subType as VibeType : undefined,
    fxType: item.type === 'fx' ? item.subType as FXType : undefined,
    label: item.label,
    color: item.color,
  }
  e.dataTransfer.setData('application/luxsync-clip', serializeDragPayload(payload))
  e.dataTransfer.effectAllowed = 'copy'
}}
```

---

### 3. CLIP RENDERER - SVG Clip Visualization
**Path:** `src/chronos/ui/timeline/ClipRenderer.tsx`

**Features:**
- Vibe clips: Gradient background, label, icon
- FX clips: Keyframe diamonds visualization
- Selection highlight (cyan glow)
- Resize handles on left/right edges
- Hover states
- Context menu trigger

```
┌─────────────────────────────────────────────┐
│ [resize]  🎹 ELECTRONIC  [resize] │
│ handle                     handle  │
└─────────────────────────────────────────────┘
     ↑                           ↑
   8px wide                   8px wide
   cursor: ew-resize          cursor: ew-resize
```

---

### 4. STATE MANAGEMENT - `useTimelineClips.ts`
**Path:** `src/chronos/hooks/useTimelineClips.ts`

**State:**
```typescript
interface UseTimelineClipsReturn {
  clips: TimelineClip[]
  selectedIds: Set<string>
  snapEnabled: boolean
  snapPosition: number | null  // For visual feedback
  beatGrid: number[]           // Pre-computed beat positions
  
  // Actions
  addClip, removeClip, updateClip
  selectClip, deselectAll, deleteSelected
  
  // Drag & Drop
  createClipFromDrop(payload, timeMs, trackId)
  moveClip(clipId, newStartMs)
  resizeClip(clipId, edge, newTimeMs)
  
  // Snapping
  toggleSnap()
  snapTime(timeMs): [snappedTime, didSnap]
}
```

**Magnetic Snapping Algorithm:**
```typescript
function snapToGrid(timeMs: number, beatGrid: number[], threshold: number): [number, boolean, number | null] {
  let nearestBeat = null
  let minDistance = Infinity
  
  for (const beat of beatGrid) {
    const distance = Math.abs(timeMs - beat)
    if (distance < minDistance) {
      minDistance = distance
      nearestBeat = beat
    }
  }
  
  if (minDistance <= threshold) {
    return [nearestBeat!, true, nearestBeat]  // Snapped!
  }
  return [timeMs, false, null]  // No snap
}
```

---

### 5. AUTO-SCROLL - `useAutoScroll.ts`
**Path:** `src/chronos/hooks/useAutoScroll.ts`

**Behavior:**
- When `followEnabled = true` and playing:
  - Viewport centers on playhead position
  - Smooth animation (not jarring jumps)
- When user manually scrolls:
  - `followEnabled` automatically disabled
- Toggle button in status bar

---

### 6. TIMELINE CANVAS - Drop Zone & Clips Layer
**Path:** `src/chronos/ui/timeline/TimelineCanvas.tsx`

**New Props:**
```typescript
interface TimelineCanvasProps {
  // WAVE 2006 additions
  clips?: TimelineClip[]
  selectedClipIds?: Set<string>
  snapEnabled?: boolean
  snapPosition?: number | null
  onClipSelect?: (clipId: string, addToSelection: boolean) => void
  onClipMove?: (clipId: string, newStartMs: number) => void
  onClipResize?: (clipId: string, edge: 'left' | 'right', newTimeMs: number) => void
  onClipDrop?: (payload: DragPayload, timeMs: number, trackId: string) => void
  onClipContextMenu?: (clipId: string, event: React.MouseEvent) => void
  followEnabled?: boolean
  onFollowToggle?: () => void
}
```

**Drop Handling:**
```typescript
const handleDrop = (e: React.DragEvent) => {
  const data = e.dataTransfer.getData('application/luxsync-clip')
  const payload = deserializeDragPayload(data)
  
  const trackId = getTrackAtY(e.clientY)
  const timeMs = getTimeAtX(e.clientX)
  
  // Validate: vibes → vibe track, fx → fx tracks
  if ((payload.clipType === 'vibe' && trackId === 'vibe') ||
      (payload.clipType === 'fx' && (trackId === 'fx1' || trackId === 'fx2'))) {
    onClipDrop?.(payload, timeMs, trackId)
  }
}
```

**Visual Feedback:**
- Drag-over highlight on valid tracks
- Snap indicator line (cyan dashed)
- Drop position preview

---

### 7. WAVEFORM COLORS - Enhanced Contrast
**Path:** `src/chronos/ui/timeline/WaveformLayer.tsx`

**Old:** Low contrast rainbow  
**New:** 
```
LOW (0.0 - 0.4): Deep Purple → Purple (#3B0764 → #7C3AED)
MEDIUM (0.4 - 0.7): CYAN (#00FFFF) - bright and visible
HIGH (0.7 - 1.0): WHITE (#FFFFFF) - maximum contrast
```

---

### 8. STATUS BAR - Control Toggles
**Path:** `src/chronos/ui/timeline/TimelineCanvas.css`

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   [🧲 SNAP ON]  [🎯 FOLLOW]  100px/s  Ctrl+Scroll to zoom      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔗 INTEGRATION FLOW

```
1. User drags TECHNO from ArsenalPanel
   ↓
2. dataTransfer contains: { clipType: 'vibe', vibeType: 'techno', label: 'TECHNO', color: '#E879F9' }
   ↓
3. TimelineCanvas receives onDragOver
   - Highlights VIBE track
   - Shows drop position line
   ↓
4. User drops at x=1000px (≈ 10 seconds)
   ↓
5. handleDrop calculates:
   - trackId = 'vibe'
   - timeMs = 10000ms
   ↓
6. useTimelineClips.createClipFromDrop():
   - snapToGrid(10000, beatGrid, 100ms) → 10000ms (exact beat!)
   - Creates VibeClip { startMs: 10000, endMs: 14000, vibeType: 'techno', ... }
   ↓
7. TimelineCanvas re-renders with new clip
   - ClipRenderer displays TECHNO block
   - Selection glow if selected
```

---

## 📊 PERFORMANCE CHARACTERISTICS

| Metric | Value |
|--------|-------|
| Clips per render | O(n) where n = visible clips only |
| Snap calculation | O(b) where b = beats in duration |
| Drag feedback | 60fps (native browser drag) |
| Clip selection | O(1) with Set<string> |
| Memory per clip | ~200 bytes |

---

## 🧪 TESTING SCENARIOS

### Scenario 1: Basic Drop
1. Load audio file (sets BPM)
2. Drag TECHNO from Arsenal
3. Drop on VIBE track at ~10s
4. **Expected:** Clip appears, snapped to nearest beat

### Scenario 2: Multi-Select
1. Click clip A (selected)
2. Ctrl+Click clip B (added to selection)
3. **Expected:** Both clips highlighted

### Scenario 3: Resize Clip
1. Click clip to select
2. Drag right resize handle
3. **Expected:** Clip extends, snaps to beat grid

### Scenario 4: Follow Mode
1. Enable FOLLOW button
2. Play audio
3. **Expected:** Viewport scrolls to keep playhead visible
4. Manual scroll
5. **Expected:** FOLLOW automatically disables

---

## 📁 FILES CREATED/MODIFIED

### NEW FILES
| File | Lines | Purpose |
|------|-------|---------|
| `src/chronos/core/TimelineClip.ts` | 310 | Type definitions, factories, snap helpers |
| `src/chronos/ui/arsenal/ArsenalPanel.tsx` | 228 | Draggable items panel |
| `src/chronos/ui/arsenal/ArsenalPanel.css` | 180 | Arsenal styling |
| `src/chronos/ui/timeline/ClipRenderer.tsx` | 345 | SVG clip visualization |
| `src/chronos/hooks/useTimelineClips.ts` | 295 | Clip state management |
| `src/chronos/hooks/useAutoScroll.ts` | 90 | Follow mode logic |

### MODIFIED FILES
| File | Changes |
|------|---------|
| `TimelineCanvas.tsx` | +200 lines - Drop handling, clips layer, status bar |
| `TimelineCanvas.css` | +80 lines - Snap indicator, status bar, drag-over |
| `WaveformLayer.tsx` | Updated color function (Cyan/White) |
| `ChronosLayout.tsx` | Integrated clips, callbacks, ArsenalPanel |

---

## 🚀 NEXT WAVE CANDIDATES

1. **WAVE 2007: CONTEXT MENU** - Right-click clip for Delete/Duplicate/Split
2. **WAVE 2008: UNDO/REDO** - Command pattern for clip operations
3. **WAVE 2009: KEYBOARD SHORTCUTS** - Delete, Ctrl+C, Ctrl+V, Ctrl+Z
4. **WAVE 2010: STAGE PREVIEW** - Connect clips to StageSimulator2 preview

---

## ✅ ACCEPTANCE CRITERIA

| Requirement | Status |
|-------------|--------|
| Drag TECHNO from Arsenal | ✅ |
| Drop on VIBE track | ✅ |
| Snap to beat grid | ✅ |
| Visual clip with label | ✅ |
| Select/deselect clips | ✅ |
| Resize handles | ✅ |
| Follow playhead mode | ✅ |
| Waveform cyan/white colors | ✅ |
| Status bar with toggles | ✅ |

---

**WAVE 2006: THE INTERACTIVE CANVAS - COMPLETE** 🎬

*"Ahora el timeline no es solo visual — es un instrumento."*
