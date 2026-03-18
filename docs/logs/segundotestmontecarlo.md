  🎲 MONTE CARLO LAB - FIESTA LATINA VALIDATION                     ║
║  WAVE 1005.6 - THE LATINO LADDER                                   ║
╚════════════════════════════════════════════════════════════════════╝

🎯 MODULE A: ZONE SWEEPER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Running 10000 iterations across energy 0.00 → 1.00


⚔️ MODULE B: SHADOWBAN TORTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Simulating 20 consecutive frames at Energy=0.7
Expecting diversity mechanism to kick in after 2-3 repetitions



══════════════════════════════════════════════════════════════════════
🎲 MONTE CARLO REPORT - FIESTA LATINA (N=10,000)
══════════════════════════════════════════════════════════════════════

## 1. ZONE DISTRIBUTION ACCURACY

[🌿 SILENCE  0.00-0.15] ✅ GREAT
   Expected: amazon_mist, ghost_breath
   Actual:   amazon_mist: 60.5%, ghost_breath: 39.5%
   Hit Rate: 100.0% (n=1451)

[🌙 VALLEY   0.15-0.30] ✅ GREAT
   Expected: cumbia_moon, tidal_wave
   Actual:   tidal_wave: 64.1%, ghost_breath: 29.0% ⚠️, cumbia_moon: 6.9%
   Hit Rate: 71.0% (n=1488)
   Foreign:  ghost_breath (cross-zone diversity)

[💫 AMBIENT  0.30-0.45] ✅ GREAT
   Expected: corazon_latino, strobe_burst
   Actual:   corazon_latino: 48.4%, strobe_burst: 31.0%, tidal_wave: 13.9% ⚠️, clave_rhythm: 6.6% ⚠️
   Hit Rate: 79.4% (n=1551)
   Foreign:  tidal_wave, clave_rhythm (cross-zone diversity)

[🎵 GENTLE   0.45-0.60] ✅ GREAT
   Expected: clave_rhythm, tropical_pulse
   Actual:   clave_rhythm: 60.6%, tropical_pulse: 39.4%
   Hit Rate: 100.0% (n=1510)

[⚡ ACTIVE   0.60-0.75] ✅ PASS
   Expected: glitch_guaguanco, machete_spark
   Actual:   machete_spark: 55.5%, tropical_pulse: 22.8% ⚠️, salsa_fire: 21.7% ⚠️
   Hit Rate: 55.5% (n=1484)
   Foreign:  salsa_fire, tropical_pulse (cross-zone diversity)

[🔥 INTENSE  0.75-0.90] ✅ GREAT
   Expected: salsa_fire, solar_flare
   Actual:   salsa_fire: 100.0%
   Hit Rate: 100.0% (n=1484)

[☢️ PEAK     0.90-1.00] ✅ GREAT
   Expected: latina_meltdown, strobe_storm
   Actual:   strobe_storm: 98.5%, salsa_fire: 1.5% ⚠️
   Hit Rate: 98.5% (n=1032)
   Foreign:  salsa_fire (cross-zone diversity)


## 2. SHADOWBAN MECHANISM (Diversity Test)

Iteration  1: machete_spark      (Score: 0.930)
Iteration  2: salsa_fire         (Score: 0.915)  🔄 SWAP
Iteration  3: tropical_pulse     (Score: 0.862)  🔄 SWAP
Iteration  4: glitch_guaguanco   (Score: 0.862)  🔄 SWAP
Iteration  5: solar_flare        (Score: 0.822)  🔄 SWAP
Iteration  6: clave_rhythm       (Score: 0.810)  🔄 SWAP
Iteration  7: strobe_burst       (Score: 0.768)  🔄 SWAP
Iteration  8: strobe_storm       (Score: 0.752)  🔄 SWAP
Iteration  9: latina_meltdown    (Score: 0.718)  🔄 SWAP
Iteration 10: corazon_latino     (Score: 0.689)  🔄 SWAP
Iteration 11: machete_spark      (Score: 0.651) 🔻 PENALIZED 🔄 SWAP
Iteration 12: salsa_fire         (Score: 0.640) 🔻 PENALIZED 🔄 SWAP
Iteration 13: tidal_wave         (Score: 0.634)  🔄 SWAP
Iteration 14: tropical_pulse     (Score: 0.603) 🔻 PENALIZED 🔄 SWAP
Iteration 15: glitch_guaguanco   (Score: 0.603) 🔻 PENALIZED 🔄 SWAP
Iteration 16: solar_flare        (Score: 0.575) 🔻 PENALIZED 🔄 SWAP
Iteration 17: clave_rhythm       (Score: 0.567) 🔻 PENALIZED 🔄 SWAP
Iteration 18: strobe_burst       (Score: 0.537) 🔻 PENALIZED 🔄 SWAP
Iteration 19: strobe_storm       (Score: 0.526) 🔻 PENALIZED 🔄 SWAP
Iteration 20: cumbia_moon        (Score: 0.526)  🔄 SWAP

Max Consecutive Same Effect: 1
Total Swaps Detected: 19
Shadowban Status: ✅ WORKING


══════════════════════════════════════════════════════════════════════
🎺 RESULTADO FINAL: ✅ PASS
   THE LATINO LADDER está correctamente calibrada.
   El Shadowban funciona correctamente.
══════════════════════════════════════════════════════════════════════

## DNA REFERENCE TABLE

| Effect           | Aggression | Zone     |
|------------------|------------|----------|
| amazon_mist      |       0.05 | SILENCE  |
| ghost_breath     |       0.13 | SILENCE  |
| cumbia_moon      |       0.18 | VALLEY   |
| tidal_wave       |       0.27 | VALLEY   |
| corazon_latino   |       0.37 | AMBIENT  |
| strobe_burst     |       0.43 | AMBIENT  |
| clave_rhythm     |       0.48 | GENTLE   |
| tropical_pulse   |       0.58 | GENTLE   |
| glitch_guaguanco |       0.63 | ACTIVE   |
| machete_spark    |       0.69 | ACTIVE   |
| salsa_fire       |       0.80 | INTENSE  |
| solar_flare      |       0.86 | INTENSE  |
| latina_meltdown  |       0.99 | PEAK     |
| strobe_storm     |       0.95 | PEAK     |