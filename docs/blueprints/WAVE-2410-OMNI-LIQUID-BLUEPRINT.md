# WAVE 2410 — THE OMNI-LIQUID BLUEPRINT

> *"Un motor. Siete zonas. Infinitos géneros."*

**Estado:** Diseño estructural para revisión del Arquitecto  
**Restricción:** CERO duplicación de motor. DRY absoluto. Agnóstico al género.

---

## 0. ESTADO ACTUAL (Pre-2410)

```
electron-app/src/hal/physics/
├── LiquidStereoPhysics.ts    ← Motor 7.1 (6 LiquidEnvelopes + 1 strobe)
├── LiquidEnvelope.ts          ← Clase universal de banda
├── TechnoStereoPhysics.ts     ← God Mode 4.1 legacy (sigue vivo)
├── RockStereoPhysics2.ts      ← Motor Rock legacy
├── LatinoStereoPhysics.ts     ← Motor Latino legacy
├── ChillStereoPhysics.ts      ← Motor Chill legacy
├── LaserPhysics.ts            ← Láseres (Photon Weaver)
├── WasherPhysics.ts           ← Washers (Lienzo de Fondo)
└── index.ts
```

**Problema:** Las 6 configs `SUBBASS_CONFIG`, `KICK_CONFIG`, `VOCAL_CONFIG`, `SNARE_CONFIG`, `HIGHMID_CONFIG`, `TREBLE_CONFIG` y los multiplicadores del Cross-Filter (`0.2`, `0.4`, `0.3`), gates inline (`MOVER_R_GATE = 0.14`), y las constantes del Bass Subtractor (`0.65 - morph * 0.45`) están todos hardcodeados dentro de `LiquidStereoPhysics.ts`.

**Consecuencia:** Para calibrar para Latino o Rock habría que duplicar el motor entero. Inaceptable.

---

## 1. LA INTERFAZ DEL PERFIL (`ILiquidProfile`)

### 1.1 Contrato

