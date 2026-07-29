Reporte de Calibración DSP — GodEar V3
Veredicto previo: los umbrales actuales son inalcanzables
Antes de dar números, tres bugs upstream invalidan cualquier tuning de strobeDrive. Los datos lo demuestran matemáticamente.

🔴 BLOQUEANTE 1 — spectralFluxV3 no está normalizado
El máximo observado en los 19 JSONs es exactamente 2048.0000 = numBins (fftSize 4096 >> 1). No es coincidencia: la función suma un término acotado a ~1.0 por bin y nunca divide.



Proyectos
let totalFlux = 0;
let totalPower = 0;
 
for (let k = 1; k <= numBins; k++) {
  const p = power[k];
  const r = fluxWhitening[k] * 0.995;
  fluxWhitening[k] = p > r ? p : r;
  const d = p - prevPower[k];
  if (d > 0) totalFlux += d / (fluxWhitening[k] + 1e-12);
  totalPower += p;
  prevPower[k] = p;
}
 
return totalPower > 1e-10 ? totalFlux : 0;
El docstring especifica F_norm(t) = F(t) / (ε + Σ_k P_t[k]), pero totalPower se calcula y se descarta. Solo se usa como guard.

Consecuencia directa: en StrobeEngine.process(), Math.min(1, spectralFlux) es siempre 1.0 para cualquier señal real (mínimo observado: 631). El término de flux aporta una constante +0.2 y cero información.

🔴 BLOQUEANTE 2 — whiteNoiseScore es cero permanente


Proyectos
const whiteNoiseScore = Math.max(0, Math.min(1, (flatness - 0.5) * 2));
Prueba empírica en samples_Cymbals.json (ruido de banda ancha puro, el caso ideal):

Métrica	min	p25	med	p75	max
strobeDrive	0.2000	0.2000	0.2000	0.2000	0.2000
Los 12 platillos dan 0.2000 exacto, sin varianza. Como el flux ya aporta 0.2 fijo y transientDensity es 0 en cymbals, esto demuestra que whiteNoiseScore = 0 incluso para el material más ruidoso de la librería. El offset de 0.5 está por encima del techo práctico de la spectral flatness.

🔴 BLOQUEANTE 3 — transientDensity solo detecta bombos


Proyectos
const slopeThreshold = Math.max(0.05, avgEnergy * 0.3);
El piso absoluto 0.05 está en unidades de potencia cruda. rawBands.subBass (bombo) es órdenes de magnitud mayor que rawBands.mid (caja) o rawBands.treble (hi-hat).

Resultado medido de transientDensity:

Grupo	n	max	% > 0.05
KICKS	63	0.4681	37%
MELODIC	37	0.3414	59%
SNARES	230	0.0000	0%
HIHATS	62	0.0000	0%
CYMBALS	12	0.0000	0%
304 muestras de percusión aguda con transientDensity idénticamente cero. Tu requisito nº1 ("un redoble de caja rápida debe disparar el estrobo") es estructuralmente imposible hoy.

Conclusión matemática sobre el estrobo


driveRaw = 0.5·td + 0.3·wns + 0.2·min(1, flux)
         = 0.5·td + 0.3·(0) + 0.2·(1.0)      ← wns y flux muertos
         = 0.5·td + 0.2
Con td_max = 0.4681 (mejor bombo de toda la librería): driveRaw_max = 0.434, y tras el suavizado asimétrico el pico real medido es 0.3239.

El umbral de 0.45 es inalcanzable por diseño. Sweep confirmatorio:

Grupo	≥0.20	≥0.25	≥0.30	≥0.35	≥0.45
KICKS	0%	0%	0%	0%	0%
SNARES	0%	0%	0%	0%	0%
HIHATS	0%	0%	0%	0%	0%
CYMBALS	0%	0%	0%	0%	0%
MELODIC	59%	22%	3%	0%	0%
El estrobo nunca se ha activado en ninguna de las 432 muestras.

