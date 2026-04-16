# WAVE 2855: ARK-FIXES-V2 — El Arca Expandida (7 Reliquias)
> **Fecha:** 15 de Abril de 2026  
> **Contexto:** WAVE 2850 identificó 4 fixes universales. WAVE 2855 añade 3 reliquias de infraestructura crítica que se perderían con el reset a `527410d` (anterior a WAVES 2720 y 2740/2750).  
> **Reset target:** `527410df` — pre wave 2672 Eclectic Law (Abril 14, 2026)

---

## MAPA DE LAS 10 RELIQUIAS

| # | Reliquia | WAVE | Archivos Afectados | Prioridad |
|---|---------|------|-------------------|-----------|
| 1 | HAL isManualPosition + SNAP | 2785 | HAL + FixturePhysicsDriver | 🔴 ALTA |
| 2 | BabelFish LED PARs Guard | 2770/2772 | ArbiterIPCHandlers | 🔴 ALTA |
| 3 | BabelFish Anti-Blackout | 2770 | HAL translateColorToWheel | 🔴 ALTA |
| 4 | LiquidEnvelope ghostCap Floor | 2792 | LiquidEnvelope | 🟡 MEDIA |
| 5 | **HarmonicQuantizer** | 2672/2720 | **NUEVO MÓDULO + HAL** | 🔴 CRÍTICO |
| 6 | **NaN Bomb Shield** | 2750 | **clampDMX x2 + MasterArbiter** | 🔴 CRÍTICO |
| 7 | **Breathing Ghost Exorcism** | 2750 | **ChillStereoPhysics** | 🟡 MEDIA |
| 8 | **DarkSpin Filter completo** | 2690/2691 | **NUEVO MÓDULO** | 🔴 CRÍTICO |
| 9 | **DarkSpin Deadlock Fix** | 2691 | **DarkSpinFilter state machine** | 🔴 CRÍTICO |
| 10 | **Layer 2 Segmented Merge** | 2710/2711 | **types.ts + MasterArbiter** | 🔴 CRÍTICO |

---

## ORDEN DE RE-APLICACIÓN POST-RESET

```
PASO 1  — Crear DarkSpinFilter.ts nuevo (módulo independiente) [Reliquia 8+9]
PASO 2  — Crear HarmonicQuantizer.ts nuevo (módulo independiente) [Reliquia 5]
PASO 3  — Integrar DarkSpin + Quantizer en HAL pipeline [Reliquias 5B, 8]
PASO 4  — Añadir getLastColor() a HardwareSafetyLayer + desmantelar chaos latch [Reliquia 5B-6]
PASO 5  — Channel Categories en types.ts [Reliquia 10A]
PASO 6  — Segmented Merge en MasterArbiter.setManualOverride() [Reliquia 10B]
PASO 7  — NaN Bomb Shield: blindar clampDMX en MergeStrategies + DMXPacket [Reliquia 6A/6B]
PASO 8  — NaN Upstream Guards: pan/tilt en MasterArbiter [Reliquia 6C]
PASO 9  — Breathing Ghost: limpiar ChillStereoPhysics movers [Reliquia 7]
PASO 10 — LiquidEnvelope ghostCap floor [Reliquia 4]
PASO 11 — isManualPosition SNAP (HAL + FixturePhysicsDriver) [Reliquia 1]
PASO 12 — BabelFish LED PARs Guard (ArbiterIPCHandlers) [Reliquia 2]
PASO 13 — BabelFish Anti-Blackout (HAL translateColorToWheel) [Reliquia 3]
```

---

# PARTE I — LAS 4 RELIQUIAS ORIGINALES (WAVE 2850)
*(Documentadas en ark-fixes.md — se incluyen aquí para completitud del Arca Expandida)*

---

## RELIQUIA 1: HAL isManualPosition + FixturePhysicsDriver SNAP
*(Ver ark-fixes.md FIX 1 para el código completo)*

**Resumen:** Detectar Layer 2 manual en `renderFromTarget()` → SNAP 400 DMX/s en FixturePhysicsDriver en lugar de inercia del vibe.

---

## RELIQUIA 2: BabelFish LED PARs Guard (Per-Fixture Translation)
*(Ver ark-fixes.md FIX 2 para el código completo)*

**Resumen:** Mover traducción RGB→ColorWheel al loop per-fixture con `needsColorTranslation(profile)`.

---

## RELIQUIA 3: BabelFish Anti-Blackout (Zero Guard + Source Check)
*(Ver ark-fixes.md FIX 3 para el código completo)*

**Resumen:** `_controlSources.color_wheel === ControlLayer.MANUAL` → skip re-traducción.

---

## RELIQUIA 4: LiquidEnvelope ghostCap Floor
*(Ver ark-fixes.md FIX 4 para el código completo)*

**Resumen:** `Math.max(ghostCap * Math.max(morphFactor, 0.1), faded)` — dimmer floor garantizado.

---

# PARTE II — LAS 3 RELIQUIAS NUEVAS (WAVE 2855)

---

## RELIQUIA 5: EL PÉNDULO ARMÓNICO — HarmonicQuantizer (WAVE 2672/2720)

### 5A. CREAR EL MÓDULO COMPLETO

**Ruta:** `electron-app/src/hal/translation/HarmonicQuantizer.ts`  
**Acción:** Crear este archivo desde cero (no existía antes de `527410d`).

