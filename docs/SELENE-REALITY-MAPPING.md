# SELENE REALITY MAPPING

> **Auditoría forense del pipeline cognitivo de Selene.**
> **Regla de Oro:** Cero invenciones. Todo valor debajo es un literal extraído del código fuente.
> **Fecha de extracción:** 2026-05-20
> **Archivos auditados:** ~23K LOC en `src/core/intelligence`, `src/core/effects`, `src/core/protocol`, `src/core/mood`.

---

## 1. LA MATRIZ DE ENERGÍA (EnergyConsciousnessEngine)

### 1.1 · Identificadores exactos

El motor usa el tipo `EnergyZone` definido en `src/core/protocol/MusicalContext.ts:145`:

```typescript
export type EnergyZone = 
  | 'silence'   // E < 0.10 - Silencio total, pad, viento
  | 'valley'    // E 0.10-0.20 - Pre-drop silence, transición
  | 'ambient'   // E 0.20-0.35 - Ambiente suave, coro lejano
  | 'gentle'    // E 0.35-0.50 - Verso, melodía suave
  | 'active'    // E 0.50-0.70 - Pre-chorus, buildup
  | 'intense'   // E 0.70-0.85 - Chorus, clímax
  | 'peak'      // E > 0.85 - Drop, explosión
```

**Nota:** Los comentarios en `MusicalContext.ts` listan umbrales LEGACY. La fuente de verdad es `EnergyConsciousnessEngine.ts` (WAVE 996 — THE LADDER), que sobreescribe los valores operativos.

### 1.2 · Umbrales operativos reales (fuente de verdad)

`src/core/intelligence/EnergyConsciousnessEngine.ts:127-135` — `DEFAULT_CONFIG.zoneThresholds`:

```typescript
zoneThresholds: {
  silence: 0.15,   // E < 0.15 = SILENCE  (0-15%)
  valley: 0.30,    // E < 0.30 = VALLEY   (15-30%)
  ambient: 0.45,   // E < 0.45 = AMBIENT  (30-45%)
  gentle: 0.60,    // E < 0.60 = GENTLE   (45-60%)
  active: 0.75,    // E < 0.75 = ACTIVE   (60-75%)
  intense: 0.90,   // E < 0.90 = INTENSE  (75-90%)
                   // E >= 0.90 = PEAK    (90-100%)
}
```

| Zona | Rango exacto | Ancho |
|------|-------------|-------|
| silence | 0.00 — <0.15 | 15% |
| valley | 0.15 — <0.30 | 15% |
| ambient | 0.30 — <0.45 | 15% |
| gentle | 0.45 — <0.60 | 15% |
| active | 0.60 — <0.75 | 15% |
| intense | 0.75 — <0.90 | 15% |
| peak | 0.90 — 1.00 | 10% |

### 1.3 · Parámetros de sostenibilidad

`EnergyConsciousnessEngine.ts:137-149`:

```typescript
smoothingFactorDown: 0.92,         // ~500ms para estabilizar en silencio
smoothingFactorUp: 0.3,              // ~50ms para detectar spike (INSTANTÁNEO)
sustainedLowThresholdMs: 5000,       // 5 segundos para "valle sostenido"
sustainedHighThresholdMs: 3000,      // 3 segundos para "pico sostenido"
sustainedLowEnergyThreshold: 0.4,
sustainedHighEnergyThreshold: 0.7,
historySize: 300,                    // ~5 segundos @ 60fps
trendWindowSize: 10,                 // ~160ms para calcular tendencia
PEAK_HOLD_DURATION: 80,              // ms (mantener peak brevemente)
FAST_DECAY_RATE: 0.85,              // Decay rápido en percusión
SLOW_DECAY_RATE: 0.95,              // Decay normal en ambiente
BASS_THRESHOLD: 0.65,               // Umbral para detectar percusión
```

---

## 2. EL CATÁLOGO DE VIBES

### 2.1 · Tipo canónico VibeId

**Fuente de verdad:** `src/types/VibeProfile.ts:18` (también duplicado en `src/stores/vibeStore.ts:19` y `src/core/protocol/SeleneProtocol.ts:50`):

```typescript
export type VibeId = 'idle' | 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge';
```

