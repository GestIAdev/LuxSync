# WAVE-2470 FASE 2: OPERACIÓN "DESCENSO OCEÁNICO"
## Blueprint de Migración ChillStereoPhysics → Omniliquid Engine

**Estado:** AUDITORÍA COMPLETA — Código **NO** escrito todavía  
**Fecha:** 2026-04-05  
**Autor:** PunkOpus (Arquitectura Base: Radwulg)

---

## 1. DIAGNÓSTICO: ¿QUÉ ES EL MOTOR LEGACY?

El motor legacy del chill-lounge **NO** es `LiquidEngine71` ni `LiquidEngine41`.  
Es un motor paralelo e independiente: `ChillStereoPhysics.ts` + `OceanicContextAdapter.ts`.

### Cadena de ejecución actual:

```
TitanEngine.ts
  └─ if (isChillVibe) → calculateChillStereo(time, energy, air, isKick, godEar, bpm)
       └─ ChillStereoPhysics.ts
            ├─ calculateHydrostaticDepth()  ← Motor de marea, oscilador coseno 12min
            ├─ calculateFluidPhysics()      ← Osciladores con números primos
            ├─ calculateColorGrading()      ← Color por zona (hardcodeado)
            ├─ checkOceanicTriggers()       ← State machine de criaturas
            └─ translateOceanicContext()    ← OceanicContextAdapter.ts
                 └─ OceanicMusicalContext → SeleneColorEngine (modulación)
```

El resultado (`DeepFieldOutput`) **bypasea completamente** el `liquidEngine41/71`.  
Las intensidades de zona llegan a `TitanEngine` como `chillOverrides.frontL/R, backL/R, moverL/R`  
y se inyectan directamente en `zoneIntensities` sin pasar por `applyBands()` del Omniliquid.

---

## 2. ARQUEOLOGÍA: LA MÁQUINA DE ESTADOS OCEÁNICA

### 2.1 Motor de Profundidad: El Hidrostático

```
startTime ─────────────────────────────────────────→ tiempo real
                          ↓
         tidePhase = (now - startTime) % TIDE_CYCLE_MS / TIDE_CYCLE_MS
                          ↓
         tideDepth = SURFACE_DEPTH + (1 - cos(tidePhase × 2π)) / 2 × MAX_DEPTH
                          ↓
         currentDepth = currentDepth × 0.992 + tideDepth × 0.008   ← INERCIA
```

**Parámetros clave:**
- `TIDE_CYCLE_MS = 12 minutos` — Un ciclo completo superficie→abismo→superficie
- `MAX_DEPTH = 10000m` (0 = superficie, 10000 = abismo máximo)
- `DEPTH_INERTIA = 0.992` — Transición extremadamente suave
- `DEBUG_SPEED = 1` — Multiplicador de velocidad (1 = tiempo real)
- **`BUOYANCY_SENSITIVITY = 0`** — La señal de audio NO mueve la profundidad. El descenso es **puramente temporal**, no reactivo al audio.

### 2.2 Las 4 Zonas Oceánicas

| Zona | Rango | Color | Emoción Traducida |
|------|-------|-------|------------------|
| SHALLOWS | 0–1000m | Verde esmeralda (hue ~160°) | `serene` |
| OCEAN | 1000–3000m | Azul tropical (hue ~200°) | `contemplative` |
| TWILIGHT | 3000–6000m | Índigo (hue ~240°) | `melancholic` |
| MIDNIGHT | 6000–10000m | Magenta/Cyan bioluminiscente (hue ~290° oscillating) | `ethereal` |

### 2.3 Física de Fluidos: Los Osciladores

La física de zonas utiliza **osciladores basados en números primos** para evitar periodicidad perceptible:

```typescript
// Todos los valores son relativos a elasticTime (tiempo escalado por BPM)
oscL = sin(t / 3659) + sin(t / 2069) × 0.25    // Asimétrico izquierdo
oscR = cos(t / 3023) + sin(t / 2707) × 0.25    // Asimétrico derecho

frontL = 0.5 + oscL × breathDepth              // breathDepth = (0.35 + energy × 0.3) × pressureFactor
frontR = 0.5 + oscR × breathDepth
backL  = 0.4 + sin(t / 4007 - 1.8) × 0.35 × pressureFactor
backR  = 0.4 + cos(t / 3511 - 2.2) × 0.35 × pressureFactor
```

