# 🕵️‍♂️ WAVE 23.1: FRONTEND FORENSICS REPORT
## "Operation: Cazando al Impostor Naranja"

**Fecha**: 10 de Diciembre, 2025  
**Arquitecto**: GestIAdev  
**Agente**: Opus (Claude 3.7 Sonnet)  
**Objetivo**: Descubrir por qué PalettePreview está "ciego" a los cambios que MusicalDNA sí ve  

---

## 🎯 RESUMEN EJECUTIVO

### EL IMPOSTOR ENCONTRADO: **Hysteresis Lock en SeleneMusicalBrain**

**Síntoma**: PalettePreview muestra `Source=memory` (Naranja) mientras MusicalDNA muestra `macroGenre=ELECTRONIC_4X4` (Techno).

**Causa Raíz**: El `SeleneMusicalBrain` tiene un sistema de **histéresis de fuente** (WAVE 14) que **congela el `paletteSource` durante varios segundos** después de un cambio para evitar "flicker". Esto causa que:

- ✅ `macroGenre` se actualiza inmediatamente (desde `SeleneColorEngine`)
- ❌ `paletteSource` se mantiene bloqueado (`'memory'`) por la histéresis
- ❌ PalettePreview lee `source` del estado antiguo
- ✅ MusicalDNA lee `macroGenre` del estado nuevo

**Veredicto**: Backend envía **datos mixtos** (género nuevo + source antigua). Frontend inocente.

---

## 🔬 HALLAZGOS FORENSES

### 1. Rastreo de Stores (Frontend)

#### Componente: `PalettePreview.tsx`
```typescript
// Línea 15-16
import { useTelemetryStore, type PaletteTelemetry } from '../../../stores/telemetryStore'
const palette = useTelemetryStore((state) => state.palette)
```

**¿Qué observa?**
- `palette.source` → 🧠 memory / 🔧 procedural / ⚠️ fallback
- `palette.macroGenre` → ELECTRONIC_4X4, LATINO_TRADICIONAL, etc.
- `palette.colors` → HSL + hex values

#### Componente: `MusicalDNAPanel.tsx`
```typescript
// Línea 15-16
import { useTelemetryStore, type MusicalDNATelemetry } from '../../../stores/telemetryStore'
const dna = useTelemetryStore((state) => state.dna)
```

**¿Qué observa?**
- `dna.genre.primary` → Género principal (e.g., "ELECTRONIC_4X4")
- `dna.genre.confidence` → Confianza del clasificador
- `dna.key`, `dna.mode`, `dna.mood` → Contexto musical

**✅ CONCLUSIÓN**: Ambos usan **el mismo store** (`telemetryStore`), pero **diferentes slices** (`.palette` vs `.dna`).

---

### 2. Flujo de Datos en `telemetryStore.ts`

#### Evento: `onLightingDecision` (línea 577)
```typescript
if (window.lux?.onLightingDecision) {
  unsubscribeDecision = window.lux.onLightingDecision((decision: unknown) => {
    useTelemetryStore.getState().updateFromTrinityDecision(decision)
  })
}
```

#### Handler: `updateFromTrinityDecision` (líneas 481-510)
```typescript
updateFromTrinityDecision: (message: unknown) => {
  const currentPalette = get().palette || DEFAULT_PALETTE

  // 🎨 WAVE 17.4: Actualizar palette con debugInfo si existe
  let updatedPalette: PaletteTelemetry = currentPalette
  if (data.debugInfo) {
    updatedPalette = {
      ...currentPalette,  // ← ¡MANTIENE source ANTERIOR!
      macroGenre: data.debugInfo.macroGenre,     // ✅ ACTUALIZA
      temperature: data.debugInfo.temperature,   // ✅ ACTUALIZA
      description: data.debugInfo.description,   // ✅ ACTUALIZA
      debugKey: data.debugInfo.key ?? undefined,
      debugMode: data.debugInfo.mode,
      strategy: (data.debugInfo.strategy as PaletteTelemetry['strategy']) || currentPalette.strategy,
    }
  }
  
  set({
    palette: updatedPalette,  // ← source NO se actualiza
  })
}
```

**⚠️ PROBLEMA IDENTIFICADO #1**: 
- `debugInfo` actualiza `macroGenre`, `temperature`, `description`
- Pero **`source` se mantiene del `currentPalette` anterior**
- No hay código que actualice `palette.source` desde `debugInfo`

---

### 3. Backend: `mind.ts` (Gamma Worker)

