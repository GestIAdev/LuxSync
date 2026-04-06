# 🏛️ WAVE 2480 — THE INFINITE ARSENAL

## BLUEPRINT ARQUITECTÓNICO: Puente Hephaestus ↔ Selene IA

**Versión**: 1.0  
**Arquitecto**: PunkOpus — DSP Senior  
**Solicitado por**: Dirección de Arquitectura (Gemini / Radwulf)  
**Estado**: BLUEPRINT APROBADO PARA IMPLEMENTACIÓN  
**Vulnerabilidad Resuelta**: COG-13 (Catálogo de efectos hardcodeado en EffectDreamSimulator)  
**Fecha**: 6 Abril 2026  
**Clasificación**: Documento Técnico Interno  

---

## RESUMEN EJECUTIVO

Este blueprint define la arquitectura para conectar el editor de curvas Hephaestus (Área 2) con el motor cognitivo Selene IA (Área 4), resolviendo la vulnerabilidad COG-13: **2.063 líneas de catálogo de efectos hardcodeado** dentro de `EffectDreamSimulator.ts`.

La solución establece un `DynamicEffectRegistry` que ingesta archivos `.lfx` con metadata cognitiva (`cognitiveDNA`), alimentando a los 15 submotores de Selene sin romper la política Zero-Allocation del hot path ni exceder el frame budget de ~5ms.

**El resultado**: Selene pasa de un arsenal fijo de 47 efectos hardcodeados a un arsenal **infinito** de clips `.lfx` creados por la comunidad, cada uno con su genoma 3D, filtros de compatibilidad, y curvas Bézier reales.

---

## TABLA DE CONTENIDOS

