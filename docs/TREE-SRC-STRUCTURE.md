# 📁 LuxSync - Estructura de Directorios `/electron-app/src`

**Actualizado:** 30 Diciembre 2025 | **WAVE 252 Status** | **0 Errores Compilación**

> **Generado**: 29 Diciembre 2025  
> **Estado**: Snapshot actual sin tests ni dependencies
> **Versión Actual**: TITAN 2.0 with SeleneTruth Protocol (WAVE 248+)

---

## 🎯 Quick Reference

| Componente | Ubicación | Descripción |
|-----------|----------|-------------|
| **Frontend** | `components/`, `views/`, `hooks/`, `stores/` | React UI + Estado |
| **Backend** | `main/`, `brain/` | SeleneLux + Trinity IA |
| **IPC Core** | `core/orchestrator/IPCHandlers.ts` | Canales `lux:*` (WAVE 250) |
| **Protocol** | `core/protocol/SeleneProtocol.ts` | TITAN 2.0 - SeleneTruth |
| **Hardware** | `hal/` | Abstracción DMX |
| **Engines** | `engine/`, `engines/` | Iluminación, Color, Movimiento |

---

## 📊 Árbol de Directorios Completo

```
src/
│
├── 📄 App.tsx                             # Componente raíz React
├── 📄 AppCommander.tsx                    # Comandos y eventos globales
├── 📄 main.tsx                            # Punto de entrada Vite
├── 📄 vite-env.d.ts                       # Definiciones Vite + window.lux + IPC API
│
├── 🧠 brain/                              # Trinity Brain (Red neuronal de IA)
│   ├── 📄 index.ts
│   ├── 📄 TrinityBrain.ts                 # Controlador principal IA
│   ├── analyzers/                         # Analizadores especializados
│   └── workers/                           # Web Workers
│
├── 🎨 components/                         # Componentes React (UI Frontend)
│   ├── 📄 BigSwitch.tsx
│   ├── 📄 Blackout.tsx
│   ├── 📄 EffectsBar.tsx
│   ├── 📄 Header.tsx
│   ├── 📄 index.ts
│   │
│   ├── layout/                            # Componentes de maquetación
│   │   ├── BlackoutOverlay.tsx
│   │   ├── BlackoutOverlay.css
│   │   ├── ContentArea.tsx
│   │   ├── ContentArea.css
│   │   ├── GlobalEffectsBar.tsx
│   │   ├── GlobalEffectsBar.css
│   │   ├── MainLayout.tsx
│   │   ├── MainLayout.css
│   │   ├── Sidebar.tsx
│   │   ├── Sidebar.css
│   │   ├── TitleBar.tsx
│   │   └── TitleBar.css
│   │
│   ├── modals/                            # Diálogos modales
│   │   └── FixtureEditor/
│   │       ├── FixtureEditorModal.tsx
│   │       └── FixtureEditor.css
│   │
│   ├── ModeSwitcher/                      # Selector de modo (flow/selene/locked)
│   │   ├── ModeSwitcher.tsx
│   │   ├── ModeSwitcher.css
│   │   └── index.ts
│   │
│   ├── shared/                            # Componentes compartidos
│   │   ├── ViewModeSwitcher.tsx
│   │   ├── ViewModeSwitcher.css
│   │   └── index.ts
│   │
│   ├── stage3d/                           # Visualización 3D del escenario
│   │   ├── Stage3DCanvas.tsx
│   │   ├── Stage3DCanvas.css
│   │   ├── index.ts
│   │   ├── controls/
│   │   │   ├── CameraControls3D.tsx
│   │   │   └── index.ts
│   │   ├── environment/
│   │   │   ├── StageFloor.tsx
│   │   │   ├── StageTruss.tsx
│   │   │   └── index.ts
│   │   └── fixtures/                      # Modelos 3D de fixtures
│   │       ├── Fixture3D.tsx
│   │       ├── MovingHead3D.tsx
│   │       ├── ParCan3D.tsx
│   │       └── index.ts
│   │
│   ├── telemetry/                         # Paneles de telemetría
│   │   ├── index.ts
│   │   ├── AudioOscilloscope/
│   │   │   ├── AudioOscilloscope.tsx
│   │   │   ├── AudioOscilloscope.css
│   │   │   └── index.ts
│   │   ├── HuntMonitor/
│   │   │   ├── HuntMonitor.tsx
│   │   │   ├── HuntMonitor.css
│   │   │   └── index.ts
│   │   ├── MusicalDNAPanel/
│   │   │   ├── MusicalDNAPanel.tsx
│   │   │   ├── MusicalDNAPanel.css
│   │   │   └── index.ts
│   │   └── PalettePreview/
│   │       ├── PalettePreview.tsx
│   │       ├── PalettePreview.css
│   │       └── index.ts
│   │
│   └── views/                             # Vistas principales
│       ├── LiveView.tsx
│       ├── SetupView.tsx
│       ├── SimulateView.tsx
│       ├── StageView.tsx
│       │
│       ├── DashboardView/                 # Dashboard principal
│       │   ├── index.tsx
│       │   ├── DashboardView.css
│       │   └── components/
│       │       ├── AudioReactorRing.tsx
│       │       ├── AudioReactorRing.css
│       │       ├── DataCards.tsx
│       │       ├── DataCards.css
│       │       ├── HudIcons.tsx
│       │       ├── ModeSwitcherSleek.tsx
│       │       ├── ModeSwitcherSleek.css
│       │       ├── PowerButton.tsx
│       │       ├── PowerButton.css
│       │       ├── SeleneBrain.tsx
│       │       ├── SeleneBrain.css
│       │       ├── TitleBar.tsx
│       │       ├── TitleBar.css
│       │       └── VibeSelector.tsx
│       │
│       ├── LuxCoreView/
│       │   ├── index.tsx
│       │   ├── LuxCoreView.css
│       │   ├── TacticalLog.tsx
│       │   └── TacticalLog.css
│       │
│       ├── SetupView/
│       │   ├── index.tsx
│       │   ├── index.legacy.tsx
│       │   ├── SetupView.css
│       │   ├── SetupLayout.tsx
│       │   ├── SetupLayout.css
│       │   ├── SetupStatusBar.tsx
│       │   ├── SetupStatusBar.css
│       │   └── tabs/
│       │       ├── AddFixtureModal.tsx
│       │       ├── AddFixtureModal.css
│       │       ├── AudioConfig.tsx
│       │       ├── AudioConfig.css
│       │       ├── DevicesTab.tsx
│       │       ├── DevicesTab.css
│       │       ├── DMXConfig.tsx
│       │       ├── DMXConfig.css
│       │       ├── LibraryTab.tsx
│       │       ├── LibraryTab.css
│       │       ├── PatchTab.tsx
│       │       ├── PatchTab.css
│       │       ├── TabPlaceholder.css
│       │       └── index.ts
│       │
│       ├── SimulateView/
│       │   ├── index.tsx
│       │   ├── SimulateView.css
│       │   └── StageSimulator2.tsx
│       │
│       └── StageViewDual/
│           ├── StageViewDual.tsx
│           ├── StageViewDual.css
│           ├── index.ts
│           └── sidebar/
│               ├── ColorPicker.tsx
│               ├── DimmerSlider.tsx
│               ├── GlobalControls.tsx
│               ├── GlobalControls.css
│               ├── InspectorControls.tsx
│               ├── InspectorControls.css
│               ├── PaletteControlMini.tsx
│               ├── PaletteControlMini.css
│               ├── PanTiltControl.tsx
│               ├── SceneBrowser.tsx
│               ├── SceneBrowser.css
│               ├── StageSidebar.tsx
│               ├── StageSidebar.css
│               ├── controls.css
│               ├── index.ts
│               └── widgets/
│                   ├── MovementRadar.tsx
│                   ├── MovementRadar.css
│                   └── index.ts
│
├── 📁 constants/
│   └── 📄 palettes.ts                     # Definiciones de paletas
│
├── ⚙️ core/                               # NÚCLEO DEL SISTEMA
│   ├── config/                            # Configuración global
│   │   ├── 📄 FeatureFlags.ts
│   │   └── 📄 index.ts
│   │
│   ├── orchestrator/                      # Orquestadores de IPC
│   │   ├── 📄 index.ts
│   │   ├── 📄 IPCHandlers.ts              # Manejadores IPC (WAVE 250, 252) ⭐
│   │   ├── 📄 EventRouter.ts
│   │   ├── 📄 TitanOrchestrator.ts        # Orquestador TITAN 2.0 ⭐
│   │   ├── 📄 IPCHandlers.ts.bak
│   │   └── 📄 TitanOrchestrator.ts.bak
│   │
│   └── protocol/                          # Protocolos de comunicación
│       ├── 📄 index.ts
│       ├── 📄 SeleneProtocol.ts           # TITAN 2.0 - SeleneTruth (WAVE 248) ⭐
│       ├── 📄 MusicalContext.ts
│       ├── 📄 LightingIntent.ts
│       └── 📄 DMXPacket.ts
│
├── ⚡ engine/                             # Motor de iluminación
│   ├── 📄 index.ts
│   ├── 📄 TitanEngine.ts                  # Motor TITAN
│   ├── 📄 SeleneLux2.ts
│   │
│   ├── color/                             # Lógica de color
│   │   ├── 📄 ColorLogic.ts
│   │   └── 📄 index.ts
│   │
│   ├── movement/                          # Lógica de movimiento
│   │   └── 📄 .gitkeep
│   │
│   └── vibe/                              # Perfiles de vibe
│       ├── 📄 index.ts
│       ├── 📄 VibeManager.ts
│       └── profiles/
│           ├── 📄 TechnoClubProfile.ts
│           ├── 📄 FiestaLatinaProfile.ts
│           ├── 📄 PopRockProfile.ts
│           └── 📄 ChillLoungeProfile.ts
│
├── 🔧 engines/                            # Motores secundarios (contexto, DMX)
│   ├── 📄 index.ts
│   │
│   ├── context/                           # Motor de contexto musical
│   │   ├── 📄 index.ts
│   │   ├── 📄 colorConstitutions.ts
│   │   ├── 📄 VibeManager.ts
│   │   └── presets/
│   │       ├── 📄 index.ts
│   │       ├── 📄 TechnoClubProfile.ts
│   │       ├── 📄 FiestaLatinaProfile.ts
│   │       ├── 📄 PopRockProfile.ts
│   │       ├── 📄 ChillLoungeProfile.ts
│   │       └── 📄 IdleProfile.ts
│   │
│   └── dmx/                               # Motor DMX
│       ├── 📄 index.ts
│       └── 📄 DMXMerger.ts
│
├── 🎛️ hal/                                # Hardware Abstraction Layer ⭐
│   ├── 📄 index.ts
│   ├── 📄 HardwareAbstraction.ts          # Capa de abstracción (WAVE 252)
│   │
│   ├── drivers/                           # Drivers de hardware
│   │   ├── 📄 index.ts
│   │   ├── 📄 DMXDriver.interface.ts
│   │   └── 📄 MockDriver.ts               # Driver mock (WAVE 252 - silencioso)
│   │
│   ├── mapping/                           # Mapeo de fixtures
│   │   ├── 📄 index.ts
│   │   ├── 📄 FixtureMapper.ts
│   │   └── 📄 ZoneRouter.ts
│   │
│   └── physics/                           # Motor de física
│       ├── 📄 index.ts
│       └── 📄 PhysicsEngine.ts
│
├── 🪝 hooks/                              # React Hooks personalizados
│   ├── 📄 index.ts
│   ├── 📄 useAudioCapture.ts
│   ├── 📄 useDevicePersistence.ts
│   ├── 📄 useFixtureRender.ts
│   ├── 📄 useSelene.ts
│   ├── 📄 useSeleneTruth.ts               # Hook TITAN 2.0 (WAVE 248)
│   ├── 📄 useSeleneVibe.ts                # Control de vibes (WAVE 250)
│   ├── 📄 useSystemPower.ts
│   └── 📄 useSeleneVibe.ts.backup
│
├── 📡 main/                               # BACKEND PRINCIPAL (Node/Electron)
│   │
│   ├── selene-lux-core/                   # 🧠 Motor de SeleneLux (CORE)
│   │   ├── 📄 SeleneLux.ts                # Orquestador principal (2284 líneas)
│   │   ├── 📄 types.ts
│   │   │
│   │   ├── docs/                          # Documentación interna
│   │   │
│   │   ├── engines/                       # Sub-motores especializados
│   │   │   │
│   │   │   ├── audio/                     # Análisis de audio
│   │   │   │   ├── 📄 AutomaticGainControl.ts
│   │   │   │   ├── 📄 BeatDetector.ts
│   │   │   │   ├── 📄 PatternRecognizer.ts
│   │   │   │   └── 📄 index.ts
│   │   │   │
│   │   │   ├── consciousness/             # Inteligencia y consciencia
│   │   │   │   ├── 📄 AudioToMusicalMapper.ts
│   │   │   │   ├── 📄 ConsciousnessToLightMapper.ts
│   │   │   │   ├── 📄 DreamForgeEngine.ts
│   │   │   │   ├── 📄 EvolutionEngine.ts
│   │   │   │   ├── 📄 FibonacciPatternEngine.ts
│   │   │   │   ├── 📄 HuntOrchestrator.ts
│   │   │   │   ├── 📄 MoodSynthesizer.ts
│   │   │   │   ├── 📄 MusicalHarmonyValidator.ts
│   │   │   │   ├── 📄 NocturnalVisionEngine.ts
│   │   │   │   ├── 📄 PrecisionJumpEngine.ts
│   │   │   │   ├── 📄 PreyRecognitionEngine.ts
│   │   │   │   ├── 📄 SeleneEvolutionEngine.ts
│   │   │   │   ├── 📄 SeleneLuxConscious.ts
│   │   │   │   ├── 📄 SelfAnalysisEngine.ts
│   │   │   │   ├── 📄 StalkingEngine.ts
│   │   │   │   ├── 📄 StrikeMomentEngine.ts
│   │   │   │   ├── 📄 UltrasonicHearingEngine.ts
│   │   │   │   ├── 📄 ZodiacAffinityCalculator.ts
│   │   │   │   └── 📄 index.ts
│   │   │   │
│   │   │   ├── musical/                   # Análisis musical avanzado
│   │   │   │   ├── 📄 SeleneMusicalBrain.ts
│   │   │   │   ├── 📄 types.ts
│   │   │   │   ├── 📄 index.ts
│   │   │   │   │
│   │   │   │   ├── analysis/
│   │   │   │   │   ├── 📄 HarmonyDetector.ts
│   │   │   │   │   ├── 📄 RhythmAnalyzer.ts
│   │   │   │   │   ├── 📄 SectionTracker.ts
│   │   │   │   │   └── 📄 index.ts
│   │   │   │   │
│   │   │   │   ├── classification/
│   │   │   │   │   ├── 📄 ScaleIdentifier.ts
│   │   │   │   │   └── 📄 index.ts
│   │   │   │   │
│   │   │   │   ├── context/
│   │   │   │   │   ├── 📄 MusicalContextEngine.ts
│   │   │   │   │   ├── 📄 PredictionMatrix.ts
│   │   │   │   │   └── 📄 index.ts
│   │   │   │   │
│   │   │   │   ├── learning/
│   │   │   │   │   ├── 📄 SeleneMemoryManager.ts
│   │   │   │   │   ├── 📄 schema.sql
│   │   │   │   │   └── 📄 index.ts
│   │   │   │   │
│   │   │   │   ├── mapping/
│   │   │   │   │   ├── 📄 MusicToLightMapper.ts
│   │   │   │   │   ├── 📄 PaletteManager.ts
│   │   │   │   │   ├── 📄 ProceduralPaletteGenerator.ts
│   │   │   │   │   └── 📄 index.ts
│   │   │   │   │
│   │   │   │   └── docs/
│   │   │   │       ├── 📄 WAVE8-FASE7-INTEGRATION-REPORT.md
│   │   │   │       ├── 📄 WAVE8-FASE8-NUCLEAR-INTEGRATION-REPORT.md
│   │   │   │       └── 📄 WAVE8-MUSICAL-INTELLIGENCE-ROADMAP.md
│   │   │   │
│   │   │   ├── telemetry/                 # Telemetría y diagnóstico
│   │   │   │   ├── 📄 SeleneTelemetryCollector.ts
│   │   │   │   └── 📄 index.ts
│   │   │   │
│   │   │   └── visual/                    # Generación de color y efectos
│   │   │       ├── 📄 ColorEngine.ts
│   │   │       ├── 📄 SeleneColorEngine.ts
│   │   │       ├── 📄 MovementEngine.ts
│   │   │       ├── 📄 EffectsEngine.ts
│   │   │       ├── 📄 EnergyStabilizer.ts
│   │   │       ├── 📄 KeyStabilizer.ts
│   │   │       ├── 📄 MoodArbiter.ts
│   │   │       ├── 📄 StrategyArbiter.ts
│   │   │       └── 📄 index.ts
│   │   │
│   │   ├── hardware/                      # Hardware (fixtures, drivers)
│   │   │   ├── 📄 DMXDriver.ts
│   │   │   ├── 📄 FixtureManager.ts
│   │   │   ├── 📄 FixturePhysicsDriver.ts
│   │   │   └── 📄 index.ts
│   │   │
│   │   ├── physics/                       # Física de sonido por vibe
│   │   │   ├── 📄 TechnoStereoPhysics.ts
│   │   │   ├── 📄 RockStereoPhysics.ts
│   │   │   ├── 📄 LatinoStereoPhysics.ts
│   │   │   ├── 📄 ChillStereoPhysics.ts
│   │   │   └── 📄 index.ts
│   │   │
│   │   └── tests/
│   │       └── 📄 MetaConsciousness.test.ts
│   │
│   └── workers/                           # Web Workers
│       ├── 📄 FFT.ts                      # Transformada Rápida de Fourier
│       ├── 📄 mind.ts                     # Worker cerebro (GAMMA)
│       ├── 📄 senses.ts                   # Worker audio (BETA)
│       ├── 📄 TrinityBridge.ts
│       ├── 📄 TrinityOrchestrator.ts
│       ├── 📄 WorkerProtocol.ts
│       ├── 📄 index.ts
│       └── utils/
│           ├── 📄 AdaptiveEnergyNormalizer.ts
│           ├── 📄 HysteresisTrigger.ts
│           └── 📄 index.ts
│
├── 📦 providers/                          # Proveedores de contexto React
│   ├── 📄 TrinityProvider.tsx
│   └── 📄 KeyboardProvider.tsx
│
├── 🗄️ stores/                             # Tiendas Zustand (estado global)
│   ├── 📄 index.ts
│   ├── 📄 truthStore.ts                   # Estado SeleneTruth (WAVE 248) ⭐
│   ├── 📄 audioStore.ts
│   ├── 📄 controlStore.ts
│   ├── 📄 dmxStore.ts
│   ├── 📄 effectsStore.ts
│   ├── 📄 logStore.ts
│   ├── 📄 luxsyncStore.ts
│   ├── 📄 navigationStore.ts
│   ├── 📄 overrideStore.ts
│   ├── 📄 sceneStore.ts
│   ├── 📄 selectionStore.ts
│   ├── 📄 seleneStore.ts
│   ├── 📄 setupStore.ts
│   └── 📄 vibeStore.ts
│
├── 🎨 styles/
│   └── 📄 globals.css
│
├── 🔧 types/
│   ├── 📄 FixtureDefinition.ts
│   ├── 📄 globals.d.ts
│   ├── 📄 VibeProfile.ts
│   └── 📄 three-jsx.d.ts
│
└── 🛠️ utils/
    ├── 📄 FixtureFactory.ts
    ├── 📄 frontendColorEngine.ts
    ├── 📄 layoutGenerator3D.ts
    └── 📄 movementGenerator.ts
```

