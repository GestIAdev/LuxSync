# WAVE 4900 — THE `.theia` GENOME & COGNITIVE ADAPTER

> **DIRECTIVA DE ARQUITECTURA — Blueprint puro. No implementación.**
> **Misión:** alinear simbióticamente el formato de vídeo `.theia` con el genoma cognitivo de los `.lfx V3`, y diseñar el `SeleneTheiaAdapter` como puente inteligente entre el `DecisionMaker` y el `ThetaOrchestrator`.
>
> **Fecha:** 2026-05-26  |  **Tier:** OPUS_PRO_TIER / SYSTEM_ARCHITECT
> **Wave base:** WAVE 4872 (rechazo del autómata 3-estados) → WAVE 4900 (genoma simétrico)

---

## 0. PRINCIPIO RECTOR

El `.theia` **NO es un nuevo formato**. Es la **proyección audiovisual** del mismo genoma cognitivo que usa `.lfx V3`. Selene no aprende dos vocabularios — aprende uno y lo aplica a dos dominios:

| Dominio | Formato | Output |
|---------|---------|--------|
| **Luz física** | `.lfx V3` | Tracks/curves → DMX |
| **Vídeo proyectado** | `.theia V1` | Clip + cuepoints → frames RGBA al pixelMap |

Ambos comparten:
- `cognitiveDNA.genome` (Aggression, Chaos, Organicity)
- `textureAffinity` (`clean` / `dirty` / `universal`)
- `compatibleVibes[]`
- `validSections[]`
- `energyZone { min, max }`

Esto significa que el `DNAAnalyzer` existente **funciona sin modificaciones** sobre clips `.theia`. La distancia euclidiana 3D que rankea efectos `.lfx` rankea idénticamente segmentos de vídeo.

---

## 1. ESPECIFICACIÓN DEL FORMATO `.theia` V1

### 1.1 Filosofía del Archivo

Un archivo `.theia` es un **manifiesto JSON** que envuelve y describe un `.mp4` (o `.webm`) externo. El binario de vídeo queda fuera — el `.theia` solo declara metadatos cognitivos, cuepoints y referencias al asset.

```
my-clip/
├── aurora-flow.theia      ← manifiesto JSON (este documento)
├── aurora-flow.mp4        ← asset binario (referenciado por filePath)
└── aurora-flow.preview.jpg ← thumbnail opcional
```

### 1.2 TypeScript Schema

