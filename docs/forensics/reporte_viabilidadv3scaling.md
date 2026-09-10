# REPORTE DE VIABILIDAD: BYPASS DNA + INTENSITY SCALING V3

**Fecha**: 2026-07-15
**Alcance**: Mapeo arquitectural READ-ONLY para preparar el Paso 2 (refactor UI + tipos)
**Directiva**: DIRECTIVA FORENSE: MAPEO DE ARQUITECTURA PARA "BYPASS DNA" Y "INTENSITY SCALING"

---

## 1. VECTOR 1: RUTA DE DISPARO MANUAL — ¿EXIGE cognitiveDNA?

### 1.1 Topología del clip V3

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\types.ts" lines="544-547" />

```typescript
  // ── Cognitivo (opcional — solo clips Selene-visibles) ──
  cognitiveDNA?: import('../arsenal/lfxTypes').CognitiveDNA
  simulationMeta?: import('../arsenal/lfxTypes').SimulationMeta
  safetyDeclaration?: import('../arsenal/lfxTypes').SafetyDeclaration
```

**`cognitiveDNA` es OPCIONAL en `HephAutomationClipV3`.** El comentario explícito dice "solo clips Selene-visibles". Un clip sin DNA es un clip Hephaestus puro.

### 1.2 Serialización

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\types.ts" lines="686-688" />

```typescript
    cognitiveDNA: clip.cognitiveDNA ? JSON.parse(JSON.stringify(clip.cognitiveDNA)) : undefined,
    simulationMeta: clip.simulationMeta ? JSON.parse(JSON.stringify(clip.simulationMeta)) : undefined,
    safetyDeclaration: clip.safetyDeclaration ? JSON.parse(JSON.stringify(clip.safetyDeclaration)) : undefined,
```

`serializeHephClip()` emite `cognitiveDNA: undefined` cuando el clip no lo tiene. `JSON.stringify()` omite los campos `undefined` del output JSON. **El .lfx guardado no contendrá la clave `cognitiveDNA`.**

### 1.3 Carga desde disco

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\LfxFileLoader.ts" lines="301-323" />

```typescript
    // ── cognitiveDNA ──────────────────────────────────────────────────────
    // Sin DNA el clip no entra al arsenal de Selene — lo pasamos al registry
    // que devuelve null silenciosamente. No es error del archivo.
    const rawDna = clip.cognitiveDNA as Record<string, unknown> | undefined
    if (rawDna) { /* validar genome, vibes, texture */ }
```

**El loader acepta clips sin DNA.** No es error de archivo. El comentario lo dice explícitamente: "Sin DNA el clip no entra al arsenal de Selene — lo pasamos al registry que devuelve null silenciosamente."

### 1.4 HephaestusClipIndex (índice O(1) en memoria)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\HephaestusClipIndex.ts" lines="130-136" />

```typescript
  public getById(id: string): LoadedClip | undefined {
    return this._byId.get(id)
  }
  public getByPath(filePath: string): LoadedClip | undefined {
    return this._byPath.get(filePath)
  }
```

El índice NO valida `cognitiveDNA`. Almacena cualquier clip V3 válido por ID y por path, independientemente de si tiene DNA.

### 1.5 HephaestusRuntime.play()

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\runtime\HephaestusRuntime.ts" lines="354-395" />

```typescript
  play(filePath: string, options: { intensity?: number; ... }): string | null {
    const clip = this.loadClip(filePath)  // ← usa HephaestusClipIndex, NO el registry
    if (!clip) return null
    // ... construye ActiveHephClip, NO verifica cognitiveDNA
  }
```

**`play()` no verifica `cognitiveDNA`.** Carga el clip desde el índice (O(1)), no desde el `DynamicEffectRegistry`.

### 1.6 Rutas de disparo manual

Existen TRES rutas IPC para disparar clips manualmente:

| Ruta IPC | Handler | Path | ¿Exige DNA? |
|---|---|---|---|
| `chronos:triggerHeph` | `IPCHandlers.ts:400-426` | `runtime.play(filePath)` directo | **NO** |
| `chronos:triggerFX` (heph-custom) | `IPCHandlers.ts:356-391` | `runtime.playFromClip(hephClip)` directo | **NO** |
| `lux:forceStrike` | `IPCHandlers.ts:274-279` | `titanOrchestrator.forceStrikeNextFrame()` → `EffectManager.trigger()` → `SeleneHephBridge.route()` → registry lookup | **SÍ** |

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\DynamicEffectRegistry.ts" lines="102-107" />

