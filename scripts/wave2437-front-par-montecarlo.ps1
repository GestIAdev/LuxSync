# ==========================================================================
# WAVE 2437: MONTE CARLO -- FRONT PAR KICK vs SUBBASS
# ==========================================================================
# Simula LiquidEnvelope.process() frame-a-frame usando datos REALES
# del log frontcalib.md
# ==========================================================================

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3

# ==========================================================================
# 1. PARSE LOG
# ==========================================================================

$logPath = Join-Path $PSScriptRoot '..\docs\logs\frontcalib.md'
$logContent = Get-Content -Path $logPath -Raw

# Extraer TECHNO-FRONT frames
$technoFrames = [System.Collections.Generic.List[hashtable]]::new()
$technoPattern = '\[TECHNO-FRONT\]\s+sB:(\d+\.\d+)\s+kE:(\d+\.\d+)\s+\|\s+fL:(\d+\.\d+)\s+fR:(\d+\.\d+)\s+\|\s+fPar:(\d+\.\d+)\s+\|\s+morph:(\d+\.\d+)'

foreach ($m in [regex]::Matches($logContent, $technoPattern)) {
    $technoFrames.Add(@{
        sB      = [double]$m.Groups[1].Value
        bass    = [double]$m.Groups[2].Value
        fL_real = [double]$m.Groups[3].Value
        fR_real = [double]$m.Groups[4].Value
        morph   = [double]$m.Groups[6].Value
    })
}

# Extraer KICK events y mapear a frame indices
$kickFrameIndices = [System.Collections.Generic.HashSet[int]]::new()
$lines = $logContent -split "`n"
$frameIdx = -1
$pendingKick = $false

foreach ($line in $lines) {
    if ($line -match '\[TECHNO-FRONT\]') {
        $frameIdx++
        if ($pendingKick) {
            [void]$kickFrameIndices.Add($frameIdx)
            $pendingKick = $false
        }
    }
    elseif ($line -match 'INTERVAL BPM\] KICK') {
        $pendingKick = $true
    }
}

$totalFrames = $technoFrames.Count
$totalKicks = $kickFrameIndices.Count

Write-Host "================================================================"
Write-Host "  WAVE 2437: MONTE CARLO -- FRONT PAR CALIBRATION"
Write-Host "================================================================"
Write-Host "  Frames parseados: $totalFrames"
Write-Host "  Kicks detectados: $totalKicks"
Write-Host "  Kick indices: $($kickFrameIndices | Sort-Object | ForEach-Object { $_ })"
Write-Host ""

# ==========================================================================
# 2. LIQUID ENVELOPE SIMULATOR
# ==========================================================================

class EnvelopeState {
    [double]$intensity = 0
    [double]$avgSignal = 0
    [double]$avgSignalPeak = 0
    [double]$lastFireTime = 0
    [double]$lastSignal = 0
    [bool]$wasAttacking = $false
}

