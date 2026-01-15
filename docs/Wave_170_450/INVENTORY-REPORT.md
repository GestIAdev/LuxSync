# 📦 WAVE 253 - INVENTORY REPORT
## El Gran Inventario de la Transición Arquitectónica

**Fecha:** 30 de Diciembre, 2025  
**Estado:** FASE DE AUDITORÍA - Solo observación, sin modificaciones  
**Propósito:** Mapear todas las zonas en conflicto para planificar la consolidación manual

---

## 🗺️ RESUMEN EJECUTIVO

La arquitectura actual presenta **MÚLTIPLES CAPAS SUPERPUESTAS** que requieren consolidación:

| Zona | Ubicación | Estado | Archivos |
|------|-----------|--------|----------|
| **ELECTRON/DRIVERS** | `electron-app/electron/` | ✅ LIMPIA | 9 archivos |
| **SELENE-LUX-CORE** | `electron-app/src/main/selene-lux-core/` | 🧠 NÚCLEO IA | ~50+ archivos |
| **ENGINES (HUÉRFANA)** | `electron-app/src/engines/` | ⚠️ DUPLICADA | ~10 archivos |
| **ENGINE (TITAN)** | `electron-app/src/engine/` | 🆕 NUEVA | ~10 archivos |
| **CORE (TITAN)** | `electron-app/src/core/` | 🆕 NUEVA | ~10 archivos |
| **TYPES (LEGACY)** | `electron-app/src/types/` | 📦 LEGACY | 4 archivos |
| **WORKERS** | `electron-app/src/main/workers/` | 🔧 PROCESAMIENTO | 9 archivos |

---

## 📁 ÁRBOL COMPLETO POR ZONA

### 1️⃣ ELECTRON-APP/ELECTRON (Drivers y Proceso Principal)
```
electron-app/electron/
├── ArtNetDriver.ts              # Driver Art-Net
├── ConfigManager.ts             # Gestión de configuración
├── FXTParser.ts                 # Parser de fixtures
├── main.ts                      # Entrada principal Electron
├── main.ts.bak                  # Backup
├── preload.ts                   # Preload script
├── SeleneValidator.ts           # Validador Selene
├── ShowManager.ts               # Gestor de shows
└── UniversalDMXDriver.ts        # Driver DMX universal
```
**Total: 9 archivos**

---