```typescript
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎵 WAVE 2672: HARMONIC QUANTIZER — LA LEY ECLÉCTICA (PÉNDULO ARMÓNICO)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PROBLEMA RESUELTO:
 * Selene piensa a 60fps. Las ruedas de color mecánicas necesitan 500ms+
 * para rotar. El HardwareSafetyLayer bloquea por fuerza bruta durante el
 * cooldown → el fixture se congela → el show muere.
 *
 * SOLUCIÓN:
 * Cuantizar los cambios de color a la subdivisión musical más rápida
 * que respete la física del hardware. El beat dicta la partitura,
 * el hardware dicta las físicas.
 *
 * ALGORITMO CENTRAL:
 * 1. Leer rBPM desde IntervalBPMTracker (vía lastAudioData.workerBpm)
 * 2. Calcular beatPeriodMs = 60000 / rBPM
 * 3. Encontrar el multiplicador armónico más rápido (×1, ×2, ×4, ×8, ×16)
 *    cuyo período sea ≥ minChangeTimeMs del perfil del fixture
 * 4. Gate: solo permitir cambio de color cuando ha pasado el período armónico
 *
 * DESACOPLAMIENTO ABSOLUTO DE CANALES:
 * - colorWheel / CMY → CUANTIZADO (gated por período armónico)
 * - dimmer → PASS-THROUGH INMEDIATO (siempre libre)
 * - shutter → PASS-THROUGH INMEDIATO (siempre libre)
 * - movement → PASS-THROUGH INMEDIATO (siempre libre)
 *
 * RELACIÓN CON HardwareSafetyLayer:
 * El Quantizer es la capa MUSICAL que previene conflictos con elegancia.
 * El SafetyLayer sigue ahí como red de seguridad de última instancia.
 * Con el Quantizer activo, el SafetyLayer casi nunca necesita intervenir.
 *
 * @module hal/translation/HarmonicQuantizer
 * @version WAVE 2672
 */

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

/** Resultado de la cuantización de color para un fixture */
export interface QuantizerResult {
  /** ¿Se permite el cambio de color en este tick? */
  colorAllowed: boolean
  /** Período armónico calculado (ms). 0 si no hay restricción */
  harmonicPeriodMs: number
  /** Multiplicador de beats usado (1=beat, 2=2beats, 4=bar, etc.) */
  beatMultiplier: number
  /** Tiempo restante hasta el próximo cambio permitido (ms) */
  timeUntilNextChangeMs: number
}

/** Estado interno por fixture en el cuantizador */
interface FixtureQuantizerState {
  /** Timestamp del último cambio de color permitido */
  lastColorChangeTime: number
  /** Último color RGB que se dejó pasar (para comparar si realmente cambió) */
  lastAllowedColor: { r: number; g: number; b: number } | null
  /** Período armónico actual calculado (ms) */
  currentHarmonicPeriodMs: number
  /** Último BPM usado para el cálculo (para invalidar cache) */
  lastBpmUsed: number
}

/** Color RGB simple */
interface RGBColor {
  r: number
  g: number
  b: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Multiplicadores de beats para subdivisiones musicales.
 * Ordenados de más rápido a más lento.
 * ×1 = cada beat, ×2 = cada 2 beats, ×4 = cada compás (4/4), etc.
 */
const BEAT_MULTIPLIERS = [1, 2, 4, 8, 16] as const

/** BPM por defecto cuando no hay detección activa */
const DEFAULT_BPM = 120

/** Umbral mínimo de confianza del BPM para activar cuantización */
const MIN_BPM_CONFIDENCE = 0.3

/** Diferencia mínima de BPM para recalcular el período armónico */
const BPM_RECALC_THRESHOLD = 2.0

// ═══════════════════════════════════════════════════════════════════════════
// HARMONIC QUANTIZER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class HarmonicQuantizer {
  /** Estado por fixture */
  private fixtureStates = new Map<string, FixtureQuantizerState>()

  /**
   * 🎯 findResonantPeriod — El corazón del Péndulo Armónico
   *
   * Encuentra la subdivisión musical más rápida (menor período)
   * que sea ≥ minChangeTimeMs.
   *
   * Ejemplo con BPM=128:
   *   beatPeriod = 60000/128 = 468.75ms
   *   minChangeTimeMs = 500ms (Beam 2R)
   *
   *   ×1 = 468.75ms  → < 500ms ✗
   *   ×2 = 937.50ms  → ≥ 500ms ✓ ← ELEGIDO
   *
   * @returns { periodMs, multiplier }
   */
  public findResonantPeriod(
    bpm: number,
    minChangeTimeMs: number
  ): { periodMs: number; multiplier: number } {
    const safeBpm = bpm > 0 ? bpm : DEFAULT_BPM
    const beatPeriodMs = 60000 / safeBpm

    for (const multiplier of BEAT_MULTIPLIERS) {
      const periodMs = beatPeriodMs * multiplier
      if (periodMs >= minChangeTimeMs) {
        return { periodMs, multiplier }
      }
    }

    // Si ni siquiera ×16 beats es suficiente (BPM extremadamente alto),
    // usar el máximo multiplicador disponible
    const maxMultiplier = BEAT_MULTIPLIERS[BEAT_MULTIPLIERS.length - 1]
    return {
      periodMs: beatPeriodMs * maxMultiplier,
      multiplier: maxMultiplier,
    }
  }

  /**
   * 🎵 quantize — Punto de entrada principal
   *
   * Evalúa si un cambio de color debe permitirse en este tick.
   * SOLO afecta al canal de color. Dimmer/shutter/movement son
   * responsabilidad del caller — este módulo NO los toca.
   *
   * @param fixtureId - ID único del fixture
   * @param newColor - Color RGB que Selene quiere aplicar
   * @param bpm - rBPM actual desde IntervalBPMTracker
   * @param bpmConfidence - Confianza del BPM (0-1)
   * @param minChangeTimeMs - Tiempo mínimo de cambio del perfil del fixture
   * @returns Resultado con colorAllowed y metadata
   */
  public quantize(
    fixtureId: string,
    newColor: RGBColor | undefined,
    bpm: number,
    bpmConfidence: number,
    minChangeTimeMs: number
  ): QuantizerResult {
    const now = Date.now()

    // Sin color → nada que cuantizar
    if (!newColor) {
      return {
        colorAllowed: true,
        harmonicPeriodMs: 0,
        beatMultiplier: 0,
        timeUntilNextChangeMs: 0,
      }
    }

    // Confianza de BPM demasiado baja → fallback a debounce simple
    // (dejar que HardwareSafetyLayer se encargue)
    if (bpmConfidence < MIN_BPM_CONFIDENCE) {
      return {
        colorAllowed: true,
        harmonicPeriodMs: 0,
        beatMultiplier: 0,
        timeUntilNextChangeMs: 0,
      }
    }

    // Obtener o crear estado
    let state = this.fixtureStates.get(fixtureId)
    if (!state) {
      state = {
        lastColorChangeTime: 0,
        lastAllowedColor: null,
        currentHarmonicPeriodMs: 0,
        lastBpmUsed: 0,
      }
      this.fixtureStates.set(fixtureId, state)
    }

    // Recalcular período armónico si el BPM cambió significativamente
    const effectiveBpm = bpm > 0 ? bpm : DEFAULT_BPM
    if (Math.abs(effectiveBpm - state.lastBpmUsed) > BPM_RECALC_THRESHOLD) {
      const resonance = this.findResonantPeriod(effectiveBpm, minChangeTimeMs)
      state.currentHarmonicPeriodMs = resonance.periodMs
      state.lastBpmUsed = effectiveBpm
    }

    const harmonicPeriodMs = state.currentHarmonicPeriodMs
    const elapsed = now - state.lastColorChangeTime

    // ¿Es el mismo color? → no consume el gate
    if (state.lastAllowedColor && this.colorsEqual(newColor, state.lastAllowedColor)) {
      return {
        colorAllowed: true,
        harmonicPeriodMs,
        beatMultiplier: this.getCurrentMultiplier(effectiveBpm, harmonicPeriodMs),
        timeUntilNextChangeMs: Math.max(0, harmonicPeriodMs - elapsed),
      }
    }

    // ¿Ha pasado el período armónico?
    if (elapsed >= harmonicPeriodMs) {
      // GATE ABIERTO → permitir cambio
      state.lastColorChangeTime = now
      state.lastAllowedColor = { ...newColor }

      return {
        colorAllowed: true,
        harmonicPeriodMs,
        beatMultiplier: this.getCurrentMultiplier(effectiveBpm, harmonicPeriodMs),
        timeUntilNextChangeMs: 0,
      }
    }

    // GATE CERRADO → color no permitido en este tick
    return {
      colorAllowed: false,
      harmonicPeriodMs,
      beatMultiplier: this.getCurrentMultiplier(effectiveBpm, harmonicPeriodMs),
      timeUntilNextChangeMs: harmonicPeriodMs - elapsed,
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // API PÚBLICA
  // ═══════════════════════════════════════════════════════════════════════

  /** Resetea el estado de un fixture específico */
  public resetFixture(fixtureId: string): void {
    this.fixtureStates.delete(fixtureId)
  }

  /** Resetea todos los fixtures */
  public resetAll(): void {
    this.fixtureStates.clear()
  }

  /** Obtiene el estado actual de un fixture (para telemetría) */
  public getFixtureState(fixtureId: string): Readonly<FixtureQuantizerState> | undefined {
    return this.fixtureStates.get(fixtureId)
  }

  /** Número de fixtures actualmente tracked */
  public get trackedFixtureCount(): number {
    return this.fixtureStates.size
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MÉTODOS PRIVADOS
  // ═══════════════════════════════════════════════════════════════════════

  /** Compara dos colores RGB con tolerancia cero (determinista) */
  private colorsEqual(a: RGBColor, b: RGBColor): boolean {
    return a.r === b.r && a.g === b.g && a.b === b.b
  }

  /** Calcula el multiplicador actual a partir del período y BPM */
  private getCurrentMultiplier(bpm: number, periodMs: number): number {
    if (bpm <= 0 || periodMs <= 0) return 0
    const beatMs = 60000 / bpm
    return Math.round(periodMs / beatMs)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let _instance: HarmonicQuantizer | null = null

export function getHarmonicQuantizer(): HarmonicQuantizer {
  if (!_instance) {
    _instance = new HarmonicQuantizer()
  }
  return _instance
}
```

