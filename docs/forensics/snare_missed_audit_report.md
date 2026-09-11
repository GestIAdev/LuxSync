# FORENSIC SNARE AUDIT — Análisis Frame-by-Frame de Missed Snares

> **Fecha:** 2026-09-11
> **Logs analizados:** 4 (minimalgravity, techhousemultitrigger, techhouseredoble, tiestomissed)
> **Script:** `snare_audit.py` (parser automático de FINESSE_AUDIT)
> **Total frames:** 2,538 | **Onsets detectados:** 145 | **Missed snares:** 484
> **Hit rate global:** 23.1%

---

## 1. Resumen Ejecutivo

El detector de snares está perdiendo **77% de los snares reales**. Dos causas concentran el 87.6% de todas las omisiones:

| Causa | Misses | % | Línea de defensa responsable |
|---|---|---|---|
| **MACD_FLOOR** | 294 | 60.7% | `snareDrive < snareFloor` (floor dinámico del MACD) |
| **REFRACTORY** | 130 | 26.9% | `_ghostRefractoryFrames` (7 frames post-onset) |
| BODY_FACTOR_LOW | 28 | 5.8% | `bFct < 0.15` (sin resonancia de parche) |
| NLMS_RESIDUAL_ZERO | 12 | 2.5% | NLMS canceló el snare como kick-bleed |
| DRIVE_COLLAPSE | 12 | 2.5% | Producto Res×cFx×bFct×sEF ≈ 0 |
| BYPASS_FAIL | 6 | 1.2% | Bypass rescue no calificó (Flux/RawΔ insuficiente) |
| HIHAT_EXCLUSION | 2 | 0.4% | `hE>0.5 && SnareE<0.2` |

**Conclusión preliminar:** El floor del MACD (`fFloor=0.070`) es demasiado estricto y el refractario de ghost (7 frames) es demasiado largo. Juntos matan el 87.6% de los snares.

---

## 2. Análisis por Log

### 2.1 minimalgravity.md — Hit rate: 34.2%

| Métrica | Valor |
|---|---|
| Frames | 738 |
| Onsets | 53 |
| Missed | 102 |
| Hit rate | 34.2% |

**Causas:**
| Causa | Count | % |
|---|---|---|
| MACD_FLOOR | 56 | 54.9% |
| REFRACTORY | 46 | 45.1% |

**Observaciones clave:**
- `gH = 1.000` en TODOS los frames — el gate del GodEarFFT está **vivo**
- `fFloor = 0.070` constante — **nunca se relaja** (gateHealth=1 → relaxation=0)
- `SnareE` alto (0.5-1.0) — el gate funciona, la energía crack-band está presente
- Los snares tienen `Drive` entre 0.007 y 0.039 — **muy por debajo del floor 0.070**

**Diagnóstico:** El gate está vivo (gH=1.0), lo que significa que `floorRelaxation = max(0, fBL-0.04) × 4.0 × (1-gH) = 0`. El floor se queda pegado en 0.070 sin importar la densidad. Los snares en este track tienen Drive legítimo (0.02-0.04) pero el floor los mata.

**Top 5 MACD_FLOOR kills:**
```
L  32  Drive=0.022  fFloor=0.070  UnG=0.525  Res=0.343  cFx=0.201
L  75  Drive=0.028  fFloor=0.070  UnG=0.552  Res=0.342  cFx=0.227
L  76  Drive=0.027  fFloor=0.070  UnG=0.552  Res=0.340  cFx=0.227
L  77  Drive=0.025  fFloor=0.070  UnG=0.601  Res=0.331  cFx=0.127
L  96  Drive=0.009  fFloor=0.070  UnG=0.484  Res=0.268  cFx=0.197
```

**Top 5 REFRACTORY kills:**
```
L 706  UnG=0.845  cFx=0.564  Res=0.652  Drive=0.220  gRefr=6  ← SNARE BRUTAL MATADO
L 162  UnG=0.839  cFx=0.495  Res=0.639  Drive=0.189  gRefr=6  [KICK]
L 381  UnG=0.826  cFx=0.455  Res=0.486  Drive=0.133  gRefr=6  [KICK]
L 803  UnG=0.815  cFx=0.354  Res=0.596  Drive=0.212  gRefr=6
L 718  UnG=0.811  cFx=0.253  Res=0.606  Drive=0.139  gRefr=5
```

