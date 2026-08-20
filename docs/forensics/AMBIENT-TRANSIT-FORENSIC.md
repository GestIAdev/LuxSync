# INFORME: Efectos Ambientales-Transitorios nunca simulados por Cassandra

**Fecha:** 2026-08-20
**Fase:** READ-ONLY (investigación)
**Síntoma:** Los efectos ambientales-transitorios (latin_bubbles, etc.) nunca aparecen
en el ranking del Dream Simulator. Solo se disparan vía Sovereign Clock RE-ROUTE
cuando un efecto heavy/divine es abortado en tiempo real.

---

## DIAGNÓSTICO RAÍZ

Hay **3 bugs encadenados** que impiden que los efectos ambientales-transitorios
se simulen proactivamente. El problema NO es la escala energética en sí (el
dynamic noise floor WAVE 7521 funciona), sino cómo el Dream Simulator predice
y filtra candidatos para eventos de BAJA energía.

---

## BUG 1: El Dream Simulator nunca predice eventos de baja energía

**Ubicación:** `EffectDreamSimulator.ts` — predicciones del oráculo Cassandra

**Problema:** El oráculo solo predice eventos de ALTA energía:
- `drop_incoming`
- `buildup_starting`
- `transition_beat`

**Nunca** predice:
- `breakdown_incoming` (viene un parón)
- `valley_incoming` (viene un valle)
- `ambient_transition` (transición a ambiente)

**Evidencia en el log:** En 868 líneas, TODAS las predicciones del Dream Simulator son:
```
pred=drop_incoming conf=0.698
pred=buildup_starting conf=0.655
pred=transition_beat conf=0.500
pred=buildup_starting conf=0.672
pred=drop_incoming conf=0.707
```

Nunca aparece una predicción de breakdown o valley. Cuando la música entra en
un parón (MSST detecta `breakdown`), el Dream Simulator ya tiene un pre-buffer
de `Strobe Storm` o `Seismic Snap` sellado para un `drop_incoming` que no va a
llegar — y el Sovereign Clock lo reroutea a `latin_bubbles` como plan B.

**Consecuencia:** Los efectos ambientales-transitorios son **ciudadanos de
segunda clase** — nunca son la predicción principal, solo el fallback de
rescate cuando algo pesado se aborta.

---

## BUG 2: Zone override siempre SUBE, nunca BAJA

**Ubicación:** `EffectDreamSimulator.ts:882-884`

```typescript
const rawProjectedZone = isFutureHeavyEvent ? 'peak'
  : isFutureBuildup ? 'intense'
  : energyZone
```

**Problema:** Si el evento futuro es heavy o buildup, la zona se override a
`peak` o `intense`. Pero **NUNCA** se override a `gentle` o `ambient` cuando
viene un breakdown.

**Evidencia en el log:**
```
[DREAM_SIMULATOR] 🔮 ORACLE VISION: zone override intense → peak
[DREAM_SIMULATOR] 🔮 ORACLE VISION: zone override active → intense
```

Nunca aparece `zone override intense → gentle` o `→ ambient`.

**Consecuencia:** Cuando el MSST detecta `breakdown → verse` y la energía
cae a E=0.43 (Z=-1.12σ), la zona real es `silence` o `valley`. Pero si el
oráculo tiene un `drop_incoming` pre-bufferizado (que no va a llegar), la
`projectedZone` se queda en `intense` o `peak`, y `filterByZone` elimina
todos los efectos con aggression < 0.60.

**latin_bubbles** tiene `aggression: 0.5` → cae en zona `gentle`/`active`
(0.35-0.80). Con `projectedZone = intense` (min 0.60), `0.5 < 0.60` →
**FILTRADO**.

---

## BUG 3: `relaxGuardsForFuture` solo relaja el MIN, no el MAX de pressureRange

**Ubicación:** `EffectDreamSimulator.ts:705-718`

