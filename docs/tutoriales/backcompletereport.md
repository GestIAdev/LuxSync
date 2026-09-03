Entendido — solo informe forense, sin acciones. Déjame leer el log completo y el historial git para identificar el punto de inflexión.

Ahora déjame ver el estado del snare detection **antes** de WAVE 7749.0 (el último commit "bueno" = `4935a248` WAVE 7734):

**Bingo.** Este es el estado "modo dios". Ahora tengo todo lo que necesito para el informe forense:

Ahora tengo el cuadro completo. Déjame ver el log 18 para analizar los misses y el nanostrobe restante:

Ahora tengo todo. Déjame identificar los misses — frames donde hay un claro snare musical pero no dispara:

Tengo todo lo necesario. Aquí está el informe forense:

---

# 🔍 INFORME FORENSE — Snare Detection WAVE 7749.x

## Fecha: Post-7749.45 | Log analizado: snarelog18.md (921 líneas, ~21s @ 44Hz)

---

## 1. PUNTO DE INFLEXIÓN IDENTIFICADO

### El estado "modo dios" (commit `4935a248`, WAVE 7734)

El snare detection que funcionaba "envidiable, incluso con snares sintéticos de Anyma" era este:

```typescript
// === ESTADO MODO DIOS (4935a248) ===
const percRaw = this._snareHoldCounter > 0 ? 1.0 : 0.0  // Transient shaper binario

if (isSnareImpact && this._snareHoldCounter === 0) {
  this._snareHoldCounter = 4  // ~90ms hold para DMX
}

let hybridSnare = percRaw  // Empieza con el transient shaper

if (input.snare_energy !== undefined) {
  const snareDelta = rawSnareEnergy - this._prevSnareEnergy
  const snareOnset = snareDelta > 0.01 && rawSnareEnergy > 0.06 
                     && (now - this._lastSnareOnset > 80)  // cooldown 80ms
  if (snareOnset) {
    this._snareImpulse = 1.0
  }
  this._snareImpulse *= 0.04  // decay 96% por frame
  hybridSnare = Math.max(percRaw, this._snareImpulse)  // MAX-BLEND
}
```

**Características clave del modo dios:**
1. **Dual-path con MAX-blend**: `hybridSnare = Math.max(percRaw, this._snareImpulse)` — el transient shaper (treble delta) Y el snare_energy EMA se fusionaban, el más fuerte ganaba
2. **Frame Hold de 90ms**: `_snareHoldCounter = 4` mantenía `percRaw = 1.0` durante 4 frames después de cualquier impacto — **esto era el anti-strobo natural**
3. **Cooldown temporal de 80ms**: `(now - this._lastSnareOnset > 80)` — cooldown basado en tiempo real, no en frames
4. **Thresholds bajos y simples**: `snareDelta > 0.01 && rawSnareEnergy > 0.06` — sin veto espectral, sin WNS, sin Flux gate, sin flatness
5. **Decay brutal**: `_snareImpulse *= 0.04` (96% por frame) — pero no importaba porque el MAX-blend con percRaw sostenía el pulso

### La cadena de cambios que rompió el modo dios

| WAVE | Commit | Cambio | Daño |
|------|--------|--------|------|
| **7749.0-4** | `254d753c` | Dual Onset Detector + veto espectral + Sustain Choke | Introdujo 4D (WNS, Flux, flatness) pero mantuvo MAX-blend |
| **7749.13-23** | `d9d1e507` | **Eliminó percRaw/holdCounter** + introdujo bypasses Flux/Energy + dynamic thresholds | **PUNTO DE RUPTURA**: mató el MAX-blend y el frame hold |
| **7749.35-42** | `e724e9ba` | TCT re-arm discriminator + photon fallback strict | Añadió complejidad sobre un sistema ya roto |
| **7749.43** | `a180449e` | Fix sign bug Math.abs() | Arregló jittering pero el sistema base ya estaba dañado |
| **7749.44** | `ef55730f` | Eliminó bypasses Flux/Energy | Quitó los parches, dejó solo WNS path |
| **7749.45** | `56988460` | Alineó decay/choke latino con techno | Parche sobre parche |

**El commit fatal fue `d9d1e507` (WAVE 7749.13-23)** — eliminó tres mecanismos críticos:

1. **`_snareHoldCounter`** — el frame hold de 90ms que prevenía el strobo
2. **`Math.max(percRaw, this._snareImpulse)`** — el MAX-blend que daba redundancia
3. **Cooldown temporal de 80ms** — reemplazado por `_snareImpulse < 0.15` (frame-based, no time-based)

---

## 2. DEFECTOS DETECTADOS EN snarelog18.md

### 2.1 MISSES — Snares reales no detectados (pérdida de ritmo)

**Patrón: PEND sin confirmación WNS**

El sistema actual requiere WNS > 0.05 en el frame del onset O en el frame siguiente (pending). Pero en música latina, muchos snares reales tienen WNS = 0 en ambos frames:

| Línea | Δ | Flux | WNS | Estado | Diagnóstico |
|-------|---|------|-----|--------|-------------|
| **63** | 0.359 | 0.197 | **0.000** | [PEND] | Snare real, WNS nunca llega |
| **81** | 0.377 | 0.290 | **0.000** | [PEND] | Conga slap fuerte, WNS = 0 |
| **84-85** | 0.222 | 0.203 | **0.000** | [PEND]×2 | Timbal doble, WNS = 0 ambos |
| **90** | 0.237 | 0.155 | **0.000** | [PEND] | Güira scrape, WNS = 0 |
| **168** | 0.329 | 0.339 | **0.000** | [PEND] | Crash abierto, WNS = 0 |

**5+ snares reales perdidos** en 21 segundos = **miss rate ~14%**. Esto es lo que causa la "pérdida de ritmo" que notas musicalmente.

**Causa raíz**: El WNS (White Noise Score) mide contenido de broadband noise en HF. Las congas, timbales y güira latina son **tonales/estrechos en banda**, no producen broadband noise. El sistema "modo dios" no necesitaba WNS — usaba `snareDelta > 0.01 && rawSnareEnergy > 0.06`, que sí capturaba estos instrumentos.

### 2.2 NANOSTROBE — Decay residual del impulso

El `snareImpulseDecay: 0.50` (alineado con techno en 7749.45) produce:

```
Frame 0 (ONSET):  Imp = 1.00, Out = 1.000
Frame 1:          Imp = 0.50, Out = 0.500
Frame 2:          Imp = 0.25, Out = 0.250
Frame 3:          Imp = 0.13, Out = 0.125
Frame 4:          Imp = 0.06, Out = 0.063
Frame 5:          Imp = 0.03, Out = 0.031
```

El `Out` sigue al `Imp` 1:1 porque `hybridSnare = snareImpulseThisFrame` (line 820). El envelope `envSnare` recibe esta escalera y la suaviza, pero con `decayBase: 0.70` el envelope solo añade ~30ms de hold encima. Resultado: **cada onset produce una escalera descendente de 6 frames (~135ms)** que se ve como un flash con decaimiento rápido — el "nanostrobe" que persiste.

**En el modo dios**, el `_snareHoldCounter = 4` mantenía `percRaw = 1.0` durante 4 frames, y el MAX-blend con `_snareImpulse` extendía el glow. No había escalera descendente — era un pulso cuadrado de ~90ms que el envelope suavizaba naturalmente.

### 2.3 ENVELOPES CAÓTICOS — Sin colchón de respaldo

El modo dios tenía **dos fuentes de señal** fusionadas con MAX:
1. `percRaw` — transient shaper (treble delta del Back R original)
2. `_snareImpulse` — snare_energy EMA adapter

Si una fallaba, la otra compensaba. El sistema actual tiene **una sola fuente**: `_snareImpulse`. Si el 4D detector no dispara, `hybridSnare = 0` sin respaldo. Esto causa los "vacíos" que ves — frames donde el Back R va a negro absoluto porque el detector no disparó y no hay percRaw que sostenga.

### 2.4 DETECCIÓN DEFECTUOSA — WNS como único discriminador

Con los bypasses eliminados (7749.44), el único path de detección es:

```
rawSnareDelta > finalSnareThreshold  (dynamic, 0.06-0.12)
  AND spectralFlux > dynamicFluxGate  (dynamic, 0.10-0.15)
  AND _snareImpulse < 0.15            (retrigger guard)
  AND _snareReArmed                   (TCT discriminator)
  AND wns > 0.05                      ← ÚNICO DISCRIMINADOR REAL
```

El WNS es un discriminador **excelente para snares acústicos de techno** (snare drum real = broadband noise burst) pero **pésimo para percusión latina** (congas, timbales, güira = tonal/estrecho en banda, WNS ≈ 0).

**Esto explica por qué "techno tampoco funciona bien"**: aunque los snares de techno sí producen WNS, el dynamic threshold + Flux gate + re-arm discriminator añaden 3 capas de fricción que el modo dios no tenía. Cada capa individual es razonable, pero combinadas crean un sistema sobre-construido que falla en casos edge.

### 2.5 ANÁLISIS DE ONSETS — 35 onsets en 21s = 1.67/segundo

Comparativa de densidad de detección:

| Log | Onsets | Duración | Onsets/s | Estado |
|-----|--------|----------|----------|--------|
| snarelog16 (pre-fix) | ~85 | ~23s | 3.7/s | Strobo severo (bypasses) |
| snarelog17 (post-7749.44) | ~85 | ~23s | 3.7/s | Strobo (decay 0.25) |
| snarelog18 (post-7749.45) | 35 | ~21s | 1.67/s | Misses + nanostrobe |

**La reducción de 3.7→1.67 onsets/s no es por mejor filtrado — es por misses.** Los 5+ PEND sin confirmación WNS son snares reales que se perdieron. El sistema ahora es **menos sensible** que el modo dios, no más preciso.

---

## 3. DEFECTOS ESTRUCTURALES

