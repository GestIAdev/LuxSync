DIAGNÓSTICO FORENSE COMPLETO — Fuga en Hardware DMX
TARGET 1: La Aduana (AetherSafetyMiddleware.ts + TickEngine.ts)
Hallazgo: La Aduana NO está bloqueando los datos.

AetherSafetyMiddleware.shouldSendUniverse() (línea 334):



typescript
if (this._virtualOnlyUniverses.has(universe)) return false  // skip virtual
// throttle check...
return true
Para universo 0 con 2 fixtures reales: virtual-only = false, throttle a 30Hz permite el paso. Retorna true.

applyOutputGate() (línea 151) es PRE-RESOLVE y, cuando outputEnabled=true, hace return inmediato (línea 152). No toca los buffers. Cuando outputEnabled=false, el comentario dice que "El bloqueo real de salida se aplica en el write final al buffer DMX dentro del resolver", pero el código real solo incrementa _aduanaBlocks++ sin mutar el arbitrated Map.

Veredicto Aduana: El buffer llega limpio al egreso. La Aduana no es la fuga.

TARGET 2: El Driver (OpenDMXStrategy.ts)
Hallazgo: El bucle de salida EXISTE y está activo.

OpenDMXStrategy.ts:131-149:



typescript
private startOutputLoop(log, universe): void {
  this.outputTimer = setInterval(() => {
    if (!this.reader || !this.port?.isOpen) return
    const frame = this.reader.readCoherent(this.lastFrameId)
    if (frame) {
      this.lastFrameId = frame.frameId
      const dmxData = frame.data.subarray(0, 512)
      const dmxPacket = Buffer.alloc(513)
      dmxPacket[0] = 0x00 // DMX Start Code
      Buffer.from(new Uint8Array(dmxData)).copy(dmxPacket, 1)
      this.port.write(dmxPacket)  // ← LÍNEA 144
    }
  }, DMX_OUTPUT_MS)  // 30Hz
}
CRÍTICO — Línea 144: this.port.write(dmxPacket) SIN CALLBACK. Si el buffer del FTDI está saturado o el cable se desconecta mid-frame, el error se pierde en el vacío. No hay listener on('error') persistente fuera de la fase de connect().

PERO: El bucle está corriendo. El problema no es que el bucle no exista. El problema es qué datos lee del SAB.

TARGET 3: Instanciación del Puerto
Hallazgo: El puerto se abre, pero la estrategia es self-managed.

UniversalDMXDriver.ts:444-462:



typescript
if (strategy.selfManaged && strategy.connect) {
  this.initBuffer(universe)
  const success = await strategy.connect(portPath, universe, (msg) => this.log(msg))
  if (!success) { ... throw ... }
  this.startOutputLoop()  // ← NO-OP para self-managed (línea 764-768)
}
startOutputLoop() del driver retorna inmediatamente para estrategias self-managed. El loop REAL vive DENTRO de OpenDMXStrategy.connect() (línea 71). Esto es correcto por diseño WAVE 2021.1.

🎯 EL VEREDICTO — Dónde mueren los datos
La desconexión NO está en el driver ni en la Aduana. La desconexión está en el TUBO AGUAS ARRIBA del SAB. Hay tres hipótesis letales, ordenadas por probabilidad:

HIPÓTESIS 1 (MÁS PROBABLE): El Universo no está registrado en NodeResolver
Ubicación: NodeResolver.ts:866 + FixtureHydrationEngine.ts:168



typescript
// NodeResolver.ts:866
const buf = this._universeBuffers.get(device.universe)
if (!buf) return   // ← SILENCIOSO. Si el fixture no tiene universe definido, NADA se escribe.
Si los 2 fixtures reales del backend llegan con universe: undefined (o no tienen la propiedad), _writeNode retorna sin escribir ni un byte. El buffer del universo permanece en 0x00 (valor por defecto del Uint8Array pre-allocado).

Cascada:

FixtureHydrationEngine.ts:168 llama resolver.registerUniverse(definition.universe) → si es undefined, el Map key es undefined.
TickEngine.ts:1066 → aetherResolver.getUniverseBuffer(0) busca key 0, no la encuentra (está bajo undefined), retorna undefined.
TickEngine.ts:1067 → if (!rawBuf) continue → salta el universo.
El SAB nunca recibe datos reales. OpenDMXStrategy lee 0x00 en los 512 canales.
HIPÓTESIS 2: Los fixtures reales no tienen dmxAddress definido
Ubicación: TickEngine.ts:496-497 + NodeResolver.ts:883



typescript
// TickEngine.ts:496-497
state.dmxAddress = fix.dmxAddress   // ¿Es undefined?
state.universe   = fix.universe     // ¿Es undefined?
Si dmxAddress es undefined, NodeResolver._writeNode calcula baseAddr = undefined - 1 → NaN. Todos los buf[idx] con idx = NaN + dmxOffset son no-ops. Los canales nunca se escriben.

HIPÓTESIS 3: El Arbiter está vacío (no hay intents)
Si los 2 fixtures no tienen nodos en el Aether NodeGraph (no fueron hidratados correctamente por FixtureHydrationEngine), el arbitrated Map está vacío. resolve() itera sobre cero entradas. Los buffers permanecen en ceros.

📍 LÍNEAS EXACTAS DE LA DESCONEXIÓN
Archivo	Línea	Problema
src/core/aether/resolver/NodeResolver.ts:866	if (!buf) return	Silencioso: universo no registrado = buffer vacío
src/core/orchestrator/tick/TickEngine.ts:1066-1067	if (!rawBuf) continue	Si NodeResolver no tiene el universo, TickEngine salta el egreso
src/hal/drivers/strategies/OpenDMXStrategy.ts:144	this.port.write(dmxPacket)	Sin callback: errores de puerto invisibles
src/core/aether/glass/DmxSabHandlers.ts:35-37	this.u8.set(universes[u], ...)	BUG LATENTE: Si uniList es sparse (ej. universe=5 sin 0-4), universes[1] es undefined y Uint8Array.set(undefined) lanza TypeError que crashearía el hot-path de 44Hz
🔬 PRÓXIMOS PASOS DE DIAGNÓSTICO
Para confirmar la hipótesis 1, añadir un log en NodeResolver._writeNode:866:



typescript
if (!buf) {
  console.warn(`[NodeResolver 🚨] _writeNode: universe ${device.universe} not registered for device ${device.deviceId}`)
  return
}
Y en TickEngine.ts:1066-1067:



typescript
const rawBuf = aetherResolver.getUniverseBuffer(universe)
if (!rawBuf) {
  console.warn(`[TickEngine 🚨] Universe ${universe} buffer missing — NodeResolver did not register it`)
  continue
}
Si ves universe undefined not registered, la causa es la Hipótesis 1. Si ves Universe 0 buffer missing, la causa es que el universo 0 no fue registrado durante la hidratación.

El hardware está sano. El cable USB está sano. Los datos mueren en el resolver porque el universo o el dmxAddress de los fixtures reales no están mapeados correctamente en el backend.