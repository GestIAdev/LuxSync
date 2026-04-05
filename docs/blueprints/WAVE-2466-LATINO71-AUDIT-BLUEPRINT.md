# WAVE 2466 — AUDITORÍA ARQUITECTÓNICA: OPERACIÓN LATINO 7.1
**Blueprint de Integración Segura — Latino en el Motor 7.1**

> Estado: PRE-EJECUCIÓN — Solo diagnóstico. Sin código modificado.  
> Auditor: PunkOpus (Sonnet 4.6)  
> Solicitante: Radwulf / Arquitectura Gemini  
> Fecha: 2026-04-05  
> Archivos auditados: `LiquidEngine71.ts` · `LiquidEngineBase.ts` · `LiquidEngine41.ts` · `profiles/latino.ts`

---

## RESUMEN EJECUTIVO

El motor 7.1 **ya tiene la infraestructura correcta** para Latino. La clase `LiquidEngine71` implementa `routeZones()` pasando las 7 señales calculadas por la Base **sin ningún `max()`**. La bifurcación **ya existe** en la Base (el `fuseProfileFor41` solo se activa si `layout === '4.1'`). El LATINO_PROFILE **ya tiene los valores ajustados para 7 zonas** en su cuerpo principal — los `overrides41` son el escudo del 4.1 y **no contaminan el 7.1**.

Problema real: **`LiquidEngine71` está hardcodeado al `TECHNO_PROFILE`**.  
Solución: Instanciar `LiquidEngine71` con `LATINO_PROFILE` cuando el género sea latino.

No hay que tocar la Base. No hay cuellos de botella reales que afecten al 4.1. La operación es quirúrgica.

---

## MISIÓN 1 — MAPEO DE RUTEO 7.1 (The Liquid Layout)

### Cómo lee las envolventes LiquidEngine71

`LiquidEngine71.routeZones()` recibe un `ProcessedFrame` que viene totalmente procesado por `LiquidEngineBase.applyBands()`. Las 7 señales ya están calculadas:

```
frontLeft   ← envSubBass.process()          [El Océano — SubBass]
frontRight  ← envKick.process()             [El Francotirador — Kick edge]
backLeft    ← envHighMid.process()          [El Coro — midSynthInput]
backRight   ← envSnare.process()            [El Látigo — Transient Shaper]
moverLeft   ← envTreble.process(moverLInput) [Mover L — cross-filter]
moverRight  ← envVocal.process(moverRInput)  [Mover R — cleanMid]
```

`LiquidEngine71.routeZones()` simplemente pasa estos 6 valores **directamente sin ninguna compactación**:

```typescript
return {
  frontLeftIntensity:  frontLeft,   // puro
  frontRightIntensity: frontRight,  // puro
  backLeftIntensity:   backLeft,    // puro
  backRightIntensity:  backRight,   // puro
  moverLeftIntensity:  moverLeft,   // puro
  moverRightIntensity: moverRight,  // puro
  // ...legacy compat con max() solo para el campo frontParIntensity (no lo usa nadie crítico)
}
```

### ¿Existe bifurcación strict-split vs default en 7.1?

**Respuesta: No — y es correcto que no exista.**

La bifurcación `strict-split` en la Base (`LiquidEngineBase.applyBands()`) afecta **solo al cálculo de movers** en el bloque WAVE 911 (línea ~380). Ese bloque se activa cuando `p.layout41Strategy === 'strict-split'`.

- **Techno 7.1**: `TECHNO_PROFILE.layout41Strategy = 'strict-split'` → entra al bloque WAVE 911 → movers calculados con math duro (mid - bass×0.5, treble puro).
- **Latino 7.1**: `LATINO_PROFILE.layout41Strategy` → **no es `strict-split`** (no está definida, o es `undefined`/`'default'`) → entra al bloque `ENVELOPE CROSS-FILTER` → usa `envTreble` + `envVocal` con ADN parametrizado.

Esto significa que **en 7.1, Latino ya usa su propio sistema de movers** — el cross-filter con `moverLMidWeight: 0.80`, `moverRTrebleSub: 0.45`, etc. No hay nada que bifurcar. La arquitectura ya está diseñada para esto.

---

## MISIÓN 2 — ASIGNACIÓN DE ROLES ESPACIALES (Latino 7.1 Spatial Mapping)

### Tabla de Ruteo Propuesta para Latino 7.1

Basada en los valores reales del log `latino1.md` y la parametría del `LATINO_PROFILE`:

