# WAVE 4837 — AUDITORÍA: Densidad de efectos en fiesta-latina (reggaetón / dembow)

> **Estado:** Auditoría sin código. Hipótesis, evidencia y propuestas.
> **Origen:** Síntoma subjetivo del usuario — demasiados efectos por minuto, desaparición del log "DIVINE", a veces dos efectos seguidos.
> **Log analizado:** `docs/logs/1234.md` (708 líneas, ~21 segundos reales, frames 6960→8220).

---

## 1. MEDICIÓN OBJETIVA — ¿Cuántos efectos disparan realmente?

Buscando `FIRED` en el log:

| # | Frame aprox. | Efecto | Path | Z-score | Intensidad |
|---|--------------|--------|------|---------|------------|
| 1 | 6960 | `glitch_guaguanco` | `hunt_strike` (DNA) | 0.7 | 0.90 |
| 2 | 7440 | `cumbia_moon` | `hunt_strike` (DNA) | 0.4 | 0.66 |
| 3 | 7620 | `latina_meltdown` | `drop` (HEAVY) | 1.51 | 0.95 |
| 4 | 7920 | `salsa_fire` | `drop` (HEAVY) | 1.61 | 0.96 |

**4 efectos en 1260 frames ≈ 21 segundos = 11.4 EPM** (efectos por minuto).

**Objetivo declarado en `SeleneTitanConscious.ts:344`:** *"3-4 EPM con LATINA_GLOBAL_EFFECT_COOLDOWN_MS=12000"*.

> **El sistema está disparando ~3× por encima del target en BALANCED + fiesta-latina.**

Los disparos se agrupan así:
- 2 hunt_strikes (DNA approves vía Fuzzy/Hunt) → "ambient" / light effects
- 2 drop effects (heavy arsenal) → en dos drops detectados consecutivos

Hay además **muchos abortados** que no se ven en pista pero saturan logs:
- `ANTI-FAKE-DROP: latina_meltdown ABORTED — Z=0.45 < 0.5` (línea 26)
- `ANTI-FAKE-DROP: latina_meltdown ABORTED — Z=-1.72 < 0.5` (línea 152)
- `ANTI-FAKE-DROP: latina_meltdown ABORTED — Z=-0.42 < 0.5` (línea 183)
- ~13× `DROP LOCKED — effect already fired for this drop section. Suppressing.`

---

## 2. ¿POR QUÉ DESAPARECIÓ EL LOG "DIVINE"?

El recuerdo del usuario es **Z > 3.5σ**. En código actual:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\think\DecisionMaker.ts:50-54
/** 
 * Umbral de Z-Score para DIVINE moment (momento de máximo impacto obligatorio) 
 * 🔬 WAVE 2185: Elevado de 3.5 a 4.0 + dual validation con energía efectiva
 */
export const DIVINE_THRESHOLD = 4.0
```

Y existe además un **doble gate energético**:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\think\DecisionMaker.ts:390
const DIVINE_ENERGY_GATE = 0.72  // 🔬 WAVE 2494: rawEnergy mínimo
```

DIVINE solo dispara si **Z ≥ 4.0σ Y rawEnergy ≥ 0.72 Y zone ∉ {silence, valley}**.

### Lo que pasa en reggaetón / dembow

El reggaetón tiene un patrón rítmico **constante y uniforme** (kick-snare repetitivo en compás 4/4 con dembow). En ese patrón:

- La **energía media** se mantiene alta y plana (0.5–0.85 en el log)
- La **desviación estándar acumulada (σ)** crece y se vuelve grande, porque hay variabilidad continua
- **Z = (E - μ) / σ** → si σ es grande, Z nunca llega a 4σ aunque haya picos reales

**Z observados en TODO el log:** rango `[-2.3, +2.3]`. El máximo registrado es `Z=2.3` (línea 580, `FUZZY ⚡ FORCE_STRIKE | Divine_Drop`). **Ni de lejos llega a 4.0**.

### Conclusión

> **DIVINE no desapareció — está vivo, pero estructuralmente inalcanzable en géneros groove-constante.** Para que DIVINE dispare en reggaetón necesitaríamos un silencio brusco de varios segundos seguido de un kick brutal, cosa que no ocurre en dembow.