function Invoke-EnvelopeProcess {
    param(
        [hashtable]$config,
        [EnvelopeState]$state,
        [double]$signal,
        [double]$morphFactor,
        [double]$now,
        [bool]$isBreakdown
    )

    $c = $config
    $s = $state

    # 1. VELOCITY GATE
    $velocity = $signal - $s.lastSignal
    $s.lastSignal = $signal

    $isRisingAttack = $velocity -ge -0.005
    $isGraceFrame = $s.wasAttacking -and ($velocity -ge -0.03)
    $isAttacking = $isRisingAttack -or $isGraceFrame
    $s.wasAttacking = $isRisingAttack -and ($velocity -gt 0.01)

    # 2. ASYMMETRIC EMA
    if ($signal -gt $s.avgSignal) {
        $s.avgSignal = $s.avgSignal * 0.98 + $signal * 0.02
    } else {
        $s.avgSignal = $s.avgSignal * 0.88 + $signal * 0.12
    }

    # 3. PEAK MEMORY + TIDAL GATE
    $timeSinceLastFire = if ($s.lastFireTime -gt 0) { $now - $s.lastFireTime } else { 0 }
    $isDrySpell = $timeSinceLastFire -gt 2000

    $peakDecay = if ($isDrySpell) { 0.985 } else { 0.993 }
    if ($s.avgSignal -gt $s.avgSignalPeak) {
        $s.avgSignalPeak = $s.avgSignal
    } else {
        $s.avgSignalPeak = $s.avgSignalPeak * $peakDecay + $s.avgSignal * (1 - $peakDecay)
    }

    # 4. ADAPTIVE FLOOR
    $drySpellFloorDecay = if ($timeSinceLastFire -gt 3000) {
        [Math]::Min(1.0, ($timeSinceLastFire - 3000) / 3000)
    } else { 0 }
    $adaptiveFloor = $c.gateOn - (0.12 * $drySpellFloorDecay)
    $avgEffective = [Math]::Max($s.avgSignal, [Math]::Max($s.avgSignalPeak * 0.55, $adaptiveFloor))

    # 5. DYNAMIC GATE
    $dynamicGate = $avgEffective + $c.gateMargin

    # 6. DECAY
    $decay = $c.decayBase + $c.decayRange * $morphFactor
    $s.intensity *= $decay

    # 7. MAIN GATE
    $breakdownPenalty = if ($isBreakdown) { 0.06 } else { 0 }
    $kickPower = 0.0
    $ghostPower = 0.0

    if (($signal -gt $dynamicGate) -and $isAttacking -and ($signal -gt 0.15)) {
        $requiredJump = 0.14 - 0.07 * $morphFactor + $breakdownPenalty
        $rawPower = ($signal - $dynamicGate) / $requiredJump
        $rawPower = [Math]::Min(1.0, [Math]::Max(0, $rawPower))
        $crushExp = $c.crushExponent + 0.3 * (1.0 - $morphFactor)
        $kickPower = [Math]::Pow($rawPower, $crushExp)
    }
    elseif (($signal -gt $avgEffective) -and ($signal -gt 0.15) -and (-not $isBreakdown)) {
        $ghostCapDynamic = $c.ghostCap * $morphFactor
        if ($ghostCapDynamic -gt 0) {
            $proximity = ($signal - $avgEffective) / 0.02
            $ghostPower = [Math]::Min($ghostCapDynamic, $proximity * $ghostCapDynamic)
        }
    }

    # 8. IGNITION SQUELCH
    $squelch = [Math]::Max(0.02, $c.squelchBase - $c.squelchSlope * $morphFactor)

    if ($kickPower -gt $squelch) {
        $s.lastFireTime = $now
        $hit = [Math]::Min(
            $c.maxIntensity,
            $kickPower * (1.2 + 0.8 * $morphFactor) * $c.boost
        )
        $s.intensity = [Math]::Max($s.intensity, $hit)
    }
    elseif ($ghostPower -gt 0) {
        $s.intensity = [Math]::Max($s.intensity, $ghostPower)
    }

    # 9. SMOOTH FADE
    $fadeZone = 0.08
    $fadeFactor = if ($s.intensity -ge $fadeZone) {
        1.0
    } else {
        [Math]::Pow($s.intensity / [Math]::Max(0.0001, $fadeZone), 2)
    }

    return [Math]::Min($c.maxIntensity, $s.intensity * $fadeFactor)
}

# ==========================================================================
# 3. SIMULATION RUNNER
# ==========================================================================

