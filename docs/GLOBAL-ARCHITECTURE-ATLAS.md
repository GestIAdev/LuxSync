# 🗺️ LUXSYNC GLOBAL ARCHITECTURE ATLAS — WAVE 3500-PRE
## **THE ATLAS: Topología de Sistemas para Próxima Generación (AgnosticEngine)**

**Clasificación:** AUDITORÍA ESTRUCTURAL | Estado: LECTURA COMPLETA | Modificaciones: CERO

---

## EXECUTIVE SUMMARY

Este documento mapea la arquitectura actual de LuxSync en 5 pilares críticos, necesarios para la implementación de **AgnosticEngine** (basado en sub-emisores) la próxima semana. No sugiere refactorizaciones ni código nuevo—solo documenta la realidad topológica.

**Hallazgo Principal:** El flujo DMX es una **cascada de 4 transformaciones secuenciales** que procesa audio → física reactiva → movimiento → color → arbitraje → salida hardware. Las 9 zonas canónicas actúan como **puente semántico** entre intents e fixtures concretos.

---

## PILAR 1: TOPOLOGÍA DE ZONAS — THE 9 CANONICAL ZONES

### 1.1 Definición de Zonas Canónicas

Las 9 zonas semánticas son el **single source of truth** para toda referencia espacial en LuxSync:

```typescript
// Fuente: src/core/stage/ShowFileV2.ts (Line 212-223)

export type CanonicalZone =
  | 'front'           // PARs frontales (wash audience-facing)
  | 'back'            // PARs traseros (backlight/counter)
  | 'floor'           // PARs de suelo (uplight)
  | 'movers-left'     // Moving heads lado izquierdo
  | 'movers-right'    // Moving heads lado derecho
  | 'center'          // Strobes/Blinders centrales
  | 'air'             // Lásers/Aerials/Atmósfera
  | 'ambient'         // House lights/ambiente general
  | 'unassigned'      // Sin asignar (fixtures huérfanas)
```

**Inversión Total:** Cada fixture en `.luxshow` posee EXACTAMENTE uno de estos 9 valores en su campo `zone`.

### 1.2 Definición Semántica

| **Zona** | **Tipo** | **Hardware Típico** | **Función** | **Rutas Activas** |
|----------|----------|-------------------|-----------|-----------------|
| `front` | PAR | Chauvet, ADJ (frontales) | Wash principal, audience-facing | LiquidEngine (envSubBass/envKick) |
| `back` | PAR | Chauvet, ADJ (traseros) | Backlight, contra-luz, dimensión | LiquidEngine (envSnare/envHighMid) |
| `floor` | PAR | Chauvet, ADJ (suelo) | Uplight, efecto de profundidad | LiquidEngine (blended) |
| `movers-left` | Cabeza Móvil | Clay Paky, Vizi, Sharpy | Pan/Tilt movimiento izquierda | VibeMovement + LiquidEngine (envTreble/envVocal) |
| `movers-right` | Cabeza Móvil | Clay Paky, Vizi, Sharpy | Pan/Tilt movimiento derecha | VibeMovement + LiquidEngine (envTreble/envVocal) |
| `center` | Strobe/Blinder | Martin, Chauvet | Efectos de strobe, flashes | LiquidEngine (strobeActive) |
| `air` | Láser/Aerial | Scanner, Aerials | Atmósfera, proyecciones | Derivado de energía general |
| `ambient` | House/Wash | Fixtures de ambiente | Iluminación de fondo suave | Consciousness (CORE 3) |
| `unassigned` | Genérica | Cualquiera | Fallback (raramente usado) | Dead zone (sin ruta) |

### 1.3 Resolución de Zonas: ZoneMapper (WAVE 2543.4)

**Módulo:**  [src/core/zones/ZoneMapper.ts](src/core/zones/ZoneMapper.ts)

ZoneMapper es el **único punto de verdad** para traducciones de zonas. Resuelve:
1. **Compuestas** (`all-pars`, `all-movers`) → múltiples canónicas
2. **Modificadores** (`all-left`, `all-right`) → filtrado posicional (position.x)
3. **Estéreo** (`frontL`, `backR`) → combinación canónica + lado

**Constantes Internas:**

```typescript
// COMPOSITE ZONES — Grupos de múltiples zonas
const COMPOSITE_ZONES = {
  'all-pars':   ['front', 'back', 'floor'],
  'all-movers': ['movers-left', 'movers-right'],
}

// MODIFIER ZONES — Filtros posicionales (applied as AND-intersection)
const MODIFIER_ZONES = new Set(['all-left', 'all-right'])
// position.x < 0  → LEFT  (stage left, audience right)
// position.x >= 0 → RIGHT (stage right, audience left)

// STEREO ZONES — Combinadas canónica + lado
const STEREO_ZONES = {
  'frontl': { canonical: 'front', side: 'left' },
  'frontr': { canonical: 'front', side: 'right' },
  'backl':  { canonical: 'back',  side: 'left' },
  'backr':  { canonical: 'back',  side: 'right' },
  // ... y más
}
```

**Función Clave:** `resolveZone(zone: string, fixtures: ZoneMappableFixture[]): string[]`
- Entrada: UI tag (ej. `"back"`, `"all-right"`, o array `["back", "all-right"]`)
- Salida: FixtureIds concretos que coinciden con esa zona + modifiers

**Consumidores:**
- `TimelineEngine.resolveFixtureIds()` — Hyperion playback
- `MasterArbiter.getFixtureIdsByZone()` — DMX routing
- `TitanOrchestrator.fixtureMatchesZone()` — Selene live
- `useHephPreview.resolveFixtures()` — Hephaestus radar

---

## PILAR 2: MAPEO DE FIXTURES Y SHOWS — PERSISTENCIA .LUXSHOW

### 2.1 Estructura de Archivo `.luxshow`

**Formato:** JSON estructurado con schema V2 validado.
**Ubicación:** `%APPDATA%/LuxSync/shows/{showName}.v2.luxshow`
**Validación:** [src/core/stage/ShowFileV2.ts](src/core/stage/ShowFileV2.ts) (~600 LOC con tipos)

#### 2.1.1 Raíz de Show