---

### 5B. INTEGRAR EN HAL — WAVE 2720

**Archivo:** `electron-app/src/hal/HardwareAbstraction.ts`

#### 5B-1. Import (añadir al bloque de imports, ~línea 59)
```typescript
// 🎵 WAVE 2720: LA LEY UNIVERSAL DEL PÉNDULO — HarmonicQuantizer universal en HAL
import { getHarmonicQuantizer } from './translation/HarmonicQuantizer'
```

#### 5B-2. Extender interfaz `AudioMetrics` (añadir campo `bpmConfidence`)
```typescript
interface AudioMetrics {
  bpm?: number
  bpmConfidence?: number  // 0-1, from IntervalBPMTracker via Worker
}
```

#### 5B-3. Propiedades de instancia en la clase (añadir junto a otras propiedades privadas)
```typescript
// 🎵 WAVE 2720: LA LEY UNIVERSAL DEL PÉNDULO — HarmonicQuantizer universal
private harmonicQuantizer = getHarmonicQuantizer()

// Stored per frame in renderFromTarget(), consumed by HarmonicQuantizer in the HAL pipeline.
private currentFrameBpm = 120
private currentFrameBpmConfidence = 0
```

#### 5B-4. Cache BPM al inicio de `renderFromTarget()` (añadir justo antes del BLACKOUT CHECK)
```typescript
// 🎵 WAVE 2720: LA LEY UNIVERSAL DEL PÉNDULO — Cache BPM per frame
// for HarmonicQuantizer in translateColorToWheel()
this.currentFrameBpm = audio.bpm ?? 120
this.currentFrameBpmConfidence = audio.bpmConfidence ?? 0
```

#### 5B-5. Bloque Quantizer dentro de `translateColorToWheel()` — ANTES del SafetyLayer

**Ubicación:** Dentro de la sección `// 🐟 COLOR WHEEL fixtures`, después de obtener `translation.colorWheelDmx`.

