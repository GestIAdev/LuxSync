// WAVE 3401: OSC NEXUS PROVIDER -- Open Sound Control Bidirectional Bridge
//
// Pure Node.js implementation using dgram (UDP). Zero external dependencies.
// Manual OSC parser/builder (the format is trivial: address + typetag + args).
//
// LISTEN (port 9000): Receives audio data, control commands, fixture overrides
// PUBLISH (port 9001): Broadcasts LuxSync state (vibe, energy, bpm, bands, beat)
//
// Supports 4 input modes:
//   pcm          -- Raw Float32 mono via blob -> written to ring buffer for FFT
//   bands        -- Pre-analyzed 7-band data -> bypass FFT (future: direct inject)
//   energy-only  -- Just energy float -> basic mode
//   control-only -- No audio, only fixture/vibe/bpm overrides
//
// Rate limiting: max 100 messages/sec per route (drop + warn on overflow)

import * as dgram from 'dgram'
import type {
  IInputProvider,
  InputSourceType,
  InputProviderStatus,
  InputProviderConfig,
  InputProviderDiagnostics,
  AudioDeviceInfo,
  OSCArgument,
  OSCMessageHandler,
  OSCSenderInfo,
  OSCNexusConfig,
} from './OmniInputTypes'

// ============================================
// OSC BINARY PROTOCOL (RFC 6295 subset)
// ============================================
// OSC Message Layout:
//   [address string, padded to 4-byte boundary, null terminated]
//   [type tag string: "," + type chars, padded to 4-byte boundary]
//   [arguments: each typed according to type tag]
//
// Argument encoding:
//   'f': Float32 big-endian (4 bytes)
//   'i': Int32 big-endian (4 bytes)
//   's': null-terminated string, padded to 4 bytes
//   'b': Int32 size (big-endian) + data + padding to 4 bytes

function alignTo4(n: number): number {
  return (n + 3) & ~3
}

function readOSCString(buf: Buffer, offset: number): { value: string; nextOffset: number } {
  let end = offset
  while (end < buf.length && buf[end] !== 0) end++
  const value = buf.toString('ascii', offset, end)
  const nextOffset = alignTo4(end + 1) // skip null terminator + padding
  return { value, nextOffset }
}

function writeOSCString(value: string): Buffer {
  const strBuf = Buffer.from(value + '\0', 'ascii')
  const padded = alignTo4(strBuf.length)
  const out = Buffer.alloc(padded)
  strBuf.copy(out)
  return out
}

function parseOSCMessage(buf: Buffer): { address: string; args: OSCArgument[] } | null {
  if (buf.length < 4 || buf[0] !== 0x2f) return null // Must start with '/'

  // Read address
  const addr = readOSCString(buf, 0)
  let offset = addr.nextOffset

  // Read type tag string
  if (offset >= buf.length || buf[offset] !== 0x2c) {
    // No type tag -- valid OSC with zero args
    return { address: addr.value, args: [] }
  }

  const typeTag = readOSCString(buf, offset)
  offset = typeTag.nextOffset
  const types = typeTag.value.slice(1) // drop the leading ','

  const args: OSCArgument[] = []

  for (const t of types) {
    if (offset > buf.length - 4 && t !== 's') break

    switch (t) {
      case 'f': {
        const value = buf.readFloatBE(offset)
        args.push({ type: 'f', value })
        offset += 4
        break
      }
      case 'i': {
        const value = buf.readInt32BE(offset)
        args.push({ type: 'i', value })
        offset += 4
        break
      }
      case 's': {
        const str = readOSCString(buf, offset)
        args.push({ type: 's', value: str.value })
        offset = str.nextOffset
        break
      }
      case 'b': {
        const blobSize = buf.readInt32BE(offset)
        offset += 4
        // Guard: blobSize must be non-negative and fit within the remaining buffer
        if (blobSize < 0 || offset + blobSize > buf.length) break
        const data = new Uint8Array(buf.buffer, buf.byteOffset + offset, blobSize)
        args.push({ type: 'b', value: data })
        offset += alignTo4(blobSize)
        break
      }
      default:
        // Unknown type tag -- skip 4 bytes (best effort)
        offset += 4
        break
    }
  }

  return { address: addr.value, args }
}

