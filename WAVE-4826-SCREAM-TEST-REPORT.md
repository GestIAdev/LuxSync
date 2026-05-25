# WAVE-4826 — SCREAM TEST FORENSIC REPORT

```text
Arquitecto:   PunkOpus
Fecha:        2026-05-21
Branch:       v3
Objetivo:     Aislar los efectos legacy, forzar el fallo de compilación y mapear el acoplamiento real del pipeline de ejecución
Estado:       Reporte forense completado; repository restaurado a estado compilable
```

## Resumen Ejecutivo

El scream test confirmó que el sistema sigue dependiendo de la carpeta legacy de efectos para compilar y ejecutar. Al aislar `src/core/effects/library/` y renombrarla temporalmente a `library_DEAD/`, `tsc --noEmit` devolvió exactamente tres archivos que gritan por acoplamiento directo con esa carpeta. El hallazgo importante no es solo la existencia de imports legacy, sino la duplicación arquitectónica: hay dos registries de factories independientes, uno en `EffectManager` y otro en `TimelineEngine`.

La consecuencia práctica es simple: el pipeline de ejecución no está desacoplado del catálogo legacy. Cuando Selene llega a la ruta `execute`, la decisión todavía depende de un camino que instancía clases legacy directamente en vez de resolver efectos desde una capa unificada basada en `DynamicEffectRegistry`.

## Metodología

1. Se aisló físicamente `src/core/effects/library/` renombrando la carpeta a `library_DEAD/`.
2. Se ejecutó `npx tsc --noEmit` para provocar el fallo de compilación y registrar los puntos de acoplamiento.
3. Se inspeccionaron los archivos que gritaron para identificar los puntos de instanciación y las rutas de ejecución.
4. Se restauró `library_DEAD/` a `library/` para devolver el repositorio a estado sano.

## Resultado del Scream Test

### Archivos que gritaron

1. `src/core/effects/EffectManager.ts`
2. `src/core/engine/TimelineEngine.ts`
3. `src/core/effects/index.ts`

### Severidad

- Crítico: `EffectManager.ts`
- Crítico: `TimelineEngine.ts`
- Menor: `effects/index.ts`

## Diagnóstico por archivo

### 1. EffectManager.ts

