# BLUEPRINT: V3 SCALING & VISIBILITY

**Rol**: Arquitecto Principal — LuxSync DMX
**Alcance**: Refactor del Sistema de Tipos V3 + UI de autoría (DnaRail)
**Estado**: BLUEPRINT — NO EJECUTADO
**Contexto forense**: `docs/forensics/reporte_viabilidadv3scaling.md`

---

## 0. RESUMEN EJECUTIVO

Dos capacidades nuevas, deliberadamente **ortogonales**:

| Capacidad | Campo | Bloque | Autoridad |
|---|---|---|---|
| **Strobe Scaling** | `intensityScaling: 'proportional' \| 'fixed' \| 'energyDriven'` | `executionHints` (raíz del clip) | Ejecución — cómo el motor escala el clip |
| **AI Auto-Play** | `visibility: 'all' \| 'manual_only'` | `cognitiveDNA` | Cognición — si Selene puede auto-seleccionarlo |

**Principio rector**: separar **descubrimiento autónomo** (los pools que Selene consulta para competir) de **despacho directo** (lookup por ID, usado por MIDI/KeyForge/timeline/ForceStrike). El flag `visibility` filtra los primeros y **NO TOCA** los segundos. Así el efecto desaparece de la competición de la IA pero sigue vivo en el controlador MIDI.

---

## 1. HALLAZGO CRÍTICO QUE DEFINE EL DISEÑO

El reporte forense sugería filtrar en `DecisionMaker` o `EffectDreamSimulator`. **Eso es insuficiente.** El grep exhaustivo de los accesores de pool revela **8 puntos de consumo distintos**:

| # | Archivo | Línea | Accesor | Rol |
|---|---|---|---|---|
| 1 | `think/DecisionMaker.ts` | 529 | `getDivineArsenal(vibeId)` | DIVINE strike |
| 2 | `think/DecisionMaker.ts` | 718 | `getHeavyArsenal(vibeId)` | DROP preparation |
| 3 | `dream/EffectDreamSimulator.ts` | 594 | `getEffectsForVibe(vibe)` | `getVibeAllowedEffects` — pool de simulación |
| 4 | `dream/EffectDreamSimulator.ts` | 530 | `getEffectsForVibe(vibe)` | `exploreAlternatives` |
| 5 | `guards/SovereignClockGuard.ts` | 321, 359, 463 | `getEffectsForVibe` | Re-route heavy/divine + ETA upgrade |
| 6 | `SeleneTitanConscious.ts` | 953 | `getEffectsForVibe` | HUNT UPGRADE (WAVE 7599) |
| 7 | `think/HuntEngine.ts` | 70, 73, 76 | los tres | `getEligibleCandidates` |
| 8 | `conscience/VisualConscienceEngine.ts` | 276 | `getEffectsForVibe` | Fallback seguro |

Filtrar en el DecisionMaker dejaría **6 vías de fuga**. Un efecto `manual_only` seguiría apareciendo por SovereignClock re-route, HUNT UPGRADE, VisualConscience fallback y exploreAlternatives.

### Decisión arquitectural

**Filtrar en el REGISTRY, en los tres accesores de pool.** Es el único cuello de botella real y ya existe el precedente exacto: el **PURGATORY WALL** (`organismStatus === 'alive'`) ya filtra ahí mismo en `getDivineArsenal`/`getHeavyArsenal` (DynamicEffectRegistry.ts:262, 270).

```
                    ┌─────────────────────────────────────┐
                    │      DynamicEffectRegistry          │
                    │                                     │
  DESCUBRIMIENTO    │  getEffectsForVibe()  ← FILTRAR     │
  AUTÓNOMO          │  getDivineArsenal()   ← FILTRAR     │
  (8 consumidores)  │  getHeavyArsenal()    ← FILTRAR     │
                    │                                     │
  ─────────────────────────────────────────────────────────
                    │                                     │
  DESPACHO          │  getEntry(id)         ← NO TOCAR    │
  DIRECTO           │  getEffectCatalog()   ← NO TOCAR    │
                    │  getExecHints(id)     ← NO TOCAR    │
                    │  getSimMeta(id)       ← NO TOCAR    │
                    │  has(id)              ← NO TOCAR    │
                    └─────────────────────────────────────┘
                                    ↓
                    MIDI / KeyForge / Timeline / ForceStrike
                    siguen funcionando intactos
```

`getEffectCatalog()` (línea 337) es el que alimenta MIDI/KeyForge vía `lux:arsenal:getCatalog`. **Debe permanecer sin filtrar** — es el requisito explícito del Problema 2.

`getEntry()` es el que usa `SeleneHephBridge.route()` (línea 187). Sin filtrar, el disparo manual por nombre sigue resolviendo.

---

