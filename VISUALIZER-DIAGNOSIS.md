# VISUALIZER-DIAGNOSIS.md
## ⚡ WAVE 4572 — FORENSICS REPORT: BEAM FAILURE + SPATIAL BLINDNESS

> *"Los haces no se apagan. El frontend deja de creer en ellos."*

**Date:** 2026-05-06
**Author:** Cascade (Sonnet) — Read-Only Forensic Audit
**Status:** DIAGNÓSTICO CRUDO — Sin alteración de código
**Scope:** Hyperion 3D Visualizer (R3F) + Tactical 2D Canvas — Beam Rendering + Spatial Alignment

---

## EXECUTIVE SUMMARY

Two independent pathologies:

| Frente | Síntoma | Severidad | Tipo de fix |
|---|---|---|---|
| **F1: Beam Failure** | Conos volumétricos invisibles en 3D | 🔴 CRÍTICA | Probablemente parcheable |
| **F2: Spatial Blindness** | Fixtures renderizan en posiciones ficticias; beams no apuntan al target real | 🔴 CRÍTICA | Requiere rediseño arquitectónico |

**Veredicto:** F1 puede parchearse. F2 es una falla de diseño fundamental que requiere un `SpatialVisualizer` o un passthrough de `Position3D` real a ambos visores. No es un bug puntual.

---

## 🔍 FRENTE 1: EL MISTERIO DEL BEAM DESAPARECIDO

### 1.1 Cadena de Control de Opacidad

El beam volumétrico (cone geometry) es controlado por UNA sola variable de opacidad:

```
TitanOrchestrator.ts:1614
    dimmer: f.dimmer / 255,          // ← NORMALIZADO 0-1

  ↓ IPC 44Hz

transientStore.ts:injectHotFrame()
    mutable.dimmer = hot.dimmer        // ← 0-1 (correcto)

  ↓ getTransientFixture(fixtureId)

HyperionMovingHead3D.tsx:206
    const liveIntensity = fixtureState.dimmer ?? 0

  ↓ useFrame

HyperionMovingHead3D.tsx:275
    beamMaterialRef.current.opacity = liveIntensity * 0.4
```

**Análisis:** La opacidad resultante es `0-0.4` para dimmer normalizado. Con `AdditiveBlending` + fondo `#050508`, un cone transparente a `opacity=0.4` DEBE ser visible. La matemática de opacidad es correcta.

### 1.2 Causas Raíz Identificadas

#### Hipótesis A: ANTI-ZOMBIE = SUICIDIO SILENCIOSO (Probabilidad: ALTA)

```typescript
// HyperionMovingHead3D.tsx:198-202
if (!fixtureState) {
  if (beamMeshRef.current) beamMeshRef.current.visible = false
  if (lensMaterialRef.current) lensMaterialRef.current.color.setScalar(0)
  return
}
```

Si `getTransientFixture(fixtureId)` devuelve `null`, el beam se oculta **permanentemente** hasta que llegue un frame válido.

**El índice `fixtureIndex` en `transientStore.ts` se reconstruye SOLO en `injectTransientTruth` (~7Hz), NO en `injectHotFrame` (44Hz).**

```typescript
// transientStore.ts:85-92
const fixtures = truth?.hardware?.fixtures
if (fixtures) {
  fixtureIndex.clear()
  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i]
    if (f?.id) fixtureIndex.set(f.id, f)
  }
}
```

**Escenario de fallo:**
1. App arranca → `fixtureIndex` está vacío
2. KineticsCathedral envía spatial target → no hay beams porque `getTransientFixture` devuelve null
3. Pasa ~143ms → llega full truth → `fixtureIndex` se pobla
4. **PERO** si el `id` del fixture en `stageStore` NO coincide con el `id` del fixture en `truth.hardware.fixtures`, el índice nunca matchea

**Evidencia de riesgo de ID mismatch:**
- `useFixture3DData.ts` usa `fixture.id` de `stageStore.fixtures`
- `TitanOrchestrator.ts` hot frame usa `originalFixture?.id || 'fix_${i}'`
- El full truth (`injectTransientTruth`) viene de un broadcast de SeleneTruth que mapea HAL fixture states a protocol fixtures
- **NO se encontró garantía de que los IDs sean idénticos entre los dos universos de datos**

