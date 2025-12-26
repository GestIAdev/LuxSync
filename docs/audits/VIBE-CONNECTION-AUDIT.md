# 🕵️ VIBE-CONNECTION-AUDIT.md
## WAVE 140: ARCHITECTURAL RECONNAISSANCE - PARTE 1

**Fecha:** 26 de Diciembre de 2025  
**Objetivo:** Auditoría forense de la "Tubería de Vibes"

---

## 📋 RESUMEN EJECUTIVO

**Estado del Sistema:** PARCIALMENTE CONECTADO  
**Problema Principal:** El VibeManager funciona correctamente en el Worker, pero SeleneLux.ts tiene bloques hardcodeados que IGNORAN sus restricciones.

---

## 🔍 HALLAZGO 1: ESTADO DEL VIBEMANAGER

### Ubicación
```
electron-app/src/engines/context/VibeManager.ts (592 líneas)
```

### ¿Qué Contiene?

| Funcionalidad | Estado | Descripción |
|---------------|--------|-------------|
| Singleton Pattern | ✅ Funcional | `getInstance()`, `resetInstance()` |
| Vibe Switching | ✅ Funcional | `setActiveVibe()`, `setActiveVibeImmediate()` |
| Transition Logic | ✅ Funcional | `updateTransition()`, 180 frames @ 60fps |
| Mood Constraints | ✅ Funcional | `validateMood()`, `constrainMood()` |
| Color Constraints | ✅ Funcional | `constrainColor()`, `constrainTemperature()`, `constrainSaturation()` |
| Dimmer Constraints | ✅ Funcional | `constrainDimmer()`, `getDimmerFloor()` |
| Drop Constraints | ✅ Funcional | `isDropAllowed()`, `getDropConstraints()` |
| Effect Constraints | ✅ Funcional | `isEffectAllowed()`, `getMaxStrobeRate()` |
| Debug Info | ✅ Funcional | `getDebugInfo()` |

### ¿Referencias a TropicalStereoPhysics o SolarFlare?

**❌ NO HAY** - Estos conceptos no existen en el código actual.

```bash
# Búsqueda realizada:
grep -r "TropicalStereo|SolarFlare|PhysicsEngine" --include="*.ts"
# Resultado: No matches found
```

---

## 🔍 HALLAZGO 2: EL ESLABÓN PERDIDO

### SeleneLux.ts NO Importa VibeManager

```typescript
// Búsqueda de imports en SeleneLux.ts
// ❌ NO HAY: import { VibeManager } from ...
// ❌ NO HAY: vibeManager.getInstance()
// ❌ NO HAY: vibeManager.update()

// Solo hay UN comentario referenciándolo:
// Línea 2092: // 🎛️ WAVE 66: Vibe Context from VibeManager
// Pero NO hay código que lo use
```

### ¿Dónde SÍ se Usa VibeManager?

| Archivo | Uso |
|---------|-----|
| `mind.ts` (Worker) | ✅ **ACTIVO** - Instanciado, llamadas a constraint methods |
| `VibeManager.test.ts` | ✅ Tests unitarios |
| `SeleneProtocol.ts` | Solo comentario de documentación |
| `presets/index.ts` | Re-exporta VibeManager |

### Flujo Actual en mind.ts (Worker)

```typescript
// Línea 342
const vibeManager = VibeManager.getInstance();

// Línea 511 - Se actualiza cada frame
vibeManager.updateTransition(state.frameCount);

// Línea 514 - Constrain Emotion
const constrainedEmotion = vibeManager.constrainMetaEmotion(moodArbiterOutput.stableEmotion);

// Línea 517 - Constrain Strategy
const constrainedStrategy = vibeManager.constrainStrategy(strategyArbiterOutput.stableStrategy);

// Línea 531 - Get Active Vibe
const activeVibe = vibeManager.getActiveVibe();

// Línea 615 - Constrain Intensity
const intensity = vibeManager.constrainDimmer(rawIntensity);

// Línea 673-674 - Strobe Rate
const maxStrobeRate = vibeManager.getMaxStrobeRate();
const vibeAllowsStrobe = maxStrobeRate > 0 && vibeManager.isEffectAllowed('strobe');
```