## 2. PASO 1 — AMPLIACIÓN DEL SISTEMA DE TIPOS

### 2.1 Nuevo tipo: `ClipExecutionOverrides`

**Archivo**: `electron-app/src/core/arsenal/lfxTypes.ts`

**Problema**: `ExecutionHints` tiene 4 campos **requeridos**, incluido `phaseConfig: PhaseConfig`. Si añadimos `executionHints?: ExecutionHints` a la raíz del clip, el autor estaría obligado a declarar `phaseConfig` — que en V3 es **legacy muerto**: cada `HephTrack` ya lleva su propio `phaseConfig?: PhaseConfigPro` (types.ts:478).

**Solución**: un tipo nuevo de overrides parciales, sin `phaseConfig`.

```typescript
/**
 * Overrides de ejecución declarables por el `.lfx` v3.
 *
 * Subconjunto PARCIAL de `ExecutionHints`. Todos los campos son opcionales:
 * los ausentes caen al `_DEFAULT_EXECUTION_HINTS` del registry.
 *
 * `phaseConfig` se excluye deliberadamente — en V3 la fase vive per-track
 * (`HephTrack.phaseConfig: PhaseConfigPro`), no a nivel de clip.
 */
export interface ClipExecutionOverrides {
  readonly overlayMode?: OverlayMode
  readonly intensityScaling?: IntensityScaling
  readonly fixtureTargeting?: FixtureTargeting
}
```

### 2.2 Nuevo tipo: `EffectVisibility`

**Archivo**: `electron-app/src/core/arsenal/lfxTypes.ts`

```typescript
/**
 * Visibilidad del efecto ante el motor autónomo de Selene.
 *
 *   - 'all'         (default) → el efecto compite en los pools autónomos.
 *   - 'manual_only' → Selene NUNCA lo auto-selecciona. Sigue disparable
 *                     por MIDI, KeyForge, timeline Chronos y ForceStrike.
 *
 * Retrocompat: ausente ⇒ 'all'.
 */
export type EffectVisibility = 'all' | 'manual_only'
```

### 2.3 Extensión de `CognitiveDNA`

**Archivo**: `electron-app/src/core/arsenal/lfxTypes.ts` (interface en línea 150)

Añadir **un** campo opcional:

```typescript
export interface CognitiveDNA {
  // ... 8 campos existentes sin cambios ...

  // ── V3 SCALING & VISIBILITY: directiva de auto-selección ──
  /**
   * Si 'manual_only', el registry excluye este efecto de los pools
   * autónomos (getEffectsForVibe / getDivineArsenal / getHeavyArsenal).
   * Los lookups directos (getEntry / getEffectCatalog) NO se filtran.
   * Ausente ⇒ 'all'.
   */
  readonly visibility?: EffectVisibility
}
```

**Por qué en `CognitiveDNA` y no en la raíz**: es una directiva puramente cognitiva ("cómo Selene razona sobre este clip"), coherente con el resto del bloque. Además — ventaja operativa decisiva — `serializeHephClip` ya hace `JSON.parse(JSON.stringify(clip.cognitiveDNA))` (types.ts:686), un deep-clone opaco: **el campo nuevo se serializa gratis, sin tocar el serializador.**

### 2.4 Extensión de `HephAutomationClipV3`

**Archivo**: `electron-app/src/core/hephaestus/types.ts` (interface en línea 504)

Añadir **un** campo opcional junto al bloque cognitivo:

```typescript
  // ── Cognitivo (opcional — solo clips Selene-visibles) ──
  cognitiveDNA?: import('../arsenal/lfxTypes').CognitiveDNA
  simulationMeta?: import('../arsenal/lfxTypes').SimulationMeta
  safetyDeclaration?: import('../arsenal/lfxTypes').SafetyDeclaration

  // ── Ejecución declarada por el autor (opcional) ──
  /**
   * Overrides de ejecución del clip. Los campos ausentes caen a
   * `_DEFAULT_EXECUTION_HINTS` en el registry. Ausente ⇒ todos default.
   */
  executionHints?: import('../arsenal/lfxTypes').ClipExecutionOverrides
```

### 2.5 Extensión de `RegistryEntry`

**Archivo**: `electron-app/src/core/arsenal/lfxTypes.ts` (interface en línea 221)

`execHints` ya existe (línea 248) y ya tiene `intensityScaling`. **No requiere cambio.**

Añadir el alias plano de visibilidad para lookup O(1) en el hot path del filtro:

```typescript
  /** Alias plano de `dna.visibility`. Default 'all' si el DNA no lo declara. */
  readonly visibility: EffectVisibility
```

### 2.6 Resumen de la superficie de tipos tocada