```typescript
// electron-app/src/hal/physics/profiles/ILiquidProfile.ts

import type { LiquidEnvelopeConfig } from '../LiquidEnvelope'

/**
 * Perfil completo de calibración para el motor Omni-Liquid 7.1.
 * Contiene TODA la parametría que varía entre géneros.
 * El motor no tiene NI UNA constante numérica propia — todo viene del perfil.
 */
export interface ILiquidProfile {
  /** Identificador único del perfil (para telemetría y debug) */
  readonly id: string
  /** Nombre legible ('Techno Industrial', 'Reggaetón Club', etc.) */
  readonly name: string

  // ═══════════════════════════════════════════════════════════════
  // ENVELOPE CONFIGS — Las 6 personalidades de los LiquidEnvelope
  // ═══════════════════════════════════════════════════════════════

  /** Front L — zona de subgraves continuos */
  readonly envelopeSubBass: LiquidEnvelopeConfig
  /** Front R — zona de kick/golpe */
  readonly envelopeKick: LiquidEnvelopeConfig
  /** Back L — zona de medios (voces, synths, coro) */
  readonly envelopeVocal: LiquidEnvelopeConfig
  /** Back R — zona percusiva (snare, hihat, el látigo) */
  readonly envelopeSnare: LiquidEnvelopeConfig
  /** Mover L — zona de presencia (melodías tonales) */
  readonly envelopeHighMid: LiquidEnvelopeConfig
  /** Mover R — zona de agudos (sweeps, brillo) */
  readonly envelopeTreble: LiquidEnvelopeConfig

  // ═══════════════════════════════════════════════════════════════
  // CROSS-FILTER COEFFICIENTS — Acondicionamiento de señal pre-envelope
  // ═══════════════════════════════════════════════════════════════

  /** 
   * Back R: Aislamiento de agudos.
   * rawRight = max(0, treble - mid × percMidSubtract)
   * Techno: 0.2 | Latino: 0.1 (más permisivo con percusión tonal)
   */
  readonly percMidSubtract: number

  /**
   * Back R: Gate + Boost del Schwarzenegger.
   * Solo se dispara si rawRight > percGate. Post-gate: pow(gated, percExponent) × percBoost.
   * Techno: gate=0.14, boost=8.0, exp=1.2 | Rock: gate=0.10, boost=6.0, exp=1.5
   */
  readonly percGate: number
  readonly percBoost: number
  readonly percExponent: number

  /**
   * Back L: Bass Subtractor adaptativo.
   * subtractFactor = bassSubtractBase - morphFactor × bassSubtractRange
   * Techno: base=0.65, range=0.45 | Latino: base=0.40, range=0.25
   */
  readonly bassSubtractBase: number
  readonly bassSubtractRange: number

  /**
   * Mover L: Cross-filter coefficients.
   * input = max(0, highMid + mid × moverLMidAdd - treble × moverLTrebleSub)
   * Techno: midAdd=0.4, trebleSub=0.3
   */
  readonly moverLMidAdd: number
  readonly moverLTrebleSub: number

  /**
   * Mover R: Cross-filter coefficient.
   * input = max(0, treble - mid × moverRMidSub)
   * Techno: 0.2 | Rock: 0.3 (más agresivo con voces)
   */
  readonly moverRMidSub: number

  // ═══════════════════════════════════════════════════════════════
  // SIDECHAIN GUILLOTINE — Control de ducking
  // ═══════════════════════════════════════════════════════════════

  /**
   * Fronts ducking sobre Movers.
   * Si frontMax > sidechainThreshold: ducking = 1.0 - frontMax × sidechainDepth
   * Techno: threshold=0.1, depth=0.90 | Chill: threshold=0.2, depth=0.60
   */
  readonly sidechainThreshold: number
  readonly sidechainDepth: number

  /**
   * Snare sidechain sobre Back L.
   * snareGate = 1.0 - snareAttack × snareSidechainDepth
   * Techno: 0.80 | Latino: 0.50 (la conga no ahoga la melodía)
   */
  readonly snareSidechainDepth: number

  // ═══════════════════════════════════════════════════════════════
  // STROBE — Umbrales del trigger binario
  // ═══════════════════════════════════════════════════════════════

  /** Umbral base de treble para strobe */
  readonly strobeThreshold: number
  /** Duración del strobe en ms */
  readonly strobeDuration: number
  /** Descuento de threshold en noiseMode (multiplicador 0-1) */
  readonly strobeNoiseDiscount: number

  // ═══════════════════════════════════════════════════════════════
  // MODES — Umbrales de detección de Acid/Noise/Apocalypse
  // ═══════════════════════════════════════════════════════════════

  readonly harshnessAcidThreshold: number
  readonly flatnessNoiseThreshold: number
  /** Apocalypse Mode: harshness > X && flatness > Y → chaos */
  readonly apocalypseHarshness: number
  readonly apocalypseFlatness: number

  // ═══════════════════════════════════════════════════════════════
  // KICK EDGE — Intervalo mínimo para considerar un kick como "edge"
  // ═══════════════════════════════════════════════════════════════

  /** ms mínimos entre kicks para que se considere edge (anti-garbage) */
  readonly kickEdgeMinInterval: number
  /** Frames de veto post-kick (Back L veto input kill) */
  readonly kickVetoFrames: number
}
```

### 1.2 Por qué esta granularidad

Cada número en la interfaz corresponde a un valor que **actualmente está hardcodeado** en `LiquidStereoPhysics.ts`. No se inventó ni un parámetro que no exista ya. La interfaz es un **espejo 1:1 del motor actual**, solo que externalizado.

### 1.3 Lo que NO entra en el perfil

| Concepto | Razón |
|----------|-------|
| `morphFactor` (cálculo EMA) | Universal. El morph se calcula igual en todos los géneros. Es una medida objetiva de la complejidad armónica de la señal. |
| `LiquidEnvelope.process()` | La física del envelope es invariante. Solo cambian sus parámetros de config. |
| AGC Rebound (`RECOVERY_DURATION`) | Propiedad del hardware de captura, no del género. |
| Ruteo asimétrico (qué banda → qué zona) | Invariante. Ver §2. |

---

## 2. EL RUTEO ASIMÉTRICO UNIFICADO (Core Routing)

### 2.1 Axioma Arquitectónico

> **El ruteo hemisférico es INVARIANTE.** No importa si suena Boris Brejcha, Bad Bunny o Metallica. Las zonas físicas del escenario no cambian de posición. Lo que cambia es la *sensibilidad* (configs) y el *acondicionamiento* (coefficients), nunca la *asignación*.

### 2.2 Mapa Fijo de Zonas

