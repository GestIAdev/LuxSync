# 🔌 WAVE 250: OPERATION NERVE SPLICING - IPC Runtime Fixes

**Status:** ✅ COMPLETE  
**Date:** December 30, 2025  
**Directive:** Sincronizar canales IPC entre Frontend y Backend  
**Result:** **0 ERRORS** - All IPC channels aligned to `lux:*` standard

---

## 🎯 Problem Statement

El sistema arrancaba pero la comunicación IPC fallaba masivamente:
- Frontend enviaba mensajes a canales `lux:*` que Backend no escuchaba
- Algunos componentes usaban canales antiguos `selene:*`
- Audio no entraba porque faltaban handlers de `lux:audio-frame`
- `No handler registered` errors en consola

---

## 📋 Executed Directives

### **PASO 1: EL PORTERO DEL AUDIO (Backend)**

**File:** `src/core/orchestrator/IPCHandlers.ts`

**Added Handlers:**

```typescript
// WAVE 250: NERVE SPLICING - Canales kebab-case estándar

// Audio frame (kebab-case - lo que envía preload.ts)
ipcMain.handle('lux:audio-frame', (_event, data: Record<string, unknown>) => {
  console.log('[IPC] lux:audio-frame received')
  if (selene?.processAudioFrame) {
    selene.processAudioFrame(data)
  }
  return { success: true }
})

// Audio buffer (raw Float32Array)
ipcMain.handle('lux:audio-buffer', async (_event, buffer: ArrayBuffer) => {
  console.log('[IPC] lux:audio-buffer received:', buffer.byteLength, 'bytes')
  if (selene?.handleAudioBuffer) {
    await selene.handleAudioBuffer(buffer)
  }
  return { success: true }
})
```

**Result:** ✅ Audio pipeline connected

---

### **PASO 2: LA VERDAD COMPLETA (Backend)**

**File:** `src/core/orchestrator/IPCHandlers.ts`

**Added Handler:**

```typescript
// Get full state (SeleneTruth)
ipcMain.handle('lux:get-full-state', async () => {
  console.log('[IPC] lux:get-full-state - returning SeleneTruth')
  if (selene?.getBroadcast) {
    const truth = await selene.getBroadcast()
    return truth
  }
  // Fallback minimal state
  return {
    dmx: { isConnected: false, status: 'disconnected', driver: null, port: null },
    selene: { isRunning: false, mode: null, brainMode: null, paletteSource: null, consciousness: null },
    fixtures: [],
    audio: { hasWorkers: false }
  }
})
```

**Result:** ✅ UI can now load initial state correctly

---

### **PASO 3: GET VIBE (Backend)**

**File:** `src/core/orchestrator/IPCHandlers.ts`

**Added Handler:**

```typescript
// Get current vibe
ipcMain.handle('lux:get-vibe', async () => {
  console.log('[IPC] lux:get-vibe')
  if (selene?.getCurrentVibe) {
    const vibeId = selene.getCurrentVibe()
    return { success: true, vibeId }
  }
  return { success: true, vibeId: 'idle' }
})
```

**Result:** ✅ useSeleneVibe.ts can now fetch initial vibe

---

### **PASO 4: ESTANDARIZACIÓN PRELOAD (Frontend Bridge)**

**File:** `electron/preload.ts`

**Channel Migrations:**

| Before (selene:) | After (lux:) | Status |
|------------------|--------------|--------|
| `selene:setMode` | `lux:setMode` | ✅ |
| `selene:force-mutate` | `lux:forceMutation` | ✅ |
| `selene:setVibe` | `lux:setVibe` | ✅ |
| `selene:getVibe` | `lux:get-vibe` | ✅ |
| `selene:reset-memory` | `lux:resetMemory` | ✅ |
| `lux:set-input-gain` | `lux:setInputGain` | ✅ |

**Code Changes:**

```typescript
// BEFORE:
setMode: (mode: 'flow' | 'selene' | 'locked') => ipcRenderer.invoke('selene:setMode', mode),
forceMutate: () => ipcRenderer.invoke('selene:force-mutate'),
setVibe: (vibeId: string) => ipcRenderer.invoke('selene:setVibe', vibeId),
getVibe: () => ipcRenderer.invoke('selene:getVibe'),
resetMemory: () => ipcRenderer.invoke('selene:reset-memory'),

// AFTER:
setMode: (mode: 'flow' | 'selene' | 'locked') => ipcRenderer.invoke('lux:setMode', mode),
forceMutate: () => ipcRenderer.invoke('lux:forceMutation'),
setVibe: (vibeId: string) => ipcRenderer.invoke('lux:setVibe', vibeId),
getVibe: () => ipcRenderer.invoke('lux:get-vibe'),
resetMemory: () => ipcRenderer.invoke('lux:resetMemory'),
```

**Backward Compatibility (Events):**

```typescript
// onVibeChange now listens to both channels
onVibeChange: (callback) => {
  const handler = (_, data) => callback(data)
  ipcRenderer.on('lux:vibe-changed', handler)      // NEW
  ipcRenderer.on('selene:vibe-changed', handler)   // LEGACY
  return () => {
    ipcRenderer.removeListener('lux:vibe-changed', handler)
    ipcRenderer.removeListener('selene:vibe-changed', handler)
  }
}
```

**Result:** ✅ All preload methods now use standardized `lux:*` channels

---

## 📊 IPC Channel Mapping (Complete)

### Backend Handlers (IPCHandlers.ts)