### 3.1 El TCT re-arm discriminator es innecesario sin bypasses

El `_snareReArmed` + `Math.abs(_prevRawSnareDelta) < 0.02` se añadió para prevenir que synth leads sostenidos re-dispararan via los bypasses Flux/Energy. **Pero los bypasses ya no existen** (7749.44). Sin bypasses, el único path requiere WNS > 0.05, y un synth lead sostenido **nunca** produce WNS. El TCT es ahora una capa de fricción que puede bloquear re-disparos legítimos de redobles rápidos donde el delta no baja de 0.02 entre hits.

### 3.2 El Sustain Choke es redundante con el WNS gate

El Sustain Choke (WAVE 7749) mata el envelope si `snare_energy` se mantiene elevado sin nuevos onsets. Pero el WNS gate ya filtra señales sostenidas (un synth lead tiene WNS = 0). El choke añade una segunda capa de asesinato del sustain que puede cortar colas legítimas de snare.

### 3.3 Los dynamic thresholds (FBL-based) añaden inestabilidad

WAVE 7749.22-23 introdujo thresholds que escalan con `fluxBaseline` EMA:
- `finalSnareThreshold = 0.12 - max(0, fBL - 0.05) * 2.0` (clamp 0.06)
- `dynamicFluxGate = max(0.10, 0.15 - max(0, fBL - 0.05) * 1.0)`

En buildups densos, fBL sube, los thresholds bajan, y el sistema se vuelve **hipersensible** — disparando en cualquier fluctuación. En drops sparse, fBL baja, los thresholds suben, y el sistema se vuelve **hiposensible** — perdiendo snares reales. Esto crea la "detección caótica" que describes.

El modo dios tenía thresholds **fijos**: `snareDelta > 0.01 && rawSnareEnergy > 0.06`. Predecibles, estables, sin sorpresas.

---

## 4. RECOMENDACIONES PARA LA SESIÓN CON EL ARQUITECTO

### Opción A: Revertir a `4935a248` y re-añadir redobles con técnica diferente

```
git checkout 4935a248 -- electron-app/src/hal/physics/LiquidEngineBase.ts
git checkout 4935a248 -- electron-app/src/hal/physics/profiles/latino.ts
git checkout 4935a248 -- electron-app/src/hal/physics/profiles/techno.ts
```

**Pros**: Recupera el modo dios probado. Los redobles se pueden implementar con una técnica no invasiva (ej: detección de densidad de onsets en ventana deslizante, sin tocar el path de detección).

**Contras**: Pierde 4 días de trabajo (7749.0-45). Pero ese trabajo **no produjo mejoras netas** — solo parches sobre un sistema que ya funcionaba.

### Opción B: Re-añadir los 3 mecanismos kill al sistema 4D actual

1. **Re-añadir `_snareHoldCounter`** con frame hold de 4 frames → mata nanostrobe
2. **Re-añadir MAX-blend** con transient shaper percRaw → mata vacíos
3. **Re-añadir cooldown temporal de 80ms** → reemplaza `_snareImpulse < 0.15` y TCT

**Pros**: Mantiene el 4D como path primario, añade redundancia.
**Contras**: Sistema híbrido complejo, dos filosofías conviviendo.

### Opción C: Perfil diferenciado latino vs techno

- **Latino**: Revertir a modo dios (sin WNS, sin 4D) — percusión tonal no necesita WNS
- **Techno**: Mantener 4D (WNS funciona para snares acústicos/sintéticos de techno)

**Pros**: Cada género usa el detector que le corresponde.
**Contras**: Doble código, doble mantenimiento.

### Mi recomendación: **Opción A** (revertir a 4935a248)

El modo dios funcionaba "envidiable" para techno Y latino Y Anyma. Los redobles se pueden implementar como **capa post-detección** (analizar la densidad de onsets en una ventana de 500ms y boostear el envelope si hay >3 onsets) sin tocar el path de detección. Esto es lo que se debería haber hecho desde el principio.

---

## 5. RESUMEN EJECUTIVO

| Problema | Causa raíz | WAVE |
|----------|-----------|------|
| Pérdida de ritmo (misses) | WNS gate bloquea percusión tonal latina | 7749.13 |
| Nanostrobe persistente | Sin frame hold, decay en escalera | 7749.13 |
| Envelopes caóticos | Sin MAX-blend, una sola fuente de señal | 7749.13 |
| Detección defectuosa techno | Dynamic thresholds + 3 capas de fricción | 7749.22-23 |
| Strobo (ya arreglado) | Bypasses Flux/Energy + decay 0.25 | 7749.18-20 |

**El 90% del daño vino de un solo commit**: `d9d1e507` (WAVE 7749.13-23), que eliminó el frame hold, el MAX-blend y el cooldown temporal — los tres mecanismos que hacían el modo dios estable. Todo lo posterior (7749.35-45) fueron parches sobre un sistema roto.

**Para la sesión con el arquitecto**: revisitar `4935a248` como baseline, implementar redobles como capa post-detección (no tocar el detector), y mantener perfiles separados si es necesario.