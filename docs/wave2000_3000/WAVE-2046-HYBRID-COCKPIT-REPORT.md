# ⚡ WAVE 2046 — HYBRID COCKPIT — Phase 1: EL SISTEMA NERVIOSO

## 🎯 MISIÓN
Dotar de tacto al Stage Preview de Chronos. Los fixtures en el canvas 2D ahora son **interactivos**: se pueden seleccionar con click, multi-seleccionar con Shift/Ctrl, y deseleccionar clickeando el fondo.

## 📐 ARQUITECTURA: HIT-TEST ENGINE

```
Mouse Event (click/move/leave)
    │
    ▼
.stage-cinema__interaction  ← overlay transparente (z-index: 2)
    │
    ▼
eventToNormalized()  ← pixel coords → normalized (0-1, 0-1)
    │
    ▼
hitTest(nx, ny)  ← distancia euclídea, radio = 0.055
    │
    ├─ HIT → fixture.id
    │    ├─ Click → handleSelectionClick(id, event, allIds)
    │    │    ├─ Normal click → select(id, 'replace')
    │    │    ├─ Ctrl+Click → toggleSelection(id)
    │    │    └─ Shift+Click → selectRange(fromId, toId, allIds)
    │    └─ Move → setHovered(id) [con change-guard]
    │
    └─ MISS → null
         ├─ Click → deselectAll()
         └─ Move → setHovered(null)
```

### Algoritmo Hit-Test
- **Espacio**: Coordenadas normalizadas (0-1) — independiente de resolución
- **Métrica**: Distancia euclídea: `√((x₁-x₂)² + (y₁-y₂)²)`
- **Radio**: `HIT_RADIUS = 0.055` (5.5% del canvas)
- **Overlap**: Nearest-fixture wins (menor distancia gana)
- **Complejidad**: O(n) por fixture array — suficiente para <500 fixtures

### Visualización de Selección
- **Selected**: Anillo cyan neon `#00F0FF` con glow (shadowBlur: 12)
- **Hovered**: Anillo magenta dashed `#FF00E5` (6-4 dash pattern)
- **Ambos**: Selection ring primero, hover ring encima (doble feedback)
- **Cursor**: `pointer` cuando hay fixture bajo el mouse, `default` si no

### Anti Stale-Closure Pattern
```
fixturesRef = useRef(cinemaFixtures)
fixturesRef.current = cinemaFixtures  // sync en cada render
// Event handlers usan fixturesRef.current, no cinemaFixtures
```

## 📦 ARCHIVOS MODIFICADOS

### `StageSimulatorCinema.tsx` (~1114 líneas)
| Sección | Cambio | Líneas aprox |
|---------|--------|-------------|
| Imports | +useSelectionStore, +useSelectionClick, +useState | +3 |
| Constants | +HIT_RADIUS, +SELECTION (colores/anchos rings) | +15 |
| Functions | +drawSelectionRing() — cyan neon con glow | +25 |
| Functions | +drawHoverRing() — magenta dashed | +20 |
| Component | +store subscriptions, +fixturesRef, +allFixtureIds | +15 |
| Component | +hitTest(), +eventToNormalized() | +35 |
| Component | +handleCanvasClick/MouseMove/MouseLeave | +35 |
| renderFrame() | +dibujar selection rings + hover rings | +25 |
| JSX | +.stage-cinema__interaction overlay div | +12 |

### `StageSimulatorCinema.css` (~105 líneas)
| Cambio | Detalle |
|--------|---------|
| `.stage-cinema__interaction` | Overlay absoluto, transparent, z-index: 2 |
| `.stage-cinema__badge` | z-index: 2 → 3 (para quedar encima del overlay) |

### Archivos NO tocados (reutilizados)
- `selectionStore.ts` — API ya existente: `select()`, `toggleSelection()`, `selectRange()`, `deselectAll()`, `setHovered()`, `useSelectionClick()`

## ✅ RESULTADO DE COMPILACIÓN

```
StageSimulatorCinema.tsx  → 0 errores
StageSimulatorCinema.css  → 0 errores
```

## 🧪 CHECKLIST DE TESTING MANUAL

- [ ] Click en fixture → se selecciona (anillo cyan)
- [ ] Click en fondo → deselecciona todo
- [ ] Ctrl+Click en fixture → toggle (agrega/quita de selección)
- [ ] Shift+Click → selecciona rango entre último seleccionado y este
- [ ] Hover sobre fixture → anillo magenta dashed + cursor pointer
- [ ] Hover fuera de fixtures → cursor default, sin anillo
- [ ] Mouse leave del canvas → hover se limpia
- [ ] Fixtures superpuestos → el más cercano al click gana
- [ ] Selección persiste entre renders (no parpadea)
- [ ] Performance: sin lag visible con 50+ fixtures

## 🔮 SIGUIENTE: WAVE 2046 Phase 2
**"EL CEREBRO DE CONTROL"** — Panel de propiedades contextual que aparece al seleccionar fixtures. DMX sliders, color picker, pan/tilt joystick. Lectura/escritura bidireccional con el engine.

---
*PunkOpus — El Sistema Nervioso vive. El tacto ha sido concedido.*
