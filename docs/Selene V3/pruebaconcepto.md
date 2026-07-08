WAVE 7004.3 — Monte Carlo Calibration (Lote 1): Resultados
Metodología de simulación
El JSONL grabado contiene el output del pipeline ya corrido (no los inputs crudos). Aproveché que los 7 sensores (s_DNA...s_B) están grabados crudos, pre-fusión — eso permite re-fusionar la confianza C(t) con pesos w1..w7 distintos sin error. Para T(t) y V(t) (que dependen de impact/temperature, invariantes al set de búsqueda), los re-simulé recursivamente frame-a-frame con los coeficientes candidatos, exactamente como CognitiveFluidState.update() e IgnitionChamber.evaluate() en el código fuente. eHat se recuperó invirtiendo s_E = eHat^0.7 (gamma_e del perfil grabado).

Ejecuté Simulated Annealing multi-start (7 corridas independientes, 6000 iteraciones c/u) con función de coste: penalización fuerte por jitter (gaps < 3s), penalización por disparo extra, penalización crítica por cero disparos.

Resultado — Coeficientes óptimos (Lote 1)


T_base:      0.568   (default 0.50)
kappa_sigma: 0.447   (default 0.35)
alpha_rise:  0.053   (default 0.04)
tau_sat:     4.39    (default 6.0)
Q_base:      0.693   (default 0.45)  ← LEVER PRINCIPAL
 
w1 (DNA):    0.309   (default 0.22)
w2 (Z):      0.163   (default 0.20)
w3 (E):      0.160   (default 0.15)
w4 (V/anti-vocal): 0.085  (default 0.15)
w5 (X):      0.104   (default 0.12)
w6 (P):      0.083   (default 0.08)
w7 (B):      0.096   (default 0.08)
Verificado: 1 solo ignite=true en toda la muestra (2700 frames, 172s), en t=48.71s — justo en el borde de ascenso del pico real de impacto (0.705 @ t=48.84s). Baseline con perfil default re-simulado: 151 ignitions. Recorded original (V2-like, sin squelch adaptativo): 894 ignites.

Análisis: por qué funciona
Q_base es el lever dominante (0.45 → 0.69, +53%). Las 7 corridas convergieron de forma independiente al mismo instante de ignición exacto, pero con T_base/kappa_sigma/tau_sat muy dispersos entre sí — señal de que la dinámica de tensión es secundaria frente al squelch base para este clip. Verifiqué esto explícitamente: subir solo Q_base a 0.65 (dejando el resto en default) produce 4 disparos (incluyendo jitter de 20ms), mientras que la combinación completa produce exactamente 1.

Mecanismo de supresión real: tras el primer disparo, vaporPressure colapsa de 0.916→0.137 (κ_vreset=0.15 fijo) y la tensión sube ligeramente (0.566→0.60+), lo que eleva el squelch de 0.564→0.85+ en menos de 150ms. La confianza post-ignición se mantiene en ~0.65-0.68 — por debajo del nuevo squelch elevado — pese a que el impacto crudo sigue siendo alto (0.65-0.70). Es la combinación (vapor discharge + tensión elevada) la que sostiene el squelch por encima de la confianza residual del mismo evento, evitando el ametrallamiento.

Fusión de sensores: w4 (filtro anti-voz s_V) baja de 0.15→0.085 consistentemente — en este clip de techno instrumental, el filtro anti-vocal aporta poca información discriminante y diluye la señal real (s_DNA, cuyo peso sube a 0.31). Esto es coherente con el género del clip, no una sobreajuste arbitrario.

Siguiente paso sugerido
Esta calibración usa 1 sola muestra (buildup de Brejcha). Antes de fijar estos valores en DEFAULT_LIQUID_PROFILE, recomiendo repetir el proceso con 2-3 clips adicionales de géneros distintos (ideal: uno con voz, para validar si w4 realmente debe bajar globalmente o es específico de este track) y promediar/regularizar entre lotes.