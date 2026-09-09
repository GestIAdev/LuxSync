Searched for files matching `**/liquidenginebase.ts`, no matches

Searched for regex `liquidengine|LiquidEngine`, 20 results

Read [](file:///c%3A/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/docs/4dcalib/snarebackRreport.md#1-1), lines 1 to 150

Read [](file:///c%3A/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/hal/physics/LiquidEngineBase.ts#806-806), lines 806 to 1091

Perfecto. Te dejo el resumen quirúrgico del **Back R de Techno** en el snare:

---

## 📐 **ENVELOPES DEL SNARE BACK R — TECHNO**

### **1. Core Impulse Decay (El envelope maestro)**

```typescript
// LiquidEngineBase.ts L959-977
if (rawOnset) this._snareImpulse = 1.0
const snareImpulseThisFrame = this._snareImpulse
this._snareImpulse *= (p.snareImpulseDecay ?? 0.65)  // techno: 0.65

hybridSnare = snareImpulseThisFrame  // El impulso vivo entra aquí
```

**Techno:** `snareImpulseDecay = 0.65`
- Decay: 1.0 → 0.65 → 0.42 → 0.27 → 0.18 
- **~200ms de vida útil** (a 44Hz)

---

### **2. Sustain Choke — Cerrojos del Tail**

```typescript
// LiquidEngineBase.ts L996-1017
if (snareOnsetThisFrame) {
  _snareSustainFrames = 0
  _snareChokeFactor = 1.0
} else {
  _snareSustainFrames++
  
  // ⚒️ EL CERROJO: Si pasaron frames y la energía se murió
  if (_snareSustainFrames > chokeThreshold && rawSnareEnergy < 0.15) {
    _snareChokeFactor *= (p.snareChokeRate ?? 0.85)  // techno: 0.85
  } else if (rawSnareEnergy >= 0.15) {
    _snareChokeFactor = 1.0  // NO CHOKA si hay percussion activa
  }
}

hybridSnare *= _snareChokeFactor
```

**Techno:**
- `snareChokeFrames = 15` (~300ms antes de que cierre)
- `snareChokeRate = 0.85` (decay suave del choke)
- **PERO:** Si `snareEnergy >= 0.15` → **el cerrojo NUNCA se activa** — asume percussion viva
- En techno denso, el EMA de snare_energy se mantiene > 0.15 entre hits → el choke **never fires** → el impulso decay es **puro** a través de `snareImpulseDecay`

---

### **3. Tonality Veto (El filtro morfológico)**

```typescript
// LiquidEngineBase.ts L1040-1091
// 3 ejes con rampa lineal floor→knee
const fluxGate = clamp(
  (spectralFlux - 0.05) / (0.20 - 0.05),
  0, 1
)
const wnsGate = clamp(
  (wns - 0.04) / (0.20 - 0.04),
  0, 1
)
const flatnessGate = clamp(
  (flatness - 0.04) / (0.10 - 0.04),
  0, 1
)

// AVERAGE (no AND mult)
const vetoFactor = (flatnessGate + wnsGate + fluxGate) / 3.0

hybridSnare *= (vetoFactor > 0.15 ? 1.0 : (vetoFactor / 0.15))
```

**En Techno (denso):**
- Flatness ≈ 0 (trash)
- WNS ≈ 0 (snares sintetizados)
- **Flux lleva TODO** → el average sobrevive desde Flux solo
- Ejemplo real: `flux=0.97, wns=0, flat=0.34 → avg=0.44 → PASSES`

---

## 🎯 **ALGORITMO SNARE BACK R — REDUCIDO A LO ESENCIAL**

```
┌─────────────────────────────────────────────────────────────┐
│ INPUT: raw_snare_delta, snare_energy, spectralFlux, WNS    │
└───────────────┬─────────────────────────────────────────────┘
                │
    ┌───────────┴────────────────────────┐
    │ 5 PATHS DE ONSET (L806-955)        │
    │ (Cascada OR — primero que pase)    │
    │                                     │
    │ Path 1: WNS confirmed              │ → rawOnset = true
    │ Path 2: High-Flux (MAIN TECHNO)    │
    │ Path 3: Energy hybrid              │
    │ Path 4: WNS soft                   │
    │ Path 5: Pending WNS latency fix    │
    └───────────┬────────────────────────┘
                │ rawOnset
                ▼
    ┌─────────────────────────────────┐
    │ IMPULSE DECAY (L959-977)        │
    │ _snareImpulse *= 0.65 per frame │ → hybridSnare = impulse
    │ (Decay: 1.0→0.65→0.42→0.27)    │
    └───────────┬─────────────────────┘
                │ hybridSnare (pre-choke)
                ▼
    ┌─────────────────────────────────┐
    │ SUSTAIN CHOKE (L996-1017)       │
    │ IF snareEnergy >= 0.15:         │
    │    NO CHOKE (percussion viva)   │ → hybridSnare *= 1.0
    │ ELSE:                            │
    │    _snareChokeFactor *= 0.85    │ → hybridSnare *= factor
    │    (15-frame cooldown)           │
    └───────────┬─────────────────────┘
                │ hybridSnare (post-choke)
                ▼
    ┌──────────────────────────────────┐
    │ TONALITY VETO (L1040-1091)       │
    │ avg(fluxGate, wnsGate, flatGate) │ → hybridSnare *= veto
    │ Techno: Flux lleva todo          │
    └───────────┬──────────────────────┘
                │
                ▼
    ┌────────────────────────────────────┐
    │ OUTPUT: hybridSnare (0.0-1.0)      │
    │ Feed → Back R LFO modulation       │
    └────────────────────────────────────┘
```

---

## 🔒 **CERROJOS ESPECÍFICOS: "7 frames / 2 en density"**

Eso que buscas probablemente esté en el **chokeThreshold** o en algún parámetro de modo density. Déjame buscar eso exacto: 

Searched for text `7 frames|density.*2|snareChokeFrames|tail` (`**/*LiquidEngine*.ts`), 20 results

Read [](file:///c%3A/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/hal/physics/LiquidEngineBase.ts#355-355), lines 355 to 410

Searched for text `density.*2|2.*density|mode.*density` (`**/*LiquidEngine*.ts`), 6 results

Read [](file:///c%3A/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/hal/physics/LiquidEngineBase.ts#1395-1395), lines 1395 to 1420

---

## 🔐 **CERROJOS ESPECÍFICOS DEL TAIL — "7 FRAMES / 2 EN DENSITY"**

### **Cerrojo 1: GHOST_REFRACTORY_FRAMES = 7**

```typescript
// LiquidEngineBase.ts L364-366
// ⚒️ WAVE 7749.91: 10→7 frames
private static readonly GHOST_REFRACTORY_FRAMES = 7
```

**¿Qué hace?**
- Mata **reverb-tail re-fires** (200-400ms de tail tras un snare real)
- **7 frames = 159ms @ 44Hz**
- Permite que los **16th roll snares respiren** (125ms = 5.5 frames a 120 BPM)
- `_ghostRefractoryFrames` se decrementa cada frame; mientras sea > 0, **el path ghost está muerto**

**Contexto:** 
- Antes: `GHOST_REFRACTORY_FRAMES = 10` (227ms) bloqueaba cada otro snare roll
- Ahora: 7 frames mata reverbs pero deja rolls intactos

---

### **Cerrojo 2: DENSITY_REFRACTORY = 2**

```typescript
// LiquidEngineBase.ts L1403-1409
// ⚒️ WAVE 7749.106: DENSITY REFRACTORY
if (snareDrive >= snareFloor) {
  rawOnset = true
  this._snareRefractoryFrames = 2  // ← DENSITY MODE
  this._ghostRefractoryFrames = GHOST_REFRACTORY_FRAMES
}
```

**¿Cuándo entra Density Mode?**
- Cuando: `fluxBaseline > 0.09` (notas densidad espectral alta)
- Y: `gateHealth < 0.05` (la crack-band gate está muerta)
- Y: `ungatedSnare > 0.45` (la energía cruda del snare es fuerte)
- Y: Already on snare momentum detector (`snareDriveSpeed >= snareFloor`)

**¿Cuándo entra Standard Mode?**
```typescript
else if (rawOnset) {
  this._snareRefractoryFrames = SNARE_REFRACTORY_FRAMES  // default ~4
}
```

**El truco:**
- **Density mode = 2 frames (45-68ms)** → firing rápido en ruido blanco continuo
- **Standard mode = 4 frames (~90ms)** → spacing normal entre hits
- El cambio es **automático según densidad** → no hay switch manual

---

### **Back R Integration — Dónde Entra el Envelope**

El `hybridSnare` (output del pipeline) **modula el Back R** del fixture:

```
hybridSnare = impulse (0-1) × choke × tonality-veto
      ↓ (pasa al Back R LFO/modulation)
back-r = r_value × hybridSnare
      ↓ (Si hybridSnare = 1.0, back-r es rojo puro)
      ↓ (Si hybridSnare = 0.3, back-r es rojo 30%)
```

Los **cerrojos de 7 y 2 frames** bloquean **re-triggers** (choques de reverb), no el envelope mismo. El envelope sigue decayendo limpiamente con `snareImpulseDecay = 0.65`.

Resumen quirúrgico: **7 frames mata la cola del reverb; 2 frames en densidad ajusta el trigger spacing para pintar luz blanca continua sin gaps.**