# WAVE 4618-A — THE 45º ANOMALY & TRANSLATOR MAP
## Auditoría Forense / ZERO CODE MUTATION

---

## Executive Summary

Se identifican **dos anomalías matemáticas independientes** con un efecto visual conjunto:

1. **La Anomalía de los 45º (Mount Matrix)**: El default `rotation: { pitch: -45 }` en `ShowFileV2.ts` se propaga como `baseRotation` a todo el grupo 3D del fixture, inclinando la carcasa/base ~45º respecto al plano del techo. El `TILT_REST_ANGLE = +45º` del head intenta compensar la dirección del haz, pero como ambas rotaciones comparten el **mismo eje X**, se cancelan parcialmente en la dirección del beam mientras la carcasa permanece visiblemente inclinada.

2. **El Enigma del Traductor (FK ausente)**: No existe función de Forward Kinematics (FK) que convierta pan/tilt normalizados (0-1) a coordenadas espaciales X/Y/Z (metros). Cuando un fixture `isPlaced: true` recibe comandos de pan/tilt sin canales espaciales, el **Iron Gatekeeper** (WAVE 4617-B M1) fuerza la ruta IK, pero `_writeNodeIK` no encuentra `targetX` y cae en un **fallback fijo** `(0, 1.5, 2.0)`. El pan/tilt real se ignora por completo.

---

## Misión 1: La Anomalía de los 45º (Mount Matrix)

### 1.1 MOUNT_QUATERNIONS — tabla auditada

**Archivo**: `components/hyperion/views/visualizer/utils/mountQuaternion.ts`

| Orientación | Quaternion | Eje de rotación | Ángulo | Propósito |
|---|---|---|---|---|
| `ceiling` | `(0,0,0,1)` | — | 0º | Fixture cuelga del techo; haz local -Y apunta al suelo |
| `floor` | `R_X(π)` | X | 180º | Fixture en piso; haz apunta arriba |
| `truss-front` | Clon de `ceiling` | — | 0º | Igual que techo |
| `truss-back` | `R_Y(π)` | Y | 180º | Inversión de yaw |
| `wall-left` | `R_Z(+π/2)` | Z | +90º | Haz hacia +X (centro) |
| `wall-right` | `R_Z(-π/2)` | Z | -90º | Haz hacia -X (centro) |

**Veredicto**: La tabla MOUNT_QUATERNIONS es matemáticamente correcta. No hay rotación de 45º en la tabla. Todos los ángulos son 0º, 90º o 180º. Las pruebas de `mountQuaternion.test.ts` confirman la corrección.

### 1.2 Origen real del tilt 45º

**Archivo**: `core/stage/ShowFileV2.ts:1135`

```typescript
rotation: options.rotation || { pitch: -45, yaw: 0, roll: 0 },
```

**Archivo**: `components/hyperion/views/visualizer/useFixture3DData.ts:251`

```typescript
baseRotation: fixture.rotation ?? { pitch: -45, yaw: 0, roll: 0 },
```

**Archivo**: `components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D.tsx:176-190`

```typescript
const baseQuat = useMemo(() => {
  const mountQ = MOUNT_QUATERNIONS[...]
  const br = fixture.baseRotation
  // br.pitch === -45 → NO entra en el early-return
  const offsetQ = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(degToRad(-45), 0, 0)
  )
  return mountQ.clone().multiply(offsetQ)  // ← ROTACIÓN -45º EN TODO EL GRUPO
}, [fixture.orientation, fixture.baseRotation])
```

**Archivo**: `components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D.tsx:362-368`

```tsx
<group 
  ref={groupRef} 
  position={[fixture.x, fixture.y, fixture.z]}
  quaternion={baseQuat}   // ← Aplicada al grupo RAÍZ
  ...
>
```

### 1.3 Análisis geométrico del compounding

Para un fixture `ceiling` (mountQ = identidad) con default `rotation.pitch = -45`:

| Elemento | Rotación aplicada | Eje |
|---|---|---|
| `baseQuat` (grupo raíz) | -45º alrededor de X | Eje X mundial |
| `yokeQuat` (pan) | `panAngle` alrededor de Y | Eje Y local (ya inclinado -45º) |
| `headQuat` (tilt) | `tiltAngle` alrededor de X | Eje X local = Eje X mundial |