Frame 706 es el caso más egregious: **Drive=0.220, UnG=0.845, Res=0.652, cFx=0.564** — un snare inequívoco matado por gRefr=6.

---

### 2.2 techhousemultitrigger.md — Hit rate: 51.5%

| Métrica | Valor |
|---|---|
| Frames | 423 |
| Onsets | 34 |
| Missed | 32 |
| Hit rate | 51.5% |

**Causas:**
| Causa | Count | % |
|---|---|---|
| MACD_FLOOR | 22 | 68.8% |
| REFRACTORY | 10 | 31.2% |

**Observaciones:**
- Mejor hit rate de los 4 logs (51.5%)
- `gH = 1.000` — gate vivo
- `fFloor = 0.070` constante — sin relajación
- `k` (NLMS) extremadamente alto (0.9-1.0) — el coeficiente de bleed está saturado
- `SnareE` moderado (0.1-0.8) — gate parcialmente vivo

**Diagnóstico:** El NLMS `k` llega a 1.0+ (BLEED_K_MAX=3.0), lo que significa que está cancelando mucha energía crack como kick-bleed. Aún así, el floor 0.070 sigue siendo el asesino principal.

---

### 2.3 techhouseredoble.md — Hit rate: 14.7%

| Métrica | Valor |
|---|---|
| Frames | 700 |
| Onsets | 30 |
| Missed | 174 |
| Hit rate | 14.7% |

**Causas:**
| Causa | Count | % |
|---|---|---|
| MACD_FLOOR | 117 | 67.2% |
| REFRACTORY | 37 | 21.3% |
| DRIVE_COLLAPSE | 8 | 4.6% |
| BODY_FACTOR_LOW | 6 | 3.4% |
| NLMS_RESIDUAL_ZERO | 6 | 3.4% |

**Observaciones críticas:**
- `SnareE` colapsado (0.001-0.038) — el gate del GodEarFFT está **muerto**
- `gH = 1.000` — pero el gate está ciego (SnareE ≈ 0)
- `fFloor` rango: 0.041 — 0.070 — **algo de relajación** activa
- `UnG` alto (0.5-1.0) — la energía raw está presente, el gate la filtra
- `k` alto (0.8-1.0) — NLMS cancelando agresivamente

**Diagnóstico:** Este es el log más revelador. `SnareE ≈ 0.001` significa que el GodEarFFT gate está completamente cerrado, pero `gH = 1.0` porque la EMA de SnareE se mantiene alta de frames anteriores. El `fFloor` se relaja parcialmente (hasta 0.041) pero no lo suficiente.

**Top 5 worst misses (UnG=1.000 sin onset):**
```
L  23  SnareE=0.243  Res=0.351  cFx=0.200  Drive=0.040  Veto=0.840  [KICK]  ← MACD_FLOOR
L  98  SnareE=0.007  Res=0.524  cFx=0.287  Drive=0.036  Veto=0.859          ← REFRACTORY gRefr=6
L 261  SnareE=0.038  Res=0.407  cFx=0.239  Drive=0.119  Veto=0.684  [KICK]  ← REFRACTORY gRefr=6
L 264  SnareE=0.032  Res=0.457  cFx=0.163  Drive=0.006  Veto=0.747          ← REFRACTORY gRefr=3
L 268  SnareE=0.025  Res=0.420  cFx=0.205  Drive=0.020  Veto=0.916  [KICK]  ← MACD_FLOOR
```

Frame 261: **Drive=0.119, UnG=1.000, Res=0.407, cFx=0.239, Veto=0.684** — un snare perfecto matado por gRefr=6.

---

### 2.4 tiestomissed.md — Hit rate: 13.7%

| Métrica | Valor |
|---|---|
| Frames | 677 |
| Onsets | 28 |
| Missed | 176 |
| Hit rate | 13.7% |

**Causas:**
| Causa | Count | % |
|---|---|---|
| MACD_FLOOR | 99 | 56.2% |
| REFRACTORY | 37 | 21.0% |
| BODY_FACTOR_LOW | 22 | 12.5% |
| NLMS_RESIDUAL_ZERO | 6 | 3.4% |
| BYPASS_FAIL | 6 | 3.4% |
| DRIVE_COLLAPSE | 4 | 2.3% |
| HIHAT_EXCLUSION | 2 | 1.1% |

