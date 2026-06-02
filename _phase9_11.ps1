$orchPath = 'c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\TitanOrchestrator.ts'
$lifecycleDir = 'c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\lifecycle'
$theiaDir = 'c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\theia'

$lines = [System.IO.File]::ReadAllLines($orchPath, [System.Text.Encoding]::UTF8)
Write-Host "Read $($lines.Length) lines"

# ====== PHASE 9: SystemLifecycleManager ======

$lifecycleCode = @"
/**
 * WAVE 4964 PHASE 9: SYSTEM LIFECYCLE MANAGER
 * Extracted from TitanOrchestrator: init(), start(), stop()
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
  brain: any
  trinity: any
  engine: any
  hal: any
  audioPipeline: any
  oscProvider: any
  virtualWireProvider: any
  usbDirectLinkProvider: any
  isInitialized: boolean
  isRunning: boolean
  config: any
  scheduler: any
  cardiogramaInterval: any
  fixtures: any[]
  beatDetector: any
  log: (category: string, message: string, data?: Record<string, unknown>) => void
}

export class SystemLifecycleManager {
  private ctx: SystemLifecycleContext

  constructor(ctx: SystemLifecycleContext) {
    this.ctx = ctx
  }

  async init(): Promise<void> {
    if (this.ctx.isInitialized) return

    this.ctx.brain = new TrinityBrain()

    try {
      const trinity = getTrinity()
      this.ctx.trinity = trinity
      this.ctx.brain.connectToOrchestrator(trinity)

      this.ctx.audioPipeline.wireAudioLevelsHandler()

      await trinity.start()

      this.ctx.oscProvider = new OSCNexusProvider()
      const audioMatrix = trinity.getAudioMatrix()
      if (audioMatrix) {
        audioMatrix.registerProvider(this.ctx.oscProvider)
      }
      try {
        await this.ctx.oscProvider.start()
        console.log('[TitanOrchestrator] WAVE 3401: OSCNexusProvider started (UDP 9000/9001)')
      } catch (oscErr) {
        console.error('[TitanOrchestrator] OSCNexusProvider failed to start:', oscErr)
      }

      if (audioMatrix) {
        this.ctx.virtualWireProvider = new VirtualWireProvider()
        await this.ctx.virtualWireProvider.initialize({})
        audioMatrix.registerProvider(this.ctx.virtualWireProvider)
        console.log('[TitanOrchestrator] WAVE 3402: VirtualWireProvider registered')

        this.ctx.usbDirectLinkProvider = new USBDirectLinkProvider()
        await this.ctx.usbDirectLinkProvider.initialize({})
        audioMatrix.registerProvider(this.ctx.usbDirectLinkProvider)
        console.log('[TitanOrchestrator] WAVE 3402: USBDirectLinkProvider registered')
      }
    } catch (e) {
      console.error('[TitanOrchestrator] Trinity startup failed:', e)
    }

    this.ctx.engine = new TitanEngine({
      debug: this.ctx.config.debug,
      initialVibe: this.ctx.config.initialVibe
    })

    this.ctx.audioPipeline.initBeatDetector()

    this.ctx.engine.on('log', (logEntry: { category: string; message: string; data?: Record<string, unknown> }) => {
      this.ctx.log(logEntry.category, logEntry.message, logEntry.data)
    })

    this.ctx.hal = new HardwareAbstraction({
      debug: this.ctx.config.debug,
      driverType: 'usb',
      externalDriver: this.ctx.config.dmxDriver
    })

    this.ctx.isInitialized = true
  }

  start(): void {
    if (!this.ctx.isInitialized) {
      console.error('[TitanOrchestrator] Cannot start - not initialized')
      return
    }
    if (this.ctx.isRunning) return

    this.ctx.isRunning = true
    this.ctx.scheduler.start()

    universalDMX.onWarning = (msg: string) => {
      console.warn(msg)
      this.ctx.log('Error', msg)
    }

    setTimeout(() => {
      this.ctx.log('System', 'TITAN 2.0 ONLINE - Main loop started @ 44fps (WAVE 2510 hot-frame)')
      this.ctx.log('Info', `Fixtures loaded: ${this.ctx.fixtures.length}`)
    }, 100)
  }

  async stop(): Promise<void> {
    if (this.ctx.hal) {
      this.ctx.hal.setBlackout(true)
    }

    universalDMX.blackout()
    await universalDMX.sendAll()
    await new Promise<void>(resolve => setTimeout(resolve, 30))

    await this.ctx.scheduler.stop()
    if (this.ctx.cardiogramaInterval) {
      clearInterval(this.ctx.cardiogramaInterval)
      this.ctx.cardiogramaInterval = null
    }
    universalDMX.onWarning = null
    this.ctx.isRunning = false

    if (this.ctx.oscProvider) {
      this.ctx.oscProvider.stop()
      this.ctx.oscProvider = null
    }

    if (this.ctx.virtualWireProvider) {
      await this.ctx.virtualWireProvider.stop()
      this.ctx.virtualWireProvider = null
    }
    if (this.ctx.usbDirectLinkProvider) {
      await this.ctx.usbDirectLinkProvider.stop()
      this.ctx.usbDirectLinkProvider = null
    }

    vibeMovementManager.resetTime()

    if (this.ctx.beatDetector) {
      this.ctx.beatDetector.reset()
    }
  }
}
"@

if (-not (Test-Path $lifecycleDir)) { New-Item -ItemType Directory -Path $lifecycleDir -Force | Out-Null }
[System.IO.File]::WriteAllText("$lifecycleDir\SystemLifecycleManager.ts", $lifecycleCode, [System.Text.Encoding]::UTF8)
Write-Host "Phase 9: SystemLifecycleManager.ts created"

# ====== PHASE 10: TheiaBridgeManager ======

$theiaCode = @"
/**
 * WAVE 4964 PHASE 10: THEIA BRIDGE MANAGER
 * Extracted from TitanOrchestrator: attachTheiaRenderer, detachTheiaRenderer,
 *   attachSeleneTheiaBridge, detachSeleneTheiaBridge
 * @module TheiaBridgeManager
 */

