# 🎯 WAVE 635 - SNIPER CALIBRATION

**STATUS**: ✅ EJECUTADO  
**FECHA**: 2026-01-16  
**OPERADOR**: PunkOpus  
**OBJETIVO**: Calibración anti-podcast + Rebalance de pesos dinámicos

---

## 📋 CONTEXTO

### 🐛 EL PROBLEMA

**User Report**:
> "Si, todas las fixtures reciben dorado intenso... cada X segundos en un podcast de TERTULIA POLITICA! No, no se pueden bajar tanto los gates! Es absurdo jajajajaja: 'La inflacion bla bla bla....' FLASHAZO !!!"

**Root Cause Analysis**:
WAVE 630 bajó los gates de DecisionMaker para eliminar falsos negativos (drops reales sin flash), pero creó el problema inverso: **falsos positivos masivos**. El sistema dispara Solar Flare en contextos sin energía física (podcasts, tertulias, silencios) porque solo evalúa métricas armónicas/rítmicas sin verificar energía real del audio.

**Ejemplo Real**:
```
[AUDIO] Tertulia política hablando de inflación
  → smoothedEnergy: 0.15 (muy bajo, solo voz humana)
  → Beauty: 0.70 (voz humana tiene armónicos bonitos)
  → Urgency: 0.35 (ritmo del habla)
  → Consonance: 0.95 (voz es consonante)
  
WAVE 630 (ANTES):
  → strikeScore: (0.70*0.2) + (0.35*0.6) + (0.95*0.2) = 0.14+0.21+0.19 = 0.54
  → Threshold fiesta-latina: 0.55
  → NO DISPARA (apenas)
  
PERO si el presentador sube el tono:
  → Urgency: 0.45
  → strikeScore: 0.14+0.27+0.19 = 0.60 > 0.55
  → ¡SOLAR FLARE EN PODCAST! 🤦
```

### 🎯 DIRECTIVA TÁCTICA

**User Command**:
```
🎯 DIRECTIVA TÁCTICA: WAVE 635 - SNIPER CALIBRATION

ANÁLISIS DE DATOS:
- Ruido/Podcast: Genera falsos positivos por falta de filtro de energía.
- Reguetón Plano: Score ~0.60.
- Drop Real: Score ~0.75.

OBJETIVOS DE CALIBRACIÓN:

1. 🛡️ THE ENERGY VETO (Anti-Podcast)
   Si energía física < 0.40 → SE IGNORA todo lo demás

2. ⚖️ AJUSTE DE PESOS (Nerf Consonance)
   Consonance 20% → 10% (deja de regalar puntos)
   Urgency: 60%, Beauty: 30%, Consonance: 10%

3. 📏 NUEVO UMBRAL (The Sweet Spot)
   Threshold: 0.55 → 0.70
   Latino Boost: 0.20 → 0.10 (más sutil)
```

---

## 🔧 IMPLEMENTACIÓN

### 1️⃣ ENERGY VETO - DecisionMaker.ts

**Archivo**: `src/core/intelligence/think/DecisionMaker.ts`  
**Función**: `generateStrikeDecision()`  
**Líneas**: 246-252

**IMPLEMENTACIÓN**:
```typescript
// 🛡️ WAVE 635.1: THE ENERGY VETO (Anti-Podcast Shield)
// Si la energía física del audio es baja, SE RECHAZA el strike
// Esto elimina disparos en silencios, intros suaves, podcasts, tertulias políticas
const hasPhysicalEnergy = pattern.smoothedEnergy >= 0.40

if (!hasPhysicalEnergy) {
  output.debugInfo.reasoning = `ENERGY VETO: smoothedEnergy=${pattern.smoothedEnergy.toFixed(2)} < 0.40 (podcast/silence detected)`
  console.log(`[DecisionMaker 🛡️] ${output.debugInfo.reasoning}`)
  return output
}
```

**QUÉ HACE**:
- Verifica `pattern.smoothedEnergy` (rolling 2s de RMS normalizado)
- Si < 0.40 → RECHAZO TOTAL (no evalúa nada más)
- Logging claro del rechazo para forensics

**POR QUÉ FUNCIONA**:
- Podcast/tertulia: energy ~0.10-0.25 (solo voz)
- Música suave: energy ~0.30-0.50 (instrumentos reales)
- Drop reguetón: energy ~0.60-0.90 (bass + percusión)

### 2️⃣ REBALANCE DE PESOS - HuntEngine.ts