**Observaciones críticas:**
- `SnareE = 0.000` en la mayoría de frames — gate completamente muerto
- `gH` decayendo de 1.000 → 0.5 a lo largo del log — el gate health colapsa
- `fFloor` rango: 0.008 — 0.070 — **relajación amplia** (gH baja → floor baja)
- `BODY_FACTOR_LOW` = 22 misses (12.5%) — snares sintéticos sin resonancia de parche
- `BYPASS_FAIL` = 6 misses — Flux o RawΔ insuficientes para el bypass rescue

**Diagnóstico:** Tiesto usa snares 100% sintéticos. `SnareE = 0` (el gate del GodEarFFT no los ve), `bFct = 0.100` (sin resonancia de parche), `WNS = 0` (sin ruido broadband). El drive colapsa porque `Drive = Res × cFx × bFct × sEF` y `bFct = 0.1` aplasta el producto. El `fFloor` se relaja correctamente (hasta 0.008) pero el drive sigue siendo demasiado bajo.

**Top 5 worst misses (UnG=1.000 sin onset):**
```
L   8  SnareE=0.002  Res=0.494  cFx=0.204  Drive=0.028  Veto=0.430          ← MACD_FLOOR
L   9  SnareE=0.002  Res=0.502  cFx=0.204  Drive=0.029  Veto=0.433          ← MACD_FLOOR
L 145  SnareE=0.000  Res=0.671  cFx=0.143  Drive=0.028  Veto=0.162  [KICK]  ← REFRACTORY gRefr=5
L 190  SnareE=0.000  Res=0.483  cFx=0.169  Drive=0.004  Veto=0.177          ← MACD_FLOOR
L 199  SnareE=0.000  Res=0.606  cFx=0.160  Drive=0.036  Veto=0.814          ← HIHAT_EXCLUSION
```

Frame 199: **UnG=1.000, Res=0.606, cFx=0.160, Drive=0.036, Veto=0.814** — snare inequívoco matado por `HIHAT_EXCLUSION` porque `hE=0.912 > 0.5 && SnareE=0.000 < 0.2`.

---

## 3. Análisis por Punto de Extracción

### 3.1 Asfixia por MACD (Snare Rolls) — 294 misses (60.7%)

**Mecanismo:** `snareDrive < snareFloor` → el crossover del MACD nunca se evalúa porque el drive no pasa el floor.

**Datos:**

| Log | Misses | Drive típico | fFloor | dynTh | gH |
|---|---|---|---|---|---|
| minimalgravity | 56 | 0.009-0.039 | 0.070 (constante) | 0.018-0.030 | 1.000 |
| techhousemulti | 22 | 0.009-0.026 | 0.070 (constante) | 0.012-0.015 | 1.000 |
| techhouseredoble | 117 | 0.001-0.058 | 0.041-0.070 | 0.013-0.018 | 1.000 |
| tiestomissed | 99 | 0.001-0.069 | 0.008-0.070 | 0.020-0.037 | 0.5-1.0 |

**Patrón:** El drive de los snares reales en estos tracks ronda 0.01-0.06. El floor está en 0.070 (o relajado hasta 0.04-0.06 en tracks densos). El drive **nunca llega al floor**.

**Causa raíz:** El producto `Drive = Res × cFx × bFct × sEF` es estructuralmente bajo porque:
1. `Res` (residual NLMS) ronda 0.3-0.5 — el NLMS cancela parte del snare como kick-bleed
2. `cFx` (crack flux) ronda 0.1-0.3 — el crack-band flux es moderado
3. `bFct` (body factor) ronda 0.1-1.0 — los snares sintéticos tienen bFct=0.1
4. `sEF` (smart energy factor) ronda 0.3-1.0 — cuando SnareE=0, sEF colapsa

El producto de 4 valores entre 0 y 1 produce resultados en el rango 0.001-0.06, que es **estructuralmente incompatible** con un floor de 0.070.

**Ejemplo extremo (tiestomissed L8):**
```
Res=0.494 × cFx=0.204 × bFct=0.100(min) × sEF=0.800 = 0.008
fFloor = 0.070
→ Drive 0.008 << fFloor 0.070 → KILL
```

**El floor de 0.070 es matemáticamente inalcanzable** cuando bFct=0.1 (snares sintéticos) o cuando Res es moderado (NLMS cancelando).

---

### 3.2 Bloqueos por Refractario — 130 misses (26.9%)

**Mecanismo:** `_ghostRefractoryFrames > 0` → `trebleGhost = 0` y el frame no puede disparar via ghost path.

