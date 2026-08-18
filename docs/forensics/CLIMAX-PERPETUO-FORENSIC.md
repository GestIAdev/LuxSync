# Reporte Forense: CLIMAX Perpetuo en Techno Minimal + Memoria de 30s

**Fecha:** 2026-08-18
**Síntoma:** `Phase: CLIMAX` aparece el 95% del tiempo en techno minimal (Boris Brejcha). Solo ~5% muestra `BUILDING`.
**Alcance:** `ThermodynamicVetoEngine.ts`, `StateCouplingEnforcer.ts`, `ContextualMemory.ts`

---

## 1. La Memoria de 30 Segundos — Confirmación

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\memory\ContextualMemory.ts" lines="189-194" />

```ts
// ANTES: bufferSize=300 (5s) → Z=12σ en drops normales
// AHORA: bufferSize=1800 (30s) → Z=3-4σ en drops reales
const DEFAULT_CONFIG: ContextualMemoryConfig = {
  bufferSize: 1800,  // 🔬 WAVE 1181: 30 segundos @ 60fps (was 300 = 5s)
```

**Confirmado:** La memoria es de 1800 frames @ 60fps = **30 segundos exactos**. Esto es by design (WAVE 1181). La filosofía es que la media represente el contexto musical, no los últimos 5 segundos. Con 5s, un drop normal producía Z=12σ (falso positivo). Con 30s, los drops reales producen Z=3-4σ (calibrado).

**La memoria NO es legacy.** Es el corazón del sistema de Z-scores. El problema no está en la memoria, está en cómo el TVE interpreta la energía.

---

## 2. El Bug: `eTotal > 0.65` — El Sustained Climax Override

### Causa raíz

El `ThermodynamicVetoEngine` tiene **6 lugares** donde un override de `eTotal > 0.65` fuerza `climax` sin mirar los Z-scores:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\perception\ThermodynamicVetoEngine.ts" lines="108-116" />

```ts
// Gate 1: CLIMAX VALIDATION
const isClassicalClimax = ev.zTotal > +0.3 && ev.zLow > +0.1   // ← Z-scores (normalizado)
const isSustainedClimax = ev.eTotal > 0.65                      // ← RAW energy (NO normalizado)
const isTexturalClimax = ev.spectralTension > 0.8 && ev.zHigh > +1.5 && ev.cfHigh > 5.0

if (isClassicalClimax || isSustainedClimax) {   // ← OR: basta con uno
  return this.accept(proposed, 'climax', ev, ...)
}
```

Los 6 overrides de `eTotal > 0.65`:

| Gate | Línea | Sección propuesta | Condición | Resultado |
|------|-------|-------------------|-----------|-----------|
| 1 | 110 | drop/chorus | `eTotal > 0.65` | climax |
| 3 | 149 | buildup | `eTotal > 0.65` (con ΔE > 0.02) | climax override |
| 3 | 157 | buildup | `eTotal > 0.65` (sin ΔE) | climax override |
| 5 | 207 | verse/unknown | `eTotal > 0.65` | climax upgrade |
| 6 | 238 | default | `eTotal > 0.65` | climax |
| downgrade | 270 | cualquiera (downgrade) | `eTotal > 0.65` | climax override |

### Por qué funciona en latino pero no en techno minimal

| Género | Energía raw (eTotal) | Z-score (zTotal) | ¿Sustained Climax? |
|--------|---------------------|------------------|---------------------|
| Latino (valle) | 0.20-0.40 | -1.5 a -0.5 | ❌ No (eTotal < 0.65) |
| Latino (build) | 0.45-0.65 | 0.0 a +1.0 | ❌ No (eTotal ≈ 0.65) |
| Latino (drop) | 0.70-0.90 | +2.0 a +4.0 | ✅ Sí (eTotal > 0.65) — correcto |
| **Techno minimal (Brejcha)** | **0.65-0.75 siempre** | **-0.5 a +0.5** | **✅ Sí SIEMPRE** — ❌ falso positivo |

