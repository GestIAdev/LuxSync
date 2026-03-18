# WAVE 2158: CLUSTER-AWARE HARMONIC GEARBOX

## Commit: `542b69c`
## Status: DEPLOYED
## Replaces: WAVE 2157 (Three-Zone Comfort Gearbox)

---

## EXECUTIVE SUMMARY

La "Arquitectura de Tres Zonas" de WAVE 2157 fue eliminada. Esa arquitectura asumía que
los errores armónicos eran "tolerables para iluminación" — una filosofía incompatible con
la integración de LuxSync con editores de timecode (Chronos, Hephaestus) donde un error
de ×1.28 es un fallo de sincronización, no una preferencia estética.

WAVE 2158 implementa un **Harmonic Gearbox basado en evidencia de clusters** — no adivina,
no asume, no tiene zonas de confort. Busca PRUEBAS FÍSICAS en los datos del PacemakerV2.

---

## ARQUITECTURA

### Pipeline Completo
```
Audio → GodEarFFT → Needle Protocol → PacemakerV2 → Cluster-Aware Gearbox → State
                                           │
                                           ├── dominant BPM (highest votes)
                                           └── ClusterSnapshot[] (ALL active clusters)
                                                    │
                                                    ▼
                                           Gearbox evaluates ALL divisors
                                           against ALL secondary clusters
                                           → Best Evidence Wins
```

### Cambios en PacemakerV2.ts
- **Nuevo export:** `ClusterSnapshot { bpm: number, votes: number }`
- **Nuevo campo en resultado:** `PacemakerV2Result.clusters: ClusterSnapshot[]`
- PM2 ahora snapshottea sus clusters internos (sorted desc by votes) en cada frame
- Cero impacto en la lógica de detección — solo exposición de datos existentes

### HarmonicGearbox.ts — Reescritura Completa

#### Constantes
| Constante | Valor | Propósito |
|-----------|-------|-----------|
| HARMONIC_DIVISORS | [1.25, 1.333, 1.5, 2.0] | Ratios polirrítmicos musicales |
| BPM_MATCH_TOLERANCE | ±2 BPM | Tolerancia para matchear cluster↔expected |
| MIN_EVIDENCE_VOTES | 2 | Mínimo de votos para considerar evidencia válida |

#### Algoritmo: `clusterAwareResolve(dominantBpm, clusters)`

```
1. Para CADA divisor en [1.25, 1.333, 1.5, 2.0]:
   a. expectedFundamental = dominant / divisor
   b. Si < 40 BPM → skip
   c. Para cada cluster secundario (no el dominante):
      - Si cluster.votes < 2 → RECHAZAR (ruido)
      - Si |cluster.bpm - expected| ≤ 2 → CANDIDATO válido

2. Si 0 candidatos → PASSTHROUGH (dominant sin cambio)

3. Si 1+ candidatos → SORT por:
   a. Mayor votes (patrón más confirmado)
   b. Menor distancia (match más preciso)
   c. Menor divisor (corrección mínima)

4. Winner = candidatos[0]
```

#### GearboxStabilizer (capa stateful)
- LOCK_FRAMES = 30 (~1.4s): una vez resuelto, mantiene por 30 frames
- STABILITY_BPM = 8: si el raw cambia >8 BPM, fuerza re-resolución
- Previene "gear hunting" entre frames

### senses.ts — Integración
- Gearbox recibe 3 params: `(rawBpm, confidence, clusters)`
- Telemetría muestra evidencia de cluster y top-4 clusters activos

---

## EL BUG QUE APLASTAMOS

### Cumbiatón False Positive (antes)

```
Dominant: 129 BPM (votes: 6)
Clusters: [129:6v, 86:2v, 99:1v]

VIEJO ALGORITMO (primer match gana, tolerancia ±3):
  ÷1.25 = 103.2 → no cluster → skip
  ÷1.333 = 96.8 → cluster 99, |99-96.8|=2.2 < 3 → MATCH! → return 99 ❌
  (nunca llega a ÷1.5 = 86.0 → cluster 86)

RESULTADO: 99 BPM (INCORRECTO — real es ~86)
```