```typescript
// src/theia/theiaTypes.ts (FUTURE)
import type {
  FrozenGenome,
  TextureAffinity,
  EnergyZoneRange,
  Range,
} from '../core/arsenal/lfxTypes'

/**
 * `.theia v1.0` — manifiesto cognitivo para clips de vídeo.
 *
 * Hereda el bloque cognitiveDNA del estándar .lfx V3 para garantizar
 * matching simétrico via DNAAnalyzer. Extiende con cuepoints temporales
 * que permiten dividir un único .mp4 en N segmentos cognitivos.
 */
export interface TheiaFileV1 {
  readonly $schema: 'luxsync.theia/1.0'
  readonly checksum: string  // sha256 sobre clip (idéntico a .lfx)

  readonly clip: {
    // ── Identidad (idéntico a .lfx) ──────────────────────────────────────
    readonly id: string
    readonly name: string
    readonly author: string
    readonly category: string  // 'ambient' | 'drop' | 'breakdown' | 'transition'
    readonly tags: readonly string[]

    // ── Asset binario ────────────────────────────────────────────────────
    readonly asset: {
      /** Ruta relativa al .mp4/.webm (resuelta por TheiaLoader). */
      readonly filePath: string
      /** Codec esperado: 'h264' | 'h265' | 'vp9' | 'av1'. */
      readonly codec: 'h264' | 'h265' | 'vp9' | 'av1'
      /** Resolución nativa del asset. */
      readonly resolution: { readonly w: number; readonly h: number }
      /** Frame rate nativo. */
      readonly fps: number
      /** Duración total en ms. */
      readonly durationMs: number
      /** Preview thumbnail opcional (path o data URL). */
      readonly thumbnail?: string
    }

    // ── Bloque cognitivo CLIP-LEVEL (idéntico a .lfx) ────────────────────
    /**
     * ADN cognitivo del CLIP COMPLETO. Es el genoma de fallback cuando
     * ningún cuepoint específico aplica (o cuando la reproducción cae en
     * una zona temporal sin cuepoint declarado).
     */
    readonly cognitiveDNA: {
      readonly genome: FrozenGenome
      readonly textureAffinity: TextureAffinity
      readonly compatibleVibes: readonly string[]
      readonly validSections: readonly string[]
      readonly energyZone: EnergyZoneRange
      readonly aggressionRange: Range
    }

    // ── Bloque CUEPOINTS — el corazón de la innovación ───────────────────
    /**
     * Cuepoints declaran ZONAS COGNITIVAS dentro del mismo .mp4.
     *
     * Cada cuepoint es un sub-genoma temporalmente acotado:
     *   [startMs, endMs] → su propio DNA, energyZone, validSections.
     *
     * El SeleneTheiaAdapter consulta esta tabla al recibir un
     * ConsciousnessOutput. Si encuentra un cuepoint cuyo genoma matchea
     * mejor que el clip-level, ordena al ThetaOrchestrator un SEEK
     * preciso al startMs de ese cuepoint.
     *
     * REGLAS:
     *   - Los rangos NO deben solaparse (validado en G3).
     *   - Al menos UN cuepoint debe existir (default = clip completo).
     *   - El cuepoint con `default: true` es el fallback cuando ningún
     *     otro matchea por encima del umbral de relevancia.
     */
    readonly cuepoints: readonly TheiaCuePoint[]

    // ── SimulationMeta (subset de .lfx — adaptado a vídeo) ───────────────
    readonly simulationMeta: {
      readonly gpuCost: number          // 0..1 (decode + Theta blend cost)
      readonly fatigueImpact: number    // 0..1 (visual saturation impact)
      readonly minPlaybackMs: number    // mínimo tiempo a mantener el clip
      readonly cooldownMs: number       // entre re-disparos del MISMO clip
      readonly isStrobe: boolean        // contiene flashes >3Hz
      readonly isDivineCandidate: boolean
      readonly isHeavyCandidate: boolean
      readonly zScoreGuards: {
        readonly requireRising: boolean
        readonly minimumZ: number | null
        readonly minimumEnergy: number | null
      }
    }

    // ── Hints de playback ───────────────────────────────────────────────
    readonly playbackHints: {
      /** Modo loop: 'loop' | 'one-shot' | 'ping-pong' */
      readonly playMode: 'loop' | 'one-shot' | 'ping-pong'
      /** Crossfade default al transicionar entre cuepoints (ms). */
      readonly defaultCrossfadeMs: number
      /** Si true, el cuepoint puede ser interrumpido mid-playback. */
      readonly interruptible: boolean
      /** Brightness baseline aplicado por el ThetaOrchestrator. */
      readonly baselineBrightness: number  // 0..1
    }

    // ── SafetyDeclaration (idéntico a .lfx) ─────────────────────────────
    readonly safetyDeclaration: {
      readonly maxStrobeFreqHz: number
      readonly containsRapidFlash: boolean
      readonly communityTrusted: boolean
    }
  }
}

/**
 * Sub-genoma cognitivo de una zona temporal dentro del .mp4.
 *
 * Cada cuepoint actúa como un mini-.lfx con un rango [startMs, endMs]
 * y su propio DNA. El SeleneTheiaAdapter usa estos cuepoints para
 * decidir SEEK precisos basados en distancia euclidiana al targetDNA.
 */
export interface TheiaCuePoint {
  /** ID único dentro del clip (ej. 'intro', 'lift', 'drop-01'). */
  readonly id: string
  /** Etiqueta legible para UI (ej. 'The Big Drop'). */
  readonly label: string

  // ── Rango temporal ─────────────────────────────────────────────────────
  /** Inicio del cuepoint en ms (offset dentro del .mp4). */
  readonly startMs: number
  /** Fin del cuepoint en ms. */
  readonly endMs: number

  // ── ADN cognitivo (idéntico al CognitiveDNA de .lfx, sin spatial) ─────
  readonly genome: FrozenGenome
  readonly textureAffinity: TextureAffinity
  readonly validSections: readonly string[]
  readonly energyZone: EnergyZoneRange

  // ── Flags ──────────────────────────────────────────────────────────────
  /** True si este cuepoint es el fallback cuando nada matchea. */
  readonly default: boolean
  /** True si este cuepoint es candidato a DIVINE strikes. */
  readonly isDivineCandidate: boolean
  /** True si este cuepoint es candidato a HEAVY strikes. */
  readonly isHeavyCandidate: boolean

  /** Hint opcional: vibes en los que este cuepoint brilla. */
  readonly preferredVibes?: readonly string[]
}
```