| Archivo | Añade | Modifica | Rompe |
|---|---|---|---|
| `arsenal/lfxTypes.ts` | `ClipExecutionOverrides`, `EffectVisibility` | `CognitiveDNA.visibility?`, `RegistryEntry.visibility` | Nada (aditivo) |
| `hephaestus/types.ts` | — | `HephAutomationClipV3.executionHints?` | Nada (aditivo) |

Ambos campos son **opcionales en el archivo** y **obligatorios-con-default en el registry**. Ese es el contrato de retrocompat: el disco es permisivo, la memoria es estricta.

---

## 3. PASO 2 — SERIALIZACIÓN

### 3.1 `serializeHephClip`

**Archivo**: `electron-app/src/core/hephaestus/types.ts` (función en línea 623)

**`visibility`**: cero cambios. El deep-clone de `cognitiveDNA` (línea 686) ya lo arrastra.

**`executionHints`**: requiere **una línea** en el object literal de retorno, siguiendo el patrón idéntico de los otros bloques opcionales:

```typescript
    cognitiveDNA: clip.cognitiveDNA ? JSON.parse(JSON.stringify(clip.cognitiveDNA)) : undefined,
    simulationMeta: clip.simulationMeta ? JSON.parse(JSON.stringify(clip.simulationMeta)) : undefined,
    safetyDeclaration: clip.safetyDeclaration ? JSON.parse(JSON.stringify(clip.safetyDeclaration)) : undefined,
    executionHints: clip.executionHints ? JSON.parse(JSON.stringify(clip.executionHints)) : undefined,  // ← NUEVO
    schemaVersion: '3.0',
```

### 3.2 Invariante de checksum (crítico)

`HephFileIO.saveClip()` calcula `sha256(JSON.stringify(serializeHephClip(clip)))` (HephFileIO.ts:178-180).

**`JSON.stringify` omite las claves con valor `undefined`.** Por tanto:

- Clip antiguo sin `executionHints` → `executionHints: undefined` → clave ausente del JSON → **checksum idéntico al actual**. Retrocompat de integridad garantizada.
- Clip nuevo con `executionHints` → clave presente → checksum nuevo, correcto.

**Requisito de determinismo**: la clave debe insertarse en una **posición fija** del object literal (propuesta: después de `safetyDeclaration`, antes de `schemaVersion`). El orden de claves de un object literal es estable en V8, y el checksum depende de él. No reordenar las claves existentes.

---

## 4. PASO 3 — CARGA (LfxFileLoader)

**Archivo**: `electron-app/src/core/arsenal/LfxFileLoader.ts`

### 4.1 Política

El loader ya practica **validar-si-presente, ignorar-si-ausente** para `cognitiveDNA` (línea 304-305: `if (rawDna) { ... }`). Se replica exactamente.

### 4.2 Validación de `visibility`

Dentro del bloque `if (rawDna)` existente (líneas 305-323), tras la validación de `textureAffinity`:

- Si `rawDna.visibility` está **ausente** → aceptar, el registry aplicará `'all'`.
- Si está presente y **no** pertenece a `{'all','manual_only'}` → política **fail-closed-a-default**: emitir `console.warn` y dejar que el registry normalice a `'all'`. **No rechazar el archivo.**

**Justificación del fail-open**: la doctrina declarada del loader es "POLÍTICA DE FALLO SILENCIOSO" (cabecera, líneas 13-16): un `.lfx` malformado se loggea y descarta sin crashear. Pero rechazar un clip entero por un enum de visibilidad corrupto es desproporcionado — el clip sigue siendo ejecutable. Se degrada el campo, no el archivo.

Añadir el set canónico junto a `VALID_TEXTURE_AFFINITIES` (línea 70):

```typescript
const VALID_VISIBILITIES = new Set<string>(['all', 'manual_only'])
```

### 4.3 Validación de `executionHints`

Bloque **nuevo e independiente** (no anidado en `if (rawDna)` — un clip sin DNA también puede declarar hints):

- Ausente → aceptar.
- Presente pero no-objeto → `warn` + tratar como ausente.
- `intensityScaling` presente y no ∈ `{'proportional','fixed','energyDriven'}` → `warn` + descartar **ese campo** (cae a default).
- `overlayMode` presente y no ∈ `{'absolute','relative','additive'}` → `warn` + descartar el campo.
- `fixtureTargeting` presente y no ∈ el set de 8 valores de `FixtureTargeting` → `warn` + descartar el campo.

Sets canónicos nuevos:

```typescript
const VALID_INTENSITY_SCALINGS = new Set<string>(['proportional', 'fixed', 'energyDriven'])
const VALID_OVERLAY_MODES      = new Set<string>(['absolute', 'relative', 'additive'])
const VALID_FIXTURE_TARGETINGS = new Set<string>([
  'all', 'movers', 'pars', 'strobes',
  'zone-front', 'zone-back', 'zone-left', 'zone-right',
])
```