🔴 BLOQUEANTE 4 — snapThreshold del ChromaCoupler off por 12×
snapThreshold = 0.35 vs. chromaFlux máximo absoluto observado en toda la librería = 0.0284. colorSnap tampoco ha disparado jamás.

Correcciones de código requeridas
Fix 1 — Normalizar el flux


ts
return totalPower > 1e-10 ? totalFlux / numBins : 0;
Rango resultante: [0.31, 1.00]. Sigue comprimido arriba, así que expande el rango útil en el StrobeEngine en lugar de usarlo crudo.

Fix 2 — Recalibrar whiteNoiseScore


ts
const whiteNoiseScore = Math.max(0, Math.min(1, (flatness - 0.20) / 0.35));
El offset debe bajar a 0.20. Requiere validación: flatness no está en la telemetría actual, así que este valor es una estimación basada en el techo práctico de la flatness espectral, no en tus datos.

Fix 3 — Umbral de onset relativo por banda


ts
const slopeThreshold = Math.max(avgEnergy * 0.05, avgEnergy * 0.3);
Elimina el piso absoluto 0.05. El umbral debe ser puramente relativo a la energía media de esa banda, o usar un piso escalado por banda (subBass: 0.05, mid: 0.002, treble: 0.0005).

Umbrales recomendados
1. Estrobo — activationThreshold
0.45 → 0.38, con pesos rebalanceados:



ts
const driveRaw = transientDensity * 0.55
               + whiteNoiseScore * 0.30
               + Math.max(0, (spectralFluxNorm - 0.60) / 0.40) * 0.15;
Justificación:

El peso del flux baja de 0.20 a 0.15 y se le resta un piso de 0.60, porque incluso normalizado el p25 más bajo de toda la librería es 0.317 y las medianas viven en 0.80–1.00. Sin restar el piso sigue siendo un offset constante disfrazado.
transientDensity sube a 0.55 porque es la única señal que distingue evento aislado de redoble.
0.38 deja margen para que un bombo aislado (td p90 = 0.207 → contribución 0.114) no llegue solo, pero un redoble con td > 0.5 sí.
⚠️ Este número es provisional. Con wns y td de snares en cero, no existe un solo dato en los 19 JSONs que describa el comportamiento real de un redoble. Necesito una segunda pasada de telemetría después de los fixes 1–3 para confirmarlo.

2. AGC — headroom
Overshoot de scaledKick sobre 1.0:

Grupo	n	>1.0	>1.2	>1.5	absMax
KICKS	63	28.6%	14.3%	4.8%	1.8533
MELODIC	37	35.1%	13.5%	0%	1.3098
SNARES	230	0%	0%	0%	0.5645
HIHATS	62	0%	0%	0%	0.0225
CYMBALS	12	0%	0%	0%	0.0503
Constantes recomendadas:



ts
AGC_HEADROOM       = 1.50   // clamp duro
AGC_TARGET_SCALE   = 0.64   // 0.9 / 1.4133  (p95 kicks → 0.9)
Justificación: el p95 de kicks es 1.4133. Escalando por 0.64 ese p95 aterriza en 0.90, dejando el 5% superior (los transitorios más agresivos) usando el headroom hasta 1.5 sin clipear. El absMax de 1.8533 sí se clampea — es un outlier único (BL_Kick09.wav) con un 85% de overshoot.

Sobre el ataque/release: que el 28.6% de bombos superen 1.0 en el pico es esperable y hasta deseable (preserva el punch). El problema no es el ataque sino la ausencia de techo. Añade el clamp antes de tocar las constantes de tiempo.

3. Filtro de armonía — chromaFlux
Aquí tengo que contradecir la premisa de la pregunta. chromaFlux no puede separar armonía de caos, porque la relación está invertida:

Grupo	med	p95	max	mean
CYMBALS	0.0197	0.0262	0.0284	0.0200
HIHATS	0.0140	0.0201	0.0234	0.0140
MELODIC	0.0146	0.0256	0.0262	0.0148
SNARES	0.0113	0.0182	0.0214	0.0114
KICKS	0.0033	0.0091	0.0151	0.0045
Los platillos tienen más chromaFlux que los pads y bajos (0.0200 vs 0.0148). Cualquier umbral simple disparará más con un crash que con un cambio de acorde real. Es lógico: un platillo excita las 12 clases de altura simultáneamente y de forma inestable.