```typescript
// ─────────────────────────────────────────────────────────────────
// 🎵 WAVE 2720: LA LEY UNIVERSAL DEL PÉNDULO — HarmonicQuantizer
// Gate color changes to BPM-harmonic intervals BEFORE SafetyLayer.
// This is THE universal gate: every color command to a mechanical
// fixture passes through here, regardless of source layer
// (Titan, Chronos, Manual, Timeline — ALL are gated here).
//
// Pipeline: ColorTranslator → [QUANTIZER] → SafetyLayer → DarkSpin
//
// If the quantizer blocks the change, we feed the SafetyLayer
// the PREVIOUS color → it sees no change → DarkSpin sees no change
// → no blackout, no motor movement. Elegant and invisible.
// ─────────────────────────────────────────────────────────────────
let quantizedColorDmx = translation.colorWheelDmx ?? 0

if (isMechanicalFixture(profile)) {
  const minChangeTimeMs = profile.colorEngine.colorWheel?.minChangeTimeMs ?? 500
  const targetRGB = { r: state.r, g: state.g, b: state.b }
  const quantizerResult = this.harmonicQuantizer.quantize(
    fixtureId,
    targetRGB,
    this.currentFrameBpm,
    this.currentFrameBpmConfidence,
    minChangeTimeMs
  )

  if (!quantizerResult.colorAllowed) {
    // Gate cerrado: usar el último color permitido por el SafetyLayer
    // (feeding the same DMX value makes SafetyLayer + DarkSpin see "no change")
    const lastState = this.safetyLayer.getLastColor(fixtureId)
    if (lastState !== undefined) {
      quantizedColorDmx = lastState
    }
    // If no lastState yet, pass through (first frame — graceful fallback)
  }
}

// Apply safety filter (debounce)
const safetyResult = this.safetyLayer.filter(
  fixtureId,
  quantizedColorDmx,  // ← usar quantizedColorDmx, NO translation.colorWheelDmx
  profile,
  state.dimmer
)
```

#### 5B-6. `HardwareSafetyLayer.ts` — Añadir método `getLastColor()`

**Archivo:** `electron-app/src/hal/translation/HardwareSafetyLayer.ts`  
**Añadir método público:**
```typescript
/** Expone el último color DMX conocido de un fixture (para el HarmonicQuantizer) */
public getLastColor(fixtureId: string): number | undefined {
  return this.fixtureStates.get(fixtureId)?.lastColorDmx
}
```

#### 5B-7. `TitanOrchestrator.ts` — Propagar `bpmConfidence`

**Archivo:** `electron-app/src/core/orchestrator/TitanOrchestrator.ts`  
**En el objeto `halAudioMetrics`:**
```typescript
const halAudioMetrics = {
  // ... campos existentes ...
  bpmConfidence: this.lastAudioData?.workerBpmConfidence ?? 0,
}
```

**IMPORTANTE:** Una vez integrado el Quantizer en HAL, eliminar el bloque de cuantización local que pueda existir en `TitanOrchestrator` (si sobrevivió de WAVE 2672). El Quantizer vive SOLO en HAL.

---

## RELIQUIA 6: NaN BOMB SHIELD (WAVE 2750)

### 6A. Blindar `clampDMX()` — ARCHIVO 1

**Archivo:** `electron-app/src/core/arbiter/merge/MergeStrategies.ts`  

**ANTES (código original pre-WAVE 2750):**
```typescript
export function clampDMX(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}
```

**DESPUÉS:**
```typescript
/**
 * Clamp a value to DMX range (0-255)
 * ⚡ WAVE 2750: NaN BOMB SHIELD — NaN/Infinity ya no pasan.
 * Math.round(NaN)=NaN, Math.min(255,NaN)=NaN, Math.max(0,NaN)=NaN → Uint8Array coerce a 0x00.
 * Ahora se detecta y se retorna 0 explícitamente (blackout seguro, no zero-snap silencioso).
 */
export function clampDMX(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(255, Math.round(value)))
}
```

### 6B. Blindar `clampDMX()` — ARCHIVO 2

**Archivo:** `electron-app/src/core/protocol/DMXPacket.ts`  

**ANTES:**
```typescript
export function clampDMX(value: number): number {
  return Math.max(DMX_MIN_VALUE, Math.min(DMX_MAX_VALUE, Math.round(value)))
}
```

**DESPUÉS:**
```typescript
/**
 * Clamp de valor DMX
 * ⚡ WAVE 2750: NaN BOMB SHIELD — NaN/Infinity ya no pasan.
 */
export function clampDMX(value: number): number {
  if (!Number.isFinite(value)) return DMX_MIN_VALUE
  return Math.max(DMX_MIN_VALUE, Math.min(DMX_MAX_VALUE, Math.round(value)))
}
```

### 6C. NaN Upstream Guards en MasterArbiter — pan/tilt

**Archivo:** `electron-app/src/core/arbiter/MasterArbiter.ts`  
**Ubicación:** Dentro del método que construye el target final de fixture (donde se calculan `pan` y `tilt` antes del clampDMX), añadir justo antes de la construcción del objeto `target`:

```typescript
// ⚡ WAVE 2750: NaN BOMB UPSTREAM GUARD — pan/tilt fallback to last known position
// Si la aritmética upstream (IK, interpolation, effectIntent) generó NaN,
// preservamos la última posición válida en vez de snap a 0 (HOME).
// clampDMX ya filtra NaN→0, pero para pan/tilt 0=HOME position = destructivo.
const lastPos = this.lastKnownPositions.get(fixtureId)
const safePan  = Number.isFinite(pan)  ? pan  : (lastPos?.pan  ?? 128)
const safeTilt = Number.isFinite(tilt) ? tilt : (lastPos?.tilt ?? 128)

const target = {
  fixtureId,
  dimmer: dimmerfinal,
  color: {
    r: clampDMX(red),
    g: clampDMX(green),
    b: clampDMX(blue),
  },
  pan:  clampDMX(safePan),   // ← safePan, no pan directo
  tilt: clampDMX(safeTilt),  // ← safeTilt, no tilt directo
  zoom:  clampDMX(zoom),
  focus: clampDMX(focus),
  // ... resto campos
}
```

