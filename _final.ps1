$orchPath = 'c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\TitanOrchestrator.ts'
$tickDir = 'c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\tick'
$tickPath = "$tickDir\TickEngine.ts"
$lifecycleDir = 'c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\lifecycle'
$theiaDir = 'c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\theia'

$content = [System.IO.File]::ReadAllText($orchPath, [System.Text.Encoding]::UTF8)
Write-Host "Original: $(($content -split "`n").Length) lines"

# ====== PHASE 7 ======
$content = $content.Replace(
  "import type { HardwareDispatcherContext } from './hal/HardwareDispatcher'",
  "import type { HardwareDispatcherContext } from './hal/HardwareDispatcher'`nimport { AudioPipelineManager } from './audio/AudioPipelineManager'`nimport type { AudioPipelineContext } from './audio/AudioPipelineManager'"
)
$content = $content.Replace(
  'broadcastManager + hardwareDispatcher initialized in constructor',
  'broadcastManager + hardwareDispatcher initialized in constructor' + "`n  private readonly audioPipeline: AudioPipelineManager"
)
$content = $content.Replace(
  'this.hardwareDispatcher = new HardwareDispatcher(halCtx)',
  'this.hardwareDispatcher = new HardwareDispatcher(halCtx)' + @"

    const audioCtx: AudioPipelineContext = {
      trinity: this.trinity,
      brain: this.brain,
      log: (category, message, data) => this.log(category, message, data),
      getInputGain: () => this.inputGain,
    }
    this.audioPipeline = new AudioPipelineManager(audioCtx)
"@
)
$content = $content -replace 'this\.beatDetector = new BeatDetector\(\{[^}]*\}\)', 'this.audioPipeline.initBeatDetector()'

# brain.on handler: find the block and replace
$brainPattern = "(?s)this\.brain\.on\('audio-levels'.*?\}\);"
$brainMatch = [regex]::Match($content, $brainPattern)
if ($brainMatch.Success) {
    $after = $content.Substring($brainMatch.Index + $brainMatch.Length)
    if ($after -match 'await trinity\.start\(\)') {
        $content = $content.Remove($brainMatch.Index, $brainMatch.Length).Insert($brainMatch.Index, '      this.audioPipeline.wireAudioLevelsHandler()')
    }
}
Write-Host "Phase 7 done: $(($content -split "`n").Length) lines"

# ====== PHASE 8: Extract processFrame ======
$pfPattern = "(?s)(private async processFrame\(\): Promise<void> \{.*?\n  \})\n\n  /\*\*\n   \* Set the current vibe)"
$pfMatch = [regex]::Match($content, $pfPattern)
if (-not $pfMatch.Success) {
    Write-Host "ERROR: processFrame not found"
    exit 1
}
$pfFull = $pfMatch.Groups[1].Value
Write-Host "processFrame: $($pfFull.Length) chars"

# Extract body
$bodyMatch = [regex]::Match($pfFull, "(?s)\{(.*)\n  \}", [System.Text.RegularExpressions.RegexOptions]::Singleline)
if (-not $bodyMatch.Success) {
    Write-Host "ERROR: body not found"
    exit 1
}
$body = $bodyMatch.Groups[1].Value
$body = $body -replace 'this\.lastAudioData', 'this.audioPipeline.lastAudioData'
$body = $body -replace 'this\.syncSmoother', 'this.audioPipeline.syncSmoother'
$body = $body -replace 'this\.hasRealAudio', 'this.audioPipeline.hasRealAudio'
$body = $body -replace 'this\.lastStableWorkerBpmFrame', 'this.audioPipeline.lastStableWorkerBpmFrame'
$body = $body -replace 'this\.lastStableWorkerBpm', 'this.audioPipeline.lastStableWorkerBpm'
$body = $body -replace 'this\.FREEWHEEL_TIMEOUT_FRAMES', 'this.audioPipeline.FREEWHEEL_TIMEOUT_FRAMES'
$body = $body -replace 'this\.beatDetector', 'this.audioPipeline.beatDetector'
$body = $body -replace 'this\.AUDIO_STALENESS_THRESHOLD_MS', 'this.audioPipeline.AUDIO_STALENESS_THRESHOLD_MS'
$body = $body -replace 'this\.lastAudioTimestamp', 'this.audioPipeline.lastAudioTimestamp'
$body = $body -replace 'this\.hasLoggedFirstAudio', 'this.audioPipeline.hasLoggedFirstAudio'
Write-Host "Body: $(($body -split "`n").Length) lines"