**Crítico**: `baseQuat` y `headQuat` comparten el **mismo eje de rotación físico** (X mundial) porque el pan es alrededor de Y. Esto significa que las rotaciones en X se **suman algebraicamente**:

- `baseQuat` = -45º en X
- `headQuat` en tilt=0.5 (DMX center) = `TILT_REST_ANGLE` = +45º en X
- **Rotación neta del head en mundo** = -45º + 45º = **0º**

**Resultado visual**:
- La **carcasa/base** está inclinada -45º (visible como bounding box torcida)
- El **head** apunta recto hacia abajo (0º, haz al suelo) en lugar de 45º forward
- El `TILT_REST_ANGLE` de +45º fue diseñado para que el head apunte 45º forward, pero el default `rotation: -45` lo cancela exactamente

### 1.4 TILT_REST_ANGLE y la compensación fantasma

**Archivo**: `HyperionMovingHead3D.tsx:72-75`

```typescript
// WAVE 4579 M3: Restaurado a +45°.
// WAVE 4578-B aplicó -Math.PI/4 por error (compensaba un drift que no existe en este eje).
const TILT_REST_ANGLE = Math.PI / 4
```

El comentario histórico revela que WAVE 4578-B **ya intentó** compensar con `-Math.PI/4`. Esto fue revertido en WAVE 4579 M3, pero el default `rotation: -45` en `ShowFileV2.ts` **permanece** como fuente de pitch fantasma. El comentario dice "compensaba un drift que no existe en este eje" — el "drift" que percibieron era probablemente la inclinación del grupo base, no del eje de tilt.

### 1.5 Conclusión Misión 1

- **NO** hay `Math.PI / 4` en `MOUNT_QUATERNIONS`.
- **SÍ** hay `rotation: { pitch: -45 }` como **default en el schema del showfile**, que se propaga como `baseRotation` al quaternion del grupo 3D.
- El `<group>` raíz NO tiene rotación hardcodeada adicional; toda la inclinación viene de `fixture.baseRotation`.
- La combinación `baseRotation = -45º` + `TILT_REST_ANGLE = +45º` produce un **cancelamiento de haz** (head apunta recto abajo) mientras la carcasa permanece visualmente inclinada.

---

## Misión 2: El Enigma del Traductor (Forward Kinematics)

### 2.1 Búsqueda de FK/Raycasting

Se ejecutaron búsquedas de texto completo en la base de código:

```
forward.*kinematics     → 0 matches
forwardKinematics       → 0 matches
raycast.*pan|raycast.*tilt  → 0 matches
pan.*tilt.*xyz|tilt.*pan.*xyz → 0 matches
```

**Veredicto**: No existe ninguna función de Forward Kinematics o raycasting que convierta pan/tilt en coordenadas espaciales métricas.

### 2.2 Pipeline de datos para un fixture isPlaced=true

**Escenario**: Comando manual de grados "Pan: 16, Tilt: -3" en un fixture `isPlaced: true`.

**Paso 1 — KineticSystem** (`core/aether/systems/KineticSystem.ts:165-323`)
- El sistema VMM genera `pan` y `tilt` normalizados (0-1).
- Escribe `this._valuesDict['pan']` y `this._valuesDict['tilt']`.
- **NO** escribe `targetX`, `targetY`, `targetZ`.

**Paso 2 — KineticAdapter** (`core/aether/adapters/KineticAdapter.ts:193-260`)
- Solo procesa intenciones del VMM (abstractas `[-1,+1]`).
- Convierte abstracto a `targetX/Y/Z` usando `stageBounds`.
- Si el intent original no viene del VMM (ej. override manual con pan/tilt), el adapter **no interviene**.

**Paso 3 — NodeArbiter**
- Arbitra entre intenciones. Si solo hay un intent con `pan`/`tilt`, el mapa arbitrado contiene `pan` y `tilt`. Sin `targetX`.

