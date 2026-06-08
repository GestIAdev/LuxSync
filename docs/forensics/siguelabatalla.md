Informe Forense WAVE 5043 — MICROTASK FLOOD & IPC BACKPRESSURE
TAREA 1: Suscripciones Reactivas (Zustand) — Renderizado en vacío
Componente	Suscripción	Hallazgo
CommandDeck.tsx	setInterval(fetchStatus, 250)	NO escucha selene:truth. Hace polling IPC aether:getControlState cada 250ms. La resolución del Promise genera un microtask que actualiza estado local + controlStore + effectsStore. React 18 batcha las setState y flushea un re-render del árbol completo del deck (4 re-renders/s en reposo). @/electron-app/src/components/commandDeck/CommandDeck.tsx:55-99
GrandMasterSlider.tsx	Ninguna (props)	Presentacional, sin React.memo. Se re-renderiza forzosamente cada vez que CommandDeck lo hace. @/electron-app/src/components/commandDeck/GrandMasterSlider.tsx:21
VibeSelectorCompact.tsx	useVibeStore + usePowerStore	Baja frecuencia (solo cambia por interacción). No genera re-renders en reposo.
MoodToggle.tsx	MoodController.subscribe()	Baja frecuencia. No genera re-renders en reposo.
NeuralCommandView.tsx	useTruthSystem()	useTruthSystem usa useShallow(selectSystem). selectSystem retorna el objeto system completo. Como truthStore reemplaza el objeto raíz en cada setTruth, system es una referencia nueva y system.frameNumber / system.timestamp cambian siempre → useShallow detecta delta → re-render en cada truthStore update. @/electron-app/src/hooks/useSeleneTruth.ts:341-343, @/electron-app/src/stores/truthStore.ts:122
ChromaticCoreComplete.tsx	useTruthContext()	Idem: selectContext retorna objeto context nuevo con timestamp cambiante. Re-render en cada truth update.
ConsciousnessView.tsx	useTruthAI()	Idem con selectAI sobre consciousness.ai.
TacticalCanvas.tsx	useFixtureData() → useHardware()	useHardware usa useShallow(selectHardware). hardware.fixtures es un array nuevo (.map() del backend) en cada truth → re-render y recálculo de useMemo en useFixtureData. @/electron-app/src/components/hyperion/views/tactical/useFixtureData.ts:107
"vibecompat"	—	No existe módulo ni componente con ese nombre en el frontend. Probablemente se refiere a VibeSelectorCompact, que es inocuo en reposo.
Conclusión TAREA 1: El "renderizado en vacío" no viene de escuchar selene:truth completo con selectores atómicos malos, sino de selectores que retornan objetos compuestos (system, context, hardware) cuyas referencias cambian en cada truthStore update. useShallow compara clave por clave, pero primitivas como frameNumber y timestamp mutan siempre, forzando re-render. CommandDeck añade 4 re-renders/s propios por su polling.

TAREA 2: El Embudo de Deserialización (selene:truth)
Paso	Frecuencia	Hallazgo
Emisión (main)	~7.2Hz manual / 44Hz Chronos	BroadcastManager.emitFullTruth crea un objeto SeleneTruth completo (con .map() sobre todos los fixtures) cada TRUTH_BROADCAST_DIVIDER = 6 ticks. @/electron-app/src/core/orchestrator/tick/BroadcastManager.ts:126-292
Hot-frame (main)	22Hz manual / 44Hz Chronos	emitHotFrame también crea objetos nuevos con .map(fixtureStates => ...) cada HOT_FRAME_DIVIDER = 2 ticks. @/electron-app/src/core/orchestrator/tick/BroadcastManager.ts:69-121
Serialización IPC (main)	Igual que emisión	mainWindow.webContents.send('selene:truth', truth) ejecuta V8 Structured Clone síncrono en el hilo principal. El código tiene una sonda que alerta si tarda >5ms: @/electron-app/src/electron/main.ts:594-602
Recepción (renderer)	Igual que emisión	window.lux.onTruthUpdate recibe el objeto deserializado masivo.
Throttle Zustand	Cada 6 mensajes IPC	TRUTH_THROTTLE_INTERVAL = 6 en useSeleneTruth.ts. En manual: ~1.2Hz. En Chronos (44Hz IPC): ~7.3Hz. El throttle es por conteo, no por tiempo; en modo Chronos la UI recibe updates ~7x más rápido de lo esperado. @/electron-app/src/hooks/useSeleneTruth.ts:80-81
Deserialización implícita	Cada mensaje IPC	Cada selene:truth que llega al renderer fuerza a V8 a deserializar y asignar nuevo heap para todo el árbol (fixture arrays, objetos anidados). Aunque el throttle de Zustand reduce React re-renders, el GC del renderer sigue recibiendo ~7 objetos masivos por segundo que deben ser recolectados.
Conclusión TAREA 2: La UI no está forzando un "parseo completo del universo a 44Hz", pero sí recibe selene:truth a ~7.2Hz y selene:hot-frame a 22Hz. El cuello de botella real es que el main process serializa objetos gigantes síncronamente dentro del tick loop, y el throttle del renderer es insuficiente en modo Chronos.

