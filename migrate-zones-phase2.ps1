# ⚒️ WAVE 2040.26: OPERATION "NATIVE TONGUE" - Phase 2
# Migra los casos que quedaron: arrays, constantes, keys de override

$rootPath = "c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\effects\library"

$files = @(
    "techno\BinaryGlitch.ts",
    "techno\AmbientStrobe.ts",
    "techno\AcidSweep.ts",
    "techno\AbyssalRise.ts",
    "poprock\ThunderStruck.ts",
    "poprock\AmpHeat.ts",
    "fiestalatina\TidalWave.ts",
    "fiestalatina\StrobeBurst.ts",
    "fiestalatina\MacheteSpark.ts",
    "fiestalatina\LatinaMeltdown.ts",
    "fiestalatina\GlitchGuaguanco.ts",
    "fiestalatina\GhostBreath.ts",
    "fiestalatina\AmazonMist.ts",
    "techno\DeepBreath.ts",
    "techno\FiberOptics.ts",
    "techno\DigitalRain.ts",
    "techno\SonarPing.ts",
    "techno\VoidMist.ts"
)

$replacements = @(
    # Arrays con 'pars', 'movers'
    @{
        pattern = "\['front', 'pars', 'back', 'movers'\]"
        replacement = "['front', 'all-pars', 'back', 'all-movers']"
    },
    @{
        pattern = "\['front', 'back', 'movers'\]"
        replacement = "['front', 'back', 'all-movers']"
    },
    @{
        pattern = "\['back', 'movers'\]"
        replacement = "['back', 'all-movers']"
    },
    @{
        pattern = "\['front', 'pars', 'back'\]"
        replacement = "['front', 'all-pars', 'back']"
    },
    @{
        pattern = "\['back', 'pars', 'front'\]"
        replacement = "['back', 'all-pars', 'front']"
    },
    # Keys de zoneOverrides
    @{
        pattern = "zoneOverrides\!\['movers'\]"
        replacement = "zoneOverrides!['all-movers']"
    },
    @{
        pattern = "zoneOverrides\['movers'\]"
        replacement = "zoneOverrides['all-movers']"
    },
    # Strings sueltos en líneas específicas
    @{
        pattern = " 'movers':"
        replacement = " 'all-movers':"
    },
    @{
        pattern = " 'pars':"
        replacement = " 'all-pars':"
    },
    # Casos en get()
    @{
        pattern = "\.get\('movers'\)"
        replacement = ".get('all-movers')"
    },
    @{
        pattern = "\.get\('pars'\)"
        replacement = ".get('all-pars')"
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
                $count = ([regex]::Matches($before, $repl.pattern)).Count
                $fileReplacements += $count
                Write-Host "  ✅ Replaced $count occurrences of: $($repl.pattern)" -ForegroundColor Green
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
Write-Host "✅ PHASE 2 COMPLETE" -ForegroundColor Green
Write-Host "Files modified: $totalFiles" -ForegroundColor Cyan
Write-Host "Total replacements: $totalReplacements" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Magenta