### 4.4 Ensamblado del `LFXFileV3`

En el object literal de `_parseAndValidateV3` (líneas 388-406), añadir junto a los otros bloques opcionales:

```typescript
        executionHints: (clip.executionHints as any) || undefined,
```

### 4.5 Nota sobre el path real de carga

`loadFile()` (línea 113) **delega a `HephaestusClipIndex.upsert()`**, no a `_parseAndValidateV3`. El índice hace su propia lectura/validación y devuelve `loaded.clip`, que se pasa a `registerEffectV3`.

**Consecuencia**: `HephaestusClipIndex` debe preservar `executionHints` y `cognitiveDNA.visibility` al construir su `LoadedClip`. Si el índice reconstruye el clip campo por campo (en lugar de pasar el parseado íntegro), hay que añadir ambos. **Verificar antes de implementar** — es el punto de fuga más probable de todo el refactor, del mismo género que el bug de hidratación de zonas de Forge.

`_parseAndValidateV3` queda como validador secundario/legacy; se actualiza igual por consistencia y porque es el contrato documentado de los gates.

---

## 5. PASO 4 — REGISTRY (el corazón del refactor)

**Archivo**: `electron-app/src/core/arsenal/DynamicEffectRegistry.ts`

### 5.1 `_buildEntryFromV3` — merge de hints y visibilidad

**Estado actual** (líneas 472-476): hardcodea el default, ignorando el clip.

```typescript
    // V3 no declara executionHints → usar default
    execHints: Object.freeze({
      ..._DEFAULT_EXECUTION_HINTS,
      phaseConfig: Object.freeze({ ..._DEFAULT_EXECUTION_HINTS.phaseConfig }),
    }) as ExecutionHints,
```

**Nuevo** — merge de tres capas, precedencia ascendente:

```
_DEFAULT_EXECUTION_HINTS  →  clip.executionHints (campos definidos)  →  Object.freeze
```

Reglas del merge:
- Sólo se sobreescriben los campos **explícitamente definidos** en `clip.executionHints`. Un `undefined` no pisa el default.
- `phaseConfig` **nunca** proviene del clip (no está en `ClipExecutionOverrides`): siempre el default congelado.
- El resultado se congela igual que hoy.

Y añadir el alias plano de visibilidad:

```typescript
    visibility: dna.visibility ?? 'all',
```

### 5.2 Filtrado de los pools autónomos

**Precedente a replicar**: el PURGATORY WALL en `getDivineArsenal` (líneas 259-264) y `getHeavyArsenal` (267-272), que ya filtran `organismStatus === 'alive'` con la optimización zero-alloc `filtered.length === raw.length ? raw : filtered`.

**Decisión de implementación: filtrar en ESCRITURA, no en lectura.**

Los pools se consultan a 44 Hz por 8 consumidores. Filtrar en lectura añade un `.filter()` (una allocación) por consulta, violando la doctrina declarada del módulo: *"CERO allocaciones en lookups"* (cabecera, línea 8).

La alternativa correcta es **no indexar** los efectos `manual_only` en los tres pools, en `_appendToIndices` (línea 350):

```
_appendToIndices(entry):
    if (entry.visibility === 'manual_only') return   ← guard temprano
    ... indexado actual sin cambios ...
```

**Consecuencias, todas deseables:**

| Efecto | Resultado |
|---|---|
| `_byVibe` / `_divineByVibe` / `_heavyByVibe` | El efecto no aparece → **los 8 consumidores autónomos quedan ciegos de golpe** |
| `_byId` | El efecto **sí** se registra (la escritura en `_byId` ocurre en `registerEffectV3` línea 129, antes de `_appendToIndices` línea 130) |
| `getEntry(id)` | Resuelve → `SeleneHephBridge.route()` sigue funcionando → ForceStrike OK |
| `getEffectCatalog()` | Itera `_allEntries` (derivado de `_byId`, línea 391) → el efecto **aparece** → **MIDI/KeyForge OK** |
| Coste en hot path | **Cero**. Ni una allocación ni una comparación por frame. |

Esto resuelve el Problema 2 en su totalidad con **una sola guarda**, en lugar de 8 filtros dispersos.

### 5.3 Simetría obligatoria en `_removeFromIndices`

`_removeFromIndices` (línea 381) hace `_spliceFrom` sobre los tres pools. Con `manual_only` el efecto nunca entró, así que los splices son no-ops inofensivos. **No requiere cambio**, pero sí requiere verificación explícita en el hot-reload: si el usuario cambia `manual_only → all` y re-guarda, `registerEffectV3` hace `if (prev) this._removeFromIndices(prev)` (línea 127) y luego re-indexa con la visibilidad nueva. El flujo es correcto por construcción.

