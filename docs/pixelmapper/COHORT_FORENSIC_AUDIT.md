# COHORT_FORENSIC_AUDIT — WAVE 8185
## Forensic Routing Audit · Zone Spill Workaround

> **Alcance**: auditoría estrictamente de solo lectura. Cero archivos `.ts` modificados.
> **Veto vigente**: `HephaestusRuntime.ts` y `TickEngine` son intocables. Todas las vías
> propuestas operan exclusivamente desde `AsteriaCompiler.ts` explotando estructuras
> de datos que YA existen, YA sobreviven al `.lfx` y YA son consumidas por el runtime.

---

## §1 — La ruta exacta (trazada línea a línea)

```
HephTrack.zones
  │
  ▼  HephaestusRuntime._buildResolvedTracks  (runtime:997–1011)
  │    resolveZonesToFixtures(t.zones)
  │      → ZoneMapper.resolveZoneTags(zones, orchFixtures)  (ZoneMapper:338)
  │      → fixtureIds: string[]          ◄── CUELLO DE BOTELLA #1
  │
  ▼  _buildResolvedTrack  (runtime:1022–1072)
  │    ResolvedTrack { fixtureIds, fixturePhases, blendSuffix, cell, ... }
  │    blendSuffix = ':' + paramId + ('#' + cell)?          (runtime:1069)
  │
  ▼  tickActive → _emitTrackSample  (runtime:696)
  │    blendKey = fixtureId + track.blendSuffix             (runtime:711)
  │    existingIdx? → _blendOutput (blendMode)              (runtime:755–756)
  │    else → writeOutput(...)                              (runtime:745/759)
  │                              ◄── CUELLO DE BOTELLA #2 (fusión)
  │
  ▼  HephFixtureOutput { fixtureId, parameter, value, normalizedValue,
  │                      trackZones, cell, isCustomClip, clipId, ... }
  │
  ▼  HephaestusAetherAdapter.ingest  (adapter:70)
       isCustomClip gate (línea 107)
       nodeIds = graph.getDeviceNodes(fixtureId)
       familyNodeIds = nodos del NodeFamily(param)
       ├─ 1 nodo  → cell match requerido si cell definido     (línea 139)
       ├─ N nodos → cell routing EXACTO primero               (líneas 155–168)
       │          → zone routing solo si cell === undefined   (líneas 169–186)
       │          → fallback flood (menos 'flash')            (líneas 190–208)
       └─ color-brightness fallback → solo si cell === undefined (línea 214)
```

### Cuello de botella #1 — resolución zona→fixture (play-time)

`resolveZonesToFixtures` (runtime:985–994) traduce `track.zones` a una lista de
`fixtureIds` mediante `resolveZoneTags`. **La granularidad es la zona, no el
fixture**: dos tracks que declaran `zones: ['front']` resuelven al *mismo* array
de fixtures. El conjunto de miembros de la cohorte —que Asteria conoce a
perfección en el field engine— se pierde aquí; el runtime nunca lo ve.

Detalle crítico de `resolveZoneTags` (ZoneMapper:356–363): los tags que no son
zona canónica ni compuesta ni modificador se **descartan sin filtrar**
("Non-spatial tag — skip, don't filter"). Si `targetTags` queda vacío, el pool
es *todos los fixtures habilitados* (línea 370–372). **Escribir
`zones: ['ast_cohort_3']` no aísla nada — inunda todo el rig.** Trampa
documentada en §3.

Y no se salva por la vía de fase: `fixturePhases` (Path A, runtime:637) se
construye con `resolveWithOverrides(fixtureIds, …)` sobre *el mismo* set
resuelto por zonas (PhaseOverride.ts:73). Los overrides clavan offsets;
no pueden añadir ni excluir fixtures del set emisor.

### Cuello de botella #2 — la fusión por blendKey (tick-time)

`_emitTrackSample` (runtime:711):

```ts
const blendKey = fixtureId + track.blendSuffix
```

Dos tracks de cohortes distintas, mismo `paramId`, mismo `fixtureId`,
`cell === undefined` en ambas → **misma blendKey** → `_blendOutput` funde los
valores con `blendMode` (`replace` → gana el último track del clip por orden
de `clip.tracks`; `max` → HTP; `add` → suma). Ahí es donde las cohortes de una
misma zona mezclan sus intensidades — la línea exacta del colapso es
`runtime:711` + `runtime:755–756`.

El compilador ya *detecta* el spill (AsteriaCompiler.ts:606–633, warning
`COHORT_ZONE_SPILL`) pero solo lo reporta — no lo evita.

---

## §2 — Inventario de handles (supervivencia verificada)

Campos de `HephTrack` (types.ts:428–503) frente a `serializeHephClip`
(types.ts:681–717) y su consumo real en runtime/adapter:

| Handle | Sobrevive `.lfx` | Llega al adapter | Discrimina fixtures | Veredicto |
|---|---|---|---|---|
| **`cell`** | ✅ línea 713 | ✅ `output.cell` → `_nodeCellMatches` | ✅ **exacto por nodeId** | **EL EXPLOIT** |
| `zones` | ✅ línea 684 | ✅ `output.trackZones` | ⚠️ granularidad zona | insuficiente solo |
| `blendMode` | ✅ línea 712 | fusiona en runtime, no en adapter | ❌ decide colisión, no aísla | paliativo |
| `phaseOverrides` | ✅ línea 716 | ✅ timing por fixture | ❌ no excluye miembros | complemento (ya en uso) |
| `colorOverride` | ✅ línea 711 | ✅ suplanta curva | ❌ constante global | irrelevante |
| `selector` | ✅ línea 714 (deep clone) | ❌ **NADIE lo resuelve** | ❌ | **dead-write, trampa** |
| `dimmerScale` | ✅ línea 710 | ❌ nadie lo consume | ❌ | dead-write (WAVE 8080-M3) |

### El handle maestro: `cell` como nodeId completo

`_nodeCellMatches` (adapter:568–573):

```ts
function _nodeCellMatches(nodeId: string, cell: string): boolean {
  const d = nodeId.length - cell.length
  if (d < 0) return false
  if (d === 0) return nodeId === cell            // ← MATCH EXACTO DE ID COMPLETO
  return nodeId.charCodeAt(d - 1) === 0x3a /* ':' */ && nodeId.endsWith(cell)
}
```

El comentario oficial solo documenta el uso por sufijo (`dev:petal-l` ↔ `petal-l`),
pero la rama `d === 0` acepta **el nodeId entero**: `cell: 'par-7:impact'` matchea
*únicamente* el nodeId `'par-7:impact'` — ni `par-17:impact` (la frontera `:` falla
en `charCodeAt(d-1)`), ni `par-8:impact`, ni celdas homónimas de otros fixtures.

Formatos de nodeId verificados (NodeExtractionPipeline):
- Familias en fixtures simples: `${deviceId}:impact` (línea 1081), `:kinetic`,
  `:beam`, `:atmosphere`, `:color` (labelSuffix 'color', línea 516).
- Celdas compuestas/Forge: `${deviceId}:${aetherNodeId}` (línea 684 —
  `petal-l`, `golden-master`, `wash`, …).

**Esto ya está en producción**: la vía MCC-Cell emite exactamente este patrón
(AsteriaCompiler.ts:711–718):

```ts
zones: ['all'], // G5 — el filtro real lo hace `cell` (Δ3)
cell: e.nodeId, // Δ1+Δ3: match exacto por id completo
```

El workaround para cohortes no inventa maquinaria — **generaliza a granularidad
de fixture un ruteo que ya está probado a granularidad de celda**.

### Por qué `cell` tumba los dos cuellos de botella a la vez

1. **Blend** (`runtime:1069`): `blendSuffix` lleva `#cell` → cada pista por
   fixture tiene clave propia (`f3:intensity#f3:impact` ≠ `f4:intensity#f4:impact`)
   → cero fusión cruzada entre cohortes.
2. **Adapter** (`adapter:139/155`): `output.cell !== undefined` activa el routing
   celular, que se ejecuta **antes** del filtro de zonas y lo **sustituye**
   (la rama de zonas exige `cell === undefined`, línea 170). Outputs cuyo nodeId
   no coincide → `_foundNode` queda falso y, como `cell` está definido, los dos
   fallbacks (flood de familia, línea 190; brightness de color, línea 214) están
   **expresamente vetados** — silencio honesto, sin leak. Es un squelch por
   diseño, no un accidente.
3. **Persistencia**: `serializeHephClip` copia `cell` verbatim (types.ts:713).
   El `.lfx` lo porta intacto; `LfxFileLoader` no lo toca.

---

## §3 — Vías de explotación (ordenadas por retorno/coste)

### VÍA A — "MCC-Device": cohortes quirúrgicas por nodeId (recomendada)

Cuando el compilador detecta `COHORT_ZONE_SPILL` (o siempre, bajo estrategia
nueva), emite **una pista por (fixture miembro × parámetro)** en lugar de una
por (cohorte × parámetro):

```ts
tracks.push({
  id: `${ASTERIA_TRACK_PREFIX}${param}_dev_${deviceId}`,
  paramId: param,
  zones: ['all'],               // fixtureIds = rig → el squelch decide
  curve,                        // curva de cohorte rotada por delay_dev
  blendMode: 'replace',
  cell: `${deviceId}:${familySuffix(param)}`,  // ← el hack
  // sin phaseConfig/phaseOverrides: el delay va horneado en la curva
})
```

- `familySuffix('intensity'|'strobe') = 'impact'`, `('color'|'white'|'amber') =
  'color'`, `('pan'|'tilt'|'speed') = 'kinetic'`, resto `'beam'/'atmosphere'`
  — la misma tabla que `_paramFamily` (adapter:357), minúsculas.
