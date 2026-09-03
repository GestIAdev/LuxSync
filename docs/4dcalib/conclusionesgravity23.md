# Diagnóstico post-OMNI-GATE v2 — gravity2.md & gravityverse.md

Fecha: 2025-11-20
Motor: LiquidEngineBase.ts (OMNI-GATE v2)
Tracks analizados: "gravity" (gravity2.md) y "gravityverse" (gravityverse.md)

---

## Resumen ejecutivo

El OMNI-GATE v2 resolvió el problema de tehnominimal pero introdujo **4 problemas nuevos** en gravity/gravityverse. Hay **2 causas raíz** distintas que afectan cada track de forma diferente:

| Track | Sección | Problema | Causa raíz |
|-------|---------|----------|------------|
| gravity2 | drop/break | Snare pega en bombo solitario | Path 2 `SnareE > 0.15` demasiado bajo |
| gravityverse | verse | Snares fantasma en colas de ruido | Pending WNS sin verificar signo de RawΔ |
| gravityverse | verse | Snares en transientes de bass | Path 2 `WNS > 0.10 AND BassE > 0.40` sin mínimo de SnareE |
| gravityverse | verse | Snares reales perdidos | Dynamic flux gate demasiado alto |

---

## PROBLEMA 1 — gravity2: Snare pega durante bombo solitario del break

### Síntoma

En el drop/break de gravity, el snare onset dispara en **cada beat** del bombo four-on-the-floor, no solo en beats 2 y 4 donde debería haber snare.

### Evidencia (gravity2.md)

Onsets que disparan con WNS:0.000 (sin contenido de ruido de snare):

```
L5:   SnareE:0.536  RawΔ:0.261  Flux:0.397  WNS:0.000  BassE:0.417  [ONSET] [KICK]
L14:  SnareE:0.641  RawΔ:0.255  Flux:0.389  WNS:0.000  BassE:0.542  [ONSET] [KICK]
L22:  SnareE:0.263  RawΔ:0.228  Flux:0.320  WNS:0.000  BassE:0.412  [ONSET]
L31:  SnareE:0.161  RawΔ:0.206  Flux:0.267  WNS:0.000  BassE:0.410  [ONSET]
L44:  SnareE:0.640  RawΔ:0.186  Flux:0.398  WNS:0.000  BassE:0.502  [ONSET] [KICK]
L50:  SnareE:0.661  RawΔ:0.222  Flux:0.436  WNS:0.000  BassE:0.518  [ONSET] [KICK]
L58:  SnareE:0.636  RawΔ:0.247  Flux:0.468  WNS:0.000  BassE:0.447  [ONSET] [KICK]
L85:  SnareE:0.622  RawΔ:0.211  Flux:0.483  WNS:0.000  BassE:0.525  [ONSET] [KICK]
L96:  SnareE:0.624  RawΔ:0.249  Flux:0.509  WNS:0.000  BassE:0.468  [ONSET] [KICK]
L347: SnareE:0.546  RawΔ:0.256  Flux:0.623  WNS:0.000  BassE:0.432  [ONSET]  (breakdown)
L373: SnareE:0.585  RawΔ:0.146  Flux:0.552  WNS:0.000  BassE:0.501  [ONSET] [KICK] (breakdown)
L381: SnareE:0.609  RawΔ:0.182  Flux:0.605  WNS:0.000  BassE:0.494  [ONSET] [KICK] (breakdown)
L390: SnareE:0.621  RawΔ:0.213  Flux:0.623  WNS:0.000  BassE:0.494  [ONSET] [KICK] (breakdown)
```

**Patrón universal**: TODOS los onsets tienen `WNS:0.000`. No hay ni un solo onset en gravity2 con WNS > 0 (excepto L398 en la transición buildup con WNS:0.911).

### Diagnóstico

**Path 2 clause 1** (`Flux > 0.20 AND _snareReArmed AND SnareE > 0.15`) dispara en cada kick de gravity porque:

1. **SnareE de gravity kicks = 0.4–0.6**: El bombo de gravity tiene energía bass que **sangra (bleed) hacia la banda de snare**. El SnareE reporta 0.4–0.6 en frames de kick puro. El umbral `> 0.15` se diseñó para snares sintéticos de Anyma (SnareE 0.46+) pero **no contempla el bleed de bass**.