#### Hipótesis B: ZOOM = INVISIBILIDAD (Probabilidad: MEDIA)

```typescript
// HyperionMovingHead3D.tsx:287-290
const targetRadius = BEAM_RADIUS_MIN + (smoothZoom.current ?? 0.5) * (BEAM_RADIUS_MAX - BEAM_RADIUS_MIN)
beamMeshRef.current.scale.x = targetRadius
beamMeshRef.current.scale.z = targetRadius
```

Base geometry: `coneGeometry args={[1.0, 3.5, 16, 1, true]}` → radio 1.0, altura 3.5.

| Zoom DMX | Zoom normalizado | targetRadius | Escala X/Z | Diámetro visual |
|---|---|---|---|---|
| 0 (beam) | 0.0 | 0.03 | 0.03 | 0.06 unidades |
| 127 | 0.5 | 0.24 | 0.24 | 0.48 unidades |
| 255 (wash) | 1.0 | 0.45 | 0.45 | 0.90 unidades |

Unidad de escena = metro. Un diámetro de 6cm a zoom beam es una aguja de 3.5m de largo.

**Sin post-processing bloom (LQ mode):** el cone es un `MeshBasicMaterial` transparente con `AdditiveBlending`. Una aguja de 6cm de grosor y 3.5m de largo, a `opacity=0.2` (dimmer=50%), sobre fondo `#050508`, es **prácticamente invisible** a distancia de cámara (~10m).

**Con post-processing bloom (HQ mode):** la aguja emite color * 2.5 HDR. Si `luminanceThreshold=0.9`, el bloom la hace visible como un rayo. **Pero** si el material no supera el threshold por algún motivo (color oscuro, dimmer bajo), el bloom no la resucita.

#### Hipótesis C: CLIPPING PLANE CERCENADOR (Probabilidad: MEDIA-BAJA)

```typescript
// VisualizerCanvas.tsx:180-182
const clippingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
gl.clippingPlanes = [clippingPlane]
gl.localClippingEnabled = true
```

Corta TODO renderizado por debajo de Y=0.

Para un floor fixture (ZONE_LAYOUT_3D['floor'].heightFactor=0.05 → y=0.25m):
- Beam tip Y = 0.25 - 1.75 - 0.12 = **-1.62m** → **CORTADO**
- Todos los beams de fixtures de piso son amputados por el clipping plane

Para un truss fixture (y≈3.5m):
- Beam tip Y ≈ 1.63m → **SALVADO**

**Veredicto:** Afecta solo floor fixtures. No explica la desaparición generalizada.

#### Hipótesis D: RACE CONDITION EN INICIO (Probabilidad: BAJA)

El componente `HyperionMovingHead3D` monta con `beamMaterialRef.current.opacity = 0.0` (linea 360). El primer `useFrame` que recibe `fixtureState` activa el beam. Si transientStore está vacío durante los primeros 200ms, el usuario ve "no hay beams" y lo reporta como bug.

### 1.3 Resumen Diagnóstico F1

| # | Causa raíz más probable | Severidad | Fix recomendado |
|---|---|---|---|
| 1 | **ID mismatch** entre `stageStore.fixtures` y `truth.hardware.fixtures` → `getTransientFixture` devuelve null permanentemente | 🔴 | Auditar la cadena de IDs. Loggear `fixtureIndex.size` y `getTransientFixture` misses en dev. |
| 2 | **Beam LQ invisible** — cone radius 0.03 + opacity 0.2 + sin bloom = aguja fantasma | 🟡 | Aumentar `BEAM_RADIUS_MIN` en LQ o usar `Line` geometry en vez de cone. |
| 3 | **Clipping plane** mata beams de floor fixtures | 🟡 | Desactivar clipping para beam meshes o elevar floor fixture Y. |
| 4 | **Anti-zombie demasiado agresivo** — oculta beam en transientStore vacío | 🟡 | Fallback a prop `intensity` del hook si transientStore está vacío. |

