# Diagnóstico post-OMNI-GATE v3 — gravityrythm.md & gravitykick.md

Fecha: 2025-11-20
Motor: LiquidEngineBase.ts (OMNI-GATE v3, commit 61c36b64)
Tracks: "gravity" (gravityrythm.md) y techno de kick fuerte (gravitykick.md)

---

## Resumen ejecutivo

OMNI-GATE v3 resolvió los problemas de gravityverse (colas de ruido, bass transientes) pero **gravity sigue siendo el problema crónico**. Los kicks de gravity tienen un bleed de bass hacia la banda de snare tan extremo (SnareE 0.7–1.0) que ningún umbral de SnareE los puede separar de los snares reales sin matar snares legítimos.

| Track | Problema | Causa raíz | Severidad |
|-------|----------|------------|-----------|
| gravityrythm | "Snare roto a trozos, 3 hits por beat" | (A) Kicks falsos por bleed masivo + (B) Impulse decay escalonado | Alta |
| gravitykick | Snares pegan junto con kicks | Kicks con SnareE 0.17–0.74 y WNS 0.00–0.26 pasan los gates | Alta |

---

## PROBLEMA A — gravityrythm: Kicks falsos por bleed extremo (SnareE 0.7–1.0)

### Síntoma

El snare onset dispara en prácticamente cada beat del four-on-the-floor. Los kicks de gravity tienen SnareE 0.7–1.0 (bleed de bass hacia banda de snare). El OMNI-GATE v3 clause 1a (`SnareE > 0.45`) no los bloquea porque SnareE > 0.45 en todos.

### Evidencia (gravityrythm.md)

Onsets con WNS:0.000 (sin ruido de snare) que pasan por clause 1a:

```
L21:  SnareE:1.000  RawΔ:0.439  Flux:0.204  WNS:0.000  BassE:0.785  [ONSET]
L46:  SnareE:0.898  RawΔ:0.101  Flux:0.153  WNS:0.000  BassE:0.794  [ONSET]
L55:  SnareE:0.547  RawΔ:0.299  Flux:0.263  WNS:0.000  BassE:0.769  [ONSET]
L67:  SnareE:1.000  RawΔ:0.729  Flux:0.233  WNS:0.000  BassE:0.754  [ONSET]
L117: SnareE:0.896  RawΔ:0.418  Flux:0.205  WNS:0.000  BassE:0.743  [ONSET]
L136: SnareE:0.578  RawΔ:0.422  Flux:0.373  WNS:0.000  BassE:0.852  [ONSET]
L401: SnareE:0.477  RawΔ:0.415  Flux:0.377  WNS:0.000  BassE:0.802  [ONSET]
L426: SnareE:1.000  RawΔ:0.600  Flux:0.237  WNS:0.000  BassE:0.788  [ONSET]
L437: SnareE:0.775  RawΔ:0.242  Flux:0.186  WNS:0.000  BassE:0.747  [ONSET]
L450: SnareE:0.580  RawΔ:0.280  Flux:0.301  WNS:0.000  BassE:0.756  [ONSET]
L461: SnareE:0.718  RawΔ:0.296  Flux:0.271  WNS:0.000  BassE:0.832  [ONSET]
L481: SnareE:0.581  RawΔ:0.447  Flux:0.342  WNS:0.000  BassE:0.851  [ONSET]
L495: SnareE:0.524  RawΔ:0.375  Flux:0.316  WNS:0.000  BassE:0.845  [ONSET]
L507: SnareE:0.609  RawΔ:0.372  Flux:0.355  WNS:0.000  BassE:0.804  [ONSET]
L531: SnareE:0.617  RawΔ:0.426  Flux:0.365  WNS:0.000  BassE:0.836  [ONSET]
```

**15 onsets con WNS = 0.000**. Todos pasan por clause 1a (`SnareE > 0.45`). Ninguno es un snare real — son kicks con bleed.

