nálisis comparativo de las 3 texturas
Datos extraídos de los logs
Métrica	Techno/Minimal	Cumbia	Dembow/Reguetón
Flatness	0.00 - 0.04	0.00 - 0.03	0.00 - 0.04
Melodicity	0.06 - 0.09	0.46 - 0.53	0.65 - 0.80
Dirtiness	0.05 - 0.06	0.12 - 0.15	0.17 - 0.23
Percussiveness	0.56 - 0.66	0.52 - 0.61	0.58 - 0.70
Groove	0.45 - 0.46	0.49 - 0.50	0.49 - 0.50
Harshness	0.10 - 0.18	0.10 - 0.39	0.24 - 0.64
Hallazgos
1. Flatness está roto — stuck en ~0 para los 3 géneros

El bug está en calculateSpectralFlatness en @/electron-app/src/workers/GodEarFFT.ts:748-772:

normFactor = 1 / (4096 × 0.35875) ≈ 0.00068 — las magnitudes normalizadas son muy pequeñas (típico 0.00001 a 0.00068)
El umbral mag2 > 1e-10 equivale a mag > 0.00001 (~1.5% del max). Esto parece razonable, pero...
YouTube (AAC/Opus 128-256kbps) levanta el noise floor por encima de 1e-10 en casi todos los bins
Resultado: validBins ≈ n (todos los bins pasan el filtro), y la media geométrica incluye cientos de bins de noise-floor con logs muy negativos que la arrastran a ~0
La media aritmética queda dominada por los pocos picos tonales
flatness = geomMean / arithMean ≈ 0 sin importar el género
2. Melodicity es el diferenciador estrella

Separación clarísima:

Techno: 0.07 (casi cero — sin presencia de medios, puro grave+agudo)
Cumbia: 0.50 (medios moderados — vientos, teclados, vocal)
Dembow: 0.75 (medios altísimos — dembow loop, sintetizadores mid)
La fórmula clamp01((midPresence - 0.30) / 0.40) funciona bien para diferenciar.

3. Harshness es el segundo diferenciador

Techno: 0.10-0.18 (poco highMid — kicks y subs dominan)
Cumbia: 0.10-0.39 (variable — depende de metales y percusión aguda)
Dembow: 0.24-0.64 (alto — el dembow satura highMid con sintetizadores agudos)
4. Dirtiness está cojo por el flatness≈0

La fórmula Dirt = harshness × (0.5 + 0.5 × flatness) se reduce a Dirt ≈ 0.5 × harshness cuando flatness≈0. Pierde la mitad de su rango dinámico. Si flatness funcionara, el dembow tendría Dirt mucho más alto.

5. Percussiveness y Groove no diferencian géneros

Todos se mantienen en 0.52-0.70 (Perc) y 0.45-0.50 (Groove). El rhythmicIntensity y syncopation no capturan la diferencia entre un bombo de techno y una güira de dembow.

Fix propuesto para Flatness
El problema es doble:

Umbral absoluto 1e-10 demasiado bajo para magnitudes normalizadas con normFactor ≈ 0.00068
Discrepancia validBins vs n — la media aritmética divide por n (todos los bins) pero la geométrica solo usa validBins
¿Quieres que aplique el fix? La solución sería usar un umbral relativo (ej: bins below 1% del max magnitude se excluyen de ambas medias) y hacer que ambas medias usen el mismo denominador.