**Distribución por gRefr:**

| gRefr | Count | % |
|---|---|---|
| 1 | 13 | 10.0% |
| 2 | 26 | 20.0% |
| 3 | 15 | 11.5% |
| 4 | 12 | 9.2% |
| 5 | 17 | 13.1% |
| 6 | 34 | 26.2% |
| 7 | 13 | 10.0% |

**Total refractario = 7 frames (~159ms @ 44Hz)**

**Patrón:** El 36.2% de los kills refractarios ocurren en gRefr=5-6, que son frames 5-6 después del onset anterior. A 128 BPM (1 beat = 469ms = ~20 frames), 7 frames = 159ms = 34% del beat. En redobles de 16th notes (1/16 = 117ms = ~5 frames), **el refractario de 7 frames cubre más de un 16th note completo**.

**Top 5 refractary kills (peores snares matados):**

| Log | Frame | UnG | Res | cFx | Drive | gRefr | Kick? |
|---|---|---|---|---|---|---|---|
| minimalgravity | 706 | 0.845 | 0.652 | 0.564 | 0.220 | 6 | No |
| minimalgravity | 162 | 0.839 | 0.639 | 0.495 | 0.189 | 6 | Sí |
| techhouseredoble | 261 | 1.000 | 0.407 | 0.239 | 0.119 | 6 | Sí |
| minimalgravity | 381 | 0.826 | 0.486 | 0.455 | 0.133 | 6 | Sí |
| techhouseredoble | 98 | 1.000 | 0.524 | 0.287 | 0.036 | 6 | No |

Frame 706 (minimalgravity): **Drive=0.220, UnG=0.845** — el snare más fuerte de todo el dataset, matado por gRefr=6. Este snare tendría que haber disparado sin duda.

**Diagnóstico:** El refractario de 7 frames fue diseñado para matar re-fires de reverb tails (hhDlt elevado 6-8 frames post-snare). Pero está matando snares reales en redobles y colisiones kick+snare. El refractario debería ser **adaptativo**: más corto cuando el Drive es alto (snare real) y más largo cuando el Drive es bajo (reverb tail).

---

### 3.3 Enmascaramiento de Bombo (Beat 1 / EDM) — 98 misses con [KICK]

**Mecanismo:** El kick infla `BassE`, lo que:
1. Infla el NLMS `k` → cancela más crack como bleed → `Res` baja
2. El Tonality Veto se diluye (WNS=0, Flux bajo en frames de kick puro)
3. El Centroid Shield puede matar si `centroid < floor && harshness < 0.024`

**Distribución por causa en frames con [KICK]:**

| Causa | Count | % |
|---|---|---|
| MACD_FLOOR | 58 | 59.2% |
| REFRACTORY | 22 | 22.4% |
| NLMS_RESIDUAL_ZERO | 12 | 12.2% |
| BODY_FACTOR_LOW | 4 | 4.1% |
| HIHAT_EXCLUSION | 2 | 2.0% |

**Top 5 kick-masked kills:**

| Log | Frame | Causa | BassE | Veto | WNS | cFx | Drive | UnG |
|---|---|---|---|---|---|---|---|---|
| techhouseredoble | 23 | MACD_FLOOR | 0.658 | 0.840 | 0.729 | 0.200 | 0.040 | 1.000 |
| techhouseredoble | 22 | MACD_FLOOR | 0.560 | 0.667 | 0.000 | 0.188 | 0.040 | 0.991 |
| tiestomissed | 145 | REFRACTORY | 0.650 | 0.162 | 0.000 | 0.143 | 0.028 | 1.000 |
| techhouseredoble | 261 | REFRACTORY | 0.798 | 0.130 | 0.000 | 0.239 | 0.119 | 1.000 |
| techhouseredoble | 345 | REFRACTORY | 0.799 | 0.818 | 0.000 | 0.214 | 0.028 | 1.000 |

**Diagnóstico del NLMS:** En frames con `BassE > 0.8`, el NLMS cancela el snare como kick-bleed:
```
tiestomissed L12: BassE=0.822, k=0.719, Res=0.000 → Drive=0.000 → KILL
tiestomissed L36: BassE=0.876, k=0.649, Res=0.000 → Drive=0.000 → KILL
tiestomissed L37: BassE=0.851, k=0.647, Res=0.000 → Drive=0.000 → KILL
```