# Build TickEngine.ts
$getterFields = @('brain','engine','hal','trinity','audioPipeline','fixtures','onHotFrame','onBroadcast','_aetherHasDevices','_aetherArbiter','_aetherResolver','_colorAdapter','_kineticAdapter','_beamAdapter','_atmosphereAdapter','_liquidAetherAdapter','_seleneAetherAdapter','_chronosAetherAdapter','_hephaestusAetherAdapter','_aetherCanvasManager','_pixelMapAdapter','_theiaVideoRenderer','_physicsPostProcessor','_aetherSafety','_forgeFrameCtx','_forgeAudioBands','_aetherUIProjector','_goldenNukeLocks','_aetherGraph','_aetherBus','_seleneBus','_effectBus','_impactAdapter','_aetherAudio','_aetherMusical','_aetherVibe','_aetherCtx','_aetherStageBounds','_hephByFixtureId','_hephByZone','_hephOutputPool','peakHoldMap','_seleneThetaBridge','_timelineEngine','EMPTY_FFT_BUFFER','oscProvider')
$getterLines = ($getterFields | ForEach-Object { "  get $_() { return this.ctx.$_ }" }) -join "`r`n"

$tickEngine = @"
/**
 * WAVE 4963 PHASE 8: TICK ENGINE
 * @module TickEngine
 */

import type { DeviceId } from '../../aether/types'
import type { HephFixtureOutput } from '../../hephaestus/runtime/HephaestusRuntime'
import { fixtureMatchesZone as zoneMapperMatch } from '../../zones/ZoneMapper'
import { getHephaestusRuntime } from '../IPCHandlers'
import { getEffectManager } from '../../effects/EffectManager'
import { aetherKineticEngine } from '../../aether/AetherKineticEngine'
import { NodeFamily } from '../../aether'
import type { AudioMetrics, MusicalContext, VibeProfile } from '../../aether'
import { SeleneTruth, createDefaultCognitive } from '../../protocol/SeleneProtocol'

const ZONE_MAP: Readonly<Record<string, string>> = {
  'FRONT_PARS': 'front', 'BACK_PARS': 'back', 'LEFT_PARS': 'left', 'RIGHT_PARS': 'right',
  'CENTER_PARS': 'center', 'TRUSS_WASH': 'truss', 'FLOOR_WASH': 'floor',
  'FRONT_MOVERS': 'front', 'BACK_MOVERS': 'back', 'LEFT_MOVERS': 'left', 'RIGHT_MOVERS': 'right',
  'CENTER_MOVERS': 'center', 'TRUSS_MOVERS': 'truss', 'FLOOR_MOVERS': 'floor',
  'HAZE': 'atmosphere', 'FOG': 'atmosphere', 'STROBE': 'effects', 'BLINDER': 'effects',
  'LASER': 'effects', 'UV': 'effects',
}
const DMX_OUTPUT_ZEROS: readonly number[] = Object.freeze(new Array(512).fill(0))

export class TickEngine {
  private static readonly TRUTH_BROADCAST_DIVIDER = 6
  private static readonly HOT_FRAME_DIVIDER = 1
  frameCount = 0; warlogHeartbeatFrame = 0; _lastLoggedEngine = ''; _outputEnabled = false
  private ctx: any

$getterLines
  get _licenseTier() { return this.ctx._licenseTier }
  get lastConsciousnessOutput() { return this.ctx.lastConsciousnessOutput }
  get mode() { return this.ctx.mode }
  get inputGain() { return this.ctx.inputGain }
  get useBrain() { return this.ctx.useBrain }

  log(category: string, message: string, data?: Record<string, unknown>) { this.ctx.log(category, message, data) }
  constructor(ctx: any) { this.ctx = ctx }

