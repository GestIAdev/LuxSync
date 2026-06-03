# WAVE 4968: PHOTONIC & HAL PIPELINE TRACE

## 1. Los Motores Visuales (Adapters/Engines)
**¿Cómo se invocan y están protegidos por alguna condición que falla en silencio?**

Dentro de `TickEngine.tick()`, a partir de la línea 781, el código intenta recuperar las referencias a los motores visuales (ej. `this._colorAdapter`, `this._liquidAetherAdapter`) que dependen de los getters configurados en `this.ctx`.

Inmediatamente después, en la línea 791, existe un guardia masivo (el **Silencio Letal**):

```typescript
if (
  !aetherArbiter ||
  !aetherResolver ||
  !colorAdapter ||
  !kineticAdapter ||
  !beamAdapter ||
  !atmosphereAdapter ||
  !liquidAetherAdapter ||
  !seleneAetherAdapter
) {
  // Lazy-init safety guard: si la matriz no existe todavía, salimos sin tocar el pipeline legacy.
} else {
  // Todo el flujo visual Aether...
}
```

**Diagnóstico:** Como se confirmó en auditorías previas de la instanciación de `TickEngine` en `TitanOrchestrator.ts`, **TODOS** los adaptadores Aether (`_colorAdapter`, `_liquidAetherAdapter`, `_kineticAdapter`, `_beamAdapter`, `_atmosphereAdapter`, etc.) fueron inyectados al contexto por valor (`_colorAdapter: this._colorAdapter`) en lugar de getters vivos. 
En el momento del arranque, estos adaptadores son `undefined`, por lo que el `TickEngine` almacena `undefined` para siempre. Esto provoca que la evaluación del `if` sea verdadera en CADA FRAME, bloqueando en silencio absoluto toda la ejecución del bloque `else` donde viven `.process()` e `.ingest()`.

## 2. El Estado del Vibe
**¿El motor está leyendo el Vibe o lee null?**

Dentro del `else` inaccesible de `TickEngine` (línea 830), el motor intenta mapear el Vibe al perfil de Aether:
```typescript
const _v = this._aetherVibe as VibeProfile & Record<string, unknown>
_v.name = this.engine.getCurrentVibe()
_v.intensity = intent.masterIntensity ?? engineAudioMetrics.energy
```
**Diagnóstico:** Aunque `this.engine.getCurrentVibe()` es funcional (gracias a que `engine` ahora es un getter vivo y de hecho se usa al final del frame para el HotFrame broadcast), el bloque interno que rutea esta intención de Vibe al pipeline DMX (Aether) **nunca se ejecuta**. El perfil de Vibe (`_aetherVibe`) destinado al bus de hardware permanece completamente inerte y desactualizado, sin importar la música.

## 3. El Puente de Salida (HardwareDispatcher / HAL)
**¿Cómo recibe HAL la referencia y quién llama el envío de datos?**

Al final del bloque `else` bloqueado (línea 1030+), el `TickEngine` es directamente responsable de empujar los datos al HAL. Lo hace de la siguiente manera:
1. `this.hal.setAetherOutputGateState(outputEnabled, blackoutActive)`
2. Un bucle por cada `universe` registrado en `aetherResolver` que invoca `this.hal.sendUniverseRaw(universe, egressBuf)`
3. Un pulso final con `this.hal.flushAetherEgress()`

**Diagnóstico de Contexto:** 
- `this.hal` actualmente está vivo y no es `null` (fue arreglado en WAVE 4967 al inyectar `get hal()`). 
- Sin embargo, los objetos como `aetherResolver` son `undefined` (atrapados por el guardia superior).
- Además, `this.fixtures` también había sido capturado por valor en el constructor antes del arreglo reciente, lo que significa que el motor carecía del mapa de dispositivos para generar la topología visual de antemano.
- Como todo el bloque de egreso (`sendUniverseRaw`, `flushAetherEgress`) vive en el `else` prisionero, el HAL (y el Worker DMX) nunca recibe un byte del nuevo pipeline y queda "flotando", asumiendo que no hay datos DMX para renderizar.

## 4. Silencios Letales
Se encontró el mayor silencio letal del flujo:

*   **El "Lazy-init Safety Guard" Vacío:** El bloque `if` de las líneas 791-801 actúa como una barrera impenetrable. Como el orquestador congeló los adaptadores en su estado pre-inicializado (`undefined`), el bucle de latido (tick) salta más de 300 líneas de código visual en cada cuadro (23ms). Ningún error `TypeError` explota porque el código esquiva proactivamente la ejecución asumiendo "aún no hemos inicializado". Todo el motor de luz, color, cinemática y láser está "apagado pero sin hacer ruido".