### Snares reales de gravity (con WNS > 0.05) para comparar:

```
L9:   SnareE:0.640  RawΔ:0.376  Flux:0.339  WNS:0.095  [ONSET] — borderline
L33:  SnareE:0.698  RawΔ:0.408  Flux:0.387  WNS:0.977  [ONSET] — snare real
L80:  SnareE:0.664  RawΔ:0.390  Flux:0.406  WNS:0.138  [ONSET] — snare real
L93:  SnareE:0.489  RawΔ:0.397  Flux:0.393  WNS:0.080  [ONSET] — borderline
L105: SnareE:0.575  RawΔ:0.479  Flux:0.410  WNS:0.116  [ONSET] — snare real
L413: SnareE:0.569  RawΔ:0.487  Flux:0.390  WNS:0.976  [ONSET] — snare real
L462: SnareE:0.718  RawΔ:0.296  Flux:0.271  WNS:0.320  [ONSET] — snare real
L496: SnareE:0.524  RawΔ:0.375  Flux:0.316  WNS:0.441  [ONSET] — snare real
L532: SnareE:0.617  RawΔ:0.426  Flux:0.365  WNS:0.583  [ONSET] — snare real
```

### Diagnóstico

**El bleed de gravity es tan extremo que SnareE no discrimina**. Los kicks tienen SnareE 0.5–1.0 (por bleed de bass hacia la banda de snare), y los snares reales tienen SnareE 0.49–0.72. **Los rangos se solapan completamente**.

| Métrica | Kicks falsos | Snares reales | Solapamiento |
|---------|-------------|---------------|--------------|
| SnareE | 0.48–1.00 | 0.49–0.72 | **Total** |
| WNS | 0.000 | 0.08–0.98 | **Parcial** (WNS = 0 solo kicks, pero WNS 0.08 es borderline) |
| Flux | 0.15–0.43 | 0.27–0.44 | **Total** |
| RawΔ | 0.10–0.73 | 0.30–0.49 | **Total** |
| BassE | 0.74–0.85 | 0.66–0.85 | **Total** |

**El único discriminador confiable es WNS**. Kicks tienen WNS = 0.000, snares reales tienen WNS > 0.08. Pero clause 1a permite SnareE > 0.45 sin WNS, y los kicks tienen SnareE > 0.45.

### El dilema del arquitecto

- **Subir clause 1a a SnareE > 0.80**: bloquearía la mayoría de kicks (SnareE 0.48–0.90), pero también bloquearía snares reales con SnareE 0.49–0.72. **Mata snares reales.**
- **Eliminar clause 1a y requerir WNS siempre**: bloquearía todos los kicks falsos, pero también bloquearía snares sintéticos de Anyma (WNS = 0, SnareE 0.46+). **Mata Anyma.**
- **Subir WNS mínimo en clause 1b a 0.08**: los snares reales de gravity tienen WNS 0.08–0.98. Los kicks tienen WNS 0.000. **Gap limpio en 0.05–0.08.** Pero los snares borderline (L9 WNS 0.095, L93 WNS 0.080) quedarían en el filo.

**Opción recomendada**: Mantener clause 1a pero subir a **SnareE > 0.85** (solo snares saturados de Anyma/dembow pasan sin WNS) y subir clause 1b WNS mínimo a **0.08**:

```
// Clause 1a: SnareE > 0.85 (saturated synth snares only — Anyma/dembow)
// Clause 1b: SnareE > 0.15 AND WNS > 0.08 (acoustic snares with noise)
// Clause 2:  WNS > 0.10 AND BassE > 0.40 AND SnareE > 0.05 (broadband + context)
(snareEnergy > 0.85 || (snareEnergy > 0.15 && wns > 0.08) || (wns > 0.10 && bassE > 0.40 && snareEnergy > 0.05))
```

