# WAVE 4859 - GRANDMA3 PHASER SYNC (V3)

## Resumen Ejecutivo
Se ejecuto la directiva de cirugia sobre el runtime de Hephaestus para corregir el desfase por fixture en tracks con fase.

Problema detectado:
- El motor evaluaba la curva una vez por track con tiempo global y luego emitia a todos los fixtures.
- Resultado: efectos tipo scanner con spread 1.0 disparaban simultaneos, ignorando offsets de PhaseDistributor.

Solucion aplicada:
- Evaluacion por fixture con tiempo local desfasado.
- Inyeccion correcta de phase config en el armado de tracks resueltos.
- Compatibilidad explicita con phaseConfig en tracks V3.

## Cambios Implementados

### 1) Modelo de tiempo local por fixture (MA3)
Archivo: electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts

Ajuste en tickActive (path con fixturePhases):
- Antes: fixtureTimeMs = baseClipTimeMs + phaseOffsetMs
- Ahora: localElapsedMs = max(0, baseClipTimeMs - phaseOffsetMs)
- Evaluacion final: evaluator en fixtureTimeMs derivado de localElapsedMs

Efecto:
- Cada fixture arranca cuando le corresponde por offset.
- Se elimina el disparo simultaneo en scanners y chases con spread.

### 2) Lectura de phaseConfig en tracks V3
Archivo: electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts

Ajuste en _buildResolvedTracks:
- Antes: solo se tomaba selector.phase o selector.phaseSpread
- Ahora: se prioriza t.phaseConfig y se mantiene fallback a selector.phase/phaseSpread

Efecto:
- Los .lfx V3 que declaran phaseConfig en track quedan correctamente conectados a PhaseDistributor.resolve(...).

### 3) Tipado V3 actualizado para phaseConfig
Archivo: electron-app/src/core/hephaestus/types.ts

Ajuste en HephTrack:
- Se agrega campo opcional: phaseConfig?: PhaseConfig

Efecto:
- El schema V3 usado en efectos como cyber_scanner queda alineado con runtime y typing.

## Verificacion
Comando ejecutado:
- npx tsc --noEmit

Resultado:
- Exit Code: 0
- Sin errores TypeScript en archivos tocados.

## Impacto Funcional Esperado
- Cyber Scanner y cualquier track con spread > 0 respetan offsets por fixture.
- El barrido vuelve a ser espacial y secuencial (estilo MA3), no simultaneo.
- No se altero la arquitectura de mezcla global; el cambio se limita al tiempo local de evaluacion por fixture y a la inyeccion de fase por track.

## Estado
- Directiva WAVE 4859: COMPLETADA
- Build de tipos: OK
- Listo para export.