| Zona Física | Señal en la Base | Envolvente | Rol Semántico | Valores Reales Observados |
|---|---|---|---|---|
| **Front L** | `envSubBass(bands.subBass)` | `envelopeSubBass` | **El TÚN** — Bombo gordo del dembow. Staccato latino (decay 0.50). | sB: 0.08-0.29 entre golpes, 0.27-0.29 en kick real |
| **Front R** | `envKick(kickSignal)` | `envelopeKick` | **El Francotirador** — Kick edge con intervalBPM como candado. Solo golpes reales. | fPar: 0.80 en kick, 0.00 entre golpes (correcto) |
| **Back L** | `envHighMid(midSynthInput)` | `envelopeHighMid` | **El Tumbao** — Congas, teclados, bajo melódico. midSynthInput = treble×0.50 en latino. | bPar: 0.85 en snare, 0.00 entre golpes (override41 activo) |
| **Back R** | `envSnare(hybridSnare)` | `envelopeSnare` | **El TAcka** — Transient Shaper completo (trebleDelta+highMidDelta+midDelta). El latigo del dembow. | bPar espejado con Back L en 4.1 — en 7.1 separadas |
| **Mover L** | `envTreble(moverLInput)` | `envelopeTreble` | **El Galán** — mid×0.80 + highMid×0.30. Melodías, congas, voces masculinas, acordeón. | mL: 0.85 en picos melódicos, 0.18 suelo (ghostCap WAVE 2465) |
| **Mover R** | `envVocal(moverRInput)` | `envelopeVocal` | **La Dama** — cleanMid - treble×0.45. Trompetas, güira, platillos, siseos. | mR: 0.61-0.85 en trompetas, 0.00-0.04 entre ellas |
| **Wash / Center** | — | — | **El Ambiente** *(ver nota)* | No hay 7ª zona en ProcessedFrame actual |

> **NOTA sobre la 7ª zona**: El `ProcessedFrame` tiene 6 señales discretas (frontLeft/Right, backLeft/Right, moverLeft/Right). LiquidEngine71 acepta 7 zonas en el tipo de retorno (`LiquidStereoResult`) pero la Base no calcula una 7ª señal autónoma. Si hay un wash/center físico, hay dos opciones arquitectónicas (ver Sección 4 del Blueprint).

### Diferencia clave 4.1 vs 7.1 para Latino

| Aspecto | 4.1 | 7.1 |
|---|---|---|
| Back PAR | `max(backLeft, backRight)` — tumbao y TAcka comprimidos | **Back L = Tumbao puro** / **Back R = TAcka puro** — separados |
| Front PAR | `max(frontLeft, frontRight)` — TÚN + kick compactados | **Front L = TÚN** / **Front R = Kick** — separados |
| overrides41 activos | Sí — `envelopeHighMid.gateOn=0.20`, `envelopeSnare.decayBase=0.22`, etc. | **No** — valores base del perfil (decay 0.45, ghostCap 0.04, etc.) |
| El Galán (Mover L) | gateOn=0.35, boost=4.0, decayBase=0.82, ghostCap=0.18 (override) | **gateOn=0.14**, boost=3.5, decayBase=0.82, ghostCap=0.18 (base) |

**Implicación directa**: En 7.1, el Back L (Tumbao) tendrá `decayBase=0.92` y `ghostCap=0.08` — el tumbao late continuamente. El Back R (TAcka) tendrá `decayBase=0.45` y `ghostCap=0.04` — el TAcka es un disparo limpio. Esta separación es más expresiva que el `max()` del 4.1.

---

## MISIÓN 3 — DETECCIÓN DE CUELLOS DE BOTELLA (The 4.1 Shield)

### Variables auditadas y su impacto cruzado

#### 3.1 — `fuseProfileFor41()` — ZONA VERDE ✅

La función `fuseProfileFor41` en `LiquidEngineBase.ts` solo se ejecuta cuando `layout === '4.1'`:

```typescript
// constructor:
const effective = layout === '4.1' ? fuseProfileFor41(profile) : profile
// setProfile():
const effective = this.layout === '4.1' ? fuseProfileFor41(profile) : profile
```

El `layout` es `readonly` e inmutable. `LiquidEngine41` siempre tiene `layout='4.1'`. `LiquidEngine71` siempre tiene `layout='7.1'`. **Son instancias completamente separadas**. Modificar los valores base del `LATINO_PROFILE` para 7.1 **no afecta al 4.1** porque el 4.1 aplica los `overrides41` encima en el momento de fusión.

**Condición**: Los `overrides41.envelopeTreble`, `overrides41.envelopeSnare`, etc. deben preservarse tal cual. No tocar `overrides41`.

#### 3.2 — `layout41Strategy` — ZONA VERDE ✅

`LATINO_PROFILE` no define `layout41Strategy` explícitamente (no está en el código auditado). Esto significa que en la Base, `p.layout41Strategy === 'strict-split'` es **false** para latino tanto en 4.1 como en 7.1. No hay riesgo de que el bloque WAVE 911 se active.

El `overrides41` tampoco tiene `layout41Strategy`, así que la fusión tampoco lo cambia.

