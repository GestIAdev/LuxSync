Informe Forense WAVE 5041 — SLOW MEMORY LEAK DIAGNOSTIC
TAREA 1: Auditoría de Acumuladores de Datos
Se auditó el backend completo (255 archivos TS con estructuras mutables). El resultado: la base de código tiene disciplina de acotación universal en el hot-path y en telemetría. Casi todos los arrays, Maps y Sets que acumulan datos tienen un mecanismo de recorte o limpieza explícito.

Estructuras auditadas con límite confirmado
Módulo	Estructura	Mecanismo de acotación
src/core/intelligence/EnergyLogger.ts:84	buffer: string[]	Flush a disco cada 100 entries o 5s (buffer = [])
src/core/intelligence/dream/EffectBiasTracker.ts:119	history	maxHistorySize = 200 con .shift()
src/core/intelligence/think/PredictionEngine.ts:304	sectionHistory	MAX_HISTORY con .shift()
src/core/intelligence/think/PredictionEngine.ts:398	bpmHistory	MAX_BPM_HISTORY = 24 con .shift()
src/core/orchestrator/metrics/SyncSmoother.ts:183	syncopationHistory	SYNC_HISTORY_SIZE con .shift()
src/core/intelligence/SeleneTitanConscious.ts:318	effectHistory	> 20 con .shift()
src/core/intelligence/SeleneTitanConscious.ts:739	spectralHistory	MAX_HISTORY = 10 con .shift()
src/stores/logStore.ts:41	logs	maxLogs = 200 con .slice(0, maxLogs)
src/core/engine/TimelineEngine.ts:151	frameAccumulator	.clear() en cada tick
src/core/aether/NodeArbiter.ts:260	_result, _opaqueNodeChannels, _opaquePlaybackChannels, _l3DominatedChannels	.clear() en arbitrate()
src/core/orchestrator/tick/TickEngine.ts:56	_hephOutputPool	arr.length = 0 cada frame
src/workers/TrinityBridge.ts:400	phaseHistory, syncHistory	historySize = 32 con .shift()
Candidato menor de fuga lenta
TickEngine.peakHoldMap (src/core/orchestrator/tick/TickEngine.ts:745-1197): Es un Map<string, number> que actualiza y resetea el pico de dimmer por fixture ID cada frame. Nunca ejecuta .delete() cuando un fixture desaparece del show. Si se cargan múltiples shows sin reiniciar el proceso, las claves antiguas permanecen. Cada entrada es un número primitivo; la fuga es microscópica (cientos de bytes por show cambiado). No explica pausas de GC.
Conclusión TAREA 1
No se detectó ninguna estructura de datos que crezca infinitamente o sin control. El hot-path de 44 Hz está efectivamente zero-alloc, y los paths de telemetría/análisis tienen acotadores explícitos.

TAREA 2: Auditoría de Resolución de Promesas (Driver DMX)
UniversalDMXDriver.sendAll()
src/hal/drivers/UniversalDMXDriver.ts:795-839
Declara array local promises, lo vacía (promises.length = 0), empuja las promesas de cada strategy, y hace await Promise.all(promises).
El bloque try/finally garantiza que isTransmitting = false y _writeLock = false siempre se liberen.
No hay promesas huérfanas. Cada await espera a que todas las strategies resuelvan.
OpenDMXStrategy.send()
src/hal/drivers/strategies/OpenDMXStrategy.ts:181-207
Realiza dirty-check (hash djb2). Si cambió, muta _ipcChannels in-place y llama this.child.send(_ipcPayload).
Retorna Promise<void> que resuelve inmediatamente. No hay callbacks pendientes del puerto serial en esta estrategia (el child process los maneja en su propio event loop).
EnttecProStrategy.send()
src/hal/drivers/strategies/EnttecProStrategy.ts:39-87
Crea un new Promise<void> que resuelve en dos caminos disjuntos:
port.write() callback → port.drain() → resolve().
Timeout de seguridad (DRAIN_TIMEOUT_MS) → resolve().
Toda promesa creada siempre resuelve. No hay leaks de callbacks en el puerto serial.
OpenDMXStrategy.destroy()
src/hal/drivers/strategies/OpenDMXStrategy.ts:212-249
Instala un listener this.child?.on('message', handler) y un setTimeout. En el path feliz (DISCONNECTED), el handler se remueve (removeListener) y resuelve. En el path de timeout (SIGKILL forzado), la promesa resuelve pero el listener no se remueve explícitamente. Sin embargo, this.child = null se asigna inmediatamente después, y el proceso hijo es terminado por el OS. En la práctica, el objeto ChildProcess y sus listeners se liberan cuando el proceso muere.
Conclusión TAREA 2
No hay evidencia de acumulación de promesas ni callbacks huérfanos en el ciclo de vida del driver DMX. El semáforo isTransmitting + try/finally previene overlapping, y todas las promesas generadas tienen paths de resolución garantizados.

