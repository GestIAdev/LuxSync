# 🔌 WAVE 2019: CHRONOS → STAGE - THE LIVING SHOW
## Blueprint para conectar el Timecoder con el Backend Real

**Fecha**: 2026-02-10
**Estado**: 📋 BLUEPRINT / PLAN DE EJECUCIÓN
**Autor**: PunkOpus + Radwulf

---

## 📊 DIAGNÓSTICO COMPLETO

### EL PROBLEMA
Chronos escribe partituras perfectamente. El usuario arrastra Vibes, graba FX, guarda proyectos .lux... pero cuando le da PLAY:
- ❌ Las luces muestran el fallback genérico de TitanEngine
- ❌ Los Vibes no se aplican
- ❌ Los efectos no se disparan
- ❌ Nada de la partitura llega al Stage

**¿Por qué?** Porque el `ChronosInjector` (WAVE 2013) emite eventos internos vía `subscribe()`, pero **NADIE está subscrito**. Los comandos se emiten al vacío.

---

## 🏗️ ARQUITECTURA ACTUAL (DESCONECTADA)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Renderer)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐                                                  │
│  │ ChronosLayout   │──▶ streaming.currentTimeMs                       │
│  │ (useEffect)     │──▶ injector.tick(clips, time)                   │
│  └────────┬────────┘                                                  │
│           ▼                                                           │
│  ┌─────────────────┐                                                  │
│  │ChronosInjector  │──▶ emit({type:'vibe-change',...})               │
│  │(core version)   │                                                  │
│  └────────┬────────┘                                                  │
│           ▼                                                           │
│      🚫 VACÍO 🚫  ◀─── Nadie subscrito!                              │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Main Process)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐     ┌─────────────────┐                         │
│  │TitanOrchestrator│────▶│  TitanEngine    │                         │
│  └────────┬────────┘     └────────┬────────┘                         │
│           │                       │                                   │
│           ▼                       ▼                                   │
│  ┌─────────────────┐     ┌─────────────────┐     ┌───────────────┐   │
│  │ VibeManager     │     │  EffectManager  │────▶│  SeleneLux    │   │
│  └─────────────────┘     └─────────────────┘     └───────────────┘   │
│                                                                       │
│  🔇 AISLADO - No recibe comandos de Chronos                          │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### DOS CHRONOS INJECTORS (CONFUSIÓN)

| Archivo | Propósito | Usado Por |
|---------|-----------|-----------|
| `src/chronos/core/ChronosInjector.ts` | Emite StageCommands via listeners | ChronosLayout (WAVE 2013) |
| `src/chronos/bridge/ChronosInjector.ts` | Aplica overrides a MusicalContext | TitanEngine (WAVE 2002) |

**El problema**: Están desconectados. El de `core/` emite al vacío. El de `bridge/` nunca recibe los comandos.

---

## 🎯 ARQUITECTURA OBJETIVO (CONECTADA)

### OPCIÓN A: IPC DIRECTO (Recomendada)
El frontend manda comandos vía IPC al backend cuando detecta cambios de Vibe/FX.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Renderer)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐                                                  │
│  │ ChronosLayout   │──▶ streaming.currentTimeMs                       │
│  │ (useEffect)     │──▶ injector.tick(clips, time)                   │
│  └────────┬────────┘                                                  │
│           ▼                                                           │
│  ┌─────────────────┐                                                  │
│  │ChronosInjector  │──▶ emit({type:'vibe-change',...})               │
│  │(core version)   │                                                  │
│  └────────┬────────┘                                                  │
│           ▼                                                           │
│  ┌─────────────────┐                                                  │
│  │ ChronosIPCBridge│──▶ window.lux.chronos.setVibe(vibeId)           │
│  │ (NEW - suscribe)│──▶ window.lux.chronos.triggerFX(effectId, ...)  │
│  └────────┬────────┘                                                  │
│           │                                                           │
└───────────┼───────────────────────────────────────────────────────────┘
            │ IPC