### 2️⃣ SELENE-LUX-CORE (El Cerebro de la IA - +50 motores)
```
electron-app/src/main/selene-lux-core/
├── SeleneLux.ts                 # ⭐ NÚCLEO PRINCIPAL
├── types.ts                     # Tipos locales
├── docs/                        # (vacío)
├── tests/
│   └── MetaConsciousness.test.ts
│
├── engines/
│   ├── audio/
│   │   ├── index.ts
│   │   ├── AutomaticGainControl.ts
│   │   ├── BeatDetector.ts
│   │   └── PatternRecognizer.ts
│   │
│   ├── consciousness/
│   │   ├── index.ts
│   │   ├── AudioToMusicalMapper.ts
│   │   ├── ConsciousnessToLightMapper.ts
│   │   ├── DreamForgeEngine.ts
│   │   ├── EvolutionEngine.ts
│   │   ├── FibonacciPatternEngine.ts
│   │   ├── HuntOrchestrator.ts
│   │   ├── MoodSynthesizer.ts
│   │   ├── MusicalHarmonyValidator.ts
│   │   ├── NocturnalVisionEngine.ts
│   │   ├── PrecisionJumpEngine.ts
│   │   ├── PreyRecognitionEngine.ts
│   │   ├── SeleneEvolutionEngine.ts
│   │   ├── SeleneLuxConscious.ts
│   │   ├── SelfAnalysisEngine.ts
│   │   ├── StalkingEngine.ts
│   │   ├── StrikeMomentEngine.ts
│   │   ├── UltrasonicHearingEngine.ts
│   │   ├── ZodiacAffinityCalculator.ts
│   │   └── __tests__/
│   │       ├── EvolutionEngines.test.ts
│   │       └── HuntOrchestrator.test.ts
│   │
│   ├── musical/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── SeleneMusicalBrain.ts
│   │   ├── docs/
│   │   │   ├── WAVE8-FASE7-INTEGRATION-REPORT.md
│   │   │   ├── WAVE8-FASE8-NUCLEAR-INTEGRATION-REPORT.md
│   │   │   └── WAVE8-MUSICAL-INTELLIGENCE-ROADMAP.md
│   │   ├── analysis/
│   │   │   ├── index.ts
│   │   │   ├── HarmonyDetector.ts
│   │   │   ├── RhythmAnalyzer.ts
│   │   │   ├── SectionTracker.ts
│   │   │   └── __tests__/
│   │   │       ├── HarmonyAnalysis.test.ts
│   │   │       ├── RhythmAnalyzer.test.ts
│   │   │       └── SectionTracker.test.ts
│   │   ├── classification/
│   │   │   ├── index.ts
│   │   │   └── ScaleIdentifier.ts
│   │   ├── context/
│   │   │   ├── index.ts
│   │   │   ├── MusicalContextEngine.ts
│   │   │   ├── PredictionMatrix.ts
│   │   │   └── __tests__/
│   │   │       ├── MusicalContextEngine.test.ts
│   │   │       └── PredictionMatrix.test.ts
│   │   ├── learning/
│   │   │   ├── index.ts
│   │   │   ├── schema.sql
│   │   │   ├── SeleneMemoryManager.ts
│   │   │   └── __tests__/
│   │   │       └── SeleneMemoryManager.test.ts
│   │   ├── mapping/
│   │   │   ├── index.ts
│   │   │   ├── MusicToLightMapper.ts
│   │   │   ├── PaletteManager.ts
│   │   │   ├── ProceduralPaletteGenerator.ts
│   │   │   └── __tests__/
│   │   │       ├── MusicToLightMapper.test.ts
│   │   │       └── ProceduralPaletteGenerator.test.ts
│   │   └── __tests__/
│   │       └── SeleneMusicalBrain.test.ts
│   │
│   ├── telemetry/
│   │   ├── index.ts
│   │   └── SeleneTelemetryCollector.ts
│   │
│   └── visual/
│       ├── index.ts
│       ├── ColorEngine.ts           # ⚠️ DUPLICADO POTENCIAL
│       ├── EffectsEngine.ts
│       ├── EnergyStabilizer.ts
│       ├── KeyStabilizer.ts
│       ├── MoodArbiter.ts
│       ├── MovementEngine.ts        # ⚠️ ÚNICO AQUÍ
│       ├── SeleneColorEngine.ts     # ⚠️ VERSIÓN SELENE
│       ├── StrategyArbiter.ts
│       └── __tests__/
│           ├── SeleneColorEngine.test.ts
│           └── TriadicFlow.test.ts
│
├── hardware/
│   ├── index.ts
│   ├── DMXDriver.ts                 # ⚠️ DUPLICADO EN ELECTRON/
│   ├── FixtureManager.ts
│   └── FixturePhysicsDriver.ts
│
└── physics/
    ├── index.ts
    ├── ChillStereoPhysics.ts
    ├── LatinoStereoPhysics.ts
    ├── LatinoStereoPhysics.ts.backup
    ├── RockStereoPhysics.ts
    └── TechnoStereoPhysics.ts
```
**Total: ~55+ archivos (el corazón de Selene)**

---

### 3️⃣ WORKERS (Procesamiento en Background)
```
electron-app/src/main/workers/
├── index.ts
├── FFT.ts                       # Transformada de Fourier
├── mind.ts                      # Procesamiento mental
├── senses.ts                    # Procesamiento sensorial
├── TrinityBridge.ts             # ⚠️ Puente Trinity (LEGACY?)
├── TrinityOrchestrator.ts       # Orquestador Trinity
├── WorkerProtocol.ts            # Protocolo de comunicación
└── utils/
    ├── index.ts
    ├── AdaptiveEnergyNormalizer.ts
    └── HysteresisTrigger.ts
```
**Total: 10 archivos**

---