2. **Flux de gravity kicks = 0.30–0.65**: El transiente del bombo produce flux espectral alto (0.30–0.65) por el cambio masivo de energía bass. Esto supera fácilmente el umbral `Flux > 0.20`.

3. **WNS = 0.000 en todos**: Los kicks de gravity no tienen contenido de ruido de snare (WNS = 0). Los snares reales de gravity (Brejcha) son acústicos y tienen WNS > 0.10.

**El discriminador clave es WNS**, pero Path 2 clause 1 no lo requiere. La lógica actual permite `SnareE > 0.15` sin verificar WNS, lo que deja pasar cualquier frame con bleed de bass.

### Propuesta de fix

**Opción A (mínima, recomendada)**: Subir el umbral de SnareE en Path 2 clause 1 de `0.15` a `0.45`:

```
// Path 2 clause 1 — antes:
if (snareEnergy > 0.15) { ... }

// Path 2 clause 1 — después:
if (snareEnergy > 0.45) { ... }
```

Justificación: Gravity kicks tienen SnareE 0.4–0.6, pero los snares reales de gravity tienen SnareE 0.5–0.9. Subir a 0.45 bloquea la mayoría de kicks (SnareE 0.4–0.5) pero deja pasar snares reales. **Riesgo**: algunos kicks con SnareE 0.55–0.60 seguirían pasando. Marginal.

**Opción B (robusta)**: Añadir requisito de WNS mínimo en Path 2 clause 1:

```
// Path 2 clause 1 — antes:
if (snareEnergy > 0.15) { ... }

// Path 2 clause 1 — después:
if (snareEnergy > 0.15 && wns > 0.05) { ... }
```

Justificación: WNS > 0.05 diferencia kicks (WNS = 0) de snares acústicos (WNS > 0.10). **Riesgo**: snares sintéticos puros (tehnominimal) con WNS = 0 dejarían de pasar por clause 1. Pero tehnominimal ya pasa por Path 3 (SnareE > 0.80). **Verificar que tehnominimal siga funcionando**.

**Opción C (híbrida)**: Combinar ambas:

```
if (snareEnergy > 0.45 || (snareEnergy > 0.15 && wns > 0.05)) { ... }
```

Esto permite snares acústicos con WNS (gravity) y snares sintéticos con SnareE alto (Anyma), pero bloquea kicks con bleed.

---

## PROBLEMA 2 — gravityverse: Snares fantasma en colas de ruido (pending WNS)

### Síntoma

En el verse post-climax de gravityverse, el snare onset dispara en frames de **cola de ruido** con `RawΔ` negativo (decay, no ataque). Estos no son snares reales sino residuos de ruido sostenido.

### Evidencia (gravityverse.md)

Onsets que disparan con RawΔ NEGATIVO y SnareE ≈ 0:

```
L405: SnareE:0.086  RawΔ:-0.081  Flux:0.158  WNS:0.961  BassE:0.477  [ONSET]
L416: SnareE:0.043  RawΔ:-0.018  Flux:0.046  WNS:0.124  BassE:0.519  [ONSET]
L422: SnareE:0.034  RawΔ:-0.002  Flux:0.184  WNS:0.399  BassE:0.504  [ONSET]
L432: SnareE:0.021  RawΔ:-0.012  Flux:0.090  WNS:0.642  BassE:0.560  [ONSET]
L451: SnareE:0.006  RawΔ:-0.082  Flux:0.060  WNS:0.665  BassE:0.450  [ONSET]
L483: SnareE:0.001  RawΔ:-0.062  Flux:0.144  WNS:0.222  BassE:0.645  [ONSET] [KICK]
L498: SnareE:0.000  RawΔ:-0.132  Flux:0.148  WNS:0.178  BassE:0.831  [ONSET]
L584: SnareE:0.000  RawΔ:-0.001  Flux:0.117  WNS:0.163  BassE:0.701  [ONSET]
L600: SnareE:0.000  RawΔ:-0.046  Flux:0.145  WNS:0.319  BassE:0.729  [ONSET]
L612: SnareE:0.000  RawΔ:-0.102  Flux:0.126  WNS:0.163  BassE:0.745  [ONSET]
L704: SnareE:0.000  RawΔ:-0.057  Flux:0.140  WNS:0.217  BassE:0.762  [ONSET]
L718: SnareE:0.000  RawΔ:-0.160  Flux:0.142  WNS:0.114  BassE:0.775  [ONSET]
```