```typescript
  public registerEffectV3(v3: LFXFileV3, options: RegisterOptions = {}): RegistryEntry | null {
    const clip = v3.clip
    if (!clip.cognitiveDNA) {
      // V3 sin DNA: clip Hephaestus puro — invisible para Selene por diseño.
      return null
    }
```

**El registry rechaza clips sin DNA.** Devuelve `null` silenciosamente. El clip no entra al arsenal de Selene.

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\SeleneHephBridge.ts" lines="187-192" />

```typescript
    const entry = this._registry.getEntry(decision.effectType)
    if (!entry) {
      this._legacyRoutes++
      return _LEGACY_NO_ENTRY
    }
```

Si el efecto no está en el registry (porque no tiene DNA), el bridge devuelve `_LEGACY_NO_ENTRY` (kind: 'legacy'). El EffectManager entonces retorna `null` — el disparo falla.

### 1.7 Veredicto Vector 1

**Despojar el cognitiveDNA NO rompe el disparo manual por filePath/timeline.** Los paths `chronos:triggerHeph` y `chronos:triggerFX` (heph-custom) funcionan sin DNA porque bypassan el registry y usan el HephaestusClipIndex directamente.

**PERO rompe el disparo manual por nombre (`lux:forceStrike`).** Este path requiere que el clip esté registrado en el `DynamicEffectRegistry`, que exige DNA. Un clip sin DNA es invisible para `forceStrike`.

**Comportamiento deseado "invisible para la IA"**: Se cumple parcialmente. El clip no entra al arsenal de Selene (automático), pero tampoco entra al arsenal de `forceStrike` (manual por nombre). Si el usuario quiere disparar por nombre desde la UI del Force Strike, necesita DNA. Si dispara desde la timeline o por filePath, no.

**Implicación para el refactor**: El toggle `bypassAi` debe documentar que los clips bypass NO aparecen en el catálogo de `forceStrike` ni en el catálogo de MidiLearn/KeyForge (que lee de `getEffectCatalog()`). Sigue siendo disparable desde la timeline y desde el HephaestusView.

---

## 2. VECTOR 2: TOPOLOGÍA DEL INTENSITY SCALING

### 2.1 Ubicación legal actual

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\lfxTypes.ts" lines="60-61" />

```typescript
/** Modo de escalado de intensidad del clip. */
export type IntensityScaling = 'proportional' | 'fixed' | 'energyDriven'
```

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\lfxTypes.ts" lines="192-198" />

```typescript
/** Hints de ejecución para HephaestusRuntime / SeleneHephBridge. */
export interface ExecutionHints {
  readonly overlayMode: OverlayMode
  readonly phaseConfig: PhaseConfig
  readonly intensityScaling: IntensityScaling
  readonly fixtureTargeting: FixtureTargeting
}
```

**`intensityScaling` vive en `ExecutionHints`**, NO en `CognitiveDNA` ni en `SimulationMeta`.

### 2.2 ExecutionHints NO existe en HephAutomationClipV3

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\types.ts" lines="504-551" />

`HephAutomationClipV3` tiene: `cognitiveDNA?`, `simulationMeta?`, `safetyDeclaration?`. **NO tiene `executionHints?` ni `execHints?`.** El bloque `ExecutionHints` solo existe en `RegistryEntry` (lfxTypes.ts:248).

### 2.3 El registry hardcodea ExecutionHints

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\DynamicEffectRegistry.ts" lines="472-476" />

```typescript
    // V3 no declara executionHints → usar default
    execHints: Object.freeze({
      ..._DEFAULT_EXECUTION_HINTS,
      phaseConfig: Object.freeze({ ..._DEFAULT_EXECUTION_HINTS.phaseConfig }),
    }) as ExecutionHints,
```

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\DynamicEffectRegistry.ts" lines="496-506" />

