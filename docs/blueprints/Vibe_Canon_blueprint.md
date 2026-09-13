# BLUEPRINT: SANEAMIENTO Y EXPANSIÓN DEL ECOSISTEMA "VIBE"

**Documento de ejecución metódica.**
**Base forense:** `docs/forensics/auditoria_trazabilidad_vibe.md`
**Objetivo final:** Canonizar el ecosistema Vibe e inyectar la vibra `rave` (EDM / Dubstep / Neurofunk) sin regresiones.
**Modo de uso:** Ejecutar las fases en orden estricto. Cada fase tiene una **puerta de verificación** que debe pasar antes de avanzar. Cada fase es committeable y reversible por separado.

---

## 0. PRINCIPIOS DE DISEÑO

Estos cinco principios gobiernan todas las decisiones del blueprint. Si una decisión de implementación los contradice, la decisión es incorrecta.

| # | Principio | Implicación práctica |
|---|---|---|
| P1 | **Una sola fuente de verdad** | `VibeId` se declara UNA vez. Todo lo demás importa o deriva. Cero uniones duplicadas. |
| P2 | **Datos, no condicionales** | Un `if (id === 'x')` que selecciona un número se convierte en un lookup a una tabla de datos. El motor cromático ya funciona así — es el modelo. |
| P3 | **Fallar visible, no silencioso** | Un vibe desconocido debe producir un warning único e ir a un estado neutro identificable, nunca disfrazarse de otro género. |
| P4 | **Refactor primero, feature después** | `rave` NO se inyecta hasta que las Fases 1-3 estén verdes. Inyectar sobre la deuda técnica multiplica los puntos de fallo de 20 a 25+. |
| P5 | **Paridad de comportamiento** | El refactor de Fases 1-3 debe producir **DMX byte-idéntico** para las 5 vibes existentes. Cualquier cambio visual es un bug del refactor, no una mejora. |

### Advertencia sobre P5

Las Fases 1-3 son **refactor puro**. La tentación de "mejorar de paso" un `decayBase` o un `frontCeiling` mientras se mueve el código debe resistirse. Si el refactor cambia el output, no se puede distinguir un bug de refactor de una mejora intencional. Guardar todas las mejoras para después de la Fase 3.

---

## 1. ARQUITECTURA OBJETIVO

### 1.1 Diagrama de dependencias (destino)

```
                    ┌─────────────────────────────┐
                    │   core/vibe/VibeCanon.ts    │  ← SSOT, CERO imports
                    │  · VibeId (única unión)      │
                    │  · VibeFamily                │
                    │  · VIBE_TRAITS               │
                    │  · resolveVibeId()           │
                    │  · VIBE_FALLBACK_ID          │
                    └──────────────┬──────────────┘
                                   │ (import unidireccional)
        ┌──────────────┬───────────┼───────────┬──────────────┐
        ▼              ▼           ▼           ▼              ▼
  types/          core/        engine/      hal/         chronos/
  VibeProfile   protocol/      vibe/       physics/      core/
  CustomVibe    SeleneProtocol profiles/   profiles/    TimelineClip
                               color/      LiquidEngine*
                               movement/   SeleneLux
```

**Restricción crítica de implementación:** `VibeCanon.ts` debe tener **cero imports**. Es un módulo hoja. Esto es obligatorio porque tanto `types/VibeProfile.ts` como `core/protocol/SeleneProtocol.ts` deben importarlo, y actualmente están en árboles distintos. Cualquier import dentro de `VibeCanon.ts` arriesga un ciclo.

**Ubicación:** `electron-app/src/core/vibe/VibeCanon.ts`

Razón de la ubicación: `core/` es neutro respecto a `types/`, `engine/`, `hal/` y `chronos/`. Colocarlo en `types/` lo ataría conceptualmente a la capa de tipos, pero contiene lógica runtime (`resolveVibeId`, tablas de traits). `core/vibe/` es el compromiso correcto.

### 1.2 Los tres artefactos del SSOT

| Artefacto | Naturaleza | Reemplaza a |
|---|---|---|
| `VibeId` | Unión de tipos | 5 uniones duplicadas |
| `VIBE_TRAITS` | Tabla de datos `Record<VibeId, VibeTraits>` | ~20 condicionales `includes()` / `===` |
| `resolveVibeId()` | Función de resolución con política de fallback única | 7 fallbacks inconsistentes |

---

## 2. FASE 1 — TIPOS Y CONTRATOS

**Meta:** Una sola unión `VibeId`. Cero cambios de comportamiento runtime.
**Riesgo:** BAJO (es puramente de tipos; el compilador detecta todo).
**Reversible:** Sí, trivialmente.

### 2.1 Crear el archivo maestro

**Archivo nuevo:** `electron-app/src/core/vibe/VibeCanon.ts`

Contenido a implementar (esqueleto de contrato, no código final):

```ts
// ─────────────────────────────────────────────────────────────
// SSOT — CERO IMPORTS. Este archivo no debe importar nada.
// ─────────────────────────────────────────────────────────────

/** Vibes canónicas. Única declaración en todo el codebase. */
export type VibeId =
  | 'idle'
  | 'techno-club'
  | 'fiesta-latina'
  | 'pop-rock'
  | 'chill-lounge'
  // FASE 4 añadirá: | 'rave'

/** Key de vibe custom generada por VibeLab. */
export type CustomVibeKey = `custom:${string}`

/** Cualquier identificador de vibe aceptable en runtime. */
export type AnyVibeKey = VibeId | CustomVibeKey

/** Array runtime derivado de la unión — mantener sincronizado. */
export const VIBE_IDS = [
  'idle', 'techno-club', 'fiesta-latina', 'pop-rock', 'chill-lounge',
] as const satisfies readonly VibeId[]

/** Vibes que pueden ser donantes de ADN en VibeLab (excluye idle). */
export const BASE_DNA_IDS = [
  'techno-club', 'fiesta-latina', 'pop-rock', 'chill-lounge',
] as const

export type BaseDNA = typeof BASE_DNA_IDS[number]

/** Política de fallback ÚNICA para todo el sistema. */
export const VIBE_FALLBACK_ID: VibeId = 'idle'

/** Type guard canónico. */
export function isVibeId(value: string): value is VibeId {
  return (VIBE_IDS as readonly string[]).includes(value)
}

export function isCustomVibeKey(value: string): value is CustomVibeKey {
  return value.startsWith('custom:')
}
```

**Nota sobre `satisfies`:** el operador `satisfies readonly VibeId[]` hace que TypeScript verifique que el array coincide con la unión. Si se añade `'rave'` a la unión pero no al array (o viceversa), el compilador falla. Esto es el mecanismo que previene el drift que causó el problema original.

