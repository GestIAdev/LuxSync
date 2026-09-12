# Monte Carlo — Coeficientes de Snare para la Vibe Club

**Corpus:** 12 logs · 12.704 frames (289 s) · 770 onsets registrados · 375 impactos etiquetados
**Simulaciones:** 11.500 (búsqueda) + 8.000 (validación cruzada y barridos)
**Método:** replay offline del pipeline real + búsqueda estocástica + protocolo split-half

---

## 1. Validación del simulador

Antes de optimizar nada hay que demostrar que el replay offline reproduce el motor.
Se re-implementó la cadena completa de `LiquidEngineBase.ts` (líneas 960–1500 onset,
1719–1795 veto) y se reprodujo sobre la telemetría con los parámetros de captura:

| Métrica | Resultado |
|---|---|
| Reconstrucción del ghost path (R²) | 0.999 – 1.000 |
| Reconstrucción del Drive (R²) | 0.927 – 1.000 |
| Error del floor dinámico (MAE) | 0.0002 |
| Onsets: precisión / recall / F1 | 0.994 / 0.996 / **0.995** |

767 de 770 onsets reproducidos. El simulador es fiable.

**Invariantes** (se toman del log, no dependen de los coeficientes): `Res`, `cFx`, `sEF`,
`WNS`, `Flux`, `hhDlt`, `sd`, `gH`, `rGate`, `fBL`, `UnG`, `SnareE`, `hE`, `RawΔ`, `dynTh`.
**Recalculado**: clamp de bodyFactor, crackDrive, trebleGhost, MACD, floor EMA, refractarios,
bypass, density path y veto.

---

## 2. Verdad de campo no circular

El detector bajo prueba es la cadena `Res × cFx × bFct × sEF`. Etiquetar con esas mismas
variables sería circular. Se usaron dos señales del worker FFT, ajenas a esa cadena:

- **Gate alivo** (`gH > 0.30`): flancos de subida de `SnareE` — la puerta AND del GodEarFFT
  (`body > 2.0×EMA` **y** `crack > 1.8×EMA`), calculada en otro módulo.
- **Gate muerto**: picos de `hhDlt` (transitorio crudo 5–15 kHz) con `UnG > 0.45`.

**Validación de las etiquetas contra la rejilla métrica:** entre **0.70 y 1.00** de los
impactos etiquetados caen sobre una posición de semicorchea (fase ajustada por barrido,
sin depender del contador PLL). Son eventos musicales, no ruido.

---

## 3. Hallazgo arquitectónico: el Tonality Veto no bloquea onsets

`LiquidEngineBase.ts:1771-1776`

```
vetoFactor  = (flatnessGate + wnsGate + fluxGate) / 3
hybridSnare *= (vetoFactor > 0.15 ? 1.0 : vetoFactor / 0.15)
```

El veto multiplica la **amplitud de salida**; no participa en la decisión de onset.
Los barridos lo confirman empíricamente: al mover `wns_floor`, `wns_knee`, `flux_floor` y
`flux_knee` por todo su rango, el número de onsets, los onsets sin evidencia y el density
path se quedan **exactamente** en 772 / 90 / 51.

**Consecuencia directa:** subir `snareVetoWnsFloor` de 0.04 a 0.10 (WAVE 7774) no cerró el
paso a ninguna voz — solo atenuó brillo. Y la atenuación real medida sobre la basura es
apenas **0.804** (80% de brillo). El veto no estaba defendiendo nada.

---

## 4. Atribución por vía: de dónde sale realmente la basura

| Vía | Onsets | Evidencia media | Sin evidencia | % del total |
|---|---|---|---|---|
| MACD | 591 | 0.71 | 50 (8% de la vía) | 6% |
| BYPASS rescue | 130 | 0.66 | **1 (1% de la vía)** | 0% |
| DENSITY rescue | 51 | 0.30 | 39 (76% de la vía) | 5% |

Total: **90 de 772 onsets (12%) sin evidencia percusiva**.

- El **bypass rescue está limpio** — 1 solo onset dudoso en todo el corpus.
- El **density path es "sucio" por diseño**: pinta luz sobre ruido blanco. No es un fallo.
- La contaminación real del MACD es del 6% del total, no la catástrofe que se suponía.

---

## 5. Identificabilidad de cada coeficiente

Barrido de un eje cada vez sobre el corpus completo:

| Eje | Spread | Óptimo | Veredicto |
|---|---|---|---|
| `flux_knee` | 0.087 | **0.15** | IDENTIFICABLE |
| `flux_floor` | 0.081 | **0.02** | IDENTIFICABLE |
| `crack_atten` | 0.040 | 0.30 (actual) | IDENTIFICABLE, ya óptimo |
| `bodyFactor` mín. | 0.015 | **0.300 (actual)** | IDENTIFICABLE, ya óptimo |
| `snareMomentumFloor` | 0.009 | 0.040–0.050 | débil |
| `crack_wns_th` | 0.003 | — | NO identificable |
| `snareVetoWnsFloor` | 0.003 | — | NO identificable |
| `crack_flux_th` | 0.002 | — | NO identificable |
| `snareVetoWnsKnee` | 0.001 | — | NO identificable |

`floor_min` y `g_refr` muestran spreads enormes (0.19) pero son **acantilados**, no pendientes:
`floor_min ≥ 0.005` o `g_refr = 2` derriban el density path por debajo del 80% y disparan la
penalización dura. Fuera de esos precipicios ambos son planos.