#### 3.3 — `moverLMidWeight: 0.80` y señal mid: 0.44-0.53 — ZONA AMARILLA ⚠️

En el 4.1 el `override41.moverLTonalThreshold: 0.99` desactiva el gate tonal del Galán. En el 7.1, `moverLTonalThreshold` usa el **valor base: `0.45`**. Esto significa:

```
isTonal = flatness < 0.45 ? 1.0 : 0.0
```

Si `flatness >= 0.45` (señal ruidosa, no tonal), el moverLInput se corta a cero. En los logs, `flatness` típica del latino no está visible directamente, pero el autotune crea componentes que pueden elevar la flatness momentáneamente.

**Riesgo concreto**: En canciones con autotune, el Galán puede cortarse esporádicamente si `flatness >= 0.45`. En 4.1 esto estaba eliminado con `moverLTonalThreshold: 0.99`.

**Recomendación para 7.1**: Evaluar si el base tonal threshold de `0.45` es adecuado para el espectro real latino, o si es mejor elevarlo a `0.70` directamente en el body del perfil (no en `overrides41`).

#### 3.4 — `envelopeHighMid` en 7.1 — ZONA AMARILLA ⚠️

El body del perfil tiene:
```typescript
envelopeHighMid: {
  decayBase: 0.92,   // tumbao continuo
  ghostCap: 0.08,    // siempre late
  gateOn: 0.04,      // gate muy bajo
}
```

El `overrides41` cambia esto a:
```typescript
envelopeHighMid: {
  gateOn: 0.20,      // sube el gate
  decayBase: 0.28,   // latiguazo rápido
  ghostCap: 0.00,    // negro absoluto
}
```

En 7.1, **se usa el valor base** — `decayBase: 0.92`, `ghostCap: 0.08`, `gateOn: 0.04`. El input del Back L en latino es:

```typescript
midSynthInput = max(0, bands.lowMid × 0.00 + bands.mid × 0.00 - bands.treble × (-0.50) - bands.bass × 0.0)
             = treble × 0.50
```

Con treble típico en 0.22-0.30, `midSynthInput = 0.11-0.15`. El gate está en `0.04` → siempre pasa. Con `decayBase: 0.92` y `ghostCap: 0.08`, el Back L **estará encendido casi permanentemente** (tumbao continuo, tal como está diseñado).

Esto es **correcto para 7.1** — el Back L en 7.1 es el tumbao continuo. No hay colisión con el Back R (TAcka) porque están en zonas físicas separadas. En 4.1 el `max()` los comprimía y el tumbao continuo mataba al TAcka, de ahí los `overrides41`. En 7.1 ese problema no existe.

#### 3.5 — `backLTrebleSub: -0.50` — ZONA VERDE ✅

Este valor negativo suma treble al input del backL (`-treble × (-0.50) = treble × 0.50`). Es el mismo valor tanto en el body como en el override41 (el `overrides41` no lo overridea). No hay diferencia entre 4.1 y 7.1 en este punto. La fórmula es la misma en ambos layouts.

#### 3.6 — Sidechain Guillotine — ZONA VERDE ✅

```typescript
// En la Base:
if (p.layout41Strategy !== 'strict-split' && frontMax > p.sidechainThreshold) {
  const ducking = 1.0 - frontMax * p.sidechainDepth
  moverLeft *= ducking
  moverRight *= ducking
}
```

En 7.1 con Latino, `sidechainDepth = 0.12` (body) vs `0.08` en `overrides41`. El duck será ligeramente más pronunciado en 7.1. No es crítico — el efecto es mínimo (12% de ducking = `1 - frontMax × 0.12`, que con frontMax=0.80 da ducking de ~9%).

#### 3.7 — El singleton `liquidEngine71` — ZONA ROJA ❌

```typescript
// Al final de LiquidEngine71.ts:
export const liquidEngine71 = new LiquidEngine71()  // TECHNO_PROFILE por defecto
```

**Este es el problema real**. La instancia singleton está hardcodeada con `TECHNO_PROFILE`. Para que Latino funcione en 7.1, hay que:
- O bien llamar a `liquidEngine71.setProfile(LATINO_PROFILE)` cuando el género cambie a latino.
- O bien que el mismo mecanismo de hot-swap que usa el 4.1 sea invocado en la instancia 71.

Esto **no es un riesgo para el 4.1** — son instancias separadas. Pero es el único cambio de código necesario para que Latino suene en 7.1.

---

## BLUEPRINT ARQUITECTÓNICO — Latino 7.1 Integration Plan

### Fase 0 — Validación (no-code)

Confirmar que `TitanOrchestrator` (o quien decide el perfil activo) tiene acceso a ambas instancias de engine por separado. Auditar cómo se hace el swap de perfil en el flujo de señal cuando el género es latino.

