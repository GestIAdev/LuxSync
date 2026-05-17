# WAVE-4862 - THE COLOR WHEEL PARADOX

## Estado
- Tipo: auditoria arquitectonica (sin implementacion)
- Alcance: L3 vs DarkSpin vs HarmonicQuantizer + trazado completo movers hasta hardware
- Metodo: forense de codigo (solo lectura)

## TL;DR
El bypass `skipDarkSpin` si viaja desde L3 hasta Safety, pero no garantiza inmunidad real cuando existe estado de transito previo en DarkSpin. La colision aparece por dos razones combinadas:
1. `checkDarkSpin()` retorna temprano con skip y no limpia/avanza estado previo de transito del nodo.
2. El barrido cross-node de DarkSpin opera por `deviceId` y mata dimmer/shutter de nodos IMPACT si cualquier COLOR del device sigue marcado en transito.

Resultado: aunque L3 pida bypass, el fixture puede quedarse oscurecido por un transito "heredado".

---

## 1) Colision L3 corto (200ms) vs DarkSpin (>=300ms)

### Hallazgo
Si el efecto L3 dura menos que `minTransitionMs` de rueda mecanica, la logica actual no modela una "ventana atomica" del efecto: solo marca bypass por frame. Cuando el estado de DarkSpin ya venia en transito, el blackout puede persistir y anular el impacto visual del efecto corto.

### Evidencia
- `skipDarkSpin` se combina por OR en Effects:
  - `electron-app/src/core/effects/EffectManager.ts:691`
  - `electron-app/src/core/effects/EffectManager.ts:781`
  - `electron-app/src/core/effects/EffectManager.ts:889`
- El adapter traslada ese flag a intents L3:
  - `electron-app/src/core/aether/adapters/selene-aether-adapter.ts:289`
  - `electron-app/src/core/aether/adapters/selene-aether-adapter.ts:523`
- El arbiter registra nodos con bypass:
  - `electron-app/src/core/aether/NodeArbiter.ts:761`
  - `electron-app/src/core/aether/NodeArbiter.ts:820`
- Orchestrator propaga al middleware de seguridad:
  - `electron-app/src/core/orchestrator/TitanOrchestrator.ts:1989`
- En Safety, `checkDarkSpin()` sale de inmediato si el nodo esta en skip:
  - `electron-app/src/core/aether/egress/AetherSafetyMiddleware.ts:304`
  - `electron-app/src/core/aether/egress/AetherSafetyMiddleware.ts:306`

### Mecanica de la paradoja
- L3 corto llega con bypass y evita crear/actualizar transito en ese tick.
- Pero si el nodo ya venia en `inTransit=true`, ese estado puede seguir vivo en `_darkSpinState`.
- El sweep cross-node usa ese estado acumulado y apaga IMPACT por device.

---

## 2) La trampa del Quantizer: "si no deja pasar el color, no hay cola"

### Hallazgo
El HarmonicQuantizer no encola cambios; solo decide `colorAllowed` por tick. Cuando bloquea, NodeResolver reconstruye un "held color" desde `lastAllowedColor`, por lo que el valor de rueda puede quedar retenido y no reflejar inmediatamente el pulso de L3.

### Evidencia
- Quantizer: gate binario sin queue:
  - `electron-app/src/hal/translation/HarmonicQuantizer.ts:154`
  - `electron-app/src/hal/translation/HarmonicQuantizer.ts:227`
- NodeResolver: si `colorAllowed=false`, usa `lastAllowedColor` y recalcula wheel DMX retenido:
  - `electron-app/src/core/aether/resolver/NodeResolver.ts:1476`
  - `electron-app/src/core/aether/resolver/NodeResolver.ts:1483`

### Implicacion
La salida cromatica en rueda puede quedar "atrasada" respecto al intento artistico de L3. Esto no es bug aislado del Quantizer: es contrato de diseño actual (gate, no scheduler).

---

## 3) Estado real del fix `skipDarkSpin` y por que falla

### Hallazgo principal
El bypass existe end-to-end, pero es incompleto respecto al estado interno de transito.

### Punto exacto de falla
`checkDarkSpin()` retorna `false` antes de tocar estado cuando el nodo esta en skip.
- Si habia `inTransit=true` de frames previos, no se desactiva ahi.
- Luego `getDarkSpinTransitNodeIds()` puede seguir reportando ese nodo como activo.

### Evidencia
- Return temprano por skip:
  - `electron-app/src/core/aether/egress/AetherSafetyMiddleware.ts:306`
- Fuente del sweep cross-node:
  - `electron-app/src/core/aether/egress/AetherSafetyMiddleware.ts:292`
  - `electron-app/src/core/aether/resolver/NodeResolver.ts:1110`
  - `electron-app/src/core/aether/resolver/NodeResolver.ts:1128`
- Efecto del sweep: mata dimmer/shutter de IMPACT del mismo device:
  - `electron-app/src/core/aether/resolver/NodeResolver.ts:1140`
  - `electron-app/src/core/aether/resolver/NodeResolver.ts:1158`

### Conclusiones de esta seccion
- No es un fallo de propagacion de flag (esa parte esta bien).
- Es un fallo de coherencia de estado entre bypass per-frame y maquina de estado DarkSpin acumulada.

---

