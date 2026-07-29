$data = @()
foreach ($line in Get-Content 'gravity_brejcha_kicksnare.jsonl') {
    if ($line.Trim()) {
        $data += ($line | ConvertFrom-Json)
    }
}
Write-Host "Total frames: $($data.Count)"
Write-Host ""
Write-Host "=== LIQUID COGNITION STATS ==="
$props = @('impact','s_B','s_E','s_Z','crestFactor','tension','temperature','epicness','intensity','confidence')
foreach ($p in $props) {
    $vals = $data | ForEach-Object { $_.$p }
    $min = ($vals | Measure-Object -Minimum).Minimum
    $max = ($vals | Measure-Object -Maximum).Maximum
    $avg = ($vals | Measure-Object -Average).Average
    Write-Host ("{0,-15} min={1:N4} max={2:N4} avg={3:N4}" -f $p, $min, $max, $avg)
}
Write-Host ""
Write-Host "=== IMPACT DISTRIBUTION (frames with impact > 0.5) ==="
$highImpact = $data | Where-Object { $_.impact -gt 0.5 }
Write-Host "Frames with impact > 0.5: $($highImpact.Count) / $($data.Count)"
Write-Host ""
Write-Host "=== SAMPLE FRAMES (every 100th) ==="
for ($i = 0; $i -lt $data.Count; $i += 100) {
    $f = $data[$i]
    Write-Host ("frame={0,4} impact={1:N3} s_B={2:N3} s_E={3:N3} s_Z={4:N3} tension={5:N3} temp={6:N4}" -f $i, $f.impact, $f.s_B, $f.s_E, $f.s_Z, $f.tension, $f.temperature)
}