### 2.2 Migrar los consumidores de tipo

Orden de ejecución (de menos a más acoplado):

| # | Archivo | Acción | Nota |
|---|---|---|---|
| 1 | `types/VibeProfile.ts:18` | Borrar la unión local. `export type { VibeId } from '../core/vibe/VibeCanon'` | Re-export para no romper los ~30 imports existentes |
| 2 | `core/protocol/SeleneProtocol.ts:47-57` | Borrar unión local. Importar y componer: `type ProtocolVibeId = VibeId \| 'custom'` | Preserva el `'custom'` que esta unión tenía de más |
| 3 | `types/CustomVibe.ts:67-92` | Borrar `BaseDNA` y `BASE_DNA_IDS` locales. Re-export desde Canon | El `Extract<VibeId, ...>` desaparece |
| 4 | `core/orchestrator/TitanOrchestrator.ts:34` | Borrar `type VibeId = ...` local. Importar de Canon | Duplicación pura, eliminación limpia |
| 5 | `core/orchestrator/lifecycle/VibeLifecycleManager.ts:17` | Borrar unión local. Importar de Canon | Duplicación pura |
| 6 | `chronos/core/TimelineClip.ts:28-79` | `VibeType` → alias de `VibeId`. `VALID_VIBE_TYPES` → derivar de `VIBE_IDS`. `toVibeType()` → usar `isVibeId()` + `VIBE_FALLBACK_ID` | Mantener el nombre `VibeType` exportado por compatibilidad |
| 7 | `core/orchestrator/tick/TickEngine.ts:1920` | Reemplazar el cast inline por el tipo importado | Elimina la "mentira de tipo" |

### 2.3 Decisión de diseño: `VibeType` vs `VibeId`

`chronos/core/TimelineClip.ts` exporta `VibeType`, consumido por 4 archivos de Chronos. **No renombrar.** Convertirlo en un alias:

```ts
// chronos/core/TimelineClip.ts
import type { VibeId } from '../../core/vibe/VibeCanon'
/** @deprecated Usar VibeId de core/vibe/VibeCanon. Alias por compatibilidad. */
export type VibeType = VibeId
```

Esto evita tocar `ProjectTypes.ts`, `useTimelineClips.ts`, `ClipInspector.tsx`, `LuxFileV3.factories.ts` en esta fase. La deprecación se limpia en un pase posterior opcional.

### 2.4 PUERTA DE VERIFICACIÓN — Fase 1

```powershell
cd electron-app
npx tsc --noEmit          # DEBE ser exit code 0
npm test                  # DEBE pasar sin cambios en snapshots
```

Verificación manual adicional:

```powershell
# No debe quedar NINGUNA declaración de VibeId fuera del Canon
# (buscar 'type VibeId =' y 'type VibeType =' en src/)
```

Criterio de aceptación: exactamente **1** declaración de `VibeId` en todo `src/`, ubicada en `core/vibe/VibeCanon.ts`.

**Commit sugerido:** `VIBE CANON FASE 1: SSOT de VibeId — elimina 5 uniones duplicadas`

---

## 3. FASE 2 — REGISTROS Y FALLBACKS

**Meta:** Una función de resolución única con política de fallback uniforme.
**Riesgo:** MEDIO — cambia el comportamiento de fallback del `KineticAdapter`.
**Reversible:** Sí, pero requiere atención al §3.4.

### 3.1 Añadir la resolución canónica al Canon

Ampliar `core/vibe/VibeCanon.ts`:

```ts
/** Aliases legacy → VibeId canónico. Fuente única. */
export const VIBE_ALIASES: Readonly<Record<string, VibeId>> = {
  // Techno family
  'techno': 'techno-club', 'electro': 'techno-club', 'electronic': 'techno-club',
  'acid': 'techno-club', 'minimal': 'techno-club', 'industrial': 'techno-club',
  'techno-dark': 'techno-club', 'cyberpunk': 'techno-club', 'dark': 'techno-club',
  // Latino family
  'latin': 'fiesta-latina', 'latino': 'fiesta-latina', 'fiesta': 'fiesta-latina',
  'salsa': 'fiesta-latina', 'cumbia': 'fiesta-latina', 'bachata': 'fiesta-latina',
  'reggaeton': 'fiesta-latina', 'dembow': 'fiesta-latina', 'tropical': 'fiesta-latina',
  'latino-organic': 'fiesta-latina',
  // Rock family
  'rock': 'pop-rock', 'pop': 'pop-rock', 'metal': 'pop-rock',
  'blues': 'pop-rock', 'indie': 'pop-rock', 'hiphop': 'pop-rock',
  // Chill family
  'chill': 'chill-lounge', 'chillout': 'chill-lounge', 'lounge': 'chill-lounge',
  'ambient': 'chill-lounge', 'jazz': 'chill-lounge', 'ballad': 'chill-lounge',
  'romantic': 'chill-lounge', 'lofi': 'chill-lounge', 'downtempo': 'chill-lounge',
  // FASE 4 añadirá: 'dubstep', 'neurofunk', 'edm', 'hardstyle', 'trance' → 'rave'
  // NOTA: 'dubstep' y 'neurofunk' migran de techno-club a rave en Fase 4.
}

export interface VibeResolution {
  readonly id: VibeId | CustomVibeKey
  readonly source: 'canonical' | 'alias' | 'custom' | 'fallback'
  readonly requested: string
}

const _warnedUnknown = new Set<string>()

/**
 * Resolución ÚNICA de cualquier string a un vibe válido.
 * Política de fallback: VIBE_FALLBACK_ID ('idle'), con warning único por key.
 */
export function resolveVibeId(raw: string | undefined | null): VibeResolution {
  const requested = raw ?? ''
  if (isVibeId(requested)) return { id: requested, source: 'canonical', requested }
  if (isCustomVibeKey(requested)) return { id: requested, source: 'custom', requested }

  const aliased = VIBE_ALIASES[requested.toLowerCase()]
  if (aliased) return { id: aliased, source: 'alias', requested }

  if (!_warnedUnknown.has(requested)) {
    _warnedUnknown.add(requested)
    console.warn(
      `[VibeCanon] Vibe desconocido '${requested}' → fallback '${VIBE_FALLBACK_ID}'. ` +
      `Válidos: ${VIBE_IDS.join(', ')}. Aliases: ${Object.keys(VIBE_ALIASES).length}.`
    )
  }
  return { id: VIBE_FALLBACK_ID, source: 'fallback', requested }
}
```

### 3.2 Migrar los 7 mapas a la resolución canónica

