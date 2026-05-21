# 🎨 WAVE 4816 — THE INFINITE ARSENAL: UX & DNA UNIFICATION

> **Codename:** `LfxClipInstance::Genesis`
> **Tier:** Creative Director / Architect Blueprint
> **Status:** Architectural blueprint — *no React yet*
> **Predecesores:** `WAVE-4811-DNA-INTEGRATION` · `WAVE-2480/2481/2482-INFINITE-ARSENAL` · `SELENE-REALITY-MAPPING.md`
> **Sucesor:** `WAVE-5000-EVOLVEENGINE` (la semilla diseñada aquí debe germinar allí)

---

## 0. EL PROBLEMA EN UNA FRASE

> Selene IA solo entiende **3 números (ACO) y 7 zonas de energía**.
> El humano que crea efectos quiere pensar en **"Strobe duro tipo Berghain"**, no en `aggression: 0.93, chaos: 0.35, organicity: 0.15`.
>
> Necesitamos un **traductor bidireccional** entre el lenguaje de la intuición artística y la matriz fría que el motor consume.

Este documento define ese traductor como una **clase átomo** (`LfxClipInstance`) y la UI que la materializa.

---

## 1. LA DOCTRINA DE LA TRADUCCIÓN

### 1.1 · Los tres lenguajes del efecto

Un efecto `.lfx` vive en tres planos simultáneos:

| Plano | Audiencia | Vocabulario | Ejemplo |
|---|---|---|---|
| **Mítico** | Usuario / Operador | Arquetipos narrativos | *"Heartbeat Latino — corazón pulsando en 3 escenas"* |
| **Estético** | Diseñador artístico | Etiquetas semánticas (Archetypes) | `STROBE`, `HEAVY`, `AMBIENT`, `DIVINE`, `LIQUID`, `SURGICAL` |
| **Cognitivo** | Selene IA | ACO + EnergyZones + flags | `{ A:0.93, C:0.35, O:0.15, zone:[active..peak] }` |

La `LfxClipInstance` es el **átomo indivisible** que coexiste en los tres planos al mismo tiempo.

### 1.2 · La Regla de Oro (No Negociable)

> **El usuario nunca toca los sliders ACO directamente. Los toca a través de los Arquetipos.**
> **Pero puede VER los ACO en todo momento, y la UI le muestra cómo cambia con cada elección.**

Esto es como un sintetizador profesional: el músico no calcula amplitud-de-onda-senoidal-en-Hz, gira el knob `BRIGHTNESS` y la matemática se mueve sola. Pero el osciloscopio sigue ahí para los que quieran mirar.

### 1.3 · Arquitectura conceptual del átomo

```
┌─────────────────────────────────────────────────────────────────────┐
│                     LfxClipInstance (átomo)                          │
│                                                                       │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│   │  Narrative   │    │ Archetypes   │    │  Cognitive Reality   │  │
│   │  Layer       │    │  Layer       │    │  Layer (ACO+Zones)   │  │
│   │              │    │              │    │                      │  │
│   │  name        │    │  ['STROBE',  │    │  genome:{A,C,O}      │  │
│   │  story       │ ─► │   'HEAVY',   │ ─► │  energyZone:{min,max}│  │
│   │  signature   │    │   'DIVINE']  │    │  textureAffinity     │  │
│   │              │    │              │    │  safetyDeclaration   │  │
│   └──────────────┘    └──────────────┘    └──────────────────────┘  │
│         ▲                    ▲                       ▲               │
│         │                    │                       │               │
│         │    ┌───────────────────────────────────┐   │               │
│         └────┤   ArchetypeProjector (puro,       ├───┘               │
│              │   determinista, idempotente)      │                   │
│              └───────────────────────────────────┘                   │
│                              ▲                                       │
│                              │                                       │
│                  ┌───────────┴───────────┐                          │
│                  │  Gatekeeper Linter    │  ← genera Warnings UX    │
│                  │  (lee Reality vs.     │                          │
│                  │   reglas de Selene)   │                          │
│                  └───────────────────────┘                          │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │  Serializer → .lfx JSON  │ ← lo que Selene consume
                └──────────────────────────┘
```

**Tres capas, una sola fuente de verdad:** la capa de **Reality** (ACO). Las otras dos son proyecciones del usuario que se *resuelven* contra Reality vía el `ArchetypeProjector`. Si el usuario toca un arquetipo, Reality muta. Si Reality muta directamente (vía el motor evolutivo de WAVE-5000), los arquetipos se *infieren* hacia atrás.

---

## 2. LOS ARQUETIPOS — EL DICCIONARIO POÉTICO

### 2.1 · Filosofía

Un **Arquetipo** es una etiqueta semántica que el usuario reconoce intuitivamente y que el `ArchetypeProjector` traduce a un *vector de presión* sobre el cubo ACO.