Esto bloquearía:
- Kicks de gravity (SnareE 0.48–1.00, WNS 0.000): clause 1a filtra SnareE < 0.85, clause 1b filtra WNS = 0, clause 2 filtra WNS = 0. **Bloqueados.**
- Pero kicks con SnareE 0.85–1.00 (L21, L67, L426) seguirían pasando por clause 1a. **3 kicks falsos restantes.**

Para bloquear esos 3 kicks restantes, habría que subir clause 1a a SnareE > 1.00 (imposible) o eliminar clause 1a. Pero eliminar clause 1a mata los snares de Anyma (SnareE 0.46–0.80, WNS 0.000).

**Esto es un trade-off fundamental**: no se puede separar kicks de gravity con SnareE > 0.85 de snares sintéticos de Anyma con SnareE 0.46–0.80 usando solo SnareE y WNS. Se necesita otra dimensión.

### Posible dimensión adicional: BassE/SnareE ratio

Un snare real (acústico o sintético) tiene **menos bass que snare energy**. Un kick tiene **más bass que snare energy** (el bleed es proporcional al bass).

| Frame | SnareE | BassE | BassE/SnareE | Tipo |
|-------|--------|-------|-------------|------|
| L21 | 1.000 | 0.785 | 0.79 | Kick falso |
| L67 | 1.000 | 0.754 | 0.75 | Kick falso |
| L426 | 1.000 | 0.788 | 0.79 | Kick falso |
| L33 | 0.698 | 0.639 | 0.91 | Snare real |
| L80 | 0.664 | 0.787 | 1.19 | Snare real |
| L105 | 0.575 | 0.831 | 1.45 | Snare real |
| L413 | 0.569 | 0.661 | 1.16 | Snare real |

**No discrimina**. Los snares reales tienen BassE/SnareE 0.91–1.45, los kicks falsos tienen 0.75–0.79. Los rangos se solapan.

### Conclusión Problema A

**No hay fix limpio con las métricas actuales**. El bleed de gravity es tan extremo que SnareE, WNS, Flux, RawΔ y BassE no separan kicks de snares. Se necesita:
1. **Mejorar la separación de bandas** en el análisis espectral (reducir bleed de bass hacia snare)
2. **Añadir una métrica nueva** como centroid espectral o crest factor
3. **O aceptar el trade-off**: bloquear todos los WNS=0 (matar Anyma) o aceptar kicks falsos con SnareE > 0.85

---

## PROBLEMA B — gravityrythm: "Snare roto a trozos, 3 hits por beat"

### Síntoma

El usuario percibe visualmente que cada snare se ve como "una bofetada rota a trozos" — como si hubiera un hit delante y un hat detrás comprimidos, pegando 3 veces por beat.

### Evidencia (gravityrythm.md)

El impulse decay del snare es `snareImpulseDecay = 0.40` (configurable, default 0.40). Esto produce:

```
Frame 0 (onset):  OutSnare 1.000
Frame 1:          OutSnare 0.450  (decay 0.40 + choke/veto amplification)
Frame 2:          OutSnare 0.200
Frame 3:          OutSnare 0.090
```

A ~43ms por frame (44.1kHz / 1024 hop), el decay completa en ~129ms. Un beat a 126 BPM = 476ms. El decay ocupa ~27% del beat.

### Diagnóstico

El decay exponencial con factor 0.40 es **muy rápido y escalonado**. Los 3 primeros frames (1.0, 0.45, 0.20) son claramente distinguibles visualmente si el motor de luces muestrea a ≥30fps. El usuario ve:

1. **Pico 1**: OutSnare 1.0 (la "bofetada")
2. **Pico 2**: OutSnare 0.45 (el "hit delante")
3. **Pico 3**: OutSnare 0.20 (el "hat detrás comprimido")

Esto se ve como 3 pulsos en lugar de 1 golpe seco. El problema se agrava porque **el snare está disparando en cada beat** (Problema A), así que el usuario ve 3 pulsos × 4 beats = 12 pulsos por compás.

### Propuesta de fix