---

## 🎯 Leyenda de Carpetas Principales

### 🔴 `main/` - Backend (Node/Electron Process)

```
Código que corre en el proceso principal de Electron (NOT en el navegador)
├── selene-lux-core/     Motor de iluminación principal
│   ├── engines/         Motores especializados
│   ├── hardware/        Drivers de hardware
│   └── physics/         Física por género
└── workers/             Web Workers para procesamiento paralelo
    ├── mind.ts          Cerebro musical (análisis avanzado)
    └── senses.ts        Análisis de audio (Wave8)
```

### 🟡 `components/` - Frontend (React Components)

```
Componentes React que corren en el navegador
├── views/               Vistas principales (páginas)
├── layout/              Componentes de maquetación
├── telemetry/           Paneles de información
├── stage3d/             Visualización 3D Three.js
└── modals/              Diálogos modales
```

### 🟢 `stores/` - Estado Global (Zustand)

```
Gestión de estado global con Zustand
├── truthStore.ts        SSOT - Verdad universal (30fps)
├── seleneStore.ts       Estado del motor Selene
├── audioStore.ts        Datos de audio en tiempo real
└── ...                  Otros stores especializados
```

### 🔵 `engines/` - Business Logic (Frontend)

```
Lógica de negocio del lado frontend
├── context/             Vibes y constituciones de color
│   └── presets/         Perfiles predefinidos
└── dmx/                 Fusión de DMX
```

