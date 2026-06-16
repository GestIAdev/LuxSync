# REPORTE FORENSE WAVE-OMNILIQUID-ROUTING

## DIAGNÓSTICO EJECUTIVO

El motor OmniLiquid sufre de **doble amputación de señal** en 4.1 y de **inanicion aguda** en 7.1 Latino. En 4.1, `LiquidEngine41` descarta por completo `frontLeft` (subBass) y `backLeft` (highMid), colapsando ambos pares de PARs a una única señal cada uno (kick para front, snare para back). En 7.1 Latino, el perfil deja morir de hambre al canal `backLeft` con pesos de entrada ridículamente bajos y un gate de 0.50 que bloquea cualquier resquicio de señal.

---

## 1. EL CADÁVER DEL BACK L (7.1)

### 1.1 Cálculo de `backLeft` en `LiquidEngineBase`

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts:611-615`

```typescript
const midSynthInput = Math.max(0,
  bands.lowMid * p.backLLowMidWeight + bands.mid * p.backLMidWeight * (1.0 - vocalPenalty * 0.80)
  - bands.treble * p.backLTrebleSub - bands.bass * p.backLBassSub
)
let backLeft = this.envHighMid.process(midSynthInput, morphFactor, now, isBreakdown)
```

Este `midSynthInput` alimenta al envelope `envHighMid`. Si la entrada es menor que `gateOn`, el envelope devuelve 0.

### 1.2 Perfil Latino (base, usada en 7.1)

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\profiles\latino.ts:210-213, 132-145`

```typescript
backLLowMidWeight: 0.22,
backLMidWeight: 0.10,
backLTrebleSub: 0.28,
backLBassSub: 0.0,

envelopeHighMid: {
  gateOn: 0.50,          // Umbral MUY alto
  boost: 3.0,
  crushExponent: 2.0,
  decayBase: 0.14,       // Guillotina snap — muere en ~1-2 frames
  decayRange: 0.03,
  maxIntensity: 0.95,
  squelchBase: 0.38,     // Piso asfixiante
  squelchSlope: 0.10,
  ghostCap: 0.00,        // Negro absoluto entre golpes
  gateMargin: 0.005,
  attackSlopeMin: 0.02,
}
```

### 1.3 Perfil Techno (base, usada en 7.1) — Comparativa

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\profiles\techno.ts:163-166, 110-122`

```typescript
backLLowMidWeight: 0.0,
backLMidWeight: 1.0,      // MID puro como alimento principal
backLTrebleSub: 0.0,
backLBassSub: 0.7,        // Sustracción del bombo

envelopeHighMid: {
  gateOn: 0.22,           // Gate permisivo
  boost: 1.5,
  crushExponent: 2.5,
  decayBase: 0.28,        // Decay razonable
  squelchBase: 0.25,
  ghostCap: 0.00,
}
```

### 1.4 Análisis del cadáver

Con Latino en 7.1:
- `bands.mid * 0.10 * (1 - vocalPenalty*0.80)` → con `vocalPenalty` hasta 0.75, el término queda `bands.mid * 0.04`.
- `bands.lowMid * 0.22` → aporta poco.
- Luego resta `treble * 0.28`.
- La señal resultante rara vez supera `gateOn: 0.50`.
- Cuando pasa, `decayBase: 0.14` la mata en 1-2 frames.
- `squelchBase: 0.38` aplasta cualquier residual.
- `ghostCap: 0.00` → entre golpes, oscuridad total.

**Veredicto:** El Back L en 7.1 Latino está diseñado para morir. No es un bug de enrutamiento, es una sentencia de inanición por parametría.

---

## 2. EL CAOS DEL 4.1 FRONT

### 2.1 `LiquidEngine41.routeZones` — El colapso

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngine41.ts:36-93`

