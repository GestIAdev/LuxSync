# WAVE 4835 — DOCTRINA: L3 SUPREMACY ABSOLUTA

> **Estado:** Decisión arquitectónica. Sin código todavía.
> **Sustituye:** la política HTP per-canal de WAVE 4832 (mantenida desde entonces).
> **Inspira:** las dos auditorías previas (WAVE-4834-L3-L0-SUPREMACY-AUDIT.md y WAVE-4834-AUDIT-L0-SUPPRESSION.md).

---

## 1. LEY DE CAPAS (definitiva)

> **Cuando L3 escribe un canal en un nodo, L0 y L1 callan en ese canal de ese nodo, sin excepción y sin negociación.**

Esto NO significa "L3 apaga el fixture entero". Significa **dominación quirúrgica per-canal**:
- L3 escribe `dimmer` en `back:impact` → L0 silenciado en `back:impact.dimmer`. L0 sigue libre en `back:impact.strobe` si L3 no lo toca.
- L3 escribe `r/g/b` en `front:color` → L0 silenciado solo en esos componentes de color, no en otros canales del mismo nodo.

El **Smart Gate** que ya existe para L2/LP (WAVE 4752 — `_opaqueNodeChannels`) se replica para L3 (`_l3DominatedChannels`, ya implementado en WAVE 4829). La única diferencia con la ley actual: **se aplica SIEMPRE, independientemente de `mergeStrategy`/`blendMode`**.

---

## 2. RE-DEFINICIÓN DE `blendMode`

`blendMode` deja de ser un contrato inter-capas y pasa a ser un contrato **intra-L3**:

| `blendMode` | Antes (WAVE 4832) | Ahora (WAVE 4835) |
|-------------|-------------------|-------------------|
| `'replace'` | LTP entre L0↔L3: L3 sobreescribe L0 | LTP **entre efectos L3 simultáneos**: el último efecto en escribir gana |
| `'max'`     | HTP entre L0↔L3: max(L0,L3) | HTP **entre efectos L3 simultáneos**: max(efectoA, efectoB) |
| `'add'`     | (reservado, no usado) | Suma clamped entre efectos L3 simultáneos |

**Inter-capas (L0/L1 vs L3): siempre L3 domina.** Sin opciones, sin flags.

Ventaja: el contrato pasa a ser coherente con su nombre. "Cómo se mezclan los efectos entre sí" es lo que `blendMode` siempre debió describir. Hoy `mixBus` (global/htp) hace solapadamente parte de ese trabajo y entra en contradicción con `blendMode` (caso CumbiaMoon).

---

## 3. ¿RESPONDE EL CARÁCTER DE LOS EFECTOS?

### CumbiaMoon — "Lunas tenues en oscuridad"
- L0 silenciado en `front:impact.dimmer`, `back:impact.dimmer`, `all-movers:impact.dimmer`
- Efecto escribe `peakIntensity=0.30` en pico, `floorIntensity=0.15` en valle
- Color: blanco lunar puro
- **Resultado:** lunas a 15-30% sobre fondo negro. El brillo musical de la cumbia desaparece de esas zonas. ✅ **Brillarán como están previstas — tenues, soñadoras, lunares.**

### TidalWave — "Ola espacial con valles"
- L0 silenciado en zonas alcanzadas por la ola
- Efecto escribe `scaledIntensity` con picos a `1.0`
- **Resultado:** la cresta de la ola brilla a 100% sobre silencio total. ✅ **Tendrá la fuerza completa que el autor diseñó.**

### CorazonLatino — "Pulso rojo y dorado"
- L0 silenciado en `back:impact.dimmer` y `back:color.r/g/b`
- Efecto escribe `heartIntensity` (0→1→0.3→0.2→0.1)
- Color: interpolación rojo base ↔ rojo peak
- Blinder front en peaks: white+amber 0.4-0.6
- **Resultado:** el corazón late con contraste real (1.0 → 0.1, no 1.0 → 0.6). El blinder dorado destella sin competir con la base musical. ✅ **Pulso rojo y dorado hermoso, exactamente como el autor lo soñó.**

---

## 4. ¿QUÉ PASA CON EL "SOPORTE DE DIMMER" QUE NOS PREOCUPABA?

El miedo histórico era: *"si silencio L0 cuando L3 manda, los efectos que no pintan todas las zonas se quedan oscuros en las zonas no cubiertas."*

**Esto NO es un riesgo en la arquitectura actual** porque:

1. **L0 solo se silencia per-canal-tocado.** Si un efecto cubre solo `back`, L0 sigue libre en `front`, `floor`, `air`, etc. Las zonas no tocadas por L3 no se oscurecen.

