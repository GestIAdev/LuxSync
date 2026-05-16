# WAVE 4834 — AUDITORÍA DE CAPAS: por qué L0 sigue vivo debajo de los soft effects de L3

## Estado

- Fecha: 2026-05-16
- Alcance: auditoría únicamente, sin cambios de código
- Pregunta auditada: por qué CumbiaMoon y CorazonLatino siguen respirando con el beat de L0 en vez de imponer su propio dimmer

---

## Veredicto corto

El bug de ZoneNodeRouter ya no es el problema. El comportamiento actual nace de una decisión arquitectónica posterior:

1. Los efectos soft declaran `blendMode: 'max'`.
2. `SeleneAetherAdapter` traduce ese `blendMode` a `mergeStrategy: 'HTP'` para dimmer, white y amber.
3. `NodeArbiter` interpreta `HTP` en L3 como “sumar por máximo sin dominación”.
4. Al no registrar dominación L3 en esos canales, L0 sigue escribiendo en frames sucesivos.
5. Resultado físico: el dimmer final queda gobernado por `max(L0, L3)` en vez de por L3 puro.

O dicho sin maquillaje: hoy los soft effects no están configurados como “Selene habla y L0 se calla”, sino como “Selene añade una capa luminosa mientras L0 sigue vivo”.

Eso explica exactamente el síntoma observado:

- CumbiaMoon mantiene el color lunar, pero el pulso de intensidad sigue sincronizado con música/beat.
- CorazonLatino mantiene el rojo/cálido, pero el latido pierde soberanía porque L0 sigue empujando brillo.

---

## Cadena causal completa

### 1. El efecto declara `blendMode: 'max'`

CumbiaMoon:

- `front` usa `dimmer: this.currentIntensity` y `blendMode: 'max'`.
- `back` usa `dimmer: this.currentIntensity * 0.7` y `blendMode: 'max'`.
- Solo `all-movers` usa `blendMode: 'replace'`.

