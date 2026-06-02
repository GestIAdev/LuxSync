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
# Use a simpler approach: find processFrame by line scanning
$lines = $content -split "`r`n"
$pfStart = -1; $pfEnd = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'private async processFrame') { $pfStart = $i }
    if ($pfStart -ge 0 -and $i -gt $pfStart -and $lines[$i].Trim() -eq '}' -and $pfEnd -lt 0) {
        $j = $i + 1
        while ($j -lt $lines.Length -and $lines[$j].Trim() -eq '') { $j++ }
        if ($j -lt $lines.Length -and $lines[$j].Trim().StartsWith('/**')) {
            $pfEnd = $i
        }
    }
}
Write-Host "processFrame: $pfStart to $pfEnd"

# Extract body
$declLine = $lines[$pfStart]
$braceIdx = $declLine.IndexOf('{')
$afterBrace = $declLine.Substring($braceIdx + 1).Trim()
$bodyLines = @()
if ($afterBrace) { $bodyLines += '    ' + $afterBrace }
for ($i = $pfStart + 1; $i -lt $pfEnd; $i++) { $bodyLines += $lines[$i] }

$bodyArr = $bodyLines | ForEach-Object {
    $l = $_
    $l = $l -replace 'this\.lastAudioData', 'this.audioPipeline.lastAudioData'
    $l = $l -replace 'this\.syncSmoother', 'this.audioPipeline.syncSmoother'
    $l = $l -replace 'this\.hasRealAudio', 'this.audioPipeline.hasRealAudio'
    $l = $l -replace 'this\.lastStableWorkerBpmFrame', 'this.audioPipeline.lastStableWorkerBpmFrame'
    $l = $l -replace 'this\.lastStableWorkerBpm', 'this.audioPipeline.lastStableWorkerBpm'
    $l = $l -replace 'this\.FREEWHEEL_TIMEOUT_FRAMES', 'this.audioPipeline.FREEWHEEL_TIMEOUT_FRAMES'
    $l = $l -replace 'this\.beatDetector', 'this.audioPipeline.beatDetector'
    $l = $l -replace 'this\.AUDIO_STALENESS_THRESHOLD_MS', 'this.audioPipeline.AUDIO_STALENESS_THRESHOLD_MS'
    $l = $l -replace 'this\.lastAudioTimestamp', 'this.audioPipeline.lastAudioTimestamp'
    $l = $l -replace 'this\.hasLoggedFirstAudio', 'this.audioPipeline.hasLoggedFirstAudio'
    $l
}
$body = ($bodyArr -join "`r`n")
Write-Host "Body: $($bodyArr.Length) lines"

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

# Replace processFrame with delegator in the lines array
$newLines = New-Object System.Collections.ArrayList
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($i -eq $pfStart) {
        [void]$newLines.Add('  private async processFrame(): Promise<void> {')
        [void]$newLines.Add('    await this.tickEngine.tick()')
        [void]$newLines.Add('  }')
        $i = $pfEnd
        continue
    }
    [void]$newLines.Add($lines[$i])
}
$lines = $newLines.ToArray()

