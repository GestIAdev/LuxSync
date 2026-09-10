# BLUEPRINT — GENESIS REFINEMENT: Color HSL, Depth Cap, Telemetría Champions, Firma Canónica

> **Fuente forense:** Auditoría read-only 2026-08-20 (devuelta en respuesta, no persistida).
> **Alcance:** 4 parches quirúrgicos en `electron-app/src/core/`.
> **Regla de oro:** Cada fase termina con `tsc --noEmit` en verde. No se avanza con deuda de tipos.
> **Restricción permanente:** Atmosphere/fire/smoke manual-only, tungsten unassigned, macros y rotX
> manual-only, rotation sin pan/tilt cambiantes. Ningún parche toca semántica de hardware.

---

## VISIÓN GENERAL

| Fase | Vector | Archivo(s) | Riesgo | Esfuerzo |
|:----:|--------|-----------|:------:|:--------:|
| 1 | Color HSL en `geneAugmentation` | `GeneticOperators.ts` | Medio | Bajo |
| 2 | Depth cap en `OrganismMaterializer` | `OrganismMaterializer.ts` | Bajo | Bajo |
| 3 | Telemetría Champions (5 puntos) | `EffectDreamSimulator.ts`, `DreamEngineIntegrator.ts`, `DecisionMaker.ts` | Bajo | Medio |
| 4 | Firma canónica (sort por paramId) | `ColiseumService.ts` | Medio | Bajo |
| 5 | Verificación + migración de firmas | tests + opcional | — | Bajo |

Orden elegido: el bug de Color (Fase 1) es el único que **corrompe descendencia activamente**
con cada spawn. El depth cap (Fase 2) es latente pero barato. La telemetría (Fase 3) es
read-only en runtime y no cambia comportamiento. La firma (Fase 4) requiere ventana de
migración y va al final para no ensuciar las señales de telemetría de la Fase 3.

---

## FASE 1 — COLOR: `geneAugmentation` debe construir HSL

### 1.1 Diagnóstico (del forense)

`GeneticOperators.ts:951-954` construye el keyframe de color como **número** (hue lineal):

```ts
} else if (chosenParam === 'color') {
  value = range[0] + span * tFraction        // ← NÚMERO
  interpolation = useBezierInterp ? 'bezier' : 'linear'
}
```

y la línea 1018 declara el track como `valueType: 'color'`. Resultado: track de color con
keyframes `{ value: number }`. Cascada de fallos:

- `colorHueShift` (l.2545) salta el keyframe (`typeof kf.value === 'number'` → `continue`).
- `focalMutation` (l.634) no entra al branch color (`typeof kf.value === 'object'` es false).
- `CurveEvaluator.getColorValue` (l.288) falla `isValidHSL` → `writeSafeDefault()` → gris.
- `computeL2DistanceV2` (l.142) no ve el keyframe → mutantes color invisibles a rareza.

### 1.2 Parche — punto A: constructor HSL (l.951-954)

Reemplazar el branch de color. El hue mantiene la intención original (spread lineal por
fracción de grid), pero S y L se muestrean para dar vida a la paleta:

```ts
} else if (chosenParam === 'color') {
  // 🎨 WAVE 7770 FIX: Color keyframes MUST be HSL objects, not numbers.
  // The old code wrote `value = range[0] + span * tFraction` (a bare number)
  // into a track declared valueType:'color'. colorHueShift skipped these
  // keyframes, CurveEvaluator fell to writeSafeDefault (gray), and L2 was
  // blind to the mutation. Construct a proper HSL now.
  const hue = range[0] + span * tFraction            // spread lineal (intento original)
  const newHsl: HSL = {
    h: Math.round(hue * 10) / 10,
    s: 70 + Math.round(rng() * 30),                  // 70-100: paleta viva, no pastel
    l: 40 + Math.round(rng() * 20),                  // 40-60: rango medio seguro
  }
  value = newHsl
  interpolation = useBezierInterp ? 'bezier' : 'linear'
}
```

