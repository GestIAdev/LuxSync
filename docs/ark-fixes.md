# WAVE 2850: ARK FIXES — Los 4 Fixes Estructurales Para Sobrevivir al Diluvio
> **Fecha:** 15 de Abril de 2026  
> **Propósito:** Código exacto de los 4 fixes universales que deben re-aplicarse post-reset.  
> **Regla:** Estos fixes son **vibe-agnósticos** — funcionan para Techno, Latino, PopRock, Chill, y cualquier vibe futuro. Ninguno depende de lógica oceánica ni de la metáfora Chillout.

---

## INSTRUCCIONES DE RE-APLICACIÓN

Después del hard reset a `527410d`, estos fixes deben aplicarse **en orden** porque hay dependencias:

```
1. HAL isManualPosition (independiente)
2. BabelFish LED PARs Guard (independiente)
3. BabelFish Anti-Blackout (depende de que exista ColorTranslator)
4. LiquidEnvelope ghostCap (independiente)
```

Los fixes 1 y 4 son completamente independientes y pueden aplicarse en paralelo. Los fixes 2 y 3 tocan el pipeline de BabelFish y deben aplicarse en secuencia.

---

## FIX 1: HAL isManualPosition + FixturePhysicsDriver SNAP

**WAVE:** 2785 / 2785.3  
**Problema:** Cuando el operador controla pan/tilt manualmente (Layer 2), la física del vibe (especialmente Chill: maxVelocity=8 DMX/s) interpola glacialmente. Un drag de radar tarda 12 segundos en llegar al destino.  
**Solución:** Detectar Layer 2 manual en `renderFromTarget()` → pasar flag `isManualPosition=true` → FixturePhysicsDriver usa 400 DMX/s rev limit directo (respuesta <100ms).

### Archivo 1A: `electron-app/src/hal/HardwareAbstraction.ts`

**Ubicación:** Dentro de `renderFromTarget()`, justo antes de la llamada a `this.movementPhysics.translateDMX()`.

```typescript
// 🏎️ WAVE 2074.2: Apply physics interpolation with real deltaTime
// 🔥 WAVE 2785.3: Detect manual position control → fast-track physics
// BUGFIX: This was missing in renderFromTarget() — only existed in render()
// Without this, manual overrides (Layer 2 pan/tilt) were interpolated through
// vibe physics (Chill = maxVelocity 8 DMX/s = glacial), ignoring the operator.
const sources = state._controlSources as Record<string, number> | undefined
const isManualPosition = sources !== undefined && (
  sources['pan'] === ControlLayer.MANUAL || sources['tilt'] === ControlLayer.MANUAL
)
this.movementPhysics.translateDMX(fixtureId, state.pan, state.tilt, physicsDt, isManualPosition)
```

**Dependencia:** `ControlLayer` debe estar importado (ya existe en imports de MasterArbiter integration).

### Archivo 1B: `electron-app/src/engine/movement/FixturePhysicsDriver.ts`

**Ubicación:** Método `translateDMX()`, al inicio antes de la lógica de interpolación normal.

