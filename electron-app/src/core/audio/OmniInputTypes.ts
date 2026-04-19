// WAVE 3401: OMNI-INPUT MATRIX -- Core Type Contracts
// Defines every interface that the Omni-Input Matrix depends on.
// No implementation here -- pure types and enums.

// ============================================
// INPUT SOURCE IDENTIFICATION
// ============================================

export type InputSourceType =
  | 'virtual-wire'
  | 'usb-directlink'
  | 'osc-nexus'
  | 'legacy-bridge'

// ============================================
// PROVIDER STATUS
// ============================================

export type InputProviderState =
  | 'uninitialized'
  | 'ready'
  | 'streaming'
  | 'error'
  | 'disposed'

export interface InputProviderStatus {
  readonly state: InputProviderState
  readonly deviceName: string | null
  readonly sampleRate: number
  readonly channels: number
  readonly latencyMs: number
  readonly errorMessage: string | null
}

// ============================================
// PROVIDER CONFIG
// ============================================

export interface InputProviderConfig {
  readonly deviceId?: string
  readonly sampleRate?: number         // Target: 44100
  readonly channelSelection?: number
  readonly exclusiveMode?: boolean
}

// ============================================
// PROVIDER DIAGNOSTICS
// ============================================

export interface InputProviderDiagnostics {
  readonly bufferUnderruns: number
  readonly bufferOverruns: number
  readonly samplesProcessed: number
  readonly avgLatencyMs: number
  readonly peakLatencyMs: number
  readonly uptimeMs: number
}

// ============================================
// AUDIO DEVICE INFO
// ============================================

export interface AudioDeviceInfo {
  readonly id: string
  readonly name: string
  readonly sampleRate: number
  readonly channels: number
  readonly isDefault: boolean
  readonly isLoopback?: boolean
  readonly isExclusiveCapable?: boolean
  readonly driver?: 'wasapi' | 'coreaudio' | 'jack' | 'alsa'
  readonly sampleRates?: readonly number[]
}

// ============================================
// IInputProvider -- Contract for every audio source
// ============================================

export interface IInputProvider {
  readonly type: InputSourceType
  readonly status: InputProviderStatus

  initialize(config: InputProviderConfig): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  dispose(): void

  // Callback when audio data arrives from the source
  onAudioData: ((buffer: Float32Array, sampleRate: number) => void) | null
  // Callback when provider state changes
  onStatusChange: ((status: InputProviderStatus) => void) | null

  enumerateDevices(): Promise<readonly AudioDeviceInfo[]>
  getDiagnostics(): InputProviderDiagnostics
}

// ============================================
// HOT-SWAP CROSSFADE
// ============================================

export interface CrossfadeDuration {
  readonly fadeOutMs: number    // Default: 60
  readonly gapMs: number        // Default: 40 (1 frame @ 25fps)
  readonly fadeInMs: number     // Default: 100
}

export type HotSwapPhase = 'none' | 'fade-out' | 'gap' | 'fade-in'

// ============================================
// INPUT ARBITER CONFIG
// ============================================

export interface InputArbiterConfig {
  readonly priorityChain: readonly InputSourceType[]
  readonly silenceTimeoutMs: number       // Default: 3000
  readonly autoFallback: boolean          // Default: true
  readonly crossfadeDuration: CrossfadeDuration
}

// ============================================
// AUDIO MATRIX STATUS
// ============================================

export interface AudioMatrixStatus {
  readonly activeSource: InputSourceType | null
  readonly isHotSwapping: boolean
  readonly hotSwapPhase: HotSwapPhase
  readonly ringBufferFillLevel: number    // 0.0-1.0
  readonly sharedBufferReady: boolean
  readonly providers: ReadonlyMap<InputSourceType, InputProviderStatus>
}

// ============================================
// IAudioMatrix -- The Central Bus
// ============================================

export interface IAudioMatrix {
  registerProvider(provider: IInputProvider): void
  unregisterProvider(type: InputSourceType): void