No son tags decorativas. **Cada arquetipo es un campo gravitatorio** que tira los ACO hacia una región del cubo.

### 2.2 · El Pantheon de Arquetipos (v1)

Catalogados en **5 familias** (corresponden a las 5 vibes reales de LuxSync). Cada arquetipo declara:

- **Dirección:** vector unitario `(dA, dC, dO)` en el cubo
- **Fuerza:** magnitud `[0..1]`
- **Zona afín:** rango de `EnergyZone` donde el arquetipo cobra sentido
- **Antagonistas:** arquetipos incompatibles (la UI los muestra atenuados/tachados)

**Familia MOTION / RHYTHM** *(modulan el tiempo)*

| Arquetipo | A | C | O | Zona afín | Antagonistas |
|---|---|---|---|---|---|
| `STROBE` | +0.45 | +0.10 | −0.40 | active..peak | `LIQUID`, `AMBIENT` |
| `PULSE` | +0.10 | −0.20 | +0.15 | ambient..intense | — |
| `LIQUID` | −0.20 | −0.10 | +0.40 | silence..gentle | `STROBE`, `SURGICAL` |
| `SURGICAL` | +0.30 | −0.35 | −0.30 | active..peak | `LIQUID`, `ORGANIC` |

**Familia INTENSITY / WEIGHT** *(modulan la presencia)*

| Arquetipo | A | C | O | Zona afín | Antagonistas |
|---|---|---|---|---|---|
| `HEAVY` | +0.40 | +0.20 | −0.20 | active..peak | `SUBTLE`, `WHISPER` |
| `SUBTLE` | −0.30 | −0.20 | +0.10 | silence..gentle | `HEAVY`, `DIVINE` |
| `DIVINE` | +0.50 | +0.10 | +0.00 | peak only | `SUBTLE`, `WHISPER` |
| `WHISPER` | −0.45 | −0.10 | +0.30 | silence..valley | `HEAVY`, `DIVINE` |

**Familia TEXTURE / GRAIN** *(modulan la materia)*

| Arquetipo | A | C | O | textureAffinity forzada | Antagonistas |
|---|---|---|---|---|---|
| `DIRTY` | +0.20 | +0.30 | −0.10 | `'dirty'` | `CRYSTAL` |
| `CRYSTAL` | −0.10 | −0.25 | +0.05 | `'clean'` | `DIRTY`, `GLITCH` |
| `GLITCH` | +0.15 | +0.45 | −0.30 | `'dirty'` | `CRYSTAL`, `ORGANIC` |
| `ORGANIC` | −0.15 | +0.05 | +0.45 | `'clean'` | `SURGICAL`, `GLITCH` |

**Familia CONTEXT / SECTION** *(declaran propósito narrativo)*

| Arquetipo | A | C | O | Zona forzada | Antagonistas |
|---|---|---|---|---|---|
| `AMBIENT` | −0.40 | −0.30 | +0.20 | silence..ambient | `STROBE`, `DROP_KILLER` |
| `BUILDUP` | +0.15 | +0.10 | −0.05 | ambient..active | — |
| `DROP_KILLER` | +0.50 | +0.20 | −0.20 | intense..peak | `AMBIENT`, `WHISPER` |
| `OUTRO` | −0.30 | −0.10 | +0.25 | silence..gentle | `DROP_KILLER` |

**Familia AESTHETIC SIGNATURE** *(modulan la identidad cultural)*

| Arquetipo | A | C | O | Vibe afín | Notas |
|---|---|---|---|---|---|
| `LATIN_HEART` | −0.05 | −0.10 | +0.25 | fiesta-latina | empuja organicity |
| `BERGHAIN` | +0.30 | +0.05 | −0.30 | techno-club | empuja A, baja O |
| `STADIUM` | +0.20 | −0.15 | +0.10 | pop-rock | medio-alto A, bajo C |
| `OCEAN` | −0.40 | −0.20 | +0.40 | chill-lounge | máximo O |

### 2.3 · El cálculo de proyección

```typescript
// Operación pura, determinista, sin side-effects.
function projectArchetypes(
  archetypes: readonly Archetype[],
  baseline: FrozenGenome = NEUTRAL,  // {0.5, 0.5, 0.5}
): FrozenGenome {
  let A = baseline.aggression
  let C = baseline.chaos
  let O = baseline.organicity

  // Suma vectorial de presiones, con saturación por tanh (no clamp duro)
  for (const arch of archetypes) {
    const def = ARCHETYPE_REGISTRY[arch]
    A += def.dA * def.strength
    C += def.dC * def.strength
    O += def.dO * def.strength
  }

  // Saturación suave (tanh) para evitar acumulación destructiva si el
  // usuario apila 6 arquetipos. Mantiene rango [0,1] sin perder "feel".
  return {
    aggression: softSaturate(A),
    chaos: softSaturate(C),
    organicity: softSaturate(O),
  }
}

// softSaturate: f(x) = 0.5 + 0.5 * tanh(2 * (x - 0.5))
// f(0) = 0.04, f(0.5) = 0.5, f(1) = 0.96, f(2) = 0.998
```

