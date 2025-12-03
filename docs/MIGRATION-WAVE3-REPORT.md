# 🌊 WAVE 3 REPORT: SYSTEM ALIVE

## 📋 Resumen
Wave 3 completado. El sistema LuxSync ahora tiene flujo de datos completo:
```
🎤 Audio → 🧠 Selene → 🎨 UI + 📤 DMX
```

## ✅ Componentes Conectados

### 1. Audio Input (Renderer → Main)
**Archivo:** `src/hooks/useAudioCapture.ts`
```typescript
// Web Audio API con FFT analysis
const useAudioCapture = (options) => {
  // Captura micrófono/system audio
  // Extrae bass, mid, treble, energy
  // Envía via window.lux.audioFrame()
}
```
- **FFT Size:** 2048 samples
- **Bandas:** bass (20-250Hz), mid (250-4kHz), treble (4k-20kHz)
- **Rate:** ~30 FPS sincronizado con main loop

### 2. Header BPM Display
**Archivo:** `src/components/Header.tsx`
```typescript
// Usa useSeleneAudio para BPM real-time
const seleneAudio = useSeleneAudio()
const displayBpm = seleneAudio.bpm > 0 ? seleneAudio.bpm : audio.bpm
const isBeatSync = seleneAudio.bass > 0.7
```
- BPM mostrado desde Selene state (actualizado cada 30ms)
- Beat sync indicator parpadea en bass > 0.7

### 3. PaletteReactor → Selene
**Archivo:** `src/components/PaletteReactor.tsx`
```typescript
// Click en paleta envía a Selene
const handlePaletteClick = (id: PaletteId) => {
  setPalette(id)  // UI store
  window.lux.setPalette(PALETTE_MAP[id])  // Selene IPC
}
```
- Mapeo: sunset→fuego, ocean→hielo, forest→selva, neon→neon
- Preview muestra color RGB actual de Selene

### 4. MovementControl → Selene
**Archivo:** `src/components/MovementControl.tsx`
```typescript
// Cambios en pattern/speed/range van a Selene
const handlePatternChange = (patternId) => {
  setMovementPattern(patternId)  // UI store
  sendToSelene(pattern, speed, range)  // IPC
}
```
- Pattern: lissajous, circle, wave, figure8, scan, random
- Speed: 0-1 (velocidad de animación)
- Range: 0-1 (intensidad de movimiento)

### 5. Main Loop + DMX Logs
**Archivo:** `electron/main.ts`
```typescript
// Loop principal con audio real/simulado
setInterval(() => {
  const useRealAudio = currentAudioData.energy > 0.05
  const state = selene.processAudioFrame(audioInput, deltaTime)
  
  // DMX log cada ~1 segundo
  console.log('[DMX] 🎨 RGB:', colors, '| 🎯 Pos:', pan, tilt)
}, 30)
```
- **Rate:** 33 FPS (30ms interval)
- **Audio Mode:** LIVE cuando hay entrada real, SIM cuando está idle
- **Logs:** RGB, Position, Beat status cada ~1 segundo

## 🔌 Flujo de Datos Completo

