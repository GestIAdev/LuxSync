Voy a hacer la auditoría read-only en paralelo. Empiezo por las tres áreas clave:

Now let me check the `updateFixture` in stageStore and the DMX Nexus:

Now let me find the DMX Nexus:

So "DMX Nexus" IS the `VisualPatcher.tsx`. Let me check the schema validation for unpatched fixtures:

Now let me check the VisualPatcher for spatial metadata display:

Now let me check the inspector panel — what fixture metadata is shown:

Now let me check the TacticalPatchBay for spatial metadata:

Now let me check if `updateFixture` syncs address changes to the backend:

Critical finding. Let me also check the `FixtureV2` interface for optional fields and the `isVirtual` field:

# 📋 WAVE 7730 — PATCHING LIFECYCLE AUDIT (READ-ONLY)

## 1. Erebus Tumor — Fixture Instantiation

### Puntos de creación (3 entradas, todas con auto-patch forzado)

| Archivo | Línea | Trigger |
|---|---|---|
| `ErebusShell.tsx` | 111-115 | Drag-drop library fixture en 3D |
| `ErebusShell.tsx` | 158-162 | Evento `erebus:place-fixture` |
| `BlueprintCanvas.tsx` | 407-413 | Drag-drop en 2D |
| `CommandPalette.tsx` | 115-117 | Ctrl+K → library result |

**El tumor:** Todos llaman a `nextAvailableAddress(existingFixtures, libChCount)` y luego `createDefaultFixture(id, addr, ...)`. WAVE 7729 arregló el cálculo (ya no es `count*4+1`), pero **el patrón sigue siendo auto-patch forzado en creación espacial**. Erebus decide la dirección DMX en el momento de crear el fixture, sin consultar al usuario ni al Patchbay.

### Restricciones del schema (lo que bloquea `null`/`0`)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\stage\ShowFileV2.ts" lines="747-748" />

```typescript
/** DMX address (1-512) */
address: number        // ← REQUIRED, non-optional, non-nullable
```

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\stage\ShowFileV2.ts" lines="1452-1455" />

```typescript
// Address: integer 1-512
if (typeof f.address !== 'number' || !Number.isInteger(f.address) || f.address < 1 || f.address > 512) {
  errors.push(`${prefix} (${f.id}): address must be integer 1-512, got ${f.address}`)
}
```

**Bloqueo duro:**
- `address: number` es **required** (no `?`, no `| null`, no `| undefined`)
- `validateShowFileDeep()` rechaza `address < 1` → `0` no pasa
- `StagePersistence.saveShow()` bloquea el save si la validación falla
- No existe campo `isPatched` ni `patched: boolean`

**El único mecanismo "unpatched" existente es `isVirtual?: boolean`** (línea 836), pero semánticamente significa "no output a hardware", no "sin dirección asignada". Un fixture virtual sigue teniendo `address: number` válida.

## 2. State Mutators — Nexus vs Patchbay

### Ambos usan el mismo canal: `stageStore.updateFixture()`

| Componente | Archivo | Mutador |
|---|---|---|
| DMX Nexus (= VisualPatcher) | `VisualPatcher.tsx:1048-1054` | `updateFixture(id, { address })` |
| Dashboard Patchbay | `TacticalPatchBay.tsx:52-57` | `updateFixture(id, { address })` |

**No hay conflicto entre ellos** — ambos escriben al mismo `showFile.fixtures[].address` vía el mismo store action. El problema **no** es Nexus vs Patchbay peleando. El problema es **Erebus auto-patching en creación** vs **usuario re-patching después**.

### Bug latente confirmado: address changes NO se sincronizan al backend

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\stores\stageStore.ts" lines="801-808" />

```typescript
if (updates.position || updates.rotation || updates.orientation) {
  const lux = (window as any).lux
  if (lux?.aether?.setFixtures) {
    lux.aether.setFixtures(allFixtures, null)
      .catch(...)
  }
}
```