El NLMS aprende que `crack ≈ k × bassE` y cuando `bassE` es masivo (kick en beat 1), el residual se anula. **El snare coexiste con el kick en techno 4/4, pero el NLMS asume que la energía crack del snare es bleed del kick.**

**Centroid Shield:** No se observaron kills directos por Centroid Shield en estos logs. El shield requiere `isKick && centroid < floor && harshness < 0.024`, y la mayoría de los frames tienen `harshness` implícito alto (no se loguea pero el veto pasa). El Centroid Shield no es el problema principal.

**Tonality Veto:** Tampoco es el asesino principal. En los frames con [KICK], el veto promedio es 0.3-0.8 (pasa). El veto mata en casos raros donde WNS=0 y Flux bajo, pero la mayoría de los kills son por MACD_FLOOR o REFRACTORY, no por veto.

---

### 3.4 Filtrado de Hi-Hats (Minimal) — 2 misses (0.4%)

Solo 2 casos de `HIHAT_EXCLUSION` en todo el dataset, ambos en tiestomissed:

| Frame | hE | SnareE | UnG | Res | cFx | Drive | Veto |
|---|---|---|---|---|---|---|---|
| 199 | 0.912 | 0.000 | 1.000 | 0.606 | 0.160 | 0.036 | 0.814 |
| 290 | 1.000 | 0.000 | 1.000 | 0.663 | 0.222 | 0.034 | 0.813 |

**Diagnóstico:** La condición `hE > 0.5 && SnareE < 0.2` del bypass rescue está matando snares sintéticos de Tiesto donde el gate está muerto (SnareE=0) pero hay energía real (UnG=1.000, Res=0.6, Veto=0.8). La lógica asume que si `hE > 0.5` y `SnareE < 0.2` es un hi-hat, pero en Tiesto es un snare sintético con gate muerto.

**fFloor en Minimal (techhouseredoble):**
- Rango: 0.041 — 0.070
- Strict (≥0.065): 159 misses (91.4%)
- Relaxed (<0.065): 15 misses (8.6%)

El floor se mantiene estricto en la mayoría de los frames porque `gH = 1.000` (gate vivo). La relajación solo se activa cuando `gH < 1`, pero en este log `gH` nunca baja. **El floor no se está relajando cuando debería.**

---

## 4. Hallazgos por Track

### minimalgravity (Techno con gate vivo)
- **gH = 1.000** constante → floor NUNCA se relaja
- SnareE alto (0.5-1.0) → el gate funciona
- Drive legítimo (0.02-0.04) pero floor = 0.070 → **todos mueren**
- Refractario mata 46 snares reales con Drive 0.04-0.22

### techhousemultitrigger (Tech House con gate vivo)
- gH = 1.000 → floor estricto
- NLMS k saturado (0.9-1.0) → cancela demasiado crack
- Solo 32 misses (mejor hit rate)

### techhouseredoble (Tech House con gate ciego)
- SnareE ≈ 0.001-0.038 → gate ciego pero gH=1.0 (EMA stuck)
- UnG = 0.5-1.0 → energía real presente
- fFloor se relaja algo (hasta 0.041) pero no suficiente
- 174 misses (peor hit rate junto con Tiesto)

### tiestomissed (EDM con gate muerto)
- SnareE = 0.000 → gate completamente muerto
- gH decae de 1.0 → 0.5 a lo largo del log
- fFloor se relaja bien (hasta 0.008) pero Drive sigue bajo
- bFct = 0.100 en 22 misses → snares sintéticos sin body
- BYPASS_FAIL en 6 casos → Flux o RawΔ no califican

---

## 5. Patrones Estructurales Identificados

### 5.1 El floor 0.070 es matemáticamente inalcanzable

El drive es un producto de 4 factores [0,1]:
```
Drive = Res × cFx × bFct × sEF
```

| Escenario | Res | cFx | bFct | sEF | Drive | ¿Pasa 0.070? |
|---|---|---|---|---|---|---|
| Snare acústico ideal | 0.5 | 0.3 | 1.5 | 1.0 | 0.225 | Sí |
| Snare acústico típico | 0.3 | 0.2 | 1.0 | 1.0 | 0.060 | **No** |
| Snare con kick | 0.2 | 0.15 | 0.5 | 0.8 | 0.012 | No |
| Snare sintético | 0.4 | 0.2 | 0.1 | 0.8 | 0.006 | No |
| Snare gate muerto | 0.3 | 0.15 | 0.1 | 0.3 | 0.001 | No |

