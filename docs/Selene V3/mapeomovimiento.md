WAVE 7171 — AUDITORÍA: Transiciones Cinemáticas y Seguridad de Hardware
1. El Muro del Árbitro (The Blockade)
1.1 Confirmación: Selene IA circula por L1, NO por L3
La sospecha del usuario es parcialmente correcta pero requiere precisión.

El sistema tiene dos rutas Selene distintas:

Selene IA cognitiva (dimmer/color/strobe) → circula por L1 ('selene' layer). El SeleneAetherAdapter emite al _seleneBus con source='effect' y priority=300, pero el NodeArbiter lo procesa como capa 'selene' (L1) — ver @/electron-app/src/core/aether/NodeArbiter.ts:660-666:


if (this._seleneBus !== null) {
  const count = this._seleneBus.count
  for (let i = 0; i < count; i++) {
    this._applyIntent(this._seleneBus.getAt(i), 'selene')
  }
}
LiveFX/EffectManager (efectos en vivo) → circula por L3 ('effect' layer). El _effectBus se alimenta vía aetherArbiter.setEffectIntents(this._effectBus.getAll()) — @/electron-app/src/core/orchestrator/tick/TickEngine.ts:1223.
Hephaestus custom clips → circula por L3+ ('hephaestus' layer) — @/electron-app/src/core/aether/adapters/HephaestusAetherAdapter.ts:196.
El comentario en SeleneAetherAdapter (@/electron-app/src/core/aether/adapters/selene-aether-adapter.ts:16) es explícito:

❌ NUNCA emite targetX/Y/Z, pan, tilt (L3 bloqueado de movimiento)

Y en la línea 394:

❌ override.movement → DESCARTADO (Regla L3: movimiento ≡ KineticAdapter)

1.2 El Bloqueo — Tres Muros Concatenados
El bloqueo de pan/tilt y coordenadas XYZ desde efectos opera en tres niveles:

Muro 1: Bloqueo en origen (SeleneAetherAdapter)
@/electron-app/src/core/aether/adapters/selene-aether-adapter.ts:16,394

El SeleneAetherAdapter nunca emite pan, tilt, targetX, targetY, targetZ. El campo movement de zoneOverrides se descarta explícitamente. No hay siquiera intent que llegue al arbiter.

Muro 2: L3 Supremacy / Escudo Anti-Sangrado (NodeArbiter._applyIntent)
@/electron-app/src/core/aether/NodeArbiter.ts:1120-1163

Cuando L3 (effect/hephaestus) escribe un canal, se registra en _l3DominatedChannels. En el mismo frame, si L0 o L1 intentan escribir ese canal en ese nodo, el guard los bloquea:



typescript
// Línea 1122-1124: obtener canales dominados por L3
const l3DominatedChannels = (layer === 'system' || layer === 'selene')
  ? this._l3DominatedChannels.get(intent.nodeId)
  : undefined
 
// Línea 1162-1164: bloqueo efectivo
if (l3DominatedChannels?.has(channel) === true) {
  continue
}
Sin embargo, este mecanismo no bloquea pan/tilt desde L3 hacia L0 — al contrario, protege L3 de ser sobreescrito por L0/L1. El bloqueo de movimiento es unidireccional: L3 puede escribir pan/tilt y L0/L1 son silenciados, pero el SeleneAetherAdapter nunca lo hace por la regla del Muro 1.

Muro 3: L0 FREEZE durante release fade
@/electron-app/src/core/aether/NodeArbiter.ts:1166-1175



typescript
if (layer === 'system' && this._releaseStates.has(intent.nodeId)) {
  if (channel === 'pan' || channel === 'tilt') {
    continue
  }
}
Durante un release fade (post-Unlock manual), L0 no puede escribir pan/tilt. El fixture permanece congelado en la posición del snapshot hasta que el fade completa.

Muro 4: AetherSafetyMiddleware (post-arbitraje, pre-DMX)
@/electron-app/src/core/aether/egress/AetherSafetyMiddleware.ts:172-262