**`pressureFactor = 1 - (depth / 10000) × 0.5`**: A mayor profundidad, respira menos (más aplastado por la presión).

**IMPORTANTE**: Estos osciladores nunca valen `0`. El mínimo de `frontL/R` a máxima profundidad con energy=0 es aproximadamente `0.5 - 0.25 × 0.5 = ~0.37`. El motor chill **nunca apaga una zona**. Hay siempre luz residual.

**Elastic Time (WAVE 1102)**: El tiempo para los osciladores se escala por BPM:
```
oceanTime += deltaMs × (safeBpm / 60)
```
A 60 BPM → 1.0x. A 120 BPM → 2.0x (las olas se mueven con la música).

### 2.4 Routing de Hardware (7.1 Actual)

```
currentDepth
     │
     ├─ frontL        → Focos Front Left  (Par front izquierdo)
     ├─ frontR        → Focos Front Right (Par front derecho)
     ├─ backL         → Focos Back Left   (Par back izquierdo)
     ├─ backR         → Focos Back Right  (Par back derecho)
     ├─ moverL        → Mover izquierdo   (gira + intensidad + pan/tilt)
     ├─ moverR        → Mover derecho     (gira + intensidad + pan/tilt)
     └─ airIntensity  → Zona "ambient"    (máquina de humo / wash)
```

¿Qué hace el **fondo marino** y qué hace los **destellos**?
- **Fondo marino (cuerpo)** = `frontL/R` y `backL/R` — Luz continua oscilante. En MIDNIGHT se atenúan al mínimo (presión profunda).
- **Destellos de bioluminiscencia** = `moverL/R` + `lifeActivity` — Los movers tienen una capa de `lifePulse`:
  ```
  lifePulse = sin(t / 800) > 0.7 ? lifeActivity : 0  // Destellos cortos
  lifeActivity = (clarity > 0.7 || energy > 0.65) ? 0.3 : 0
  ```
  En MIDNIGHT, el `baseIntensity` de los movers baja a `0.15`, pero los `lifePulse` los llevan hasta `0.45`.

Los **pan/tilt** de los movers se mueven continuamente con osciladores lentos (período ~5s), simulando deriva oceánica.

---

## 3. LA STATE MACHINE DE CRIATURAS

### 3.1 Estructura de una Criatura

Cada criatura es un trigger booleano. La condición de disparo:

```
depthInZone(criatura)
  AND timeInZone > timeInZoneMs   ← WAVE 1072: no disparar al llegar
  AND audioMetric > threshold
  AND (now - lastTrigger) > cooldownMs
```

### 3.2 Tabla de Criaturas

| Criatura | Zona | Audio Trigger | Cooldown | TimeInZone |
|----------|------|---------------|----------|------------|
| SolarCaustics | SHALLOWS (<1000m) | clarity > 0.75 | 45s | 10s |
| SchoolOfFish | OCEAN (1000-3000m) | transientDensity > 0.55 | 35s | 8s |
| WhaleSong | TWILIGHT (3000-6000m) | bassEnergy > 0.30 | 60s | 15s |
| AbyssalJellyfish | MIDNIGHT (>6000m) | spectralFlatness < 0.30 | 90s | 20s |
| SurfaceShimmer | SHALLOWS (<200m) | clarity > 0.4 | 18s | 5s |
| PlanktonDrift | 200-1000m | transientDensity > 0.25 | 22s | 6s |
| DeepCurrentPulse | 1000-6000m | 0.20 < bassEnergy < 0.50 | 28s | 8s |
| BioluminescentSpore | MIDNIGHT (>6000m) | spectralFlatness < 0.15 | 35s | 10s |

### 3.3 ¿Cómo reacciona al audio actualmente?

