# WAVE 3475 — Color Veto Diagnosis

## Alcance y método
- Diagnóstico de solo lectura, sin cambios de código.
- Ruta auditada: Effect output -> EffectManager -> TitanOrchestrator -> MasterArbiter -> HAL -> traducción a color wheel DMX.
- Efectos bajo investigación: TidalWave, CumbiaMoon.

## Hallazgo principal (punto exacto del veto)

El ruteo de color hacia movers se mata en dos compuertas del Arbiter cuando el efecto llega con mixBus global:

1) Veto temprano en inyección de intents
- Archivo: electron-app/src/core/arbiter/MasterArbiter.ts
- Función: setEffectIntents
- Condición letal:
  - if (intent.mixBus === 'global')
  - if (fixtureMeta && this.isMovingFixture(fixtureMeta))
  - delete intent.color; delete intent.white; delete intent.amber;
- Efecto: aunque TitanOrchestrator haya resuelto zoneOverrides de movers con color, el color se elimina antes de arbitrar.

2) Escudo adicional en merge de canales
- Archivo: electron-app/src/core/arbiter/MasterArbiter.ts
- Función: mergeChannelForFixture
- Condición letal:
  - if (MOVER_SHIELD_CHANNELS.has(channel) && effectIntent.mixBus === 'global')
  - if (fixtureMeta && this.isMovingFixture(fixtureMeta)) moverShieldActive = true
- Efecto: en canales de color de movers (red/green/blue/white), Layer 3 no se aplica y fluye el color base de Titan.

Conclusión forense: el veto no está en TidalWave/CumbiaMoon ni en el cuántizador de color. Está en Arbiter, por regla explícita de protección para movers bajo bus global.

---

## 1) Rastro en el Árbitro (EffectManager / VisualConscienceEngine / TitanOrchestrator)

### EffectManager
- Archivo: electron-app/src/core/effects/EffectManager.ts
- Función: getCombinedOutput
- Hallazgo:
  - Zone overrides se combinan por HTP/LTP básico (dimmer HT P, color por prioridad).
  - El campo blendMode de cada zona no participa en la mezcla final (no se usa en la estructura tipada interna de merge).
- Impacto:
  - blendMode replace emitido por efectos no tiene semántica fuerte aquí; se conserva color/dimmer por prioridad, pero la política final la impone Arbiter.

### TitanOrchestrator
- Archivo: electron-app/src/core/orchestrator/TitanOrchestrator.ts
- Función: processFrame (bloque WAVE 2662 de inyección de intents)
- Hallazgo:
  - Convierte zoneOverrides a EffectIntent por fixture y los inyecta vía masterArbiter.setEffectIntents(intentMap).
  - Se propaga mixBus desde effectOutput.mixBus.
- No se encontró flag tipo forceHardwareSync/isHardEffect ni filtro por duración corta.

### VisualConscienceEngine
- Archivo: electron-app/src/core/intelligence/conscience/VisualConscienceEngine.ts
- Hallazgo:
  - Motor ético/selección de candidatos. No participa en traducción de zoneOverrides ni en ruteo DMX por fixture.
  - No hay veto directo de color movers aquí.

### Colisión con Background/LiquidEngine
- Archivo: electron-app/src/core/arbiter/MasterArbiter.ts
- Función: mergeChannelForFixture
- Resolución real:
  - En mixBus global, dimmer del efecto reemplaza estrictamente.
  - En color de movers, por mover shield, se omite Layer 3 y queda base Titan (fondo/vibe).
- Resultado observable:
  - Parece que el background gana color en movers aunque el efecto mande replace en zoneOverrides.

---

## 2) Rastro en HAL y cuantizador

### Traducción RGB/HSL -> rueda DMX
- Archivo: electron-app/src/hal/HardwareAbstraction.ts
- Función: translateColorToWheel
- Pipeline:
  - ColorTranslator.translate -> HarmonicQuantizer -> HardwareSafetyLayer -> DarkSpinFilter

### Caso CumbiaMoon (gris lunar h:0 s:0 l:80)
- Archivo: electron-app/src/hal/translation/ColorTranslator.ts
- Función: findNearestColorLab
- Regla matemática:
  - Si target no es cromático (s <= 0.15), devuelve directamente slot 0 (Open/White).
- Conclusión:
  - No falla por distancia euclidiana ni se queda en color previo por ese motivo.
  - Un gris de baja saturación se mapea deliberadamente a blanco/open de rueda.

### Caso TidalWave (dorado saturado)
- Misma función en ColorTranslator elige por hue circular para targets cromáticos.
- Conclusión:
  - El dorado sí debería mapear a slot cromático si llega al HAL.
  - En esta incidencia, el dorado no llega para movers porque fue vetado antes en Arbiter (setEffectIntents + mover shield para global).

### Por qué OroSolido puede verse diferente
- Hay dos rutas operativas en el sistema:
  - Ruta EffectIntent (TitanOrchestrator -> setEffectIntents): sujeta al veto global en movers.
  - Ruta Playback/Chronos (TimelineEngine -> setPlaybackFrame): mezcla híbrida distinta, sin el mismo borrado en setEffectIntents.
- Si OroSolido se disparó por ruta de playback, no pasa por el mismo punto de veto.

---

## 3) Restricciones mecánicas (DarkSpin / control de movers)

### Restricción temporal mecánica
- Archivo: electron-app/src/hal/translation/HardwareSafetyLayer.ts
- Función: filter
- Regla:
  - Debounce por minChangeTimeMs del perfil mecánico (si cambio demasiado rápido, bloquea y mantiene color anterior).

### Blackout de tránsito de rueda
- Archivo: electron-app/src/hal/translation/DarkSpinFilter.ts
- Función: filter
- Regla:
  - Si cambia color_wheel, fuerza dimmer=0 durante transitDuration (basado en minChangeTimeMs).

### Jerarquía HTP/LTP para color wheel
- Archivo: electron-app/src/core/arbiter/MasterArbiter.ts
- Función: arbitrate (playback) y mergeChannelForFixture (arbitraje normal)
- Hallazgo:
  - Prioridad de mezcla existe, pero el bloqueo específico a movers globales ocurre antes y durante merge de color.
  - No se encontró regla tipo no cambiar color por fase corta en MoverController (no existe módulo con ese nombre en este árbol).

---

## Respuesta directa a la causa raíz

El ruteo de color de movers para TidalWave y CumbiaMoon se anula por diseño cuando el efecto usa mixBus global:

- MasterArbiter.setEffectIntents borra color/white/amber en movers para intents globales.
- MasterArbiter.mergeChannelForFixture vuelve a blindar canales de color en movers para mixBus global.

Este doble veto explica que exista zoneOverrides con replace y color en el efecto, pero no aparezca color en simulador/hardware para movers.

## Evidencia mínima clave
- MasterArbiter.ts: setEffectIntents (WAVE 3307 Deep Seal)
- MasterArbiter.ts: mergeChannelForFixture (WAVE 3305 mover shield)
- ColorTranslator.ts: target no cromático -> slot 0/open
- HardwareAbstraction.ts: translateColorToWheel se ejecuta después, por lo que no puede recuperar color ya eliminado aguas arriba