| # | Archivo | Estado actual | Acción |
|---|---|---|---|
| 1 | `engine/vibe/profiles/index.ts:53-93` | `VIBE_ALIAS_MAP` propio | **Borrar.** Re-export `VIBE_ALIASES` del Canon |
| 2 | `engine/vibe/profiles/index.ts:98-110` | `normalizeVibeId()` propio | **Borrar.** Delegar a `resolveVibeId()` |
| 3 | `engine/vibe/profiles/index.ts:39-45` | `VIBE_REGISTRY` | Mantener. Cambiar tipo a `Record<VibeId, VibeProfile>` verificado contra `VIBE_IDS` |
| 4 | `hal/physics/profiles/index.ts:25-47` | `PROFILE_REGISTRY` con 18 aliases + fallback techno | Reducir a `Record<VibeId, ILiquidProfile>` (5 entradas). Los aliases los resuelve `resolveVibeId()` **antes** del lookup |
| 5 | `engine/color/colorConstitutions.ts:505-522` | `COLOR_CONSTITUTIONS` + fallback idle | Mantener estructura. Ya usa fallback idle — es el modelo correcto |
| 6 | `engine/movement/VibeMovementManager.ts:192,203,375` | 3 mapas, fallback idle/0 | Mantener. Añadir verificación de completitud (§3.3) |
| 7 | `core/aether/adapters/KineticAdapter.ts:84-104` | `VIBE_ID_MAP` propio + **fallback techno-club** | **Borrar el mapa.** Usar `resolveVibeId()`. Ver §3.4 — cambio de comportamiento |

### 3.3 Guardia de completitud en tiempo de compilación

Para cada `Record` indexado por vibe, cambiar la firma de `Record<string, T>` a `Record<VibeId, T>`. Esto convierte una entrada faltante en un **error de compilación** en lugar de un fallback silencioso.

Aplicar a:

| Archivo | Símbolo | Firma objetivo |
|---|---|---|
| `engine/vibe/profiles/index.ts` | `VIBE_REGISTRY` | `Record<VibeId, VibeProfile>` (ya lo es) |
| `hal/physics/profiles/index.ts` | `PROFILE_REGISTRY` | `Record<VibeId, ILiquidProfile>` |
| `engine/color/colorConstitutions.ts` | `COLOR_CONSTITUTIONS` | `Record<VibeId, GenerationOptions>` (ya lo es) |
| `engine/movement/VibeMovementManager.ts` | `VIBE_CONFIG` | `Record<VibeId, VibeConfig>` |
| `engine/movement/VibeMovementManager.ts` | `STEREO_CONFIG` | `Record<VibeId, StereoConfig>` |
| `engine/movement/VibeMovementManager.ts` | `TILT_OFFSET_BY_VIBE` | `Record<VibeId, number>` |
| `engine/movement/VibeMovementPresets.ts` | `MOVEMENT_PRESETS` | `Record<VibeId, MovementPreset>` |
| `core/effects/ContextualEffectSelector.ts` | `EFFECTS_BY_VIBE` | `Record<VibeId, ...>` |
| `chronos/core/TimelineClip.ts` | `VIBE_COLORS` | `Record<VibeId, string>` |
| `hooks/useSeleneVibe.ts` | `VIBE_PRESETS` | `Record<VibeId, VibeInfo>` |

**Este es el paso de mayor valor de todo el blueprint.** Después de esto, añadir `'rave'` a la unión `VibeId` produce ~10 errores de compilación que son exactamente la lista de trabajo pendiente. El compilador se convierte en el checklist.

**Cuidado con los mapas que necesitan aceptar `custom:` keys.** Los mapas mutados por `VibeGraftRegistry` (`VIBE_CONFIG`, `STEREO_CONFIG`, `MOVEMENT_PRESETS`, `TILT_OFFSET_BY_VIBE`, `COLOR_CONSTITUTIONS`) reciben keys `custom:*` en runtime. Solución: declararlos como `Record<VibeId, T>` pero acceder mediante un helper que acepta `AnyVibeKey`:

```ts
function lookupVibeConfig(key: AnyVibeKey): VibeConfig {
  return (VIBE_CONFIG as Record<string, VibeConfig>)[key] ?? VIBE_CONFIG[VIBE_FALLBACK_ID]
}
```

El tipo estricto fuerza la completitud canónica; el helper permite la extensión runtime del graft. Los dos objetivos se cumplen sin conflicto.

### 3.4 CAMBIO DE COMPORTAMIENTO: fallback del KineticAdapter

**Situación actual:** `KineticAdapter.ts:103` usa `FALLBACK_VIBE_ID = 'techno-club'`. Un vibe desconocido hace que los movers bailen como techno.

**Situación tras el refactor:** fallback a `'idle'`. Un vibe desconocido congela los movers en posición neutra.

**Análisis del riesgo:**

| Escenario | Antes | Después | Veredicto |
|---|---|---|---|
| Vibe canónico | Correcto | Correcto | Sin cambio |
| Vibe custom grafted | Correcto (está en el mapa) | Correcto | Sin cambio |
| Vibe desconocido | Movers bailan techno (disfraz silencioso) | Movers en idle + warning | **Mejora** (P3) |

**Justificación:** el disfraz silencioso es exactamente el bug que la auditoría identificó como más peligroso. Un vibe desconocido que se comporta como techno es indistinguible de techno real en el escenario — el operador no puede diagnosticarlo. Con fallback a idle + warning, el fallo es evidente e inmediatamente diagnosticable.

**Mitigación:** en la práctica este path solo se alcanza con un bug de propagación, porque `VibeManager.setActiveVibe()` ya rechaza vibes inválidos antes de que lleguen al adapter. El cambio es defensivo, no funcional.

**Acción obligatoria:** documentar este cambio en el mensaje de commit y verificar en la build que ninguna de las 5 vibes existentes produce el warning.

### 3.5 PUERTA DE VERIFICACIÓN — Fase 2

```powershell
cd electron-app
npx tsc --noEmit          # exit code 0
npm test                  # sin regresiones
```

Verificación funcional en la build:

1. Arrancar la app y ciclar por las 5 vibes.
2. Confirmar **cero** `[VibeCanon] Vibe desconocido` en consola.
3. Confirmar que los aliases legacy siguen funcionando: probar `setVibe('techno')`, `setVibe('latino')`, `setVibe('chill')`.
4. Confirmar paridad visual con la build anterior (P5).

**Commit sugerido:** `VIBE CANON FASE 2: resolución única + Record<VibeId,T> — unifica 7 fallbacks`

---

## 4. FASE 3 — SISTEMA DE FAMILIAS Y LÓGICA FÍSICA/CROMÁTICA

