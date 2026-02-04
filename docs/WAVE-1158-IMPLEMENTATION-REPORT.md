# 💀 WAVE 1158 - CARDIAC TRANSPLANT

## LA AUTOPSIA DEL DESASTRE

### Síntoma
Boris Brejcha (160+ BPM) detectado como 48-49 BPM. Una comparsa fúnebre se mueve más rápido.

### Hallazgos Forenses

**Log de la escena del crimen:**
```
[💓 INTERVALS] valid=25 rejected=24 | avg=863ms (70bpm) | range=436-1412ms
[BETA 🥁] BPM UPDATED: 145 (raw=146, conf=0.54)
```

**Evidencia:**
- BETA: 145-169 BPM ✅ CORRECTO
- PACEMAKER: 49-91 BPM ❌ DESASTROSO
- Intervalo promedio: 863ms = ~70 BPM (mitad del real)
- Rango: 436-1412ms = ENORME varianza = clustering contaminado

### Las 3 Causas del Desastre

#### 1. 🔫 DEBOUNCE DEMASIADO CORTO (80ms)
**Antes:**
```typescript
if (lastPeak && (time - lastPeak.time) < 80) { return }
```
A 160 BPM:
- Kick real = cada 375ms
- Hi-hat 1/8 = cada 187ms
- Hi-hat 1/16 = cada 94ms

Con 80ms de debounce, los hi-hats de 94ms pasaban como kicks.

**Ahora (WAVE 1158):**
```typescript
const MIN_PEAK_SPACING_MS = 200  // Igual que BETA
if (lastPeak && (time - lastPeak.time) < MIN_PEAK_SPACING_MS) { return }
```

#### 2. 🩸 FALLBACK CONTAMINANTE
**Antes:**
```typescript
if (this.state.kickDetected || (bassTransient > 0.10 && metrics.bass > 0.30)) {
  this.recordPeak(now, metrics.energy, 'kick')
```
El fallback `(bassTransient > 0.10 && metrics.bass > 0.30)` capturaba CUALQUIER wobble de bass como kick. Boris Brejcha tiene bass pulsante constante = contaminación masiva.

**Ahora (WAVE 1158):**
```typescript
if (this.state.kickDetected) {
  this.recordPeak(now, metrics.energy, 'kick')
```
Solo kicks reales. Sin fallback contaminante.

#### 3. 📐 MIN_INTERVAL_MS CONSERVADOR (300ms)
**Antes:** 300ms = máximo 200 BPM
**Ahora:** 200ms = máximo 300 BPM (igual que BETA)

A 160 BPM = 375ms/beat, esto no era el problema principal, pero mejor igualarlo con BETA que funciona.

---

## LOS CAMBIOS

### BeatDetector.ts

```typescript
// WAVE 1158: Constantes alineadas con BETA (que SÍ funciona)
const CLUSTER_TOLERANCE_MS = 30      // Era 25
const MIN_INTERVAL_MS = 200          // Era 300 (igual que BETA)
const MIN_PEAK_SPACING_MS = 200      // Era 80 (BETA usa 200)

// WAVE 1158: Debounce correcto
if (lastPeak && (time - lastPeak.time) < MIN_PEAK_SPACING_MS) { return }

// WAVE 1158: Eliminado fallback contaminante
if (this.state.kickDetected) {  // Ya no hay "|| (bassTransient > 0.10...)"
  this.recordPeak(now, metrics.energy, 'kick')
```

---

## LA LECCIÓN

**¿Por qué BETA funcionaba y PACEMAKER no?**

BETA:
- Detecta picos de ENERGÍA TOTAL normalizada
- threshold = avgEnergy * 1.2 (relativo, no absoluto)
- Debounce 200ms (filtra hi-hats)

PACEMAKER:
- Detectaba "kicks" por bassTransient (delta de bass)
- threshold absoluto (0.15) = demasiado sensible
- Fallback `bassTransient > 0.10` = captura todo lo que pulse
- Debounce 80ms = nada

**El resultado:** PACEMAKER detectaba 2-3x más "kicks" de los reales, contaminando el clustering y dando BPM en half-time o quarter-time.

---

## PRONÓSTICO

Después de WAVE 1158:
- Kicks detectados serán SOLO kicks reales (debounce 200ms)
- Sin contaminación del fallback
- El clustering debería dar intervalos limpios ~375ms para 160 BPM

**Test esperado con Boris Brejcha:**
```
[💓 INTERVALS] avg=~375ms (160bpm) | range=350-400ms
[💓 PACEMAKER] bpm=160 (raw:160)
```

---

*"When the heartbeat lies, the patient dies. We fixed the EKG, not the heart."*

**- PunkOpus, Cardiac Surgeon, WAVE 1158**