Solución: gate compuesto. El discriminador real está en el ratio de bandas:

Grupo	scaledKick med	scaledHighs med	ratio
KICKS	0.2359	0.0021	112.3
MELODIC	0.7684	0.0226	34.0
SNARES	0.0407	0.0181	2.25
CYMBALS	0.0266	0.1153	0.23
HIHATS	0.0039	0.0446	0.087
Separación de dos órdenes de magnitud entre contenido tonal y percusión-ruido.



ts
CHROMA_SNAP_THRESHOLD   = 0.35  → 0.0130   // p50 melodic, deja fuera 62% de snares
CHROMA_TONAL_GATE_RATIO = 1.0              // scaledKick / (scaledHighs + 1e-6)
Condición de disparo:



ts
const tonalRatio = scaledKick / (scaledHighs + 1e-6);
const colorSnap = chromaFlux > 0.0130 && tonalRatio > 1.0 && snapCooldown <= 0;
Justificación de 0.0130: es la mediana de MELODIC (0.0146) bajada un escalón para capturar cambios de acorde suaves en pads. Con el gate de ratio, los 12 cymbals (ratio 0.23) y los 62 hi-hats (ratio 0.087) quedan excluidos aunque superen el umbral de flux. El ratio 1.0 deja pasar melodic (34.0) y kicks (112) pero bloquea snares (2.25) solo parcialmente — si quieres cerrar las cajas del todo, sube a 5.0.

Resumen de constantes


ts
// GodEarFFT.ts — computeSpectralFlux()
return totalPower > 1e-10 ? totalFlux / numBins : 0;   // FIX obligatorio
 
// StrobeEngine
ACTIVATION_THRESHOLD = 0.38     // era 0.45 (inalcanzable)
WEIGHT_TRANSIENT     = 0.55     // era 0.50
WEIGHT_NOISE         = 0.30     // sin cambio
WEIGHT_FLUX          = 0.15     // era 0.20, con piso -0.60 y escala /0.40
DEACTIVATION_THRESH  = 0.20     // era 0.25, proporcional al nuevo umbral
 
// whiteNoiseScore
FLATNESS_OFFSET      = 0.20     // era 0.50
FLATNESS_SCALE       = 0.35     // era 0.50 (×2)
 
// SlopeBasedOnsetDetector
SLOPE_FLOOR_ABSOLUTE = eliminar // el 0.05 mata snares y hi-hats
 
// AGCTrustZone
AGC_HEADROOM         = 1.50
AGC_TARGET_SCALE     = 0.64
 
// ChromaCoupler
SNAP_THRESHOLD       = 0.0130   // era 0.35 (12× fuera de rango)
TONAL_GATE_RATIO     = 1.0      // nuevo: scaledKick/scaledHighs
Limitaciones de este análisis
Debo ser explícito sobre qué está respaldado por datos y qué no:

Sólido: los 4 bloqueantes, el headroom del AGC, el umbral y gate de chroma. Derivados directamente de 432 muestras.
Provisional: ACTIVATION_THRESHOLD = 0.38 y los pesos del driveRaw. Con whiteNoiseScore y el transientDensity de percusión aguda en cero, no hay ni un solo dato válido sobre cómo se comporta un redoble. Ese número es una estimación.
No verificado: FLATNESS_OFFSET = 0.20. La flatness no está expuesta en GodEarTelemetry.
Siguiente paso recomendado: añadir flatness, whiteNoiseScore y driveRaw (pre-suavizado) a la telemetría, aplicar los fixes 1–3, y re-ejecutar el calibrador. Con esos datos puedo cerrar el umbral del estrobo con la misma solidez que tienen ahora los del AGC y el chroma. ¿Lo preparo?



Feedback submitt