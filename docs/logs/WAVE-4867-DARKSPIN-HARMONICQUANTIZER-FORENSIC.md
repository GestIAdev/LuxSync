# WAVE 4867 — Informe Forense: DarkSpin, HarmonicQuantizer y Pintado de Movers

## Resumen Ejecutivo

El sistema de color en LuxSync no tiene una sola compuerta. Tiene una cadena de compuertas separadas:

1. `ColorTranslator` decide si un color requiere rueda física, RGBW, CMY o passthrough.
2. `HarmonicQuantizer` decide si el cambio de color puede ocurrir en ese instante musical.
3. `HardwareSafetyLayer` aplica debounce pasivo si el fixture es mecánico.
4. `DarkSpinFilter` apaga temporalmente el fixture durante el tránsito físico de la rueda.
5. `skipDarkSpin` permite saltarse ese blackout mecánico de tránsito.

La conclusión más importante es esta:

- `HarmonicQuantizer` solo gatea cambios de color.
- `DarkSpinFilter` solo protege el tránsito de rueda mecánica.
- Ninguno de los dos apaga de forma global el dimmer, el strobe o el resto de la escena.
- `skipDarkSpin` es un bypass explícito para no hacer blackout durante el cambio de rueda.

Si el objetivo arquitectónico es: "si un efecto es demasiado rápido para la rueda, no cambia de color y ya; solo conserva strobe/dimmer", entonces `skipDarkSpin` va en dirección contraria a esa política. No es un detalle menor; es un bypass real de protección física.

## Cadena de Responsabilidad

### 1) Traducción de color físico

El punto de entrada físico está en [ColorTranslator.ts](electron-app/src/hal/translation/ColorTranslator.ts).

- RGB puro sin rueda física pasa directo.
- RGBW se descompone en blanco + cromáticos.
- CMY se traduce a canales sustractivos.
- Si el fixture usa rueda mecánica, entra al flujo de cuantización y seguridad.

Punto clave: la rueda solo existe si el perfil la declara. Si no hay `colorWheel`, el sistema no fabrica un tránsito mecánico artificial.

### 2) Cuantización musical del color

`HarmonicQuantizer` vive en [HarmonicQuantizer.ts](electron-app/src/hal/translation/HarmonicQuantizer.ts).

Su contrato real es estrecho:

- Si no hay color nuevo, no hace nada.
- Si la confianza BPM es baja, deja pasar.
- Si el color no cambió, no consume gate.
- Si el cambio está dentro del período armónico, bloquea el cambio de color.
- Si el período ya pasó, permite el cambio.

Lo crítico aquí es lo que no toca:

- No escribe dimmer.
- No escribe shutter.
- No escribe movimiento.

Eso está documentado en su propio módulo y se ve en el código: solo controla color. Por tanto, si un efecto "se ve" a pesar de que el color no cambia, la causa no está en el cuantizador. Está en otra capa que sigue moviendo luminancia.

### 3) Debounce físico de seguridad

`HardwareSafetyLayer` en [HardwareSafetyLayer.ts](electron-app/src/hal/translation/HardwareSafetyLayer.ts) es todavía más simple:

- Si el fixture no es mecánico, passthrough.
- Si es mecánico, solo aplica debounce pasivo por `minChangeTimeMs`.
- No inventa blackouts de espectáculo.
- No gestiona strobes.
- No gestiona color creativo.

Es una capa de seguridad física, no una capa artística.

### 4) DarkSpin: blackout del tránsito mecánico

El núcleo del problema está en [DarkSpinFilter.ts](electron-app/src/hal/translation/DarkSpinFilter.ts).

La regla es directa:

- Si cambia el DMX de la rueda de color, activa tránsito.
- Mientras el tránsito está activo, fuerza `dimmer = 0`.
- Al terminar el tránsito, libera el blackout.

Eso significa que DarkSpin no cambia el color por sí mismo. Lo que hace es ocultar el cristal intermedio mientras la rueda gira.

### 5) Dónde entra `skipDarkSpin`

`skipDarkSpin` es un campo explícito del output de efectos en [core/effects/types.ts](electron-app/src/core/effects/types.ts).

Flujo real:

- El efecto lo declara en su output.
- `EffectManager` lo acumula en el output combinado.
- `TitanOrchestrator` lo propaga al middleware de seguridad.
- `AetherSafetyMiddleware` registra los nodos que lo pidieron.
- `DarkSpinFilter` consulta ese set.

La prueba está en:
- [EffectManager.ts](electron-app/src/core/effects/EffectManager.ts) donde se acumula `skipDarkSpin`.
- [TitanOrchestrator.ts](electron-app/src/core/orchestrator/TitanOrchestrator.ts) donde se llama `setSkipDarkSpinNodes(...)`.
- [AetherSafetyMiddleware.ts](electron-app/src/core/aether/egress/AetherSafetyMiddleware.ts) donde `checkDarkSpin(...)` devuelve `false` si el nodo está en el set de bypass.
- [IntentBus.ts](electron-app/src/core/aether/IntentBus.ts) donde el flag se conserva al cruzar el bus.

Interpretación forense:

`skipDarkSpin` no es un comentario ni un marcador. Es un bypass funcional. Si está activo, el fixture deja de recibir el blackout de transición mecánica.

## Por Qué Unos Efectos Pintan Movers Y Otros No

La respuesta no es una sola causa. Es una combinación de 4 filtros:

### A) Zona declarada por el efecto