### El Problema: Datos Pasan pero Son Ignorados

```
                           ┌──────────────────────────────────────────┐
                           │             mind.ts (Worker)             │
                           │                                          │
  [Audio] ──► [Analyzers] ──► [VibeManager.constrainXXX()] ──►       │
                           │           │                              │
                           │           ▼                              │
                           │  [stabilizedAnalysis + activeVibe.id]    │
                           └──────────────────┬───────────────────────┘
                                              │
                                              ▼ (postMessage)
                           ┌──────────────────────────────────────────┐
                           │           SeleneLux.ts                   │
                           │                                          │
                           │  [Recibe constrainedEmotion, activeVibe] │
                           │           │                              │
                           │           ▼                              │
                           │  [SeleneColorEngine genera paleta]       │
                           │           │                              │
                           │           ▼                              │
                           │  ┌───────────────────────────┐           │
                           │  │ if (isTechnoVibe) {       │ ◄── ❌ BYPASS
                           │  │   SOBRESCRIBIR lastColors │           │
                           │  │ }                         │           │
                           │  │ if (isPopRockVibe) {      │ ◄── ❌ BYPASS
                           │  │   SOBRESCRIBIR lastColors │           │
                           │  │ }                         │           │
                           │  └───────────────────────────┘           │
                           │           │                              │
                           │           ▼                              │
                           │  [DMX Output]                            │
                           └──────────────────────────────────────────┘
```

**Conclusión:** VibeManager hace su trabajo en el Worker, pero los bloques hardcodeados en SeleneLux.ts (Techno Prism, Rock Stage) IGNORAN esos constraints.

---

## 🔍 HALLAZGO 3: CONFIGURACIÓN DISPERSA

### Estructura de Archivos de Vibes

```
electron-app/src/
├── types/
│   └── VibeProfile.ts          ◄── Definición de interfaces (360 líneas)
│
├── engines/context/
│   ├── VibeManager.ts          ◄── Singleton manager (592 líneas)
│   ├── index.ts                ◄── Re-exports
│   └── presets/
│       ├── index.ts            ◄── Registry central
│       ├── IdleProfile.ts      ◄── Vibe: Idle
│       ├── TechnoClubProfile.ts ◄── Vibe: Techno Club (124 líneas)
│       ├── FiestaLatinaProfile.ts ◄── Vibe: Fiesta Latina
│       ├── PopRockProfile.ts   ◄── Vibe: Pop Rock
│       └── ChillLoungeProfile.ts ◄── Vibe: Chill Lounge
```

### Contenido de un VibeProfile (Ejemplo: TechnoClubProfile)

```typescript
export const VIBE_TECHNO_CLUB: VibeProfile = {
  id: 'techno-club',
  name: 'Techno Club',
  
  mood: {
    allowed: ['dark', 'dramatic', 'tense', 'calm', 'energetic'],
    fallback: 'dark',
    audioInfluence: 0.7,
  },
  
  color: {
    strategies: ['monochromatic', 'analogous', 'complementary'],
    temperature: { min: 4000, max: 9000 },  // ❌ IGNORADO en SeleneLux
    saturation: { min: 0.3, max: 0.85 },    // ❌ IGNORADO en SeleneLux
    maxHueShiftPerSecond: 30,               // ❌ IGNORADO en SeleneLux
  },
  
  drop: {
    sensitivity: 0.6,
    energyThreshold: 0.25,
    timing: { cooldownFrames: 300 },
    allowMicroDrops: false,
  },
  
  dimmer: {
    floor: 0.05,
    ceiling: 1.0,
    allowBlackout: true,
  },
  
  effects: {
    allowed: ['strobe', 'beam'],
    maxStrobeRate: 12,
  },
};
```

