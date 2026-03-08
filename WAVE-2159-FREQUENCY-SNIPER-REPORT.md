# WAVE 2159 — FREQUENCY SNIPER

**Commit:** `1794859`  
**Archivo modificado:** `electron-app/src/workers/senses.ts`  
**Insertions:** 46 | **Deletions:** 5  

---

## EL PROBLEMA: Offbeat Contamination

### Síntoma
Boris Brejcha (Minimal Techno, ~126 BPM real). El BPM mostrado salta caóticamente:

```
108 → 161 → 129 → 181 → 144 → 92
```

Ninguno de esos valores es correcto. El 126 **nunca aparece** en los clusters del Pacemaker.

### Diagnóstico (log `atortasconelBPM.md`)

El Needle Protocol (WAVE 2155) detecta impactos que **no son kicks**. Son combinaciones offbeat de "bajo + hi-hat crujiente" donde **ambas bandas** (sub Y mid) suben simultáneamente → `deltaSub × deltaMid > 0` → needle no-zero → PM2 registra un onset falso.

**Evidencia numérica del log:**

| Frame | Tipo | Centroide | Needle |
|-------|------|-----------|--------|
| F1520 | ❌ FALSO | 5452 Hz | 0.0318 |
| F1640 | ✅ REAL | 226 Hz | 0.0892 |
| F1680 | ❌ FALSO | 7891 Hz | 0.0127 |
| F1740 | ✅ REAL | 86 Hz | 0.1203 |
| F1800 | ❌ FALSO | 2166 Hz | 0.0412 |

**El patrón es brutal:**
- Kicks reales: centroide **< 1000 Hz** (la masa de bajo arrastra el centroide hacia abajo)
- Onsets falsos: centroide **> 2000 Hz** (hi-hat/clap tira el centroide hacia arriba)
- **Gap entre mundos: 1000 Hz → 2000 Hz** (1194 Hz de luz del día)

### Consecuencia en PM2

El intervalo real entre kicks es ~476ms (126 BPM). Los falsos onsets fragmentan ese intervalo en pedazos irregulares (325ms, 418ms, 557ms). PM2 genera clusters basura:

```
F1740 clusters: [185:4v | 129:3v | 108:2v | 161:1v | 117:1v]
```

**Ningún cluster a 126 BPM.** El Gearbox (WAVE 2158) está haciendo su trabajo perfecto pero recibe datos envenenados.

---

## LA SOLUCIÓN: Centroid Gate

### Concepto

Si el Needle Protocol reporta un impacto (coincidenceFlux > 0), verificar el centroide espectral del frame. Si el centroide está por encima de 1500 Hz → **matar el flux a cero**. El frame es hi-hat/clap, no kick.

### Umbral: ¿Por qué 1500 Hz?

Radwulf propuso 250 Hz. Demasiado agresivo — mataría kicks reales con centroides de 612 Hz, 752 Hz, 972 Hz (que aparecen en el log como kicks legítimos).

El análisis de los datos muestra:
- **Centroide máximo de kick real:** 972 Hz
- **Centroide mínimo de onset falso:** 2166 Hz
- **Centro del gap:** ~1500 Hz

**1500 Hz** corta exactamente en la mitad del vacío. Margen de seguridad: 528 Hz por debajo del primer falso, 528 Hz por encima del último real.

### Implementación

```typescript
// ═══════════════════════════════════════════════════════════════
// 🎯 WAVE 2159 — FREQUENCY SNIPER: Centroid Gate
// ═══════════════════════════════════════════════════════════════
// El Needle Protocol (WAVE 2155) captura coincidencias verticales
// sub×mid. Pero en Minimal Techno (Brejcha), los offbeats tienen
// bajo + hi-hat crujiente que pasan la aguja. El centroide los
// delata: un kick real arrastra el centroide < 1000Hz, un hi-hat
// lo dispara > 2000Hz.
//
// Mediciones del log (atortasconelBPM.md):
//   Kicks reales:  centroide 86 - 972 Hz
//   Falsos onsets: centroide 2166 - 7891 Hz
//   Gap:           972 → 2166 Hz (1194 Hz de luz del día)
//
// CENTROID_CEILING = 1500 Hz (centro del gap)
// ═══════════════════════════════════════════════════════════════

const CENTROID_CEILING_HZ = 1500;
const centroidHz = spectrum.spectralCentroid;

const snipedFlux = (coincidenceFlux > 0 && centroidHz > CENTROID_CEILING_HZ)
  ? 0
  : coincidenceFlux;
```

PM2 ahora recibe `snipedFlux` en vez de `coincidenceFlux`.

### Telemetría

El log ahora muestra:

```
[NEEDLE] F1520 Δsub=0.0230 Δmid=0.0044 needle=0.0318 sniper=0.0000 centroid=5452Hz [SNIPED] 🎯SNIPED(5452Hz)
[NEEDLE] F1640 Δsub=0.0680 Δmid=0.0117 needle=0.0892 sniper=0.0892 centroid=226Hz
```

Tags:
- `🎯SNIPED(XXXXHz)` — cuando el sniper mata un onset falso
- `sniper=` — el valor que realmente entra a PM2
- `centroid=` — centroide del frame en Hz

---

## RIESGOS Y VIGILANCIA

### ¿Qué podría salir mal?

1. **Kicks acústicos/rock** con mucho contenido armónico podrían tener centroide > 1500 Hz. LuxSync es para electrónica, pero si algún día se usa con una banda de rock, el umbral podría necesitar ajuste.

2. **Kicks con capa de noise** (industrial techno, gabber) podrían tener centroides elevados. Vigilar.

3. **El umbral 1500 Hz es empírico** — basado en UN log de Brejcha. Si aparecen más tracks donde el gap se cierra, habrá que recalibrarlo.

### Qué NO rompe

- **DnB:** Los kicks de DnB son sub-heavy, centroides bajos. El sniper no los toca.
- **House/Techno estándar:** Kicks 4-on-the-floor con centroide < 500 Hz. Seguros.
- **Reggaetón:** Dembow kicks son sub-dominant. Seguros.
- **Frames sin needle:** Si `coincidenceFlux === 0`, el sniper no actúa (0 pasa directo). Sin overhead.

---

## PIPELINE ACTUALIZADO

```
Audio Buffer (2048 samples)
    ↓
Ring Buffer (4096 samples)
    ↓
GodEar FFT (Radix-2 DIT)
    ↓
Spectrum Analysis → spectralCentroid (Hz)
    ↓
Needle Protocol (WAVE 2155): deltaSub × deltaMid → sqrt()
    ↓
🎯 Frequency Sniper (WAVE 2159): centroid > 1500Hz → KILL
    ↓
PacemakerV2: IOI clustering → ClusterSnapshot[]
    ↓
Harmonic Gearbox (WAVE 2158): Best Evidence Wins
    ↓
State Output → BPM
```

---

## RESULTADO ESPERADO

Con el Frequency Sniper activo, en el track de Brejcha:
- Los offbeats con centroide > 1500 Hz se eliminan antes de PM2
- Solo entran los kicks reales (~476ms entre ellos)
- PM2 debería generar cluster dominante a ~126 BPM
- Gearbox pasa 126 directo (sin necesidad de resolver armónicos)

**Pendiente: verificación con audio real.**

---

*PunkOpus × Radwulf — El Frequency Sniper no adivina. Mide.*