### 1.3 Ejemplo Concreto: `aurora-flow.theia`

```json
{
  "$schema": "luxsync.theia/1.0",
  "checksum": "sha256:a7f9b3...",
  "clip": {
    "id": "aurora-flow",
    "name": "Aurora Flow",
    "author": "PunkOpus",
    "category": "ambient",
    "tags": ["aurora", "flow", "organic", "techno-compatible"],

    "asset": {
      "filePath": "./aurora-flow.mp4",
      "codec": "h264",
      "resolution": { "w": 1920, "h": 1080 },
      "fps": 30,
      "durationMs": 184000,
      "thumbnail": "./aurora-flow.preview.jpg"
    },

    "cognitiveDNA": {
      "genome": { "aggression": 0.35, "chaos": 0.25, "organicity": 0.80 },
      "textureAffinity": "clean",
      "compatibleVibes": ["techno", "ambient", "downtempo"],
      "validSections": ["intro", "verse", "breakdown", "outro"],
      "energyZone": { "min": "ambient", "max": "active" },
      "aggressionRange": { "min": 0.2, "max": 0.6 }
    },

    "cuepoints": [
      {
        "id": "intro",
        "label": "Aurora Awakens",
        "startMs": 0,
        "endMs": 33000,
        "genome": { "aggression": 0.15, "chaos": 0.10, "organicity": 0.90 },
        "textureAffinity": "clean",
        "validSections": ["intro", "verse"],
        "energyZone": { "min": "silence", "max": "ambient" },
        "default": true,
        "isDivineCandidate": false,
        "isHeavyCandidate": false
      },
      {
        "id": "lift",
        "label": "Tension Rise",
        "startMs": 33000,
        "endMs": 77000,
        "genome": { "aggression": 0.45, "chaos": 0.30, "organicity": 0.65 },
        "textureAffinity": "universal",
        "validSections": ["buildup"],
        "energyZone": { "min": "ambient", "max": "active" },
        "default": false,
        "isDivineCandidate": false,
        "isHeavyCandidate": false
      },
      {
        "id": "drop-peak",
        "label": "The Aurora Burst",
        "startMs": 77000,
        "endMs": 132000,
        "genome": { "aggression": 0.85, "chaos": 0.55, "organicity": 0.40 },
        "textureAffinity": "dirty",
        "validSections": ["drop", "peak"],
        "energyZone": { "min": "intense", "max": "peak" },
        "default": false,
        "isDivineCandidate": true,
        "isHeavyCandidate": true,
        "preferredVibes": ["techno", "trance"]
      },
      {
        "id": "outro-wave",
        "label": "Aurora Dissipates",
        "startMs": 132000,
        "endMs": 184000,
        "genome": { "aggression": 0.25, "chaos": 0.20, "organicity": 0.85 },
        "textureAffinity": "clean",
        "validSections": ["breakdown", "outro"],
        "energyZone": { "min": "valley", "max": "ambient" },
        "default": false,
        "isDivineCandidate": false,
        "isHeavyCandidate": false
      }
    ],

    "simulationMeta": {
      "gpuCost": 0.35,
      "fatigueImpact": 0.10,
      "minPlaybackMs": 3000,
      "cooldownMs": 12000,
      "isStrobe": false,
      "isDivineCandidate": true,
      "isHeavyCandidate": false,
      "zScoreGuards": {
        "requireRising": false,
        "minimumZ": null,
        "minimumEnergy": 0.30
      }
    },

    "playbackHints": {
      "playMode": "loop",
      "defaultCrossfadeMs": 500,
      "interruptible": true,
      "baselineBrightness": 0.85
    },

    "safetyDeclaration": {
      "maxStrobeFreqHz": 0,
      "containsRapidFlash": false,
      "communityTrusted": true
    }
  }
}
```

### 1.4 Gates de Validación (paralelos a `.lfx`)

| Gate | Validación | Acción si falla |
|------|------------|-----------------|
| **G1** | `$schema === 'luxsync.theia/1.0'` | Reject |
| **G2** | Checksum SHA-256 sobre `clip` | Reject |
| **G3** | Cuepoints sin solapamientos temporales | Reject |
| **G3.1** | `endMs > startMs` y `endMs ≤ durationMs` | Reject |
| **G3.2** | Exactamente 1 cuepoint con `default: true` | Reject |
| **G4** | `genome.{aggression,chaos,organicity} ∈ [0,1]` | Reject |
| **G5** | Asset file existe en disco | Reject |
| **G6** | `safetyDeclaration` consistente con cuepoints declarados | Reject |
| **G7** | `compatibleVibes.length > 0` | Reject |
| **USER** | Si source='user' → `aggression ≤ 0.95` | Reject |