  getActiveProvider(): IInputProvider | null
  getRegisteredProviders(): readonly IInputProvider[]

  setPriorityChain(chain: readonly InputSourceType[]): void
  forceSource(type: InputSourceType): Promise<void>
  releaseForce(): void

  getSharedBuffer(): SharedArrayBuffer
  getStatus(): AudioMatrixStatus

  dispose(): void
}

// ============================================
// ISharedRingBuffer -- Lock-free SPSC transport
// ============================================

export interface ISharedRingBuffer {
  readonly buffer: SharedArrayBuffer

  // Producer side (main thread)
  write(samples: Float32Array): void

  // Consumer side (worker thread)
  read(output: Float32Array, maxSamples: number): number

  readonly available: number
  readonly fillLevel: number

  reset(): void
}

// ============================================
// OSC TYPES
// ============================================

export type OSCArgumentType = 'f' | 'i' | 's' | 'b'

export type OSCArgument =
  | { type: 'f'; value: number }       // Float32
  | { type: 'i'; value: number }       // Int32
  | { type: 's'; value: string }       // String
  | { type: 'b'; value: Uint8Array }   // Blob (PCM bulk)

export type OSCMessageHandler = (
  args: readonly OSCArgument[],
  senderInfo: OSCSenderInfo
) => void

export interface OSCSenderInfo {
  readonly address: string
  readonly port: number
}

export interface OSCNexusConfig {
  readonly listenPort: number            // Default: 9000
  readonly publishPort: number           // Default: 9001
  readonly publishHost: string           // Default: '255.255.255.255'
  readonly maxMessagesPerSecond: number   // Rate limit: 100
  readonly enablePublisher: boolean
}

export interface OSCNexusStatus {
  readonly isListening: boolean
  readonly listenPort: number
  readonly publishPort: number
  readonly messagesReceived: number
  readonly messagesSent: number
  readonly activeRoutes: number
  readonly lastMessageTimestamp: number
}

// ============================================
// IOSCBridge -- Bidirectional OSC interface
// ============================================

export interface IOSCBridge {
  startServer(config: OSCNexusConfig): Promise<void>
  stopServer(): Promise<void>

  publish(address: string, args: readonly OSCArgument[]): void

  onMessage(address: string, handler: OSCMessageHandler): void
  offMessage(address: string, handler: OSCMessageHandler): void

  getStatus(): OSCNexusStatus
}

// ============================================
// OSC INPUT MODES
// ============================================

export type OSCInputMode =
  | 'pcm'            // Raw PCM samples via /luxsync/input/pcm
  | 'bands'          // Pre-analyzed 7-band GodEarBands
  | 'energy-only'    // Just bass/mid/treble/volume
  | 'control-only'   // No audio, just fixture/vibe/bpm overrides

// ============================================
// CONSTANTS
// ============================================

export const OMNI_CONSTANTS = {
  RING_SIZE: 8192,                     // 2x FFT_SIZE (4096)
  RING_BUFFER_BYTES: 33796,           // 16 header + 32768 data + 12 padding
  METADATA_SLOTS: 4,                   // writeHead, readHead, sampleRate, channelCount
  METADATA_BYTES: 16,                  // 4 Int32 slots
  DATA_BYTES: 32768,                   // 8192 * 4 (Float32)
  DEFAULT_SAMPLE_RATE: 44100,
  DEFAULT_CHANNELS: 1,
  FFT_SIZE: 4096,
  CROSSFADE_FADE_OUT_MS: 60,
  CROSSFADE_GAP_MS: 40,
  CROSSFADE_FADE_IN_MS: 100,
  SILENCE_TIMEOUT_MS: 3000,
  OSC_LISTEN_PORT: 9000,
  OSC_PUBLISH_PORT: 9001,
  OSC_MAX_RATE: 100,
} as const

// Metadata header slot indices
export const META = {
  WRITE_HEAD: 0,
  READ_HEAD: 1,
  SAMPLE_RATE: 2,
  CHANNEL_COUNT: 3,
} as const
