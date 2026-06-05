allazgos WAVE 5002 — Z-SCORE NOISE FLOOR & SENSES MAP

1. Cálculo del Z-Score (RollingStats.ts)


RollingStats.ts:132-143
// Calcular estadísticas
const n = this.buffer.size;
const mean = this.sum / n;
    
// Varianza usando fórmula: E[X²] - E[X]²
const variance = Math.max(0, (this.sumSquares / n) - (mean * mean));
const stdDev = Math.max(this.config.minStdDev, Math.sqrt(variance));
    
// Z-Score: cuántas desviaciones estándar del valor actual respecto a la media
// Cap: clamp a ±maxZScoreCap para evitar outliers absurdos (silencio→boom = ~20σ)
const rawZScore = (value - mean) / stdDev;
const zScore = Math.max(-this.config.maxZScoreCap, Math.min(this.config.maxZScoreCap, rawZScore));
Configuración actual del suelo (minStdDev):



RollingStats.ts:44-65
const DEFAULT_CONFIG: Required<RollingStatsConfig> = {
  windowSize: 300, // ~5 segundos a 60fps
  maxZScoreCap: 10.0, // Cap: Z > 10σ es cosméticamente absurdo y numéricamente inestable
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔬 WAVE 1181.1: Z-SCORE FLOOR FIX
  // 🔬 WAVE 2185: RECALIBRATED — 0.08 → 0.05
  // ═══════════════════════════════════════════════════════════════════════════
  minStdDev: 0.05, // 🔬 WAVE 2185: Recalibrado (was 0.08, was 0.001)
2. Protección contra stdDev = 0
SÍ existe. Se aplica en dos lugares:

RollingStats.update():


RollingStats.ts:138
const stdDev = Math.max(this.config.minStdDev, Math.sqrt(variance));
RollingStats.hypotheticalZScore():


RollingStats.ts:175
const stdDev = Math.max(this.config.minStdDev, Math.sqrt(variance));
Pero el suelo actual (0.05) es INSUFICIENTE para el escenario de silencio prolongado + voz suave.

3. Mapeo de Senses.ts — senseMusicalPattern()


MusicalPatternSensor.ts:128-131
// Bandas de frecuencia normalizadas
bassPresence: state.bass,
midPresence: state.mid,
highPresence: state.high,


MusicalPatternSensor.ts:73-76
export function senseMusicalPattern(state: TitanStabilizedState): SeleneMusicalPattern {
  const section = classifySection(state.sectionType)
  const energyPhase = classifyEnergyPhase(state.smoothedEnergy)
Respuesta: MusicalPatternSensor NO aplica suavizado a las bandas. Hace un passthrough directo (state.bass, state.mid, state.high) desde TitanStabilizedState. El único suavizado previo en el pipeline es smoothedEnergy (producido por EnergyStabilizer en TitanEngine), pero las bandas individuales llegan crudas.

4. 📋 Comentario Forense — Propuesta de "Suelo de Varianza"
Diagnóstico del fallo:

En una intro vocal prolongada, la energía se asienta en ~0.05-0.10 con varianza real casi nula. El minStdDev = 0.05 actúa como denominador. Cuando la voz entra y eleva la energía a 0.20, el Z-Score explota:



mean ≈ 0.08  |  value = 0.20  |  minStdDev = 0.05
rawZ = (0.20 - 0.08) / 0.05 = 2.4σ  →  Notable/Épico (falso positivo)
Si el salto es un poco más pronunciado (0.05 → 0.25):



rawZ = (0.25 - 0.05) / 0.05 = 4.0σ  →  DIVINE_DROP (falso positivo grave)
Propuesta de coeficiente:

Suelo de Varianza recomendado: minStdDev = 0.10 (subir desde 0.05).

Justificación numérica:

Escenario	Energía salto	minStdDev=0.05	minStdDev=0.10	Resultado
Voz suave en intro	0.05 → 0.20	3.0σ	1.5σ	✅ Ignorado como normal
Plosiva / frase corta	0.05 → 0.30	5.0σ	2.5σ	✅ Notable, no DIVINE
Drop real de reggaetón	0.05 → 0.75	14.0σ	7.0σ	✅ Sigue pasando DIVINE
El maxZScoreCap = 10.0 sigue protegiendo contra outliers cosméticos. Un floor de 0.10 no caza señales legítimas de drops reales, pero elimina los falsos disparos causados por la varianza artificialmente comprimida en silencios.

---

## 🔴 HALLAZGO 5 — GHOST DROP LOCK (DecisionMaker.ts)

**Síntoma:** El log dice `DROP LOCKED — effect already fired for this drop section` aunque **ningún efecto llegó a dispararse**.

**Causa raíz:** `acquireDropLock()` se ejecuta **antes** de la validación `ANTI-FAKE-DROP`.

```typescript
@/electron-app/src/core/intelligence/think/DecisionMaker.ts:1033-1065
    // 🔒 WAVE 2187: THE DROP LOCK — Anti-Esquizofrenia
    if (!acquireDropLock()) {                                // ← LOCK PUESTO AQUÍ
      console.log(`[DecisionMaker 🔒] DROP LOCKED...`)
    } else {
      const suggestedEffect = selectFromArsenalWithDiversity(dropArsenal)

      // 🛡️ WAVE 2200.2: ANTI-FAKE-DROP — Z-Score Sanity Check
      if (isHeavyEffect(suggestedEffect) && currentZ < antiFakeThreshold) {
        // ← ABORTA AQUÍ, pero el lock YA ESTÁ ACTIVO
        console.log(
          `[DecisionMaker 🛡️] ANTI-FAKE-DROP... ABORTED`
        )
        // Sin effectDecision — pero lock sigue activo
      } else {
        output.effectDecision = { ... }  // Solo aquí se dispara realmente
      }
    }
```

**Cadena del fallo en el log:**

1. `DROP LOCK ACQUIRED` → `_dropLockSection = 'drop'`
2. `ANTI-FAKE-DROP (LATINO): "strobe_storm" ABORTED — Z=0.22σ < 0.85` → Aborta, lock NO se libera
3. `SILENCE` → Efecto nunca se disparó
4. `DROP LOCKED — effect already fired... Suppressing.` ×5 → **Falso positivo**, no se disparó nada
5. `DROP LOCK RELEASED: section transitioned drop→verse` → Solo libera al salir de sección

**Comentario forense:**

> **Fix propuesto:** `releaseDropLock()` en el path de abort del anti-fake, o mover `acquireDropLock()` a DESPUÉS de pasar todas las validaciones (anti-fake + spectral gate + worthiness).
>
> Alternativa mínima: cambiar el log de `DROP LOCKED` a `DROP LOCKED (ghost)` cuando no existe `effectDecision` en el output, para no confundir al operador.

---

## 🟡 HALLAZGO 6 — CASSANDRA / FilterByZone — Rango de Agresión Demasiado Permisivo

**Síntoma:** El Dream Simulator genera candidatos de agresión muy dispar (ej. `cumbia_moon` suave y `latina_meltdown` hard) dentro de la misma pool para una zona dada.

**Causa raíz:** Los rangos de `active` e `intense` dejan pasar casi todo.

```typescript
@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:496-503
const aggressionLimits: Record<string, { min: number; max: number }> = {
  'silence': { min: 0, max: 0.30 },
  'valley':  { min: 0, max: 0.50 },
  'ambient': { min: 0, max: 0.70 },
  'gentle':  { min: 0, max: 0.85 },
  'active':  { min: 0.20, max: 1.00 },  // ← Casi TODO pasa
  'intense': { min: 0.45, max: 1.00 },  // ← Desde medio a brutal
  'peak':    { min: 0.70, max: 1.00 },
}
```

**Consecuencia:** `generateCandidates()` recibe efectos de agresión `0.20` y `0.95` en la misma pool cuando la zona es `active`. El scoring del Dream Simulator les asigna intensidades similares (todas pasan por `calculateIntensity()` con `MIN_VISIBLE_INTENSITY = 0.80`), por lo que un efecto suave puede ganar sobre uno hard por mera diversidad o hash de nombre.

**Comentario forense:**

> **Fix propuesto:** Restringir los topes para forzar coherencia de intensidad dentro del pool de candidatos:
>
> | Zona | Rango actual | Rango propuesto | Justificación |
> |---|---|---|---|
> | `active` | `0.20–1.00` | `0.40–0.80` | Separar soft de hard; builds medios no necesitan arsenal brutal |
> | `intense` | `0.45–1.00` | `0.60–1.00` | Solo hard; medios deben quedar en `active` |
>
> Esto fuerza al Dream Simulator a producir candidatos homogéneos en agresión para cada zona, evitando que un `cumbia_moon` (agresión ~0.30) compita contra `latina_meltdown` (agresión ~0.90) en el mismo frame de zona `active`.