function buildOSCMessage(address: string, args: readonly OSCArgument[]): Buffer {
  const parts: Buffer[] = []

  // Address
  parts.push(writeOSCString(address))

  // Type tag
  let typeTag = ','
  for (const arg of args) {
    typeTag += arg.type
  }
  parts.push(writeOSCString(typeTag))

  // Arguments
  for (const arg of args) {
    switch (arg.type) {
      case 'f': {
        const b = Buffer.alloc(4)
        b.writeFloatBE(arg.value, 0)
        parts.push(b)
        break
      }
      case 'i': {
        const b = Buffer.alloc(4)
        b.writeInt32BE(arg.value, 0)
        parts.push(b)
        break
      }
      case 's': {
        parts.push(writeOSCString(arg.value))
        break
      }
      case 'b': {
        const sizeBuf = Buffer.alloc(4)
        sizeBuf.writeInt32BE(arg.value.length, 0)
        parts.push(sizeBuf)
        const dataBuf = Buffer.from(arg.value)
        const padded = alignTo4(dataBuf.length)
        const paddedBuf = Buffer.alloc(padded)
        dataBuf.copy(paddedBuf)
        parts.push(paddedBuf)
        break
      }
    }
  }

  return Buffer.concat(parts)
}

// ============================================
// RATE LIMITER (per-route, sliding window)
// ============================================

class RouteRateLimiter {
  private readonly counts = new Map<string, number>()
  private readonly maxPerSecond: number
  private resetInterval: ReturnType<typeof setInterval> | null = null

  constructor(maxPerSecond: number) {
    this.maxPerSecond = maxPerSecond
    this.resetInterval = setInterval(() => this.counts.clear(), 1000)
  }

  allow(route: string): boolean {
    const count = this.counts.get(route) ?? 0
    if (count >= this.maxPerSecond) return false
    this.counts.set(route, count + 1)
    return true
  }

  dispose(): void {
    if (this.resetInterval) {
      clearInterval(this.resetInterval)
      this.resetInterval = null
    }
    this.counts.clear()
  }
}

// ============================================
// OSC NEXUS PROVIDER
// ============================================

export class OSCNexusProvider implements IInputProvider {
  readonly type: InputSourceType = 'osc-nexus'

  private _status: InputProviderStatus = {
    state: 'uninitialized',
    deviceName: null,
    sampleRate: 44100,
    channels: 1,
    latencyMs: 0,
    errorMessage: null,
  }

  // Callbacks wired by AudioMatrix
  onAudioData: ((buffer: Float32Array, sampleRate: number) => void) | null = null
  onStatusChange: ((status: InputProviderStatus) => void) | null = null

  // UDP sockets
  private listenSocket: dgram.Socket | null = null
  private publishSocket: dgram.Socket | null = null
  private config: OSCNexusConfig = {
    listenPort: 9000,
    publishPort: 9001,
    publishHost: '255.255.255.255',
    maxMessagesPerSecond: 100,
    enablePublisher: true,
  }

  // Route handlers
  private readonly routeHandlers = new Map<string, Set<OSCMessageHandler>>()

  // Rate limiter
  private rateLimiter: RouteRateLimiter | null = null

  // Telemetry
  private messagesReceived = 0
  private messagesSent = 0
  private samplesProcessed = 0
  private startTime = 0
  private lastMessageTimestamp = 0

  // Control message callbacks (external code registers these)
  onVibeOverride: ((vibeId: string) => void) | null = null
  onBlackout: ((enabled: boolean) => void) | null = null
  onMasterDimmer: ((value: number) => void) | null = null
  onFixtureOverride: ((fixtureId: string, channel: string, values: number[]) => void) | null = null
  onExternalBpm: ((bpm: number) => void) | null = null
  onExternalBeat: (() => void) | null = null

  get status(): InputProviderStatus {
    return this._status
  }

  async initialize(config: InputProviderConfig): Promise<void> {
    this._status = {
      state: 'ready',
      deviceName: `OSC Nexus UDP :${this.config.listenPort}`,
      sampleRate: config.sampleRate ?? 44100,
      channels: 1,
      latencyMs: 0,
      errorMessage: null,
    }
    this.onStatusChange?.(this._status)
  }