2. **`dimmerOverride` global sigue siendo el "soporte universal".** Cualquier efecto que necesite garantizar brillo en TODAS las zonas usa el campo top-level `dimmerOverride`, que se emite como intent IMPACT zona `'all'` con LTP forzado (`selene-aether-adapter.ts:326`). `LatinaMeltdown`, `OroSolido` y `CoreMeltdown` ya lo usan.

3. **Los efectos blandos cargan su propio dimmer.** Verificado en código: `CumbiaMoon` (peak 0.30), `CorazonLatino` (envelope 0.1-1.0), `TidalWave` (0-1.0). No necesitan a L0 como soporte.

El bug histórico fue **otro problema distinto**: efectos hard que se diseñaron asumiendo que zonas no cubiertas heredarían L0. Aquellos efectos hoy usan `dimmerOverride` global o cubren todas las zonas explícitamente. La doctrina L3-Supremacy no los regresa.

---

## 5. IMPLEMENTACIÓN PROPUESTA (sin codificar todavía)

### Cambios mínimos

**`NodeArbiter.ts`** — Eliminar la rama HTP del `_applyIntent()`:

```ts
// ANTES (líneas 718-756, simplificado):
const useHtpMerge = (layer === 'effect') && intentMerge === 'HTP'
if (useHtpMerge) {
  // max(record[ch], incoming) — NO registra dominación
} else {
  // LTP + registra dominación L3
}

// DESPUÉS:
// SIEMPRE registrar dominación L3 (todos los canales L3 escritos).
// SIEMPRE LTP entre capas (L3 sobreescribe L0/L1).
// El campo intent.mergeStrategy se usa SOLO si en el futuro
// añadimos arbitraje intra-L3 (varios efectos L3 escribiendo
// el mismo canal). Hoy no es necesario porque mixBus='global'
// ya bloquea simultaneidad.
```

**`selene-aether-adapter.ts`** — `blendModeToMergeStrategy` queda como helper para el día que implementemos arbitraje intra-L3, pero su salida deja de usarse en el adapter actual. Todos los emits van con `mergeStrategy='LTP'` (o sin él, ya que LTP es default).

**Tipos (`intent-bus.ts`):** El campo `mergeStrategy` permanece — no se elimina, queda preparado para arbitraje intra-L3 futuro.

### Lo que NO cambia
- `dimmerOverride` global LTP → sigue igual.
- `mixBus='global'` (Dictador a nivel EffectManager) → sigue igual; bloquea otros L3 simultáneos.
- L2 Manual Hard Lock → sigue siendo la última palabra del operador (post-L3).
- Smart Gate L2/LP per-canal → intacto.
- Release fades, inhibit limits, Grand Master → intactos.

### Coste estimado
- ~10 LOC modificadas en `NodeArbiter._applyIntent`
- ~5 LOC en `selene-aether-adapter.ts` (eliminar pasaje de `mergeStrategy` a emits, o forzar LTP)
- 0 cambios en efectos individuales — todos siguen funcionando con sus `blendMode` actuales (que ahora describen intra-L3, no inter-capas)

---

## 6. ALTERNATIVAS DESCARTADAS Y POR QUÉ

### Opción A — Mantener HTP per-canal (statu quo WAVE 4832)
- Síntoma actual: efectos blandos no cumplen su intención.
- Veredicto: rechazada. Es la causa del problema.

### Opción B — Ducking proporcional (L0 *= 1 − L3.dimmer)
- Atractivo: comportamiento musical natural.
- Problema: introduce un nuevo modelo arbitral que NO está en ninguna otra capa. Heredamos complejidad sin claridad.
- Para CumbiaMoon (dimmer=0.2): L0 baja solo 20% → sigue aplastando.
- Veredicto: rechazada. Demasiado mágico, mal contraste para efectos tenues.

### Opción C — Flag `zoneL0Behavior` per-efecto
- Atractivo: máxima flexibilidad.
- Problema: añade superficie de configuración para resolver un caso que en realidad nadie tiene (ningún efecto existente quiere coexistir con L0).
- YAGNI: si algún día aparece, se añade. Hoy es ruido.
- Veredicto: rechazada como decisión actual; se puede añadir más adelante sin romper nada.

### Opción D (elegida) — L3 Supremacy absoluta
- Coherente con el contrato `mixBus` declarado por los autores de los efectos.
- Coherente con WAVE 4829 (que ya tenía L3 Supremacy excepto en la rama HTP).
- Sin nuevas configuraciones, menos código, menos contradicciones internas.
- Si en el futuro queremos arbitraje intra-L3 (varios efectos simultáneos escribiendo el mismo canal), `mergeStrategy` queda preservado en los tipos para resucitarse en ese contexto natural.