```typescript
const _DEFAULT_EXECUTION_HINTS: Readonly<ExecutionHints> = Object.freeze({
  overlayMode: 'absolute',
  phaseConfig: Object.freeze({
    spread: 0,
    symmetry: 'linear',
    wings: 1,
    direction: 1,
  }) as ExecutionHints['phaseConfig'],
  intensityScaling: 'proportional',
  fixtureTargeting: 'all',
}) as Readonly<ExecutionHints>
```

**El registry SIEMPRE asigna `intensityScaling: 'proportional'`.** No lee nada del clip V3. No hay forma de que un .lfx V3 declare su propio `intensityScaling` hoy.

### 2.4 Punto de consumo

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\SeleneHephBridge.ts" lines="318-322" />

```typescript
  const intensity =
    entry.execHints.intensityScaling === 'fixed'
      ? 1.0
      : _clamp01(decision.intensity)
```

El bridge lee `entry.execHints.intensityScaling` del `RegistryEntry`. Si es `'fixed'`, fuerza `intensity = 1.0` (ignora la intensidad dinámica de Selene). Si no, pasa la intensidad de la decisión.

**Esto SOLO aplica al path automático de Selene.** El path manual (`chronos:triggerHeph`) pasa `config.intensity` directamente a `runtime.play()` sin consultar el bridge.

### 2.5 Veredicto Vector 2

**`intensityScaling` pertenece legalmente a `ExecutionHints`**, un bloque separado de `CognitiveDNA` y `SimulationMeta`. Pero `ExecutionHints` no existe en `HephAutomationClipV3` — solo en `RegistryEntry`.

**Para exponerlo en la UI, hay dos opciones topológicas:**

| Opción | Ubicación | Pros | Contras |
|---|---|---|---|
| **A: Añadir `executionHints?` a `HephAutomationClipV3`** | Bloque C (raíz del clip) | Semánticamente correcto — `ExecutionHints` describe ejecución, no cognición. El loader puede leerlo y el registry puede usarlo. | Requiere modificar `HephAutomationClipV3`, `serializeHephClip`, `_buildEntryFromV3`, y el loader. |
| **B: Añadir `intensityScaling` a `CognitiveDNA`** | Bloque A (cognitivo) | Menos cambios — `CognitiveDNA` ya se serializa y propaga. | Semánticamente incorrecto — `intensityScaling` no es cognitivo, es de ejecución. Acopla ejecución a cognición. |

**Recomendación**: Opción A. `ExecutionHints` ya existe como tipo y ya vive en `RegistryEntry`. Añadirlo como campo opcional a `HephAutomationClipV3` es la extensión natural. El loader ya tiene el patrón para validar bloques opcionales (ver `cognitiveDNA`, `simulationMeta`, `safetyDeclaration`).

**Nota crítica**: Si se añade `executionHints` al clip, el `_buildEntryFromV3` debe leerlo del clip en lugar de usar `_DEFAULT_EXECUTION_HINTS`:

```typescript
// Actual (hardcoded):
execHints: Object.freeze({ ..._DEFAULT_EXECUTION_HINTS, ... })

// Deseado (leer del clip):
execHints: Object.freeze({ ..._DEFAULT_EXECUTION_HINTS, ...clip.executionHints })
```

---

## 3. VECTOR 3: ESTADO DE UI EN DnaRail.tsx

### 3.1 Forma del estado actual

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\dna\DnaRail.tsx" lines="168-176" />

```typescript
interface DnaFormState {
  archetype: UserArchetype
  aco: AcoTriad
  zones: EnergyZoneId[]
  vibes: CompatibleVibe[]
  maxStrobeFreqHz: number
  pressureRange: { min: number; max: number }
  textureAffinity: TextureAffinity
}
```

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\dna\DnaRail.tsx" lines="208-214" />

```typescript
interface DnaRailProps {
  dna: CognitiveDNA | undefined
  simMeta: SimulationMeta | undefined
  onDnaChange: (dna: CognitiveDNA) => void
  onSimMetaChange: (meta: SimulationMeta) => void
  onEnableDna: () => void
}
```

El componente padre posee `dna` y `simMeta`. DnaRail los recibe como props y propaga cambios via `onDnaChange` y `onSimMetaChange`.

### 3.2 Flujo de guardado