### 5.4 Consideración: ¿`getEffectsForVibe` debe filtrarse también?

Sí, y la guarda en `_appendToIndices` lo hace automáticamente — `_byVibe` es el mapa que alimenta `getEffectsForVibe`. Nótese que `getEffectsForVibe` **hoy no aplica el PURGATORY WALL** (inconsistencia preexistente vs. los otros dos pools). Este blueprint **no la corrige** — fuera de alcance, se documenta y punto.

---

## 6. PASO 5 — RESPETO AL STROBE (defensa en dos capas)

### 6.1 Capa 1 — `SeleneHephBridge`: ya funciona

**Archivo**: `electron-app/src/core/arsenal/SeleneHephBridge.ts` (líneas 318-322)

```typescript
  const intensity =
    entry.execHints.intensityScaling === 'fixed'
      ? 1.0
      : _clamp01(decision.intensity)
```

El bridge **ya implementa el blindaje**. Idéntico en `_resolvePixelParams` (líneas 351-354).

Cadena de atenuación completa, para trazar dónde muere:

```
pattern.energy (fluctúa con el audio)
  ↓
EffectDreamSimulator.calculateIntensity()     ← Math.max(0.80, energy), ×1.1 si strobe
  ↓
DecisionMaker.effectDecision.intensity        ← 0.80-1.0
  ↓
EffectManager.trigger()                       ← puede degradar más vía Shield maxIntensity
  ↓
SeleneHephBridge._resolvePlayParams()         ← ★ 'fixed' ⇒ 1.0 · LA ATENUACIÓN MUERE AQUÍ
  ↓
HephaestusRuntime.play({ intensity })         ← activeClip.intensity = 1.0
  ↓
_emitTrackSample: rawValue * intensity        ← 1.0 × 1.0 = 1.0
  ↓
scaleToDMX('strobe', 1.0) = 255               ← frecuencia íntegra
```

**El único cambio necesario para activar esta capa es el Paso 5.1** (que el registry lea `intensityScaling` del clip en vez de hardcodear `'proportional'`). Cero líneas en el bridge.

### 6.2 Capa 2 — `HephaestusRuntime`: la autoridad final

**Problema**: el bridge **sólo cubre el path de Selene**. Hay tres rutas que lo bypassan por completo y llegan a `runtime.play()` con una `intensity` arbitraria:

| Ruta | Handler | Pasa por bridge? |
|---|---|---|
| `chronos:triggerHeph` | `IPCHandlers.ts:400-426` | **NO** |
| `chronos:triggerFX` (heph-custom) | `IPCHandlers.ts:356-391` | **NO** |
| `TimelineEngine.triggerHephClip` | `TimelineEngine.ts:424-428` | **NO** (hardcodea 1.0) |

Si el operador dispara el strobe desde la timeline con `intensity: 0.7`, la curva se destroza igual. El `.lfx` declaró `'fixed'` y el motor lo ignoró.

**Solución**: clamp autoritativo en `play()` / `playFromClip()`.

**Archivo**: `electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts` (líneas 384-395 y el bloque gemelo de `playFromClip`)

Estado actual (línea 391):
```typescript
      intensity: options.intensity ?? 1.0,
```

Nuevo — el clip tiene la última palabra sobre quien lo dispara:

```
si clip.executionHints?.intensityScaling === 'fixed'
    → activeClip.intensity = 1.0        (ignora options.intensity)
si no
    → activeClip.intensity = options.intensity ?? 1.0
```

**Por qué esta capa es la correcta y no redundante:**

1. **Autoridad en el sitio correcto.** El `.lfx` es el autor de la curva; su declaración debe ser inviolable para *cualquier* disparador. Es el mismo principio que el `HARD_SAFETY_CHANNELS` de `NodeResolver`.
2. **Coste cero.** Una comparación de string en `play()`, que ocurre una vez por disparo — no en el hot path de 44 Hz.
3. **Idempotente con la Capa 1.** Si Selene ya envió `1.0`, el clamp es un no-op.
4. **Cubre MIDI y KeyForge**, que resuelven a `forceStrike`/`triggerHeph` según el binding.

`playFromClip()` recibe el clip inline (Diamond path) y también lo tiene disponible: mismo tratamiento, mismo bloque.

### 6.3 Lo que este blueprint NO hace