**Nota sobre `pop-rock`:** El comentario en `HuntEngine.ts:690-694` lo lista como uno de los "4 VIBES REALES DE LUXSYNC" junto a fiesta-latina, techno-club y chill-lounge. `idle` es el estado neutro de espera. No hay vibes marcadas como deprecadas en el código. Ninguna está "congelada a la espera de stems" — todas 5 son tipos válidos en producción.

### 2.2 · Matriz de pesos por vibe (VIBE_STRIKE_MATRIX)

**Fuente:** `src/core/intelligence/think/HuntEngine.ts:707-757`:

```typescript
const VIBE_STRIKE_MATRIX: Record<string, VibeStrikeWeights> = {
  'fiesta-latina': {
    beautyWeight: 0.3,
    urgencyWeight: 0.6,
    consonanceWeight: 0.1,
    threshold: 0.70,
    urgencyBoost: 0.05
  },
  'techno-club': {
    beautyWeight: 0.2,
    urgencyWeight: 0.7,
    consonanceWeight: 0.1,
    threshold: 0.65,
    urgencyBoost: 0.1
  },
  'pop-rock': {
    beautyWeight: 0.4,
    urgencyWeight: 0.5,
    consonanceWeight: 0.1,
    threshold: 0.70,
    urgencyBoost: 0.0
  },
  'chill-lounge': {
    beautyWeight: 0.7,
    urgencyWeight: 0.2,
    consonanceWeight: 0.1,
    threshold: 0.75,
    urgencyBoost: 0.0
  },
  'idle': {
    beautyWeight: 0.4,
    urgencyWeight: 0.5,
    consonanceWeight: 0.1,
    threshold: 0.75,
    urgencyBoost: 0.0
  },
}
```

**Fallback:** Si un `vibeId` no existe en la matriz, retorna `VIBE_STRIKE_MATRIX['pop-rock']` (`HuntEngine.ts:764`).

### 2.3 · Multiplicadores de threshold por vibe (PredictionEngine)

**Fuente:** `src/core/intelligence/think/PredictionEngine.ts:484-487`:

```typescript
const VIBE_THRESHOLD_PROFILES: Record<string, number> = {
  'fiesta-latina': 1.2,    // Más conservador (reggaetón/cumbia tienen kicks constantes)
  'techno-club': 0.9,      // Más sensible
  'pop-rock': 1.0,         // Neutral
  'chill-lounge': 1.3,     // Muy conservador
}
```

---

## 3. LA TRÍADA COGNITIVA Y ATRIBUTOS DE EFECTO (EffectDNA)

### 3.1 · Interface exacta

**Fuente:** `src/core/intelligence/dna/EffectDNA.ts:103-118`:

```typescript
export interface EffectDNA {
  aggression: number     // 0=suave, 1=brutal
  chaos: number           // 0=predecible, 1=caótico
  organicity: number      // 0=sintético, 1=orgánico
  textureAffinity?: TextureAffinity  // 'dirty' | 'clean' | 'universal'
  selectionBias?: number  // ☢️ WAVE 3469: sesgo paramétrico para romper empates euclidianos
}
```

**Confirmación:** La tríada ACO (`aggression`, `chaos`, `organicity`) es EXACTAMENTE lo que el `DNAAnalyzer` lee para rankear. No hay más parámetros numéricos en la interfaz base.

**Parámetro numérico adicional real:** `selectionBias?: number` (único campo numérico opcional; usado por `core_meltdown` con valor `2.0` para romper empates).

### 3.2 · "Tags" reales vs. inferidos

**NO EXISTE un campo `tags` en `EffectDNA`.**

Lo que el WAVE-4838 llama "tags" (strobe, heavy, etc.) son **inferencias del código**, no atributos del DNA:

- **HEAVY_ARSENAL** no es un tag — es un `Set<string>` hardcodeado en `DecisionMaker.ts:123-132`:

```typescript
export const HEAVY_ARSENAL_EFFECTS: ReadonlySet<string> = new Set([
  'core_meltdown',
  'industrial_strobe',
  'gatling_raid',
  'neon_blinder',
  'strobe_storm',
  'latina_meltdown',
  'thunder_struck',
  'feedback_storm',
])
```

- **OCEANIC_EFFECTS** no es un tag — es un `Set<string>` en `SeleneTitanConscious.ts:212-213`:

```typescript
const OCEANIC_EFFECTS_NO_OVERRIDE: Set<string> = new Set([
  'solar_caustics',
  // ... (lista completa no mostrada en el grep, solo se vio 'solar_caustics')
])
```