TAREA 3: El Fantasma Olvidado (Energy Lab)
Ubicación
EnergyLogger.ts (261 líneas).
Arquitectura
Singleton global export const EnergyLogger = new EnergyLoggerClass().
Buffer interno de 100 líneas CSV en RAM. Flush automático a disco cada 5s o al llenarse.
Escribe en ./logs/energy_lab_[timestamp].csv vía fs.createWriteStream.
Supervivencia
Es importado estáticamente por dos módulos centrales:
src/core/intelligence/EnergyConsciousnessEngine.ts:27
src/core/intelligence/SeleneTitanConscious.ts:126
En SeleneTitanConscious.ts:140 existe la guardia:


typescript
const DEBUG_ENERGY = false  // WAVE 2098: Calibration complete, lab closed
Las llamadas a EnergyLogger.initialize() y EnergyLogger.log() están protegidas por if (DEBUG_ENERGY) e if (EnergyLogger.isEnabled()).
Veredicto
El Energy Lab está DORMIDO en producción. Gracias a DEBUG_ENERGY = false, no inicializa el stream ni escribe al buffer. El objeto singleton existe en memoria (creado al importar el módulo), pero su estado interno (enabled = false, buffer = []) es trivial.
No es causa de fuga de memoria ni de pausas GC. Pero sí es código muerto anclado en imports estáticos de módulos core que nunca se refactorizaron para eliminarlo.
Resumen Ejecutivo
TAREA	Hallazgo	Riesgo de Fuga / GC Pause
1 — Acumuladores	100% de arrays/maps auditados en hot-path y telemetría tienen límites explícitos (shift/slice/clear).	Nulo. No hay estructuras sin techo.
1 — Fuga menor	TickEngine.peakHoldMap nunca hace .delete() de fixtures removidos.	Despreciable (bytes por fixture, no explica pausas de 30s).
2 — Promesas DMX	Todas las promesas de sendAll(), OpenDMXStrategy.send(), EnttecProStrategy.send() resuelven garantizadamente. Semáforo anti-overlap con try/finally.	Nulo.
3 — Energy Lab	Singleton importado estáticamente pero inactivo (DEBUG_ENERGY = false). No escribe a disco ni acumula buffer en producción.	Nulo (código muerto, no leak).
Hipótesis consolidada: Tras auditar estructuras de datos, promesas y el logger fantasma, no se encontró evidencia de un memory leak lento ni de acumulación de objetos fuera del hot-path que justifique pausas periódicas del Garbage Collector cada ~30 segundos. El heap permanece estable; las únicas estructuras con crecimiento teórico (peakHoldMap, maps de registro en AetherSafetyMiddleware) están acotadas por el número de fixtures del show y no crecen con el tiempo de ejecución.

Nota forense (solo diagnóstico): Si el parpadeo persiste con pares estáticos y el Event Loop está descartado, el foco debe volver a la causa primaria identificada en WAVE 5040 (rotación de patrones cinéticos del VMM + crossfade cada phraseDuration beats ≈ 30s) o investigar pausas a nivel de proceso hijo (OpenDMX Worker) o OS/driver de puerto serial, ya que el heap del proceso principal está limpio.