## 4) Viaje completo movers: EffectManager -> hardware fisico

### Pipeline validado
1. `EffectManager.getCombinedOutput()` consolida L3 y calcula `skipDarkSpin` OR.
   - `electron-app/src/core/effects/EffectManager.ts:889`
2. `SeleneAetherAdapter.ingest()` captura `effectOutput.skipDarkSpin` y lo copia a intents de COLOR/IMPACT.
   - `electron-app/src/core/aether/adapters/selene-aether-adapter.ts:289`
   - `electron-app/src/core/aether/adapters/selene-aether-adapter.ts:523`
3. `IntentBus.push()` preserva `skipDarkSpin` en slot.
   - `electron-app/src/core/aether/IntentBus.ts:383`
4. `NodeArbiter.arbitrate()` registra nodos skip y aplica dominancia L3 por canal.
   - `electron-app/src/core/aether/NodeArbiter.ts:761`
   - `electron-app/src/core/aether/NodeArbiter.ts:744`
5. `TitanOrchestrator` pasa `getSkipDarkSpinNodeIds()` a `AetherSafetyMiddleware`.
   - `electron-app/src/core/orchestrator/TitanOrchestrator.ts:1989`
6. `NodeResolver.resolve()` traduce a DMX (ColorTranslator + HarmonicQuantizer + DarkSpin checks).
   - `electron-app/src/core/aether/resolver/NodeResolver.ts:1476`
   - `electron-app/src/core/aether/resolver/NodeResolver.ts:1508`
7. `NodeResolver` ejecuta barrido cross-node DarkSpin (COLOR->IMPACT por device).
   - `electron-app/src/core/aether/resolver/NodeResolver.ts:1110`
8. Egress gate/throttle decide envio final por universo al HAL/hardware.
   - `electron-app/src/core/aether/egress/AetherSafetyMiddleware.ts:352`

### Respuesta directa a la pregunta del viaje
No hay "Aduana" separada con otro nombre de archivo para este caso; la aduana efectiva esta repartida entre `TitanOrchestrator` + `AetherSafetyMiddleware` + `NodeResolver` (intra-resolve y sweep post-escritura).

---

## 5) Viabilidad de la "Ley de Herencia" propuesta

## Propuesta evaluada
"Si `effectDuration < 500ms` y fixture tiene color wheel -> activar `skipDarkSpin` automaticamente en Hephaestus/SeleneAetherAdapter"

### Veredicto
- Viable a nivel conceptual: SI.
- Viable inmediata sin deuda tecnica: NO, faltan datos en el punto correcto del pipeline.

### Por que no es inmediata
- `CombinedEffectOutput` actual expone `skipDarkSpin`, pero no transporta metadatos estables de duracion efectiva por nodo/fixture para decidir herencia automatica en adapter.
  - `electron-app/src/core/effects/types.ts:530`
  - `electron-app/src/core/effects/EffectManager.ts:889`
- El adapter no conoce por si solo si el nodo/fixture destino tiene rueda mecanica elegible en tiempo de emision del intent.
  - `electron-app/src/core/aether/adapters/selene-aether-adapter.ts:500`
- Esa elegibilidad hoy se decide en resolver por `_isDarkSpinEligibleColorNode()`.
  - `electron-app/src/core/aether/resolver/NodeResolver.ts:1536`

### Arquitectura recomendada (sin codificar aqui)
1. Definir herencia en una unica capa de decision (no duplicar en EffectManager y adapter).
2. Llevar metadato de "ventana corta" de forma explicita (no inferencia implita por frame).
3. Evaluar elegibilidad mecanica con informacion de nodo real (wheel fisica + minTransitionMs).
4. Mantener determinismo: regla pura basada en duracion y capacidad, sin heuristicas aleatorias.

---

## 6) Respuestas cortas a tus 4 preguntas

1. "L3 de 200ms choca con DarkSpin de 300ms?"
- Si. Choca por diferencia de ventanas temporales y por estado de transito persistente.

2. "Quantizer trampa que no deja pasar y no encola?"
- Si. El quantizer actual es gate, no cola. Si bloquea, el resolver mantiene ultimo color permitido.

3. "SkipDarkSpin roto en NodeResolver/Aduana?"
- Parcialmente roto por coherencia de estado: el bypass se propaga bien, pero el estado previo de transito puede seguir activando el sweep cross-node.

4. "Viaje completo movers hasta hardware?"
- Trazado completo confirmado: EffectManager -> SeleneAetherAdapter -> IntentBus -> NodeArbiter -> TitanOrchestrator/AetherSafetyMiddleware -> NodeResolver -> HAL.

---

## 7) Riesgos abiertos
- Riesgo de blackout fantasma cuando un nodo entra en skip durante o inmediatamente despues de un transito previo.
- Riesgo de percepcion artistica "late color" por contrato actual del Quantizer (gate sin queue).
- Riesgo de decisiones duplicadas si la "Ley de Herencia" se reparte en varias capas.

## 8) Cierre
El "Paradoja Color Wheel" no es un bug aislado de una linea: es un desacople entre politicas temporales (L3 corto), maquina de estado de DarkSpin y contrato del Quantizer. La base de propagacion de `skipDarkSpin` ya existe y esta bien cableada; el punto critico real es la consistencia del estado de transito y su impacto cross-node por device.