**Nota:** `this.lastKnownPositions` es el Map `lastKnownPositions` que ya existe en MasterArbiter (WAVE 2402, Ghost Protocol). Reutilizarlo. No crear un nuevo Map.

---

## RELIQUIA 7: BREATHING GHOST EXORCISM (WAVE 2750)

### 7A. Limpiar movers en ChillStereoPhysics

**Archivo:** `electron-app/src/hal/physics/ChillStereoPhysics.ts`  
**Función:** `calculateFluidPhysics()`  

**ANTES (código original con breathing hardcodeado):**
```typescript
const lifeActivity = (clarity > 0.7 || energy > 0.65) ? 0.3 : 0
const lifePulse = Math.sin(now / 800) > 0.7 ? lifeActivity : 0

// Líneas DEL PROBLEMA — Breathing sinusoidal ±15% SIEMPRE ACTIVO en movers
const moverIntL = clamp(baseIntensity + Math.sin(now / 2500) * 0.15 + lifePulse + energy * 0.2, 0, 1)
const moverIntR = clamp(baseIntensity + Math.sin(now / 3100 + 2) * 0.15 + lifePulse + energy * 0.2, 0, 1)

const airBase = zone === 'SHALLOWS' ? 0.4 : zone === 'OCEAN' ? 0.25 : 0.1
const airIntensity = clamp(airBase + energy * 0.2 + lifePulse * 0.5, 0, 0.7)
```

**DESPUÉS (movers limpios, PARs/air mantienen lifePulse):**
```typescript
const lifeActivity = (clarity > 0.7 || energy > 0.65) ? 0.3 : 0
const lifePulse = Math.sin(now / 800) > 0.7 ? lifeActivity : 0

// ⚡ WAVE 2750: BREATHING GHOST EXORCISM — Movers son fixtures mecánicos.
// Un dimmer pulsante en un cabezal móvil es ruido visual, no arte.
// El sinusoidal de ±15% y lifePulse se eliminan del cálculo de movers.
// PARs/air mantienen lifePulse porque son LED y el efecto es sutil.
const moverIntL = clamp(baseIntensity + energy * 0.2, 0, 1)
const moverIntR = clamp(baseIntensity + energy * 0.2, 0, 1)

const airBase = zone === 'SHALLOWS' ? 0.4 : zone === 'OCEAN' ? 0.25 : 0.1
const airIntensity = clamp(airBase + energy * 0.2 + lifePulse * 0.5, 0, 0.7)
```

**Qué se removió:**
- `Math.sin(now / 2500) * 0.15` — breathing izquierdo (±15%)
- `Math.sin(now / 3100 + 2) * 0.15` — breathing derecho (período diferente)
- `lifePulse` en `moverIntL` y `moverIntR` — flash gate sinusoidal

**Qué se preservó:**
- `lifePulse` en `airIntensity` — los PARs LED pueden pulsear sutilmente
- `lifeActivity` y `lifePulse` declarados — siguen siendo usados por air

---

---

# PARTE III — LAS 3 RELIQUIAS FINALES (WAVE 2855 EXPANSION)

---

## RELIQUIA 8 + 9: DARK-SPIN FILTER — Módulo completo + Deadlock Fix (WAVE 2690/2691)

### Contexto
DarkSpinFilter es la capa que protege al público de ver el cristal intermedio cuando la rueda de color mecánica rota. Aplica un blackout temporal (`dimmer=0`) mientras dura el tránsito. WAVE 2691 corrigió un deadlock crítico donde el contador se reiniciaba en cada frame, congelando el fixture en negro indefinidamente.

**Las dos correcciones son inseparables** — el módulo debe crearse con el fix 2691 ya incluido.

### 8A. CREAR EL MÓDULO COMPLETO

**Ruta:** `electron-app/src/hal/translation/DarkSpinFilter.ts`  
**Acción:** Crear este archivo desde cero (no existía antes de `527410d`).