**Meta:** Eliminar los ~20 condicionales `includes()` / `===` convirtiéndolos en lookups a tabla.
**Riesgo:** ALTO — toca el motor de física. Aquí es donde P5 (paridad) es crítico.
**Reversible:** Sí, pero requiere disciplina en la extracción de constantes.

### 4.1 Diseño del sistema de familias

El error conceptual a evitar: una familia NO es solo una etiqueta. Si `VIBE_FAMILY` solo devuelve `'techno' | 'latino' | ...`, los condicionales se transforman de `includes('techno')` a `family === 'techno'` — más limpio, pero sigue siendo un condicional disperso.

**El diseño correcto: la tabla lleva los parámetros que los condicionales hardcodean.** Así cada `if` desaparece por completo.

```ts
// core/vibe/VibeCanon.ts (continuación)

export type VibeFamily = 'techno' | 'latino' | 'rock' | 'chill' | 'rave' | 'neutral'

/**
 * Rasgos de comportamiento por vibe.
 * Cada campo reemplaza un condicional hardcodeado identificado en la auditoría.
 * La referencia al origen es obligatoria en el comentario de cada campo.
 */
export interface VibeTraits {
  readonly family: VibeFamily

  // ── Física líquida ──────────────────────────────────────────
  /** Reemplaza `isTechnoProfile` @ LiquidEngineBase.ts:1958 (vocalPenalty bypass) */
  readonly bypassVocalPenalty: boolean
  /** Reemplaza el ternario dmzFactor @ LiquidEngineBase.ts:1959 */
  readonly dmzFactor: number
  /** Reemplaza el ternario backLeftGain @ LiquidEngineBase.ts:1965 */
  readonly backLeftGain: number
  /** Reemplaza `isLatino` @ LiquidEngine71.ts:107,167-168 (swap de movers) */
  readonly swapMovers: boolean
  /** Reemplaza `isAbsoluteChillProfile()` @ LiquidEngineBase.ts:2257 */
  readonly pureAmbient: boolean
  /** Reemplaza `isChill` @ LiquidEngine71.ts:108,120 (payload neutro) */
  readonly neutralPayload: boolean

  // ── Techo de intensidad legacy ──────────────────────────────
  /** Reemplaza `isTechno ? 0.80 : 0.95` @ SeleneLux.ts:1212 */
  readonly frontCeiling: number
  /** Reemplaza `isTechno ? 0.10 : 0.06` @ SeleneLux.ts:1218 */
  readonly backGateThreshold: number

  // ── Paleta y motores auxiliares ─────────────────────────────
  /** Reemplaza el if/else de paleta @ SeleneLux.ts:610-626 */
  readonly palettePhysics: 'techno' | 'latino' | 'none'
  /** Reemplaza `includes('chill')` @ SeleneLux.ts:677, TitanEngine.ts:811 */
  readonly usesChillAmbientEngine: boolean
  /** Reemplaza `isChillVibeStrobe` @ SeleneLux.ts:1324 */
  readonly strobeAllowed: boolean
  /** Reemplaza `isChillVibeDimmer` @ SeleneLux.ts:1310 */
  readonly photonDimmerOverride: boolean

  // ── Identificador del perfil líquido ────────────────────────
  /** El `ILiquidProfile.id` asociado. Rompe el acoplamiento por string. */
  readonly liquidProfileId: string
}

export const VIBE_TRAITS: Record<VibeId, VibeTraits> = {
  'techno-club': {
    family: 'techno',
    bypassVocalPenalty: true,      // era: id === 'techno-industrial'
    dmzFactor: 0.55,
    backLeftGain: 1.45,
    swapMovers: false,
    pureAmbient: false,
    neutralPayload: false,
    frontCeiling: 0.80,
    backGateThreshold: 0.10,
    palettePhysics: 'techno',
    usesChillAmbientEngine: false,
    strobeAllowed: true,
    photonDimmerOverride: true,
    liquidProfileId: 'techno-industrial',
  },
  'fiesta-latina': {
    family: 'latino',
    bypassVocalPenalty: false,
    dmzFactor: 0.30,
    backLeftGain: 1.75,
    swapMovers: true,              // era: id === 'latino-fiesta'
    pureAmbient: false,
    neutralPayload: false,
    frontCeiling: 0.95,
    backGateThreshold: 0.06,
    palettePhysics: 'latino',
    usesChillAmbientEngine: false,
    strobeAllowed: true,
    photonDimmerOverride: true,
    liquidProfileId: 'latino-fiesta',
  },
  'pop-rock': {
    family: 'rock',
    bypassVocalPenalty: false,
    dmzFactor: 0.30,
    backLeftGain: 1.75,
    swapMovers: false,
    pureAmbient: false,
    neutralPayload: false,
    frontCeiling: 0.95,
    backGateThreshold: 0.06,
    palettePhysics: 'none',
    usesChillAmbientEngine: false,
    strobeAllowed: true,
    photonDimmerOverride: true,
    liquidProfileId: 'poprock-live',
  },
  'chill-lounge': {
    family: 'chill',
    bypassVocalPenalty: false,
    dmzFactor: 0.30,
    backLeftGain: 1.75,
    swapMovers: false,
    pureAmbient: true,             // era: id.includes('chill')||includes('ambient')
    neutralPayload: true,          // era: id === 'chill-oceanic'
    frontCeiling: 0.95,
    backGateThreshold: 0.06,
    palettePhysics: 'none',
    usesChillAmbientEngine: true,  // era: includes('chill')||'lounge'||'ambient'||'jazz'
    strobeAllowed: false,
    photonDimmerOverride: false,
    liquidProfileId: 'chill-oceanic',
  },
  'idle': {
    family: 'neutral',
    bypassVocalPenalty: false,
    dmzFactor: 0.30,
    backLeftGain: 1.75,
    swapMovers: false,
    pureAmbient: false,
    neutralPayload: false,
    frontCeiling: 0.95,
    backGateThreshold: 0.06,
    palettePhysics: 'none',
    usesChillAmbientEngine: false,
    strobeAllowed: true,
    photonDimmerOverride: true,
    liquidProfileId: 'idle',
  },
}

export function getVibeTraits(key: AnyVibeKey): VibeTraits {
  return (VIBE_TRAITS as Record<string, VibeTraits>)[key] ?? VIBE_TRAITS[VIBE_FALLBACK_ID]
}
```

### 4.2 Procedimiento de extracción (crítico para P5)

**Este es el paso donde se rompen las cosas si se hace mal.** El procedimiento obligatorio para cada condicional:

1. **Leer** el condicional actual y sus valores exactos.
2. **Copiar** los valores literales a `VIBE_TRAITS`, uno por vibe, sin redondear ni "limpiar".
3. **Verificar** que el valor de cada vibe en la tabla coincide con lo que el condicional producía para esa vibe.
4. **Reemplazar** el condicional por el lookup.
5. **Confirmar** con tsc + test.