```
╔══════════════════════════════════════════════════════════════════╗
║                    ESCENARIO (Vista Aérea)                      ║
║                                                                  ║
║  ┌─────────────────────┐         ┌─────────────────────┐        ║
║  │  MOVER L            │         │  MOVER R             │        ║
║  │  Presencia/Melodía  │         │  Brillo/Sweeps       │        ║
║  │  highMid + mid×α    │         │  treble − mid×β      │        ║
║  │  − treble×γ         │         │                      │        ║
║  └─────────────────────┘         └─────────────────────┘        ║
║                                                                  ║
║  ┌─────────────────────┐         ┌─────────────────────┐        ║
║  │  BACK L (El Coro)   │         │  BACK R (El Látigo)  │        ║
║  │  Mid Synths/Vocals  │         │  Snare/HiHat         │        ║
║  │  mid − bass×sf      │         │  treble gate+boost   │        ║
║  │  + kickVeto + snGate │         │  Schwarzenegger Port │        ║
║  └─────────────────────┘         └─────────────────────┘        ║
║                                                                  ║
║  ┌─────────────────────┐         ┌─────────────────────┐        ║
║  │  FRONT L (Océano)   │         │  FRONT R (Francotirador)│    ║
║  │  SubBass continuo   │         │  Kick Edge only       │      ║
║  │  bands.subBass raw  │         │  bands.bass × isEdge  │      ║
║  └─────────────────────┘         └─────────────────────┘        ║
║                                                                  ║
║                    ┌───── STROBE ─────┐                          ║
║                    │  Binary trigger   │                          ║
║                    │  treble + ultraAir│                          ║
║                    └──────────────────┘                          ║
╚══════════════════════════════════════════════════════════════════╝
```

### 2.3 Hemisferios

| Hemisferio | Función | Zonas | Banda dominante |
|------------|---------|-------|-----------------|
| **DERECHO** | Ritmo / Percusión / Brillo | Front R, Back R, Mover R | Bass (kick), Treble (hihat) |
| **IZQUIERDO** | Armonía / Atmósfera / Melodía | Front L, Back L, Mover L | SubBass (groove), Mid (vocal), HighMid (presencia) |

### 2.4 Diferencia con la propuesta del usuario

La propuesta sugería "Mover R = Voces" y "Mover L = Melodías tonales con flatness invertido". Sin embargo, el motor actual (probado en producción WAVE 2408M+N) tiene:

- **Mover R = Schwarzenegger** (`treble − mid×0.2`) → agudos/sweeps/brillo. Funciona impecable.
- **Mover L = Presencia** (`highMid + mid×0.4 − treble×0.3`) → cuerpo melódico. Funciona impecable.

**Recomendación:** Mantener el ruteo actual (probado) como el DEFAULT. Si el Arquitecto quiere invertir los movers para un género específico, los coeficientes del perfil lo permiten sin tocar el motor:

```typescript
// "Invertir" movers = cambiar los coeficientes
// Mover L con más treble → moverLTrebleSub: -0.2 (sumando en vez de restando)
// Mover R con más mid → moverRMidSub: -0.3 (sumando)
```

Los coeficientes pueden ser negativos — el `Math.max(0, ...)` sigue protegiendo.

---

## 3. INYECCIÓN DE DEPENDENCIAS

### 3.1 Patrón: Hot-Swap Profile

El motor `LiquidStereoPhysics` recibe el perfil en el **constructor** y lo usa como `readonly`. Para cambiar de perfil: se **crea una nueva instancia** del motor con el nuevo perfil. Esto garantiza:

1. **Estado limpio** — Los LiquidEnvelopes se recrean con las nuevas configs. No hay residuos del genre anterior en el decay o la peak memory.
2. **Thread safety** — No hay mutación concurrente. Un frame usa un motor, el siguiente usa otro.
3. **Simplicidad** — No hay setters, no hay re-configuración parcial, no hay estados transitorios inconsistentes.

### 3.2 Contrato del Motor Refactorizado

```typescript
// LiquidStereoPhysics.ts (post-refactor)

export class LiquidStereoPhysics {
  private readonly profile: ILiquidProfile

  // Los 6 envelopes se crean con las configs del perfil
  private readonly envSubBass: LiquidEnvelope
  private readonly envKick: LiquidEnvelope
  private readonly envVocal: LiquidEnvelope
  private readonly envSnare: LiquidEnvelope
  private readonly envHighMid: LiquidEnvelope
  private readonly envTreble: LiquidEnvelope

  constructor(profile: ILiquidProfile) {
    this.profile = profile
    this.envSubBass = new LiquidEnvelope(profile.envelopeSubBass)
    this.envKick    = new LiquidEnvelope(profile.envelopeKick)
    this.envVocal   = new LiquidEnvelope(profile.envelopeVocal)
    this.envSnare   = new LiquidEnvelope(profile.envelopeSnare)
    this.envHighMid = new LiquidEnvelope(profile.envelopeHighMid)
    this.envTreble  = new LiquidEnvelope(profile.envelopeTreble)
  }

  // applyBands() NO CAMBIA su firma.
  // Internamente usa this.profile.percGate en vez de MOVER_R_GATE, etc.
  applyBands(input: LiquidStereoInput): LiquidStereoResult { ... }
}
```