# Add TickEngine import/field/constructor
$newLines = New-Object System.Collections.ArrayList
$addedImp = $false; $addedField = $false; $addedCtor = $false
for ($i = 0; $i -lt $lines.Length; $i++) {
    [void]$newLines.Add($lines[$i])
    if (-not $addedImp -and $lines[$i] -match "import type \{ AudioPipelineContext \} from") {
        [void]$newLines.Add("import { TickEngine } from './tick/TickEngine'")
        $addedImp = $true
    }
    if (-not $addedField -and $lines[$i] -match 'private readonly audioPipeline: AudioPipelineManager') {
        [void]$newLines.Add('  private readonly tickEngine: TickEngine')
        $addedField = $true
    }
    if (-not $addedCtor -and $lines[$i] -match 'this\.audioPipeline = new AudioPipelineManager') {
        [void]$newLines.Add('    this.tickEngine = new TickEngine({')
        [void]$newLines.Add('      brain: this.brain, engine: this.engine, hal: this.hal, trinity: this.trinity,')
        [void]$newLines.Add('      audioPipeline: this.audioPipeline, fixtures: this.fixtures,')
        [void]$newLines.Add('      onHotFrame: this.onHotFrame, onBroadcast: this.onBroadcast,')
        [void]$newLines.Add('      _aetherHasDevices: this._aetherHasDevices,')
        [void]$newLines.Add('      _aetherArbiter: this._aetherArbiter, _aetherResolver: this._aetherResolver,')
        [void]$newLines.Add('      _colorAdapter: this._colorAdapter, _kineticAdapter: this._kineticAdapter,')
        [void]$newLines.Add('      _beamAdapter: this._beamAdapter, _atmosphereAdapter: this._atmosphereAdapter,')
        [void]$newLines.Add('      _liquidAetherAdapter: this._liquidAetherAdapter,')
        [void]$newLines.Add('      _seleneAetherAdapter: this._seleneAetherAdapter,')
        [void]$newLines.Add('      _chronosAetherAdapter: this._chronosAetherAdapter,')
        [void]$newLines.Add('      _hephaestusAetherAdapter: this._hephaestusAetherAdapter,')
        [void]$newLines.Add('      _aetherCanvasManager: this._aetherCanvasManager,')
        [void]$newLines.Add('      _pixelMapAdapter: this._pixelMapAdapter,')
        [void]$newLines.Add('      _theiaVideoRenderer: this._theiaVideoRenderer,')
        [void]$newLines.Add('      _physicsPostProcessor: this._physicsPostProcessor,')
        [void]$newLines.Add('      _aetherSafety: this._aetherSafety,')
        [void]$newLines.Add('      _forgeFrameCtx: this._forgeFrameCtx, _forgeAudioBands: this._forgeAudioBands,')
        [void]$newLines.Add('      _aetherUIProjector: this._aetherUIProjector,')
        [void]$newLines.Add('      _goldenNukeLocks: this._goldenNukeLocks,')
        [void]$newLines.Add('      _aetherGraph: this._aetherGraph, _aetherBus: this._aetherBus,')
        [void]$newLines.Add('      _seleneBus: this._seleneBus, _effectBus: this._effectBus,')
        [void]$newLines.Add('      _impactAdapter: this._impactAdapter,')
        [void]$newLines.Add('      _aetherAudio: this._aetherAudio, _aetherMusical: this._aetherMusical,')
        [void]$newLines.Add('      _aetherVibe: this._aetherVibe, _aetherCtx: this._aetherCtx,')
        [void]$newLines.Add('      _aetherStageBounds: this._aetherStageBounds,')
        [void]$newLines.Add('      _hephByFixtureId: this._hephByFixtureId, _hephByZone: this._hephByZone,')
        [void]$newLines.Add('      _hephOutputPool: this._hephOutputPool, peakHoldMap: this.peakHoldMap,')
        [void]$newLines.Add('      _seleneThetaBridge: this._seleneThetaBridge,')
        [void]$newLines.Add('      _timelineEngine: this._timelineEngine,')
        [void]$newLines.Add('      EMPTY_FFT_BUFFER: this.EMPTY_FFT_BUFFER,')
        [void]$newLines.Add('      oscProvider: this.oscProvider,')
        [void]$newLines.Add('      _licenseTier: this._licenseTier,')
        [void]$newLines.Add('      lastConsciousnessOutput: this.lastConsciousnessOutput,')
        [void]$newLines.Add('      mode: this.mode, inputGain: this.inputGain, useBrain: this.useBrain,')
        [void]$newLines.Add('      log: (category: string, message: string, data?: Record<string, unknown>) => this.log(category, message, data),')
        [void]$newLines.Add('    })')
        $addedCtor = $true
    }
}
$lines = $newLines.ToArray()
Write-Host "Phase 8 done: $($lines.Length) lines"

# ====== PHASE 9-11: Extract methods using line scanning ======

# Helper: find method range by signature pattern
function Find-MethodRange($sigPattern) {
    for ($i = 0; $i -lt $script:lines.Length; $i++) {
        if ($script:lines[$i] -match $sigPattern) {
            $start = $i
            $depth = 0; $foundOpen = $false
            for ($j = $i; $j -lt $script:lines.Length; $j++) {
                $open = ($script:lines[$j].ToCharArray() | Where-Object { $_ -eq '{' }).Count
                $close = ($script:lines[$j].ToCharArray() | Where-Object { $_ -eq '}' }).Count
                if ($open -gt 0) { $foundOpen = $true }
                $depth += $open - $close
                if ($foundOpen -and $depth -eq 0) { return @{ Start = $start; End = $j } }
            }
        }
    }
    return $null
}

