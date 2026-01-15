# 📋 WAVE 290: AUDITORÍA DIAGNÓSTICA - FIESTA LATINA
## Sensitivity & Roles Tuning Report

**Fecha:** 2026-01-02  
**Auditor:** PunkOpus  
**Solicitante:** Comandante Radwulf  
**Estado:** ✅ **IMPLEMENTADO Y COMPILADO**  

---

## 🎯 CAMBIOS IMPLEMENTADOS

### 1. ✅ MOVER_LERP → 0.04 (Caderas de Cumbia)
**Archivo:** `LatinoStereoPhysics.ts`
```typescript
private static readonly MOVER_LERP = 0.04; // Era 0.08, ahora movimiento líquido
```
**Efecto:** Movers tardan ~950ms en alcanzar 90% del target → FLUIDO, no parpadeo.

### 2. ✅ Back PARs → Bass Gated (No Voces)
**Archivo:** `LatinoStereoPhysics.ts`
```typescript
private static readonly BACK_PAR_BASS_GATE = 0.45;  // Solo golpes fuertes
private static readonly BACK_PAR_DECAY = 0.12;       // Decay rápido
```
**Efecto:** Solo responde a bombo/bajo, ignora voces en mids.

### 3. ✅ White Puncture en DROP
**Archivos:** `LatinoStereoPhysics.ts`, `SeleneLux.ts`, `TitanEngine.ts`

**Flujo Implementado:**
```
TitanEngine (context.section.type)
    ↓
SeleneLux (vibeContext.section)
    ↓
LatinoStereoPhysics (metrics.sectionType)
    ↓
White Puncture State Machine
```

**Lógica:**
- Frame 1-2: DIMMER DIP al 30% (oscurecer antes del impacto)
- Frame 3: WHITE FLASH (R:255, G:255, B:255, dimmer 100%)
- Frame 4+: Retorno normal

---

## 🚨 SÍNTOMAS REPORTADOS

| Síntoma | Descripción | Prioridad |
|---------|-------------|-----------|
| **Movers Parpadean** | Parpadeo excesivo, falta histéresis | 🔴 ALTA |
| **Back PARs siguen voces** | Reaccionan demasiado a Mids | 🔴 ALTA |
| **Pulso Aceleradísimo** | Sensación de "nerviosismo" general | 🟡 MEDIA |
| **Solar Flare Inútil** | Con dimmers al 100%, el boost no aporta | 🟢 INFO |

---

## 🔍 AUDITORÍA TÉCNICA

### 1. SMOOTHING DE MOVERS (`MOVER_LERP`)

**Archivo:** `LatinoStereoPhysics.ts` línea 65

```typescript
private static readonly MOVER_LERP = 0.08; // 🔧 Más suave para cintura latina
private static readonly MOVER_GATE = 0.15; // 🔧 Gate: evita baile fantasma
```

**ANÁLISIS:**
| Parámetro | Valor Actual | Valor Documentado (WAVE 288) | Evaluación |
|-----------|--------------|------------------------------|------------|
| `MOVER_LERP` | 0.08 (8%) | 0.05 (5%) en docs | ⚠️ MÁS RÁPIDO que diseño |
| `MOVER_GATE` | 0.15 | 0.15 | ✅ OK |

**PROBLEMA DETECTADO:**
- LERP de 0.08 significa que en cada frame el mover se mueve 8% hacia el target
- A 60fps, alcanza 90% del target en ~28 frames (~460ms)
- Para música latina con mucha percusión constante, esto es DEMASIADO RÁPIDO
- El resultado: **parpadeo estroboscópico** cuando las voces (mid) varían rápido

**RECOMENDACIÓN:**
```typescript
private static readonly MOVER_LERP = 0.04; // 4% - "Caderas de cumbia"
```
Con 0.04: alcanza 90% en ~57 frames (~950ms) → movimiento LÍQUIDO

---

### 2. FUENTE DE AUDIO PARA BACK PARs

**Archivo:** `LatinoStereoPhysics.ts` líneas 191-196

```typescript
// BACK PARs: MID^1.5 con Decay
const targetBackPar = Math.pow(mid, 1.5);
if (targetBackPar > this.currentBackParIntensity) {
  this.currentBackParIntensity = targetBackPar;
} else {
  this.currentBackParIntensity = this.currentBackParIntensity * (1 - LatinoStereoPhysics.DECAY_RATE * 2);
}
```

**PROBLEMA DETECTADO:**
- `mid^1.5` amplifica TODAS las frecuencias medias
- En música latina, las voces están EN LOS MIDS (200Hz-2kHz)
- El cantante mueve los Back PARs → **efecto karaoke no deseado**
- El usuario quiere que los Movers sigan la voz, NO los Back PARs

**ANÁLISIS DE FRECUENCIAS:**

