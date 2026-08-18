

## 2. BPM 199 EN REGGAETON — Error de Octava + Freewheel Stale

### Síntoma
El log muestra tres patrones de BPM:

| Línea | context.bpm | oracle | kalman | conf | PLL | Estado |
|-------|-------------|--------|--------|------|-----|--------|
| 1112  | **199.13**  | 99.01  | 98.88  | 0.19 | FREEWHEEL | context.bpm = 2× oracle |
| 62    | **136.06**  | 195.92 | 195.84 | 0.12 | FREEWHEEL | context.bpm ≈ 0.7× oracle |
| 407   | **130.61**  | 130.61 | 130.61 | 0.66 | LOCKED    | Todos coinciden ✅ |

### Causa raíz — Gate de confianza + freewheel memory en bucle

El flujo de BPM (TickEngine.ts:395-570) tiene esta cadena de prioridad:

```
1. workerConfidence > 0.5  →  context.bpm = acceptedBpm (hysteresis-filtered)
2. freewheel memory activa  →  context.bpm = lastStableWorkerBpm (stale)
3. sin memoria              →  context.bpm = beatState.bpm (pacemaker)
```

**El problema:** Durante reggaeton, la confianza del detector (`workerConfidence`) es consistentemente baja (0.12–0.30). Esto se debe al patrón dembow que tiene ghost-kicks que confunden al detector.

Como `workerConfidence < 0.5` **siempre**, la cadena cae a Priority 2 (freewheel memory). El sistema usa `lastStableWorkerBpm`, que es el último BPM que se aceptó cuando la confianza fue brevemente >0.5.

**El 199 es un error de octava-up (99×2≈198):**
1. En algún momento temprano, el detector detectó 199 BPM con confianza >0.5 (un octave-up error clásico en reggaeton).
2. Ese valor se guardó en `lastStableWorkerBpm` y `_stableBpm`.
3. La confianza cayó a <0.5 y **nunca volvió a subir**.
4. El sistema ha estado freewheeling a 199 BPM, **ignorando** al oracle que correctamente dice 99 BPM.
5. El EMA (`_smoothedBpm`, α=0.15) mantiene el valor stale porque context.bpm sigue siendo 199.

**El 136 vs 196 es el mismo bug en dirección inversa:** el stale memory tenía 136 (de una sección anterior) y el oracle detectó 196, pero como confianza <0.5, se ignora.

### Por qué el hysteresis gate no ayuda
El hysteresis gate (línea 410-458) con detección de octavas solo se ejecuta **dentro** del bloque `workerConfidence > 0.5`. Como la confianza nunca supera 0.5, el gate nunca se activa, y los valores correctos del oracle son completamente ignorados.

### Confirmación: PLL=LOCKED funciona
En la línea 407, cuando la confianza subió a 0.66, todo coincidió (130.61). El sistema funciona cuando conf > 0.5. El problema es exclusivamente el gate de confianza demasiado estricto para reggaeton.

### Recomendación
- Bajar el gate de confianza de 0.5 a ~0.3 para reggaeton/dembow, O
- Cuando `workerConfidence > 0.3` y el oracle difiere del stale memory por ~2× (octava), inyectar el oracle directamente, O
- Añadir un "stale memory timeout" que decaiga `lastStableWorkerBpm` hacia el oracle después de N segundos en freewheel.

---

## 3. LOGS DEMASIADO VERBOSOS

### Síntoma
Tres líneas de log se disparan **cada frame** (60fps) sin throttle ninguno. En 1153 líneas de log, estas tres representan ~700 líneas (60% del volumen):

### Log 1: DNA Simulation (SeleneTitanConscious.ts:1287-1293)
```
[SeleneTitanConscious] 🧬 DNA: ✅ latin_strobe | ethics=1.134 | dream=0ms | execute
[SeleneTitanConscious] 🧬 DNA: ❌ none | ethics=N/A | dream=0ms | modify
```
**Frecuencia:** Cada frame, sin throttle.
**Comentario en código:** `WAVE 2093.3: DNA SIMULATION LOG restaurado (información vital para debug)` — alguien lo restauró sin throttle.

### Log 2: INTEGRATOR APPROVED (DreamEngineIntegrator.ts:329-333)
```
[INTEGRATOR] ✅ APPROVED: latin_strobe @ 1.00 | ethics=1.134 | Dream: 0ms | Total: 0ms
```
**Frecuencia:** Cada frame que se aprueba un efecto, sin throttle.

### Log 3: PRE-BUFFER GUARD (DreamEngineIntegrator.ts:244-247)
```
[INTEGRATOR] 🔮🛡️ PRE-BUFFER GUARD: blocking normal approval — "latina_meltdown" sealed, 3s remaining
```
**Frecuencia:** Cada frame mientras hay un pre-buffer activo (hasta 3 segundos = ~180 frames), sin throttle.

### Solución existente
El proyecto ya tiene un utility `throttledLog(reason, message, limitMs)` en DecisionMaker.ts:48 que permite limitar logs por razón. Este patrón debería aplicarse a los tres logs anteriores:
- Log 1: throttle a 1 log/segundo por estado (execute/modify/pre-buffer-guard)
- Log 2: throttle a 1 log/segundo por nombre de efecto
- Log 3: throttle a 1 log/segundo por effectId del pre-buffer

---

## RESUMEN EJECUTIVO

| Problema | Causa | ¿Bug? | Archivo |
|----------|-------|-------|---------|
| corazon_latino no aparece | `filterByZone` usa `aggression` (0.3), no `energyZone`. CLIMAX requiere ≥0.60 | No — comportamiento correcto por diseño | EffectDreamSimulator.ts:575 | SOLUCIONADO
| BPM 199 en reggaeton | Gate `conf>0.5` demasiado estricto → freewheel en stale octave-up value | Sí — gate de confianza no calibrado para dembow | TickEngine.ts:409,513 | POENDIENTE
| Logs verbosos | 3 console.log sin throttle disparándose a 60fps | Sí — throttle removido/restaurado sin protección | SeleneTitanConscious.ts:1288, DreamEngineIntegrator.ts:244,329 |PENDIENTE
