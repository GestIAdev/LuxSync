# 🥁 WAVE 47.4: KICK AUTHORITY & STATE LOGIC

**Fecha:** 2025-12-19  
**Versión:** 47.4.1  
**Objetivo:** Detectar DROP correctamente en audio comprimido (YouTube) + Arreglar silencios dramáticos

---

## 📋 PROBLEMA REPORTADO

1. **DROP nunca se detecta** → Se queda en Buildup permanentemente
2. **Silencios dramáticos → OUTRO** → Los silencios antes del drop se marcan como "fin de canción"
3. **YouTube comprime el volumen** → La detección por "volumen" falla porque todo está aplastado

---

## 🔬 ANÁLISIS: "THE LOUDNESS WAR PROBLEM"

### YouTube Compression Reality
```
Audio Original:  Buildup=0.4, Drop=0.9  (diferencia clara)
YouTube:         Buildup=0.7, Drop=0.8  (aplastado, casi igual)
```

**Insight clave:** El VOLUMEN está comprimido, pero la RELACIÓN GRAVES/AGUDOS no cambia.

---

## ✅ SOLUCIÓN: KICK AUTHORITY

### Nueva Métrica: `isDropCandidate`

```typescript
// KickAuthority = Fuerza del kick * presencia de graves
const kickAuthority = rhythm.drums.kickIntensity * audio.bass;

// HiFreqContent = Treble + Mid (risers, snares, hats)
const hiFreqContent = audio.treble + audio.mid;

// DROP CANDIDATE: Kick autoritario Y graves dominan sobre agudos
const isDropCandidate = kickAuthority > 0.4 && (audio.bass > hiFreqContent * 0.7);
```

### Lógica de Votación Actualizada

| Condición | Sección | Peso |
|-----------|---------|------|
| `isDropCandidate` | **DROP** | 1.8 |
| `isDropCandidate + four_on_floor` | **DROP** | +0.5 |
| `isPowerKick + hasCleanSubBass` | **DROP** (fallback) | 1.2 |
| `hasKick + !isDropCandidate + !isPowerKick` | **BUILDUP** | 1.0 |

---

## 🤐 STATE LOGIC: SILENCIOS CON SIGNIFICADO

### Problema: El Silencio NO es Universal

```
Silencio después de BUILDUP = Tensión dramática (BREAKDOWN)
Silencio después de DROP    = Fin de sección (puede ser OUTRO)
Silencio después de OUTRO   = Nueva canción (UNKNOWN)
```

### Reglas Implementadas

#### Regla #1: Silencio Dramático
```typescript
// Silencio (energía < 0.15) después de BUILDUP = BREAKDOWN
if (relativeEnergy < 0.15 && this.currentSection === 'buildup') {
  this.addVote('breakdown', 1.5);
  this.sectionVotes['outro'] = 0;  // PROHIBIDO
  this.sectionVotes['intro'] = 0;  // PROHIBIDO
}
```

#### Regla #2: OUTRO Solo Desde Drop/Breakdown
```typescript
// OUTRO solo si vienes de drop o breakdown (fin natural)
if (relativeEnergy < 0.2 && this.frameCount > 3000) {
  if (this.currentSection === 'breakdown' || this.currentSection === 'drop') {
    this.addVote('outro', 0.5);
  }
  if (this.currentSection === 'buildup') {
    this.addVote('breakdown', 0.8);  // NO outro desde buildup
  }
}
```

#### Regla #3: Protección de Energía Media
```typescript
// Kick desaparece pero hay energía = NUNCA intro/outro
if (!spectral.hasKick && relativeEnergy > 0.3) {
  if (spectral.trebleRatio > 0.35) {
    this.addVote('buildup', 0.6);  // Risers
  } else {
    this.addVote('breakdown', 0.6);  // Pads/melodías
  }
  this.sectionVotes['intro'] = 0;
  this.sectionVotes['outro'] = 0;
}
```

---

## 📊 MÉTRICAS ESPECTRALES (WAVE 47.4.1)

| Métrica | Fórmula | Descripción |
|---------|---------|-------------|
| `kickAuthority` | `kickIntensity * bass` | Fuerza del bombo (resistente a compresión) |
| `hiFreqContent` | `treble + mid` | Contenido agudo (risers, snares) |
| `isDropCandidate` | `kickAuth > 0.4 && bass > HiFreq * 0.7` | ¿Es un drop real? |
| `isPowerKick` | `kickIntensity > 0.75` | Kick de guerra (velocity 110+) |
| `isGhostSnare` | `snareIntensity < 0.6` | Snare roll (velocity 60-75) |
| `hasCleanSubBass` | `bassDom > 0.65 && treble < 0.25` | Sub-bass limpio sin ruido |

---

## 🛡️ MATRIZ DE TRANSICIONES

```
buildup → ['drop', 'chorus', 'breakdown']  // NUNCA otro
drop → ['breakdown', 'buildup', 'verse', 'outro']
breakdown → ['buildup', 'verse', 'drop', 'outro']
```

**Regla de Hierro:** `buildup → outro` está PROHIBIDO.

---

## 🎯 RESULTADO ESPERADO

### Boris Brejcha - Gravity

| Momento | Antes | Ahora |
|---------|-------|-------|
| Buildup (risers) | BUILDUP | BUILDUP ✓ |
| Silencio dramático | OUTRO ❌ | BREAKDOWN ✓ |
| Drop (bombo + bajo) | BUILDUP ❌ | DROP ✓ |
| Breakdown melódico | OUTRO ❌ | BREAKDOWN ✓ |
| Final de canción | OUTRO | OUTRO ✓ |

---

## 📁 ARCHIVOS MODIFICADOS

- `src/main/workers/TrinityBridge.ts` → SimpleSectionTracker
  - Añadido: `kickAuthority`, `hiFreqContent`, `isDropCandidate`
  - Añadido: State Logic para silencios
  - Añadido: Protección contra intro/outro con energía media

---

## 🔄 PRÓXIMOS PASOS

1. **Probar con Boris Brejcha - Gravity** → Validar DROP detectado
2. **Probar con tracks de YouTube** → Validar resistencia a compresión
3. **Ajustar umbrales si necesario** → kickAuthority > 0.4, bass > HiFreq * 0.7

---

**Status:** ✅ BUILD EXITOSO - LISTO PARA TEST
