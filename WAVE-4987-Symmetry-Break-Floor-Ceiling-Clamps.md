# WAVE 4987 — FORENSIC AUDIT: SYMMETRY BREAK & FLOOR/CEILING CLAMPS

**Date:** 2026-06-03  
**Status:** AUDIT COMPLETE — ZERO CODE GENERATION  
**Scope:** Estado del cálculo de fase L/R en KineticAdapter y disponibilidad de topología; ubicación exacta de los clamps de tilt en NodeArbiter.

---

## 1. LA TOPOLOGÍA DEL NODO — ¿Qué propiedades tenemos disponibles?

### 1.1 El objeto `node` en el scope de `KineticAdapter.process()`

**File:** `src/core/aether/adapters/KineticAdapter.ts` | **Line:** 150

```typescript
  process(
    nodes: INodeView<IKineticNodeData>,
    context: FrameContext,
    bus: IIntentBus,
  ): void {
```

El callback `forEach` recibe `node: IKineticNodeData`, que hereda de `ICapabilityNode`.

### 1.2 Propiedades topológicas disponibles en `node` (de `ICapabilityNode`)

**File:** `src/core/aether/capability-node.ts` | **Lines:** 202–241

```typescript
export interface ICapabilityNode {
  readonly nodeId: NodeId
  readonly family: NodeFamily
  readonly deviceId: DeviceId
  readonly zoneId: ZoneId          ← TOPOLÓGICA: zona espacial asignada
  readonly position?: Position3D    ← TOPOLÓGICA: posición 3D en escenario
  readonly role: NodeRole           ← TOPOLÓGICA: rol semántico
  readonly channels: readonly INodeChannelDef[]
  readonly constraints: INodeConstraints
  readonly profileMeta?: Readonly<IProfileMetadata>
  readonly state: Float64Array
}
```

**Propiedades disponibles en el hot-path del KineticAdapter:**
- `node.zoneId` — `ZoneId` (string identificador de zona, ej. `"back-left"`, `"center-stage"`, etc.)
- `node.position` — `Position3D` (igual que `physicalPosition`, alternativa)
- `node.role` — `NodeRole` (rol semántico del fixture)
- `node.deviceId` — `DeviceId` (id del fixture físico)

**NO disponibles:**
- `node.zone` (no existe; es `zoneId`)
- `node.isLeft` (no existe)
- `node.group` (no existe)
- `node.side` (no existe)

### 1.3 Propiedades cinéticas disponibles en `node` (de `IKineticNodeData`)

**File:** `src/core/aether/capability-node.ts` | **Lines:** 329–393

```typescript
export interface IKineticNodeData extends ICapabilityNode {
  readonly family: NodeFamily.KINETIC
  readonly motorType: MotorType
  readonly isContinuous: boolean
  readonly maxPanSpeed: number
  readonly maxTiltSpeed: number
  readonly maxRotationSpeed?: number
  currentPosition: { pan: number; tilt: number; rotation?: number }
  readonly physicalPosition: Position3D    ← USADA HOY para L/R
  readonly stereoIndex: number
  readonly stereoTotal: number
  readonly ikOrientation?: IKOrientation
  readonly ikLimits?: IKMechanicalLimits
  readonly ikCalibration?: IKCalibration
}
```

**La propiedad `physicalPosition`** es la única topológica que se usa actualmente para L/R:

**File:** `src/core/aether/adapters/KineticAdapter.ts` | **Lines:** 237–244

```typescript
      const lrX = node.physicalPosition?.x ?? 0
      const lrPhaseOffset = Math.abs(lrX) < 0.05 ? 0 : (lrX > 0 ? Math.PI : 0)
```

### 1.4 Observación crítica: `zoneId` vs `physicalPosition.x`

Si `zoneId` contiene palabras clave como `"left"`, `"right"`, `"back-left"`, `"front-right"`, etc., se podría usar directamente para determinar la zona L/R sin depender de coordenadas X que pueden ser ruidosas o no disponibles.

**Sin embargo:** `zoneId` es un string opaco — no hay una función normalizada que convierta `"back-left"` → `"left"` en el hot-path. El KineticAdapter no tiene acceso al `ZoneNodeRouter` en su scope actual.

**Recomendación arquitectónica:** El parche debería basarse en `physicalPosition.x` (ya se usa) con una deadzone ajustada, O añadir una propiedad pre-computada en `IKineticNodeData` (ej. `side: 'left' | 'right' | 'center'`) durante el patch time en `NodeExtractionPipeline`.

---

## 2. LOS LÍMITES FÍSICOS — Ubicación exacta de los clamps de tilt

### 2.1 `_applyRelativeOffsetFusion` — TILT_ARBITER_MAX

