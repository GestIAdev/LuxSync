Informe Forense WAVE 5039 — READ-ONLY AUDIT
TAREA 1: Rastreo de selene:truth
¿Qué es este módulo? selene:truth no es un módulo; es el canal IPC principal ('selene:truth') por el cual el main process emite el estado completo del sistema (SeleneTruth) al renderer. Se define en electron/main.ts:598 dentro del callback registrado con titanOrchestrator.setBroadcastCallback().

¿Es un remanente de UI antigua? No. Es el backbone vivo de la UI. La arquitectura actual (WAVE 2510) lo mantiene como broadcast de estado completo a ~7 Hz, complementado por selene:hot-frame a 44 Hz para datos dinámicos de fixtures. La store truthStore (src/stores/truthStore.ts:292) y useSeleneTruth.ts dependen exclusivamente de este canal.

¿Por qué bloquea IPC 7.2 ms? El log [IPC PROBE] 🐢 selene:truth BLOCK 7.2ms mide performance.now() alrededor de mainWindow.webContents.send('selene:truth', truth). El objeto truth es una instancia de SeleneTruth (SeleneProtocol.ts), que arrastra fixtures, consciousness, context, hardware y datos sensoriales completos. La serialización de este objeto grande en el IPC bridge de Chromium consume ese tiempo síncrono. No es starvation del event loop de Node, pero es un micro-bloqueo serializado en el hilo principal por cada emisión.

¿Sigue emitiendo durante el tick a 44 Hz? Sí. En TickEngine.ts:1170, this.onBroadcast(truth) se invoca dentro de tick(). La guarda shouldBroadcastFullTruth (TickEngine.ts:737) usa TRUTH_BROADCAST_DIVIDER = 6, por lo que normalmente emite cada 6 frames (~7.3 Hz). PERO si chronosPlaying es true, la guarda se salta y emite en cada frame (44 Hz), amplificando el costo de serialización IPC.

TAREA 2: Auditoría del Buffer DMX — "Suma bytes: 638"
Ubicación del log:

TickEngine.ts:1138
HardwareDispatcher.ts:88
Matemática real:



typescript
let byteSum = 0
for (let _bi = 0; _bi < egressBuf.length; _bi++) byteSum += egressBuf[_bi]
Veredicto: no hay anomalía de tamaño. El nombre del log es confuso: "Suma bytes" no es la longitud del buffer, es la suma aritmética de los valores de cada byte.

egressBuf proviene de aetherResolver.getUniverseBuffer(universe) (NodeResolver.ts:359), que retorna un Uint8Array(512) según su propio JSDoc.
Un universo DMX tiene 512 canales útiles (más start code). Si la mayoría de los canales están en 0 y solo unos pocos fixtures emiten valores bajos (p. ej. 4 movers con RGB tenue ~160 en total por fixture), la suma de 638 es matemáticamente esperable.
No se concatenan universos ni metadatos IPC al buffer que va al puerto serie. El buffer que se suma es el array de valores DMX puros del universo. El log simplemente refleja un escenario de baja intensidad lumínica.
TAREA 3: Confirmación de la Hipótesis "Split-Brain UI"
Ciclo de vida en TrinityProvider.tsx:

Llamada a start() siempre, sin importar el estado: En TrinityProvider.tsx:293-314, startTrinity() hace:


typescript
const current = await window.lux.getState()
if (!current) {
  window.lux.start()      // ← Primera llamada
} else {
  window.lux.start()      // ← SEGUNDA llamada, aunque ya corra
}
El backend (SystemLifecycleManager.start()) tiene guarda if (this.ctx.isRunning) return, por lo que la segunda invocación es un no-op funcional. PERO TitanOrchestrator.start() incrementa _startCount antes de delegar al lifecycle manager, generando el log [GHOST-HUNTER] startCount: 2. Esto explica la alerta sin necesidad de clones reales.
Cleanup en unmount: Existe un useEffect de cleanup explícito (TrinityProvider.tsx:617-621) que llama stopTrinity() al desmontar el provider. stopTrinity() a su vez invoca unsubscribeRef.current() y window.lux.stop().
Flags de protección:
_hasInitializedHandshake (variable global, línea 437) previene doble handshake.
_hasSubscribedToFixtures (variable global, línea 508) previene doble suscripción al canal de fixtures.
hasStartedRef (useRef) previene doble arranque por cambios de powerState.
Conclusión: No hay evidencia de un split-brain real (workers huérfanos, múltiples orquestadores o listeners acumulados). Sin embargo, el patrón en startTrinity() donde se ignora explícitamente el estado de getState() y se re-invoca start() de todos modos genera:

El falso positivo startCount: 2 en Ghost-Hunter.
Una re-suscripción innecesaria de listeners onStateUpdate, onModeChange y onTelemetryUpdate en cada remontaje (aunque unsubscribeRef sobreescribe la referencia anterior, sin acumulación real de listeners).
En React Strict Mode, el ciclo montaje-desmontaje-remontaje ejecutará start() → stop() → start(), lo cual es funcionalmente seguro pero ruidoso en los logs.
Hipótesis confirmada parcialmente: No hay brain split de instancias, pero sí hay una fuga lógica de lifecycle donde el frontend nunca confía en el estado del backend para decidir si llamar start().