- **No** implementa `'energyDriven'`. El enum ya lo contiene, pero ningún consumidor lo distingue de `'proportional'` hoy. Queda como no-op documentado — un `'energyDriven'` se comporta como `'proportional'`. Implementarlo es un refactor aparte.
- **No** introduce blindaje per-canal (p.ej. "escalar el dimmer pero no el strobe"). El multiplicador `intensity` de `HephaestusRuntime` es global al clip por diseño (línea 705: `rawValue * intensity`). El requisito declarado — *"respetar la curva para el Strobe y el dimmer"* — se satisface exactamente con el clamp global. Un shield per-canal exigiría reescribir `_emitTrackSample` y se rechaza por desproporcionado.
- **No** toca `EffectDreamSimulator.calculateIntensity()`. Sigue produciendo `0.80-1.0`; simplemente deja de importar para los clips `'fixed'`. Modificarlo alteraría el comportamiento de **todos** los efectos, incluidos los que quieren atenuación acústica.

---

## 7. PASO 6 — UI (DnaRail.tsx)

**Archivo**: `electron-app/src/components/views/HephaestusView/dna/DnaRail.tsx`

### 7.1 Estado del formulario

`DnaFormState` (línea 168) recibe **dos** campos:

```typescript
interface DnaFormState {
  archetype: UserArchetype
  aco: AcoTriad
  zones: EnergyZoneId[]
  vibes: CompatibleVibe[]
  maxStrobeFreqHz: number
  pressureRange: { min: number; max: number }
  textureAffinity: TextureAffinity
  visibility: EffectVisibility          // ← NUEVO  (AI Auto-Play)
  intensityScaling: IntensityScaling    // ← NUEVO  (Strobe Scaling)
}
```

### 7.2 Los TRES inicializadores que hay que tocar (trampa conocida)

El componente construye `DnaFormState` en **tres** sitios distintos, todos con literales completos. Omitir uno produce un campo `undefined` que rompe el control en silencio:

| # | Ubicación | Caso |
|---|---|---|
| 1 | `useState` initializer, rama `if (!dna)` — líneas 265-273 | Clip nuevo sin DNA |
| 2 | `useState` initializer, rama con DNA — líneas 283-299 | Carga inicial con DNA |
| 3 | `useEffect` de sync, ambas ramas — líneas 309-317 y 327-342 | Cambio de clip cargado |

Hidratación en cada uno:
- `visibility: dna.visibility ?? 'all'`
- `intensityScaling: <execHints prop> ?? 'proportional'`

En la rama sin DNA: los defaults literales `'all'` / `'proportional'`.

### 7.3 Props nuevas

`DnaRailProps` (línea 208) — `visibility` viaja dentro de `CognitiveDNA` (ya cubierto por `dna`/`onDnaChange`), pero `intensityScaling` necesita su propio canal, replicando el patrón ya establecido de `simMeta`/`onSimMetaChange`:

```typescript
interface DnaRailProps {
  dna: CognitiveDNA | undefined
  simMeta: SimulationMeta | undefined
  execHints: ClipExecutionOverrides | undefined      // ← NUEVO
  onDnaChange: (dna: CognitiveDNA) => void
  onSimMetaChange: (meta: SimulationMeta) => void
  onExecHintsChange: (hints: ClipExecutionOverrides) => void   // ← NUEVO
  onEnableDna: () => void
}
```

### 7.4 EL PUNTO CRÍTICO — el `useEffect` de propagación de DNA

**Líneas 375-401.** Este efecto llama `instance.toCognitiveDNA(overrides)` y luego construye un **object literal explícito, campo por campo** (líneas 388-399):

```typescript
    onDnaChange({
      archetype: reality.archetype,
      genome: { ...reality.genome },
      textureAffinity: reality.textureAffinity,
      compatibleVibes: [...reality.compatibleVibes],
      validSections: [...reality.validSections],
      energyZone: { ...reality.energyZone },
      aggressionRange: { ...reality.aggressionRange },
      pressureRange: { ...reality.pressureRange },
      spatialBehavior: reality.spatialBehavior,
      ikCompatibility: reality.ikCompatibility,
      // ← visibility AUSENTE ⇒ SE PIERDE AL GUARDAR
    })
```

**Cualquier campo no listado aquí se descarta silenciosamente al guardar.** Esta es exactamente la clase de bug de:
- WAVE 7177 (`archetype` no se guardaba — corregido añadiéndolo al literal)
- La regresión de hidratación de zonas de Forge (`<select>` sin la opción `flash`)

**Acción obligatoria**: añadir `visibility: form.visibility` a ese literal.

**Segunda acción obligatoria**: `LfxClipInstance.toCognitiveDNA()` (LfxClipInstance.ts:515) construye el `CognitiveDNA` y acepta `overrides?: Partial<CognitiveDNA>`. Como `visibility` no es derivable del arquetipo, debe:
- pasarse vía `overrides` desde el `useEffect`, **o**
- emitirse por la instancia con default `'all'`.

**Recomendación**: pasarlo por `overrides` — es un dato puro del usuario, no una derivación del bias ACO. Evita ampliar el contrato de la clase átomo.