  async tick(): Promise<void> {
$body
  }
}
"@

if (-not (Test-Path $tickDir)) { New-Item -ItemType Directory -Path $tickDir -Force | Out-Null }
[System.IO.File]::WriteAllText($tickPath, $tickEngine, [System.Text.Encoding]::UTF8)
Write-Host "TickEngine.ts: $(($tickEngine -split "`n").Length) lines"

# Replace processFrame with delegator
$delegator = "  private async processFrame(): Promise<void> {`n    await this.tickEngine.tick()`n  }"
$content = $content.Remove($pfMatch.Index, $pfMatch.Length).Insert($pfMatch.Index, $delegator + "`n`n  /**`n   * Set the current vibe")

# Add TickEngine import/field/constructor
$content = $content.Replace(
  "import type { AudioPipelineContext } from './audio/AudioPipelineManager'",
  "import type { AudioPipelineContext } from './audio/AudioPipelineManager'`nimport { TickEngine } from './tick/TickEngine'"
)
$content = $content.Replace(
  'private readonly audioPipeline: AudioPipelineManager',
  'private readonly audioPipeline: AudioPipelineManager' + "`n  private readonly tickEngine: TickEngine"
)
$content = $content.Replace(
  'this.audioPipeline = new AudioPipelineManager(audioCtx)',
  'this.audioPipeline = new AudioPipelineManager(audioCtx)' + @"

    this.tickEngine = new TickEngine({
      brain: this.brain, engine: this.engine, hal: this.hal, trinity: this.trinity,
      audioPipeline: this.audioPipeline, fixtures: this.fixtures,
      onHotFrame: this.onHotFrame, onBroadcast: this.onBroadcast,
      _aetherHasDevices: this._aetherHasDevices,
      _aetherArbiter: this._aetherArbiter, _aetherResolver: this._aetherResolver,
      _colorAdapter: this._colorAdapter, _kineticAdapter: this._kineticAdapter,
      _beamAdapter: this._beamAdapter, _atmosphereAdapter: this._atmosphereAdapter,
      _liquidAetherAdapter: this._liquidAetherAdapter,
      _seleneAetherAdapter: this._seleneAetherAdapter,
      _chronosAetherAdapter: this._chronosAetherAdapter,
      _hephaestusAetherAdapter: this._hephaestusAetherAdapter,
      _aetherCanvasManager: this._aetherCanvasManager,
      _pixelMapAdapter: this._pixelMapAdapter,
      _theiaVideoRenderer: this._theiaVideoRenderer,
      _physicsPostProcessor: this._physicsPostProcessor,
      _aetherSafety: this._aetherSafety,
      _forgeFrameCtx: this._forgeFrameCtx, _forgeAudioBands: this._forgeAudioBands,
      _aetherUIProjector: this._aetherUIProjector,
      _goldenNukeLocks: this._goldenNukeLocks,
      _aetherGraph: this._aetherGraph, _aetherBus: this._aetherBus,
      _seleneBus: this._seleneBus, _effectBus: this._effectBus,
      _impactAdapter: this._impactAdapter,
      _aetherAudio: this._aetherAudio, _aetherMusical: this._aetherMusical,
      _aetherVibe: this._aetherVibe, _aetherCtx: this._aetherCtx,
      _aetherStageBounds: this._aetherStageBounds,
      _hephByFixtureId: this._hephByFixtureId, _hephByZone: this._hephByZone,
      _hephOutputPool: this._hephOutputPool, peakHoldMap: this.peakHoldMap,
      _seleneThetaBridge: this._seleneThetaBridge,
      _timelineEngine: this._timelineEngine,
      EMPTY_FFT_BUFFER: this.EMPTY_FFT_BUFFER,
      oscProvider: this.oscProvider,
      _licenseTier: this._licenseTier,
      lastConsciousnessOutput: this.lastConsciousnessOutput,
      mode: this.mode, inputGain: this.inputGain, useBrain: this.useBrain,
      log: (category: string, message: string, data?: Record<string, unknown>) => this.log(category, message, data),
    })
"@
)
Write-Host "Phase 8 done: $(($content -split "`n").Length) lines"

# ====== PHASE 9-11: Extract methods and replace with delegators ======

# Build manager files from the current content
# We extract each method body using regex, then replace with delegator

# --- SystemLifecycleManager ---
$initMatch = [regex]::Match($content, "(?s)(async init\(\): Promise<void> \{.*?\n  \})\n\n  /\*\*\n   \* Start the main loop)")
$startMatch = [regex]::Match($content, "(?s)(start\(\): void \{.*?\n  \})\n\n  /\*\*\n   \* Stop the main loop)")
$stopMatch = [regex]::Match($content, "(?s)(async stop\(\): Promise<void> \{.*?\n  \})\n\n  /\*\*\n   \* Process a single frame)")

if ($initMatch.Success -and $startMatch.Success -and $stopMatch.Success) {
    $initBody = [regex]::Match($initMatch.Groups[1].Value, "(?s)\{(.*)\n  \}", [System.Text.RegularExpressions.RegexOptions]::Singleline).Groups[1].Value
    $startBody = [regex]::Match($startMatch.Groups[1].Value, "(?s)\{(.*)\n  \}", [System.Text.RegularExpressions.RegexOptions]::Singleline).Groups[1].Value
    $stopBody = [regex]::Match($stopMatch.Groups[1].Value, "(?s)\{(.*)\n  \}", [System.Text.RegularExpressions.RegexOptions]::Singleline).Groups[1].Value

    $lifecycleCode = @"
/**
 * WAVE 4964 PHASE 9: SYSTEM LIFECYCLE MANAGER
 * @module SystemLifecycleManager
 */

import { TrinityBrain } from '../../workers/TrinityBrain'
import { getTrinity } from '../../workers/TrinityOrchestrator'
import { TitanEngine } from '../../engine/TitanEngine'
import { HardwareAbstraction } from '../../hal/HardwareAbstraction'
import { OSCNexusProvider } from '../../osc/OscNexusProvider'
import { VirtualWireProvider } from '../../audio/VirtualWireProvider'
import { USBDirectLinkProvider } from '../../audio/USBDirectLinkProvider'
import { universalDMX } from '../../hal/drivers/UniversalDMXDriver'
import { vibeMovementManager } from '../../engine/movement/VibeMovementManager'

export interface SystemLifecycleContext {
  brain: any; trinity: any; engine: any; hal: any; audioPipeline: any
  oscProvider: any; virtualWireProvider: any; usbDirectLinkProvider: any
  isInitialized: boolean; isRunning: boolean
  config: any; scheduler: any; cardiogramaInterval: any
  fixtures: any[]; beatDetector: any
  log: (category: string, message: string, data?: Record<string, unknown>) => void
}

export class SystemLifecycleManager {
  private ctx: SystemLifecycleContext
  constructor(ctx: SystemLifecycleContext) { this.ctx = ctx }

  async init(): Promise<void> {
$initBody
  }

  start(): void {
$startBody
  }

  async stop(): Promise<void> {
$stopBody
  }
}
"@
    if (-not (Test-Path $lifecycleDir)) { New-Item -ItemType Directory -Path $lifecycleDir -Force | Out-Null }
    [System.IO.File]::WriteAllText("$lifecycleDir\SystemLifecycleManager.ts", $lifecycleCode, [System.Text.Encoding]::UTF8)
    Write-Host "Phase 9: SystemLifecycleManager.ts created"

    # Replace with delegators
    $content = $content.Remove($initMatch.Index, $initMatch.Length).Insert($initMatch.Index, "  async init(): Promise<void> { await this.lifecycleManager.init() }`n`n  /**`n   * Start the main loop")
    $content = $content.Remove($startMatch.Index, $startMatch.Length).Insert($startMatch.Index, "  start(): void { this.lifecycleManager.start() }`n`n  /**`n   * Stop the main loop")
    $content = $content.Remove($stopMatch.Index, $stopMatch.Length).Insert($stopMatch.Index, "  async stop(): Promise<void> { await this.lifecycleManager.stop() }`n`n  /**`n   * Process a single frame")
}