**Archivo**: `src/core/intelligence/think/HuntEngine.ts`  
**Constante**: `VIBE_STRIKE_MATRIX`  
**Líneas**: 589-652

**CAMBIOS EN PESOS**:

| Vibe          | Beauty (antes→después) | Urgency (antes→después) | Consonance (antes→después) |
|---------------|------------------------|-------------------------|----------------------------|
| fiesta-latina | 0.2 → **0.3**          | 0.6 (sin cambio)        | 0.2 → **0.1**              |
| techno-club   | 0.1 → **0.2**          | 0.8 → **0.7**           | 0.1 (sin cambio)           |
| pop-rock      | 0.4 (sin cambio)       | 0.4 → **0.5**           | 0.2 → **0.1**              |
| chill-lounge  | 0.7 (sin cambio)       | 0.1 → **0.2**           | 0.2 → **0.1**              |
| idle          | 0.4 (sin cambio)       | 0.4 → **0.5**           | 0.2 → **0.1**              |

**RATIONALE**:
- **Consonance bajado uniformemente**: Antes regalaba puntos porque siempre está ~0.9-1.0 en cualquier música
- **Urgency rebalanceado**: Subido en vibes donde importa (pop-rock, chill-lounge), bajado en techno
- **Beauty ajustado**: Subido en rhythm-driven genres para compensar consonance

**EJEMPLO MATEMÁTICO** (fiesta-latina):
```
BEFORE WAVE 635:
  Beauty=0.60 * 0.2 = 0.12
  Urgency=0.65 * 0.6 = 0.39
  Consonance=0.95 * 0.2 = 0.19
  strikeScore = 0.70

AFTER WAVE 635:
  Beauty=0.60 * 0.3 = 0.18  (+0.06)
  Urgency=0.65 * 0.6 = 0.39  (igual)
  Consonance=0.95 * 0.1 = 0.095  (-0.095)
  strikeScore = 0.665  (-0.035)
  
→ Consonance dejó de inflar, Beauty compensó parcialmente
→ Net effect: Scores más bajos y honestos
```

### 3️⃣ THRESHOLD AJUSTE - HuntEngine.ts

**CAMBIOS EN THRESHOLDS**:

| Vibe          | Threshold (antes→después) | Urgency Boost (antes→después) |
|---------------|---------------------------|-------------------------------|
| fiesta-latina | 0.55 → **0.70**           | 0.2 → **0.1**                 |
| techno-club   | 0.60 → **0.70**           | 0.2 → **0.1**                 |
| pop-rock      | 0.65 → **0.70**           | 0.0 (sin cambio)              |
| chill-lounge  | 0.70 → **0.75**           | 0.0 (sin cambio)              |
| idle          | 0.70 → **0.75**           | 0.0 (sin cambio)              |

**OBJETIVO**:
- Reguetón plano (score ~0.60): **NO DISPARA** (< 0.70)
- Drop real (score ~0.75): **DISPARA** (≥ 0.70)
- Podcast (score ~0.50-0.60): **VETADO por energy** antes de llegar aquí

**URGENCY BOOST**:
- Reducido de 0.2 → 0.1 para vibes latinos/techno
- Antes: urgency 0.38 → 0.58 (demasiado agresivo)
- Ahora: urgency 0.38 → 0.48 (más sutil, natural)

### 4️⃣ TIPO AÑADIDO - types.ts

**Archivo**: `src/core/intelligence/types.ts`  
**Interface**: `SeleneMusicalPattern`  
**Líneas**: 227-232

**CAMBIO**:
```typescript
// ═══════════════════════════════════════════════════════════════════════
// ENERGÍA FÍSICA (WAVE 635)
// ═══════════════════════════════════════════════════════════════════════

/** Energía RMS suavizada (rolling 2s) - Para detectar podcasts/silencios */
smoothedEnergy: number
```

**PROPAGACIÓN**:
- `MusicalPatternSensor.ts`: Añadido `smoothedEnergy: state.smoothedEnergy` en línea 116
- Flujo: `TitanStabilizedState` → `MusicalPattern` → `DecisionInputs` → `DecisionMaker`

---

## 📊 MATRIZ FINAL DE PESOS

### Fiesta-Latina (Reggaeton/Cumbia)
```
beautyWeight: 0.3      ← +0.1 (compensar nerf consonance)
urgencyWeight: 0.6     ← Mantenido (ritmo es rey)
consonanceWeight: 0.1  ← -0.1 (nerf general)
threshold: 0.70        ← +0.15 (anti-podcast)
urgencyBoost: 0.1      ← -0.1 (más sutil)
```