**`snareVetoFlatnessFloor` es no identificable por construcción:** `flatness` no se registra
en la telemetría y en la captura `floor == knee == 0.10`, así que la inversión del veto solo
devuelve un binario. Se deja intacto y se declara no optimizable con estos datos.

### Refutación empírica: el bodyFactor mínimo

La hipótesis de subir el suelo de `bodyFactor` para rescatar snares sintéticos queda **refutada**:

| Suelo | fitness | recall percusivo | onsets sin evidencia |
|---|---|---|---|
| **0.300** | **0.7483** | **0.802** | **90** |
| 0.500 | 0.7474 | 0.798 | 91 |
| 1.000 | 0.7329 | 0.783 | 101 |

Subirlo deja pasar más basura que snares. El cambio 0.1 → 0.3 de WAVE 7773 fue correcto;
seguir subiendo es contraproducente.

---

## 6. Arbitraje: por qué se descarta el campeón de 12 dimensiones

La búsqueda estocástica encontró un óptimo conjunto de fitness 0.7795 (+4.2%). El protocolo
split-half lo desmonta:

| Configuración | fitness | fold A | fold B | ¿robusto? |
|---|---|---|---|---|
| Campeón 12-D | 0.7795 | +0.0135 | +0.0489 | **no** — inconsistente |
| **Candidato C (4 cambios)** | **0.7667** | **+0.0166** | **+0.0202** | **sí** |

El campeón gana más en una mitad y menos en la otra: está memorizando. El candidato C gana
lo mismo en ambas. Se envía C.

---

## 7. Set aplicado

| Parámetro | Antes | Después | Fichero |
|---|---|---|---|
| `snareVetoFluxFloor` | 0.05 | **0.02** | `techno.ts` |
| `snareVetoFluxKnee` | 0.25 | **0.15** | `techno.ts` |
| `snareMomentumFloor` | 0.045 | **0.040** | `techno.ts` |
| `GHOST_REFRACTORY_FRAMES` | 4 | **6** | `LiquidEngineBase.ts` |

**Deliberadamente NO se tocan:**

- `bodyFactor` mínimo `0.300` — óptimo demostrado, subirlo degrada todo.
- `SNARE_REFRACTORY_FRAMES = 4` — a 130 BPM una semicorchea son 115 ms y 5 frames son
  114 ms: pisaría exactamente los redobles. Argumento físico por encima del fitness.
- `snareVetoWnsFloor / Knee`, `crack_wns_th`, `crack_flux_th` — no identificables.
- `snareMomentumFloorMin = 0.002` — cualquier valor mayor mata el density path.

### Resultado global

| Métrica | Antes | Después |
|---|---|---|
| Recall percusivo (Carl Cox, Brejcha, Minimal…) | 0.802 | **0.866** |
| Recall comercial (Icona Pop, Guetta, Tiësto) | 0.622 | **0.671** |
| Onsets sin evidencia | 90 | **87** |
| Onsets del density path | 51 | **51** (preservado) |
| Brillo entregado en impactos reales | 0.964 | **0.998** |

### Por pista

| Pista | Recall antes → después | Onsets |
|---|---|---|
| thebussinesstiesto | 0.809 → **0.944** | 43 → 45 |
| minimaldroplex | 0.865 → **0.947** | 52 → 53 |
| borisgravity | 0.742 → **0.889** | 66 → 67 |
| florianpicasso | 0.821 → **0.882** | 38 → 42 |
| iloveiticonapop | 0.892 → **1.000** | 42 → 42 |
| dontbeshytiestokarolg | 0.910 → **0.961** | 44 → 44 |
| carlcoxacid | 0.877 → **0.897** | 94 → 94 |
| purplenoisebrejcha | 0.715 → **0.759** | 30 → 32 |
| buildredoblemimnimal | density preservado | 122 → 119 |

---

## 8. Límites de este estudio

1. **`flatness` no es recuperable** de la telemetría; `snareVetoFlatnessFloor` queda sin optimizar.
2. **`bodyFactor` solo explorable hacia arriba** (0.300): la telemetría ya viene recortada en ese suelo.
3. **Las etiquetas de `edm1` / `edm2` son las más débiles** (gate muerto → se recurre a `hhDlt`,
   que también dispara con hi-hats; alineación a rejilla 0.70/0.72, la más baja del corpus).
   Su recall bajo (0.42–0.73) puede ser artefacto del etiquetado, no del detector.
4. **La mejora es modesta**: +2.5% de fitness. El detector ya estaba razonablemente limpio
   (12% de onsets sin evidencia, 5 de esos 12 puntos son el density path funcionando como debe).

---

## 9. Reproducir

```powershell
$env:PYTHONIOENCODING="utf-8"
C:\Python313\python.exe -u docs\4dcalib\technoclub\montecarlo\_mc_parse.py   # topología
C:\Python313\python.exe -u docs\4dcalib\technoclub\montecarlo\_mc_truth.py   # etiquetas
C:\Python313\python.exe -u docs\4dcalib\technoclub\montecarlo\_mc_sim.py     # validación
C:\Python313\python.exe -u docs\4dcalib\technoclub\montecarlo\_mc_run.py     # búsqueda
C:\Python313\python.exe -u docs\4dcalib\technoclub\montecarlo\_mc_verify.py  # split-half
C:\Python313\python.exe -u docs\4dcalib\technoclub\montecarlo\_mc_sweep.py   # barridos 1-D
C:\Python313\python.exe -u docs\4dcalib\technoclub\montecarlo\_mc_final.py   # arbitraje
```