# --- TheiaBridgeManager ---
$theiaAttachMatch = [regex]::Match($content, "(?s)(attachTheiaRenderer\(.*?\n  \})\n\n  /\*\*\n   \* Desconecta el renderer)")
$theiaDetachMatch = [regex]::Match($content, "(?s)(detachTheiaRenderer\(\): void \{.*?\n  \})\n\n  //.*?SeleneTheiaBridge)")
$seleneAttachMatch = [regex]::Match($content, "(?s)(attachSeleneTheiaBridge\(bridge: SeleneTheiaBridge\): void \{.*?\n  \})\n\n  detachSeleneTheiaBridge)")
$seleneDetachMatch = [regex]::Match($content, "(?s)(detachSeleneTheiaBridge\(\): void \{.*?\n  \})\n\n  /\*\*\n   \* Initialize all)")

if ($theiaAttachMatch.Success -and $theiaDetachMatch.Success -and $seleneAttachMatch.Success -and $seleneDetachMatch.Success) {
    $theiaAttachBody = [regex]::Match($theiaAttachMatch.Groups[1].Value, "(?s)\{(.*)\n  \}", [System.Text.RegularExpressions.RegexOptions]::Singleline).Groups[1].Value
    $theiaDetachBody = [regex]::Match($theiaDetachMatch.Groups[1].Value, "(?s)\{(.*)\n  \}", [System.Text.RegularExpressions.RegexOptions]::Singleline).Groups[1].Value
    $seleneAttachBody = [regex]::Match($seleneAttachMatch.Groups[1].Value, "(?s)\{(.*)\n  \}", [System.Text.RegularExpressions.RegexOptions]::Singleline).Groups[1].Value
    $seleneDetachBody = [regex]::Match($seleneDetachMatch.Groups[1].Value, "(?s)\{(.*)\n  \}", [System.Text.RegularExpressions.RegexOptions]::Singleline).Groups[1].Value

    $theiaCode = @"
/**
 * WAVE 4964 PHASE 10: THEIA BRIDGE MANAGER
 * @module TheiaBridgeManager
 */

import { TheiaVideoRenderer } from '../../theia/TheiaVideoRenderer'
import type { SeleneTheiaBridge } from '../../theia/SeleneTheiaBridge'

export interface TheiaBridgeContext {
  _theiaVideoRenderer: any; _seleneThetaBridge: any
  _aetherCanvasManager: any; _pixelMapAdapter: any
  _aetherGraph: any; _aetherStageBounds: any
}

export class TheiaBridgeManager {
  private ctx: TheiaBridgeContext
  constructor(ctx: TheiaBridgeContext) { this.ctx = ctx }

  attachTheiaRenderer(canvasId: string, thumbPixelSAB: SharedArrayBuffer, opts: { intensity?: number; alphaToDimmer?: boolean } = {}): void {
$theiaAttachBody
  }

  detachTheiaRenderer(): void {
$theiaDetachBody
  }

  attachSeleneTheiaBridge(bridge: SeleneTheiaBridge): void {
$seleneAttachBody
  }

  detachSeleneTheiaBridge(): void {
$seleneDetachBody
  }
}
"@
    if (-not (Test-Path $theiaDir)) { New-Item -ItemType Directory -Path $theiaDir -Force | Out-Null }
    [System.IO.File]::WriteAllText("$theiaDir\TheiaBridgeManager.ts", $theiaCode, [System.Text.Encoding]::UTF8)
    Write-Host "Phase 10: TheiaBridgeManager.ts created"

    # Replace with delegators
    $content = $content.Remove($theiaAttachMatch.Index, $theiaAttachMatch.Length).Insert($theiaAttachMatch.Index, "  attachTheiaRenderer(canvasId: string, thumbPixelSAB: SharedArrayBuffer, opts: { intensity?: number; alphaToDimmer?: boolean } = {}): void { this.theiaBridgeManager.attachTheiaRenderer(canvasId, thumbPixelSAB, opts) }`n`n  /**`n   * Desconecta el renderer")
    $content = $content.Remove($theiaDetachMatch.Index, $theiaDetachMatch.Length).Insert($theiaDetachMatch.Index, "  detachTheiaRenderer(): void { this.theiaBridgeManager.detachTheiaRenderer() }`n`n  //")
    $content = $content.Remove($seleneAttachMatch.Index, $seleneAttachMatch.Length).Insert($seleneAttachMatch.Index, "  attachSeleneTheiaBridge(bridge: SeleneTheiaBridge): void { this.theiaBridgeManager.attachSeleneTheiaBridge(bridge) }`n`n  detachSeleneTheiaBridge")
    $content = $content.Remove($seleneDetachMatch.Index, $seleneDetachMatch.Length).Insert($seleneDetachMatch.Index, "  detachSeleneTheiaBridge(): void { this.theiaBridgeManager.detachSeleneTheiaBridge() }`n`n  /**`n   * Initialize all")
}