function Invoke-Simulation {
    param(
        [hashtable]$kickConfig,
        [hashtable]$subBassConfig
    )

    $kickState = [EnvelopeState]::new()
    $subBassState = [EnvelopeState]::new()

    $now = 0.0
    $frameTimeMs = 50.0

    $truePositives = 0
    $falsePositives = 0
    $missedKicks = 0
    $trueNegatives = 0
    $fLAsfixiaCount = 0
    $totalFrOutput = 0.0

    for ($i = 0; $i -lt $totalFrames; $i++) {
        $frame = $technoFrames[$i]
        $isKickFrame = $kickFrameIndices.Contains($i)
        $now += $frameTimeMs

        $kickSignal = if ($isKickFrame) { $frame.bass } else { 0.0 }

        $fR = Invoke-EnvelopeProcess -config $kickConfig -state $kickState `
            -signal $kickSignal -morphFactor $frame.morph -now $now -isBreakdown $false

        $fL = Invoke-EnvelopeProcess -config $subBassConfig -state $subBassState `
            -signal $frame.sB -morphFactor $frame.morph -now $now -isBreakdown $false

        if ($isKickFrame) {
            if ($fR -gt 0.01) {
                $truePositives++
                $totalFrOutput += $fR
                if ($fL -ge $fR) { $fLAsfixiaCount++ }
            } else {
                $missedKicks++
            }
        } else {
            if ($fR -gt 0.01) {
                $falsePositives++
            } else {
                $trueNegatives++
            }
        }
    }

    # FITNESS: premio kicks, castigo falsos positivos, bonus magnitud
    $fitness = ($truePositives * 10) +
               (($truePositives - $fLAsfixiaCount) * 5) +
               ($falsePositives * -20) +
               ($missedKicks * -15) +
               ($totalFrOutput * 3)

    return @{
        fitness       = $fitness
        truePositives = $truePositives
        falsePositives = $falsePositives
        missedKicks   = $missedKicks
        trueNegatives = $trueNegatives
        fLAsfixia     = $fLAsfixiaCount
        totalFrOutput = [Math]::Round($totalFrOutput, 3)
        kickRate      = if ($totalKicks -gt 0) { [Math]::Round($truePositives / $totalKicks * 100, 1) } else { 0 }
        falseRate     = if (($totalFrames - $totalKicks) -gt 0) { [Math]::Round($falsePositives / ($totalFrames - $totalKicks) * 100, 1) } else { 0 }
    }
}

# ==========================================================================
# 4. BASELINE
# ==========================================================================

$currentKick = @{
    name          = 'Front R (Kick Sniper)'
    gateOn        = 0.15
    boost         = 3.0
    crushExponent = 0.6
    decayBase     = 0.04
    decayRange    = 0.10
    maxIntensity  = 0.85
    squelchBase   = 0.03
    squelchSlope  = 0.10
    ghostCap      = 0.00
    gateMargin    = 0.01
}

$currentSubBass = @{
    name          = 'Front L (SubBass Groove)'
    gateOn        = 0.12
    boost         = 3.5
    crushExponent = 2.6
    decayBase     = 0.30
    decayRange    = 0.15
    maxIntensity  = 0.70
    squelchBase   = 0.04
    squelchSlope  = 0.55
    ghostCap      = 0.06
    gateMargin    = 0.01
}

Write-Host "-- BASELINE (parametros actuales) --"
$baseline = Invoke-Simulation -kickConfig $currentKick -subBassConfig $currentSubBass
Write-Host "  Fitness:          $($baseline.fitness)"
Write-Host "  Kick Hit Rate:    $($baseline.kickRate)% ($($baseline.truePositives)/$totalKicks)"
Write-Host "  False Positives:  $($baseline.falsePositives) ($($baseline.falseRate)%)"
Write-Host "  Missed Kicks:     $($baseline.missedKicks)"
Write-Host "  fL Asfixia:       $($baseline.fLAsfixia)/$($baseline.truePositives)"
Write-Host "  Total fR output:  $($baseline.totalFrOutput)"
Write-Host ""

# ==========================================================================
# 5. MONTE CARLO -- 10,000 iteraciones
# ==========================================================================

$rng = [System.Random]::new(42)

function Get-MutatedValue {
    param([double]$base, [double]$min, [double]$max, [double]$stddev)
    $u1 = 1.0 - $rng.NextDouble()
    $u2 = 1.0 - $rng.NextDouble()
    $gaussian = [Math]::Sqrt(-2.0 * [Math]::Log($u1)) * [Math]::Sin(2.0 * [Math]::PI * $u2)
    $mutated = $base + $gaussian * $stddev
    return [Math]::Max($min, [Math]::Min($max, $mutated))
}

$iterations = 10000
$bestFitness = $baseline.fitness
$bestResult = $baseline
$bestKickConfig = $currentKick.Clone()
$bestSubBassConfig = $currentSubBass.Clone()

# Top10: array de 10 slots + worstIdx para insercion O(1)
$top10 = @()
$top10WorstFitness = [double]::MaxValue
$top10WorstIdx = 0

Write-Host "-- MONTE CARLO: $iterations iteraciones (Phase 1) --"
Write-Host ""

$sw = [System.Diagnostics.Stopwatch]::StartNew()

