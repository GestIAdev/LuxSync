# Glass Bridge — Espejo Fluido (WAVE 6005 v2)

Arquitectura de transporte de estado Aether hacia la UI y el hardware DMX con cero serializacion y zero-allocation en el hot-path.

## Pilares

### Pilar 1: Hardware via SAB (DMX_UNIVERSE_SAB)

- **SharedArrayBuffer** compartido entre Main Process y `worker_thread` (Phantom Worker).
- Protocolo **seqlock** (`Atomics.add`) para lecturas lock-free.
- 50 universos x 512 canales = 25600 bytes de datos DMX.
- El Phantom Worker lee el SAB a 44Hz y escribe directo al `SerialPort`.
- Cero serializacion, cero IPC por frame.

### Pilar 2: UI via ArrayBuffer transferible (Ping-Pong)

- **BufferPoolManager** (Main) mantiene un pool de 3 `ArrayBuffer` pre-asignados.
- Cada tick (44Hz) copia el estado maestro (Float32Array) a un buffer libre y lo transfiere al Renderer via `MessageChannelMain`.
- El Renderer recibe el buffer en `window.glass.onFrame`, lo consume en `requestAnimationFrame`, y lo devuelve con `window.glass.ackFrame()`.
- Zero-copy, zero-allocation. Unica copia: ~5 microsegundos (memcpy del SAB al buffer).

## Contrato Sagrado del Ping-Pong

**El frontend DEBE llamar a `window.glass.ackFrame()` dentro del `requestAnimationFrame`.**

Si no se llama a `ackFrame()`:

1. El buffer queda retenido en el Renderer.
2. El pool del `BufferPoolManager` se vacia (3 buffers en vuelo).
3. `pushFrame()` retorna sin enviar (frame drop intencional).
4. La UI se congela: deja de recibir actualizaciones.

El frame drop intencional es un mecanismo de backpressure: si el Renderer va lento, el Main descarta frames para que la UI siempre converja al estado mas reciente en lugar de acumular latencia.

## API de window.glass

```typescript
interface GlassAPI {
  connect(): Promise<{ maxFixtures: number; floatsPerFix: number }>
  onFrame(callback: (view: Float32Array) => void): () => void
  ackFrame(): void
}
```

- `connect()` — handshake inicial (reservado para futura negociacion de capacidad).
- `onFrame(cb)` — suscribe un callback que recibe la vista `Float32Array` del frame actual. Retorna funcion de unsubscribe.
- `ackFrame()` — confirma consumo y devuelve el `ArrayBuffer` al pool del Main.

## Layout de memoria

Definido en `layout.ts`:

| Constante | Valor | Descripcion |
|---|---|---|
| `MAX_FIXTURES` | 2048 | Max fixtures en el SAB de estado |
| `FLOATS_PER_FIX` | 16 | Campos por fixture (R,G,B,W,A,dimmer,pan,tilt,etc.) |
| `FIX_DATA_FLOATS` | 32768 | Total floats = 2048 x 16 |
| `FIX_DATA_BYTES` | 131072 | ~128 KB por frame |

## Telemetria

El `BufferPoolManager` expone `getMetrics()`:

```typescript
{
  framesSent: number    // frames enviados al Renderer
  framesDropped: number  // frames descartados por pool vacio
  inFlight: number       // buffers en vuelo (en poder del Renderer)
  poolFree: number       // buffers disponibles en el pool
}
```

Un `setInterval` de 2s en `TitanOrchestrator.start()` loguea estas metricas en consola.

## Archivos del modulo

| Archivo | Rol |
|---|---|
| `layout.ts` | Constantes y offsets del SAB |
| `GlassMemory.ts` | `FixtureStateWriter` / `FixtureStateReader` con seqlock |
| `DmxSabHandlers.ts` | `DmxUniverseWriter` / `DmxUniverseReader` para DMX |
| `BufferPoolManager.ts` | Pool de buffers transferibles + ping-pong |
| `dmxPhantomWorker.ts` | Worker thread que lee SAB y escribe SerialPort |
| `glassPreload.ts` | `window.glass` API en el Renderer |
| `GlassCanvas.tsx` | Componente React con rAF + ackFrame |