```typescript
// Fuente: src/core/stage/ShowFileV2.ts (Line 400+)

export interface ShowFileV2 {
  // Metadatos
  schemaVersion: string          // "2.0" (para migraciones futuras)
  name: string                   // "Club XYZ - Noche 1"
  description?: string           // "Show de prueba del nuevo engine"
  
  // Fixtures
  fixtures: FixtureV2[]          // Array de ALL fixtures
  groups: GroupDefinition[]      // Groupos lógicos (opcional)
  scenes: SceneV2[]              // Snapshots de estado (opcional)
  
  // Configuración Global
  globalConfig: {
    defaultLayout: '4.1' | '7.1' | 'custom'
    installation: {
      orientation: InstallationOrientation  // 'ceiling' | 'floor' | etc.
      safetyLevel: 'strict' | 'moderate' | 'off'
      maxMotorAccel: number                 // DMX units/sec²
    }
  }
  
  // Timestamps
  createdAt: string              // ISO 8601
  modifiedAt: string             // ISO 8601
}
```

#### 2.1.2 Fixture V2 (Binding Zone)

**El corazón de la persistencia:** Cada fixture almacena su zona canónica + calibración.

```typescript
// Fuente: src/core/stage/ShowFileV2.ts (Line 480+)

export interface FixtureV2 {
  // Identidad
  id: string                     // v4 UUID (NO Math.random())
  fixtureType: string            // "par56", "clay-paky-sharpy", etc.
  manufacturer: string           // "Chauvet", "ADJ", etc.
  model: string                  // "DJ Par 64"
  
  // ZONA — El binding semántico
  zone: CanonicalZone           // Uno de los 9 - OBLIGATORIO
  
  // Posición 3D en el espacio
  position: {
    x: number                    // Stage left-right (-100 = far left, +100 = far right)
    y: number                    // Stage depth (-100 = back, +100 = front)
    z: number                    // Height (0 = ground, 100 = ceiling)
  }
  
  // Orientación
  rotation: {
    panOffset: number            // 0-360° (para fixtures montadas de lado)
    tiltOffset: number           // 0-360° (para fixtures invertidas)
  }
  
  // Calibración de Hardware
  calibration: {
    panResolution: number        // bits (typically 8 o 16)
    tiltResolution: number       // bits
    panInvert: boolean           // ¿Invertir sentido de Pan?
    tiltInvert: boolean          // ¿Invertir sentido de Tilt?
    colorWheelType?: string      // "gobo-wheel" | "color-wheel" | "none"
    strobeChannel?: number       // CH index si tiene strobe
  }
  
  // Física del motor
  physics: PhysicsProfile {
    motorType: 'servo-pro' | 'stepper-quality' | 'stepper-cheap' | 'unknown'
    maxAcceleration: number      // aplicado por safety layer
    maxVelocity: number
    safetyCap: boolean
    homePosition: { pan: number; tilt: number }  // DMX 0-255
  }
  
  // Control DMX
  dmxAddresses: {
    universe: number             // 0-indexed
    startChannel: number         // 1-indexed (CH 1-512)
  }
  
  // Metadata
  enabled: boolean               // ¿Fixture activa en show?
  notes?: string                 // "Rig repairs", etc.
}
```

**INVERSIÓN CRÍTICA:** El campo `zone` es **persistido literalmente**. Si usuario guarda fixture en zona `"back"`, será `"back"` cuando se cargue.

### 2.2 Binding Fixture → Zona en Runtime

**Secuencia:**

1. **Cargar Show** → `StagePersistence.loadShow(filename)`
   - Lee `.luxshow` del disco
   - Valida fixtures contra schema V2
   - Auto-migra formatos legacy (V1 → V2)

2. **Resolver Fixture** → `ZoneMapper.resolveZone("back", fixtures)`
   - Itera `fixtures` del show
   - Filtra por `fixture.zone === "back"`
   - Retorna array de FixtureIds

3. **Aplicar Intent** → `MasterArbiter.arbitrate(layer0_titan)`
   - Layer0 contiene `zones: ZoneIntentMap`
   - Por cada zona, `MasterArbiter.getFixtureIdsByZone(zone)`
   - Resuelve → fixtures concretos
   - Aplica merge de canales (HTP para dimmer, LTP para color)

### 2.3 Persistencia API

**Módulo:** [src/core/stage/StagePersistence.ts](src/core/stage/StagePersistence.ts)

```typescript
// OPERACIONES ATÓMICAS

export abstract class StagePersistence {
  static async saveShow(showFile: ShowFileV2, filename?: string): Promise<SaveResult>
  // - Write to temp file
  // - Validate schema
  // - Rename atomic
  // - Update recent-shows.json

  static async loadShow(filename: string): Promise<LoadResult>
  // - Read file
  // - Parse JSON
  // - Validate + migrate if needed
  // - Return ShowFileV2

  static async listRecentShows(): Promise<ListResult>
  // - Read recent-shows.json
  // - Stat each file (size, mtime, fixture count)
  // - Return ShowMetadataV2[]
}
```

**Ruta de Almacenamiento:** `%APPDATA%/LuxSync/shows/`

---

## PILAR 3: LIQUID ENGINE (MOTOR DE FÍSICA REACTIVA)

### 3.1 Arquitectura del Motor

**Jerarquía de Clases:**

```
LiquidEngineBase (Abstract) — Toda la matemática pesada
├── LiquidEngine41 (Comprimido)  — 4 zonas + strobe (rigs pequeños)
└── LiquidEngine71 (Asimétrico)  — 7 zonas diferenciadas (rigs proffesionales)
```

**Módulos:**
- [src/hal/physics/LiquidEngineBase.ts](src/hal/physics/LiquidEngineBase.ts) — Base (600+ LOC)
- [src/hal/physics/LiquidEngine41.ts](src/hal/physics/LiquidEngine41.ts) — Layout 4.1 (100 LOC)
- [src/hal/physics/LiquidEngine71.ts](src/hal/physics/LiquidEngine71.ts) — Layout 7.1 (400+ LOC)

### 3.2 ProcessedFrame: Salida de LiquidEngine

De la Base, cada frame procesado produce:

```typescript
// Fuente: src/hal/physics/LiquidEngineBase.ts (Line 34+)

export interface ProcessedFrame {
  // Audio Bands (GodEarBands — análisis FFT)
  bands: GodEarBands  // { bass, lowMid, mid, highMid, treble, air, ultraAir }
  
  // Factores de Morfo
  morphFactor: number    // 0-1 (intensidad general)
  recoveryFactor: number // AGC rebound
  isBreakdown: boolean   // ¿Sección de breakdown?
  isVetoed: boolean      // ¿Bloqueado por Kick Edge Detection?
  
  // Envelopes Procesados (output clave de 6 LiquidEnvelopes)
  // Estas sont las SEÑALES que routeZones() encamina a zonas
  frontLeft: number      // envSubBass.output → Front L
  frontRight: number     // envKick.output → Front R
  backLeft: number       // envHighMid.output → Back L
  backRight: number      // envSnare.output → Back R
  moverLeft: number      // envTreble.output →  Mover L
  moverRight: number     // envVocal.output → Mover R
  
  // Metadata
  now: number            // Timestamp frame actual
  strobeActive: boolean  // ¿Strobe encendido?
  strobeIntensity: number
  spectralCentroid: number  // Hz tonal brightness
}
```

**Los 6 LiquidEnvelopes:**

| **Envelope** | **Input Band** | **Proceso** | **Output** | **Zona 7.1 Default** | **Zona 4.1 Default** |
|--------------|---|---|---|---|---|
| `envSubBass` | bass | Simple level detector | frontLeft | Front L | Comprimido → frontPar |
| `envKick` | lowMid | Edge detector + BPM lock | frontRight | Front R | frontPar |
| `envHighMid` | highMid | Gate 0.22 + decay 0.14 | backLeft | Back L | backPar |
| `envSnare` | mid+treble | **Transient Shaper** | backRight | Back R | backPar |
| `envTreble` | treble | Cross-filter + vocal gating | moverLeft | Mover L (Melodista) | Mover L |
| `envVocal` | treble (puro) | Clean contour + sustain kill | moverRight | Mover R (Alma) | Mover R |

### 3.3 Enrutamiento: routeZones()

**Mecanismo Diferenciador:** Cada motor tiene estrategia distinta.

#### 3.3.1 LiquidEngine41 — Estrategia Dual

**Fuente:** [src/hal/physics/LiquidEngine41.ts](src/hal/physics/LiquidEngine41.ts) (Line 45+)

Dos modos configurables via `profile.layout41Strategy`:

**a) `'default'` (Legacy)**
```
frontPar  = max(envSubBass, envKick)     // Océano + Francotirador
backPar   = max(envHighMid, envSnare)    // Sintetizadores + Caja
moverL    = envTreble                    // Melodías
moverR    = envVocal                     // Voces
```

**b) `'strict-split'` (WAVE 2455 — Metrónomo/Lienzo)**
```
frontPar  = envKick                      // SOLO Kick → El Metrónomo
backPar   = envSnare                     // SOLO Snare → El Látigo
moverL    = envTreble (via WAVE 911)     // El Melodista
moverR    = envVocal (via WAVE 911)      // El Terminator
```

Techno industrial usa `strict-split` para separación pura ritmo ↔ atmósfera.

#### 3.3.2 LiquidEngine71 — Rutas Semáticas por Perfil

**Fuente:** [src/hal/physics/LiquidEngine71.ts](src/hal/physics/LiquidEngine71.ts) (Line 80+)

Three bifurcaciones por `profile.id`:

**a) TECHNO (default)**
```
Front L ← envSubBass    // El Océano
Front R ← envKick       // El Francotirador
Back L  ← envHighMid    // El Coro
Back R  ← envSnare      // El Látigo
Mover L ← envTreble     // El Melodista
Mover R ← envVocal      // El Alma
```

**b) LATINO (WAVE 2468)**
```
Front L ← envSubBass    // El TÚN (decay staccato 0.50)
Front R ← envKick       // El Francotirador (bombo puro, BPM lock)
Back L  ← envHighMid    // El Tumbao (congas, decay 0.92 —sustain max)
Back R  ← envSnare      // El TAcka (caja dembow, crisp)
Mover L ← envVocal      // El Galán (voces, melodía, piano)
Mover R ← envTreble     // La Dama (güira, metales, platillos)
```

(Nota: Mover L/R SWAPPED respecto a TECHNO para énfasis vocal latino.)

**c) CHILL (WAVE 2470 — Oceanico)**
```
Front L ← wave(1831, 1039)    // El Pulso del Abismo (osciladores primo-números)
Front R ← wave(1511, 1361)    // La Corriente (interferencia no-periódica)
Back L  ← wave(2003, 1201)    // Las Algas (período más largo)
Back R  ← wave(1759, 1069)    // El Destello Fantasma
Mover L ← envVocal             // La Voz del Mar (reactivo a música)
Mover R ← envTreble            // La Bioluminiscencia (destellos esporádicos)
```

(Los 4 PARs usan osciladores, NO envelopes rítmicos, para respiación continua.)

### 3.4 Perfiles y Overrides 4.1

**Almacenamiento:** [src/hal/physics/profiles/](src/hal/physics/profiles/) — *.ts files

**Interfaz Perfil:** [src/hal/physics/profiles/ILiquidProfile.ts](src/hal/physics/profiles/ILiquidProfile.ts)

```typescript
export interface ILiquidProfile {
  id: string                    // "latino-fiesta", "techno-industrial", etc.
  envelopeXXX: LiquidEnvelopeConfig
  layout41Strategy?: 'default' | 'strict-split'
  overrides41?: {               // WAVE 2435 — Fusion layer
    percMidSubtract?: number    // Transient Shaper aggressiveness
    envelopeSnare?: Partial<LiquidEnvelopeConfig>
    envelopeHighMid?: Partial<LiquidEnvelopeConfig>
    // ... más overrides per-envelope
  }
}
```

**Fuso de Perfiles (Fusion):**

Cuando layout='4.1' activo:
```typescript
// En setProfile() dentro de LiquidEngineBase

const fused = fuseProfileFor41(baseProfile)
// Retorna nuevo profile con overrides41 aplicados
// Original nunca es mutado
```

**Ejemplo Vivo (WAVE 3485 — Latino TAcka Restoration):**
```typescript
envelopeSnare: {
  decayBase: 0.14  // Root profile: crisp 350ms decay
}

overrides41: {
  percMidSubtract: 2.0  // 4x aggressive voice purge
  envelopeSnare: {
    decayBase: 0.14     // Modo 4.1 hereda (no regresan a base)
  }
}
```

---

## PILAR 4: VIBE MOVEMENT MANAGER (MOTOR CINÉTICO)

### 4.1 Generación de Movimiento

**Módulo:** [src/engine/movement/VibeMovementManager.ts](src/engine/movement/VibeMovementManager.ts) (450+ LOC)