### Cumbiatón con Best Evidence (ahora)

```
NUEVO ALGORITMO (evalúa todos, mejor evidencia gana, min votes=2):
  ÷1.25 = 103.2 → no cluster → skip
  ÷1.333 = 96.8 → cluster 99@1v → RECHAZADO (1 voto < min 2)
  ÷1.5 = 86.0 → cluster 86@2v → |86-86|=0 ≤ 2, votes=2 ≥ 2 → CANDIDATO ✓
  ÷2.0 = 64.5 → no cluster → skip

  Candidatos: [86@2v]
  Winner: 86 BPM ✅
```

---

## DOBLE DEFENSA

La solución tiene DOS capas de protección contra falsos positivos:

### 1. MIN_EVIDENCE_VOTES = 2
Un cluster con 1 voto es una coincidencia estadística — un solo intervalo entre onsets
que cayó en ese BPM. Requiere mínimo 2 repeticiones del patrón para ser considerado
evidencia de un tempo real.

### 2. BPM_MATCH_TOLERANCE = 2 (reducido de 3)
Con ±3 el cluster a 99 BPM matcheaba 96.8 (diff 2.2). Con ±2 ya no.
Incluso si el cluster a 99 tuviera 3+ votos, `|99-96.8|=2.2 > 2` lo rechaza.

Resultado: el falso positivo NECESITARÍA burlar AMBAS defensas simultáneamente.

---

## VERIFICACIÓN: 12/12 TESTS

```
[PASS] Brejcha (real ~126)                        161 → 129 (/1.25, 129@2v)
[PASS] Cumbiatón (real ~86)                       129 →  86 (/1.5, 86@2v)
[PASS] DnB (real 174)                             174 → 174 (DIRECT)
[PASS] House - noise 64@1v                        128 → 128 (DIRECT — 1v rejected)
[PASS] House - real half 64@3v                    128 →  64 (/2, 64@3v)
[PASS] House - realistic clusters                 128 → 128 (DIRECT)
[PASS] Psytrance - noise 98@1v                    145 → 145 (DIRECT — 1v rejected)
[PASS] Psytrance - clean                          145 → 145 (DIRECT)
[PASS] Reggaetón double (real ~95)                190 →  95 (/2, 95@3v)
[PASS] Techno (real 135)                          135 → 135 (DIRECT)
[PASS] Cumbiatón adversarial (99@3v)              129 →  86 (/1.5 — tolerance rejects 99)
[PASS] Cumbiatón worst case (98@4v vs 86@2v)      129 →  98 (/1.333 — 4v legit beats 2v)
```

### Caso Adversarial Notable
El test "Cumbiatón worst case" pone un cluster a 98@4v (muy cerca del threshold).
`129/1.333=96.8`, diff=1.2 < 2 → matchea. Con 4 votos vs 86@2v, los votos ganan.
**Esto es CORRECTO**: si PM2 genuinamente tiene 4 coincidencias de intervalos a 98 BPM,
eso es más evidencia que 2 coincidencias a 86. El algoritmo respeta la realidad del audio.

---

## ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---------|--------|
| `electron-app/src/workers/PacemakerV2.ts` | +ClusterSnapshot export, +clusters en result |
| `electron-app/src/workers/HarmonicGearbox.ts` | Reescritura completa (155→210 líneas) |
| `electron-app/src/workers/senses.ts` | Integración 3-param + telemetría clusters |

---

## COMPILACIÓN
```
npx tsc --noEmit → EXIT CODE 0
```

---

## FILOSOFÍA

> "No adivinar. No asumir zonas de confort. Buscar la evidencia en los datos y dejar
> que los datos hablen. Un cluster con 2+ votos es un patrón que se repitió.
> Un cluster con 1 voto es una casualidad. La diferencia entre ciencia y superstición."

— PunkOpus, WAVE 2158