┌───────────┼───────────────────────────────────────────────────────────┐
│           ▼                                                           │
│  ┌─────────────────┐     ┌─────────────────┐                         │
│  │ chronos:setVibe │────▶│TitanOrchestrator│                         │
│  │ chronos:trigger │     │   .setVibe()    │                         │
│  │ (IPC Handlers)  │     │   .trigger()    │                         │
│  └────────┬────────┘     └────────┬────────┘                         │
│           │                       │                                   │
│           ▼                       ▼                                   │
│  ┌─────────────────┐     ┌─────────────────┐     ┌───────────────┐   │
│  │ VibeManager     │     │  EffectManager  │────▶│  SeleneLux    │   │
│  │ .setActiveVibe()│     │   .trigger()    │     │   .process()  │   │
│  └─────────────────┘     └─────────────────┘     └───────────────┘   │
│                                                                       │
│                          BACKEND (Main Process)                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📋 PLAN DE IMPLEMENTACIÓN

### FASE 1: IPC BRIDGE (WAVE 2019.1)

#### 1.1 Nuevos IPC Handlers en el Backend

**Archivo**: `electron/ipc/ChronosIPCHandlers.ts`

```typescript
// 🕰️ WAVE 2019: CHRONOS PLAYBACK COMMANDS
// These handlers receive timeline playback events from the renderer

ipcMain.handle('chronos:setVibe', (_event, vibeId: string) => {
  console.log('[Chronos→Stage] 🎭 VIBE:', vibeId)
  if (titanOrchestrator) {
    titanOrchestrator.setVibe(vibeId)
  }
  return { success: true }
})

ipcMain.handle('chronos:triggerFX', (_event, config: {
  effectType: string
  intensity: number
  durationMs: number
  color?: string
  source: 'chronos'
}) => {
  console.log('[Chronos→Stage] ⚡ FX:', config.effectType)
  if (titanOrchestrator) {
    // Disparar via EffectManager con source='chronos'
    const effectManager = titanOrchestrator.getEffectManager()
    effectManager.trigger({
      effectType: config.effectType,
      intensity: config.intensity,
      source: 'chronos',  // Para identificar origen en logs
      musicalContext: titanOrchestrator.getCurrentContext(),
    })
  }
  return { success: true }
})

ipcMain.handle('chronos:stopFX', (_event, effectId: string) => {
  console.log('[Chronos→Stage] 🛑 FX STOP:', effectId)
  // Opcional: cancelar efecto si EffectManager soporta cancel
  return { success: true }
})
```

#### 1.2 Exponer en Preload

**Archivo**: `electron/preload.ts`

```typescript
// 🕰️ WAVE 2019: CHRONOS PLAYBACK API
chronos: {
  // ... existing project/autosave APIs ...
  
  // Playback commands (NEW)
  setVibe: (vibeId: string) => ipcRenderer.invoke('chronos:setVibe', vibeId),
  triggerFX: (config: { effectType: string; intensity: number; durationMs: number; color?: string }) => 
    ipcRenderer.invoke('chronos:triggerFX', { ...config, source: 'chronos' }),
  stopFX: (effectId: string) => ipcRenderer.invoke('chronos:stopFX', effectId),
},
```

#### 1.3 Bridge de Suscripción en Frontend

**Archivo**: `src/chronos/bridge/ChronosIPCBridge.ts` (NUEVO)