for ($iter = 0; $iter -lt $iterations; $iter++) {
    $mutKick = @{
        name          = 'Front R (Kick Sniper)'
        gateOn        = Get-MutatedValue -base $currentKick.gateOn -min 0.01 -max 0.40 -stddev 0.04
        boost         = Get-MutatedValue -base $currentKick.boost -min 0.5 -max 8.0 -stddev 0.8
        crushExponent = Get-MutatedValue -base $currentKick.crushExponent -min 0.1 -max 3.0 -stddev 0.3
        decayBase     = Get-MutatedValue -base $currentKick.decayBase -min 0.001 -max 0.30 -stddev 0.03
        decayRange    = Get-MutatedValue -base $currentKick.decayRange -min 0.0 -max 0.30 -stddev 0.04
        maxIntensity  = Get-MutatedValue -base $currentKick.maxIntensity -min 0.5 -max 1.0 -stddev 0.1
        squelchBase   = Get-MutatedValue -base $currentKick.squelchBase -min 0.001 -max 0.15 -stddev 0.02
        squelchSlope  = Get-MutatedValue -base $currentKick.squelchSlope -min 0.0 -max 0.50 -stddev 0.05
        ghostCap      = 0.00
        gateMargin    = Get-MutatedValue -base $currentKick.gateMargin -min 0.0 -max 0.10 -stddev 0.01
    }

    $mutSubBass = @{
        name          = 'Front L (SubBass Groove)'
        gateOn        = Get-MutatedValue -base $currentSubBass.gateOn -min 0.01 -max 0.40 -stddev 0.04
        boost         = Get-MutatedValue -base $currentSubBass.boost -min 0.5 -max 8.0 -stddev 0.8
        crushExponent = Get-MutatedValue -base $currentSubBass.crushExponent -min 0.5 -max 4.0 -stddev 0.4
        decayBase     = Get-MutatedValue -base $currentSubBass.decayBase -min 0.05 -max 0.80 -stddev 0.08
        decayRange    = Get-MutatedValue -base $currentSubBass.decayRange -min 0.0 -max 0.30 -stddev 0.04
        maxIntensity  = Get-MutatedValue -base $currentSubBass.maxIntensity -min 0.2 -max 0.90 -stddev 0.1
        squelchBase   = Get-MutatedValue -base $currentSubBass.squelchBase -min 0.001 -max 0.15 -stddev 0.02
        squelchSlope  = Get-MutatedValue -base $currentSubBass.squelchSlope -min 0.0 -max 1.0 -stddev 0.1
        ghostCap      = Get-MutatedValue -base $currentSubBass.ghostCap -min 0.0 -max 0.15 -stddev 0.02
        gateMargin    = Get-MutatedValue -base $currentSubBass.gateMargin -min 0.0 -max 0.10 -stddev 0.01
    }

    $result = Invoke-Simulation -kickConfig $mutKick -subBassConfig $mutSubBass

    if ($result.fitness -gt $bestFitness) {
        $bestFitness = $result.fitness
        $bestResult = $result
        $bestKickConfig = $mutKick.Clone()
        $bestSubBassConfig = $mutSubBass.Clone()
    }

    # Top10: insercion sin sort
    if ($top10.Count -lt 10) {
        $top10 += @{ fitness=$result.fitness; result=$result; kickConfig=$mutKick.Clone(); subBassConfig=$mutSubBass.Clone(); iteration=$iter }
        if ($top10.Count -eq 10) {
            # Calcular worst
            $top10WorstFitness = $top10[0].fitness; $top10WorstIdx = 0
            for ($k=1; $k -lt 10; $k++) { if ($top10[$k].fitness -lt $top10WorstFitness) { $top10WorstFitness=$top10[$k].fitness; $top10WorstIdx=$k } }
        }
    }
    elseif ($result.fitness -gt $top10WorstFitness) {
        $top10[$top10WorstIdx] = @{ fitness=$result.fitness; result=$result; kickConfig=$mutKick.Clone(); subBassConfig=$mutSubBass.Clone(); iteration=$iter }
        # Recalcular worst
        $top10WorstFitness = $top10[0].fitness; $top10WorstIdx = 0
        for ($k=1; $k -lt 10; $k++) { if ($top10[$k].fitness -lt $top10WorstFitness) { $top10WorstFitness=$top10[$k].fitness; $top10WorstIdx=$k } }
    }

    if ($iter % 2000 -eq 0 -and $iter -gt 0) {
        Write-Host "  [$iter/$iterations] Best fitness: $([Math]::Round($bestFitness, 2)) | Kick rate: $($bestResult.kickRate)% | FP: $($bestResult.falsePositives)"
    }
}

