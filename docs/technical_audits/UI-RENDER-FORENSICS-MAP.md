# UI-RENDER-FORENSICS-MAP — WAVE 4558
## Auditoria Forense del Pipeline de Renderizado Visual

**Fecha:** 2026-05-05 | **Auditor:** PunkOpus / Cascade | **Rama:** v3

---

## VEREDICTO EJECUTIVO

El pipeline de renderizado 3D esta **BLINDADO EN EL HOT-PATH** (60fps, cero React overhead).
Pero hay un **agujero negro en la capa de adaptacion Aether**: el `AetherUIProjector` esta
construido, tiene logica valida para KINETIC... y nunca se instancia. El resto
del motor — transientStore, useFrame, zoom, pan/tilt suavizado — es solido.

**Riesgo si abres la Vista Espacial con fixtures Aether:**
- Fixtures Aether → siempre negros + pan/tilt congelados en el preview 3D
- Fixtures legacy → perfectos

---

## EJE 1 — EL ESPEJO (AetherUIProjector)

**Archivo:** `electron-app/src/core/aether/resolver/AetherUIProjector.ts`

### Lo que hace

Clase con un unico metodo publico: `project(fixtures: FixtureState[], graph: NodeGraph): void`

- Itera el array legacy `FixtureState[]`
- Para cada fixture, busca sus nodos en el `NodeGraph` de Aether
- Si encuentra nodos `KINETIC`, copia `pan`, `tilt`, `rotation` al objeto legacy en formato DMX (0-255)
- Mutacion in-place, cero allocations

### Estado de implementacion por familia

| Familia | Canales | Estado |
|---------|---------|--------|
| KINETIC | pan, tilt, rotation | Implementado — escritura in-place correcta |
| COLOR | r, g, b, w, amber | `default: break` — no proyecta nada |
| IMPACT | dimmer, strobe | `default: break` — no proyecta nada |
| BEAM | zoom, focus, gobo, prism, iris | `default: break` — no proyecta nada |

### BUG CRITICO 1 — DeviceId incorrecto (linea ~49)

```typescript
// Codigo actual (mal):
const deviceId = fixture.fixtureId ?? fixture.name

// Correcto (el NodeGraph indexa por fixture.id):
const deviceId = fixture.id
```

`fixture.fixtureId` puede ser `undefined` en hot-frames (no esta en el contrato).
El `NodeGraph` indexa exclusivamente por `DeviceId = fixture.id` (UUID).
Resultado: `graph.getDeviceNodes(deviceId)` siempre devuelve `[]` → proyeccion nula total.

### BUG CRITICO 2 — Projector nunca instanciado

Grep de `AetherUIProjector` en `TitanOrchestrator.ts`: **cero menciones**.

El pipeline post-HAL actual es:

```
hal.renderFromTarget()  →  fixtureStates
    → Hephaestus merge (in-place)
    → Peak Hold acumulacion
    → HOT FRAME broadcast  ← la UI lee aqui
    → FULL TRUTH broadcast
    → flushToDriver() (Aduana + DMX)
```

No hay punto de inyeccion Aether. Los fixtures Aether llegan al frontend
con los valores del pipeline legacy (o ceros si el legacy no los conoce).

---

## EJE 2 — EL PUENTE AL RENDERER (IPC / Throttling)

### Arquitectura de frecuencias

```
TitanOrchestrator.processFrame()
    FrameScheduler @ 44Hz (setInterval 23ms + Stampede Guard)
        │
        ├─ HOT FRAME cada 2 ticks = 22Hz
        │      fixtureStates dinamicos: dimmer, rgb, pan, tilt, zoom,
        │      physicalPan, physicalTilt, beat, audio bands
        │      Tamanio estimado: ~8-12 KB con 50 fixtures
        │
        └─ FULL TRUTH cada 6 ticks = ~7Hz
               SeleneTruth completo (fixtures + context + vibe + effects + audio)
```

### Mecanismo de transferencia

Sin SharedArrayBuffer, sin Transferables. Electron IPC via `webContents.send()` con
**Structured Clone** — clon completo en cada broadcast.

**Cuantificacion:**
- 22 hot-frames/seg × ~10 KB = ~220 KB/seg de Structured Clone
- WAVE 3050 baja de 44Hz a 22Hz → ahorro del 50%
- Sin delta-encoding: valores completos cada vez

### Camino completo del hot-frame