```typescript
/**
 *  🔥 WAVE 2785: isManualPosition flag — cuando el operador tiene control
 *  manual de pan/tilt, el physics driver usa SNAP rápido independientemente
 *  del vibe activo. Evita que la inercia glacial de Chill bloquee la
 *  respuesta del radar.
 */
translateDMX(fixtureId: string, targetPanDMX: number, targetTiltDMX: number, deltaTime = 16, isManualPosition = false): DMXPosition {
  const config = this.configs.get(fixtureId)
  if (!config) {
    console.warn(`[PhysicsDriver] Fixture "${fixtureId}" no configurado`)
    return { fixtureId, panDMX: 127, tiltDMX: 127, panFine: 0, tiltFine: 0 }
  }

  // Aplicar límites de seguridad directamente
  const safePan = Math.max(0, Math.min(255, targetPanDMX))
  const safeTilt = Math.max(config.limits.tiltMin, Math.min(config.limits.tiltMax, targetTiltDMX))
  
  const targetDMX: Position2D = { pan: safePan, tilt: safeTilt }

  // ═══════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 2785: MANUAL OVERRIDE FAST-TRACK
  // Cuando el operador tiene control manual de posición, la física del
  // vibe NO puede bloquear la respuesta. Chill tiene maxVelocity=8 DMX/s
  // y maxAccel=4 — eso convierte un drag de radar en un viaje de 12 segundos.
  // En modo manual: snap directo con revLimit de operador (400 DMX/s).
  // El fixture responde en <100ms a cualquier movimiento del radar.
  // ═══════════════════════════════════════════════════════════════════════
  if (isManualPosition) {
    const current = this.currentPositions.get(fixtureId)
    if (!current) {
      this.currentPositions.set(fixtureId, targetDMX)
      this.velocities.set(fixtureId, { pan: 0, tilt: 0 })
    } else {
      const dt = deltaTime / 1000
      const MANUAL_REV_LIMIT = 400 // DMX/s — mismo que Techno, respuesta profesional
      const maxThisFrame = MANUAL_REV_LIMIT * dt

      let deltaPan = targetDMX.pan - current.pan
      let deltaTilt = targetDMX.tilt - current.tilt

      deltaPan = Math.max(-maxThisFrame, Math.min(maxThisFrame, deltaPan))
      deltaTilt = Math.max(-maxThisFrame, Math.min(maxThisFrame, deltaTilt))

      const newPos = { pan: current.pan + deltaPan, tilt: current.tilt + deltaTilt }
      this.currentPositions.set(fixtureId, newPos)
      this.velocities.set(fixtureId, {
        pan: dt > 0 ? deltaPan / dt : 0,
        tilt: dt > 0 ? deltaTilt / dt : 0,
      })
    }

    const pos = this.currentPositions.get(fixtureId)!
    const panDMX = Math.round(Math.max(0, Math.min(255, pos.pan)))
    const tiltDMX = Math.round(Math.max(0, Math.min(255, pos.tilt)))
    return {
      fixtureId,
      panDMX,
      tiltDMX,
      panFine: Math.round(Math.max(0, Math.min(255, (pos.pan - panDMX) * 255))),
      tiltFine: Math.round(Math.max(0, Math.min(255, (pos.tilt - tiltDMX) * 255))),
    }
  }
  
  // ... (resto de interpolación normal del vibe)
```

---

## FIX 2: BabelFish LED PARs Guard (Per-Fixture Translation)

**WAVE:** 2770 / 2772  
**Problema:** BabelFish traducía RGB → Color Wheel globalmente. Si la selección mezclaba fixtures con rueda de color y LED PARs RGB, los PARs perdían sus canales RGB y recibían `color_wheel` (un canal que no tienen).  
**Solución:** Mover la traducción DENTRO del loop per-fixture. Solo traducir si `needsColorTranslation(profile)` es true. Guard adicional: `wasTranslated && colorWheelDmx !== undefined`.

### Archivo: `electron-app/src/core/arbiter/ArbiterIPCHandlers.ts`

**Ubicación:** Dentro de la función que procesa comandos de control (override handler), reemplaza el bloque de traducción global.

**Import necesario (línea ~22):**
```typescript
import { getProfile, needsColorTranslation } from '../../hal/translation/FixtureProfiles'
```

