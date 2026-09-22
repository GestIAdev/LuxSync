Forensic audit #2 — tracing the UI's data source vs the DMX path to find the exact bifurcation. Starting with `AetherProjectorUI`:

Projector confirmed — reads `arbitrated.get(nodeId)` per-node. Now checking tick ordering (project vs resolve) and confirming the resolver never mutates the shared map:

Map complete — the bifurcation is now exact. Here's the holistic trace.

---

# 🗺️ AUDITORÍA: BIFURCACIÓN UI vs DMX — TUNGSTEN MULTI-CELL

## El mapa de dependencias completo

```
LiquidStereoResult (intensidades por zona: air/ambient/flash…)
        │
        ▼  ADAPTERS — routing por node.zoneId (sano, verificado):
        │    LiquidAetherAdapter._routeUniversalIntensity (L284-310)
        │      ├─ nodo CON dimmer físico → intent 'dimmer'
        │      └─ nodo SIN dimmer      → intent 'brightness'   (virtual dimming)
        │    selene-aether-adapter._emitColor/_emitImpact (dual-alias r+red)
        ▼
NodeArbiter ──► ArbitratedNodeMap  { nodeId → channelValues }
        │           ▲
        │           │  ★★★ ÚNICA FUENTE DE VERDAD COMPARTIDA ★★★
        │           │  TickEngine.ts:1681 (resolve) y :1691 (project)
        │           │  leen EL MISMO mapa, post-arbitraje
        │
        ├───────────────────────────┬────────────────────────────────┐
        ▼ RUTA UI (sana)            │                                ▼ RUTA DMX (corrupta)
                                  │
AetherUIProjector.project          │    NodeResolver.resolve(arbitrated)
 (TickEngine.ts:1691)              │      │ por cada nodeId del device:
  arbitrated.get(nodeId)           │      ├─ ¿device tiene forgeGraph?
  ─ lee POR NODO, keys desnudas:   │      │    SÍ → _accumulateForgeNodeValues
  • ch['dimmer'] ?? ch['brightness']│    │      merge a record PLANO por device
  • ch['r'/'red']… → fixture.r,    │    │      ★ CORRUPCIÓN A (L1047-1058):
    rAmbient, rAir (zoneId routing)│    │      keys 'dimmer'×5, 'red'×2 colisionan
  • KINETIC → fixture.rotation     │    │      → last-writer-wins por orden de nodos
  • WAVE 4822: NUNCA aplica        │    │
    blackout (L72-75) — canvas     │    ▼
    muestra INTENCIÓN, no bytes    │    _writeForgeDevice → ForgeNodeEvaluator.evaluate
                                  │      ★ CORRUPCIÓN B (ForgeGraphCompiler.ts:316):
                                  │        inputMap.set(channelKey) last-wins —
                                  │        'dimmer' solo alimenta in-dimmer-7;
                                  │        wires de in-dimmer-2/4/5/6, in-red-9/10/11…
                                  │        jamás se inyectan → output 0
                                  │      ★ CORRUPCIÓN C: 'brightness' no existe
                                  │        como input node → descartado (eval L69-72)
                                  │      ▼
                                  │    _applyIgnitionInjections (L979-1002)
                                  │      ★ CORRUPCIÓN D: dep {type:'dimmer'} →
                                  │        find-first → buf[offset2]=255 (celda ajena)
                                  │      ▼
                                  │    buffer → SAB egress (TickEngine:1698+)
                                  │      → drivers → hardware = NEGRO
                                  ▼
```

## Por qué la UI se veía perfecta durante el apagón

El proyector lee `arbitrated.get('wash-impact')['dimmer']` y `arbitrated.get('beam-color')['brightness']` — **valores por-nodo, sanos, enrutados por zoneId**. La corrupción ocurre íntegramente *aguas abajo* de esa lectura:

1. `wash-impact` sí recibió su intent `dimmer` (ambient) → UI lo dibuja → pero en la ruta DMX ese valor colisiona con los `dimmer` de 4 nodos impact más en el record plano y solo sobrevive en el wire de `in-dimmer-7` por accidente de orden.
2. `beam-color` recibió `brightness` + color → UI lo proyecta con `localDimmer` correcto → pero `brightness` no existe como `input_dmx` en el grafo → **descartado**, y sus canales RGB solo reciben el ganador del merge `red/green/blue` (última celda COLOR que escribió).
3. El proyector **ignora blackout por diseño** (WAVE 4822, L72-75: *"El Canvas siempre muestra L0+L1+L2… HAL es la única Aduana real"*) — incluso un blackout deliberado se dibuja encendido.

## Respuesta a la pregunta 4 — ¿Prefijos `nodeId:channelType` dañarían la UI?

**No. La UI es completamente agnóstica al espacio de claves del grafo Forge.**

- El proyector jamás toca `_forgeAccumValues`, `inputMap`, `wireBuffer` ni el buffer DMX — solo `arbitrated` (por-nodo, keys desnudas) + `node.zoneId`/`family` para ruteo visual.
- Las claves prefijadas (`wash-impact:dimmer`) existen solo en dos lugares invisibles para la UI: el record plano por-device (`NodeResolver.ts:1052-1054`) y el `inputMap` compilado (`compileForgeState.ts:276`).
- Inyectar prefijos en `channelKey` de los input nodes (i.e., regenerar el nodeGraph del paciente vía `compileForgeState`, o añadir fallback `${cellId}:${type}` en `_accumulateForgeNodeValues`) restauraría el aislamiento DMX **sin tocar una sola lectura del proyector**.

## Punto exacto de bifurcación

**`TickEngine.ts:1681` vs `:1691`** — mismo `arbitrated`, dos destinos. Todo lo sano que viste en pantalla existía realmente; todo lo negro que salió por DMX se destruyó dentro de `resolve()` → rama forge → merge+inputMap+ignition. El canvas no miente: miente la frontera entre "verdad arbitrada" y "verdad emitida" — hoy no existe ningún instrumento que compare ambas (el `TRACER-3` de `ForgeNodeEvaluator.ts:160-167` solo loggea fixture en baseAddr 0, cada 20 frames, y solo el primer byte).

Sin modificaciones — solo lectura, según orden estricta.