1. DnaRail mantiene `form: DnaFormState` y `meta: SimulationMeta` en `useState`.
2. Cuando `form` cambia, un `useEffect` deriva `instance.toCognitiveDNA(overrides)` y llama `onDnaChange(dna)`.
3. Cuando `meta` cambia, un `useEffect` llama `onSimMetaChange(meta)`.
4. El padre ensambla el `HephAutomationClipV3` con `cognitiveDNA` y `simulationMeta` y llama `hephFileIO.saveClip(clip)`.
5. `serializeHephClip()` serializa el clip a JSON, omitiendo `cognitiveDNA: undefined`.

### 3.3 Puntos de inyección para los dos controles nuevos

#### 3.3.1 Toggle `bypassAi` (Bypass DNA)

**Ubicación**: DnaRail.tsx, dentro del header o como primera sección.

**Estado**: Añadir a `DnaFormState`:
```typescript
interface DnaFormState {
  // ... campos existentes ...
  bypassAi: boolean  // ← NUEVO
}
```

**Comportamiento**:
- Cuando `bypassAi === true`:
  - El `useEffect` que propaga `onDnaChange` debe omitir la llamada (o el padre debe setear `cognitiveDNA = undefined` en el clip).
  - El DnaRail puede mostrar un estado colapsado ("DNA desactivado — clip manual-only").
  - El botón "ENABLE DNA" actual ya maneja el caso `dna === undefined`.
- Cuando `bypassAi === false`:
  - Comportamiento actual intacto.

**Punto de inyección más limpio**: El `useEffect` de propagación (DnaRail.tsx:375-401). Añadir un guard:
```typescript
useEffect(() => {
  if (isSyncingFromDna.current) { ... }
  if (!dna) return
  if (form.bypassAi) return  // ← NUEVO: no propagar DNA si bypass activo
  const reality = instance.toCognitiveDNA(...)
  onDnaChange(...)
}, [instance])
```

El padre debe entonces setear `clip.cognitiveDNA = undefined` antes de serializar.

**Dependencia**: Ningún cambio en tipos V3 necesarios — `cognitiveDNA` ya es opcional. Solo UI + lógica de guardado.

#### 3.3.2 Selector `intensityScaling` (Fixed/Dynamic)

**Ubicación**: DnaRail.tsx, nueva sección después de SIM GUARDS o como parte de una sección "EXECUTION" nueva.

**Estado**: Añadir a `DnaFormState` o a una prop nueva:
```typescript
interface DnaFormState {
  // ... campos existentes ...
  intensityScaling: IntensityScaling  // ← NUEVO
}
```

**Props nuevas**: DnaRail necesita propagar `intensityScaling` al padre. Opciones:
- Añadir `onExecHintsChange: (hints: ExecutionHints) => void` a `DnaRailProps`.
- O añadir `intensityScaling: IntensityScaling` y `onIntensityScalingChange: (v: IntensityScaling) => void` a `DnaRailProps`.

**Dependencia de tipos**: Requiere añadir `executionHints?: ExecutionHints` a `HephAutomationClipV3` (Opción A del Vector 2). Sin esto, el valor no se persiste en el .lfx.

**Punto de inyección más limpio**: Mismo patrón que `simMeta` — un callback `onExecHintsChange` que el padre usa para setear `clip.executionHints` antes de serializar.

---

## 4. MAPA DE DEPENDENCIAS

### 4.1 Archivos involucrados en Bypass DNA

| Archivo | Rol | ¿Cambio necesario? |
|---|---|---|
| `hephaestus/types.ts:545` | `cognitiveDNA?` ya es opcional | NO |
| `hephaestus/types.ts:686` | `serializeHephClip` omite `undefined` | NO |
| `arsenal/LfxFileLoader.ts:301-323` | Acepta clips sin DNA | NO |
| `arsenal/DynamicEffectRegistry.ts:104-107` | Rechaza clips sin DNA (invisible para Selene) | NO |
| `hephaestus/HephaestusClipIndex.ts` | Indexa sin verificar DNA | NO |
| `hephaestus/runtime/HephaestusRuntime.ts:354` | `play()` no verifica DNA | NO |
| `orchestrator/IPCHandlers.ts:400-426` | `chronos:triggerHeph` bypassa registry | NO |
| `components/.../DnaRail.tsx` | UI toggle `bypassAi` | **SÍ** |
| Padre de DnaRail (HephaestusView) | Lógica de guardado: omitir `cognitiveDNA` | **SÍ** |

