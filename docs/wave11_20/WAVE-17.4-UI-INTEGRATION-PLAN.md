# 🎨 WAVE 17.4 - UI INTEGRATION PLAN

**Objetivo:** Conectar los datos del nuevo `SeleneColorEngine` (Wave 17.2/17.3) a la UI de telemetría existente.

---

## 📊 ARQUITECTURA DESCUBIERTA

### Flujo de Datos Actual

```
GAMMA Worker (mind.ts)
  ↓ genera LightingDecision con debugInfo (✅ Wave 17.3)
  ↓
TrinityOrchestrator
  ↓ processLightingDecision()
  ↓ emit('lighting-decision', decision)
  ↓
??? (MISSING LINK) ???
  ↓
TrinityProvider (React)
  ↓ handleStateUpdate()
  ↓
Stores (audioStore, seleneStore, dmxStore, luxsyncStore)
  ↓
UI Components (PalettePreview, MusicalDNAPanel)
```

### Problema Identificado

**El `debugInfo` del SeleneColorEngine NO se está propagando a la UI porque:**

1. ✅ `mind.ts` genera `debugInfo` correctamente (Wave 17.3)
2. ✅ `WorkerProtocol.LightingDecision` tiene campo `debugInfo` (Wave 17.3)
3. ❌ `TrinityProvider` NO captura el `debugInfo` de las state updates
4. ❌ `telemetryStore` NO tiene campos para `macroGenre`, `temperature`
5. ❌ `PalettePreview` NO muestra estos datos

---

## 🎯 PLAN DE IMPLEMENTACIÓN

### Fase 1: Telemetry Data Flow

**1.1 Actualizar SeleneStateUpdate interface** (`TrinityProvider.tsx`)
```typescript
interface SeleneStateUpdate {
  colors?: { primary, secondary, accent }
  movement?: { pan, tilt, pattern, speed }
  beat?: { bpm, onBeat, beatPhase }
  brain?: { mode, confidence, energy }
  palette?: { name, source }
  
  // 🎨 WAVE 17.4: SeleneColorEngine debug info
  debugInfo?: {
    macroGenre?: string
    strategy?: string
    temperature?: string
    description?: string
    key?: string | null
    mode?: string
  }
}
```

**1.2 Actualizar PaletteTelemetry** (`telemetryStore.ts` + `SeleneTelemetryCollector.ts`)
```typescript
export interface PaletteTelemetry {
  strategy: 'analogous' | 'triadic' | 'complementary' | 'split-complementary'
  source: 'memory' | 'procedural' | 'fallback'
  
  // 🎨 WAVE 17.4: New fields
  macroGenre?: string        // 'ELECTRONIC_4X4', 'LATINO_TRADICIONAL', etc.
  temperature?: string       // 'warm', 'cool', 'neutral'
  description?: string       // 'Azul profundo hipnótico (Techno A minor)'
  
  colors: { primary, secondary, accent, ambient, contrast }
  dnaDerivation: { keyToHue, modeShift, zodiacPull, finalHue }
}
```

**1.3 Conectar debugInfo en TrinityProvider**
```typescript
// En handleStateUpdate()
if (seleneState.debugInfo) {
  // Actualizar telemetryStore con los nuevos datos
  useTelemetryStore.getState().updatePalette({
    macroGenre: seleneState.debugInfo.macroGenre,
    strategy: seleneState.debugInfo.strategy,
    temperature: seleneState.debugInfo.temperature,
    description: seleneState.debugInfo.description,
  })
}
```

---

### Fase 2: UI Components

**2.1 Actualizar PalettePreview.tsx**
```tsx
// Mostrar macro-género y temperatura
<div className="macro-genre-badge">
  <span className="genre-icon">{getMacroGenreIcon(data.macroGenre)}</span>
  <span className="genre-name">{data.macroGenre || 'PROCEDURAL'}</span>
</div>

<div className="temperature-indicator">
  <span className={`temp-icon ${data.temperature}`}>
    {data.temperature === 'warm' ? '🔥' : data.temperature === 'cool' ? '❄️' : '〰️'}
  </span>
  <span className="temp-label">{data.temperature || 'neutral'}</span>
</div>

// Tooltip con descripción completa
<div className="palette-description" title={data.description}>
  {data.description || 'Paleta procedural generada'}
</div>
```