---

## 2. EL `SeleneTheiaAdapter` — ARQUITECTURA

### 2.1 Posición en el Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│  RENDERER PROCESS (Selene Brain)                                 │
│                                                                  │
│  SeleneTitanConscious.think()                                    │
│         ↓                                                        │
│  DecisionMaker.makeDecision()                                    │
│         ↓                                                        │
│  ConsciousnessOutput {                                           │
│    effect: 'core_meltdown',                                      │
│    confidence: 0.87,                                             │
│    targetDNA: { A:0.85, C:0.55, O:0.40 },                        │
│    energyZone: 'intense',                                        │
│    spectralContext: { texture:'dirty', clarity:0.6 },            │
│    vibe: 'techno',                                               │
│    section: 'drop'                                               │
│  }                                                               │
│         ↓                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  SeleneTheiaAdapter (Renderer-side bridge)               │    │
│  │  ────────────────────────────────────────────            │    │
│  │  1. Lee targetDNA del ConsciousnessOutput                │    │
│  │  2. Itera TheiaRegistry.getAllCuepoints()                │    │
│  │  3. Filtra por compatibleVibes + validSections          │    │
│  │  4. Calcula distancia euclidiana 3D por cuepoint         │    │
│  │  5. Aplica diversity penalty (anti-repetición)           │    │
│  │  6. Selecciona winner (min distance × diversity)         │    │
│  │  7. Emite IPC: theia:cue-jump { clipId, cuepointId, ms } │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              ↓ IPC
┌──────────────────────────────────────────────────────────────────┐
│  MAIN PROCESS                                                    │
│                                                                  │
│  ThetaOrchestrator.handleCueJump(payload)                        │
│         ↓                                                        │
│  theta.worker.ts {                                               │
│    - Carga clip si no está cargado                              │
│    - SEEK a startMs del cuepoint                                 │
│    - Crossfade desde frame actual                                │
│    - Publica frames al thumbPixelSAB (WAVE 4867)                 │
│  }                                                               │
│         ↓                                                        │
│  TheiaVideoRenderer (renderer) lee SAB → AetherCanvasManager     │
│         ↓                                                        │
│  PixelMapAetherAdapter → INodeIntent[] L3 → NodeArbiter → DMX    │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Clase y API