**Esto no es necesariamente un bug.** El diseño de WAVE 2185 buscaba exactamente esto: que DIVINE sea un evento estadístico extremo, no rutinario. En techno-minimal con bombo seco tras silencio sí dispara. En reggaetón no, **y no debería disparar** (porque el clímax es continuo, no puntual).

---

## 3. ¿POR QUÉ DISPARA DEMASIADO?

### 3.1 Causa raíz #1 — Sección "drop" oscila como una metralla

Contando transiciones de sección en el log:

| Línea | Transición |
|-------|------------|
| 58 | `drop → verse` |
| 160 | `drop → buildup` |
| 219 | `drop → breakdown` |
| 386 | `drop → verse` |
| 405 | `drop → buildup` |
| 461 | `drop → verse` |
| 587 | `drop → verse` |

**7 transiciones de salida de drop en 21 segundos**. Cada vez que la sección pasa a `drop` el `_dropLockSection` se libera (línea 230-235 de `DecisionMaker.ts`), y el siguiente frame que detecte `pattern.section === 'drop'` adquiere un nuevo lock y puede disparar otro heavy arsenal.

Los `[DecisionMaker 🔒] DROP LOCK ACQUIRED — single effect per drop` aparecen **7 veces** en el log. Eso significa que el sistema cree haber visto 7 drops distintos en 21 segundos. **No es musical — es ruido del detector**.

> El **`DROP LOCK`** funciona perfectamente para evitar dobles disparos *dentro* de un mismo drop, pero **no protege contra detección esquizofrénica de drops** en grooves continuos donde la sección parpadea drop↔verse↔breakdown según micro-fluctuaciones de energía.

Esto explica el síntoma del usuario *"a veces dispara dos seguidos"*: cuando la sección hace `drop → verse → drop` en ~1 segundo, el lock se libera y re-adquiere, permitiendo dos disparos pegados (lat. meltdown línea 373 y salsa_fire línea 568, separados ~300 frames = 5s).