### Techno-Club (Techno/House)
```
beautyWeight: 0.2      ← +0.1
urgencyWeight: 0.7     ← -0.1 (rebalance)
consonanceWeight: 0.1  ← Mantenido
threshold: 0.70        ← +0.10
urgencyBoost: 0.1      ← -0.1
```

### Pop-Rock (Balanced)
```
beautyWeight: 0.4      ← Mantenido
urgencyWeight: 0.5     ← +0.1
consonanceWeight: 0.1  ← -0.1
threshold: 0.70        ← +0.05
urgencyBoost: 0.0      ← Mantenido
```

### Chill-Lounge (Harmony-driven)
```
beautyWeight: 0.7      ← Mantenido
urgencyWeight: 0.2     ← +0.1
consonanceWeight: 0.1  ← -0.1
threshold: 0.75        ← +0.05
urgencyBoost: 0.0      ← Mantenido
```

### Idle (Default)
```
beautyWeight: 0.4      ← Mantenido
urgencyWeight: 0.5     ← +0.1
consonanceWeight: 0.1  ← -0.1
threshold: 0.75        ← +0.05
urgencyBoost: 0.0      ← Mantenido
```

---

## 🧪 CASOS DE PRUEBA ESPERADOS

### ✅ CASO 1: Podcast de Tertulia Política
```
INPUT:
  smoothedEnergy: 0.15 (solo voz)
  beauty: 0.70 (armónicos vocales)
  urgency: 0.40 (ritmo de habla)
  consonance: 0.95

WAVE 630 (ANTES):
  strikeScore = (0.70*0.2) + (0.40*0.6) + (0.95*0.2) = 0.57
  threshold = 0.55
  → DISPARA ❌ (falso positivo)

WAVE 635 (AHORA):
  1. Energy check: 0.15 < 0.40 → VETO ✅
  2. No evalúa pesos ni threshold
  → NO DISPARA ✅
```

### ✅ CASO 2: Reguetón Plano (Verso sin hook)
```
INPUT:
  smoothedEnergy: 0.55 (bass presente)
  beauty: 0.50
  urgency: 0.60
  consonance: 0.90
  vibe: fiesta-latina

WAVE 630 (ANTES):
  strikeScore = (0.50*0.2) + (0.60*0.6) + (0.90*0.2) = 0.64
  threshold = 0.55
  → DISPARA ❌ (no es momento épico)

WAVE 635 (AHORA):
  1. Energy check: 0.55 > 0.40 → PASS
  2. strikeScore = (0.50*0.3) + (0.60*0.6) + (0.90*0.1) = 0.60
  3. threshold = 0.70
  → NO DISPARA ✅ (correcto, no es drop)
```

### ✅ CASO 3: Drop Real de Reguetón
```
INPUT:
  smoothedEnergy: 0.85 (bass + percusión fuerte)
  beauty: 0.75 (sincopación rica)
  urgency: 0.80 (drop energy)
  consonance: 0.95
  vibe: fiesta-latina

WAVE 630 (ANTES):
  strikeScore = (0.75*0.2) + (0.80*0.6) + (0.95*0.2) = 0.82
  threshold = 0.55
  → DISPARA ✅

WAVE 635 (AHORA):
  1. Energy check: 0.85 > 0.40 → PASS
  2. strikeScore = (0.75*0.3) + (0.80*0.6) + (0.95*0.1) = 0.80
  3. threshold = 0.70
  → DISPARA ✅ (correcto, es drop épico)
```

### ✅ CASO 4: Intro Suave (Chill-Lounge)
```
INPUT:
  smoothedEnergy: 0.35 (ambient pads)
  beauty: 0.85 (armonía compleja)
  urgency: 0.20
  consonance: 0.90
  vibe: chill-lounge

WAVE 630 (ANTES):
  strikeScore = (0.85*0.7) + (0.20*0.1) + (0.90*0.2) = 0.79
  threshold = 0.70
  → DISPARA ❌ (es intro suave, no momento épico)

WAVE 635 (AHORA):
  1. Energy check: 0.35 < 0.40 → VETO ✅
  → NO DISPARA ✅ (correcto, no tiene energía física)
```

---

## 📈 IMPACTO ESPERADO

### Reducción de Falsos Positivos
- **Podcasts/Tertulias**: 100% eliminados (energy veto)
- **Intros suaves**: 90% eliminados (energy veto + threshold alto)
- **Versos planos**: 70% eliminados (threshold 0.70 más estricto)

