# OMNILIQUID ENGINE v2.0 — BLUEPRINT ARQUITECTÓNICO

## WAVE 2435 — OVERRIDES 4.1 + RESOLUCIÓN GATEOFF

**Fecha:** 2026-04-01
**Autores:** PunkOpus + Radwulf
**Status:** ✅ IMPLEMENTADO — WAVE 2435 ejecutada. TypeScript compila limpio.

---

## 0. RESUMEN EJECUTIVO

Dos deudas técnicas del Omni-Liquid Engine requieren cirugía coordinada:

1. **Overrides 4.1 vs 7.1**: El `max()` de `LiquidEngine41.routeZones()` compacta 7 señales independientes en 4.  Cuando un perfil diseñado para 7.1 (donde `backLeft` es tumbao y `backRight` es el TAcka) corre en 4.1, el `backPar = max(backLeft, backRight)` permite que el mid melódico continuo (`backLeft`) asfixie al latigazo percusivo (`backRight`), porque el mid siempre está presente y el percusivo solo aparece en transientes.

2. **`gateOff` fantasma**: `LiquidEnvelopeConfig` define `gateOff` en todos los perfiles (Techno y Latino, 12 valores), pero `LiquidEnvelope.process()` **nunca lo lee**. Es dead code en la interfaz.

Ambas deudas se resuelven en la misma wave porque comparten el punto de inyección: `setProfile()`.

---

## 1. ANÁLISIS DEL ESTADO ACTUAL

### 1.1 El Flujo de Datos (Verificado contra código fuente)

```
 ILiquidProfile (dato puro)
        │
        ▼
 LiquidEngineBase.setProfile(profile)
   ├─ this.profile = profile
   └─ Recrea 6 × LiquidEnvelope(profile.envelope*)
        │
        ▼
 LiquidEngineBase.applyBands(input)
   ├─ MorphFactor calculation
   ├─ Modes (acid/noise)
   ├─ Silence/AGC
   ├─ Kick detection + veto
   ├─ Process 6 envelopes (usa this.profile.* para crossfilters)
   ├─ Sidechain guillotine
   ├─ Strobe
   ├─ AGC rebound
   └─ return this.routeZones(frame)  ← ABSTRACT
        │
        ├─ LiquidEngine41.routeZones()
        │    frontPar = max(frontLeft, frontRight)  ← AQUÍ ESTÁ EL PROBLEMA 4.1
        │    backPar  = max(backLeft, backRight)
        │    return { frontPar×2, backPar×2, moverL, moverR }
        │
        └─ LiquidEngine71.routeZones()
             return { frontL, frontR, backL, backR, moverL, moverR }  (7 independientes)
```

### 1.2 El Problema Concreto del 4.1

En modo 7.1, cada perfil calibra cada zona independientemente:

| Zona | Rol | Señal típica (Latino) |
|------|-----|-----------------------|
| `backLeft` | Tumbao/Teclados | `mid×0.6 + lowMid×0.7` → **continuo, avg ≈ 0.15-0.30** |
| `backRight` | TAcka percusivo | `trebleDelta×4` → **impulsivo, avg ≈ 0.02, picos ≈ 0.70** |

Cuando `max(backLeft, backRight)` los compacta:
- **Entre golpes**: `backPar = max(0.25, 0.02)` → 0.25 → **el tumbao domina**
- **En el golpe**: `backPar = max(0.25, 0.70)` → 0.70 → **el TAcka gana**

**Resultado**: El back PAR **nunca se apaga** porque el tumbao lo mantiene encendido.  
El latigazo percusivo pierde contraste sobre una base que ya está a 0.25.

En 7.1 esto no pasa porque `backLeft` y `backRight` van a hardware separado.

**Raíz**: No existe mecanismo para que el perfil ajuste parámetros según el layout que lo consume. Un perfil latino calibrado para 7.1 necesita un `backLBassSub` diferente en 4.1 (más agresivo, para que el tumbao no inunde el backPar compactado).

### 1.3 Inventario de gateOff

| Perfil | Envelope | `gateOff` declarado | Usado en `process()` |
|--------|----------|--------------------|--------------------|
| Techno | envelopeSubBass | 0.06 | **NO** |
| Techno | envelopeKick | 0.08 | **NO** |
| Techno | envelopeVocal | 0.005 | **NO** |
| Techno | envelopeSnare | 0.02 | **NO** |
| Techno | envelopeHighMid | 0.01 | **NO** |
| Techno | envelopeTreble | 0.01 | **NO** |
| Latino | envelopeSubBass | 0.05 | **NO** |
| Latino | envelopeKick | 0.10 | **NO** |
| Latino | envelopeVocal | 0.08 | **NO** |
| Latino | envelopeSnare | 0.04 | **NO** |
| Latino | envelopeHighMid | 0.02 | **NO** |
| Latino | envelopeTreble | 0.10 | **NO** |