**Propiedades clave:**

1. **Determinismo:** el mismo set de arquetipos → siempre los mismos ACO.
2. **Conmutatividad:** el orden en que el usuario agrega arquetipos no importa.
3. **Reversibilidad parcial:** quitar un arquetipo deshace su presión exactamente.
4. **No-clamp:** la saturación suave evita "techos planos" que matarían la diferenciación.

---

## 3. LA CLASE UNIFICADORA — `LfxClipInstance`

### 3.1 · Interface TypeScript completa

```typescript
import type {
  CognitiveDNA, SimulationMeta, ExecutionHints,
  SafetyDeclaration, FrozenGenome, EnergyZone, TextureAffinity,
} from '@/core/arsenal/lfxTypes'

// ─── ARCHETYPE LAYER ────────────────────────────────────────────────────────

/** Las 20 etiquetas semánticas del Pantheon v1. Cerrado deliberadamente. */
export type ArchetypeId =
  // Motion/Rhythm
  | 'STROBE' | 'PULSE' | 'LIQUID' | 'SURGICAL'
  // Intensity/Weight
  | 'HEAVY' | 'SUBTLE' | 'DIVINE' | 'WHISPER'
  // Texture/Grain
  | 'DIRTY' | 'CRYSTAL' | 'GLITCH' | 'ORGANIC'
  // Context/Section
  | 'AMBIENT' | 'BUILDUP' | 'DROP_KILLER' | 'OUTRO'
  // Aesthetic signature
  | 'LATIN_HEART' | 'BERGHAIN' | 'STADIUM' | 'OCEAN'

export interface ArchetypeDefinition {
  readonly id: ArchetypeId
  readonly family: 'motion' | 'intensity' | 'texture' | 'context' | 'signature'
  readonly displayName: string
  readonly glyph: string                       // Unicode/icon (visual UI)
  readonly poeticDescription: string           // 1 frase para tooltip
  readonly pressureVector: {
    readonly dA: number; readonly dC: number; readonly dO: number
  }
  readonly strength: number                    // [0..1]
  readonly affineZones: readonly EnergyZone[]  // dónde tiene sentido
  readonly forcesTexture?: TextureAffinity     // si fuerza texture
  readonly antagonists: readonly ArchetypeId[] // incompatibles
}

export const ARCHETYPE_REGISTRY: Readonly<Record<ArchetypeId, ArchetypeDefinition>>

// ─── REALITY LAYER (consumido por Selene) ───────────────────────────────────

/** Snapshot inmutable del estado cognitivo derivado. Lo que se serializa. */
export interface CognitiveReality {
  readonly genome: FrozenGenome
  readonly textureAffinity: TextureAffinity
  readonly energyZone: { readonly min: EnergyZone; readonly max: EnergyZone }
  readonly compatibleVibes: readonly string[]
  readonly validSections: readonly string[]
  readonly safety: SafetyDeclaration
  readonly simulation: SimulationMeta
  readonly execution: ExecutionHints
  /** Hash determinista de toda la realidad. Para Genesis Engine. */
  readonly checksum: string
}

// ─── NARRATIVE LAYER (humano) ───────────────────────────────────────────────

export interface NarrativeMetadata {
  readonly clipId: string                     // UUIDv7
  readonly name: string                        // "Corazón Latino v3"
  readonly author: string
  readonly storyOneLiner: string               // hasta 120 chars
  readonly signaturePalette: readonly string[] // hex colors, para UI cards
  readonly createdAt: number
  readonly lastEditedAt: number
}

// ─── THE ATOM ───────────────────────────────────────────────────────────────

/**
 * 🧬 LfxClipInstance — El átomo unificado.
 *
 * Vive en memoria como una instancia mutable durante la edición.
 * Se congela (Object.freeze) en el momento del export al .lfx.
 *
 * Invariante crítico: `reality` es SIEMPRE el resultado puro de
 * projectArchetypes(archetypes, manualOverrides). Nunca se edita
 * directamente excepto en modo "Expert" (donde el usuario rompe la
 * abstracción a sabiendas).
 */
export class LfxClipInstance {
  // ── Capa narrativa (mutable durante edición) ──
  public narrative: NarrativeMetadata

  // ── Capa arquetípica (entrada principal del usuario) ──
  public archetypes: ReadonlySet<ArchetypeId>

  // ── Anclajes de zona y vibe (chips multi-select en UI) ──
  public anchoredVibes: ReadonlySet<string>      // ['fiesta-latina', 'pop-rock']
  public anchoredZones: { min: EnergyZone; max: EnergyZone }

  // ── Override manual (modo Expert / Selene Evolutiva) ──
  /**
   * Cuando el usuario o el Genesis Engine quieren forzar valores ACO
   * fuera del resultado de proyección. Si está presente, la UI muestra
   * un badge "[MANUAL OVERRIDE]" y el botón "Reset to archetypes".
   */
  public manualGenomeOverride: FrozenGenome | null

  // ── Carga útil técnica (Hephaestus runtime) ──
  public curves: readonly HephCurve[]
  public phaseConfig: PhaseConfig
  public executionHints: ExecutionHints

  // ── Capa REALITY (derivada, read-only externo) ──
  private _cachedReality: CognitiveReality | null

  // ─── API PÚBLICA ─────────────────────────────────────────────────────────

  /** Resuelve la realidad cognitiva on-demand. Cachea hasta próximo edit. */
  public getReality(): CognitiveReality

  /** Lint completo. Devuelve warnings antes del export. */
  public lint(): readonly GatekeeperWarning[]

  /** Serializa a .lfx v2.1 JSON (congela). */
  public toLfx(): LfxClipV2

  // ─── EDICIÓN ─────────────────────────────────────────────────────────────

  public addArchetype(id: ArchetypeId): void   // valida antagonistas
  public removeArchetype(id: ArchetypeId): void
  public toggleVibe(vibe: string): void
  public setEnergyZoneRange(min: EnergyZone, max: EnergyZone): void
  public setManualOverride(genome: FrozenGenome): void
  public clearManualOverride(): void

  // ─── GENESIS HOOKS (WAVE-5000) ───────────────────────────────────────────

  /**
   * Genera N variantes mutadas para el Genesis Engine.
   * No modifica el átomo padre. Devuelve instancias hijas inmutables.
   */
  public spawnMutations(
    n: number,
    strategy: MutationStrategy,
  ): readonly LfxClipInstance[]

  /** Distancia genética L2 con otro clip (para speciation). */
  public geneticDistance(other: LfxClipInstance): number

  /** Reconstruye un átomo desde .lfx serializado (round-trip). */
  public static fromLfx(lfx: LfxClipV2): LfxClipInstance

  /** Infiere arquetipos plausibles desde un genoma crudo. */
  public static inferArchetypes(genome: FrozenGenome): readonly ArchetypeId[]
}
```