```typescript
private filterByPressure(
  effects: string[],
  currentPressure: number,
  relaxGuardsForFuture: boolean,
): string[] {
  const registry = getDynamicEffectRegistry()
  const filtered = effects.filter(effect => {
    const entry = registry.getEntry(effect)
    if (!entry) return false
    const pr = entry.pressureRange
    if (pr.min === 0 && pr.max === 0) return true  // permissive
    if (relaxGuardsForFuture && currentPressure < pr.min) return true  // ← solo relaja MIN
    return currentPressure >= pr.min && currentPressure <= pr.max  // ← MAX siempre estricto
  })
  // ...
}
```

**Problema:** `relaxGuardsForFuture` solo relaja el gate de MIN — si la
presión actual es baja pero subirá (drop incoming), permite efectos que
requieren presión alta.

Pero **NO relaja el gate de MAX** — si la presión actual es alta pero
bajará (breakdown incoming), los efectos que requieren presión baja
(`pressureRange.max < currentPressure`) se filtran.

**Escenario real del log:**
- Pressure actual: 0.865 (chorus de reggaetón)
- Viene un breakdown (la presión bajará a ~0.50)
- Efecto ambiental configurado: `pressureRange: {min: 0, max: 0.85}`
- `0.865 > 0.85` → **FILTRADO** aunque el breakdown va a bajar la presión

**Nota sobre latin_bubbles:** Este efecto específico tiene
`pressureRange: {min: 0, max: 0}` (permissive), así que NO es filtrado
por pressure. Pero otros efectos ambientales que el usuario configuró con
`max < 0.90` SÍ son filtrados por este bug.

---

## ¿LA ESCALA ENERGÉTICA ESTÁ ROTA?

**No.** El dynamic noise floor (WAVE 7521) funciona correctamente:

```typescript
// EnergyConsciousnessEngine.ts:510
private normalizeEnergy(raw: number): number {
  const range = (this._rollingMaxEnergy - this._rollingMinEnergy) + DYNAMIC_RANGE_EPSILON
  return Math.max(0, Math.min(1, (raw - this._rollingMinEnergy) / range))
}
```

Para reggaetón con noise floor ~0.40, un parón a 0.42 se normaliza a
`(0.42 - 0.40) / (1.0 - 0.40 + ε) ≈ 0.03` → SILENCE.

**Evidencia en el log:**
```
[SeleneTitanConscious] 🧘 SILENCE (throttled, last 5.0s ago) | vibe=fiesta-latina | E=0.43 | Z=-1.12σ
[MEMORY 🧠] E:-1.7σ 🟡 B:-1.3σ 🟢 H:-0.5σ 🟢 | Phase: SILENCE | normal
```

El sistema SÍ detecta el silencio/valle relativo. El problema es que el
**Dream Simulator no actúa sobre esa detección** — sigue prediciendo
`drop_incoming` y filtrando por zona `intense`.

El adaptive floor de 0.30 como silencio funciona en el sentido de que la
zona se determina correctamente (SILENCE aparece en logs). Pero el Dream
Simulator no consume esa información para predecir eventos de baja energía.

---

## ¿POR QUÉ latin_bubbles SÍ SE DISPARA (A VECES)?

latin_bubbles se dispara exclusivamente por **Sovereign Clock RE-ROUTE**:

```
[Sovereign Clock 🔄] DIVINE RE-ROUTE: "Latina Meltdown" → "latin_bubbles"
[Sovereign Clock 🔄] DIVINE RE-ROUTE: "Strobe Storm" → "latin_bubbles"
[SeleneTitanConscious] 🔮👑 CASSANDRA SOVEREIGN CLOCK: firing "latin_bubbles" | 🔄 HEAVY RE-ROUTED
```

El SovereignClockGuard (`SovereignClockGuard.ts:271-286`) busca candidatos
ligeros cuando un efecto divine/heavy es bloqueado:

```typescript
const lighterCandidatesDivine = vibeArsenalDivine.filter(e =>
  !e.simMeta.isDivineCandidate &&
  !e.simMeta.isHeavyCandidate &&
  (e.dna.aggression ?? 0) <= 0.70 &&
  (!e.organismId || e.organismStatus !== 'alive')
)
```

