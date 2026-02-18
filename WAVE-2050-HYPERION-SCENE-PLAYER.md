# WAVE 2050: HYPERION SCENE PLAYER 🎬

**Commit:** `1ad7888`  
**Push:** `7d95eaa..1ad7888 main -> main`  
**Fecha:** $(date)  
**Errores TypeScript:** 0  
**Archivos:** 4 (+1206 / -500 líneas)

---

## 🎯 OBJETIVO

> *"Elimina ese botón de REC rojo de la pestaña SCENES. Grabamos en Chronos, aquí reproducimos."*  
> — Comandante Radwulf

Convertir la pestaña SCENES de Hyperion — un cadáver de Wave 32 con botón REC inútil — en un **player de escenas .lux** capaz de reproducir el fruto de Chronos directamente en el Stage Simulator.

**Axioma fundamental:** Chronos graba. Hyperion reproduce. No se confunden.

---

## 📦 ARCHIVOS

| Archivo | Acción | Líneas |
|---------|--------|--------|
| `hooks/useScenePlayer.ts` | **NEW** | 496 |
| `sidebar/SceneBrowser.tsx` | **REWRITE** | 335 |
| `sidebar/SceneBrowser.css` | **REWRITE** | 375 |
| `sidebar/index.ts` | **FIX** | -1 |

---

## 🔧 ARQUITECTURA

### useScenePlayer.ts — El Motor

```
LuxProject (.lux)
    ↓
loadScene(project, audioUrl?)
    ↓
┌─────────────────────────────┐
│  HTMLAudioElement (audio)    │
│  requestAnimationFrame loop │
│         ↓                   │
│  Cada frame:                │
│  1. currentTimeMs = audio   │
│  2. Buscar clips activos    │
│  3. VibeClip → setVibe()    │
│  4. FXClip → arbiter.set()  │
└─────────────────────────────┘
    ↓
MasterArbiter (DMX output)
```

**PlayerState:** `idle → loaded → playing ⟷ paused → idle`

**FX Types soportados:**
- `strobe` → dimmer 1.0, flash channel
- `blackout` → dimmer 0, all channels 0
- `color-wash` → RGB interpolation via keyframes
- `intensity-ramp` → dimmer from keyframes
- `sweep` → pan interpolation
- `chase` → stepped keyframe progression
- `pulse` → dimmer sine wave
- `fade` → linear dimmer interpolation

**Keyframe interpolation modes:**
- `step` | `linear` | `ease-in` | `ease-out` | `ease-in-out`

**Cleanup protocol:**
- `cancelAnimationFrame` al desmontar
- Audio `.pause()` + `src = ''`
- `arbiter.clearAllManual()` → devuelve control a la IA

### SceneBrowser.tsx — La Interfaz

**ELIMINADO (Wave 32):**
- ❌ Botón REC rojo
- ❌ SceneCard con preview de color
- ❌ SceneStore integration
- ❌ Diálogo de grabación
- ❌ Quick Load
- ❌ SceneBrowserProps interface

**AÑADIDO (Wave 2050):**
- ✅ Import zone con drag & drop (.lux/.json)
- ✅ Lista de escenas importadas (nombre, clips, duración)
- ✅ Panel "Now Playing" con barra de progreso
- ✅ Controles de transporte: PLAY | PAUSE | STOP | LOOP
- ✅ Indicador de clips activos + vibe activa
- ✅ Botón Eject para descargar escena
- ✅ Botón Delete con confirmación
- ✅ Badge de estado: NO SCENE / READY / PLAYING / PAUSED

**Iconos:** Todos SVG custom inline (PlayIcon, PauseIcon, StopIcon, LoopIcon, ImportIcon, TrashIcon, EjectIcon) + LuxIcons (ScenesIcon, PlayCircleIcon, FileIcon, BoltIcon)

### SceneBrowser.css — El Estilo

**Theme:** Cyberpunk magenta/cyan (consistente con Hyperion)

| Sección | Descripción |
|---------|-------------|
| Import zone | Borde dashed magenta, gradiente hover, drag highlight cyan |
| Scene items | Indicator gradient cyan→magenta, hover reveal delete |
| Now Playing | Fondo oscuro, borde magenta, progress bar gradient |
| Transport | Play/Pause circular 42px, Stop cuadrado, Loop con glow activo |
| Badges | 4 estados con colores semánticos (gray/cyan/green/orange) |

---

## 🔗 INTEGRACIÓN

```
StageSidebar.tsx
  └── activeTab === 'scenes'
       └── <SceneBrowser />     ← Sin props (autocontenido)
            └── useScenePlayer()
                 ├── loadScene(project)
                 ├── play/pause/stop
                 └── arbiter.setManual() → DMX output
```

**No se tocaron:** StageSidebar.tsx, AppCommander.tsx, ChronosEngine.ts, MasterArbiter — el SceneBrowser es autocontenido.

---

## 📊 ESTADO DEL ARTE

| Funcionalidad | Estado |
|---------------|--------|
| Importar .lux | ✅ |
| Drag & drop | ✅ |
| Múltiples escenas | ✅ |
| Play/Pause/Stop | ✅ |
| Loop | ✅ |
| Progress bar | ✅ |
| Clip counter | ✅ |
| Vibe indicator | ✅ |
| Audio sync | ✅ (HTMLAudioElement) |
| Arbiter injection | ✅ (setManual + clearAllManual) |
| Keyframe interpolation | ✅ (5 modos) |
| Cleanup on unmount | ✅ |
| TypeScript errors | 0 |

---

*Chronos compone. Hyperion ejecuta. El artista y su escenario.*  
*— PunkOpus, Wave 2050*