### Registro de Vibes Disponibles

```typescript
// presets/index.ts
export const VIBE_REGISTRY: Map<VibeId, VibeProfile> = new Map([
  ['idle', VIBE_IDLE],
  ['techno-club', VIBE_TECHNO_CLUB],
  ['fiesta-latina', VIBE_FIESTA_LATINA],
  ['pop-rock', VIBE_POP_ROCK],
  ['chill-lounge', VIBE_CHILL_LOUNGE],
]);

export const DEFAULT_VIBE: VibeId = 'idle';
```

---

## 📊 MATRIZ DE CONEXIÓN

| Componente | Ubicación | Estado | Problema |
|------------|-----------|--------|----------|
| **VibeProfile Types** | `types/VibeProfile.ts` | ✅ Definidos | Ninguno |
| **Vibe Presets** | `presets/*.ts` | ✅ Completos | `color.*` ignorados |
| **VibeManager** | `engines/context/VibeManager.ts` | ✅ Funcional | No usado en SeleneLux |
| **Worker (mind.ts)** | `workers/mind.ts` | ✅ Conectado | Pasa datos correctamente |
| **SeleneLux.ts** | `selene-lux-core/SeleneLux.ts` | ⚠️ ROTO | Bloques bypass ignoran Vibes |
| **SeleneColorEngine** | `engines/visual/SeleneColorEngine.ts` | ✅ Funcional | Output sobrescrito |

---

## 🎯 DIAGNÓSTICO FINAL

### El Pipeline Teórico (Correcto)
```
[Audio] → [Worker] → [VibeManager.constrain()] → [SeleneColorEngine] → [DMX]
                           ↓
                    Vibe Constraints:
                    - temperature: 4000-9000K
                    - saturation: 0.3-0.85
                    - strategies: ['mono', 'analog', 'comp']
```

### El Pipeline Real (Roto)
```
[Audio] → [Worker] → [VibeManager.constrain()] → [SeleneColorEngine] → [lastColors]
                                                                            │
                           ┌────────────────────────────────────────────────┘
                           ▼
                    if (isTechnoVibe) {
                      // IGNORA todo lo anterior
                      this.lastColors = { HARDCODED VALUES }
                    }
                           │
                           ▼
                        [DMX]
```

### Raíz del Problema

1. **VibeManager FUNCIONA** - Está bien diseñado y se usa en el Worker
2. **Los constraints SE APLICAN** - Pero solo a MoodArbiter, StrategyArbiter, Dimmer
3. **Los constraints de COLOR se IGNORAN** - Porque SeleneLux tiene bloques hardcodeados
4. **SeleneColorEngine genera colores** - Pero son SOBRESCRITOS 10ms después

---

## 📋 INVENTARIO DE CONSTRAINTS IGNORADOS

### TechnoClubProfile.color (100% IGNORADO)

| Constraint | Valor en Profile | Valor en SeleneLux |
|------------|------------------|-------------------|
| `strategies` | `['mono', 'analog', 'comp']` | HARDCODED `+60, +120, +180` |
| `temperature.min` | `4000K` | No se lee |
| `temperature.max` | `9000K` | No se lee |
| `saturation.min` | `0.3` | HARDCODED `100` |
| `saturation.max` | `0.85` | HARDCODED `100` |
| `maxHueShiftPerSecond` | `30°/s` | No se lee |

### PopRockProfile.color (100% IGNORADO)

| Constraint | Valor en Profile | Valor en SeleneLux |
|------------|------------------|-------------------|
| `strategies` | `['analogous', 'complementary']` | HARDCODED `+180, +120` |
| `temperature.min` | `3000K` | No se lee |
| `temperature.max` | `7000K` | No se lee |
| `saturation.min` | `0.5` | HARDCODED `100` |
| `saturation.max` | `1.0` | HARDCODED `100` |

---

*Documento generado por WAVE 140: ARCHITECTURAL RECONNAISSANCE*