```typescript
protected routeZones(frame: ProcessedFrame): LiquidStereoResult {
  const {
    frontRight, backRight,
    moverLeft, moverRight,
    strobeActive, strobeIntensity,
    acidMode, noiseMode,
    floorIntensity, ambientIntensity, airIntensity,
  } = frame

  // WAVE 4691: En 4.1 los PARs son SIEMPRE rítmicos.
  const frontPar = frontRight   // 🔴 frontLeft (subBass) DESCARTADO
  const backPar = backRight     // 🔴 backLeft (highMid) DESCARTADO
  const outMoverL = moverLeft
  const outMoverR = moverRight

  return {
    frontLeftIntensity:  frontPar,   // = frontRight (kick edge)
    frontRightIntensity: frontPar,   // = frontRight (kick edge)
    backLeftIntensity:   backPar,    // = backRight (snare)
    backRightIntensity:  backPar,    // = backRight (snare)
    moverLeftIntensity:  outMoverL,
    moverRightIntensity: outMoverR,
    ...
  }
}
```

**Problema arquitectónico:** En 4.1, `frontLeft` (subBass continuo, El Océano) y `backLeft` (highMid, El Coro) son **amputados**. Ambos Front PARs reciben únicamente `frontRight` (kick edge), y ambos Back PARs reciben `backRight` (snare).

### 2.2 Cálculo de `frontRight` (kick edge) en la Base

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts:431-433`

```typescript
const kickLocked = this.profile.layout41Strategy === 'strict-split' && !isKick
const kickSignal = kickLocked ? 0 : (isKickEdge ? bands.bass : 0)
let frontRight = this.envKick.process(kickSignal, morphFactor, now, isBreakdown)
```

**Techno (`layout41Strategy: 'strict-split'`):**
- `!isKick` → `kickSignal = 0`. Front PARs apagados entre kicks.
- `isKick` pero no `isKickEdge` → `kickSignal = 0`.
- Solo `isKickEdge` dispara.
- Los Front PARs son esclavos absolutos del tracker de BPM. Si el tracker falla, las luces frontales se apagan.

**Latino (`layout41Strategy: undefined`):**
- `kickLocked = false`.
- `kickSignal = isKickEdge ? bands.bass : 0`.
- Aún depende de `isKickEdge`, que requiere `intervalo > kickEdgeMinInterval`.

### 2.3 Overrides de Latino en 4.1 — Agravante

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\profiles\latino.ts:393-396, 387-391`

```typescript
envelopeKick: {
  decayBase: 0.10,   // 🔴 Decay ultrarrápido — el kick es un flash, no un pulso
},
envelopeSubBass: {
  gateOn: 0.22,      // Bloquea bajo continuo
  boost: 1.25,
},
```

En 4.1, `envelopeSubBass` no se usa para los Front PARs (están colapsados a `frontRight`/`envKick`). Pero el override de `envKick` hace que el kick sea aún más estaccato (`decayBase: 0.10`). Los Front PARs se convierten en flashes aisladísimos.

### 2.4 Veredicto del caos 4.1

1. **Amputación de hemisferios:** `frontLeft` (subBass) se tira a la basura. Los Front PARs pierden el groove continuo y solo parpadean con kicks.
2. **Candado BPM:** `isKickEdge` + `kickLocked` hacen que los PARs frontales dependan 100% del tracker. Detección errática = caos.
3. **Latino agrava:** `decayBase: 0.10` en `overrides41` convierte cada kick en un flash de 1-2 frames.

---

## 3. DIFERENCIAS UI vs DMX PAYLOAD

### 3.1 Interfaz `LiquidStereoResult`

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidStereoPhysics.ts:67-116`

```typescript
export interface LiquidStereoResult {
  frontLeftIntensity: number
  frontRightIntensity: number
  backLeftIntensity: number
  backRightIntensity: number
  moverLeftIntensity: number
  moverRightIntensity: number
  strobeActive: boolean
  strobeIntensity: number

  // WAVE 4520.2: 9-zone expansion
  floorIntensity: number
  ambientIntensity: number
  airIntensity: number

  // Legacy compat
  frontParIntensity: number
  backParIntensity: number
  moverIntensityL: number
  moverIntensityR: number
  moverIntensity: number
  moverActive: boolean
  physicsApplied: 'liquid-stereo'
  acidMode: boolean
  noiseMode: boolean
}
```

### 3.2 Cómo lee el pipeline DMX estas zonas

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\ingestion\NodeExtractionPipeline.ts:276-290`