---

## 🔍 FRENTE 2: LA CONCIENCIA ESPACIAL (IK vs 3D Math)

### 2.1 La Gran Mentira: Posiciones Auto-Generadas

**Evidencia contundente — `useFixture3DData.ts` (líneas 148-168):**

```typescript
// useFixture3DData.ts — Hook que alimenta VisualizerCanvas
zoneFixtures.forEach((fixture, index) => {
  let x: number, y: number, z: number

  if (layout.vertical && layout.fixedX !== undefined) {
    x = layout.fixedX * halfWidth
    y = distributeInRange(index, total, trussHeight * 0.5, trussHeight * 0.9)
    z = layout.depthFactor * halfDepth
  } else {
    x = distributeInRange(index, total, layout.xRange[0] * halfWidth, layout.xRange[1] * halfWidth)
    y = layout.heightFactor * trussHeight
    z = layout.depthFactor * halfDepth
  }
  // ...
  result.push({ id: fixture.id, x, y, z, ... })
})
```

**`fixture.position` (Position3D real del ShowFile) NUNCA se lee. NUNCA. Se tira a la basura.**

Las posiciones 3D se computan desde `ZONE_LAYOUT_3D`, un diccionario hardcodeado:

| Zona | heightFactor | depthFactor | xRange | Posición generada (stage 12×8×5) |
|---|---|---|---|---|
| front | 0.30 | +0.80 | [-0.70, 0.70] | y=1.5m, z=+3.2m, x spread |
| back | 0.85 | -0.60 | [-0.60, 0.60] | y=4.25m, z=-2.4m, x spread |
| floor | 0.05 | +0.60 | [-0.65, 0.65] | y=0.25m, z=+2.4m, x spread |
| movers-left | 0.70 | 0.00 | fixed -0.85 | y spread 2.5-4.5m, z=0, x=-5.1m |
| movers-right | 0.70 | 0.00 | fixed +0.85 | y spread 2.5-4.5m, z=0, x=+5.1m |

**Esto significa:** Si el usuario coloca un moving head en `Position3D {x: 2, y: 4, z: -1}` (front truss, derecha, 4m de altura), el 3D visualizer lo dibuja en `x: [-5.1], y: [2.5-4.5], z: 0` (movers-left o right, según su zone). La posición real del stage builder es IGNORADA.

### 2.2 El 2D Canvas: Misma Enfermedad

**`useFixtureData.ts` (líneas 218-245):**

```typescript
byZone.forEach((indices, zone) => {
  const layout = ZONE_LAYOUT_2D[zone]
  indices.forEach((globalIdx, localIdx) => {
    const fixture = classified[globalIdx]
    if (isVertical && layout.fixedX !== undefined) {
      fixture.x = layout.fixedX
      fixture.y = distributeVertically(localIdx, count, layout.y)
    } else {
      const [xMin, xMax] = layout.xRange
      fixture.x = distributeInRange(localIdx, count, xMin, xMax)
      fixture.y = layout.y
      if (fixture.type === 'moving') fixture.y -= 0.06
      else if (fixture.type === 'par') fixture.y += 0.06
    }
  })
})
```

El 2D TacticalCanvas posiciona fixtures en el canvas usando `ZONE_LAYOUT_2D`, NO `fixture.position`. Un fixture en (x=2, z=-1) del stage real se dibuja en el canvas en una posición que depende únicamente de su `zone` e índice dentro de la zona.

### 2.3 Aether IK: Usa Posiciones Reales

**`InverseKinematicsEngine.ts` (líneas 14-18):**

```typescript
// ── SISTEMA DE COORDENADAS (ShowFileV2) ──
// • X: Left(-) ← → Right(+)  desde perspectiva de audiencia
// • Y: Down(-)  ↕  Up(+)      0 = suelo
// • Z: Back(-)  ↔  Front(+)   0 = centro escenario
// • Unidad: metros
```

**`SpatialRegistrar.ts` (líneas 437-446):**

