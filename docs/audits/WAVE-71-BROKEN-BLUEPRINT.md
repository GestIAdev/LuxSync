# 🔍 THE BROKEN BLUEPRINT
## WAVE 71: Auditoría Forense Completa
### Flujo de Datos desde mind.ts hasta UI

---

## 📋 EXECUTIVE SUMMARY

**Síntomas Reportados:**
1. 🔴 **UI Flickering** - Chromatic Core parpadea
2. 🔴 **Vibe Constraint Violation** - DARK mood aparece en "Fiesta Latina" profile
3. 🔴 **Type Mismatch** - 11 MoodTypes (VibeProfile) vs 3 stableEmotions (SeleneProtocol)

**Diagnóstico Principal:**
> ⚠️ **DUAL COLOR ENGINE SYNDROME** - SeleneLux.ts tiene su propio ColorInterpolator que opera EN PARALELO al del Worker, causando condiciones de carrera cromáticas.

---

## 🗺️ ARQUITECTURA AS-IS (El Mapa Roto)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WORKER (mind.ts)                                │
│                                                                              │
│  ┌─────────────────┐    ┌───────────────────┐    ┌─────────────────────┐   │
│  │  MoodArbiter    │    │   VibeManager     │    │ SeleneColorEngine   │   │
│  │  ───────────    │    │   ───────────     │    │ (+ Interpolator)    │   │
│  │  stableEmotion  │───▶│constrainMetaEmotion│───▶│     palette HSL     │   │
│  │  3 types:       │    │  (11→3 mapping)   │    │     + paletteRGB    │   │
│  │  BRIGHT/DARK/   │    │                   │    │                     │   │
│  │  NEUTRAL        │    └───────────────────┘    └─────────────────────┘   │
│  └─────────────────┘             │                         │               │
│          │                       │                         │               │
│          ▼                       ▼                         ▼               │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                     LightingDecision                               │   │
│  │  ════════════════════════════════════════════════════════════════  │   │
│  │  {                                                                 │   │
│  │    palette: { primary, secondary, accent, ambient, intensity }     │   │
│  │    debugInfo: {                                                    │   │
│  │      mood: {                                                       │   │
│  │        stableEmotion: constrainedEmotion,  ← LA VERDAD            │   │
│  │        thermalTemperature: K,                                      │   │
│  │        colorStrategy: {...}                                        │   │
│  │      },                                                            │   │
│  │      activeVibe: string,                                           │   │
│  │      vibeTransitioning: boolean                                    │   │
│  │    }                                                               │   │
│  │  }                                                                 │   │
│  └────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        │ postMessage('LIGHTING_DECISION')
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             main.ts (Bridge)                                 │
│                                                                              │
│  trinity.on('lighting-decision', (decision) => {                            │
│    selene.updateFromTrinity(decision.debugInfo, decision.palette) ✅        │
│    mainWindow.webContents.send('trinity:lighting-decision', decision)       │
│  })                                                                          │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
                    ▼                                       ▼
┌───────────────────────────────────────┐   ┌─────────────────────────────────┐
│         SeleneLux.ts (Main)           │   │        Renderer (UI)             │
│                                       │   │                                  │
│  🚨 INFRACCIÓN #1: DUAL ENGINE        │   │   useSeleneBroadcast() hook     │
│  ═══════════════════════════════      │   │         ▼                        │
│  private colorInterpolator:           │   │   ChromaticCore.tsx             │
│    SeleneColorInterpolator            │   │   MusicalDNA.tsx                │
│    = new SeleneColorInterpolator()    │   │         ▼                        │
│         │                             │   │   Lectura de:                    │
│         │ ← PARALELO AL WORKER!       │   │   - cognitiveData.stableEmotion │
│         ▼                             │   │   - visualDecision.palette      │
│  updateFromTrinity():                 │   │                                  │
│    └─▶ workerColorState (RGB interp)  │   │  🚨 INFRACCIÓN #3: FALLBACK     │
│    └─▶ lastColors = interpolated      │   │  stableEmotion ?? 'NEUTRAL'     │
│                                       │   │                                  │
│  update() [Legacy Flow]:              │   └─────────────────────────────────┘
│    └─▶ colorInterpolator.update() 🔥  │
│    └─▶ lastColors = procedural        │
│                                       │
│  getBroadcast():                      │
│    └─▶ CognitiveData.stableEmotion    │
│        = trinityData?.mood?.          │
│          stableEmotion ?? 'NEUTRAL'   │
│    └─▶ visualDecision.palette         │
│        = this.lastColors (ambiguo!)   │
└───────────────────────────────────────┘
```

---

## 🚨 TABLA DE INFRACCIONES

| # | Ubicación | Línea | Infracción | Severidad | Síntoma |
|---|-----------|-------|------------|-----------|---------|
| **1** | `SeleneLux.ts` | 180 | **DUAL COLOR ENGINE** - Instancia propia de `SeleneColorInterpolator` | 🔴 CRÍTICA | UI Flickering |
| **2** | `SeleneLux.ts` | 845-848 | **RECÁLCULO PARALELO** - Llama `colorInterpolator.update()` en flujo Legacy | 🔴 CRÍTICA | Colores inconsistentes |
| **3** | `SeleneLux.ts` | 1670 | **FALLBACK NEUTRAL** - `stableEmotion ?? 'NEUTRAL'` ignora Vibe constraints | 🟡 MAYOR | DARK en Fiesta Latina |
| **4** | `VibeProfile.ts` vs `SeleneProtocol.ts` | N/A | **TYPE MISMATCH** - 11 MoodTypes mapeados a 3 MetaEmotions | 🟡 MAYOR | Pérdida de granularidad |
| **5** | `SeleneLux.ts` | 618, 782, 855, 1435 | **MÚLTIPLES PUNTOS DE MUTACIÓN** - 4 lugares sobrescriben `lastColors` | 🟡 MAYOR | Race conditions |

---

## 🔬 ANÁLISIS DETALLADO

### INFRACCIÓN #1 & #2: DUAL COLOR ENGINE SYNDROME

**Evidencia:**

```typescript
// SeleneLux.ts:180 - MOTOR LOCAL
private colorInterpolator: SeleneColorInterpolator = new SeleneColorInterpolator()