Los efectos no pintan todo el show por magia. Pintan las zonas que declaran en `zoneOverrides`.

Ejemplo claro: [CumbiaMoon.ts](electron-app/src/core/effects/library/fiestalatina/CumbiaMoon.ts)

- `front` → color blanco lunar + dimmer
- `back` → color blanco lunar + dimmer más bajo
- `all-movers` → color blanco lunar + dimmer muy bajo

Eso ya explica por qué CumbiaMoon sí puede llegar a movers: el propio efecto los nombra.

### B) Mapeo de zonas a nodos reales

La traducción de zona abstracta a nodos físicos la hace [ZoneNodeRouter.ts](electron-app/src/core/aether/adapters/helpers/zone-node-router.ts).

- `all-movers` se resuelve como unión determinista de `movers`, `movers-left`, `movers-right`.
- `front`, `back`, `floor` se expanden con sus subzonas.
- Si la zona no existe, devuelve array vacío compartido.

Es decir: si un efecto no declara una zona que el router entienda, no hay pintado físico.

### C) Mover shield y pasaporte diplomático

Hay una protección especial para movers con rueda física.

`NodeArbiter` tiene un escudo de mover para L1 y un pasaporte de Selene:

- El escudo bloquea color en movers por defecto.
- `overrideMoverShield` puede abrir la puerta.
- En [selene-aether-adapter.ts](electron-app/src/core/aether/adapters/selene-aether-adapter.ts) el `blendMode` `max` se traduce a `HTP`, o sea: el efecto blando puede tintar sin matar el brillo base.

Eso significa que no todos los efectos pintan movers. Solo los que:
- declaran la zona correcta,
- tienen señal cromática o blanca real,
- y superan el escudo de movers cuando aplica.

### D) Familia de nodo y capacidad real

El flujo L0/L1/L3 no es abstracto solamente. Se topa con la familia real del nodo:

- COLOR nodes reciben `brightness` o RGB según el adapter.
- IMPACT nodes reciben `dimmer` y strobe.
- Los efectos que no tocan color no pintan cromática, solo luminancia o movimiento.

Por eso ves una diferencia entre:

- efectos que pintan movers,
- efectos que solo los hacen respirar,
- y efectos que no los pintan en absoluto.

## El Caso CumbiaMoon

CumbiaMoon es un buen ejemplo porque combina tres cosas a la vez:

- declara `front`, `back` y `all-movers`,
- usa blanco lunar (`moonWhite`),
- y marca `blendMode: 'max'` en `front` y `back`.

Eso tiene dos consecuencias:

1. El blanco sí puede heredar en fixtures donde el color pase por hardware.
2. La luminancia no queda apagada por diseño, porque `max` está pensado para no bajar energía.

Por eso en simulador se ve la luna blanca con un fondo donde todavía asoman beats más intensos. No es una fuga misteriosa: es la suma de un efecto aditivo/blando con una capa de luminancia que sigue viva.

## Veredicto Sobre `skipDarkSpin`

### Función real

`skipDarkSpin` existe para que ciertos efectos cortos puedan ignorar el blackout de rueda mecánica.

### Efecto real

- Evita que el fixture se apague durante el tránsito de rueda.
- Permite ver el cambio de color más rápido, o mantener continuidad visual.

### Impacto arquitectónico

Si la política nueva es:

- "no queremos ningún cambio de color visible si la rueda no alcanza",
- "preferimos no cambiar color antes que mostrar un tránsito",
- "solo dimmer/strobe pueden seguir vivos",

entonces `skipDarkSpin` va contra esa doctrina.

### Diagnóstico duro

`skipDarkSpin` es una compuerta de excepción. Si se mantiene, la ley física del DarkSpin deja de ser absoluta.

## Conclusión Final

El motivo por el que algunos efectos se pintan en movers y otros no es una combinación de:

- zona declarada,
- mapeo de zona a nodos,
- escudo de movers,
- tipo de nodo,
- y si el efecto emite color real o solo luminancia.

El motivo por el que DarkSpin existe es proteger la rueda física de color. El motivo por el que HarmonicQuantizer existe es no disparar cambios imposibles demasiado rápido.

Pero `skipDarkSpin` rompe la parte más estricta de esa protección. Si el nuevo mandato del show es "si no llega a tiempo, no cambia de color", entonces este bypass es candidato serio a extirpación.

## Referencias Clave

- [DarkSpinFilter.ts](electron-app/src/hal/translation/DarkSpinFilter.ts)
- [HarmonicQuantizer.ts](electron-app/src/hal/translation/HarmonicQuantizer.ts)
- [HardwareSafetyLayer.ts](electron-app/src/hal/translation/HardwareSafetyLayer.ts)
- [HardwareAbstraction.ts](electron-app/src/hal/HardwareAbstraction.ts)
- [ColorTranslator.ts](electron-app/src/hal/translation/ColorTranslator.ts)
- [AetherSafetyMiddleware.ts](electron-app/src/core/aether/egress/AetherSafetyMiddleware.ts)
- [TitanOrchestrator.ts](electron-app/src/core/orchestrator/TitanOrchestrator.ts)
- [EffectManager.ts](electron-app/src/core/effects/EffectManager.ts)
- [CumbiaMoon.ts](electron-app/src/core/effects/library/fiestalatina/CumbiaMoon.ts)
- [zone-node-router.ts](electron-app/src/core/aether/adapters/helpers/zone-node-router.ts)
- [selene-aether-adapter.ts](electron-app/src/core/aether/adapters/selene-aether-adapter.ts)