**Ejemplo trabajado — `LiquidEngineBase.ts:1958-1965`:**

```ts
// ANTES
const isTechnoProfile = this.profile.id === 'techno-industrial'
const vocalPenalty = isTechnoProfile ? 0 : Math.min(0.75, ...)
const dmzFactor = isTechnoProfile ? 0.55 : 0.30
const backLeftGain = isTechnoProfile ? 1.45 : 1.75

// DESPUÉS
const traits = this.traits   // inyectado vía setProfile()
const vocalPenalty = traits.bypassVocalPenalty ? 0 : Math.min(0.75, ...)
const dmzFactor = traits.dmzFactor
const backLeftGain = traits.backLeftGain
```

**Tabla de verificación de paridad** (rellenar y confirmar antes de continuar):

| Vibe | `id` actual | `isTechnoProfile` antes | `bypassVocalPenalty` tabla | `dmzFactor` antes | tabla | `backLeftGain` antes | tabla | ✓ |
|---|---|---|---|---|---|---|---|---|
| techno-club | techno-industrial | `true` | `true` | 0.55 | 0.55 | 1.45 | 1.45 | ☐ |
| fiesta-latina | latino-fiesta | `false` | `false` | 0.30 | 0.30 | 1.75 | 1.75 | ☐ |
| pop-rock | poprock-live | `false` | `false` | 0.30 | 0.30 | 1.75 | 1.75 | ☐ |
| chill-lounge | chill-oceanic | `false` | `false` | 0.30 | 0.30 | 1.75 | 1.75 | ☐ |
| idle | idle | `false` | `false` | 0.30 | 0.30 | 1.75 | 1.75 | ☐ |

Replicar esta tabla para cada grupo de condicionales migrado.

### 4.3 Inyección de traits en el motor físico

`LiquidEngineBase` recibe un `ILiquidProfile`, no un `VibeId`. Necesita acceso a los traits. Dos opciones:

| Opción | Implementación | Veredicto |
|---|---|---|
| **A** | Añadir `readonly traits: VibeTraits` a `ILiquidProfile` | ❌ Duplica los traits en 5 archivos de perfil; riesgo de drift |
| **B** | `setProfile(profile, traits)` — el llamador (`SeleneLux`) pasa ambos | ✅ Un solo origen; `SeleneLux` ya conoce el `vibeKey` |

**Elegir opción B.** Modificación en `SeleneLux.setActiveProfile`:

```ts
public setActiveProfile(vibeKey: string): void {
  const { id } = resolveVibeId(vibeKey)
  const traits = getVibeTraits(id)
  const profile = PROFILE_REGISTRY[id as VibeId] ?? PROFILE_REGISTRY[VIBE_FALLBACK_ID]
  liquidEngine41.setProfile(profile, traits)
  liquidEngine71.setProfile(profile, traits)
  liquidTelemetryObserver.setProfile(profile)
  this._activeProfileId = profile.id
  this._activeTraits = traits          // para los usos en updateFromTitan
}
```

Firma nueva en `LiquidEngineBase`:

```ts
setProfile(profile: ILiquidProfile, traits: VibeTraits): void {
  const effective = this.layout === '4.1' ? fuseProfileFor41(profile) : profile
  this.profile = effective
  this.traits = traits
  // ... recreación de envelopes sin cambios
}
```

### 4.4 Inventario completo de condicionales a migrar

| # | Archivo:línea | Condicional actual | Trait de reemplazo |
|---|---|---|---|
| 1 | `LiquidEngineBase.ts:1958` | `profile.id === 'techno-industrial'` | `traits.bypassVocalPenalty` |
| 2 | `LiquidEngineBase.ts:1959` | ternario dmzFactor | `traits.dmzFactor` |
| 3 | `LiquidEngineBase.ts:1965` | ternario backLeftGain | `traits.backLeftGain` |
| 4 | `LiquidEngineBase.ts:2257-2260` | `id.includes('chill')\|\|'ambient'` | `traits.pureAmbient` |
| 5 | `LiquidEngine71.ts:107` | `profileId === LATINO_PROFILE_ID` | `traits.swapMovers` |
| 6 | `LiquidEngine71.ts:108,120` | `profileId === CHILL_PROFILE_ID` | `traits.neutralPayload` |
| 7 | `LiquidEngine71.ts:167-168` | `isLatino ? swap` | `traits.swapMovers` |
| 8 | `LiquidEngine41.ts:92` | `profile.id === 'techno-industrial'` | Borrar (solo telemetría muerta) |
| 9 | `SeleneLux.ts:610-626` | `includes('techno')\|\|'electro'` / `'latin'\|\|...` | `traits.palettePhysics` |
| 10 | `SeleneLux.ts:677-683` | `includes('chill')\|\|'lounge'\|\|...` | `traits.usesChillAmbientEngine` |
| 11 | `SeleneLux.ts:725-730` | `isChill` para selección de engine | `traits.usesChillAmbientEngine` |
| 12 | `SeleneLux.ts:1211-1218` | `includes('techno')` → ceiling/gate | `traits.frontCeiling` / `.backGateThreshold` |
| 13 | `SeleneLux.ts:1310` | `isChillVibeDimmer` | `traits.photonDimmerOverride` |
| 14 | `SeleneLux.ts:1324` | `isChillVibeStrobe` | `traits.strobeAllowed` |
| 15 | `TitanEngine.ts:811-814` | `includes('chill')\|\|'lounge'\|\|...` | `traits.usesChillAmbientEngine` |
| 16 | `KineticAdapter.ts:159` | `vibeId === CHILL_VIBE_ID` | `traits.family === 'chill'` |
| 17 | `KineticSystem.ts:157` | `includes('chill')\|\|'ambient'\|\|'lounge'` | `traits.family === 'chill'` |
| 18 | `SeleneTitanConscious.ts:1693` | `pattern.vibeId === 'chill-lounge'` | `traits.family === 'chill'` |
| 19 | `EffectManager.ts:1303,1325,1339` | `vibeId === 'chill-lounge'/'idle'/'fiesta-latina'` | `traits.family` + tabla de reglas |
| 20 | `VibeMovementManager.ts:1053` | `vibeId === 'chill-lounge' ? 0.80 : 1.0` | Nuevo trait `sedationFactor` |
| 21 | `TitanEngine.ts:975-980` | `physicsApplied === 'latino'\|\|'techno'\|\|...` | Ver §4.5 |

### 4.5 Caso especial: `physicsApplied`