**File:** `src/core/aether/NodeArbiter.ts` | **Lines:** 898–904

```typescript
      if (hasBaseTilt || hasTiltOffset) {
        const oy = (!hasBaseTilt && hasTiltOffset) ? (tiltOffset as number) : 0
        let final = baseTilt + oy * ampTilt * distScale
        if (final < 0) final = 0
        else if (final > TILT_ARBITER_MAX) final = TILT_ARBITER_MAX
        record['tilt'] = final
      }
```

**Análisis:**
- `final < 0 → final = 0` permite que el tilt alcance 0.
- En nuestro rig, **DMX 0 = techo** (inversión de ejes en ceiling mounts).
- Solo hay límite SUPERIOR (`TILT_ARBITER_MAX = 0.85`) pero no límite INFERIOR efectivo contra el techo.

### 2.2 `_applyReleaseFades` — blended clamp

**File:** `src/core/aether/NodeArbiter.ts` | **Lines:** 1302–1308

```typescript
        if (l0Value !== undefined && Number.isFinite(l0Value)) {
          let blended = releaseValue * fadeWeight + l0Value * (1.0 - fadeWeight)
          if (key === 'tilt' && blended > TILT_ARBITER_MAX) blended = TILT_ARBITER_MAX
          record[key] = blended
        }
```

**Análisis:**
- Sólo hay clamp superior (`> TILT_ARBITER_MAX`).
- El blend puede producir valores por debajo del límite del techo si `releaseValue` fue capturado antes del clamp (ej. snapshot de un manual override con tilt < TILT_ARBITER_MIN).
- Si `l0Value` es undefined, se salta el fade — el valor previo del record (si existe) no se clampa aquí.

---

## 3. DÓNDE INYECTAR TILT_ARBITER_MIN

### 3.1 Ubicación recomendada en `_applyRelativeOffsetFusion`

**Línea 901–902:** después del clamp superior, añadir clamp inferior.

```typescript
        let final = baseTilt + oy * ampTilt * distScale
        if (final < TILT_ARBITER_MIN) final = TILT_ARBITER_MIN      ← NUEVO
        else if (final > TILT_ARBITER_MAX) final = TILT_ARBITER_MAX
        record['tilt'] = final
```

**Ojo con el orden:** Si `TILT_ARBITER_MIN = 0.15`, el check `final < 0` (línea 901 actual) queda redundante. Debe reemplazarse por `TILT_ARBITER_MIN`.

### 3.2 Ubicación recomendada en `_applyReleaseFades`

**Línea 1306:** después del clamp superior, añadir clamp inferior.

```typescript
          let blended = releaseValue * fadeWeight + l0Value * (1.0 - fadeWeight)
          if (key === 'tilt') {
            if (blended > TILT_ARBITER_MAX) blended = TILT_ARBITER_MAX
            if (blended < TILT_ARBITER_MIN) blended = TILT_ARBITER_MIN  ← NUEVO
          }
          record[key] = blended
```

### 3.3 Constante a definir

**File:** `src/core/aether/NodeArbiter.ts` | **Line:** 120

Junto a `TILT_ARBITER_MAX = 0.85`, añadir:

```typescript
const TILT_ARBITER_MIN = 0.15
```

**Justificación:** 0.15 en normalizado [0,1] ≈ DMX 38 (de 255). Para un fixture de techo con tiltRange=270° y inversión de ejes, esto evita que el haz apunte completamente vertical (techo). El valor corresponde a ~40° desde la vertical hacia el escenario — un límite seguro.

---

## 4. TABLA DE HALLAZGOS

| # | Hallazgo | Ubicación | Impacto |
|---|----------|-----------|---------|
| 1 | `node.zoneId` existe pero no se usa para L/R | `capability-node.ts:210` | Podría reemplazar `physicalPosition.x` si las zonas nombran left/right |
| 2 | `node.position` es alternativa a `physicalPosition` | `capability-node.ts:212` | Mismo valor, distinto campo — redundancia |
| 3 | `lrPhaseOffset` usa `physicalPosition.x` con deadzone ±0.05 | `KineticAdapter.ts:243-244` | El deadzone rompe simetría: un foco derecho con x=0.04 se trata como izquierdo |
| 4 | `TILT_ARBITER_MAX` clamp existe en fusión + fade | `NodeArbiter.ts:902, 1306` | Protege el suelo (límite superior), no el techo |
| 5 | `final < 0` clamp existe pero permite tilt=0 (techo) | `NodeArbiter.ts:901` | Necesita reemplazarse por `TILT_ARBITER_MIN` |
| 6 | `_applyReleaseFades` no clampa inferior | `NodeArbiter.ts:1306` | El blend puede degradar por debajo del límite del techo |

---

*End of WAVE 4987 Forensic Audit Report.*
