# 🔍 DIRECTIVA DE REINGENIERÍA: WAVE 5009 — CASSANDRA'S REVENGE & THE SILENT ASSASSIN

## Análisis Forense del Motor Aether (Minimal Techno)

Tras la revisión exhaustiva de los logs (`calibminimal.md` y `logcortominimal.md`) y la arquitectura del motor, hemos identificado tres factores críticos que causaban bloqueos silenciosos en géneros con dinámicas de energía sutiles como el Minimal Techno.

### 1. El Asesino Silencioso (Los Logs de Bloqueo)

En revisiones anteriores (WAVE 4998 y 4865), varios logs vitales fueron silenciados para reducir el "spam" en la consola. Esto nos dejó ciegos ante bloqueos legítimos del sistema. Específicamente:
- El `SILENCE` por falta de propuesta de DNA.
- El `ANTI-FAKE-DROP`, que abortaba efectos pesados cuando la energía parecía insuficiente.
- Las compuertas de caída (`AbsGate` y `SpectralGate`), que prevenían disparos pesados en valles de energía.

**La Solución:** Implementar un mecanismo de "Throttle" (WAVE 5009 FIX 1). En lugar de silenciar los logs o permitir que inunden la consola a 44Hz, ahora utilizamos un `logThrottles` (Map) que limita estos mensajes a 1 por segundo, restaurando la visibilidad del arquitecto sin sacrificar el rendimiento.

### 2. La Fortaleza Excesiva del Anti-Fake-Drop

El Techno Minimal no se caracteriza por explosiones de Z-Score; sus subidas son texturizadas y rítmicamente planas. El `antiFakeThreshold` exigía `0.2` de Z-Score (en pistas que no reventaban subgraves). 

En el log observamos:
```
[INTEGRATOR] ✅ APPROVED: lateral_frag @ 0.99
[SeleneTitanConscious] 🧬 DNA: ✅ lateral_frag | ethics=1.000 | dream=1ms | execute
[SeleneTitanConscious] 🧠 Hunt=stalking Fuzzy=🎯strike Z=1.2σ
```
El sistema Integrador aprobaba el efecto, la IA Difusa pedía disparar, pero si el Z-score en ese milisegundo caía por debajo del umbral, el `DecisionMaker` lo abortaba en silencio.

**La Solución:** Confianza en el ADN (WAVE 5009 FIX 2). Si el `vibe` es Techno, el pipeline de integración (`dreamIntegration`) ya ha aprobado el efecto, y estamos en perfiles permisivos (`PUNK` o `BALANCED`), reducimos drásticamente el escudo a `-0.2`. Esto permite que los "efectos pesados pero texturizados" respiren, reconociendo que el Minimal juega con reglas de tensión diferentes.

### 3. El Contrato Blindado de Cassandra

El hallazgo más crítico: "La Venganza de Cassandra".
Cassandra (el simulador de sueños) es brillante prediciendo eventos. En el log:
```
[DREAM_SIMULATOR] 🔮📦 CASSANDRA PRE-BUFFER: "solar_flare" stored for transition_beat in ~2.0s (85% confidence)
[DREAM_SIMULATOR] 🔮🛡️ TEMPORAL SEAL: solar_flare → 'modify' (pre-buffer active, timeToEvent=2000ms)
```

Sin embargo, cuando el evento era inminente, Cassandra usaba el `FAST PATH` y cambiaba su recomendación a `execute`. Pero el `DreamEngineIntegrator.ts` de la WAVE 4913 tenía un "Temporal Seal Gate" absoluto:
```typescript
if (dreamResult.recommendation === 'modify') { return { approved: false ... } }
```

El problema radicaba en que el `EffectDreamSimulator` no siempre actualizaba la `recommendation` a tiempo o el Integrador la filtraba incorrectamente en el FAST PATH. 

**La Solución:** Re-sellar el Contrato Blindado (WAVE 5009 FIX 3). Ahora, cuando Cassandra invoca el `FAST PATH`, inyecta la frase literal `FAST PATH` en el `reason`. El Integrador lee esto y, **aunque la recomendación diga 'modify'**, si detecta que es un FAST PATH dictado por el oráculo, hace bypass del Temporal Seal y fuerza la ejecución. El Oráculo manda.

---

## 🛠️ Modificaciones Realizadas

### FIX 1: Un-Silence the Assassin
- Inyectado `throttledLog` (max 1/seg) en `DecisionMaker.ts`.
- Restaurados logs de `SILENCE: DNA has no proposal`.
- Restaurados logs de `ANTI-FAKE-DROP`.
- Restaurados logs de `DROP BLOCKED (AbsGate)` y `(SpectralGate)`.

### FIX 2: Bajar los Escudos para Minimal
- En `DecisionMaker.ts`, bajo la sección de Techno, si `dreamIntegration.approved` es `true` y el perfil es `PUNK` o `BALANCED`, el `antiFakeThreshold` cae a `-0.2`.

### FIX 3: El Contrato Blindado de Cassandra
- Modificado `EffectDreamSimulator.ts` (FAST PATH) para inyectar explícitamente `🔮 CASSANDRA FAST PATH` en el `reason`.
- Modificado `DreamEngineIntegrator.ts` para verificar `isFastPath = dreamResult.reason.includes('FAST PATH')` y evitar el bloqueo prematuro del `Temporal Seal Gate`.

Todas las directivas han sido aplicadas sin refactorizaciones masivas, respetando la estructura arquitectónica (ZERO REFACTOR).