**La respuesta al audio en el motor legacy es limitada y semi-estática:**
- La **profundidad** es 100% temporal (tide oscilador). El audio NO la controla.
- Los **triggers de criaturas** usan el audio como condición de activación.
- Los **osciladores de física** se modulan suavemente por `energy` (breathDepth).
- El **Elastic Time** escala con BPM (WAVE 1102) — las olas respiran con la música.

Lo que NO existe: una respuesta kick-by-kick, snare-by-snare o beat-by-beat para el chill. El motor no tiene envelopes. Es pura respiración con modulación de BPM.

---

## 4. EL NODO DE CONEXIÓN CON SELENECOLORENGINE

`OceanicContextAdapter.ts` traduce el estado oceánico en `OceanicMusicalContext`:

```typescript
{
  hueInfluence: number          // 0-360 (color por zona: 160°/200°/240°/290°)
  hueInfluenceStrength: number  // Qué tanto pesa en el color final
  saturationMod: number         // -30 a +30
  lightnessMod: number          // -20 a +20
  translatedSection: 'intro' | 'verse' | 'bridge' | 'breakdown' | 'ambient'
  translatedEnergy: number      // Más profundo = menos energía base
  translatedEmotion: 'serene' | 'contemplative' | 'melancholic' | 'ethereal'
  depth: number
  zone: DepthZone
  tidePhase: number             // 0 = superficie, 1 = abismo
  breathingFactor: number       // Modulado por audio suavizado
}
```

Este contexto llega a `SeleneColorEngine.oceanicModulation()` para modular la paleta.

---

## 5. EL PLAN DE MIGRACIÓN: DESCENSO OCEÁNICO EN OMNILIQUID

### 5.1 La Pregunta Central

**¿Qué preservamos y qué transformamos?**

El motor legacy tiene **dos capas funcionalmente distintas**:

| Capa | Descripción | ¿Migrar al Omniliquid? |
|------|-------------|------------------------|
| **Hidrostática** | Descenso temporal (tide = coseno 12min) | **NO** — esta es la firma única del chill. No hay equivalente en envelopes. |
| **Física de Fluidos** | Osciladores con números primos × pressureFactor | **REEMPLAZAR** con envelopes Omniliquid pero modulados por profundidad |
| **Criaturas** | State machine de triggers | **NO** — son efectos de escenario, no física de zona |
| **Color** | OceanicContext → SeleneColorEngine | **PRESERVAR** — ya es modular, no hardcodeado |

### 5.2 El CHILL_PROFILE — Qué campos necesita

Un perfil ILiquidProfile para chill debe capturar la **respiración submarina**:

```
envelopeSubBass → "El Pulso del Abismo" (baja frecuencia, decay larguísimo)
  decayBase: 0.97   ← el sub respira muy lento, como latidos de ballena
  gateOn: 0.02      ← umbral mínimo — captura toda respiración de bajo
  boost: 1.5        ← no agresivo, solo cuerpo

envelopeKick → "La Corriente" (el beat en chill es suave, no bombo)
  decayBase: 0.90   ← sin staccato, la corriente fluye
  gateOn: 0.05      ← ghost beats del shaker/cepillo
  boost: 1.8

envelopeVocal → "La Voz del Mar" (voces flotantes, pad vocals)
  decayBase: 0.94   ← sustain largo, las voces flotan
  ghostCap: 0.25    ← siempre hay un susurro residual

envelopeSnare → "El Destello" (snare en chill es casi inaudible)
  gateOn: 0.15      ← alto — solo los snares claros pasan
  boost: 2.0        ← cuando pasa, que se note

envelopeHighMid → "Las Algas" (pad/synth mid, textura continua)
  decayBase: 0.95   ← tejido continuo
  boost: 2.5

envelopeTreble → "La Bioluminiscencia" (brillo puntual)
  decayBase: 0.88   ← persistente pero no eterno
  boost: 3.0        ← cuando brilla, brilla fuerte
```

### 5.3 La Clave: `morphFactor` como Profundidad

**El `morphFactor` del Omniliquid puede mapear perfectamente a la profundidad oceánica.**

Actualmente el `morphFactor` en la Base se calcula desde `spectralCentroid` (frecuencias altas = melódico). Para chill, la propuesta es **desconectarlo del centroide y anclarlo a la tide**:

```
morphFactor = 1.0 - (currentDepth / MAX_DEPTH)
  // A superficie (0m) → morphFactor = 1.0 (vibe alto, más variación)
  // A abismo (10000m) → morphFactor = 0.0 (presión total, mínima variación)
```

Esto modularia automáticamente:
- **decayRange** → a mayor profundidad, los envelopes tienen menos rango. Todo se uniformiza.
- **breathDepth** del pressureFactor → reemplazado semánticamente por `morphFactor` en los parámetros del perfil.
- **Los movers** → en profundidad alta, su rango dinámico se comprime.

### 5.4 La Bioluminiscencia como `beatVisualEnvelope`

Los destellos de bioluminiscencia del motor legacy (`lifePulse`) pueden traducirse a un **envelope de alta frecuencia**:

- En el Omniliquid, `envelopeTreble` con `decayBase = 0.88` capta los shimmers de synth chill.
- Los triggers de criaturas (WhaleSong, AbyssalJellyfish) **se mantienen fuera del Omniliquid** — son efectos de escenario consumidos por `EffectManager`, no física de zona.
- La diferencia: el legacy mandaba `lifeActivity` directo a `moverL/R`. El Omniliquid lo haría via `envelopeTreble → moverLeft` (La Bioluminiscencia).

### 5.5 Preservar la Tide Machine

**El oscilador hidrostático NO debe migrar al Omniliquid.**

La razón: el Omniliquid es reactivo por diseño (frame-by-frame, audio-driven). La tide es temporal-absoluta (coseno de 12 minutos). Mezclar los paradigmas contaminaría la arquitectura.

**La propuesta de migración limpia:**

```
ChillStereoPhysics.ts  (SIMPLIFICADO — solo tide + zones)
        │
        ▼
CHILL_PROFILE.morphFactor = f(currentDepth)   ← feed del estado de marea al perfil
        │
        ▼
LiquidEngineBase.applyBands(liquidInput con morphFactor de marea)
        │
        ▼
LiquidEngine71.routeZones()  ← con bifurcación 'chill-lounge' si necesaria
```

El `ChillStereoPhysics` se convierte en un **proveedor de contexto** (profundidad → morphFactor) en lugar de motor de física completo.

### 5.6 Routing en 7.1 para Chill

Propuesta de asignación de zonas para `CHILL_PROFILE` en `LiquidEngine71.routeZones()`:

```
Front L → envSubBass  (El Pulso del Abismo — bass continuo, latido de ballena)
Front R → envKick     (La Corriente — beat suave del bajo)
Back L  → envHighMid  (Las Algas — pad mid, textura continua)
Back R  → envSnare    (El Destello — brush/shaker, destellos puntuales)
Mover L → envVocal    (La Voz del Mar — pad vocal floating)
Mover R → envTreble   (La Bioluminiscencia — shimmer/brillo puntual)
Canal 7 → 0.0         (Blackout — reservado para fog/hazer)
```

El mapping front/back es paralelo al latino en filosofía: cuerpo en front, textura en back, expresión en movers.

### 5.7 El Routing en 4.1 para Chill

En 4.1 el `max()` del default compactaría así:

```
frontPar = max(subBass, kick)      ← El latido bajo + corriente
backPar  = max(highMid, snare)     ← Las algas + destellos
moverL   = envVocal                ← La Voz del Mar
moverR   = envTreble               ← La Bioluminiscencia
```

El `decayBase` extremamente alto de `envelopeSubBass` (0.97) dominaría el `frontPar`, creando el cuerpo continuo deseado. `layout41Strategy: 'default'` es correcto para chill.

---

## 6. LO QUE NO CAMBIA (PRESERVAR INTACTO)

| Componente | Estado | Razón |
|------------|--------|-------|
| `OceanicContextAdapter.ts` | No tocar | Modula SeleneColorEngine correctamente |
| `TRIGGER_CONFIG` criaturas | No tocar | Son efectos de escenario (EffectManager) |
| `TitanEngine.isChillVibe` bloque | Refactorizar ligeramente | Mantener el tide para morphFactor |
| `SeleneColorEngine.oceanicModulation()` | No tocar | Ya funciona con oceanicContext |
| `ChillLoungeProfile.ts` (VibeProfile) | No tocar | Es perfil visual/mood, no física |
| `isOceanicEffectValidForDepth()` | No tocar | Proteccion geográfica de efectos |