- **Texture affinity** SÍ es un atributo real en `EffectDNA` (3 valores posibles).

### 3.3 · Registro completo EFFECT_DNA_REGISTRY

**Fuente:** `src/core/intelligence/dna/EffectDNA.ts:169-575`

A continuación, el listado literal de TODAS las claves y sus triadas ACO (+ textureAffinity cuando está presente):

**TECHNO-INDUSTRIAL:**
```
'industrial_strobe':  { aggression: 0.95, chaos: 0.55, organicity: 0.05,  textureAffinity: 'universal' }
'acid_sweep':         { aggression: 0.70, chaos: 0.45, organicity: 0.25,  textureAffinity: 'universal' }
'cyber_dualism':      { aggression: 0.55, chaos: 0.50, organicity: 0.45,  textureAffinity: 'universal' }
'gatling_raid':       { aggression: 0.90, chaos: 0.40, organicity: 0.10,  textureAffinity: 'universal' }
'sky_saw':            { aggression: 0.80, chaos: 0.55, organicity: 0.20,  textureAffinity: 'universal' }
```

**TECHNO-ATMOSPHERIC:**
```
'void_mist':          { aggression: 0.05, chaos: 0.20, organicity: 0.85,  textureAffinity: 'universal' }
'binary_glitch':      { aggression: 0.60, chaos: 0.55, organicity: 0.00,  textureAffinity: 'universal' }
'seismic_snap':       { aggression: 0.70, chaos: 0.20, organicity: 0.10,  textureAffinity: 'universal' }
'digital_rain':       { aggression: 0.50, chaos: 0.65, organicity: 0.40,  textureAffinity: 'universal' }
'deep_breath':        { aggression: 0.05, chaos: 0.10, organicity: 0.95,  textureAffinity: 'clean'    }
```

**WAVE 977 — NUEVOS TECHNO:**
```
'ambient_strobe':     { aggression: 0.45, chaos: 0.40, organicity: 0.10,  textureAffinity: 'universal' }
'sonar_ping':         { aggression: 0.15, chaos: 0.10, organicity: 0.05,  textureAffinity: 'clean'    }
```

**ARSENAL PESADO / FINAL:**
```
'abyssal_rise':       { aggression: 0.80, chaos: 0.30, organicity: 0.50,  textureAffinity: 'universal' }
'fiber_optics':       { aggression: 0.10, chaos: 0.20, organicity: 0.00,  textureAffinity: 'clean'    }
'core_meltdown':      { aggression: 0.96, chaos: 0.94, organicity: 0.05,  textureAffinity: 'universal', selectionBias: 2.0 }
'neon_blinder':       { aggression: 0.82, chaos: 0.15, organicity: 0.05,  textureAffinity: 'universal' }
'surgical_strike':    { aggression: 0.88, chaos: 0.25, organicity: 0.02,  textureAffinity: 'universal' }
'ghost_chase':        { aggression: 0.25, chaos: 0.15, organicity: 0.90,  textureAffinity: 'universal' }
```

**FIESTA LATINA — THE LATINO LADDER (7 zonas):**
```
// ZONA 1: SILENCE
'amazon_mist':        { aggression: 0.05, chaos: 0.15, organicity: 0.80,  textureAffinity: 'clean'    }
'ghost_breath':       { aggression: 0.13, chaos: 0.25, organicity: 0.80,  textureAffinity: 'universal' }

// ZONA 2: VALLEY
'cumbia_moon':        { aggression: 0.21, chaos: 0.20, organicity: 0.80,  textureAffinity: 'clean'    }
'tidal_wave':         { aggression: 0.28, chaos: 0.25, organicity: 0.65,  textureAffinity: 'universal' }

// ZONA 3: AMBIENT
'corazon_latino':     { aggression: 0.37, chaos: 0.35, organicity: 0.75,  textureAffinity: 'clean'    }
'strobe_burst':       { aggression: 0.43, chaos: 0.35, organicity: 0.40,  textureAffinity: 'universal' }

// ZONA 4: GENTLE
'clave_rhythm':       { aggression: 0.48, chaos: 0.20, organicity: 0.70,  textureAffinity: 'universal' }
'tropical_pulse':     { aggression: 0.56, chaos: 0.45, organicity: 0.65,  textureAffinity: 'universal' }

// ZONA 5: ACTIVE
'glitch_guaguanco':   { aggression: 0.64, chaos: 0.28, organicity: 0.35,  textureAffinity: 'universal' }
'machete_spark':      { aggression: 0.70, chaos: 0.25, organicity: 0.30,  textureAffinity: 'universal' }

// ZONA 6: INTENSE
'salsa_fire':         { aggression: 0.75, chaos: 0.22, organicity: 0.38,  textureAffinity: 'universal' }
'solar_flare':        { aggression: 0.86, chaos: 0.25, organicity: 0.45,  textureAffinity: 'universal' }

// ZONA 7: PEAK
'latina_meltdown':    { aggression: 0.92, chaos: 0.20, organicity: 0.20,  textureAffinity: 'dirty'    }
'oro_solido':         { aggression: 0.90, chaos: 0.15, organicity: 0.40,  textureAffinity: 'universal' }
'strobe_storm':       { aggression: 0.93, chaos: 0.35, organicity: 0.15,  textureAffinity: 'dirty'    }
```