**Función Clave:**
```typescript
generateIntent(
  vibeId: string,           // "techno-club", "fiesta-latina", etc.
  audio: AudioContext,      // { energy, bass, mids, highs, bpm, beatPhase }
  fixtureIndex: number,     // 0 = first mover, 1 = second, etc.
  totalFixtures: number     // Número total de movers
): MovementIntent
// Output: { x: -1..+1, y: -1..+1, pattern, speed, amplitude }
```

### 4.2 Los 12 Patrones Dorados (THE GOLDEN DOZEN + 4 NOBLES)

**WAVE 2086.5 — Vocabulario Expandido Profesional**

Organizados por vibe genre:

#### TECHNO (4 Patterns — Industrial/Sharp)
| **Patrón** | **Geometría** | **Amplitud Típica** | **Uso** |
|-----------|---|---|---|
| `scan_x` | Barrido X lineal (👈→👉) | 1.0 (full range) | Searchlight, robot scan |
| `square` | Rectángulo con esquinas agudas | 0.95 | Preciso, matemático |
| `diamond` | Rombo (abs + abs, no círculo) | 0.90 | Agresivo, rhombus puro |
| `botstep` | Posiciones cuantizadas (snapped) | 0.80 | Robótico, hold between |

#### LATINO (3 Patterns — Fluid/Hips)
| **Patrón** | **Geometría** | **Amplitud Típica** | **Uso** |
|-----------|---|---|---|
| `figure8` | Infinito (X lento, Y rápido) | 0.65 | Caderas de cumbia |
| `wave_y` | Pendulum U (X lento, Y rapido senoidal) | 0.60 | Ola suave, pendulum |
| `ballyhoo` | Espiral cierra cada 4 compases | 0.65 | Complejidad, cierre |

#### POP-ROCK (3 Patterns — Stadium/Symmetry)
| **Patrón** | **Geometría** | **Amplitud Típica** | **Uso** |
|-----------|---|---|---|
| `circle_big` | Círculo completo (X/Y = sin/cos) | 0.45 | El rey de estadios |
| `cancan` | X fijo, Y arriba/abajo sincronizado | 0.35 | Can-can dance leg kick |
| `dual_sweep` | Barrido U majestuoso | 0.40 | Estadio profesional |

#### CHILL (3 Patterns — Organic/Ambient)
| **Patrón** | **Geometría** | **Amplitud Típica** | **Uso** |
|-----------|---|---|---|
| `drift` | Brownian motion lento (azimutal) | 0.25 | Medusa drift |
| `sway` | Pendulum X suave (Y = 0) | 0.15 | Balanceo sutil |
| `breath` | Solo Tilt micro-oscilación | 0.05 | Respiración escénica |

#### THE FOUR NOBLES (4 Patterns — Professional Library WAVE 2086.5)
| **Patrón** | **Geometría** | **Amplitud Típica** | **Uso** |
|-----------|---|---|---|
| `slow_pan` | Barrido X lineal ultra-lento (32 beats) | 0.90 | Entrance, professional pacing |
| `tilt_nod` | Inclinación Y suave (cabeceo "sí") | 0.30 | Emotional response, nod |
| `figure_of_4` | Figure8 contenido (0.5 amplitude fija) | 0.50 | Refined, tight 8 |
| `chase_position` | Snap cuantizado cada 4 beats (hold between) | 1.0 | Chase lines, formación |

### 4.3 Configuraciones por Vibe

**Fuente:** [src/engine/movement/VibeMovementManager.ts](src/engine/movement/VibeMovementManager.ts) (Line 60+)

```typescript
const VIBE_CONFIG: Record<string, VibeConfig> = {
  'techno-club': {
    amplitudeScale: 0.70,        // 350° pan en 540° safe range
    baseFrequency: 0.25,         // Hz (ciclo de movimiento)
    patterns: ['scan_x', 'square', 'diamond', 'botstep'],
    homeOnSilence: false,        // No volver a home durante silencio
  },
  
  'fiesta-latina': {
    amplitudeScale: 0.65,        // Caderas amplias
    baseFrequency: 0.15,         // Más lento para groove
    patterns: ['figure8', 'wave_y', 'ballyhoo'],
    homeOnSilence: false,
  },
  
  'pop-rock': {
    amplitudeScale: 0.45,        // Conservador para servo-safety
    baseFrequency: 0.20,
    patterns: ['circle_big', 'cancan', 'dual_sweep'],
    homeOnSilence: true,         // Vuelve a home en silencio
  },
  
  'chill-oceanic': {
    amplitudeScale: 0.20,        // Micro-movements drift
    baseFrequency: 0.05,         // Ultra-lento, casi estático
    patterns: ['drift', 'sway', 'breath'],
    homeOnSilence: true,
  }
}
```

### 4.4 Phase Offset & Stereo Positioning

**WAVE 2086.1 — Stereo Resurrection (Phase offset ahora en VibeMovement)**

Por cada fixture, `generateIntent()` aplica desfase de fase (mirror/snake/linear):

**Entrada:**
```
fixtureIndex = 2
totalFixtures = 4
pattern = 'circle_big'
```

**Cálculo Desfase:**
```javascript
phaseOffset = (fixtureIndex / totalFixtures) * 360°
// = (2/4) × 360° = 180°

// Circle big rotado 180° queda "al otro lado"
// Mover 0 → Mover 1 → Mover 2 (180°) → Mover 3 (270°)
```

**Output:** `{ x, y, pattern: 'circle_big', _phase: 180 }`

MasterArbiter recibe esto como `mechanicsL` / `mechanicsR` pre-diferenciados.

### 4.5 Consumidor: TitanEngine

**Cómo se Integra:**

```typescript
// En TitanOrchestrator / TitanEngine

const movementIntent = vibeMovementManager.generateIntent(
  currentVibeId,
  {
    energy: liquidEngine71.lastFrame.morphFactor,
    bass: liquidEngine71.lastFrame.bands.bass,
    mids: liquidEngine71.lastFrame.bands.mid,
    highs: liquidEngine71.lastFrame.bands.treble,
    bpm: beatTracker.bpm,
    beatPhase: pll.phase,
  },
  fixtureIndex,
  totalMoversInRig
)

// moverIntent es parte de Layer0_Titan
layer0.mechanics = {
  // Posiciones pan/tilt normalizadas
  leftMoverIntent: movementIntent,
  rightMoverIntent: movementIntent,
}
```

---