# ==========================================================================
# 6. PHASE 2 -- REFINAMIENTO (5000 iteraciones, stddev x0.3)
# ==========================================================================

Write-Host ""
Write-Host "-- PHASE 2: REFINAMIENTO (5000 iter, stddev x0.3) --"

for ($iter = 0; $iter -lt 5000; $iter++) {
    $mutKick = @{
        name          = 'Front R (Kick Sniper)'
        gateOn        = Get-MutatedValue -base $bestKickConfig.gateOn -min 0.01 -max 0.40 -stddev 0.012
        boost         = Get-MutatedValue -base $bestKickConfig.boost -min 0.5 -max 8.0 -stddev 0.24
        crushExponent = Get-MutatedValue -base $bestKickConfig.crushExponent -min 0.1 -max 3.0 -stddev 0.09
        decayBase     = Get-MutatedValue -base $bestKickConfig.decayBase -min 0.001 -max 0.30 -stddev 0.009
        decayRange    = Get-MutatedValue -base $bestKickConfig.decayRange -min 0.0 -max 0.30 -stddev 0.012
        maxIntensity  = Get-MutatedValue -base $bestKickConfig.maxIntensity -min 0.5 -max 1.0 -stddev 0.03
        squelchBase   = Get-MutatedValue -base $bestKickConfig.squelchBase -min 0.001 -max 0.15 -stddev 0.006
        squelchSlope  = Get-MutatedValue -base $bestKickConfig.squelchSlope -min 0.0 -max 0.50 -stddev 0.015
        ghostCap      = 0.00
        gateMargin    = Get-MutatedValue -base $bestKickConfig.gateMargin -min 0.0 -max 0.10 -stddev 0.003
    }

    $mutSubBass = @{
        name          = 'Front L (SubBass Groove)'
        gateOn        = Get-MutatedValue -base $bestSubBassConfig.gateOn -min 0.01 -max 0.40 -stddev 0.012
        boost         = Get-MutatedValue -base $bestSubBassConfig.boost -min 0.5 -max 8.0 -stddev 0.24
        crushExponent = Get-MutatedValue -base $bestSubBassConfig.crushExponent -min 0.5 -max 4.0 -stddev 0.12
        decayBase     = Get-MutatedValue -base $bestSubBassConfig.decayBase -min 0.05 -max 0.80 -stddev 0.024
        decayRange    = Get-MutatedValue -base $bestSubBassConfig.decayRange -min 0.0 -max 0.30 -stddev 0.012
        maxIntensity  = Get-MutatedValue -base $bestSubBassConfig.maxIntensity -min 0.2 -max 0.90 -stddev 0.03
        squelchBase   = Get-MutatedValue -base $bestSubBassConfig.squelchBase -min 0.001 -max 0.15 -stddev 0.006
        squelchSlope  = Get-MutatedValue -base $bestSubBassConfig.squelchSlope -min 0.0 -max 1.0 -stddev 0.03
        ghostCap      = Get-MutatedValue -base $bestSubBassConfig.ghostCap -min 0.0 -max 0.15 -stddev 0.006
        gateMargin    = Get-MutatedValue -base $bestSubBassConfig.gateMargin -min 0.0 -max 0.10 -stddev 0.003
    }

    $result = Invoke-Simulation -kickConfig $mutKick -subBassConfig $mutSubBass

    if ($result.fitness -gt $bestFitness) {
        $bestFitness = $result.fitness
        $bestResult = $result
        $bestKickConfig = $mutKick.Clone()
        $bestSubBassConfig = $mutSubBass.Clone()
    }

    if ($top10.Count -lt 10) {
        $top10 += @{ fitness=$result.fitness; result=$result; kickConfig=$mutKick.Clone(); subBassConfig=$mutSubBass.Clone(); iteration=(10000+$iter) }
        if ($top10.Count -eq 10) {
            $top10WorstFitness = $top10[0].fitness; $top10WorstIdx = 0
            for ($k=1; $k -lt 10; $k++) { if ($top10[$k].fitness -lt $top10WorstFitness) { $top10WorstFitness=$top10[$k].fitness; $top10WorstIdx=$k } }
        }
    }
    elseif ($result.fitness -gt $top10WorstFitness) {
        $top10[$top10WorstIdx] = @{ fitness=$result.fitness; result=$result; kickConfig=$mutKick.Clone(); subBassConfig=$mutSubBass.Clone(); iteration=(10000+$iter) }
        $top10WorstFitness = $top10[0].fitness; $top10WorstIdx = 0
        for ($k=1; $k -lt 10; $k++) { if ($top10[$k].fitness -lt $top10WorstFitness) { $top10WorstFitness=$top10[$k].fitness; $top10WorstIdx=$k } }
    }

    if ($iter % 1000 -eq 0 -and $iter -gt 0) {
        Write-Host "  [P2 $iter/5000] Best fitness: $([Math]::Round($bestFitness, 2)) | Kick rate: $($bestResult.kickRate)% | FP: $($bestResult.falsePositives)"
    }
}