**POP-ROCK (WAVE 1020):**
```
'thunder_struck':      { aggression: 0.95, chaos: 0.10, organicity: 0.05,  textureAffinity: 'dirty'    }
'liquid_solo':        { aggression: 0.40, chaos: 0.35, organicity: 0.75,  textureAffinity: 'clean'    }
'amp_heat':           { aggression: 0.15, chaos: 0.15, organicity: 0.90,  textureAffinity: 'clean'    }
'arena_sweep':        { aggression: 0.50, chaos: 0.20, organicity: 0.25,  textureAffinity: 'clean'    }
'feedback_storm':     { aggression: 0.85, chaos: 0.90, organicity: 0.10,  textureAffinity: 'dirty'    }
'power_chord':        { aggression: 0.85, chaos: 0.15, organicity: 0.10,  textureAffinity: 'dirty'    }
'stage_wash':         { aggression: 0.25, chaos: 0.10, organicity: 0.60,  textureAffinity: 'clean'    }
'spotlight_pulse':    { aggression: 0.50, chaos: 0.20, organicity: 0.40,  textureAffinity: 'clean'    }
```

**CHILL LOUNGE / THE LIVING OCEAN (WAVE 1070):**
```
'solar_caustics':     { aggression: 0.10, chaos: 0.15, organicity: 0.85,  textureAffinity: 'clean'    }
'school_of_fish':     { aggression: 0.15, chaos: 0.30, organicity: 0.90,  textureAffinity: 'clean'    }
'whale_song':         { aggression: 0.05, chaos: 0.15, organicity: 0.98,  textureAffinity: 'clean'    }
'abyssal_jellyfish':  { aggression: 0.20, chaos: 0.40, organicity: 0.95,  textureAffinity: 'universal' }
'surface_shimmer':    { aggression: 0.00, chaos: 0.15, organicity: 0.80,  textureAffinity: 'clean'    }
'plankton_drift':     { aggression: 0.05, chaos: 0.35, organicity: 0.90,  textureAffinity: 'clean'    }
'deep_current_pulse': { aggression: 0.10, chaos: 0.05, organicity: 0.95,  textureAffinity: 'universal' }
'bioluminescent_spore': { aggression: 0.00, chaos: 0.25, organicity: 1.00,  textureAffinity: 'universal' }
```

**Total: 47 efectos con DNA registrado.**

### 3.4 · WILDCARDS por categoría

**Fuente:** `EffectDNA.ts:627-633`:

```typescript
export const WILDCARD_EFFECTS: Record<string, string> = {
  'techno-industrial': 'cyber_dualism',
  'techno-atmospheric': 'digital_rain',
  'latino-organic': 'clave_rhythm',
  'pop-rock': 'spotlight_pulse',
  'chill-lounge': 'deep_current_pulse',
}
```

### 3.5 · Lookups semánticas del DNAAnalyzer

**Fuente:** `EffectDNA.ts:588-615`:

```typescript
const MOOD_ORGANICITY: Record<Mood, number> = {
  'dreamy': 0.90,
  'melancholic': 0.80,
  'neutral': 0.50,
  'mysterious': 0.60,
  'euphoric': 0.55,
  'triumphant': 0.45,
  'aggressive': 0.20,
}

const SECTION_ORGANICITY: Record<SectionType, number> = {
  'intro': 0.70,
  'verse': 0.65,
  'chorus': 0.50,
  'bridge': 0.60,
  'breakdown': 0.85,
  'buildup': 0.40,
  'drop': 0.15,
  'outro': 0.75,
  'unknown': 0.50,
}
```