**El condicional solo dispara `lux.aether.setFixtures()` para `position/rotation/orientation`.** Cuando cambias `address` en el Patchbay, el backend **no se entera** hasta el próximo load show. Esto es un bug real: si patcheas en caliente, el `TickEngine` sigue emitiendo DMX a la dirección vieja.

## 3. UX Audit — Patchbay sin metadata espacial

### TacticalPatchBay (Dashboard)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\DashboardView\components\TacticalPatchBay.tsx" lines="141-147" />

Solo muestra `fixture.name` + `fixture.model`. **Cero metadata espacial.** Si tienes 10 "Tungsten" genéricos, no sabes cuál es cuál.

### VisualPatcher (Nexus)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\VisualPatcher\VisualPatcher.tsx" lines="1433-1439" />

Muestra `name`, `type`, `model`, `id`. Tampoco muestra posición. Pero tiene el canvas 2D con `f.position.x/z` dibujado, así que visualmente sí sabes cuál es — solo no en el inspector textual.

### Datos disponibles en `fixture` (fácil de exponer)

```typescript
fixture.position: { x, y, z }     // metros, center-origin
fixture.zone: FixtureZone          // 'unassigned' | 'front' | 'back' | ...
fixture.rigId?: string             // referencia a truss/totem
fixture.orientation: InstallationOrientation
fixture.placementMode?: 'unplaced' | 'planar' | '3d'
```

**Conclusión UX:** Trivial exponer `[X, Z]` o `zone` en el Patchbay. Los datos ya están en el objeto. Solo hay que renderizarlos.

---

## 🏗️ Propuesta de Arquitectura — Routing Authority Unification

### Principio: Erebus = Spatial, Nexus/Patchbay = Signal

```
EREBUS (Builder)          →  crea fixture con address=0 (UNPATCHED)
NEXUS / PATCHBAY          →  único lugar donde address se asigna/muta
SAVE GATE                 →  permite address=0 (unpatched), bloquea overlaps
TICKENGINE                →  ignora fixtures con address=0 (no emite DMX)
```

### Cambios necesarios (no ejecutar todavía)

**1. Schema — permitir "Unpatched"**
- `FixtureV2.address: number | 0` donde `0` = sin asignar
- `validateShowFileDeep()`: aceptar `0` como válido, pero **warning** (no error)
- Añadir helper `isFixturePatched(f): f.address >= 1`

**2. Erebus — dejar de auto-patchear**
- Reemplazar `nextAvailableAddress(...)` por `address: 0` en los 4 puntos de creación
- Mostrar badge "UNPATCHED" en el canvas 2D/3D para fixtures con `address=0`

**3. Nexus/Patchbay — autoridad única**
- Al seleccionar un fixture `address=0`, auto-sugerir `nextAvailableAddress()` como default en el input
- El usuario confirma o edita → `updateFixture(id, { address })`

**4. stageStore.updateFixture — sync address al backend**
- Añadir `updates.address` o `updates.universe` al condicional de `setFixtures()` (línea 801)
- Esto arregla el bug latente de patch en caliente

**5. TickEngine / HAL — skip unpatched**
- En el loop de render DMX, `if (fixture.address === 0) continue`
- No escribir canales para fixtures unpatched

**6. UX — metadata espacial en Patchbay**
- En `TacticalPatchBay.tsx`, añadir columna o subtítulo: `X:{x.toFixed(1)} Z:{z.toFixed(1)} · {zone}`
- En `VisualPatcher.tsx` inspector, añadir línea "POS: {x}, {z} · {zone}"

### Riesgo

- **Migración:** shows existentes con `address >= 1` siguen funcionando. Solo fixtures nuevos nacen unpatched.
- **Backward compat:** `address: 0` ya era rechazado por validación — hay que aflojar esa regla con cuidado (solo `0`, no negativos).
- **TickEngine:** hay que auditar todos los consumers de `fixture.address` para que toleren `0` sin crashear.

---

**Diagnóstico completo.** Espero autorización para proceder con la implementación (WAVE 7731+).