# Informe de ajustes: Techno (WAVE 290.3)

Fecha: 2026-01-05

Resumen breve
-------------
Este documento resume las últimas directivas ejecutadas y completadas sobre el motor de física `TechnoStereoPhysics` (WAVE 290.3). El objetivo fue recuperar y afinar el comportamiento Techno: diferenciación clara entre Front (bombo), Back (caja) y Movers (agudos), reducir ruido/"karaoke" en los pares, y conseguir una respuesta más agresiva y con menos smoothing (modo RAVE).

Cambios principales aplicados
----------------------------
- Eliminación de smoothing excesivo en PARs (Front/Back) y vuelta a cálculos directos tipo `Math.pow` cuando procedía.
- Corrección del bug donde Back PAR usaba BASS en lugar de MID (ahora usa MID correctamente).
- Ajuste del gate anti-karaoke para Back PAR (se incrementó progresivamente y se calibró en varias iteraciones hasta encontrar el sweet-spot para Techno 4x4).
- Reequilibrado de multiplicadores ("vitaminas") para dar más o menos potencia según pruebas con DnB y Techno minimal.
- Implementación de dual API para `TechnoStereoPhysics` (API estática para colores/strobe y singleton/instancia para zonas), manteniendo compatibilidad con `SeleneLux`.
- Introducción de histéresis anti-parpadeo para Front PAR (umbral encendido >0.35, apagado <0.28).
- Revisión y ajustes finos en `calculateMover()` para attack instantáneo y decay agresivo (pulsos rápidos y negros profundos).
- Se añadió `frontParActive` al estado interno y se añadió limpieza en `reset()`.

Detalle cronológico (últimas directivas ejecutadas y completadas)
----------------------------------------------------------------
1. Revisión y rollback parcial de `SeleneLux.ts` tras corrupción (se restauró estado estable y se re-aplicaron cambios necesarios para techno).
2. Creación inicial de `TechnoStereoPhysics` con API dual (static apply for color/strobe, instance applyZones for zones).
3. Identificación y corrección del bug: Back PAR utilizaba BASS en lugar de MID. Cambio aplicado.
4. Detección de comportamiento "strobe sin strobe" debido a smoothing excesivo. Se eliminaron las suavizaciones en `calculateFrontPar` y `calculateBackPar` y se volvieron a fórmulas directas con `Math.pow`.
5. Ajuste de gates y multiplicadores:
   - BACK_PAR_GATE aumentado inicialmente para reducir karaoke (valor ajustado durante la sesión).
   - Se probaron multiplicadores agresivos (2.0+) y luego se redujeron tras observar saturación en logs.
6. Implementación de vitaminas iniciales (exponentes <1 y multiplicadores) para elevar potencia en señales débiles; luego afinado a valores moderados (ej. back mult -> 2.0 → calibrado).
7. Reintroducción de control de histéresis para Front PAR para eliminar parpadeos alrededor del umbral.
8. Ajustes en `calculateMover()`:
   - Attack instantáneo (subida inmediata al objetivo cuando corresponde).
   - Decay muy agresivo (retención 10% del valor anterior + limpieza si <0.20).
   - Cambio en la lógica de activación para encendido inmediato y apagado con pequeña demora anti-flicker.
9. Eliminación de multiplicador extra en Front que provocaba saturación; se dejó la función solo con `Math.pow(gated, 0.6)` y cap a 0.80.
10. Añadido `frontParActive` y reseteo en `reset()`.

Decisiones de diseño y justificación
------------------------------------
- Filosofía Techno: priorizar DELTA y contraste. Por defecto se redujo smoothing al mínimo viable y se optó por attacks instantáneos y decays rápidos para maximizar el impacto visual.
- Gate vs multiplicador: el gate decide si pasa o no una señal; el multiplicador decide cuánto brilla. Tras pruebas se retiró multiplicador innecesario en Front para evitar saturación general.
- Histéresis: se introdujo para evitar rebotes en umbral (parpadeos) sin sacrificar reactividad.
- Compatibilidad: los cambios respetan la API de `SeleneLux` y `TitanEngine` (quien ya puede recibir `physicsApplied: 'techno'`).

Pruebas y logs observados
-------------------------
- Pruebas con Drum & Bass: necesario reducir smoothing y ajustar multiplicadores (inicialmente exceso de smoothing y luego exceso de vitaminas).
- Pruebas con Techno minimal / hardminimal: con la configuración final los Back actúan como "ambiente" (apagados largos y micro-lluvias que aparecen y desvanecen), Front late con pulso agresivo, Movers reaccionan instantáneamente y con decay rápido.
- Se revisaron múltiples logs (`docs/logs/technominimal.md`, `docs/logs/dnblog.md`, `docs/logs/loggravitpiano.md`) para validar comportamiento en distintos tracks.

Archivos modificados (muestra de los principales)
--------------------------------------------------
- `electron-app/src/hal/physics/TechnoStereoPhysics.ts`  — cambios amplios en cálculo de PARs, movers, histéresis, estado y reset.
- `electron-app/src/core/reactivity/SeleneLux.ts` — restauración de versión válida y adaptación para llamar a `technoStereoPhysics.applyZones()`.
- `electron-app/src/hal/physics/index.ts` — export de `technoStereoPhysics` singleton.
- `electron-app/src/hal/physics/PhysicsEngine.ts` — marcado como GLOBAL y advertencias de deprecación para funciones techno-específicas.

Siguientes pasos recomendados
----------------------------
- Probar más pistas representativas de subgéneros (dubstep, neurofunk, brejcha) para ajustar curvas y gates por perfil o introducir perfiles por subgénero.
- Crear configuración por "preset" (techno-minimal, dnb, dubstep) que seleccione gates/exponentes/multiplcadores automáticamente.
- Mapear la respuesta a fixtures reales (PWM vs 8-bit dimming, CRI variaciones) cuando pase a hardware.
- Documentar en `docs/` las decisiones clave y dejar ejemplos de audio → métricas → salida esperada.

Estado del TODO
----------------
- Todas las directivas descritas más arriba han sido ejecutadas y probadas interactivamente; la configuración actual en `TechnoStereoPhysics.ts` refleja el estado final descrito.

Contacto
--------
Si quieres que empaquete estos cambios en una rama y abra un PR con descripción y pruebas básicas, dímelo y lo hago.

---
Reporte generado automáticamente a petición del equipo (Radwulf).