**2.2 Actualizar MusicalDNAPanel.tsx**
```tsx
// Usar debugInfo.key y debugInfo.mode si están disponibles
const displayKey = debugInfo?.key || dna.key
const displayMode = debugInfo?.mode || dna.mode

<div className="key-display">
  <span className="key-value">{displayKey || '—'}</span>
  <span className="mode-badge">{displayMode}</span>
  {debugInfo && <span className="source-badge">SeleneColorEngine</span>}
</div>
```

---

### Fase 3: System Integration (OPCIONAL - Sistema Dual)

**El desafío:** Hay DOS sistemas corriendo en paralelo:

1. **TRINITY System** (Workers: ALPHA/BETA/GAMMA)
   - Usado para modo "SELENE INTELLIGENT"
   - Genera LightingDecision con debugInfo
   - UI muestra "MODE: INTELLIGENT" (según screenshot)

2. **SeleneLux Brain** (Clase clásica)
   - Usado para modo "FLOW" o fallback
   - Genera BrainOutput SIN debugInfo
   - Sistema original (Waves 8-14)

**Decisión:**  
NO necesitamos modificar SeleneLux Brain ahora. El debugInfo solo fluye cuando TRINITY está activo (modo INTELLIGENT), que es el caso según la UI.

---

## 🔧 IMPLEMENTACIÓN PRIORITARIA

### Archivos a Modificar

| Archivo | Cambio | Prioridad |
|---------|--------|-----------|
| `TrinityProvider.tsx` | Capturar debugInfo en handleStateUpdate | 🔴 CRITICAL |
| `telemetryStore.ts` | Agregar campos a PaletteTelemetry | 🔴 CRITICAL |
| `PalettePreview.tsx` | Mostrar macroGenre + temperature | 🟡 HIGH |
| `MusicalDNAPanel.tsx` | Usar debugInfo.key/mode si disponible | 🟢 MEDIUM |
| `SeleneTelemetryCollector.ts` | Mapear debugInfo a PaletteTelemetry | 🟡 HIGH |

---

## 🎨 UI MOCKUP

### PalettePreview Component (Actualizado)

```
┌─────────────────────────────────────────┐
│ 🎨 PALETTE           🧠 procedural     │
├─────────────────────────────────────────┤
│                                         │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐       │
│  │ P │ │ S │ │ A │ │Am │ │ C │       │
│  └───┘ └───┘ └───┘ └───┘ └───┘       │
│                                         │
│  🎸 ELECTRONIC_4X4          ❄️ cool    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━       │
│                                         │
│  Primary: H: 240° S: 40% L: 27%       │
│  #292961                                │
│                                         │
│  Strategy: analogous                    │
│  "Azul profundo hipnótico (A minor)"   │
└─────────────────────────────────────────┘
```

---

## ⚡ QUICK WIN APPROACH

**Implementación mínima para ver datos fluyendo:**

1. ✅ Agregar campos a `PaletteTelemetry` interface (2 min)
2. ✅ Capturar `debugInfo` en `TrinityProvider` (5 min)
3. ✅ Mostrar `macroGenre` en `PalettePreview` (3 min)
4. ✅ Test con música real (2 min)

**Total:** ~12 minutos para ver los primeros resultados.

---

## 🚀 PRÓXIMOS PASOS

1. Implementar cambios en orden de prioridad
2. Verificar con `console.log` que `debugInfo` llegue a TrinityProvider
3. Testear con música (Techno → debería mostrar "ELECTRONIC_4X4" + "cool")
4. Testear con Cumbia → debería mostrar "LATINO_TRADICIONAL" + "warm")
5. Screenshot de UI actualizada
6. Documentar Wave 17.4 completada

---

**Wave 17.4 = INICIO ✅**  
*Next: Implementación incremental con validación continua*