$sw.Stop()

# ==========================================================================
# 7. MATHEMATICAL ANALYSIS
# ==========================================================================

Write-Host ""
Write-Host "================================================================"
Write-Host "  ANALISIS MATEMATICO DEL GATE ADAPTATIVO"
Write-Host "================================================================"

$allBass = $technoFrames | ForEach-Object { $_.bass }
$bassMin = ($allBass | Measure-Object -Minimum).Minimum
$bassMax = ($allBass | Measure-Object -Maximum).Maximum
$bassAvg = ($allBass | Measure-Object -Average).Average
$sortedBass = $allBass | Sort-Object
$bassMed = $sortedBass[[Math]::Floor($sortedBass.Count / 2)]

$kickBass = [System.Collections.Generic.List[double]]::new()
$nonKickBass = [System.Collections.Generic.List[double]]::new()
for ($i = 0; $i -lt $totalFrames; $i++) {
    if ($kickFrameIndices.Contains($i)) {
        $kickBass.Add($technoFrames[$i].bass)
    } else {
        $nonKickBass.Add($technoFrames[$i].bass)
    }
}

$kickBassAvg = if ($kickBass.Count -gt 0) { ($kickBass | Measure-Object -Average).Average } else { 0 }
$kickBassMin = if ($kickBass.Count -gt 0) { ($kickBass | Measure-Object -Minimum).Minimum } else { 0 }
$kickBassMax = if ($kickBass.Count -gt 0) { ($kickBass | Measure-Object -Maximum).Maximum } else { 0 }
$nonKickBassAvg = if ($nonKickBass.Count -gt 0) { ($nonKickBass | Measure-Object -Average).Average } else { 0 }
$nonKickBassMax = if ($nonKickBass.Count -gt 0) { ($nonKickBass | Measure-Object -Maximum).Maximum } else { 0 }

Write-Host ""
Write-Host "  bands.bass (kE) -- Estadisticas globales:"
Write-Host "    Min:     $([Math]::Round($bassMin, 3))"
Write-Host "    Max:     $([Math]::Round($bassMax, 3))"
Write-Host "    Average: $([Math]::Round($bassAvg, 3))"
Write-Host "    Median:  $([Math]::Round($bassMed, 3))"
Write-Host ""
Write-Host "  bands.bass en KICK frames:"
Write-Host "    Count:   $($kickBass.Count)"
Write-Host "    Average: $([Math]::Round($kickBassAvg, 3))"
Write-Host "    Min:     $([Math]::Round($kickBassMin, 3))"
Write-Host "    Max:     $([Math]::Round($kickBassMax, 3))"
Write-Host ""
Write-Host "  bands.bass en NO-KICK frames:"
Write-Host "    Count:   $($nonKickBass.Count)"
Write-Host "    Average: $([Math]::Round($nonKickBassAvg, 3))"
Write-Host "    Max:     $([Math]::Round($nonKickBassMax, 3))"
Write-Host ""