```typescript
const center: Position3D = {
  x: stagePosition.x,  // Ancho (izquierda/derecha)
  y: stagePosition.y,  // Altura (piso/techo)
  z: stagePosition.z,  // Profundidad (upstage/downstage)
}
```

**`SpatialRegistrar.ts` enriquece los nodos Aether con `Position3D` REAL del fixture.** El NodeGraph de Aether sabe dónde está físicamente cada fixture.

**`InverseKinematicsEngine.ts` usa `IKFixtureProfile.position` (Position3D real) para resolver:**

```typescript
export interface IKFixtureProfile {
  id: string
  position: Position3D        // ← REAL
  orientation: FixtureOrientation  // ← REAL
  limits: MechanicalLimits
  calibration: FixtureCalibration
}
```

### 2.4 La Brecha: Visualizador vs Aether

| Aspecto | Aether (IK Engine) | 3D Visualizer (R3F) | 2D Canvas |
|---|---|---|---|
| Posición del fixture | `Position3D` real del stage | `ZONE_LAYOUT_3D` auto-generada | `ZONE_LAYOUT_2D` auto-generada |
| Orientación de montaje | `InstallationOrientation` + `Rotation3D` | Hardcodeado: truss genérico | N/A (icono 2D) |
| Cálculo de beam | Vector desde posición real hacia target real | Quaternion desde DMX pan/tilt | Triángulo desde DMX pan/tilt |
| Beam apunta a target | ✅ SÍ (vector real) | ❌ NO (ignora target) | ❌ NO (ignora target) |

**Consecuencia:** Cuando el operador usa SpatialTargetPad para apuntar al target (x=3, y=2, z=4), Aether calcula:
- Fixture A en (2, 4, -1): "Necesitas pan=0.7, tilt=0.3 para apuntar al target"
- Fixture B en (-3, 3, 2): "Necesitas pan=0.2, tilt=0.5 para apuntar al target"

Pero el 3D visualizer dibuja:
- Fixture A en posición ficticia (-5.1, 3.5, 0) — lejos de su posición real
- Fixture B en posición ficticia (+5.1, 3.0, 0) — lejos de su posición real

El beam del fixture A apunta en la dirección pan=0.7, tilt=0.3 desde su posición FICTICIA. **El operador ve el beam apuntando al vacío, no al target.**

### 2.5 Desalineación de Ejes (Quaternion vs IK)

**3D Visualizer — Quaternion Math:**

```typescript
// HyperionMovingHead3D.tsx:45-46, 102-104
const PAN_RANGE = Math.PI * 1.5    // ±135°
const TILT_RANGE = Math.PI * 0.75  // ±67.5°
const PAN_AXIS = new THREE.Vector3(0, 1, 0)   // Y-axis
const TILT_AXIS = new THREE.Vector3(1, 0, 0)  // X-axis

// Tilt math:
const tiltAngle = -(smoothTilt.current! - 0.5) * TILT_RANGE + TILT_REST_ANGLE
// TILT_REST_ANGLE = Math.PI * 0.25 = +45°
```

**Análisis del eje tilt:**

En Three.js, rotación positiva alrededor de X (regla de la mano derecha) rota +Y hacia +Z.
- `tiltAngle = +45°` → beam rota desde -Y (abajo) hacia -Z (atrás del escenario)
- `tiltAngle = -5.6°` (tilt DMX=1.0) → beam casi vertical, ligeramente hacia -Z

**PERO en el sistema de coordenadas del stage:**
- +Z es FRONT (audiencia)
- -Z es BACK (upstage)

**El `TILT_REST_ANGLE = +45°` hace que el beam apunte hacia -Z (BACK) en vez de +Z (FRONT/AUDIENCE).** Para que un truss-mounted fixture apunte hacia la audiencia (+Z), necesitaría `TILT_REST_ANGLE = -45°` (o invertir la convención de signo).

**El comment dice:** "Real moving heads mounted on truss naturally point ~45° forward into the audience/stage." Pero la matemática hace que apunten hacia el **back** del escenario.

**Esto es un bug de signo/inversión de eje Z en el quaternion del tilt.**

### 2.6 Orientación de Montaje Ignorada