## PILAR 5: SELENE COLOR ENGINE & MASTER ARBITER — EL EMBUDO FINAL

### 5.1 Generación de Color: SeleneColorEngine

**Módulo:** [src/engine/color/SeleneColorEngine.ts](src/engine/color/SeleneColorEngine.ts) (350+ LOC)

**Filosofía:**
> "Selene pinta matemática musical pura. El VibeProfile es el único jefe."

**Inputs:**
```typescript
// Análisis armónico + rítmico de audio
interface ExtendedAudioAnalysis {
  harmony: HarmonyOutput {
    key: string | null          // "C", "D#", "A", etc.
    mode: string                // "major", "minor", "dorian"
    mood: string                // "joyful", "melancholic"
    temperature: 'warm' | 'cool' | 'neutral'
    dissonance: number          // 0-1
  }
  rhythm: RhythmOutput {
    syncopation: number         // 0-1 (CRÍTICO para estrategia de color)
    groove: number
    pattern: string
  }
  genre: GenreOutput {
    primary: string             // "techno", "latino", etc.
    secondary?: string
  }
  section: SectionOutput {
    type: string                // "intro", "drop", "bridge"
    energy: number              // 0-1
  }
}
```

**Proceso Generador:**

1. **KEY → HUE (Círculo de Quintas)**
   ```typescript
   const KEY_TO_HUE = {
     'C':  0,    'G': 60,   'D': 120, 'A': 180,  'E': 240, 'B': 300,
     'F': 330,  'C#': 30,  'D#': 150, // ... etc
   }
   
   baseHue = KEY_TO_HUE[harmony.key] ?? 0
   ```

2. **MODE → MODIFIER (Alteración Emocional)**
   ```typescript
   const MODE_MODIFIERS = {
     'major': { hueDelta: 0, temperature: 'warm', saturation: 1.0 },
     'minor': { hueDelta: 180, temperature: 'cool', saturation: 0.85 },
     'dorian': { hueDelta: 120, temperature: 'neutral', saturation: 0.90 },
   }
   
   adjustedHue = (baseHue + MODE_MODIFIERS[mode].hueDelta) % 360
   ```

3. **ENERGY → BRIGHTNESS/SATURATION (NUNCA hue)**
   ```typescript
   saturation = 0.40 + (morphFactor × 0.60)     // 0.40-1.0
   brightness = 0.30 + (morphFactor × 0.70)     // 0.30-1.0
   // Hue JAMÁS cambia con energía
   ```

4. **SYNCOPATION → ESTRATEGIA (Color Secundario)**
   ```typescript
   if (syncopation > 0.7) {
     strategy = 'complementary'  // 180° opuesto al hue primario
   } else if (syncopation < 0.3) {
     strategy = 'analogous'      // ±30° del hue primario
   } else {
     strategy = 'triadic'        // 120° rotación Fibonacci
   }
   ```

5. **FIBONACCI SECONDARY (φ × 360° ≈ 222.5°)**
   ```typescript
   secondaryHue = (baseHue + 222.5) % 360
   // Golden ratio color rotation
   ```

**Output: SelenePalette**
```typescript
export interface SelenePalette {
  primary: HSLColor       // PARs, wash general
  secondary: HSLColor     // Back PARs, Fibonacci
  accent: HSLColor        // Moving heads, highlights
  ambient: HSLColor       // Fills, backlighting
  contrast: HSLColor      // Siluetas, sombras
  meta: {
    strategy: 'analogous' | 'triadic' | 'complementary'
    temperature: 'warm' | 'cool' | 'neutral'
    description: string
    confidence: number
  }
}
```

### 5.2 Master Arbiter — El Árbitro Central

**Módulo:** [src/core/arbiter/MasterArbiter.ts](src/core/arbiter/MasterArbiter.ts) (700+ LOC)

**Jerarquía de Capas (5 Niveles):**

```
┌─────────────────────────────────────────────────┐
│ Layer 4: BLACKOUT (Apagón total)                │  ← Prioridad 1 (Siempre Gana)
├─────────────────────────────────────────────────┤
│ Layer 3: EFFECTS (Strobe, Flash, cambios color)│  ← Prioridad 2
├─────────────────────────────────────────────────┤
│ Layer 2: MANUAL (XY pad, override usuario)      │  ← Prioridad 3
├─────────────────────────────────────────────────┤
│ Layer 1: CONSCIOUSNESS (SeleneLuxConscious)     │  ← Prioridad 4 (CORE 3)
├─────────────────────────────────────────────────┤
│ Layer 0: TITAN_AI (LiquidEngine+VibeMovement)   │  ← Prioridad 5 (Base)
└─────────────────────────────────────────────────┘
```

### 5.3 Merge Strategy (Arbitración de Canales)

**Fuente:** [src/core/arbiter/MergeStrategies.ts](src/core/arbiter/MergeStrategies.ts)

| **Canal Type** | **Estrategia** | **Lógica** | **Efecto** |
|---|---|---|---|
| Dimmer (Intensidad) | **HTP** (Highest Takes Precedence) | `max(layer0, layer1, layer2, layer3)` | Manual siempre más brillante |
| Pan/Tilt | **LTP** (Latest Takes Precedence) | El último layer que escribió gana | Movimientos manuales interrupt AI |
| Color | **LTP** + Crossfade | Transición suave 200ms | Evita flashes abruptos |
| Strobe | Priority + Duration | SI layer 3 activo, strobe se enciende | Efectos dominan |

**Ejemplo Vivo:**
```
Layer 0: frontPar dimmer = 200 (LiquidEngine41 dice 200/255)
Layer 1: frontPar dimmer = 180 (SeleneLux dice 180)
Layer 2: frontPar dimmer = 100 (Usuario XY pad: 100)
Layer 3: fronLeft strobe = FLASH (Effect: strobe intenso)
Layer 4: BLACKOUT = FALSE

RESULT:
✓ Dimmer = HTP = max(200, 180, 100) = 200 (LiquidEngine gana)
✓ Strobe = Layer 3 FLASH (Efecto domina)
✓ Color = LTP Layer 1 (Consciousness es latest color provider)
```

### 5.4 Flujo Completo: Intent → Arbitration → DMX

**Secuencia Frame a Frame:**