Después del arbitraje, el NodeResolver aplica velocity clamping y airbag sobre los valores finales de pan/tilt:

Velocity Limiter (líneas 178-217): clamp por vibe (VIBE_REV_LIMITS), cap absoluto KINETIC_SAFETY_CAP_VEL=350 DMX/s, teleport threshold 200ms.
Airbag (líneas 257-262): margen mecánico de 5 DMX en ambos extremos (0-5 y 250-255).
Esto no bloquea movimiento, pero limita su velocidad — un efecto que pida "Vete a 250,180 YA" será limitado a 300 DMX/s en techno (≈1.2s para barrer 0→255).

1.3 Conclusión del Bloqueo
El bloqueo de movimiento desde efectos es por diseño en el adapter, no en el arbiter. El SeleneAetherAdapter descarta movement en línea 394. El HephaestusAetherAdapter sí puede emitir pan/tilt (líneas 405-417 de HephaestusAetherAdapter.ts), y cuando lo hace, el arbiter le da supremacía total sobre L0/L1 vía _l3DominatedChannels.

No hay un "muro" que filtre pan/tilt de L3 en el arbiter. El muro está en el adapter de Selene que nunca los emite.

2. Arqueología de Interpolación (The Opus Ghost)
2.1 Sobreviviente principal: PhysicsPostProcessor (WAVE 4518.1)
@/electron-app/src/core/aether/resolver/PhysicsPostProcessor.ts

Este es el motor de inercia activo en el pipeline actual. Posición: NodeArbiter → [PhysicsPostProcessor] → NodeResolver.

Lo que hace:

Modo CLASSIC: curva-S con aceleración/deceleración física real. Calcula distancia de frenado v² / (2*maxAcc), acelera si está lejos, frena si está cerca. Clamp por SAFETY_MAX_VELOCITY_NORM=5.0 y SAFETY_MAX_ACCELERATION_NORM=20.0 en espacio normalizado.
Modo SNAP: desplazamiento fraccional snapFactor * (target - current), clampeado por maxVel * dt.
Inercia 3D espacial (WAVE 4617-B M3): aplica la misma física de curva-S a targetX/Y/Z en espacio métrico (metros), escalado por dimensiones del escenario.
Teleport mode: si deltaMs > 200ms, copia targets directamente (el motor estuvo congelado).
Anti-jitter: deltas < 0.0005 se ignoran.
Seed/Reset (WAVE 6020): seedClassicState() y resetSpatialState() para transiciones limpias entre modo IK y modo clásico.
Este NO es un remanente de Opus — es un motor de inercia completo y funcional. Es el sucesor directo del FixturePhysicsDriver.applyPhysicsEasing() legacy.

2.2 Sobreviviente secundario: Release Fades (NodeArbiter._applyReleaseFades)
@/electron-app/src/core/aether/NodeArbiter.ts:1439-1509

Interpolación ease-out cúbica cuando se libera un override manual L2:



blended = releaseValue * fadeWeight + l0Value * (1.0 - fadeWeight)
SLOW_RELEASE_CHANNELS: pan, tilt, zoom, focus, rotation (líneas 108-110)
RELEASE_MS_FAST=150, RELEASE_MS_SLOW=600
IK_POISON_KEYS (targetX/Y/Z, focusX/Y/Z) no se interpolan — se resetean directamente.
Gimbal lock fade: atenúa pan offset cuando tilt está cerca del cenit.
2.3 Sobreviviente terciario: Relative Offset Fusion (NodeArbiter._applyRelativeOffsetFusion)
@/electron-app/src/core/aether/NodeArbiter.ts:862-1025

Combina pan_base/tilt_base (de L2 manual o IK) con pan_offset/tilt_offset (de L0 VMM o L3 Hephaestus):



pan_final = clamp01(pan_base + pan_offset * amp * aspect)
Gimbal factor: atenúa offset cuando tilt_base está cerca del cenit.
Tilt clamping: TILT_ARBITER_MAX=0.95, TILT_ARBITER_MIN=0.05.
2.4 Sobreviviente en AetherSafetyMiddleware
@/electron-app/src/core/aether/egress/AetherSafetyMiddleware.ts:178-251