---

## 📦 Tamaños Aproximados

| Carpeta | Archivos | Tamaño |
|---------|----------|--------|
| `main/selene-lux-core/` | 60+ | ~250KB |
| `main/workers/` | 15+ | ~100KB |
| `components/` | 80+ | ~180KB |
| `hooks/` | 7 | ~30KB |
| `stores/` | 12 | ~50KB |

---

## 🚀 Arquitectura de Capas

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vite + React)                   │
│              components/ → hooks/ → stores/                 │
└─────────────────────┬───────────────────────────────────────┘
                      │ IPC (ipcMain/ipcRenderer)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (Electron Main)                    │
│              main/selene-lux-core/ → hardware/              │
└─────────────────────┬───────────────────────────────────────┘
                      │ Worker Threads
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  WORKERS (Análisis Musical)                  │
│            main/workers/ → senses.ts, mind.ts              │
└─────────────────────────────────────────────────────────────┘
```

---

---

## 🎯 WAVE 248-252 Status Update

### ✅ WAVE 248: TITAN 2.0 Protocol (Frontend Migration)
- **Archivo Central:** `src/core/protocol/SeleneProtocol.ts` (DELETED - V1 Legacy removed)
- **Interfaz Principal:** `SeleneTruth` (estado unificado)
  ```typescript
  interface SeleneTruth {
    system: SystemState      // mode, vibe, titanEnabled, actualFPS, brainStatus
    sensory: SensoryData     // audio, beat, fft, input
    consciousness: CognitiveData  // mood, evolution, dream, zodiac
    context: MusicalContext  // genre, section, bpm, energy
    intent: LightingIntent   // palette, zones, movement, effects
    hardware: HardwareState  // dmx (driver, port, universe), fixtures
    timestamp: number
  }
  ```
- **Frontend State:** `src/stores/truthStore.ts` (Zustand)
- **Compilation:** ✅ 0 errores

### ✅ WAVE 250: Operation Nerve Splicing (IPC Synchronization)
- **Archivo Core:** `src/core/orchestrator/IPCHandlers.ts`
- **Canales Estándar:** `lux:*` prefix (antes: `selene:*`)
- **Handlers Clave:**
  - `lux:audio-frame` → Audio frame 44.1kHz
  - `lux:audio-buffer` → Buffer de audio 4096 samples
  - `lux:get-vibe` → Obtener vibe actual
  - `lux:get-full-state` / `lux:get-state` → SeleneTruth broadcast
  - `lux:setMode`, `lux:setVibe` → Control de parámetros
  - `lux:save-config` → Persistencia
- **Preload Bridge:** `electron/preload.ts` → window.lux API
- **Frontend Hooks:** `src/hooks/useSeleneVibe.ts` (WAVE 250 verified)
- **Compilation:** ✅ 0 errores

### ✅ WAVE 252: Silence & Reality (Runtime Cleanup)

#### PASO 1: Silenciador de IPC
- **Archivo:** `src/core/orchestrator/IPCHandlers.ts`
- **Cambios:**
  - ❌ Eliminados: `console.log` de audio handlers (lux:audio-frame, lux:audio-buffer)
  - ❌ Eliminados: `console.log` de state handlers (lux:get-vibe, lux:get-full-state)
  - ✅ Resultado: IPC path completamente silencioso

#### PASO 2: Exterminar Mock Fixtures
- **Archivo:** `src/core/orchestrator/TitanOrchestrator.ts`
- **Cambios:**
  - ❌ Eliminado: Hardcoded `mockFixtures` array (6 dispositivos falsos)
  - ✅ Añadido: `private fixtures: any[] = []` (vacío, inyectado)
  - ✅ Añadido: `setFixtures(fixtures)` método público
  - ✅ Añadido: `getFixturesCount()` accessor
  - ✅ Actualizado: `getState()` retorna `fixturesCount`
  - **Línea 195:** `hal.render(intent, this.fixtures, halAudioMetrics)` → **datos reales**

#### PASO 3: Drivers Silenciosos
- **Archivo:** `src/hal/drivers/MockDriver.ts`
- **Cambios:**
  - ❌ Eliminados: Todos los `console.log` de lifecycle (connect, close)
  - ❌ Eliminados: Todos los `console.log` de transmisión (send, sendUniverse, blackout)
  - ✅ Añadido: `verbose: boolean` property (default false)
  - ✅ Cambio: `debug: config.debug ?? true` → `debug: config.debug ?? false`
  - ✅ Actualizado: `setLogging(enabled)` ahora controla `verbose` mode
  - **Resultado:** Driver completamente silencioso, verbose on-demand

#### PASO 4: HAL Silencioso
- **Archivo:** `src/hal/HardwareAbstraction.ts`
- **Cambios:**
  - ❌ Eliminados: `console.warn()` para fallback USB/ArtNet
  - ✅ Cambio: Todas instancias MockDMXDriver usan `{ debug: false }`
  - **Resultado:** No hay warning spam en inicialización

#### 📊 Resultado WAVE 252
```
✅ Console Completamente Limpia (0 warnings, 0 IPC spam)
✅ Real Data Pipeline Listo (fixtures inyectables)
✅ Backend Compilation: 0 errores
✅ Frontend Compilation: 0 errores
✅ Git Commit: 65572a8 "WAVE 252: SILENCE & REALITY"
```

---

## 🔄 Flujos de Datos Actuales (Post-WAVE 252)

### 1. Audio → Luz Pipeline
```
Audio Input (Web Audio API)
  ↓
