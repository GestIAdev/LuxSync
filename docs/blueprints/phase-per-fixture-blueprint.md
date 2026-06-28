# BLUEPRINT: Individual Phase Per-Fixture — Módulo 5 "Phase Canvas"

> **Sistema:** Hephaestus V3 — Phase Distribution Engine
> **Autor:** Cascade (blueprint para revisión del arquitecto)
> **Fecha:** 2026-06-28
> **Estado:** Diseño — pendiente de aprobación

---

## 1. Motivación

El motor algorítmico de `PhaseConfigPro` es superior a MA3 en reproducibilidad
(shuffle determinista con seed), flexibilidad (wings como frecuencia continua,
multi-ciclo hasta 1440°) y transparencia (pipeline de 7 etapas auditable).

**Lo que falta:** un programador MA3 puede arrastrar el offset de fase de un
fixture individual a mano. En Hephaestus, todo es algorítmico — no hay forma
de decir "el fixture #7 arranca 120ms antes que el resto" sin trucar el
algoritmo entero.

Este módulo cierra ese gap **y lo supera** con tres diferenciadores clave que
MA3 no tiene.

---

## 2. Diferenciadores vs grandMA3

### D1 — Hybrid Overlay (no es either/or)

MA3 funciona en modo **algorítmico XOR manual**: o usas MAtricks, o editas
fixture por fixture. No puedes decir "dame un chase mirror con 90° de spread,
pero el fixture del centro arranca 50ms antes".

**Hephaestus:** El override manual es un **delta sobre el baseline algorítmico**.
El motor calcula `resolvePro()` normalmente, y luego aplica los overrides como
`finalOffset = algorithmicOffset + manualDelta`. Si cambias el spread o el
shuffle, los deltas se preservan. Si quieres override absoluto, un toggle
cambia a modo `replace`.

### D2 — Phase Canvas Visual (no es una lista de números)

MA3 muestra offsets como números en una tabla. El programador tiene que
imaginar la wave.

**Hephaestus:** Un mini-canvas circular (96×96px) muestra cada fixture como un
punto en un reloj de fase. La posición angular = offset normalizado [0°, 360°).
Los fixtures con override manual se destacan en UV neon. Arrastrar un punto
cambia su offset en tiempo real, con el QuantumSpectrometer actualizándose
a 44Hz en paralelo. Es **manipulación directa visual**, no entrada numérica
ciega.

### D3 — Bake / Unbake (ida y vuelta)

MA3: si editas manualmente, perdiste el algoritmo. No hay vuelta.

**Hephaestus:** "Bake" convierte los offsets algorítmicos actuales en overrides
manuales explícitos (preservando los valores exactos). "Unbake" borra los
overrides y vuelve al algoritmo puro. Esto permite:
- Bake → ajustar 2-3 fixtures a mano → Unbake si no convence
- Guardar presets de overrides sin perder el algoritmo base
- Versionar: el `.lfx` almacena ambos (algoritmo + overrides)

---

## 3. Data Model

### 3.1 — Extensión de `HephTrack`

```typescript
// En types.ts — nuevo campo opcional en HephTrack:

/**
 * Overrides manuales de fase per-fixture.
 * Key = fixtureId, Value = configuración del override.
 * 
 * Modo 'delta': finalOffset = algorithmicOffset + deltaMs
 * Modo 'absolute': finalOffset = absoluteMs (ignora algoritmo para este fixture)
 * 
 * Vacío o ausente → comportamiento algorítmico puro (default).
 */
phaseOverrides?: Record<string, PhaseOverride>
```

### 3.2 — Tipo `PhaseOverride`

```typescript
// Nuevo archivo: core/hephaestus/phase/PhaseOverride.ts

export interface PhaseOverride {
  /** Modo de aplicación del override. */
  mode: 'delta' | 'absolute'

  /**
   * Delta en ms sobre el offset algorítmico (modo 'delta').
   * Offset absoluto en ms desde t=0 (modo 'absolute').
   * Rango canónico: [0, durationMs].
   */
  offsetMs: number

  /** Si true, este fixture está "pinned" — no se ve afectado por cambios en spread/shuffle/wings. */
  pinned?: boolean
}
```

### 3.3 — Resolución en runtime

```typescript
// Pseudocódigo — modificación a resolvePro() o capa superior:

function resolveWithOverrides(
  fixtureIds: string[],
  config: PhaseConfigPro,
  overrides: Record<string, PhaseOverride> | undefined,
  durationMs: number,
): FixturePhase[] {
  // 1. Calcular baseline algorítmico
  const basePhases = resolvePro(fixtureIds, config, durationMs)
  
  // 2. Si no hay overrides, retornar baseline
  if (!overrides || Object.keys(overrides).length === 0) return basePhases

  // 3. Aplicar overrides
  const result = basePhases.map(fp => {
    const ov = overrides[fp.fixtureId]
    if (!ov) return fp

    if (ov.mode === 'absolute') {
      return { ...fp, phaseOffsetMs: ov.offsetMs }
    }
    // delta
    const final = fp.phaseOffsetMs + ov.offsetMs
    return { ...fp, phaseOffsetMs: Math.max(0, Math.min(durationMs, final)) }
  })

  // 4. Re-ordenar ASC (preserva cursor cache O(1) amortizado)
  result.sort((a, b) => a.phaseOffsetMs - b.phaseOffsetMs)
  return result
}
```