| Banda | Frecuencia | Qué Contiene (Latino) | Debería Mover |
|-------|------------|----------------------|---------------|
| Sub-Bass | 20-80Hz | Sub-bass 808 | Front PARs |
| Bass | 80-200Hz | **Bombo + Bajo** | **Back PARs** ✅ |
| Low-Mid | 200-500Hz | Tumbao, Conga | Híbrido |
| Mid | 500Hz-2kHz | **VOCES, Trompetas** | **Movers** |
| Treble | 2-8kHz | Hi-hats, Güiro | Nada (ruido) |

**EL PROBLEMA:** 
Los Back PARs escuchan `mid` que incluye las voces.
Deberían escuchar `bass` (bombo, bajo melódico, tumbao).

**RECOMENDACIÓN:** Cambiar fuente de Back PARs:

```typescript
// BACK PARs: WAVE 290 - BASS con Gate (Solo golpes, no sustenido)
// Evita que las voces muevan los back pars
const BACK_PAR_GATE = 0.45;  // Solo responde a bass > 45%
const BACK_PAR_DECAY = 0.12; // Decay más rápido que DECAY_RATE

const bassGated = bass > BACK_PAR_GATE ? Math.pow(bass - BACK_PAR_GATE, 1.3) * 2 : 0;
if (bassGated > this.currentBackParIntensity) {
  this.currentBackParIntensity = Math.min(1.0, bassGated);
} else {
  this.currentBackParIntensity = Math.max(0, this.currentBackParIntensity - BACK_PAR_DECAY);
}
```

**EFECTO:**
- Gate de 0.45 = solo responde a golpes de bombo/bajo fuertes
- No responde a bass sostenido (que acompaña a las voces)
- Decay de 0.12 = desvanece rápido entre golpes → más "punchy"

---

### 3. MOVERS: FUENTE DE AUDIO ACTUAL

**Archivo:** `LatinoStereoPhysics.ts` líneas 199-209

```typescript
// 💃 MOVERS: WAVE 288.7 - MID (voces/melodía), no TREBLE (güiro/maracas)
const moverTarget = mid;

if (currentEnergy > LatinoStereoPhysics.MOVER_GATE) {
  this.currentMoverIntensity += (moverTarget - this.currentMoverIntensity) * LatinoStereoPhysics.MOVER_LERP;
} else {
  this.currentMoverIntensity *= 0.95;
}
```

**ANÁLISIS:**
- ✅ Correcto usar `mid` para movers (voces, melodías)
- ⚠️ LERP de 0.08 es muy rápido
- ✅ Gate de 0.15 evita baile fantasma

**EL PROBLEMA NO ES LA FUENTE, ES LA VELOCIDAD**

---

### 4. INTEGRACIÓN CON DROP DETECTION (WAVE 289.5)

**Estado:** ✅ SimpleSectionTracker ya detecta DROPs vibe-aware

**Pero:** SeleneLux/LatinoStereoPhysics **NO CONSUMEN** la sección detectada.

**Flujo Actual:**
```
SimpleSectionTracker → wave8.section → GAMMA (mind.ts) → TrinityBrain
                                                              ↓
                                        UI muestra "DROP" pero...
                                        
LatinoStereoPhysics → NO SABE que estamos en DROP
```

**PROBLEMA:**
- El Solar Flare se dispara por `bassRatio > threshold && bassDelta > delta`
- Esto es INDEPENDIENTE del DROP detectado por SectionTracker
- Podría haber DROP sin Solar Flare (si no hay kick) o Solar Flare sin DROP

**OPORTUNIDAD WAVE 290:**
- Cuando `section.type === 'drop'` → ¿White Puncture? ¿Boost adicional?
- Actualmente NO hay estrategia definida para aprovechar el DROP

---

### 5. SOLAR FLARE ANALYSIS

**Archivo:** `LatinoStereoPhysics.ts` líneas 159-185

```typescript
private static readonly KICK_THRESHOLD = 0.65;
private static readonly BASS_DELTA_THRESHOLD = 0.12;
private static readonly DECAY_RATE = 0.08;

// Solar Flare trigger
const effectiveThreshold = LatinoStereoPhysics.KICK_THRESHOLD * thresholdMod;
const effectiveDelta = LatinoStereoPhysics.BASS_DELTA_THRESHOLD * thresholdMod;
const isKick = bass > effectiveThreshold && bassDelta > effectiveDelta;
```

**EVALUACIÓN:**
| Parámetro | Valor | Comentario |
|-----------|-------|------------|
| KICK_THRESHOLD | 0.65 | Necesita bass > 65% |
| BASS_DELTA_THRESHOLD | 0.12 | Necesita salto de 12% |
| DECAY_RATE | 0.08 | Desvanece 8%/frame |

**PROBLEMA REPORTADO:**
> "Con dimmers al 100% es bastante inútil"

El Solar Flare hace `boostBrightness(accent, 20%)` pero si el fixture ya está al máximo, no hay headroom.