### 3.3 SeleneLux: Factory + Swap

```typescript
// SeleneLux.ts (extracto conceptual del switch)

import { TECHNO_PROFILE } from '../../hal/physics/profiles/techno'
import { LATINO_PROFILE } from '../../hal/physics/profiles/latino'
import { ROCK_PROFILE }   from '../../hal/physics/profiles/rock'
import { CHILL_PROFILE }  from '../../hal/physics/profiles/chill'

// Registry: vibe → perfil
const PROFILE_REGISTRY: Record<string, ILiquidProfile> = {
  'techno':  TECHNO_PROFILE,
  'electro': TECHNO_PROFILE,
  'latino':  LATINO_PROFILE,
  'rock':    ROCK_PROFILE,
  'chill':   CHILL_PROFILE,
}

class SeleneLux {
  private liquidEngine: LiquidStereoPhysics
  private currentProfileId: string = ''

  private ensureProfile(vibeNormalized: string): void {
    // Buscar match en el registry
    const profileKey = Object.keys(PROFILE_REGISTRY)
      .find(key => vibeNormalized.includes(key))
      ?? 'techno'  // fallback: techno como default universal

    // Solo recrear si cambió el perfil
    if (profileKey !== this.currentProfileId) {
      this.liquidEngine = new LiquidStereoPhysics(PROFILE_REGISTRY[profileKey])
      this.currentProfileId = profileKey
    }
  }

  updateFromTitan(/* ... */): void {
    // ...
    this.ensureProfile(vibeNormalized)
    const liquidResult = this.liquidEngine.applyBands(liquidInput)
    // ...
  }
}
```

### 3.4 ¿Por qué NO inyección por setter / método?

| Alternativa | Problema |
|-------------|----------|
| `engine.setProfile(p)` | El estado interno de los 6 envelopes (intensity, avgSignal, peak) corresponde a la calibración anterior. Un decay de 0.65 con un peak calculado con boost=3.0 se usa con un boost=8.0 → glitch visual.  |
| Reconfigurable envelopes | `LiquidEnvelope` tendría que exponer setters para 13 parámetros y gestionar la transición del estado. Complejidad innecesaria. |
| Factory sola (sin caché) | Crear `new LiquidStereoPhysics()` cada frame = 6 `new LiquidEnvelope()` por frame = basura para el GC. El caché por `currentProfileId` evita esto. |

### 3.5 Transición entre perfiles

El cambio de perfil es **instantáneo** (hard cut). No hay crossfade entre motores. Razón:

1. El cambio de vibe ya ocurre en transiciones naturales (break entre canciones, cambio de mood detectado).
2. El nuevo motor arranca con state=0 en todos los envelopes → fade-in natural por el propio attack/boost.
3. Crossfade entre dos motores de 6 envelopes cada uno = 12 envelopes simultáneos por 180 frames = complejidad sin valor perceptible.

---

## 4. ESTRUCTURA DE ARCHIVOS

### 4.1 Jerarquía Propuesta

```
electron-app/src/hal/physics/
├── profiles/                          ← NUEVO: carpeta de perfiles
│   ├── ILiquidProfile.ts             ← Interfaz + type exports
│   ├── techno.ts                     ← TECHNO_PROFILE: const exportado
│   ├── rock.ts                       ← ROCK_PROFILE
│   ├── latino.ts                     ← LATINO_PROFILE
│   ├── chill.ts                      ← CHILL_PROFILE
│   └── index.ts                      ← Re-exports + PROFILE_REGISTRY
│
├── LiquidStereoPhysics.ts            ← Motor refactorizado (import ILiquidProfile)
├── LiquidEnvelope.ts                 ← SIN CAMBIOS (ya es universal)
├── TechnoStereoPhysics.ts            ← God Mode legacy (coexiste, no se toca)
├── index.ts                          ← Añadir exports de profiles
└── ...
```

