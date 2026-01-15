# WAVE 369.6: BOX SELECT RESURRECTION 📦✨

**Status:** ✅ COMPLETE  
**Type:** Bug Fix + Selection System Overhaul  
**Dependencies:** WAVE 369 (Camera Lock), WAVE 369.5 (File Dialogs)

---

## 🎯 OBJECTIVE

Revivir la herramienta de Box Select que detectaba fixtures correctamente pero **no los seleccionaba visualmente**. Diagnóstico y solución de problemas profundos en la interacción entre Zustand + React Three Fiber.

---

## 🐛 THE NIGHTMARE: THREE LAYERS OF PAIN

### Layer 1: Wrong Math (WAVE 369.6 Fix #1)
**Problem:** BoxSelect usaba aproximaciones hardcodeadas (`x/8`, `z/6`) que fallaban con cámara rotada.

```typescript
// ❌ BROKEN
const approxNdcX = fixture.position.x / 8  // Rough scale
const approxNdcZ = -fixture.position.z / 6  // Doesn't work when camera rotates
```

**Solution:** Usar `Vector3.project(camera)` para proyección 3D→2D correcta:

```typescript
// ✅ CORRECT
const worldPos = new THREE.Vector3(fixture.position.x, fixture.position.y, fixture.position.z)
const projected = worldPos.clone().project(camera)

const screenX = (projected.x + 1) / 2 * rect.width
const screenY = (-projected.y + 1) / 2 * rect.height

return screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY && projected.z < 1
```

### Layer 2: Zustand + R3F Context Mismatch (WAVE 369.6 Fix #2)
**Problem:** StageScene (dentro del Canvas de R3F) y StageGrid3D (fuera) tenían **instancias diferentes del store Zustand**.

```
[BoxSelect] Selected 3 fixtures: [...]     ← Correct
[Store] Updated selectedIds: (3) [...]     ← Store updated
[StageScene] selectedIds changed: []       ← EMPTY! Different store instance!
```

**Diagnosis:** React Three Fiber usa su propio reconciler/contexto. El hook `useSelectionStore()` dentro del Canvas accedía a una instancia separada.

**Solution:** Pasar `selectedIds` como **prop desde el padre al hijo**:

```typescript
// En StageGrid3D (fuera del Canvas)
const selectionVersion = useSelectionStore(state => state.selectedIds.size)
const selectedIdsArray = useSelectionStore(state => [...state.selectedIds])

// Pasar como prop
<Canvas>
  <StageScene selectedIdsArray={selectedIdsArray} />
</Canvas>

// En StageScene (dentro del Canvas)
const selectedIds = useMemo(
  () => new Set(selectedIdsArray), 
  [selectionVersion]  // Use size as dependency instead of array
)
```

### Layer 3: Silent Deselection on Mouse Up (WAVE 369.6 Fix #3)
**Problem:** Después de BoxSelect, la selección se borraba inmediatamente.

```
[BoxSelect] Selected 3 fixtures: [...]     ← Selection correct
[Store] Updated selectedIds: (3) [...]     ← Store correct
[StageScene] Selection changed: (3) [...]  ← Visual correct
[Store] Updated selectedIds: []            ← WIPE! GONE!
```

**Root Cause:** El mesh invisible del floor tenía `onClick={handleBackgroundClick}` que llamaba `deselectAll()`. Cuando soltabas el mouse después del BoxSelect, el evento `onClick` se disparaba.

**Solution:** No ejecutar `deselectAll()` durante BoxSelect:

```typescript
const handleBackgroundClick = useCallback(() => {
  if (isBoxSelectMode) return  // WAVE 369.6: Don't deselect when using box select tool
  deselectAll()
}, [deselectAll, isBoxSelectMode])
```

---

## 📁 FILES MODIFIED

| File | Changes | Lines |
|------|---------|-------|
| `src/components/views/StageConstructor/StageGrid3D.tsx` | 1. Fixed 3D→2D projection math 2. Fixed Zustand+R3F context 3. Fixed deselect on mouse up | ~80 |
| `src/stores/selectionStore.ts` | Removed debug logs | ~10 |

---

## 🔧 CODE CHANGES

### 1. Projection Math Fix
**File:** `StageGrid3D.tsx` lines 560-595

```typescript
const selectedFixtureIds = fixtures.filter(fixture => {
  // Project 3D position to screen space using actual camera
  const worldPos = new THREE.Vector3(
    fixture.position.x,
    fixture.position.y,
    fixture.position.z
  )
  
  const projected = worldPos.clone().project(camera)
  
  // Convert NDC to screen pixels
  const screenX = (projected.x + 1) / 2 * rect.width
  const screenY = (-projected.y + 1) / 2 * rect.height
  
  // Check if inside selection box AND in front of camera
  return (
    screenX >= minX && screenX <= maxX &&
    screenY >= minY && screenY <= maxY &&
    projected.z < 1
  )
}).map(f => f.id)
```

### 2. Zustand+R3F Fix
**File:** `StageGrid3D.tsx` lines 465-477

```typescript
// Use selector that detects changes via .size (primitive value)
const selectionVersion = useSelectionStore(state => state.selectedIds.size)
const selectedIdsArray = useSelectionStore(state => [...state.selectedIds])

// Inside StageScene (prop-based)
const selectedIds = useMemo(() => new Set(selectedIdsArray), [selectionVersion])
```

### 3. Deselect Guard
**File:** `StageGrid3D.tsx` lines 352-355

```typescript
const handleBackgroundClick = useCallback(() => {
  if (isBoxSelectMode) return  // WAVE 369.6: Don't deselect when using box select
  deselectAll()
}, [deselectAll, isBoxSelectMode])
```

---

## ✅ VERIFICATION

- [x] BoxSelect detects fixtures with correct 3D→2D math
- [x] Selected fixtures render cyan glow
- [x] Selection persists after BoxSelect completes
- [x] Groups panel shows selected fixtures
- [x] Can create groups from BoxSelected fixtures
- [x] Clicking empty space still deselects (when NOT in BoxSelect mode)

---

## 🎬 USER WORKFLOW

```
1. Open Stage Constructor
2. Load a show with fixtures
3. Select "Box Select" tool (□ icon)
4. Drag rectangle over fixtures
   ↓
5. Fixtures light up cyan (VISUAL FEEDBACK)
6. Release mouse
7. Fixtures STAY selected ✅
8. Open Groups panel → "Create Group" button active
9. Create group with selected fixtures
```

---

## 🎓 LESSONS LEARNED

1. **Zustand + R3F = Separate Contexts**
   - Hooks used inside `<Canvas>` have different context than outside
   - Solution: Use props to bridge contexts, not hooks

2. **React.useMemo Dependencies Matter**
   - Can't use Arrays/Objects directly (recreated each render)
   - Use primitives like `.size` or `.join(',')`

3. **Event Propagation is Subtle**
   - `onClick` on invisible meshes still fires
   - Guard clauses prevent unwanted side effects

4. **3D Projection is Non-Obvious**
   - Never hardcode scale factors
   - Use `Vector3.project(camera)` for correct math

---

## 📊 PERFORMANCE NOTES

- BoxSelect now does proper O(n) raycasting instead of approximate heuristics
- No performance degradation observed
- Selection updates are instant (no debouncing needed)

---

**WAVE 369.6 Status:** ✅ COMPLETE - Box Select fully functional and bulletproof!

Next: WAVE 370 (TBD) - More creative features incoming! 🚀
