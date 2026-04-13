param()

$file = "electron-app/src/chronos/ui/timeline/TimelineCanvas.tsx"
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$originalLen = $content.Length

# ============================================================
# CAMBIO 1: Eliminar customZoneTracks state y imports viejos
# Reemplazar con suscripción reactiva al ChronosStoreV2
# ============================================================
$old1 = "  // `u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`n  // `u{1F3AF} WAVE 2545: INFINITE TRACKS `u{2014} Custom zone tracks added by user`n  // `u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`u{2550}`n  const [customZoneTracks, setCustomZoneTracks] = useState<CanonicalZone[]>([])`n  `n  // WAVE 2545: State for magnetic drag zone-incompatibility visual feedback"

$new1 = "  // `u{1F525} WAVE 2548: Subscribe al ChronosStoreV2 para re-render cuando cambian las tracks`n  const [storeVersion, setStoreVersion] = useState(0)`n  useEffect(() => {`n    const store = getChronosStoreV2()`n    const onTrackChange = () => setStoreVersion(v => v + 1)`n    store.on('track-added', onTrackChange)`n    store.on('track-removed', onTrackChange)`n    store.on('track-reordered', onTrackChange)`n    store.on('track-renamed', onTrackChange)`n    store.on('track-updated', onTrackChange)`n    store.on('project-loaded', onTrackChange)`n    store.on('project-new', onTrackChange)`n    return () => {`n      store.off('track-added', onTrackChange)`n      store.off('track-removed', onTrackChange)`n      store.off('track-reordered', onTrackChange)`n      store.off('track-renamed', onTrackChange)`n      store.off('track-updated', onTrackChange)`n      store.off('project-loaded', onTrackChange)`n      store.off('project-new', onTrackChange)`n    }`n  }, [])`n`n  // WAVE 2545: State for magnetic drag zone-incompatibility visual feedback"

if ($content.Contains($old1)) {
    $content = $content.Replace($old1, $new1)
    Write-Host "CAMBIO 1: OK"
} else {
    Write-Host "CAMBIO 1: FAIL (not found)"
}

# ============================================================
# CAMBIO 2: Reemplazar allTracks useMemo (fixtures-based) con V2 store
# ============================================================
$old2anchor = "const fixtures = useStageStore(state => state.fixtures)"
$old2end = "  }, [fixtures, customZoneTracks])"

$idxStart = $content.IndexOf($old2anchor)
$idxEnd = $content.IndexOf($old2end)

if ($idxStart -ge 0 -and $idxEnd -ge 0) {
    # Find start of the comment block before 'const fixtures'
    $blockStart = $content.LastIndexOf("`n  // `u{2550}`u{2550}`u{2550}", $idxStart)
    if ($blockStart -lt 0) { $blockStart = $idxStart - 2 }  # fallback to just before 'const fixtures'
    $blockEnd = $idxEnd + $old2end.Length

    $old2 = $content.Substring($blockStart, $blockEnd - $blockStart)
    $new2 = "`n`n  // `u{1F525} WAVE 2548: DUMB CANVAS `u{2014} puro .map() del store V2`n  // Sin getActiveZonesFromFixtures. Sin generateZoneTracks. Sin fixtures.`n  // El store ES la `u{FA}nica fuente de verdad para las tracks FX.`n  const allTracks = useMemo(() => {`n    const store = getChronosStoreV2()`n    const fxTracks = [...store.tracks]`n      .sort((a, b) => a.order - b.order)`n      .map(storeTrackToCanvasTrack)`n    return [...STRUCTURAL_TRACKS, ...fxTracks]`n  // eslint-disable-next-line react-hooks/exhaustive-deps`n  }, [storeVersion])  // storeVersion cambia cuando el store emite eventos de track"

    $content = $content.Substring(0, $blockStart) + $new2 + $content.Substring($blockEnd)
    Write-Host "CAMBIO 2: OK"
} else {
    Write-Host "CAMBIO 2: FAIL (idxStart=$idxStart idxEnd=$idxEnd)"
}

# ============================================================
# CAMBIO 3: Reemplazar footer condicional con footer simple
# ============================================================
$old3anchor = "      {CANONICAL_ZONES.filter(z => z !== 'unassigned').some(z =>"
$old3end = "        />`n      )}`n    </div>"

$idx3Start = $content.IndexOf($old3anchor)
if ($idx3Start -ge 0) {
    # Find the comment block before it
    $blockStart3 = $content.LastIndexOf("{/* `u{2550}", $idx3Start)
    if ($blockStart3 -lt 0) { $blockStart3 = $idx3Start }
    $idx3End = $content.IndexOf($old3end, $idx3Start)
    if ($idx3End -ge 0) {
        $blockEnd3 = $idx3End + $old3end.Length

        $new3 = "      {/* `u{1F525} WAVE 2548: Footer siempre visible `u{2014} cat`u{E1}logo infinito */}`n      <ZoneTrackFooter />`n    </div>"
        $content = $content.Substring(0, $blockStart3) + $new3 + $content.Substring($blockEnd3)
        Write-Host "CAMBIO 3: OK"
    } else { Write-Host "CAMBIO 3 FAIL: end not found" }
} else { Write-Host "CAMBIO 3 FAIL: anchor not found" }

[System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
Write-Host "ARCHIVO GUARDADO. Chars: $($content.Length) (original: $originalLen)"
