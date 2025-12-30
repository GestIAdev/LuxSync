# 📦 WAVE 253 - INVENTORY REPORT v2.0
## El Inventario Post-Mudanza (Pre-Purga Final)

**Fecha:** 30 de Diciembre, 2025  
**Estado:** POST-MUDANZA - Identificando imports rotos y carpetas residuales  
**Propósito:** Mapear la estructura actual y los conflictos pendientes antes de la purga

---

## 🎉 RESUMEN DE LA MUDANZA

### ✅ LO QUE SE MOVIÓ CORRECTAMENTE

| Origen | Destino | Estado |
|--------|---------|--------|
| `main/workers/` | `src/workers/` | ✅ COMPLETADO |
| `engines/context/` (huérfana) | ELIMINADA | ✅ PURGADA |
| `electron/` drivers | `hal/drivers/` | ✅ CONSOLIDADO |
| `electron/` config | `core/config/` | ✅ CONSOLIDADO |
| `electron/` library | `core/library/` | ✅ CONSOLIDADO |
| `main/selene-lux-core/engines/visual/` | `engine/color/` | ✅ MOVIDO |
| `main/selene-lux-core/engines/audio/` | `engine/audio/` | ✅ MOVIDO |
| `main/selene-lux-core/engines/consciousness/` | `engine/conciousness/` | ✅ MOVIDO |
| `main/selene-lux-core/engines/musical/` | `engine/musical/` | ✅ MOVIDO |
| `main/selene-lux-core/physics/` | `hal/physics/` | ✅ MOVIDO |
| `main/selene-lux-core/hardware/FixtureManager` | `engine/movement/` | ✅ MOVIDO |

### 📂 ARCHIVOS EN ELECTRON (AHORA MÍNIMO)
```
electron-app/electron/
├── main.ts                      # Entrada Electron
├── main.ts.bak                  # 🗑️ PURGAR
├── preload.ts                   # Preload script
└── SeleneValidator.ts           # Validador
```
**Total: 4 archivos (antes eran 9)**

---

## 📁 ESTRUCTURA ACTUAL CONSOLIDADA

### 1️⃣ SRC/WORKERS (Nuevo hogar de workers)
```
electron-app/src/workers/
├── index.ts
├── FFT.ts
├── mind.ts
├── senses.ts
├── TrinityBridge.ts
├── TrinityOrchestrator.ts
├── WorkerProtocol.ts
└── utils/
    ├── index.ts
    ├── AdaptiveEnergyNormalizer.ts
    └── HysteresisTrigger.ts
```
**Total: 10 archivos ✅**

---