### 4.2 Archivos involucrados en Intensity Scaling

| Archivo | Rol | ¿Cambio necesario? |
|---|---|---|
| `arsenal/lfxTypes.ts:61` | Tipo `IntensityScaling` ya existe | NO |
| `arsenal/lfxTypes.ts:192-198` | `ExecutionHints` ya existe | NO |
| `hephaestus/types.ts:504-551` | `HephAutomationClipV3` sin `executionHints` | **SÍ** — añadir campo opcional |
| `hephaestus/types.ts:623-691` | `serializeHephClip` no serializa `executionHints` | **SÍ** — añadir serialización |
| `arsenal/DynamicEffectRegistry.ts:472-476` | Hardcodea `_DEFAULT_EXECUTION_HINTS` | **SÍ** — leer del clip |
| `arsenal/LfxFileLoader.ts:234-411` | No valida `executionHints` | **SÍ** — añadir validación opcional |
| `arsenal/SeleneHephBridge.ts:318-322` | Lee `entry.execHints.intensityScaling` | NO |
| `components/.../DnaRail.tsx` | UI selector `intensityScaling` | **SÍ** |
| Padre de DnaRail (HephaestusView) | Propagar `executionHints` al clip | **SÍ** |

---

## 5. RIESGOS Y CONFLICTOS

### 5.1 Bypass DNA

- **Riesgo bajo.** `cognitiveDNA` ya es opcional en toda la cadena. El único path que se rompe es `lux:forceStrike` (manual por nombre), que ya está documentado como comportamiento esperado ("invisible para la IA").
- **Conflicto con MidiLearn/KeyForge**: `getEffectCatalog()` (DynamicEffectRegistry.ts:337-344) solo retorna efectos con DNA. Los clips bypass no aparecerán en el catálogo de MIDI/KeyForge. Esto es consistente con "invisible para la IA".
- **Retrocompat**: Los .lfx existentes con DNA no se ven afectados. Los .lfx sin DNA ya cargan hoy (legacy v1.x).

### 5.2 Intensity Scaling

- **Riesgo medio.** Añadir `executionHints?` a `HephAutomationClipV3` es un cambio aditivo. Los clips existentes que no lo declaran caen al default (`'proportional'`).
- **Conflicto con checksum**: Si se añade `executionHints` al clip, el checksum SHA-256 cambia para clips nuevos. Los clips existentes sin `executionHints` mantienen su checksum (campo omitido = mismo JSON).
- **Retrocompat**: El loader debe aceptar clips sin `executionHints` (igual que acepta clips sin `cognitiveDNA`). El registry debe hacer fallback a `_DEFAULT_EXECUTION_HINTS` si el clip no declara el bloque.
- **Validación**: El loader debe validar que `intensityScaling` sea uno de `'proportional' | 'fixed' | 'energyDriven'`. Si no, rechazar o caer al default.

---

## 6. CONCLUSIÓN

| Pregunta | Respuesta |
|---|---|
| ¿Despojar el ADN rompe el disparo manual? | **NO** para timeline/filePath (`chronos:triggerHeph`). **SÍ** para `lux:forceStrike` (por nombre). |
| ¿Dónde vive legalmente `intensityScaling`? | En `ExecutionHints` (lfxTypes.ts:192-198), NO en `CognitiveDNA` ni `SimulationMeta`. |
| ¿`ExecutionHints` existe en `HephAutomationClipV3`? | **NO.** Solo en `RegistryEntry`. Hay que añadirlo como campo opcional. |
| ¿Punto de inyección más limpio para `bypassAi`? | `DnaFormState.bypassAi` + guard en el `useEffect` de propagación (DnaRail.tsx:375). |
| ¿Punto de inyección más limpio para `intensityScaling`? | Nueva prop `onExecHintsChange` + sección "EXECUTION" en DnaRail. Requiere añadir `executionHints?` a `HephAutomationClipV3`. |
| ¿Riesgo de retrocompat? | Bajo para bypass DNA. Medio para intensity scaling (cambio de tipo + serialización + loader + registry). |

**El plano está listo para el Paso 2.**