**Aether soporta:**
```typescript
export type InstallationOrientation = 
  | 'ceiling' 
  | 'floor' 
  | 'wall-left' 
  | 'wall-right' 
  | 'truss-front'
  | 'truss-back'
```

**3D Visualizer:**
```typescript
// NINGUNA referencia a InstallationOrientation o Rotation3D
// Todos los fixtures se renderizan con la misma base + yoke + head
// La orientación se aplica como quaternion PAN/Y + TILT/X genérico
```

**Consecuencia:** Un fixture montado en piso (`'floor'`) con `Rotation3D {pitch: 0, yaw: 0, roll: 0}` se dibuja en 3D como si estuviera colgado de un truss, apuntando hacia abajo. Aether lo trata como un uplight. El visualizer lo trata como un downlight.

### 2.7 Inconsistencia con SpatialTargetPad

**`KinRadarViewport.tsx` (líneas 63-78):**

```typescript
const fixtureGhosts = useMemo((): RadarFixtureGhost[] => {
  return selectedIds.flatMap(id => {
    const sf = stageFixtures.find(f => f.id === id)
    return [{
      id: sf.id,
      position: (sf as any).position,   // ← USA POSICIÓN REAL
      fixtureType: isMoving ? 'moving' : 'static',
    }]
  })
}, [selectedIds, stageFixtures, radarMode])
```

**El SpatialTargetPad (Cathedral sidebar / KinRadarViewport) SÍ lee `fixture.position` real.** Dibuja los ghosts de fixtures en sus posiciones reales del stage.

**Esto crea una experiencia fracturada:**
- En SpatialTargetPad: fixture A está en (2, 4, -1) — correcto
- En VisualizerCanvas 3D: fixture A está en (-5.1, 3.5, 0) — ficticio
- El operador no entiende por qué el beam "apunta al vacío" en 3D cuando en el radar espacial parece correcto.

### 2.8 Resumen Diagnóstico F2

| # | Disfunción | Impacto | Fix |
|---|---|---|---|
| 1 | **Posiciones ficticias** — `useFixture3DData` y `useFixtureData` ignoran `Position3D` real | 🔴 CRÍTICO | Rehacer hooks para leer `fixture.position` con fallback a zone layout |
| 2 | **Orientación ignorada** — `InstallationOrientation` y `Rotation3D` no afectan el quaternion 3D | 🔴 CRÍTICO | Pasar orientación al componente 3D; aplicar pre-rotación antes de pan/tilt |
| 3 | **Signo tilt invertido** — `TILT_REST_ANGLE = +45°` apunta a -Z en vez de +Z | 🟠 ALTO | Cambiar a `-45°` o mapear eje Z según convención de stage |
| 4 | **2D beam ciego** — `FixtureLayer.drawBeam` usa solo pan/tilt DMX, no posición real | 🟡 MEDIO | Requiere proyección 3D→2D o un modo "spatial ray" para 2D |
| 5 | **Inconsistencia UI** — SpatialTargetPad usa posición real, 3D usa ficticia | 🟡 MEDIO | Unificar datasource: siempre `Position3D` real |

---

## RECOMENDACIONES ARQUITECTÓNICAS

### Opción A: Parche Mínimo (F1 only, F2 parcial)

**Scope:** 1-2 días. No rediseña posiciones.

1. **F1 — Beam visibility:**
   - En `HyperionMovingHead3D`, loggear `fixtureId` + `getTransientFixture(fixtureId)` miss rate
   - Si transientStore está vacío, usar `fixture.intensity` del prop como fallback para beam opacity
   - Aumentar `BEAM_RADIUS_MIN` de 0.03 a 0.08 en LQ mode (o detectar LQ y usar `Line` en vez de cone)
   - Bypass clipping plane para beam meshes (set `material.clippingPlanes = []` en el beam mesh)

2. **F2 — Tilt sign fix:**
   - Cambiar `TILT_REST_ANGLE = -Math.PI * 0.25` para apuntar a +Z (audiencia)
   - Verificar con fixture en 'back' zone que apunta "forward"