**Solo los snares acústicos ideales pasan el floor.** Los snares típicos (Res~0.3, cFx~0.2, bFct~1.0, sEF~1.0) producen Drive~0.06, que está por debajo de 0.070.

### 5.2 El refractario de 7 frames mata redobles

A 128 BPM:
- 1/16 note = 117ms = ~5 frames
- 1/8 note = 234ms = ~10 frames
- Refractario = 7 frames = 159ms

El refractario cubre **1.4 sixteenth notes**. En un redoblé de 16ths, el snare en la 2da corchea llega en frame 5, pero el refractario dura hasta frame 7 → **matado**.

### 5.3 El NLMS cancela snares en colisiones kick+snare

Cuando `BassE > 0.8` (kick masivo en beat 1), el NLMS aprende `k ≈ crack/bassE` y cancela el residual:
```
crack = 0.5, bassE = 0.85, k = 0.65
Res = max(0, 0.5 - 0.65 × 0.85) = max(0, 0.5 - 0.55) = 0
```

El snare coexiste con el kick, pero el NLMS asume que toda la energía crack es bleed del kick.

### 5.4 gH stuck en 1.0 cuando el gate está ciego

En techhouseredoble, `SnareE ≈ 0.001` (gate ciego) pero `gH = 1.000` (EMA stuck alta de frames anteriores). Esto desactiva la relajación del floor (`floorRelaxation × (1-gH) = 0`). **El gate health EMA es demasiado lenta (τ~2.3s) para detectar gate blindness transitoria.**

### 5.5 bFct=0.1 aplasta snares sintéticos

En Tiesto, los snares son 100% sintéticos: no hay resonancia de parche (bFct=0.1). El body factor está clampado a mínimo 0.1, pero multiplicar por 0.1 aplasta el drive:
```
Drive = 0.5 × 0.2 × 0.1 × 0.8 = 0.008
```

El `bFct` fue diseñado para penalizar claps/rimshots (body ≈ EMA → bFct ≈ 0.5), pero los snares sintéticos de EDM reciben la misma penalización que un clap.

---

## 6. Resumen de Causas por Línea de Defensa

| Línea de defensa | Misses | % | Severidad |
|---|---|---|---|
| **MACD Floor (snareMomentumFloor=0.070)** | 294 | 60.7% | CRÍTICA — floor inalcanzable |
| **Ghost Refractory (7 frames)** | 130 | 26.9% | ALTA — mata redobles |
| **Body Factor (bFct min=0.1)** | 28 | 5.8% | MEDIA — aplasta sintéticos |
| **NLMS Residual (k aprendido)** | 12 | 2.5% | MEDIA — cancela en kicks |
| **Drive Collapse (producto≈0)** | 12 | 2.5% | BAJA — síntoma, no causa |
| **Bypass Rescue (Flux/RawΔ)** | 6 | 1.2% | BAJA — umbrales demasiado estrictos |
| **Hi-hat Exclusion (hE>0.5)** | 2 | 0.4% | BAJA — falsos positivos raros |

---

## 7. Datos Crudos para Recalibración

### Drive vs Floor en los 4 logs

| Log | Drive mediano | Drive p90 | fFloor | Gap |
|---|---|---|---|---|
| minimalgravity | 0.020 | 0.039 | 0.070 | -0.031 |
| techhousemulti | 0.015 | 0.026 | 0.070 | -0.044 |
| techhouseredoble | 0.015 | 0.058 | 0.041-0.070 | -0.012 a -0.055 |
| tiestomissed | 0.012 | 0.069 | 0.008-0.070 | +0.001 a -0.058 |

**Solo tiestomissed en su punto más relajado (fFloor=0.008) tiene un gap positivo.** En todos los demás casos, el drive está por debajo del floor.

### Refractario vs tempo

| Track | BPM | 1/16 (frames) | Refractario (frames) | ¿Mata 16ths? |
|---|---|---|---|---|
| minimalgravity | ~123 | ~5.4 | 7 | **Sí** |
| techhousemulti | ~128 | ~5.2 | 7 | **Sí** |
| techhouseredoble | ~128 | ~5.2 | 7 | **Sí** |
| tiestomissed | ~119 | ~5.6 | 7 | **Sí** |

**El refractario de 7 frames mata 16th notes en todos los tempos del dataset.**

---

*Generado por `snare_audit.py` — 2026-09-11*