**Patrón universal**: Todos tienen `RawΔ ≤ 0` (negativo o cero). Un snare real tiene RawΔ > 0 (ataque). Estos son colas de ruido con WNS alto pero sin ataque.

### Diagnóstico

El **mecanismo de pending WNS** dispara estos onsets. La lógica actual es:

```typescript
if (this._snarePendingWns && wns > 0.05 && (snareEnergy > 0.15 || bassE > 0.40) && this._snareImpulse < 0.15) {
    // fire pending onset
}
```

El problema: **no verifica el signo de RawΔ**. Un frame con RawΔ = -0.132 (decay) puede disparar si:
- `_snarePendingWns` = true (seteado por un frame anterior)
- `wns > 0.05` (0.178 ✓)
- `bassE > 0.40` (0.831 ✓)
- `_snareImpulse < 0.15` (✓)

El `bassE > 0.40` es trivialmente cierto en gravityverse porque el verse tiene bass constante (BassE 0.5–0.9). Esto convierte el pending WNS en un disparador casi continuo durante el verse.

### Propuesta de fix

**Añadir requisito de RawΔ > 0 en la confirmación pending**:

```typescript
// Pending WNS — antes:
if (this._snarePendingWns && wns > 0.05 && (snareEnergy > 0.15 || bassE > 0.40) && this._snareImpulse < 0.15) {

// Pending WNS — después:
if (this._snarePendingWns && wns > 0.05 && rawSnareDelta > 0.02 && (snareEnergy > 0.15 || bassE > 0.40) && this._snareImpulse < 0.15) {
```

Justificación: Un snare real confirmado por WNS debe tener al menos un mínimo de ataque positivo (RawΔ > 0.02). Las colas de ruido tienen RawΔ ≤ 0. El umbral 0.02 es bajo para no bloquear snares débiles pero suficiente para filtrar colas.

**Alternativa más estricta**: Requerir `rawSnareDelta > finalSnareThreshold * 0.5` (mitad del umbral dinámico) en lugar de un valor fijo.

---

## PROBLEMA 3 — gravityverse: Snares en transientes de bass (Path 2 clause 2)

### Síntoma

En el verse/drop de gravityverse, el snare onset dispara en **transientes de bass** con `SnareE = 0.000` pero `WNS > 0.10` y `BassE > 0.40`. Estos no son snares sino bombo con contenido de ruido broadband.

### Evidencia (gravityverse.md)

Onsets con SnareE = 0.000 que disparan por Path 2 clause 2 (`WNS > 0.10 AND BassE > 0.40`):

```
L509: SnareE:0.000  RawΔ:0.268  Flux:0.360  WNS:0.391  BassE:0.755  [ONSET]
L524: SnareE:0.000  RawΔ:0.294  Flux:0.370  WNS:0.578  BassE:0.766  [ONSET]
L535: SnareE:0.000  RawΔ:0.275  Flux:0.297  WNS:0.485  BassE:0.758  [ONSET]
L548: SnareE:0.000  RawΔ:0.212  Flux:0.217  WNS:0.172  BassE:0.814  [ONSET]
L561: SnareE:0.000  RawΔ:0.126  Flux:0.186  WNS:0.406  BassE:0.770  [ONSET]
L573: SnareE:0.000  RawΔ:0.130  Flux:0.155  WNS:0.343  BassE:0.733  [ONSET]
L622: SnareE:0.000  RawΔ:0.159  Flux:0.178  WNS:0.339  BassE:0.763  [ONSET]
L637: SnareE:0.000  RawΔ:0.212  Flux:0.291  WNS:0.512  BassE:0.770  [ONSET]
L650: SnareE:0.000  RawΔ:0.389  Flux:0.440  WNS:0.325  BassE:0.793  [ONSET]
L662: SnareE:0.000  RawΔ:0.355  Flux:0.337  WNS:0.128  BassE:0.780  [ONSET]
L684: SnareE:0.000  RawΔ:0.098  Flux:0.159  WNS:0.318  BassE:0.714  [ONSET]
```

**Patrón universal**: `SnareE = 0.000` (cero absoluto, sin energía en banda de snare) pero `WNS > 0.10` y `BassE > 0.40`. El WNS viene del contenido broadband del bombo, no de un snare.

### Diagnóstico