### 3.2 · El contrato del átomo (5 invariantes)

| # | Invariante | Por qué importa |
|---|---|---|
| 1 | `getReality()` es una **función pura** de `(archetypes, anchored*, manualGenomeOverride)`. | Determinismo total. Mismo input → mismo `.lfx`. Genesis Engine puede confiar en hashes. |
| 2 | Quitar arquetipos siempre **deshace** su presión exactamente. | UX reversible. Ningún botón es "destructivo". |
| 3 | El usuario **nunca puede dejar el átomo en estado inválido**. | Antagonistas se bloquean en `addArchetype`. Zonas se clampan a `[silence..peak]`. |
| 4 | `manualGenomeOverride === null` implica que `reality.genome === projectArchetypes(archetypes)`. | El árbol está siempre balanceado salvo override explícito. |
| 5 | El `checksum` de `CognitiveReality` cambia si y solo si la realidad cambia. | Genesis Engine identifica "padres únicos" sin colisión. |

### 3.3 · Por qué esta clase es **semilla perfecta para WAVE-5000**

El motor evolutivo necesita que cada efecto tenga:

| Necesidad de Genesis Engine | Cómo lo cumple `LfxClipInstance` |
|---|---|
| **Padre inmutable** | El `.lfx` exportado es congelado (`Object.freeze`) + SHA-256. La instancia en memoria tiene `fromLfx()` para hidratar sin mutar el padre. |
| **Mutación atómica** | `spawnMutations(n, strategy)` produce hijas que solo modifican `manualGenomeOverride` y/o `curves`, dejando `archetypes` como referencia de linaje. |
| **Identidad linaje** | `checksum` + `parent.clipId` permite reconstruir el árbol filogenético. |
| **Distancia genética** | `geneticDistance()` con métrica L2 en cubo ACO + cosine en arquetipos. Speciation directa. |
| **Reverse-engineering** | `inferArchetypes()` permite que mutaciones nacidas en el Coliseum (con ACO puros) recuperen una "etiqueta poética" para la UI. |
| **Fitness signal** | El `lint()` devuelve warnings que pueden contribuir negativamente al fitness inicial (un efecto que nace con warnings de seguridad parte con desventaja). |

---

## 4. EL DNA DESIGNER RAIL — VISIÓN UI/UX

> *"Que se sienta como pilotar un mech, no como llenar un formulario."*

### 4.1 · Anatomía del Rail (panel derecho de Hephaestus)

