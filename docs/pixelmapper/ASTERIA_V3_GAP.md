WAVE 8200 — auditoría read-only del puente de exportación `.lfx`. Mapeo primero el ecosistema: serializador V3, validador/gates, metadata de Selene, y cómo Asteria intenta exportar hoy:

`LFXFileV3` = `$schema + clip + checksum SHA-256`. Ahora `HephAutomationClipV3` (types) y los gates del loader:

Ahora `LfxFileLoader` — los gates de validación:

El loader delega en `HephaestusClipIndex.upsert()` — ahí deben vivir los gates G1-G7 y la Gate 4 de zonas energéticas:

Ahora busco el GatekeeperLinter y la regla de "máximo 2 zonas energéticas":

El GatekeeperLinter valida `LfxClipInstance` — el átomo de Selene con `acoTriad`/`energyZones`. Busco "Gate 4" literal y el `LfxClipInstance`:

Gate 4 localizado: `zoneSpan = indexOf(energyZone.max) − indexOf(energyZone.min) + 1 > 2` → fail. Ahora `LfxClipInstance` (ACO, bake, checksum) y el compilador/injector de Asteria:

El átomo Selene deriva `energyZone.min/max` de un array `energyZones` — una lista de 5 zonas produce un span >2 → G4 fail. Ahora busco qué genera Asteria hoy (¿cognitiveDNA? ¿vibeCompat? ¿export?):

Hallazgo clave: **cero referencias a `cognitiveDNA`/`energyZone`/`vibe`/`ACO`/`archetype` en todo Asteria**. Ahora el canal de guardado existente — `HephFileIO` + IPC:

Canal de guardado existe: `HephFileIO.saveClip` → serialize + SHA-256 + `userData/arsenal/`. Ahora `AsteriaCompiler`/`injectAstTracks` — qué escribe en el clip (¿DNA? ¿spatialZones?):

`DynamicEffectRegistry.registerEffectV3` — sus gates y qué pasa sin `cognitiveDNA`:

Registry: sin `cognitiveDNA` → `registerEffectV3` devuelve `null` (Hephaestus-only, invisible a Selene). Ahora `emissionPlan.ts` — la forma exacta de las pistas emitidas:

Ahora las funciones `emitRoute`/`emitPlans` — la forma exacta del `HephTrack` emitido:

Las pistas emitidas están claras (lambda/zoned/surgical). Ahora: `computeLfxChecksum`, el IPC de guardado, y dónde nace el `cognitiveDNA` del clip (¿quién pone energyZone?):

Ahora el lado renderer: ¿quién llama `heph:save`? ¿el editor store corre gates antes? ¿`NewClipModal` crea DNA?

**Hallazgo Gate 4**: `DEFAULT_COGNITIVE_DNA.energyZone = {min:'ambient', max:'peak'}` → span = 5 zonas (ambient,gentle,active,intense,peak) → G4 fail. Ahora el caller renderer de `heph:save` y si los gates bloquean el guardado:

El flujo de guardado bloquea en `evaluateGates`. Verifico `NewClipModal` (¿hereda el DNA por defecto de 5 zonas?) y `memberZones` (¿qué strings de zona emite Asteria?):

`memberZones` emite `atlas.entries[i].zoneId` — ¿esos ids son `CanonicalZone` válidos? Verifico el atlas y `materialize`:

`normalizeZoneId` produce `front-left`/`back-left` — **fuera de las 9 `CanonicalZone`**. Verifico el resto y cómo el runtime resuelve `track.zones` (`ZoneMapper`):

`ZoneMapper` tolera strings arbitrarios — las zonas del atlas (`front-left` etc.) no son `CanonicalZone` estricto pero resuelven. Última pieza: `computeLfxChecksum` y el bridge `DnaRail` (cómo el DNA llega al clip):

Verifico cómo Asteria recupera el proyecto al cargar un clip (`clip.asteria` → store) y el init del proyecto:

Verifico si `_parseAndValidateV3` sigue vivo en el path de carga o es código muerto:

`_parseAndValidateV3` es **código muerto** — `loadFile` delega en `index.upsert`. El path real de validación es Index→Registry. Última verificación: consumidores Cassandra/Selene del `.lfx` y el uso de `MAX_FILE_SIZE_BYTES`:

Última pieza — la intención documentada de export en el blueprint (§10 mencionado por el budget HUD):

El blueprint ya declara el contrato de exportación. Leo las secciones clave (170-240, 640-710):

Una verificación final — ¿el `SafetyStrip` (donde se ven los gates) es visible en la pestaña Asteria?

Auditoría completa. Reporte WAVE 8200 — Audit Phase:

# WAVE 8200 — V3 Export & I/O Holistics · Gap Analysis

## Mapa del pipeline real (verificado en código)

```
AsteriaView ──► useAsteriaCompiler (debounce 150ms)
     │           fieldEngine.evaluate → compile() → emitRoute()
     │           → injectAstTracks(clip, ast_*, project)   [solo tracks + clip.asteria]
     │           → replaceClipTransient(editor.clip)
     ▼
HephaestusView header SAVE ──► evaluateGates(clip)  [G1–G7, renderer]
     │   any fail → "🛡 BLOCKED" (no IPC)
     ▼
window.luxsync.hephaestus.save(serializeHephClip(clip))
     ▼
ipcMain 'heph:save' ──► HephFileIO.saveClip()
     │   serializeHephClip → JSON.stringify → SHA-256
     │   → write {$schema:'luxsync.lfx/3.0', clip, checksum} a userData/arsenal/<id>.lfx
     │   → HephaestusClipIndex.upsert (struct + G2 checksum verify)
     ▼
LfxFileLoader.loadFile → DynamicEffectRegistry.registerEffectV3 (G3/G4) → Selene
```

**No existe ningún exportador Asteria.** Cero llamadas a `heph:save`/`saveClip`/`.lfx`/fs en `asteria/`. El blueprint ya lo declara: *"Asteria no es un exportador. Es un generador de tracks que vive dentro del clip V3 activo"*. El puente físico existe y funciona — la brecha es de **metadata y gates**, no de escritura.

---

## Pilar 1 — Normalización de curvas vs V3

**Qué emite `emitRoute` hoy** (`emissionPlan.ts:1119-1176`):

| Ruta | Forma emitida |
|---|---|
| `lambda`/`ride` | `{id:'ast_<param>_<stem>', paramId, zones, curve, blendMode:'replace', phaseConfig:ASTERIA_PHASE_CONFIG, phaseOverrides:{dev:{mode:'absolute',offsetMs}}}` |
| `zoned` (cohort) | idem, curva rotada+gain horneado, `zones` = zoneIds de miembros |
| `surgical` (mcc/mcc-device/glyph/static) | `{id, paramId, zones:['all'], curve, blendMode:'replace', cell: nodeId}` — delay+gain horneados |

**Compatibilidad estructural es real, no coincidente**: `materialize` produce los 6 campos de `HephCurve` (`paramId`, `valueType`, `range`, `defaultValue`, `keyframes`, `mode`); `sanitizeCurve` redondea/clampa; `validateAstTrack` (AsteriaCompiler.ts:230) exige `ast_*`, zones≠∅, kfs ASC en [0,D], valores en range, offsets enteros. `serializeHephClip` preserva `cell`/`phaseConfig`/`phaseOverrides`/`blendMode` (types.ts:715-721). El roundtrip `cell` está testeado (`AsteriaCompiler.test.ts:1343`).

**Discrepancias exactas:**

1. **`zones` no es vocabulario canónico.** `memberZones()` (emissionPlan.ts:467) vuelca `atlas.entries[].zoneId` crudo con cast `as ZoneTarget[]`. `normalizeZoneId` produce `'front-left'`, `'back-left'`, etc. — **fuera de las 9 `CanonicalZone`** y de los helpers `'all'/'all-pars'/'all-movers'`. Ningún gate valida el enum (index solo exige array no vacío); `ZoneMapper.resolveZone` los tolera por string-match. Funciona por tolerancia del resolver, viola el tipo estricto.
2. **`spatialZones` queda stale.** `injectAstTracks` (AsteriaCompiler.ts:156-169) hace `{...clip, asteria, tracks}` — jamás recomputa `spatialZones` (documentado como "unión de zones de tracks[]"). Además el comentario en types.ts:564 dice que "el LfxFileLoader auto-recomputa en carga" — **falso**: ni `_parseAndValidateV3` ni `upsert` lo recomputan. Consecuencia viva: `useHephPreview.resolveFixtures` (useHephPreview.ts:330) lee `spatialZones` para el pool → si el clip nació con `['front']` y Asteria emite `['all']`, el preview filtra mal.
3. **Orden de tracks no canónico.** types.ts:582 documenta "zona ASC → paramId ASC (garantiza idempotencia/checksum)". Los `ast_*` se appends al final en orden de plan. El checksum no se rompe (se hashea lo escrito), pero el invariante documentado no se honra.
4. **Cobertura de params incompleta**: `gobo1`, `gobo2`, `prism`, `smoke_density`, `fan_speed` → `PARAM_SKIPPED` (emissionPlan.ts:88-93). `curveMode:'stepped'` nunca se emite — consistente con la exclusión de gobos, pero es un límite de exportación.
5. `selector` no se emite (correcto — blueprint A2: el runtime lo ignora para targeting) y `dimmerScale` no se emite (correcto — dead write, gain horneado).