### 3.4 — Serialización `.lfx`

El campo `phaseOverrides` se serializa dentro del track existente. No rompe
schema — es un campo opcional nuevo. Clips V3 sin `phaseOverrides` funcionan
idéntico. El migrator V2→V3 no emite overrides (siempre algorítmico puro).

```json
{
  "id": "track-intensity-01",
  "paramId": "intensity",
  "curve": { ... },
  "phaseConfig": { "spreadDeg": 180, "symmetry": "linear", ... },
  "phaseOverrides": {
    "fx-7": { "mode": "delta", "offsetMs": 50 },
    "fx-12": { "mode": "absolute", "offsetMs": 0, "pinned": true }
  }
}
```

---

## 4. UI — Módulo 5: "PHASE CANVAS"

### 4.1 — Layout

Quinto módulo en `PhaseControls.tsx`, debajo de Spatial Behavior.

```
┌─────────────────────────────────────────────┐
│  ▣ PHASE CANVAS                    INDIVIDUAL│  ← título UV
├─────────────────────────────────────────────┤
│                                             │
│         ┌───────────┐                       │
│         │  ⊙  ⊙     │                       │
│         │ ⊙    ⊙    │  ← Mini phase wheel   │
│         │  ⊙  ⊙     │    (96×96px canvas)   │
│         └───────────┘                       │
│                                             │
│  [BAKE]  [UNBAKE]  [RESET ALL]              │
│                                             │
│  ── Selected Fixture ──────────────────     │
│  Fixture: V03                               │
│  Mode:  (● Delta) ( ○ Absolute)             │
│  Offset: [───●───────] 50ms                 │
│  [◎] Pin (immune to algo changes)           │
│                                             │
│  Overrides: 2 / 16 fixtures                 │
│                                             │
└─────────────────────────────────────────────┘
```

### 4.2 — Paleta Neon UV

```typescript
// Quinto color neon — UV púrpura/violeta
const NEON_UV = '#b388ff'  // Material Deep Purple A100

// Estilo del módulo (consistente con los 4 existentes):
{
  ...moduleBase,
  borderTop: `2px solid ${NEON_UV}`,
  boxShadow: `0 0 24px rgba(179, 136, 255, 0.15), inset 0 1px 0 rgba(179, 136, 255, 0.1), 0 0 1px ${NEON_UV}`,
}
```

Los 5 colores del rack quedan:
| Módulo | Color | Hex |
|--------|-------|-----|
| Wave Shaper | Orange | `#ff6b2b` |
| Block Matrix | Cyan | `#00e5ff` |
| Chaos Engine | Red | `#ff1744` |
| Spatial Behavior | Green | `#00e676` |
| **Phase Canvas** | **UV Purple** | **`#b388ff`** |

### 4.3 — Phase Wheel (Canvas interactivo)

- Canvas 96×96px con DPR scaling (igual que QuantumSpectrometer).
- Cada fixture = un punto circular (radio 3px).
- Posición angular = `(phaseOffsetMs / durationMs) * 360°` desde las 12 en sentido horario.
- Color base: `rgba(255,255,255,0.3)`. Fixtures con override: `#b388ff` con glow.
- Fixture seleccionado (sync con `selectedFixtureId` del QuantumSpectrometer): anillo de selección.
- **Drag interaction:** arrastrar un punto cambia su offset. En modo delta, el drag es relativo a la posición algorítmica. En modo absolute, es absoluto.
- **Click:** selecciona el fixture (propaga `onSelectFixture`).
- **Hover:** tooltip con fixture ID + offset actual + delta vs algorítmico.

### 4.4 — Controles

- **BAKE:** Convierte todos los offsets algorítmicos actuales en overrides `absolute`. Útil para congelar una distribución y ajustar manualmente desde ahí.
- **UNBAKE:** Borra todos los overrides. Vuelve al algoritmo puro.
- **RESET ALL:** Borra overrides + resetea el algoritmo a `DEFAULT_PHASE_CONFIG_PRO`.
- **Mode toggle (Delta / Absolute):** Per-fixture. Delta = suma al algorítmico. Absolute = reemplaza.
- **Offset slider:** 0 a `durationMs`. En modo delta, el rango es `[-durationMs/4, +durationMs/4]` (no tiene sentido un delta mayor a un cuarto de ciclo).
- **Pin checkbox:** El fixture pinned no se recalcula cuando cambian spread/shuffle/wings. Su offset se mantiene fijo.

### 4.5 — Estado vacío

