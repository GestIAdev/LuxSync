# 📁 LuxSync - Estructura de Directorios `/electron-app/src`

> **Generado**: 29 Diciembre 2025  
> **Estado**: Snapshot actual sin tests ni dependencies

---

## 📊 Árbol de Directorios

```
src/
├── App.tsx                             # Componente raíz React
├── AppCommander.tsx                    # Comandos globales
├── main.tsx                            # Punto de entrada Vite
├── vite-env.d.ts                       # Definiciones Vite
│
├── components/                         # Componentes React reutilizables
│   ├── BigSwitch.tsx                   # Switch principal modo
│   ├── Blackout.tsx                    # Control blackout
│   ├── EffectsBar.tsx                  # Barra de efectos
│   ├── Header.tsx                      # Encabezado
│   ├── index.ts                        # Exportaciones
│   │
│   ├── layout/                         # Componentes de maquetación
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
│   ├── modals/                         # Diálogos modales
│   │   └── FixtureEditor/
│   │       ├── FixtureEditorModal.tsx
│   │       └── FixtureEditor.css
│   │
│   ├── ModeSwitcher/                   # Selector de modo (flow/selene/locked)
│   │   ├── ModeSwitcher.tsx
│   │   ├── ModeSwitcher.css
│   │   └── index.ts
│   │
│   ├── shared/                         # Componentes compartidos
│   │   ├── ViewModeSwitcher.tsx
│   │   ├── ViewModeSwitcher.css
│   │   └── index.ts
│   │
│   ├── stage3d/                        # Visualización 3D del escenario
│   │   ├── Stage3DCanvas.tsx
│   │   ├── Stage3DCanvas.css
│   │   ├── index.ts
│   │   │
│   │   ├── controls/
│   │   │   ├── CameraControls3D.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── environment/
│   │   │   ├── StageFloor.tsx          # Piso del escenario
│   │   │   ├── StageTruss.tsx          # Estructura de truss
│   │   │   └── index.ts
│   │   │
│   │   └── fixtures/                   # Modelos 3D de fixtures
│   │       ├── Fixture3D.tsx
│   │       ├── MovingHead3D.tsx
│   │       ├── ParCan3D.tsx
│   │       └── index.ts
│   │
│   ├── telemetry/                      # Paneles de telemetría
│   │   ├── index.ts
│   │   │
│   │   ├── AudioOscilloscope/
│   │   │   ├── AudioOscilloscope.tsx
│   │   │   ├── AudioOscilloscope.css
│   │   │   └── index.ts
│   │   │
│   │   ├── HuntMonitor/
│   │   │   ├── HuntMonitor.tsx
│   │   │   ├── HuntMonitor.css
│   │   │   └── index.ts
│   │   │
│   │   ├── MusicalDNAPanel/
│   │   │   ├── MusicalDNAPanel.tsx
│   │   │   ├── MusicalDNAPanel.css
│   │   │   └── index.ts
│   │   │
│   │   └── PalettePreview/
│   │       ├── PalettePreview.tsx
│   │       ├── PalettePreview.css
│   │       └── index.ts
│   │
│   └── views/                          # Vistas principales
│       ├── LiveView.tsx                # Vista en vivo
│       ├── SetupView.tsx               # Configuración
│       ├── SimulateView.tsx            # Simulador
│       ├── StageView.tsx               # Vista escenario
│       │
│       ├── DashboardView/              # Dashboard principal
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
│       ├── LuxCoreView/                # Vista core Selene
│       │   ├── index.tsx
│       │   ├── LuxCoreView.css
│       │   ├── TacticalLog.tsx
│       │   └── TacticalLog.css
│       │
│       ├── SetupView/                  # Configuración de hardware
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
│       │       └── index.ts
│       │
│       ├── SimulateView/               # Simulador
│       │   ├── index.tsx
│       │   ├── SimulateView.css
│       │   └── StageSimulator2.tsx
│       │
│       └── StageViewDual/              # Vista escenario dual
│           ├── index.ts
│           ├── StageViewDual.tsx
│           ├── StageViewDual.css
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
├── constants/                          # Constantes globales
│   └── palettes.ts                     # Definiciones de paletas
│
├── engines/                            # Motores de negocio
│   ├── index.ts
│   │
│   ├── context/                        # Contexto y vibes
│   │   ├── VibeManager.ts              # Gestor de vibes
│   │   ├── colorConstitutions.ts       # Reglas cromáticas por vibe
│   │   ├── index.ts
│   │   └── presets/                    # Perfiles de vibes
│   │       ├── ChillLoungeProfile.ts
│   │       ├── FiestaLatinaProfile.ts
│   │       ├── IdleProfile.ts
│   │       ├── PopRockProfile.ts
│   │       ├── TechnoClubProfile.ts
│   │       └── index.ts
│   │
│   └── dmx/                            # Fusión de DMX
│       ├── DMXMerger.ts
│       └── index.ts
│
├── hooks/                              # Custom React hooks
│   ├── useAudioCapture.ts              # Captura de audio
│   ├── useDevicePersistence.ts         # Persistencia de dispositivos
│   ├── useFixtureRender.ts             # Renderizado de fixtures
│   ├── useSelene.ts                    # Hook a SeleneLux
│   ├── useSeleneTruth.ts               # Hook a estado verdad
│   ├── useSeleneVibe.ts                # Hook a vibes
│   ├── useSystemPower.ts               # Control de energía
│   └── index.ts
│
├── main/                               # 🔴 BACKEND PRINCIPAL (Node/Electron)
│   │
│   ├── selene-lux-core/                # 🧠 Motor de Selene (CORE)
│   │   ├── SeleneLux.ts                # Fachada principal
│   │   ├── types.ts                    # Tipos del core
│   │   │
│   │   ├── docs/                       # Documentación interna
│   │   │
│   │   ├── engines/                    # Sub-motores especializados
│   │   │
│   │   │   ├── audio/                  # Análisis de audio
│   │   │   │   ├── AutomaticGainControl.ts
│   │   │   │   ├── BeatDetector.ts
│   │   │   │   ├── PatternRecognizer.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── consciousness/          # Inteligencia y consciencia
│   │   │   │   ├── AudioToMusicalMapper.ts
│   │   │   │   ├── ConsciousnessToLightMapper.ts
│   │   │   │   ├── DreamForgeEngine.ts
│   │   │   │   ├── EvolutionEngine.ts
│   │   │   │   ├── FibonacciPatternEngine.ts
│   │   │   │   ├── HuntOrchestrator.ts
│   │   │   │   ├── MoodSynthesizer.ts
│   │   │   │   ├── MusicalHarmonyValidator.ts
│   │   │   │   ├── NocturnalVisionEngine.ts
│   │   │   │   ├── PrecisionJumpEngine.ts
│   │   │   │   ├── PreyRecognitionEngine.ts
│   │   │   │   ├── SeleneEvolutionEngine.ts
│   │   │   │   ├── SeleneLuxConscious.ts
│   │   │   │   ├── SelfAnalysisEngine.ts
│   │   │   │   ├── StalkingEngine.ts
│   │   │   │   ├── StrikeMomentEngine.ts
│   │   │   │   ├── UltrasonicHearingEngine.ts
│   │   │   │   ├── ZodiacAffinityCalculator.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── musical/                # Análisis musical avanzado
│   │   │   │   ├── SeleneMusicalBrain.ts
│   │   │   │   ├── types.ts
│   │   │   │   ├── index.ts
│   │   │   │   │
│   │   │   │   ├── analysis/           # Análisis musical
│   │   │   │   │   ├── HarmonyDetector.ts
│   │   │   │   │   ├── RhythmAnalyzer.ts
│   │   │   │   │   ├── SectionTracker.ts
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── classification/     # Clasificación musical
│   │   │   │   │   ├── ScaleIdentifier.ts
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── context/            # Contexto musical
│   │   │   │   │   ├── MusicalContextEngine.ts
│   │   │   │   │   ├── PredictionMatrix.ts
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── learning/           # Aprendizaje y memoria
│   │   │   │   │   ├── SeleneMemoryManager.ts
│   │   │   │   │   ├── schema.sql
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── mapping/            # Mapeo música → luz
│   │   │   │   │   ├── MusicToLightMapper.ts
│   │   │   │   │   ├── PaletteManager.ts
│   │   │   │   │   ├── ProceduralPaletteGenerator.ts
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   └── docs/               # Documentación Wave8
│   │   │   │       ├── WAVE8-FASE7-INTEGRATION-REPORT.md
│   │   │   │       ├── WAVE8-FASE8-NUCLEAR-INTEGRATION-REPORT.md
│   │   │   │       └── WAVE8-MUSICAL-INTELLIGENCE-ROADMAP.md
│   │   │   │
│   │   │   ├── telemetry/              # Telemetría y diagnóstico
│   │   │   │   ├── SeleneTelemetryCollector.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── visual/                 # Generación de color y efectos
│   │   │       ├── ColorEngine.ts      # Motor de colores antiguo
│   │   │       ├── SeleneColorEngine.ts # Motor procedural nuevo
│   │   │       ├── EffectsEngine.ts    # Efectos especiales
│   │   │       ├── EnergyStabilizer.ts
│   │   │       ├── KeyStabilizer.ts
│   │   │       ├── MoodArbiter.ts
│   │   │       ├── MovementEngine.ts
│   │   │       ├── StrategyArbiter.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── hardware/                   # Hardware drivers
│   │   │   ├── DMXDriver.ts
│   │   │   ├── FixtureManager.ts
│   │   │   ├── FixturePhysicsDriver.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── physics/                    # Física de luz por género
│   │   │   ├── ChillStereoPhysics.ts   # Físca Chill
│   │   │   ├── LatinoStereoPhysics.ts  # Física Latino
│   │   │   ├── RockStereoPhysics.ts    # Física Rock
│   │   │   ├── TechnoStereoPhysics.ts  # Física Techno
│   │   │   └── index.ts
│   │   │
│   │   └── tests/                      # Tests locales
│   │       └── MetaConsciousness.test.ts
│   │
│   └── workers/                        # Worker threads
│       ├── FFT.ts                      # Análisis FFT
│       ├── mind.ts                     # Worker cerebro (GAMMA)
│       ├── senses.ts                   # Worker audio (BETA)
│       ├── TrinityBridge.ts            # Puente Wave8
│       ├── TrinityOrchestrator.ts      # Orquestador Trinity
│       ├── WorkerProtocol.ts           # Protocolo de comunicación
│       ├── index.ts
│       └── utils/
│           ├── AdaptiveEnergyNormalizer.ts
│           ├── HysteresisTrigger.ts
│           └── index.ts
│
├── providers/                          # Proveedores React Context
│   ├── KeyboardProvider.tsx            # Entrada de teclado
│   └── TrinityProvider.tsx             # Contexto de Trinity
│
├── stores/                             # Zustand stores (estado global)
│   ├── audioStore.ts                   # Estado de audio
│   ├── controlStore.ts                 # Controles globales
│   ├── dmxStore.ts                     # Estado DMX
│   ├── effectsStore.ts                 # Efectos activos
│   ├── logStore.ts                     # Logs
│   ├── luxsyncStore.ts                 # Estado general
│   ├── navigationStore.ts              # Navegación
│   ├── overrideStore.ts                # Overrides manual
│   ├── sceneStore.ts                   # Escenas guardadas
│   ├── selectionStore.ts               # Selección actual
│   ├── seleneStore.ts                  # Estado Selene
│   ├── setupStore.ts                   # Configuración
│   ├── truthStore.ts                   # Verdad universal
│   ├── vibeStore.ts                    # Vibes activos
│   └── index.ts
│
├── styles/                             # Estilos globales
│   └── globals.css
│
├── types/                              # Tipos TypeScript globales
│   ├── FixtureDefinition.ts            # Definición de fixtures
│   ├── SeleneProtocol.ts               # Protocolo de Selene
│   ├── VibeProfile.ts                  # Perfil de vibes
│   ├── globals.d.ts                    # Declaraciones globales
│   └── three-jsx.d.ts                  # Three.js JSX types
│
└── utils/                              # Utilidades
    ├── FixtureFactory.ts               # Factory de fixtures
    ├── frontendColorEngine.ts          # Motor de color (frontend)
    ├── layoutGenerator3D.ts            # Generador de layouts 3D
    └── movementGenerator.ts            # Generador de movimiento
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

## 📝 Notas

- **No incluye**: `node_modules/`, tests (`__tests__`, `*.test.ts`), archivos `.backup`
- **Generado**: Snapshot del 29 Diciembre 2025
- **Propósito**: Referencia visual de la estructura del proyecto LuxSync 1.x