```typescript
// src/theia/SeleneTheiaAdapter.ts (FUTURE)

import type { ConsciousnessOutput } from '../core/protocol/ConsciousnessOutput'
import type { FrozenGenome } from '../core/arsenal/lfxTypes'
import type { TheiaCuePoint, TheiaFileV1 } from './theiaTypes'

interface CueCandidate {
  readonly clipId: string
  readonly cuepoint: TheiaCuePoint
  readonly distance: number       // 3D euclidiana
  readonly diversityFactor: number
  readonly score: number          // (1 - distance/√3) × diversityFactor × bonuses
}

interface CueJumpIntent {
  readonly clipId: string
  readonly cuepointId: string
  readonly startMs: number
  readonly crossfadeMs: number
  readonly reason: string         // human-readable para logs
}

/**
 * SeleneTheiaAdapter — Puente cognitivo entre el cerebro de Selene
 * y el ThetaOrchestrator del proceso principal.
 *
 * Vive en el renderer. Es invocado por SeleneTitanConscious.think()
 * AL FINAL del ciclo, DESPUÉS de que DecisionMaker emitió su
 * ConsciousnessOutput. NO hace re-decisión, NO reabre el pipeline —
 * sólo TRADUCE la decisión cognitiva a un seek de vídeo.
 */
export class SeleneTheiaAdapter {
  // ── Estado anti-repetición (idéntico patrón al DNAAnalyzer) ─────────────
  private readonly _cueUsageCount = new Map<string, number>()
  private _lastUsageReset = Date.now()
  private readonly USAGE_WINDOW_MS = 60_000   // ventana 60s
  private readonly DIVERSITY_FACTORS = [1.0, 0.70, 0.35, 0.15]

  // ── Cache del último cuepoint emitido (evita IPC redundante) ────────────
  private _lastEmittedCue: { clipId: string; cuepointId: string; t: number } | null = null
  private readonly CUE_REEMIT_THROTTLE_MS = 2000

  // ── Umbral mínimo de relevancia para considerar un cue válido ──────────
  private readonly MIN_RELEVANCE_SCORE = 0.45
  private readonly MAX_DISTANCE = Math.sqrt(3)  // distancia máxima 3D

  /**
   * Procesa el output cognitivo de Selene y decide qué cuepoint
   * de vídeo proyectar. Idempotente y zero-alloc en hot-path
   * (no allocá objetos nuevos si el cuepoint no cambia).
   */
  public process(output: ConsciousnessOutput): CueJumpIntent | null {
    // GUARD 1: Selene en HOLD → no tocar el vídeo (sigue lo que esté)
    if (output.decision === 'hold') return null

    // GUARD 2: BLACKOUT explícito → emitir cue 'blackout' especial
    if (output.decision === 'blackout') {
      return this._emitBlackout(output)
    }

    // STEP 1: Obtener el target DNA del output (lo que Selene QUIERE)
    const targetDNA = this._extractTargetDNA(output)
    if (!targetDNA) return null  // Sin DNA = no match posible

    // STEP 2: Recolectar candidatos (cross-product clip × cuepoint)
    const candidates = this._gatherCandidates(output)
    if (candidates.length === 0) {
      console.warn('[SeleneTheia] No candidates for vibe', output.vibe)
      return null
    }

    // STEP 3: Scoring por distancia euclidiana 3D + diversity
    this._maybeResetUsageWindow()
    const scored: CueCandidate[] = candidates.map(c => {
      const distance = this._euclideanDistance3D(c.cuepoint.genome, targetDNA)
      const baseRelevance = 1 - (distance / this.MAX_DISTANCE)
      const usageKey = `${c.clipId}:${c.cuepoint.id}`
      const usageCount = this._cueUsageCount.get(usageKey) ?? 0
      const diversityIdx = Math.min(usageCount, this.DIVERSITY_FACTORS.length - 1)
      const diversityFactor = this.DIVERSITY_FACTORS[diversityIdx]

      // Bonuses contextuales
      let bonus = 1.0
      if (c.cuepoint.preferredVibes?.includes(output.vibe)) bonus *= 1.15
      if (c.cuepoint.validSections.includes(output.section)) bonus *= 1.10
      if (output.decision === 'divine_strike' && c.cuepoint.isDivineCandidate) bonus *= 1.25
      if (output.decision === 'strike' && c.cuepoint.isHeavyCandidate) bonus *= 1.10

      const score = baseRelevance * diversityFactor * bonus
      return { ...c, distance, diversityFactor, score }
    })

    // STEP 4: Ordenar y seleccionar winner
    scored.sort((a, b) => b.score - a.score)
    const winner = scored[0]

    // GUARD 3: Score mínimo
    if (winner.score < this.MIN_RELEVANCE_SCORE) {
      // Fallback: el cuepoint default del clip más compatible
      const fallback = this._findFallbackCuepoint(output)
      if (!fallback) return null
      return this._buildIntent(fallback, output, 'fallback-default')
    }

    // STEP 5: Throttle anti-flicker
    if (this._isRedundantCue(winner)) return null

    // STEP 6: Registrar uso y emitir
    const usageKey = `${winner.clipId}:${winner.cuepoint.id}`
    this._cueUsageCount.set(usageKey, (this._cueUsageCount.get(usageKey) ?? 0) + 1)
    this._lastEmittedCue = {
      clipId: winner.clipId,
      cuepointId: winner.cuepoint.id,
      t: Date.now(),
    }

    return this._buildIntent(winner, output, 'dna-match')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNALS
  // ─────────────────────────────────────────────────────────────────────────

  private _extractTargetDNA(output: ConsciousnessOutput): FrozenGenome | null {
    // Selene ya derivó el targetDNA en DNAAnalyzer. Lo reusamos.
    // Si el output tiene `effect`, leemos el DNA del .lfx ganador del registry.
    // Si no, derivamos del contexto (energía + sección + texture).
    if (output.effect) {
      const entry = getDynamicEffectRegistry().getEntry(output.effect)
      if (entry) return entry.dna
    }
    return output.targetDNA ?? null
  }

  private _gatherCandidates(output: ConsciousnessOutput): Array<{
    clipId: string
    cuepoint: TheiaCuePoint
  }> {
    const registry = getTheiaRegistry()  // Future singleton
    const clips = registry.getClipsForVibe(output.vibe)
    const result: Array<{ clipId: string; cuepoint: TheiaCuePoint }> = []

    for (const clip of clips) {
      for (const cp of clip.clip.cuepoints) {
        // Filtro duro: sección debe matchear
        if (!cp.validSections.includes(output.section) &&
            !cp.validSections.includes('any')) continue
        result.push({ clipId: clip.clip.id, cuepoint: cp })
      }
    }
    return result
  }

  private _euclideanDistance3D(a: FrozenGenome, b: FrozenGenome): number {
    const dA = a.aggression - b.aggression
    const dC = a.chaos - b.chaos
    const dO = a.organicity - b.organicity
    return Math.sqrt(dA * dA + dC * dC + dO * dO)
  }

  private _isRedundantCue(winner: CueCandidate): boolean {
    if (!this._lastEmittedCue) return false
    const sameClip = this._lastEmittedCue.clipId === winner.clipId
    const sameCue = this._lastEmittedCue.cuepointId === winner.cuepoint.id
    const recent = (Date.now() - this._lastEmittedCue.t) < this.CUE_REEMIT_THROTTLE_MS
    return sameClip && sameCue && recent
  }

  private _buildIntent(
    winner: { clipId: string; cuepoint: TheiaCuePoint },
    output: ConsciousnessOutput,
    reason: string,
  ): CueJumpIntent {
    return {
      clipId: winner.clipId,
      cuepointId: winner.cuepoint.id,
      startMs: winner.cuepoint.startMs,
      crossfadeMs: this._deriveCrossfade(output),
      reason: `${reason}|section=${output.section}|vibe=${output.vibe}|dec=${output.decision}`,
    }
  }

  private _deriveCrossfade(output: ConsciousnessOutput): number {
    // DIVINE / drop urgente → corte duro (50ms)
    if (output.decision === 'divine_strike') return 50
    if (output.decision === 'strike' && output.section === 'drop') return 100
    // Buildup / ambient → fade suave (500-1000ms)
    if (output.section === 'buildup') return 750
    return 500
  }

  // ... _emitBlackout, _findFallbackCuepoint, _maybeResetUsageWindow
}
```