```
T=0ms: Audio FFT Ingresa
  ↓
  GodEarWorker.analyze() → bands [bass, lowMid, mid, highMid, treble, air, ultraAir]
  ↓
  IntervalBPMTracker.detect() → bpm, beatPhase, isKick

T=5ms: Física Reactiva
  ↓
  LiquidEngine71.process(bands) → ProcessedFrame {
    frontLeft (envSubBass),
    frontRight (envKick),
    backLeft (envHighMid),
    backRight (envSnare),
    moverLeft (envTreble),
    moverRight (envVocal),
    strobeActive,
    strobeIntensity
  }
  ↓
  LiquidEngine71.routeZones(frame) → LiquidStereoResult {
    frontLeftIntensity,
    frontRightIntensity,
    backLeftIntensity,
    backRightIntensity,
    moverLeftIntensity,
    moverRightIntensity,
    strobeActive,
    strobeIntensity,
  }

T=10ms: Movimiento Cinético
  ↓
  VibeMovementManager.generateIntent(vibeId, audioContext, fixtureIdx, total)
  → MovementIntent { x, y, pattern, speed, amplitude }

T=15ms: Color Generativo
  ↓
  SeleneColorEngine.generate(audioAnalysis) → SelenePalette {
    primary (HSL),
    secondary (HSL),
    accent (HSL),
    ambient (HSL),
  }

T=20ms: Layer Composition
  ↓
  TitanOrchestrator.compose() → Layer0_Titan {
    zones: ZoneIntentMap {
      'front': { intensity: ..., priority: 'primary' },
      'back': { intensity: ..., priority: 'secondary' },
      'movers-left': { intensity: ..., priority: 'accent' },
      'movers-right': { intensity: ..., priority: 'accent' },
    },
    mechanics: {
      leftMoverIntent: { x, y, pattern },
      rightMoverIntent: { x, y, pattern },
    }
  }
  ↓
  SeleneLuxConscious.compose() → Layer1_Consciousness {
    zones: ZoneIntentMap { /* emotional overrides */ },
    colors: { /* custom color palette */ },
  }
  ↓
  ManualOverrides.collect() → Layer2_Manual {
    zone: 'back',
    dimmer: 100,
    color: HSL { h: 180, s: 100, l: 50 }
  }

T=25ms: Master Arbitration
  ↓
  MasterArbiter.arbitrate(layer0, layer1, layer2, layer3, layer4)
  For EACH fixture:
    1. resolveZone(fixture.zone) → ZoneIntentMap
    2. getFixtureIdsByZone(zone) → [ "fix-1", "fix-3", ... ]
    3. For EACH resolved fixture:
       - mergeChannel('dimmer', layer0, layer1, layer2, layer3)
       - mergeChannel('color', layer0, layer1, layer2, layer3)
       - mergeChannel('pan', layer0, layer1, layer2, layer3)
       - mergeChannel('tilt', layer0, layer1, layer2, layer3)
    4. Return FinalLightingTarget per fixture

T=30ms: Hardware Abstraction (HAL)
  ↓
  HardwareAbstraction.renderFromTarget(finalLightingTarget)
  For EACH fixture:
    1. getProfile(fixture.model) → FixtureProfile
    2. applyDynamicOptics(color, beatPhase) → color ajustado
    3. ColorTranslator.translate(RGB) → deben usar "BABEL FISH"
       Si fixture tiene "color wheel" → RGB → WheelIndex DMX
       Si fixture es RGB nativa → RGB → [R, G, B] DMX
    4. PhysicsDriver.applyDecay(pan, tilt) → smoothing inertia
    5. Write to DMX buffer [universe, channel, value]

T=35ms: DMX Output
  ↓
  USBDMXDriver.send(dmxPacket) → USB device
  ArtNetDriver.send(dmxPacket) → Network
```

### 5.5 El Cuello de Botella: MasterArbiter Output Gate

**WAVE 1132 — Cold Start Protocol**

```typescript
// En MasterArbiter

private _outputEnabled: boolean = false  // DEFAULT: armed (output blocked)

/** 🚦 El Árbitro decidirá si el DMX fluye a los fixtures */
private get isOutputGated(): boolean {
  // Falso si:
  // - Manual blackout() fue llamado
  // - Aplicación está en startup (ARMED mode)
  // - Usuario presionó "KILL"
  return this._outputEnabled && !this.layer4_blackout
}

arbitrate(layer0, layer1, layer2, layer3, layer4): FinalLightingTarget {
  if (!this.isOutputGated) {
    // DMX bloqueado — engines corren pero sin salida hardware
    return NULL_TARGET  // Todos los fixtures a (0, 0, 0)
  }
  // ... arbitration normal
}
```

**Propósito:** Prevenir "hot patching" (cambios abruptos al conectar fixtures nuevas).

---

## PILAR 6: DIAGRAM CONCEPTUAL — EL FLUJO COMPLETO

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        LUXSYNC FULL DATA PIPELINE                           │
└────────────────────────────────────────────────────────────────────────────┘