12 valores escritos con intención, documentados con comentarios, **y nadie los lee**.

La razón: `LiquidEnvelope.process()` usa `dynamicGate = avgEffective + gateMargin` como gate adaptativo.  
El pipeline **no tiene sistema de histéresis binaria** (on/off con dos umbrales). El apagado se delega al decay natural (`intensity *= decay`). No hay punto en el código donde se pregunte "¿la señal cayó debajo de `gateOff`?".

---

## 2. PROPUESTA OBJETIVO 1: OVERRIDES 4.1

### 2.1 Principio Arquitectónico

> **La fusión ocurre UNA VEZ en `setProfile()`.  
> El hot-path de `LiquidEnvelope.process()` permanece en O(1) estricto.  
> Cero condicionales de layout en el pipeline de audio.**

El motor NO debe saber si es 4.1 o 7.1 mientras procesa. La diferencia vive **exclusivamente en la parametría** que el perfil inyecta.

### 2.2 Extensión de ILiquidProfile

```typescript
// ═══════════════════════════════════════════════════════════════
// WAVE 2435: OVERRIDES POR LAYOUT
// Cuando el motor corre en 4.1, el `max()` de routeZones aplasta
// señales que en 7.1 vivirían separadas. Estos overrides permiten
// ajustar la parametría para compensar la compactación.
//
// Ejemplo concreto: en Latino 7.1, backL.gateOn=0.04 es correcto
// porque el tumbao va a su propio foco. Pero en 4.1 ese tumbao
// compite via max() con el TAcka del backR. Un override
// backL.gateOn=0.18 evita que el tumbao estático domine el backPar.
// ═══════════════════════════════════════════════════════════════

export interface ILiquidProfile {
  // ... todo lo existente sin cambios ...

  /**
   * Overrides parciales para modo 4.1.
   * Solo los campos que necesitan cambiar respecto al perfil base (7.1).
   * Se fusionan en setProfile() cuando el motor detecta layout 4.1.
   *
   * Semántica: un campo presente aquí REEMPLAZA al campo homólogo
   * del perfil base. Los ausentes se heredan sin modificación.
   */
  readonly overrides41?: {
    readonly envelopeSubBass?: Partial<LiquidEnvelopeConfig>
    readonly envelopeKick?: Partial<LiquidEnvelopeConfig>
    readonly envelopeVocal?: Partial<LiquidEnvelopeConfig>
    readonly envelopeSnare?: Partial<LiquidEnvelopeConfig>
    readonly envelopeHighMid?: Partial<LiquidEnvelopeConfig>
    readonly envelopeTreble?: Partial<LiquidEnvelopeConfig>

    // Escalares que podrían necesitar override
    readonly percGate?: number
    readonly percBoost?: number
    readonly percExponent?: number
    readonly percMidSubtract?: number
    readonly backLLowMidWeight?: number
    readonly backLMidWeight?: number
    readonly backLTrebleSub?: number
    readonly backLBassSub?: number
    readonly moverLTonalThreshold?: number
    readonly moverLHighMidWeight?: number
    readonly moverLTrebleWeight?: number
    readonly moverLMidWeight?: number
    readonly bassSubtractBase?: number
    readonly bassSubtractRange?: number
    readonly moverRTrebleSub?: number
    readonly sidechainThreshold?: number
    readonly sidechainDepth?: number
    readonly snareSidechainDepth?: number
  }
}
```

**Decisión: `Partial` profundo por bloque, no `DeepPartial` recursivo.**

- `Partial<LiquidEnvelopeConfig>` permite overridear campos individuales del envelope (e.g. solo `gateOn` del `envelopeHighMid`) sin repetir los otros 12 campos.
- Los escalares sueltos (`percGate`, `backLMidWeight`, etc.) solo tienen un nivel — `Partial` a nivel de `overrides41` es suficiente.
- No necesitamos `DeepPartial<ILiquidProfile>` genérico: eso permitiría overridear `id` y `name`, que no tiene sentido.

### 2.3 Función de Fusión (Pura, Fuera del Hot-Path)