---

## 7. RIESGOS Y CONSIDERACIONES

### 7.1 El "Dimmer Floor" de Chill

`ChillLoungeProfile.ts` especifica `dimmer.floor = 0.2`. El Omniliquid actualmente no tiene un floor de dimmer nativo — los envelopes pueden ir a `0.0`. El CHILL_PROFILE necesitará `ghostCap` elevados en todos los envelopes para mantener la luminosidad ambient mínima.

### 7.2 Los Osciladores vs Los Envelopes

Los osciladores legacy producen valores continuos incluso en silencio absoluto. Los envelopes Omniliquid decaen hacia `ghostCap`. El `ghostCap` del CHILL_PROFILE debe ser suficientemente alto para simular la "respiración" del océano en silencio. Propuesta: `ghostCap ≥ 0.25` en todos los envelopes.

### 7.3 El Tiempo Real vs El Tiempo de Audio

Los osciladores legacy corren en tiempo real (`Date.now()`). Los envelopes Omniliquid corren en tiempo de frame de audio. Para chill a 60 FPS, la diferencia es negligible. El Elastic Time (BPM scaling) ya resuelve la sincronización.

### 7.4 Coexistencia Durante la Migración

Durante la migración, la bifurcación en `SeleneLux.updateFromTitan()` puede mantenerse:
- `useLiquidStereo && vibeId === 'chill-lounge'` → Omniliquid (nuevo)
- `useLiquidStereo && vibeId !== 'chill-lounge'` → Omniliquid (actual)
- `!useLiquidStereo` → Legacy (deprecado)

---

## 8. ENTREGABLE DE LA MIGRACIÓN (CUANDO LLEGUE EL MOMENTO)

**Archivos a crear:**
1. `electron-app/src/hal/physics/profiles/chilllounge.ts` — `CHILL_PROFILE` con morfología de marea

**Archivos a modificar:**
1. `electron-app/src/hal/physics/profiles/index.ts` — Registrar `CHILL_PROFILE` en registry
2. `electron-app/src/hal/physics/LiquidEngine71.ts` — Bifurcación para chill (morfología de movers)
3. `electron-app/src/core/reactivity/SeleneLux.ts` — Conectar tide → morphFactor del perfil
4. `electron-app/src/hal/physics/ChillStereoPhysics.ts` — Reducir a proveedor de contexto (depth → morphFactor)

**Archivos que NO cambian:**
- `OceanicContextAdapter.ts`
- `ChillLoungeProfile.ts` (VibeProfile)
- `EffectRegistry.ts` criaturas
- `TitanEngine.ts` isChillVibe block (solo conectar morphFactor)

---

## 9. RESUMEN EJECUTIVO

El `ChillStereoPhysics.ts` es un **motor hidrostático basado en tiempo**, no en audio. Funciona como un compositor autónomo que simula el descenso oceánico con osciladores de números primos y una marea coseno de 12 minutos. El audio solo activa criaturas (efectos de escenario) y modula suavemente la "respiración" (breathDepth por energy).

La migración NO es reescribir el motor oceánico en envelopes. Es **crear un CHILL_PROFILE** con parámetros de decays larguísimos (0.94-0.97), ghostCaps altos (0.25+), y conectar el `tidePhase` del hidrostático al `morphFactor` que modulará esos decays. La tide machine **sobrevive** pero como datos, no como motor de intensidad.

Las criaturas quedan fuera del Omniliquid — son una capa de efectos de escenario que ya vive en `EffectManager` y `EffectRegistry`. Solo consumen `depth` y `zone` como contexto.

**La belleza del diseño se preserva. La arquitectura se unifica.**

---

*Blueprint generado por PunkOpus — WAVE 2470 FASE 2*  
*Para ejecución cuando Radwulg dé la orden de "Descender".*