### 2️⃣ SRC/ENGINE (La Nueva Casa TITAN)
```
electron-app/src/engine/
├── index.ts
├── SeleneLux2.ts
├── TitanEngine.ts
│
├── audio/                        # ✅ Movido desde main/selene-lux-core/engines/audio
│   ├── index.ts
│   ├── AutomaticGainControl.ts
│   ├── BeatDetector.ts
│   └── PatternRecognizer.ts
│
├── color/                        # ✅ Consolidado: ColorEngine (Flow) + SeleneColorEngine (IA)
│   ├── index.ts
│   ├── .gitkeep
│   ├── colorConstitutions.ts
│   ├── ColorEngine.ts            # 🎨 Motor Flow Mode
│   ├── ColorLogic.ts
│   ├── EffectsEngine.ts
│   ├── EnergyStabilizer.ts
│   ├── KeyStabilizer.ts
│   ├── MoodArbiter.ts
│   ├── MovementEngine.ts         # ⚠️ Movimiento en carpeta color?
│   ├── SeleneColorEngine.ts      # 🤖 Motor Selene IA Mode
│   └── StrategyArbiter.ts
│
├── conciousness/                 # ✅ Movido desde main/selene-lux-core/engines/consciousness
│   ├── index.ts                  # ⚠️ NOTA: Typo "conciousness" vs "consciousness"
│   ├── AudioToMusicalMapper.ts
│   ├── ConsciousnessToLightMapper.ts
│   ├── DreamForgeEngine.ts
│   ├── EvolutionEngine.ts
│   ├── FibonacciPatternEngine.ts
│   ├── HuntOrchestrator.ts
│   ├── MoodSynthesizer.ts
│   ├── MusicalHarmonyValidator.ts
│   ├── NocturnalVisionEngine.ts
│   ├── PrecisionJumpEngine.ts
│   ├── PreyRecognitionEngine.ts
│   ├── SeleneEvolutionEngine.ts
│   ├── SeleneLuxConscious.ts
│   ├── SelfAnalysisEngine.ts
│   ├── StalkingEngine.ts
│   ├── StrikeMomentEngine.ts
│   ├── UltrasonicHearingEngine.ts
│   └── ZodiacAffinityCalculator.ts
│
├── movement/                     # ✅ Movido desde main/selene-lux-core/hardware
│   ├── index.ts
│   ├── .gitkeep
│   ├── FixtureManager.ts
│   └── FixturePhysicsDriver.ts
│
├── musical/                      # ✅ Movido desde main/selene-lux-core/engines/musical
│   ├── index.ts
│   ├── types.ts
│   ├── SeleneMusicalBrain.ts
│   ├── analysis/
│   │   ├── index.ts
│   │   ├── HarmonyDetector.ts
│   │   ├── RhythmAnalyzer.ts
│   │   ├── SectionTracker.ts
│   │   └── __tests__/
│   ├── classification/
│   │   ├── index.ts
│   │   └── ScaleIdentifier.ts
│   ├── context/
│   │   ├── index.ts
│   │   ├── MusicalContextEngine.ts
│   │   ├── PredictionMatrix.ts
│   │   └── __tests__/
│   ├── learning/
│   │   ├── index.ts
│   │   ├── schema.sql
│   │   ├── SeleneMemoryManager.ts
│   │   └── __tests__/
│   ├── mapping/
│   │   ├── index.ts
│   │   ├── MusicToLightMapper.ts
│   │   ├── PaletteManager.ts
│   │   ├── ProceduralPaletteGenerator.ts
│   │   └── __tests__/
│   └── telemetry/
│       ├── index.ts
│       └── SeleneTelemetryCollector.ts
│
└── vibe/                         # ✅ Consolidado
    ├── index.ts
    ├── .gitkeep
    ├── VibeManager.ts
    └── profiles/
        ├── ChillLoungeProfile.ts
        ├── FiestaLatinaProfile.ts
        ├── IdleProfile.ts
        ├── PopRockProfile.ts
        └── TechnoClubProfile.ts
```
**Total: ~65+ archivos (EL NUEVO NÚCLEO)**

---

### 3️⃣ SRC/CORE (Infraestructura TITAN)
```
electron-app/src/core/
├── config/
│   ├── index.ts
│   ├── ConfigManager.ts          # ✅ Movido desde electron/
│   └── FeatureFlags.ts
│
├── library/                      # ✅ Nueva carpeta
│   ├── FXTParser.ts              # Movido desde electron/
│   └── ShowManager.ts            # Movido desde electron/
│
├── orchestrator/
│   ├── index.ts
│   ├── .gitkeep
│   ├── EventRouter.ts
│   ├── IPCHandlers.ts
│   ├── IPCHandlers.ts.bak        # 🗑️ PURGAR
│   ├── TitanOrchestrator.ts
│   └── TitanOrchestrator.ts.bak  # 🗑️ PURGAR
│
└── protocol/
    ├── index.ts
    ├── DMXPacket.ts
    ├── LightingIntent.ts
    ├── MusicalContext.ts
    └── SeleneProtocol.ts
```
**Total: 16 archivos**

---

### 4️⃣ SRC/HAL (Hardware Abstraction Layer)
```
electron-app/src/hal/
├── index.ts
├── HardwareAbstraction.ts
│
├── drivers/                      # ✅ Consolidado desde electron/
│   ├── index.ts
│   ├── .gitkeep
│   ├── ArtNetDriver.ts           # Movido desde electron/
│   ├── DMXDriver.interface.ts
│   ├── MockDriver.ts
│   └── UniversalDMXDriver.ts     # Movido desde electron/
│
├── mapping/
│   ├── index.ts
│   ├── FixtureMapper.ts
│   └── ZoneRouter.ts
│
└── physics/                      # ✅ Movido desde main/selene-lux-core/physics
    ├── index.ts
    ├── ChillStereoPhysics.ts
    ├── LatinoStereoPhysics.ts
    ├── PhysicsEngine.ts
    ├── RockStereoPhysics.ts
    └── TechnoStereoPhysics.ts
```
**Total: 17 archivos**

---

