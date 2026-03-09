# 🔥 WAVE 2166 — DESNUDAR EL AUTOCORRELADOR

**Commit:** `29259b7`
**Fecha:** Sesión actual
**Archivo modificado:** `electron-app/src/workers/senses.ts`

---

## LA EPIFANÍA

Después de 7 WAVEs (2159-2165) y 1 semana intentando filtrar la señal de onset,
la respuesta estaba en el log todo el tiempo:

```
F1680 bpm=131 conf=0.474  ← LA LECTURA MÁS ALTA DEL LOG ENTERO
```

Cuando el autocorrelador recibió energía REAL (durante el drop), calculó **131 BPM
con confianza 0.474**. Estamos a 5 BPM de 126.

**El motor FUNCIONA. Solo estábamos matando de hambre su entrada.**

---

## CEMENTERIO DE FILTROS (WAVEs 2159-2165)

| WAVE | Filtro | Causa de muerte |
|------|--------|-----------------|
| 2159 | Centroid Sniper (>1500Hz) | Mataba kicks reales con click agudo |
| 2160 | Raw low flux only | PM2 debounce comía offbeats |
| 2161 | GodEarBPMTracker + Shark Fin | Thin spikes, BPM errático |
| 2162 | FFT pre-AGC + fire Sniper | Hi-hats inundaban sin sniper |
| 2163 | Restore Sniper only | Rolling bass pasaba ambos gates |
| 2164 | √(low×mid) multiplicativa | Aplastaba 65% de energía real del kick |
| 2165 | Portero Lógico (midFlux>0.001) | midFlux=0 en kicks reales de Brejcha |

### La prueba irrefutable (debugBPM.md):

```
F1960  lowFlux=0.2939  midFlux=0.0000  needle=0.0000  centroid=121Hz
       ← EL KICK MÁS FUERTE DEL LOG. BLOQUEADO POR midFlux=0.

F1820  lowFlux=0.2007  midFlux=0.0000  needle=0.0000  centroid=119Hz
       ← OTRO BOMBAZO. BLOQUEADO.

F1040  lowFlux=0.0965  midFlux=0.0000  needle=0.0000  centroid=92Hz
       ← KICK MASIVO A 92Hz PURO. BLOQUEADO.
```

---

## DIAGNÓSTICO RAÍZ

Los kicks de Boris Brejcha son **sub-bass puro** (centroid 70-150Hz).
No tienen "click" en 800-3000Hz. El rawMidEnergy es CERO cuando el kick pega.

El rolling bass de Brejcha TAMBIÉN es sub-bass puro (~centroid 100-200Hz).

**Son gemelos espectrales — imposible separarlos por banda de frecuencia.**

Cada filtro que inventemos para matar al bajo rodante, también mata al kick.

---

## LA SOLUCIÓN: DESNUDAR

### Qué se eliminó:
- ❌ Gatekeeper (`midFlux > 0.001` → pass rawLowFlux, else 0)
- ❌ Sniper (`needle > 0.015 && centroid > 1500Hz` → needle = 0)
- ❌ TODA la lógica de filtrado EXODIA (5 piezas → 0 piezas)

### Qué queda:
```
Audio(2048) → RingBuffer(4096) → FFT(raw, pre-AGC) → AGC(UI)
  → subEnergy = rawSubBass + rawBassOnly  (0-250Hz)
  → rawLowFlux = max(0, subEnergy - prevSubEnergy)
  → needle = rawLowFlux                    ← DIRECTO, SIN FILTROS
  → SharkFin: fatNeedle = max(needle, fatNeedle × 0.85)
  → GodEarBPMTracker.process(fatNeedle, false, deterministicTimestamp)
```

### Por qué funciona (teoría):

1. **Kick en el beat + bass en el offbeat = ambos periódicos a 126 BPM**
   - El kick repite cada 476ms. El bass repite cada 476ms (desfasado 238ms).
   - La autocorrelación en lag≈476ms ve el patrón completo kick+bass.
   - La periodicidad a 126 BPM es MÁXIMA.

2. **El bass no confunde al autocorrelador — lo AYUDA**
   - Kick+bass juntos crean un patrón más rico y regular que cualquiera solo.
   - La autocorrelación suma productos: kick×kick + bass×bass ≈ doble evidencia.

3. **Hi-hats no inundan (post FFT-pre-AGC)**
   - Sin AGC amplificando agudos, la señal raw tiene sub-bass dominante.
   - lowFlux de kick: 0.20-0.29. midFlux de hihat: 0.01-0.03.
   - Órdenes de magnitud de diferencia → autocorrelación dominada por graves.

4. **El Harmonic Sieve + Octave Lock manejan octavas**
   - Si la autocorrelación ve picos en 126 Y 63 (o 252), el sieve prefiere
     el fundamental. El Octave Lock requiere 8 scans consecutivos para 2×/0.5×.

---

## ESTADO

- ✅ TSC compila limpio
- ✅ 31/32 tests pasan (el fallo es pre-existente: kick phase crossing)
- ✅ Commit `29259b7`
- 🧪 PENDIENTE: Test con Boris Brejcha en producción

---

## QUÉ BUSCAR EN EL PRÓXIMO LOG

### Escenario óptimo:
```
[SHARK] F1000 bpm=126 conf=0.400+ needle=0.2007 fin=0.2007
```
- BPM estable ~126
- conf > 0.30 (autocorrelación fuerte)
- needle SIEMPRE > 0 cuando hay lowFlux (ya no hay zeros fantasma)

### Escenario a vigilar:
```
[SHARK] F1000 bpm=252 conf=0.300
```
- Si lee 252 en lugar de 126 = autocorrelación ve el patrón a doble velocidad
  (kick + bass juntos = 2× la frecuencia del beat).
- Solución: ajustar OCTAVE_LOW_PREFERENCE o reducir MAX_BPM.

### Escenario de pánico:
```
[SHARK] F1000 bpm=63 conf=0.200
```
- Lee la mitad. El octave lock debería evitar esto, pero si ocurre,
  el harmonic sieve necesita ajuste.
