REPORTE FORENSE — AUDITORÍA SALIDA Y RENDIMIENTO UI
1. El Misterio de Sent: 0 y Cero Luces
Hallazgo A: GlassBridge Desconectado del Motor
Archivo: TitanOrchestrator.ts:617-663

El objeto ctx pasado al TickEngine NO incluye glassPool:



TitanOrchestrator.ts:617-663
this.tickEngine = new TickEngine({
  get brain() { return self.brain },
  get engine() { return self.engine },
  // ... ~40 propiedades, pero glassPool AUSENTE
  log: (category, message, data) => this.log(category, message, data),
})
Archivo: TickEngine.ts:1046-1048

Como glassPool no existe en ctx, esta condición nunca se cumple:



TickEngine.ts:1046-1048
if (this.ctx.glassPool) {
  this.ctx.glassPool.pushFrame(view)
}
Diagnóstico: BufferPoolManager.pushFrame() nunca se invoca. framesSent permanece en 0 porque el tubo está cortado en la fuente.

Hallazgo B: SAB Vacío → Hardware Mudo
Archivo: TickEngine.ts:1123-1135

commitFrame solo se ejecuta si uniList.length > 0:



TickEngine.ts:1123-1135
const uniList: Uint8Array[] = []
let dirtyMask = BigInt(0)
for (const universe of aetherResolver.registeredUniverses) {
  const buf = this._universeSnapshots.get(universe)
  if (buf) {
    uniList[universe] = buf
    dirtyMask |= BigInt(1) << BigInt(universe)
  }
}
if (uniList.length > 0) {
  this.dmxWriter.commitFrame(this.frameCount, uniList, dirtyMask)
}
Pero el llenado de _universeSnapshots (línea 1061-1120) tiene múltiples filtros de salida:

aetherSafety.shouldSendUniverse(universe) puede hacer continue.
aetherResolver.getUniverseBuffer(universe) puede devolver null → continue.
Si blackoutActive es true, se usa getSoftBlackoutUniverseBuffer, pero el buffer aún se guarda.
Diagnóstico: Si no hay universos registrados en aetherResolver.registeredUniverses, o si todos son rechazados por shouldSendUniverse / getUniverseBuffer, _universeSnapshots queda vacío. Entonces uniList.length === 0 y commitFrame nunca escribe en el SAB.

Archivo: OpenDMXStrategy.ts:134-141

El outputLoop lee del SAB:



OpenDMXStrategy.ts:134-141
this.outputTimer = setInterval(() => {
  if (!this.reader || !this.port?.isOpen) return
  const frame = this.reader.readCoherent(this.lastFrameId)
  if (frame) {
    this.lastFrameId = frame.frameId
    this.port.write(Buffer.from(new Uint8Array(frame.data.subarray(0, 512))))
  }
}, DMX_OUTPUT_MS)
Diagnóstico: Si commitFrame no escribe, readCoherent devuelve null (frameId no cambia desde -1). port.write nunca se ejecuta → cero luces físicas.

2. El Lag de la UI (3-5 FPS)
Hallazgo C: selene:hot-frame Completamente Purgeado
Búsqueda global en [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/src/](cci:4://file://c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/src/:0:0-0:0) por selene:hot-frame: 0 resultados.

Archivo: TickEngine.ts:756-760



TickEngine.ts:756-760
const emitHotFrame = () => {
  // 💀 WAVE 6005 v2 Phase 5: LA PURGA
  // El JSON estructurado asesino de 44Hz ha sido erradicado.
  // La UI ahora lee de GlassBridge (BufferPool) y el HW de Phantom Worker (SAB).
}
Diagnóstico: emitHotFrame es una función vacía. No hay JSON masivo ni webContents.send asfixiando el renderer. El cuello de botella de 3-5 FPS NO se encuentra en los archivos auditados.

Hallazgo D: GlassCanvas.tsx es Seguro
Archivo: GlassCanvas.tsx:21-65



GlassCanvas.tsx:21-65
const loop = () => {
  const canvas = canvasRef.current
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
 
  const view = latestView.current
  if (view && view.length > 0) {
    // ... renderiza barra de intensidad
    window.glass.ackFrame()
  } else {
    // ... pinta "Esperando frames..."
  }
  rafId.current = requestAnimationFrame(loop)
}
Diagnóstico:

No hay bucle infinito.
view[0] solo se accede tras view.length > 0.
ackFrame() solo se llama cuando hay datos.
No hay excepciones silenciosas que exploten la consola de React.
Conclusión del lag: El código auditado es inocente. El lag de 3-5 FPS proviene de un componente fuera del alcance de esta auditoría (posiblemente otro componente React en el renderer, o el Main Process bloqueado por una operación sincrónica no auditada).

3. La Vía del Hardware
Archivo: OpenDMXStrategy.ts:131-145



OpenDMXStrategy.ts:131-145
private startOutputLoop(log: (msg: string) => void, universe: number): void {
  if (this.outputTimer) return
  this.outputTimer = setInterval(() => {
    if (!this.reader || !this.port?.isOpen) return
    const frame = this.reader.readCoherent(this.lastFrameId)
    if (frame) {
      this.lastFrameId = frame.frameId
      this.port.write(Buffer.from(new Uint8Array(frame.data.subarray(0, 512))))
    }
  }, DMX_OUTPUT_MS)
}
Diagnóstico: El outputLoop tiene dos guardas:

!this.port?.isOpen — Si connect() no logró abrir el puerto (error de serialport o timeout), el loop no escribe.
!frame — Si el SAB no tiene frames nuevos (porque commitFrame no se ejecutó, ver Hallazgo B), tampoco escribe.
RESUMEN EJECUTIVO
Síntoma	Causa Raíz	Ubicación
Sent: 0	glassPool no fue inyectado en el ctx de TickEngine	TitanOrchestrator.ts:617-663
Cero luces	commitFrame condicionado a uniList.length > 0; si no hay universos registrados o todos son filtrados, el SAB permanece vacío y el outputLoop no escribe	TickEngine.ts:1061-1135
UI a 3-5 FPS	No encontrado en código auditado. selene:hot-frame fue purgado. GlassCanvas.tsx es limpio. Buscar fuera de estos archivos.	N/A
Los tapones son:

Desconexión del puente Glass: Falta glassPool en el contexto del motor.
Desconexión del hardware: El SAB no se alimenta porque uniList está vacío (o bien no hay universos registrados, o los filtros de seguridad los bloquean todos).