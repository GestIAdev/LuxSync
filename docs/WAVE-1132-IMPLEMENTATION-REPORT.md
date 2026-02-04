# 🚦 WAVE 1132: THE COLD START - LOGIC HARDWIRING

## STATUS: ✅ COMPLETE

**Date:** Auto-generated  
**Author:** PunkOpus  
**Directive:** Cold Start Protocol - Sistema arranca en silencio total

---

## 📋 EXECUTIVE SUMMARY

Se implementó el **Cold Start Protocol** completo: LuxSync ahora arranca **FRÍO** (Output DISABLED) y solo emite señal DMX cuando el usuario pulsa explícitamente **GO**.

### Estados del Sistema

| Estado | Audio | DMX Gate | Descripción |
|--------|-------|----------|-------------|
| **COLD** | N/A | CLOSED | Boot inicial, no hay conexión |
| **ARMED** | Connected | CLOSED | Dashboard visible, audio fluye, pero DMX bloqueado |
| **LIVE** | Connected | OPEN | Usuario pulsó GO, DMX fluye a fixtures |

---

## 🔧 IMPLEMENTATION DETAILS

### 1. MasterArbiter.ts - The Iron Core

**File:** `electron-app/src/core/arbiter/MasterArbiter.ts`

#### Nuevo Property
```typescript
// 🚦 WAVE 1132: OUTPUT GATE - THE COLD START PROTOCOL
private _outputEnabled: boolean = false  // DEFAULT: COLD START
```

#### Nuevos Métodos
```typescript
setOutputEnabled(enabled: boolean): void
isOutputEnabled(): boolean
toggleOutput(): boolean
```

#### Gate Logic en arbitrateFixture()
```typescript
// SUPREME PRIORITY - antes que cualquier otro layer
if (!this._outputEnabled) {
  return this.createOutputGateBlackout(fixtureId)
}
```

#### Nuevo Método de Safe State
```typescript
private createOutputGateBlackout(fixtureId: string): FixtureLightingTarget {
  // Dimmer: 0, Color: Black, Position: Center (128,128)
  // Speed: 0 (fast response), Color wheel: 0 (open)
}
```

#### Status Logging
- Log periódico cada 150 frames cuando en ARMED state
- Constructor log confirmando COLD START

---

### 2. ArbiterIPCHandlers.ts - IPC Bridge

**File:** `electron-app/src/core/arbiter/ArbiterIPCHandlers.ts`

```typescript
ipcMain.handle('lux:arbiter:setOutputEnabled', ...)
ipcMain.handle('lux:arbiter:toggleOutput', ...)
ipcMain.handle('lux:arbiter:getOutputEnabled', ...)
```

---

### 3. preload.ts - Frontend API

**File:** `electron-app/electron/preload.ts`

```typescript
arbiter: {
  setOutputEnabled: (enabled: boolean) => ...,
  toggleOutput: () => ...,
  getOutputEnabled: () => ...,
}
```

---

### 4. controlStore.ts - State Management

**File:** `electron-app/src/stores/controlStore.ts`

```typescript
interface ControlState {
  outputEnabled: boolean  // Default: false
  toggleOutput: () => void
  setOutputEnabled: (enabled: boolean) => void
}

export const selectOutputEnabled = (state) => state.outputEnabled
```

---

### 5. CommandDeck.tsx - UI Integration

**File:** `electron-app/src/components/commandDeck/CommandDeck.tsx`

- GO button ahora muestra estado ARMED/LIVE correctamente
- Sincroniza `outputEnabled` desde backend en mount
- Escucha eventos `onStatusChange` para actualizaciones en tiempo real
- `handleOutputToggle` llama a `window.lux.arbiter.setOutputEnabled()`

---

### 6. vite-env.d.ts - TypeScript Declarations

**File:** `electron-app/src/vite-env.d.ts`

Añadidas declaraciones de tipos para:
- `arbiter.setOutputEnabled()`
- `arbiter.toggleOutput()`
- `arbiter.getOutputEnabled()`
- `status.outputEnabled`

---

## 🏗️ ARCHITECTURE FLOW