**El problema:** `eTotal` es la **energía raw** (no normalizada). En techno minimal:
- La energía raw es alta y **plana** (0.65-0.75 constantemente)
- Los Z-scores son bajos porque la rolling stats de 30s se adaptan al baseline
- El TVE ignora los Z-scores y usa el raw energy → **siempre climax**

En latino:
- La energía raw varía mucho (0.2 en valles, 0.8 en drops)
- Los Z-scores capturan la varianza correctamente
- El sustained climax override solo dispara en drops reales → **correcto**

### Por qué el CLIMAX_LOCKOUT no ayuda

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\memory\ContextualMemory.ts" lines="261-264" />

```ts
private static readonly CLIMAX_LOCKOUT_MS = 4000; // ≈8 beats at 120 BPM
```

El `CLIMAX_LOCKOUT_MS = 4000` solo previene salir de climax por 4 segundos. Pero como el TVE **re-evalúa** climax cada frame y el `eTotal > 0.65` sigue siendo true, el lockout se resetea continuamente. El lockout asume que el TVE eventualmente dejará de decir climax, pero en techno minimal nunca lo hace.

### Por qué el StateCouplingEnforcer no ayuda

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\perception\StateCouplingEnforcer.ts" lines="76-85" />

```ts
// Hard rule: valley/ambient zone cannot be climax
if ((zone.label === 'valley' || zone.label === 'ambient') &&
    phase.phase === 'climax') {
  return { phase: this.overridePhase(phase, 'valley', ...), corrected: true }
}
```

El `StateCouplingEnforcer` solo fuerza **OUT** de climax cuando la zone es `valley` o `ambient`. Pero en techno minimal con energía raw 0.65-0.75, la zone probablemente es `active` o `intense` (no valley/ambient), así que el enforcer no interviene.

---

## 3. El Flujo del Bug

```
Frame N (techno minimal, energía plana 0.70):
┌─────────────────────────────────────────────────────────────┐
│ ContextualMemory.update()                                   │
│   ├─ energyStats.update(0.70) → zScore = +0.3 (normal)     │
│   └─ eTotal = 0.70 (raw, alto pero plano)                   │
│                                                             │
│ TVE.validate(proposed='verse', evidence)                    │
│   ├─ Gate 5: VERSE UPGRADE CHECK                           │
│   ├─ ev.eTotal > 0.65? → YES (0.70 > 0.65)                 │
│   └─ return { phase: 'climax', verdict: 'UPGRADED' }        │
│      "Verse upgraded to climax: sustained E=0.70"           │
│                                                             │
│ StateCouplingEnforcer.enforce(zone='active', phase='climax')│
│   └─ No conflict (active zone + climax phase = OK)          │
│                                                             │
│ ContextualMemory.calculateNarrativeContext()                │
│   ├─ narrativePhase = 'climax'                              │
│   ├─ CLIMAX_LOCKOUT: lastPhase='climax' → no lockout needed │
│   └─ lastNarrativePhase = 'climax'                          │
│                                                             │
│ Log: [MEMORY 🧠] E:+0.3σ 🟢 | Phase: CLIMAX | normal        │
└─────────────────────────────────────────────────────────────┘

Frame N+1, N+2, ... (igual):
  → Siempre climax porque eTotal siempre > 0.65
  → Z-score siempre ~0.3 (normal) pero ignorado
  → CLIMAX_LOCKOUT nunca expira porque nunca sale de climax
```

---

## 4. Consecuencias

### 4.1 Efectos hard/divinos nunca se seleccionan