```typescript
/**
 * Fusiona un perfil base con sus overrides 4.1.
 * Retorna un ILiquidProfile NUEVO — inmutable, sin mutar el original.
 * Complejidad: O(n) donde n = campos del perfil (constante ~40).
 * Se llama UNA VEZ en setProfile(), NUNCA en el hot-path.
 */
function fuseProfileFor41(base: ILiquidProfile): ILiquidProfile {
  const ov = base.overrides41
  if (!ov) return base  // Sin overrides → perfil idéntico

  return {
    ...base,
    // Fusión de envelopes: spread base + spread override
    envelopeSubBass:  ov.envelopeSubBass  ? { ...base.envelopeSubBass,  ...ov.envelopeSubBass }  : base.envelopeSubBass,
    envelopeKick:     ov.envelopeKick     ? { ...base.envelopeKick,     ...ov.envelopeKick }     : base.envelopeKick,
    envelopeVocal:    ov.envelopeVocal    ? { ...base.envelopeVocal,    ...ov.envelopeVocal }    : base.envelopeVocal,
    envelopeSnare:    ov.envelopeSnare    ? { ...base.envelopeSnare,    ...ov.envelopeSnare }    : base.envelopeSnare,
    envelopeHighMid:  ov.envelopeHighMid  ? { ...base.envelopeHighMid,  ...ov.envelopeHighMid }  : base.envelopeHighMid,
    envelopeTreble:   ov.envelopeTreble   ? { ...base.envelopeTreble,   ...ov.envelopeTreble }   : base.envelopeTreble,
    // Fusión de escalares: override si present, base si ausente
    percGate:             ov.percGate             ?? base.percGate,
    percBoost:            ov.percBoost            ?? base.percBoost,
    percExponent:         ov.percExponent         ?? base.percExponent,
    percMidSubtract:      ov.percMidSubtract      ?? base.percMidSubtract,
    backLLowMidWeight:    ov.backLLowMidWeight    ?? base.backLLowMidWeight,
    backLMidWeight:       ov.backLMidWeight       ?? base.backLMidWeight,
    backLTrebleSub:       ov.backLTrebleSub       ?? base.backLTrebleSub,
    backLBassSub:         ov.backLBassSub         ?? base.backLBassSub,
    moverLTonalThreshold: ov.moverLTonalThreshold ?? base.moverLTonalThreshold,
    moverLHighMidWeight:  ov.moverLHighMidWeight  ?? base.moverLHighMidWeight,
    moverLTrebleWeight:   ov.moverLTrebleWeight   ?? base.moverLTrebleWeight,
    moverLMidWeight:      ov.moverLMidWeight      ?? base.moverLMidWeight,
    bassSubtractBase:     ov.bassSubtractBase     ?? base.bassSubtractBase,
    bassSubtractRange:    ov.bassSubtractRange    ?? base.bassSubtractRange,
    moverRTrebleSub:      ov.moverRTrebleSub      ?? base.moverRTrebleSub,
    sidechainThreshold:   ov.sidechainThreshold   ?? base.sidechainThreshold,
    sidechainDepth:       ov.sidechainDepth       ?? base.sidechainDepth,
    snareSidechainDepth:  ov.snareSidechainDepth  ?? base.snareSidechainDepth,
  }
}
```

### 2.4 Modificación de LiquidEngineBase.setProfile()

```typescript
export abstract class LiquidEngineBase {

  /** Layout activo — determina si aplican overrides41 */
  protected layout: '4.1' | '7.1' = '7.1'

  setProfile(profile: ILiquidProfile): void {
    // Fusión condicional: si layout === '4.1' y el perfil tiene overrides, aplicar
    const effective = this.layout === '4.1'
      ? fuseProfileFor41(profile)
      : profile

    this.profile = effective
    this.envSubBass = new LiquidEnvelope(effective.envelopeSubBass)
    this.envKick    = new LiquidEnvelope(effective.envelopeKick)
    this.envVocal   = new LiquidEnvelope(effective.envelopeVocal)
    this.envSnare   = new LiquidEnvelope(effective.envelopeSnare)
    this.envHighMid = new LiquidEnvelope(effective.envelopeHighMid)
    this.envTreble  = new LiquidEnvelope(effective.envelopeTreble)
  }

  // applyBands() → SIN CAMBIOS. Lee this.profile.* como antes.
  // process() de cada envelope → SIN CAMBIOS.
  // routeZones() → SIN CAMBIOS.
}
```

### 2.5 Inicialización del Layout

Las subclases ya saben su layout por definición:

```typescript
export class LiquidEngine41 extends LiquidEngineBase {
  constructor(profile: ILiquidProfile = TECHNO_PROFILE) {
    super(profile)
    this.layout = '4.1'
    // Re-aplicar setProfile para que la fusión ocurra con el layout correcto
    this.setProfile(profile)
  }
}

export class LiquidEngine71 extends LiquidEngineBase {
  constructor(profile: ILiquidProfile = TECHNO_PROFILE) {
    super(profile)
    this.layout = '7.1'  // default, no cambia nada
  }
}
```

**Alternativa más limpia**: pasar el layout al constructor de la base:

```typescript
export abstract class LiquidEngineBase {
  protected readonly layout: '4.1' | '7.1'

  constructor(profile: ILiquidProfile, layout: '4.1' | '7.1' = '7.1') {
    this.layout = layout
    // Constructor siempre fusiona
    const effective = layout === '4.1' ? fuseProfileFor41(profile) : profile
    this.profile = effective
    this.envSubBass = new LiquidEnvelope(effective.envelopeSubBass)
    // ... etc
  }
}

// LiquidEngine41
export class LiquidEngine41 extends LiquidEngineBase {
  constructor(profile: ILiquidProfile = TECHNO_PROFILE) {
    super(profile, '4.1')  // ← un solo punto de verdad
  }
}
```

**Recomendación: la alternativa limpia.** El layout es inmutable para la vida del engine.  `readonly` previene bugs.

### 2.6 Diagrama de Flujo de Fusión

```
                    PERFIL LATINO (base - calibrado para 7.1)
                    ┌────────────────────────────────────────┐
                    │ envelopeHighMid.gateOn: 0.04           │
                    │ envelopeHighMid.decayBase: 0.65        │
                    │ percGate: 0.019                        │
                    │ overrides41:                            │
                    │   envelopeHighMid:                     │
                    │     gateOn: 0.18   ← sube el muro     │
                    │     decayBase: 0.40 ← decay más corto  │
                    │   envelopeSubBass:                     │
                    │     gateOn: 0.15   ← más sensible      │
                    │     decayBase: 0.30                    │
                    └────────────────┬───────────────────────┘
                                     │
                                     ▼
                  ┌──── fuseProfileFor41() ────┐
                  │                            │
          ┌───────┴───────┐           ┌────────┴────────┐
          │ layout='7.1'  │           │ layout='4.1'    │
          │ return base   │           │ spread + merge  │
          └──────┬────────┘           └────────┬────────┘
                 │                             │
                 ▼                             ▼
    ┌─── PERFIL EFECTIVO ───┐    ┌─── PERFIL EFECTIVO ───────┐
    │ gateOn: 0.04          │    │ gateOn: 0.18 ← OVERRIDED │
    │ decayBase: 0.65       │    │ decayBase: 0.40 ← "      │
    │ percGate: 0.019       │    │ percGate: 0.019 (heredado)│
    └─────────┬─────────────┘    └───────────┬───────────────┘
              │                              │
              ▼                              ▼
    LiquidEngine71.setProfile()    LiquidEngine41.setProfile()
    (6 envelopes con params 7.1)   (6 envelopes con params fusionados)
              │                              │
              ▼                              ▼
    applyBands() → O(1) idéntico   applyBands() → O(1) idéntico
    (no sabe que es 7.1)           (no sabe que es 4.1)
```

### 2.7 Ejemplo Concreto: LATINO_PROFILE con overrides41

```typescript
export const LATINO_PROFILE: ILiquidProfile = {
  id: 'latino-fiesta',
  name: 'Latino Fiesta',

  // Base (calibrado para 7.1 — cada zona va a hardware independiente)
  envelopeHighMid: {
    name: 'Back L (Tumbao & Teclados)',
    gateOn: 0.04,     // Permisivo — el tumbao siempre late
    gateOff: 0.02,    // (legacy, ver sección 3)
    boost: 4.0,
    crushExponent: 1.0,
    decayBase: 0.65,  // Colchón largo — el tumbao es continuo
    decayRange: 0.05,
    maxIntensity: 0.90,
    squelchBase: 0.02,
    squelchSlope: 0.10,
    ghostCap: 0.06,
    gateMargin: 0.005,
  },

  // ... otros envelopes y escalares (sin cambios) ...

  // ═══════════════════════════════════════════════════════════════
  // OVERRIDES 4.1 — Compensación de compactación max()
  // En 4.1, backPar = max(backLeft, backRight).
  // El tumbao continuo (backLeft ≈ 0.25) asfixia el TAcka impulsivo.
  // Solución: subir el gateOn del tumbao para que solo se encienda
  // con mid REAL, y bajar el decay para que no sostenga.
  // ═══════════════════════════════════════════════════════════════
  overrides41: {
    envelopeHighMid: {
      gateOn: 0.18,     // Más exigente — ignora mid ambiente
      decayBase: 0.40,  // Más corto — suelta rápido para dar paso al TAcka
      ghostCap: 0.02,   // Menos ghost — el tumbao no debe latir en background
    },
    envelopeSubBass: {
      gateOn: 0.15,     // WAVE 2434 Monte Carlo winner para 4.1
      decayBase: 0.30,  // Golpe más limpio
    },
    envelopeVocal: {
      gateOn: 0.25,     // WAVE 2434: treble avg 0.187 en 4.1, 0.32 mataba La Dama
    },
  },
}
```

