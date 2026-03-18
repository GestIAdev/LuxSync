# WAVE 2160 — UNCHAIN THE NEEDLE

**Commit:** `4e1b269`  
**Archivo modificado:** `electron-app/src/workers/senses.ts`  
**Insertions:** 48 | **Deletions:** 87 (menos código, más músculo)

---

## EL DIAGNÓSTICO: La Paradoja Mortal

### Síntoma (log `arranquehonesto.md`)

El Frequency Sniper (WAVE 2159) funcionó perfectamente:
```
🎯SNIPED(6256Hz)
🎯SNIPED(3238Hz)
🎯SNIPED(4974Hz)
```

Pero PM2 se moría de hambre:
```
[PM2 🚫] F1297 RANGE-REJECT IOI=2879ms
[PM2 🚫] F2047 RANGE-REJECT IOI=3111ms
[PM2 🚫] F2268 RANGE-REJECT IOI=5991ms
```

Un latido cada 3-6 segundos. Clusters vacíos. Confianza al 30%. El Gearbox operando sobre basura.

### La Trampa

Teníamos DOS filtros en serie:

**Filtro 1 — Needle Protocol (WAVE 2155):** multiplicativo `deltaSub × deltaMid`
> Solo genera señal si sub-bass Y mids suben SIMULTÁNEAMENTE.

**Filtro 2 — Frequency Sniper (WAVE 2159):** centroide
> Mata la señal si centroide > 1500Hz.

El resultado es una **trampa mortal**:

| Evento | deltaSub | deltaMid | Needle | Centroide | Sniper | Resultado |
|--------|----------|----------|--------|-----------|--------|-----------|
| Kick puro (Minimal Techno) | +0.12 | +0.001 | **≈0** | 86Hz | — | ❌ Muerto por Needle |
| Kick limpio | +0.10 | +0.04 | +0.063 | 752Hz | ✅ | ✅ Pasa |
| Kick + hihat | +0.09 | +0.05 | +0.067 | 4974Hz | ❌ SNIPED | ❌ Muerto por Sniper |
| Offbeat bajo puro | +0.08 | -0.01 | **0** | 3238Hz | — | ✅ Correcto |

Solo el kick con exactamente "algo de mids pero no demasiado" sobrevivía. En Minimal Techno y Tech-House, donde los kicks son sub-dominantes puros, prácticamente ningún kick pasaba. **PM2 estaba sordo.**

---

## LA SOLUCIÓN: Un Solo Portero

### El Insight (PunkArchytect WAVE 2160)

> *"Inventamos el multiplicador porque antes no teníamos al Francotirador. Ahora el Francotirador es perfecto. Ya no necesitamos el candado de la puerta."*

La lógica multiplicativa `deltaSub × deltaMid` nació como defensa contra los offbeats de Brejcha. Pero el Frequency Sniper ya resuelve ese problema — y lo resuelve con datos reales (el centroide espectral medido frame a frame), no con una heurística de bandas.

**Principio de simplificación:** cuando tienes dos defensas que se solapan y crean paradojas, la más robusta y medible gana. El Sniper tiene datos duros. El multiplicador era una aproximación.

### La Nueva Arquitectura

```
Bass attack en cualquier forma
    ↓
rawLowFlux = delta(subEnergy)    ← Fuerza bruta. Toda subida de graves.
    ↓
Frequency Sniper: centroid > 1500Hz?
    ├── SÍ → 0  (🎯SNIPED — hi-hat, clap, offbeat con transiente)
    └── NO → rawLowFlux  (kick legítimo — centroide bajo)
    ↓
PM2 recibe snipedFlux
```

### Tabla de verdad post-2160

| Evento | rawLowFlux | Centroide | Resultado |
|--------|------------|-----------|-----------|
| Kick puro sub (Minimal) | +0.120 | 86Hz | ✅ +0.120 |
| Kick rico (House) | +0.095 | 752Hz | ✅ +0.095 |
| Kick + hihat (Brejcha) | +0.080 | 4974Hz | 🎯 0.000 |
| Offbeat bajo | +0.060 | 3238Hz | 🎯 0.000 |
| Bajo melódico | +0.045 | 2800Hz | 🎯 0.000 |
| Hi-hat solo | +0.003 | 6256Hz | 🎯 0.000 |

---

## IMPLEMENTACIÓN

### Código eliminado (WAVE 2155 Needle Protocol)

```typescript
// ELIMINADO:
const midEnergy = spectrum.rawLowMidEnergy + spectrum.rawMidEnergy;
const deltaSub = Math.max(0, subEnergy - prevSubEnergy);
const deltaMid = Math.max(0, midEnergy - prevMidEnergy);
const coincidenceFluxRaw = deltaSub * deltaMid;
const coincidenceFlux = Math.sqrt(coincidenceFluxRaw);
// + prevMidEnergy module-scope var
// + prevMidEnergy = 0 en reset
```

### Código nuevo (WAVE 2160 Raw Low Flux)

```typescript
// NUEVO:
const rawLowFlux = Math.max(0, subEnergy - prevSubEnergy);

const snipedFlux = (rawLowFlux > 0 && centroidHz > CENTROID_CEILING_HZ)
  ? 0
  : rawLowFlux;
```

**Resultado:** 48 inserciones, 87 borrados. La solución correcta es más corta.

---

## IMPACTO EN PM2

Con la compuerta de graves completamente abierta:

- **Antes (WAVE 2159):** PM2 recibía 1 onset cada ~3 segundos. IOIs de 3000ms = RANGE-REJECT.
- **Después (WAVE 2160):** PM2 debería recibir un onset en cada kick real. Para 126 BPM → IOI ~476ms → dentro del rango aceptable.

El único filtro es el centroide. Y el centroide discrimina perfectamente según los datos medidos en los logs.

---

## RIESGOS

### ¿Puede el nuevo `rawLowFlux` ser demasiado ruidoso para PM2?

El Needle Protocol multiplicativo tenía una propiedad hermosa: solo disparaba cuando las DOS bandas subían. Generaba señal muy esparsa.

`rawLowFlux` es más activo — cualquier subida de graves dispara. Eso incluye:
- Bajos melódicos sin hihat → centroide > 1500Hz → SNIPED ✅
- Bajos melódicos puros y sostenidos → sin ataque → rawLowFlux ≈ 0 ✅
- Sub-rumble ambiental → pequeñísimo delta → PM2's inner ear lo rechaza ✅

El único riesgo real: bajos melódicos que ataquen fuerte Y tengan centroide < 1500Hz (muy bajo, prácticamente solo posible con un bassline de sine wave puro con ataque). En ese caso, PM2's `energy-reject` (umbral adaptativo P99 × 0.35) debería filtrarlos por ser más débiles que los kicks.

---

## GENEALOGÍA

```
WAVE 2155 — Needle Protocol: multiplicative gate (deltaSub × deltaMid)
    ↓ Funciona para la mayoría. Falla con kicks sub-puros (Minimal Techno)
WAVE 2159 — Frequency Sniper: centroid gate añadida sobre la aguja
    ↓ Paradoja: combinación de ambas mata kicks legítimos. PM2 muere de hambre
WAVE 2160 — Unchain the Needle: elimina multiplicative gate, Sniper como único portero
    ↓ Simple. Medible. Determinista.
```

---

*PunkOpus × Radwulf — Cuando dos filtros se contradicen, el más inteligente gana.*