### Preservación de Verdaderos Positivos
- **Drops reales**: 95% mantenidos (energy alta + score alto)
- **Chorus épicos**: 90% mantenidos (energy + urgency + beauty)
- **Builds intensos**: 85% mantenidos (threshold 0.70 alcanzable con energía)

### Rate de Disparo Estimado
```
BEFORE WAVE 635:
  fiesta-latina: ~6 strikes/minuto (con falsos positivos)
  
AFTER WAVE 635:
  fiesta-latina: ~2-3 strikes/minuto (solo momentos épicos)
  
  Cooldown: 2 segundos (120 frames @ 60fps)
  → Máximo teórico: 30 strikes/minuto
  → Real: 2-3 strikes/minuto (selectividad ~10%)
```

---

## 🔬 FORENSICS & DEBUGGING

### Logs del Energy Veto
```typescript
[DecisionMaker 🛡️] ENERGY VETO: smoothedEnergy=0.15 < 0.40 (podcast/silence detected)
```

### Logs de Strike Aprobado
```typescript
[DecisionMaker 🎯] SOLAR FLARE QUEUED: intensity=0.95 | urgency=0.80 tension=0.75 energy=0.85
```

### Logs del Hunt Engine
```typescript
[fiesta-latina] STRIKE! Score=0.80 (threshold=0.70) | Beauty=0.75×0.3 Urgency=0.80×0.6 Cons=0.95×0.1
```

### Logs de Rechazo
```typescript
[fiesta-latina] Score=0.65 < 0.70 (need +0.05) | Beauty=0.60 Urgency=0.70 Cons=0.90
```

---

## ✅ VALIDACIÓN

### Compilación TypeScript
```bash
npx tsc --noEmit
# Result: 3 pre-existing errors (SimulateView, StageViewDual)
# All WAVE 635 files: CLEAN ✅
```

### Archivos Modificados
1. ✅ `src/core/intelligence/types.ts` - Añadido `smoothedEnergy` a `SeleneMusicalPattern`
2. ✅ `src/core/intelligence/sense/MusicalPatternSensor.ts` - Propagado `smoothedEnergy` desde state
3. ✅ `src/core/intelligence/think/DecisionMaker.ts` - Implementado Energy Veto
4. ✅ `src/core/intelligence/think/HuntEngine.ts` - Rebalance de pesos y thresholds

### Archivos Sin Errores
- ✅ DecisionMaker.ts: No errors
- ✅ HuntEngine.ts: No errors
- ✅ types.ts: No errors
- ✅ MusicalPatternSensor.ts: No errors

---

## 🎯 PRÓXIMOS PASOS

### Testing con Cumbiaton
1. Cargar `cumbiaton.mp3` en simulador
2. Verificar que NO dispare en versos planos (score ~0.60-0.65)
3. Verificar que SÍ dispare en chorus/drops (score ~0.75-0.85)
4. Confirmar rate de ~2-3 strikes/minuto

### Testing con Podcast
1. Cargar cualquier podcast de tertulia/conversación
2. Verificar logs: `[DecisionMaker 🛡️] ENERGY VETO`
3. Confirmar 0 disparos durante todo el podcast

### Fine-Tuning (si necesario)
- Si dispara muy poco: Bajar threshold 0.70 → 0.65
- Si dispara mucho: Subir threshold 0.70 → 0.75
- Si rechaza drops: Bajar energy veto 0.40 → 0.35

---

## 📝 LECCIONES APRENDIDAS

### Anti-Patrón: Bajar Gates Sin Energy Check
WAVE 630 bajó `urgency > 0.75` a `confidence > 0.50` pensando solo en falsos negativos. Esto creó un monstruo de falsos positivos porque no había filtro de energía física.

### Patrón Correcto: Defense in Depth
```
Layer 1: Energy Veto (physical audio check)
Layer 2: Weighted Scoring (musical context)
Layer 3: Threshold Gate (quality bar)
```

### Consonance Es Un Mentiroso
Consonance tiende a estar siempre ~0.9-1.0 en cualquier música (incluso podcasts). Darle peso >10% es regalar puntos gratis. La música disonante es rara y la disonancia estable aún más.

### Urgency Boost Debe Ser Sutil
Latino boost de 0.2 (urgency 0.38 → 0.58) era demasiado artificial. Con 0.1 (0.38 → 0.48) es más natural y aún da ventaja a géneros rhythm-driven.

---

**FIN WAVE 635** 🎯