**Paso 4 — PhysicsPostProcessor** (`core/aether/resolver/PhysicsPostProcessor.ts:313-366`)
- Verifica `entry['targetX'] !== undefined`.
- Como `targetX` no existe, **no entra en la rama 3D**.
- Aplica inercia clásica a `pan`/`tilt` en espacio normalizado.

**Paso 5 — NodeResolver._writeNode** (`NodeResolver.ts:506-526`, WAVE 4617-B M1)

```typescript
if (!kineticNode.isContinuous && device.isPlaced === true) {
  this._writeNodeIK(kineticNode, channelValues, ...)
  return
}
```

El **Iron Gatekeeper** fuerza ruta IK SIEMPRE para `isPlaced === true`. Los canales `pan`/`tilt` en `channelValues` son **ignorados**.

**Paso 6 — _writeNodeIK** (`NodeResolver.ts:641-653`)

```typescript
const tx = channelValues[CH_TARGET_X] ?? 0
const ty = channelValues[CH_TARGET_Y] ?? 1.5
const tz = channelValues[CH_TARGET_Z] ?? 2.0
```

Como `CH_TARGET_X` no está presente (el pipeline solo llevaba `pan`/`tilt`):
- `tx = 0` (centro del escenario en X)
- `ty = 1.5` (altura de trabajo, ~cabeza de público)
- `tz = 2.0` (plano frontal del escenario)

### 2.3 Radiografía del canal targetX

**Archivo**: `core/aether/types.ts` (o `NodeResolver.ts` top-level)

```typescript
const CH_TARGET_X = 'targetX'
```

El canal `targetX` solo se inyecta en el pipeline por dos vías:
1. **KineticAdapter** (VMM → espacial) — produce `targetX/Y/Z` a partir de patrones abstractos.
2. **Override manual espacial** (SpatialTargetPad) — inyecta directamente `targetX/Y/Z`.

Si el operador usa controles clásicos de pan/tilt (ej. XY Pad, faders, o comando DMX directo), **ningún sistema** traduce esos valores a `targetX/Y/Z`.

### 2.4 Conclusión Misión 2

- **No existe Forward Kinematics**. El sistema Aether puede hacer IK (metros → grados) pero no FK (grados → metros).
- Para un fixture `isPlaced: true` con comando de pan/tilt puro, el Iron Gatekeeper fuerza la ruta IK, pero la IK no recibe coordenadas espaciales reales.
- Los valores `pan`/`tilt` llegan al NodeResolver, son leídos por `_writeNodeIK`... y **ignorados**. Solo `targetX/Y/Z` importan en la ruta IK.
- **Efecto visual**: el fixture espacial apunta a un punto fijo `(0, 1.5, 2.0)` en el espacio, independientemente de los comandos pan/tilt recibidos.

---

## Misión 3: Lectura Directa del Buffer IK

### 3.1 ¿Es (0, 1.5, 2.0) una asunción de log o una coordenada real?

**Archivo**: `NodeResolver.ts:649-653`

```typescript
const tx = channelValues[CH_TARGET_X] ?? 0
const ty = channelValues[CH_TARGET_Y] ?? 1.5
const tz = channelValues[CH_TARGET_Z] ?? 2.0
```

Estos son **fallbacks de código**, no asunciones de log. Cuando `channelValues` no contiene `targetX` (caso del 99% de los comandos pan/tilt), el motor IK resuelve para el punto `(0, 1.5, 2.0)`.

### 3.2 Contexto espacial del fallback

Con un escenario default de 8×4m (centerY=1.5, depth=2.0):
- `tx = 0` → centro horizontal del escenario.
- `ty = 1.5` → altura de los ojos del público (mitad de la altura del escenario).
- `tz = 2.0` → **frente del escenario** (borde downstage, `depth/2`).

**Esto NO es el centro del escenario en 3D** — es un punto en el proscenio, a la altura de la cara del público. Para un fixture colgado en Y=4m-5m, apuntar a (0, 1.5, 2.0) produce un vector con componente Y dominante (caída de ~3m) y componente Z menor (2m hacia adelante). El ángulo respecto al horizonte:

```
tan(θ) = ΔY / ΔZ = (5.0 - 1.5) / 2.0 = 3.5 / 2.0 = 1.75
θ = arctan(1.75) ≈ 60.3° debajo del horizonte
```

Si el fixture está más atrás (Z=-2, back truss), el cálculo cambia:
```
ΔZ = 2.0 - (-2.0) = 4.0
tan(θ) = 3.5 / 4.0 = 0.875
θ = arctan(0.875) ≈ 41.2° debajo del horizonte
```

Esto es consistente con la observación del usuario: "los focos apuntan al horizonte con una leve caída".

### 3.3 ¿Por qué TODOS los fixtures apuntan al mismo punto?

El fallback `(0, 1.5, 2.0)` es **idéntico para todos los fixtures**. No depende de:
- La posición física del fixture en el truss.
- El stereoIndex del nodo.
- El patrón VMM activo.
- Los comandos pan/tilt manuales.

Resultado: **todos los movers espaciales convergen al mismo punto del proscenio**, creando un efecto de "pile-up" luminoso en lugar de un barrido distribuido.

### 3.4 Conclusión Misión 3

- El fallback `(0, 1.5, 2.0)` es **código activo**, no un artefacto de logging.
- Es una coordenada espacial real que el IK engine resuelve cada frame.
- Para fixtures en back truss, apuntar a `(0, 1.5, 2.0)` produce un ángulo de ~41° bajo el horizonte — consistente con "al horizonte con una leve caída".
- Todos los fixtures sin targetX explícito convergen al **mismo punto**, explicando el pile-up visual.

---

## Matriz de Causalidad Cruzada

| Síntoma visual | Causa primaria | Archivo | Línea |
|---|---|---|---|
| Bounding box inclinada ~45º | `rotation: { pitch: -45 }` default en ShowFileV2 | `ShowFileV2.ts` | 1135 |
| Carcasa/base no horizontal | `baseQuat` incluye `fixture.baseRotation` en grupo raíz | `HyperionMovingHead3D.tsx` | 176-190 |
| Haz apunta al suelo (no 45º fwd) | Cancelamiento: `baseRotation -45º` + `TILT_REST_ANGLE +45º` | `HyperionMovingHead3D.tsx` | 75, 308 |
| Focos apuntan al mismo punto | Fallback fijo `(0, 1.5, 2.0)` en `_writeNodeIK` | `NodeResolver.ts` | 651-653 |
| Pan/tilt manuales ignorados | Iron Gatekeeper fuerza IK sin FK; no hay `targetX` | `NodeResolver.ts` | 516-523 |
| No hay barrido distribuido | KineticSystem emite `pan`/`tilt`; KineticAdapter no traduce para intenciones no-VMM | `KineticSystem.ts` | 312-314 |

---

## Recomendaciones de Remediación

### R1: Separar "base rotation" de "head rest angle"

El `rotation: { pitch: -45 }` en `ShowFileV2.ts` debe ser **cero por defecto** (`{ pitch: 0, yaw: 0, roll: 0 }`). La inclinación de 45º forward es una propiedad del **head/yoke**, no de la base de montaje. La base de un fixture de techo siempre debe ser horizontal (paralela al techo).

### R2: Implementar Forward Kinematics (FK) para comandos clásicos

Cuando un fixture `isPlaced: true` recibe comandos de `pan`/`tilt` sin `targetX/Y/Z`, el sistema debe:
1. Usar FK para convertir `(pan, tilt)` + `fixture.position` → `(targetX, targetY, targetZ)`.
2. Inyectar los canales espaciales derivados antes de `_writeNodeIK`.

Sin FK, el Iron Gatekeeper deja los fixtures espaciales "ciegos" a comandos pan/tilt tradicionales.

### R3: Fallback espacial proporcional a la posición del fixture

Si `targetX` sigue siendo undefined tras FK, el fallback no debe ser `(0, 1.5, 2.0)` para todos. Debería ser un punto relativo a la posición del propio fixture (ej. `fixture.position` proyectado al suelo, o el centro del escenario ajustado por `stereoIndex`).

---

*Fin del informe forense — WAVE 4618-A*