### 2.3 IPC Contract: Renderer → Main

```typescript
// src/theia/protocol.ts (EXTENDED)

/** Renderer → Main: Selene ordena un seek cognitivo a un cuepoint específico. */
export interface TheiaCueJumpMessage {
  readonly type: 'theia:cue-jump'
  readonly payload: {
    readonly clipId: string
    readonly cuepointId: string
    readonly startMs: number
    readonly crossfadeMs: number
    readonly reason: string
    /** Timestamp del renderer al emitir — para latency tracking. */
    readonly emittedAt: number
  }
}

/** Renderer → Main: Selene ordena blackout del vídeo. */
export interface TheiaBlackoutMessage {
  readonly type: 'theia:blackout'
  readonly payload: { readonly fadeMs: number }
}

/** Main → Renderer: ack del cue ejecutado (telemetría). */
export interface TheiaCueAckMessage {
  readonly type: 'theia:cue-ack'
  readonly payload: {
    readonly clipId: string
    readonly cuepointId: string
    readonly latencyMs: number  // emittedAt → actual seek done
    readonly ok: boolean
    readonly error?: string
  }
}
```

### 2.4 Diagrama de Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│ Frame N @ 44Hz                                                       │
│                                                                      │
│  TitanEngine → ... → DecisionMaker.makeDecision()                    │
│         ↓                                                            │
│  ConsciousnessOutput emitido al EffectManager (L3 lighting)          │
│         ↓                                                            │
│  ────────────────────────────────────────────────────                │
│  NUEVO: SeleneTheiaAdapter.process(output)                           │
│  ────────────────────────────────────────────────────                │
│         ↓                                                            │
│  ┌──────────────────────────────────────────────────┐                │
│  │ 1. extractTargetDNA()                            │                │
│  │ 2. gatherCandidates() ← TheiaRegistry            │                │
│  │ 3. score = (1 - dist/√3) × diversity × bonuses   │                │
│  │ 4. winner = top score                            │                │
│  │ 5. throttle/dedupe                               │                │
│  │ 6. emit CueJumpIntent                            │                │
│  └──────────────────────────────────────────────────┘                │
│         ↓ ipcRenderer.send('theia:cue-jump', payload)                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ MAIN PROCESS                                                         │
│  ThetaOrchestrator.on('theia:cue-jump', payload)                     │
│         ↓                                                            │
│  worker.postMessage({ type:'SEEK', clipId, ms, crossfadeMs })        │
│         ↓                                                            │
│  theta.worker.ts:                                                    │
│   - Si clip no cargado → load .mp4 (lazy)                           │
│   - videoElement.currentTime = ms / 1000                            │
│   - Iniciar crossfade A→B                                           │
│   - downscale frames → thumbPixelSAB                                │
│         ↓ (SAB shared)                                               │
│  TheiaVideoRenderer.tick() (renderer hot-path 44Hz)                  │
│         ↓                                                            │
│  AetherCanvasManager → PixelMapAetherAdapter                         │
│         ↓                                                            │
│  INodeIntent[] L3 → NodeArbiter → DMX → Fixtures físicos             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. CÓMO EL DISEÑO RESUELVE EL PROBLEMA SIN CARGAR A SELENE

