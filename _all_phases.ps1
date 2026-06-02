$orchPath = 'c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\TitanOrchestrator.ts'
$tickDir = 'c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\tick'
$tickPath = "$tickDir\TickEngine.ts"
$lifecycleDir = 'c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\lifecycle'
$theiaDir = 'c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\theia'

# Read original file
$content = [System.IO.File]::ReadAllText($orchPath, [System.Text.Encoding]::UTF8)
$lines = $content -split "`r`n"
Write-Host "Original: $($lines.Length) lines"

# ====== PHASE 7: AudioPipelineManager ======

# 1. Add import
$marker = "import type { HardwareDispatcherContext } from './hal/HardwareDispatcher'"
$insert = "import { AudioPipelineManager } from './audio/AudioPipelineManager'`nimport type { AudioPipelineContext } from './audio/AudioPipelineManager'"
$content = $content.Replace($marker, $marker + "`n" + $insert)

# 2. Add field
$marker = 'broadcastManager + hardwareDispatcher initialized in constructor'
$content = $content.Replace($marker, $marker + "`n  private readonly audioPipeline: AudioPipelineManager")

# 3. Add constructor init
$marker = 'this.hardwareDispatcher = new HardwareDispatcher(halCtx)'
$insert = @"
    const audioCtx: AudioPipelineContext = {
      trinity: this.trinity,
      brain: this.brain,
      log: (category, message, data) => this.log(category, message, data),
      getInputGain: () => this.inputGain,
    }
    this.audioPipeline = new AudioPipelineManager(audioCtx)
"@
$content = $content.Replace($marker, $marker + "`n" + $insert)

# 4. Replace beatDetector init
$content = $content -replace 'this\.beatDetector = new BeatDetector\(\{[^}]*\}\)', 'this.audioPipeline.initBeatDetector()'

# 5. Replace brain.on('audio-levels') handler
$brainPattern = "(?s)this\.brain\.on\('audio-levels'.*?\}\);"
$brainMatch = [regex]::Match($content, $brainPattern)
if ($brainMatch.Success) {
    $after = $content.Substring($brainMatch.Index + $brainMatch.Length)
    if ($after -match 'await trinity\.start\(\)') {
        $content = $content.Remove($brainMatch.Index, $brainMatch.Length).Insert($brainMatch.Index, '      this.audioPipeline.wireAudioLevelsHandler()')
    }
}

Write-Host "Phase 7 applied"

# ====== PHASE 8: Extract processFrame to TickEngine ======

$lines = $content -split "`r`n"

# Find processFrame by signature
$pfStart = -1; $pfEnd = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'private async processFrame\(\): Promise<void> \{') { $pfStart = $i }
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

# Apply Phase 7 field replacements
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

# Build TickEngine.ts
$getterFields = @(
    'brain','engine','hal','trinity','audioPipeline','fixtures',
    'onHotFrame','onBroadcast','_aetherHasDevices','_aetherArbiter','_aetherResolver',
    '_colorAdapter','_kineticAdapter','_beamAdapter','_atmosphereAdapter',
    '_liquidAetherAdapter','_seleneAetherAdapter','_chronosAetherAdapter','_hephaestusAetherAdapter',
    '_aetherCanvasManager','_pixelMapAdapter','_theiaVideoRenderer',
    '_physicsPostProcessor','_aetherSafety','_forgeFrameCtx','_forgeAudioBands',
    '_aetherUIProjector','_goldenNukeLocks','_aetherGraph','_aetherBus','_seleneBus','_effectBus',
    '_impactAdapter','_aetherAudio','_aetherMusical','_aetherVibe','_aetherCtx','_aetherStageBounds',
    '_hephByFixtureId','_hephByZone','_hephOutputPool','peakHoldMap',
    '_seleneThetaBridge','_timelineEngine','EMPTY_FFT_BUFFER','oscProvider'
)

$getterLines = ($getterFields | ForEach-Object { "  get $_() { return this.ctx.$_ }" }) -join "`r`n"
$bodyStr = ($bodyArr -join "`r`n")