window.lux.audioFrame() → IPC
  ↓
IPCHandlers.ts (lux:audio-frame handler) [SILENT]
  ↓
TrinityBrain.processAudioFrame() → FFT, Beat Detection
  ↓
TitanEngine.update() → LightingIntent generation
  ↓
TitanOrchestrator.render()
  ↓
hal.render(intent, this.fixtures, metrics) [REAL FIXTURES]
  ↓
DMX Output → Hardware
```

### 2. IPC Communication (Synchronized Channels)
```
Frontend (React)
  ↓
window.lux.* API (preload.ts)
  ↓
ipcRenderer.invoke('lux:*') / ipcRenderer.on('lux:*')
  ↓
IPCHandlers.ts (lux:* handlers) [WAVE 250 STANDARDIZED]
  ↓
Backend (SeleneLux, TrinityBrain, TitanEngine)
  ↓
ipcMain.handle() / ipcMain.emit()
  ↓
Frontend callbacks (stores, hooks)
```

### 3. State Management (TITAN 2.0 Protocol)
```
Backend: SeleneLux.getBroadcast() → SeleneTruth
  ↓
lux:get-full-state IPC handler
  ↓
Frontend: truthStore (Zustand) [WAVE 248]
  ↓
React Components (useSeleneTruth hook)
  ↓
