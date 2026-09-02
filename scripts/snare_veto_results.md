# WAVE 7749 — Monte Carlo Snare Veto Calibration Results

**Dataset:** 25543 frames from 4 categories
**Categories:** bass (5228), snare (3663), synth (12788), vocal (3864)

## Final Recommended Thresholds

| Parameter | Value |
|---|---|
| snareVetoFlatnessFloor | 0.0800 |
| snareVetoFlatnessKnee  | 0.1800 |
| snareVetoWnsFloor      | 0.2000 |
| snareVetoWnsKnee       | 0.7000 |
| snareVetoFluxFloor     | 0.1500 |
| snareVetoFluxKnee      | 0.2500 |

**Strategy:** Optimized (p10/p40)
**False Positive Rate:** 36.69%
**Snare Recall:** 70.63%

## Performance Comparison

| Strategy | FP Rate | Recall |
|---|---|---|
| Default (p5/p50) | 51.08% | 71.33% |
| Optimized (p10/p40) | 36.69% | 70.63% |