- El runtime emite un output por fixture del rig por pista; el adapter squelcha
  todos menos el nodeId exacto. Aislamiento **total** — ni siquiera depende
  de que el fixture esté bien zoneado.
- **Coste**: outputs emitidos = Σ miembros × |rig| por parámetro (la mayoría
  squelchados en el adapter). 60 fixtures, 10 miembros, 2 params →
  ~1200 outputs/frame — el buffer auto-crece y el tick es lineal, pero es la
  tasa del hack. Mitigación opcional: `zones: [zona del fixture]` en vez de
  `'all'` recorta la emisión al pool de su zona (el squelch sigue aislando
  dentro de ella) — solo como optimización de CPU, no de corrección.
- **Coste en bytes**: la curva de cohorte se duplica por miembro (HephTrack
  embebe su propia `curve`). Con K cohortes de ~m miembros el `.lfx` crece
  ~m× respecto a la vía cohorte pura — el HUD BUDGET de la WAVE 8181 ya sabe
  contarlo. Estrategia sensata: **cohort por defecto; MCC-Device solo para
  cohortes con spill detectado** (el warning ya calcula el set exacto).

### VÍA B — Modificadores de zona gratuitos (mitigación barata)

`MODIFIER_ZONES = {'all-left','all-right'}` (ZoneMapper:128) hacen
AND-intersección por `position.x`. `zones: ['front', 'all-left']` parte una
zona en dos mitades sin tocar nada. Útil si el spill real es ≤2 cohortes
separables por lateralidad. Gratis, pero binario — no escala.

### VÍA C — `zones` a nivel de nodo en fixtures compuestos

En compuestos, `output.trackZones` se compara por string crudo
(`_nodeZoneInTrackZones`, adapter:553 — lowercase, sin canonicalizar) contra
`node.zoneId` — que puede ser un *channelZone* interno (`'wash'`, `'strobe'`…).
Si las cohortes mapean sobre channelZones distintos, `zones: ['wash']` discrimina
celdas dentro del fixture. Limitado: solo compuestos, y el operador no controla
esos zoneIds desde Asteria.

### Callejones sin salida (documentados para no reintentarlos)

- **`selector`**: `FixtureSelector` (ShowFileV2:578) declara target/parity/
  indexRange/stereoSide — el targeting por fixture *perfecto* en papel.
  `resolveFixtureSelector` existe (ShowFileV2:651) y se exporta… y **nadie la
  llama en src/**. El runtime solo lee `selector.phase`/`selector.phaseSpread`
  (runtime:1005–1006). Escribir `selector` para targeting es dead-write: la
  trampa más peligrosa del modelo porque *parece* la solución.
- **`phaseOverrides` como exclusión**: los offsets se clampean `[0, D]`
  (PhaseOverride.ts:86/94) y se iteran desde `fixtureIds` — un fixture no
  miembro con override gigante sigue emitiendo (envuelto/clampeado). No excluye.
- **`zones` con tags inventados** (`'ast_cohort_3'`): `resolveZoneTags` los
  descarta → pool = todos los fixtures (ZoneMapper:370–372). Peor que nada.
- **`dimmerScale`**: dead-write confirmado (comentario WAVE 8080-M3 en
  types.ts:445–452). El gain por cohorte ya se hornea en la curva
  (`bakeGainIntoCurve`) — bien así.

---

## §4 — Recomendación de arquitectura

1. **Primario**: nueva estrategia del compilador `mcc-device` (o flag
   `cohortIsolated`) — reutiliza `emitMccTracks` cambiando `e.nodeId` (celda)
   por `${e.deviceId}:${familySuffix}` (fixture) agrupado por cohorte de gain/
   delay. Cero cambios fuera de `AsteriaCompiler.ts`. Runtime, adapter,
   serializer y loader: intactos — el veto se respeta al 100 %.
2. **Selector de estrategia `auto`**: cuando `emitCohortTracks` reporta
   `COHORT_ZONE_SPILL` no vacío, escalar esa cohorte a MCC-Device
   automáticamente (o emitir warning con sugerencia — la decisión del
   operador es política, no técnica).
3. **Presupuesto**: el salto de K×params a Σmiembros×params tracks impacta el
   presupuesto de 256 KB — el HUD BUDGET (WAVE 8181) ya lo visualiza; el
   compilador debería contarlo en `bytes` igual que MCC-Cell.
4. **Nunca** gastar una wave en `selector`/`dimmerScale`/`zones` inventadas —
   §3 los certifica como dead-ends verificados.

> **Veredicto forense**: el runtime no tiene targeting por fixture en tracks…
> salvo por `cell`, que discrimina por nodeId exacto y estaba esperando ser
> usado a granularidad de fixture desde la WAVE 8040. El hack es legítimo:
> reusa un contrato serializado, testeado (Δ1/Δ3, G5) y ya en producción para
> MCC-Cell. `HephaestusRuntime.ts` y `TickEngine` no se tocan.