$tickEngine = @"
/**
 * WAVE 4963 PHASE 8: TICK ENGINE
 * Extracted from TitanOrchestrator.processFrame().
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

  frameCount = 0
  warlogHeartbeatFrame = 0
  _lastLoggedEngine = ''
  _outputEnabled = false
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
$bodyStr
  }
}
"@

if (-not (Test-Path $tickDir)) { New-Item -ItemType Directory -Path $tickDir -Force | Out-Null }
[System.IO.File]::WriteAllText($tickPath, $tickEngine, [System.Text.Encoding]::UTF8)
Write-Host "TickEngine.ts: $(($tickEngine -split "`n").Length) lines"

# Replace processFrame with delegator
$delegator = "  private async processFrame(): Promise<void> {`n    await this.tickEngine.tick()`n  }"
$content = $content -replace [regex]::Escape($lines[$pfStart]), $delegator
# Remove the old body (lines pfStart+1 through pfEnd)
$lines = $content -split "`r`n"
$newLines = New-Object System.Collections.ArrayList
$skipUntil = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'private async processFrame\(\): Promise<void> \{') {
        [void]$newLines.Add($lines[$i])
        # Skip until we find the closing } of the delegator (next line)
        if ($i+1 -lt $lines.Length -and $lines[$i+1] -match 'await this\.tickEngine\.tick') {
            [void]$newLines.Add($lines[$i+1])
            [void]$newLines.Add($lines[$i+2])
            $skipUntil = $pfEnd
            $i = $i + 2
            continue
        }
    }
    if ($skipUntil -ge 0 -and $i -le $skipUntil) { continue }
    [void]$newLines.Add($lines[$i])
}
$lines = $newLines.ToArray()
$content = $lines -join "`r`n"

# Add TickEngine import
$marker = "import type { AudioPipelineContext } from './audio/AudioPipelineManager'"
$content = $content.Replace($marker, $marker + "`nimport { TickEngine } from './tick/TickEngine'")

# Add tickEngine field
$marker = 'private readonly audioPipeline: AudioPipelineManager'
$content = $content.Replace($marker, $marker + "`n  private readonly tickEngine: TickEngine")

# Add tickEngine constructor init
$marker = 'this.audioPipeline = new AudioPipelineManager(audioCtx)'
$insert = @"
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
$content = $content.Replace($marker, $marker + "`n" + $insert)

Write-Host "Phase 8 applied"

# ====== PHASE 9-11: Create managers and replace methods ======

# Reload lines
$lines = $content -split "`r`n"
Write-Host "Before Phase 9-11: $($lines.Length) lines"

# Helper function: find method by signature, return start line (signature) and end line (closing })
function Find-Method($sigPattern) {
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match $sigPattern) {
            $start = $i
            $depth = 0; $foundOpen = $false
            for ($j = $i; $j -lt $lines.Length; $j++) {
                $open = ($lines[$j].ToCharArray() | Where-Object { $_ -eq '{' }).Count
                $close = ($lines[$j].ToCharArray() | Where-Object { $_ -eq '}' }).Count
                if ($open -gt 0) { $foundOpen = $true }
                $depth += $open - $close
                if ($foundOpen -and $depth -eq 0) { return @{ Start = $start; End = $j } }
            }
        }
    }
    return $null
}

# Helper: extract method body (everything between { and })
function Get-Body($startLine, $endLine) {
    $body = @()
    $sigLine = $lines[$startLine]
    $braceIdx = $sigLine.IndexOf('{')
    $after = $sigLine.Substring($braceIdx + 1).Trim()
    if ($after) { $body += '    ' + $after }
    for ($i = $startLine + 1; $i -lt $endLine; $i++) { $body += $lines[$i] }
    return $body
}

# Helper: replace method range with new lines
function Replace-Method($start, $end, $newLines) {
    $script:lines = $script:lines[0..($start-1)] + $newLines + $script:lines[($end+1)..($script:lines.Length-1)]
}

# --- Create SystemLifecycleManager ---
$initMethod = Find-Method('async init\(\): Promise<void>')
$startMethod = Find-Method('start\(\): void \{')
$stopMethod = Find-Method('async stop\(\): Promise<void>')

$initBody = Get-Body $initMethod.Start $initMethod.End
$startBody = Get-Body $startMethod.Start $startMethod.End
$stopBody = Get-Body $stopMethod.Start $stopMethod.End

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
$($initBody -join "`r`n")
  }

  start(): void {
$($startBody -join "`r`n")
  }

  async stop(): Promise<void> {
$($stopBody -join "`r`n")
  }
}
"@

if (-not (Test-Path $lifecycleDir)) { New-Item -ItemType Directory -Path $lifecycleDir -Force | Out-Null }
[System.IO.File]::WriteAllText("$lifecycleDir\SystemLifecycleManager.ts", $lifecycleCode, [System.Text.Encoding]::UTF8)
Write-Host "Phase 9: SystemLifecycleManager.ts created"

# --- Create TheiaBridgeManager ---
$theiaAttach = Find-Method('attachTheiaRenderer\(')
$theiaDetach = Find-Method('detachTheiaRenderer\(\): void')
$seleneAttach = Find-Method('attachSeleneTheiaBridge\(bridge: SeleneTheiaBridge\): void')
$seleneDetach = Find-Method('detachSeleneTheiaBridge\(\): void')

$theiaAttachBody = Get-Body $theiaAttach.Start $theiaAttach.End
$theiaDetachBody = Get-Body $theiaDetach.Start $theiaDetach.End
$seleneAttachBody = Get-Body $seleneAttach.Start $seleneAttach.End
$seleneDetachBody = Get-Body $seleneDetach.Start $seleneDetach.End

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
$($theiaAttachBody -join "`r`n")
  }

  detachTheiaRenderer(): void {
$($theiaDetachBody -join "`r`n")
  }

  attachSeleneTheiaBridge(bridge: SeleneTheiaBridge): void {
$($seleneAttachBody -join "`r`n")
  }

  detachSeleneTheiaBridge(): void {
$($seleneDetachBody -join "`r`n")
  }
}
"@

if (-not (Test-Path $theiaDir)) { New-Item -ItemType Directory -Path $theiaDir -Force | Out-Null }
[System.IO.File]::WriteAllText("$theiaDir\TheiaBridgeManager.ts", $theiaCode, [System.Text.Encoding]::UTF8)
Write-Host "Phase 10: TheiaBridgeManager.ts created"

# --- Create VibeLifecycleManager ---
$methods = @{
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

$methodBodies = @{}
foreach ($name in $methods.Keys) {
    $m = Find-Method($methods[$name])
    if ($m) {
        $methodBodies[$name] = Get-Body $m.Start $m.End
        Write-Host "  Found $name at $($m.Start)-$($m.End)"
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
$($methodBodies['setVibe'] -join "`r`n")
  }

  forcePaletteSync(): void {
$($methodBodies['forcePaletteSync'] -join "`r`n")
  }

  setMood(moodId: 'calm' | 'balanced' | 'punk'): void {
$($methodBodies['setMood'] -join "`r`n")
  }

  getMood(): 'calm' | 'balanced' | 'punk' {
$($methodBodies['getMood'] -join "`r`n")
  }

  setChronosHeatmap(heatmap: unknown): void {
$($methodBodies['setChronosHeatmap'] -join "`r`n")
  }

  setChronosPlayhead(timeMs: number, isPlaying: boolean): void {
$($methodBodies['setChronosPlayhead'] -join "`r`n")
  }

  setMode(mode: string): void {
$($methodBodies['setMode'] -join "`r`n")
  }

  setUseBrain(enabled: boolean): void {
$($methodBodies['setUseBrain'] -join "`r`n")
  }

  setConsciousnessEnabled(enabled: boolean): void {
$($methodBodies['setConsciousnessEnabled'] -join "`r`n")
  }

  setLiquidStereo(enabled: boolean): void {
$($methodBodies['setLiquidStereo'] -join "`r`n")
  }

  setLiquidLayout(mode: '4.1' | '7.1'): void {
$($methodBodies['setLiquidLayout'] -join "`r`n")
  }

  getLiquidLayout(): '4.1' | '7.1' {
$($methodBodies['getLiquidLayout'] -join "`r`n")
  }
}
"@

[System.IO.File]::WriteAllText("$lifecycleDir\VibeLifecycleManager.ts", $vibeCode, [System.Text.Encoding]::UTF8)
Write-Host "Phase 11: VibeLifecycleManager.ts created"

# ====== REPLACE METHODS WITH DELEGATORS ======

# Sort all methods by start line descending
$allMethods = @()
$allMethods += @{ Start = $initMethod.Start; End = $initMethod.End; NewLine = '  async init(): Promise<void> { await this.lifecycleManager.init() }' }
$allMethods += @{ Start = $startMethod.Start; End = $startMethod.End; NewLine = '  start(): void { this.lifecycleManager.start() }' }
$allMethods += @{ Start = $stopMethod.Start; End = $stopMethod.End; NewLine = '  async stop(): Promise<void> { await this.lifecycleManager.stop() }' }
$allMethods += @{ Start = $theiaAttach.Start; End = $theiaAttach.End; NewLine = '  attachTheiaRenderer(canvasId: string, thumbPixelSAB: SharedArrayBuffer, opts: { intensity?: number; alphaToDimmer?: boolean } = {}): void { this.theiaBridgeManager.attachTheiaRenderer(canvasId, thumbPixelSAB, opts) }' }
$allMethods += @{ Start = $theiaDetach.Start; End = $theiaDetach.End; NewLine = '  detachTheiaRenderer(): void { this.theiaBridgeManager.detachTheiaRenderer() }' }
$allMethods += @{ Start = $seleneAttach.Start; End = $seleneAttach.End; NewLine = '  attachSeleneTheiaBridge(bridge: SeleneTheiaBridge): void { this.theiaBridgeManager.attachSeleneTheiaBridge(bridge) }' }
$allMethods += @{ Start = $seleneDetach.Start; End = $seleneDetach.End; NewLine = '  detachSeleneTheiaBridge(): void { this.theiaBridgeManager.detachSeleneTheiaBridge() }' }

$delegatorMap = @{
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

foreach ($name in $delegatorMap.Keys) {
    $m = Find-Method($methods[$name])
    if ($m) {
        $allMethods += @{ Start = $m.Start; End = $m.End; NewLine = $delegatorMap[$name] }
    }
}

$allMethods = $allMethods | Sort-Object Start -Descending
foreach ($r in $allMethods) {
    Write-Host "Replacing $($r.Start)-$($r.End)"
    Replace-Method $r.Start $r.End @($r.NewLine)
}

# ====== ADD MANAGER IMPORTS, FIELDS, CONSTRUCTOR INITS ======

$content = $lines -join "`r`n"

# Add imports
$marker = "import { TickEngine } from './tick/TickEngine'"
$insert = @"
import { SystemLifecycleManager } from './lifecycle/SystemLifecycleManager'
import type { SystemLifecycleContext } from './lifecycle/SystemLifecycleManager'
import { TheiaBridgeManager } from './theia/TheiaBridgeManager'
import type { TheiaBridgeContext } from './theia/TheiaBridgeManager'
import { VibeLifecycleManager } from './lifecycle/VibeLifecycleManager'
import type { VibeLifecycleContext } from './lifecycle/VibeLifecycleManager'
"@
$content = $content.Replace($marker, $marker + "`n" + $insert)

# Add fields
$marker = 'private readonly tickEngine: TickEngine'
$content = $content.Replace($marker, $marker + "`n  private readonly lifecycleManager: SystemLifecycleManager`n  private readonly theiaBridgeManager: TheiaBridgeManager`n  private readonly vibeLifecycleManager: VibeLifecycleManager")

# Add constructor inits
$marker = 'log: (category: string, message: string, data?: Record<string, unknown>) => this.log(category, message, data),'
# Find the closing }) of tickEngine init
$lines = $content -split "`r`n"
$newLines = New-Object System.Collections.ArrayList
$added = $false
for ($i = 0; $i -lt $lines.Length; $i++) {
    [void]$newLines.Add($lines[$i])
    if (-not $added -and $lines[$i] -match '^\s+\}\)$') {
        # Check if this is the end of tickEngine init (previous lines contain tickEngine context fields)
        $prev2 = if ($i -ge 2) { $lines[$i-2] } else { '' }
        if ($prev2 -match 'oscProvider' -or $prev2 -match 'useBrain') {
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
            $added = $true
        }
    }
}
$lines = $newLines.ToArray()
$content = $lines -join "`r`n"

[System.IO.File]::WriteAllText($orchPath, $content, [System.Text.Encoding]::UTF8)
Write-Host "Orchestrator written: $(($content -split "`r`n").Length) lines"
Write-Host "DONE - All phases complete"