### 5️⃣ MAIN/SELENE-LUX-CORE (El Legado - A PURGAR)
```
electron-app/src/main/selene-lux-core/
├── SeleneLux.ts                  # 🔴 IMPORTS ROTOS (archivo principal legacy)
├── types.ts                      # ⚠️ Posible duplicado con engine/musical/types.ts
├── docs/                         # (vacío)
├── tests/
│   └── MetaConsciousness.test.ts
│
├── engines/                      # 🔴 CASI VACÍO (solo quedan tests)
│   ├── audio/                    # (vacío)
│   ├── consciousness/
│   │   └── __tests__/
│   │       ├── EvolutionEngines.test.ts
│   │       └── HuntOrchestrator.test.ts
│   ├── musical/
│   │   ├── docs/                 # Documentación legacy
│   │   └── __tests__/
│   │       └── SeleneMusicalBrain.test.ts
│   └── visual/
│       └── __tests__/
│           ├── SeleneColorEngine.test.ts
│           └── TriadicFlow.test.ts
│
├── hardware/
│   └── DMXDriver.ts              # ⚠️ Posible duplicado con hal/drivers/
│
└── physics/
    ├── index.ts                  # Solo exports
    └── LatinoStereoPhysics.ts.backup  # 🗑️ PURGAR
```
**⚠️ ESTA CARPETA DEBE SER EVALUADA PARA PURGA**

---

### 6️⃣ MAIN/WORKERS (VACÍO)
```
electron-app/src/main/workers/
└── (vacío)                       # 🗑️ PURGAR CARPETA
```

---

### 7️⃣ BRAIN (Casi vacío)
```
electron-app/src/brain/
├── index.ts
├── TrinityBrain.ts
├── analyzers/
│   └── .gitkeep                  # (vacío)
└── workers/
    └── .gitkeep                  # (vacío)
```
**⚠️ Evaluar si consolidar en otro lugar**

---

## 🔴 ERRORES DE IMPORTACIÓN DETECTADOS

### ARCHIVO CRÍTICO: SeleneLux.ts
```
Ubicación: src/main/selene-lux-core/SeleneLux.ts
Estado: 🔴 MÚLTIPLES IMPORTS ROTOS
```

| Línea | Import Roto | Nueva Ubicación |
|-------|-------------|-----------------|
| 46 | `./engines/visual/ColorEngine` | `../../engine/color/ColorEngine` |
| 47 | `./engines/visual/MovementEngine` | `../../engine/color/MovementEngine` |
| 48 | `./engines/audio/BeatDetector` | `../../engine/audio/BeatDetector` |
| 61 | `./engines/visual/SeleneColorEngine` | `../../engine/color/SeleneColorEngine` |
| 67 | `./engines/telemetry/SeleneTelemetryCollector` | `../../engine/musical/telemetry/SeleneTelemetryCollector` |
| 72 | `./engines/consciousness/SeleneLuxConscious` | `../../engine/conciousness/SeleneLuxConscious` |
| 78 | `./engines/consciousness/HuntOrchestrator` | `../../engine/conciousness/HuntOrchestrator` |
| 82 | `./engines/consciousness/ZodiacAffinityCalculator` | `../../engine/conciousness/ZodiacAffinityCalculator` |
| 92 | `./engines/visual/SeleneColorEngine` (GenerationOptions) | `../../engine/color/SeleneColorEngine` |

### ARCHIVOS EN ENGINE/ CON IMPORTS ROTOS A `../../types`

Los siguientes archivos buscan `../../types` que **NO EXISTE**:

| Archivo | Import Roto | Debería ser |
|---------|-------------|-------------|
| `engine/color/ColorEngine.ts:33` | `from '../../types'` | Crear types en engine/ o usar main/selene-lux-core/types |
| `engine/color/MovementEngine.ts:18` | `from '../../types'` | ↑ |
| `engine/color/EffectsEngine.ts:14` | `from '../../types'` | ↑ |
| `engine/audio/BeatDetector.ts:14` | `from '../../types'` | ↑ |
| `engine/audio/PatternRecognizer.ts:17` | `from '../../types'` | ↑ |
| `engine/conciousness/AudioToMusicalMapper.ts:14` | `from '../../types'` | ↑ |
| `engine/conciousness/EvolutionEngine.ts:17` | `from '../../types'` | ↑ |
| `engine/conciousness/HuntOrchestrator.ts:20` | `from '../../types'` | ↑ |
| `engine/conciousness/MoodSynthesizer.ts:15` | `from '../../types'` | ↑ |
| `engine/conciousness/PreyRecognitionEngine.ts:19` | `from '../../types'` | ↑ |
| `engine/conciousness/SeleneLuxConscious.ts:22` | `from '../../types'` | ↑ |
| `engine/conciousness/StalkingEngine.ts:17` | `from '../../types'` | ↑ |
| `engine/conciousness/StrikeMomentEngine.ts:18` | `from '../../types'` | ↑ |
| `engine/movement/FixtureManager.ts:13` | `from '../types'` | ↑ |