```
[Main Process]
TitanOrchestrator.onHotFrame(hotFrame)
    → main.ts: mainWindow.webContents.send('selene:hot-frame', hotFrame)

[Structured Clone — cruza el proceso boundary]

[Renderer Process]
preload.ts: window.lux.onHotFrame(callback)  →  IPC bridge
    → useSeleneTruth.ts:
          window.lux.onHotFrame((frame) => {
              injectHotFrame(frame)  // transientStore mutable ref — ZERO React
          })
          // Full truth via 'selene:truth' @ 7Hz → setTruth() → Zustand
```

### Frecuencias por store

| Store | Escritura | Mecanismo | Overhead React |
|-------|-----------|-----------|----------------|
| transientStore | 22Hz | Mutacion in-place | CERO |
| truthStore (Zustand) | ~3-4Hz | setState() via throttle | Moderado |
| audioStore (Zustand) | ~3-4Hz | Selector-based | Bajo |

---

## EJE 3 — CONSUMO EN EL VISOR 3D

### transientStore — El corazon del hot-path

**Archivo:** `electron-app/src/stores/transientStore.ts`

```typescript
// Mutable module-level ref — sin Proxy, sin Zustand
let fixtureIndex: Map<string, any> = new Map()  // O(1) lookup por ID

function injectHotFrame(frame): void {
    for (let i = 0; i < frame.fixtures.length; i++) {
        const existing = fixtureIndex.get(frame.fixtures[i].id)
        if (existing) {
            existing.dimmer = frame.fixtures[i].dimmer
            existing.pan    = frame.fixtures[i].pan
            // ... patch in-place SOLO campos dinamicos
            // NUNCA toca: id, name, type, zone, dmxAddress
        }
    }
}

function injectTransientTruth(truth): void {
    fixtureIndex.clear()
    truth.fixtures.forEach(f => { if (f?.id) fixtureIndex.set(f.id, f) })
    vibeGeneration++  // contador monotono para deteccion de vibe change
}
```

`getTransientFixture(id)` → O(1). Unico punto de contacto entre backend y R3F loop.

### HyperionMovingHead3D — El renderizador atomico

**Archivo:** `electron-app/src/components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D.tsx`

#### Patron de renderizado (safe path)

```typescript
// Refs pre-allocados en mount — jamas se recalculan
const smoothPan  = useRef<number | null>(null)
const smoothTilt = useRef<number | null>(null)
const smoothZoom = useRef<number | null>(null)
const liveColor  = useRef(new THREE.Color())
const yokeQuat   = useRef(new THREE.Quaternion())
const headQuat   = useRef(new THREE.Quaternion())

useFrame(() => {
    // Lectura directa del mutable ref — zero React, zero Zustand, zero proxy
    const fixtureState = getTransientFixture(fixtureId)

    // VIBE SNAP: cambio de vibe → posicion instantanea sin lerp (WAVE 3260)
    if (getVibeGeneration() !== localVibeGen.current) {
        smoothPan.current = null
    }

    // ANTI-ZOMBIE: sin estado → apagar luz (WAVE 3260)
    if (!fixtureState) {
        beamMeshRef.current.visible = false
        return
    }

    // EMA smoothing sobre valores normalizados
    const VISUAL_SMOOTH = 0.35
    const ZOOM_SMOOTH   = 0.15
    smoothPan.current  += (livePan  - smoothPan.current)  * VISUAL_SMOOTH
    smoothTilt.current += (liveTilt - smoothTilt.current) * VISUAL_SMOOTH
    smoothZoom.current += (liveZoom - smoothZoom.current) * ZOOM_SMOOTH

    // Conversion a radianes → quaternion → mutacion directa del Object3D
    yokeRef.current.quaternion.copy(
        yokeQuat.current.setFromAxisAngle(PAN_AXIS, (smoothPan.current - 0.5) * PAN_RANGE)
    )
    headRef.current.quaternion.copy(
        headQuat.current.setFromAxisAngle(TILT_AXIS, -(smoothTilt.current - 0.5) * TILT_RANGE + TILT_REST_ANGLE)
    )

    // HDR bloom: color * (1 + dimmer * 2) → luminance > 1 → bloom
    lensMaterialRef.current.color.copy(liveColor.current)
    beamMaterialRef.current.color.copy(liveColor.current)
})
```

React no re-renderiza en ningun frame de ese loop. Correcto.

#### Nota sobre ConeGeometry

La geometria del beam es `args={[1.0, 3.5, 16, 1, true]}` en JSX — estatica.
No se reconstruye en `useFrame`. El zoom controla escala/opacidad via ref,
no via `new THREE.ConeGeometry()` en runtime. 

#### Canales proyectados en el visor