# --- VibeLifecycleManager ---
$vibeMethods = @{
    'setVibe' = "(?s)(setVibe\(vibeId: VibeId\): void \{.*?\n  \})\n  \n  /\*\*\n   \* .*Force Palette Sync)"
    'forcePaletteSync' = "(?s)(forcePaletteSync\(\): void \{.*?\n  \})\n\n  /\*\*\n   \* .*Set the current mood)"
    'setMood' = "(?s)(setMood\(moodId: 'calm' \| 'balanced' \| 'punk'\): void \{.*?\n  \})\n\n  /\*\*\n   \* .*Get the current mood)"
    'getMood' = "(?s)(getMood\(\): 'calm' \| 'balanced' \| 'punk' \{.*?\n  \})\n\n  /\*\*\n   \* .*THE PHANTOM BUFFER)"
    'setChronosHeatmap' = "(?s)(setChronosHeatmap\(heatmap: unknown\): void \{.*?\n  \})\n\n  /\*\*\n   \* .*PLAYHEAD SYNC)"
    'setChronosPlayhead' = "(?s)(setChronosPlayhead\(timeMs: number, isPlaying: boolean\): void \{.*?\n  \})\n\n  /\*\*\n   \* WAVE 254: Set mode)"
    'setMode' = "(?s)(setMode\(mode: string\): void \{.*?\n  \})\n\n  /\*\*\n   \* WAVE 254: Enable/disable brain)"
    'setUseBrain' = "(?s)(setUseBrain\(enabled: boolean\): void \{.*?\n  \})\n  \n  /\*\*\n   \* .*Enable/disable consciousness)"
    'setConsciousnessEnabled' = "(?s)(setConsciousnessEnabled\(enabled: boolean\): void \{.*?\n  \})\n  \n  /\*\*\n   \* .*Set Liquid Stereo)"
    'setLiquidStereo' = "(?s)(setLiquidStereo\(enabled: boolean\): void \{.*?\n  \})\n\n  /\*\*\n   \* .*THE GREAT WIRING.*Layout Switch)"
    'setLiquidLayout' = "(?s)(setLiquidLayout\(mode: '4\.1' \| '7\.1'\): void \{.*?\n  \})\n\n  getLiquidLayout)"
    'getLiquidLayout' = "(?s)(getLiquidLayout\(\): '4\.1' \| '7\.1' \{.*?\n  \})\n  \n  /\*\*\n   \* .*Get consciousness)"
}

