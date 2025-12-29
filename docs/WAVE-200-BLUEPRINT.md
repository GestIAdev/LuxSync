# 🏛️ WAVE 200: TITAN ARCHITECTURE BLUEPRINT

> **Fecha**: 29 Diciembre 2025  
> **Versión**: LuxSync 2.0 Architecture  
> **Codename**: TITAN  
> **Estado**: Blueprint (Pre-Implementación)

---

## 📋 TABLA DE CONTENIDOS

1. [Filosofía Arquitectónica](#filosofía-arquitectónica)
2. [Diagrama de Capas](#diagrama-de-capas)
3. [Estructura de Carpetas](#estructura-de-carpetas)
4. [Flujo de Datos Unidireccional](#flujo-de-datos-unidireccional)
5. [Especificación de Módulos](#especificación-de-módulos)
6. [SeleneProtocol: La Única Fuente de Verdad](#seleneprotocol-la-única-fuente-de-verdad)
7. [Plan de Migración](#plan-de-migración)

---

## 🎯 FILOSOFÍA ARQUITECTÓNICA

### Los 5 Mandamientos de TITAN

```
1. CADA MÓDULO TIENE UNA SOLA RESPONSABILIDAD
   "Hago una cosa y la hago bien."

2. LOS DATOS FLUYEN EN UNA SOLA DIRECCIÓN
   Audio → Contexto → Intención → Hardware

3. NADIE ESCRIBE DONDE NO LE CORRESPONDE
   Cada capa solo modifica su propio estado.

4. SELENEPROTOCOL ES LA BIBLIA
   Si no está en el protocolo, no existe.

5. ELECTRON MAIN.TS SOLO ORQUESTRA
   No calcula. No transforma. Solo conecta.
```

### Separación de Concerns

| Capa | Pregunta que Responde | Qué NO Hace |
|------|----------------------|-------------|
| **CEREBRO** | ¿Qué está sonando? | No decide colores DMX |
| **MOTOR** | ¿Qué queremos expresar? | No conoce hardware específico |
| **HAL** | ¿Cómo lo mostramos? | No analiza audio |
| **ORQUESTADOR** | ¿Cómo conecto las piezas? | No procesa datos |

---

## 🏗️ DIAGRAMA DE CAPAS

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            🌐 CAPA DE PRESENTACIÓN                          │
│                                (Frontend/UI)                                │
│                                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │  Dashboard  │  │  Patch Bay  │  │   Canvas    │  │   Effects   │       │
│   │   Widget    │  │   Editor    │  │  Visualizer │  │   Panel     │       │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│          │                │                │                │              │
│          └────────────────┴────────────────┴────────────────┘              │
│                                    │                                        │
│                                    ▼                                        │
│                    ┌───────────────────────────────┐                       │
│                    │       SeleneProtocol          │                       │
│                    │   (Contrato de Comunicación)  │                       │
│                    └───────────────┬───────────────┘                       │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │ IPC (selene:truth, selene:command)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          🎼 CAPA DE ORQUESTACIÓN                            │
│                           (Electron Main Process)                           │
│                                                                             │
│                    ┌───────────────────────────────┐                       │
│                    │         main.ts               │                       │
│                    │    (Solo 300-500 líneas)      │                       │
│                    │                               │                       │
│                    │  • Window creation            │                       │
│                    │  • IPC routing                │                       │
│                    │  • Lifecycle management       │                       │
│                    │  • Module initialization      │                       │
│                    └───────────────┬───────────────┘                       │
│                                    │                                        │
│     ┌──────────────────────────────┼──────────────────────────────┐        │
│     │                              │                              │        │
│     ▼                              ▼                              ▼        │
│ ┌─────────────┐            ┌─────────────┐            ┌─────────────┐      │
│ │   Event     │            │   Module    │            │   Config    │      │
│ │   Router    │            │   Loader    │            │   Manager   │      │
│ └─────────────┘            └─────────────┘            └─────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           🧠 CAPA CEREBRO                                   │
│                    (Análisis Musical - Worker Thread)                       │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                     TrinityBrain.ts                              │      │
│   │                                                                  │      │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │      │
│   │  │  Wave8      │  │   Section   │  │   Genre     │              │      │
│   │  │  Analyzer   │  │   Tracker   │  │  Classifier │              │      │
│   │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │      │
│   │         │                │                │                      │      │
│   │         └────────────────┼────────────────┘                      │      │
│   │                          ▼                                       │      │
│   │              ┌─────────────────────┐                            │      │
│   │              │   MusicalContext    │                            │      │
│   │              │   {key, mode, bpm,  │                            │      │
│   │              │   section, energy,  │                            │      │
│   │              │   genre, mood}      │                            │      │
│   │              └──────────┬──────────┘                            │      │
│   └─────────────────────────┼────────────────────────────────────────┘      │
│                             │                                               │
│                     OUTPUT: MusicalContext                                  │
│                    (NO colores, NO DMX, solo QUÉ SUENA)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ⚡ CAPA MOTOR                                     │
│                    (Lógica Reactiva - Main Thread)                          │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                     SeleneLux 2.0                                │      │
│   │                                                                  │      │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │      │
│   │  │   Vibe      │  │   Color     │  │  Movement   │              │      │
│   │  │  Manager    │  │   Engine    │  │   Engine    │              │      │
│   │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │      │
│   │         │                │                │                      │      │
│   │         │    MusicalContext + Vibe       │                      │      │
│   │         │                │                │                      │      │
│   │         └────────────────┼────────────────┘                      │      │
│   │                          ▼                                       │      │
│   │              ┌─────────────────────┐                            │      │
│   │              │   LightingIntent    │                            │      │
│   │              │   {palette: HSL[],  │                            │      │
│   │              │    intensity: 0-1,  │                            │      │
│   │              │    movement: {...}, │                            │      │
│   │              │    effects: [...]}  │                            │      │
│   │              └──────────┬──────────┘                            │      │
│   └─────────────────────────┼────────────────────────────────────────┘      │
│                             │                                               │
│                    OUTPUT: LightingIntent                                   │
│                   (Abstracto, NO sabe de fixtures)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      🔧 CAPA HAL (Hardware Abstraction)                     │
│                    (Traducción a Hardware Real)                             │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                    HardwareAbstraction.ts                        │      │
│   │                                                                  │      │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │      │
│   │  │  Fixture    │  │   Zone      │  │  Physics    │              │      │
│   │  │  Mapper     │  │   Router    │  │   Engine    │              │      │
│   │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │      │
│   │         │                │                │                      │      │
│   │         │    LightingIntent + Fixtures   │                      │      │
│   │         │                │                │                      │      │
│   │         └────────────────┼────────────────┘                      │      │
│   │                          ▼                                       │      │
│   │              ┌─────────────────────┐                            │      │
│   │              │    DMXPacket[]      │                            │      │
│   │              │   [{addr, ch, val}] │                            │      │
│   │              └──────────┬──────────┘                            │      │
│   └─────────────────────────┼────────────────────────────────────────┘      │
│                             │                                               │
│               ┌─────────────┴─────────────┐                                │
│               ▼                           ▼                                │
│       ┌─────────────┐             ┌─────────────┐                          │
│       │  USB DMX    │             │   Art-Net   │                          │
│       │  Driver     │             │   Driver    │                          │
│       └─────────────┘             └─────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 ESTRUCTURA DE CARPETAS

```
electron-app/
├── electron/                          # Electron-specific (minimal)
│   ├── main.ts                        # 300-500 lines MAX (orquestador)
│   ├── preload.ts                     # IPC bridge
│   └── windows/
│       └── MainWindow.ts              # Window creation logic
│
├── src/
│   ├── core/                          # 🆕 TITAN CORE
│   │   ├── protocol/
│   │   │   ├── SeleneProtocol.ts      # Tipos y contratos
│   │   │   ├── MusicalContext.ts      # Interface del Cerebro
│   │   │   ├── LightingIntent.ts      # Interface del Motor
│   │   │   └── DMXPacket.ts           # Interface del HAL
│   │   │
│   │   ├── orchestrator/
│   │   │   ├── EventRouter.ts         # Enruta eventos IPC
│   │   │   ├── ModuleLoader.ts        # Carga módulos dinámicamente
│   │   │   └── LifecycleManager.ts    # App lifecycle
│   │   │
│   │   └── config/
│   │       ├── ConfigManager.ts       # (movido desde electron/)
│   │       └── VibePresets.ts         # (extraído de main.ts)
│   │
│   ├── brain/                         # 🧠 CAPA CEREBRO
│   │   ├── TrinityBrain.ts            # Orquestador del Worker
│   │   ├── workers/
│   │   │   ├── AudioAnalyzer.worker.ts
│   │   │   └── ContextBuilder.worker.ts
│   │   ├── analyzers/
│   │   │   ├── Wave8Adapter.ts        # Integración Wave8
│   │   │   ├── SectionTracker.ts
│   │   │   ├── GenreClassifier.ts
│   │   │   └── MoodSynthesizer.ts
│   │   └── types/
│   │       └── MusicalContext.ts
│   │
│   ├── engine/                        # ⚡ CAPA MOTOR (SeleneLux 2.0)
│   │   ├── SeleneLux.ts               # Fachada principal
│   │   ├── vibe/
│   │   │   ├── VibeManager.ts
│   │   │   └── profiles/
│   │   │       ├── FiestaLatinaProfile.ts
│   │   │       ├── TechnoClubProfile.ts
│   │   │       └── ...
│   │   ├── color/
│   │   │   ├── ColorEngine.ts
│   │   │   ├── ColorInterpolator.ts
│   │   │   ├── StrategyArbiter.ts
│   │   │   └── MoodArbiter.ts
│   │   ├── movement/
│   │   │   ├── MovementEngine.ts
│   │   │   └── patterns/
│   │   ├── effects/
│   │   │   ├── EffectsEngine.ts
│   │   │   └── triggers/
│   │   └── types/
│   │       └── LightingIntent.ts
│   │
│   ├── hal/                           # 🔧 CAPA HAL
│   │   ├── HardwareAbstraction.ts     # Fachada HAL
│   │   ├── mapping/
│   │   │   ├── FixtureMapper.ts       # Intent → Fixture specific
│   │   │   ├── ZoneRouter.ts          # Zonas (PAR_FRONT, etc.)
│   │   │   └── ColorWheelAdapter.ts   # RGB vs Rueda de colores
│   │   ├── physics/
│   │   │   ├── PhysicsEngine.ts       # Decay, inertia, gates
│   │   │   ├── DecayBuffer.ts
│   │   │   └── NoiseGate.ts
│   │   ├── drivers/
│   │   │   ├── DMXDriver.interface.ts
│   │   │   ├── USBDMXDriver.ts
│   │   │   ├── ArtNetDriver.ts
│   │   │   └── MockDriver.ts          # Para tests
│   │   └── types/
│   │       └── DMXPacket.ts
│   │
│   ├── ui/                            # Frontend (React)
│   │   └── ... (sin cambios mayores)
│   │
│   └── types/                         # Tipos globales
│       ├── fixtures.ts
│       └── common.ts
│
└── tests/
    ├── brain/
    ├── engine/
    └── hal/
```

---

## 🔄 FLUJO DE DATOS UNIDIRECCIONAL

### El Manifiesto del Flujo

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  AUDIO   │───▶│ CEREBRO  │───▶│  MOTOR   │───▶│   HAL    │───▶ DMX
│  INPUT   │    │          │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                    │               │               │
                    ▼               ▼               ▼
              Musical         Lighting         DMXPacket[]
              Context          Intent
              
   "Qué suena"        "Qué queremos"      "Cómo se hace"
```

### Reglas del Flujo

1. **CEREBRO** solo produce `MusicalContext`
   ```typescript
   interface MusicalContext {
     key: string | null        // 'C', 'A#', null
     mode: 'major' | 'minor' | 'unknown'
     bpm: number
     section: SectionType      // 'drop', 'breakdown', 'buildup'
     energy: number            // 0-1
     genre: MacroGenre
     mood: Mood
     syncopation: number
     confidence: number
   }
   ```

2. **MOTOR** recibe `MusicalContext` + `AudioMetrics`, produce `LightingIntent`
   ```typescript
   interface LightingIntent {
     palette: {
       primary: HSLColor
       secondary: HSLColor
       accent: HSLColor
       ambient: HSLColor
     }
     intensity: number         // 0-1 global
     zones: {
       [zoneName: string]: {
         intensity: number     // 0-1 zone specific
         color: 'primary' | 'secondary' | 'accent' | 'ambient'
       }
     }
     movement: {
       pan: number             // 0-1
       tilt: number            // 0-1
       speed: number
       pattern: MovementPattern
     }
     effects: EffectIntent[]
   }
   ```

3. **HAL** recibe `LightingIntent` + `FixtureConfig[]`, produce `DMXPacket[]`
   ```typescript
   interface DMXPacket {
     universe: number
     address: number
     channels: number[]        // Raw DMX values 0-255
   }
   ```

---

## 📜 SELENEPROTOCOL: LA ÚNICA FUENTE DE VERDAD

### SeleneProtocol.ts (El Contrato)

```typescript
// src/core/protocol/SeleneProtocol.ts

/**
 * 🏛️ WAVE 200: SELENE PROTOCOL
 * 
 * Este archivo define TODOS los tipos que cruzan límites de módulo.
 * Si un tipo no está aquí, NO PUEDE usarse para comunicación inter-módulo.
 */

// ═══════════════════════════════════════════════════════════════════════════
// CEREBRO → MOTOR
// ═══════════════════════════════════════════════════════════════════════════

export interface MusicalContext {
  // Harmonic
  key: MusicalKey | null
  mode: MusicalMode
  
  // Rhythmic
  bpm: number
  beatPhase: number
  syncopation: number
  
  // Structural
  section: SectionContext
  
  // Emotional
  energy: number
  mood: Mood
  
  // Classification
  genre: GenreContext
  
  // Meta
  confidence: number
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════════════════
// MOTOR → HAL
// ═══════════════════════════════════════════════════════════════════════════

export interface LightingIntent {
  // Color Palette (Abstract - HSL only)
  palette: ColorPalette
  
  // Global Intensity
  masterIntensity: number
  
  // Zone Assignments
  zones: ZoneIntentMap
  
  // Movement (Abstract - 0-1 normalized)
  movement: MovementIntent
  
  // Active Effects
  effects: EffectIntent[]
  
  // Meta
  source: 'procedural' | 'manual' | 'effect'
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════════════════
// HAL → HARDWARE
// ═══════════════════════════════════════════════════════════════════════════

export interface DMXOutput {
  universes: Map<number, Uint8Array>  // universe → 512 channels
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════════════════
// UI ↔ BACKEND (IPC)
// ═══════════════════════════════════════════════════════════════════════════

export interface SeleneTruth {
  // Current State
  context: MusicalContext
  intent: LightingIntent
  
  // Hardware State
  hardware: {
    dmxConnected: boolean
    fixtures: FixtureState[]
  }
  
  // Audio State
  audio: {
    source: string
    isActive: boolean
    levels: AudioLevels
  }
  
  // System State
  system: {
    mode: SeleneMode
    vibe: VibeId
    fps: number
    uptime: number
  }
}
```

### Canales IPC Definidos

| Canal | Dirección | Payload | Descripción |
|-------|-----------|---------|-------------|
| `selene:truth` | Backend → Frontend | `SeleneTruth` | Estado completo @ 30fps |
| `selene:command` | Frontend → Backend | `SeleneCommand` | Comandos de usuario |
| `selene:config` | Bidireccional | `SeleneConfig` | Configuración |
| `selene:fixtures` | Backend → Frontend | `FixtureState[]` | Estado de fixtures |

---

## 🚀 PLAN DE MIGRACIÓN

### Fase 0: Preparación (WAVE 200-205)

```
┌─────────────────────────────────────────────────────────────────┐
│ OBJETIVO: Crear estructura sin romper nada                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ WAVE 200: Crear carpetas nuevas (vacías)                       │
│   - src/core/protocol/                                          │
│   - src/brain/                                                  │
│   - src/engine/                                                 │
│   - src/hal/                                                    │
│                                                                 │
│ WAVE 201: Escribir SeleneProtocol.ts con todos los tipos       │
│   - Definir interfaces sin implementación                       │
│   - Documentar contratos                                        │
│                                                                 │
│ WAVE 202: Crear stubs de módulos principales                   │
│   - TrinityBrain.ts (stub)                                     │
│   - SeleneLux2.ts (stub)                                        │
│   - HardwareAbstraction.ts (stub)                               │
│                                                                 │
│ WAVE 203: Feature flag para alternar entre v1 y v2             │
│   - TITAN_ENABLED = false (default)                             │
│   - Cuando true, usa nuevos módulos                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Fase 1: Extracción de HAL (WAVE 205-215)

```
┌─────────────────────────────────────────────────────────────────┐
│ OBJETIVO: Sacar toda la lógica de hardware de main.ts          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ WAVE 205: Extraer PhysicsEngine                                │
│   - Mover applyDecay, applyPhysics de main.ts                  │
│   - Mover decayBuffers                                          │
│   - Crear PhysicsEngine.ts en src/hal/physics/                  │
│                                                                 │
│ WAVE 207: Extraer ZoneRouter                                   │
│   - Mover switch(zone) de main.ts líneas 1050-1400             │
│   - Crear ZoneRouter.ts en src/hal/mapping/                     │
│   - Mantener API compatible                                     │
│                                                                 │
│ WAVE 210: Extraer FixtureMapper                                │
│   - Mover lógica de fixtureStates.map()                        │
│   - Crear FixtureMapper.ts                                      │
│                                                                 │
│ WAVE 212: Unificar Drivers                                     │
│   - Crear DMXDriver.interface.ts                                │
│   - Refactorizar USBDMXDriver y ArtNetDriver                   │
│                                                                 │
│ WAVE 215: Crear HardwareAbstraction.ts (fachada)               │
│   - Combinar todos los módulos HAL                              │
│   - Exponer API única: hal.render(intent, fixtures)            │
│                                                                 │
│ RESULTADO: main.ts pierde ~700 líneas                          │
└─────────────────────────────────────────────────────────────────┘
```

### Fase 2: Consolidación del Motor (WAVE 215-225)

```
┌─────────────────────────────────────────────────────────────────┐
│ OBJETIVO: Unificar SeleneLux con coherencia                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ WAVE 217: Limpiar SeleneLux.ts                                 │
│   - Eliminar código del Worker zombie                           │
│   - Remover isWorkerActive() y flujos duplicados               │
│   - Reducir de 2279 a ~1000 líneas                             │
│                                                                 │
│ WAVE 220: Crear LightingIntent generator                       │
│   - SeleneLux recibe MusicalContext                            │
│   - Produce LightingIntent (no DMX)                            │
│                                                                 │
│ WAVE 222: Mover VibeManager a src/engine/vibe/                 │
│   - Extraer perfiles a archivos separados                       │
│   - Crear factory para perfiles                                 │
│                                                                 │
│ WAVE 225: Integrar con HAL                                     │
│   - SeleneLux.getIntent() → HAL.render()                       │
│   - Eliminar generación DMX en SeleneLux                        │
│                                                                 │
│ RESULTADO: Motor limpio que solo produce Intent                │
└─────────────────────────────────────────────────────────────────┘
```

### Fase 3: Simplificación del Cerebro (WAVE 225-235)

```
┌─────────────────────────────────────────────────────────────────┐
│ OBJETIVO: El Worker solo produce MusicalContext                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ WAVE 227: Crear TrinityBrain.ts                                │
│   - Fachada para toda la lógica de análisis                    │
│   - Output: solo MusicalContext                                 │
│                                                                 │
│ WAVE 230: Refactorizar mind.ts                                 │
│   - Eliminar SeleneColorEngine del Worker                       │
│   - Eliminar generación de paletas                              │
│   - Solo análisis Wave8 + clasificación                         │
│                                                                 │
│ WAVE 233: Simplificar TrinityOrchestrator                      │
│   - Solo pasa MusicalContext (no LightingDecision)             │
│   - Eliminar palette passthrough                                │
│                                                                 │
│ WAVE 235: Nuevo flujo Brain → Engine                           │
│   - TrinityBrain emite 'context-update'                        │
│   - SeleneLux escucha y genera Intent                          │
│                                                                 │
│ RESULTADO: Cerebro que solo analiza, no decide                 │
└─────────────────────────────────────────────────────────────────┘
```

### Fase 4: Limpieza del Orquestador (WAVE 235-245)

```
┌─────────────────────────────────────────────────────────────────┐
│ OBJETIVO: main.ts solo orquestra, no calcula                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ WAVE 237: Extraer IPC Handlers                                 │
│   - Crear src/core/orchestrator/IPCHandlers.ts                 │
│   - Mover todos los ipcMain.handle()                           │
│                                                                 │
│ WAVE 240: Extraer EventRouter                                  │
│   - Centralizar routing de eventos                              │
│   - Trinity → Engine → HAL → DMX                               │
│                                                                 │
│ WAVE 243: Nuevo main.ts minimalista                            │
│   - Solo: createWindow, initModules, startLoop                 │
│   - 300-500 líneas máximo                                       │
│                                                                 │
│ WAVE 245: Feature flag TITAN_ENABLED = true                    │
│   - Activar nueva arquitectura                                  │
│   - Mantener fallback a v1 si hay problemas                    │
│                                                                 │
│ RESULTADO: main.ts elegante y mantenible                       │
└─────────────────────────────────────────────────────────────────┘
```

### Fase 5: Validación y Cleanup (WAVE 245-250)

```
┌─────────────────────────────────────────────────────────────────┐
│ OBJETIVO: Verificar y limpiar                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ WAVE 247: Test Suite                                           │
│   - Tests unitarios para cada módulo                            │
│   - Tests de integración Brain → Engine → HAL                   │
│                                                                 │
│ WAVE 248: Performance Audit                                    │
│   - Verificar 30fps consistente                                 │
│   - Profile memoria y CPU                                       │
│                                                                 │
│ WAVE 249: Eliminar código v1                                   │
│   - Remover feature flags                                       │
│   - Eliminar código legacy                                      │
│                                                                 │
│ WAVE 250: TITAN COMPLETE 🏛️                                   │
│   - Documentación actualizada                                   │
│   - LuxSync 2.0 release                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 MÉTRICAS DE ÉXITO

| Archivo | Antes | Después | Reducción |
|---------|-------|---------|-----------|
| `main.ts` | 3290 líneas | ~400 líneas | **88%** |
| `SeleneLux.ts` | 2279 líneas | ~800 líneas | **65%** |
| `mind.ts` | 1220 líneas | ~400 líneas | **67%** |

| Métrica | Antes | Después |
|---------|-------|---------|
| Módulos con >1000 líneas | 3 | 0 |
| Responsabilidades de main.ts | 12+ | 3 |
| Puntos de escritura a lastColors | 2 | 1 |
| Flujos de datos | 2 (conflictivos) | 1 (unidireccional) |

---

## 🎯 RESUMEN VISUAL

```
                    ANTES (v1)                          DESPUÉS (v2 TITAN)
                    
           ┌──────────────────────┐             ┌─────────────────────────┐
           │     main.ts          │             │      main.ts            │
           │    (3290 líneas)     │             │     (400 líneas)        │
           │                      │             │    Solo orquesta        │
           │  Audio + Physics +   │             └──────────┬──────────────┘
           │  DMX + Effects +     │                        │
           │  Config + IPC +      │             ┌──────────┴──────────────┐
           │  Window + Trinity +  │             │                         │
           │  Overrides + ...     │             ▼                         ▼
           └──────────┬───────────┘    ┌─────────────┐           ┌─────────────┐
                      │                │   BRAIN     │           │   ENGINE    │
                      ▼                │  Context    │──────────▶│   Intent    │
           ┌──────────────────────┐    └─────────────┘           └──────┬──────┘
           │    SeleneLux.ts      │                                     │
           │   (árbitro confuso)  │                                     ▼
           └──────────────────────┘                             ┌─────────────┐
                                                                │    HAL      │
                                                                │   DMX       │
                                                                └─────────────┘
```

---

## 📝 PRÓXIMOS PASOS INMEDIATOS

1. **WAVE 200**: Crear estructura de carpetas (este documento)
2. **WAVE 201**: Escribir `SeleneProtocol.ts` con todos los tipos
3. **WAVE 202**: Crear stubs de módulos principales
4. **WAVE 203**: Implementar feature flag `TITAN_ENABLED`
5. **WAVE 205**: Comenzar extracción de HAL con PhysicsEngine

---

> **Autor**: Claude (Arquitecto de Sistemas)  
> **Revisión**: Pendiente aprobación humana  
> **Estado**: BLUEPRINT COMPLETO - Listo para implementación