1. [Diagnóstico: La Herida COG-13](#1-diagnóstico-la-herida-cog-13)
2. [Extensión del Esquema Hephaestus (.lfx)](#2-extensión-del-esquema-hephaestus-lfx)
3. [DynamicEffectRegistry: Ingesta Zero-Allocation](#3-dynamiceffectregistry-ingesta-zero-allocation)
4. [Interacción con los 15 Submotores de Selene](#4-interacción-con-los-15-submotores-de-selene)
5. [El Puente de Ejecución: TitanEngine → HephaestusRuntime](#5-el-puente-de-ejecución-titanengine--hephaestusruntime)
6. [Flujo de Datos Completo](#6-flujo-de-datos-completo)
7. [Frame Budget y Cuellos de Botella](#7-frame-budget-y-cuellos-de-botella)
8. [Plan de Migración Progresiva](#8-plan-de-migración-progresiva)
9. [Apéndice: Interfaces Completas](#9-apéndice-interfaces-completas)

---

## 1. DIAGNÓSTICO: LA HERIDA COG-13

### 1.1 Estado Actual: El Monolito

`EffectDreamSimulator.ts` (2.063 LOC) contiene, hardcodeados en su cuerpo:

| Dato Hardcodeado | Líneas Aprox. | Ejemplo |
|---|---|---|
| `EFFECTS_BY_VIBE` — Whitelist por género | ~200 LOC | `'techno-club': ['industrial_strobe', ...]` |
| Beauty weights (base, energyMultiplier, vibeBonus) | ~150 LOC | `acid_sweep: { base: 0.75, energyMultiplier: 1.2 }` |
| GPU costs y fatigue impacts | ~100 LOC | `core_meltdown: { gpuCost: 0.40, fatigue: 0.10 }` |
| Energy zone filters (aggression limits) | ~80 LOC | `peak: { minAggression: 0.70 }` |
| Z-score guards por efecto | ~40 LOC | Strobe Z-Guard, Gatling Peak Requirement |

En paralelo, `EffectDNA.ts` (1.081 LOC) contiene:

| Dato Hardcodeado | Líneas Aprox. |
|---|---|
| `DNA_REGISTRY` — 47 vectores (A, C, O) + TextureAffinity | ~200 LOC |

Y `DecisionMaker.ts` contiene:

| Dato Hardcodeado | Líneas Aprox. |
|---|---|
| `DIVINE_ARSENAL` — Armas por vibe | ~50 LOC |
| `HEAVY_ARSENAL` — Arsenal pesado | ~30 LOC |

**Total**: ~850 LOC de datos que deberían ser configuración externa, no código.

### 1.2 El Problema Real

No es solo limpieza de código. El problema es **escalabilidad funcional**:

1. **Agregar un efecto nuevo** requiere tocar 3 archivos de lógica core (DreamSimulator, EffectDNA, DecisionMaker) + el EffectsEngine. Riesgo de regresión alto.
2. **La comunidad no puede contribuir** efectos sin acceso al código fuente y conocimiento de 4 APIs internas.
3. **Los 13 EFFECT_DEFINITIONS del EffectsEngine** (strobe, pulse, blinder, shake, dizzy, police, rainbow, breathe, beam, prism...) son primitivas DMX genéricas. Los 47 nombres del DNA (acid_sweep, industrial_strobe, etc.) son *conceptos cognitivos* que mapean a combinaciones paramétrizadas de estas primitivas. Ese mapeo es implícito y mental, no declarativo.

### 1.3 La Solución: Externalización mediante .lfx Enriquecido

Cada efecto se convierte en un archivo `.lfx` autocontenido que lleva:
- **Curvas Bézier reales** (el comportamiento DMX exacto) — ya existe en Hephaestus
- **CognitiveDNA** (el genoma 3D) — nuevo bloque a inyectar
- **Filtros de compatibilidad** (vibes, secciones, zonas) — nuevo bloque
- **Metadata de simulación** (beauty, GPU cost, fatigue) — nuevo bloque
- **Checksums de integridad** — ya existe (SHA-256)

El resultado: **un solo archivo `.lfx` reemplaza las entradas dispersas en 4 archivos de código**.

---

## 2. EXTENSIÓN DEL ESQUEMA HEPHAESTUS (.lfx)

### 2.1 Esquema Actual (v1.0.0)

```json
{
  "$schema": "hephaestus/v1",
  "version": "1.0.0",
  "clip": {
    "id": "heph-...",
    "name": "...",
    "author": "...",
    "category": "movement",
    "tags": [],
    "vibeCompat": [],
    "zones": ["all"],
    "mixBus": "htp",
    "durationMs": 4000,
    "effectType": "heph_custom",
    "curves": { ... },
    "staticParams": { ... }
  },
  "checksum": "sha256..."
}
```

### 2.2 Esquema Extendido (v2.0.0) — El Bloque `cognitiveDNA`

```json
{
  "$schema": "hephaestus/v2",
  "version": "2.0.0",
  "clip": {
    "id": "heph-1744108800000-a1b2",
    "name": "Acid Sweep",
    "author": "PunkOpus",
    "category": "composite",
    "tags": ["sweep", "techno", "reactive"],
    "zones": ["all"],
    "mixBus": "htp",
    "priority": 75,
    "durationMs": 4000,
    "effectType": "heph_custom",
    "curves": {
      "intensity": { ... },
      "pan": { ... },
      "color": { ... }
    },
    "staticParams": {},
    "selector": { ... },

    "cognitiveDNA": {
      "genome": {
        "aggression": 0.70,
        "chaos": 0.45,
        "organicity": 0.25
      },
      "textureAffinity": "universal",
      "compatibleVibes": ["techno-club", "techno", "industrial"],
      "validSections": ["drop", "buildup", "chorus", "peak"],
      "energyZone": {
        "min": "ambient",
        "max": "peak"
      },
      "aggressionRange": {
        "min": 0.25,
        "max": 1.00
      }
    },

    "simulationMeta": {
      "beautyWeights": {
        "base": 0.75,
        "energyMultiplier": 1.20,
        "vibeBonus": 0.15
      },
      "gpuCost": 0.25,
      "fatigueImpact": 0.06,
      "minDurationMs": 2000,
      "cooldownMs": 7000,
      "isStrobe": false,
      "isDivineCandidate": false,
      "isHeavyCandidate": false,
      "zScoreGuards": {
        "requireRising": false,
        "minimumZ": null,
        "minimumEnergy": null
      }
    },

    "executionHints": {
      "overlayMode": "absolute",
      "phaseConfig": {
        "spread": 0.3,
        "symmetry": "mirror",
        "wings": 1,
        "direction": 1
      },
      "intensityScaling": "proportional",
      "fixtureTargeting": "movers"
    }
  },
  "checksum": "sha256..."
}
```

### 2.3 Detalle de Cada Bloque Nuevo

#### `cognitiveDNA` — El Genoma para EffectDNA

| Campo | Tipo | Descripción | Validación |
|---|---|---|---|
| `genome.aggression` | `number` | Coordenada A del cubo unitario | `[0.0, 1.0]` |
| `genome.chaos` | `number` | Coordenada C del cubo unitario | `[0.0, 1.0]` |
| `genome.organicity` | `number` | Coordenada O del cubo unitario | `[0.0, 1.0]` |
| `textureAffinity` | `'clean' \| 'dirty' \| 'universal'` | Compatibilidad espectral | Enum estricto |
| `compatibleVibes` | `string[]` | Vibes donde este efecto puede operar | `length ≥ 1` |
| `validSections` | `string[]` | Secciones musicales compatibles | Subset de `['silence','valley','verse','buildup','chorus','drop','breakdown','peak','outro','bridge']` |
| `energyZone.min` / `energyZone.max` | `EnergyZone` | Rango de zona energética válida | Enum: silence→peak |
| `aggressionRange.min` / `.max` | `number` | Rango de aggression del target DNA donde este efecto compite | `[0.0, 1.0]` |

**Invariantes**:
- `genome` es inmutable post-ingesta. NO se modifica en runtime.
- `compatibleVibes` es el reemplazo directo de `EFFECTS_BY_VIBE`.
- `validSections` es nuevo: permite al DecisionMaker descartar efectos por contexto musical sin consultar el DNA.
- `aggressionRange` es nuevo: pre-filtro O(1) que evita calcular distancia euclidiana para efectos claramente fuera de rango.

#### `simulationMeta` — Datos para EffectDreamSimulator

| Campo | Tipo | Descripción |
|---|---|---|
| `beautyWeights.base` | `number` | Score de belleza base `[0.0, 1.0]` |
| `beautyWeights.energyMultiplier` | `number` | Multiplicador por energía `[0.5, 2.0]` |
| `beautyWeights.vibeBonus` | `number` | Bonus cuando match de vibe `[0.0, 0.5]` |
| `gpuCost` | `number` | Costo GPU estimado `[0.0, 1.0]` |
| `fatigueImpact` | `number` | Impacto en fatiga de audiencia `[-0.10, 0.20]` (negativo = descanso) |
| `minDurationMs` | `number` | Duración mínima para que el efecto tenga sentido |
| `cooldownMs` | `number` | Cooldown minimum post-ejecución |
| `isStrobe` | `boolean` | Sujeto a Z-Guard de strobe (solo en energía rising) |
| `isDivineCandidate` | `boolean` | Elegible para DIVINE_ARSENAL dinámico |
| `isHeavyCandidate` | `boolean` | Elegible para HEAVY_ARSENAL dinámico |
| `zScoreGuards` | `object` | Guards especiales de Z-score |

**Invariantes**:
- `gpuCost` se valida contra el headroom disponible en runtime.
- `isDivineCandidate` + `isHeavyCandidate` reemplazan las listas hardcodeadas de `DIVINE_ARSENAL` y `HEAVY_ARSENAL`.
- Efectos sin `simulationMeta` usan defaults conservadores (base=0.50, gpuCost=0.30, cooldown=10000).

#### `executionHints` — Directivas para HephaestusRuntime

| Campo | Tipo | Descripción |
|---|---|---|
| `overlayMode` | `'absolute' \| 'relative' \| 'additive'` | Modo global del clip cuando es disparado por Selene |
| `phaseConfig` | `PhaseConfig` | Distribución de fase sugerida |
| `intensityScaling` | `'proportional' \| 'fixed' \| 'energyDriven'` | Cómo se escala la intensidad del clip |
| `fixtureTargeting` | `'all' \| 'movers' \| 'pars' \| 'strobes' \| 'zone-front' \| 'zone-back'` | Target de fixtures sugerido |

**Invariantes**:
- `overlayMode` default es `'absolute'` — el clip controla directamente los canales DMX.
- `intensityScaling = 'proportional'` significa que la intensity de Selene (0-1) escala proporcionalmente todas las curvas.
- `intensityScaling = 'energyDriven'` delega la intensidad al AudioBinding del clip (reactivo a energía real).
- `fixtureTargeting` es sugerencia — el MasterArbiter puede override según la configuración del show.

### 2.4 Retrocompatibilidad

| Versión | Comportamiento |
|---|---|
| `v1.0.0` sin `cognitiveDNA` | El registro lo trata como "efecto Hephaestus puro" — solo ejecutable desde Chronos timeline, invisible para Selene IA |
| `v2.0.0` con `cognitiveDNA` | Efecto híbrido — visible para Selene IA y ejecutable desde Chronos |
| `v2.0.0` sin `curves` (solo DNA) | Rechazado. Un efecto sin curvas es un concepto sin cuerpo. |

La coexistencia es pacífica: Selene ignora `.lfx` v1 porque no tienen genoma. Chronos ejecuta `.lfx` v2 normalmente porque las curvas están intactas.

---

## 3. DYNAMICEFFECTREGISTRY: INGESTA ZERO-ALLOCATION

### 3.1 Arquitectura

```
┌─ FILESYSTEM ──────────────────────────────────────────────────┐
│                                                                │
│  📁 /user-effects/             📁 /builtin-effects/           │
│  ├── community-acid.lfx        ├── acid_sweep.lfx             │
│  ├── my-custom-drop.lfx        ├── industrial_strobe.lfx      │
│  └── reggaeton-pulse.lfx       ├── whale_song.lfx             │
│                                └── ... (47 efectos migrados)  │
│                                                                │
└──────────────┬──────────────────────────┬─────────────────────┘
               │ Startup scan              │ fs.watch()
               │ (una sola vez)            │ (hot reload)
               ▼                           ▼
┌─ DynamicEffectRegistry (Singleton) ───────────────────────────┐
│                                                                │
│  ┌─ FASE 1: INGESTA (startup / hot reload) ────────────────┐  │
│  │  1. Scan directorios (globSync '*.lfx')                 │  │
│  │  2. Leer archivo → JSON.parse()                         │  │
│  │  3. Validar checksum SHA-256                            │  │
│  │  4. Validar schema ($schema === 'hephaestus/v2')        │  │
│  │  5. Validar cognitiveDNA (rangos, enums, invariantes)   │  │
│  │  6. Extraer DNA + SimMeta + ExecHints                   │  │
│  │  7. Almacenar en cache pre-allocado                     │  │
│  │  8. NO almacenar curvas completas (solo path al .lfx)   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ CACHE (pre-allocated, immutable post-load) ─────────────┐ │
│  │                                                           │ │
│  │  effectIndex: Map<string, RegistryEntry>                  │ │
│  │                                                           │ │
│  │  RegistryEntry = {                                        │ │
│  │    id: string              // "heph-..." o effectName     │ │
│  │    filePath: string        // path al .lfx en disco       │ │
│  │    name: string            // nombre humano               │ │
│  │    dna: FrozenDNA          // { A, C, O } inmutable       │ │
│  │    textureAffinity: str    // 'clean'|'dirty'|'universal' │ │
│  │    compatibleVibes: str[]  // whitelist de vibes          │ │
│  │    validSections: str[]    // whitelist de secciones      │ │
│  │    energyZone: {min, max}  // rango de zona energética    │ │
│  │    aggressionRange: {m,M}  // pre-filtro rápido           │ │
│  │    simMeta: SimulationMeta // beauty, gpu, fatigue        │ │
│  │    execHints: ExecHints    // overlay, phase, targeting   │ │
│  │    isBuiltin: boolean      // true = migrado del core     │ │
│  │    loadedAt: number        // timestamp de carga          │ │
│  │  }                                                        │ │
│  │                                                           │ │
│  │  vibeIndex: Map<string, RegistryEntry[]>                  │ │
│  │  divinePool: RegistryEntry[]                              │ │
│  │  heavyPool: RegistryEntry[]                               │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌─ API PÚBLICA ────────────────────────────────────────────┐  │
│  │  getEffectsForVibe(vibe: string): RegistryEntry[]        │  │
│  │  getDNA(effectId: string): FrozenDNA | undefined         │  │
│  │  getSimMeta(effectId: string): SimulationMeta            │  │
│  │  getDivineArsenal(vibe: string): RegistryEntry[]         │  │
│  │  getHeavyArsenal(vibe: string): RegistryEntry[]          │  │
│  │  getEffectFilePath(effectId: string): string | undefined │  │
│  │  getAllEntries(): RegistryEntry[]                         │  │
│  │  getEntryCount(): number                                 │  │
│  │  reloadFromDisk(): void                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 Política Zero-Allocation en Runtime

El contrato es claro: **TODA la allocación ocurre en startup o hot-reload. CERO allocaciones en el hot path (tick/frame).**

| Fase | Allocación | Frecuencia | Impacto GC |
|---|---|---|---|
| **Startup scan** | N × RegistryEntry | 1 vez al iniciar app | Ninguno (antes del primer frame) |
| **Hot reload** (`fs.watch`) | 1 × RegistryEntry por `.lfx` modificado | Raro (usuario guarda archivo) | Negligible (evento aislado) |
| **Frame query** (`getEffectsForVibe()`) | **CERO** — retorna referencia al array pre-calculado | 60fps × siempre | **CERO** |
| **DNA query** (`getDNA()`) | **CERO** — retorna referencia al objeto frozen | Condicional | **CERO** |

**Mecanismo**:

1. **Pre-indexación**: Al cargar un `.lfx`, su `RegistryEntry` se inserta en `effectIndex` (por ID) y en `vibeIndex` (por cada vibe compatible). Los índice `vibeIndex`, `divinePool`, `heavyPool` son arrays pre-construidos.

2. **Inmutabilidad**: Cada `RegistryEntry` se congela con `Object.freeze()` tras la ingesta. Cualquier mutación accidental lanza TypeError en strict mode.

3. **Separación curvas/DNA**: El Registry NO carga las curvas Bézier en memoria. Solo almacena el `filePath`. Las curvas se cargan bajo demanda SOLO cuando HephaestusRuntime necesita ejecutar el efecto (evento puntual, no per-frame).

4. **Carga lazy de curvas**: Cuando Selene decide disparar un efecto dinámico, `HephaestusRuntime.play(filePath)` carga el `.lfx` completo. Pero el Runtime ya tiene cache LRU propio para clips recientes, así que la segunda ejecución del mismo efecto es O(1) desde cache.

### 3.3 Hot Reload: Comunidad en Vivo

```
fs.watch('/user-effects/', { recursive: false })
  │
  ├─ 'add' / 'change' → 
  │    1. Leer .lfx
  │    2. Validar schema + checksum
  │    3. Si válido: insertar/actualizar en effectIndex + vibeIndex
  │    4. Reconstruir divinePool / heavyPool si isDivineCandidate
  │    5. Log: "DynamicRegistry: +1 effect loaded (community-acid.lfx)"
  │
  └─ 'unlink' →
       1. Remover de effectIndex + vibeIndex + pools
       2. Log: "DynamicRegistry: -1 effect removed (...)"
```

**Contrato de seguridad**: El hot-reload es atómico respecto al frame loop. Si Selene está en medio de `think()`, el reload espera al siguiente tick. Implementación: los índices se reconstruyen en un buffer shadow y se intercambian (swap) atómicamente al final del reload.

### 3.4 Validación de Archivos de Comunidad

Un `.lfx` de la comunidad pasa por 5 gates antes de ser aceptado:

| Gate | Validación | Rechazo |
|---|---|---|
| G1: Schema | `$schema === 'hephaestus/v2'` | `.lfx` v1 sin DNA → ignorado por Selene (solo Chronos) |
| G2: Checksum | `SHA-256(clip) === checksum` | Archivo corrupto → rechazado, log warning |
| G3: DNA Range | `genome.A/C/O ∈ [0.0, 1.0]`, textureAffinity es enum válido | Valores out-of-range → rechazado |
| G4: Vibe Valid | `compatibleVibes` contiene al menos 1 vibe conocido | Vibe desconocido → warning. Vibe vacío → rechazado |
| G5: Curve Sanity | Al menos 1 curva con ≥2 keyframes, duración > 0 | Clip vacío → rechazado |

Los archivos que pasan G1-G5 entran al Registry. Los rechazados se logean con razón explícita.

### 3.5 Escalabilidad: El Cuello de Botella Real

**¿Qué pasa cuando hay 500 efectos en el Registry?**

El único componente que itera sobre todos los efectos es `EffectDNA.rankEffects()` — actualmente O(47). Con 500 efectos:

| Operación | Con 47 | Con 500 | Mitigación |
|---|---|---|---|
| Distancia euclidiana + diversity | 47 × ~5μs = 0.24ms | 500 × ~5μs = 2.5ms | Pre-filtro por `aggressionRange` reduce a ~50-100 candidatos |
| DreamSimulator scenario scoring | ~15 top candidates | ~15 top candidates | Sin cambio — solo simula los top N |
| Vibe filter | O(1) lookup | O(1) lookup | `vibeIndex` pre-calculado |

**El pre-filtro por `aggressionRange`** es la clave de escalabilidad. Si el target DNA tiene aggression = 0.70, un efecto con `aggressionRange: { min: 0.0, max: 0.30 }` se descarta en O(1) antes de calcular la distancia 3D. En la práctica, esto filtra ~60-80% de los efectos.

Para el caso extremo de 500+ efectos, la siguiente optimización (si fuera necesaria) sería un **k-d tree 3D** sobre las coordenadas (A, C, O). Pero con pre-filtro, 500 efectos todavía están cómodamente dentro del budget de 5ms.

---

## 4. INTERACCIÓN CON LOS 15 SUBMOTORES DE SELENE

### 4.1 EffectDNA — Matching Genético 3D (Impacto: DIRECTO)

**Situación actual**: `DNA_REGISTRY` es un `Record<string, { aggression, chaos, organicity, textureAffinity }>` hardcodeado con 47 entradas.

**Cambio**: `EffectDNA.getEffectDNA(effectId)` consulta primero el `DynamicEffectRegistry.getDNA(effectId)`. Si no existe (efecto legacy), cae al `DNA_REGISTRY` hardcodeado como fallback durante la migración.

```
                   ┌─────────────────────────┐
                   │ EffectDNA.getEffectDNA() │
                   └───────────┬─────────────┘
                               │
                    ┌──────────▼──────────┐
                    │ DynamicEffectRegistry│
                    │   .getDNA(id)       │
                    └──────────┬──────────┘
                               │
                   ┌───────────▼────────────┐
                   │ ¿Existe en Registry?   │
                   └───┬──────────────┬─────┘
                   Sí  │              │ No
                       ▼              ▼
               FrozenDNA del      DNA_REGISTRY[id]
               .lfx cargado       (legacy fallback)
```

**Interfaz**:

```typescript
interface FrozenDNA {
  readonly aggression: number
  readonly chaos: number
  readonly organicity: number
  readonly textureAffinity: 'clean' | 'dirty' | 'universal'
}
```

**Impacto en rendimiento**: CERO — `getDNA()` es un `Map.get()` seguido de `Object.freeze()` ya aplicado en ingesta.

**Impacto en `rankEffects()`**: El método itera sobre `getAllEntries()` del Registry en vez de `Object.keys(DNA_REGISTRY)`. El pre-filtro por `aggressionRange` mantiene el set activo en ~50-100 candidatos.

```
rankEffects(targetDNA):
  allEffects = DynamicEffectRegistry.getEffectsForVibe(activeVibe)
  
  for entry in allEffects:
    // PRE-FILTRO O(1): ¿Está el target aggression dentro del rango?
    if targetDNA.aggression < entry.aggressionRange.min: skip
    if targetDNA.aggression > entry.aggressionRange.max: skip
    
    // EUCLIDIANA O(1): Distancia 3D
    distance = √[(A_eff - A_tgt)² + (C_eff - C_tgt)² + (O_eff - O_tgt)²]
    relevance = (1 - distance/√3) × confidence × diversityFactor
    
    // TEXTURE COMPAT
    if textureMismatch(entry.textureAffinity, spectralContext): penalize
    
    ranked.push({ entry, relevance })
  
  return ranked.sortByRelevance().topN(15)
```

### 4.2 EffectDreamSimulator — Simulación de Escenarios (Impacto: ALTO)

**Situación actual**: `dreamEffects()` consulta `EFFECTS_BY_VIBE[vibe]` hardcodeado, luego carga beauty weights, GPU costs, y fatigue impacts de constantes locales.

**Cambio**: `dreamEffects()` consulta `DynamicEffectRegistry.getEffectsForVibe(vibe)`, y para cada candidato, extrae la `simulationMeta` de la `RegistryEntry`.

**Flujo modificado**:

```
dreamEffects(state, prediction, context):
  1. vibe = context.activeVibe
  2. candidates = DynamicEffectRegistry.getEffectsForVibe(vibe)
                  // Retorna RegistryEntry[] pre-filtrado por vibe
  
  3. for entry in candidates:
       // ZONE FILTER: ¿La zona energética actual está en rango?
       if currentZone < entry.energyZone.min: skip
       if currentZone > entry.energyZone.max: skip
       
       // SECTION FILTER: ¿La sección musical actual es compatible?
       if currentSection NOT in entry.validSections: skip
       
       // Z-SCORE GUARDS (de simulationMeta)
       if entry.simMeta.isStrobe AND energy declining: skip
       if entry.simMeta.zScoreGuards.requireRising AND Z < 0: skip
       if entry.simMeta.zScoreGuards.minimumZ AND Z < threshold: skip
       
       // BEAUTY PROJECTION (con datos del .lfx)
       beauty = entry.simMeta.beautyWeights.base
              × (1 + (energy - 0.5) × (entry.simMeta.beautyWeights.energyMultiplier - 1))
              + entry.simMeta.beautyWeights.vibeBonus
       
       // GPU + FATIGUE
       risk = entry.simMeta.gpuCost × gpuLoadFactor
            + entry.simMeta.fatigueImpact × fatigueFactor
       
       scenario = simulateScenario(entry, beauty, risk, ...)
       scenarios.push(scenario)
  
  4. rank(scenarios) → top 15
  5. return { bestScenario, recommendation, ... }
```

**Impacto en rendimiento**:
- Los filtros de zone + section + Z-score son O(1) y eliminan candidatos ANTES de la simulación costosa.
- La simulación per-scenario sigue siendo O(1) — solo cambia el origen de los datos (de constantes locales a `entry.simMeta`).
- El top-N selector sigue operando sobre ~15 candidatos — sin cambio.

**La clave**: `entry.simMeta` ya está en memoria (pre-cargado en ingesta). No hay I/O durante `dreamEffects()`.

### 4.3 DecisionMaker — El General (Impacto: MEDIO)

**Situación actual**: `DIVINE_ARSENAL` y `HEAVY_ARSENAL` son `Record<string, string[]>` hardcodeados.

**Cambio**: `DIVINE_ARSENAL[vibe]` se reemplaza por `DynamicEffectRegistry.getDivineArsenal(vibe)`, que retorna `RegistryEntry[]` pre-calculado. Idem para Heavy.

```
getDivineArsenal(vibe: string): RegistryEntry[]
  // Pre-calculado en ingesta:
  // divinePool[vibe] = allEntries.filter(e => 
  //   e.simMeta.isDivineCandidate && e.compatibleVibes.includes(vibe)
  // )
```

**Impacto**: O(1) lookup — el pool está pre-indexado. El DecisionMaker ya no necesita mantener listas estáticas.

**Transición**: Durante la migración, si `getDivineArsenal(vibe)` retorna array vacío (no hay `.lfx` con `isDivineCandidate=true` para esa vibe), cae al `DIVINE_ARSENAL` hardcodeado legacy.

### 4.4 VisualConscienceEngine — Filtro Ético (Impacto: BAJO)

**Situación actual**: Los 7 valores éticos se evalúan contra cada `EffectCandidate`.

**Cambio**: Sin cambio en la lógica del motor ético. Los datos que necesita ya están en la `RegistryEntry`:

| Valor Ético | Dato del Registry | Campo |
|---|---|---|
| Safety (epilepsia) | `simMeta.isStrobe` | Activa modo epilepsia (+40% strictness) |
| Intensity | `simMeta.gpuCost` + `simMeta.fatigueImpact` | Ya disponible |
| Diversity | `effectId` (para tracking de uso) | Ya disponible |
| Coherence | `cognitiveDNA.validSections` | Nuevo — refuerza la evaluación ética |
| Novelty | `entry.isBuiltin` flag | Bonus sutil para efectos de comunidad |

**El contrato ético no cambia**: El motor evalúa candidatos por sus propiedades, no por su origen. Un efecto de comunidad pasa por los mismos 7 valores que uno builtin.

### 4.5 HuntEngine — El Cazador (Impacto: NINGUNO)

El HuntEngine opera con worthiness scores derivados de audio (beauty, consonance, tension, rhythm). No consulta el catálogo de efectos directamente. **Sin cambios.**

### 4.6 PredictionEngine — El Meteorólogo (Impacto: NINGUNO)

El PredictionEngine predice secciones musicales futuras basándose en audio analysis. No selecciona efectos. **Sin cambios.**

### 4.7 FuzzyDecisionMaker — El Hemisferio (Impacto: NINGUNO)

El motor fuzzy Mamdani opera sobre variables de entrada (energy, section, beauty, consonance). No consulta efectos. **Sin cambios.**

### 4.8 EnergyConsciousnessEngine — La Escalera (Impacto: NINGUNO)

Procesa señal de energía bruta. No tiene relación con el catálogo. **Sin cambios.**

### 4.9 BeautySensor + ConsonanceSensor (Impacto: NINGUNO)

Sensores que miden estética del estado visual actual. No dependen del catálogo. **Sin cambios.**

### 4.10 BiasDetector — Auto-Análisis (Impacto: BAJO)

El BiasDetector trackea decisiones por `effectId`. Con efectos dinámicos, simplemente hay más IDs posibles en la ventana de 100 decisiones. El `cognitive_health_score` puede mejorar naturalmente con un catálogo más diverso. **Sin cambios en la lógica.**

### 4.11 Resumen de Impacto

```
┌─────────────────────────────────┬──────────┬─────────────────────────┐
│ Submotor                        │ Impacto  │ Modificación            │
├─────────────────────────────────┼──────────┼─────────────────────────┤
│ EffectDNA                       │ DIRECTO  │ Source de datos cambia  │
│ EffectDreamSimulator            │ ALTO     │ Source + filtros nuevos │
│ DecisionMaker                   │ MEDIO    │ Arsenal dinámico        │
│ VisualConscienceEngine          │ BAJO     │ Datos nuevos, no lógica │
│ BiasDetector                    │ BAJO     │ Más IDs posibles        │
│ DreamEngineIntegrator           │ BAJO     │ Orquesta igual, datos ≠ │
│ HuntEngine                      │ NINGUNO  │ —                       │
│ PredictionEngine                │ NINGUNO  │ —                       │
│ FuzzyDecisionMaker              │ NINGUNO  │ —                       │
│ EnergyConsciousnessEngine       │ NINGUNO  │ —                       │
│ BeautySensor                    │ NINGUNO  │ —                       │
│ ConsonanceSensor                │ NINGUNO  │ —                       │
│ DropBridge                      │ NINGUNO  │ —                       │
│ ContextualMemory                │ NINGUNO  │ —                       │
│ SeleneTitanConscious            │ NINGUNO  │ Orquesta igual          │
└─────────────────────────────────┴──────────┴─────────────────────────┘
```

**10 de 15 submotores NO se tocan.** La encapsulación del pipeline cognitivo es sólida.

---

## 5. EL PUENTE DE EJECUCIÓN: TITANENGINE → HEPHAESTUSRUNTIME

### 5.1 Problema: El Gap de Ejecución

Actualmente, cuando Selene decide disparar `acid_sweep`, la cadena es:

```
Selene → ConsciousnessEffectDecision { effectType: 'acid_sweep' }
  → MasterArbiter Layer 3
  → EffectsEngine.triggerEffect('acid_sweep', params)
  → EFFECT_DEFINITIONS['acid_sweep']  ← ¿¿¿ESTO NO EXISTE???
```

**El gap**: Los 47 nombres del `DNA_REGISTRY` (acid_sweep, industrial_strobe, etc.) son *conceptos cognitivos*, no *definiciones de efectos DMX*. El `EffectsEngine` solo tiene 13 primitivas genéricas (strobe, pulse, blinder, shake, dizzy, police, rainbow, breathe, beam, prism...). El mapeo de conceptos cognitivos a primitivas DMX es actualmente **implícito y artesanal** — cada concepto es una parametrización específica de una o varias primitivas.

Con Hephaestus `.lfx`, este gap se elimina: cada concepto cognitivo TIENE un archivo `.lfx` con curvas Bézier reales que definen exactamente qué hace en el hardware.

### 5.2 El Nuevo Pipeline de Ejecución

```
┌─ SELENE DECIDE ──────────────────────────────────────────────┐
│                                                               │
│  DecisionMaker output:                                        │
│  {                                                            │
│    effectType: 'acid_sweep',  // effectId del Registry        │
│    intensity: 0.85,                                           │
│    zones: ['all'],                                            │
│    confidence: 0.78                                           │
│  }                                                            │
│                                                               │
└──────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─ SELENE-HEPH BRIDGE (nuevo módulo) ──────────────────────────┐
│                                                               │
│  1. Lookup: entry = DynamicEffectRegistry.get('acid_sweep')   │
│                                                               │
│  2. ¿Es efecto dinámico (.lfx)?                              │
│     │                                                         │
│     ├─ SÍ (.lfx existe, entry.filePath válido):              │
│     │   → Ruta Hephaestus (NUEVO)                            │
│     │                                                         │
│     └─ NO (legacy / sin .lfx):                               │
│         → Ruta EffectsEngine clásica (ACTUAL)                │
│                                                               │
└─────────┬───────────────────────────────┬─────────────────────┘
          │                               │
          ▼ RUTA HEPHAESTUS               ▼ RUTA LEGACY
┌─────────────────────────┐    ┌──────────────────────────────┐
│                         │    │                              │
│  3. Resolver params:    │    │  EffectsEngine               │
│     filePath = entry    │    │    .triggerEffect(name,      │
│       .filePath         │    │      params, duration)       │
│     intensity = Selene  │    │                              │
│       .intensity × hint │    │  (13 primitivas DMX          │
│     duration = clip     │    │   parametrizadas)            │
│       .durationMs       │    │                              │
│     targeting = entry   │    └──────────────┬───────────────┘
│       .execHints        │                   │
│       .fixtureTargeting │                   │
│     overlay = entry     │                   │
│       .execHints        │                   │
│       .overlayMode      │                   │
│     phase = entry       │                   │
│       .execHints        │                   │
│       .phaseConfig      │                   │
│                         │                   │
│  4. HephaestusRuntime   │                   │
│     .play(filePath, {   │                   │
│       intensity,        │                   │
│       durationOverride, │                   │
│       fixtureIds,       │                   │
│       loop: false       │                   │
│     })                  │                   │
│                         │                   │
└───────────┬─────────────┘                   │
            │                                 │
            ▼                                 ▼
┌─ HEPHAESTUS RUNTIME (cada frame) ─────────────────────────────┐
│                                                                │
│  tick(currentTimeMs):                                         │
│    for each fixture in fixturePhases[]:                       │
│      fixtureTimeMs = baseTime + phaseOffset                   │
│      for each curve in clip.curves:                           │
│        value = CurveEvaluator.getValue(curve, fixtureTimeMs)  │
│        output = scaleToDMX(param, value)                      │
│                                                                │
│  Retorna: HephFixtureOutput[]                                 │
│    { fixtureId, parameter, value, fine?, rgb?, source }       │
│                                                                │
└──────────────────────┬─────────────────────────────────────────┘
                       │
                       ▼
┌─ HEPH PARAMETER OVERLAY ─────────────────────────────────────┐
│                                                               │
│  Según overlayMode del .lfx:                                 │
│                                                               │
│  ABSOLUTE:  outputDMX = curveValue                           │
│    → El .lfx CONTROLA el canal DMX                           │
│    → El motor líquido base es SILENCIADO temporalmente       │
│    → Use: drops, strikes, momentos definidos                 │
│                                                               │
│  RELATIVE:  outputDMX = baseValue × curveValue               │
│    → El .lfx MODULA el estado actual                         │
│    → El motor líquido sigue activo, pero enveloped           │
│    → Use: intensity swells, breathing overlays               │
│                                                               │
│  ADDITIVE:  outputDMX = clamp(baseValue + curveValue)        │
│    → El .lfx SUMA al estado actual                           │
│    → El motor líquido sigue activo con perturbación          │
│    → Use: wobble de pan, color shift sutil                   │
│                                                               │
│  Temporal semantics:                                          │
│    clip.start() → overlay ACTIVO                             │
│    clip.end()   → overlay se DESVANECE (fade-out 100ms)      │
│                   → control retorna al motor líquido          │
│                                                               │
└──────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─ MASTERARBITER MERGE ────────────────────────────────────────┐
│                                                               │
│  Layer 0: TitanEngine base (motor líquido, physics, vibes)   │
│  Layer 1: Selene consciousness (color decisions)             │
│  Layer 2: Manual UI overrides                                │
│  Layer 3: EffectsEngine / HephaestusRuntime ← AQUÍ          │
│  Layer 4: Blackout (absolute priority)                       │
│                                                               │
│  Merge rules:                                                 │
│    HTP: dimmer, strobe → highest value wins                  │
│    LTP: pan, tilt, zoom, color → latest source wins          │
│    Additive: white, amber channel sums                       │
│                                                               │
│  HephaestusRuntime outputs entran en Layer 3                 │
│  con la misma prioridad que EffectsEngine clásico.           │
│                                                               │
└──────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
                    DMX OUT
```

### 5.3 El Secuestro Temporal: overlay → motor líquido

El concepto clave es el **secuestro temporal del canal DMX**:

1. **PRE-EFECTO**: El motor líquido (TitanEngine Layer 0) controla pan=0.50, tilt=0.30, intensity=0.65 según la física del vibe activo.

2. **EFECTO ACTIVO (overlay ABSOLUTE)**: El `.lfx` toma el control. Pan sigue la curva Bézier del clip. Tilt sigue otra curva. Intensity sigue otra. El motor líquido está **silenciado** para esos parámetros — sus outputs se descartan.

3. **EFECTO ACTIVO (overlay RELATIVE/ADDITIVE)**: El motor líquido sigue generando valores, pero el `.lfx` los modifica (multiplica o suma). Convivencia activa.

4. **POST-EFECTO**: El clip termina (`timeMs ≥ durationMs`). El overlay se desvanece en ~100ms lineales (anti-pop). El motor líquido retoma el control suavemente.

**El desvanecimiento de 100ms es crítico**: sin él, el corte abrupto de Hephaestus → motor líquido produce un salto visual ("pop"). Con el fade, el ojo no percibe la transición.

**Implementación del fade-out**: En los últimos 100ms del clip, `HephaestusRuntime` interpola linealmente entre el valor de la curva y el valor base del motor líquido. El `HephParameterOverlay` recibe un parámetro `fadeProgress` (1.0 → 0.0) que escala la contribución del overlay hacia cero.

### 5.4 Intensity Scaling

Selene pasa una `intensity` (0-1) que modula la ejecución del `.lfx`:

| `intensityScaling` | Comportamiento |
|---|---|
| `'proportional'` | Todas las curvas de dimmer/color se multiplican × `intensity`. Pan/tilt no se afectan. |
| `'fixed'` | La intensity de Selene se ignora. El `.lfx` se ejecuta tal cual fue diseñado. |
| `'energyDriven'` | La intensity proviene del `audioBinding` del clip (reactivo en tiempo real). Selene solo inicia/para. |

### 5.5 Fixture Targeting

Cuando Selene dispara un efecto, el `fixtureTargeting` del `.lfx` sugiere qué fixtures usar:

```
fixtureTargeting = 'movers'
  → El Bridge consulta el ShowConfig para obtener 
    fixtureIds de tipo 'moving_head'
  → Pasa la lista a HephaestusRuntime.play({ fixtureIds })
  → PhaseDistributor distribuye fase entre los movers

fixtureTargeting = 'all'
  → Todos los fixtures del universo activo
  
fixtureTargeting = 'zone-front'
  → Fixtures del grupo 'front' definido en ShowConfig
```

Si el `.lfx` tiene un `selector` más específico (parity, indexRange), ese selector toma precedencia sobre `fixtureTargeting`.

---

## 6. FLUJO DE DATOS COMPLETO

### 6.1 Diagrama End-to-End

```
                ┌─────────────────────────┐
                │  USUARIO / COMUNIDAD    │
                │                         │
                │  • Crea efecto en       │
                │    Hephaestus Editor    │
                │  • Asigna cognitiveDNA  │
                │    (A=0.70, C=0.45,     │
                │     O=0.25)             │
                │  • Asigna filtros       │
                │  • Guarda .lfx v2.0.0   │
                └────────────┬────────────┘
                             │
                             │ Archivo .lfx
                             │ guardado en 
                             │ /user-effects/
                             ▼
                ┌─────────────────────────┐
                │ DynamicEffectRegistry   │
                │                         │
                │ • Valida schema+checksum│
                │ • Extrae DNA, SimMeta   │
                │ • Indexa por vibe       │
                │ • Congela (immutable)   │
                │ • 0 allocations ongoing │
                └───────┬──────┬──────────┘
                        │      │
          ┌─────────────┘      └────────────────┐
          │                                     │
          ▼                                     ▼
┌─────────────────┐                  ┌──────────────────┐
│ EffectDNA       │                  │ EffectDream      │
│                 │                  │ Simulator        │
│ • getDNA() →    │                  │                  │
│   Registry      │                  │ • getVibeEffects │
│ • rankEffects() │                  │   → Registry     │
│   usa pre-filtro│                  │ • beauty weights │
│   + euclidiana  │                  │   → entry.simMeta│
│                 │                  │ • gpu/fatigue    │
│                 │                  │   → entry.simMeta│
└────────┬────────┘                  └────────┬─────────┘
         │                                    │
         └──────────┬─────────────────────────┘
                    │
                    ▼
         ┌───────────────────┐
         │   DecisionMaker   │
         │                   │
         │ • DIVINE arsenal  │
         │   → Registry pool │
         │ • Priority chain  │
         │ • DNA or Silence  │
         └────────┬──────────┘
                  │
                  │ ConsciousnessEffectDecision
                  │ { effectType: 'acid_sweep',
                  │   intensity: 0.85, ... }
                  ▼
         ┌───────────────────┐
         │SeleneHephBridge   │
         │                   │
         │ • Lookup Registry │
         │ • ¿.lfx exists?  │
         │   SÍ → Heph path │
         │   NO → Legacy    │
         └───┬─────────┬────┘
             │         │
    ┌────────┘         └─────────┐
    ▼                            ▼
┌───────────────┐    ┌───────────────────┐
│ HephaestusRT  │    │ EffectsEngine     │
│               │    │ (legacy fallback) │
│ • play(path)  │    │                   │
│ • tick() →    │    │ • triggerEffect() │
│   HephOutput[]│    │ • 13 primitivas   │
│ • phase distr │    │ • dimmerMult,     │
│ • Bézier eval │    │   colorOverride,  │
│ • overlay mode│    │   positionOffset  │
└───────┬───────┘    └────────┬──────────┘
        │                     │
        └─────────┬───────────┘
                  │
                  ▼
         ┌───────────────────┐
         │  MasterArbiter    │
         │  Layer 3 merge    │
         │  (HTP/LTP rules)  │
         └────────┬──────────┘
                  │
                  ▼
         ┌───────────────────┐
         │     HAL → DMX     │
         │   Bytes on wire   │
         └───────────────────┘
```

### 6.2 Timeline de un Frame Típico (con efecto dinámico activo)

```
t=0.00ms  │ AudioAnalyzer → TitanState actualizado
t=0.10ms  │ EnergyConsciousnessEngine.process() → zone 'active'
t=0.20ms  │ BeautySensor + ConsonanceSensor → aesthetic metrics
t=0.30ms  │ HuntEngine.evaluate() → worthiness 0.72
t=0.50ms  │ PredictionEngine → prediction (drop inminente)
t=0.70ms  │ FuzzyDecisionMaker.defuzzify() → strike 0.65, hold 0.30
t=1.00ms  │ EffectDNA.rankEffects() con pre-filtro → top 15 candidatos
t=2.50ms  │ DreamSimulator.dreamEffects() → bestScenario: 'acid_sweep_custom'
t=3.00ms  │ VisualConscienceEngine.evaluate() → APPROVED
t=3.50ms  │ DecisionMaker.makeDecision() → FIRE acid_sweep_custom
t=3.60ms  │ SeleneHephBridge → Registry lookup → .lfx v2 found
t=3.70ms  │ HephaestusRuntime.play('/user-effects/acid_sweep_custom.lfx')
          │   → Clip loaded from cache (LRU hit)
          │   → PhaseDistributor.resolve() → fixture phases
t=4.00ms  │ HephaestusRuntime.tick() → HephFixtureOutput[] (12 params × 6 movers)
t=4.50ms  │ HephParameterOverlay.apply() → merge con motor líquido
t=5.00ms  │ MasterArbiter.merge() → FinalLightingTarget[]
t=5.50ms  │ HAL.render() → DMX packet → USB/ArtNet
          │
t=16.67ms │ ═══ DEADLINE 60fps ═══ (headroom: ~11ms)
```

---

## 7. FRAME BUDGET Y CUELLOS DE BOTELLA

### 7.1 Presupuesto por Componente

| Componente | Latencia Actual | Latencia Post-Arsenal | Delta | Notas |
|---|---|---|---|---|
| Energy+Sense (always) | ~0.70ms | ~0.70ms | 0 | Sin cambios |
| EffectDNA.rankEffects | ~0.24ms (47 effects) | ~0.50ms (100 post-filter) | +0.26ms | Pre-filtro `aggressionRange` |
| DreamSimulator top-N | ~2.00ms (15 scenarios) | ~2.00ms (15 scenarios) | 0 | Mismo N de simulación |
| VisualConscienceEngine | ~1.00ms | ~1.00ms | 0 | Sin cambios |
| DecisionMaker | ~0.05ms | ~0.05ms | 0 | O(1) priority chain |
| **SeleneHephBridge** | N/A | **~0.10ms** | +0.10ms | **NUEVO**: Map.get() + param resolve |
| HephaestusRuntime.tick | ~2.00ms (if active) | ~2.00ms (if active) | 0 | Ya existe para Chronos |
| HephOverlay.apply | ~0.30ms (if active) | ~0.30ms (if active) | 0 | Ya existe |
| **TOTAL** | **~5.30ms** | **~5.66ms** | **+0.36ms** | Holgura: ~11ms |

**Veredicto**: El Infinite Arsenal añade **~0.36ms** al peor caso. Con headroom de ~11ms, no hay riesgo.

### 7.2 Cuello de Botella #1: Ingesta de Disco

**Riesgo**: Si `/user-effects/` contiene 500 archivos `.lfx`, el scan de startup podría tardar.

**Mitigación**:
- JSON.parse() de un `.lfx` típico (~5KB) toma <1ms.
- 500 archivos × 1ms = 500ms en startup. Aceptable (se muestra splash screen).
- Las curvas NO se cargan en el scan — solo metadatos (~200 bytes por entry). Las curvas se cargan lazy cuando se ejecutan.

### 7.3 Cuello de Botella #2: Escalabilidad de rankEffects

**Riesgo**: Con N efectos, `rankEffects()` es O(N). Para N=500, potencialmente 2.5ms.

**Mitigación por fases**:

| N efectos | Latencia (sin filtro) | Con pre-filtro aggression | Con zone + section |
|---|---|---|---|
| 47 (actual) | 0.24ms | 0.24ms (no aplica) | 0.24ms |
| 100 | 0.50ms | ~0.30ms (~40% filtrado) | ~0.20ms |
| 250 | 1.25ms | ~0.50ms (~60% filtrado) | ~0.35ms |
| 500 | 2.50ms | ~0.80ms (~70% filtrado) | ~0.55ms |
| 1000+ | 5.00ms ⚠️ | ~1.50ms | ~1.00ms |

**Para N>1000**: Implementar k-d tree 3D sobre las coordenadas (A, C, O). Nearest-neighbor query en O(log N). Pero esto es optimización futura — ni la comunidad más activa llegará a 1000 efectos en corto plazo.

### 7.4 Cuello de Botella #3: HephaestusRuntime Simultáneo

**Riesgo**: Si Selene dispara un `.lfx` mientras Chronos ya está ejecutando otro, ¿doble costo?

**Mitigación**: HephaestusRuntime ya soporta múltiples clips activos (array de `activeClips`). El costo `tick()` es proporcional a clips activos × fixtures. Con 2 clips simultáneos: ~4ms en vez de ~2ms. Todavía dentro del budget.

**Protección**: El `DreamSimulator` ya calcula `gpuLoadImpact` y penaliza efectos pesados cuando la carga es alta. Si Chronos tiene un clip activo, Selene automáticamente elige un efecto más ligero.

---

## 8. PLAN DE MIGRACIÓN PROGRESIVA

### 8.1 Fase 0: Infraestructura (sin breaking changes)

1. Crear `DynamicEffectRegistry` singleton con API pública.
2. Crear directorios `/builtin-effects/` y `/user-effects/`.
3. Implementar scan + validación + indexación.
4. Crear `SeleneHephBridge` con routing dual (Heph / Legacy).
5. Tests unitarios del Registry y Bridge.

**Estado al final**: El sistema funciona igual que antes. El Registry existe pero está vacío. El Bridge siempre cae a la ruta Legacy.

### 8.2 Fase 1: Migración de los 47 Efectos Builtin

1. Crear un `.lfx v2.0.0` por cada efecto del `DNA_REGISTRY` actual.
2. Cada `.lfx` contiene:
   - `cognitiveDNA.genome` copiado del `DNA_REGISTRY`
   - `simulationMeta` copiado del `DreamSimulator`
   - `curves` diseñadas en Hephaestus Editor para replicar el comportamiento DMX
3. Colocar los 47 archivos en `/builtin-effects/`.
4. Verificar que `DynamicEffectRegistry` los carga correctamente.
5. Activar la ruta Hephaestus en SeleneHephBridge para efectos con `.lfx`.

**Estado al final**: Los 47 efectos se ejecutan via HephaestusRuntime con curvas Bézier reales, en vez of las 13 primitivas genéricas del EffectsEngine. El DNA_REGISTRY hardcodeado sigue como fallback.

**Nota crítica**: Esta fase requiere el mayor esfuerzo de **diseño de curvas**. Cada concepto cognitivo (acid_sweep, industrial_strobe, etc.) necesita curvas Bézier que repliquen fielmente su comportamiento esperado. Este es trabajo de lightjockey, no de programador.

### 8.3 Fase 2: Limpieza del Monolito (COG-13 resuelto)

1. Eliminar `EFFECTS_BY_VIBE` hardcodeado del `DreamSimulator` → reemplazar con `Registry.getEffectsForVibe()`.
2. Eliminar beauty weights, GPU costs, fatigue impacts del `DreamSimulator` → reemplazar con `entry.simMeta`.
3. Eliminar `DNA_REGISTRY` de `EffectDNA` → reemplazar con `Registry.getDNA()`.
4. Eliminar `DIVINE_ARSENAL` y `HEAVY_ARSENAL` de `DecisionMaker` → reemplazar con `Registry.getDivineArsenal()` / `Registry.getHeavyArsenal()`.
5. Lock tests de regresión E2E para asegurar que las decisiones de Selene no cambian.

**Estado al final**: ~850 LOC de datos hardcodeados eliminados del código core. `EffectDreamSimulator` baja de ~2063 LOC a ~1200 LOC. `EffectDNA` baja de ~1081 LOC a ~900 LOC. `DecisionMaker` pierde ~80 LOC de constantes.

### 8.4 Fase 3: Editor de DNA en Hephaestus

1. Añadir panel de "CognitiveDNA" al editor de clips Hephaestus.
2. Visualización 3D del cubo (A, C, O) con preview del punto del efecto.
3. Selector de `compatibleVibes` con checkboxes.
4. Selector de `validSections` con checkboxes.
5. Sliders para beauty weights, GPU cost, fatigue.
6. El `.lfx` se guarda con el bloque `cognitiveDNA` completo.

**Estado al final**: Cualquier usuario puede crear un efecto completo — curvas DMX + genoma cognitivo — desde la UI, sin tocar código.

### 8.5 Fase 4: Comunidad

1. Habilitar hot-reload de `/user-effects/`.
2. Crear mecanismo de importación (drag-and-drop `.lfx` en la UI).
3. Crear mecanismo de exportación (share `.lfx`).
4. Validación safety: los efectos de comunidad pasan por `VisualConscienceEngine` con scrutiny elevada en modo "untrusted" (epilepsy thresholds +50%).

---

## 9. APÉNDICE: INTERFACES COMPLETAS

### 9.1 Extensión del .lfx (TypeScript)

```typescript
/** WAVE 2480: Bloque de DNA cognitivo para .lfx v2.0.0 */
interface CognitiveDNA {
  /** Coordenadas en el cubo unitario (A, C, O) */
  genome: {
    readonly aggression: number     // [0.0, 1.0]
    readonly chaos: number          // [0.0, 1.0]
    readonly organicity: number     // [0.0, 1.0]
  }
  
  /** Compatibilidad espectral */
  textureAffinity: 'clean' | 'dirty' | 'universal'
  
  /** Vibes donde este efecto puede operar */
  compatibleVibes: string[]         // ['techno-club', 'fiesta-latina', ...]
  
  /** Secciones musicales compatibles */
  validSections: string[]           // ['drop', 'buildup', 'chorus', ...]
  
  /** Rango de zona energética válida */
  energyZone: {
    min: EnergyZoneName             // 'silence' | 'valley' | ... | 'peak'
    max: EnergyZoneName
  }
  
  /** Pre-filtro rápido por aggression del target */
  aggressionRange: {
    min: number                     // [0.0, 1.0]
    max: number                     // [0.0, 1.0]
  }
}

/** Metadata para EffectDreamSimulator */
interface SimulationMeta {
  beautyWeights: {
    base: number                    // [0.0, 1.0]
    energyMultiplier: number        // [0.5, 2.0]
    vibeBonus: number               // [0.0, 0.5]
  }
  gpuCost: number                   // [0.0, 1.0]
  fatigueImpact: number             // [-0.10, 0.20]
  minDurationMs: number
  cooldownMs: number
  isStrobe: boolean
  isDivineCandidate: boolean
  isHeavyCandidate: boolean
  zScoreGuards: {
    requireRising: boolean
    minimumZ: number | null
    minimumEnergy: number | null
  }
}

/** Hints de ejecución para HephaestusRuntime */
interface ExecutionHints {
  overlayMode: 'absolute' | 'relative' | 'additive'
  phaseConfig: PhaseConfig
  intensityScaling: 'proportional' | 'fixed' | 'energyDriven'
  fixtureTargeting: string
}

type EnergyZoneName = 'silence' | 'valley' | 'ambient' | 'gentle' 
                    | 'active' | 'intense' | 'peak'
```

### 9.2 DynamicEffectRegistry

```typescript
interface RegistryEntry {
  readonly id: string
  readonly filePath: string
  readonly name: string
  readonly author: string
  readonly category: string
  readonly dna: FrozenDNA
  readonly textureAffinity: 'clean' | 'dirty' | 'universal'
  readonly compatibleVibes: readonly string[]
  readonly validSections: readonly string[]
  readonly energyZone: { readonly min: EnergyZoneName; readonly max: EnergyZoneName }
  readonly aggressionRange: { readonly min: number; readonly max: number }
  readonly simMeta: Readonly<SimulationMeta>
  readonly execHints: Readonly<ExecutionHints>
  readonly isBuiltin: boolean
  readonly loadedAt: number
}

interface FrozenDNA {
  readonly aggression: number
  readonly chaos: number
  readonly organicity: number
  readonly textureAffinity: 'clean' | 'dirty' | 'universal'
}

interface DynamicEffectRegistry {
  /** Inicialización — escanea directorios y construye índices */
  initialize(builtinDir: string, userDir: string): Promise<void>
  
  /** Retorna efectos pre-filtrados por vibe (O(1) — array pre-calculado) */
  getEffectsForVibe(vibe: string): readonly RegistryEntry[]
  
  /** Retorna DNA de un efecto (O(1) — Map lookup) */
  getDNA(effectId: string): FrozenDNA | undefined
  
  /** Retorna metadata de simulación (O(1)) */
  getSimMeta(effectId: string): Readonly<SimulationMeta> | undefined
  
  /** Retorna execution hints (O(1)) */
  getExecHints(effectId: string): Readonly<ExecutionHints> | undefined
  
  /** Retorna arsenal DIVINE pre-filtrado por vibe */
  getDivineArsenal(vibe: string): readonly RegistryEntry[]
  
  /** Retorna arsenal HEAVY pre-filtrado por vibe */
  getHeavyArsenal(vibe: string): readonly RegistryEntry[]
  
  /** Retorna path al .lfx (para carga lazy de curvas) */
  getEffectFilePath(effectId: string): string | undefined
  
  /** Retorna una entrada por ID */
  getEntry(effectId: string): RegistryEntry | undefined
  
  /** Retorna todas las entradas (para iteración exhaustiva) */
  getAllEntries(): readonly RegistryEntry[]
  
  /** Cantidad de efectos cargados */
  getEntryCount(): number
  
  /** Fuerza recarga desde disco (hot-reload manual) */
  reloadFromDisk(): Promise<void>
}
```

### 9.3 SeleneHephBridge

```typescript
interface SeleneHephBridge {
  /**
   * Ejecuta un efecto decidido por Selene.
   * 
   * Flujo:
   * 1. Busca en DynamicEffectRegistry por effectId
   * 2. Si tiene .lfx → HephaestusRuntime.play()
   * 3. Si no → EffectsEngine.triggerEffect() (legacy)
   * 
   * Retorna ID de instancia para tracking.
   */
  executeEffect(decision: ConsciousnessEffectDecision): number
  
  /**
   * Detiene un efecto activo (cleanup + fade-out).
   */
  stopEffect(instanceId: number): void
  
  /**
   * Consulta si hay un efecto Hephaestus activo
   * (para que DreamSimulator calcule gpuLoad correcto).
   */
  hasActiveHephEffect(): boolean
}
```

### 9.4 Schema JSON .lfx v2.0.0 (Validación)

```json
{
  "$schema": "hephaestus/v2",
  "version": "2.0.0",
  "clip": {
    "id": "string (required, unique)",
    "name": "string (required, 1-100 chars)",
    "author": "string (required)",
    "category": "enum: physical|color|movement|composite (required)",
    "tags": "string[] (optional, max 20)",
    "zones": "string[] (required, min 1)",
    "mixBus": "enum: global|htp|ambient|accent (default: htp)",
    "priority": "number 0-100 (default: 50)",
    "durationMs": "number >0 (required)",
    "effectType": "string (default: heph_custom)",
    "curves": "Record<HephParamId, HephCurve> (required, min 1 curve)",
    "staticParams": "Record<string, any> (optional)",
    "selector": "FixtureSelector (optional)",
    
    "cognitiveDNA": {
      "genome": {
        "aggression": "number [0.0, 1.0] (required)",
        "chaos": "number [0.0, 1.0] (required)",
        "organicity": "number [0.0, 1.0] (required)"
      },
      "textureAffinity": "enum: clean|dirty|universal (required)",
      "compatibleVibes": "string[] (required, min 1)",
      "validSections": "string[] (required, min 1)",
      "energyZone": {
        "min": "EnergyZoneName (required)",
        "max": "EnergyZoneName (required)"
      },
      "aggressionRange": {
        "min": "number [0.0, 1.0] (required)",
        "max": "number [0.0, 1.0] (required)"
      }
    },
    
    "simulationMeta": {
      "beautyWeights": {
        "base": "number [0.0, 1.0] (default: 0.50)",
        "energyMultiplier": "number [0.5, 2.0] (default: 1.00)",
        "vibeBonus": "number [0.0, 0.5] (default: 0.00)"
      },
      "gpuCost": "number [0.0, 1.0] (default: 0.30)",
      "fatigueImpact": "number [-0.10, 0.20] (default: 0.06)",
      "minDurationMs": "number ≥0 (default: 1000)",
      "cooldownMs": "number ≥0 (default: 7000)",
      "isStrobe": "boolean (default: false)",
      "isDivineCandidate": "boolean (default: false)",
      "isHeavyCandidate": "boolean (default: false)",
      "zScoreGuards": {
        "requireRising": "boolean (default: false)",
        "minimumZ": "number|null (default: null)",
        "minimumEnergy": "number|null (default: null)"
      }
    },
    
    "executionHints": {
      "overlayMode": "enum: absolute|relative|additive (default: absolute)",
      "phaseConfig": "PhaseConfig (default: {spread:0, symmetry:'linear', wings:1, direction:1})",
      "intensityScaling": "enum: proportional|fixed|energyDriven (default: proportional)",
      "fixtureTargeting": "string (default: 'all')"
    }
  },
  "checksum": "string SHA-256 (required)"
}
```

---

## FIN DEL BLUEPRINT

### Decisiones Arquitectónicas Clave

| # | Decisión | Razón |
|---|---|---|
| D1 | Metadata sin curvas en Registry | Zero-allocation: ~200 bytes/entrada vs ~5KB con curvas |
| D2 | Carga lazy de curvas via HephaestusRuntime cache LRU | Solo carga lo que dispara. Cache evita I/O repetido |
| D3 | Pre-filtro aggression antes de euclidiana | O(1) descard elimina 60-80% de candidatos |
| D4 | Indices vibeIndex / divinePool pre-calculados | `getEffectsForVibe()` es O(1), no O(N) |
| D5 | `Object.freeze()` en cada RegistryEntry | Inmutabilidad garantizada. Mutación → TypeError |
| D6 | Dual path (Heph / Legacy) en SeleneHephBridge | Migración progresiva sin breaking changes |
| D7 | Fade-out 100ms en overlay termination | Anti-pop visual al devolver control al motor líquido |
| D8 | Hot-reload atómico con shadow buffer | Frame loop nunca lee índice a medio-reconstruir |
| D9 | Efectos comunidad pasan mismos 7 valores éticos | No hay ciudadanos de segunda clase |
| D10 | `cognitiveDNA` es OPCIONAL en .lfx v2 legacy | Retrocompatibilidad: v1 clips siguen funcionando en Chronos |

### Métricas de Éxito

| Métrica | Antes | Después | Objetivo |
|---|---|---|---|
| LOC de datos hardcodeados en core | ~850 | 0 | ✅ COG-13 resuelto |
| Archivos a tocar para agregar 1 efecto | 4 (DNA + Dream + Decision + Effects) | 1 (.lfx) | ✅ 4× reducción |
| Frame budget delta | 5.30ms | 5.66ms | ✅ <1ms de overhead |
| Efectos soportados antes de k-d tree | 47 | ~500 con pre-filtro | ✅ 10× headroom |
| Tiempo para que comunidad cree efecto | Imposible | ~30min en editor | ✅ |

---

*Blueprint elaborado por PunkOpus. La arquitectura es un instrumento, no un obstáculo. Cada decisión aquí sirve a la música.*