**Veredicto P1**: las pistas `ast_*` son serializables como V3 *tal cual*. No hace falta adapter de curvas; sí hace falta saneado de vocabulario de zonas + recompute de `spatialZones`.

## Pilar 2 — ADN y metadata de Selene

**Asteria no genera metadata. Punto.** `grep` sobre todo `asteria/`: cero hits para `cognitiveDNA`, `energyZone`, `vibeCompat`, `acoTriad`, `userArchetype`, `visibility`. El clip arrastra el DNA con que nació:

- `NewClipModal.tsx:266` → `{...DEFAULT_COGNITIVE_DNA}` = archetype `'utility'`, genome `{0.5,0.5,0.5}` (el **ACO**), `textureAffinity 'universal'`, **`compatibleVibes: []`**, **`validSections: []`**, `energyZone {min:'ambient', max:'peak'}`, `spatialBehavior 'absolute'`, sin `visibility` (→ `'all'`).
- `vibeCompat` del clip: `serializeHephClip` lo deriva de `dna.compatibleVibes` si hay — vacío queda vacío.

**Cadena de consecuencias:**
- `registerEffectV3` (DynamicEffectRegistry.ts:104): sin DNA → `null` (Hephaestus-only); con DNA pero `compatibleVibes:[]` → **G4 fail → rechazo silencioso** → Selene/Cassandra jamás ven el clip.
- Flags manual vs arsenal = `cognitiveDNA.visibility: 'all'|'manual_only'` — existe el campo, el toggle en DnaRail y el filtro en el registry; **nada en Asteria lo escribe** → siempre `'all'` (auto-seleccionable).
- La metadata sí sobrevive a la serialización (whitelist en `serializeHephClip:748-751`) — el problema no es pérdida, es que el contenido describe al clip template, no a lo que Asteria pintó.

**Discrepancia exacta**: falta la capa que sintetice o saneé DNA para clips Asteria-authored (o que los marque honestamente `manual_only` si la intención es disparo manual).

## Pilar 3 — Gate 4 (zonas energéticas)

**El origen de las "5 zonas" NO es Asteria** — es el default de fábrica:

```
DEFAULT_COGNITIVE_DNA.energyZone = { min:'ambient', max:'peak' }   (defaults.ts:16)
ENERGY_ZONES = [silence, valley, ambient, gentle, active, intense, peak]
zoneSpan = idx(6) − idx(2) + 1 = 5  →  G4 FAIL ("máximo 2")
```

- Dos evaluadores G4: `gateEvaluators.ts:87-135` (renderer, **bloquea SAVE** en `handleSave`/`handleSaveAs`, index.tsx:170-174) y `PrenatalScreening.ts:94-131` (Genesis, aborta organismos).
- DnaRail agrava: su form default es `zones:['ambient','gentle','active']` → span 3 → también >2. Y expande `zones = ENERGY_ZONES.slice(lo, hi+1)` — rango contiguo, sin cap.
- `energyZone` es un *rango* `{min,max}` — las "zonas" que cuenta G4 son el **span del termómetro Selene**, no los `track.zones` espaciales. Namespaces separados por diseño (types.ts:548-551). Los `zoneId` del atlas no contaminan este gate.
- `handleCreateClip` (index.tsx:382-403) **bypassea los gates** — el clip se escribe en disco con DNA roto; el operador descubre el bloqueo al primer SAVE posterior.