**Path 2 clause 2** (`Flux > 0.20 AND _snareReArmed AND WNS > 0.10 AND BassE > 0.40`) dispara en transientes de bass porque:

1. **SnareE = 0.000**: No hay energía en la banda de snare. Esto debería ser un veto absoluto — si no hay energía de snare, no hay snare.

2. **WNS > 0.10**: El bombo de gravityverse tiene contenido de ruido broadband que produce WNS 0.12–0.58. El WNS no es exclusivo de snares; cualquier transiente broadband lo genera.

3. **BassE > 0.40**: Trivialmente cierto en gravityverse (BassE 0.71–0.82). Esta condición no discrimina nada en este track.

El problema fundamental: **clause 2 no requiere ningún mínimo de SnareE**. Permite disparar con SnareE = 0 si WNS y BassE son suficientes. Pero SnareE = 0 significa que no hay energía en la banda de snare — no puede haber un snare.

### Propuesta de fix

**Añadir mínimo de SnareE en Path 2 clause 2**:

```typescript
// Path 2 clause 2 — antes:
if (wns > 0.10 && bassE > 0.40) { ... }

// Path 2 clause 2 — después:
if (wns > 0.10 && bassE > 0.40 && snareEnergy > 0.05) { ... }
```

Justificación: SnareE > 0.05 requiere al menos algo de energía en la banda de snare. Los transientes de bass con SnareE = 0.000 quedan bloqueados. Los snares reales con WNS (que tienen SnareE > 0.15) siguen pasando.

**Umbral 0.05 vs 0.10**: 0.05 es conservador para no bloquear snares débiles. 0.10 sería más estricto pero podría bloquear snares reales con SnareE 0.05–0.10. Recomendado: 0.05.

---

## PROBLEMA 4 — gravityverse: Snares reales perdidos (dynamic flux gate)

### Síntoma

Algunos snares reales con SnareE alto y RawΔ alto no disparan porque el **dynamic flux gate** los bloquea.

### Evidencia (gravityverse.md)

Frames que NO disparan pero deberían:

```
L7:   SnareE:0.767  RawΔ:0.229  Flux:0.129  WNS:0.000  BassE:0.824  — NO onset
      Gate:0.092  →  RawΔ 0.229 > 0.092 ✓  pero  Flux 0.129 < dynamicFluxGate ≈ 0.136 ✗

L334: SnareE:0.013  RawΔ:0.323  Flux:0.378  WNS:0.000  BassE:0.586  — NO onset
      Gate:0.064  →  RawΔ 0.323 > 0.064 ✓  pero  SnareE 0.013 < 0.15 AND WNS 0.000 < 0.10  → Path 2 falla
```

**L7**: SnareE 0.767 (muy alto), RawΔ 0.229 (alto), pero Flux 0.129 es marginalmente menor que el dynamicFluxGate (≈0.136 calculado desde fBL 0.064). El snare se pierde por un margen de 0.007.

**L334**: RawΔ 0.323 y Flux 0.378 son altos, pero SnareE 0.013 y WNS 0.000. Ningún path de Path 2 dispara. Esto es un snare con energía desplazada fuera de la banda de snare (posible snare sintético o filtrado).

### Diagnóstico

1. **L7 — Dynamic flux gate demasiado alto**: El dynamicFluxGate se calcula como `max(0.10, 0.15 - (fBL - 0.05) * 1.0)`. Con fBL 0.064, resulta en 0.136. El snare tiene Flux 0.129, que está 0.007 por debajo. El clamp mínimo de 0.10 no ayuda aquí porque el cálculo da 0.136 > 0.10.

2. **L334 — Sin confirmación de banda**: El snare tiene RawΔ y Flux altos pero SnareE y WNS ambos ≈ 0. Ningún path de Path 2 lo confirma. Esto puede ser un snare real con energía fuera de la banda de snare (efecto de filtrado o snare sintético atípico).

### Propuesta de fix

**Para L7 (flux gate)**: Bajar el clamp mínimo del dynamicFluxGate de 0.10 a 0.08:

```typescript
// Dynamic flux gate — antes:
const dynamicFluxGate = Math.max(0.10, 0.15 - Math.max(0, fBL - 0.05) * 1.0);

// Dynamic flux gate — después:
const dynamicFluxGate = Math.max(0.08, 0.15 - Math.max(0, fBL - 0.05) * 1.0);
```