El `EffectDreamSimulator` usa la `narrativePhase` para filtrar efectos. Si siempre es `climax`:
- Los efectos `divine` requieren `epicness` alto, que se calcula con Z-scores
- Los Z-scores son bajos en techno minimal (energía plana)
- `epicness` nunca sube → `isDivineCandidate` nunca se activa
- Los efectos hard requieren `aggression` alta + zona `peak`/`intense`
- La zona probablemente es `active` (no `peak`) porque la energía es plana
- Sin `peak`/`intense`, los efectos hard se filtran

### 4.2 El sistema no distingue entre "energía alta y plana" y "energía alta y variable"

| Estado | eTotal | zTotal | ¿Debería ser climax? |
|--------|--------|--------|----------------------|
| Drop de reggaetón | 0.85 | +3.5 | ✅ Sí |
| Techno minimal plano | 0.70 | +0.3 | ❌ No (es un plateau, no un climax) |
| Buildup de latino | 0.60 | +1.0 | ❌ No (es buildup) |

El bug es que `eTotal > 0.65` trata los dos primeros como iguales, pero el Z-score los distingue correctamente.

---

## 5. Recomendación de Fix

### Opción A: Subir el threshold de sustained climax (mínimo invasivo)

```ts
// ANTES:
const isSustainedClimax = ev.eTotal > 0.65

// DESPUÉS:
const isSustainedClimax = ev.eTotal > 0.80  // Solo drops reales, no plateaus
```

**Pros:** Mínimo cambio, preserva el comportamiento en latino.
**Contras:** Drops de techno con energía 0.70-0.80 no se detectarían como climax.

### Opción B: Requerir Z-score positivo + raw energy alto (recomendada)

```ts
// ANTES:
const isSustainedClimax = ev.eTotal > 0.65

// DESPUÉS:
const isSustainedClimax = ev.eTotal > 0.65 && ev.zTotal > +0.5
```

**Pros:** Distingue "plateau alto" (techno minimal) de "pico real" (drop de latino). El Z-score ya está normalizado contra el baseline de 30s.
**Contras:** En warmup (primeros 30s), los Z-scores son menos confiables.

### Opción C: Threshold adaptativo por varianza (óptima pero compleja)

```ts
// Si la varianza de energía es baja (música plana), exigir más raw energy
const energyVariance = this.energyStats.getStats()?.stdDev ?? 0
const sustainedThreshold = energyVariance < 0.05 ? 0.85 : 0.65
const isSustainedClimax = ev.eTotal > sustainedThreshold
```

**Pros:** Se adapta automáticamente al género. Techno plano exige 0.85, latino variable exige 0.65.
**Contras:** Requiere acceso a `energyStats` desde el TVE (inyectar varianza).

### Opción D: Eliminar el sustained climax override (radical)

Eliminar los 6 overrides de `eTotal > 0.65` y confiar solo en Z-scores.

**Pros:** Limpio, sin calibración por género.
**Contras:** Drops muy largos (>30s) donde el Z-score decae porque el baseline se adapta podrían perder el climax. El sustained override fue diseñado para esto.

---

## 6. Resumen

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Memoria 30s | ✅ Correcto | By design (WAVE 1181), no es legacy |
| CLIMAX_LOCKOUT 4s | ⚠️ Inefectivo | Se resetea continuamente porque el TVE siempre dice climax |
| `eTotal > 0.65` override | ❌ Bug | 6 lugares donde fuerza climax sin mirar Z-scores |
| StateCouplingEnforcer | ⚠️ No ayuda | No interviene porque la zone es `active` (no valley) |
| Techno minimal | ❌ Siempre climax | Energía raw 0.65-0.75 constante dispara el override |
| Latino | ✅ Funciona | Energía raw varía, el override solo dispara en drops reales |

**Conclusión:** El `eTotal > 0.65` sustained climax override es un hack diseñado para latino que no funciona en techno minimal. La Opción B (requerir `zTotal > +0.5` además de `eTotal > 0.65`) es el fix más equilibrado: preserva el comportamiento en latino y desbloquea el detection correcto en techno minimal.