$delegatorMap = @{
    'setVibe' = "  setVibe(vibeId: VibeId): void { this.vibeLifecycleManager.setVibe(vibeId) }`n  `n  /**`n   *"
    'forcePaletteSync' = "  forcePaletteSync(): void { this.vibeLifecycleManager.forcePaletteSync() }`n`n  /**`n   *"
    'setMood' = "  setMood(moodId: 'calm' | 'balanced' | 'punk'): void { this.vibeLifecycleManager.setMood(moodId) }`n`n  /**`n   *"
    'getMood' = "  getMood(): 'calm' | 'balanced' | 'punk' { return this.vibeLifecycleManager.getMood() }`n`n  /**`n   *"
    'setChronosHeatmap' = "  setChronosHeatmap(heatmap: unknown): void { this.vibeLifecycleManager.setChronosHeatmap(heatmap) }`n`n  /**`n   *"
    'setChronosPlayhead' = "  setChronosPlayhead(timeMs: number, isPlaying: boolean): void { this.vibeLifecycleManager.setChronosPlayhead(timeMs, isPlaying) }`n`n  /**`n   * WAVE 254: Set mode"
    'setMode' = "  setMode(mode: string): void { this.vibeLifecycleManager.setMode(mode) }`n`n  /**`n   * WAVE 254: Enable/disable brain"
    'setUseBrain' = "  setUseBrain(enabled: boolean): void { this.vibeLifecycleManager.setUseBrain(enabled) }`n  `n  /**`n   *"
    'setConsciousnessEnabled' = "  setConsciousnessEnabled(enabled: boolean): void { this.vibeLifecycleManager.setConsciousnessEnabled(enabled) }`n  `n  /**`n   *"
    'setLiquidStereo' = "  setLiquidStereo(enabled: boolean): void { this.vibeLifecycleManager.setLiquidStereo(enabled) }`n`n  /**`n   *"
    'setLiquidLayout' = "  setLiquidLayout(mode: '4.1' | '7.1'): void { this.vibeLifecycleManager.setLiquidLayout(mode) }`n`n  getLiquidLayout"
    'getLiquidLayout' = "  getLiquidLayout(): '4.1' | '7.1' { return this.vibeLifecycleManager.getLiquidLayout() }`n  `n  /**`n   *"
}

