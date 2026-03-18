# WAVE 2205-2206: COSMÉTICA 3D + AUTOPSIA DEL MOTOR DE MOVIMIENTO

**Fecha**: Junio 2025  
**Cirujano**: PunkOpus  
**Asistente**: Radwulf  
**Estado**: ✅ COMPLETADO — 0 errores TypeScript, 129/129 tests PASS

---

## RESUMEN EJECUTIVO

Dos directivas ejecutadas secuencialmente:

| Directiva | Prioridad | Archivos | Fixes | Tests |
|-----------|-----------|----------|-------|-------|
| **2205** — Cosmética 3D | Baja | 3 | 3 | N/A (visual) |
| **2206** — Autopsia Motor Movimiento | Crítica | 2 | 4 | 129/129 ✅ |

---

## DIRECTIVA 1 — WAVE 2205: COSMÉTICA 3D

### Fix 1/3: NeonFloor.tsx — Grid Estático
**Síntoma**: Grid del suelo pulsaba con el beat → distracción visual  
**Causa**: `useFrame` modulaba `gridRef.current.material.opacity` reactivamente al beat  
**Fix**: Eliminado `useRef`, `useFrame`, import de `@react-three/fiber`. Grid ahora 100% estático:
- `opacity: 0.2` fijo
- `color: primaryColor` fijo
- Centro cross: `opacity: 0.35` fijo
- Retiene `depthWrite: false` + `polygonOffset: true` de WAVE 2204

### Fix 2/3: HyperionPar3D.tsx — Eliminación del Cono Beam
**Síntoma**: PAR mostraba cono de luz 3D que consumía GPU sin aportar valor  
**Causa**: Mesh `<coneGeometry>` renderizado para cada PAR con beam activo  
**Fix**: Eliminado completamente:
- `beamMaterialRef` removido
- Lógica beam en `useFrame` removida
- **Bloque JSX completo del cone mesh eliminado**
- PAR ahora muestra SOLO lens + bloom (HDR multiplication de WAVE 2204 intacta)
- Versión bumpeada a v2.2

### Fix 3/3: VisualizerCanvas.tsx — Documentación LQ
**Síntoma**: No era claro si NeonBloom se ejecutaba en modo LQ  
**Verificación**: `{qualitySettings.postProcessing && (<NeonBloom/>)}` — correcto, NeonBloom se DESMONTA completamente en LQ  
**Fix**: Comentarios actualizados documentando "ZERO GPU cost in LQ mode"

---

## DIRECTIVA 2 — WAVE 2206: AUTOPSIA DEL MOTOR DE MOVIMIENTO

### Diagnóstico Forense

**Archivos analizados**: ~2400 líneas totales
- `VibeMovementManager.ts` (1010 líneas) — El Coreógrafo
- `FixturePhysicsDriver.ts` (1052 líneas) — El Físico
- `VibeMovementPresets.ts` (329 líneas) — Configs por vibe

### Síntoma 1 → Fix 2206.1: Patrón Atascado en scan_x

| | Antes | Después |
|--|-------|---------|
| **Rotación** | `barCount / 8` = 32 beats por cambio | `barCount / 4` = 16 beats por cambio |
| **Fallback** | Ninguno (si beatTracker errático → congelado) | `this.time / 16` = cada 16 segundos |
| **Selección** | Single-source (beat only) | `Math.max(beatPhrase, timePhrase)` dual-source |
| **Ciclo Techno** | 128 beats ≈ 4 min | 64 beats ≈ 32s |

**Root Cause**: `selectPattern()` dependía exclusivamente de `barCount`, que solo se incrementaba cuando `beatCount` cambiaba Y era divisible por 4. Con beat tracker errático, `barCount` se congelaba → patrón atascado indefinidamente.

### Síntoma 2 → Fix 2206.2 + 2206.3: Todos los Vibes a la Misma Velocidad

