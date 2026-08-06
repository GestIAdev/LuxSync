# THE SYNESTHETIC SANDBOX — Custom Vibe Creator Blueprint

**Versión:** 1.0 — Arquitectura de Mutación Genética
**Estado:** Propuesta arquitectónica. Ningún código de motor ha sido modificado.
**Objetivo:** Diseñar el *Custom Vibe Creator*: un sandbox visual donde el usuario muta el
ADN de la luz para crear perfiles ("Dubstep", "Trap", "Teatro de Vanguardia") que se
exportan como `.luxvibe` JSON, heredando de un `baseDNA` canónico y sobreescribiendo
variables de motor **sin tocar la lógica sagrada del core**.

**Blueprints de entrada:**
- <ref_file file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\blueprints\liquid_engine_topology.md" /> (~180 params)
- <ref_file file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\blueprints\color_engine_topology.md" /> (49 params)
- <ref_file file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\blueprints\movement_engine_topology.md" /> (53 params)

**Superficie total de mutación: ~282 parámetros.**

---

## 0. EL PRINCIPIO RECTOR: GRAFTING, NO SURGERY

Antes de la UI, la decisión arquitectónica que lo sostiene todo.

### 0.1 El problema

Los motores están cerrados por diseño. `VibeId` es una unión literal cerrada:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\types\VibeProfile.ts" lines="18-18" />

```typescript
export type VibeId = 'idle' | 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge';
```

La tentación sería refactorizar `VibeId` a `string` y propagar el cambio por 30+ archivos.
**Eso es cirugía a corazón abierto sobre el core sagrado. Lo rechazamos.**

### 0.2 La solución: El Injerto (Grafting)

Todos los registries de motor son **lookups de Record con fallback**. Verificado uno por uno:

| Registry | Archivo | Firma real | ¿Injertable? |
|---|---|---|---|
| `VIBE_CONFIG` | `VibeMovementManager.ts:199` | `Record<string, VibeConfig>` | ✅ Sin cast |
| `STEREO_CONFIG` | `VibeMovementManager.ts:368` | `Record<string, StereoConfig>` | ✅ Sin cast |
| `MOVEMENT_PRESETS` | `VibeMovementPresets.ts:83` | `Record<string, MovementPreset>` | ✅ Sin cast |
| `PROFILE_REGISTRY` | `physics/profiles/index.ts` | `Record<string, ILiquidProfile>` | ✅ Sin cast |
| `TILT_OFFSET_BY_VIBE` | `VibeMovementManager.ts:189` | `Readonly<Record<string, number>>` | ⚠️ Cast (readonly sólo en TS) |
| `COLOR_CONSTITUTIONS` | `colorConstitutions.ts:490` | `Record<VibeId, GenerationOptions>` | ⚠️ Cast de clave |
| `VIBE_REGISTRY` | `vibe/profiles/index.ts:39` | `Record<VibeId, VibeProfile>` | ⚠️ Cast de clave |

Y los consumidores ya toleran claves desconocidas:

```typescript
// VibeMovementManager.ts:987
const config = VIBE_CONFIG[vibeId] || VIBE_CONFIG['idle']
// VibeMovementManager.ts:1112
const stereoConfig = STEREO_CONFIG[vibeId] || STEREO_CONFIG['idle']
// colorConstitutions.ts:505-506
export function getColorConstitution(vibeId: VibeId | string): GenerationOptions {
  return COLOR_CONSTITUTIONS[vibeId as VibeId] ?? IDLE_CONSTITUTION;
}
// VibeManager.ts:122
public setActiveVibe(vibeId: VibeId | string, frameCount?: number): boolean
```