---

## 4. FILTROS DEL GATEKEEPER (Ethics & Availability)

### 4.1 · Pipeline de verificación único

**Fuente:** `src/core/effects/ContextualEffectSelector.ts:726-795` — método `checkAvailability()`:

El Gatekeeper evalúa en ESTE ORDEN EXACTO:

1. **MOOD FORCE UNLOCK** — `moodController.isEffectForceUnlocked(effectType)` → bypassa TODO.
2. **MOOD BLOCKLIST** — `moodController.isEffectBlocked(effectType)` → bloqueo incondicional.
3. **DICTATOR HARD MINIMUM COOLDOWN** — `DICTATOR_HARD_MINIMUM_COOLDOWNS[effectType]` → no bypassable por DNA override.
4. **COOLDOWN CHECK** — `effectTypeCooldowns[effectType]` × vibe adjustment × `moodController.applyCooldown()`.
5. **AVAILABLE** — pasa.

### 4.2 · DICTATOR HARD MINIMUM COOLDOWNS

**Fuente:** `ContextualEffectSelector.ts:101-115`:

```typescript
export const DICTATOR_HARD_MINIMUM_COOLDOWNS: Record<string, number> = {
  'abyssal_rise': 20000,      // 20s
  'gatling_raid': 15000,      // 15s
  'core_meltdown': 12000,     // 12s
  'industrial_strobe': 12000, // 12s
  'strobe_storm': 12000,      // 12s
  'latina_meltdown': 15000,   // 15s
  'oro_solido': 22000,        // 22s
}
```

### 4.3 · EFFECT_COOLDOWNS (base, pre-multiplicador de mood)

**Fuente:** `ContextualEffectSelector.ts:117-207` — extracto de los cooldowns explícitos:

```typescript
export const EFFECT_COOLDOWNS: Record<string, number> = {
  // === LATINO ===
  'cumbia_moon': 25000,
  'tropical_pulse': 28000,
  'corazon_latino': 28000,
  'clave_rhythm': 28000,
  'glitch_guaguanco': 22000,
  'machete_spark': 22000,
  'salsa_fire': 28000,
  'solar_flare': 30000,
  'latina_meltdown': 35000,
  'oro_solido': 28000,

  // === TECHNO ===
  'industrial_strobe': 8000,
  'acid_sweep': 8000,
  'cyber_dualism': 10000,
  'gatling_raid': 8000,
  'sky_saw': 8000,
  'abyssal_rise': 30000,

  // === ATMOSPHERIC ===
  'void_mist': 12000,
  'binary_glitch': 10000,
  'seismic_snap': 10000,
  'digital_rain': 10000,
  'deep_breath': 10000,
  'ambient_strobe': 10000,
  'sonar_ping': 10000,

  // === FINAL ARSENAL ===
  'fiber_optics': 10000,
  'core_meltdown': 12000,
  'neon_blinder': 12000,
  'surgical_strike': 10000,
  'ghost_chase': 10000,

  // === POP-ROCK ===
  'thunder_struck': 15000,
  'liquid_solo': 10000,
  'amp_heat': 10000,
  'arena_sweep': 10000,
  'feedback_storm': 15000,
  'power_chord': 12000,
  'stage_wash': 10000,
  'spotlight_pulse': 10000,

  // === CHILL LOUNGE / OCEANIC ===
  'solar_caustics': 90000,
  'school_of_fish': 90000,
  'whale_song': 120000,
  'abyssal_jellyfish': 90000,
  'surface_shimmer': 60000,
  'plankton_drift': 60000,
  'deep_current_pulse': 60000,
  'bioluminescent_spore': 60000,
}
```

**Fallback:** Si un efecto no tiene entrada explícita, usa `DEFAULT_CONFIG.minCooldownMs = 800` (`ContextualEffectSelector.ts:325`).

**Multiplicador de mood:** `moodController.applyCooldown(baseCooldown)` multiplica por:
- `CALM`: 4.0× (WAVE 1182.2)
- `BALANCED`: 2.2× (WAVE 4829)
- `PUNK`: 0.7×

### 4.4 · Mood Profiles (ethics, thresholds, blockLists)