$vibeBodies = @{}
foreach ($name in $vibeMethods.Keys) {
    $m = [regex]::Match($content, $vibeMethods[$name])
    if ($m.Success) {
        $bodyMatch = [regex]::Match($m.Groups[1].Value, "(?s)\{(.*)\n  \}", [System.Text.RegularExpressions.RegexOptions]::Singleline)
        if ($bodyMatch.Success) {
            $vibeBodies[$name] = $bodyMatch.Groups[1].Value
        }
    } else {
        Write-Host "WARNING: $name not found"
    }
}

$vibeCode = @"
/**
 * WAVE 4964 PHASE 11: VIBE LIFECYCLE MANAGER
 * @module VibeLifecycleManager
 */

import { MoodController } from '../../engine/MoodController'
import type { VibeId } from '../../engine/types'

export interface VibeLifecycleContext {
  engine: any; hal: any; trinity: any
  mode: string; useBrain: boolean; consciousnessEnabled: boolean
  currentLiquidLayout: '4.1' | '7.1'
  log: (category: string, message: string, data?: Record<string, unknown>) => void
}

export class VibeLifecycleManager {
  private ctx: VibeLifecycleContext
  constructor(ctx: VibeLifecycleContext) { this.ctx = ctx }

  setVibe(vibeId: VibeId): void {
$($vibeBodies['setVibe'])
  }

  forcePaletteSync(): void {
$($vibeBodies['forcePaletteSync'])
  }

  setMood(moodId: 'calm' | 'balanced' | 'punk'): void {
$($vibeBodies['setMood'])
  }

  getMood(): 'calm' | 'balanced' | 'punk' {
$($vibeBodies['getMood'])
  }

  setChronosHeatmap(heatmap: unknown): void {
$($vibeBodies['setChronosHeatmap'])
  }

  setChronosPlayhead(timeMs: number, isPlaying: boolean): void {
$($vibeBodies['setChronosPlayhead'])
  }

  setMode(mode: string): void {
$($vibeBodies['setMode'])
  }

  setUseBrain(enabled: boolean): void {
$($vibeBodies['setUseBrain'])
  }

  setConsciousnessEnabled(enabled: boolean): void {
$($vibeBodies['setConsciousnessEnabled'])
  }

  setLiquidStereo(enabled: boolean): void {
$($vibeBodies['setLiquidStereo'])
  }

  setLiquidLayout(mode: '4.1' | '7.1'): void {
$($vibeBodies['setLiquidLayout'])
  }

  getLiquidLayout(): '4.1' | '7.1' {
$($vibeBodies['getLiquidLayout'])
  }
}
"@

