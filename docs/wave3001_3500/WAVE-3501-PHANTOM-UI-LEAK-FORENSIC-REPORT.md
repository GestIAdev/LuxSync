# WAVE 3501 — THE PHANTOM UI LEAK — FORENSIC REPORT

**Fecha**: 2026-04-25  
**Estado**: AUDITORIA COMPLETADA (READ-ONLY)  
**Tipo**: Forense de memoria Renderer IPC/Worker  
**Scope**: Electron Main + Preload + Renderer React + Tactical Worker

---

## RESUMEN EJECUTIVO

Se investigó el colapso progresivo del Renderer (OOM/WSOD tras 3-4 horas) con Main y Workers aún vivos.

**Diagnóstico principal**:
- El cuello de botella exacto está en la ruta Renderer -> Tactical Worker.
- El Renderer produce mensajes FRAME en cada RAF y los empuja por postMessage sin control de backpressure, sin ACK y sin política de drop.
- Cuando el Worker no drena al mismo ritmo (picos CPU/GPU/GC), la cola de mensajes crece y retiene memoria en Renderer hasta degradar y eventualmente romper la vista.

**Diagnóstico secundario**:
- Hay puntos de lifecycle con cleanup incompleto (intencional no-op) que elevan riesgo de retención si ocurre un desmontaje real fuera del escenario previsto.

---

## OBJETIVO DE LA AUDITORIA

La directiva WAVE 3501 exigía validar:

1. Si UI Phantom -> Renderer estaba empaquetando y emitiendo con throttle real.
2. Si el frontend retenía memoria por arrays/estructuras no acotadas o listeners no limpiados.
3. Si existía crecimiento de cola outbound bajo saturación IPC.

Sin cambios de código. Solo evidencia técnica.

---

## METODOLOGIA

Auditoría estática read-only de rutas críticas:

- Main process: callbacks de broadcast de verdad y hot-frame.
- Preload bridge: wrappers de suscripción y unsubscribe.
- Hooks y providers React: alta frecuencia, montaje y cleanup.
- Stores Zustand/transient: detección de buffers históricos no acotados.
- Tactical pipeline: ruta de datos hacia Worker de render.

---

## HALLAZGOS (ORDENADOS POR SEVERIDAD)

## 1) CRITICO — Cola Renderer -> Worker sin backpressure (fuga progresiva)

**Ruta afectada**: TacticalCanvas data pump

Hechos observados:
- Se genera un FRAME por ciclo RAF en main thread.
- Cada frame se envía por postMessage con Transferable buffer.
- No existe señal de ACK desde Worker para regular la producción.
- No existe cola acotada, drop policy ni skip de frames atrasados.

Conclusión:
- Si el Worker cae por debajo de la tasa de ingreso, el backlog crece.
- Ese backlog se manifiesta como presión de heap en Renderer y explica la degradación por horas hasta OOM/WSOD.

Evidencia principal:
- electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx
  - loop RAF del pump
  - envío continuo de FRAME via postMessage
- electron-app/src/workers/hyperion-render.worker.ts
  - recepción de FRAME sin control de crédito/ack para el productor

---

## 2) ALTO — Teardown incompleto del Tactical Worker

Hechos observados:
- El efecto de inicialización del worker usa cleanup intencionalmente vacío para supervivencia de Strict Mode.
- El Worker sí implementa ruta SHUTDOWN con cancelación de RAF y limpieza de estructuras internas.
- No se encontró señal explícita de SHUTDOWN en un teardown real desde TacticalCanvas.

Conclusión:
- Aunque la arquitectura actual asume persistencia larga de vista, existe riesgo de retención de recursos en escenarios reales de desmontaje o recarga.
- No se identifica como origen principal del OOM reportado, pero aumenta riesgo sistémico de fuga acumulativa.

Evidencia principal:
- electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx
  - cleanup no-op documentado
- electron-app/src/workers/hyperion-render.worker.ts
  - case SHUTDOWN con clear de stores y cancel RAF

---

## 3) MEDIO — Listener de fixtures con cleanup débil

Hechos observados:
- TrinityProvider registra listener global para lux:fixtures-loaded.
- Usa flags globales para evitar doble suscripción.
- El cleanup retornado en ese efecto no remueve explícitamente el listener.

Conclusión:
- Riesgo de deuda de lifecycle y listeners huérfanos en escenarios de remount no contemplados.
- No se comporta como causa raíz primaria del OOM de 3-4 horas, pero es un vector secundario de retención.

Evidencia principal:
- electron-app/src/providers/TrinityProvider.tsx
  - registro global de listener con flags
  - cleanup sin removeListener explícito en ese bloque

---

## HALLAZGOS DESCARTADOS (NO CAUSA RAIZ)

1. IPC Main -> Renderer saturando sin control.
- Se confirmó throttling real en orquestador:
  - hot-frame en cadencia reducida
  - full truth en cadencia aún menor
- No corresponde al patrón de inundación masiva naive.

2. Fuga por stores de UI sin límites.
- truthStore opera como snapshot único, sin historial creciente.
- dmxStore reemplaza Map en updates, no acumula historial ilimitado.
- logStore está acotado por maxLogs.

3. Listener principal de verdad sin cleanup.
- useSeleneTruth remueve listeners de truth y hot-frame en cleanup.

---

## DIAGNOSTICO FORENSE FINAL

**Leak/Bottleneck exacto**:
- Pipeline de frame pumping Renderer -> Tactical Worker sin backpressure.
- Productor a ritmo RAF, consumidor variable según carga.
- Acumulación de mensajes en cola inter-thread durante sesiones largas.

**Traducción operacional del fallo**:
- FPS cae gradualmente.
- GC cada vez más agresivo en Renderer.
- UI se degrada, luego pantalla blanca o congelamiento.
- Main y otros workers continúan operando, creando la ilusión de que solo murió la vista.

---

## RIESGO OPERACIONAL

- Severidad: CRITICA
- Impacto: caída de interfaz en show prolongado
- Probabilidad: alta en escenas complejas, sesiones largas y hardware de recursos limitados

---

## RECOMENDACIONES TECNICAS (POST-AUDITORIA)

1. Implementar backpressure formal en canal FRAME:
- esquema productor-consumidor con crédito (ack) o mailbox latest-only.
- política de drop de frames viejos cuando el worker va atrasado.

2. Acotar explícitamente la cola de mensajes:
- límite duro de in-flight frames.
- telemetría de backlog y alerta temprana.

3. Consolidar teardown determinista:
- enviar SHUTDOWN y terminate en desmontajes reales controlados.
- limpiar listeners globales con removeListener explícito en todos los efectos críticos.

4. Instrumentación para validación en runtime:
- métricas de queue depth, frame lag, heap renderer, long tasks y GC pause.
- alarma al superar umbrales sostenidos.

---

## CIERRE

WAVE 3501 identifica una causa raíz concreta y coherente con el síntoma de campo: la fuga no nace en un array histórico React, sino en una arquitectura de bombeo de frames sin control de presión entre Renderer y Worker.

No se aplicaron cambios de código en esta wave. Este documento consolida únicamente hallazgos forenses y diagnóstico técnico.