Velocity clamping post-resolución — es un slew-rate limiter puro: limita deltaDMX/dt a un máximo por vibe. Esto es la última capa de seguridad antes del hardware.

2.5 Legacy: KineticSystem (Gearbox Budget)
@/electron-app/src/core/aether/systems/KineticSystem.ts:296-305

El KineticSystem (no el KineticAdapter) tiene un gearbox budget inline:



typescript
const maxPanDeltaPerMs = node.maxPanSpeed / (540 * 1000)
const maxTiltDeltaPerMs = node.maxTiltSpeed / (270 * 1000)
const maxPanDelta = maxPanDeltaPerMs * deltaMs
const limitedPan = currentPan + clampDelta(panDelta, maxPanDelta)
Esto es un slew-rate limiter en espacio normalizado, operando ANTES del IntentBus. Limita la velocidad del patrón VMM a lo que el motor físicamente puede seguir.

2.6 Conclusión de Arqueología
No se encontraron remanentes muertos de Opus. Lo que existe es un sistema de interpolación/inercia vivo y multicapa:

Capa	Componente	Tipo	Estado
Pre-bus	KineticSystem	Slew-rate (gearbox budget)	Activo
Post-arbiter	PhysicsPostProcessor	Inercia curva-S + 3D	Activo
Post-arbiter	NodeArbiter._applyReleaseFades	Ease-out cúbico	Activo
Post-arbiter	NodeArbiter._applyRelativeOffsetFusion	Fusión base+offset	Activo
Post-resolver	AetherSafetyMiddleware.clampKineticVelocity	Slew-rate DMX	Activo
Post-resolver	AetherSafetyMiddleware.applyAirbag	Margen mecánico	Activo
El "Opus Ghost" no es un fantasma — es una cadena completa de 6 capas de suavizado. El problema no es falta de interpolación, sino que el adapter de Selene nunca emite pan/tilt, por lo que ninguna de estas capas recibe intents de movimiento desde efectos.

3. Estructura del Payload de Movimiento (Effect Intent)
3.1 ¿Cómo empaqueta Hephaestus el movimiento en el .lfx?
El flujo completo cuando un efecto pide "Vete a 250,180 YA, parate 6 segundos":

Paso 1: Definición del clip (.lfx v3)

El clip .lfx contiene tracks con HephParamId que incluyen 'pan' y 'tilt' (@/electron-app/src/core/hephaestus/types.ts:619):



typescript
const MOVEMENT_PARAMS: HephParamId[] = ['pan', 'tilt']
Los keyframes definen curvas en [0,1] normalizado. El CurveEvaluator evalúa cada parámetro en timeMs → retorna number (0-1) para pan/tilt.

Paso 2: HephaestusRuntime.tick()

@/electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts

El runtime evalúa las curvas y produce HephFixtureOutput[]:

parameter: 'pan' → value: coarseByte (0-255), fineByte: LSB, normalizedValue: 0-1
parameter: 'tilt' → igual
Pan/tilt son 16-bit: val16 = normalizedValue * 65535, coarse = MSB, fine = LSB
Paso 3: HephaestusAetherAdapter.ingest()

@/electron-app/src/core/aether/adapters/HephaestusAetherAdapter.ts:350-417

El adapter recibe HephFixtureOutput[] y traduce a INodeIntent:



typescript
case 'pan':
  if (behavior === 'relative_offset') {
    values['pan_offset'] = _toOffset(output.normalizedValue)  // [0,1] → [-1,+1]
  } else {
    values['pan'] = output.normalizedValue  // absoluto [0,1]
  }
  break
case 'tilt':
  if (behavior === 'relative_offset') {
    values['tilt_offset'] = _toOffset(output.normalizedValue)
  } else {
    values['tilt'] = output.normalizedValue
  }
  break
