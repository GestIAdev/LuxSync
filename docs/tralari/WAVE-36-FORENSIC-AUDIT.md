# 🔬 WAVE 36.0 - DEEP CORE FORENSIC AUDIT

**Fecha**: 2025-12-18  
**Objetivo**: Entender cómo piensa Selene (Backend Wave 24) para conectarla al Frontend (TruthStore Wave 35)

---

## 📊 ARQUITECTURA ACTUAL: FLUJO DE DATOS

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        🎵 AUDIO INPUT                                        │
│                     (System Audio Capture)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     📡 AUDIO METRICS                                         │
│         { bass, mid, treble, energy, peak, timestamp }                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
┌─────────────────────────────┐     ┌─────────────────────────────────────────┐
│   🥁 BeatDetector.ts        │     │   🧠 SeleneMusicalBrain.ts               │
│   ─────────────────────────│     │   ───────────────────────────────────── │
│   • BPM detection           │     │   • MusicalContextEngine (percepción)   │
│   • Beat phase (0-1)        │     │   • SeleneMemoryManager (memoria)       │
│   • Kick/Snare/HiHat        │     │   • ProceduralPaletteGenerator          │
│   • onBeat flag             │     │   • MusicToLightMapper (acción)         │
│                             │     │                                         │
│   Output: BeatState         │     │   Output: BrainOutput                   │
└─────────────────────────────┘     │   • palette: { primary, secondary... }  │
                    │               │   • context: { genre, harmony, section }│
                    │               │   • confidence, estimatedBeauty         │
                    │               └─────────────────────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     🌙 SeleneLux.ts (MAIN ORCHESTRATOR)                      │
│   ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│   processAudioFrame(metrics, deltaTime) → SeleneState                       │
│      │                                                                      │
│      ├── beatDetector.process(metrics) → BeatState                          │
│      │                                                                      │
│      ├── [IF Brain Initialized]                                             │
│      │      │                                                               │
│      │      ├── brain.process(audioAnalysis) → BrainOutput                  │
│      │      │                                                               │
│      │      ├── 🎨 SeleneColorEngine.generate(safeAnalysis) → HSL Palette   │
│      │      │                                                               │
│      │      └── paletteToRgb(hslPalette) → RGB for DMX                      │
│      │                                                                      │
│      └── [ELSE Legacy Mode]                                                 │
│             └── colorEngine.generate(metrics) → ColorOutput                 │
│                                                                             │
│   getBroadcast() → SeleneBroadcast (WAVE 25 - Truth Protocol)               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
┌─────────────────────────────┐     ┌─────────────────────────────────────────┐
│   📡 Telemetry Collector    │     │   🌙 SeleneBroadcast                     │
│   ─────────────────────────│     │   ───────────────────────────────────── │
│   emit('telemetry-update')  │     │   • sensory: { audio, beat, input }     │
│   • 20 FPS                  │     │   • cognitive: { mood, evolution }      │
│   • Legacy UI consumption   │     │   • musicalDNA: { key, mode, genre }    │
│                             │     │   • visualDecision: { palette, move }   │
│   ⚠️ LEGACY - Duplicated    │     │   • hardwareState: { dmx, fixtures }    │
│                             │     │   • system: { fps, uptime, mode }       │
└─────────────────────────────┘     │                                         │
                                    │   ✅ WAVE 25 - The Single Source        │
                                    └─────────────────────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     💡 DMX OUTPUT                                            │
│                     (FixtureManager → Hardware)                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧠 1. ANÁLISIS DEL CEREBRO (engines/consciousness)

### 📍 SeleneLuxConscious.ts (936 líneas)
**Estado**: LEGACY - No se usa en el flujo principal actual

Este archivo contiene la consciencia "felina" original:
- `AudioToMusicalMapper`
- `UltrasonicHearingEngine`
- `ConsciousnessToLightMapper`
- `SeleneEvolutionEngine` (Wave 6)
- `DreamForgeEngine` + `SelfAnalysisEngine` (Wave 7)

**Dónde se decide el MOOD**:
```typescript
// Línea 151-156
private consciousness: ConsciousnessStateV2 = {
  status: 'awakening',
  generation: 0,
  mood: 'harmonious',  // ← ESTADO LOCAL
  experienceCount: 0,
  lastInsight: 'Selene abre los ojos...',
}
```

**⚠️ PROBLEMA**: Este `consciousness.mood` es local y NO se expone al truthStore.

### 📍 SeleneMusicalBrain.ts (1130 líneas)
**Estado**: ACTIVO - Cerebro principal