`SeleneLux` emite un string `physicsApplied` (`'techno'` / `'latino'` / `'chill'` / `'rock'` / `'liquid-stereo'` / `'none'`) que `TitanEngine:975-980` compara. Esto es un canal de comunicación por string entre módulos.

**Refactor propuesto:** cambiar `physicsApplied: string` a un tipo cerrado:

```ts
// core/vibe/VibeCanon.ts
export type PhysicsMode = 'liquid-stereo' | 'legacy-mono' | 'chill-glacier' | 'none'
```

Y en `TitanEngine`, en lugar de enumerar los 5 nombres de género, comprobar la capacidad:

```ts
// ANTES
if (nervousOutput.physicsApplied === 'latino' || === 'techno' || === 'rock' || === 'chill' || === 'liquid-stereo')

// DESPUÉS
if (nervousOutput.physicsMode !== 'none')
```

Esto es lo que hace que `rave` funcione sin tocar `TitanEngine`: el motor pregunta "¿hay física?", no "¿es de género X?".

**Nota de riesgo:** este cambio es el más invasivo de la Fase 3. Si el tiempo aprieta, es aceptable posponerlo a una Fase 3b y de momento añadir `'rave'` a la lista de strings — pero queda como deuda.

### 4.6 Simplificación del motor cromático

`TitanEngine.ts:811-839` inyecta `oceanicModulation` en la constitución cuando el vibe es chill. Con traits:

```ts
if (traits.usesChillAmbientEngine) { /* ... oceanic ... */ }
```

El motor cromático (`SeleneColorEngine`) **no requiere cambios** — ya es data-driven y no ramifica por nombre de vibe. Es el modelo arquitectónico que el resto debe imitar. Confirmado en la auditoría §5.

### 4.7 PUERTA DE VERIFICACIÓN — Fase 3

Esta puerta es la más estricta del blueprint.

```powershell
cd electron-app
npx tsc --noEmit          # exit code 0
npm test                  # sin regresiones
```

**Verificación de paridad DMX (obligatoria, P5):**

1. Antes de la Fase 3, capturar telemetría `[FINESSE_AUDIT]` de una pista de referencia por vibe (5 logs).
2. Tras la Fase 3, repetir con la misma pista y misma vibe.
3. Comparar: `OutSnare`, `OutKick`, y las intensidades de zona deben ser **idénticas** frame a frame.
4. Cualquier divergencia = bug de extracción. Revisar la tabla de paridad del §4.2.

**Checklist de condicionales:**

```powershell
# NO debe quedar ningún includes() sobre nombres de género en el motor
# Buscar en src/: includes('techno'), includes('chill'), includes('latin'), includes('ambient')
# Resultado esperado: 0 matches en core/reactivity/, hal/physics/, engine/TitanEngine.ts
```

**Commit sugerido:** `VIBE CANON FASE 3: VIBE_TRAITS — elimina 21 condicionales por string`

---

## 5. FASE 4 — INYECCIÓN DE `rave`

**Meta:** Añadir la vibra `rave` (EDM / Dubstep / Neurofunk).
**Riesgo:** BAJO tras las Fases 1-3 — el compilador dicta la lista de trabajo.
**Precondición dura:** Fases 1, 2 y 3 verdes y committeadas.

### 5.1 El momento de la verdad

Añadir `'rave'` a la unión en `VibeCanon.ts` y ejecutar `tsc --noEmit`. El compilador producirá ~10 errores, uno por cada `Record<VibeId, T>` incompleto. **Esa lista de errores ES el plan de trabajo.** Esto es el retorno de la inversión de las Fases 1-3: antes, añadir un vibe era arqueología sobre 25 archivos; ahora es rellenar los huecos que el compilador señala.

### 5.2 Perfil sonoro objetivo de `rave`

Definición del carácter antes de escribir números, para que las decisiones de calibración tengan un criterio:

| Dimensión | Característica EDM/Dubstep/Neurofunk | Implicación técnica |
|---|---|---|
| Sub-bass | Continuo, wobble, brickwall | `floorSubWeight` alto; cuidado con saturación de ambient |
| Kick | Presente pero enmascarado por el sub | Similar a techno; `bassSubtract` agresivo |
| Snare/crack | **A menudo ausente o sintético** (ver §5.3) | Gate de snare muere → riesgo documentado en `imgood.md` |
| Medios | Sintes densos, sostenidos, agresivos | Necesita el anti-sustain de Fase WAVE 7776/7777 |
| Agudos | Hi-hats sintéticos, risers, white noise | `airTrebleWeight` alto |
| Rango dinámico | Comprimido (brickwall) | AGC y gates deben ser más sensibles |
| Vocales | Frecuentes y prominentes | `bypassVocalPenalty` — decidir en §5.4 |

### 5.3 Riesgo conocido: el gate de snare muerto

La telemetría de `docs/4dcalib/technoclub/imgood.md` documenta el problema estructural del EDM:

- `SnareE = 0.000` en el **100%** de los 775 frames analizados.
- `gH` (gate health) a 0.000 en 409 frames, 0.01x en 72.
- `UnG = 1.000` en 344 frames (44%) → modo wideband abierto.
- Consecuencia: las consonantes vocales se detectan como snares.

**Este problema NO lo resuelve la creación de la vibra `rave`.** Es una limitación del detector: sin percusión seca de la que aprender, el gate no puede distinguir vocal de hi-hat.

**Estrategia aceptada (decisión previa del arquitecto):** no combatir el Right en EDM. Compensar con el 7.1 Left (melodía/presencia) para que la pista se vea viva. La calibración `rave` debe por tanto:

- Priorizar la riqueza del Left (Front L / Back L) sobre la precisión del Right.
- Considerar un `snareVetoTonality` más agresivo para reducir falsos positivos vocales, aceptando pérdida de recall.
- Documentar explícitamente que el Back R en `rave` es "reactivo a transitorios", no "detector de caja".

### 5.4 Decisiones de diseño pendientes de validación en sala

Estas cuatro decisiones no pueden resolverse desde el código. Requieren prueba con material real.

| # | Decisión | Opción A | Opción B | Criterio de desempate |
|---|---|---|---|---|
| D1 | ¿`rave` es familia propia o sub-familia de techno? | `family: 'rave'` — identidad total | `family: 'techno'` — reutiliza infra | Si los traits difieren en ≥3 campos → familia propia |
| D2 | ¿`bypassVocalPenalty`? | `true` (como techno) | `false` (respeta vocales) | EDM tiene vocales prominentes → probar `false` primero |
| D3 | ¿`layout41Strategy`? | `'strict-split'` (metronómico) | `'default'` (smoothed) | EDM es metronómico → `strict-split` |
| D4 | ¿Migrar `'dubstep'`/`'neurofunk'` de techno a rave? | Sí — coherencia semántica | No — evita cambiar comportamiento existente | Sí, pero verificar que no rompe presets guardados |