**Remediación conceptual** (sin implementar): el export debe colapsar `energyZone` a un span ≤2 — p.ej. derivar la banda desde el arquetipo (`ARCHETYPE_BIAS_MAP.defaultZones` ya son ≤2 en todos los arquetipos) o clampear `min..max` a la ventana dominante. Bonus: DnaRail debería impedir seleccionar >2 zonas contiguas.

## Pilar 4 — Checksum y Gates 1–7

**Checksum: existe y es correcto.**
- `saveClip` (HephFileIO.ts:178-186): `sha256(JSON.stringify(serializeHephClip(clip)))` → `checksum:'sha256:<hex>'`. **La metadata de usuario está dentro del payload** (`cognitiveDNA`, `simulationMeta`, `asteria` van dentro de `clip`) → cubierta por el hash. ✓
- Verificación en carga: `HephaestusClipIndex.upsert:229-243` — mismatch = hard reject; ausente = warn+accept (doctrina LAZARUS B-4). Prefijo `sha256:` normalizado.
- Determinismo: `serializeHephClip` construye el objeto con orden de claves fijo → `JSON.stringify` estable. Doble serialización (renderer + main) es idempotente. ✓

**Gates G1–G7 — mapa de enforcement real:**

| Gate | Dónde se evalúa | ¿Bloquea el .lfx de Asteria? |
|---|---|---|
| G1 schema | renderer `evaluateGates` + index | pasa (id/name/duration del clip) |
| G2 checksum | index `upsert` (post-write) | pasa — saveClip lo calcula bien |
| G3 genome | renderer + registry | pasa (0.5∈[0,1]) |
| **G4 compat/zonas** | renderer (bloquea) + registry (rechaza) | **FALLA — span 5 + vibes/sections vacíos** |
| G5 curvas | renderer + index + `validateAstTrack` | pasa |
| G6 strobe | renderer + `saveClip` auto-declara safetyDeclaration si hay pista strobe | pasa/auto-fix |
| G7 spatial | renderer | warn si DNA dice `absolute` y hay pan/tilt — no bloquea |

**Agujeros encontrados:**
- `heph:save` IPC **no re-valida gates** — el enforcement es solo UI. `handleCreateClip` y cualquier caller futuro (incluido un export Asteria) escriben sin gates.
- `_parseAndValidateV3` + `_validateCurves`/`_validateStrobeDeclaration`/`_validateSpatialRanges` en LfxFileLoader son **código muerto** — `loadFile` delega en `index.upsert` y nunca se llaman. El blueprint §8.5.3 manda "gate replay" con ellos — imposible, no están en el path.
- `USER_SAFETY_POLICY.MAX_FILE_SIZE_BYTES` (256 KB) está declarado y **nunca se usa** — el límite que el HUD de Asteria muestra no se enforcea en carga.

## Pilar 5 — Rutas de I/O físicas

**Estado: correcto donde existe.**
- Escritura única: `userData/arsenal/<clip.id>.lfx` — `app.getPath('userData')` → absoluta, `mkdir -p`, preserva subfolder del índice, limpia duplicados stale (HephFileIO.ts:188-218). ✓
- **Repo = solo factory**: `builtins/` se lee como seed; `_isBuiltinFile` protege borrado; `saveClip` jamás escribe fuera de `userData`. ✓
- Roundtrip del proyecto: `clip.asteria` embebido sobrevive serialize+load (`AsteriaPersistence.test.ts`), `useAsteriaRigDrift` lo rehidrata. ✓

**El puente que falta**: no es un writer — es la capa de **higiene de clip pre-save**. Hoy el único camino es el botón SAVE del header (visible en la pestaña Asteria, `SafetyStrip` incluido — el operador ve "🛡 BLOCKED" pero las causas G4 viven en el DnaRail del tab sculpt). Un clip pintado 100 % en Asteria hereda un DNA que (a) describe intención ajena, (b) viola G4 por default, (c) es rechazado por el registry aunque se escriba.

## Veredicto

**¿Existe exportación `.lfx` válida hoy?** Parcialmente. El archivo físico que `saveClip` produce **es un `.lfx` legítimo** (schema V3, checksum correcto, tracks conformes, `asteria` embebido) y entra al `HephaestusClipIndex` sin problemas. Pero:

1. **SAVE está bloqueado por G4** para todo clip con `DEFAULT_COGNITIVE_DNA` (span 5 + vibes vacíos) — que es todo clip nacido de NewClipModal.
2. **Aunque se escriba** (via create-bypass o DNA arreglado a mano), el clip es **invisible para Selene/Cassandra** (registry G4: `compatibleVibes` vacío) o — peor — visible con DNA que describe otro efecto.
3. `spatialZones` stale y zonas de track no-canónicas son deudas reales del payload.

**Frontera de remediación recomendada** (sin implementar): un `prepareClipForExport(clip)` patch-time que (a) recompute `spatialZones` desde `tracks`, (b) normalice `track.zones` a `CanonicalZone`/helpers, (c) saneé/sintetice `cognitiveDNA` (arquetipo+ACO+vibes+energyZone ≤2+visibility) — ya sea derivando del stack de gestos o marcando `manual_only` honesto, (d) corra `evaluateGates` antes del IPC. Todo offline, cero cambio al runtime — consistente con el dogma.

Sin cambios realizados — esperando autorización para la fase de implementación.
---

# WAVE 8201 — RESOLUCIÓN (The Diplomat)

Implementado el middleware de exportación auditado arriba.

## `src/core/hephaestus/exportSanitizer.ts` (nuevo, puro)

`prepareClipForExport(clip) → { clip, notes }` — sin mutación del input.

**M1 · Higiene espacial** — `sanitizeTrackZone` cadena:
`ZoneTarget` válido → `normalizeZoneId` (aliases aether) → sufijo lateral
(`front-left` → `front`, padre canónico) → `normalizeZone` (legacy V1/V2) →
`'unassigned'` (zona muerta honesta — jamás `'all'`: una zona irreconocible
no debe inundar el rig). Dedupe por track; `spatialZones` raíz = unión
ordenada canónico-primero sobre todos los tracks → pool de preview ya no
queda stale (`useHephPreview.resolveFixtures`).

**M2 · Pasaporte Selene** — solo si `cognitiveDNA` existe (no inventar para
clips Hephaestus-only):
- `energyZone` span > 2 o huérfano → `ARCHETYPE_BIAS_MAP[archetype].defaultZones`
  → cola dominante ≤ 2 (utility `[ambient,gentle,active]` → `gentle→active`;
  divine → `peak→peak`; desconocido → fallback `active→intense`).
- `compatibleVibes` vacío → `['chill-lounge']` + `visibility:'manual_only'`
  (registry G4 exige vibes ≠ ∅ para indexar; `manual_only` es el flag honesto:
  catalogado, jamás auto-seleccionado, disparo manual abierto).
- `validSections` vacío → secciones derivadas de la ventana energética
  (mapa `ZONE_SECTIONS` alineado con vocabulario de builtins).

**M3 · Enforcement** — doble capa:
- **Renderer** (`index.tsx`): `exportView = prepareClipForExport(clip)` es la
  fuente de `gateResults`/`hasGateFailures`/`SafetyStrip` (badges muestran lo
  que se escribirá). `handleSave`/`handleConfirmSaveAs`/`handleCreateClip`
  serializan `prepared` (no el raw); gate fail → abort + `console.error` +
  mensaje 🛡. El editor adopta el clip saneado post-save (editor == disco).
  El create-path ya no bypassea gates.
- **Main** (`HephIPCHandlers.ts` `heph:save`): re-sanea + re-evalúa gates
  antes de `hephFileIO.saveClip` → `success:false` sin escritura si falla.
  Última línea de defensa contra callers que bypasseen el renderer.

`gateEvaluators.ts` + `exportSanitizer.ts` reubicados a `core/hephaestus/`
(puros, compartidos renderer/main — elimina el smell de importar view-layer
desde el proceso principal).

**Veto runtime ✓** — cero cambios en `NodeArbiter`/`TickEngine`/runtime:
el saneamiento es patch-time, consistente con el dogma.

Tests: `src/core/hephaestus/__tests__/exportSanitizer.test.ts` — 17 tests
(zonas sub-canónicas, dedupe, union, pureza, DNA span 5→≤2, arquetipos,
vibes/manual_only, secciones derivadas, integración con `evaluateGates`).