```
┌─────────────────────────────────────────────────┐
│  ◉ CORAZÓN LATINO v3                  [SAVE]    │ ← Header (narrativa)
│  by radwulf · "el latido del barrio"            │
├─────────────────────────────────────────────────┤
│                                                 │
│           ◢◣  THE GENOME CHAMBER  ◢◣            │ ← Sección I
│          ┌─────────────────────┐                │
│          │     [ACO CUBE 3D]    │                │  cubo isométrico,
│          │   pulsing dot       │                │  el punto pulsa al
│          │   showing genome    │                │  ritmo del BPM
│          └─────────────────────┘                │
│   A ▓▓▓▓▓▓▓░░░ 0.73   "Aggressive heart"        │ ← lectura semántica
│   C ▓▓▓░░░░░░░ 0.31   "Steady rhythm"           │   auto-generada
│   O ▓▓▓▓▓▓▓▓░░ 0.82   "Pure flesh"              │
│                                                 │
├─────────────────────────────────────────────────┤
│        ⚔  ARCHETYPE LOADOUT  ⚔                  │ ← Sección II
│                                                 │
│   ┌─Active (3/6)─────────────────────────┐      │
│   │  ❤ LATIN_HEART  ✕                    │      │ ← chips activos
│   │  ◆ HEAVY        ✕                    │      │   con glyph
│   │  ◉ PULSE        ✕                    │      │
│   └──────────────────────────────────────┘      │
│                                                 │
│   ┌─Available (filtered)─────────────────┐      │
│   │  ⚡STROBE  ◇LIQUID  ✦DIVINE          │      │
│   │  ░DIRTY   ◈CRYSTAL  ⌖SURGICAL       │      │
│   │  (BERGHAIN  hidden: antagonist of    │      │ ← antagonistas
│   │   LATIN_HEART)                       │      │   ocultos/tachados
│   └──────────────────────────────────────┘      │
│                                                 │
├─────────────────────────────────────────────────┤
│       🔥  ENERGY THERMOMETER  🔥                 │ ← Sección III
│                                                 │
│   silence  valley  ambient gentle active intense peak │
│   ░░░░░░░░░░░░░░░░░░░░░░░░██████████████████████████  │
│                          [▲────────▲]                  │ ← drag range
│                                                        │
│   Effect lives between ACTIVE and PEAK.                │
│                                                 │
├─────────────────────────────────────────────────┤
│        🌍 VIBE COMPATIBILITY                     │ ← Sección IV
│                                                 │
│   [✓ fiesta-latina] [○ techno-club]             │ ← multi-toggle
│   [○ pop-rock]      [○ chill-lounge]            │   con visual
│   [○ idle]                                      │   afinidad
│                                                 │
├─────────────────────────────────────────────────┤
│        ⚠  GATEKEEPER LINTER (live)              │ ← Sección V
│                                                 │
│   ✓ Energy zone consistent with archetypes      │
│   ⚠ STROBE active but isStrobe flag is FALSE    │
│   ✗ Conflict: DIVINE requires zone=peak only    │
│      Current zone allows ACTIVE — Selene will   │
│      block this in ACTIVE songs.                │
│      [Fix automatically] [Ignore]               │
│                                                 │
├─────────────────────────────────────────────────┤
│   [ EXPERT MODE ▾ ]      [ ⬇ EXPORT .lfx ]      │ ← Footer
└─────────────────────────────────────────────────┘
```

### 4.2 · Las 5 Secciones del Rail

#### **Sección I — The Genome Chamber** *(visual hero)*

- **El cubo ACO ya existe** en `DnaRail.tsx` (SVG isométrico). Lo mantenemos pero con upgrades:
  - El punto **pulsa al BPM** del último frame de audio que pasó por Selene (suscripción a un store ligero).
  - Cuando el usuario agrega un arquetipo, el punto se anima con un **trail de partículas** hacia su nueva posición (~300ms cubic-bezier).
  - Las caras del cubo **se iluminan** en la región dominante (si A>0.7, la cara A brilla naranja).
- **Sliders ACO ocultos por defecto**. Solo se muestran en *Expert Mode*. En modo normal, debajo del cubo aparecen **lecturas semánticas auto-generadas**:
  - `A=0.73` → *"Aggressive heart"*
  - `A=0.20` → *"Gentle touch"*
  - (Tabla de 5 niveles × 3 ejes = 15 frases canónicas. Las define el equipo creativo.)

#### **Sección II — Archetype Loadout** *(el corazón de la UX)*

**Inspiración:** loadouts de Street Fighter 6 (selección de moves) + perks de Cyberpunk 2077 (familias visuales) + sintetizador modular (módulos drag-and-drop con visual feedback inmediato).

**Interacción:**
- Los arquetipos viven en una **grilla 4×5** debajo de los activos.
- Cada uno es una **tarjeta con glyph + nombre + microvector** (mini-cubo 16×16px que muestra su presión sobre ACO).
- Click → se mueve al área "Active" arriba con animación de **chip flotante**.
- En el cubo principal, el efecto del arquetipo se previsualiza con un **fantasma del punto** mientras el mouse pasa por encima (hover preview).
- **Antagonistas** del loadout actual se atenúan a 30% opacity, con un símbolo `⊘` y tooltip: *"Antagonist of HEAVY"*.
- **Máximo 6 arquetipos activos.** Si el usuario intenta agregar un 7º, vibra el panel y aparece toast: *"Loadout saturated. Remove one first."*