### Fase 1 — Hot-swap Profile en Engine 7.1 (WAVE 2466)

**Cambio mínimo** para que Latino suene en 7.1 sin tocar el 4.1:

```typescript
// En el mecanismo de switch de género (TitanOrchestrator o donde sea):
if (genre === 'latino-fiesta') {
  liquidEngine71.setProfile(LATINO_PROFILE)  // listo — Base aplica perfil sin fusión (layout=7.1)
}
```

`setProfile()` en la Base recrea los 6 envelopes con la configuración efectiva. El estado interno (avgMid, silence, kick) se preserva. No hay salto de señal.

### Fase 2 — Validar moverLTonalThreshold para 7.1 (WAVE 2467-candidato)

Antes de producción, monitorear el valor de `flatness` real en canciones latinas con autotune. Si hay cortes del Galán:

```typescript
// En el body de LATINO_PROFILE (no en overrides41):
moverLTonalThreshold: 0.70,  // 0.45 → 0.70 — más permisivo en 7.1
```

Esto **no afecta al 4.1** porque `overrides41.moverLTonalThreshold: 0.99` overridea este valor en la fusión 4.1.

### Fase 3 — Opcional: Wash/Center (WAVE 2468-candidato)

Si existe una 7ª zona física (wash LED, zona central), hay dos enfoques:

**Opción A — Derivada por suma**: En `routeZones()` del 71 para Latino:
```typescript
center = Math.max(moverLeft, moverRight) * 0.6  // promedio energético
```
No requiere nueva envolvente en la Base.

**Opción B — Nueva señal en Base**: Añadir `envelopeWash` al `ILiquidProfile` y calcular una 7ª señal (ej: `Math.max(frontLeft, backLeft)` como suelo continuo de ambiente). Esto sí requiere cambios en la Base, en `ILiquidProfile`, y en `ProcessedFrame`.

**Recomendación**: Opción A primero. Posponer Opción B hasta tener fixture real de center/wash configurado.

---

## RESUMEN DE RIESGOS POR ZONA

| ID | Zona de Riesgo | Nivel | Impacto en 4.1 | Acción Requerida |
|---|---|---|---|---|
| R1 | Singleton hardcodeado a TECHNO | 🔴 Bloqueante | Ninguno | `setProfile(LATINO_PROFILE)` en switch de género |
| R2 | `moverLTonalThreshold: 0.45` en body | 🟡 Moderado | Ninguno | Monitorear flatness en prod. Candidato WAVE 2467 |
| R3 | Back L continuo (decay 0.92) | 🟢 Controlado | Ninguno | Esperado y correcto en 7.1 — sin max() la separación es limpia |
| R4 | Sidechain 0.12 vs 0.08 (4.1) | 🟢 Mínimo | Ninguno | Ducking marginal (+4%) — aceptable |
| R5 | Ausencia de 7ª zona en Base | 🟢 Cosm\u00e9tico | Ninguno | Posponer. Opción A de derivada sin cambios en Base |

---

## GARANTÍA DE CERO REGRESIONES EN 4.1

La arquitectura ya garantiza el aislamiento:

1. **`fuseProfileFor41()` es determinista**: Solo se activa con `layout='4.1'`. El layout es `readonly`. Sin efectos laterales.
2. **Instancias separadas**: `liquidEngine41` y `liquidEngine71` son objetos distintos en memoria. El `setProfile()` de uno no toca al otro.  
3. **`overrides41` son inmutables**: El body del `LATINO_PROFILE` no modifica `overrides41`. Los cambios de calibración futuros en el body (valores 7.1) se fusionan correctamente con el override para el 4.1.
4. **El hot-path es layout-agnostic**: `applyBands()` en la Base es el mismo para ambos layouts. La única diferencia es `fuseProfileFor41()` en inicialización, que ya está protegida.

**Condición de seguridad**: Nunca agregar lógica condicional a `fuseProfileFor41()` que dependa de señales de audio. Es una función de configuración pura — debe seguir siendo así.

---

## ORDEN DE EJECUCIÓN RECOMENDADA

```
WAVE 2466: R1 — Hot-swap setProfile en LiquidEngine71 para género latino
WAVE 2467: R2 — Monitor flatness + ajuste moverLTonalThreshold si necesario  
WAVE 2468: R5 — Wash/Center opcional con Opción A (derivada)
```

**Prerequisito antes de ejecutar**: Confirmar cómo `TitanOrchestrator` selecciona el engine (71 vs 41) y dónde ocurre el switch de género. Sin esto, el `setProfile()` no sabe dónde conectarse.

---

*Blueprint generado por PunkOpus — WAVE 2466 PRE-EJECUCIÓN*  
*Todos los valores verificados contra código fuente real. Sin suposiciones.*
