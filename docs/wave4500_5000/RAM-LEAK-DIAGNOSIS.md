# DIAGNÓSTICO: Fuga de RAM en Vista 3D de Hyperion

> **Date:** 2026-05-08  
> **Branch:** v3  
> **Estado:** Pendiente de fix — archivado para después  

---

## Síntoma

La vista 3D de Hyperion satura la RAM en ~2 minutos de visualización activa y en ocasiones crashea Electron por OOM.

---

## Vectores de fuga identificados

### VECTOR 1 — 🟢 BAJA: `physicsStore` globals en el worker

**Archivo:** `electron-app/src/workers/hyperion-render.worker.ts` (línea ~103)

El worker mantiene `physicsStore` y `prevIntensity` como Maps globales del thread. La limpieza existe (en el handler de `SCAFFOLD` elimina IDs que ya no están). `fpsHistory` hace push+shift correctamente (max 30 entries). No hay fuga masiva aquí.

**Severidad: BAJA**

---

### VECTOR 2 — 🟡 MEDIA: `new THREE.Color()` en `useMemo` sin disposal

**Archivo:** `electron-app/src/components/hyperion/views/visualizer/useFixture3DData.ts` (línea ~229)

```ts
const color = new THREE.Color(r / 255, g / 255, b / 255)
```

Este `useMemo` recalcula cuando cambia cualquiera de: `fixtures`, `fixturesByZone`, `selectedIds`, `overrides`, `halfWidth`, `halfDepth`, `trussHeight`. Cada recalculo crea **N objetos `THREE.Color` nuevos** (uno por fixture). Los anteriores no tienen cleanup. Con 100 fixtures y cambios frecuentes de `selectedIds` → presión GC sostenida.

**Fix:** Reutilizar un pool de `THREE.Color` o no crear el objeto en el `useMemo` (los fixtures 3D ya leen color directamente del `transientStore` en `useFrame`).

**Severidad: MEDIA**

---

### VECTOR 3 — 🔴 ALTA: Geometría + Material Three.js sin `.dispose()` en `NeonFloor`

**Archivo:** `electron-app/src/components/hyperion/views/visualizer/environment/NeonFloor.tsx` (líneas 56 y 93)

```ts
const gridGeometry = useMemo(() => {
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  return geometry
}, [width, depth])  // ← recalcula si el stage cambia

const gridMaterial = useMemo(() => {
  return new THREE.LineBasicMaterial({ color: primaryColor, ... })
}, [primaryColor])  // ← recalcula si cambia el color
```

`THREE.BufferGeometry` y `THREE.LineBasicMaterial` son **objetos GPU** — suben datos a VRAM. Cuando `useMemo` descarta el valor anterior, la geometría/material anterior **nunca se llama `.dispose()`**. La referencia GPU queda zombi en VRAM indefinidamente (el GC interno de Three.js no la recupera mientras el renderer viva).

**Fix:**
```ts
const gridGeometry = useMemo(() => {
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  return geometry
}, [width, depth])

useEffect(() => {
  return () => { gridGeometry.dispose() }
}, [gridGeometry])

// Mismo patrón para gridMaterial
```

**Severidad: ALTA — Fuga de VRAM confirmada**

---

### VECTOR 4 — 🔴 ALTA (ASESINO PRINCIPAL): `getState()` a 60fps × N fixtures en `useFrame`

**Archivo:** `electron-app/src/components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D.tsx` (línea ~272)

```ts
useFrame(() => {
  // Se ejecuta 60fps × N_fixtures veces por segundo
  const movementState = useMovementStore.getState()
  if (movementState.manualOverrideFixtureIds.has(fixtureId)) {
    const ov = useProgrammerStore.getState().fixtureOverrides.get(fixtureId)
    // ...
  }
})
```

Con 50 fixtures → **3.000 `getState()` por segundo**. Cada snapshot incluye el estado completo del store. Si `fixtureOverrides` crece (historial de overrides), cada snapshot pesa más. Presión GC masiva sostenida a 60fps.

**Fix:** Suscribirse fuera del `useFrame` con un ref, o pasar el dato como prop ya resuelto desde el componente padre.