### 4️⃣ ENGINES (La Carpeta Huérfana - ZONA DE CONFLICTO)
```
electron-app/src/engines/
├── index.ts
├── context/
│   ├── index.ts
│   ├── colorConstitutions.ts
│   ├── VibeManager.ts           # ⚠️ DUPLICADO EN engine/vibe/
│   └── presets/
│       ├── index.ts
│       ├── ChillLoungeProfile.ts    # ⚠️ DUPLICADO
│       ├── FiestaLatinaProfile.ts   # ⚠️ DUPLICADO
│       ├── IdleProfile.ts
│       ├── PopRockProfile.ts        # ⚠️ DUPLICADO
│       └── TechnoClubProfile.ts     # ⚠️ DUPLICADO
└── dmx/
    ├── index.ts
    └── DMXMerger.ts
```
**Total: 12 archivos (⚠️ MUCHOS DUPLICADOS)**

---

### 5️⃣ ENGINE (Nueva Estructura TITAN)
```
electron-app/src/engine/
├── index.ts
├── SeleneLux2.ts                # Nueva versión del núcleo
├── TitanEngine.ts               # Motor TITAN principal
├── color/
│   ├── index.ts
│   ├── .gitkeep
│   └── ColorLogic.ts            # ⚠️ NUEVO - ColorLogic
├── movement/
│   └── .gitkeep                 # (vacío)
└── vibe/
    ├── index.ts
    ├── .gitkeep
    ├── VibeManager.ts           # ⚠️ DUPLICADO DE engines/context/
    └── profiles/
        ├── ChillLoungeProfile.ts    # ⚠️ DUPLICADO
        ├── FiestaLatinaProfile.ts   # ⚠️ DUPLICADO
        ├── PopRockProfile.ts        # ⚠️ DUPLICADO
        └── TechnoClubProfile.ts     # ⚠️ DUPLICADO
```
**Total: 13 archivos (⚠️ DUPLICADOS CON engines/)**

---

### 6️⃣ CORE (Nueva Estructura TITAN)
```
electron-app/src/core/
├── config/
│   ├── index.ts
│   └── FeatureFlags.ts
├── orchestrator/
│   ├── index.ts
│   ├── .gitkeep
│   ├── EventRouter.ts
│   ├── IPCHandlers.ts
│   ├── IPCHandlers.ts.bak
│   ├── TitanOrchestrator.ts     # Nuevo orquestador
│   └── TitanOrchestrator.ts.bak
└── protocol/
    ├── index.ts
    ├── DMXPacket.ts
    ├── LightingIntent.ts
    ├── MusicalContext.ts
    └── SeleneProtocol.ts
```
**Total: 14 archivos**

---

### 7️⃣ TYPES (Legacy)
```
electron-app/src/types/
├── FixtureDefinition.ts
├── globals.d.ts
├── three-jsx.d.ts
└── VibeProfile.ts               # Tipos de perfiles Vibe
```
**Total: 4 archivos**

---

### 8️⃣ HAL (Hardware Abstraction Layer)
```
electron-app/src/hal/
├── index.ts
├── HardwareAbstraction.ts
├── drivers/
│   ├── index.ts
│   ├── .gitkeep
│   ├── DMXDriver.interface.ts   # ⚠️ INTERFAZ (vs implementación)
│   └── MockDriver.ts
├── mapping/
│   ├── index.ts
│   ├── FixtureMapper.ts
│   └── ZoneRouter.ts
└── physics/
    ├── index.ts
    └── PhysicsEngine.ts         # ⚠️ vs StereoPhysics en selene-lux-core
```
**Total: 12 archivos**

---

### 9️⃣ BRAIN (Cerebro Frontend)
```
electron-app/src/brain/
├── index.ts
├── TrinityBrain.ts              # ⚠️ Relacionado con TrinityBridge
├── analyzers/
│   └── .gitkeep                 # (vacío)
└── workers/
    └── .gitkeep                 # (vacío)
```
**Total: 4 archivos**

---

## 🔴 DUPLICADOS IDENTIFICADOS

### CONFLICTO CRÍTICO: VibeManager
| Archivo | Ubicación |
|---------|-----------|
| `VibeManager.ts` | `src/engines/context/` |
| `VibeManager.ts` | `src/engine/vibe/` |