### ARCHIVOS CON IMPORTS A `../visual/` o `../engines/`
| Archivo | Import Roto |
|---------|-------------|
| `engine/conciousness/ConsciousnessToLightMapper.ts:15` | `from '../visual/ColorEngine'` |
| `engine/conciousness/SeleneLuxConscious.ts:26-27` | `from '../visual/ColorEngine'`, `from '../visual/MovementEngine'` |
| `engine/movement/FixtureManager.ts:14-16` | `from '../engines/visual/*` |
| `hal/physics/TechnoStereoPhysics.ts:22` | `from '../engines/visual/SeleneColorEngine'` |

### ARCHIVOS CON IMPORTS A RUTAS LEGACY
| Archivo | Import Roto |
|---------|-------------|
| `engine/musical/index.ts:22` | `from '../../main/selene-lux-core/engines/musical/types'` |
| `engine/musical/index.ts:118,124` | `from '../../main/selene-lux-core/engines/musical/SeleneMusicalBrain'` |
| `engine/vibe/VibeManager.ts:26` | `from '../../main/selene-lux-core/engines/visual/SeleneColorEngine'` |
| `engine/color/colorConstitutions.ts:19` | `from '../../main/selene-lux-core/engines/visual/SeleneColorEngine'` |

---

## 🗑️ ARCHIVOS A PURGAR

### Backups (.bak y .backup)
1. `electron/main.ts.bak`
2. `core/orchestrator/IPCHandlers.ts.bak`
3. `core/orchestrator/TitanOrchestrator.ts.bak`
4. `main/selene-lux-core/physics/LatinoStereoPhysics.ts.backup`
5. `hooks/useSeleneVibe.ts.backup`

### Carpetas vacías
1. `main/workers/` (vacía después de mover a src/workers/)
2. `main/selene-lux-core/docs/` (vacía)
3. `main/selene-lux-core/engines/audio/` (vacía)
4. `brain/analyzers/` (solo .gitkeep)
5. `brain/workers/` (solo .gitkeep)

### Archivos .gitkeep en carpetas con contenido
- Múltiples `.gitkeep` que ya no son necesarios

---

## 🎯 ACCIONES RECOMENDADAS

### PRIORIDAD 1: Crear `engine/types.ts`
Mover/consolidar tipos desde `main/selene-lux-core/types.ts` a `engine/types.ts` para que todos los engines puedan importar desde `../types` o `../../types` correctamente.

### PRIORIDAD 2: Arreglar imports en SeleneLux.ts
Este archivo es el núcleo y tiene 9+ imports rotos. Actualizar todas las rutas a la nueva estructura.

### PRIORIDAD 3: Arreglar imports en engine/
Actualizar todos los archivos que buscan rutas inexistentes:
- `../../types` → `../types` (cuando se cree)
- `../visual/*` → `../color/*`
- `../engines/*` → rutas correctas

### PRIORIDAD 4: Purgar archivos residuales
- Eliminar todos los `.bak` y `.backup`
- Eliminar carpetas vacías
- Evaluar si `main/selene-lux-core/` puede eliminarse completamente

### PRIORIDAD 5: Mover tests
Los tests quedaron huérfanos en `main/selene-lux-core/engines/*/___tests__/`. Moverlos junto a sus archivos correspondientes en `engine/`.

---

## 📊 ESTADÍSTICAS

| Métrica | Antes | Después | Cambio |
|---------|-------|---------|--------|
| Carpetas de engines | 3 (superpuestas) | 1 consolidada | -66% |
| Archivos en electron/ | 9 | 4 | -55% |
| Duplicados de VibeManager | 2 | 1 | -50% |
| Duplicados de Profiles | 8 | 5 | -37% |
| Imports rotos | 0 | ~25+ | ⚠️ A RESOLVER |

---

## ⚠️ NOTA SOBRE TYPO

La carpeta `engine/conciousness/` tiene un typo (debería ser `consciousness`). Considerar renombrar después de resolver los imports.

---

## 🎨 SOBRE ColorEngine vs SeleneColorEngine

Como solicitaste, **ambos motores son necesarios**:
- `ColorEngine.ts` → Motor del **modo Flow** (reactividad directa)
- `SeleneColorEngine.ts` → Motor del **modo Selene IA** (inteligencia avanzada)

Ambos ahora viven en `engine/color/` ✅

---

*Generado por WAVE 253 v2.0 - POST-MUDANZA INVENTORY*  
*LuxSync Architecture Audit System*