TAREA 3: Verificación del "Falso Aislamiento" del Worker UI
Worker / Hilo	Rol	Aislamiento real
hyperion-render.worker	Web Worker para Canvas 2D táctico	Solo aísla el pintado de canvas. El hilo principal del renderer sigue corriendo el pump RAF a 60fps (clear Map + pack Float32Array + postMessage), React, R3F y todas las suscripciones Zustand. @/electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx:99
React / Zustand / R3F	UI completa	Corren en el hilo principal del renderer. No hay worker dedicado a React.
TrinityOrchestrator (Alpha)	Hilo principal del main process	Gestiona Beta/Gamma (worker_threads) para audio y lighting, pero el broadcast IPC y la recepción de mensajes del renderer corren en el hilo principal. @/electron-app/src/workers/TrinityOrchestrator.ts:1-16
IPC inbound (main)	lux:audio-buffer + lux:audio-frame	~120 handlers/segundo en ipcMain.on dentro del hilo principal. @/electron-app/src/core/orchestrator/IPCHandlers.ts:524-562
Conclusión TAREA 3: El "Worker UI" no existe como tal. El único worker del renderer solo dibuja; React sigue en el hilo principal. En el main process, los Node.js worker threads (Beta/Gamma) computan audio/lighting, pero Alpha (hilo principal) hace toda la serialización/deserialización IPC. No hay backpressure que cruce de renderer a main a nivel de V8 compartido (son procesos OS separados), pero sí hay bloqueo del hilo principal del main process por la serialización síncrona de webContents.send y la alta tasa de handlers entrantes.

Cuello de botón exacto en las microtasks (renderer)
El bloqueo de 38ms en la cola de microtasks se produce cuando:

CommandDeck resuelve su polling cada 250ms (microtask de Promise).
En ese microtask, llama setArbiterStatus + setOutputEnabled + setBlackout.
React 18 (automatic batching) acumula estas actualizaciones y las flushea dentro del mismo microtask.
Si en ese instante coincide una actualización de truthStore (desde useSeleneTruth en otro microtask/macrotask), React batcha TODO en un único paso de render.
El paso de render incluye:
Re-render de CommandDeck + hijos no memoizados.
Re-render de TacticalCanvas (si useHardware detectó delta).
Re-render de paneles UI (NeuralCommandView, ChromaticCoreComplete, etc.) si truthStore cambió.
Si el árbol de componentes afectados es grande, el render phase dura 38ms, ocupando la microtask queue y bloqueando cualquier otra microtask pendiente (incluyendo posibles callbacks de IPC).
Veredicto ejecutivo
Síntoma	Causa raíz real	Ubicación
Microtasks 38ms en renderer	React 18 batching + re-render simultáneo de CommandDeck (polling) + paneles UI (truthStore object selectors)	@/electron-app/src/components/commandDeck/CommandDeck.tsx:64-99, @/electron-app/src/hooks/useSeleneTruth.ts:341-343
DMX flicker / jitter	Serialización síncrona masiva (webContents.send) + 120 handlers IPC entrantes/s en el hilo principal del main process	@/electron-app/src/electron/main.ts:594-602, @/electron-app/src/core/orchestrator/IPCHandlers.ts:524-562
Falso aislamiento	No existe worker aislado para React ni para serialización IPC. Trinity workers computan, pero Alpha hace todo el I/O.	@/electron-app/src/workers/TrinityOrchestrator.ts:1-16
truthStore throttle insuficiente en Chronos	TRUTH_THROTTLE_INTERVAL = 6 por mensaje. A 44Hz IPC → ~7.3Hz updates a React, no ~5fps.	@/electron-app/src/hooks/useSeleneTruth.ts:80-81
Nota: No se encontró componente "vibecompat". Si existe en otro módulo, no está bajo src/components ni src/stores.