El archivo depende directamente de la librería legacy con imports concretos desde `./library/**` en su bloque de imports. Ver [EffectManager.ts](electron-app/src/core/effects/EffectManager.ts#L54).

El punto estructural más relevante está en `registerBuiltinEffects()`, donde se llena `this.effectFactories` con factories del tipo `() => new ClassName()`. Ver [EffectManager.ts](electron-app/src/core/effects/EffectManager.ts#L946).

Esto significa que el manager no resuelve efectos desde un contrato abstracto o desde el registry dinámico como fuente única de verdad. En su lugar, mantiene una tabla manual de constructors legacy.

### 2. TimelineEngine.ts

Este es el hallazgo más grave.

El archivo importa directamente clases legacy desde `../effects/library/**` en su bloque superior. Ver [TimelineEngine.ts](electron-app/src/core/engine/TimelineEngine.ts#L42).

Además, define un `EFFECT_FACTORIES` a nivel de módulo como un `Map<string, EffectFactory>` propio, independiente del `EffectManager`. Ver [TimelineEngine.ts](electron-app/src/core/engine/TimelineEngine.ts#L139).

Esa independencia es el problema real: hay dos registries que modelan la misma realidad, pero no comparten estado ni autoridad. Uno vive en `EffectManager`, otro en `TimelineEngine`. Eso rompe la unificación del pipeline.

La ruta de ejecución usa ese map para resolver el efecto cuando el clip entra en modo core effect. El punto de selección está en `processCoreEffect()`, donde se busca el factory con `EFFECT_FACTORIES.get(clip.fxType as string)` y luego se instancia la clase para disparar `trigger()` y continuar con el frame loop. Ver [TimelineEngine.ts](electron-app/src/core/engine/TimelineEngine.ts#L515).

Resultado: la ejecución depende de un constructor legacy local, no de una abstracción inyectada desde el registry dinámico ni de un bridge Selene/Hephaestus.

### 3. effects/index.ts

Solo queda un re-export residual de `SolarFlare` desde la librería legacy. Ver [effects/index.ts](electron-app/src/core/effects/index.ts#L39).

Es un resto menor. No define la arquitectura, pero confirma que la carpeta legacy todavía está expuesta desde el barrel público.

## Diagnóstico del `reason=execute`

El log observado en el integrator sale de [DreamEngineIntegrator.ts](electron-app/src/core/intelligence/integration/DreamEngineIntegrator.ts#L289).

Ese log refleja una decisión previa:

- `dreamRecommendation = execute`
- `decision.approved = ethicalVerdict.verdict === 'APPROVED'`

Cuando `approved` es `false`, la tubería publica `Pipeline: ❌ REJECTED | reason=execute`.

Eso indica que el problema no está en la recomendación del dream simulator, sino en la capa de evaluación/validación posterior. La ruta de decisión se está cerrando antes de llegar a una ejecución desacoplada.

## Hallazgo arquitectónico central

El sistema tiene dos mapas de factories que hacen el mismo trabajo:

- `EffectManager.effectFactories`
- `TimelineEngine.EFFECT_FACTORIES`

Ambos construyen instancias con `new LegacyClass()`.

Eso produce estas consecuencias:

- duplicación de fuente de verdad;
- riesgo de divergencia entre manager y engine;
- acoplamiento duro al árbol `library/`;
- imposibilidad de reemplazar el backend de ejecución sin tocar dos caminos distintos;
- exposición parcial del catálogo legacy desde `effects/index.ts`.

## Qué no grita

Durante el scream test se confirmó que estos archivos no participaron en el acoplamiento directo con `library/`:

- `ContextualEffectSelector.ts`
- `DecisionMaker.ts`
- `SeleneHephBridge`
- `HephaestusAetherAdapter`

Eso importa porque descarta una falsa pista: el bridge existe, pero no está siendo usado por la ruta que termina en `execute`.

## Interpretación funcional

La tubería hoy funciona así:

1. Selene produce una recomendación de efecto.
2. El integrator evalúa si la decisión puede aprobarse.
3. El engine selecciona una factory local.
4. Se instancia una clase legacy.
5. Se ejecuta el efecto desde ese constructor concreto.

No hay un paso donde el pipeline pase por un adaptador único que resuelva el efecto desde `DynamicEffectRegistry` y delegue la construcción a una sola capa coherente.

## Evidencia de restauración

Después del aislamiento, la carpeta `library_DEAD/` fue restaurada a `library/` y el repositorio volvió a compilar sin errores con `npx tsc --noEmit`.

Eso valida que el scream test fue no destructivo y que el repositorio quedó en estado operativo al cierre del análisis.

## Conclusión

El scream test no solo mostró dependencias legacy. Mostró algo más serio: el core de ejecución está diseñado alrededor de una duplicación de factories y de instanciación directa de clases. Mientras `TimelineEngine` mantenga su registry propio y `EffectManager` siga registrando constructores manuales, el sistema seguirá acoplado al catálogo legacy aunque exista `DynamicEffectRegistry`.

El próximo paso de implementación debería atacar el punto correcto: una única ruta de resolución de efectos, basada en el registry dinámico como fuente de verdad y un adaptador de construcción compartido.

## Archivos relevantes

- [EffectManager.ts](electron-app/src/core/effects/EffectManager.ts#L54)
- [EffectManager.ts](electron-app/src/core/effects/EffectManager.ts#L946)
- [TimelineEngine.ts](electron-app/src/core/engine/TimelineEngine.ts#L42)
- [TimelineEngine.ts](electron-app/src/core/engine/TimelineEngine.ts#L139)
- [TimelineEngine.ts](electron-app/src/core/engine/TimelineEngine.ts#L515)
- [effects/index.ts](electron-app/src/core/effects/index.ts#L39)
- [DreamEngineIntegrator.ts](electron-app/src/core/intelligence/integration/DreamEngineIntegrator.ts#L289)