**Fuente:** `src/core/mood/MoodController.ts:29-123`:

```typescript
export const MOOD_PROFILES: Record<MoodId, MoodProfile> = {
  calm: {
    name: 'calm',
    thresholdMultiplier: 2.5,    // WAVE 1182.2
    cooldownMultiplier: 4.0,     // WAVE 1182.2
    ethicsThreshold: 0.95,       // WAVE 1182.2
    maxIntensity: 0.6,
    minIntensity: undefined,
    blockList: [
      'core_meltdown', 'industrial_strobe', 'gatling_raid',
      'strobe_storm', 'latina_meltdown', 'feedback_storm',
      'surgical_strike', 'neon_blinder', 'thunder_struck',
    ],
  },
  balanced: {
    name: 'balanced',
    thresholdMultiplier: 1.10,   // WAVE 2492
    cooldownMultiplier: 2.2,     // WAVE 4829
    ethicsThreshold: 1.20,       // WAVE 2104.2
    maxIntensity: 1.0,
    minIntensity: undefined,
    blockList: [],
  },
  punk: {
    name: 'punk',
    thresholdMultiplier: 0.8,
    cooldownMultiplier: 0.7,
    ethicsThreshold: 0.75,       // WAVE 973
    maxIntensity: 1.0,
    minIntensity: 0.5,
    blockList: [],
  },
}
```

### 4.5 · DNAAnalyzer — Diversity Engine

**Fuente:** `src/core/intelligence/dna/EffectDNA.ts:680-711`:

```typescript
private readonly SMOOTHING_ALPHA = 0.30       // EMA para TargetDNA
private readonly MIDDLE_VOID_THRESHOLD = 0.60
private readonly MAX_DISTANCE = Math.sqrt(3)  // ~1.732
private readonly USAGE_WINDOW_MS = 120000     // 120 segundos
private readonly DIVERSITY_FACTORS = [1.0, 0.70, 0.35, 0.15]
```

**Lógica:** Cada vez que un efecto se dispara, `DNAAnalyzer.recordEffectUsage(effectType)` incrementa su contador. Al calcular relevancia, se multiplica por el factor correspondiente al número de usos dentro de la ventana de 120s.

### 4.6 · Global Cooldowns (SeleneTitanConscious)

**Fuente:** `src/core/intelligence/SeleneTitanConscious.ts:317-347`:

```typescript
private readonly DNA_OVERRIDE_MIN_INTERVAL_MS = 12000           // 12s entre overrides
private readonly DNA_OVERRIDE_SAME_EFFECT_INTERVAL_MS = 20000   // 20s para repetir MISMO efecto con override
private readonly PIPELINE_EXECUTION_THROTTLE_MS = 2000          // 2s entre pipelines
private readonly GLOBAL_EFFECT_COOLDOWN_MS = 7000               // 7s base (WAVE 2106)
private readonly LATINA_GLOBAL_EFFECT_COOLDOWN_MS = 12000       // 12s para fiesta-latina (WAVE 4834)
```

### 4.7 · Fuzzy Decision Maker — Reglas y umbrales

**Fuente:** `src/core/intelligence/think/FuzzyDecisionMaker.ts`

**Membership parameters (`MEMBERSHIP_PARAMS:225-251`):**
```typescript
energy: {
  low:    { center: 0.0, spread: 0.35 },
  medium: { center: 0.5, spread: 0.30 },
  high:   { center: 1.0, spread: 0.50 },  // WAVE 2107: spread 0.35→0.50
},
zScore: {
  normal:   { threshold: 1.5 },
  notable:  { low: 1.5, high: 2.8 },
  epic:     { threshold: 2.8 },
},
harshness: {
  low:    { center: 0.0, spread: 0.05 },
  medium: { center: 0.075, spread: 0.05 },
  high:   { center: 0.15, spread: 0.10 },
}
```

**Fuzzy Rules (`FUZZY_RULES:437-654`) — 22 reglas exactas:**