**Opción 1 (suavizar decay)**: Subir `snareImpulseDecay` de 0.40 a **0.65**:

```
Frame 0: 1.000
Frame 1: 0.650
Frame 2: 0.423
Frame 3: 0.275
Frame 4: 0.179
```

Decay más suave — 5 frames para bajar de 1.0 a 0.18 (~215ms). Los frames intermedios (0.65, 0.42, 0.28) son menos distinguibles como pulsos separados. Se ve como un golpe con cola, no 3 hits.

**Riesgo**: decay más largo puede solaparse con el siguiente beat si el snare dispara en beats consecutivos. A 126 BPM, 215ms < 476ms (un beat), así que no debería solaparse.

**Opción 2 (decay más largo aún)**: `snareImpulseDecay = 0.75`:

```
Frame 0: 1.000
Frame 1: 0.750
Frame 2: 0.563
Frame 3: 0.422
Frame 4: 0.316
```

Decay muy suave — se ve como un solo golpe con cola larga. **Riesgo**: si hay snares en beats consecutivos (dembow), el decay del primer snare se solapa con el segundo. A 126 BPM, 4 frames = 172ms < 476ms, seguro.

**Recomendación**: Probar 0.65 primero. Si sigue viéndose "a trozos", subir a 0.75.

---

## PROBLEMA C — gravitykick: Snares pegan junto con kicks

### Síntoma

En una versión de techno con kick muy fuerte y mucho bass rodante, el snare sigue disparando junto con algunos kicks. Aunque menos frecuente que antes, sigue ocurriendo.

### Evidencia (gravitykick.md)

Onsets marcados con [ONSET] [KICK] (snare + kick simultáneos):

```
L6:   SnareE:0.198  RawΔ:0.353  Flux:0.740  WNS:0.184  BassE:0.610  [ONSET] [KICK]
L28:  SnareE:0.228  RawΔ:0.329  Flux:0.783  WNS:0.261  BassE:0.596  [ONSET] [KICK]
L49:  SnareE:0.687  RawΔ:0.255  Flux:0.724  WNS:0.000  BassE:0.702  [ONSET] [KICK]
L71:  SnareE:0.204  RawΔ:0.351  Flux:0.748  WNS:0.257  BassE:0.580  [ONSET] [KICK]
L78:  SnareE:0.745  RawΔ:0.316  Flux:0.672  WNS:0.000  BassE:0.532  [ONSET] [KICK]
L108: SnareE:0.171  RawΔ:0.337  Flux:0.621  WNS:0.110  BassE:0.593  [ONSET] [KICK]
L138: SnareE:0.683  RawΔ:0.330  Flux:0.558  WNS:0.000  BassE:0.650  [ONSET] [KICK]
```

### Diagnóstico

Dos patrones distintos de kicks falsos:

**Patrón 1 — Kicks con SnareE alto y WNS = 0** (L49, L78, L138):
- SnareE 0.68–0.75, WNS 0.000
- Pasan por clause 1a (`SnareE > 0.45`)
- Mismo problema que gravityrythm: bleed de bass hacia banda de snare

**Patrón 2 — Kicks con SnareE bajo y WNS moderado** (L6, L28, L71, L108):
- SnareE 0.17–0.23, WNS 0.11–0.26
- Pasan por clause 1b (`SnareE > 0.15 AND WNS > 0.05`)
- El kick tiene contenido broadband que produce WNS 0.11–0.26
- SnareE 0.17–0.23 es muy bajo para un snare real, pero supera el umbral 0.15

### Comparación con snares reales de gravitykick