```typescript
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌑 WAVE 2690: DARK-SPIN FILTER - LA LEY FÍSICA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PROBLEMA QUE RESUELVE:
 * Los fixtures mecánicos (Beam 2R, etc.) tienen una rueda de colores física.
 * Cuando el DMX ordena un cambio de slot, la rueda gira — y durante ~500ms
 * el cristal intermedio queda visible. El público NUNCA debe ver ese cristal.
 *
 * SOLUCIÓN:
 * Dark-Spin es una LEY FÍSICA GLOBAL que aplica a TODO el sistema:
 * Si se detecta un cambio de valor DMX en el canal colorWheel de un
 * fixture mecánico, se inyecta un blackout (dimmer=0) para ese fixture.
 * El blackout se mantiene durante el tiempo de tránsito (minChangeTimeMs).
 * Terminado el tránsito, se libera el dimmer.
 *
 * WAVE 2691 FIX — DEADLOCK:
 * Bug original: transitStartTime se reescribía en CADA frame porque CHECK 2
 * se re-ejecutaba mientras inTransit=true. El counter nunca avanzaba → negro eterno.
 * Fix: campo pendingColorDmx separa "color estable" de "color en vuelo".
 * CHECK 1 y CHECK 2 son mutuamente exclusivos por estados de transición.
 *
 * RELACIÓN CON HardwareSafetyLayer:
 * SafetyLayer decide SI el cambio se permite (debounce).
 * DarkSpinFilter asume que el cambio YA fue aprobado y enmascara el tránsito.
 *
 * RELACIÓN CON HarmonicQuantizer:
 * Quantizer cuantiza cambios a subdivisiones musicales ANTES del SafetyLayer.
 * DarkSpinFilter opera DESPUÉS: cuando un cambio cuantizado y aprobado ocurre,
 * enmascara el tránsito mecánico.
 *
 * Pipeline completo: Quantizer → SafetyLayer → DarkSpinFilter
 *
 * @module hal/translation/DarkSpinFilter
 * @version WAVE 2690 + 2691
 */

import type { FixtureProfile } from './FixtureProfiles'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estado de tránsito por fixture
 * 🔧 WAVE 2691: pendingColorDmx separado de lastStableColorDmx para evitar
 * que CHECK 2 se re-dispare en cada frame mientras inTransit=true.
 */
interface DarkSpinState {
  /** Último color wheel DMX ya estable (ANTES del tránsito activo) */
  lastStableColorDmx: number
  /** El nuevo color que está en tránsito ahora — guardado en CHECK 2, liberado en CHECK 1 */
  pendingColorDmx: number
  /** ¿Estamos en tránsito ahora? */
  inTransit: boolean
  /** Timestamp de inicio del tránsito */
  transitStartTime: number
  /** Duración del tránsito actual (ms) */
  transitDurationMs: number
}

/**
 * Resultado del filtro Dark-Spin
 */
export interface DarkSpinResult {
  /** Dimmer final (0 durante tránsito, original si no) */
  dimmer: number
  /** ¿Estamos en blackout de tránsito? */
  inTransit: boolean
  /** ms restantes de tránsito (0 si no aplica) */
  transitRemainingMs: number
}

// ═══════════════════════════════════════════════════════════════════════════
// DARK-SPIN FILTER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class DarkSpinFilter {
  /** Estado por fixture */
  private fixtureStates = new Map<string, DarkSpinState>()

  /** Multiplicador de seguridad sobre minChangeTimeMs */
  private safetyMargin: number

  constructor(safetyMargin = 1.1) {
    this.safetyMargin = safetyMargin
  }

  /**
   * 🌑 MÉTODO PRINCIPAL: Evalúa si un fixture necesita blackout de tránsito
   *
   * Se llama DESPUÉS del SafetyLayer, con el colorWheelDmx aprobado.
   * Si detecta que el color cambió, activa un blackout temporal.
   *
   * @param fixtureId - ID único del fixture
   * @param currentColorDmx - Color wheel DMX que el SafetyLayer aprobó
   * @param profile - Perfil del fixture (para obtener minChangeTimeMs)
   * @param requestedDimmer - Dimmer que el sistema quiere aplicar
   * @returns Resultado con el dimmer filtrado
   */
  public filter(
    fixtureId: string,
    currentColorDmx: number,
    profile: FixtureProfile,
    requestedDimmer: number
  ): DarkSpinResult {
    const now = Date.now()

    // Obtener o crear estado
    let state = this.fixtureStates.get(fixtureId)
    if (!state) {
      state = {
        lastStableColorDmx: currentColorDmx,
        pendingColorDmx: currentColorDmx,
        inTransit: false,
        transitStartTime: 0,
        transitDurationMs: 0,
      }
      this.fixtureStates.set(fixtureId, state)
      // Primer frame — no hay tránsito
      return { dimmer: requestedDimmer, inTransit: false, transitRemainingMs: 0 }
    }

    // ═══════════════════════════════════════════════════════════════════
    // CHECK 1: ¿Estamos en tránsito activo?
    // ═══════════════════════════════════════════════════════════════════
    if (state.inTransit) {
      const elapsed = now - state.transitStartTime
      const remaining = state.transitDurationMs - elapsed

      // 🔧 WAVE 2691 FAIL-SAFE: Si el tránsito lleva más de minChangeTimeMs * 2,
      // forzar reset para evitar deadlock infinito (p.ej. si el clock se congela
      // o si algún bug externo impide que elapsed supere transitDurationMs).
      const failSafeLimit = state.transitDurationMs * 2
      if (elapsed >= failSafeLimit) {
        console.warn(
          `[DarkSpin 🔴 FAIL-SAFE] ${fixtureId}: Tránsito atascado ${elapsed}ms (límite ${failSafeLimit}ms). Forzando reset.`
        )
        state.inTransit = false
        state.lastStableColorDmx = state.pendingColorDmx
        // ← caemos al CHECK 2 para evaluar si hay un nuevo cambio
      } else if (remaining > 0) {
        // Tránsito en progreso → BLACKOUT
        return { dimmer: 0, inTransit: true, transitRemainingMs: remaining }
      } else {
        // Tránsito terminado normalmente → liberar
        state.inTransit = false
        state.lastStableColorDmx = state.pendingColorDmx
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // CHECK 2: ¿Hay un nuevo cambio de color?
    // ═══════════════════════════════════════════════════════════════════
    if (currentColorDmx !== state.lastStableColorDmx) {
      // ¡CAMBIO DETECTADO! Activar blackout de tránsito.
      // CRITICAL (WAVE 2691): Solo se activa UNA VEZ — guardamos pendingColorDmx
      // para que los frames subsiguientes (con el mismo currentColorDmx) no
      // re-disparen el tránsito. Los frames N+1..N+K entran por CHECK 1 directamente.
      const minChangeTime = profile.colorEngine.colorWheel?.minChangeTimeMs ?? 500
      const transitDuration = Math.round(minChangeTime * this.safetyMargin)

      state.inTransit = true
      state.transitStartTime = now
      state.transitDurationMs = transitDuration
      state.pendingColorDmx = currentColorDmx

      console.log(
        `[DarkSpin 🌑] ${fixtureId}: Color transit DMX ${state.lastStableColorDmx}→${currentColorDmx} — Blackout ${transitDuration}ms`
      )

      return { dimmer: 0, inTransit: true, transitRemainingMs: transitDuration }
    }

    // ═══════════════════════════════════════════════════════════════════
    // SIN CAMBIO: Pass-through
    // ═══════════════════════════════════════════════════════════════════
    return { dimmer: requestedDimmer, inTransit: false, transitRemainingMs: 0 }
  }

  /** Resetea el estado de un fixture */
  public resetFixture(fixtureId: string): void {
    this.fixtureStates.delete(fixtureId)
  }

  /** Resetea todos los estados */
  public resetAll(): void {
    this.fixtureStates.clear()
  }

  /** Métricas de diagnóstico */
  public getMetrics(): { activeFixtures: number; fixturesInTransit: number } {
    let inTransit = 0
    for (const state of this.fixtureStates.values()) {
      if (state.inTransit) inTransit++
    }
    return { activeFixtures: this.fixtureStates.size, fixturesInTransit: inTransit }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let instance: DarkSpinFilter | null = null

export function getDarkSpinFilter(): DarkSpinFilter {
  if (!instance) {
    instance = new DarkSpinFilter()
  }
  return instance
}
```