  async start(): Promise<void> {
    if (this._status.state === 'streaming') return

    this.startTime = Date.now()
    this.rateLimiter = new RouteRateLimiter(this.config.maxMessagesPerSecond)

    // Setup listen socket
    this.listenSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    this.listenSocket.on('message', (msg, rinfo) => {
      this.handleIncomingMessage(msg, rinfo)
    })

    this.listenSocket.on('error', (err) => {
      console.error(`[OSCNexus] Listen socket error: ${err.message}`)
      this.updateStatus({
        ...this._status,
        state: 'error',
        errorMessage: err.message,
      })
    })

    await new Promise<void>((resolve, reject) => {
      this.listenSocket!.bind(this.config.listenPort, () => {
        console.log(`[OSCNexus] WAVE 3401: Listening on UDP port ${this.config.listenPort}`)
        resolve()
      })
      this.listenSocket!.once('error', reject)
    })

    // Setup publish socket
    // WAVE 3403.1: bind() must complete before setBroadcast() — the socket needs
    // a valid file descriptor (EBADF otherwise). Port 0 = OS picks ephemeral port.
    if (this.config.enablePublisher) {
      this.publishSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
      await new Promise<void>((resolve, reject) => {
        this.publishSocket!.bind(0, () => {
          try {
            this.publishSocket!.setBroadcast(true)
            resolve()
          } catch (err) {
            reject(err)
          }
        })
        this.publishSocket!.once('error', reject)
      })
      console.log(`[OSCNexus] WAVE 3401: Publisher ready on UDP port ${this.config.publishPort}`)
    }

    // Register built-in route handlers
    this.registerBuiltInRoutes()

    this.updateStatus({
      ...this._status,
      state: 'streaming',
    })
  }

  async stop(): Promise<void> {
    if (this.listenSocket) {
      this.listenSocket.close()
      this.listenSocket = null
    }
    if (this.publishSocket) {
      this.publishSocket.close()
      this.publishSocket = null
    }
    if (this.rateLimiter) {
      this.rateLimiter.dispose()
      this.rateLimiter = null
    }

    this.routeHandlers.clear()
    this.updateStatus({ ...this._status, state: 'ready' })
  }

  dispose(): void {
    this.stop()
    this.onAudioData = null
    this.onStatusChange = null
    this.onVibeOverride = null
    this.onBlackout = null
    this.onMasterDimmer = null
    this.onFixtureOverride = null
    this.onExternalBpm = null
    this.onExternalBeat = null
    this.updateStatus({ ...this._status, state: 'disposed' })
  }

  async enumerateDevices(): Promise<readonly AudioDeviceInfo[]> {
    return [{
      id: 'osc-nexus',
      name: `OSC UDP :${this.config.listenPort}`,
      sampleRate: 44100,
      channels: 1,
      isDefault: false,
    }]
  }

  getDiagnostics(): InputProviderDiagnostics {
    return {
      bufferUnderruns: 0,
      bufferOverruns: 0,
      samplesProcessed: this.samplesProcessed,
      avgLatencyMs: 0,
      peakLatencyMs: 0,
      uptimeMs: this.startTime > 0 ? Date.now() - this.startTime : 0,
    }
  }

  // ============================================
  // OSC PUBLISHER (broadcast LuxSync state)
  // ============================================

  publish(address: string, args: readonly OSCArgument[]): void {
    if (!this.publishSocket || !this.config.enablePublisher) return

    const msg = buildOSCMessage(address, args)
    this.publishSocket.send(msg, this.config.publishPort, this.config.publishHost)
    this.messagesSent++
  }

  /**
   * Broadcast current LuxSync state. Called by TitanOrchestrator at frame rate.
   */
  publishState(state: {
    vibe: string
    energy: number
    bpm: number
    onBeat: boolean
    section: string
    bands: number[]  // 7 floats
  }): void {
    this.publish('/luxsync/state/vibe', [{ type: 's', value: state.vibe }])
    this.publish('/luxsync/state/energy', [{ type: 'f', value: state.energy }])
    this.publish('/luxsync/state/bpm', [{ type: 'f', value: state.bpm }])
    if (state.onBeat) {
      this.publish('/luxsync/state/beat', [{ type: 'i', value: 1 }])
    }
    this.publish('/luxsync/state/section', [{ type: 's', value: state.section }])
    if (state.bands.length >= 7) {
      this.publish('/luxsync/state/bands', state.bands.map(v => ({ type: 'f' as const, value: v })))
    }
  }

