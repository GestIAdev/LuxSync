# WAVE 4636 - PHOTON + MEMORY FORENSIC REPORT

Fecha: 2026-05-08
Estado: Read-only forense, sin mutacion de codigo
Objetivo: Consolidar todos los hallazgos criticos para resolverlos en una fase unica posterior

---

## 1) Resumen ejecutivo

Hay dos frentes criticos que deben resolverse en conjunto:

1. Inconsistencia fotonica en pipeline Liquid/Aether (comportamiento mixto 4.1 vs 7.1, variacion intra-zona, reaccion musical no uniforme).
2. Inestabilidad de memoria en vista 3D Hyperion (presion GC + fuga VRAM) que deriva en OOM/crash de Electron.

El riesgo sistemico es alto porque ambos frentes ocurren en hot-path de frame loop y compiten por estabilidad temporal y de memoria.

---

## 2) Alcance forense consolidado

Este reporte consolida hallazgos de:

- Auditoria de flujo fotonico LiquidEngineBase -> SeleneLux -> TitanOrchestrator -> Aether adapters -> NodeArbiter.
- Diagnosticos previos archivados de memoria/crash en 3D:
  - RAM-LEAK-DIAGNOSIS.md
  - PHANTOM-WORKER-AUDIT.md
  - POLTERGEIST-AUDIT.md

---

## 3) Hallazgos criticos de fisica fotonica

### F1 - Split-brain de layout (critico)

Descripcion:
- SeleneLux permite layout activo 4.1 o 7.1.
- Pero el ingreso L0 a Aether toma cache de liquidEngine71 de forma fija en orquestacion.

Efecto observable:
- El sistema puede estar configurado en 4.1 pero reaccionar dinamicamente como 7.1 en emision real.

Impacto:
- Mezcla de comportamientos calibrados.
- Incoherencia entre modo seleccionado y salida efectiva.

---

### F2 - Doble productor de dimmer con merge HTP (critico)

Descripcion:
- LiquidAetherAdapter emite dimmer base (L0).
- ImpactAdapter emite dimmer reactivo adicional.
- NodeArbiter resuelve dimmer por HTP (maximo valor), no por una fuente unica de verdad.

Efecto observable:
- Dominancia variable por nodo/frame.
- Diferencias de intensidad dentro de una misma zona semantica.

Impacto:
- Comportamiento no determinista perceptual cuando ambas ramas discrepan.

---

### F3 - Variacion intra-zona por espacializacion + banda (alto)

Descripcion:
- ImpactAdapter pondera por posicion (X/Z), falloff por epicentro y bandMix por fixture.
- Esto no siempre coincide con la semantica de zona esperada por operador.

Efecto observable:
- Dos fixtures de "misma zona" pueden reaccionar distinto por geometria y mezcla espectral.

Impacto:
- Sensacion de desigualdad de reaccion musical dentro del mismo bloque zonal.

---

### F4 - Fallbacks que aplanan o sesgan energia (alto)

Descripcion:
- Seleccion de zona y promedios/fallbacks en utilidades de zona pueden aplanar intensidad base.
- Para zonas no canonicas o center/unassigned hay rutas de promedio.

Efecto observable:
- Emision base con apariencia de "modo intermedio" aunque el motor reactivo sea distinto.

Impacto:
- Dificultad para diagnostico visual directo del layout activo.

---

### F5 - Cobertura de tests no protege el caso integrado (medio)

Descripcion:
- Hay tests unitarios de adapters.
- Falta test de integracion que valide seleccion de layout activa + ingest Aether + merge final en arbiter.

Impacto:
- Regresiones de cableado pueden pasar sin deteccion temprana.

---

## 4) Hallazgos criticos de memoria 3D (crash/OOM)

Fuente primaria: RAM-LEAK-DIAGNOSIS.md

### M1 - Hot-loop getState() en useFrame x N fixtures (critico)

Descripcion:
- Lecturas de store dentro de useFrame por fixture en cada frame.
- Escala en O(N fixtures x FPS) y aumenta snapshots/GC pressure.

Impacto:
- Presion sostenida de GC, jitter y degradacion progresiva.
- Con carga real puede gatillar freeze y luego crash.

---

### M2 - Recursos GPU sin dispose() (critico)

Descripcion:
- BufferGeometry/Material recreados por memo sin liberar explicitamente.
- Three.js no libera VRAM automaticamente solo por GC JS.

Impacto:
- Fuga de VRAM acumulativa.
- Riesgo alto de OOM por renderer prolongado.

---

### M3 - Alocaciones frecuentes de objetos visuales (alto)

Descripcion:
- new THREE.Color() y recomputos de quaternions/euler por dependencias inestables.

Impacto:
- GC churn constante.
- Empeora estabilidad en sesiones largas.

---

### M4 - Render 3D activo fuera de visibilidad real (alto)

Descripcion:
- frameloop puede mantenerse en always aunque el usuario no vea realmente el canvas objetivo.

Impacto:
- Consumo continuo de CPU/GPU sin valor de negocio.
- Acelera llegada a estado de agotamiento.

---

### M5 - Fragilidad de puente 2D worker/transient (medio)

Fuente complementaria: PHANTOM-WORKER-AUDIT.md

Descripcion:
- Pipeline indirecto por transientStore y orden de fixtures sensible a indice.
- No explica por si solo el crash 3D, pero agrega fragilidad operativa.

Impacto:
- Estados negros/intermitentes en 2D y mayor complejidad de observabilidad.

---

## 5) Matriz de severidad consolidada

