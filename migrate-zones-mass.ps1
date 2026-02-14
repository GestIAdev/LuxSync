# ⚒️ WAVE 2040.26: OPERATION "NATIVE TONGUE" - Mass Zone Migration Script
# Migra TODOS los efectos de legacy zones a canonical zones

$rootPath = "c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\effects\library"

# Lista de archivos a procesar
$files = @(
    "chillLounge\AbyssalJellyfish.ts",
    "chillLounge\DeepCurrentPulse.ts",
    "chillLounge\SchoolOfFish.ts",
    "chillLounge\SolarCaustics.ts",
    "chillLounge\WhaleSong.ts",
    "fiestalatina\ClaveRhythm.ts",
    "fiestalatina\CorazonLatino.ts",
    "fiestalatina\CumbiaMoon.ts",
    "fiestalatina\GhostBreath.ts",
    "fiestalatina\MacheteSpark.ts",
    "fiestalatina\SalsaFire.ts",
    "poprock\AmpHeat.ts",
    "poprock\ArenaSweep.ts",
    "poprock\FeedbackStorm.ts",
    "poprock\LiquidSolo.ts",
    "poprock\PowerChord.ts",
    "poprock\SpotlightPulse.ts",
    "poprock\StageWash.ts",
    "poprock\ThunderStruck.ts",
    "techno\AbyssalRise.ts",
    "techno\DeepBreath.ts",
    "techno\DigitalRain.ts",
    "techno\FiberOptics.ts",
    "techno\VoidMist.ts"
)

$replacements = @(
    # movers_left → movers-left
    @{
        pattern = "'movers_left'"
        replacement = "'movers-left'"
    },
    # movers_right → movers-right  
    @{
        pattern = "'movers_right'"
        replacement = "'movers-right'"
    },
    # "movers_left" → "movers-left"
    @{
        pattern = '"movers_left"'
        replacement = '"movers-left"'
    },
    # "movers_right" → "movers-right"
    @{
        pattern = '"movers_right"'
        replacement = '"movers-right"'
    },
    # zones: ['movers'] → zones: ['all-movers']
    @{
        pattern = "zones: \['movers'\]"
        replacement = "zones: ['all-movers']"
    },
    # zones: ['front', 'pars', 'back', 'movers'] → zones: ['front', 'all-pars', 'back', 'all-movers']
    @{
        pattern = "zones: \['front', 'pars', 'back', 'movers'\]"
        replacement = "zones: ['front', 'all-pars', 'back', 'all-movers']"
    },
    # zones: [...PAR_ZONES, 'movers'] → zones: [...PAR_ZONES, 'all-movers']
    @{
        pattern = "zones: \[\.\.\.PAR_ZONES, 'movers'\]"
        replacement = "zones: [...PAR_ZONES, 'all-movers']"
    },
    # 'movers': { → 'all-movers': {
    @{
        pattern = "'movers': \{"
        replacement = "'all-movers': {"
    },
    # 'pars': { → 'all-pars': {
    @{
        pattern = "'pars': \{"
        replacement = "'all-pars': {"
    }
)

$totalFiles = 0
$totalReplacements = 0

foreach ($file in $files) {
    $fullPath = Join-Path $rootPath $file
    
    if (Test-Path $fullPath) {
        Write-Host "Processing: $file" -ForegroundColor Cyan
        
        $content = Get-Content $fullPath -Raw -Encoding UTF8
        $originalContent = $content
        $fileReplacements = 0
        
        foreach ($repl in $replacements) {
            $before = $content
            $content = $content -replace $repl.pattern, $repl.replacement
            
            if ($before -ne $content) {
                $matches = ([regex]::Matches($before, $repl.pattern)).Count
                $fileReplacements += $matches
                Write-Host "  ✅ Replaced $matches occurrences of: $($repl.pattern)" -ForegroundColor Green
            }
        }
        
        if ($originalContent -ne $content) {
            Set-Content $fullPath $content -Encoding UTF8 -NoNewline
            $totalFiles++
            $totalReplacements += $fileReplacements
            Write-Host "  💾 Saved with $fileReplacements changes" -ForegroundColor Yellow
        } else {
            Write-Host "  ⏭️  No changes needed" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠️  File not found: $fullPath" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "✅ MIGRATION COMPLETE" -ForegroundColor Green
Write-Host "Files modified: $totalFiles" -ForegroundColor Cyan
Write-Host "Total replacements: $totalReplacements" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Magenta