```
L11:  SnareE:0.074  RawΔ:0.219  Flux:0.205  WNS:0.539  [ONSET] — snare real (WNS alto)
L40:  SnareE:0.740  RawΔ:0.362  Flux:0.776  WNS:0.070  [ONSET] — borderline (WNS 0.07)
L54:  SnareE:0.272  RawΔ:0.268  Flux:0.426  WNS:0.532  [ONSET] — snare real
L94:  SnareE:0.252  RawΔ:0.313  Flux:0.453  WNS:0.393  [ONSET] — snare real
L120: SnareE:0.175  RawΔ:0.378  Flux:0.569  WNS:0.189  [ONSET] — borderline
```

| Métrica | Kicks Patrón 1 | Kicks Patrón 2 | Snares reales |
|---------|----------------|----------------|---------------|
| SnareE | 0.68–0.75 | 0.17–0.23 | 0.07–0.74 |
| WNS | 0.000 | 0.11–0.26 | 0.07–0.54 |
| Flux | 0.56–0.78 | 0.62–0.78 | 0.21–0.78 |

**Flux discrimina parcialmente**: Kicks tienen Flux 0.56–0.78. Snares reales tienen Flux 0.21–0.78. Los snares reales con Flux 0.43–0.78 se solapan con kicks. Pero los snares reales con Flux 0.21–0.43 no se solapan.

**WNS discrimina parcialmente**: Kicks Patrón 2 tienen WNS 0.11–0.26. Snares reales tienen WNS 0.07–0.54. Solapamiento total.

### Propuesta de fix para Patrón 2 (SnareE bajo + WNS moderado)

Subir WNS mínimo en clause 1b de 0.05 a **0.30**:

```
// Clause 1b — antes:
(snareEnergy > 0.15 && wns > 0.05)

// Clause 1b — después:
(snareEnergy > 0.15 && wns > 0.30)
```

Justificación: Los kicks Patrón 2 tienen WNS 0.11–0.26. Los snares reales de gravitykick tienen WNS 0.39–0.54 (excepto L40 con WNS 0.070 y L120 con WNS 0.189 que son borderline). WNS > 0.30 bloquea los kicks Patrón 2 pero deja pasar snares reales con WNS > 0.30.

**Riesgo**: snares reales con WNS 0.07–0.30 (L40, L120) quedarían bloqueados. Pero estos son borderline — L40 tiene WNS 0.070 que es marginal, y L120 tiene SnareE 0.175 que es muy bajo.

### Propuesta de fix para Patrón 1 (SnareE alto + WNS = 0)

Mismo problema que gravityrythm. Subir clause 1a a SnareE > 0.85 bloquearía L49 (0.687) y L138 (0.683) pero no L78 (0.745). Y bloquearía snares reales con SnareE 0.46–0.85.

**No hay fix limpio** sin una métrica adicional.

---

## PROBLEMA D — gravitykick: Flux como discriminador

### Observación

Los kicks de gravitykick tienen Flux **anormalmente alto** (0.56–0.78). Esto es porque el kick es muy fuerte con mucho bass rodante, produciendo un transiente espectral masivo.

Los snares reales de gravitykick tienen Flux 0.21–0.78. Los snares reales con Flux < 0.50 no se solapan con kicks. Pero los snares reales con Flux > 0.50 (L40: 0.776, L120: 0.569) sí se solapan.

### Posible gate de Flux máximo

```
// Path 2 — añadir Flux < 0.50 a clause 1b:
(spectralFlux < 0.50 && snareEnergy > 0.15 && wns > 0.30)
```

Esto bloquearía los kicks Patrón 2 (Flux 0.62–0.78) pero también bloquearía snares reales con Flux > 0.50 (L40, L120). **Riesgo alto**.

**No recomendado** — el Flux de los snares reales varía demasiado.

---

## Tabla resumen de fixes propuestos

| # | Problema | Fix | Riesgo | Prioridad |
|---|----------|-----|--------|-----------|
| B | Snare roto a trozos | Subir snareImpulseDecay 0.40 → 0.65 | Bajo | **Alta** |
| C-P2 | Kicks con WNS moderado | Subir WNS en clause 1b: 0.05 → 0.30 | Medio (borderline snares) | **Alta** |
| A+C-P1 | Kicks con SnareE alto + WNS=0 | Subir clause 1a: 0.45 → 0.85 | Alto (3 kicks restantes) | Media |
| A | Bleed extremo de gravity | Sin fix limpio — necesita métrica nueva | — | Investigación |