### 3.2 Causa raíz #2 — El ANTI-FAKE-DROP es demasiado generoso

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\think\DecisionMaker.ts:972-976
if (HEAVY_ARSENAL_EFFECTS.has(suggestedEffect) && currentZ < 0.5) {
  console.log(
    `[DecisionMaker 🛡️] ANTI-FAKE-DROP: "${suggestedEffect}" ABORTED — ` +
    `Z=${currentZ.toFixed(2)}σ < 0.5 (energy insufficient for heavy arsenal)`
  )
```

**Z ≥ 0.5σ** permite arsenal pesado. En reggaetón, donde Z oscila en `[-2.3, +2.3]`, más del 30% del tiempo Z > 0.5. Es decir: prácticamente cualquier drop detectado pasa el filtro.

Los dos heavy drops del log dispararon con `Z=1.51` y `Z=1.61` — pasaron con margen amplio.

**El umbral 0.5 fue calibrado para techno** (`WAVE 2200.2` buildup-extrema, donde el problema era que arsenal disparaba con Z negativo). Para reggaetón sería más correcto **Z ≥ 1.5σ** (un drop que destaque realmente sobre la baseline).

### 3.3 Causa raíz #3 — El cooldown global de fiesta-latina no usa el `cooldownMultiplier` del mood

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\SeleneTitanConscious.ts:342-346
private lastGlobalEffectTimestamp: number = 0
private readonly GLOBAL_EFFECT_COOLDOWN_MS = 7000
private readonly LATINA_GLOBAL_EFFECT_COOLDOWN_MS = 12000
```

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\SeleneTitanConscious.ts:877-880
const globalCooldownMs = pattern.vibeId === 'fiesta-latina'
  ? this.LATINA_GLOBAL_EFFECT_COOLDOWN_MS
  : this.GLOBAL_EFFECT_COOLDOWN_MS
if (timeSinceLastEffect < globalCooldownMs && !isDropUrgent) {
```

**`globalCooldownMs` se lee crudo, sin multiplicar por `MoodController.getCurrentProfile().cooldownMultiplier`.**

En BALANCED el `cooldownMultiplier` es **2.2** (`WAVE 4829`). En CALM es **4.0**. En PUNK es **0.7**.

Si se aplicara, el cooldown LATINA quedaría:
- CALM: 12s × 4.0 = **48s**
- BALANCED: 12s × 2.2 = **26.4s**
- PUNK: 12s × 0.7 = **8.4s**

> El usuario cree estar en BALANCED esperando ~3-4 EPM, pero el cooldown se aplica con el valor crudo. Esto explica perfectamente por qué CALM "no parece más calmado de lo esperado" y por qué BALANCED en fiesta-latina sigue siendo agresivo.

**Además**, el bypass `isDropUrgent` (`prediction.estimatedTimeMs < 800 && prediction.probability > 0.80`) salta el cooldown completamente cuando el predictor canta drop. En groove constante, eso pasa cada pocos segundos.

### 3.4 Causa raíz #4 — DROP LOCK NO bloquea hunt_strike

`DROP LOCK` solo protege `generateDropPreparationDecision()` (línea 935 de `DecisionMaker.ts`). El path **`generateStrikeDecision()`** (DNA approved + hunt_strike) **no consulta el lock**.

Esto explica la secuencia del log:
1. Frame 6960: `glitch_guaguanco FIRED [hunt_strike]` — DNA path, sin lock
2. Frame 7440: `cumbia_moon FIRED [hunt_strike]` — DNA path, sin lock
3. Frame 7620: `latina_meltdown FIRED [drop]` — adquiere lock
4. Frame 7920: `salsa_fire FIRED [drop]` — adquiere lock NUEVO porque sección rebotó

Los dos primeros **podrían haber sido bloqueados** si el lock fuera global. Como no lo es, hunt_strike sigue disparando aunque el drop ya tenga su efecto principal.

### 3.5 Causa raíz #5 — Diversidad estancada en drops

Las 7 selecciones de drop disparan **siempre el mismo ranking**:

```
DIVERSITY SELECT: winner=latina_meltdown score=0.313 from
  [latina_meltdown, oro_solido, solar_flare, salsa_fire]
```

`score=0.313` se repite literal en todas las invocaciones del drop. Eso significa que el `selectFromArsenalWithDiversity()` está calculando el mismo ranking cada vez porque los inputs (cooldowns por efecto, usage counters) no cambian lo suficiente entre frames.

Resultado: aunque el sistema fuera más restrictivo, **siempre disparará latina_meltdown** hasta que entre en hard cooldown.

---

## 4. ¿LA MÚSICA "ES ASÍ"? — ANÁLISIS OBJETIVO

El reggaetón / dembow tiene tres características musicales que el sistema actual interpreta erróneamente como "drops constantes":

| Característica musical | Cómo la interpreta el sistema |
|------------------------|-------------------------------|
| Patrón kick-clap constante (groove) | Energía oscilante → drop↔verse↔breakdown |
| Pads/sintes que entran/salen por compases | Buildups falsos cada 4-8 beats |
| Voces con dinámica fuerte | Z-scores positivos repetidos |
| Sin breaks reales (groove continuo) | Predictor canta drop_incoming constantemente |

> **Veredicto musicológico:** El reggaetón es un género de **estructura plana en términos de "secciones EDM"**. Su clímax está en la **continuidad**, no en el contraste. El sistema fue calibrado pensando en techno/EDM (estructura buildup → drop → breakdown clara) y traslada esa lógica al reggaetón, donde no aplica.

**No es que la música esté mintiendo. Es que el detector aplica un modelo (EDM-shaped) que no encaja con dembow.**

---

## 5. PROPUESTAS DE FIX (ordenadas por impacto y simplicidad)

### Propuesta A — Aplicar `cooldownMultiplier` al global cooldown (1 línea, alto impacto)

```ts
// Antes:
const globalCooldownMs = pattern.vibeId === 'fiesta-latina'
  ? this.LATINA_GLOBAL_EFFECT_COOLDOWN_MS
  : this.GLOBAL_EFFECT_COOLDOWN_MS

// Después:
const baseCooldown = pattern.vibeId === 'fiesta-latina'
  ? this.LATINA_GLOBAL_EFFECT_COOLDOWN_MS
  : this.GLOBAL_EFFECT_COOLDOWN_MS
const globalCooldownMs = MoodController.getInstance().applyCooldown(baseCooldown)
```

**Impacto esperado:**
- BALANCED latina: 12s → 26.4s → de ~11 EPM a ~4-5 EPM ✅ (objetivo cumplido)
- CALM latina: 12s → 48s → ~1-2 EPM (objetivo CALM cumplido)
- PUNK latina: 12s → 8.4s → ~7 EPM (caos controlado)

**Riesgo:** muy bajo. Es coherencia arquitectónica — el `MoodController` se diseñó precisamente para esto.

---

### Propuesta B — Subir el umbral ANTI-FAKE-DROP en fiesta-latina (1 línea, alto impacto)

```ts
// Antes:
if (HEAVY_ARSENAL_EFFECTS.has(suggestedEffect) && currentZ < 0.5) {

// Después (vibe-aware):
const heavyArsenalZThreshold = pattern.vibeId.includes('latin') || pattern.vibeId.includes('fiesta')
  ? 1.5   // Reggaetón necesita Z realmente alto para arsenal nuclear
  : 0.5   // Techno/pop: comportamiento actual
if (HEAVY_ARSENAL_EFFECTS.has(suggestedEffect) && currentZ < heavyArsenalZThreshold) {
```

**Impacto:** los drops detectados con Z<1.5 (la mayoría en groove continuo) no dispararán heavy arsenal — el sistema caerá en silencio o efectos blandos. Combina muy bien con Propuesta A.

**Riesgo:** medio. Si el detector de drops es más fiable de lo que parece, podríamos perder algún clímax real. Mitigación: empezar con 1.2 en lugar de 1.5 y ajustar.

---

### Propuesta C — DROP LOCK global (no solo en drop_preparation) (5 líneas, medio impacto)

Hacer que `acquireDropLock()` se invoque también en `generateStrikeDecision()` cuando `section === 'drop'`. Así un hunt_strike durante un drop respeta el "un efecto por drop".

**Impacto:** elimina pares como `glitch_guaguanco (hunt) + latina_meltdown (drop)` en el mismo drop.

**Riesgo:** medio. Hunt_strikes legítimos previos al drop (durante el verse) seguirían pasando, pero los que coinciden con el drop quedan bloqueados. Habría que pensar si el primer efecto en disparar (el más alejado del drop) debería "ganar" o si debería ganar el drop_preparation.

---

### Propuesta D — Filtro anti-oscilación de sección (10-15 líneas, alto impacto)

En `DecisionMaker.makeDecision()`, antes de procesar `section === 'drop'`, exigir que la sección **lleve estable N frames** o **al menos T ms**:

```ts
// Pseudocódigo
const SECTION_STABILITY_MS_LATINA = 4000  // Reggaetón: 4s de drop estable
const SECTION_STABILITY_MS_OTHER  = 1500  // Techno/pop: 1.5s
const requiredStability = pattern.vibeId.includes('latin') 
  ? SECTION_STABILITY_MS_LATINA 
  : SECTION_STABILITY_MS_OTHER

if (sectionAgeMs < requiredStability) {
  // Sección "joven" — no disparar drop aún
  return 'hold'
}
```

**Impacto:** elimina las 7 detecciones esquizofrénicas en 21 segundos. Solo cuenta como drop válido el que ha estado activo ≥ 4 segundos en reggaetón.

**Riesgo:** bajo-medio. Habrá que verificar que el detector de sección expone `sectionAgeMs` o un `lastTransitionTimestamp`. Si no, hay que añadirlo.

---

### Propuesta E — Recalibrar pesos de Fuzzy en MOOD:BALANCED + vibe=fiesta-latina (sin código, perfilado)

El Fuzzy strike threshold (0.50) puede ser demasiado bajo en reggaetón donde `Conf=0.60-0.80` es constante. Posible mejora: añadir un multiplicador por vibe similar al threshold mood, o subir umbral STRIKE a 0.60 en latino.

**Impacto:** menor. Los hunt_strikes serían menos frecuentes. Empareja bien con Propuesta C (drop lock global).

**Riesgo:** alto. Tocar los umbrales del Fuzzy requiere medición fina y puede romper otros géneros. **Recomendación: no tocar Fuzzy ahora.**

---

### Propuesta F — Re-considerar DIVINE_THRESHOLD por vibe (10 líneas, no urgente)

Si el usuario *quiere* ver DIVINE en reggaetón ocasionalmente, podríamos bajar el threshold por vibe:

```ts
const DIVINE_THRESHOLD_BY_VIBE: Record<string, number> = {
  'fiesta-latina': 2.5,   // Más bajo: el groove constante no permite 4.0
  'techno-club': 4.0,     // Actual
  'pop-rock': 3.5,
}
```

**Impacto:** vería logs DIVINE en latino ~1 vez cada 2-3 minutos en climax fuertes.

**Riesgo:** medio. Cambia la doctrina "DIVINE = evento estadístico extremo". **Recomendación: no implementar a menos que el usuario lo pida explícitamente.** Es mejor que DIVINE siga siendo único y raro.

---

## 6. ORDEN DE IMPLEMENTACIÓN RECOMENDADO

| Orden | Propuesta | LOC | Impacto esperado en EPM (latino BALANCED) |
|-------|-----------|-----|-------------------------------------------|
| 1 | A — `cooldownMultiplier` aplicado al global cooldown | 2 | 11 → 5 |
| 2 | B — ANTI-FAKE-DROP vibe-aware (Z≥1.2 en latino) | 3 | 5 → 4 |
| 3 | D — Estabilidad mínima de sección antes de drop | 10 | 4 → 3 |
| 4 | C — DROP LOCK global (hunt_strike también) | 5 | 3 → 2-3 |

Después de los 4 cambios, en BALANCED + fiesta-latina deberíamos ver:
- **2-3 EPM** (objetivo cumplido)
- 1 efecto por drop REAL (no fantasma)
- Sin pares back-to-back

CALM iría a **0.5-1 EPM** (zen real). PUNK a **6-8 EPM** (fiesta sin descontrol total).

---

## 7. PREGUNTAS PENDIENTES PARA EL USUARIO

1. **¿El detector de sección expone `sectionAgeMs`?** Si no, Propuesta D requiere añadirlo en el Worker o en `SeleneMusicalPattern`.

2. **¿Quieres que DIVINE pueda dispararse en reggaetón?** Hoy no puede, por diseño estadístico. Aceptas que en este género el log "DIVINE MOMENT" simplemente no exista, o prefieres un umbral por vibe (Propuesta F).

3. **¿BALANCED es el target o quieres que CALM sea aún más calmado?** Si Propuesta A se implementa, CALM pasa a 48s entre disparos. Quizá demasiado.

4. **¿Hunt_strikes durante drops deben ceder al drop o competir?** Esto define cómo implementamos Propuesta C.

---

## 8. SELLO

**Diagnóstico objetivo:**
- 11.4 EPM en BALANCED+latino vs objetivo 3-4 EPM = **3× sobre-disparo confirmado**
- DIVINE inalcanzable en groove constante por diseño estadístico (Z<2.3 observado, threshold=4.0) — **NO es un bug**
- 7 drops detectados en 21s = sección oscilando como metralla = **causa principal**
- `cooldownMultiplier` del MoodController **no se aplica al global cooldown** = **bug latente de coherencia**
- ANTI-FAKE-DROP Z<0.5 = **threshold válido para techno, demasiado generoso para latino**
- DROP LOCK protege contra dobles disparos en mismo drop, pero **no contra detección esquizofrénica de drops**

**Recomendación arquitectónica:** Empezar por la Propuesta A (1-2 LOC, coherencia con MoodController). Validar en sesión real de reggaetón. Luego B (vibe-aware threshold). Luego D si la oscilación persiste.

**No tocar:** DIVINE_THRESHOLD, Fuzzy thresholds, mood profile values. Son partes calibradas con cuidado para otros géneros.