```
┌─────────────────────────────────────────────────────────────┐
│                      RENDERER PROCESS                        │
├─────────────────────────────────────────────────────────────┤
│  🎤 useAudioCapture                                         │
│       │                                                      │
│       ▼                                                      │
│  window.lux.audioFrame() ──────────────────────────────────┼──┐
│                                                              │  │
│  🎨 PaletteReactor                                          │  │
│       │                                                      │  │
│       ▼                                                      │  │
│  window.lux.setPalette() ──────────────────────────────────┼──┤
│                                                              │  │
│  🎯 MovementControl                                         │  │
│       │                                                      │  │
│       ▼                                                      │  │
│  window.lux.setMovement() ─────────────────────────────────┼──┤
│                                                              │  │
└──────────────────────────────────────────────────────────────┘  │
                                                                  │
┌──────────────────────────────────────────────────────────────┐  │
│                       MAIN PROCESS                            │  │
├──────────────────────────────────────────────────────────────┤  │
│                                                              │  │
│  ┌────────────────────────────────────────────┐              │  │
│  │  IPC Handlers                              │◄─────────────┼──┘
│  │  • lux:audio-frame → currentAudioData      │              │
│  │  • lux:set-palette → selene.setPalette()   │              │
│  │  • lux:set-movement → selene.setMovement() │              │
│  └────────────────────────────────────────────┘              │
│                       │                                       │
│                       ▼                                       │
│  ┌────────────────────────────────────────────┐              │
│  │  Main Loop (30ms)                          │              │
│  │  • processAudioFrame(audioData, deltaTime) │              │
│  │  • emit lux:update-state                   │              │
│  │  • console.log [DMX] output                │              │
│  └────────────────────────────────────────────┘              │
│                       │                                       │
│                       ▼                                       │
│  ┌────────────────────────────────────────────┐              │
│  │  🧠 SELENE LUX CORE                        │              │
│  │  ├── ColorEngine (RGB output)              │              │
│  │  ├── MovementEngine (Pan/Tilt)             │              │
│  │  └── BeatDetector (BPM/Beat sync)          │              │
│  └────────────────────────────────────────────┘              │
│                       │                                       │
└───────────────────────┼───────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────┐
│                     lux:update-state                           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  SeleneState {                                          │  │
│  │    colors: { primary, secondary, accent, ambient }      │  │
│  │    movement: { pan, tilt }                              │  │
│  │    beat: { bpm, onBeat, confidence }                    │  │
│  │    consciousness: { mood, mode, generation }            │  │
│  │  }                                                      │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────┐
│                    RENDERER (React)                            │
│  useSelene() hooks reciben state y actualizan UI               │
│  • useSeleneColor() → PaletteReactor preview                  │
│  • useSeleneAudio() → Header BPM display                      │
│  • useSeleneDimmer() → Dimmer controls                        │
└───────────────────────────────────────────────────────────────┘
```

## 📁 Archivos Modificados/Creados

### Nuevos
| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| `src/hooks/useAudioCapture.ts` | ~120 | Web Audio API hook |
| `src/hooks/useSelene.ts` | ~80 | React state bindings |
| `docs/MIGRATION-WAVE3-REPORT.md` | Este archivo |

### Modificados
| Archivo | Cambios |
|---------|---------|
| `src/App.tsx` | +useAudioCapture, +system status |
| `src/components/Header.tsx` | +useSeleneAudio for BPM |
| `src/components/PaletteReactor.tsx` | +lux.setPalette, +color preview |
| `src/components/MovementControl.tsx` | +lux.setMovement handlers |
| `electron/main.ts` | +currentAudioData, +DMX logs |

## 🧪 Testing Manual

### Verificar Audio Capture
1. Ejecutar `npm run dev`
2. Click en "Start Audio" (App.tsx)
3. Reproducir música
4. Verificar en terminal: `[DMX] 🎵 Audio: LIVE`

### Verificar Palette Flow
1. Click en paleta en PaletteReactor
2. Verificar color preview cambia
3. Verificar en terminal: colores RGB cambian

### Verificar Movement Flow
1. Cambiar pattern en MovementControl
2. Verificar en terminal: `[DMX] 🎯 Pos:` cambia

### Verificar BPM Display
1. Con audio activo, verificar Header muestra BPM
2. Beat dot parpadea en beats fuertes

## 🎯 Estado Final Wave 3

| Componente | Estado | Conexión |
|------------|--------|----------|
| Audio Input | ✅ | useAudioCapture → lux.audioFrame |
| Header BPM | ✅ | useSeleneAudio |
| PaletteReactor | ✅ | lux.setPalette |
| MovementControl | ✅ | lux.setMovement |
| Main Loop | ✅ | processAudioFrame + emit state |
| DMX Logs | ✅ | Console output cada ~1s |

## 🔮 Próximos Pasos (Wave 4)

1. **DMX Output Real** - Conectar a hardware USB-DMX
2. **Effect Triggers** - UI para efectos (strobe, blinder, etc)
3. **Fixture Editor** - Cargar fixtures .fxt
4. **Scene Presets** - Guardar/cargar configuraciones
5. **MIDI Input** - Control por MIDI

---
*Wave 3 completado - Sistema LuxSync ALIVE! 🌙✨*