---

## Notas para el arquitecto

1. **Fix B (impulse decay) es el más seguro y visible**. Subir de 0.40 a 0.65 debería cambiar inmediatamente la percepción visual del snare de "3 trozos" a "golpe con cola". Es un cambio de un solo parámetro.

2. **Fix C-P2 (WNS en clause 1b)** es efectivo pero tiene un trade-off. Subir WNS de 0.05 a 0.30 bloquea los kicks con WNS 0.11–0.26, pero también bloquea snares reales con WNS 0.07–0.30. En gravitykick, los snares reales tienen WNS 0.39–0.54 (excepto 2 borderline), así que el trade-off es aceptable. **Pero en gravityrythm, los snares reales tienen WNS 0.08–0.14** (L9, L80, L93, L105) — subir WNS a 0.30 los mataría.

3. **El problema A (bleed de gravity) es el más difícil**. Los kicks de gravity tienen SnareE 0.7–1.0 por bleed de bass. Ningún umbral de SnareE separa kicks de snares. Se necesita:
   - Mejorar la separación de bandas en el análisis FFT (ventanas más estrechas, notch filter en bass)
   - O añadir una métrica como **spectral centroid** (un snare tiene centroid en HF, un kick en LF)
   - O añadir **crest factor** (un snare tiene crest factor alto, un kick bajo)
   - O usar **BassΔ** como discriminador (un kick tiene BassΔ positivo en el ataque, un snare no)

4. **BassΔ como posible discriminador**: Mirando los datos:
   - Kicks falsos gravityrythm: BassΔ -0.02 a +0.10 (mayormente positivo o plano)
   - Snares reales gravityrythm: BassΔ -0.10 a -0.06 (negativo — el bass baja cuando pega el snare)
   
   **Hay un gap**: kicks tienen BassΔ > -0.02, snares tienen BassΔ < -0.06. Requerir `BassΔ < 0` en clause 1a podría bloquear los kicks falsos. **Investigar esto.**

5. **Orden de aplicación recomendado**: Fix B (impulse decay) → Fix C-P2 (WNS 0.30 en clause 1b) → Investigar BassΔ para Fix A.

---

## Datos crudos de referencia

### gravityrythm.md — Distribución de onsets

| Tipo | WNS range | SnareE range | Count |
|------|-----------|--------------|-------|
| Kick falso (WNS=0) | 0.000 | 0.48–1.00 | 15 |
| Snare real (WNS>0.05) | 0.08–0.98 | 0.49–0.72 | 9 |
| Borderline | 0.04–0.08 | 0.47–0.57 | 3 |

### gravitykick.md — Distribución de onsets [ONSET] [KICK]

| Patrón | WNS | SnareE | Flux | Count |
|--------|-----|--------|------|-------|
| Patrón 1 (SnareE alto, WNS=0) | 0.000 | 0.68–0.75 | 0.56–0.72 | 3 |
| Patrón 2 (SnareE bajo, WNS moderado) | 0.11–0.26 | 0.17–0.23 | 0.62–0.78 | 4 |

### gravityrythm.md — BassΔ en onsets (posible discriminador)

| Frame | Tipo | SnareE | WNS | BassΔ |
|-------|------|--------|-----|-------|
| L21 | Kick falso | 1.000 | 0.000 | +0.041 |
| L46 | Kick falso | 0.898 | 0.000 | +0.051 |
| L55 | Kick falso | 0.547 | 0.000 | -0.002 |
| L67 | Kick falso | 1.000 | 0.000 | +0.020 |
| L117 | Kick falso | 0.896 | 0.000 | +0.035 |
| L33 | Snare real | 0.698 | 0.977 | -0.096 |
| L80 | Snare real | 0.664 | 0.138 | -0.059 |
| L105 | Snare real | 0.575 | 0.116 | -0.056 |
| L413 | Snare real | 0.569 | 0.976 | -0.107 |
| L462 | Snare real | 0.718 | 0.320 | -0.076 |