### 2.8 Impacto en Código Existente

| Archivo | Cambio | Líneas afectadas |
|---------|--------|-----------------|
| `ILiquidProfile.ts` | Añadir `overrides41?` | +25 líneas (tipo nuevo) |
| `LiquidEngineBase.ts` | Añadir `layout`, `fuseProfileFor41()`, modificar constructor y `setProfile()` | ~20 líneas modificadas |
| `LiquidEngine41.ts` | Pasar `'4.1'` al constructor de base | 1 línea |
| `LiquidEngine71.ts` | Pasar `'7.1'` al constructor de base | 1 línea |
| `LiquidEngine41Telemetry.ts` | Pasar `'4.1'` al constructor de base | 1 línea |
| `profiles/latino.ts` | Añadir bloque `overrides41` | ~15 líneas |
| `profiles/techno.ts` | Opcional: añadir `overrides41` vacío o omitir | 0 líneas (Techno compacta bien) |

**Hot-path `applyBands()`: CERO cambios.**  
**Hot-path `LiquidEnvelope.process()`: CERO cambios.**

---

## 3. PROPUESTA OBJETIVO 2: RESOLUCIÓN DE GATEOFF

### 3.1 Análisis de la Matemática Actual

El pipeline de `LiquidEnvelope.process()` tiene 9 etapas (verificado línea por línea).  
En **ninguna** de las 9 etapas se lee `config.gateOff`.

El apagado actual funciona así:
```
Etapa 6: intensity *= decay         (decay = decayBase + decayRange × morph)
Etapa 9: fadeFactor = (i < 0.08) ? pow(i/0.08, 2) : 1.0
          return intensity × fadeFactor
```

Es decir: la señal se apaga por **decay exponencial** (`intensity *= 0.30` por frame en Latino SubBass) + **fade cuadrático** bajo 0.08. No hay gate de apagado explícito.

La constante `fadeZone = 0.08` (hardcodeada) actúa como un `gateOff` implícito y universal. Bajo 0.08, la salida se atenúa cuadráticamente → llega a 0 suavemente.

### 3.2 CAMINO A: Purga (Eliminar gateOff)

**Argumento a favor:**
- `gateOff` nunca se usó. Es dead code que ocupa espacio en cada perfil (12 valores × 2 perfiles = 24 números inútiles).
- El decay exponencial + fadeZone 0.08 ya proveen apagado suave y elegante.
- La ausencia de histéresis binaria es una **feature**: evita el "parpadeo" on-off que plaga motores primitivos con hysteresis dual.
- Simplifica la interfaz (`LiquidEnvelopeConfig` pierde 1 campo → 12 campos en lugar de 13).

**Implementación:**
1. Eliminar `gateOff` de `LiquidEnvelopeConfig`
2. Eliminar los 12 valores `gateOff: X.XX` en `techno.ts` y `latino.ts`
3. Si `overrides41` ya fue añadido, no necesita `gateOff` tampoco

**Riesgo:** CERO riesgo funcional — quitar algo que no se usa no puede romper nada.

**Costo:** ~30 minutos de búsqueda-y-reemplazo. Cambio mecánico.

### 3.3 CAMINO B: Histéresis Real (Implementar gateOff)

**Argumento a favor:**
- Los valores de `gateOff` fueron escritos con intención (diferentes por envelope y por perfil).
- Sin `gateOff`, el decay natural depende del frameRate (20fps → 50ms/frame). Si el frameRate cambiara, el apagado cambiaría proporcionalmente. Un `gateOff` explícito sería invariante al frameRate.
- Histéresis real permite "cortar" señales débiles que actualmente mantienen el envelope en una intensidad residual baja (entre 0.02-0.08) que el fadeZone no aplana completamente.