INPUT: Audio Vivo
   ↓
   ┌─────────────────────────────────────────┐
   │  WAVE 8 ANALYSIS (GodEarWorker)         │
   │  - FFT → bands (bass, mid, treble)      │
   │  - Harmony detection (key, mode)        │
   │  - Rhythm detection (syncopation, BPM) │
   │  - Genre classification                 │
   │  - Section detection (intro/drop)       │
   └─────────────────────────────────────────┘
   ↓
   ├─→ LAYER 0: TITAN_AI (LiquidEngine + VibeMovement)
   │    ├─→ LiquidEngine71/41.process(bands)
   │    │    Returns: ProcessedFrame {
   │    │      frontLeft, frontRight,
   │    │      backLeft, backRight,
   │    │      moverLeft, moverRight,
   │    │      strobe
   │    │    }
   │    │
   │    ├─→ LiquidEngine.routeZones(processedFrame)
   │    │    Zone-specific output:
   │    │    - 4.1: { frontPar, backPar, moverL, moverR }
   │    │    - 7.1: { frontL, frontR, backL, backR, moverL, moverR }
   │    │    - CHILL: { oceanic oscillations + reactive movers }
   │    │
   │    ├─→ VibeMovementManager.generateIntent(...)
   │    │    Returns: MovementIntent { x, y, pattern, speed }
   │    │
   │    └─→ compose() → Layer0_Titan {
   │         dimmer per zone (HTP eligible),
   │         mechanics (pan/tilt),
   │         strobeActive
   │       }
   │
   ├─→ LAYER 1: CONSCIOUSNESS (SeleneLuxConscious)
   │    ├─→ SeleneColorEngine.generate(analysis)
   │    │    Returns: SelenePalette {
   │    │      primary, secondary, accent, ambient, contrast
   │    │    }
   │    │
   │    └─→ compose() → Layer1_Consciousness {
   │         colors (LTP eligible),
   │         emotional overrides (dimmer modulation)
   │       }
   │
   ├─→ LAYER 2: MANUAL (User Controls)
   │    └─→ XY Pad, zone selectors, manual overrides
   │         → Layer2_Manual { zone, dimmer, color, pan }
   │
   ├─→ LAYER 3: EFFECTS (Strobe, Flash, Transitions)
   │    └─→ EffectManager injects EffectIntents RESOLVED to fixture IDs
   │         → Layer3_Effect[] { type, intensity, duration }
   │
   └─→ LAYER 4: BLACKOUT (Emergency Control)
        └─→ Output Gate
            _outputEnabled = true/false
            
   ↓
   ┌───────────────────────────────────────────┐
   │  MASTER ARBITER (Arbitration Engine)      │
   │  - For EACH fixture:                      │
   │    1. resolveZone(fixture.zone)           │
   │    2. getFixtureIdsByZone(zone)           │
   │    3. mergeChannel('dimmer', layers)      │
   │       → HTP: max(layer0, 1, 2, 3)        │
   │    4. mergeChannel('color', layers)       │
   │       → LTP + crossfade                   │
   │    5. mergeChannel('pan/tilt', layers)   │
   │       → LTP from latest layer             │
   │    6. Apply output gate check             │
   │                                           │
   │    Returns: FinalLightingTarget per fix   │
   └───────────────────────────────────────────┘
   ↓
   ┌───────────────────────────────────────────────┐
   │  HARDWARE ABSTRACTION (HAL)                   │
   │  For EACH fixture FinalLightingTarget:        │
   │    1. getProfile(fixture.model)               │
   │    2. applyDynamicOptics(color, beatPhase)   │
   │    3. ColorTranslator.translate()             │
   │       → RGB → WheelIndex OR → [R,G,B] DMX    │
   │    4. FixturePhysicsDriver.applyDecay()       │
   │       → Pan/Tilt inertia + smoothing          │
   │    5. Convert to DMX packet [U, CH, VAL]     │
   └───────────────────────────────────────────────┘
   ↓
   ┌───────────────────────────────┐
   │  DMX OUTPUT DRIVERS           │
   │  - USBDMXDriverAdapter        │
   │  - ArtNetDriverAdapter        │
   │  - MockDMXDriver (testing)    │
   │                               │
   │  Send 512-channel universes   │
   │  at 44.1 kHz sync             │
   └───────────────────────────────┘
   ↓
   PHYSICAL FIXTURES (PAR, Movers, Strobes)
   ✓ Dimmer ON/OFF controlled by Layer merge (HTP)
   ✓ Color steered by SeleneColorEngine (LTP)
   ✓ Pan/Tilt animated by VibeMovement (LTP) + Physics decay
   ✓ Strobe pulsed by EffectManager (LTP)
```

---

## INFRAESTRUCTURA CRÍTICA — DEPENDENCIAS Y PUNTOS DE CONEXIÓN

### 6.1 Storage Layer

| **Responsabilidad** | **Module** | **Clave** |
|---|---|---|
| Persistencia Shows | [src/core/stage/StagePersistence.ts](src/core/stage/StagePersistence.ts) | `.luxshow` formato V2 |
| Validación Schema | [src/core/stage/ShowFileV2.ts](src/core/stage/ShowFileV2.ts) | Tipos CanonicalZone + FixtureV2 |
| Auto-Migración | [src/core/stage/ShowFileMigrator.ts](src/core/stage/ShowFileMigrator.ts) | V1 → V2 converters |

### 6.2 Physics Layer

| **Responsabilidad** | **Module** | **Clave** |
|---|---|---|
| Cálculo de Energía | [src/hal/physics/LiquidEngineBase.ts](src/hal/physics/LiquidEngineBase.ts) | 6 LiquidEnvelopes → ProcessedFrame |
| Ruteo 4.1 | [src/hal/physics/LiquidEngine41.ts](src/hal/physics/LiquidEngine41.ts) | `routeZones()` → 4 salidas stereo |
| Ruteo 7.1 | [src/hal/physics/LiquidEngine71.ts](src/hal/physics/LiquidEngine71.ts) | `routeZones()` → 7 salidas asimétricas |
| Perfiles Config | [src/hal/physics/profiles/](src/hal/physics/profiles/) | latino.ts, techno.ts, chill-oceanic.ts |

### 6.3 Movement Layer

| **Responsabilidad** | **Module** | **Clave** |
|---|---|---|
| Generación de Movimiento | [src/engine/movement/VibeMovementManager.ts](src/engine/movement/VibeMovementManager.ts) | 12 Golden Patterns + 4 Nobles |
| Physics del Motor | [src/engine/movement/FixturePhysicsDriver.ts](src/engine/movement/FixturePhysicsDriver.ts) | Decay, inertia, smooth acceleration |
| IK Solver (Pan/Tilt) | [src/engine/movement/InverseKinematicsEngine.ts](src/engine/movement/InverseKinematicsEngine.ts) | 3D target → pan/tilt angles |

### 6.4 Color Layer

| **Responsabilidad** | **Module** | **Clave** |
|---|---|---|
| Generación Cromática | [src/engine/color/SeleneColorEngine.ts](src/engine/color/SeleneColorEngine.ts) | Key→Hue, Mode→Modifier, Energy→Bright |
| Conciencia Emocional | [src/core/consciousness/SeleneLuxConscious.ts](src/core/consciousness/SeleneLuxConscious.ts) | CORE 3 Layer1 |
| Traducción Color | [src/hal/translation/ColorTranslator.ts](src/hal/translation/ColorTranslator.ts) | RGB → WheelIndex (BABEL FISH) |

### 6.5 Arbitration Layer

| **Responsabilidad** | **Module** | **Clave** |
|---|---|---|
| Mapeo Zonas | [src/core/zones/ZoneMapper.ts](src/core/zones/ZoneMapper.ts) | Zone string → Fixture IDs |
| Arbitraje 5-Layer | [src/core/arbiter/MasterArbiter.ts](src/core/arbiter/MasterArbiter.ts) | HTP dimmer, LTP color |
| Merge Strategies | [src/core/arbiter/MergeStrategies.ts](src/core/arbiter/MergeStrategies.ts) | Channel-type specific merge |

### 6.6 Hardware Output Layer

| **Responsabilidad** | **Module** | **Clave** |
|---|---|---|
| Abstracción HAL | [src/hal/HardwareAbstraction.ts](src/hal/HardwareAbstraction.ts) | render(intent) → DMX packet |
| Drivers USB/ArtNet | [src/hal/drivers/](src/hal/drivers/) | USBDMXDriverAdapter, ArtNetDriverAdapter |
| Safety Layer | [src/hal/translation/HardwareSafetyLayer.ts](src/hal/translation/HardwareSafetyLayer.ts) | Velocity caps, tilt limits |

---

## LIMITACIONES ARQUITECTÓNICAS ACTUALES

### Para Considerar en AgnosticEngine

1. **Zona Singular por Fixture**
   - Cada FixtureV2 tiene EXACTAMENTE 1 zona en su campo `zone`
   - No hay "multi-zone" fixtures (un PAR no puede ser "front + back" simultáneamente)
   - Workaround actual: duplicar fixture o usar grupos

2. **Ruteo Estático en Perfiles**
   - LiquidEngine41 tiene 2 modos hardcodeados (`default` vs `strict-split`)
   - LiquidEngine71 está bifurcado 3 vías por `profile.id`
   - Para AgnosticEngine: podría ser ***n-ario* (sub-emisores dinámicos)

3. **Output Gate Centralizado**
   - MasterArbiter._outputEnabled es global (todos los fixtures ON/OFF juntos)
   - No hay granularidad por zona o fixture individual

4. **Color engine agnóstico de Zona**
   - SelenePalette es **única** (primary, secondary, accent, ambient, contrast)
   - Se distribuye a zones via `priority` en ZoneIntentMap
   - Para AgnosticEngine: podrían generarse paletas **por sub-emisor**

5. **VibeMovement agnóstico de Zona**
   - Los 12 patrones se aplican globalmente a todos los movers-left/right
   - No hay patrón asignado por zona o grupo de fixtures

---

## CASOS DE USO VALIDADOS PARA AGNOSTICENGINE

### Caso A: Sub-Emisor Tecno "Kick Limpio"
```
AgnosticEngine SubEmitter 1:
  Name: "kick-isolated"
  Input: envKick (extraído de ProcessedFrame)
  Output Zone: "front"
  Routing: direct injection a fixtures con zone='front'
  Strategy: strict intensidad (no max() con otros envelopes)