**Gap**: Kicks falsos tienen BassΔ ≥ -0.02. Snares reales tienen BassΔ ≤ -0.06. **Gap limpio en -0.02 a -0.06.**

---

## ADENDUM — reguetonsnare1.md: Comparativa de texturas musicales

### Contexto

El usuario reporta que el snare funciona **maravillosamente** en el perfil latino con reguetón. El Front es "MARAVILLOSO". Buena pegada, buen ritmo, buena detección. El autotune (archienemigo) no interfiere. Hay algunos missed snares pero en términos generales, excelente.

Este log es de **fiesta-latina** con reguetón a ~100 BPM. Sirve como referencia de **qué funciona bien** para contrastar con gravity/techno.

### Por qué el latino funciona con reguetón

#### 1. Separación espectral limpia — WNS es el discriminador perfecto

En reguetón, los kicks tienen WNS = 0.000 (sin contenido broadband). Los snares reales tienen WNS 0.32–1.00. **No hay solapamiento**.

| Tipo | WNS | SnareE | RawΔ | OutSnare |
|------|-----|--------|------|----------|
| Kicks (WNS=0) | 0.000 | 0.00–0.93 | 0.01–0.14 | 0.000 ✅ |
| Snares reales | 0.32–1.00 | 0.05–0.78 | 0.22–0.94 | 0.850 ✅ |

**Todos los kicks son correctamente bloqueados. Todos los snares son correctamente detectados.**

#### 2. RawΔ bajo en kicks — el gate natural que gravity no tiene

El insight clave: en reguetón, los kicks tienen **RawΔ bajo** (0.01–0.14) incluso cuando SnareE es alto (0.93). El bass bleed existe pero **no produce transientes afilados en la banda de snare**.

```
L281: SnareE:0.932  RawΔ:0.114  WNS:0.000  → OutSnare:0.000  ✅ bloqueado
L282: SnareE:0.876  RawΔ:-0.091 WNS:0.000  → OutSnare:0.000  ✅ bloqueado
L283: SnareE:0.824  RawΔ:-0.364 WNS:0.000  → OutSnare:0.000  ✅ bloqueado
```

Estos kicks tienen SnareE 0.82–0.93 (¡más alto que muchos snares reales!) pero RawΔ ≤ 0.114. El `finalSnareThreshold` (~0.15) los bloquea automáticamente. **No necesitan clause 1a, 1b ni 2 — el RawΔ los filtra antes.**

En gravity, los kicks tienen RawΔ 0.10–0.73. El bass bleed es **tan afilado** que produce transientes en la banda de snare que parecen snares reales. **Gravity rompe el supuesto fundamental del OMNI-GATE**: que los kicks no tienen transientes afilados en la banda de snare.

#### 3. Snares reales con WNS alto — detección limpia

```
L33:   SnareE:0.698  RawΔ:0.408  WNS:0.977  → OutSnare:0.850  ✅
L80:   SnareE:0.664  RawΔ:0.390  WNS:0.138  → OutSnare:0.850  ✅
L251:  SnareE:0.686  RawΔ:0.756  WNS:1.000  → OutSnare:0.850  ✅
L287:  SnareE:0.534  RawΔ:0.239  WNS:0.637  → OutSnare:0.850  ✅
L465:  SnareE:0.645  RawΔ:0.419  WNS:0.878  → OutSnare:0.850  ✅
L488:  SnareE:0.569  RawΔ:0.589  WNS:0.748  → OutSnare:0.850  ✅
L498:  SnareE:0.176  RawΔ:0.637  WNS:0.998  → OutSnare:0.850  ✅
```