3. **F2 — Posición real (parcial):**
   - Modificar `useFixture3DData` para leer `fixture.position` cuando exista, fallback a zone layout
   - Esto alinea el 3D visualizer con SpatialTargetPad

### Opción B: Spatial Visualizer V2 (Rediseño)

**Scope:** 1-2 semanas. Requiere blueprint.

**Nuevos componentes:**
- `SpatialFixture3D`: lee `Position3D` + `Rotation3D` + `InstallationOrientation`, construye quaternion base correcto
- `SpatialBeam3D`: rayo desde `Position3D` real hacia target 3D real (no cone desde posición ficticia)
- `SpatialFixture2D`: proyección ortográfica o perspectiva de posiciones reales al canvas 2D
- Unificar `useFixture3DData` + `useFixtureData` en un solo hook que siempre use `Position3D` real

**Eliminar:**
- `ZONE_LAYOUT_3D` como fuente primaria de posición (mantener como fallback para fixtures sin `Position3D`)
- `ZONE_LAYOUT_2D` como fuente primaria (mantener como fallback)

### Opción C: Hybrid (Recomendada)

**Scope:** 3-4 días.

1. **Phase 1 (parche F1):** Beam visibility fixes — Opción A pasos 1-2
2. **Phase 2 (parche F2 posiciones):** `useFixture3DData` y `useFixtureData` usan `fixture.position` real con fallback zone
3. **Phase 3 (F2 orientación):** Añadir `InstallationOrientation` y `Rotation3D` al quaternion base del 3D
4. **Phase 4 (F2 spatial awareness):** 2D canvas beam opcionalmente muestra "spatial ray" (línea desde fixture real a target real) en modo spatial

---

## ANEXO: MAPA DE ARCHIVOS RELEVANTES

| Archivo | Rol | Líneas críticas |
|---|---|---|
| `HyperionMovingHead3D.tsx` | Beam geometry + quaternion | 121-290 (useFrame), 353-365 (beam mesh JSX) |
| `transientStore.ts` | Bypass mutable para 60fps | 37-93 (fixtureIndex build), 110-198 (hotFrame patch) |
| `TitanOrchestrator.ts` | Hot frame format | 1585-1632 (hot frame builder) |
| `useFixture3DData.ts` | Posiciones 3D ficticias | 140-240 (position calculation loop) |
| `useFixtureData.ts` | Posiciones 2D ficticias | 136-248 (position calculation loop) |
| `ZoneLayoutEngine.ts` | Diccionario de layouts | 160-219 (ZONE_LAYOUT_3D), 73-135 (ZONE_LAYOUT_2D) |
| `VisualizerCanvas.tsx` | Clipping plane + showBeams | 175-191 (ClippingPlaneSetup), 347-352 (props) |
| `InverseKinematicsEngine.ts` | Sistema de coordenadas real | 1-84 (types + coord system) |
| `SpatialRegistrar.ts` | Aether enriquece Position3D real | 225-277 (enrich + update position) |
| `ShowFileV2.ts` | Position3D + Rotation3D + InstallationOrientation | 240-253 (interfaces), 655-660 (FixtureV2) |
| `KinRadarViewport.tsx` | SpatialTargetPad SÍ usa posición real | 63-78 (fixtureGhosts con `(sf as any).position`) |

---

## CIERRE

> *"El visualizador no es un espejo del backend. Es un diorama de fantasía que vive en un escenario paralelo. Aether calcula en el mundo real; el frontend pinta en un mundo de juguetes."*

**F1:** Parcheable. Probablemente ID mismatch + LQ beam invisibilidad.

**F2:** Requiere decisión estratégica. El frontend está diseñado alrededor de `ZONE_LAYOUT_*` porque eso es lo que StageSimulator2 necesitaba. Con Aether operativo y el StageBuilder persistiendo `Position3D`, los layouts por zona son deuda técnica obsoleta. Recomendación: **Opción C (Hybrid)** para resolver F1 rápido y empezar a desmantelar la ceguera espacial.

---
*End of Forensic Report — WAVE 4572*
*Strictly read-only. Zero code modified.*