Cuando no hay overrides:
```
┌─────────────────────────────────────────────┐
│  ▣ PHASE CANVAS                    INDIVIDUAL│
├─────────────────────────────────────────────┤
│         ┌───────────┐                       │
│         │  ⊙  ⊙     │                       │
│         │ ⊙    ⊙    │                       │
│         │  ⊙  ⊙     │                       │
│         └───────────┘                       │
│                                             │
│  No overrides — algorithmic phase active    │
│                                             │
│  [BAKE] to start manual editing             │
│                                             │
│  Click a fixture dot to select & override   │
└─────────────────────────────────────────────┘
```

---

## 5. Integración con el motor existente

### 5.1 — `useHephPreview.ts`

`resolveFixtures()` ya llama a `resolvePro()` para obtener `fixturePhases`.
La modificación es reemplazar esa llamada con `resolveWithOverrides()`:

```typescript
// Antes:
const fixturePhases = resolvePro(fixtureIds, phaseConfig, c.durationMs)

// Después:
const fixturePhases = resolveWithOverrides(
  fixtureIds,
  phaseConfig,
  activeTrack?.phaseOverrides,  // ← nuevo
  c.durationMs,
)
```

El override se aplica **después** de `resolvePro()`, preservando toda la
matemática existente (blocks, shuffle, wings, symmetry, direction).

### 5.2 — `HephaestusRuntime.ts`

`_buildResolvedTrack()` ya construye `fixturePhases` via `resolvePro()`.
Misma modificación: envolver con `resolveWithOverrides()` pasando
`track.phaseOverrides`.

### 5.3 — Store (`useHephaestusEditorStore`)

Nueva acción:

```typescript
updatePhaseOverride: (trackId: string, fixtureId: string, override: PhaseOverride | null) => void
```

- `override !== null` → set/update el override para ese fixture.
- `override === null` → delete el override (vuelve al algorítmico).

Usa el mismo patrón `mutate()` con draft que las demás acciones del store.

### 5.4 — QuantumSpectrometer

Sin cambios. El spectrometer ya lee `fixtures` del preview, que incluirán
los offsets con override aplicado. La wave se visualizará correctamente.

**Opcional (fase 2):** Destacar fixtures con override en el radar con un
anillo UV en lugar del anillo naranja estándar.

---

## 6. Plan de implementación (3 fases)

### Fase 1 — Data model + motor (sin UI)
- Crear `PhaseOverride.ts` con el tipo.
- Crear `resolveWithOverrides()` en `PhaseConfigPro.ts` o archivo separado.
- Añadir `phaseOverrides?` a `HephTrack` en `types.ts`.
- Integrar en `useHephPreview.ts` y `HephaestusRuntime.ts`.
- Añadir acción al store.
- **Verify:** `tsc --noEmit`

### Fase 2 — UI Phase Canvas
- Nuevo componente `PhaseCanvas.tsx` (canvas interactivo + controles).
- Integrar como 5º módulo en `PhaseControls.tsx`.
- Wire up con store + `selectedFixtureId`.
- **Verify:** `tsc --noEmit` + preview visual

### Fase 3 — Polish + diferenciadores
- Bake/Unbake con animación.
- Pin visual (icono de candado en el phase wheel).
- Destacar overrides en QuantumSpectrometer (anillo UV).
- Tooltip con delta vs algorítmico.
- **Verify:** `tsc --noEmit` + test manual de drag

---

## 7. Consideraciones de diseño

### 7.1 — Rendimiento
- `resolveWithOverrides()` es O(N) + O(N log N) sort. N = fixtures del track
  (típicamente 16-64). Despreciable vs la evaluación de curvas.
- El phase wheel canvas es 96×96px — ~9K pixeles. A 44Hz son <0.1ms.
- Los overrides se almacenan como `Record<string, PhaseOverride>` — acceso O(1).

### 7.2 — Compatibilidad
- Campo opcional → clips existentes sin `phaseOverrides` funcionan idéntico.
- El migrator V2→V3 no emite overrides (V2 no tiene concepto individual).
- El `LfxFileLoader` valida que los `fixtureId` en overrides existan en el
  target pool del track. Si un fixture desaparece del patch, el override
  se ignora silenciosamente (no error fatal).

### 7.3 — Checksum
- Los overrides se incluyen en el checksum G2 del clip (son parte del track).
- Un clip con overrides diferentes = checksum diferente. Correcto.

### 7.4 — Safety gate G6 (strobe)
- Los overrides pueden hacer que un fixture arranque antes → su strobe
  podría activarse en un frame donde el algoritmo puro no lo haría.
- El G6 gate ya valida por-fixture (itera `fixturePhases`), así que está
  cubierto. No se necesita modificación al safety gate.

---

## 8. Nombre comercial

**"Phase Canvas"** — evoca manipulación directa visual, no una tabla de
números. El término "Canvas" alinea con el QuantumSpectrometer (ambos son
canvas interactivos). El programador MA3 entiende "Individual Phase" pero
"Phase Canvas" sugiere algo más: **pintar la fase, no teclearla**.

Tagline para marketing: *"Don't type your phases. Paint them."*