WNS 0.14–1.00, SnareE 0.05–0.78, RawΔ 0.22–0.94. **Todos detectados correctamente.** El OMNI-GATE v3 brilla aquí: clause 1b (`SnareE > 0.15 AND WNS > 0.05`) captura los snares con WNS moderado, y clause 2 (`WNS > 0.10 AND BassE > 0.40`) captura los borderline.

#### 4. Casos borderline — algunos missed snares

El usuario menciona "algunas pistas tienen missed snare". Mirando los datos:

```
L589:  SnareE:0.589  RawΔ:0.097  Flux:0.289  WNS:0.758  → OutSnare:0.000  ❌ MISSED
```

L589 tiene WNS 0.758 (snare real claro) pero RawΔ 0.097 está por debajo del `finalSnareThreshold`. El snare es real pero el transiente es suave. **El gate de RawΔ es demasiado estricto para snares suaves de reguetón.**

**Posible fix para missed snares en latino**: Si WNS > 0.50 (snare confirmado por ruido broadband), bajar el `finalSnareThreshold` o usar un path alternativo con WNS como gate principal:

```
// Path 3 (nuevo): WNS-confirmed soft snare
if (wns > 0.50 && rawSnareDelta > 0.05 && spectralFlux > dynamicFluxGate) {
  rawOnset = true
}
```

Esto capturaría L589 (WNS 0.758, RawΔ 0.097) sin abrir la puerta a kicks (WNS 0.000).

### Comparativa de texturas: Reguetón vs Gravity/Techno

| Dimensión | Reguetón (latino) | Gravity (techno) |
|-----------|-------------------|------------------|
| Bass bleed a snare | Bajo (RawΔ ≤ 0.14) | **Alto** (RawΔ 0.10–0.73) |
| WNS en kicks | 0.000 (limpio) | 0.000 (limpio) |
| WNS en snares | 0.14–1.00 | 0.08–0.98 |
| SnareE en kicks | 0.00–0.93 | **0.48–1.00** |
| SnareE en snares | 0.05–0.78 | 0.49–0.72 |
| Discriminador efectivo | **RawΔ** + WNS | Solo WNS (insuficiente) |
| OMNI-GATE v3 | ✅ Funciona perfecto | ❌ Kicks falsos por clause 1a |

### Insight fundamental

**El problema de gravity NO es el OMNI-GATE v3. Es la mezcla de gravity.**

Gravity tiene un bass tan extremo y con tanto bleed que los kicks producen transientes afilados en la banda de snare (RawΔ alto) con SnareE alto. **Para el OMNI-GATE, estos kicks son indistinguibles de snares sintéticos de Anyma** (SnareE alto, WNS 0, RawΔ alto).

El reguetón no tiene este problema porque:
1. El bass está más controlado en la mezcla
2. Los kicks de reguetón son más secos (menos bleed)
3. La separación de bandas es más limpia

**Conclusión**: El OMNI-GATE v3 está bien calibrado para música con separación espectral normal (reguetón, latino, pop). Gravity es un caso patológico que requiere o:
- Mejorar la separación de bandas en el análisis FFT
- Añadir BassΔ como discriminador (ver sección anterior)
- Un perfil específico para tracks con bass extremo

### Recomendación para el arquitecto

1. **No tocar el perfil latino** — está funcionando maravillosamente. Los ghostCaps que acabamos de eliminar (WAVE 7749.57) deberían mejorar el contraste sin romper nada.
2. **Considerar Path 3 (WNS-confirmed soft snare)** para los missed snares en reguetón — pero solo si el arquitecto lo aprueba, ya que podría abrir la puerta a otros falsos positivos.
3. **El fix de gravity debe ser específico a techno** — no subir WNS en clause 1b globalmente porque mataría los snares reales de gravityrythm (WNS 0.08–0.14). Usar BassΔ como discriminador adicional en clause 1a es la vía más prometedora.