---

## 7. PRUEBA DE NO-REGRESIÓN

Tras aplicar el cambio, los siguientes efectos deben seguir comportándose **igual o mejor**:

| Efecto | Antes | Después | ¿Cambio visible? |
|--------|-------|---------|------------------|
| `solar_flare` | LTP, dominaba | LTP, domina | Idéntico |
| `latina_meltdown` | LTP + dimmerOverride global | LTP + dimmerOverride global | Idéntico |
| `oro_solido` | LTP, dominaba | LTP, domina | Idéntico |
| `core_meltdown` | LTP, dominaba | LTP, domina | Idéntico |
| `salsa_fire` | LTP, dominaba | LTP, domina | Idéntico |
| `tidal_wave` | LTP, dominaba | LTP, domina | Idéntico |
| `strobe_storm` | LTP, dominaba | LTP, domina | Idéntico |
| `gatling_raid` | LTP, dominaba | LTP, domina | Idéntico |
| `cumbia_moon` | HTP, L0 ganaba | LTP, L3 domina | ✅ **AHORA brilla tenue como diseño** |
| `corazon_latino` | HTP, L0 ganaba | LTP, L3 domina | ✅ **AHORA late con contraste real** |
| `tropical_pulse` | mixto | LTP, domina | Confirmar visualmente; ningún canal HTP era esencial |
| `ghost_breath` | mixto | LTP, domina | Confirmar visualmente; UV tenue es soft pero `mixBus='global'` ya pedía silencio |
| `amazon_mist` | mixto | LTP, domina | Confirmar visualmente; era HTP intencional, posible regresión a vigilar |

**Riesgo único identificado:** `amazon_mist` declara `mixBus='htp'` y se categoriza como "color background". Es el único caso que parece haber sido escrito asumiendo coexistencia real con L0. Tras el cambio, se comportará como dominador. Recomendación: probarlo primero en escena; si se siente "demasiado solo", tiene dos salidas:
1. Bajar su `dimmer` para que la base oscura sea estética (probable solución suficiente).
2. Resucitar HTP solo para `amazon_mist` con un flag explícito.

---

## 8. RESPUESTA A LAS PREGUNTAS DEL USUARIO

> **¿Si apagamos L0 las lunas brillarán como está previsto de manera muy tenue?**

✅ **Sí.** CumbiaMoon escribe `peakIntensity=0.30` y `floorIntensity=0.15`. Sobre L0 silenciado, las lunas se verán al 15-30%. Justo como su autor escribió: *"lunitas sutiles"*, *"casi apagado"*. Hoy es imposible verlas porque L0 las cubre con 0.6-0.9.

> **¿TidalWave tendrá fuerza para que la ola brille?**

✅ **Sí.** TidalWave escribe `scaledIntensity` y `isPeak ? 1.0`. Sobre L0 silenciado, la cresta llega al 100% en cada zona en su momento. El valle entre zonas será negro real (no L0 mezclado), creando el efecto de ola espacial con contraste verdadero.

> **¿Corazón Latino tendrá su pulso rojo y dorado hermoso?**

✅ **Sí.** Sobre L0 silenciado:
- `back`: pulso rojo de 0.1 → 1.0 → 0.3 → 0.2 → 0.1 (latido real)
- `all-movers`: dorado/ámbar a heartIntensity * 0.8 (movers acompañan al corazón)
- `front`: blinder dorado destellando en peaks (0.1 base → 1.0 explosión)

El contraste será visible. El efecto será emocional. El operador sentirá el latido en lugar de un tintado.

---

## 9. SELLO DE DECISIÓN

**Doctrina elegida:** Opción D — L3 Supremacy Absoluta per-canal.

**Justificación arquitectónica:**
1. Coherencia: alinea el comportamiento con la intención declarada por cada efecto (`mixBus='global'` significa silencio).
2. Simplicidad: elimina una rama condicional (HTP en L3) que generaba contradicciones.
3. Reversibilidad: el campo `mergeStrategy` queda en los tipos por si en el futuro queremos arbitraje intra-L3.
4. Bajo riesgo: solo `amazon_mist` necesita verificación visual posterior.
5. El "soporte de dimmer" histórico está cubierto por `dimmerOverride` global (LTP) y por la cobertura per-canal del Smart Gate.

**Próximo paso autorizado por el usuario** → implementar WAVE 4836 con los ~15 LOC descritos en sección 5.