**Reglas visuales por familia:**
- Motion → tinte azul
- Intensity → tinte rojo
- Texture → tinte púrpura
- Context → tinte verde
- Signature → tinte dorado

#### **Sección III — Energy Thermometer**

- Una barra horizontal segmentada en las **7 zonas** (silence → peak), con los **colores oficiales** que ya usa Selene en su HUD.
- Dos handles `[▲────▲]` que el usuario arrastra para definir `min` y `max`.
- Debajo, frase generada: *"Effect lives between ACTIVE and PEAK."*
- **Sugerencia automática:** si el loadout incluye `STROBE` + `DIVINE`, la UI sugiere "Auto-set to ACTIVE..PEAK" con un botón.
- **Validación cruzada con arquetipos:** si el usuario tiene `AMBIENT` activo pero arrastra el handle al rango `peak`, la barra se pinta de rojo y el Linter dispara warning.

#### **Sección IV — Vibe Compatibility**

- **5 chips toggle** (las 5 vibes reales de LuxSync).
- Cada chip muestra una **mini-card con afinidad**: si el genoma actual cae cerca del centroide DNA de los efectos de esa vibe, el chip se ilumina con un halo dorado: *"Strong match"*.
- Si el usuario marca todas las vibes → tooltip: *"Universal effect. Selene will compete against vibe-specialists."* (No es prohibido, pero advertido.)

#### **Sección V — Gatekeeper Linter (THE GUARDIAN)**

Esto merece su propia sección. Ver §5.

### 4.3 · El Modo Expert (escape hatch)

Un toggle en el footer abre un drawer con:
- Sliders ACO directos (mismos de `DnaRail.tsx` actual, pero ahora con badge `[MANUAL OVERRIDE]`).
- Editor de `simulationMeta` (cooldown ms, GPU cost, fatigue, flags).
- Editor de `safetyDeclaration` (max strobe Hz, containsRapidFlash).
- Botón rojo **"Reset to archetypes"** (volver a la realidad proyectada).

> **Filosofía:** El modo Expert existe para **mí (Cascade)**, para **el Genesis Engine**, y para **diseñadores que entienden la matemática**. No es un escape, es un microscopio.

### 4.4 · Animaciones clave (que el usuario debe sentir)

| Evento | Animación | Duración |
|---|---|---|
| Add archetype | Chip vuela de grid a loadout, cubo dot translada con trail | 350ms ease-out-cubic |
| Remove archetype | Chip se desintegra en partículas que vuelven a la grid | 300ms |
| BPM pulse | Dot escala 1.0 → 1.15 → 1.0 sincronizado con kick | continuo |
| Linter warning new | El badge `⚠` aparece con flash naranja + leve shake del rail | 200ms |
| Linter error | Botón EXPORT se bloquea, ripple rojo recorre todo el rail | 400ms |
| Manual override | Halo púrpura permanente alrededor del cubo | static |
| Export success | Confeti minimalista + cubo gira 360° una vez | 800ms |

### 4.5 · Tipografía y voz

- **Display:** mono geométrico (Eurostile / JetBrains Mono Bold) para labels técnicos.
- **Body:** sans humano para frases semánticas (*"Aggressive heart"* debe sentirse escrita por una persona, no un compilador).
- **Voz de los warnings:** firme, sin condescendencia. *"This will be blocked in ambient zones. Sure?"* — nunca *"Oops! Looks like you might have a problem!"*.

---

## 5. EL GATEKEEPER LINTER — UX DE SEGURIDAD

### 5.1 · Filosofía

> **El usuario debe entender POR QUÉ Selene rechazaría el efecto, ANTES de exportarlo.**
> No queremos que cargue un `.lfx` en el show y descubra a las 3 AM que nunca dispara.

El Linter es un **compilador semántico**: aplica las reglas reales del Gatekeeper de Selene (extraídas en `SELENE-REALITY-MAPPING.md`) en tiempo real sobre el átomo en edición, y devuelve `GatekeeperWarning[]`.

### 5.2 · Interface TS de warnings

```typescript
export type WarningSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface GatekeeperWarning {
  readonly id: string                          // 'STROBE_FLAG_MISMATCH'
  readonly severity: WarningSeverity
  readonly title: string                       // 1 línea
  readonly explanation: string                 // 2-3 líneas, humana
  readonly affectedFields: readonly string[]  // ['simulationMeta.isStrobe']
  readonly seleneCorrelation: {
    readonly engine: 'Gatekeeper' | 'DNAAnalyzer' | 'FuzzyDecision' |
                     'EnergyConsciousness' | 'MoodController'
    readonly rule: string                      // 'DICTATOR_HARD_MINIMUM_COOLDOWNS'
    readonly threshold?: number
  }
  readonly autoFix?: {
    readonly label: string                     // "Fix automatically"
    readonly action: (clip: LfxClipInstance) => void
  }
}
```