**El hallazgo decisivo:** `VibeManager.setActiveVibe()` valida vía `normalizeVibeId()`, que
hace `if (vibeId in VIBE_REGISTRY) return vibeId as VibeId`
(<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\vibe\profiles\index.ts" lines="98-110" />).

Por tanto: **si injertamos la clave sintética en `VIBE_REGISTRY`, el pipeline entero
(Liquid + Color + Movement) la acepta sin una sola línea modificada en la lógica de motor.**

### 0.3 El contrato del injerto

```
.luxvibe (JSON de mutación)
    │  { baseDNA: 'techno-club', physics: {...}, color: {...}, movement: {...} }
    ▼
VibeFusionResolver.resolve(override)          ← NUEVO módulo puro, cero deps de React
    │  1. Lee las 7 configs canónicas de baseDNA
    │  2. Deep-merge de la capa sparse de override
    │  3. Valida contra SEALED_PARAMS + rangos
    ▼
FusedVibeBundle { key: 'custom:dubstep-a1b2', vibeProfile, liquidProfile,
                  colorConstitution, vibeConfig, stereoConfig,
                  movementPreset, tiltOffset }
    ▼
VibeGraftRegistry.graft(bundle)               ← NUEVO módulo, escribe en los 7 Records
    │
    ▼
VibeManager.setActiveVibe('custom:dubstep-a1b2')   ← API EXISTENTE, sin cambios
SeleneLux.setActiveProfile('custom:dubstep-a1b2')  ← API EXISTENTE, sin cambios
    │
    ▼
Los motores funcionan exactamente igual. No saben que el vibe es custom.
```

**Regla de oro:** el core nunca aprende el concepto "custom vibe". Sólo ve una clave más
en un Record que ya sabía leer. Todo el trabajo vive en dos módulos nuevos aislados.

### 0.4 Parámetros SELLADOS (nunca mutables)

Extraídos de los 3 blueprints. Estos **no aparecen en el tipo de override** y además se
validan en runtime. Son seguridad de hardware y de percepción humana.

| Parámetro | Valor | Dominio | Razón |
|---|---|---|---|
| `SAFETY_CAP.maxAcceleration` | 900 DMX/s² | Movement | Protege motores de todos los movers |
| `SAFETY_CAP.maxVelocity` | 400 DMX/s | Movement | Protege correas |
| `TILT_CEILING` | 0.15 | Movement | No apuntar al techo |
| `TILT_FLOOR_LIMIT` | 0.50 | Movement | No apuntar al horizonte trasero |
| `TILT_OFFSET_CEILING` | -0.325 | Movement | Centrado de semiesfera inferior |
| `GIMBAL_LOCK_EPSILON` | 50 mm | IK | Zona de singularidad blindada |
| `PAN_SAFETY_MARGIN` | 5 DMX | IK | Nunca golpear topes mecánicos |
| `GEARBOX_MIN_AMPLITUDE` | 0.10 | Movement | Floor del gearbox |
| `BPM_SMOOTH_FACTOR` | 0.05 | Movement | Estabilidad temporal |
| Phrase envelope range | [0.85, 1.00] | Movement | Identidad geométrica del patrón |
| EMA alphas | 0.98/0.02, 0.88/0.12 | Liquid | Tracking del envelope |
| Peak decay | 0.993/0.985/0.95 | Liquid | Adaptive gate |
| `RECOVERY_DURATION` | 250 | Liquid | Constante de hardware |
| `KICK_COOLDOWN_MS` | 150 | Liquid | Constante de hardware |
| `STALE_PEAK_THRESHOLD` | 15 | Liquid | Interno |
| `fadeZone` | 0.08 | Liquid | Anti-guillotine |
| `KEY_TO_HUE` (12) | fijo | Color | Mapeo sinestésico canónico |
| `MODE_MODIFIERS` (13) | fijo | Color | Modificadores de modo musical |
| `PHI_ROTATION` | 222.5° | Color | Constante áurea (el *default*; el override sí puede dar otro ángulo vía `fibonacciRotationDeg`) |

Además, un **guardarraíl duro de epilepsia**: `strobeThreshold` mutado nunca puede producir
> 12 Hz efectivos, y `maxHueShiftPerSecond` tiene techo. Se valida en el resolver, no en la UI.

---

## 1. LA VISIÓN UX/UI — "THE SYNESTHETIC SANDBOX"

### 1.1 Concepto rector

Cruce entre **panel de nave espacial** y **sintetizador modular**. El usuario no "edita
ajustes": **muta un genoma**. Cada control es un gen. Cada gen mutado brilla. El resto
permanece en gris ADN heredado.

El lenguaje visual reutiliza el sistema existente: CSS plano por componente + CSS custom
properties (`--accent-color`), Lucide icons, framer-motion — exactamente como
`TheProgrammer` y `PhysicsTuner`. **No se introduce Tailwind** (está en `package.json`
pero no se usa en componentes; respetamos la convención real).

### 1.2 Anatomía de la pantalla

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ⬡ THE HELIX BAR                                                             │
│  ┌────────────────┐  Nombre: [ Dubstep Cathedral        ]  ⬢ 47 mutaciones   │
│  │ DNA DONOR      │  Autor:  [ Raúl                     ]  ◆ SHIELDED ⇄ RAW  │
│  │ ▼ techno-club  │                                        [Revert] [Mint ⬇] │
│  └────────────────┘                                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│  [ ⚡ PHOTON PHYSICS ]  [ 🎨 CHROMATIC SPECTRUM ]  [ 🛰 KINETIC ORBIT ]        │
├───────────────────────────────────────────────┬──────────────────────────────┤
│                                               │                              │
│   THE MUTATION BENCH                          │   THE MUTATION SCOPE         │
│   (paneles del tab activo)                    │   (preview en vivo, canvas)  │
│                                               │                              │
│   ▾ THE SIX CHAMBERS                          │   ┌────────────────────────┐ │
│     ◈ SUB-BASS  [gate ▓▓▓░░] [boost ▓▓▓▓░]   │   │  7-zone rig monitor    │ │
│     ◈ KICK      [gate ▓▓░░░] [boost ▓▓▓░░]   │   │  ● ● ● ●   ◑ ◑         │ │
│     ◈ VOCAL     ...                           │   └────────────────────────┘ │
│                                               │   ┌────────────────────────┐ │
│   ▾ MORPHOLOGY                                │   │  Palette strip (5)     │ │
│     [morphFloor ◄──●────►  morphCeiling]      │   └────────────────────────┘ │
│                                               │   ┌────────────────────────┐ │
│   ▾ SIDECHAIN GUILLOTINE            🔒 RAW    │   │  Orbit trail (pan/tilt)│ │
│     ...                                       │   └────────────────────────┘ │
│                                               │   ⚠ 2 avisos de seguridad    │
└───────────────────────────────────────────────┴──────────────────────────────┘
```

### 1.3 El componente estrella: `<GeneSlider>`

Es el 80% de la UI. Un slider que sabe que es un gen mutable:

```
   PERC BOOST                                    ⟲          ← revert al ADN base
   ├──────────────●───────────────────┤   [ 4.20 ]
   ╎              ╎                   ╎
   ╎          ▲ base 3.10             ╎          ← fantasma del valor heredado
   └ 0.0                          10.0 ┘
   ░░░░░░░░░░░░░░░░░░░░░████████████░░           ← banda roja = zona de riesgo
```

**Estados visuales:**

| Estado | Aspecto |
|---|---|
| `inherited` | Track gris, sin glow. El valor es el del `baseDNA`. |
| `mutated` | Track con `--accent-color` del tab, glow neón, badge ⬢, botón ⟲ visible |
| `danger` | Zona del track en rojo. Cruzarla dispara un toast de advertencia (no bloquea) |
| `sealed` | Candado, disabled, tooltip explicando por qué es intocable |
| `locked-by-basic` | Oculto en modo SHIELDED, revelado en RAW |

El "fantasma del valor base" es la clave de la sensación de mutación: siempre ves de dónde
vienes.

### 1.4 The Safety Interlock (Basic vs Advanced)

Un toggle físico de dos posiciones en la Helix Bar, no un checkbox:

```
   ◆ SHIELDED  ⇄  RAW REACTOR
```

| Modo | Qué expone | Público |
|---|---|---|
| **SHIELDED** (default) | Sólo los ~65 parámetros marcados `UI Safe` en los 3 blueprints. Agrupados en macro-controles semánticos. | Usuario medio. Imposible romper la física. |
| **RAW REACTOR** | Los ~282 parámetros, incluidos cross-filters, squelch anti-autotune, safe-harbor phases, calibración IK. | Power user. Confirmación modal la primera vez ("estás manipulando la gravedad de los fotones"). |

En SHIELDED aparecen además **Macro Genes**: un solo slider que mueve varios parámetros
correlacionados con una curva predefinida. Ejemplo:

| Macro Gene | Mueve por debajo |
|---|---|
| **AGGRESSION** | `percBoost` ↑, `percGate` ↓, `decayBase` ↓, `snapFactor` ↑, `friction` ↓ |
| **VISCOSITY** | `ambientAttackMs` ↑, `ambientReleaseMs` ↑, `friction` ↑, `smoothFactor` ↑, `transitionBeats` ↑ |
| **THERMAL BIAS** | `atmosphericTemp` + `thermalGravityStrength` en curva conjunta |
| **SPATIAL REACH** | `panScale` + `tiltScale` + `fanAmplitude` |
| **NERVOUSNESS** | `cycleBeats` ↓, `phraseDuration` ↓, `globalSpeedMultiplier` ↑ |

Los Macro Genes escriben en el mismo documento de override; al pasar a RAW ves exactamente
qué genes movieron.

### 1.5 Los tres tabs

#### TAB 1 — ⚡ PHOTON PHYSICS (`--accent-color: #00e5ff` cian)

Metáfora: **rack de sintetizador modular**. Cada envelope es un módulo con su faceplate.

| Panel | Nombre temático | Contenido |
|---|---|---|
| Envelopes | **THE SIX CHAMBERS** | 6 bahías (SubBass, Kick, Vocal, Snare, HighMid, Treble). Cada una es un `<EnvelopeBay>` colapsable con visualización ADSR en vivo. 17 params c/u. |
| Morph | **MORPHOLOGY** | `<TwinGeneSlider>` para morphFloor/morphCeiling con una barra que muestra la posición actual del morphFactor en tiempo real |
| Transient | **THE SCHWARZENEGGER** | percMidSubtract, percGate, percBoost, percExponent + preview de la curva |
| Cross-filters | **THE SEPARATION MATRIX** | Back L, Mover L, Mover R. Grid de pesos de banda estilo mixer |
| Sidechain | **THE GUILLOTINE** | threshold, depth, snareDepth, auraCap. Visualizador de ducking |
| Strobe | **THE FLASH GATE** | threshold, duration, noiseDiscount. Guardarraíl de epilepsia visible |
| Modes | **ACID / NOISE / APOCALYPSE** | 4 thresholds con LEDs que se encienden cuando el modo dispara |
| Kick | **THE METRONOME** | kickEdgeMinInterval, kickVetoFrames |
| Ambient | **VISCOSITY** | attackMs, releaseMs, midWeight, gain |
| Routing | **THE ROUTING BAY** | layout41Strategy, isPureAmbient |
| 4.1 | **THE COMPACT MIRROR** | Panel colapsable con overrides41 (sólo RAW) |

#### TAB 2 — 🎨 CHROMATIC SPECTRUM (`--accent-color: #ff2fd0` magenta)

Metáfora: **mesa de astronavegación cromática**. La pieza central es una rueda de 360°.

| Panel | Nombre temático | Contenido |
|---|---|---|
| Rueda | **THE FORBIDDEN WHEEL** | `<ChromaticWheel>` — rueda HSL 360° donde se pintan arcos rojos (forbidden) y verdes (allowed) arrastrando. El corazón del tab. |
| Gravedad | **THERMAL GRAVITY** | atmosphericTemp (slider Kelvin con gradiente real) + strength. Overlay en la rueda con un **vector de arrastre animado** hacia el polo |
| Remapping | **THE TRANSMUTATION TABLE** | Tabla editable from→to→target con preview de swatch |
| S/L | **THE LUMINANCE GATE** | saturationRange + lightnessRange como dual-sliders sobre un gradiente real |
| Sanitizado | **MUD GUARD / NEON PROTOCOL** | Toggles + config. Preview del "antes/después" de un color en la danger zone |
| Estrategia | **THE HARMONY ENGINE** | forceStrategy (radio), tropicalMirror, ambientLock, fibonacciRotationDeg con un diagrama de la rueda mostrando dónde caen secondary/accent/ambient |
| Accent | **THE ACCENT REACTOR** | accentBehavior + su sub-config (strobeColor / solarFlare / snareFlash / pulseConfig) |
| Transiciones | **THE GLACIER** | min/max duration, easing, dimming floor/ceiling |
| Sidereal | **THE SIDEREAL CAROUSEL** | Editor de slots en línea de tiempo circular. Cada slot es un arco de la rueda con su duración |
| Oceánico | **THE ABYSS** | oceanicModulation (sólo RAW; auto-visible si baseDNA = chill) |

#### TAB 3 — 🛰 KINETIC ORBIT (`--accent-color: #ffb020` ámbar)

Metáfora: **consola de control orbital**. Pieza central: preview de trayectoria animada.

| Panel | Nombre temático | Contenido |
|---|---|---|
| Patrones | **THE ORBIT VAULT** | Grid de los 16 patrones con **thumbnail animado en vivo** de cada trayectoria. Multi-select + drag para reordenar la rotación del scheduler |
| Por patrón | **THE SCHEDULER DECK** | Por patrón seleccionado: cycleBeats, phraseDuration, transitionBeats (+ safeHarbor en RAW). Valida el invariante `phraseDuration = N × cycleBeats` con snap automático |
| Amplitud | **THE REACH** | panScale, tiltScale, tiltOffset con preview del arco barrido sobre una silueta de escenario |
| Simetría | **THE ENSEMBLE** | stereo type (sync/snake/mirror) + offset. Preview con 6 fixtures fantasma mostrando la ola |
| Física | **THE GEARBOX** | physicsMode, maxVelocity, maxAcceleration, friction, snapFactor, revLimits. Reutiliza el lenguaje visual de `PhysicsTuner` (indicadores de riesgo) |
| Óptica | **THE LENS** | zoom/focus default + ranges con preview del haz |
| Conducta | **THE INSTINCT** | homeOnSilence, syncToBeat, allowRandomPos, smoothFactor |
| Espacial | **THE FAN ARRAY** | fanMode (converge/line/circle) + amplitude, con vista cenital del escenario |

### 1.6 The Mutation Scope (preview lateral, siempre visible)

Tres canvas apilados que **no re-renderizan React** (ver §3.4):

1. **Rig Monitor** — 7 zonas (frontL/R, backL/R, moverL/R, strobe) pulsando con el
   `LiquidStereoResult` real.
2. **Palette Strip** — los 5 colores (primary, secondary, accent, ambient, contrast) en vivo.
3. **Orbit Trail** — traza pan/tilt de los últimos 3 segundos con estela.

Debajo, **The Diagnostics Rail**: contador de mutaciones, avisos de seguridad, y un botón
`A/B` que alterna entre ADN base y mutación para comparar al instante.

### 1.7 Inventario de componentes nuevos (nombres definitivos)

| Componente | Rol |
|---|---|
| `VibeLabView` | Contenedor raíz de la vista |
| `HelixBar` | Cabecera: DNA donor, nombre, autor, interlock, acciones |
| `DnaDonorSelector` | Selector de `baseDNA` (5 canónicos) |
| `SafetyInterlock` | Toggle SHIELDED ⇄ RAW |
| `MutationBench` | Panel izquierdo, hospeda los tabs |
| `GenomeTabs` | Las 3 pestañas |
| `GenePanel` | Sección colapsable (envuelve el patrón `Accordion` existente) |
| `GeneSlider` | Slider mutable con fantasma base + zona de riesgo + revert |
| `TwinGeneSlider` | Dual-slider para rangos (min/max) |
| `GeneToggle` | Booleano mutable |
| `GeneSegmented` | Enum como botones segmentados (patrón de `SystemsCheck`) |
| `GeneNumberField` | Entrada numérica precisa |
| `MacroGeneDial` | Macro control (modo SHIELDED) |
| `ChromaticWheel` | Rueda 360° con arcos forbidden/allowed |
| `ThermalVector` | Overlay del vector de gravedad térmica |
| `EnvelopeBay` | Módulo de un envelope (17 params + curva ADSR) |
| `OrbitVault` | Grid de patrones con thumbnails animados |
| `OrbitThumbnail` | Canvas de una trayectoria |
| `SiderealCarousel` | Editor de slots temporales |
| `TransmutationTable` | Tabla de hueRemapping |
| `MutationScope` | Panel derecho de preview |
| `RigMonitorCanvas` | Canvas de 7 zonas |
| `PaletteStripCanvas` | Canvas de 5 colores |
| `OrbitTrailCanvas` | Canvas de traza pan/tilt |
| `DiagnosticsRail` | Contador + avisos + A/B |
| `GenomeVault` | Biblioteca de vibes custom (patrón `UniversalAssetBrowser`) |
| `MintDialog` | Diálogo de exportación a `.luxvibe` |

---

## 2. EL CÓDIGO GENÉTICO — TypeScript

**Ubicación:** `src/types/CustomVibe.ts` (nuevo, cero dependencias, importable desde
main y renderer).

### 2.1 Principios de tipado

1. **Todo override es opcional.** El documento es una capa *sparse*. Ausente = heredado.
2. **`DeepPartial` explícito, no genérico mágico.** Cada nivel se declara para que el
   autocompletado del IDE sea útil y el agente ejecutor no invente campos.
3. **Los parámetros SELLADOS no existen en el tipo.** Imposible escribirlos por accidente.
4. **`readonly` en el documento persistido**, mutable sólo en el borrador del store.
5. **Versionado desde el día 1** (`schemaVersion`) para migraciones futuras.

### 2.2 Documento raíz

```typescript
import type { VibeId } from './VibeProfile'

/** Versión del esquema .luxvibe. Incrementar ante cambios incompatibles. */
export const LUXVIBE_SCHEMA_VERSION = 1 as const

/** Identificador de un vibe custom. Formato: `custom:<slug>-<hash6>` */
export type CustomVibeKey = `custom:${string}`

/** Los 4 donantes de ADN válidos (idle excluido: no es un género). */
export type BaseDNA = Extract<VibeId, 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge'>

export interface CustomVibeMeta {
  /** Clave sintética estable, generada al crear. Nunca cambia. */
  readonly key: CustomVibeKey
  /** Nombre visible. Editable. */
  name: string
  /** Descripción libre. */
  description: string
  /** Emoji o nombre de icono Lucide. */
  icon: string
  /** Autor declarado por el usuario. */
  author: string
  /** Epoch ms. */
  readonly createdAt: number
  updatedAt: number
  /** Etiquetas libres para el GenomeVault: ['dubstep', 'heavy', 'club']. */
  tags: string[]
  /** Color de acento para la tarjeta en la biblioteca (hex). */
  accentHex: string
}

/**
 * EL DOCUMENTO .luxvibe
 *
 * Una mutación sparse sobre un ADN canónico. Sólo contiene lo que difiere.
 * El resolver reconstruye las 7 configs de motor fusionando base + esta capa.
 */
export interface CustomVibeOverride {
  readonly schemaVersion: typeof LUXVIBE_SCHEMA_VERSION
  readonly kind: 'luxvibe'
  meta: CustomVibeMeta

  /** El genoma del que hereda. Cambiarlo re-basa todas las mutaciones. */
  baseDNA: BaseDNA

  /** Capa de mutación del motor OmniLiquid (física de fotones). */
  physics?: PhysicsOverride
  /** Capa de mutación del motor Selene Color. */
  color?: ColorOverride
  /** Capa de mutación del VMM + presets de movimiento. */
  movement?: MovementOverride

  /** Valores de los Macro Genes (modo SHIELDED), 0..1. Sólo informativo:
   *  su efecto ya está materializado en las capas de arriba. */
  macros?: Partial<Record<MacroGeneId, number>>
}

export type MacroGeneId =
  | 'aggression'
  | 'viscosity'
  | 'thermalBias'
  | 'spatialReach'
  | 'nervousness'
```

### 2.3 Capa PHYSICS (OmniLiquid — ~180 params)

```typescript
/** Los 17 parámetros de un LiquidEnvelope. Todos opcionales. */
export interface EnvelopeOverride {
  gateOn?: number                          // 0.0 – 1.0
  boost?: number                           // 0.0 – 20.0
  crushExponent?: number                   // 0.1 – 5.0
  decayBase?: number                       // 0.0 – 1.0
  decayRange?: number                      // 0.0 – 1.0
  maxIntensity?: number                    // 0.0 – 1.0
  squelchBase?: number                     // 0.0 – 1.0
  squelchSlope?: number                    // 0.0 – 1.0
  ghostCap?: number                        // 0.0 – 1.0
  gateMargin?: number                      // 0.0 – 0.5
  attackSlopeMin?: number                  // -0.1 – 0.5
  riseRate?: number                        // 0.0 – 1.0
  sustainedSquelchStartFrames?: number     // 0 – 9999
  sustainedSquelchRisePerFrame?: number    // 0.0 – 0.1
  sustainedSquelchMaxBoost?: number        // 0.0 – 1.0
  sustainedFlatVelocityMax?: number        // 0.0 – 1.0
  adaptiveNoiseAlpha?: number              // 0.0 – 1.0
}

/** Las 6 cámaras. */
export type EnvelopeSlot =
  | 'envelopeSubBass'
  | 'envelopeKick'
  | 'envelopeVocal'
  | 'envelopeSnare'
  | 'envelopeHighMid'
  | 'envelopeTreble'

export interface PhysicsOverride {
  /** THE SIX CHAMBERS */
  envelopes?: Partial<Record<EnvelopeSlot, EnvelopeOverride>>

  /** THE SCHWARZENEGGER — transient shaper (Back R) */
  transient?: {
    percMidSubtract?: number   // 0.0 – 5.0
    percGate?: number          // 0.0 – 0.5
    percBoost?: number         // 0.0 – 10.0
    percExponent?: number      // 0.1 – 3.0
  }

  /** THE SEPARATION MATRIX — cross-filters */
  separation?: {
    /** Mover R (voces) — bass subtractor adaptativo */
    bassSubtractBase?: number    // 0.0 – 1.0
    bassSubtractRange?: number   // 0.0 – 1.0
    moverRTrebleSub?: number     // -1.0 – 1.0 (negativo inyecta)
    /** Back L (mid synths) */
    backLLowMidWeight?: number   // 0.0 – 2.0
    backLMidWeight?: number      // 0.0 – 2.0
    backLTrebleSub?: number      // -1.0 – 1.0
    backLBassSub?: number        // 0.0 – 1.0
    /** Mover L (melodías) */
    moverLHighMidWeight?: number // 0.0 – 3.0
    moverLTrebleWeight?: number  // 0.0 – 2.0
    moverLMidWeight?: number     // 0.0 – 2.0
    moverLTonalThreshold?: number// 0.0 – 1.0
  }

  /** THE GUILLOTINE — sidechain */
  sidechain?: {
    sidechainThreshold?: number           // 0.0 – 999.0
    sidechainDepth?: number               // 0.0 – 1.0
    snareSidechainDepth?: number          // 0.0 – 1.0
    frontKickSidechainThreshold?: number  // 0.0 – 1.0
    auraCapBase?: number                  // 0.0 – 1.0
    auraCapExponent?: number              // 0.0 – 5.0
  }

  /** THE FLASH GATE */
  strobe?: {
    strobeThreshold?: number      // 0.0 – 999.0
    strobeDuration?: number       // 1 – 1000 ms
    strobeNoiseDiscount?: number  // 0.0 – 1.0
  }

  /** ACID / NOISE / APOCALYPSE */
  modes?: {
    harshnessAcidThreshold?: number  // 0.0 – 1.0
    flatnessNoiseThreshold?: number  // 0.0 – 1.0
    apocalypseHarshness?: number     // 0.0 – 1.0
    apocalypseFlatness?: number      // 0.0 – 1.0
  }

  /** MORPHOLOGY — invariante: morphFloor < morphCeiling */
  morph?: {
    morphFloor?: number    // 0.0 – 1.0
    morphCeiling?: number  // 0.0 – 1.0
  }

  /** THE METRONOME */
  kick?: {
    kickEdgeMinInterval?: number  // 1 – 999999 ms
    kickVetoFrames?: number       // 0 – 20
  }

  /** VISCOSITY — ambient EMA */
  ambient?: {
    ambientAttackMs?: number   // 1 – 10000
    ambientReleaseMs?: number  // 1 – 60000
    ambientMidWeight?: number  // 0.0 – 2.0
    ambientGain?: number       // 0.0 – 5.0
  }

  /** THE ROUTING BAY */
  routing?: {
    layout41Strategy?: 'default' | 'strict-split'
    isPureAmbient?: boolean
  }

  /** THE COMPACT MIRROR — overrides específicos de layout 4.1.
   *  Recursivo pero sin `overrides41` anidado (no tiene sentido). */
  overrides41?: Omit<PhysicsOverride, 'overrides41'>
}
```

### 2.4 Capa COLOR (Selene Color Engine — 49 params)

```typescript
/** Rango angular en el círculo cromático. Grados 0–360. */
export type HueRange = readonly [start: number, end: number]

/** Rango genérico min/max. */
export type MinMax = readonly [min: number, max: number]

export interface HslTriplet { h: number; s: number; l: number }
export interface RgbTriplet { r: number; g: number; b: number }

export interface HueRemapRule {
  /** Inicio del rango origen (grados). */
  from: number
  /** Fin del rango origen (grados). */
  to: number
  /** Hue destino (grados). */
  target: number
}

export interface SiderealSlot {
  /** Etiqueta para debug/UI: 'BUNKER', 'APEX'... */
  label: string
  allowedHueRanges: HueRange[]
  lightnessRange?: MinMax
}

export type ColorStrategyOverride = 'analogous' | 'triadic' | 'complementary' | 'prism'

export type AccentBehavior =
  | 'strobe'
  | 'drum-reactive'
  | 'solar-flare'
  | 'breathing'
  | 'quaternary'

export interface ColorOverride {
  /** THE FORBIDDEN WHEEL */
  hue?: {
    forbiddenHueRanges?: HueRange[]
    allowedHueRanges?: HueRange[]
    elasticRotation?: number       // 1 – 90 grados por iteración
    hueRemapping?: HueRemapRule[]
  }

  /** THERMAL GRAVITY */
  thermal?: {
    atmosphericTemp?: number         // 2000 – 10000 K
    thermalGravityStrength?: number  // 0.0 – 1.0
  }

  /** THE LUMINANCE GATE */
  luminance?: {
    saturationRange?: MinMax   // 0 – 100
    lightnessRange?: MinMax    // 0 – 100
  }

  /** MUD GUARD */
  mudGuard?: {
    enabled?: boolean
    swampZone?: HueRange
    minLightness?: number      // 0 – 100
    minSaturation?: number     // 0 – 100
  }

  /** NEON PROTOCOL */
  neonProtocol?: {
    enabled?: boolean
    dangerZone?: HueRange
    minSaturation?: number     // 0 – 100
    minLightness?: number      // 0 – 100
    fallbackToWhite?: boolean
  }

  /** THE HARMONY ENGINE */
  harmony?: {
    /** Si se define, blinda la estrategia frente al StrategyArbiter. */
    forceStrategy?: ColorStrategyOverride
    tropicalMirror?: boolean
    tropicalAmbientBias?: boolean
    suppressTropicalBias?: boolean
    ambientLock?: HslTriplet
    /** Ángulo de rotación del secundario. Default del motor ≈ 222.5° (PHI). */
    fibonacciRotationDeg?: number    // 0 – 360
    /** root (0–11) → delta en grados */
    saltChromaticKeys?: Record<number, number>
    /** root (0–11) → signature de hue */
    luxurySignatures?: Record<number, { h: number; maxS?: number }>
  }

  /** THE ACCENT REACTOR */
  accent?: {
    accentBehavior?: AccentBehavior
    strobeProhibited?: boolean
    strobeColor?: RgbTriplet
    solarFlareAccent?: HslTriplet
    snareFlash?: HslTriplet
    kickPunch?: { usesPrimary?: boolean; l?: number }
    pulseConfig?: { duration?: number; amplitude?: number }
  }

  /** THE GLACIER */
  transitions?: {
    minDuration?: number   // 1 – 60000 ms
    maxDuration?: number   // 1 – 60000 ms
    easing?: 'linear' | 'ease-in' | 'ease-out' | 'sine-inout'
  }

  /** Dimming general */
  dimming?: {
    floor?: number    // 0.0 – 1.0
    ceiling?: number  // 0.0 – 1.0
  }

  /** THE SIDEREAL CAROUSEL */
  siderealClock?: {
    enabled?: boolean
    slotDurationMs?: number   // 1000 – 3600000
    slots?: SiderealSlot[]
  }

  /** THE ABYSS — normalmente inyectado dinámicamente por TitanEngine para chill.
   *  Exponerlo permite oceanografía en vibes no-chill. Sólo RAW. */
  oceanicModulation?: {
    enabled?: boolean
    hueInfluence?: number          // 0 – 360
    hueInfluenceStrength?: number  // 0.0 – 1.0
    saturationMod?: number         // -30 – +30
    lightnessMod?: number          // -20 – +20
    breathingFactor?: number       // 0.85 – 1.15
  }
}
```

### 2.5 Capa MOVEMENT (VMM + IK — 53 params)

```typescript
/** Los 16 patrones de la Docena Dorada + Four Nobles. */
export type GoldenPatternId =
  // TECHNO
  | 'scan_x' | 'square' | 'diamond' | 'botstep' | 'darkspin'
  | 'laser_grid' | 'industrial_pendulum'
  // LATINO
  | 'figure8' | 'wave_y' | 'ballyhoo' | 'cadera_libre' | 'espiral_conga'
  // POP-ROCK
  | 'circle_big' | 'cancan' | 'dual_sweep'
  // CHILL
  | 'drift' | 'sway' | 'breath'
  // FOUR NOBLES
  | 'slow_pan' | 'tilt_nod' | 'figure_of_4' | 'chase_position'

/** Override del scheduler para UN patrón. */
export interface PatternSchedulerOverride {
  cycleBeats?: number        // 8 – 512
  /** Invariante: múltiplo entero de cycleBeats. El resolver hace snap. */
  phraseDuration?: number    // 16 – 1024
  transitionBeats?: number   // 1 – 8
  safeHarborPhase?: number   // 0 – 2π rad        (RAW)
  safeHarborWindow?: number  // 0 – π rad         (RAW)
  hardDeadlineExtra?: number // 8 – 128 beats     (RAW)
}

export interface MovementOverride {
  /** THE ORBIT VAULT + THE REACH — equivalente a VIBE_CONFIG */
  kinematics?: {
    /** Lista ordenada de patrones. El orden define la rotación del scheduler. */
    patterns?: GoldenPatternId[]
    panScale?: number        // 0.0 – 1.0
    tiltScale?: number       // 0.0 – 1.0
    baseFrequency?: number   // 0.0 – 1.0  (legacy)   (RAW)
    homeOnSilence?: boolean
  }

  /** THE SCHEDULER DECK — por patrón */
  scheduler?: Partial<Record<GoldenPatternId, PatternSchedulerOverride>>

  /** THE ENSEMBLE — equivalente a STEREO_CONFIG */
  stereo?: {
    type?: 'sync' | 'snake' | 'mirror'
    offset?: number   // 0 – π rad
  }

  /** Audience bias. Sólo aplica a montaje 'floor'; ceiling/totem están SELLADOS. */
  tiltOffset?: number   // -0.50 – 0.0

  /** THE GEARBOX — equivalente a MovementPhysics del preset */
  physics?: {
    physicsMode?: 'snap' | 'classic'
    /** Capado en runtime por SAFETY_CAP (900). */
    maxAcceleration?: number     // 6 – 900 DMX/s²
    /** Capado en runtime por SAFETY_CAP (400). */
    maxVelocity?: number         // 12 – 400 DMX/s
    friction?: number            // 0.0 – 1.0
    arrivalThreshold?: number    // 0.5 – 8.0 DMX     (RAW)
    snapFactor?: number          // 0.0 – 1.0
    revLimitPanPerSec?: number   // 15 – 300 DMX/s
    revLimitTiltPerSec?: number  // 10 – 240 DMX/s
  }

  /** THE LENS — equivalente a OpticsConfig */
  optics?: {
    zoomDefault?: number       // 0 – 255
    zoomRange?: MinMax         // 0 – 255
    focusDefault?: number      // 0 – 255
    focusRange?: MinMax        // 0 – 255
    irisDefault?: number       // 0 – 255           (RAW)
  }

  /** THE INSTINCT — equivalente a MovementBehavior */
  behavior?: {
    homeOnSilence?: boolean
    syncToBeat?: boolean
    allowRandomPos?: boolean
    smoothFactor?: number      // 0.0 – 1.0
  }

  /** THE FAN ARRAY — targeting espacial IK */
  spatial?: {
    fanMode?: 'converge' | 'line' | 'circle'
    fanAmplitude?: number      // 0 – 10 metros
  }

  /** Defaults globales de la IA para este vibe. */
  grandMaster?: {
    globalSpeedMultiplier?: number  // 0.1 – 2.0
    globalChaosAmount?: number      // 0.0 – 1.0
  }
}
```

### 2.6 El bundle fusionado y el resolver

```typescript
import type { VibeProfile } from './VibeProfile'
import type { GenerationOptions } from '../engine/color/SeleneColorEngine'
import type { ILiquidProfile } from '../hal/physics/profiles/ILiquidProfile'
import type { MovementPreset } from '../engine/movement/VibeMovementPresets'

/** Config del VMM (espejo del `VibeConfig` interno, no exportado por el VMM). */
export interface GraftableVibeConfig {
  panScale: number
  tiltScale: number
  baseFrequency: number
  patterns: GoldenPatternId[]
  homeOnSilence: boolean
}

export interface GraftableStereoConfig {
  offset: number
  type: 'sync' | 'snake' | 'mirror'
}

/**
 * Resultado del resolver: las 7 configs canónicas ya fusionadas,
 * listas para ser injertadas en los registries de motor.
 */
export interface FusedVibeBundle {
  readonly key: CustomVibeKey
  readonly baseDNA: BaseDNA
  vibeProfile: VibeProfile              // → VIBE_REGISTRY
  liquidProfile: ILiquidProfile         // → PROFILE_REGISTRY
  colorConstitution: GenerationOptions  // → COLOR_CONSTITUTIONS
  vibeConfig: GraftableVibeConfig       // → VIBE_CONFIG
  stereoConfig: GraftableStereoConfig   // → STEREO_CONFIG
  movementPreset: MovementPreset        // → MOVEMENT_PRESETS
  tiltOffset: number                    // → TILT_OFFSET_BY_VIBE
}

export interface ResolveDiagnostic {
  severity: 'info' | 'warn' | 'error'
  /** Ruta del gen: 'physics.envelopes.envelopeKick.boost' */
  path: string
  message: string
  /** Valor solicitado y valor finalmente aplicado tras clamp/snap. */
  requested?: number | string
  applied?: number | string
}

export interface ResolveResult {
  bundle: FusedVibeBundle | null
  diagnostics: ResolveDiagnostic[]
  /** false si hubo al menos un diagnostic de severidad 'error'. */
  ok: boolean
}
```

**Firma del resolver** (`src/engine/vibe/custom/VibeFusionResolver.ts`, función pura):

```typescript
export function resolveCustomVibe(doc: CustomVibeOverride): ResolveResult
```

Responsabilidades, en orden:

1. Cargar las 7 configs canónicas de `doc.baseDNA` desde los registries existentes.
2. **Deep clone** (nunca mutar el canónico — son singletons compartidos).
3. Deep-merge de la capa sparse. Arrays se **reemplazan**, no se concatenan.
4. Rechazar cualquier clave presente en `SEALED_PARAMS` → diagnostic `error`.
5. Clampear cada número a su rango declarado → diagnostic `warn` si se clampeó.
6. Aplicar invariantes cruzados → diagnostic `warn` + auto-corrección:
   - `morphFloor < morphCeiling`
   - `phraseDuration = N × cycleBeats` (snap al múltiplo más cercano)
   - `saturationRange[0] ≤ saturationRange[1]` (íd. lightness, zoom, focus)
   - `transitions.minDuration ≤ maxDuration`
   - `dimming.floor ≤ ceiling`
   - `patterns.length ≥ 1` (si vacío → hereda del base)
   - Epilepsia: strobe efectivo ≤ 12 Hz
7. Recalcular `overrides41` fusionando sobre la capa base ya fusionada.
8. Devolver el bundle + diagnostics.

**Firma del injertador** (`src/engine/vibe/custom/VibeGraftRegistry.ts`):

```typescript
/** Escribe el bundle en los 7 registries. Idempotente. */
export function graft(bundle: FusedVibeBundle): void
/** Elimina la clave de los 7 registries. */
export function ungraft(key: CustomVibeKey): void
/** Lista de claves custom actualmente injertadas. */
export function listGrafted(): CustomVibeKey[]
```

Las 3 escrituras que requieren cast documentado (los otros 4 son `Record<string, …>`):

```typescript
;(VIBE_REGISTRY as Record<string, VibeProfile>)[bundle.key] = bundle.vibeProfile
;(COLOR_CONSTITUTIONS as Record<string, GenerationOptions>)[bundle.key] = bundle.colorConstitution
;(TILT_OFFSET_BY_VIBE as Record<string, number>)[bundle.key] = bundle.tiltOffset
```

> **Nota de honestidad técnica:** estos 3 casts son la *única* concesión al core. Son
> escrituras a objetos que en runtime siempre fueron mutables (`Readonly<>` y
> `Record<VibeId,…>` son anotaciones de compilación, no `Object.freeze`). Si se prefiere
> tolerancia cero a casts, la alternativa es exportar tres setters `registerVibe(key, v)`
> desde cada módulo: 3 funciones nuevas de 1 línea, cero cambios de lógica. Recomiendo
> esta segunda vía si el equipo quiere el core formalmente cerrado.

---

## 3. STATE MANAGEMENT — Zustand

**Ubicación:** `src/stores/vibeLabStore.ts` (nuevo).

### 3.1 El problema de rendimiento

Hay dos flujos con frecuencias incompatibles:

| Flujo | Frecuencia | Consumidor | ¿React re-render? |
|---|---|---|---|
| **Edición** (usuario arrastra un slider) | ~60 Hz durante el drag, 0 Hz en reposo | Panel de controles | Sí, pero sólo el control tocado |
| **Telemetría** (motor emite resultado) | 44–60 Hz continuo, para siempre | Mutation Scope | **NUNCA** |

Meter la telemetría en Zustand haría re-renderizar el árbol 60 veces por segundo con
~282 controles montados. Inaceptable. **Por eso se separan en dos canales.**

### 3.2 Arquitectura de dos canales

```
CANAL A — EDICIÓN (Zustand, baja frecuencia)
  GeneSlider onChange
      └─► vibeLabStore.setGene(path, value)      [immer, sparse write]
              ├─► draft actualizado → re-render SOLO del control (selector por path)
              └─► scheduleSync()                  [coalescido por rAF]
                      └─► resolveCustomVibe(draft) → graft() → engine

CANAL B — TELEMETRÍA (fuera de React, alta frecuencia)
  Engine tick 60 Hz
      └─► IPC 'lux:vibe-lab:telemetry'
              └─► VibeLabTelemetryBus  (singleton, Float32Array + listeners)
                      └─► rAF loop en cada canvas lee el buffer y pinta
                          (cero setState, cero re-render)
```

### 3.3 El store

```typescript
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export type GenomeTab = 'physics' | 'color' | 'movement'
export type InterlockMode = 'shielded' | 'raw'

/** Ruta con puntos dentro del documento: 'physics.envelopes.envelopeKick.boost' */
export type GenePath = string

interface VibeLabState {
  // ── DOCUMENTO ─────────────────────────────────────────────
  /** null = no hay sesión de edición abierta. */
  draft: CustomVibeOverride | null
  /** Snapshot del último estado guardado, para dirty-check y descarte. */
  pristine: CustomVibeOverride | null
  isDirty: boolean

  // ── UI ────────────────────────────────────────────────────
  activeTab: GenomeTab
  interlock: InterlockMode
  /** Paneles abiertos por id, por tab. */
  expandedPanels: Record<GenomeTab, string[]>
  /** Envelope seleccionado en THE SIX CHAMBERS. */
  focusedEnvelope: EnvelopeSlot | null
  /** Patrón seleccionado en THE ORBIT VAULT. */
  focusedPattern: GoldenPatternId | null

  // ── PREVIEW ───────────────────────────────────────────────
  /** Si false, las ediciones no se envían al motor (modo offline). */
  livePreview: boolean
  /** A/B: 'mutation' aplica el draft, 'base' aplica el baseDNA puro. */
  abMode: 'mutation' | 'base'
  /** Diagnostics del último resolve. */
  diagnostics: ResolveDiagnostic[]
  /** Nº de genes mutados (derivado, cacheado en cada write). */
  mutationCount: number

  // ── BIBLIOTECA ────────────────────────────────────────────
  vault: CustomVibeMeta[]
  vaultLoading: boolean

  // ── ACCIONES: sesión ──────────────────────────────────────
  beginSession: (baseDNA: BaseDNA, name: string) => void
  openFromVault: (key: CustomVibeKey) => Promise<void>
  closeSession: (discard: boolean) => void
  rebase: (newBase: BaseDNA, keepMutations: boolean) => void

  // ── ACCIONES: genes ───────────────────────────────────────
  /** Escribe un gen. `undefined` borra el override (vuelve a heredar). */
  setGene: (path: GenePath, value: unknown) => void
  revertGene: (path: GenePath) => void
  revertPanel: (pathPrefix: string) => void
  revertAll: () => void
  applyMacro: (id: MacroGeneId, value: number) => void

  // ── ACCIONES: meta ────────────────────────────────────────
  setMeta: (patch: Partial<CustomVibeMeta>) => void

  // ── ACCIONES: UI ──────────────────────────────────────────
  setTab: (tab: GenomeTab) => void
  setInterlock: (mode: InterlockMode) => void
  togglePanel: (tab: GenomeTab, panelId: string) => void
  setFocusedEnvelope: (slot: EnvelopeSlot | null) => void
  setFocusedPattern: (p: GoldenPatternId | null) => void

  // ── ACCIONES: preview ─────────────────────────────────────
  setLivePreview: (on: boolean) => void
  setAbMode: (m: 'mutation' | 'base') => void
  /** Fuerza un resolve+graft inmediato (usado por el rAF coalescer). */
  flushToEngine: () => void

  // ── ACCIONES: persistencia ────────────────────────────────
  loadVault: () => Promise<void>
  mint: () => Promise<{ ok: boolean; path?: string; error?: string }>
  deleteFromVault: (key: CustomVibeKey) => Promise<void>
  duplicate: (key: CustomVibeKey) => Promise<CustomVibeKey | null>
  importFromFile: () => Promise<boolean>
  exportToFile: (key: CustomVibeKey) => Promise<boolean>
}

export const useVibeLabStore = create<VibeLabState>()(
  subscribeWithSelector(
    immer((set, get) => ({ /* … */ }))
  )
)
```

**Por qué este stack de middleware:**
- `immer` — ya es dependencia (`package.json:34`). Imprescindible: `setGene` escribe en
  rutas profundas de 4 niveles (`physics.envelopes.envelopeKick.boost`) sobre una
  estructura sparse donde los objetos intermedios pueden no existir.
- `subscribeWithSelector` — patrón ya usado en `stageStore`, `programmerStore`,
  `sceneStore`. Permite que el coalescer de rAF se suscriba a `draft` sin montar
  un componente React.
- **`persist` deliberadamente NO se usa.** La biblioteca vive en disco vía IPC
  (`userData/vibes/`), igual que `libraryStore` y las shows. localStorage no es
  el sitio para artefactos exportables del usuario.

### 3.4 Selectores de alta granularidad

Regla dura para el agente ejecutor: **un `GeneSlider` jamás se suscribe al `draft` entero.**

```typescript
/** Lee un gen resolviendo herencia: override → base → undefined. */
export function useGene<T>(path: GenePath, baseValue: T): {
  value: T
  isMutated: boolean
} {
  return useVibeLabStore(
    useShallow(s => {
      const raw = s.draft ? getByPath(s.draft, path) : undefined
      return { value: (raw ?? baseValue) as T, isMutated: raw !== undefined }
    })
  )
}

/** Selectores derivados estables (patrón truthStore.ts:91-178). */
export const selectMutationCount = (s: VibeLabState) => s.mutationCount
export const selectInterlock     = (s: VibeLabState) => s.interlock
export const selectActiveTab     = (s: VibeLabState) => s.activeTab
export const selectDiagnostics   = (s: VibeLabState) => s.diagnostics

export const useMutationCount = () => useVibeLabStore(selectMutationCount)
export const useInterlock     = () => useVibeLabStore(selectInterlock)
```

Con `useGene`, arrastrar el slider de `percBoost` re-renderiza **un** componente.

### 3.5 El coalescer rAF (puente store → motor)

`src/stores/vibeLab/engineSync.ts` — se inicializa una vez, fuera de React:

```typescript
let pending = false
let lastGrafted: CustomVibeKey | null = null

export function initVibeLabEngineSync(): () => void {
  return useVibeLabStore.subscribe(
    s => ({ draft: s.draft, live: s.livePreview, ab: s.abMode }),
    ({ draft, live, ab }) => {
      if (!draft || !live) return
      if (pending) return              // ya hay un flush encolado este frame
      pending = true
      requestAnimationFrame(() => {
        pending = false
        if (ab === 'base') {
          vibeManager.setActiveVibe(draft.baseDNA)
          return
        }
        const { bundle, diagnostics, ok } = resolveCustomVibe(draft)
        useVibeLabStore.setState({ diagnostics })
        if (!ok || !bundle) return
        graft(bundle)
        if (lastGrafted !== bundle.key) {
          vibeManager.setActiveVibeImmediate(bundle.key)
          seleneLux.setActiveProfile(bundle.key)
          lastGrafted = bundle.key
        }
        // Mismo key → el graft ya reemplazó las configs in-place.
        // Sólo hay que re-empujar el liquid profile (hot-swap preserva estado).
        else {
          liquidEngine41.setProfile(bundle.liquidProfile)
          liquidEngine71.setProfile(bundle.liquidProfile)
        }
      })
    },
    { equalityFn: shallow }
  )
}
```

Puntos críticos:
- **Coalescing por rAF**: arrastrar un slider dispara ~60 `setGene`/s pero como máximo
  1 resolve+graft por frame.
- **Hot-swap sin reset**: `LiquidEnvelope.setConfig()` preserva el estado interno
  (blueprint Liquid §5), así que cambiar `boost` en vivo no provoca un salto de luz.
- **Misma key siempre**: el vibe custom mantiene su `key` durante toda la sesión, por
  lo que `setActiveVibe` se llama una sola vez. Sin esto, cada tick de slider dispararía
  una transición de vibe.

### 3.6 El bus de telemetría (canal B, cero React)

`src/stores/vibeLab/telemetryBus.ts`:

```typescript
/** Layout fijo del frame de telemetría. Índices estables. */
export const TELEMETRY_LAYOUT = {
  frontL: 0, frontR: 1, backL: 2, backR: 3, moverL: 4, moverR: 5, strobe: 6,
  morphFactor: 7,
  panL: 8, tiltL: 9, panR: 10, tiltR: 11,
  primaryH: 12, primaryS: 13, primaryL: 14,
  secondaryH: 15, secondaryS: 16, secondaryL: 17,
  accentH: 18, accentS: 19, accentL: 20,
  ambientH: 21, ambientS: 22, ambientL: 23,
  contrastH: 24, contrastS: 25, contrastL: 26,
} as const

export const TELEMETRY_SIZE = 27

class VibeLabTelemetryBus {
  /** Doble buffer: el IPC escribe en `back`, los canvas leen `front`. */
  private front = new Float32Array(TELEMETRY_SIZE)
  private back  = new Float32Array(TELEMETRY_SIZE)
  private listeners = new Set<(buf: Float32Array) => void>()

  push(values: ArrayLike<number>): void {
    this.back.set(values)
    const tmp = this.front; this.front = this.back; this.back = tmp
    for (const l of this.listeners) l(this.front)
  }
  read(): Readonly<Float32Array> { return this.front }
  subscribe(fn: (buf: Float32Array) => void): () => void {
    this.listeners.add(fn); return () => this.listeners.delete(fn)
  }
}

export const telemetryBus = new VibeLabTelemetryBus()
```

Cada canvas del Mutation Scope corre su propio bucle rAF leyendo `telemetryBus.read()`.
**Cero `setState`. Cero re-render. Cero garbage** (buffers preasignados, igual que el
patrón de object pooling del VMM en `_tempPos`/`_tempIntent`).

### 3.7 Persistencia

Siguiendo el patrón exacto de `libraryStore` (system/user split) y `StagePersistence`:

| Aspecto | Decisión |
|---|---|
| Ubicación | `app.getPath('userData')/vibes/` |
| Extensión | `.luxvibe` (JSON plano, legible, versionado) |
| Nombre de archivo | `<slug>-<hash6>.luxvibe` |
| Escritura | Atómica (temp + rename), igual que `StagePersistence` |
| Canal IPC | `lux:vibe-lab:*` |
| Bridge | `window.lux.vibeLab.*` en `electron/preload.ts` |

```typescript
// electron/preload.ts — añadir al objeto `api`
vibeLab: {
  list:    ()                        => ipcRenderer.invoke('lux:vibe-lab:list'),
  read:    (key: string)             => ipcRenderer.invoke('lux:vibe-lab:read', key),
  save:    (doc: unknown)            => ipcRenderer.invoke('lux:vibe-lab:save', doc),
  delete:  (key: string)             => ipcRenderer.invoke('lux:vibe-lab:delete', key),
  exportDialog: (key: string)        => ipcRenderer.invoke('lux:vibe-lab:export-dialog', key),
  importDialog: ()                   => ipcRenderer.invoke('lux:vibe-lab:import-dialog'),
  onTelemetry: (cb: (b: Float32Array) => void) =>
    ipcRenderer.on('lux:vibe-lab:telemetry', (_e, buf) => cb(buf)),
}
```

---

## 4. THE ASSEMBLY LINE — 4 fases de ejecución

Cada fase es autocontenida, verificable y **no rompe la app si se para ahí**.
Formato pensado para alimentar a un agente ejecutor (Cascade/GLM).

---

### FASE 1 — THE GENOME (tipos, resolver, injerto, store)

> **Sin UI. Puro TypeScript testeable.** Al terminar, se puede crear y aplicar un vibe
> custom desde la consola de DevTools.

**Crear:**

| Archivo | Contenido |
|---|---|
| `src/types/CustomVibe.ts` | Todas las interfaces de §2.2–§2.6 |
| `src/engine/vibe/custom/SEALED_PARAMS.ts` | `Set<string>` con las rutas selladas de §0.4 |
| `src/engine/vibe/custom/GENE_RANGES.ts` | `Record<GenePath, { min, max, step, tier: 'safe'\|'raw', danger?: [number,number] }>` — la SSOT de rangos que consumen resolver Y UI |
| `src/engine/vibe/custom/VibeFusionResolver.ts` | `resolveCustomVibe(doc): ResolveResult` — función pura |
| `src/engine/vibe/custom/VibeGraftRegistry.ts` | `graft` / `ungraft` / `listGrafted` |
| `src/engine/vibe/custom/pathUtils.ts` | `getByPath` / `setByPath` / `deleteByPath` / `countLeaves` |
| `src/engine/vibe/custom/macroGenes.ts` | Definición de los 5 Macro Genes → lista de `{ path, curve }` |
| `src/stores/vibeLabStore.ts` | Store de §3.3 (sin las acciones de persistencia, que van en Fase 4: dejarlas como stubs que devuelven `{ ok:false }`) |
| `src/stores/vibeLab/engineSync.ts` | Coalescer rAF de §3.5 |
| `src/stores/vibeLab/telemetryBus.ts` | Bus de §3.6 |

**Tests (vitest, ya configurado):**

| Archivo | Debe cubrir |
|---|---|
| `src/engine/vibe/custom/__tests__/VibeFusionResolver.test.ts` | (a) doc vacío → bundle idéntico al canónico; (b) override de 1 gen sólo cambia ese gen; (c) clamp fuera de rango emite `warn`; (d) `SEALED_PARAMS` emite `error`; (e) `phraseDuration` hace snap a múltiplo de `cycleBeats`; (f) `morphFloor > morphCeiling` se auto-corrige; (g) **el registry canónico NO se muta** (deep-equal antes/después) |
| `src/engine/vibe/custom/__tests__/VibeGraftRegistry.test.ts` | (a) tras `graft`, `normalizeVibeId(key)` devuelve la key; (b) `getColorConstitution(key)` devuelve la constitución fusionada; (c) `getMovementPreset(key)` no emite el warn de fallback; (d) `ungraft` limpia los 7 registries |
| `src/stores/__tests__/vibeLabStore.test.ts` | (a) `setGene` crea objetos intermedios; (b) `revertGene` los poda si quedan vacíos; (c) `mutationCount` correcto; (d) `rebase` con `keepMutations:false` limpia las 3 capas |

**Criterio de aceptación:**
```
npx vitest run src/engine/vibe/custom src/stores/__tests__/vibeLabStore.test.ts
```
verde, y en DevTools:
```js
const r = resolveCustomVibe({ schemaVersion:1, kind:'luxvibe', baseDNA:'techno-club',
  meta:{...}, movement:{ kinematics:{ panScale:0.4 } } })
graft(r.bundle); vibeManager.setActiveVibe(r.bundle.key)
// → los movers reducen su barrido en vivo, sin errores en consola
```

**Prohibido en esta fase:** tocar cualquier archivo de `src/engine/movement/`,
`src/engine/color/`, `src/hal/physics/` salvo (si se elige la vía sin casts) añadir
los 3 setters `registerVibe` de una línea.

---

### FASE 2 — THE INSTRUMENT KIT (primitivas de UI)

> La auditoría confirmó que **no existen** `Slider`, `Toggle`, `Tabs`, `Modal`, `Knob`,
> `Dropdown` genéricos en el codebase. Hay que construirlos. Esta fase los crea de forma
> aislada y con un playground, sin conectarlos aún al genoma real.

**Crear** en `src/components/vibeLab/kit/`:

| Componente | Props clave |
|---|---|
| `GeneSlider.tsx` + `.css` | `path, label, baseValue, value, min, max, step, unit?, danger?, isMutated, tier, onChange, onRevert` |
| `TwinGeneSlider.tsx` + `.css` | idem pero `value: [number, number]`, con guardia `min ≤ max` |
| `GeneToggle.tsx` + `.css` | `path, label, baseValue, value, isMutated, onChange, onRevert` |
| `GeneSegmented.tsx` + `.css` | `options: {label, value}[]` — patrón visual de `SystemsCheck` |
| `GeneNumberField.tsx` + `.css` | entrada numérica con clamp al blur |
| `GenePanel.tsx` + `.css` | Colapsable. Envuelve el patrón de `src/chronos/ui/common/Accordion.tsx`. Props: `id, title, icon, accent, tier, mutatedCount, children` |
| `MacroGeneDial.tsx` + `.css` | Dial circular 0..1, drag vertical |
| `SafetyInterlock.tsx` + `.css` | Toggle SHIELDED ⇄ RAW con modal de confirmación la primera vez |
| `MutationBadge.tsx` | Badge ⬢ con contador |
| `index.ts` | Barrel export |

**Reglas de estilo (obligatorio, es la convención real del repo):**
- Un `.css` plano por componente, importado desde el `.tsx`. **Nada de Tailwind.**
- Acento vía CSS custom property inyectada por el padre:
  `style={{ '--accent-color': accent } as React.CSSProperties}` (patrón de `Accordion.tsx:70`).
- Iconos de `lucide-react`.
- Animaciones con `framer-motion` sólo en colapsables y en el badge de mutación.
- Nombres de archivo PascalCase; CSS kebab-case (`gene-slider.css`).

**Playground:** `src/components/vibeLab/kit/__playground__/KitPlayground.tsx` — una ruta
temporal que renderiza cada primitiva en sus 5 estados
(`inherited`, `mutated`, `danger`, `sealed`, `locked-by-basic`).

**Criterio de aceptación:** el playground muestra las 10 primitivas, el fantasma del valor
base se ve, el botón ⟲ aparece sólo en `mutated`, y arrastrar un `GeneSlider` con React
DevTools Profiler activo **re-renderiza únicamente ese componente**.

---

### FASE 3 — THE THREE BENCHES (los tabs, cableados al genoma)

> Ahora sí: UI real conectada al store. Sin persistencia todavía.

**Crear** en `src/components/vibeLab/`:

| Archivo | Rol |
|---|---|
| `VibeLabView.tsx` + `.css` | Contenedor raíz (layout de §1.2) |
| `HelixBar.tsx` + `.css` | Cabecera |
| `DnaDonorSelector.tsx` | Selector de `baseDNA` + confirmación al re-basar |
| `GenomeTabs.tsx` + `.css` | Las 3 pestañas |
| `MutationBench.tsx` | Host del tab activo |
| `tabs/PhysicsBench.tsx` | 11 paneles de §1.5 TAB 1 |
| `tabs/ColorBench.tsx` | 10 paneles de §1.5 TAB 2 |
| `tabs/MovementBench.tsx` | 8 paneles de §1.5 TAB 3 |
| `panels/EnvelopeBay.tsx` + `.css` | Un envelope (17 genes + curva ADSR en canvas) |
| `panels/ChromaticWheel.tsx` + `.css` | Rueda 360° con arcos arrastrables |
| `panels/ThermalVector.tsx` | Overlay del vector de gravedad |
| `panels/TransmutationTable.tsx` + `.css` | Tabla de `hueRemapping` |
| `panels/SiderealCarousel.tsx` + `.css` | Editor de slots temporales |
| `panels/OrbitVault.tsx` + `.css` | Grid de 16 patrones, multi-select + reorden con `@dnd-kit` (ya es dependencia) |
| `panels/OrbitThumbnail.tsx` | Canvas que dibuja la trayectoria de un patrón |
| `geneRegistry.ts` | **Pieza clave:** declaración de los ~282 genes → `{ path, label, panel, tab, tier, control }`. La UI se genera a partir de esta tabla + `GENE_RANGES`. |

**La tabla `geneRegistry.ts` es el corazón de esta fase.** Evita escribir 282 JSX a mano:

```typescript
export interface GeneDescriptor {
  path: GenePath
  label: string
  tab: GenomeTab
  panel: string
  tier: 'safe' | 'raw'
  control: 'slider' | 'twin' | 'toggle' | 'segmented' | 'number' | 'color' | 'custom'
  unit?: string
  options?: { label: string; value: string }[]
}
export const GENE_REGISTRY: readonly GeneDescriptor[] = [ /* … 282 entradas … */ ]
```

Un panel se renderiza filtrando: `GENE_REGISTRY.filter(g => g.panel === id && (interlock === 'raw' || g.tier === 'safe'))`.

**Sub-orden de trabajo recomendado (para no ahogar al agente):**
1. `geneRegistry.ts` sólo con los genes `tier: 'safe'` (~65). Verificar que los 3 tabs
   renderizan y mutan en vivo.
2. `OrbitThumbnail` + `OrbitVault` (necesita portar las 16 funciones de patrón a un helper
   de dibujo — **copiar, no importar**, para no acoplar la UI al VMM).
3. `ChromaticWheel` (el componente más complejo: arcos arrastrables sobre SVG).
4. `EnvelopeBay` + los ~217 genes `tier: 'raw'` restantes.

**Criterio de aceptación:** con `livePreview` activo y audio sonando, mover
`physics.transient.percBoost` cambia el comportamiento del back-R en tiempo real; el
contador de mutaciones sube; ⟲ lo devuelve al valor de `techno-club`.

---

### FASE 4 — THE VAULT (preview, persistencia, minting)

**Crear:**

| Archivo | Rol |
|---|---|
| `src/components/vibeLab/MutationScope.tsx` + `.css` | Panel derecho |
| `src/components/vibeLab/scope/RigMonitorCanvas.tsx` | 7 zonas, rAF sobre `telemetryBus` |
| `src/components/vibeLab/scope/PaletteStripCanvas.tsx` | 5 colores |
| `src/components/vibeLab/scope/OrbitTrailCanvas.tsx` | Traza pan/tilt con estela |
| `src/components/vibeLab/DiagnosticsRail.tsx` + `.css` | Avisos + botón A/B |
| `src/components/vibeLab/GenomeVault.tsx` + `.css` | Biblioteca (patrón `UniversalAssetBrowser`) |
| `src/components/vibeLab/MintDialog.tsx` + `.css` | Exportación |
| `electron/ipc/VibeLabIPCHandlers.ts` | Handlers `lux:vibe-lab:*` |
| `src/core/vibe/VibeLabPersistence.ts` | Lectura/escritura atómica en `userData/vibes/` (espejo de `StagePersistence`) |

**Modificar:**

| Archivo | Cambio |
|---|---|
| `electron/preload.ts` | Añadir el bloque `vibeLab` de §3.7 al objeto `api` |
| `electron/main.ts` | Registrar `VibeLabIPCHandlers` |
| `src/stores/vibeLabStore.ts` | Implementar las acciones de persistencia (stubs de Fase 1) |
| `src/stores/index.ts` | Exportar `useVibeLabStore` |
| Router/sidebar de navegación | Añadir la entrada "VIBE LAB" |
| Emisor de telemetría del tick | Emitir `lux:vibe-lab:telemetry` **sólo si hay un cliente suscrito** (flag, para no pagar coste en producción) |

**Detalles de la telemetría:** empaquetar en un `Float32Array` de 27 posiciones (§3.6) y
enviarlo por IPC. `structuredClone` de un TypedArray es transferible y barato. **No enviar
objetos JS por frame.**

**Criterio de aceptación:**
1. Crear un vibe "Dubstep Cathedral" desde `techno-club`, mutar ~15 genes en los 3 tabs.
2. `Mint` → aparece `userData/vibes/dubstep-cathedral-a1b2.luxvibe`.
3. Reiniciar la app → el vibe aparece en el `GenomeVault`.
4. Seleccionarlo desde el `VibeSelector` del Command Deck → los tres motores lo aplican.
5. `Export` → archivo compartible. `Import` en otra máquina → funciona idéntico.
6. El A/B alterna base ⇄ mutación sin glitch de luz.

---

## 5. RIESGOS Y DECISIONES ABIERTAS

| # | Riesgo | Mitigación propuesta |
|---|---|---|
| 1 | Los 3 casts de §2.6 sobre `VIBE_REGISTRY`, `COLOR_CONSTITUTIONS`, `TILT_OFFSET_BY_VIBE` | Preferible: añadir 3 setters `registerVibe()` de una línea en esos módulos. Decisión del equipo. |
| 2 | `LiquidEngine71.routeZones()` bifurca por `profile.id` con strings literales (`'latino-fiesta'`, `'chill-oceanic'`) | El resolver debe **preservar el `id` del perfil base** en el `liquidProfile` fusionado, no usar la key custom. Si no, un Dubstep basado en Latino perdería el swap vocal/treble. **Está en los tests de Fase 1.** |
| 3 | `SeleneLux` fuerza `liquidEngine71` cuando detecta chill | Un custom basado en `chill-lounge` heredará ese routing. Correcto, pero hay que documentarlo en la UI: "los vibes basados en Chill siempre usan el motor 7.1". |
| 4 | `TitanEngine` detecta chill por `vibeProfile.id.includes('chill')` para inyectar `oceanicModulation` | Igual que #2: el `id` heredado lo resuelve. La key `custom:*` no debe usarse para estas comprobaciones. |
| 5 | 282 controles montados a la vez | Los paneles arrancan colapsados y se montan bajo demanda (`GenePanel` no renderiza hijos si está cerrado). |
| 6 | El usuario crea un vibe físicamente imposible | Los diagnostics del resolver son visibles siempre en el `DiagnosticsRail`; el clamp es automático y no bloqueante. |
| 7 | Migración de esquema al añadir genes | `schemaVersion` + un `migrations.ts` con funciones `v1→v2`. Un gen nuevo ausente simplemente se hereda: la naturaleza sparse hace las migraciones casi triviales. |

---

## 6. RESUMEN EJECUTIVO

| Dimensión | Cifra |
|---|---|
| Parámetros mutables totales | ~282 (180 physics + 49 color + 53 movement) |
| Expuestos en modo SHIELDED | ~65 + 5 Macro Genes |
| Parámetros sellados | 19 constantes de seguridad |
| Archivos nuevos | ~55 |
| Archivos de motor modificados | **0** (o 3 setters de una línea, si se rechazan los casts) |
| Stores nuevos | 1 (`vibeLabStore`) + 2 módulos auxiliares fuera de React |
| Canales IPC nuevos | 7 (`lux:vibe-lab:*`) |
| Formato de intercambio | `.luxvibe` — JSON sparse, versionado, legible |

**La tesis:** un vibe custom no es una entidad nueva en el sistema. Es **una clave más en
Records que el motor ya sabía leer**. Toda la complejidad vive en dos módulos puros
(`VibeFusionResolver` + `VibeGraftRegistry`) y una capa de UI generada por tabla. El core
matemático —OmniLiquid, Thermal Color, VMM/IK— permanece exactamente como está.