```ts
// Fuera del useFrame, al nivel del componente:
const isManualOverride = useRef(false)
useEffect(() => {
  return useMovementStore.subscribe(
    state => state.manualOverrideFixtureIds.has(fixtureId),
    (val) => { isManualOverride.current = val }
  )
}, [fixtureId])

// Dentro del useFrame — solo accede a un boolean:
useFrame(() => {
  if (isManualOverride.current) { ... }
})
```

**Severidad: ALTA — Presión GC sostenida a 60fps × N fixtures**

---

### VECTOR 5 — 🟡 MEDIA: `useMemo` de `baseQuat` recalcula por `baseRotation` inline

**Archivo:** `electron-app/src/components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D.tsx` (línea ~188)

```ts
const baseQuat = useMemo(() => {
  const offsetQ = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(...)
  )
  return mountQ.clone().multiply(offsetQ)
}, [fixture.orientation, fixture.baseRotation])  // ← baseRotation es objeto inline
```

Si `fixture.baseRotation` es un literal `{ pitch: 0, yaw: 0, roll: 0 }` construido en el render de `useFixture3DData`, **cada render crea una nueva referencia de objeto**, haciendo que `useMemo` recalcule en cada render aunque los valores sean idénticos. Resultado: `new THREE.Quaternion()` + `new THREE.Euler()` sin disposal en cada render.

**Fix:** Comparar por valores en el dep array, o memoizar `baseRotation` upstream en `useFixture3DData`.

**Severidad: MEDIA**

---

### VECTOR 6 — 🟡 MEDIA: R3F `frameloop='always'` activo en background

**Archivo:** `electron-app/src/components/hyperion/views/visualizer/VisualizerCanvas.tsx` (línea ~408)

```tsx
<Canvas frameloop={isVisible ? 'always' : 'never'} ...>
```

`isVisible` viene de `viewMode === '3D' && sidebarMode !== 'kinetics'`. Si el usuario está en otra pestaña de la app pero el `HyperionView` sigue en modo 3D, **R3F sigue renderizando a 60fps** con todos los `useFrame` activos (incluyendo el getState() masivo del Vector 4).

**Fix:** `isVisible` debería depender también de si el componente está visible en el DOM (tab activo en la navegación principal).

**Severidad: MEDIA**

---

## Resumen de prioridades

| # | Vector | Archivo | Tipo | Severidad |
|---|--------|---------|------|-----------|
| 4 | `getState()` a 60fps × N fixtures en `useFrame` | `HyperionMovingHead3D.tsx:272` | CPU / GC presión | 🔴 ALTA |
| 3 | `THREE.BufferGeometry` + `Material` sin `.dispose()` | `NeonFloor.tsx:56,93` | VRAM leak | 🔴 ALTA |
| 2 | `new THREE.Color()` sin cleanup en `useMemo` | `useFixture3DData.ts:229` | GC pressure | 🟡 MEDIA |
| 5 | `useMemo` recalcula por `baseRotation` inline | `HyperionMovingHead3D.tsx:188` | GC + Three GPU | 🟡 MEDIA |
| 6 | R3F render en background con tab invisible | `VisualizerCanvas.tsx:408` | CPU waste | 🟡 MEDIA |
| 1 | `physicsStore` / `fpsHistory` globals worker | `hyperion-render.worker.ts:103` | Sin fuga real | 🟢 BAJA |

---

## Plan de acción (cuando se retome)

1. **Fix Vector 4** — Patrón `subscribe → ref` en `HyperionMovingHead3D` para sacar el `getState()` del interior de `useFrame`.
2. **Fix Vector 3** — Añadir `useEffect(() => () => geometry.dispose(), [geometry])` en `NeonFloor` para `gridGeometry` y `gridMaterial`.
3. **Fix Vector 2** — Eliminar `new THREE.Color()` del `useMemo` de `useFixture3DData` (ya no es necesario — el color se lee en `useFrame` directamente del `transientStore`).
4. **Fix Vector 5** — Memoizar `baseRotation` como primitivos separados (`pitch`, `yaw`, `roll`) en el dep array de `baseQuat`.
5. **Fix Vector 6** — Conectar `isVisible` del `VisualizerCanvas` a la visibilidad real del tab activo en la navegación principal.