**Bloque de traducción per-fixture:**
```typescript
// ═══════════════════════════════════════════════════════════════════════════
// 🎨 WAVE 2042.32: COLOR TRANSLATION - RGB → Color Wheel
// Commander sends RGB, but fixtures might have color wheels.
// Detect and translate automatically using ColorTranslator.
//
// 🔧 WAVE 2770: FIX — Multi-profile translation.
// Old code checked only the FIRST fixture's profile and applied the same
// translation to ALL fixtures. If the selection mixes color-wheel fixtures
// with RGB fixtures, half of them got wrong controls. Now translation
// happens per-fixture inside the loop.
// ═══════════════════════════════════════════════════════════════════════════
const hasRGB = channels.includes('red') && channels.includes('green') && channels.includes('blue')

const overrideCount = resolvedFixtureIds.length

for (const fixtureId of resolvedFixtureIds) {
  let perFixtureControls = { ...finalControls }
  let perFixtureChannels = [...finalChannels]
  
  if (hasRGB) {
    const fixtureData = masterArbiter.getFixture(fixtureId)
    if (fixtureData) {
      const profile = getProfile(fixtureData.profileId || '')
      if (profile && needsColorTranslation(profile)) {
        const targetRGB = {
          r: controls.red || 0,
          g: controls.green || 0,
          b: controls.blue || 0
        }
        const translation = colorTranslator.translate(targetRGB, profile)
        
        // 🔧 WAVE 2772: BABELFISH RESTORATION — Defensive guard.
        // Only replace RGB with color_wheel if translation actually produced
        // a valid wheel DMX value. If colorWheelDmx is undefined (e.g. RGB
        // fixture with hybrid profile, or translation fallback), keep RGB
        // intact to avoid destroying the operator's color intent.
        if (translation.wasTranslated && translation.colorWheelDmx !== undefined) {
          if (!_babelFishLogThrottle || Date.now() - _babelFishLogThrottle > 2000) {
            console.log(`[Arbiter] 🎨 COLOR TRANSLATION (${fixtureId}): RGB(${targetRGB.r},${targetRGB.g},${targetRGB.b}) → Wheel=${translation.colorWheelDmx} (${translation.colorName})`)
            _babelFishLogThrottle = Date.now()
          }
          
          perFixtureControls = { ...perFixtureControls }
          delete perFixtureControls.red
          delete perFixtureControls.green
          delete perFixtureControls.blue
          perFixtureControls.color_wheel = translation.colorWheelDmx
          
          perFixtureChannels = perFixtureChannels.filter(ch => !['red', 'green', 'blue'].includes(ch))
          perFixtureChannels.push('color_wheel')
        } else {
          // Translation returned no wheel DMX — fixture keeps RGB as-is
          if (!_babelFishLogThrottle || Date.now() - _babelFishLogThrottle > 2000) {
            console.log(`[Arbiter] 🎨 BABELFISH SKIP (${fixtureId}): needsColorTranslation=true but translate() returned no colorWheelDmx. Keeping RGB.`)
            _babelFishLogThrottle = Date.now()
          }
        }
      }
    }
  }
  
  const override: Layer2_Manual = {
    fixtureId,
    controls: perFixtureControls as any,
    overrideChannels: perFixtureChannels as any,
    mode: 'absolute',
    source: 'ui_programmer',
    priority: 100,
    autoReleaseMs: 0,
    releaseTransitionMs: 500,
    timestamp: performance.now(),
  }
  
  masterArbiter.setManualOverride(override)
}
```

**Variable auxiliar necesaria (fuera de la función, a nivel módulo):**
```typescript
let _babelFishLogThrottle = 0
```

---

## FIX 3: BabelFish Anti-Blackout (Zero Guard + Control Source Check)

**WAVE:** 2770  
**Problema:** `color_wheel=0` (DMX 0 = "Open/White" en muchos fixtures) era tratado como "sin override", causando que BabelFish re-tradujera y potencialmente destruyera la elección explícita del operador. También: al fallar una traducción, el output podía ser DMX 0 = blackout.  
**Solución:** Checkear `_controlSources` — si `color_wheel` vino de control manual (Layer 2), respetar SIN importar el valor. Si no hay perfil, asumir fixture RGB y pass-through.

### Archivo: `electron-app/src/hal/HardwareAbstraction.ts`

**Ubicación:** Inicio del método `translateColorToWheel()`.

```typescript
/**
 * 🐟 BABEL FISH: Translate RGB to Color Wheel DMX if fixture needs it
 * @returns Modified state with colorWheel set (or original state if no translation needed)
 */
private translateColorToWheel(
  state: FixtureState, 
  fixture: PatchedFixture,
  existingColorWheel: number
): FixtureState {
  // 🔧 WAVE 2770: FIX — Zero guard was treating color_wheel=0 (OPEN/WHITE)
  // as "no override", causing Babel Fish to re-translate and destroy
  // the operator's explicit choice. The correct test: check _controlSources.
  // If color_wheel came from a MANUAL override, respect it regardless of value.
  const colorWheelSource = (state as any)._controlSources?.color_wheel
  if (colorWheelSource === ControlLayer.MANUAL || existingColorWheel > 0) {
    return state
  }
  
  // Get fixture profile
  const profile = this.getFixtureProfileCached(fixture)
  if (!profile) {
    return state // No profile = assume RGB fixture, pass-through
  }
  
  // Check if fixture needs color translation (has color wheel)
  if (!needsColorTranslation(profile)) {
    return state // RGB/CMY fixture, no translation needed
  }
  
  // 🐟 TRANSLATE RGB → PHYSICAL COLOR (wheel/RGBW/CMY)
  const targetRGB: RGB = { r: state.r, g: state.g, b: state.b }
  const translation = this.colorTranslator.translate(targetRGB, profile)
  
  // If not translated (shouldn't happen if needsColorTranslation=true), pass-through
  if (!translation.wasTranslated) {
    return state
  }

  // ... (rest of RGBW/CMY/ColorWheel handling + HarmonicQuantizer + SafetyLayer + DarkSpin)
```