```
┌─────────────────────────────────────────────────────────────────────┐
│                        COLD START PROTOCOL                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   USER                    FRONTEND                   BACKEND        │
│                                                                     │
│     │                        │                          │           │
│     │    [App Launches]      │                          │           │
│     │                        │    fetch status          │           │
│     │                        │─────────────────────────>│           │
│     │                        │    outputEnabled: false  │           │
│     │                        │<─────────────────────────│           │
│     │                        │                          │           │
│     │   [GO Button = OFF]    │                          │           │
│     │<───────────────────────│                          │           │
│     │                        │                          │           │
│     │   [DMX = BLACKOUT]     │                          │           │
│     │                        │        arbitrate()       │           │
│     │                        │                   ┌──────┴───────┐   │
│     │                        │                   │_outputEnabled│   │
│     │                        │                   │   = false    │   │
│     │                        │                   │              │   │
│     │                        │                   │ → BLACKOUT   │   │
│     │                        │                   └──────────────┘   │
│     │                        │                          │           │
│     │                        │                          │           │
│     │   [CLICK GO]           │                          │           │
│     │───────────────────────>│   setOutputEnabled(true) │           │
│     │                        │─────────────────────────>│           │
│     │                        │                          │           │
│     │   [GO Button = ON]     │        success           │           │
│     │<───────────────────────│<─────────────────────────│           │
│     │                        │                          │           │
│     │   [DMX = LIVE]         │                          │           │
│     │                        │        arbitrate()       │           │
│     │                        │                   ┌──────┴───────┐   │
│     │                        │                   │_outputEnabled│   │
│     │                        │                   │   = true     │   │
│     │                        │                   │              │   │
│     │                        │                   │ → NORMAL     │   │
│     │                        │                   │   RENDER     │   │
│     │                        │                   └──────────────┘   │
│     │                        │                          │           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ✅ VERIFICATION CHECKLIST

- [x] `_outputEnabled` default = `false` (COLD START)
- [x] `arbitrateFixture()` checks gate BEFORE blackout layer
- [x] `createOutputGateBlackout()` returns safe fixture state
- [x] IPC handlers registered for output gate control
- [x] Preload API exposes output gate methods
- [x] controlStore has `outputEnabled` state + actions
- [x] CommandDeck syncs with backend on mount
- [x] GO button toggles output state
- [x] TypeScript declarations updated
- [x] `getStatus()` includes `outputEnabled`
- [x] `reset()` sets `_outputEnabled = false` (back to COLD)

---

## 📝 CONSOLE LOGS

### On Boot (Constructor)
```
[MasterArbiter] 🚦 COLD START: Output DISABLED by default (ARMED state)
```

### While Armed (Every ~5 seconds)
```
[MasterArbiter] 🚦 ARMED STATE: Output DISABLED | 10 fixtures forced to BLACKOUT | Press GO to enable DMX
```

### On GO Press
```
[MasterArbiter] 🚦 OUTPUT GATE: ENABLED → DMX flow ACTIVE
```

### On PAUSE Press
```
[MasterArbiter] 🚦 OUTPUT GATE: DISABLED → DMX blocked (ARMED state)
```

### On Reset
```
[MasterArbiter] 🚦 Reset complete - Output DISABLED (COLD state)
```

---

## 🔮 PENDING TASKS

1. **Audio Manager Silence on Boot** - AudioInputManager should start with no active source
2. **Safety Interlocks** - Force `outputEnabled = false` when navigating to CALIBRATE/FORGE views
3. **Visual Feedback** - Consider adding visual indicator in StageSimulator when in ARMED state

---

## 💀 PUNK NOTES

El Cold Start Protocol es **anti-silicio-valley bullshit**. No hay "smart defaults" que enciendan fixtures sin tu permiso. No hay "helpful features" que muevan cabezas móviles a posiciones random porque "el algoritmo lo decidió".

**TÚ mandas. LuxSync obedece.**

El sistema arranca FRÍO. Pulsas GO cuando TÚ estás listo. Así de simple.

---

*WAVE 1132 - THE COLD START: LOGIC HARDWIRING*  
*No hot patching. No surprises. Just control.*