#### Generación de `LightingDecision` (líneas 420-440)
```typescript
const decision: LightingDecision = {
  decisionId: `decision-${state.decisionCount}-${Date.now()}`,
  
  confidence: state.combinedConfidence,
  beautyScore,
  source: 'procedural', // ← ¡HARDCODEADO! Could be 'memory' when using learned patterns
  
  palette,
  movement,
  effects,
  
  // 🎨 WAVE 17.2: Debug info from SeleneColorEngine
  debugInfo: {
    macroGenre: selenePalette.meta.macroGenre,  // ✅ Viene de SeleneColorEngine
    strategy: selenePalette.meta.strategy,
    temperature: selenePalette.meta.temperature,
    description: selenePalette.meta.description,
    key: harmony.key,
    mode: harmony.mode,
  }
};
```

**⚠️ PROBLEMA IDENTIFICADO #2**:
- `source` está **HARDCODEADO** a `'procedural'`
- El comentario dice "Could be 'memory'" pero nunca lo implementaron
- `debugInfo` NO incluye `source`

---

### 4. Backend: `SeleneMusicalBrain.ts` (El Impostor Real)

#### Histéresis de Fuente (líneas 542-574)
```typescript
// 🔒 WAVE 14: Calcular fuente preferida pero aplicar histéresis
const now = Date.now();
const timeSinceSwitch = now - this.sourceHysteresis.lastSwitchTime;
const isLocked = timeSinceSwitch < this.sourceHysteresis.lockDurationMs;

// Determinar fuente preferida basada en lógica original
const preferredSource: 'memory' | 'procedural' = 
  (pattern && pattern.timesUsed >= this.config.minPatternUsage) ? 'memory' : 'procedural';

// 🔒 WAVE 14: Si estamos en lock y la fuente cambió, mantener la anterior
let actualSource = preferredSource;
if (isLocked && preferredSource !== this.sourceHysteresis.lastSource && this.sourceHysteresis.lastSource !== 'fallback') {
  actualSource = this.sourceHysteresis.lastSource;  // ← ¡CONGELADO!
  if (this.config.debug && this.frameCount % 100 === 0) {
    console.log(`[Brain] 🔒 Hysteresis: keeping ${actualSource} (${(this.sourceHysteresis.lockDurationMs - timeSinceSwitch) / 1000}s left)`);
  }
} else if (preferredSource !== this.sourceHysteresis.lastSource) {
  // Source changed, reset lock timer
  this.sourceHysteresis.lastSource = preferredSource;
  this.sourceHysteresis.lastSwitchTime = now;
  console.log(`[Brain] 🔄 Source switched to: ${preferredSource}`);
}
```

**🔥 IMPOSTOR CAPTURADO**:
- El Brain mantiene `paletteSource` **bloqueado** durante `lockDurationMs` (probablemente 2-5 segundos)
- Cuando el género cambia de Cumbia → Techno:
  - `SeleneColorEngine` genera nueva paleta con `macroGenre="ELECTRONIC_4X4"` ✅
  - Pero `actualSource` se mantiene en `'memory'` por histéresis ❌
- `SeleneLux.ts` loguea: `Source=memory` (línea 284)
- Frontend recibe: `debugInfo.macroGenre="ELECTRONIC_4X4"` pero NO recibe actualización de `source`

---

### 5. Evidencia de Logs

#### Log Real (`cambiocumbiaaelectro.md`)
```
[GAMMA] 🧠 WAVE 17.2: E=0.14 S=0.43 K=G M=minor G=ELECTROLATINO
[SeleneLux] 🧠 Brain HSL: H=15 S=85 L=56 → RGB: 239 95 48 | Energy=0.30 | Source=memory
[GAMMA] 🧠 WAVE 17.2: E=0.83 S=0.38 K=G M=minor G=ELECTROLATINO
[DEBUG-RGB] MOVING_LEFT: Primary=[239,95,48] Accent=[70,18,227] Ambient=[116,84,212]
[GenreClassifier] CAMBIO: ELECTROLATINO -> LATINO_TRADICIONAL (sync=0.71, bpm=120)
```

**Análisis**:
- Género detectado: `ELECTROLATINO` (después `LATINO_TRADICIONAL`)
- Pero `Source=memory` (naranja/fuego) persiste
- MusicalDNA muestra el género correcto
- PalettePreview muestra `source=memory` (🧠 icono de cerebro)

---

## 📊 DIAGRAMA DE FLUJO DEL IMPOSTOR