latin_bubbles tiene `aggression: 0.5 ≤ 0.70` → entra como candidato de
reroute. Se ordena por aggression descendente y se pick el primero sin
cooldown reciente.

**Pero esto es reactivo, no proactivo.** El efecto se dispara como
consolación cuando algo pesado falla, no porque Selene predijo que
venía un parón y preparó un ambiental.

---

## CADENA DE FILTRADO EN EL LOG

Para una sesión de fiesta-latina con 17 efectos en el vibe:

```
[DREAM_AUDIT] vibe="fiesta-latina" zone=intense pressure=0.865
  | vibeAllowed=17 → zoneFiltered=9 → pressureFiltered=8
```

- **vibeAllowed=17**: 17 efectos compatibles con fiesta-latina
- **zoneFiltered=9**: 8 efectos eliminados por `filterByZone(intense)`
  - Eliminados: todos con aggression < 0.60 (latin_bubbles, ambientales, etc.)
- **pressureFiltered=8**: 1 efecto eliminado por `filterByPressure`
  - Eliminado: efecto con pressureRange.max < 0.865

Los 8 finalistas son todos heavy/divine: Strobe Storm, Latina Meltdown,
Seismic Snap, Solar Flare, Strobe Burst, Ambient Strobe, etc.

**latin_bubbles nunca llega al ranking** porque se filtra en `zoneFiltered`.

---

## RESUMEN DE CAUSAS

| # | Bug | Impacto | Severidad |
|---|-----|---------|-----------|
| 1 | Dream Simulator no predice eventos de baja energía | Ambientales nunca son candidatos proactivos | ALTA |
| 2 | Zone override solo sube (peak/intense), nunca baja (gentle/ambient) | filterByZone elimina ambientales en breakdowns | ALTA |
| 3 | relaxGuardsForFuture no relaja MAX de pressureRange | Efectos con max < pressure actual se filtran aunque viene valle | MEDIA |

**El adaptive floor de 0.30 NO está roto.** La zona se calcula bien (SILENCE
aparece). El problema es que el Dream Simulator no consume esa información
para predicciones de baja energía.

---

## RECOMENDACIONES PARA EL ARQUITECTO (FASE 2)

> **Nota:** Estas recomendaciones son para la próxima fase. NO se modifica
> código en esta fase de investigación.

### Fix 1: Predicciones de baja energía en el oráculo
El oráculo Cassandra necesita predecir no solo `drop_incoming` y
`buildup_starting`, sino también:
- `breakdown_incoming` — cuando el MSST detecta transición a breakdown
- `valley_incoming` — cuando la energía tiende a bajar sostenidamente
- `ambient_transition` — cuando la zona actual es ambient/gentle y se mantiene

Esto permitiría que el Dream Simulator prepare candidatos ambientales
proactivamente.

### Fix 2: Zone override bidireccional
```typescript
const rawProjectedZone = isFutureHeavyEvent ? 'peak'
  : isFutureBuildup ? 'intense'
  : isFutureBreakdown ? 'gentle'      // ← NUEVO
  : isFutureValley ? 'ambient'        // ← NUEVO
  : energyZone
```

### Fix 3: relaxGuardsForFuture bidireccional
```typescript
if (relaxGuardsForFuture) {
  // Relajar MIN: la presión subirá (drop incoming)
  if (currentPressure < pr.min) return true
  // Relajar MAX: la presión bajará (breakdown incoming) ← NUEVO
  if (currentPressure > pr.max) return true
}
return currentPressure >= pr.min && currentPressure <= pr.max
```

Esto requiere que `relaxGuardsForFuture` se active también para predicciones
de baja energía, no solo para heavy/buildup.

### Fix 4 (opcional): Categoría "transitorio" en el DNA
Los efectos ambientales-transitorios podrían tener un flag explícito en su
cognitiveDNA (ej: `archetype: "transitional"`) que les dé prioridad en
predicciones de breakdown/valley, similar a como `isHeavyCandidate` da
prioridad en drops.

---

*Generado por investigación read-only — 2026-08-20*