### 5.3 · Las 12 Reglas del Linter v1

Mapeadas 1-a-1 contra `SELENE-REALITY-MAPPING.md`:

| # | ID | Severidad | Disparador | Engine de Selene |
|---|---|---|---|---|
| 1 | `STROBE_FLAG_MISMATCH` | warning | Archetype `STROBE` ∧ `simulationMeta.isStrobe === false` | EffectDreamSimulator |
| 2 | `STROBE_IN_LOW_ZONE` | error | `isStrobe === true` ∧ `energyZone.min < ambient` | EnergyConsciousness |
| 3 | `STROBE_FREQ_UNDECLARED` | critical | `isStrobe === true` ∧ `safety.maxStrobeFreqHz === 0` | SafetyDeclaration G6 |
| 4 | `STROBE_FREQ_DANGEROUS` | critical | `safety.maxStrobeFreqHz > 25` ∧ `safety.containsRapidFlash` | Epilepsy safety |
| 5 | `DIVINE_NOT_PEAK` | error | Archetype `DIVINE` ∧ `energyZone.max < peak` | DecisionMaker drop logic |
| 6 | `HEAVY_NO_COOLDOWN` | warning | Archetype `HEAVY` ∧ `simulationMeta.cooldownMs < 12000` | DICTATOR_HARD_MINIMUM_COOLDOWNS |
| 7 | `ANTAGONISTS_IGNORED` | warning | Cualquier antagonista presente (caso Expert override) | (estructural) |
| 8 | `EMPTY_VIBE_LIST` | warning | `anchoredVibes.size === 0` | DNAAnalyzer (efecto invisible para vibe filter) |
| 9 | `GENOME_OFF_ARCHETYPES` | info | `manualGenomeOverride` activo y desviación > 0.25 L2 | (estructural / Expert) |
| 10 | `TEXTURE_FORCED_CONFLICT` | warning | Dos arquetipos fuerzan `textureAffinity` distinto | ArchetypeProjector |
| 11 | `BLOCKED_BY_MOOD` | info | Effect name match `MOOD_PROFILES.calm.blockList` | MoodController |
| 12 | `COOLDOWN_VS_DURATION` | warning | `cooldownMs < minDurationMs * 1.5` | EffectManager |

### 5.4 · Render del Linter

En la sección V del rail, los warnings aparecen como **stack vertical de cards**:

```
┌─────────────────────────────────────────────────────┐
│  ✗ STROBE_IN_LOW_ZONE                  [critical]   │
│                                                     │
│  You added STROBE but the energy range includes     │
│  SILENCE and VALLEY. Selene's EnergyConsciousness  │
│  engine will suppress strobes below ambient zone    │
│  (threshold 0.30) to prevent retinal damage.        │
│                                                     │
│  Affects: energyZone.min                            │
│  Rule: EnergyConsciousness.zoneThresholds.ambient   │
│                                                     │
│  [Auto-fix: Set min=ambient]    [Dismiss]           │
└─────────────────────────────────────────────────────┘
```

- **Severity colors:** info=cyan, warning=naranja, error=rojo, critical=rojo pulsante.
- **Auto-fix:** ejecuta `warning.autoFix.action(clip)` con `withConfirmation: false` para warnings, `true` para errors/criticals.
- **El botón EXPORT está bloqueado** mientras haya warnings de severidad `error` o `critical`.
- **Banner de éxito:** cuando todos los warnings son `info` o no hay ninguno: *"✅ Selene will love this."*

### 5.5 · El "Simulator Preview" (stretch goal)

Botón secundario *"Simulate against last show audio"*:
- Carga los últimos 60 segundos del log de audio del show actual.
- Corre el `EffectDreamSimulator` con este clip como candidato.
- Reporta: *"Would have been triggered 3 times in last 60s. Best confidence: 0.78 at t=42.3s (chorus). Blocked by cooldown 1x."*
- Si nunca dispara → warning visible: *"Effect never met threshold. Consider lowering aggressionRange.min or adding BUILDUP archetype."*

---

## 6. EL CICLO COMPLETO — NARRATIVA DE USO

### 6.1 · "Radwulf crea Corazón Latino v3" (storyboard)

> **T+0s.** Radwulf duplica un clip vacío en la timeline de Hephaestus. El DNA Designer Rail aparece a la derecha con un átomo neutro: `genome: {0.5, 0.5, 0.5}`, cubo apagado, mensaje *"Tabula rasa. Pick an archetype to begin."*