**Puntos de protección anti-blackout (3 capas):**
1. **L1 — Source check:** Si `color_wheel` es MANUAL → return state (no re-traducir)
2. **L2 — Profile check:** Si no hay profile → return state (asumir RGB, no blackout)
3. **L3 — Translation check:** Si `!wasTranslated` → return state (no aplicar fallback roto)

---

## FIX 4: LiquidEnvelope ghostCap Floor

**WAVE:** 2792  
**Problema:** El SMOOTH FADE (Step 9) del envelope multiplicaba cuadráticamente hacia 0 cuando `intensity < 0.08`. En Chillout, durante breakdowns, esto causaba que el dimmer del mover llegara a ~0 (parpadeo) a pesar de que el perfil declaraba `ghostCap: 0.22` ("nunca oscuro").  
**Solución:** Añadir Step 10 al final de `process()` que garantiza `output >= ghostCap * max(morphFactor, 0.1)`. Backward compatible: si `ghostCap=0` → `dimmerFloor=0` → sin cambio.

### Archivo: `electron-app/src/hal/physics/LiquidEnvelope.ts`

**Ubicación:** Al final del método `process()`, reemplazando el `return` directo.

**ANTES (código original):**
```typescript
    // 9. SMOOTH FADE — Anti-guillotine low-end filter
    const fadeZone = 0.08
    const fadeFactor = s.intensity >= fadeZone
      ? 1.0
      : Math.pow(s.intensity / fadeZone, 2)

    return Math.min(c.maxIntensity, s.intensity * fadeFactor)
```

**DESPUÉS (con ghostCap floor):**
```typescript
    // ═══════════════════════════════════════════════════════════════════
    // 9. SMOOTH FADE — Anti-guillotine low-end filter
    //    Herencia: WAVE 2383 (quadratic fade below 0.08)
    // ═══════════════════════════════════════════════════════════════════
    const fadeZone = 0.08
    const fadeFactor = s.intensity >= fadeZone
      ? 1.0
      : Math.pow(s.intensity / fadeZone, 2)

    const faded = Math.min(c.maxIntensity, s.intensity * fadeFactor)

    // ═══════════════════════════════════════════════════════════════════
    // 10. GHOST CAP FLOOR — Dimmer floor garantizado
    //    Si ghostCap > 0, garantizar que el output nunca baje de
    //    ghostCap * max(morphFactor, 0.1). El mínimo 0.1 garantiza que
    //    incluso en el abismo (morphFactor≈0) el floor sea ghostCap*0.1.
    //    Perfiles sin ghostCap (ghostCap=0): dimmerFloor=0, sin cambio.
    // ═══════════════════════════════════════════════════════════════════
    const dimmerFloor = c.ghostCap > 0 ? c.ghostCap * Math.max(morphFactor, 0.1) : 0

    return Math.max(dimmerFloor, faded)
```

**Tabla de comportamiento:**

| Perfil | ghostCap | morphFactor | dimmerFloor | Efecto |
|--------|----------|-------------|-------------|--------|
| Techno | 0.00 | N/A | 0.00 | Sin cambio |
| Latino | 0.00 | N/A | 0.00 | Sin cambio |
| PopRock | 0.00 | N/A | 0.00 | Sin cambio |
| Chill (superficie) | 0.22 | 1.0 | 0.22 | 22% mínimo |
| Chill (abismo) | 0.22 | 0.0 | 0.022 | 2.2% bioluminiscencia |

---

## NOTAS FINALES

### Orden de aplicación post-reset:
```
1. FIX 4 (LiquidEnvelope ghostCap)     ← Independiente, sin dependencias
2. FIX 1 (isManualPosition + SNAP)      ← 2 archivos, sin dependencias
3. FIX 2 (BabelFish LED PARs Guard)     ← Necesita FixtureProfiles.needsColorTranslation()
4. FIX 3 (BabelFish Anti-Blackout)      ← Necesita ControlLayer import
```

### Lo que NO va en el Arca (chill-only workarounds):
- ❌ COLOR BUNKER (`lastKnownColors` + freeze)
- ❌ MoodArbiter neutralization (`mood: 'neutral'`)
- ❌ Ghost Handoff disabled
- ❌ Deprecated `colorOverride` bypasses

### Verificación post-aplicación:
```bash
cd electron-app && npx tsc --noEmit
# Expected: exit 0
```

---

*Generado por PunkOpus — WAVE 2850: Operation Ark*  
*15-APR-2026*  
*Este documento es el salvavidas. Tratarlo con respeto.*