| | Antes | Después |
|--|-------|---------|
| **baseFrequency** | CÓDIGO MUERTO — definido pero nunca usado | `phaseDelta *= config.baseFrequency / 0.20` |
| **Techno (0.25)** | 1.0× (igual que todos) | 1.25× más rápido que Rock |
| **Latino (0.15)** | 1.0× | 0.75× — orgánico, cadencioso |
| **Rock (0.20)** | 1.0× | 1.0× — referencia neutral |
| **Chill (0.10→0.03)** | 1.0× | 0.15× — GLACIAR |
| **Idle (0.05→0.02)** | 1.0× | 0.10× — semi-estático |

**Root Cause**: `config.baseFrequency` se definía en VIBE_CONFIG, se devolvía como `speed` en MovementIntent, pero JAMÁS multiplicaba el `phaseDelta` del acumulador de fase. Todos los vibes avanzaban la fase al mismo ritmo BPM-driven.

### Síntoma 3 → Fix 2206.4: Stuttering (3 Jerks por Revolución)

| | Antes | Después |
|--|-------|---------|
| **REV_LIMIT** | `Math.max(-limit, Math.min(limit, delta))` — HARD clamp | `limit * Math.tanh(delta / limit)` — SOFT clamp |
| **Derivada** | Discontinua en ±limit (salto instantáneo) | Continua everywhere (tanh) |
| **Resultado** | 2-3 jerks mecánicos cuando sin(ωt) cruzaba el threshold | Zero discontinuidades, curva smooth |

**Root Cause**: Hard `Math.max/Math.min` clamp en SNAP mode creaba discontinuidades de velocidad. Cuando la velocidad sinusoidal del patrón cruzaba el REV_LIMIT, la aceleración cambiaba instantáneamente → jerk mecánico en los picos de la sinusoide (0, π, 2π).

**Nuevo método**:
```typescript
private softClampDelta(delta: number, limit: number): number {
  if (limit <= 0) return 0
  return limit * Math.tanh(delta / limit)
}
```
Matemáticamente: `tanh(x) → x` para `|x| << 1` (lineal), `tanh(x) → ±1` para `|x| >> 1` (saturación suave). Derivada continua en todo el dominio.

---

## REPARACIÓN DE TESTS

4 tests fallaban en `§2 PATTERN MATHEMATICS` (3 pre-existentes + 1 nuevo):

| Test | Causa Real | Fix |
|------|-----------|-----|
| `square: 4 quadrants` | Solo 16 beats × 17ms = 65° de fase (insuficiente para ciclo completo) | 128 beats + pop-rock (scale=1.0) |
| `chase_position: 4 directions` | Mismo que square | 128 beats + pop-rock |
| `drift: varied positions` | chill-lounge ahora 0.15× → 32 beats insuficientes | 256 beats + pop-rock |
| `Every pattern: movement` | Date.now() mock contaminaba constructor de VMM entre patrones → dt negativo | Mock monotónico antes de constructor |

**Resultado final**: 129/129 PASS ✅

---

## ARCHIVOS MODIFICADOS

### Motor (engine):
- `src/engine/movement/VibeMovementManager.ts` — FIX 2206.1, 2206.2, 2206.3
- `src/engine/movement/FixturePhysicsDriver.ts` — FIX 2206.4

### Visual (hyperion):
- `src/components/hyperion/views/visualizer/environment/NeonFloor.tsx`
- `src/components/hyperion/views/visualizer/fixtures/HyperionPar3D.tsx`
- `src/components/hyperion/views/visualizer/VisualizerCanvas.tsx`

### Tests:
- `src/engine/movement/__tests__/VibeMovementManager.test.ts` — 4 tests actualizados

---

## IMPACTO EN PERFORMANCE

| Componente | Antes | Después | Mejora |
|-----------|-------|---------|--------|
| NeonFloor GPU | useFrame cada frame | Estático (0 JS/frame) | -100% CPU overhead |
| PAR Beam cone | 1 mesh + material por PAR | Eliminado | -100% draw calls |
| REV_LIMIT calc | `Math.max/Math.min` (3 ops) | `Math.tanh` (1 op) | Equivalente perf, mejor resultado |
| Phase accumulator | 3 multiplications | 4 multiplications (+frequencyScale) | +1 mul/frame (negligible) |