El Brain decide basándose en:
1. `MusicalContextEngine` → Detecta género, armonía, sección
2. `SeleneMemoryManager` → Busca patrones aprendidos
3. `ProceduralPaletteGenerator` → Genera colores si no hay memoria
4. `MusicToLightMapper` → Traduce música a sugerencias de luz

**⚠️ PROBLEMA**: El Brain emite eventos locales (`emit('output')`) pero no actualiza el truthStore directamente.

---

## 👻 2. EL FANTASMA DE WAVE 24 (SeleneLux.ts)

### 📍 Origen del Log `WAVE24.4 DUAL`

**Archivo**: `SeleneLux.ts`, línea **473**
```typescript
console.log(`[SeleneLux] 🎨 WAVE24.4 DUAL: HSL(UI)=${Math.round(hsl.h)}°... | RGB(DMX)=...`)
```

**Este log ocurre cada ~100 frames** (`if (this.frameCount % 100 === 0)`)

### 📍 ¿Sobrescribe decisiones?

**SÍ**. El flujo actual en `processAudioFrame()`:

1. Brain genera `BrainOutput` con paleta
2. Pero luego **Wave 24.4 sobrescribe**:
   ```typescript
   // Línea 414-419
   const freshHslPalette = SeleneColorEngine.generate(safeAnalysis)
   const freshRgbValues = paletteToRgb(freshHslPalette)
   
   // Línea 443-453 - SOBRESCRIBE la paleta del Brain
   brainOutput.palette = {
     primary: freshHslPalette.primary,
     ...
   }
   brainOutput.paletteSource = 'procedural'  // Forzar etiqueta
   ```

**🎯 CONCLUSIÓN**: El `SeleneColorEngine` SIEMPRE sobrescribe la decisión del Brain. La memoria del Brain está "lobotomizada" (Wave 23.4).

### 📍 Cómo desactivar el ColorEngine legacy

**Opción A**: Remover las líneas 414-453 y confiar en `brainOutputToColors()`

**Opción B**: Condicionar con flag:
```typescript
if (!this.useLegacyColorEngine) {
  // Usar brainOutput.palette directamente
} else {
  // Código actual Wave 24.4
}
```

---

## 🔊 3. ANÁLISIS DEL RUIDO (engines/audio)

### 📍 BeatDetector.ts
**Estado**: LIMPIO - No hay logs spam aquí

El BeatDetector es silencioso, solo calcula:
- BPM desde intervalos de kicks
- Fase del beat (0-1)
- Detección de instrumentos

### 📍 Origen de logs `[GAMMA]`

**Archivo**: `src/main/workers/mind.ts`

| Línea | Log | Contexto |
|-------|-----|----------|
| 25 | `[GAMMA] 🎨 WAVE 17.2: E=... S=... K=... M=... G=...` | Cada frame procesado |
| 343 | Mismo log | Duplicado en otro bloque |
| 578 | `[GAMMA] State restored` | Al restaurar estado |
| 591 | `[GAMMA] 🧠 Mind initialized` | Una vez al inicio |
| 647 | `[GAMMA] Config updated` | Cuando cambia config |
| 656-677 | Varios logs de modo | Al cambiar modo |

### 📍 Plan de Silencio

Para silenciar el spam de `[GAMMA] 🎨 WAVE 17.2`:

**Opción A** - Condicionar con flag:
```typescript
// En mind.ts línea 25
if (DEBUG_GAMMA) {
  console.log(`[GAMMA] 🎨 WAVE 17.2: ...`)
}
```

**Opción B** - Reducir frecuencia (cada N frames):
```typescript
if (frameCount % 100 === 0) {
  console.log(`[GAMMA] 🎨 WAVE 17.2: ...`)
}
```

---

## 🗺️ 4. MAPA DE CONEXIÓN (The Gap)

### 📍 Sistema Actual de Eventos

```
SeleneLux                    →  main.ts  →  IPC  →  Frontend
   │                                                    │
   ├── emit('telemetry-update')  ────────────────────→  ❌ No usado
   ├── emit('brain-output')      ────────────────────→  ❌ No usado
   ├── emit('log')               ────────────────────→  ✅ logStore (Wave 25.7)
   └── getBroadcast()            ────────────────────→  ✅ truthStore (Wave 25)
```

### 📍 El Puente: getBroadcast()

`SeleneLux.getBroadcast()` (línea 1008) YA genera el `SeleneBroadcast` completo:

```typescript
return {
  sensory,        // Audio crudo
  cognitive,      // Mood, evolution, beauty
  musicalDNA,     // Genre, key, mode, section
  visualDecision, // Palette, movement, effects
  hardwareState,  // DMX, fixtures
  system,         // FPS, uptime, mode
}
```

### 📍 Puntos de Inyección

**Dónde conectar truthStore.update()**:

1. **main.ts** (IPC bridge) - Llamar `getBroadcast()` y emitir via `selene:broadcast`
2. **Renderer** (truthStore) - Recibir broadcast y hacer `setState()`

**Código propuesto**:

```typescript
// En main.ts
setInterval(() => {
  if (selene) {
    const broadcast = selene.getBroadcast()
    mainWindow?.webContents.send('selene:broadcast', broadcast)
  }
}, 1000 / 30)  // 30 FPS

// En el renderer (donde se inicia truthStore)
window.lux.onBroadcast((broadcast) => {
  useTruthStore.getState().update(broadcast)
})
```

---

## 📋 5. PUNTOS DE CORTE (Legacy vs Active)

### 🔴 ELIMINAR/REEMPLAZAR

| Archivo | Razón |
|---------|-------|
| `SeleneLuxConscious.ts` | No usado, duplica lógica del Brain |
| `ConsciousnessToLightMapper.ts` | Replaced by SeleneColorEngine |
| `UltrasonicHearingEngine.ts` | Concepto no usado |
| `DreamForgeEngine.ts` | Wave 7 abandonado |
| `SelfAnalysisEngine.ts` | Wave 7 abandonado |
| `ColorEngine.ts` (legacy) | Replaced by SeleneColorEngine |

### 🟡 SILENCIAR (Keep but reduce logging)

| Archivo | Líneas | Acción |
|---------|--------|--------|
| `workers/mind.ts` | 25, 343 | Condición `if (frameCount % 100 === 0)` |
| `SeleneLux.ts` | 473 | Ya tiene condición, pero considerar eliminar |

### 🟢 MANTENER Y CONECTAR

| Archivo | Propósito | Conexión |
|---------|-----------|----------|
| `SeleneLux.ts` | Orquestador principal | `getBroadcast()` → truthStore |
| `SeleneMusicalBrain.ts` | Cerebro activo | Via SeleneLux |
| `SeleneColorEngine.ts` | Motor de color procedural | Via SeleneLux |
| `BeatDetector.ts` | Detección de ritmo | Via SeleneLux |
| `SeleneTelemetryCollector.ts` | Puede eliminarse si truthStore reemplaza | Evaluar |

---

## 🎯 6. PLAN DE ACCIÓN WAVE 37

### Fase 1: Silencio (Quick Win)
- [ ] Agregar `DEBUG_GAMMA` flag en `workers/mind.ts`
- [ ] Reducir frecuencia de log `WAVE24.4 DUAL` o eliminar

### Fase 2: Puente IPC
- [ ] Verificar que `main.ts` llama `getBroadcast()` y emite
- [ ] Verificar que `truthStore` recibe el broadcast correctamente
- [ ] Eliminar sistema de eventos legacy (`telemetry-update`)

### Fase 3: Consolidación del Mood
- [ ] El `consciousness.currentMood` en SeleneLux viene de `cognitive.mood`
- [ ] Conectar a `musicalDNA.rhythm.pattern` para inferir mood desde género
- [ ] Exponer en `cognitive.mood` del broadcast

### Fase 4: Limpieza
- [ ] Mover archivos legacy a `/deprecated/`
- [ ] Documentar el nuevo flujo simplificado

---

## 📈 DIAGRAMA SIMPLIFICADO POST-WAVE 37

```
Audio → BeatDetector → Brain → SeleneColorEngine → getBroadcast() → truthStore
                                                          │
                                                          └→ logStore (events)
```

---

## 🔑 RESUMEN EJECUTIVO

| Área | Descubrimiento |
|------|----------------|
| **Mood Decision** | Está en `SeleneLux.consciousness.currentMood`, pero es estado LOCAL |
| **WAVE24.4 DUAL** | Log en `SeleneLux.ts:473` - el `SeleneColorEngine` SOBRESCRIBE decisiones del Brain |
| **[GAMMA] Spam** | Origen: `workers/mind.ts` líneas 25 y 343 - cada frame |
| **El Puente** | YA EXISTE: `getBroadcast()` genera `SeleneBroadcast` completo |
| **Legacy Muerto** | `SeleneLuxConscious.ts`, `DreamForge`, `SelfAnalysis` - Wave 6/7 abandonados |

---

Fin del Audit. 🌙