**Por qué estos rangos de S/L:** S ∈ [70,100] evita grises lavados (el safe default ya es
gris — no queremos mutar hacia gris). L ∈ [40,60] evita negro/blanco extremos que el
`PrenatalScreening` podría rechazar por exceso de contraste. El hue conserva el spread
original por `tFraction` — la distribución por grid era correcta, solo la representación
era inválida.

### 1.3 Parche — punto B: `Math.round` numérico (l.976)

La línea 976 hace `value = Math.round(value * 1000) / 1000`. Sobre un objeto HSL produce
`NaN`. Blindar:

```ts
if (typeof value === 'number') {
  value = Math.round(value * 1000) / 1000
}
const kf: HephKeyframe = { timeMs, value, interpolation }
```

### 1.4 Parche — punto C: boundary enforcement HSL-aware (l.992-1009)

El keyframe de borde en t=0 propaga `firstVal` y el de t=duration propaga `last.value`.
Ambos ya funcionan con objetos (passthrough), PERO la línea 997 re-hace el round numérico:

```ts
value: typeof firstVal === 'number' ? Math.round(firstVal * 1000) / 1000 : firstVal,
```

Esta línea **ya es correcta** para HSL (el ternario pasa el objeto intacto). Verificar que
no haya sido "simplificada" en un futuro — anotar con comentario. No requiere cambio.

### 1.5 Parche — punto D: `defaultValue` del track (l.1020)

`defaultValue: range[0]` es un número en un track de color. `CurveEvaluator` (l.271)
verifica `typeof curve.defaultValue === 'object'` y si falla cae a `{h:0, s:0, l:50}` (gris).
Construir default HSL:

```ts
const isColorTrack = chosenParam === 'color'
// ...
curve: {
  paramId: chosenParam as HephParamId,
  valueType: isColorTrack ? 'color' : 'number',
  range: [range[0], range[1]] as [number, number],
  defaultValue: isColorTrack
    ? { h: range[0], s: 85, l: 50 }          // 🎨 WAVE 7770: default HSL coherente
    : range[0],
  keyframes,
  mode: 'absolute',
},
```

### 1.6 Parche — punto E: `deepClone` y `applyDelta` (sin cambio, verificación)

Los operadores ya producen deltas con objetos HSL (`colorHueShift` l.2573-2577 emite
`{ op: 'replace', value: newHsl }`). `applyDelta` usa JSON Patch sobre estructuras
clonadas — los objetos sobreviven el round-trip. **No requiere cambio.** Verificar con el
test de la Fase 1.8.

### 1.7 Parche — punto F: sanity clamp post-arena (opcional, recomendado)

Después del switch de construcción (l.974), blindar el HSL contra valores fuera de dominio
(defensa en profundidad — si un blueprint ancestro trae S=120):

```ts
if (typeof value === 'object' && value !== null && 'h' in value) {
  const hsl = value as HSL
  hsl.h = ((hsl.h % 360) + 360) % 360
  hsl.s = Math.max(0, Math.min(100, hsl.s))
  hsl.l = Math.max(0, Math.min(100, hsl.l))
}
```

### 1.8 Verificación de Fase 1

Test unitario nuevo (o extensión del existente de operadores) — camino mínimo:

1. Llamar `geneAugmentation(clipPadre)` con un clip que tenga DNA con `organicity > 0.5`
   (para que `chosenParam === 'color'` sea alcanzable — verificar el pool
   `AUGMENTABLE_PARAMS` y el branch de selección por organicity).
2. Fijar seed determinista.
3. Assert: el nuevo track (si `chosenParam === 'color'`) tiene TODOS sus keyframes con
   `typeof kf.value === 'object'` y `'h' in kf.value && 's' in kf.value && 'l' in kf.value`.
4. Assert: `curve.defaultValue` es objeto HSL cuando `valueType === 'color'`.
5. Round-trip: `applyDelta(parent, delta)` → materializar → los keyframes siguen siendo HSL.
6. `computeL2DistanceV2(parent, child)` con mutación color > 0 (el branch HSL de l.142-161
   ahora contribuye a la distancia).