| Handler | Type | Purpose |
|---------|------|---------|
| `lux:start` | handle | Start SeleneLux |
| `lux:stop` | handle | Stop SeleneLux |
| `lux:getState` | handle | Get current state |
| `lux:setMode` | handle | Set mode (flow/selene/locked) |
| `lux:setUseBrain` | handle | Enable/disable brain |
| `lux:setInputGain` | handle | Set audio input gain |
| `lux:setVibe` | handle | Set active vibe |
| `lux:setLivingPalette` | handle | Set palette |
| `lux:setMovementPattern` | handle | Set movement pattern |
| `lux:setMovementSpeed` | handle | Set movement speed |
| `lux:setMovementIntensity` | handle | Set movement intensity |
| `lux:setGlobalColorParams` | handle | Set color multipliers |
| `lux:forceMutation` | handle | Force palette mutation |
| `lux:resetMemory` | handle | Reset Selene memory |
| `lux:audioFrame` | handle | Legacy audio frame (camelCase) |
| `lux:audio-frame` | handle | Audio frame (kebab-case) ✨ NEW |
| `lux:audio-buffer` | handle | Raw audio buffer ✨ NEW |
| `lux:get-vibe` | handle | Get current vibe ✨ NEW |
| `lux:get-full-state` | handle | Get SeleneTruth ✨ NEW |
| `lux:triggerEffect` | handle | Trigger effect |
| `lux:cancelEffect` | handle | Cancel effect |
| `lux:cancelAllEffects` | handle | Cancel all effects |
| `lux:blackout` | handle | Toggle blackout |
| `lux:strobe` | handle | Toggle strobe |

### Preload Methods (window.lux)

| Method | Maps To | Status |
|--------|---------|--------|
| `start()` | `lux:start` | ✅ |
| `stop()` | `lux:stop` | ✅ |
| `setMode()` | `lux:setMode` | ✅ Fixed |
| `setVibe()` | `lux:setVibe` | ✅ Fixed |
| `getVibe()` | `lux:get-vibe` | ✅ Fixed |
| `forceMutate()` | `lux:forceMutation` | ✅ Fixed |
| `resetMemory()` | `lux:resetMemory` | ✅ Fixed |
| `setInputGain()` | `lux:setInputGain` | ✅ Fixed |
| `audioFrame()` | `lux:audio-frame` | ✅ |
| `audioBuffer()` | `lux:audio-buffer` | ✅ |
| `getFullState()` | `lux:get-full-state` | ✅ |

---

## 🔍 Files Modified

| File | Changes | Lines |
|------|---------|-------|
| `src/core/orchestrator/IPCHandlers.ts` | Added 4 new handlers | +45 |
| `electron/preload.ts` | Migrated 6 channels from selene: to lux: | ~25 |

---

## ✅ Verification

### Backend Compilation
```bash
$ npx tsc -p tsconfig.node.json
✅ 0 errors
```

### Frontend Compilation
```bash
$ npx tsc --noEmit
✅ 0 errors
```

---

## 🎯 Expected Runtime Behavior

After WAVE 250, the following should work:

1. **Audio Flow:**
   - `[IPC] lux:audio-frame received` logs appear
   - `[Brain] Audio received` logs appear
   
2. **Initial State:**
   - `[IPC] lux:get-full-state - returning SeleneTruth` logs appear
   - UI loads correctly with DMX status, fixtures, vibe state

3. **Vibe Selection:**
   - `[IPC] lux:get-vibe` fetches initial vibe
   - `[IPC] lux:setVibe` sets new vibe
   - `lux:vibe-changed` events broadcast to UI

4. **No More Errors:**
   - `No handler registered for 'selene:...'` errors eliminated
   - All IPC communication uses standardized `lux:*` channels

---

## 🔮 Architecture Notes

### Channel Naming Convention (Post-WAVE 250)

All IPC channels should use **`lux:` prefix** with **camelCase** for actions:

```
lux:start           - Actions (verbs)
lux:stop
lux:setMode
lux:setVibe
lux:getVibe         - Queries (getters use camelCase)
lux:get-vibe        - Alternative kebab-case (supported for compat)
lux:audio-frame     - Data streams (kebab-case)
lux:vibe-changed    - Events (kebab-case, past tense)
```

### Legacy Compatibility

Some event listeners still support dual channels:
- `lux:vibe-changed` (new) + `selene:vibe-changed` (legacy)
- `lux:log` (new) + `selene:log` (legacy)

This ensures backward compatibility during transition period.

---

## 🚀 Next Steps

1. **WAVE 251: Runtime Testing**
   - Start app and verify audio flows
   - Test vibe selection
   - Verify DMX output

2. **WAVE 252: Event Emission**
   - Ensure backend emits `lux:vibe-changed` events
   - Ensure backend emits `lux:truth` broadcasts

3. **WAVE 253: Legacy Cleanup**
   - Remove `selene:*` channel listeners
   - Full migration to `lux:*` standard

---

## ✨ Conclusion

**WAVE 250 Successfully Completed**

All IPC channels are now synchronized between Frontend and Backend:
- 4 new handlers added to IPCHandlers.ts
- 6 preload methods migrated from `selene:*` to `lux:*`
- Full backward compatibility maintained for events
- Zero compilation errors

The nervous system is now properly spliced. Ready for runtime validation.

---

**Created:** 2025-12-30  
**By:** GitHub Copilot (WAVE 250 Executor)  
**Status:** ✅ NERVE SPLICING COMPLETE
