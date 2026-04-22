# WAVE 3429 - Export Arquitecto

Fecha: 2026-04-21
Repositorio: GestIAdev/LuxSync
Branch: main
Commit objetivo: 4e2cda08

## 1) Memoria activa del repo

Inventario actual de memorias en /memories/repo:

- dep0168-napi-fix.md
- gc-pending-allocations.md
- godear-audio-pipeline.md
- hyperion-render-worker.md
- lux-conventions.md
- luxsync-architecture.md
- luxsync-timing-rules.md
- wave-2540-4-phantom-buffer.md
- wave-2616-desacoplamiento-ui.md
- wave-2770-blackbox.md
- wave-2785-3-renderfromtarget-fix.md
- wave-3010-single-send.md
- wave-3060-audio-ipc-bypass.md
- wave-3409-great-rewiring.md
- wave-3429-agnostic-raw-telemetry.md
- zone-mapper.md

Resumen puntual de memoria WAVE 3429 (wave-3429-agnostic-raw-telemetry.md):

- Se agrego telemetria raw pre-AGC en GodEarAnalyzer cada 60 frames con tag [RADIX2 RAW].
- El formato de runtime log reporta Peak + sub/bass/mid/highMid sobre bandas escaladas pre-AGC.
- Se agrego calibrador determinista Radix-2 para tonos de igual amplitud (60Hz vs 2500Hz).
- El calibrador emite lineas [RADIX2 TEST] con bass/highMid para ambos tonos.
- Se agrego paridad en suite amplia mediante test equivalente en GodEarFFT.test.ts.

## 2) Evidencia de cambios (commit)

Salida de validacion de commit:

- 4e2cda08 (HEAD -> main) WAVE 3429: agnostic raw telemetry and Radix-2 calibrator
- Archivos modificados:
  - electron-app/src/workers/GodEarFFT.radix2.ts
  - electron-app/src/workers/GodEarFFT.test.ts
  - electron-app/src/workers/GodEarFFT.ts

## 3) Resultados de tests para export

Comando ejecutado:

- cd electron-app
- npx tsx src/workers/GodEarFFT.radix2.ts

Resultado global:

- ALL TESTS PASSED

Bloque de calibracion WAVE 3429 (salida clave):

- [RADIX2 RAW] Peak: 1177.346787 | Bands: sub=1177.346787 bass=1151.666187 mid=23.355936 highMid=10.364941
- [RADIX2 RAW] Peak: 1228.135197 | Bands: sub=2.113453 bass=3.909611 mid=26.002785 highMid=1228.135197
- [RADIX2 TEST] 60Hz amp=0.6 => bass=1151.666187 highMid=10.364941
- [RADIX2 TEST] 2500Hz amp=0.6 => bass=3.909611 highMid=1228.135197

Metricas de performance del mismo run:

- Avg: 0.560ms
- Min: 0.535ms
- P95: 0.591ms
- Parseval rel_err: 2.662e-9

## 4) Lectura tecnica para arquitectura

- El feed queda agnostico por evidencia de respuesta diferencial con amplitud identica:
  - 60Hz concentra energia en bass.
  - 2500Hz concentra energia en highMid.
- La telemetria [RADIX2 RAW] queda disponible en runtime para auditoria pre-AGC sin coloracion de ganancia automatica.
- El calibrador Radix-2 deja baseline determinista reproducible para futuras olas de calibracion.