```

### Caso B: Sub-Emisor Latino "Tumbao Asimétrico"
```
AgnosticEngine SubEmitter 2:
  Name: "tumbao-delayed"
  Input: envHighMid con decay estocástico
  Output Zone: "back"
  Routing: resuelve solo fixtures zone='back' + position.x < 0 (left side)
  Strategy: phase offset de -45° respecto a back-right
```

### Caso C: Sub-Emisor Oceánico "Respiración Continua"
```
AgnosticEngine SubEmitter 3:
  Name: "ocean-breath"
  Input: oscilador primo (NO envelope rítmico)
  Output Zone: "front"
  Routing: PARs frontales únicamente
  Strategy: periodo 8.5 segundos, amplitude tapering con morphFactor
```

---

## RECOMENDACIONES PARA ARQUITECTO (NO DIRECTIVAS)

1. **Sub-Emisore Como Abstraer:**
   - Cada sub-emisor es un *tuple (InputSignal, OutputZones, RoutingStrategy, Intensity)*
   - Pueden ser inyectados dinámicamente (no hardcodeados en LiquidEngine71)

2. **Zone-Aware Routing:**
   - ZoneMapper ya resuelve fixtures por zona — reutilizar
   - Sub-emisores podrían especificar `outputZones: ['back', 'movers-left']` en config

3. **Envelope Pooling:**
   - Los 6 envelopes (subBass, kick, highMid, snare, treble, vocal) podrían compartirse
   - O generarse dinámicamente bajo demanda ("create envCustom for sub-emitter X")

4. **Profile Composition:**
   - En lugar de 3 bifurcaciones hardcodeadas (`techno`, `latino`, `chill`), usar **profile DSL**
   - Cada profile declara sub-emisores: `subEmitters: [ { name, input, outputZone } ]`

---

## REFERENCIAS DE CÓDIGO CLAVE

| **Concepto** | **Archivo** | **Líneas** |
|---|---|---|
| Zonas canónicas | ShowFileV2.ts | 212-223 |
| Resolver zonas | ZoneMapper.ts | 50-150 |
| Persistencia shows | StagePersistence.ts | 1-100 |
| Envelopes rítmicos | LiquidEngineBase.ts | 1-100 |
| ProcessedFrame | LiquidEngineBase.ts | 34-80 |
| Ruteo 4.1 | LiquidEngine41.ts | 45-120 |
| Ruteo 7.1 | LiquidEngine71.ts | 50-250 |
| Generación movimiento | VibeMovementManager.ts | 1-200 |
| Generación color | SeleneColorEngine.ts | 1-150 |
| Arbitraje | MasterArbiter.ts | 120-250 |
| Merge HTP/LTP | MergeStrategies.ts | 1-80 |
| HAL main | HardwareAbstraction.ts | 100-200 |
| Conexión Arbiter → HAL | TitanOrchestrator.ts | (search for arbitrate call) |

---

## CONCLUSIÓN

LuxSync modela la cadena completa **Audio → Física Reactiva → Movimiento Cinético → Color Generativo → Arbitraje → DMX** usando 9 zonas canónicas como semántica unificadora. 

El AgnosticEngine propuesto podrá descomprimir esta arquitectura actual en **sub-sistemas de emisión independientes** (sub-emisores), cada uno capaz de:
1. Consumir envelopes o señales discretas (NO solo ProcessedFrame monolítica)
2. Dirigirse a zonas específicas (NO todas las zonas simultáneamente)
3. Definir estrategias de ruteo personalizadas (NO hardcodeadas en LiquidEngine)

Sin cambios de código, esta atlas documenta TODO lo que el nuevo sistema debe saber.

---

**Documento Preparado Por:** Executor (Codex)  
**Para:** Dirección de Arquitectura (Jeny)  
**WAVE:** 3500-PRE  
**Estado:** AUDITORÍA LECTURA COMPLETA | SIN MODIFICACIONES CÓDIGO  
**Fecha:** ${new Date().toISOString()}