function Get-MethodBody($start, $end) {
    $sigLine = $script:lines[$start]
    $braceIdx = $sigLine.IndexOf('{')
    $after = $sigLine.Substring($braceIdx + 1).Trim()
    $body = @()
    if ($after) { $body += '    ' + $after }
    for ($i = $start + 1; $i -lt $end; $i++) { $body += $script:lines[$i] }
    return $body -join "`r`n"
}

# --- SystemLifecycleManager ---
$initRange = Find-MethodRange 'async init\(\): Promise<void>'
$startRange = Find-MethodRange 'start\(\): void \{'
$stopRange = Find-MethodRange 'async stop\(\): Promise<void>'

if ($initRange -and $startRange -and $stopRange) {
    $initBody = Get-MethodBody $initRange.Start $initRange.End
    $startBody = Get-MethodBody $startRange.Start $startRange.End
    $stopBody = Get-MethodBody $stopRange.Start $stopRange.End

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
}

# --- TheiaBridgeManager ---
$theiaAttachRange = Find-MethodRange 'attachTheiaRenderer\('
$theiaDetachRange = Find-MethodRange 'detachTheiaRenderer\(\): void'
$seleneAttachRange = Find-MethodRange 'attachSeleneTheiaBridge\(bridge: SeleneTheiaBridge\): void'
$seleneDetachRange = Find-MethodRange 'detachSeleneTheiaBridge\(\): void'

if ($theiaAttachRange -and $theiaDetachRange -and $seleneAttachRange -and $seleneDetachRange) {
    $theiaAttachBody = Get-MethodBody $theiaAttachRange.Start $theiaAttachRange.End
    $theiaDetachBody = Get-MethodBody $theiaDetachRange.Start $theiaDetachRange.End
    $seleneAttachBody = Get-MethodBody $seleneAttachRange.Start $seleneAttachRange.End
    $seleneDetachBody = Get-MethodBody $seleneDetachRange.Start $seleneDetachRange.End

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
}

# --- VibeLifecycleManager ---
$vibeMethodSigs = @{
    'setVibe' = 'setVibe\(vibeId: VibeId\): void'
    'forcePaletteSync' = 'forcePaletteSync\(\): void'
    'setMood' = "setMood\(moodId: 'calm' \| 'balanced' \| 'punk'\): void"
    'getMood' = "getMood\(\): 'calm' \| 'balanced' \| 'punk'"
    'setChronosHeatmap' = 'setChronosHeatmap\(heatmap: unknown\): void'
    'setChronosPlayhead' = 'setChronosPlayhead\(timeMs: number, isPlaying: boolean\): void'
    'setMode' = 'setMode\(mode: string\): void'
    'setUseBrain' = 'setUseBrain\(enabled: boolean\): void'
    'setConsciousnessEnabled' = 'setConsciousnessEnabled\(enabled: boolean\): void'
    'setLiquidStereo' = 'setLiquidStereo\(enabled: boolean\): void'
    'setLiquidLayout' = "setLiquidLayout\(mode: '4\.1' \| '7\.1'\): void"
    'getLiquidLayout' = "getLiquidLayout\(\): '4\.1' \| '7\.1'"
}