El spatialBehavior del clip determina si el movimiento es absoluto (pan/tilt directo) o relativo (pan_offset/tilt_offset que se suma al base IK).

Paso 4: Inyección al Arbiter



typescript
arbiter.setHephaestusIntents(this._frameIntents)  // L3+ priority=350, source='hephaestus'
Paso 5: Arbitraje

El arbiter procesa L3+ después de L0/L1 pero antes del manual hard lock. Como L3+ registra dominancia (_registerL3Dominance), L0/L1 quedan silenciados en los canales que Hephaestus escribió.

Paso 6: Post-procesamiento

El PhysicsPostProcessor aplica inercia sobre pan/tilt del ArbitratedNodeMap. Si el clip pide "250,180 YA", el PPP no teleporta — aplica curva-S con aceleración/deceleración limitada por maxPanSpeed/maxTiltSpeed del motor.

Paso 7: Resolución + Safety

El NodeResolver convierte normalizado → DMX. El AetherSafetyMiddleware aplica velocity clamp + airbag como última barrera.

3.2 ¿Qué pasa con Selene IA (no Hephaestus)?
Cuando Selene decide un efecto (ej. "CorazonLatino"), el flujo es:

SeleneTitanConscious.think() → ConsciousnessOutput + CombinedEffectOutput
SeleneHephBridge.route() decide si va por Hephaestus (HIT) o legacy (MISS)
Si HIT → playHook → HephaestusRuntime.play() → el clip se ejecuta y produce HephFixtureOutput[] → pasa por el flujo de Hephaestus descrito arriba
Si MISS → SeleneAetherAdapter.ingest() procesa el CombinedEffectOutput → descarta movement (línea 394) → solo emite dimmer/color/strobe al _seleneBus (L1)
Por lo tanto, Selene IA SÍ puede generar movimiento, pero solo si el efecto está registrado en el DynamicEffectRegistry con un clip .lfx que contenga tracks de pan/tilt. En ese caso, el movimiento circula por L3+ (Hephaestus), no por L1 (SeleneAetherAdapter).

3.3 El "silencio spatial" del bridge
@/electron-app/src/core/arsenal/SeleneHephBridge.ts:228-235

El bridge tiene un mecanismo de silenceSpatial: si el clip declara spatialBehavior='absolute' Y hay IK target activo, marca silenceSpatial=true. Esto no bloquea el clip — solo indica al caller que debe filtrar pan/tilt del output. Pero este filtrado no está implementado en HephaestusAetherAdapter.ingest() — el adapter no lee silenceSpatial del ResolvedPlayParams. El flag se calcula pero nadie lo consume.

Resumen Ejecutivo
Punto	Hallazgo
1. El Muro	El bloqueo NO está en el arbiter. Está en SeleneAetherAdapter línea 394 que descarta movement. Hephaestus sí puede emitir pan/tilt por L3+ y recibe supremacía.
Selene IA por L3	Selene cognitivo va por L1 ('selene'). Los efectos de Selene que tienen clip .lfx van por L3+ ('hephaestus') vía SeleneHephBridge → HephaestusRuntime.
2. Opus Ghost	No hay código muerto. Existen 6 capas vivas de interpolación/slew-rate: KineticSystem gearbox, PhysicsPostProcessor (curva-S), Release Fades (ease-out), Relative Offset Fusion, AetherSafetyMiddleware velocity clamp + airbag.
3. Payload Hephaestus	.lfx → keyframes pan/tilt [0,1] → HephaestusRuntime evalúa → HephFixtureOutput (16-bit coarse+fine) → HephaestusAetherAdapter traduce a INodeIntent (pan/tilt absoluto o pan_offset/tilt_offset relativo) → Arbiter L3+ → PhysicsPostProcessor (inercia) → NodeResolver → AetherSafetyMiddleware (velocity clamp) → DMX.
Bug latente	SeleneHephBridge.silenceSpatial se calcula pero HephaestusAetherAdapter no lo consume. Si un clip absoluto corre con IK activo, pan/tilt del clip compite con el target IK sin filtrar.


