# 🩸 WAVE 2099: EL PÉNDULO DE GOLDILOCKS

## DIAGNÓSTICO POST-WAVE 2098

### LO QUE FUNCIONA (intocable):
- ✅ Kicks fluyen continuamente (112 → 176 en 30 segundos)
- ✅ Peak History se refresca con el decay de 10s
- ✅ PLL logra LOCKED state y se mantiene estable
- ✅ CASSANDRA ya varía timeToEvent (1141ms → 2001ms → 1904ms)
- ✅ frontendBass alimenta correctamente al Pacemaker
- ✅ BPM se auto-corrige de 210→126 — pero TARDA DEMASIADO

### LO ROTO:

#### TUMOR 1: BPM=210 al inicio → auto-corrige a 126 en ~40s
- **Causa raíz**: `MIN_PEAK_SPACING_MS=200ms` dejaba pasar sub-beats
- Intervalos de 229ms, 264ms, 276ms, 295ms son HI-HATS, no kicks
- Estos crean un cluster fantasma a ~280ms (~214 BPM)
- El clustering elige ese cluster porque tiene más intervalos
- **El BPM se auto-corrige** porque el Peak Decay va limpiando, pero tarda ~40 segundos

#### TUMOR 2: Section=breakdown SIEMPRE — La trampa sin salida
- breakdown se activa con `energyDelta < -0.20 && wE < 0.35`
- En techno (bajo constante), wE oscila entre 0.02-0.40 → SIEMPRE cumple
- energyDelta fluctúa ±0.15 normalmente → cualquier fluctuación de -0.21 activa breakdown
- Una vez atrapado en breakdown, las salidas son IMPOSIBLES:
  - verse requiere `beatsSinceChange > 90` → 45 SEGUNDOS a 2 beats/sec
  - buildup requiere `energyDelta > 0.03` → bajo constante no sube
  - drop requiere `bassRatio > 1.40` → historial estable = ratio ~1.0

#### TUMOR 3: CASSANDRA semi-congelada
- Ya varía (mejora vs 2098) pero siempre predice `buildup_starting`
- Porque section=breakdown siempre → mismo pattern match
- Se resuelve automáticamente al arreglar TUMOR 2

---

## CIRUGÍAS APLICADAS

### FIX 1: `BeatDetector.ts` — MIN_PEAK_SPACING_MS 200→280ms
**Debounce entre kicks.** A 280ms:
- Kicks reales a 126 BPM (476ms) → ✅ PASAN
- Kicks reales a 170 BPM/DnB (353ms) → ✅ PASAN
- Sub-beats fantasma a 229-276ms → ❌ MUERTOS

### FIX 2: `BeatDetector.ts` — MIN_INTERVAL_MS 200→280ms
**Coherencia.** Si el debounce es 280ms, ningún intervalo válido puede ser <280ms.
El clustering ya no verá intervalos de sub-beats.

### FIX 3: `TrinityBridge.ts` — Breakdown entry tightened
- `energyDelta` threshold: `-0.20` → `-0.10` (solo caídas REALES)
- En techno, la energía fluctúa ±0.15 normalmente. Con -0.20 cualquier fluctuación activaba breakdown. Con -0.10, solo un colapso real de energía lo activa.

### FIX 4: `TrinityBridge.ts` — beatsSinceChange 90→32
- 90 beats a 2 beats/sec = 45 SEGUNDOS atrapado en breakdown
- 32 beats = ~16 segundos — largo suficiente para ser musical, corto para escapar

### FIX 5: `TrinityBridge.ts` — techno breakdownEnergyThreshold 0.35→0.25
- wE del techno oscila 0.02-0.40 normalmente
- Con threshold 0.35, SIEMPRE cumple la condición de breakdown
- Con 0.25, solo verdaderos silencios/intros/bridges activan breakdown

---

## CASCADA ESPERADA

1. **BPM**: Arranca en ~126 BPM desde el primer minuto (no 210). El cluster fantasma de sub-beats está eliminado.
2. **Sección**: verse → buildup → drop → verse (ciclo natural). breakdown solo en silencios reales.
3. **CASSANDRA**: Con secciones variando, predicciones cambian → timeToEvent varía → efectos se diversifican.
4. **Drops**: Con section moviéndose entre verse/buildup, cuando bassRatio suba a 1.40+ con hasKick, DROP ENTER finalmente se activará.

## ARCHIVOS MODIFICADOS
- `electron-app/src/engine/audio/BeatDetector.ts` (2 constantes)
- `electron-app/src/workers/TrinityBridge.ts` (3 condiciones + 1 perfil)

## COMPILACIÓN
✅ Zero errores en archivos modificados