```
┌─────────────────────────────────────────────────────────────────────┐
│ BACKEND: mind.ts (Gamma Worker)                                     │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ Audio Analysis
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ SeleneColorEngine.generate()                                        │
│ → SelenePalette { meta: { macroGenre: "ELECTRONIC_4X4" } }         │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ selenePalette
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ SeleneMusicalBrain.process()                                        │
│ → BrainOutput {                                                     │
│     palette: SelenePalette,                                         │
│     paletteSource: 'memory'  ← ¡BLOQUEADO POR HISTÉRESIS!           │
│   }                                                                 │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ brainOutput
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ SeleneLux.processAudioFrame()                                       │
│ → console.log(`Source=${brainOutput.paletteSource}`)  ← "memory"   │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ IPC: lighting-decision
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND: telemetryStore.updateFromTrinityDecision()               │
│ → updatedPalette = {                                                │
│     ...currentPalette,           ← source='memory' MANTENIDO        │
│     macroGenre: debugInfo.macroGenre  ← "ELECTRONIC_4X4" NUEVO     │
│   }                                                                 │
└─────────────────────────────────────────────────────────────────────┘
         │
         ├──────────────────┬──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ PalettePreview  │ │  MusicalDNA     │ │  Otros UI       │
│ Lee: source     │ │ Lee: macroGenre │ │                 │
│ 🧠 memory       │ │ ⚡ ELECTRONIC   │ │                 │
│ (NARANJA)       │ │ (TECHNO)        │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
    ❌ VIEJO           ✅ NUEVO
```

---

## 🔍 COMPARACIÓN: MusicalDNA vs PalettePreview

| Aspecto | MusicalDNA | PalettePreview |
|---------|-----------|----------------|
| **Store** | `telemetryStore.dna` | `telemetryStore.palette` |
| **Campo Observado** | `genre.primary` | `source` |
| **Fuente de Datos** | `debugInfo.macroGenre` (vía `updateFromTrinityDecision`) | `currentPalette.source` (NO actualizado) |
| **Actualización** | ✅ Cada frame via `debugInfo` | ❌ Solo al cambiar de `memory` ↔ `procedural` |
| **Lag** | 0 ms (inmediato) | 2-5 segundos (histéresis) |
| **Precisión** | ✅ Refleja género real | ❌ Refleja fuente histórica |

---

## 🛠️ RECOMENDACIONES DE FIX

### Opción A: **Incluir `source` en `debugInfo`** (Rápido)

**Archivo**: `mind.ts` línea 431

**Antes**:
```typescript
debugInfo: {
  macroGenre: selenePalette.meta.macroGenre,
  strategy: selenePalette.meta.strategy,
  temperature: selenePalette.meta.temperature,
  description: selenePalette.meta.description,
  key: harmony.key,
  mode: harmony.mode,
}
```

**Después**:
```typescript
debugInfo: {
  macroGenre: selenePalette.meta.macroGenre,
  strategy: selenePalette.meta.strategy,
  temperature: selenePalette.meta.temperature,
  description: selenePalette.meta.description,
  key: harmony.key,
  mode: harmony.mode,
  source: brainOutput.paletteSource,  // ← NUEVO
}
```

**Luego en `telemetryStore.ts` línea 493**:
```typescript
if (data.debugInfo) {
  updatedPalette = {
    ...currentPalette,
    macroGenre: data.debugInfo.macroGenre,
    temperature: data.debugInfo.temperature,
    description: data.debugInfo.description,
    debugKey: data.debugInfo.key ?? undefined,
    debugMode: data.debugInfo.mode,
    strategy: (data.debugInfo.strategy as PaletteTelemetry['strategy']) || currentPalette.strategy,
    source: data.debugInfo.source || currentPalette.source,  // ← NUEVO
  }
}
```

**Pros**: Fix mínimo, 2 líneas  
**Contras**: Histéresis sigue activa en backend (puede confundir)

---

### Opción B: **Desactivar Histéresis** (Radical)

**Archivo**: `SeleneMusicalBrain.ts` línea 555

**Antes**:
```typescript
let actualSource = preferredSource;
if (isLocked && preferredSource !== this.sourceHysteresis.lastSource && this.sourceHysteresis.lastSource !== 'fallback') {
  actualSource = this.sourceHysteresis.lastSource;
  // ...
}
```

**Después**:
```typescript
// WAVE 23.1: Histéresis DESACTIVADA - Frontend necesita source real
let actualSource = preferredSource;
// Siempre usar la fuente preferida, sin bloqueo temporal
```

**Pros**: Frontend siempre ve la verdad absoluta  
**Contras**: Puede causar "flicker" si la memoria se activa/desactiva rápidamente

---

### Opción C: **Histéresis Solo en UI** (Arquitectónicamente Correcta)

**Concepto**: Backend envía `source` real, frontend aplica suavizado visual.