**OPCIONES:**
1. **WHITE PUNCTURE** - Flash blanco puro (RGB 255,255,255) en el kick
2. **DIMMER DIP** - Bajar dimmer antes del kick, subirlo en el kick (contraste)
3. **STROBE MOMENTÁNEO** - Mini-strobe de 1 frame en el drop

---

## 📊 TABLA DE ROLES PROPUESTA

| Zona | Fuente Actual | Fuente Propuesta | Rol |
|------|---------------|------------------|-----|
| **Front PARs** | Bass + Pulse | Sin cambio | Iluminación facial, calor ámbar |
| **Back PARs** | Mid^1.5 | **Bass con Gate 0.45** | Golpes de bombo/bajo, punch |
| **Movers** | Mid (LERP 0.08) | Mid (LERP **0.04**) | Seguir voces/melodía, LÍQUIDO |

---

## 🎯 PROPUESTA DE AJUSTE: WAVE 290

### A. Nuevo MOVER_LERP

```typescript
// ANTES
private static readonly MOVER_LERP = 0.08;

// DESPUÉS - WAVE 290
private static readonly MOVER_LERP = 0.04; // "Caderas de cumbia" - más líquido
```

### B. Nuevo Cálculo Back PARs

```typescript
// ANTES
const targetBackPar = Math.pow(mid, 1.5);

// DESPUÉS - WAVE 290: Bass Gated
private static readonly BACK_PAR_GATE = 0.45;
private static readonly BACK_PAR_ATTACK = 1.0;  // Instantáneo
private static readonly BACK_PAR_DECAY = 0.12;  // Más rápido que general

// En apply():
const bassGated = bass > LatinoStereoPhysics.BACK_PAR_GATE 
  ? Math.pow(bass - LatinoStereoPhysics.BACK_PAR_GATE, 1.3) * 2 
  : 0;
  
if (bassGated > this.currentBackParIntensity) {
  this.currentBackParIntensity = Math.min(1.0, bassGated);
} else {
  this.currentBackParIntensity = Math.max(0, this.currentBackParIntensity - LatinoStereoPhysics.BACK_PAR_DECAY);
}
```

### C. Estrategia White Puncture (DROP Integration)

**OPCIÓN RECOMENDADA: Dimmer Dip + White Flash**

El sistema actual NO recibe información de sección en LatinoStereoPhysics.
Para implementar White Puncture necesitamos:

1. **Pasar `sectionType` a LatinoStereoPhysics**
2. **En el momento de DROP**, hacer:
   - Frame 0-2: Dimmer al 30% (oscurecer)
   - Frame 3: WHITE FLASH (R:255, G:255, B:255, Dimmer 100%)
   - Frame 4+: Resume normal con paleta boosteada

**Código propuesto:**
```typescript
// En LatinoPhysicsResult, añadir:
isWhitePuncture: boolean;
whitePunctureIntensity: number;

// En apply(), añadir parámetro:
public apply(
  palette: LatinoPalette,
  metrics: LatinoAudioMetrics,
  bpm?: number,
  mods?: ElementalModifiers,
  sectionType?: string  // 🆕 WAVE 290
): LatinoPhysicsResult {
  
  // ...
  
  // 🆕 WAVE 290: White Puncture en entrada de DROP
  let isWhitePuncture = false;
  if (sectionType === 'drop' && this.lastSectionType !== 'drop') {
    // Primera frame de DROP!
    isWhitePuncture = true;
    this.whitePunctureFrames = 3; // Flash de 3 frames
  }
  this.lastSectionType = sectionType;
  
  if (this.whitePunctureFrames > 0) {
    isWhitePuncture = true;
    this.whitePunctureFrames--;
  }
}
```

---

## ⚡ RESUMEN EJECUTIVO

### Problema Principal: ROLES MAL ASIGNADOS

| Zona | Escucha | Debería Escuchar |
|------|---------|------------------|
| Back PARs | Voces (Mid) | Bombo (Bass gated) |
| Movers | Mid (muy rápido) | Mid (más lento) |

### Cambios Propuestos (3 líneas de código)

1. **MOVER_LERP:** 0.08 → 0.04 (más líquido)
2. **Back PARs:** Mid^1.5 → Bass con Gate 0.45 (solo golpes)
3. **White Puncture:** Opcional, requiere pasar sectionType

### Impacto Esperado

- ✅ Movers dejan de parpadear (movimiento fluido de 1s)
- ✅ Back PARs solo en golpes de bombo (no en voces)
- ✅ Separación clara de roles (voces→movers, bombo→backs)
- 🔄 White Puncture pendiente de decisión arquitectónica

---

## 🎬 PRÓXIMOS PASOS

1. **WAVE 290.1:** Implementar ajustes de LERP y Back PAR Gate
2. **WAVE 290.2:** Decidir estrategia White Puncture (¿pasar sectionType?)
3. **WAVE 290.3:** Testing con música latina real (cumbia, reggaetón)

---

*PunkOpus - WAVE 290 COMPLETADO - 2026-01-02*
*Build: ✅ TypeScript compilado sin errores*