```typescript
/**
 * 🔌 WAVE 2019: CHRONOS IPC BRIDGE
 * 
 * Subscribes to ChronosInjector (core) and forwards commands to backend via IPC.
 * This is the missing link between Timeline playback and real Stage effects.
 */

import { getChronosInjector, type StageCommand } from '../core/ChronosInjector'

let isConnected = false

/**
 * Connect ChronosInjector to backend via IPC
 * Call this once when Chronos mounts
 */
export function connectChronosToStage(): () => void {
  if (isConnected) {
    console.warn('[ChronosIPCBridge] Already connected')
    return () => {}
  }
  
  const lux = (window as any).lux
  if (!lux?.chronos) {
    console.warn('[ChronosIPCBridge] lux.chronos API not available')
    return () => {}
  }
  
  const injector = getChronosInjector()
  
  const unsubscribe = injector.subscribe((command: StageCommand) => {
    switch (command.type) {
      case 'vibe-change':
        console.log('[ChronosIPCBridge] 🎭 Sending VIBE:', command.effectId)
        lux.chronos.setVibe(command.effectId)
        break
        
      case 'fx-trigger':
        console.log('[ChronosIPCBridge] ⚡ Sending FX:', command.effectId)
        lux.chronos.triggerFX({
          effectType: command.effectId,
          intensity: command.intensity ?? 0.8,
          durationMs: command.durationMs ?? 1000,
          color: command.color,
        })
        break
        
      case 'fx-stop':
        console.log('[ChronosIPCBridge] 🛑 Stopping FX:', command.effectId)
        lux.chronos.stopFX(command.effectId)
        break
    }
  })
  
  isConnected = true
  console.log('[ChronosIPCBridge] ✅ Connected to Stage!')
  
  return () => {
    unsubscribe()
    isConnected = false
    console.log('[ChronosIPCBridge] 🔌 Disconnected')
  }
}
```

#### 1.4 Conectar en ChronosLayout

**Archivo**: `src/chronos/ui/ChronosLayout.tsx`

```typescript
import { connectChronosToStage } from '../bridge/ChronosIPCBridge'

// En el useEffect de montaje:
useEffect(() => {
  // ... existing session restore logic ...
  
  // 🔌 WAVE 2019: Connect to Stage backend
  const disconnectStage = connectChronosToStage()
  
  return () => {
    disconnectStage()
    // ... existing cleanup ...
  }
}, [])
```

---

### FASE 2: MAPEO DE VIBES (WAVE 2019.2)

Los clips de Chronos tienen `vibeType` como string (ej: 'chill-lounge', 'techno-club').
Estos deben mapearse a los IDs de VibeManager.

**Mapeo existente** (ya en el sistema):
- `chill-lounge` → VibeId compatible
- `techno-club` → VibeId compatible
- `fiesta-latina` → VibeId compatible
- `pop-rock` → VibeId compatible
- `industrial` → VibeId compatible

✅ No requiere trabajo adicional - los nombres son compatibles.

---

### FASE 3: MAPEO DE EFECTOS (WAVE 2019.3)

Los clips FX tienen `fxType` que debe mapearse a efectos de `EffectManager`.

**Tipos de FX en Chronos** (`TimelineClip.ts`):
```typescript
type FXType = 
  | 'strobe' 
  | 'flash' 
  | 'drop' 
  | 'sweep' 
  | 'color-flash'
  | 'intensity-pulse'
  | 'custom'
```

**Mapeo a BaseEffect**:

| Chronos FX Type | BaseEffect ID | Notas |
|-----------------|---------------|-------|
| `strobe` | `strobe_burst` | Strobe básico |
| `flash` | `solar_flare` | Flash blanco intenso |
| `drop` | `core_meltdown` | Drop nuclear |
| `sweep` | `arena_sweep` | Sweep horizontal |
| `color-flash` | Depende del vibe | Ver VibeShield |
| `intensity-pulse` | `deep_breath` | Pulso de intensidad |
| `custom` | **TBD** | Futuro editor |

**Implementación**:

```typescript
// src/chronos/core/FXMapper.ts

const FX_MAP: Record<string, string> = {
  'strobe': 'strobe_burst',
  'flash': 'solar_flare',
  'drop': 'core_meltdown',
  'sweep': 'arena_sweep',
  'color-flash': 'strobe_storm',  // O depende del vibe
  'intensity-pulse': 'deep_breath',
}

export function mapChronosFXToBaseEffect(fxType: string): string {
  return FX_MAP[fxType] ?? 'solar_flare'  // Fallback
}
```

---

### FASE 4: ARBITER PRIORITY LAYER (WAVE 2019.4) - OPCIONAL

Si Chronos necesita OVERRIDE absoluto sobre Selene:

```typescript
// En MasterArbiter: Nueva capa de prioridad

enum ArbiterLayer {
  FALLBACK = 0,      // TitanEngine default
  SELENE = 1,        // Selene AI decisions
  CHRONOS = 2,       // Timeline playback (HIGHEST)
  MANUAL = 3,        // Manual UI overrides
}
```