// SeleneLux.ts:845-848 - RECÁLCULO PARALELO (Legacy Flow)
const proceduralPalette = this.colorInterpolator.update(safeAnalysis as any, isDrop)
```

**Flujo Tóxico:**
1. Worker calcula `palette` con su propio `SeleneColorInterpolator` (WAVE 70)
2. Main.ts pasa `palette` a `selene.updateFromTrinity()`
3. PERO si `useBrain=true` (legacy), SeleneLux TAMBIÉN llama `colorInterpolator.update()`
4. **DOS interpoladores con estados diferentes** = condición de carrera

**Diagnosis:**
> El Worker (mind.ts línea 516) y SeleneLux (línea 845) ambos tienen `SeleneColorInterpolator` con estados internos desincronizados (`currentHue`, `baselineHue`, `dropLocked`).

---

### INFRACCIÓN #3: FALLBACK NEUTRAL BYPASS

**Evidencia:**

```typescript
// SeleneLux.ts:1670
stableEmotion: (trinityData?.mood?.stableEmotion ?? 'NEUTRAL') as 'BRIGHT' | 'DARK' | 'NEUTRAL',
```

**Flujo Tóxico:**
1. Si `trinityData.mood.stableEmotion` no existe → NEUTRAL
2. NEUTRAL permite CUALQUIER mood incluyendo "dark"
3. Fiesta Latina prohibe "dark" pero NEUTRAL no lo sabe

**Root Cause:**
> El fallback `?? 'NEUTRAL'` es incondicional y no consulta el Vibe activo para determinar el fallback apropiado.

---

### INFRACCIÓN #4: TYPE MISMATCH TAXONOMY

**Evidencia:**

| Sistema | Tipos | Fuente |
|---------|-------|--------|
| `VibeProfile.MoodType` | 11: peaceful, calm, dreamy, playful, festive, euphoric, dark, dramatic, aggressive, energetic, tense | `VibeProfile.ts:23-35` |
| `SeleneProtocol.CognitiveData.mood` | 7: peaceful, energetic, dark, playful, calm, dramatic, euphoric | `SeleneProtocol.ts:?` |
| `MoodArbiter.stableEmotion` | 3: BRIGHT, DARK, NEUTRAL | `MoodArbiter.ts:133` |

**Mapeo en VibeManager.constrainMetaEmotion():**

```typescript
// VibeManager.ts:425-455
const metaToMoods = {
  'BRIGHT': ['festive', 'euphoric', 'playful', 'energetic'],
  'DARK': ['dark', 'dramatic', 'tense', 'aggressive'],
  'NEUTRAL': ['calm', 'peaceful', 'dreamy'],
};
```

**Problema:**
> Se pierde información cuando 11 moods → 3 MetaEmotions. Ejemplo: `dramatic` (high energy, theatrical) se agrupa con `dark` (brooding).

---

### INFRACCIÓN #5: MÚLTIPLES PUNTOS DE MUTACIÓN

**Evidencia - 4 lugares sobrescriben `lastColors`:**

| Línea | Contexto | Origen de datos |
|-------|----------|-----------------|
| 618 | Brain output (Legacy) | freshRgbValues |
| 782 | Flow mode (Legacy) | ColorEngine.generate() |
| 855 | Trinity context (Legacy) | colorInterpolator.update() LOCAL |
| 1435 | updateFromTrinity() | workerColorState (Worker data) ✅ |

**Problema:**
> Si el flujo Legacy ejecuta antes que `updateFromTrinity()`, sobrescribe los colores del Worker con los del motor local.

---

## 📐 EL CONFLICTO DE FLUJOS

```
                    ┌─────────────────────────────────────┐
                    │         FLUJO LEGACY                │
                    │  (update() con useBrain=true)       │
                    │                                      │
                    │  colorInterpolator.update() LOCAL   │
                    │         │                            │
                    │         ▼                            │
                    │  lastColors = procedural (LOCAL)    │
                    └─────────────────────┬───────────────┘
                                          │
                    ┌─────────────────────┴───────────────┐
                    │         COLISIÓN                     │
                    │   ¿Cuál lastColors gana?            │
                    │   (depende del timing)              │
                    └─────────────────────┬───────────────┘
                                          │
                    ┌─────────────────────┴───────────────┐
                    │         FLUJO WORKER                 │
                    │  (updateFromTrinity())               │
                    │                                      │
                    │  workerColorState.interpolate()      │
                    │         │                            │
                    │         ▼                            │
                    │  lastColors = interpolated (WORKER) │
                    └─────────────────────────────────────┘