> **T+4s.** Radwulf hace click en `LATIN_HEART` (dorado, glyph ❤). El chip vuela al loadout, el punto del cubo se desliza con un trail naranja hacia (0.50, 0.40, 0.65). Debajo del cubo aparecen las frases: *"Balanced heart"*, *"Steady rhythm"*, *"Warm flesh"*. El termómetro de energía resalta automáticamente la zona `gentle..intense`.

> **T+10s.** Radwulf agrega `HEAVY`. El punto vuela a (0.85, 0.55, 0.50). La frase A cambia a *"Brutal heart"*. El Linter dispara un warning naranja: *"HEAVY archetype: consider cooldown ≥12s (DICTATOR_HARD_MINIMUM)"*. Hay un botón **[Auto-fix]**. Lo pulsa. Cooldown se setea a 12000ms.

> **T+15s.** Agrega `PULSE`. Tres chips activos. La grid de abajo atenúa `STROBE`, `LIQUID`, `AMBIENT` (antagonistas o conflictivos). El cubo ahora tiene su cara A iluminada en naranja brillante.

> **T+22s.** Click en chip de vibe `fiesta-latina`. Halo dorado. *"Strong match — current genome is 0.12 from latin centroid."* Marca también `pop-rock` por las dudas. Halo amarillo: *"Acceptable match."*.

> **T+35s.** Arrastra los handles del termómetro de energía: min=ambient, max=peak. Linter satisfecho. *"✅ Selene will love this."*.

> **T+42s.** Radwulf cura los detalles narrativos: nombre `"Corazón Latino v3"`, story `"el latido del barrio"`. Click en EXPORT.

> **T+43s.** Animación: el cubo gira 360°, confeti minimalista, el átomo se congela en `LfxClipV2`, se serializa a `corazon_latino_v3.lfx` y se registra en `DynamicEffectRegistry`. Selene puede ahora dispararlo en producción.

> **T+45s.** El Genesis Engine (cuando esté online) detecta el nuevo blueprint, calcula su SHA-256, lo inserta en `lfx_blueprints` con `immutable=1`. Empieza a generar mutaciones nocturnas.

### 6.2 · Lo que el usuario nunca tuvo que saber

- Que `aggression` era un número entre 0 y 1.
- Que la zona `ambient` empezaba en 0.30.
- Que `DICTATOR_HARD_MINIMUM_COOLDOWNS['core_meltdown'] = 12000`.
- Que el Gatekeeper aplica un multiplicador de mood de 2.2× en BALANCED.

**Todo eso vive en el código.** El usuario habla en metáforas. La clase traduce. La UI lo cuenta. El Linter avisa.

---

## 7. ROADMAP DE IMPLEMENTACIÓN

| Fase | Entregable | Dependencias | LOC estimadas |
|---|---|---|---|
| **F1** | `LfxClipInstance` class + `ArchetypeProjector` + `ARCHETYPE_REGISTRY` (20 entradas) | `lfxTypes.ts` existente | ~600 |
| **F2** | `GatekeeperLinter` con las 12 reglas v1 + tests unitarios | F1 + audit `SELENE-REALITY-MAPPING.md` | ~400 |
| **F3** | `inferArchetypes()` (reverse lookup ACO→tags) | F1 | ~150 |
| **F4** | Rediseño completo de `DnaRail.tsx` siguiendo §4 | F1, F2, CSS tokens | ~800 |
| **F5** | Componentes shared: `GenomeCube3D`, `ArchetypeCard`, `EnergyThermometer`, `LinterPanel` | F4 | ~500 |
| **F6** | Animaciones (Framer Motion o CSS keyframes) + sonido sutil opcional | F5 | ~200 |
| **F7** | "Simulate against last show" stretch goal | EffectDreamSimulator API | ~300 |
| **F8** | Hooks para WAVE-5000: `spawnMutations`, `geneticDistance`, checksum stable | F1 + WAVE-5000 inicial | ~250 |

**Estimación total:** ~3200 LOC de TS/TSX, ~600 LOC de CSS, ~150 LOC de tests.

---

## 8. CONCLUSIÓN — LA MAGIA DETRÁS DEL TELÓN

> Selene es una máquina implacable que solo entiende 3 números y 7 zonas.
> El usuario es un artista que piensa en *"el latido del barrio"*.
>
> La `LfxClipInstance` es el **rito de pasaje** entre los dos.
>
> El DNA Designer Rail es el **altar** donde se celebra ese rito.
>
> El Gatekeeper Linter es el **sacerdote** que valida la ofrenda antes de entregarla.
>
> Y todo esto, con la disciplina suficiente para que mañana — cuando el Genesis Engine despierte — pueda tomar cada átomo congelado y empezar a mutarlo en la oscuridad, sin que nadie tenga que explicarle lo que es un *"corazón latino"*. Porque el ACO ya lo dice todo.

---

*Documento redactado por Cascade · Opus Pro Tier · bajo directiva creativa WAVE 4816 · 2026-05-21*
