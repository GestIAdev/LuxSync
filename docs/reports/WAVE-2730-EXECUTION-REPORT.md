# WAVE 2730: THE GATEKEEPER — Post-WAVE 2720 Diagnostic Fix

## STATUS: ✅ COMPLETADO — 0 errores de compilación

---

## 📋 CONTEXTO

Después de WAVE 2720 (La Ley Universal del Péndulo), las pruebas en campo revelaron un bug CRÍTICO:

> **GlitchGuaguancó se disparó 12 veces en ~60 segundos con trigger `[hunt_strike]`**
> — Radwulf: "Se ha disparado 5 o 6 veces seguidas en cosa de 6 segundos... esto puede ser un síntoma de algún problema mayor."

---

## 🔍 AUTOPSIA FORENSE

### Root Cause #1: EffectManager.trigger() NO validaba cooldown per-effect

`EffectManager.trigger()` tenía validaciones de:
- ✅ Traffic Control (efectos críticos activos)
- ✅ THE SHIELD (permisos de vibe)
- ❌ **COOLDOWN PER-EFFECT — NO EXISTÍA**

El cooldown solo se **registraba DESPUÉS** de disparar (`registerEffectFired()` en línea ~599). Esto significaba que cualquier sistema upstream que dijera "fire", el EffectManager obedecía ciegamente.

### Root Cause #2: `glitch_guaguanco` sin cooldown explícito

Sin entrada en `EFFECT_COOLDOWNS`, caía al fallback `minCooldownMs = 800ms`. Con BALANCED mood (1.5x multiplier): **1.2 segundos**. Un efecto de impacto con el mismo cooldown que un parpadeo.

Comparación de referencia:
- `salsa_fire`: 18,000ms
- `cumbia_moon`: 25,000ms
- `glitch_guaguanco`: 800ms (!) ← sin definir

### Root Cause #3: Cache stale en SeleneTitanConscious

Cuando `GLOBAL_COOLDOWN` (7s) bloquea el pipeline DNA, reutiliza `lastDreamIntegrationResult`. Este cache mantenía `approved: glitch_guaguanco` frame tras frame. El DecisionMaker recibía la misma decisión cacheada, y como el cooldown per-effect de 1.2s ya había pasado → aprobado → disparado → cooldown reset → repeat.

Flujo de la ráfaga:
```
Frame N        : DNA aprueba glitch_guaguanco → FIRE → cooldown = 1.2s
Frame N+40     : Cache reutilizado → cooldown expiró → FIRE de nuevo
Frame N+80     : Cache reutilizado → cooldown expiró → FIRE de nuevo
... x12 en 60 segundos
```

### Hallazgo adicional: `hunt_strike` es INOCENTE

`hunt_strike` es solo un string label en `config.source`. No tiene ninguna lógica de bypass. El culpable era el trío cache_stale + sin_cooldown + sin_gate.

---

## ⚡ CORRECCIONES IMPLEMENTADAS

### FIX 1: THE GATEKEEPER — Gate de cooldown en EffectManager.trigger()

**Archivo:** `electron-app/src/core/effects/EffectManager.ts`

Se añadió validación de cooldown per-effect ANTES de crear la instancia del efecto. Consulta `checkAvailability()` del ContextualEffectSelector. Si el efecto está en cooldown, se bloquea con log `[EffectManager ⏱️ GATEKEEPER]` y emite evento `effectBlocked`.

Bypass para `chronos` y `manual` (tienen su propia temporalidad).

### FIX 2: Cooldowns explícitos para efectos huérfanos

**Archivo:** `electron-app/src/core/effects/ContextualEffectSelector.ts`

Cuatro efectos "Lost Four" (WAVE 1010.5) nunca tuvieron cooldowns explícitos:

| Efecto | Antes | Después | Con BALANCED (1.5x) |
|--------|-------|---------|---------------------|
| `glitch_guaguanco` | 800ms (fallback) | 15,000ms | 22.5s |
| `machete_spark` | 800ms (fallback) | 12,000ms | 18s |
| `amazon_mist` | 800ms (fallback) | 20,000ms | 30s |
| `corazon_latino` | 800ms (fallback) | 30,000ms | 45s |

### FIX 3: Cache invalidation por cooldown

**Archivo:** `electron-app/src/core/intelligence/SeleneTitanConscious.ts`

ANTES de evaluar si debería correr el pipeline DNA, se verifica si el efecto que recomienda el cache ya está en cooldown. Si lo está → cache invalidado → decisiones frescas o silencio (que es lo correcto).

Esto complementa la invalidación por cambio de sección (WAVE 2106) con invalidación por estado de cooldown real.

---

## 📊 IMPACTO ESPERADO

### GlitchGuaguancó ráfaga: ELIMINADA
- FIX 1 (Gatekeeper) la bloquea en la puerta del EffectManager
- FIX 2 (cooldown 15s) previene que sea elegible de nuevo en <22.5s
- FIX 3 (cache invalidation) limpia la decisión stale para que el DecisionMaker no reciba basura

### Triple capa de protección
```
Capa 1: Cache invalidation (SeleneTitanConscious) — no alimentar decisiones stale
Capa 2: Per-effect cooldown (ContextualEffectSelector) — tiempos de respiro correctos  
Capa 3: THE GATEKEEPER (EffectManager) — última línea de defensa antes del trigger
```

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---------|--------|
| `electron-app/src/core/effects/EffectManager.ts` | +21 líneas: THE GATEKEEPER cooldown gate |
| `electron-app/src/core/effects/ContextualEffectSelector.ts` | +10 líneas: cooldowns explícitos para 4 efectos |
| `electron-app/src/core/intelligence/SeleneTitanConscious.ts` | +14 líneas: cache invalidation por cooldown |

**Total: ~45 líneas añadidas. 0 líneas eliminadas. 0 errores de compilación.**

---

## 🎯 ESTADO ACTUAL

- ✅ Compilación limpia
- ✅ Correcciones quirúrgicas (no se tocó lógica existente, solo se añadieron gates)
- ⏳ Pendiente: pruebas en campo para confirmar que la ráfaga no se repite