### 3.1 El Problema Original

Antes de WAVE 4900, había dos opciones malas:
- **Opción A:** Selene decide vídeo con su propio sistema de prioridades (drop/ambient/transition). Esto creaba un AUTÓMATA DE 3 ESTADOS desacoplado del cerebro `.lfx`. Selene tenía que mantener dos vocabularios.
- **Opción B:** El ThetaOrchestrator escucha audio directamente y decide. Esto duplicaba el `TitanEngine` y desperdiciaba el cerebro de Selene.

Ambas opciones rompían la simbiosis. Ambas violaban DRY.

### 3.2 La Solución: Adapter de Traducción (Cero Re-decisión)

El `SeleneTheiaAdapter` **NO toma decisiones cognitivas**. Selene ya decidió. El adapter solo **traduce la decisión a coordenadas de vídeo**.

**Composición de cargas:**

| Componente | Trabajo | Hot-path? |
|------------|---------|-----------|
| `DecisionMaker.makeDecision()` | Sin cambios. Sigue decidiendo `.lfx` y `targetDNA`. | Sí (frame 44Hz) |
| `SeleneTheiaAdapter.process()` | **NUEVO**. Lookup O(N×M) donde N=clips, M=cuepoints/clip. Típicamente N=10, M=4 → 40 distancias 3D + sort. **~0.05ms en JS moderno.** | Sí (frame 44Hz) |
| `TheiaRegistry` | Lookup O(1) por vibe. Mismo patrón que `DynamicEffectRegistry`. | Sí (read-only) |
| `ThetaOrchestrator.handleCueJump()` | IPC + worker SEEK. **Latencia: 30-80ms**, pero ASYNC. | No (event-driven) |
| `theta.worker.ts` | Decode + downscale (ya existente WAVE 4867). | Sí (worker thread, no bloquea Selene) |

**Conclusión cuantitativa:**
- **Coste agregado al hot-path de Selene:** ~0.05-0.10ms por frame (lookup + scoring + emit IPC).
- **Comparación con el pipeline DNA existente:** El `EffectDreamSimulator` ya tarda 3-10ms por simulación. El adapter es **~50× más barato**.
- **Sin async waiting:** El adapter emite IPC fire-and-forget. No espera ack para retornar.

### 3.3 Por Qué la Simetría con `.lfx` Es La Clave

1. **DNAAnalyzer ya entrenado:** El cerebro de Selene ya sabe medir distancias 3D. Cero código nuevo de matching.
2. **TargetDNA reusable:** El `DNAAnalyzer.deriveTargetDNA()` produce el mismo target sin importar si lo consume `.lfx` o `.theia`.
3. **EnergyZone compartida:** El `EnergyConsciousness` emite `zone='intense'` y ambos formatos lo entienden.
4. **Validación de sección unificada:** `validSections[]` funciona idéntico en luz y vídeo.
5. **Diversity engine paralelo:** Mismo patrón de penalización por uso repetido (1.0 → 0.70 → 0.35 → 0.15).
6. **Mood awareness opcional:** El adapter PUEDE consultar `MoodController.isEffectBlocked(clipId)` con misma API que `.lfx`. CALM puede bloquear clips agresivos sin código duplicado.

### 3.4 Lo Que NO Hace El Adapter (Intencionalmente)