# SubBass analysis
$allSubBass = $technoFrames | ForEach-Object { $_.sB }
$sbAvg = ($allSubBass | Measure-Object -Average).Average
$sbMax = ($allSubBass | Measure-Object -Maximum).Maximum
Write-Host "  subBass (sB) -- Estadisticas:"
Write-Host "    Average: $([Math]::Round($sbAvg, 3))"
Write-Host "    Max:     $([Math]::Round($sbMax, 3))"
Write-Host ""

Write-Host "  IMPORTATE: envKick recibe kickSignal = isKickEdge ? bass : 0"
Write-Host "  La senal es 0.0 en no-kick frames y ~ 0.6-0.9 en kick frames."
Write-Host "  El adaptive gate DEBERIA funcionar -- signal=0 decay el avgSignal."
Write-Host "  Pero: si kicks llegan rapido (cada ~500ms a 121bpm), el EMA no"
Write-Host "  tiene tiempo para decaer (0.88^10 frames = 0.28), y avgSignalPeak"
Write-Host "  con peakDecay=0.993 tiene half-life de ~100 frames (~5s)."
Write-Host "  Cuando el peak sube, dynamicGate = max(avg,peak*0.55,floor)+margin"
Write-Host "  y el kick tiene que SUPERAR ese gate para disparar."
Write-Host ""

# ==========================================================================
# 8. RESULTADOS
# ==========================================================================

Write-Host ""
Write-Host "================================================================"
Write-Host "  RESULTADOS MONTE CARLO -- $($sw.Elapsed.TotalSeconds.ToString('F1'))s"
Write-Host "================================================================"
Write-Host ""
Write-Host "-- BASELINE vs GANADOR --"
Write-Host ""
Write-Host "                    BASELINE        GANADOR"
Write-Host "  Fitness:          $($baseline.fitness.ToString().PadRight(16))$($bestResult.fitness)"
Write-Host "  Kick Rate:        $("$($baseline.kickRate)%".PadRight(16))$($bestResult.kickRate)%"
Write-Host "  False Positives:  $($baseline.falsePositives.ToString().PadRight(16))$($bestResult.falsePositives)"
Write-Host "  Missed Kicks:     $($baseline.missedKicks.ToString().PadRight(16))$($bestResult.missedKicks)"
Write-Host "  fL Asfixia:       $($baseline.fLAsfixia.ToString().PadRight(16))$($bestResult.fLAsfixia)"
Write-Host "  fR Total:         $($baseline.totalFrOutput.ToString().PadRight(16))$($bestResult.totalFrOutput)"
Write-Host ""

Write-Host "-- COEFICIENTES GANADORES: envKick --"
Write-Host "  gateOn:        $([Math]::Round($bestKickConfig.gateOn, 4))"
Write-Host "  boost:         $([Math]::Round($bestKickConfig.boost, 4))"
Write-Host "  crushExponent: $([Math]::Round($bestKickConfig.crushExponent, 4))"
Write-Host "  decayBase:     $([Math]::Round($bestKickConfig.decayBase, 4))"
Write-Host "  decayRange:    $([Math]::Round($bestKickConfig.decayRange, 4))"
Write-Host "  maxIntensity:  $([Math]::Round($bestKickConfig.maxIntensity, 4))"
Write-Host "  squelchBase:   $([Math]::Round($bestKickConfig.squelchBase, 4))"
Write-Host "  squelchSlope:  $([Math]::Round($bestKickConfig.squelchSlope, 4))"
Write-Host "  gateMargin:    $([Math]::Round($bestKickConfig.gateMargin, 4))"
Write-Host ""

Write-Host "-- COEFICIENTES GANADORES: envSubBass --"
Write-Host "  gateOn:        $([Math]::Round($bestSubBassConfig.gateOn, 4))"
Write-Host "  boost:         $([Math]::Round($bestSubBassConfig.boost, 4))"
Write-Host "  crushExponent: $([Math]::Round($bestSubBassConfig.crushExponent, 4))"
Write-Host "  decayBase:     $([Math]::Round($bestSubBassConfig.decayBase, 4))"
Write-Host "  decayRange:    $([Math]::Round($bestSubBassConfig.decayRange, 4))"
Write-Host "  maxIntensity:  $([Math]::Round($bestSubBassConfig.maxIntensity, 4))"
Write-Host "  squelchBase:   $([Math]::Round($bestSubBassConfig.squelchBase, 4))"
Write-Host "  squelchSlope:  $([Math]::Round($bestSubBassConfig.squelchSlope, 4))"
Write-Host "  ghostCap:      $([Math]::Round($bestSubBassConfig.ghostCap, 4))"
Write-Host "  gateMargin:    $([Math]::Round($bestSubBassConfig.gateMargin, 4))"
Write-Host ""