### 8B. INTEGRAR DARKSPIN EN HAL

**Archivo:** `electron-app/src/hal/HardwareAbstraction.ts`

#### Import (añadir junto al del HarmonicQuantizer)
```typescript
// 🌑 WAVE 2690: DARK-SPIN FILTER — Enmascara tránsito mecánico de rueda de color
import { getDarkSpinFilter } from './translation/DarkSpinFilter'
```

#### Propiedad de instancia
```typescript
private darkSpinFilter = getDarkSpinFilter()
```

#### Uso al final del pipeline en `translateColorToWheel()` — DESPUÉS del SafetyLayer
```typescript
// Apply DarkSpin filter — blackout durante tránsito mecánico de rueda de color
// Se aplica DESPUÉS del SafetyLayer: si SafetyLayer bloqueó el cambio,
// DarkSpin ve el mismo color → no activa tránsito → dimmer sin cambio.
const darkSpinResult = this.darkSpinFilter.filter(
  fixtureId,
  safetyResult.finalColorDmx,
  profile,
  state.dimmer
)

return {
  colorWheel: safetyResult.finalColorDmx,
  dimmer: darkSpinResult.dimmer,  // 0 si en tránsito, state.dimmer si estable
  strobe: state.strobe,
  inDarkSpinTransit: darkSpinResult.inTransit,
}
```

#### Fix de optional chaining (WAVE 2691 cleanup)
```typescript
// ANTES (crash con fixtures de la Forja que no tienen .safety):
const darkSpin = profile.safety.blackoutOnColorChange

// DESPUÉS:
const darkSpin = profile.safety?.blackoutOnColorChange
```

---

## RELIQUIA 10: LAYER 2 SEGMENTED MERGE (WAVE 2710/2711)

### Contexto
**El bug (WAVE 2710 H1 — Secuestro Cromático):** Cuando PositionSection enviaba `{pan, tilt}` después de que ColorSection había enviado `{red, green, blue}`, el `setManualOverride()` con blind union acumulaba todos los canales en un solo override. Los channels `['red', 'green', 'blue', 'pan', 'tilt']` quedaban en el override pero `controls.red=0` (valor por defecto) → color muerto, fixture blanco.

**El fix (WAVE 2711):** Segmentar por **categoría de canal**. Cada sección UI toca una categoría distinta. Cuando llega un override, se purgan solo los canales de las categorías tocadas — preservando el resto.

### 10A. CHANNEL CATEGORIES EN `types.ts`

**Archivo:** `electron-app/src/core/arbiter/types.ts`  
**Añadir antes de las interfaces de Layer 0:**

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// 🔧 WAVE 2711: CHANNEL CATEGORIES — Segmented merge anti-color-kidnap
// Each UI Section (ColorSection, PositionSection, etc.) owns a category.
// setManualOverride() replaces channels of the INCOMING category only —
// channels of OTHER categories from the existing override are PRESERVED.
// This prevents PositionSection's override from inheriting stale color
// channels via blind union merge.
// ═══════════════════════════════════════════════════════════════════════════

export type ChannelCategory = 'color' | 'position' | 'intensity' | 'beam' | 'control' | 'ingenios'

const CHANNEL_CATEGORY_MAP: Record<ChannelType, ChannelCategory> = {
  // COLOR
  red: 'color',
  green: 'color',
  blue: 'color',
  white: 'color',
  amber: 'color',
  uv: 'color',
  cyan: 'color',
  magenta: 'color',
  yellow: 'color',
  color_wheel: 'color',
  // POSITION
  pan: 'position',
  pan_fine: 'position',
  tilt: 'position',
  tilt_fine: 'position',
  // INTENSITY
  dimmer: 'intensity',
  strobe: 'intensity',
  shutter: 'intensity',
  // BEAM
  gobo: 'beam',
  gobo_rotation: 'beam',
  prism: 'beam',
  prism_rotation: 'beam',
  focus: 'beam',
  zoom: 'beam',
  frost: 'beam',
  // CONTROL
  speed: 'control',
  macro: 'control',
  control: 'control',
  // INGENIOS
  rotation: 'ingenios',
  custom: 'ingenios',
  // FALLBACK
  unknown: 'control',
}

/**
 * Get the category for a channel type.
 * Used by setManualOverride to determine which channels to replace vs preserve.
 */
export function getChannelCategory(channel: ChannelType): ChannelCategory {
  return CHANNEL_CATEGORY_MAP[channel] ?? 'control'
}

/**
 * Get all unique categories present in a list of channels.
 */
export function getChannelCategories(channels: ChannelType[]): Set<ChannelCategory> {
  const categories = new Set<ChannelCategory>()
  for (const ch of channels) {
    categories.add(getChannelCategory(ch))
  }
  return categories
}
```

### 10B. SEGMENTED MERGE EN `MasterArbiter.ts`

**Archivo:** `electron-app/src/core/arbiter/MasterArbiter.ts`

#### Import (añadir a los imports de types):
```typescript
import {
  // ... imports existentes ...
  getChannelCategories,
  getChannelCategory,
  type ChannelCategory,
} from './types'
```

#### Reemplazar el bloque de merge en `setManualOverride()`:

El método `setManualOverride()` ya existe post-reset (era WAVE 440, existe desde antes). Hay que reemplazar la lógica de merge existente (que era `blind union`) con esta:

```typescript
// 🔧 WAVE 2711: SEGMENTED MERGE — Replace by category, preserve by category
const existingOverride = this.layer2_manualOverrides.get(override.fixtureId)

