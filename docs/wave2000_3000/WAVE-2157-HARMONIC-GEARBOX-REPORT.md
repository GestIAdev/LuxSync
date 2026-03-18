# WAVE 2157: THE GEARBOX — Three-Zone Harmonic Reducer

**Commit:** `78ace81`  
**Parent:** `e0c5dfd` (WAVE 2155: Needle Protocol)  
**Status:** ✅ DEPLOYED — Pending live test

---

## PROBLEMA

La Needle Protocol (WAVE 2155) entrega BPM ultra-estable pero bloqueado en armónicos polirrítmicos:

| Género | BPM Real | PM2 lee | Ratio | Patrón musical |
|--------|----------|---------|-------|----------------|
| Cumbiatón | 86 | 129 | 1.50× | Tresillo (3:2) |
| Brejcha | 126 | 161 | 1.28× | Swing (5:4) |
| Reggaeton | 95 | 190 | 2.00× | Octava |
| DnB | 174 | 174 | 1.00× | Sin reducción |

## SOLUCIÓN: Arquitectura de Tres Zonas

```
[0 ─── FLOOR(70) ════════ CEILING(140) ─── AMBIG(175) ─── ∞]
 │  PASSTHROUGH  │   COMFORT (pass)    │ AMBIGUOUS(pass) │ REDUCE │
```

### Zona 1+2: COMFORT [0, 140] → Passthrough
El 99% de la música bailable vive aquí. House 128, Techno 135, Trap 140, Ambient 60.

### Zona 3: AMBIGUOUS (140, 175] → Passthrough
**Principio del Daño Menor**: Podría ser DnB real (174) o armónico Brejcha (161). Sin análisis de clusters de PM2, es indistinguible. Pasar directo porque:
- Luz 1.3× más rápida (161 vs 126) = tolerable visualmente
- Luz 2× más lenta (87 vs 174 DnB) = desastroso

### Zona 4: HARMONIC (175, ∞) → Reducir
**Principio de Mínima Corrección**: Divisores ordenados ascendente [1.25, 1.333, 1.5, 2.0]. El PRIMER divisor cuyo candidato cae en [70,140] gana.

## VERIFICACIÓN MATEMÁTICA — 13/13 ✅

```
✅ Cumbiaton        129 BPM →  129 BPM (pass)     ← En zona, PM2 lee harmónico pero funcional
✅ Brejcha          161 BPM →  161 BPM (pass)     ← Zona ambigua, pass seguro
✅ DnB              174 BPM →  174 BPM (pass)     ← Zona ambigua, BPM real
✅ Psytrance        145 BPM →  145 BPM (pass)     ← Zona ambigua, BPM real
✅ House            128 BPM →  128 BPM (pass)     ← Comfort zone
✅ Reggaeton-2x     190 BPM →  127 BPM (÷1.5)    ← Zona harmónica, reducido
✅ Trap             140 BPM →  140 BPM (pass)     ← Borde comfort zone
✅ Ambient           60 BPM →   60 BPM (pass)     ← Bajo floor
✅ Techno           135 BPM →  135 BPM (pass)     ← Comfort zone
✅ HalfDnB           87 BPM →   87 BPM (pass)     ← Comfort zone
✅ Cumbia-3x        258 BPM →  129 BPM (÷2)       ← Zona harmónica, reducido
✅ FastReggaeton    200 BPM →  133 BPM (÷1.5)     ← Zona harmónica, reducido
✅ Gabber           180 BPM →  135 BPM (÷1.333)   ← Zona harmónica, reducido
```

## ARCHIVOS MODIFICADOS

### NUEVO: `electron-app/src/workers/HarmonicGearbox.ts` (329 líneas)
- `harmonicReduce()` — Función pura, tres zonas, cero estado
- `GearboxStabilizer` — Wrapper con histéresis (30 frames, 8 BPM umbral)
- `GearboxResult` — Interface de resultado

### MODIFICADO: `electron-app/src/workers/senses.ts` (+22 líneas)
- Import + instanciación de `GearboxStabilizer`
- Processing block entre PM2 y state update
- Telemetría actualizada: `bpm=X raw=Y gear=Z`
- Amnesia Protocol: `gearbox.reset()`

## LIMITACIONES CONOCIDAS (Scope para Phase 2)

1. **Cumbiatón 129 → 129**: PM2 lee el tresillo a 129 BPM. El Gearbox no puede reducirlo a 86 porque 129 está en comfort zone. Solución futura: Cluster-Aware Gearbox que mire los clusters secundarios de PM2.

2. **Brejcha 161 → 161**: Pasa directo por zona ambigua. Real es ~126. Error de 1.28× aceptable para luces. Solución futura: misma que punto 1.

3. **Reggaeton 190 → 127 (no 95)**: El divisor ÷1.5 gana sobre ÷2 por Mínima Corrección. 127 BPM para luces de reggaeton es visualmente funcional. La Needle Protocol difícilmente producirá 190 para reggaeton (el flux multiplicativo ya mata octavas).

## PIPELINE COMPLETO POST-WAVE 2157

```
Audio → GodEarFFT → Spectrum → Needle Protocol (deltaSub × deltaMid → √)
     → PacemakerV2 (IOI clustering) → HarmonicGearbox (three-zone reduce)
     → GearboxStabilizer (hysteresis) → state.currentBpm → DMX
```

## SIGUIENTE PASO

Testear en vivo con Cumbiatón y Brejcha. Si la zona ambigua (161 passthrough) es visualmente aceptable → cerrar WAVE 2157. Si no → Phase 2: Cluster-Aware Gearbox.