```typescript
private _resolveStereoAwareZone(zoneRaw: string, position?: Position3D): ZoneId {
  const normalized = normalizeZoneId(zoneRaw)
  const x = position?.x

  if ((normalized === 'front' || normalized === 'back') && typeof x === 'number' && !Number.isNaN(x)) {
    if (x < -0.1) {
      return (normalized === 'front' ? 'front-left' : 'back-left') as ZoneId
    }
    if (x > 0.1) {
      return (normalized === 'front' ? 'front-right' : 'back-right') as ZoneId
    }
  }

  return normalized as ZoneId
}
```

### 3.3 Inconsistencia UI/DMX

- **UI (TacticalCanvas):** Lee `stageFixture.zone` (canónico: `'front'`, `'back'`) y usa `ZONE_LAYOUT_2D` para decidir L/R visual. Ya fue parcheado en WAVE-SPLIT-BRAIN para respetar `position.x`.
- **DMX (NodeExtractionPipeline):** Deriva `front-left` / `front-right` / `back-left` / `back-right` dinámicamente desde `position.x` del fixture.
- **LiquidEngine:** Devuelve `frontLeftIntensity` / `frontRightIntensity` como zonas separadas.

**El problema:** En 4.1, `frontLeftIntensity === frontRightIntensity` (ambos = kick). Entonces, aunque el DMX envíe `front-left` y `front-right` a canales diferentes, ambos reciben la **misma señal**. El DMX cumple su trabajo de enrutar, pero la señal que lleva está clonada.

---

## 4. FIXES PROPUESTOS

### Fix A — Resucitar Back L en Latino 7.1

En `latino.ts`, base profile:

```typescript
backLMidWeight: 0.55,       // 0.10 → 0.55 (mitad de Techno, suficiente para respirar)
backLLowMidWeight: 0.35,    // 0.22 → 0.35

envelopeHighMid: {
  gateOn: 0.28,             // 0.50 → 0.28 (permitir señal real)
  decayBase: 0.35,          // 0.14 → 0.35 (no morir en 1 frame)
  squelchBase: 0.18,        // 0.38 → 0.18 (suelo razonable)
  ghostCap: 0.04,           // 0.00 → 0.04 (sostenido mínimo)
  ...
}
```

### Fix B — Restaurar hemisferios en 4.1

En `LiquidEngine41.ts`:

```typescript
protected routeZones(frame: ProcessedFrame): LiquidStereoResult {
  const {
    frontLeft, frontRight,    // ← Importar frontLeft
    backLeft, backRight,    // ← Importar backLeft
    moverLeft, moverRight,
    strobeActive, strobeIntensity,
    acidMode, noiseMode,
    floorIntensity, ambientIntensity, airIntensity,
  } = frame

  // 4.1: colapsar front/back a un valor promedio, NO descartar hemisferios
  const frontPar = Math.max(frontLeft, frontRight)   // Océano + Francotirador
  const backPar  = Math.max(backLeft, backRight)      // Coro + Látigo
  const outMoverL = moverLeft
  const outMoverR = moverRight

  return {
    frontLeftIntensity:  frontLeft,    // ← Restaurar
    frontRightIntensity: frontRight,   // ← Restaurar
    backLeftIntensity:   backLeft,     // ← Restaurar
    backRightIntensity:  backRight,    // ← Restaurar
    moverLeftIntensity:  outMoverL,
    moverRightIntensity: outMoverR,
    ...
  }
}
```

Alternativa conservadora: si el contrato de 4.1 realmente quiere "4 canales", mantener `frontPar = max(frontLeft, frontRight)` y asignar `frontLeftIntensity = frontPar * 0.7`, `frontRightIntensity = frontPar * 1.0` para dar prioridad al kick en R, pero sin desconectar L.

### Fix C — Stabilizar kick en 4.1 strict-split

En `LiquidEngineBase.ts`, línea 431:

```typescript
// Candado menos draconiano: usar bands.bass como fallback cuando !isKick
const kickSignal = this.profile.layout41Strategy === 'strict-split'
  ? (isKickEdge ? bands.bass : bands.bass * 0.25)  // 25% de energía entre kicks
  : (isKickEdge ? bands.bass : 0)
```

Esto evita que los Front PARs se apaguen completamente entre kicks detectados.