**Recomendación de partida:** D1=A (familia propia), D2=B (`false`), D3=A (`strict-split`), D4=Sí. Ajustar tras la primera sesión de prueba.

### 5.5 Roadmap de ejecución de la Fase 4

Ejecutar en este orden. Cada paso es verificable.

#### Paso 4.1 — Contratos (tipos)

| Archivo | Acción |
|---|---|
| `core/vibe/VibeCanon.ts` | Añadir `'rave'` a `VibeId` y a `VIBE_IDS` |
| `core/vibe/VibeCanon.ts` | Añadir `'rave'` a `BASE_DNA_IDS` (si debe ser donante de ADN) |
| `core/vibe/VibeCanon.ts` | Añadir `'rave'` a `VibeFamily` (si D1=A) |
| `core/vibe/VibeCanon.ts` | Añadir entrada completa en `VIBE_TRAITS` |
| `core/vibe/VibeCanon.ts` | Añadir aliases: `'edm'`, `'dubstep'`, `'neurofunk'`, `'hardstyle'`, `'trance'`, `'bigroom'` → `'rave'` |

Verificar: `tsc --noEmit` produce la lista de Records incompletos. **Anotarla — es el plan de los pasos siguientes.**

#### Paso 4.2 — Registros

| Archivo | Acción |
|---|---|
| `engine/vibe/profiles/RaveProfile.ts` | **NUEVO.** Crear `VIBE_RAVE: VibeProfile` (mood, color, drop, dimmer, movement, effects, meta) |
| `engine/vibe/profiles/index.ts` | Importar y añadir a `VIBE_REGISTRY` |
| `hal/physics/profiles/rave.ts` | **NUEVO.** Crear `RAVE_PROFILE: ILiquidProfile` (§5.6) |
| `hal/physics/profiles/index.ts` | Añadir a `PROFILE_REGISTRY` |

#### Paso 4.3 — Lógica física y cromática

| Archivo | Acción |
|---|---|
| `engine/color/colorConstitutions.ts` | **NUEVO** `RAVE_CONSTITUTION` + entrada en `COLOR_CONSTITUTIONS` (§5.7) |
| `engine/movement/VibeMovementPresets.ts` | Añadir preset `rave` a `MOVEMENT_PRESETS` |
| `engine/movement/VibeMovementManager.ts` | Añadir a `VIBE_CONFIG`, `STEREO_CONFIG`, `TILT_OFFSET_BY_VIBE` |

Nota: si las Fases 1-3 se completaron, `SeleneLux`, `LiquidEngineBase`, `LiquidEngine71` y `TitanEngine` **no requieren edición** — leen los traits. Esto es la prueba de que el refactor funcionó.

#### Paso 4.4 — Subsistemas y Timeline

| Archivo | Acción |
|---|---|
| `chronos/core/TimelineClip.ts` | Añadir color a `VIBE_COLORS` (sugerencia: verde ácido `#84cc16` o magenta `#ec4899`) |
| `hooks/useSeleneVibe.ts` | Añadir a `VIBE_PRESETS` (label, icono) |
| `components/views/HephaestusView/dna/DnaRail.tsx` | Añadir a `VIBE_UI` |
| `core/arsenal/LfxClipInstance.ts` | Añadir a `COMPATIBLE_VIBES` |
| `core/effects/ContextualEffectSelector.ts` | Añadir a `EFFECTS_BY_VIBE` |
| `engine/musical/analysis/VibeSectionProfiles.ts` | Añadir perfil de sección |
| `core/intelligence/think/PredictionEngine.ts` | Añadir a `VIBE_THRESHOLD_PROFILES` |
| `workers/TrinityBridge.ts` | Añadir a `VIBE_PROFILES` |
| `core/aether/egress/AetherSafetyMiddleware.ts` | Añadir a `VIBE_REV_LIMITS` |
| `electron/SeleneValidator.ts` | Añadir a la lista de validación |

#### Paso 4.5 — Calibración iterativa

Solo tras que todo lo anterior compile y arranque. Ver §6.

### 5.6 Punto de partida del perfil líquido `rave`

**No partir de cero.** Clonar `techno.ts` y ajustar. Justificación: `rave` comparte con techno el sub-bass continuo, el kick enmascarado, y el carácter metronómico. Las diferencias son de grado, no de naturaleza.

Ajustes de partida sugeridos (hipótesis a validar en sala, no verdades):

| Parámetro | techno | rave (partida) | Razón |
|---|---|---|---|
| `id` | `techno-industrial` | `rave-highfreq` | Debe coincidir con `traits.liquidProfileId` |
| `envelopeSubBass.decayBase` | 0.22 | 0.28 | Wobble necesita algo más de estela |
| `envelopeHighMid.decayBase` | 0.75 | 0.75 | Los ríos de luz del WAVE 7777 aplican igual |
| `envelopeSnare.gateOn` | 0.28 | 0.34 | Gate más alto: menos falsos positivos vocales |
| `snareVetoTonality*` | actual | más agresivo | Combate el problema del §5.3 |
| `floorSubWeight` | 0.5 | 0.6 | Sub-bass EDM más protagonista |
| `airTrebleWeight` | 1.0 | 1.0 | Risers y white noise: puro treble |
| `layout41Strategy` | `strict-split` | `strict-split` | D3 |

**Los `overrides41` deben declararse explícitamente.** La auditoría melódica (`auditoria_melodica_71.md`) demostró que los `overrides41` solo se fusionan cuando `layout === '4.1'`. Si `rave` omite `overrides41`, los valores 7.1 correrán en rigs 4.1.

### 5.7 Punto de partida de la constitución cromática `rave`

Carácter visual objetivo: neón agresivo, alto contraste, saturación extrema. Diferenciarse de techno (que ya usa cian/verde con `forbiddenHueRanges: [[5,80]]`).

Propuesta de partida:

| Campo | Valor sugerido | Razón |
|---|---|---|
| `forbiddenHueRanges` | `[[20,60]]` | Prohibir ámbar/amarillo (territorio latino) |
| `allowedHueRanges` | `[[260,340],[100,160]]` | Magenta/violeta + verde ácido = paleta rave |
| `saturationRange` | `[95,100]` | Saturación extrema |
| `lightnessRange` | `[25,55]` | Contraste alto, no lavado |
| `neonProtocol` | `enabled: true` | Heredar de techno |
| `forceStrategy` | `'split-complementary'` | Tensión cromática agresiva |
| `accentBehavior` | `'strobe'` | Como techno |
| `atmosphericTemp` | `10000` | Más frío que techno (9500) |
| `thermalGravityStrength` | `0.15` | Menos gravedad térmica: más libertad de hue |