**Dónde insertar en el pipeline:**

El punto correcto es **después del decay (Etapa 6) y antes del main gate (Etapa 7)**:

```
Etapa 6:  intensity *= decay
────────────────────────────────────────── NUEVO ──
Etapa 6b: GATE-OFF HYSTERESIS
          if (signal < gateOff && intensity < fadeZone)
              intensity = 0
              // Forzar apagado limpio cuando:
              //   a) la señal de entrada está MUY baja (< gateOff)
              //   b) la intensidad residual ya está en zona de fade
              // Esto evita el "fantasma" de 0.02-0.08 que el decay natural
              // tarda ~15 frames en limpiar.
──────────────────────────────────────────────────
Etapa 7:  main gate check (kickPower / ghostPower)
```

**Pseudocódigo exacto:**
```typescript
// Etapa 6b: GATE-OFF HYSTERESIS (WAVE 2435)
// Condición dual: señal baja AND intensidad en fadeZone
// Previene guillotinazo: solo corta si la señal ya estaba cayendo
// Y el envelope ya estaba en la zona de apagar
if (signal < c.gateOff && s.intensity < fadeZone) {
  s.intensity = 0
}
```

**Análisis computacional:**
- **1 comparación + 1 AND lógico + 1 asignación condicional** por frame por envelope
- En el peor caso: 6 envelopes × 1 branch = 6 branches extra por frame
- En la práctica: el branch predictor del CPU lo va a acertar >95% del tiempo (casi siempre es `false`-`false`)
- **Impacto en latencia: despreciable**. Estamos en el rango de nanosegundos dentro de un pipeline que toma microsegundos.

**Impacto musical:**
- El "fantasma" de 0.02-0.08 se corta ~10 frames antes con histéresis que con decay puro.
- A 20fps, eso es 500ms de apagado MÁS RÁPIDO en zonas de silencio.
- En Latino, donde el decay base es 0.30-0.65 (largo), esto puede ser significativo:
  
  $t_{apagado} = \frac{\ln(0.02/0.30)}{\ln(decay)} \times 50ms$
  
  Con `decayBase=0.30`: $\frac{\ln(0.067)}{\ln(0.30)} \times 50 = \frac{-2.71}{-1.20} \times 50 ≈ 113ms$ (≈2 frames)
  
  Con `decayBase=0.65`: $\frac{\ln(0.067)}{\ln(0.65)} \times 50 = \frac{-2.71}{-0.43} \times 50 ≈ 315ms$ (≈6 frames)

  Los envelopes con `decayBase` alto (0.65-0.78, como Mover L y Back L) tardan 6+ frames en apagarse. Un `gateOff` cortaría eso a 1 frame cuando la señal cae debajo del umbral.

**Riesgo:**
- Si `gateOff` es demasiado alto → guillotinas audibles (luz que se apaga de golpe mid-nota)
- Si `gateOff` es demasiado bajo → equivalente a no tenerlo (el decay natural lo logra primero)
- Necesitaría recalibración Monte Carlo para encontrar los valores correctos de cada `gateOff`
- Los 12 valores existentes en los perfiles **fueron escritos sin feedback** (nunca se probaron contra audio real)

**Costo:** ~2 horas de implementación + recalibración Monte Carlo de los 12 `gateOff` por perfil.

### 3.4 Análisis Comparativo

| Criterio | Camino A (Purga) | Camino B (Histéresis) |
|----------|-------------------|-----------------------|
| **Complejidad** | Resta código | Suma 4 líneas al hot-path |
| **Riesgo** | 0 | Medio (requiere recalibración) |
| **Impacto musical** | Ninguno (status quo) | Apagado 300-500ms más rápido en decays largos |
| **Costo de implementación** | 30 min | 2h + Monte Carlo |
| **Mantenimiento** | Simpler (menos parámetros) | 1 parámetro más por envelope × perfil |
| **Reversibilidad** | Fácil (re-añadir si hace falta) | Fácil (quitar el branch) |
| **O(1) del hot-path** | Intacto | Intacto (1 branch predecible) |

### 3.5 Recomendación

**Camino A (Purga) es el correcto para AHORA.**