### CONFLICTO CRÍTICO: Perfiles de Vibe (4 archivos × 2 ubicaciones = 8 duplicados)
| Archivo | Ubicación 1 | Ubicación 2 |
|---------|-------------|-------------|
| `ChillLoungeProfile.ts` | `engines/context/presets/` | `engine/vibe/profiles/` |
| `FiestaLatinaProfile.ts` | `engines/context/presets/` | `engine/vibe/profiles/` |
| `PopRockProfile.ts` | `engines/context/presets/` | `engine/vibe/profiles/` |
| `TechnoClubProfile.ts` | `engines/context/presets/` | `engine/vibe/profiles/` |

### CONFLICTO: DMX Drivers
| Archivo | Ubicación | Tipo |
|---------|-----------|------|
| `UniversalDMXDriver.ts` | `electron/` | Implementación real |
| `ArtNetDriver.ts` | `electron/` | Implementación real |
| `DMXDriver.ts` | `main/selene-lux-core/hardware/` | Implementación core |
| `DMXDriver.interface.ts` | `hal/drivers/` | Solo interfaz |

### CONFLICTO: ColorEngine
| Archivo | Ubicación |
|---------|-----------|
| `ColorEngine.ts` | `main/selene-lux-core/engines/visual/` |
| `SeleneColorEngine.ts` | `main/selene-lux-core/engines/visual/` |
| `ColorLogic.ts` | `engine/color/` (NUEVO TITAN) |
| `frontendColorEngine.ts` | `utils/` (versión ligera frontend) |

### CONFLICTO: Physics
| Archivo | Ubicación |
|---------|-----------|
| `PhysicsEngine.ts` | `hal/physics/` |
| `*StereoPhysics.ts` (4 archivos) | `main/selene-lux-core/physics/` |
| `FixturePhysicsDriver.ts` | `main/selene-lux-core/hardware/` |

### CONFLICTO: Orquestadores
| Archivo | Ubicación |
|---------|-----------|
| `TitanOrchestrator.ts` | `core/orchestrator/` |
| `TrinityOrchestrator.ts` | `main/workers/` |
| `TrinityBridge.ts` | `main/workers/` |
| `TrinityBrain.ts` | `brain/` |

---

## 📊 ESTADÍSTICAS TOTALES

| Categoría | Archivos | Estado |
|-----------|----------|--------|
| Archivos únicos en zonas de conflicto | ~120 | ⚠️ |
| Archivos duplicados identificados | ~15 pares | 🔴 |
| Archivos con extensión .bak | 4 | 🗑️ |
| Carpetas vacías con .gitkeep | 5 | 📁 |
| Tests | ~20 | ✅ |

---

## 🎯 RECOMENDACIONES PARA LA MUDANZA

### PASO 1: Eliminar Duplicados
1. **VibeManager**: Decidir cuál es el canónico (`engine/vibe/` parece ser la nueva ubicación)
2. **Perfiles**: Consolidar en una sola ubicación
3. **Eliminar carpeta `engines/`** (huérfana) después de migrar lo necesario

### PASO 2: Consolidar Drivers
1. Mantener drivers reales en `electron/`
2. Mover interfaces a `hal/drivers/`
3. Evaluar si `DMXDriver.ts` de selene-lux-core es necesario

### PASO 3: Unificar Color Engines
1. `ColorEngine.ts` + `SeleneColorEngine.ts` → Decidir si fusionar
2. `ColorLogic.ts` (TITAN) → Evaluar si reemplaza a los anteriores
3. `frontendColorEngine.ts` → Mantener como versión ligera para UI

### PASO 4: Limpiar
1. Eliminar archivos `.bak`
2. Evaluar carpetas vacías con `.gitkeep`

---

## ⚠️ ADVERTENCIA

**Este reporte es SOLO INFORMATIVO.**  
No se ha modificado ni eliminado ningún archivo.  
Usar este inventario para planificar la mudanza manual.

---

*Generado por WAVE 253 - THE INVENTORY*  
*LuxSync Architecture Audit System*