### 5.8 PUERTA DE VERIFICACIÓN — Fase 4

```powershell
cd electron-app
npx tsc --noEmit          # exit code 0 — cero Records incompletos
npm test
```

Verificación funcional:

1. `rave` aparece en el selector de vibes de la UI.
2. `setVibe('rave')` no produce warning 404.
3. Los aliases funcionan: `setVibe('dubstep')`, `setVibe('edm')` → resuelven a `rave`.
4. Cero `[VibeCanon] Vibe desconocido` en consola.
5. Las 5 vibes preexistentes siguen con paridad visual (P5).
6. En `rave`: Left pinta melodía/sintes, Floor/Air responden, movers se mueven.

**Commit sugerido:** `VIBE RAVE FASE 4: nueva vibra EDM/Dubstep/Neurofunk`

---

## 6. FASE 5 (OPCIONAL) — CALIBRACIÓN DE `rave`

Fuera del alcance del saneamiento arquitectónico, pero necesaria para que `rave` suene bien. Metodología ya probada en el proyecto:

1. **Capturar telemetría** `[FINESSE_AUDIT]` de 8-12 pistas representativas (EDM comercial, dubstep, neurofunk, hardstyle, riddim).
2. **Etiquetado independiente** de impactos con `_mc_truth.py`.
3. **Monte Carlo** con `_mc_sweep.py` sobre los coeficientes de veto.
4. **Verificación split-half** para evitar overfitting.
5. **Documentar** en `docs/forensics/montecarlo_rave.md`.

La infraestructura existe en `docs/4dcalib/technoclub/montecarlo/`. Reutilizarla creando `docs/4dcalib/rave/`.

**Expectativa realista:** el `SnareE = 0.000` estructural del EDM (§5.3) limita el techo de precisión del Right. La calibración debe optimizar el Left y aceptar que el Right en `rave` es un canal de transitorios, no un detector de caja.

---

## 7. TABLA MAESTRA DE EJECUCIÓN

| Fase | Alcance | Archivos | Riesgo | Precondición | Verificación |
|---|---|---|---|---|---|
| **1** | Tipos y contratos | 1 nuevo + 7 editados | BAJO | — | tsc + 1 sola decl. de VibeId |
| **2** | Registros y fallbacks | 10 editados | MEDIO | Fase 1 ✅ | tsc + cero warnings + aliases OK |
| **3** | Familias y lógica física | 12 editados | ALTO | Fase 2 ✅ | tsc + **paridad DMX** + cero includes() |
| **4** | Inyección `rave` | 2 nuevos + 15 editados | BAJO | Fase 3 ✅ | tsc + rave funcional + paridad de las 5 |
| **5** | Calibración `rave` | Solo perfiles | BAJO | Fase 4 ✅ | Monte Carlo + validación en sala |

### Estimación de esfuerzo relativo

| Fase | Complejidad | Notas |
|---|---|---|
| 1 | Baja | Mecánico. El compilador guía cada paso. |
| 2 | Media | El cambio de fallback del KineticAdapter requiere criterio. |
| 3 | **Alta** | La extracción de constantes exige disciplina. Es la fase que puede introducir regresiones sutiles. |
| 4 | Baja | Tras la Fase 3, es rellenar huecos que el compilador señala. |
| 5 | Media | Iterativa, dependiente de material musical y pruebas en sala. |

---

## 8. ESTRATEGIA DE ROLLBACK

Cada fase es un commit independiente. Si una fase falla la verificación:

```powershell
git revert <hash-de-la-fase>    # NO usar reset --hard: preserva el historial
```

**Regla de oro:** no encadenar fases sin verificar. Si la Fase 3 falla tras haber empezado la 4, el diagnóstico se vuelve exponencialmente más difícil porque los cambios de traits y los de `rave` se confunden.

**Punto de no retorno:** ninguno. Todas las fases son reversibles. La Fase 3 es la que más cuidado requiere porque sus regresiones son visuales y sutiles, no errores de compilación — de ahí la exigencia de paridad DMX.

---

## 9. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Ciclo de imports al crear el SSOT | Media | Alto | `VibeCanon.ts` con **cero imports**. Verificar con `tsc` tras crearlo. |
| Regresión visual en Fase 3 | **Alta** | Alto | Tabla de paridad §4.2 + captura de telemetría antes/después |
| Drift entre `VibeId` y `VIBE_IDS` | Media | Medio | `satisfies readonly VibeId[]` lo detecta en compilación |
| Graft de custom vibes roto por `Record<VibeId,T>` | Media | Medio | Helper de acceso `lookupX(key: AnyVibeKey)` (§3.3) |
| `rave` suena a techno por fallback silencioso | Baja tras Fase 2 | Alto | Warning único de `resolveVibeId` + verificación de cero warnings |
| Presets `.lux` guardados con `dubstep` cambian de comportamiento | Media | Bajo | D4 — decidir consciente y documentar |
| Sobre-ingeniería del sistema de traits | Media | Medio | Solo añadir un trait cuando reemplaza un condicional **existente**. No especular. |

---

## 10. CRITERIOS DE ÉXITO

El saneamiento se considera completo cuando:

- [ ] Existe exactamente **1** declaración de `VibeId` en `src/`.
- [ ] Existe exactamente **1** función de resolución de vibe con **1** política de fallback.
- [ ] Cero `includes('techno')` / `includes('chill')` / `includes('latin')` en `core/reactivity/`, `hal/physics/`, `engine/TitanEngine.ts`.
- [ ] Todos los mapas indexados por vibe son `Record<VibeId, T>` (completitud verificada por el compilador).
- [ ] Añadir un vibe nuevo produce una lista finita y completa de errores de compilación que constituye el plan de trabajo.
- [ ] `rave` funciona end-to-end: UI → orquestador → física → color → movimiento → DMX.
- [ ] Las 5 vibes preexistentes mantienen paridad DMX byte-idéntica.
- [ ] `tsc --noEmit` exit code 0 y suite de tests verde.

---

## 11. NOTA FINAL SOBRE EL ORDEN

La tentación natural es empezar por la Fase 4 — es la que da el resultado visible. **Resistirla.**

La auditoría demostró que inyectar `rave` sobre la arquitectura actual requiere tocar 25 archivos con condicionales frágiles dispersos, sin ninguna garantía de haber encontrado todos. Tras las Fases 1-3, el compilador enumera exhaustivamente lo que falta.

El coste de las Fases 1-3 se amortiza en la primera vibra nueva. Se amortiza dos veces si alguna vez hay una segunda.

---

*Blueprint de diseño. No contiene cambios de código. Ejecución pendiente de aprobación.*