**Flujo con Arbiter**:
1. Selene genera su output normal
2. Si Chronos está activo → Arbiter aplica override de Vibe/FX
3. MasterArbiter fusiona (o reemplaza) según prioridad

⚠️ **NOTA**: Esto puede no ser necesario si usamos IPC directo. El IPC llama a `titanOrchestrator.setVibe()` que ya sobrescribe todo.

---

## 🎭 DOS MODOS DE USO

### MODO 1: CHRONOS STUDIO (Edición)
- **Dónde**: Vista Chronos en el sidebar
- **Propósito**: Crear/editar partituras, grabar en vivo
- **Simulador**: StagePreview embebido en Chronos (mini-preview)
- **Conexión**: ChronosInjector → IPC → Backend → StagePreview

### MODO 2: LIVE SHOW (Reproducción)
- **Dónde**: TheCommander > Scenes tab
- **Propósito**: Reproducir shows pre-programados en vivo
- **Simulador**: StageSimulator2 completo (vista 3D)
- **Conexión**: Cargar .lux → Reproducir → Mismo pipeline IPC

**Misma conexión, diferente UI**. El backend no distingue - solo recibe comandos.

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### WAVE 2019.1 - IPC Bridge
- [ ] Agregar `chronos:setVibe` IPC handler
- [ ] Agregar `chronos:triggerFX` IPC handler
- [ ] Agregar `chronos:stopFX` IPC handler
- [ ] Exponer en preload.ts
- [ ] Crear `ChronosIPCBridge.ts`
- [ ] Conectar en ChronosLayout mount
- [ ] Test: Play timeline → Console muestra logs IPC

### WAVE 2019.2 - Vibe Mapping
- [ ] Verificar compatibilidad de nombres
- [ ] Test: Vibe clip → VibeManager cambia → Luces cambian color

### WAVE 2019.3 - FX Mapping
- [ ] Crear FXMapper.ts
- [ ] Integrar en ChronosIPCBridge
- [ ] Test: FX clip → EffectManager dispara → Efecto visible en Stage

### WAVE 2019.4 - Arbiter Layer (Opcional)
- [ ] Evaluar si es necesario
- [ ] Implementar solo si Selene interfiere con Chronos

---

## 🧪 TEST SCRIPT

```bash
# 1. Abrir LuxSync
# 2. Ir a Chronos
# 3. Cargar audio
# 4. Agregar clip Vibe "techno-club" de 0s a 10s
# 5. Agregar clip FX "drop" en 5s
# 6. Play

# EXPECTED:
# Console: [ChronosIPCBridge] 🎭 Sending VIBE: techno-club
# Console: [Chronos→Stage] 🎭 VIBE: techno-club
# Console: [TitanOrchestrator] Vibe set to: techno-club
# En segundo 5:
# Console: [ChronosIPCBridge] ⚡ Sending FX: drop
# Console: [EffectManager 🔥] core_meltdown FIRED [chronos]
```

---

## 📊 RESUMEN EJECUTIVO

| Componente | Estado Actual | Acción |
|------------|---------------|--------|
| ChronosInjector (core) | ✅ Emite comandos | - |
| ChronosInjector (bridge) | ⚠️ No usado | Ignorar |
| IPC Handlers | ❌ No existen | CREAR |
| Preload API | ❌ No expuesto | CREAR |
| ChronosIPCBridge | ❌ No existe | CREAR |
| ChronosLayout | ⚠️ Falta conexión | CONECTAR |
| FXMapper | ❌ No existe | CREAR |

**Estimación**: ~2-3 horas de trabajo para conexión funcional.

---

## 🔮 FUTURO

- **WAVE 2020**: Editor de efectos custom
- **WAVE 2021**: Scenes Tab en TheCommander para reproducción live
- **WAVE 2022**: Sync con música externa (SMPTE/MIDI timecode)
- **WAVE 2023**: Multi-track con layers de prioridad visual

---

**WAVE 2019: CHRONOS → STAGE** - El puente que faltaba 🔌⚡🎭