$vibeBodies = @{}
$vibeRanges = @{}
foreach ($name in $vibeMethodSigs.Keys) {
    $r = Find-MethodRange $vibeMethodSigs[$name]
    if ($r) {
        $vibeRanges[$name] = $r
        $vibeBodies[$name] = Get-MethodBody $r.Start $r.End
        Write-Host "  Found $name at $($r.Start)-$($r.End)"
    } else {
        Write-Host "  WARNING: $name not found"
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

# ====== REPLACE METHODS WITH DELEGATORS ======
$delegators = @{
    'init' = '  async init(): Promise<void> { await this.lifecycleManager.init() }'
    'start' = '  start(): void { this.lifecycleManager.start() }'
    'stop' = '  async stop(): Promise<void> { await this.lifecycleManager.stop() }'
    'theiaAttach' = '  attachTheiaRenderer(canvasId: string, thumbPixelSAB: SharedArrayBuffer, opts: { intensity?: number; alphaToDimmer?: boolean } = {}): void { this.theiaBridgeManager.attachTheiaRenderer(canvasId, thumbPixelSAB, opts) }'
    'theiaDetach' = '  detachTheiaRenderer(): void { this.theiaBridgeManager.detachTheiaRenderer() }'
    'seleneAttach' = '  attachSeleneTheiaBridge(bridge: SeleneTheiaBridge): void { this.theiaBridgeManager.attachSeleneTheiaBridge(bridge) }'
    'seleneDetach' = '  detachSeleneTheiaBridge(): void { this.theiaBridgeManager.detachSeleneTheiaBridge() }'
}

$vibeDelegators = @{
    'setVibe' = '  setVibe(vibeId: VibeId): void { this.vibeLifecycleManager.setVibe(vibeId) }'
    'forcePaletteSync' = '  forcePaletteSync(): void { this.vibeLifecycleManager.forcePaletteSync() }'
    'setMood' = "  setMood(moodId: 'calm' | 'balanced' | 'punk'): void { this.vibeLifecycleManager.setMood(moodId) }"
    'getMood' = "  getMood(): 'calm' | 'balanced' | 'punk' { return this.vibeLifecycleManager.getMood() }"
    'setChronosHeatmap' = '  setChronosHeatmap(heatmap: unknown): void { this.vibeLifecycleManager.setChronosHeatmap(heatmap) }'
    'setChronosPlayhead' = '  setChronosPlayhead(timeMs: number, isPlaying: boolean): void { this.vibeLifecycleManager.setChronosPlayhead(timeMs, isPlaying) }'
    'setMode' = '  setMode(mode: string): void { this.vibeLifecycleManager.setMode(mode) }'
    'setUseBrain' = '  setUseBrain(enabled: boolean): void { this.vibeLifecycleManager.setUseBrain(enabled) }'
    'setConsciousnessEnabled' = '  setConsciousnessEnabled(enabled: boolean): void { this.vibeLifecycleManager.setConsciousnessEnabled(enabled) }'
    'setLiquidStereo' = '  setLiquidStereo(enabled: boolean): void { this.vibeLifecycleManager.setLiquidStereo(enabled) }'
    'setLiquidLayout' = "  setLiquidLayout(mode: '4.1' | '7.1'): void { this.vibeLifecycleManager.setLiquidLayout(mode) }"
    'getLiquidLayout' = "  getLiquidLayout(): '4.1' | '7.1' { return this.vibeLifecycleManager.getLiquidLayout() }"
}

# Collect all replacements, sort by Start descending
$allReplacements = @()
$allReplacements += @{ Start = $initRange.Start; End = $initRange.End; NewLine = $delegators['init'] }
$allReplacements += @{ Start = $startRange.Start; End = $startRange.End; NewLine = $delegators['start'] }
$allReplacements += @{ Start = $stopRange.Start; End = $stopRange.End; NewLine = $delegators['stop'] }
$allReplacements += @{ Start = $theiaAttachRange.Start; End = $theiaAttachRange.End; NewLine = $delegators['theiaAttach'] }
$allReplacements += @{ Start = $theiaDetachRange.Start; End = $theiaDetachRange.End; NewLine = $delegators['theiaDetach'] }
$allReplacements += @{ Start = $seleneAttachRange.Start; End = $seleneAttachRange.End; NewLine = $delegators['seleneAttach'] }
$allReplacements += @{ Start = $seleneDetachRange.Start; End = $seleneDetachRange.End; NewLine = $delegators['seleneDetach'] }

foreach ($name in $vibeRanges.Keys) {
    $allReplacements += @{ Start = $vibeRanges[$name].Start; End = $vibeRanges[$name].End; NewLine = $vibeDelegators[$name] }
}

$allReplacements = $allReplacements | Sort-Object Start -Descending

# Apply replacements by rebuilding the array
foreach ($r in $allReplacements) {
    Write-Host "Replacing $($r.Start)-$($r.End)"
    $newArr = New-Object System.Collections.ArrayList
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($i -eq $r.Start) {
            [void]$newArr.Add($r.NewLine)
            $i = $r.End
            continue
        }
        [void]$newArr.Add($lines[$i])
    }
    $lines = $newArr.ToArray()
}

# ====== ADD MANAGER IMPORTS, FIELDS, CONSTRUCTOR INITS ======
$newLines = New-Object System.Collections.ArrayList
$addedImp = $false; $addedField = $false; $addedCtor = $false
for ($i = 0; $i -lt $lines.Length; $i++) {
    [void]$newLines.Add($lines[$i])
    if (-not $addedImp -and $lines[$i] -match "import \{ TickEngine \} from") {
        [void]$newLines.Add("import { SystemLifecycleManager } from './lifecycle/SystemLifecycleManager'")
        [void]$newLines.Add("import type { SystemLifecycleContext } from './lifecycle/SystemLifecycleManager'")
        [void]$newLines.Add("import { TheiaBridgeManager } from './theia/TheiaBridgeManager'")
        [void]$newLines.Add("import type { TheiaBridgeContext } from './theia/TheiaBridgeManager'")
        [void]$newLines.Add("import { VibeLifecycleManager } from './lifecycle/VibeLifecycleManager'")
        [void]$newLines.Add("import type { VibeLifecycleContext } from './lifecycle/VibeLifecycleManager'")
        $addedImp = $true
    }
    if (-not $addedField -and $lines[$i] -match 'private readonly tickEngine: TickEngine') {
        [void]$newLines.Add('  private readonly lifecycleManager: SystemLifecycleManager')
        [void]$newLines.Add('  private readonly theiaBridgeManager: TheiaBridgeManager')
        [void]$newLines.Add('  private readonly vibeLifecycleManager: VibeLifecycleManager')
        $addedField = $true
    }
    if (-not $addedCtor -and $lines[$i] -match '^\s+\}\)$') {
        $prev2 = if ($i -ge 2) { $lines[$i-2] } else { '' }
        if ($prev2 -match 'useBrain' -or $prev2 -match 'oscProvider') {
            [void]$newLines.Add('')
            [void]$newLines.Add('    const lifecycleCtx: SystemLifecycleContext = {')
            [void]$newLines.Add('      brain: this.brain, trinity: this.trinity, engine: this.engine, hal: this.hal,')
            [void]$newLines.Add('      audioPipeline: this.audioPipeline,')
            [void]$newLines.Add('      oscProvider: this.oscProvider, virtualWireProvider: this.virtualWireProvider,')
            [void]$newLines.Add('      usbDirectLinkProvider: this.usbDirectLinkProvider,')
            [void]$newLines.Add('      isInitialized: this.isInitialized, isRunning: this.isRunning,')
            [void]$newLines.Add('      config: this.config, scheduler: this.scheduler,')
            [void]$newLines.Add('      cardiogramaInterval: this.cardiogramaInterval,')
            [void]$newLines.Add('      fixtures: this.fixtures, beatDetector: this.beatDetector,')
            [void]$newLines.Add('      log: (category, message, data) => this.log(category, message, data),')
            [void]$newLines.Add('    }')
            [void]$newLines.Add('    this.lifecycleManager = new SystemLifecycleManager(lifecycleCtx)')
            [void]$newLines.Add('')
            [void]$newLines.Add('    const theiaCtx: TheiaBridgeContext = {')
            [void]$newLines.Add('      _theiaVideoRenderer: this._theiaVideoRenderer,')
            [void]$newLines.Add('      _seleneThetaBridge: this._seleneThetaBridge,')
            [void]$newLines.Add('      _aetherCanvasManager: this._aetherCanvasManager,')
            [void]$newLines.Add('      _pixelMapAdapter: this._pixelMapAdapter,')
            [void]$newLines.Add('      _aetherGraph: this._aetherGraph,')
            [void]$newLines.Add('      _aetherStageBounds: this._aetherStageBounds,')
            [void]$newLines.Add('    }')
            [void]$newLines.Add('    this.theiaBridgeManager = new TheiaBridgeManager(theiaCtx)')
            [void]$newLines.Add('')
            [void]$newLines.Add('    const vibeCtx: VibeLifecycleContext = {')
            [void]$newLines.Add('      engine: this.engine, hal: this.hal, trinity: this.trinity,')
            [void]$newLines.Add('      mode: this.mode, useBrain: this.useBrain,')
            [void]$newLines.Add('      consciousnessEnabled: this.consciousnessEnabled,')
            [void]$newLines.Add('      currentLiquidLayout: this.currentLiquidLayout,')
            [void]$newLines.Add('      log: (category, message, data) => this.log(category, message, data),')
            [void]$newLines.Add('    }')
            [void]$newLines.Add('    this.vibeLifecycleManager = new VibeLifecycleManager(vibeCtx)')
            $addedCtor = $true
        }
    }
}
$lines = $newLines.ToArray()

[System.IO.File]::WriteAllLines($orchPath, $lines, [System.Text.Encoding]::UTF8)
Write-Host "Orchestrator: $($lines.Length) lines"
Write-Host "DONE - All phases complete"
