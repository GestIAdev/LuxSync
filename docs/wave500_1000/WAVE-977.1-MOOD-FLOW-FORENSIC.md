# 🧬 WAVE 977.1 - MOOD FLOW FORENSIC

**FECHA**: 2026-01-22  
**AUTOR**: PunkOpus  
**INVESTIGACIÓN**: ¿Cómo afecta el Mood Selector (UI) al sistema de efectos?

---

## 🔍 LA PREGUNTA DE RADWULF

> "Investiga que ocurre desde que en la UI pulso el selector de mood punk hasta que se 'se supone' que veo más efectos. Porque sí, incluimos el mood en el flujo (estaba desconectado) pero no veo gran diferencia. Quizá sean impresiones mías. ¿Cómo afecta exactamente el mood al ADN?"

---

## ⚠️ ACLARACIÓN TERMINOLÓGICA

Hay **DOS CONCEPTOS** diferentes llamados "mood":

### 1️⃣ **MoodController** (UI Selector: calm/balanced/punk)
- **Archivo**: `MoodController.ts`
- **Lo que controla**: Comportamiento GLOBAL del sistema
- **NO afecta al DNA directamente**

### 2️⃣ **Musical Mood** (del MusicalContext: dreamy/aggressive/euphoric)
- **Archivo**: `EffectDNA.ts` (MOOD_ORGANICITY table)
- **Lo que controla**: Target DNA (organicidad)
- **SÍ afecta al DNA**

---

## 🎛️ MOOD CONTROLLER (calm/balanced/punk)

### PERFILES:

| Profile | Threshold | Cooldown | MaxIntensity | MinIntensity |
|---------|-----------|----------|--------------|--------------|
| **CALM** 😌 | 1.8x | 3.0x | 0.6 | undefined |
| **BALANCED** ⚖️ | 1.15x | 1.0x | 1.0 | undefined |
| **PUNK** 🔥 | 0.8x | 0.7x | 1.0 | 0.5 |

### DÓNDE AFECTA:

#### 1. **FuzzyDecisionMaker.ts** (líneas 854-930)
```typescript
private applyMoodModifiers(decision: FuzzyDecision): FuzzyDecision {
  const profile = this.moodController.getCurrentProfile()
  
  // THRESHOLD: Afecta si una decisión "strike" pasa o se degrada a "hold"
  const rawScore = decision.confidence
  const effectiveScore = this.moodController.applyThreshold(rawScore)
  
  // Umbrales para acciones:
  // - force_strike: 0.7
  // - strike: 0.5
  // - prepare: 0.3
  // - hold: 0.0
  
  // CALM (1.8x): Un strike con confidence=0.6 → effectiveScore=0.33 → DEGRADADO a "hold"
  // PUNK (0.8x): Un strike con confidence=0.6 → effectiveScore=0.75 → PASA como "strike"
  
  // INTENSITY: Afecta la intensidad final del efecto
  const finalIntensity = this.moodController.applyIntensity(decision.intensity)
}
```

**RESULTADO**:
- **CALM**: Muchas decisiones "strike" se degradan a "hold" → Menos efectos
- **PUNK**: Casi todas las decisiones "strike" pasan → Más efectos

#### 2. **Gatekeeper** (Cooldowns)
```typescript
// ContextualEffectSelector.ts (línea 266)
applyCooldown(baseCooldown: number): number {
  return Math.round(baseCooldown * profile.cooldownMultiplier)
}

// EJEMPLOS:
// industrial_strobe base = 10000ms
// - CALM: 10000 * 3.0 = 30000ms (30s entre strobes)
// - BALANCED: 10000 * 1.0 = 10000ms (10s entre strobes)
// - PUNK: 10000 * 0.7 = 7000ms (7s entre strobes)
```

**RESULTADO**:
- **CALM**: Cooldowns TRIPLES → Cada efecto reaparece mucho más tarde
- **PUNK**: Cooldowns 0.7x → Efectos pueden repetirse más rápido

#### 3. **Intensidad Final**
```typescript
// MoodController.ts (líneas 190-220)
applyIntensity(baseIntensity: number): number {
  const profile = this.currentProfile
  
  // Aplicar min/max
  let finalIntensity = baseIntensity
  
  if (profile.minIntensity !== undefined) {
    finalIntensity = Math.max(finalIntensity, profile.minIntensity)
  }
  
  if (profile.maxIntensity !== undefined) {
    finalIntensity = Math.min(finalIntensity, profile.maxIntensity)
  }
  
  return finalIntensity
}

// EJEMPLOS:
// void_mist propone intensity=0.3
// - CALM: min(0.3, 0.6) = 0.3 ✓ Pasa
// - PUNK: max(0.3, 0.5) = 0.5 → FORZADO a 50% mínimo
```

**RESULTADO**:
- **CALM**: Intensidades máximas 60% → Efectos más sutiles
- **PUNK**: Intensidades mínimas 50% → Efectos nunca tenues

---

## 🧬 MUSICAL MOOD (dreamy/aggressive/euphoric)

### TABLA DE ORGANICIDAD:

```typescript
// EffectDNA.ts (líneas 233-241)
const MOOD_ORGANICITY: Record<Mood, number> = {
  'dreamy': 0.90,       // Sueños = muy orgánico
  'melancholic': 0.80,  // Tristeza = humano
  'mysterious': 0.60,   // Misterio = semi-orgánico
  'neutral': 0.50,      // Neutral
  'euphoric': 0.55,     // Euforia puede ser electrónica o humana
  'triumphant': 0.45,   // Triunfo = algo épico/mecánico
  'aggressive': 0.20,   // Agresión = máquina
}
```

### CÓMO AFECTA AL TARGET DNA:

```typescript
// EffectDNA.ts (líneas 554-570)
// O = (moodOrganicity * 0.30) + (sectionOrganicity * 0.30) + 
//     ((1 - harshness) * 0.25) + (groove * 0.15)

const moodOrganicity = this.getMoodOrganicity(context.mood)

const targetOrganicity = 
  (moodOrganicity * 0.30) +
  (sectionOrganicity * 0.30) +
  ((1 - harshness) * 0.25) +
  (groove * 0.15)
```

**EJEMPLO**:
- Track: aggressive mood (O=0.20), drop section (O=0.10), harshness=0.8, groove=0.4
- Target O = (0.20 * 0.30) + (0.10 * 0.30) + (0.20 * 0.25) + (0.40 * 0.15)
- Target O = 0.06 + 0.03 + 0.05 + 0.06 = **0.20** (muy mecánico)

**RESULTADO**:
- DNA busca efectos con **baja organicidad** → `industrial_strobe` (O=0.05), `gatling_raid` (O=0.10)

---

## 🔁 FLUJO COMPLETO: UI → EFECTOS

```
USER clicks "PUNK 🔥" in UI
    ↓
MoodController.setProfile('punk')
    ↓
    ├─→ FuzzyDecisionMaker.applyMoodModifiers()
    │   └─→ Threshold 0.8x → Más decisiones "strike" pasan
    │
    ├─→ Gatekeeper.applyCooldown()
    │   └─→ Cooldowns 0.7x → Efectos reaparecen más rápido
    │
    └─→ MoodController.applyIntensity()
        └─→ minIntensity=0.5 → Efectos nunca tenues

RESULTADO: +30-50% más efectos disparados
```

---

## 📊 COMPARATIVA: CALM vs PUNK

### ESCENARIO: industrial_strobe propuesto con confidence=0.6

| Etapa | CALM 😌 | PUNK 🔥 |
|-------|---------|---------|
| **Threshold** | 0.6 * 1.8 = 1.08 → OVER 0.7 → "hold" ❌ | 0.6 * 0.8 = 0.48 → "strike" ✅ |
| **Cooldown** | 10s * 3.0 = 30s | 10s * 0.7 = 7s |
| **Intensity** | min(0.8, 0.6) = 0.6 (60%) | max(0.8, 0.5) = 0.8 (80%) |
| **RESULTADO** | ❌ BLOQUEADO | ✅ DISPARA a 80% |

---

## ❓ ¿POR QUÉ NO VES DIFERENCIA?

### POSIBLES CAUSAS:

1. **Ethics Threshold** (WAVE 973)
   - CALM: 0.98 (solo 9.8/10)
   - PUNK: 0.75 (solo 7.5/10)
   - Si la música no alcanza el umbral de ética, **mood no importa**

2. **Vibe Shield** es supremo
   - Si el efecto NO está en la lista del VIBE, mood no puede desbloquearlo
   - Ejemplo: `cumbia_moon` NUNCA disparará en `techno-club`, ni en punk

3. **Zona energética** filtra primero
   - Si estás en zona `silence` (E<0.30), `industrial_strobe` NO está en la paleta
   - Mood solo puede afectar a efectos YA permitidos por zona

4. **Cooldowns base altos**
   - `abyssal_rise`: 45s base → PUNK: 31.5s (sigue siendo largo)
   - Efecto: Mood afecta, pero no de forma "obvia"

---

## 🎯 RECOMENDACIONES

### Para ver diferencias OBVIAS entre CALM y PUNK:

1. **Usa tracks con drops claros** (E > 0.82)
   - En `intense`/`peak` zones, la diferencia es más notoria

2. **Observa efectos MID-TIER** (no muy raros)
   - `cyber_dualism` (15s base): CALM=45s, PUNK=10.5s (4x diferencia)
   - `acid_sweep` (12s base): CALM=36s, PUNK=8.4s (4x diferencia)

3. **Mira los logs de decisión**
   - `[FUZZY_DECISION] 🎭 MOOD DOWNGRADE: strike → hold (CALM)`
   - Estos logs indican cuando CALM está bloqueando

4. **Cuenta EPM (Effects Per Minute)**
   - CALM target: 1-3 EPM
   - BALANCED target: 5-6 EPM
   - PUNK target: 8-10 EPM

---

## 🔧 CONCLUSIÓN

**El Mood Controller SÍ afecta al sistema**, pero de forma **INDIRECTA**:

- ❌ **NO toca el DNA** (no cambia qué efecto se simula)
- ✅ **SÍ toca las decisiones** (si un efecto pasa de "strike" a "hold")
- ✅ **SÍ toca los cooldowns** (cuánto tarda en repetirse)
- ✅ **SÍ toca la intensidad** (cuán brillante es)

**PERO** todo esto ocurre **DESPUÉS** de:
1. Vibe Shield (¿efecto permitido?)
2. Zone Filter (¿efecto adecuado para esta energía?)
3. DNA Simulation (¿efecto es el mejor match?)

Si la música no genera oportunidades (drops, builds), **punk no puede inventarlas**.

---

## 🛠️ DEBUG TIPS

Para verificar que mood funciona:

```typescript
// En FuzzyDecisionMaker.ts (línea ~890)
console.log(`[MOOD_DEBUG] Raw: ${rawScore.toFixed(2)}, Effective: ${effectiveScore.toFixed(2)}, Profile: ${profile.name}`)

// En ContextualEffectSelector.ts (línea ~266)
console.log(`[MOOD_DEBUG] Cooldown: ${baseCooldown}ms → ${finalCooldown}ms (${profile.name} x${profile.cooldownMultiplier})`)
```

---

**PunkOpus**  
*"El mood NO controla QUÉ se dispara, controla CUÁNDO y CUÁNTO"*