**Criterio de éxito:** `colorHueShift` sobre un descendiente de `geneAugmentation` produce
`delta.length > 0` (antes era 0 — saltaba todos los keyframes).

---

## FASE 2 — DEPTH CAP en `OrganismMaterializer.materialize()`

### 2.1 Diagnóstico

`OrganismMaterializer.ts:132-135`:

```ts
if (org.parent_organism_id) {
  // Recursively materialize parent (bounded by generation ≤ 16)  ← COMENTARIO MIENTE
  const parentMat = this.materialize(org.parent_organism_id)      // ← SIN BOUND
  parentClip = parentMat.clip
}
```

El comentario dice "bounded by generation ≤ 16" pero el check `generation < 16` solo existe en
`_mitosis` (ColiseumService.ts:771) — limita reproducción, no materialización. Si la BD
sufre un ciclo referencial (A→B→A en `parent_organism_id`), la recursión es infinita →
stack overflow → Event Loop colgado (main process muerto).

### 2.2 Parche

**Constante** (junto a `LRU_MAX_SIZE`, l.33):

```ts
// 🛡️ WAVE 7770: Maximum lineage depth for materialization recursion.
// Matches MITOSIS generation cap (ColiseumService generation < 16).
// Guards against circular parent_organism_id references corrupting the DB.
const MAX_LINEAGE_DEPTH = 16
```

**Firma** (l.118):

```ts
materialize(organismId: string, _depth: number = 0): MaterializedOrganism {
```

Nota: `_depth` con guion bajo — parámetro interno, no parte del contrato público. Los
callers existentes (`ColiseumService`, `DynamicEffectRegistry.refreshEvolutionaryCandidates`,
tests) no cambian.

**Branch de recursión** (l.132-135):

```ts
if (org.parent_organism_id) {
  if (_depth >= MAX_LINEAGE_DEPTH) {
    // 🛡️ WAVE 7770: Lineage too deep (or circular). Fall back to the granite
    // ancestor instead of recursing — the operator never sees a lost frame.
    console.warn(
      `[OrganismMaterializer ⚠️] Lineage depth ${_depth} ≥ ${MAX_LINEAGE_DEPTH} ` +
      `for ${organismId} — possible circular reference. Falling back to granite ancestor.`,
    )
    const blueprint = this._vault.getBlueprint(org.blueprint_id)
    if (!blueprint) {
      throw new Error(`Blueprint not found: ${org.blueprint_id}`)
    }
    parentClip = blueprint.clipV3
  } else {
    const parentMat = this.materialize(org.parent_organism_id, _depth + 1)
    parentClip = parentMat.clip
  }
}
```

**Por qué este fallback:** es el mismo FALLBACK SAGRADO que ya existe en el catch (l.203-231)
— granite ancestor intacto. La diferencia: lo interceptamos ANTES del stack overflow, no
después. El clip sigue siendo evaluable; solo pierde las mutaciones acumuladas de la
profundidad excedida.

### 2.3 Detalle: el catch existente NO protege contra stack overflow

El `try/catch` de `materialize` (l.123) NO captura `RangeError: Maximum call stack size
exceeded` de forma fiable en todos los runtimes de V8 — la condición del stack puede
corromper el manejo de excepciones. El depth cap elimina la clase de problema, no el
síntoma.

### 2.4 Verificación de Fase 2

Test: insertar organismos A→B→A (ciclo de 2) en un vault de test, llamar
`materialize('A')`, assert que retorna el granite ancestor (no hang, no stack overflow),
y que el warning fue emitido. Extender `OrganismMaterializer.test.ts`.

---

## FASE 3 — TELEMETRÍA DE CHAMPIONS (5 puntos de inyección)

### 3.1 Principio de diseño

Un solo formato de log, throttled, con prefijo `[CHAMPION_TRACK]` — grep-able en la
consola de producción. **Cero cambios de comportamiento** — solo observabilidad. Todos
los logs usan `console.log`/`warn` (patrón existente del codebase) con throttle de 30s
donde el punto está en hot path.

### 3.2 PUNTO 1 — Registro en Arena (ya existe, intensificar)