[System.IO.File]::WriteAllText("$lifecycleDir\VibeLifecycleManager.ts", $vibeCode, [System.Text.Encoding]::UTF8)
Write-Host "Phase 11: VibeLifecycleManager.ts created"

# Replace vibe methods with delegators (in reverse order to preserve indices)
$orderedNames = @('getLiquidLayout','setLiquidLayout','setLiquidStereo','setConsciousnessEnabled','setUseBrain','setMode','setChronosPlayhead','setChronosHeatmap','getMood','setMood','forcePaletteSync','setVibe')
foreach ($name in $orderedNames) {
    $m = [regex]::Match($content, $vibeMethods[$name])
    if ($m.Success) {
        $content = $content.Remove($m.Index, $m.Length).Insert($m.Index, $delegatorMap[$name])
    }
}

# ====== ADD MANAGER IMPORTS, FIELDS, CONSTRUCTOR INITS ======
$content = $content.Replace(
  "import { TickEngine } from './tick/TickEngine'",
  "import { TickEngine } from './tick/TickEngine'`nimport { SystemLifecycleManager } from './lifecycle/SystemLifecycleManager'`nimport type { SystemLifecycleContext } from './lifecycle/SystemLifecycleManager'`nimport { TheiaBridgeManager } from './theia/TheiaBridgeManager'`nimport type { TheiaBridgeContext } from './theia/TheiaBridgeManager'`nimport { VibeLifecycleManager } from './lifecycle/VibeLifecycleManager'`nimport type { VibeLifecycleContext } from './lifecycle/VibeLifecycleManager'"
)
$content = $content.Replace(
  'private readonly tickEngine: TickEngine',
  'private readonly tickEngine: TickEngine' + "`n  private readonly lifecycleManager: SystemLifecycleManager`n  private readonly theiaBridgeManager: TheiaBridgeManager`n  private readonly vibeLifecycleManager: VibeLifecycleManager"
)
$content = $content.Replace(
  'log: (category: string, message: string, data?: Record<string, unknown>) => this.log(category, message, data),',
  'log: (category: string, message: string, data?: Record<string, unknown>) => this.log(category, message, data),' + @"

    })
    this.tickEngine = new TickEngine(tickCtx)

    const lifecycleCtx: SystemLifecycleContext = {
      brain: this.brain, trinity: this.trinity, engine: this.engine, hal: this.hal,
      audioPipeline: this.audioPipeline,
      oscProvider: this.oscProvider, virtualWireProvider: this.virtualWireProvider,
      usbDirectLinkProvider: this.usbDirectLinkProvider,
      isInitialized: this.isInitialized, isRunning: this.isRunning,
      config: this.config, scheduler: this.scheduler,
      cardiogramaInterval: this.cardiogramaInterval,
      fixtures: this.fixtures, beatDetector: this.beatDetector,
      log: (category, message, data) => this.log(category, message, data),
    }
    this.lifecycleManager = new SystemLifecycleManager(lifecycleCtx)

    const theiaCtx: TheiaBridgeContext = {
      _theiaVideoRenderer: this._theiaVideoRenderer,
      _seleneThetaBridge: this._seleneThetaBridge,
      _aetherCanvasManager: this._aetherCanvasManager,
      _pixelMapAdapter: this._pixelMapAdapter,
      _aetherGraph: this._aetherGraph,
      _aetherStageBounds: this._aetherStageBounds,
    }
    this.theiaBridgeManager = new TheiaBridgeManager(theiaCtx)

    const vibeCtx: VibeLifecycleContext = {
      engine: this.engine, hal: this.hal, trinity: this.trinity,
      mode: this.mode, useBrain: this.useBrain,
      consciousnessEnabled: this.consciousnessEnabled,
      currentLiquidLayout: this.currentLiquidLayout,
      log: (category, message, data) => this.log(category, message, data),
    }
    this.vibeLifecycleManager = new VibeLifecycleManager(vibeCtx)
"@
)

[System.IO.File]::WriteAllText($orchPath, $content, [System.Text.Encoding]::UTF8)
Write-Host "Orchestrator: $(($content -split "`n").Length) lines"
Write-Host "DONE - All phases complete"