- **NO re-implementa los gates** (Z-score, energy gates, spectral gates). Selene ya filtra. Si el `ConsciousnessOutput.decision === 'hold'`, el adapter no se ejecuta.
- **NO maneja cooldowns globales.** El `simulationMeta.cooldownMs` del clip es consultado, pero el "global effect cooldown" de Selene ya garantiza spacing temporal.
- **NO decodifica vídeo.** Eso vive en el worker. El adapter solo emite intenciones.
- **NO consulta el `EffectManager`.** El L3 lighting y el L3 video son canales independientes (Aether vs Theia). El `NodeArbiter` ya domina la mezcla final.

### 3.5 Casos Edge Cubiertos

| Caso | Comportamiento |
|------|----------------|
| Selene en HOLD | Adapter no emite. Vídeo sigue lo que esté reproduciendo. |
| Selene en BLACKOUT | Adapter emite `theia:blackout` separado. |
| No hay clips para el vibe | Adapter loguea warning, no emite. ThetaOrchestrator mantiene clip actual. |
| Score < `MIN_RELEVANCE_SCORE` (0.45) | Fallback al cuepoint `default: true` del clip de mayor compatibleVibes overlap. |
| Mismo cue ya emitido <2s | Throttle: ignora (anti-flicker). |
| Drop urgente (`crossfadeMs: 50ms`) | Cut casi instantáneo, no fade. |
| Buildup detectado | Fade largo (750ms) hacia cuepoint `lift`. |

---

## 4. ENTREGABLES Y SIGUIENTES PASOS (NO EJECUTAR AÚN)

### 4.1 Estructura de Archivos Propuesta

```
electron-app/src/theia/
├── theiaTypes.ts            ← NEW. TheiaFileV1, TheiaCuePoint, etc.
├── TheiaFileLoader.ts       ← NEW. Espejo de LfxFileLoader (gates G1-G7).
├── TheiaRegistry.ts         ← NEW. Espejo de DynamicEffectRegistry (índice por vibe).
├── SeleneTheiaAdapter.ts    ← NEW. La clase descrita en §2.2.
├── protocol.ts              ← EXTEND. Añadir TheiaCueJumpMessage / TheiaCueAckMessage.
├── ThetaOrchestrator.ts     ← EXTEND. handleCueJump() handler.
├── theta.worker.ts          ← EXTEND. SEEK + crossfade logic.
├── TheiaThumbBuffer.ts      ← EXISTING (WAVE 4867).
└── index.ts                 ← EXTEND. Exportar nuevos módulos.
```

### 4.2 Hooks Necesarios en Selene Existente

| Archivo | Cambio |
|---------|--------|
| `SeleneTitanConscious.think()` | Al final, después de `EffectManager`, llamar `seleneTheiaAdapter.process(output)`. |
| `ConsciousnessOutput` | Garantizar que incluye `targetDNA`, `energyZone`, `vibe`, `section`, `decision`. (Ya los tiene en su mayoría.) |

### 4.3 Orden de Implementación (Cuando Toque)

1. **WAVE 4900.1** — `theiaTypes.ts` + `TheiaFileLoader.ts` (sin integración).
2. **WAVE 4900.2** — `TheiaRegistry.ts` + test con 1-2 `.theia` mockeados.
3. **WAVE 4900.3** — `SeleneTheiaAdapter.ts` standalone (input: mock `ConsciousnessOutput`).
4. **WAVE 4900.4** — IPC wiring + `ThetaOrchestrator.handleCueJump`.
5. **WAVE 4900.5** — `theta.worker.ts` SEEK + crossfade.
6. **WAVE 4900.6** — Integración en `SeleneTitanConscious.think()`.
7. **WAVE 4900.7** — UI de cuepoints en `TheiaEngineView` (visualización + edición).

---

## 5. ALINEACIÓN FILOSÓFICA

> *"Un solo cerebro, dos cuerpos. Selene piensa una vez, y su pensamiento ilumina la pista Y proyecta el sueño."*

Este diseño elimina la dicotomía **luz vs vídeo**. Para Selene, ambos son **emanaciones del mismo genoma**. El operador autora `.lfx` y `.theia` con el mismo vocabulario. El usuario percibe coherencia total porque la coherencia es **matemática**, no curada.

El `SeleneTheiaAdapter` es un **traductor**, no un **decisor**. Mantiene Selene SECA (DRY), KISS, y simbiótica.

---

*Fin del blueprint WAVE 4900. Ningún código fue ejecutado durante el diseño de esta directiva.*