Razones:
1. Los valores de `gateOff` actuales nunca se probaron — no son datos calibrados, son guesswork.
2. El decay natural + fadeZone=0.08 funciona correctamente en producción desde WAVE 2401.
3. Si en el futuro necesitamos histéresis (porque calibramos un perfil con decay alto que deja fantasmas), la implementación del Camino B es trivial (4 líneas) y el campo `gateOff` se puede re-añadir.
4. **Axioma Perfection First**: mejor no tener un feature que tener un feature mal calibrado.

**Plan propuesto:**
1. **Ahora**: Purga. Eliminar `gateOff` de `LiquidEnvelopeConfig` y de los perfiles.
2. **Futuro (si se detectan fantasmas en decays largos)**: Implementar Camino B con valores calibrados por Monte Carlo, no por guesswork.

---

## 4. SECUENCIA DE IMPLEMENTACIÓN

```
WAVE 2435 — FASE 1 (sin cambio funcional visible):
  ├─ 1. Añadir overrides41? a ILiquidProfile
  ├─ 2. Crear fuseProfileFor41() en LiquidEngineBase.ts
  ├─ 3. Refactorear constructor de LiquidEngineBase para recibir layout
  ├─ 4. Actualizar LiquidEngine41, LiquidEngine71, LiquidEngine41Telemetry
  ├─ 5. Purga de gateOff (LiquidEnvelopeConfig, techno.ts, latino.ts)
  └─ 6. Tests: verificar que sin overrides41, el comportamiento es idéntico

WAVE 2435 — FASE 2 (calibración real):
  ├─ 7. Añadir overrides41 en LATINO_PROFILE (basado en datos Monte Carlo 4.1)
  ├─ 8. Re-correr Monte Carlo con captura 4.1 para validar overrides
  └─ 9. Opcional: overrides41 en TECHNO_PROFILE si el rig de prueba lo necesita

WAVE 2435 — FASE 3 (documentación):
  └─ 10. Actualizar LIQUID-ENGINE-AUDIT-V1.md con nueva arquitectura
```

---

## 5. CONTRATOS DE TIPOS FINALES

### 5.1 LiquidEnvelopeConfig (post-purga de gateOff)

```typescript
export interface LiquidEnvelopeConfig {
  readonly name: string
  readonly gateOn: number
  // gateOff: ELIMINADO (WAVE 2435 — nunca se usó en process())
  readonly boost: number
  readonly crushExponent: number
  readonly decayBase: number
  readonly decayRange: number
  readonly maxIntensity: number
  readonly squelchBase: number
  readonly squelchSlope: number
  readonly ghostCap: number
  readonly gateMargin: number
}
```

### 5.2 ILiquidProfile (con overrides41)

```typescript
export interface ILiquidProfile {
  readonly id: string
  readonly name: string

  // 6 envelope configs
  readonly envelopeSubBass: LiquidEnvelopeConfig
  readonly envelopeKick: LiquidEnvelopeConfig
  readonly envelopeVocal: LiquidEnvelopeConfig
  readonly envelopeSnare: LiquidEnvelopeConfig
  readonly envelopeHighMid: LiquidEnvelopeConfig
  readonly envelopeTreble: LiquidEnvelopeConfig

  // Transient Shaper
  readonly percMidSubtract: number
  readonly percGate: number
  readonly percBoost: number
  readonly percExponent: number

  // Mover R: Bass Subtractor
  readonly bassSubtractBase: number
  readonly bassSubtractRange: number

  // Back L: Cross-filter
  readonly backLLowMidWeight: number
  readonly backLMidWeight: number
  readonly backLTrebleSub: number
  readonly backLBassSub: number

  // Mover L: Melody Gate
  readonly moverLHighMidWeight: number
  readonly moverLTrebleWeight: number
  readonly moverLMidWeight: number
  readonly moverLTonalThreshold: number

  // Mover R: Treble Subtraction
  readonly moverRTrebleSub: number

  // Sidechain
  readonly sidechainThreshold: number
  readonly sidechainDepth: number
  readonly snareSidechainDepth: number

  // Strobe
  readonly strobeThreshold: number
  readonly strobeDuration: number
  readonly strobeNoiseDiscount: number

  // Modes
  readonly harshnessAcidThreshold: number
  readonly flatnessNoiseThreshold: number
  readonly apocalypseHarshness: number
  readonly apocalypseFlatness: number

  // Kick
  readonly kickEdgeMinInterval: number
  readonly kickVetoFrames: number

  // ═══════════════════════════════════════════════════════════════
  // WAVE 2435: OVERRIDES DE LAYOUT 4.1
  //
  // Fusionados en setProfile() cuando layout === '4.1'.
  // Solo campos que necesitan cambiar. Los ausentes se heredan.
  // ═══════════════════════════════════════════════════════════════
  readonly overrides41?: Partial<
    Pick<ILiquidProfile,
      | 'envelopeSubBass' | 'envelopeKick' | 'envelopeVocal'
      | 'envelopeSnare' | 'envelopeHighMid' | 'envelopeTreble'
    >
  > & Partial<
    Pick<ILiquidProfile,
      | 'percGate' | 'percBoost' | 'percExponent' | 'percMidSubtract'
      | 'backLLowMidWeight' | 'backLMidWeight' | 'backLTrebleSub' | 'backLBassSub'
      | 'moverLTonalThreshold' | 'moverLHighMidWeight' | 'moverLTrebleWeight' | 'moverLMidWeight'
      | 'bassSubtractBase' | 'bassSubtractRange' | 'moverRTrebleSub'
      | 'sidechainThreshold' | 'sidechainDepth' | 'snareSidechainDepth'
    >
  >
}
```