Write-Host "-- TOP 10 SOLUCIONES --"
$top10Sorted = @($top10 | Sort-Object { $_.fitness } -Descending)
for ($i = 0; $i -lt $top10Sorted.Count; $i++) {
    $t = $top10Sorted[$i]
    $r = $t.result
    Write-Host "  #$($i+1): fitness=$($r.fitness) | kick=$($r.kickRate)% | FP=$($r.falsePositives) | miss=$($r.missedKicks) | asfixia=$($r.fLAsfixia) | iter=$($t.iteration)"
}

Write-Host ""
Write-Host "-- DELTA vs BASELINE --"
$props = @('gateOn','boost','crushExponent','decayBase','decayRange','maxIntensity','squelchBase','squelchSlope','gateMargin')
Write-Host "  envKick:"
foreach ($prop in $props) {
    $old = $currentKick[$prop]
    $new = $bestKickConfig[$prop]
    $delta = $new - $old
    $sign = if ($delta -ge 0) { '+' } else { '' }
    Write-Host "    $($prop.PadRight(16)) $([Math]::Round($old,4).ToString().PadRight(10)) -> $([Math]::Round($new,4).ToString().PadRight(10)) ($sign$([Math]::Round($delta,4)))"
}
Write-Host ""
Write-Host "  envSubBass:"
$propsSubBass = @('gateOn','boost','crushExponent','decayBase','decayRange','maxIntensity','squelchBase','squelchSlope','ghostCap','gateMargin')
foreach ($prop in $propsSubBass) {
    $old = $currentSubBass[$prop]
    $new = $bestSubBassConfig[$prop]
    $delta = $new - $old
    $sign = if ($delta -ge 0) { '+' } else { '' }
    Write-Host "    $($prop.PadRight(16)) $([Math]::Round($old,4).ToString().PadRight(10)) -> $([Math]::Round($new,4).ToString().PadRight(10)) ($sign$([Math]::Round($delta,4)))"
}

# ==========================================================================
# 9. TRACE: primeros 80 frames con coeficientes ganadores
# ==========================================================================
Write-Host ""
Write-Host "-- TRACE: Primeros 80 frames con coeficientes ganadores --"
Write-Host "  [frame] kick? | sB    bass  morph | sim_fL  sim_fR  fPar | real_fL real_fR"

$traceKickState = [EnvelopeState]::new()
$traceSubBassState = [EnvelopeState]::new()
$traceNow = 0.0

$maxTrace = [Math]::Min(80, $totalFrames)
for ($i = 0; $i -lt $maxTrace; $i++) {
    $f = $technoFrames[$i]
    $isK = $kickFrameIndices.Contains($i)
    $traceNow += 50.0
    $kickSig = if ($isK) { $f.bass } else { 0.0 }

    $simFR = Invoke-EnvelopeProcess -config $bestKickConfig -state $traceKickState `
        -signal $kickSig -morphFactor $f.morph -now $traceNow -isBreakdown $false

    $simFL = Invoke-EnvelopeProcess -config $bestSubBassConfig -state $traceSubBassState `
        -signal $f.sB -morphFactor $f.morph -now $traceNow -isBreakdown $false

    $simPar = [Math]::Max($simFL, $simFR)
    $kickMarker = if ($isK) { 'KICK' } else { '    ' }

    Write-Host ("  [{0,3}] {1} | {2} {3} {4} | {5} {6} {7} | {8} {9}" -f `
        $i, $kickMarker,
        $f.sB.ToString('F3'), $f.bass.ToString('F3'), $f.morph.ToString('F3'),
        $simFL.ToString('F3'), $simFR.ToString('F3'), $simPar.ToString('F3'),
        $f.fL_real.ToString('F3'), $f.fR_real.ToString('F3'))
}

Write-Host ""
Write-Host "================================================================"
Write-Host "  WAVE 2437 MONTE CARLO -- COMPLETE"
Write-Host "================================================================"