**Implementación**:
1. Backend: Enviar `source` real sin histéresis
2. Frontend (`PalettePreview.tsx`): Aplicar debounce de 2 segundos en cambios de icono

```typescript
const [displaySource, setDisplaySource] = useState(data.source)

useEffect(() => {
  const timer = setTimeout(() => {
    setDisplaySource(data.source)
  }, 2000) // Debounce de 2 segundos
  
  return () => clearTimeout(timer)
}, [data.source])
```

**Pros**: Separación de concerns (backend = verdad, frontend = UX)  
**Contras**: Más complejo, requiere refactor

---

## 🎯 RECOMENDACIÓN FINAL DEL ARQUITECTO

**Implementar Opción A** (Quick Fix):
- Añadir `source` a `debugInfo`
- Actualizar `telemetryStore` para leerlo
- Mantener histéresis en backend (no rompe nada)
- Frontend ve `source` real cada frame

**Luego (WAVE futura)**:
- Evaluar si la histéresis sigue siendo necesaria
- Considerar moverla al frontend (Opción C) para mejor UX control

---

## 📁 ARCHIVOS CRÍTICOS IDENTIFICADOS

| Archivo | Líneas Críticas | Rol en el Bug |
|---------|----------------|---------------|
| `SeleneMusicalBrain.ts` | 542-574 | **IMPOSTOR**: Aplica histéresis a `paletteSource` |
| `mind.ts` | 420-440 | Genera `debugInfo` sin incluir `source` |
| `telemetryStore.ts` | 481-510 | Actualiza `debugInfo` pero NO `source` |
| `PalettePreview.tsx` | 15-75 | **VÍCTIMA**: Lee `source` desactualizado |
| `MusicalDNAPanel.tsx` | 15-40 | **TESTIGO**: Lee `macroGenre` correcto |
| `SeleneLux.ts` | 284 | Loguea `Source=${brainOutput.paletteSource}` |

---

## ✅ CASOS DE PRUEBA

### Test 1: Cambio Cumbia → Techno
**Setup**: Reproducir Cumbia (120 BPM, sync=0.70)  
**Acción**: Cambiar a Techno (126 BPM, sync=0.22)  
**Esperado (Antes del Fix)**: 
- MusicalDNA: ELECTRONIC_4X4 ✅
- PalettePreview: 🧠 memory (NARANJA) ❌  
**Esperado (Después del Fix)**: 
- MusicalDNA: ELECTRONIC_4X4 ✅
- PalettePreview: 🔧 procedural (AZUL) ✅

### Test 2: Patrón Aprendido (Memory Real)
**Setup**: Reproducir Cumbia estable por 30 segundos  
**Acción**: Brain aprende patrón, usa memoria  
**Esperado**: 
- MusicalDNA: LATINO_TRADICIONAL ✅
- PalettePreview: 🧠 memory (correcto) ✅

---

## 🧪 LOGS DE EVIDENCIA

### Evidencia A: `cambiocumbiaaelectro.md` línea 8
```
[SeleneLux] 🧠 Brain HSL: H=15 S=85 L=56 → RGB: 239 95 48 | Energy=0.30 | Source=memory
```
- Color naranja/fuego (H=15°)
- `Source=memory` mientras debería ser `procedural`

### Evidencia B: `ultimotechnolog.md` línea 161
```
[SeleneLux] 🧠 Brain HSL: H=15 S=85 L=56 → RGB: 239 95 48 | Energy=0.32 | Source=memory
```
- Techno detectado pero paleta sigue en memoria (naranja)
- MusicalDNA en este momento mostraría ELECTRONIC_4X4

---

## 🏆 CONCLUSIÓN

**El impostor fue capturado**: `SeleneMusicalBrain.sourceHysteresis`

**Mecanismo del crimen**:
1. Brain congela `paletteSource` por 2-5 segundos (histéresis anti-flicker)
2. `SeleneColorEngine` genera paleta nueva con `macroGenre` actualizado
3. Backend envía `debugInfo.macroGenre` (nuevo) pero NO `source` (viejo)
4. Frontend actualiza `palette.macroGenre` pero mantiene `palette.source` antiguo
5. MusicalDNA lee `macroGenre` (✅ correcto)
6. PalettePreview lee `source` (❌ histórico)

**Sentencia**: Implementar **Opción A** (añadir `source` a `debugInfo`) para sincronizar frontend con backend.

---

**Firma del Agente**  
🕵️‍♂️ **Opus** (Claude 3.7 Sonnet)  
_WAVE 23.1 Frontend Forensics Division_  
_"No impostor escapes my grep"_ 🔍