| Canal | Fuente | En useFrame | Estado |
|-------|--------|-------------|--------|
| pan / physicalPan | transientStore | Si — quaternion yoke | Implementado |
| tilt / physicalTilt | transientStore | Si — quaternion head | Implementado |
| zoom (0-255 DMX) | transientStore.zoom | Si — zoom/255 | Implementado |
| dimmer | transientStore.dimmer | Si — HDR bloom scalar | Implementado |
| color (r,g,b) | transientStore.color | Si — liveColor | Implementado |
| focus | transientStore.focus | No | Pendiente |
| gobo | transientStore.gobo | No | Pendiente |
| prism | transientStore.prism | No | Pendiente |
| iris | transientStore.iris | No | Pendiente |

---

## MAPA DE RIESGOS

| Severidad | Riesgo | Ubicacion |
|-----------|--------|-----------|
| CRITICA | AetherUIProjector nunca instanciado | TitanOrchestrator.ts — ausencia total |
| ALTA | DeviceId mismatch: `fixtureId ?? name` en lugar de `fixture.id` | AetherUIProjector.ts ~L49 |
| MEDIA | COLOR / IMPACT / BEAM = `break` vacio | AetherUIProjector.ts |
| BAJA | Hot-frame sin delta encoding (~220 KB/s) | TitanOrchestrator broadcast path |
| BAJA | fixtureIndex rebuild O(N) a 7Hz | transientStore.ts `injectTransientTruth` |

---

## REMEDIATION — 5 FIXES

### Fix 1 — DeviceId correcto (1 linea)

```typescript
// AetherUIProjector.ts ~L49
// Antes:
const deviceId = fixture.fixtureId ?? fixture.name
// Despues:
const deviceId = fixture.id
```

### Fix 2 — Instanciar y llamar el projector en processFrame()

En `TitanOrchestrator.ts`, campo de clase:

```typescript
private readonly _aetherUIProjector = new AetherUIProjector()
```

En `processFrame()`, despues del bloque Hephaestus y antes del HOT FRAME broadcast:

```typescript
if (this._aetherHasDevices && this._aetherResolver) {
    this._aetherUIProjector.project(fixtureStates, this._aetherGraph)
}
```

### Fix 3 — Implementar COLOR en AetherUIProjector

```typescript
case NodeFamily.COLOR: {
    const cn = node as IColorNodeData
    const { r, g, b } = cn.currentColor
    fixture.r = toDmx(r)
    fixture.g = toDmx(g)
    fixture.b = toDmx(b)
    if (cn.hasWhite) fixture.white = toDmx(cn.currentColor.w ?? 0)
    if (cn.hasAmber) fixture.amber = toDmx(cn.currentColor.amber ?? 0)
    break
}
```

### Fix 4 — Implementar IMPACT en AetherUIProjector

```typescript
case NodeFamily.IMPACT: {
    const imp = node as IImpactNodeData
    fixture.dimmer = toDmx(imp.intensity)
    if (imp.strobeRate > 0) fixture.strobe = toDmx(imp.strobeRate)
    break
}
```

### Fix 5 — Implementar BEAM en AetherUIProjector

```typescript
case NodeFamily.BEAM: {
    const bn = node as IBeamNodeData
    if (bn.zoom  !== undefined) fixture.zoom  = toDmx(bn.zoom)
    if (bn.focus !== undefined) fixture.focus = toDmx(bn.focus)
    if (bn.gobo  !== undefined) fixture.gobo  = toDmx(bn.gobo)
    if (bn.prism !== undefined) fixture.prism = toDmx(bn.prism)
    if (bn.iris  !== undefined) (fixture as any).iris = toDmx(bn.iris)
    break
}
```

---

## CONCLUSION

**El motor de renderizado 3D es un BUNKER:**
- `useFrame` + `getTransientFixture` + mutacion de refs = patron correcto
- Cero re-renders React en el hot-path de 60fps
- EMA smoothing sobre valores normalizados antes de la conversion a quaternion
- Anti-zombie y vibe-snap implementados
- zoom / color / pan / tilt del pipeline legacy funcionan perfectamente

**El puente Aether → UI es una BOMBA:**
- `AetherUIProjector` = pieza construida, nunca montada en el Orchestrator
- El bug del DeviceId garantiza fallo silencioso incluso si se monta
- COLOR / IMPACT / BEAM = `break` sin logica

La Vista Espacial funciona al 100% para fixtures legacy.
Para Aether: aplicar los 5 fixes antes de abrir el Spatial Radar.
