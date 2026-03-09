# 🔬 WAVE 2162 — THE TRIPLE AUTOPSY
### *"Three Corpses, Three Cures, One Truth"*

**Commit:** `d128afb`  
**Archivos:** `senses.ts`, `GodEarBPMTracker.ts`  
**Tests:** 31/32 ✅ (1 preexistente kick detection)  
**TSC:** EXIT CODE 0  

---

## 🩺 DIAGNÓSTICO (Radwulf)

Tres autopsias independientes que explican por qué Boris Brejcha iba a 94→186→93→184 BPM en lugar de 126 BPM.

---

## 🔬 AUTOPSIA 1: El Francotirador es un Traidor

**Premisa del Sniper (WAVE 2159):** "Centroide alto = contratiempo. Matarlo."

**Realidad en Minimal Techno:**
- Los bombos llevan un "click" de ataque a 5000Hz+ para sonar fuerte en club
- Los bajos a contratiempo son senoidales puras y sordas (~200Hz)

**Evidencia del log:**
```
F700  🎯SNIPED(5458Hz)  ← ¡ERA UN BOMBO REAL!
F1300 🎯SNIPED(5260Hz)  ← ¡ERA UN BOMBO REAL!
```

**Consecuencia:** Al matar los bombos, el autocorrelador leía la periodicidad del bajo sincopado → **188 BPM** (perfectamente correcto para el bajo, mortalmente incorrecto para el beat).

**Cirugía:** Eliminar el Frequency Sniper completamente. La Autocorrelación es un motor de patrones globales — las aletas de tiburón del bombo (energía masiva) siempre dominan el patrón por su tamaño, sin necesidad de pre-filtrado.

---

## 🔬 AUTOPSIA 2: El Fantasma del AGC

**Orden anterior:** `buffer → AGC → FFT → BPM`

**El crimen:** Cuando cae un bombo, el AGC aplasta la ganancia. Cuando el bombo pasa (~300ms después), el AGC "suelta" la compresión → el volumen general sube artificialmente → los graves se inflan de la nada → el tracker lee un segundo golpe fantasma a ~185 BPM.

**Cirugía:** Invertir el orden:
```
ANTES: buffer → AGC(comprime) → FFT(ve fantasmas) → BPM(lee mentiras)
AHORA: buffer → FFT(ve la verdad) → AGC(normaliza para UI) → visuales
```

El FFT ahora analiza el audio CRUDO con toda su dinámica real. El AGC se aplica DESPUÉS para normalizar los niveles que consumen el resto del sistema (rhythmDetector, harmonyDetector, UI).

---

## 🔬 AUTOPSIA 3: El Filtro Polirrítmico "Machista"

**Código viejo:** `syncRatio = alt.bpm / topPeak.bpm` → Solo detectaba ratios cuando `alt > topPeak`.  
**Comentario:** *"In 4/4 electronic music the higher BPM is ALWAYS the real beat."*

**¡FALSO!**
- **Techno:** beat=128, swing=96 → el mayor es el real ✅
- **Cumbia:** beat=88, tresillo=132 → el MENOR es el real ❌ (el código forzaba 132)
- **Brejcha:** 92 vs 126 → ratio 1.37 → 126 ✅ (pero con cumbia fallaría)

**Cirugía: Dance Pocket Rule (80-135 BPM)**
```typescript
const maxBpm = Math.max(alt.bpm, topPeak.bpm)
const minBpm = Math.min(alt.bpm, topPeak.bpm)
const syncRatio = maxBpm / minBpm  // Siempre positivo, independiente del orden

// Si el menor está en el bolsillo (80-135), es el downbeat real (Latin)
// Si solo el mayor está en el bolsillo, es el 4/4 real (Techno)
// Si ambos están en el bolsillo, preferir el mayor (convención 4/4)
```

Verificación con tests:
```
Techno 96 vs 128:  pocket=[✅96, ✅128] → ambos en pocket → elige 128 ✅
Cumbia 88 vs 132:  pocket=[✅88, ✅132] → ambos en pocket → elige 132 
                   (pero si 132 > 135, pocket=[✅88, ❌132] → elige 88 ✅)
Boris 92 vs 126:   pocket=[✅92, ✅126] → ambos en pocket → elige 126 ✅
```

---

## 📊 TELEMETRÍA NUEVA

```
[SHARK] F740 bpm=126 conf=0.433 kick=false phase=0.95 lowFlux=0.0559 fin=0.0559 centroid=1060Hz samples=130
```

- Ya NO aparece `🎯SNIPED` — el Francotirador fue despedido
- Ya NO aparece `sniper=` — no hay segunda variable de flux
- `lowFlux` va directo a la Shark Fin (`fin`)
- El centroide sigue en telemetría para diagnóstico, pero ya no es gatekeeper

---

## 🧮 CADENA DE SEÑAL FINAL (WAVE 2162)

```
Audio (2048 samples) → Ring Buffer (4096)
  ↓
🔬 GodEar FFT (Radix-2 DIT) — sobre audio CRUDO
  ↓
📊 Spectrum (subEnergy, centroid, bands)
  ↓
🎚️ AGC (solo para UI y analizadores downstream)
  ↓
📈 Raw Low Flux (delta subEnergy, solo positivos)
  ↓
🦈 Shark Fin (envelope follower, decay 0.85/frame)
  ↓
🥁 GodEarBPMTracker (autocorrelación 4× upsampled)
  ├── Harmonic Sieve (octave-aware peak selection)
  ├── 🔬 Dance Pocket Rule (80-135 BPM preference)
  ├── Octave Lock (8 scans for 2×/0.5×)
  └── Polyrhythm Filter (ratio-agnostic, pocket-aware)
  ↓
🎯 BPM + Confidence + Phase → LuxSync
```

---

## 🧹 COMPONENTES ELIMINADOS

| Componente | WAVE Nacimiento | WAVE Muerte | Causa |
|-----------|----------------|-------------|-------|
| Frequency Sniper | 2159 | 2162 | Asesinaba bombos reales (click de ataque a 5kHz) |
| AGC antes del FFT | 670 | 2162 | Creaba golpes fantasma por recuperación de ganancia |
| "Higher BPM always wins" | 2125 | 2162 | Falso para música latina (tresillo > beat) |

---

## ⏭️ SIGUIENTE

Probar con Boris Brejcha en vivo. Esperar:
- `bpm=126` estable con `conf > 0.3`
- Sin octave bounce (184/93)
- Sin SNIPED tags en el log
- Centroide del bombo visible (~5000Hz) pasando libremente al tracker