Ver [electron-app/src/core/effects/library/fiestalatina/CumbiaMoon.ts](electron-app/src/core/effects/library/fiestalatina/CumbiaMoon.ts#L218).

CorazonLatino:

- `back`, `all-movers` y `front` salen todos con `blendMode: 'max'`.

Ver [electron-app/src/core/effects/library/fiestalatina/CorazonLatino.ts](electron-app/src/core/effects/library/fiestalatina/CorazonLatino.ts#L331).

El contrato de tipos sigue diciendo que:

- `replace` = LTP
- `max` = HTP

Ver [electron-app/src/core/effects/types.ts](electron-app/src/core/effects/types.ts#L239).

### 2. EffectManager sí propaga ese blendMode

Tras WAVE 4832, `EffectManager.getCombinedOutput()` ya no pierde el campo. El `blendMode` del efecto dominante por zona se copia a `combinedZoneOverrides[zoneId]`.

Ver [electron-app/src/core/effects/EffectManager.ts](electron-app/src/core/effects/EffectManager.ts#L800).

Conclusión: el dato llega vivo al adapter. Ya no se pierde en ese salto.

### 3. SeleneAetherAdapter convierte `max` en `HTP`

La traducción es literal:

- `max` → `HTP`
- `replace` → `LTP`

Ver [electron-app/src/core/aether/adapters/selene-aether-adapter.ts](electron-app/src/core/aether/adapters/selene-aether-adapter.ts#L39).

Y en `_processZoneOverrides()` se especifica además que esta política solo afecta a luminancia:

- dimmer
- white
- amber

El color RGB se sigue emitiendo siempre como `LTP`.

Ver [electron-app/src/core/aether/adapters/selene-aether-adapter.ts](electron-app/src/core/aether/adapters/selene-aether-adapter.ts#L411).

La emisión concreta de dimmer usa ese `mergeStrategy` al hacer push al bus L3:

Ver [electron-app/src/core/aether/adapters/selene-aether-adapter.ts](electron-app/src/core/aether/adapters/selene-aether-adapter.ts#L500).

### 4. TitanOrchestrator inyecta L3 antes del arbitraje

El bus de efectos se llena con `seleneAetherAdapter.ingest(...)` y luego se entrega al arbiter con `setEffectIntents(this._effectBus.getAll())`.

Ver [electron-app/src/core/orchestrator/TitanOrchestrator.ts](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1930).

Conclusión: el frame L3 llega bien al Arbiter. El problema no es ausencia de intents, sino la semántica con que se arbitran.

### 5. NodeArbiter aplica L0 primero y L3 después

El orden real del frame es:

1. L0 `system`
2. L1 `selene`
3. LP `playback`
4. L2 manual
5. L3 `effect`
6. L3+ `hephaestus`

Ver [electron-app/src/core/aether/NodeArbiter.ts](electron-app/src/core/aether/NodeArbiter.ts#L390).

Esto significa que L3 tiene oportunidad de dominar a L0. No falla por orden. Falla por política de mezcla.

### 6. El punto exacto donde L3 deja sobrevivir a L0

En `_applyIntent()` ocurre la decisión crítica:

- `useHtpMerge = (layer === 'effect') && intent.mergeStrategy === 'HTP'`
- si `useHtpMerge` es verdadero, no se registra el canal en `_l3DominatedChannels`
- luego el canal se mezcla con `max(record[channel], incoming)`

Ver [electron-app/src/core/aether/NodeArbiter.ts](electron-app/src/core/aether/NodeArbiter.ts#L718).

La propia documentación inline lo deja negro sobre blanco:

- Los intents HTP de efectos blandos “NO dominan”.
- L0/L1 “coexisten”.
- Se hizo “para que CumbiaMoon/CorazonLatino tinten sin matar el brillo musical”.

Ver [electron-app/src/core/aether/NodeArbiter.ts](electron-app/src/core/aether/NodeArbiter.ts#L749).

Y el merge HTP explícito está aquí:

Ver [electron-app/src/core/aether/NodeArbiter.ts](electron-app/src/core/aether/NodeArbiter.ts#L784).

---

## Qué significa eso en runtime

## Caso CumbiaMoon

Si L0 escribe:

- `dimmer = 0.82`

Y CumbiaMoon escribe:

- `front.dimmer = 0.28`
- `blendMode = 'max'`
- por tanto `mergeStrategy = 'HTP'`

El Arbiter resuelve:

$$
dimmer_{final} = \max(0.82, 0.28) = 0.82
$$

Resultado visual:

- el color blanco lunar entra
- pero la dinámica de brillo la sigue dictando L0
- las “lunitas en oscuridad” no existen como entidad soberana

## Caso CorazonLatino

Si L0 va respirando con el beat y CorazonLatino propone un latido más bajo o más estable:

$$
dimmer_{final} = \max(dimmer_{L0}, dimmer_{heart})
$$

Eso destruye la intención emocional del efecto, porque el corazón ya no decide cuándo subir o bajar. Solo colorea o eleva si supera el brillo que ya traía L0.

---

## Por qué con los hard “parece” no haber problema

Porque en los hard effects pasan dos cosas distintas:

1. Suelen usar `blendMode: 'replace'`, que llega como `LTP` y sí registra dominación L3.
2. Aunque hubiera algo debajo, el propio comportamiento estroboscópico o el nivel de salida hace que visualmente tape todo.

Ejemplos de efectos con `replace`:

- OroSolido
- TidalWave
- StrobeStorm
- LatinaMeltdown

Se puede verificar en:

- [electron-app/src/core/effects/library/fiestalatina/OroSolido.ts](electron-app/src/core/effects/library/fiestalatina/OroSolido.ts#L237)
- [electron-app/src/core/effects/library/fiestalatina/TidalWave.ts](electron-app/src/core/effects/library/fiestalatina/TidalWave.ts#L224)
- [electron-app/src/core/effects/library/fiestalatina/StrobeStorm.ts](electron-app/src/core/effects/library/fiestalatina/StrobeStorm.ts#L329)
- [electron-app/src/core/effects/library/fiestalatina/LatinaMeltdown.ts](electron-app/src/core/effects/library/fiestalatina/LatinaMeltdown.ts#L279)

Entonces el contraste es este:

- Hard: L3 tirano, o al menos visualmente aplastante.
- Soft: L3 aditivo por política explícita.

---

## Mapa actual de soberanía por canal

Hoy, para efectos L3 emitidos por `SeleneAetherAdapter`, el mapa real es:

- `dimmer`: depende de `blendMode`
- `white`: depende de `blendMode`
- `amber`: depende de `blendMode`
- `r/g/b` y aliases `red/green/blue`: siempre LTP de L3
- `strobeRate` y `shutter`: siempre LTP de L3
- movimiento: no sale de SeleneAetherAdapter

Por tanto, en un soft effect actual:

- el color sí puede ser soberano
- la intensidad no lo es, si viene marcada como `max`

Ese desacople entre cromática soberana e intensidad no soberana es exactamente el comportamiento que estás viendo en pista.

---

## Conclusión arquitectónica

La arquitectura actual contradice la regla que quieres imponer:

> Cuando Selene habla en L3, L0 debe callarse.

Hoy el sistema está implementado con otra doctrina:

> Si el efecto marca `blendMode: 'max'`, L3 no domina dimmer/white/amber; coopera con L0 vía HTP.

No es un bug residual. Es una política activa, documentada y codificada en dos sitios:

1. traducción `blendMode -> mergeStrategy` en el adapter
2. ausencia de dominación L3 cuando `mergeStrategy === 'HTP'` en el arbiter

---

## Punto exacto a debatir en la revisión

La decisión pendiente no es “dónde está el fallo”, porque ya quedó localizado.

La decisión real es esta:

### Opción doctrinal A

Mantener el significado actual de `blendMode: 'max'`:

- L3 soft coexiste con L0
- el efecto no manda en intensidad
- CumbiaMoon y CorazonLatino siguen siendo aditivos, no soberanos

### Opción doctrinal B

Redefinir la ley de capas para que todo L3 silencie L0 en intensidad, incluso cuando el efecto sea “soft”:

- el dimmer del efecto pasa a ser autoridad final
- el carácter del efecto se conserva completo
- `blendMode` dejaría de significar “coexistencia con L0” y pasaría a significar otra cosa, o habría que separar mezcla intra-L3 de soberanía inter-capas

Esa segunda opción es la que encaja con tu criterio actual de diseño.

---

## Sello final

Diagnóstico sellado:

- El bug de objetos en `ZoneNodeRouter` estaba matando los efectos antes.
- Ese bug ya no explica el síntoma actual.
- El síntoma actual nace de WAVE 4832 y su semántica HTP para soft effects.
- L0 no sobrevive por accidente: sobrevive porque L3 soft le concede ese derecho explícitamente.

Si en la próxima iteración decidís que L3 debe callar siempre a L0 cuando hay dimmer de efecto, el cambio a discutir ya no es de rastreo sino de doctrina de capas.