### 4.2 Convención de Archivo de Perfil

Cada perfil es un archivo **puro de datos**: un `const` que satisface `ILiquidProfile`. Sin lógica, sin funciones, sin imports pesados. Solo números calibrados + comentarios de origen.

```typescript
// profiles/techno.ts (estructura conceptual)

import type { ILiquidProfile } from './ILiquidProfile'

/**
 * TECHNO INDUSTRIAL PROFILE
 * Extraído 1:1 del motor LiquidStereoPhysics WAVE 2408M+2408N.
 * Cada valor está documentado con la WAVE de origen y el test de referencia.
 */
export const TECHNO_PROFILE: ILiquidProfile = {
  id: 'techno-industrial',
  name: 'Techno Industrial',

  envelopeSubBass: { /* SUBBASS_CONFIG actual */ },
  envelopeKick:    { /* KICK_CONFIG actual */ },
  envelopeVocal:   { /* VOCAL_CONFIG actual */ },
  envelopeSnare:   { /* SNARE_CONFIG actual */ },
  envelopeHighMid: { /* HIGHMID_CONFIG actual */ },
  envelopeTreble:  { /* TREBLE_CONFIG actual */ },

  // Cross-filter (WAVE 2408M+N)
  percMidSubtract: 0.2,
  percGate: 0.14,
  percBoost: 8.0,
  percExponent: 1.2,

  bassSubtractBase: 0.65,
  bassSubtractRange: 0.45,

  moverLMidAdd: 0.4,
  moverLTrebleSub: 0.3,
  moverRMidSub: 0.2,

  // Sidechain
  sidechainThreshold: 0.1,
  sidechainDepth: 0.90,
  snareSidechainDepth: 0.80,

  // Strobe
  strobeThreshold: 0.80,
  strobeDuration: 30,
  strobeNoiseDiscount: 0.80,

  // Modes
  harshnessAcidThreshold: 0.60,
  flatnessNoiseThreshold: 0.70,
  apocalypseHarshness: 0.55,
  apocalypseFlatness: 0.55,

  // Kick
  kickEdgeMinInterval: 150,
  kickVetoFrames: 5,
}
```

### 4.3 Relación con los Vibes existentes

Los vibes de `VibeManager` (`engine/vibe/profiles/`) controlan **colores, moods y restricciones visuales**. Los `ILiquidProfile` controlan **física de reactividad**. Son capas ortogonales:

```
VibeManager (engine/vibe/)  →  QUÉ COLORES usar
ILiquidProfile (hal/physics/profiles/)  →  CÓMO REACCIONAR al audio
```

SeleneLux es el puente: recibe el vibe del TitanEngine, selecciona el `ILiquidProfile` correspondiente, y alimenta el motor.

---

## 5. MECÁNICAS EXCLUSIVAS DE GÉNERO

### 5.1 El Problema

Hay lógicas que parecen únicas de un género:

| Mecánica | Género actual | Descripción |
|----------|--------------|-------------|
| **The Schwarzenegger** (percGate + percBoost + percExponent) | Techno | Gate duro + boost masivo para hihat isolation |
| **Kick Veto** (kickVetoFrames) | Techno | Silencia Back L durante N frames post-kick |
| **Bass Subtractor** (bassSubtractBase) | Techno | Resta bass del mid para aislar voces |
| **Sidechain Guillotine** (sidechainDepth) | Techno | Ducks movers cuando fronts disparan |
| **Apocalypse Mode** | Techno | harshness+flatness altos → chaos override |

### 5.2 La Solución: TODO es parametría. NADA es booleano.

**La mecánica del Schwarzenegger NO es exclusiva del techno.** Es un gate+boost+exponent genérico que *en techno* tiene valores agresivos. En un perfil Chill:

```typescript
// chill.ts
percGate: 0.30,      // Gate altísimo — casi nada lo supera
percBoost: 2.0,       // Boost suave
percExponent: 2.0,    // Curva selectiva — solo picos genuinos
```

El resultado: el Back R en Chill apenas dispara, y cuando lo hace es un golpecito sutil. **Misma mecánica, resultado completamente distinto.**

### 5.3 Tabla de Equivalencias