**Archivo:** `DynamicEffectRegistry.ts` — `refreshEvolutionaryCandidates()` (l.236-240)

El summary log actual ya lista `status: ${result.candidates.map(c => c.status).join(', ')}`.
Ampliar para contar por estado y loguear rechazos con razón:

```ts
const statusCount = result.candidates.reduce((acc, c) => {
  acc[c.status] = (acc[c.status] ?? 0) + 1
  return acc
}, {} as Record<string, number>)
console.log(
  `[CHAMPION_TRACK] 🧬 Arena cycle: injected=${injected} rejected=${rejected} ` +
  `pool=${JSON.stringify(statusCount)}`,
)
```

En el branch de rechazo (l.222-226), ya loguea DNA/vibes. Añadir la razón exacta (G3 vs G4)
mirando cuál gate falló — esto requiere tocar `_validateGenomeRanges` o duplicar el check
antes de llamar `registerEffectV3`. **Opción mínima:** loguear los valores del genome y la
longitud de vibes (suficiente para diagnóstico post-hoc).

### 3.3 PUNTO 2 — QUARANTINE filter (hot path, throttled 30s)

**Archivo:** `EffectDreamSimulator.ts` — justo después de l.323 (después del filter):

```ts
// [CHAMPION_TRACK] P2: composition of the ranking funnel
if (!this._lastChampionTrackTs || Date.now() - this._lastChampionTrackTs > 30_000) {
  this._lastChampionTrackTs = Date.now()
  const rankedByStatus: Record<string, number> = {}
  for (const s of rankedScenarios) {
    const st = registry.getEntry(s.effect.effect)?.organismStatus ?? 'builtin'
    rankedByStatus[st] = (rankedByStatus[st] ?? 0) + 1
  }
  console.log(
    `[CHAMPION_TRACK] 🧬 Funnel: ranked=${rankedScenarios.length} ` +
    `(${JSON.stringify(rankedByStatus)}) → live=${liveCandidates.length} ` +
    `best=${bestScenario ? (registry.getEntry(bestScenario.effect.effect)?.organismStatus ?? 'builtin') : 'null'}`,
  )
}
```

Campo nuevo en la clase: `private _lastChampionTrackTs = 0` (junto a `_lastFilterAuditTs`,
que ya existe en l.979 — mismo patrón).

**Este es el punto de diagnóstico clave:** si `live=0` con champions en el registry,
el bug está aguas arriba (registro/índices). Si `live>0` pero `best` no es champion,
el bug está en el ranking (`calculateScenarioScore`). Si `best` ES champion pero no se
dispara, el bug está aguas abajo (Puntos 3-5).

### 3.4 PUNTO 3 — Pre-buffer vibe-aware (evento, no throttle)

**Archivo:** `EffectDreamSimulator.ts` — l.357-362 (ya loguea el fallback vibe-incompatible).

Ampliar el log existente con el estado del organismo:

```ts
if (preBufferScenario && preBufferScenario !== bestScenario) {
  console.log(
    `[CHAMPION_TRACK] 🔮 Vibe pre-buffer swap: #1 ` +
    `(${registry.getEntry(bestScenario?.effect.effect ?? '')?.organismStatus ?? '?'}) ` +
    `→ "${effectDisplayName(preBufferScenario.effect.effectName ?? preBufferScenario.effect.effect)}" ` +
    `(${registry.getEntry(preBufferScenario.effect.effect)?.organismStatus ?? 'builtin'})`,
  )
}
```

Y en el selizado del pre-buffer (l.364-379), loguear CUÁNDO un champion entra al buffer.

### 3.5 PUNTO 4 — DreamEngineIntegrator: el veredicto ético (evento)

**Archivo:** `DreamEngineIntegrator.ts`

Los puntos de rechazo `approved: false` están en l.167, l.193, l.219, l.260. Cada uno
corresponde a una razón distinta (sin pre-buffer, sin bestScenario, rechazo ético,
fallback vacío). El log de APPROVED ya existe en l.390 (throttled por efecto).

Añadir en cada rechazo el ID del organismo si el effect proviene del registry:

```ts
const entry = getDynamicEffectRegistry().getEntry(candidateEffect?.effect ?? '')
console.warn(
  `[CHAMPION_TRACK] ⚖️ Ethics reject @ ${reason}: ` +
  `${effectDisplayName(candidateEffect?.effect ?? '?')} ` +
  `(status=${entry?.organismStatus ?? 'builtin'}, id=${entry?.organismId ?? 'n/a'})`,
)
```

**Este punto revela si el Conscience Engine (HERESY, penalty=1.0) está matando champions**
— el split-brain clásico del WAVE 7541 que ya se documentó para vibes.

### 3.6 PUNTO 5 — DecisionMaker: la compuerta de confianza (evento)

**Archivo:** `DecisionMaker.ts` — l.218-224

El bypass `dnaApproved` existe (WAVE 7004.6). El punto ciego: cuando `dnaApproved` es
**false** (el integrator no aprobó) y la confianza cae bajo 0.55, el champion muere aquí
silenciosamente con solo `Low Confidence Matrix`. Ampliar:

```ts
if (!dnaApproved && combinedConfidence < cfg.minConfidenceThreshold) {
  const entry = getDynamicEffectRegistry().getEntry(
    inputs.dreamIntegration?.effect?.effect ?? '',
  )
  console.log(
    `[CHAMPION_TRACK] 🚪 Confidence gate BLOCK: conf=${combinedConfidence.toFixed(3)} ` +
    `< ${cfg.minConfidenceThreshold} | effect=${inputs.dreamIntegration?.effect?.effect ?? 'null'} ` +
    `(status=${entry?.organismStatus ?? 'n/a'})`,
  )
  // ... return output existente
}
```

Nota: `DecisionMaker.ts` es un módulo de funciones puras — verificar si ya importa
`getDynamicEffectRegistry`. Si no, preferir pasar el status por `DecisionInputs.dreamIntegration`
(el efecto ya viaja ahí) para no acoplar el módulo. **Opción limpia:** añadir
`organismStatus?: string` al payload de `dreamIntegration` en el Integrator (Punto 4) y
loguearlo aquí sin nuevo import.

### 3.7 Verificación de Fase 3

Ejecutar la app con ecosistema activo 5+ minutos. Grep de `[CHAMPION_TRACK]` debe mostrar
la cadena completa: Arena → Funnel → (Pre-buffer | Ethics | Confidence). Si algún eslabón
no aparece, ese es el punto de muerte documentado con datos.

---

## FASE 4 — FIRMA CANÓNICA: sort de tracks por paramId

### 4.1 Diagnóstico

`ColiseumService.ts:200-227` (`computeBezierSignature`) itera `clip.tracks` en orden de
inserción. Dos clips estructuralmente idénticos con orden distinto de tracks producen
firmas distintas → K-Means los clusteriza en especies diferentes → especiación ruidosa.

### 4.2 Parche

```ts
function computeBezierSignature(clip: HephAutomationClipV3): Float32Array {
  const values: number[] = []
  // 🔬 WAVE 7770: Canonical track order — sort by paramId before extraction.
  // Two structurally identical clips with different track insertion order
  // produced different signatures → phantom species in K-Means.
  // Secondary sort by zones.join(',') for deterministic order when a clip
  // has two tracks with the same paramId (different zones).
  const canonicalTracks = [...clip.tracks].sort((a, b) => {
    const byParam = a.curve.paramId.localeCompare(b.curve.paramId)
    if (byParam !== 0) return byParam
    return a.zones.join(',').localeCompare(b.zones.join(','))
  })
  for (const track of canonicalTracks) {
    // ... cuerpo existente sin cambios (range/span/offset, keyframes, handles)
  }
  // ... pad/truncate a 128 existente sin cambios
}
```

**Detalles:**
- `[...clip.tracks]` — copia superficial, NO mutar el clip original (es cacheado y
  compartido; el materializer lo sirve por referencia).
- Sort secundario por `zones.join(',')` — determinismo cuando hay dos tracks del mismo
  `paramId` con zones distintas (caso legítimo: color para pars vs color para ambient).
- `localeCompare` — determinista entre sesiones (evitar `<`/`>` que depende de
  normalización Unicode del runtime).

### 4.3 Ventana de migración (crítico)

La firma vieja y la nueva son **incomparables** — los organismos existentes en
`lfx_organisms.bezier_signature` tienen firmas en orden de inserción. Tras el parche:

- **Opción A (auto-curativa, recomendada):** no migrar. El `SpeciationEngine` re-clusteriza
  cada ciclo de mantenimiento (60s). Durante UN ciclo, todos los organismos vivos aparecen
  como "novedosos" entre sí (distancia máxima entre firma vieja y nueva) → posible re-escisión
  de especias transitoria → se estabiliza al siguiente ciclo cuando todos los INSERT nuevos
  usan firma canónica. Los organismos viejos que no re-spawnean nunca actualizan su firma —
  sus firmas viejas siguen siendo comparables ENTRE SÍ (mismo formato viejo).
  **Limitación:** firma vieja vs firma nueva nunca converge para el mismo organismo.

- **Opción B (migración one-shot):** al arrancar, tras `AncestralIngestor.ingestAll()`,
  ejecutar `UPDATE lfx_organisms SET bezier_signature = NULL WHERE status IN ('alive','champion')`
  y recalcular solo los que entren en `refreshEvolutionaryCandidates` (el INSERT path no
  re-escribe firmas de organismos existentes — requiere UPDATE explícito). Más costoso,
  pero consistente al 100%.

- **Recomendación del blueprint:** Opción A + nota en el changelog. La especiación es
  aproximada por diseño (K-Means con centroides heredados); un ciclo de ruido es aceptable.

### 4.4 Verificación de Fase 4

Test: construir dos clips idénticos con tracks en orden inverso, assert que
`computeBezierSignature` produce `Float32Array` idénticas (comparación elemento a elemento).

---

## FASE 5 — VERIFICACIÓN FINAL

1. `npx tsc --noEmit` — exit code 0 (obligatorio tras cada fase, y de nuevo al final).
2. Suite de tests Genesis existente:
   - `OrganismMaterializer.test.ts` (extendido con el test de ciclo de Fase 2)
   - `EcologyLifecycle.test.ts` (sin regresión)
   - Tests de operadores (extendidos con HSL round-trip de Fase 1)
3. Smoke manual: ecosistema activo 10 min, grep `[CHAMPION_TRACK]`, confirmar que el funnel
   muestra champions en `live=` y que al menos uno llega a APPROVED o el log de rechazo
   identifica la compuerta exacta.

---

## RESUMEN DE ARCHIVOS TOCADOS

| Archivo | Fase | Naturaleza del cambio |
|---------|:----:|----------------------|
| `electron-app/src/core/genesis/operators/GeneticOperators.ts` | 1 | Constructor HSL + guard Math.round + defaultValue HSL + clamp dominio |
| `electron-app/src/core/genesis/OrganismMaterializer.ts` | 2 | `MAX_LINEAGE_DEPTH` + parámetro `_depth` + fallback granite |
| `electron-app/src/core/arsenal/DynamicEffectRegistry.ts` | 3 | Log composición por status en Arena cycle |
| `electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts` | 3 | P2 funnel log (throttled) + P3 pre-buffer status |
| `electron-app/src/core/intelligence/integration/DreamEngineIntegrator.ts` | 3 | P4 ethics reject con organismStatus |
| `electron-app/src/core/intelligence/think/DecisionMaker.ts` | 3 | P5 confidence gate log (status vía dreamIntegration) |
| `electron-app/src/core/genesis/ColiseumService.ts` | 4 | Sort canónico en `computeBezierSignature` |
| Tests (2 archivos) | 1,2 | HSL round-trip + ciclo de linaje |

**No se toca:** `HephaestusRuntime`, `CurveEvaluator`, `FixtureMapper`, `EffectManager`,
`SpeciesQuotaSelector`, `LifecycleManager`, schema SQL. Los consumidores de HSL ya están
correctos — el bug estaba solo en el productor (`geneAugmentation`).