if (existingOverride) {
  // Determine which categories the NEW override touches
  const incomingCategories = getChannelCategories(override.overrideChannels)

  // PRESERVE: existing channels whose category is NOT in the incoming set
  const preservedChannels = existingOverride.overrideChannels.filter(
    ch => !incomingCategories.has(getChannelCategory(ch))
  )

  // Build preserved controls — only keep control values for preserved channels
  const preservedControls: Record<string, any> = {}
  for (const ch of preservedChannels) {
    const value = (existingOverride.controls as any)[ch]
    if (value !== undefined) {
      preservedControls[ch] = value
    }
  }

  // FINAL CONTROLS: preserved (old categories) + incoming (new categories)
  const mergedControls: Record<string, any> = {
    ...preservedControls,
    ...override.controls,
  }

  // FINAL CHANNELS: preserved + incoming (no duplicates, category-clean)
  const mergedChannels = [...new Set([
    ...preservedChannels,
    ...override.overrideChannels,
  ])]

  // Store category-segmented override
  this.layer2_manualOverrides.set(override.fixtureId, {
    ...existingOverride,
    ...override,
    controls: mergedControls,
    overrideChannels: mergedChannels as ChannelType[],
    timestamp: performance.now()
  })
} else {
  // No existing override — store as new
  this.layer2_manualOverrides.set(override.fixtureId, {
    ...override,
    timestamp: performance.now()
  })
}
```

**Comportamiento post-fix:**

| Escenario | Resultado ANTES (WAVE 440) | Resultado DESPUÉS (WAVE 2711) |
|-----------|---------------------------|-------------------------------|
| ColorSection → PositionSection | channels acumulados, `red=0` → color muerto | Categorías separadas: color=intacto, position=nuevo |
| PositionSection → ColorSection | channels acumulados, `pan=0` → pan muerto | Categorías separadas: position=intacto, color=nuevo |
| ColorSection → ColorSection | update correcto | update correcto (igual) |
| PositionSection sola | correcto | correcto (igual) |

---

# PARTE IV — VERIFICACIÓN Y RESUMEN FINAL

## Checklist post-Reset y post-Re-aplicación

```
□ DarkSpinFilter.ts creado en hal/translation/
□ Import getDarkSpinFilter en HardwareAbstraction.ts
□ private darkSpinFilter en clase HAL
□ DarkSpin.filter() al final del pipeline en translateColorToWheel()
□ profile.safety?.blackoutOnColorChange (optional chaining)
□ HarmonicQuantizer.ts creado en hal/translation/
□ Import getHarmonicQuantizer en HardwareAbstraction.ts
□ bpmConfidence propagado en AudioMetrics interface
□ private harmonicQuantizer + currentFrameBpm* en clase HAL
□ Cache BPM en renderFromTarget()
□ Bloque quantize() en translateColorToWheel() (ANTES del SafetyLayer)
□ getLastColor() añadido en HardwareSafetyLayer.ts
□ bpmConfidence propagado en TitanOrchestrator.ts halAudioMetrics
□ ChannelCategory + CHANNEL_CATEGORY_MAP + getChannelCategory() en types.ts
□ Segmented merge en MasterArbiter.setManualOverride()
□ Import getChannelCategories, getChannelCategory en MasterArbiter.ts
□ clampDMX NaN guard en MergeStrategies.ts
□ clampDMX NaN guard en DMXPacket.ts
□ safePan/safeTilt NaN guard en MasterArbiter.ts
□ Breathing Ghost removido de moverIntL/moverIntR en ChillStereoPhysics.ts
□ LiquidEnvelope ghostCap floor
□ isManualPosition SNAP en HAL + FixturePhysicsDriver
□ BabelFish per-fixture loop en ArbiterIPCHandlers
□ BabelFish Anti-Blackout en HAL translateColorToWheel
```

## Compilación final

```bash
cd electron-app && npx tsc --noEmit
# Expected: exit 0
```

---

## Tabla de Archivos Afectados (completa)

| Archivo | Reliquias | Acción |
|---------|-----------|--------|
| `hal/translation/DarkSpinFilter.ts` | 8+9 | CREAR NUEVO |
| `hal/translation/HarmonicQuantizer.ts` | 5A | CREAR NUEVO |
| `hal/HardwareAbstraction.ts` | 5B, 8B, 1, 3 | MODIFICAR |
| `hal/translation/HardwareSafetyLayer.ts` | 5B-6 | AÑADIR MÉTODO |
| `hal/physics/LiquidEnvelope.ts` | 4 | MODIFICAR |
| `hal/physics/ChillStereoPhysics.ts` | 7 | MODIFICAR |
| `core/arbiter/types.ts` | 10A | AÑADIR CHANNEL CATEGORIES |
| `core/arbiter/MasterArbiter.ts` | 6C, 10B | MODIFICAR |
| `core/arbiter/merge/MergeStrategies.ts` | 6A | MODIFICAR |
| `core/protocol/DMXPacket.ts` | 6B | MODIFICAR |
| `core/orchestrator/TitanOrchestrator.ts` | 5B-7 | MODIFICAR |
| `core/arbiter/ArbiterIPCHandlers.ts` | 2 | MODIFICAR |
| `engine/movement/FixturePhysicsDriver.ts` | 1 | MODIFICAR |

---

*Generado por PunkOpus — WAVE 2855: Ark Expansion (Final)*  
*15-APR-2026*  
*El Arca ahora tiene 10 reliquias. Que venga el diluvio.*