| ID | Dominio | Hallazgo | Severidad |
|---|---|---|---|
| F1 | Fotonica | Split-brain layout 4.1/7.1 | CRITICA |
| F2 | Fotonica | Doble writer dimmer + HTP | CRITICA |
| M1 | Memoria 3D | getState en useFrame x N | CRITICA |
| M2 | Memoria 3D | Recursos GPU sin dispose | CRITICA |
| F3 | Fotonica | Variacion intra-zona espacial/espectral | ALTA |
| F4 | Fotonica | Fallbacks/promedios sesgan base | ALTA |
| M3 | Memoria 3D | Alocaciones frecuentes en render | ALTA |
| M4 | Memoria 3D | Render fuera de visibilidad real | ALTA |
| F5 | Fotonica | Gap de tests integrados | MEDIA |
| M5 | Memoria 3D/2D | Fragilidad puente worker/transient | MEDIA |

---

## 6) Hipotesis causal global

1. El frente fotonico esta dividido por fuente de verdad no unificada (layout elegido vs fuente de ingest).
2. El frente 3D acumula deuda de runtime (GC + VRAM) en loops de alta frecuencia.
3. Cuando ambos coinciden en sesion larga, la app pierde margen de estabilidad: primero jitter/degradacion, luego freeze y potencial crash.

---

## 7) Backlog de remediacion recomendado (para ejecutar despues)

Orden estricto sugerido:

1. Unificar fuente de verdad de layout en Aether (eliminar hardwire de 7.1 para ingest cuando layout activo sea 4.1).
2. Definir politica unica de dimmer (single-writer o composicion determinista no HTP ciego para este canal).
3. Extraer getState() fuera de useFrame y pasar a subscribe->ref en 3D.
4. Implementar dispose() sistematico para recursos GPU recreables.
5. Reducir alocaciones transitorias en hot path de render.
6. Bloquear frameloop cuando canvas no este realmente visible.
7. Agregar pruebas de integracion E2E para:
   - Paridad 4.1 vs 7.1 en salida Aether.
   - Consistencia intra-zona bajo escena fija.
   - Resistencia de memoria en soak test de 20-30 minutos.

---

## 8) Criterios de aceptacion de la fase de fixes

Fotonica:
- Cambiar layout 4.1/7.1 modifica de forma coherente la salida final en nodos IMPACT sin mezcla residual.
- Fixtures de una misma zona cumplen politica definida (uniforme o espacial controlada), sin divergencia accidental.

Memoria:
- Sin crecimiento monotono de VRAM por geometria/material en sesion prolongada.
- Sin aumento sostenido de heap por frame loops durante 20-30 min.
- Sin OOM ni crash en escenario de carga nominal.

---

## 9) Nota de estado

Este documento no aplica fixes. Es un consolidado forense para ejecucion posterior junto con la campana de saneamiento de memoria 3D.

------------------------------------


Hallazgos forenses, ordenados por severidad:

Crítico: split-brain real entre layout seleccionado y layout que inyecta Aether.

En SeleneLux el layout activo sí cambia entre 4.1 y 7.1, y por defecto arranca en 4.1: SeleneLux.ts:396, SeleneLux.ts:462, SeleneLux.ts:629.

Pero en el hot path Aether, TitanOrchestrator toma siempre lastFrame/lastResult de liquidEngine71 para L0: TitanOrchestrator.ts:1742, TitanOrchestrator.ts:1743.

Además ImpactAdapter también queda cableado por defecto a liquidEngine71: ImpactAdapter.ts:117, y el orchestrator lo instancia sin inyectar engine alterno: TitanOrchestrator.ts:338.

Resultado práctico: puedes estar en 4.1 a nivel SeleneLux/UI, pero Aether (dimmer físico) sigue reaccionando con 7.1.

Crítico: doble productor de dimmer sobre los mismos nodos con arbitraje HTP.

LiquidAetherAdapter escribe dimmer en L0: LiquidAetherAdapter.ts:49, LiquidAetherAdapter.ts:246.

ImpactAdapter también escribe dimmer: ImpactAdapter.ts:64, ImpactAdapter.ts:200.

NodeArbiter resuelve dimmer por HTP (máximo), no por prioridad efectiva: NodeArbiter.ts:46, NodeArbiter.ts:268.

Efecto: si los dos adapters discrepan, gana el pico más alto por nodo y frame, generando asimetrías y comportamiento “mezcla rara” entre modos.

Alto: diferencias dentro de la misma zona causadas por modulación espacial y espectral por fixture.

ImpactAdapter no usa zoneId semántico del nodo para dimmer, usa posición X/Z y regla de zona media: ImpactAdapter.ts:195, zoneUtils.ts:166, zoneUtils.ts:173.

También aplica falloff por distancia al epicentro y bandMix por fixture: ImpactAdapter.ts:189, ImpactAdapter.ts:199, ImpactAdapter.ts:200.

Con eso, dos fixtures “misma zona” pueden terminar con intensidades/reacción distintas por geometría y perfil de banda, aunque musicalmente esperes igualdad.

Alto: L0 introduce promedios y fallbacks que tienden a “aplanar” emisión.

Para zoneId no canónicos, hay fallback a promedio de 6 zonas: zoneUtils.ts:131.

Para center/unassigned/mid se usa promedio de 9 zonas en L0: LiquidAetherAdapter.ts:347, LiquidAetherAdapter.ts:352.

Eso puede dar sensación de “emisión base 4.1-ish” aunque la dinámica interna venga de 7.1.

Medio: cobertura de test no protege el caso real de conmutación 4.1/7.1 en Aether end-to-end.

Hay tests unitarios de LiquidAetherAdapter aislado: liquid-aether-adapter.test.ts:222.

Hay tests de ImpactAdapter con engine mock, no cableado real de SeleneLux layout + Orchestrator + Arbiter: core-systems.test.ts:349, core-systems.test.ts:355.