| Mecánica | Cómo "desactivarla" via perfil |
|----------|-------------------------------|
| Schwarzenegger (Gate+Boost) | `percGate: 0.50` → nada lo supera. Zona muerta. |
| Kick Veto | `kickVetoFrames: 0` → sin veto. |
| Bass Subtractor | `bassSubtractBase: 0.0, bassSubtractRange: 0.0` → sin resta. Mid crudo. |
| Sidechain Guillotine | `sidechainDepth: 0.0` → sin ducking. Movers siempre libres. |
| Apocalypse Mode | `apocalypseHarshness: 2.0` → inalcanzable. Desactivado de facto. |
| Snare → Back L sidechain | `snareSidechainDepth: 0.0` → Back L no duckea con snare. |

**Principio:** Si un número puede apagar una mecánica, NO necesitamos un booleano `enableXxx`. La mecánica siempre *existe* en el motor; el perfil decide su *intensidad* — incluyendo intensidad cero.

### 5.4 ¿Y si aparece una mecánica genuinamente nueva?

Escenario: el perfil Rock necesita "Double Kick Detection" (dos kicks rápidos = un único flash largo). Esto no existe en el motor.

**Protocolo:**
1. Se implementa la mecánica en `LiquidStereoPhysics.ts` de forma **parametrizable** (ej: `doubleKickWindow: number` → 0 = desactivada).
2. Se añade el parámetro a `ILiquidProfile`.
3. El perfil Techno pone `doubleKickWindow: 0` (no le afecta). El perfil Rock pone `doubleKickWindow: 80` (80ms ventana de detección).
4. El motor crece de forma orgánica. Nunca bifurca.

---

## 6. PLAN DE EJECUCIÓN

### Fase 1: Extracción (puro refactor, sin cambio funcional)
1. Crear `profiles/ILiquidProfile.ts` con la interfaz
2. Crear `profiles/techno.ts` con los valores **exactos** del motor actual
3. Refactorizar `LiquidStereoPhysics` para recibir `ILiquidProfile` en constructor
4. Reemplazar toda constante hardcodeada por `this.profile.xxx`
5. `profiles/index.ts` con re-exports

**Validación:** El output del motor con `TECHNO_PROFILE` inyectado debe ser **bit-perfect idéntico** al motor actual. Mismo input → mismo output. Si un solo decimal difiere, el refactor está mal.

### Fase 2: Nuevos perfiles (expansión)
6. Crear `profiles/rock.ts` — calibrado con logs de AC/DC, Metallica, RHCP
7. Crear `profiles/latino.ts` — calibrado con logs de reggaetón, salsa, cumbia
8. Crear `profiles/chill.ts` — calibrado con logs de ambient, lofi, deep house

### Fase 3: Integración SeleneLux
9. `PROFILE_REGISTRY` en `profiles/index.ts`
10. `SeleneLux.ensureProfile()` con factory + caché
11. Eliminar `liquidStereoPhysics` singleton global → reemplazar por instancia managed

### Fase 4: Deprecación Legacy
12. `TechnoStereoPhysics.ts` → marcar deprecated (no eliminar hasta que todos los vibes estén en Omni-Liquid)
13. `RockStereoPhysics2.ts`, `LatinoStereoPhysics.ts`, `ChillStereoPhysics.ts` → deprecar cuando sus perfiles ILiquidProfile estén calibrados y validados

---

## 7. RIESGOS Y MITIGACIONES

| Riesgo | Mitigación |
|--------|-----------|
| El perfil Latino necesita una mecánica que no existe | §5.4 — Protocolo de extensión parametrizable |
| Performance: muchos `this.profile.xxx` vs constantes locales | V8 inlinea propiedades readonly de objetos frozen. Diferencia: nanosegundos. Irrelevante a 30fps. |
| Perfil con valores absurdos (boost=999) | `ILiquidProfile` es readonly + los `Math.min(1.0, ...)` del motor ya clipean. Considerar validación en constructor si se abre a usuarios. |
| Transición entre perfiles causa glitch visual | §3.5 — Hard cut en transición natural. El nuevo motor arranca limpio. |
| Singleton global `liquidStereoPhysics` rompe al eliminar | Fase 3 lo reemplaza por instancia managed en SeleneLux. Backward compat con re-export temporal desde index.ts. |

---

## 8. RESUMEN

```
ANTES (WAVE 2408):
  1 motor × N constantes hardcodeadas = 1 género posible

DESPUÉS (WAVE 2410):
  1 motor × N perfiles de datos = N géneros con el mismo código
```

**El motor no cambia de forma.** Cambian los números que lo alimentan. Eso es todo. Eso es la elegancia.