Display + Control Updates
```

---

## 📋 Archivo Key Files Post-WAVE 252

| Archivo | WAVE | Cambios | Status |
|---------|------|---------|--------|
| `src/core/orchestrator/IPCHandlers.ts` | 250, 252 | Canales `lux:*`, IPC silencioso | ✅ Live |
| `src/core/orchestrator/TitanOrchestrator.ts` | 252 | Fixtures inyectables (real data) | ✅ Live |
| `src/hal/drivers/MockDriver.ts` | 252 | Silent driver, verbose on-demand | ✅ Live |
| `src/hal/HardwareAbstraction.ts` | 252 | Silent fallback initialization | ✅ Live |
| `src/core/protocol/SeleneProtocol.ts` | 248 | TITAN 2.0 interfaces (SeleneTruth) | ✅ Live |
| `src/stores/truthStore.ts` | 248 | Estado global TITAN 2.0 | ✅ Live |
| `src/hooks/useSeleneVibe.ts` | 250 | IPC channels sincronizados | ✅ Live |
| `electron/preload.ts` | 250 | `window.lux` API (6 canales migrados) | ✅ Live |
| `tsconfig.node.json` | 249 | `downlevelIteration: true`, target ES2020 | ✅ Live |
| `src/vite-env.d.ts` | 249 | `declare global {}` Window extensions | ✅ Live |

---

## 🎓 Aprendizajes de WAVE 249-252

### WAVE 249: Backend Type System
- ✅ `downlevelIteration: true` resuelve Map/Set iterator errors en TypeScript <ES2020
- ✅ `declare global {}` + `export {}` necesario para Window extensions globales
- ✅ Type assertions pragmáticas válidas con validación runtime
- ✅ SectionContext.current field es crítico para MusicalContext

### WAVE 250: IPC Synchronization
- ✅ Naming conventions importan: canales deben ser consistentes
- ✅ Dual event listeners para backward compatibility
- ✅ preload.ts es el punto central para seguridad
- ✅ IPCHandlers.ts debe mantener todos los handlers registrados

### WAVE 252: Runtime Optimization
- ✅ Verbose logging debe ser opt-in, no default
- ✅ Mock fixtures deben ser inyectables para real data
- ✅ Console spam mata performance en streams de alta frecuencia
- ✅ Driver initialization warnings pueden eliminarse sin afectar funcionalidad

---

## 📄 Archivos de Documentación Generados

```
docs/
├── WAVE-249-BACKEND-RESURRECTION.md    # Backend type fixes
├── WAVE-250-NERVE-SPLICING.md          # IPC channel sync
├── WAVE-252-SILENCE-REALITY.md         # Console cleanup + real data
└── TREE-SRC-STRUCTURE.md               # Este archivo (directorio tree)
```

---

## 📝 Notas

- **No incluye**: `node_modules/`, tests (`__tests__`, `*.test.ts`), archivos `.backup`
- **Generado**: Actualizado 30 Diciembre 2025 (WAVE 252 Complete)
- **Propósito**: Referencia visual de la estructura del proyecto LuxSync 2.0 TITAN
- **Compilación:** ✅ Backend: 0 errores | ✅ Frontend: 0 errores
- **GitHub:** github.com/GestIAdev/LuxSync | Branch: main | Commit: 65572a8