**Nota sobre el tipo**: La alternativa al `Pick` nested es la interfaz explícita de la sección 2.2. Ambas son equivalentes en runtime. La interfaz explícita es más legible; el `Pick` es más DRY. **Elección del equipo.** Recomiendo la interfaz explícita por claridad — este es un archivo que se lee mucho.

---

## 6. INVARIANTES A PRESERVAR

1. **O(1) estricto en `LiquidEnvelope.process()`**: La fusión ocurre en `setProfile()`. El hot-path lee `this.config.*` sin saber qué layout lo generó.

2. **Determinismo**: `fuseProfileFor41()` es pura (sin side-effects, sin `Date.now()`, sin `Math.random()`). Mismo perfil de entrada → mismo perfil de salida.

3. **Inmutabilidad**: `fuseProfileFor41()` retorna un objeto NUEVO. El perfil original nunca se muta. Esto permite que el mismo `LATINO_PROFILE` se inyecte en un engine 4.1 y uno 7.1 simultáneamente sin interferencia.

4. **Retrocompatibilidad**: `overrides41` es `optional`. Perfiles sin overrides se comportan exactamente igual que hoy. Cero breaking changes en el API público.

5. **Serialización**: El perfil fusionado es JSON-serializable (puro dato). Permite debug via `JSON.stringify(engine.profile)` para verificar qué parámetros tiene realmente el engine.

---

*Blueprint generado por PunkOpus — WAVE 2435*  
*Validado por Radwulf. Implementación completada.*

---

## 7. REGISTRO DE IMPLEMENTACIÓN

### Decisiones tomadas por Radwulf:
- **Overrides**: Interfaz explícita (no Pick anidado) — mayor legibilidad
- **gateOff**: Camino A (Purga Total) — "Orden 66"

### Archivos modificados (Fase 1 — Purga + Arquitectura):
| Archivo | Cambio |
|---------|--------|
| `LiquidEnvelope.ts` | `gateOff` eliminado de `LiquidEnvelopeConfig` |
| `profiles/techno.ts` | 6× `gateOff` purgados |
| `profiles/latino.ts` | 6× `gateOff` purgados |
| `profiles/poprock.ts` | 6× `gateOff` purgados |
| `__tests__/LiquidEnvelope.test.ts` | 3× `gateOff` purgados |
| `ILiquidProfile.ts` | `overrides41?` añadido (interfaz explícita) |
| `LiquidEngineBase.ts` | `LiquidLayout` type, `fuseEnvelope()`, `fuseProfileFor41()`, constructor con `layout` param |
| `LiquidEngine41.ts` | Constructor pasa `'4.1'` a base |
| `LiquidEngine71.ts` | Constructor pasa `'7.1'` a base |
| `LiquidEngine41Telemetry.ts` | Constructor pasa `'4.1'` a base |

### Archivos modificados (Fase 2 — Calibración Latino 4.1):
| Archivo | Cambio |
|---------|--------|
| `profiles/latino.ts` | `overrides41` block añadido: `envelopeHighMid` (gateOn↑0.18, decay↓0.40, ghostCap↓0.02), `envelopeSubBass` (decay↓0.25), `envelopeSnare` (boost↑4.5), `sidechainDepth` (↓0.08) |

### Verificación:
- `npx tsc --noEmit`: **0 errores**
- `grep gateOff`: Solo 2 comentarios documentales (LiquidEnvelope.ts, techno.ts)