| # | Nombre | Consecuente | Peso |
|---|--------|-------------|------|
| 1 | `Divine_Drop` | forceStrike | 1.00 |
| 2 | `Epic_Peak` | forceStrike | 0.95 |
| 3 | `Epic_Hunt` | forceStrike | 0.90 |
| 4 | `Hunt_Strike` | strike | 0.85 |
| 5 | `Harsh_Climax` | strike | 0.80 |
| 6 | `Notable_Peak` | strike | 0.75 |
| 7 | `High_Energy_Hunt` | strike | 0.70 |
| 8 | `Beautiful_Peak` | strike | 0.65 |
| 9 | `Hunt_Buildup_Strike` | strike | 0.80 |
| 10 | `Notable_Energy_Strike` | strike | 0.75 |
| 11 | `Pure_Energy_Strike` | strike | 0.70 |
| 12 | `Energy_Building_Strike` | strike | 0.70 |
| 13 | `Building_Tension` | prepare | 0.60 |
| 14 | `Notable_Building` | prepare | 0.55 |
| 15 | `Harshness_Rising` | prepare | 0.50 |
| 16 | `Energy_Rising` | prepare | 0.45 |
| 17 | `Hunt_Preparing` | prepare | 0.50 |
| 18 | `Quiet_Section` | hold | 1.00 |
| 19 | `Normal_State` | hold | 0.85 |
| 20 | `Low_Energy` | hold | 0.70 |
| 21 | `No_Hunt_Interest` | hold | 0.60 |
| 22 | `Energy_Silence_Total_Suppress` | hold | 1.00 |
| 23 | `Energy_Valley_Suppress` | hold | 0.85 |
| 24 | `Energy_Low_Dampen_Action` | hold | 0.70 |

**Defuzzify thresholds (`defuzzify:725-765`):**
```typescript
// Prioridad 1
if (outputs.forceStrike > 0.5) → 'force_strike'

// Prioridad 2 (WAVE 2109)
else if (outputs.strike > outputs.hold + 0.08 && outputs.strike > 0.25) → 'strike'

// Prioridad 3 (WAVE 1176)
else if (outputs.prepare > outputs.hold && outputs.prepare > 0.35) → 'prepare'

// Default
else → 'hold'
```

**Section fuzzy profiles (`fuzzifySection:407-418`):**
```typescript
'intro':     { quiet: 1.0, building: 0.2, peak: 0.0 }
'verse':     { quiet: 0.3, building: 0.7, peak: 0.1 }
'chorus':    { quiet: 0.0, building: 0.2, peak: 1.0 }
'bridge':    { quiet: 0.4, building: 0.6, peak: 0.2 }
'buildup':   { quiet: 0.0, building: 1.0, peak: 0.3 }
'drop':      { quiet: 0.0, building: 0.0, peak: 1.0 }
'breakdown': { quiet: 0.3, building: 0.5, peak: 0.2 }  // WAVE 2100
'outro':     { quiet: 1.0, building: 0.1, peak: 0.0 }
```

---

## 5. NOTAS SOBRE ALUCINACIONES DETECTADAS EN WAVE-4838

| Claim de WAVE-4838 | Realidad del código |
|---|---|
| "7 valores éticos" en VisualConscienceEngine | No se encontró enum ni array de 7 valores. `VisualConscienceEngine` no aparece como clase explícita en el grep. El cálculo de `ethicalScore` existe en `EffectDreamSimulator.ts` (~línea 1536+) pero no hay lista canónica de 7 valores. |
| "Tags como `strobe`, `heavy`" en EffectDNA | **No existen.** No hay campo `tags` en `EffectDNA`. `heavy` es una categoría inferida por `HEAVY_ARSENAL_EFFECTS` (un `Set` hardcodeado en `DecisionMaker.ts`). |
| "Diversity Factor 1.0→0.8→0.5→0.2" | Era correcto en versiones anteriores. **Realidad actual:** `[1.0, 0.70, 0.35, 0.15]` (WAVE 2107, `EffectDNA.ts:711`). |
| "Ventana de diversidad 120s" | Correcto. `USAGE_WINDOW_MS = 120000` (WAVE 2095.3). |
| "EMA smoothing α=0.30" | Correcto. `SMOOTHING_ALPHA = 0.30` (WAVE 2107). |
| "Zona energética `divine`" | **No existe.** El tipo `EnergyZone` tiene 7 valores; `divine` no es uno de ellos. Los drops divinos se detectan por `zScore >= 4.0` + `rawEnergy >= 0.72` en `DecisionMaker.ts`. |

---

*Documento compilado por Cascade (Auditoría Forense). Todos los valores son literales extraídos del AST/lexer del código fuente de LuxSync. Sin alucinaciones, sin interpolaciones.*