Justificación: Bajar el clamp a 0.08 permite snares con Flux 0.08–0.10 que actualmente se bloquean. El riesgo de falsos positivos es bajo porque el outer condition ya requiere `RawΔ > finalSnareThreshold` y los paths internos requieren SnareE o WNS.

**Para L334 (sin confirmación de banda)**: Este caso es más complejo. El snare tiene RawΔ 0.323 y Flux 0.378 pero sin energía en banda de snare. Opciones:
- Añadir un Path 4: `RawΔ > 0.25 && Flux > 0.35 && BassE > 0.50` (confirmación por transiente puro, sin requerir banda de snare). **Riesgo alto**: esto dispararía en transientes de bass también.
- **No fix recomendado**: L334 es un caso edge. Si SnareE y WNS son ambos ≈ 0, no hay evidencia de snare. Podría ser un transiente de bass atípico. Mejor mantenerlo bloqueado.

---

## Tabla resumen de fixes propuestos

| # | Problema | Fix | Riesgo | Prioridad |
|---|----------|-----|--------|-----------|
| 1 | gravity2: kicks pasan Path 2 | Subir SnareE de 0.15 a 0.45 en clause 1, O añadir `wns > 0.05` | Medio (verificar tehnominimal) | **Alta** |
| 2 | gravityverse: pending WNS en colas | Añadir `rawSnareDelta > 0.02` en confirmación pending | Bajo | **Alta** |
| 3 | gravityverse: bass transientes con SnareE=0 | Añadir `snareEnergy > 0.05` en clause 2 | Bajo | **Alta** |
| 4a | gravityverse: flux gate bloquea snares reales | Bajar clamp de 0.10 a 0.08 | Bajo–Medio | Media |
| 4b | gravityverse: snare sin banda (L334) | No fix (caso edge) | — | Baja |

---

## Notas para el arquitecto

1. **Fix 1 y Fix 3 interactúan**: Si se sube SnareE a 0.45 en clause 1 (Fix 1), los snares de gravityverse con SnareE 0.15–0.45 que actualmente pasan por clause 1 dejarían de pasar. Necesitan pasar por clause 2 (con el nuevo requisito SnareE > 0.05) o por Path 3. **Verificar que gravityverse no pierda snares reales**.

2. **Fix 1 Opción B (wns > 0.05)** es más limpia que Opción A (SnareE > 0.45) porque:
   - No depende del nivel absoluto de SnareE (que varía por track)
   - Usa WNS como discriminador físico (ruido de snare vs bleed de bass)
   - Pero requiere verificar que tehnominimal (WNS = 0) siga pasando por Path 3

3. **Fix 2 es el más seguro**: Requerir RawΔ > 0.02 en pending WNS no afecta ningún snare real (todos tienen RawΔ > 0.05 en el ataque). Solo bloquea colas de ruido con RawΔ negativo.

4. **Orden de aplicación recomendado**: Fix 2 → Fix 3 → Fix 1 → Fix 4a. Fix 2 y 3 son independientes y de bajo riesgo. Fix 1 requiere validación cruzada con tehnominimal. Fix 4a es el más invasivo.

5. **Métrica clave a monitorear post-fix**: WNS en onsets de gravity2. Si todos los onsets post-fix tienen WNS > 0.05, el fix funciona. Si siguen apareciendo onsets con WNS = 0, el fix no es suficiente.

---

## Datos crudos de referencia

### gravity2.md — Distribución de WNS en onsets

| WNS range | Count | Tipo |
|-----------|-------|------|
| 0.000 | 35+ | Kicks con bleed (PROBLEMA) |
| 0.911 | 1 | Snare real (buildup transition) |

### gravityverse.md — Distribución de SnareE en onsets

| SnareE range | Count | Tipo |
|--------------|-------|------|
| 0.000 | 20+ | Bass transientes con WNS (PROBLEMA 3) |
| 0.001–0.05 | 8 | Colas de ruido pending (PROBLEMA 2) |
| 0.05–0.15 | 5 | Snares débiles/borderline |
| 0.15–0.45 | 10 | Snares reales |
| 0.45–0.80 | 8 | Snares reales fuertes |
| 0.80+ | 5 | Snares reales muy fuertes (Path 3) |

### gravityverse.md — Onsets con RawΔ negativo (PROBLEMA 2)

Total: 12 onsets con RawΔ ≤ 0. Todos del mecanismo pending WNS. Ninguno es un snare real.