  // ============================================
  // ROUTE HANDLER REGISTRATION
  // ============================================

  onMessage(address: string, handler: OSCMessageHandler): void {
    let handlers = this.routeHandlers.get(address)
    if (!handlers) {
      handlers = new Set()
      this.routeHandlers.set(address, handlers)
    }
    handlers.add(handler)
  }

  offMessage(address: string, handler: OSCMessageHandler): void {
    const handlers = this.routeHandlers.get(address)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) this.routeHandlers.delete(address)
    }
  }

  // ============================================
  // INCOMING MESSAGE HANDLING
  // ============================================

  private handleIncomingMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    this.messagesReceived++
    this.lastMessageTimestamp = Date.now()

    const parsed = parseOSCMessage(msg)
    if (!parsed) return

    const { address, args } = parsed

    // Rate limiting per address
    if (this.rateLimiter && !this.rateLimiter.allow(address)) return

    // Route to registered handlers
    const handlers = this.routeHandlers.get(address)
    if (handlers) {
      const senderInfo: OSCSenderInfo = { address: rinfo.address, port: rinfo.port }
      for (const handler of handlers) {
        handler(args, senderInfo)
      }
    }

    // Also check pattern matches for fixture routes
    this.routeFixtureMessage(address, args)
  }

  // ============================================
  // BUILT-IN ROUTE HANDLERS
  // ============================================

  private registerBuiltInRoutes(): void {
    // Audio: PCM blob
    this.onMessage('/luxsync/audio/pcm', (args) => {
      if (args.length === 0 || args[0].type !== 'b') return
      const blob = args[0].value
      // Convert from raw bytes to Float32Array
      const float32 = new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4)
      this.samplesProcessed += float32.length
      if (this.onAudioData) {
        this.onAudioData(float32, this._status.sampleRate)
      }
    })

    // Audio: BPM override
    this.onMessage('/luxsync/audio/bpm', (args) => {
      if (args.length > 0 && args[0].type === 'f') {
        this.onExternalBpm?.(args[0].value)
      }
    })

    // Audio: Beat trigger
    this.onMessage('/luxsync/audio/beat', (args) => {
      if (args.length > 0 && args[0].type === 'i' && args[0].value === 1) {
        this.onExternalBeat?.()
      }
    })

    // Control: Vibe
    this.onMessage('/luxsync/control/vibe', (args) => {
      if (args.length > 0 && args[0].type === 's') {
        this.onVibeOverride?.(args[0].value)
      }
    })

    // Control: Blackout
    this.onMessage('/luxsync/control/blackout', (args) => {
      if (args.length > 0 && args[0].type === 'i') {
        this.onBlackout?.(args[0].value === 1)
      }
    })

    // Control: Grand Master
    this.onMessage('/luxsync/control/master', (args) => {
      if (args.length > 0 && args[0].type === 'f') {
        this.onMasterDimmer?.(args[0].value)
      }
    })
  }

  // ============================================
  // FIXTURE ROUTE PATTERN MATCHING
  // ============================================

  private routeFixtureMessage(address: string, args: readonly OSCArgument[]): void {
    // Pattern: /luxsync/fixture/{id}/{channel}
    const match = address.match(/^\/luxsync\/fixture\/([^/]+)\/(\w+)$/)
    if (!match) return

    const fixtureId = match[1]
    const channel = match[2]
    const values = args.filter(a => a.type === 'f').map(a => (a as { type: 'f'; value: number }).value)

    if (values.length > 0 && this.onFixtureOverride) {
      this.onFixtureOverride(fixtureId, channel, values)
    }
  }

  // ============================================
  // CONFIG
  // ============================================

  configure(config: Partial<OSCNexusConfig>): void {
    this.config = { ...this.config, ...config }
  }

  private updateStatus(newStatus: InputProviderStatus): void {
    this._status = newStatus
    this.onStatusChange?.(newStatus)
  }
}

// Re-export OSC utilities for use by publisher
export { buildOSCMessage, parseOSCMessage }