```

---

## 🔧 PLAN DE RE-CABLEADO (Para implementación futura)

### PASO 1: Unificar Fuente de Verdad
> **Eliminar** el `colorInterpolator` local de SeleneLux.ts y usar SOLO el del Worker.

```typescript
// ELIMINAR línea 180:
- private colorInterpolator: SeleneColorInterpolator = new SeleneColorInterpolator()

// ELIMINAR bloque 845-870:
- const proceduralPalette = this.colorInterpolator.update(...)
```

### PASO 2: Fallback Consciente del Vibe
> Cambiar fallback NEUTRAL a consultar el Vibe activo.

```typescript
// SeleneLux.ts:1670 - ACTUAL
stableEmotion: (trinityData?.mood?.stableEmotion ?? 'NEUTRAL')

// PROPUESTO
stableEmotion: (trinityData?.mood?.stableEmotion ?? this.getFallbackEmotionForVibe())
```

### PASO 3: Serializar Puntos de Mutación
> `lastColors` debe mutarse ÚNICAMENTE desde `updateFromTrinity()`.

```typescript
// Marcar líneas 618, 782, 855 como DEPRECATED
// Redirigir toda lógica a updateFromTrinity()
```

### PASO 4: Enriquecer Transporte de Datos
> Asegurar que `LightingDecision` siempre incluya `stableEmotion` constrained.

```typescript
// mind.ts - Ya correcto (línea 726)
stableEmotion: constrainedEmotion  // ✅ Constrained by Vibe
```

---

## 📊 MATRIZ DE RIESGO

| Fix | Impacto | Complejidad | Prioridad |
|-----|---------|-------------|-----------|
| Eliminar colorInterpolator local | Alto (elimina race condition) | Media | 🔴 P0 |
| Fallback consciente del Vibe | Alto (respeta constraints) | Baja | 🔴 P0 |
| Serializar mutaciones de lastColors | Medio (previene futuros bugs) | Alta | 🟡 P1 |
| Enriquecer transporte | Bajo (ya está correcto) | N/A | ⚪ Done |

---

## 🎯 CONCLUSIÓN

**Root Cause Principal:**
> SeleneLux.ts opera como un "puente dividido" - tiene lógica Legacy que compite con el flujo del Worker. El ColorInterpolator local (línea 180) es vestigio de una arquitectura anterior a WAVE 69 y debe eliminarse.

**Síntoma Observable:**
- Flickering = dos interpoladores con estados diferentes
- DARK en Fiesta Latina = fallback NEUTRAL ignora constraints

**Próximos Pasos:**
1. ⏳ WAVE 72: Implementar las 4 correcciones del Plan de Re-cableado
2. ⏳ Crear tests que verifiquen single source of truth para colores
3. ⏳ Validar con log que stableEmotion NUNCA sea NEUTRAL cuando hay Vibe activo

---

**Generado por:** GitHub Copilot  
**Fecha:** WAVE 71  
**Archivos Analizados:** 
- `mind.ts` (Worker)
- `SeleneLux.ts` (Main)
- `main.ts` (Bridge)
- `VibeProfile.ts` (Types)
- `VibeManager.ts` (Constraints)
- `MoodArbiter.ts` (Emotion)
- `SeleneProtocol.ts` (Protocol)