import { TheiaVideoRenderer } from '../../theia/TheiaVideoRenderer'
import type { SeleneTheiaBridge } from '../../theia/SeleneTheiaBridge'

export interface TheiaBridgeContext {
  _theiaVideoRenderer: any
  _seleneThetaBridge: any
  _aetherCanvasManager: any
  _pixelMapAdapter: any
  _aetherGraph: any
  _aetherStageBounds: any
}

export class TheiaBridgeManager {
  private ctx: TheiaBridgeContext

  constructor(ctx: TheiaBridgeContext) {
    this.ctx = ctx
  }

  attachTheiaRenderer(
    canvasId: string,
    thumbPixelSAB: SharedArrayBuffer,
    opts: {
      intensity?: number
      alphaToDimmer?: boolean
    } = {},
  ): void {
    this.ctx._theiaVideoRenderer?.stop()
    this.ctx._theiaVideoRenderer = new TheiaVideoRenderer(
      canvasId,
      this.ctx._aetherCanvasManager,
      thumbPixelSAB,
    )
    this.ctx._theiaVideoRenderer.active = true

    const stageRect = {
      x0: -this.ctx._aetherStageBounds.width  * 0.5,
      z0: -this.ctx._aetherStageBounds.depth  * 0.5,
      x1:  this.ctx._aetherStageBounds.width  * 0.5,
      z1:  this.ctx._aetherStageBounds.depth  * 0.5,
    }
    this.ctx._pixelMapAdapter.bindWorldSamplers(
      canvasId,
      {
        intensity: opts.intensity ?? 1.0,
        alphaToDimmer: opts.alphaToDimmer ?? false,
      },
      this.ctx._aetherGraph,
      stageRect,
      64,
      64,
    )

    console.log(\`[TitanOrchestrator] WAVE 4867: TheiaVideoRenderer attached (canvasId='\${canvasId}')\`)
  }

  detachTheiaRenderer(): void {
    if (this.ctx._theiaVideoRenderer) {
      this.ctx._theiaVideoRenderer.stop()
      const canvasId = this.ctx._theiaVideoRenderer.getTelemetry().canvasId
      this.ctx._pixelMapAdapter.unbindCanvas(canvasId)
      this.ctx._aetherCanvasManager.release(canvasId)
      this.ctx._theiaVideoRenderer = null
      console.log('[TitanOrchestrator] WAVE 4867: TheiaVideoRenderer detached')
    }
  }

  attachSeleneTheiaBridge(bridge: SeleneTheiaBridge): void {
    this.ctx._seleneThetaBridge = bridge
    console.log('[TitanOrchestrator] WAVE 4869: SeleneTheiaBridge attached')
  }

  detachSeleneTheiaBridge(): void {
    this.ctx._seleneThetaBridge = null
    console.log('[TitanOrchestrator] WAVE 4869: SeleneTheiaBridge detached')
  }
}
"@

if (-not (Test-Path $theiaDir)) { New-Item -ItemType Directory -Path $theiaDir -Force | Out-Null }
[System.IO.File]::WriteAllText("$theiaDir\TheiaBridgeManager.ts", $theiaCode, [System.Text.Encoding]::UTF8)
Write-Host "Phase 10: TheiaBridgeManager.ts created"

# ====== PHASE 11: VibeLifecycleManager ======

$vibeCode = @"
/**
 * WAVE 4964 PHASE 11: VIBE LIFECYCLE MANAGER
 * Extracted from TitanOrchestrator: setVibe, forcePaletteSync, setMood, getMood,
 *   setChronosHeatmap, setChronosPlayhead, setMode, setUseBrain,
 *   setConsciousnessEnabled, setLiquidStereo, setLiquidLayout, getLiquidLayout
 * @module VibeLifecycleManager
 */

import { MoodController } from '../../engine/MoodController'
import type { VibeId } from '../../engine/types'

export interface VibeLifecycleContext {
  engine: any
  hal: any
  trinity: any
  mode: string
  useBrain: boolean
  consciousnessEnabled: boolean
  currentLiquidLayout: '4.1' | '7.1'
  log: (category: string, message: string, data?: Record<string, unknown>) => void
}

export class VibeLifecycleManager {
  private ctx: VibeLifecycleContext

  constructor(ctx: VibeLifecycleContext) {
    this.ctx = ctx
  }

  setVibe(vibeId: VibeId): void {
    if (this.ctx.engine) {
      this.ctx.engine.setVibe(vibeId)
      const normalizedVibeId = this.ctx.engine.getCurrentVibe()

      console.log(\`[TitanOrchestrator] Vibe set to: \${normalizedVibeId}\`)
      this.ctx.log('Mode', \`Vibe changed to: \${normalizedVibeId.toUpperCase()}\`)

      if (this.ctx.trinity) {
        this.ctx.trinity.setVibe(normalizedVibeId)
        console.log('[TitanOrchestrator] WAVE 289: Vibe propagated to Workers')
      }

      if (this.ctx.hal) {
        this.ctx.hal.setVibe(normalizedVibeId)
        console.log('[TitanOrchestrator] WAVE 338: Movement physics updated for vibe')
      }

      if (this.ctx.trinity) {
        this.ctx.trinity.resetPacemaker()
        console.log(\`[TitanOrchestrator] WAVE 2140: Pacemaker reset triggered by vibe change \${normalizedVibeId}\`)
      }

      this.ctx.engine.setActiveProfile(normalizedVibeId)
      console.log(\`[TitanOrchestrator] WAVE 3230: Clean Slate for vibe \${normalizedVibeId}\`)
    }
  }

  forcePaletteSync(): void {
    if (this.ctx.engine) {
      this.ctx.engine.forcePaletteRefresh()
      console.log('[TitanOrchestrator] Palette forcefully synced to current vibe')
    }
  }

  setMood(moodId: 'calm' | 'balanced' | 'punk'): void {
    if (this.ctx.engine) {
      MoodController.getInstance().setMood(moodId)
      console.log(\`[TitanOrchestrator] Mood set to: \${moodId.toUpperCase()}\`)
      this.ctx.log('Mode', \`Mood changed to: \${moodId.toUpperCase()}\`)
    }
  }

  getMood(): 'calm' | 'balanced' | 'punk' {
    return MoodController.getInstance().getCurrentMood()
  }

  setChronosHeatmap(heatmap: unknown): void {
    if (this.ctx.engine) {
      this.ctx.engine.setChronosHeatmap(heatmap as any)
    }
  }

  setChronosPlayhead(timeMs: number, isPlaying: boolean): void {
    if (this.ctx.engine) {
      this.ctx.engine.setChronosPlayhead(timeMs, isPlaying)
    }
  }

  setMode(mode: string): void {
    this.ctx.mode = mode as 'auto' | 'manual'
    console.log(\`[TitanOrchestrator] Mode set to: \${mode}\`)
    this.ctx.log('System', \`Mode: \${mode.toUpperCase()}\`)
  }

  setUseBrain(enabled: boolean): void {
    this.ctx.useBrain = enabled
    console.log(\`[TitanOrchestrator] Brain \${enabled ? 'enabled' : 'disabled'} (FULL SYSTEM)\`)
    this.ctx.log('System', \`Brain: \${enabled ? 'ONLINE' : 'OFFLINE'}\`)
  }

  setConsciousnessEnabled(enabled: boolean): void {
    this.ctx.consciousnessEnabled = enabled
    if (this.ctx.engine) {
      this.ctx.engine.setConsciousnessEnabled(enabled)
    }
    console.log(\`[TitanOrchestrator] Consciousness \${enabled ? 'ENABLED' : 'DISABLED'}\`)
    this.ctx.log('Brain', \`Consciousness: \${enabled ? 'ACTIVE' : 'STANDBY'}\`)
  }

  setLiquidStereo(enabled: boolean): void {
    if (this.ctx.engine) {
      this.ctx.engine.setLiquidStereo(enabled)
    }
    console.log(\`[TitanOrchestrator] Liquid Stereo: \${enabled ? 'ACTIVE' : 'OFF'}\`)
    this.ctx.log('Physics', \`Liquid Stereo: \${enabled ? '7-BAND' : 'GOD MODE'}\`)
  }

  setLiquidLayout(mode: '4.1' | '7.1'): void {
    this.ctx.currentLiquidLayout = mode
    if (this.ctx.engine) {
      this.ctx.engine.setLiquidLayout(mode)
    }
    console.log(\`[TitanOrchestrator] Layout: \${mode}\`)
    this.ctx.log('Physics', \`Layout switched to \${mode}\`)
  }

  getLiquidLayout(): '4.1' | '7.1' {
    return this.ctx.currentLiquidLayout
  }
}
"@

[System.IO.File]::WriteAllText("$lifecycleDir\VibeLifecycleManager.ts", $vibeCode, [System.Text.Encoding]::UTF8)
Write-Host "Phase 11: VibeLifecycleManager.ts created"

# ====== UPDATE TITAN ORCHESTRATOR ======

# 1. Add imports
$newLines = New-Object System.Collections.ArrayList
$addedLifecycle = $false; $addedTheia = $false; $addedVibe = $false
for ($i = 0; $i -lt $lines.Length; $i++) {
    [void]$newLines.Add($lines[$i])
    if (-not $addedLifecycle -and $lines[$i] -match "import \{ TickEngine \} from") {
        [void]$newLines.Add("import { SystemLifecycleManager } from './lifecycle/SystemLifecycleManager'")
        [void]$newLines.Add("import type { SystemLifecycleContext } from './lifecycle/SystemLifecycleManager'")
        $addedLifecycle = $true
    }
    if (-not $addedTheia -and $lines[$i] -match "import type \{ SystemLifecycleContext \} from") {
        [void]$newLines.Add("import { TheiaBridgeManager } from './theia/TheiaBridgeManager'")
        [void]$newLines.Add("import type { TheiaBridgeContext } from './theia/TheiaBridgeManager'")
        $addedTheia = $true
    }
    if (-not $addedVibe -and $lines[$i] -match "import type \{ TheiaBridgeContext \} from") {
        [void]$newLines.Add("import { VibeLifecycleManager } from './lifecycle/VibeLifecycleManager'")
        [void]$newLines.Add("import type { VibeLifecycleContext } from './lifecycle/VibeLifecycleManager'")
        $addedVibe = $true
    }
}
$lines = $newLines.ToArray()
Write-Host "Added manager imports"

# 2. Add fields after tickEngine
$newLines = New-Object System.Collections.ArrayList
$added = $false
for ($i = 0; $i -lt $lines.Length; $i++) {
    [void]$newLines.Add($lines[$i])
    if (-not $added -and $lines[$i] -match 'private readonly tickEngine: TickEngine') {
        [void]$newLines.Add('  private readonly lifecycleManager: SystemLifecycleManager')
        [void]$newLines.Add('  private readonly theiaBridgeManager: TheiaBridgeManager')
        [void]$newLines.Add('  private readonly vibeLifecycleManager: VibeLifecycleManager')
        $added = $true
    }
}
$lines = $newLines.ToArray()
Write-Host "Added manager fields"

# 3. Add constructor init after tickEngine init
$newLines = New-Object System.Collections.ArrayList
$added = $false
for ($i = 0; $i -lt $lines.Length; $i++) {
    [void]$newLines.Add($lines[$i])
    if (-not $added -and $lines[$i] -match 'this\.tickEngine = new TickEngine\(\{') {
        # Find the closing }) of tickEngine
        $j = $i
        while ($j -lt $lines.Length -and $lines[$j] -notmatch '^\s+\}\)$') { $j++ }
        # Skip past the tickEngine init (we'll add lifecycle init after it)
    }
    if (-not $added -and $lines[$i] -match '^\s+\}\)$' -and $i -gt 0) {
        # Check if previous lines contain tickEngine
        $prev = $lines[$i-1]
        if ($prev -match 'log:' -or $prev -match 'oscProvider') {
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
Write-Host "Added manager constructor inits"

# 4. Replace methods with delegators
# We need to replace: init, start, stop, attachTheiaRenderer, detachTheiaRenderer,
#   attachSeleneTheiaBridge, detachSeleneTheiaBridge, setVibe, forcePaletteSync,
#   setMood, getMood, setChronosHeatmap, setChronosPlayhead, setMode, setUseBrain,
#   setConsciousnessEnabled, setLiquidStereo, setLiquidLayout, getLiquidLayout

$methodMap = @{
    'async init(): Promise<void>' = 'async init(): Promise<void> { await this.lifecycleManager.init() }'
    'start(): void' = 'start(): void { this.lifecycleManager.start() }'
    'async stop(): Promise<void>' = 'async stop(): Promise<void> { await this.lifecycleManager.stop() }'
    'attachTheiaRenderer(' = 'attachTheiaRenderer(canvasId: string, thumbPixelSAB: SharedArrayBuffer, opts: { intensity?: number; alphaToDimmer?: boolean } = {}): void { this.theiaBridgeManager.attachTheiaRenderer(canvasId, thumbPixelSAB, opts) }'
    'detachTheiaRenderer(): void' = 'detachTheiaRenderer(): void { this.theiaBridgeManager.detachTheiaRenderer() }'
    'attachSeleneTheiaBridge(bridge: SeleneTheiaBridge): void' = 'attachSeleneTheiaBridge(bridge: SeleneTheiaBridge): void { this.theiaBridgeManager.attachSeleneTheiaBridge(bridge) }'
    'detachSeleneTheiaBridge(): void' = 'detachSeleneTheiaBridge(): void { this.theiaBridgeManager.detachSeleneTheiaBridge() }'
    'setVibe(vibeId: VibeId): void' = 'setVibe(vibeId: VibeId): void { this.vibeLifecycleManager.setVibe(vibeId) }'
    'forcePaletteSync(): void' = 'forcePaletteSync(): void { this.vibeLifecycleManager.forcePaletteSync() }'
    "setMood(moodId: 'calm' | 'balanced' | 'punk'): void" = "setMood(moodId: 'calm' | 'balanced' | 'punk'): void { this.vibeLifecycleManager.setMood(moodId) }"
    "getMood(): 'calm' | 'balanced' | 'punk'" = "getMood(): 'calm' | 'balanced' | 'punk' { return this.vibeLifecycleManager.getMood() }"
    'setChronosHeatmap(heatmap: unknown): void' = 'setChronosHeatmap(heatmap: unknown): void { this.vibeLifecycleManager.setChronosHeatmap(heatmap) }'
    'setChronosPlayhead(timeMs: number, isPlaying: boolean): void' = 'setChronosPlayhead(timeMs: number, isPlaying: boolean): void { this.vibeLifecycleManager.setChronosPlayhead(timeMs, isPlaying) }'
    'setMode(mode: string): void' = 'setMode(mode: string): void { this.vibeLifecycleManager.setMode(mode) }'
    'setUseBrain(enabled: boolean): void' = 'setUseBrain(enabled: boolean): void { this.vibeLifecycleManager.setUseBrain(enabled) }'
    'setConsciousnessEnabled(enabled: boolean): void' = 'setConsciousnessEnabled(enabled: boolean): void { this.vibeLifecycleManager.setConsciousnessEnabled(enabled) }'
    'setLiquidStereo(enabled: boolean): void' = 'setLiquidStereo(enabled: boolean): void { this.vibeLifecycleManager.setLiquidStereo(enabled) }'
    "setLiquidLayout(mode: '4.1' | '7.1'): void" = "setLiquidLayout(mode: '4.1' | '7.1'): void { this.vibeLifecycleManager.setLiquidLayout(mode) }"
    "getLiquidLayout(): '4.1' | '7.1'" = "getLiquidLayout(): '4.1' | '7.1' { return this.vibeLifecycleManager.getLiquidLayout() }"
}

# Process each method: find its start (signature line), find its end (closing }), replace with delegator
$replacements = @()
foreach ($sig in $methodMap.Keys) {
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match [regex]::Escape($sig)) {
            # Find the end of this method
            $start = $i
            # Check if the method has a comment block before it
            if ($start -gt 0 -and $lines[$start-1].Trim().StartsWith('*/')) {
                # Find the start of the comment
                $commentStart = $start - 1
                while ($commentStart -gt 0 -and -not $lines[$commentStart].Trim().StartsWith('/**')) {
                    $commentStart--
                }
                $start = $commentStart
            }
            
            $depth = 0; $end = $start
            $foundOpen = $false
            for ($j = $start; $j -lt $lines.Length; $j++) {
                $open = ($lines[$j].ToCharArray() | Where-Object { $_ -eq '{' }).Count
                $close = ($lines[$j].ToCharArray() | Where-Object { $_ -eq '}' }).Count
                if ($open -gt 0) { $foundOpen = $true }
                $depth += $open - $close
                if ($foundOpen -and $depth -eq 0) { $end = $j; break }
            }
            
            $replacements += @{ Start = $start; End = $end; NewLine = $methodMap[$sig] }
            break
        }
    }
}

# Sort replacements by Start descending so we can splice without index shifts
$replacements = $replacements | Sort-Object Start -Descending

foreach ($r in $replacements) {
    Write-Host "Replacing lines $($r.Start)-$($r.End) with delegator"
    $newArr = New-Object System.Collections.ArrayList
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($i -eq $r.Start) {
            [void]$newArr.Add("  $($r.NewLine)")
            $i = $r.End
            continue
        }
        [void]$newArr.Add($lines[$i])
    }
    $lines = $newArr.ToArray()
}

[System.IO.File]::WriteAllLines($orchPath, $lines, [System.Text.Encoding]::UTF8)
Write-Host "Orchestrator written: $($lines.Length) lines"
Write-Host "DONE - Phases 9, 10, 11 complete"