### 7.5 Controles

**Toggle "AI AUTO-PLAY"** — nueva subsección dentro del bloque `SIM GUARDS` existente (que ya alberga los toggles `isStrobe`/`isDivineCandidate`/`isHeavyCandidate`, líneas 508-510) o sección propia junto al header.

- ON ⇒ `visibility = 'all'`
- OFF ⇒ `visibility = 'manual_only'`
- Handler nuevo con el patrón `useCallback` establecido (cf. `handleMetaToggle`, línea 508).
- Copy sugerido para el estado OFF: *"Manual only — Selene will not auto-fire this. MIDI, KeyForge and timeline still work."* Es el punto en que se comunica al usuario la garantía del Problema 2.

**Selector "STROBE SCALING"** — sección **nueva** `EXECUTION`, después de `SIM GUARDS`.

- `Dynamic` ⇒ `'proportional'`
- `Fixed` ⇒ `'fixed'`
- `'energyDriven'` **no se expone en la UI** (no-op sin implementar; exponerlo prometería un comportamiento inexistente).
- Handler nuevo que llama `onExecHintsChange({ ...execHints, intensityScaling: v })`.
- Copy para `Fixed`: *"Curve is authoritative — audio energy will not scale this clip."*

### 7.6 Efecto de propagación de `execHints`

Replicar literalmente la maquinaria anti-ciclo de `meta` (líneas 229-261), que ya resuelve el problema de la doble actualización:
- `lastPropagatedRef` con comparación por contenido serializado.
- `isSyncingFromMeta`-equivalente para distinguir sync-desde-props de edición-del-usuario.
- Efecto de sync por identidad de prop + guarda de contenido.

**No inventar un mecanismo nuevo**: el existente ya está depurado contra el ciclo de re-render.

### 7.7 Componente padre (HephaestusView)

Debe:
1. Mantener `executionHints` en su estado del clip.
2. Pasarlo como prop `execHints` y recibir `onExecHintsChange`.
3. Escribirlo en `clip.executionHints` antes de `hephFileIO.saveClip(clip)`.

`visibility` no necesita nada nuevo en el padre: viaja dentro del `CognitiveDNA` que ya gestiona.

---

## 8. MATRIZ DE RETROCOMPATIBILIDAD

| Escenario | `visibility` | `intensityScaling` | Comportamiento |
|---|---|---|---|
| `.lfx` v3 antiguo, sin ninguno de los dos bloques | `'all'` (default registry) | `'proportional'` (default registry) | **Idéntico al actual.** Bit por bit. |
| `.lfx` con DNA pero sin `visibility` | `'all'` | según `executionHints` | Compite en pools, como hoy |
| `.lfx` con `executionHints` pero sin `intensityScaling` | según DNA | `'proportional'` | Merge parcial sobre el default |
| `.lfx` sin `cognitiveDNA` (Heph-puro) | N/A — rechazado por el registry (línea 104) | leído por `HephaestusRuntime` (Capa 2) | Invisible para Selene **y** para MIDI. **Sigue siendo el modo equivocado** de hacer manual-only. |
| `.lfx` con `visibility: 'manual_only'` | `'manual_only'` | según hints | **Invisible para Selene, visible en MIDI/KeyForge.** ✅ Objetivo del Problema 2 |
| `visibility` con valor corrupto | `'all'` + `warn` | — | Fail-safe: se degrada el campo, no el archivo |
| `intensityScaling` con valor corrupto | — | `'proportional'` + `warn` | Fail-safe: idem |
| Checksum de clip antiguo | — | — | **Inalterado** (claves `undefined` omitidas por `JSON.stringify`) |

**El contraste de las filas 4 y 5 es la tesis del Problema 2**: quitar el DNA logra "invisible para la IA" pero mata el MIDI; `visibility: 'manual_only'` logra ambos objetivos porque el DNA permanece y el registry sigue aceptando la entry.

---

## 9. ORDEN DE EJECUCIÓN

Secuencia con typecheck limpio en cada paso:

| Paso | Acción | Archivos | Verificación |
|---|---|---|---|
| **1** | Tipos: `ClipExecutionOverrides`, `EffectVisibility`, `CognitiveDNA.visibility?`, `RegistryEntry.visibility`, `HephAutomationClipV3.executionHints?` | `arsenal/lfxTypes.ts`, `hephaestus/types.ts` | `tsc --noEmit` → errores esperados en `_buildEntryFromV3` (falta `visibility`) |
| **2** | Registry: merge de hints + `visibility` en `_buildEntryFromV3`; guarda en `_appendToIndices` | `arsenal/DynamicEffectRegistry.ts` | `tsc` limpio. Test: entry `manual_only` ∉ pools, ∈ `getEntry`, ∈ `getEffectCatalog` |
| **3** | Serialización: 1 línea en `serializeHephClip` | `hephaestus/types.ts` | Round-trip save→load preserva ambos campos |
| **4** | **Auditar `HephaestusClipIndex`** — ¿preserva los campos nuevos? (§4.5) | `hephaestus/HephaestusClipIndex.ts` | Un `.lfx` con ambos campos sobrevive `upsert()` |
| **5** | Loader: sets de validación + ensamblado | `arsenal/LfxFileLoader.ts` | Clip con enum corrupto carga degradado, no rechazado |
| **6** | Runtime: clamp autoritativo de `'fixed'` en `play()` y `playFromClip()` | `hephaestus/runtime/HephaestusRuntime.ts` | `triggerHeph` con `intensity: 0.5` sobre clip `'fixed'` ⇒ DMX strobe 255 |
| **7** | UI: estado, 3 inicializadores, props, literal de `onDnaChange`, 2 controles, efecto de propagación | `DnaRail.tsx` + padre | Save→reload conserva ambos controles |
| **8** | Verificación E2E | — | Los 6 escenarios de §10 |

**El Paso 4 es el de mayor riesgo** y el más fácil de saltarse: es un punto de fuga silencioso, no un error de compilación.

---

## 10. CRITERIOS DE ACEPTACIÓN

1. Un `.lfx` con `visibility: 'manual_only'` **nunca** aparece en los 8 consumidores autónomos (§1) — verificable inspeccionando los tres mapas de índice del registry.
2. El mismo `.lfx` **sí** aparece en `getEffectCatalog()` y por tanto en MIDI Learn y KeyForge.
3. El mismo `.lfx` es disparable por `lux:forceStrike` (resuelve vía `getEntry`).
4. Un `.lfx` con `intensityScaling: 'fixed'` disparado por Selene con `pattern.energy = 0.80` produce **DMX strobe 255**, no 224.
5. El mismo `.lfx` disparado por `chronos:triggerHeph` con `intensity: 0.5` produce **DMX strobe 255** (Capa 2).
6. Todos los `.lfx` existentes conservan su checksum y su comportamiento sin re-guardarlos.

---

## 11. RIESGOS

| Riesgo | Severidad | Mitigación |
|---|---|---|
| `HephaestusClipIndex` descarta los campos nuevos | **Alta** | Paso 4 dedicado y bloqueante. Es fuga silenciosa, no error de compilación. |
| El literal de `onDnaChange` omite `visibility` | **Alta** | §7.4. Precedente exacto: WAVE 7177 y la regresión de zonas de Forge. |
| Alguno de los 3 inicializadores de `DnaFormState` se queda sin el campo | Media | §7.2. Enumerados con líneas exactas. |
| Un efecto queda inalcanzable (autor marca `manual_only` sin binding MIDI) | Media | Regla de linter opcional en `GatekeeperLinter`: severidad `info` si `manual_only`. |
| `'energyDriven'` seleccionable pero no implementado | Baja | Excluido de la UI (§7.5). |
| Deriva de checksum en clips existentes | Baja | Verificado: `undefined` ⇒ clave omitida (§3.2). |
| `getEffectsForVibe` sin PURGATORY WALL (preexistente) | Baja | Documentado, fuera de alcance. |

---

## 12. DECISIONES DE DISEÑO — REGISTRO

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Filtrar en `_appendToIndices` (escritura) | Filtrar en los 3 getters (lectura) | Zero-alloc en hot path; doctrina declarada del módulo (línea 8) |
| Filtrar en el registry | Filtrar en `DecisionMaker`/`EffectDreamSimulator` | 8 consumidores ⇒ 6 vías de fuga. El registry es el único cuello de botella |
| `visibility` en `CognitiveDNA` | `visibility` en la raíz del clip | Es directiva cognitiva; y el deep-clone existente la serializa sin tocar el serializador |
| `ClipExecutionOverrides` (parcial, nuevo) | `ExecutionHints` completo en el clip | `phaseConfig` es requerido y legacy-muerto en V3 (la fase vive per-track) |
| `executionHints` en la raíz del clip | Dentro de `CognitiveDNA` | Es ejecución, no cognición. Debe funcionar en clips sin DNA |
| Clamp de `'fixed'` en el Runtime | Sólo en el Bridge | 3 rutas bypassan el bridge (§6.2). El `.lfx` debe ser autoridad frente a cualquier disparador |
| Loader fail-open en enums corruptos | Rechazar el archivo | Desproporcionado: el clip sigue ejecutable. Coherente con la doctrina de fallo silencioso |
| `'energyDriven'` no expuesto en UI | Exponerlo | No implementado; prometería comportamiento inexistente |

---

**FIN DEL BLUEPRINT — pendiente de aprobación para ejecución.**
