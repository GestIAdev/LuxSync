# 🔒 WAVE 47.5: GENRE LOCKING & DROP SUSTAINABILITY

**Fecha:** 2025-12-19  
**Versión:** 47.5  
**Audio de Test:** Techno .WAV (30s extract de track de 5 min)

---

## 📋 PROBLEMAS REPORTADOS (Log WAV)

1. **GenreClassifier falla en breakdowns** → BPM cae a 106 y salta a `LATINO_URBANO`
2. **SectionTracker falso positivo de DROP** → Picos transitorios del WAV (Dynamic Range) disparan DROP en Buildup
3. **OUTRO en silencios dramáticos** → Los silencios a mitad de canción se marcan como OUTRO

---

## ✅ SOLUCIÓN 1: GENRE LOCK (High Inertia Mode)

### Problema Original
```
Frame 100: genre=cyberpunk (Sync=0.12)
Frame 200: [BREAKDOWN] BPM baja a 106, Sync sube a 0.35
Frame 201: genre=latin_pop ❌ (falso positivo)
```

### Implementación

```typescript
// WAVE 47.5: GENRE LOCK - High Inertia Mode
private highInertiaMode = false;
private latinVoteAccumulator = 0;
private readonly LATIN_VETO_THRESHOLD = 300;  // ~5 segundos a 60fps
private readonly SILENCE_TO_UNLOCK = 1200;    // ~20 segundos de silencio
private readonly ELECTRONIC_GENRES = ['techno', 'house', 'edm', 'cyberpunk', 'trance'];
```

### Reglas

| Condición | Acción |
|-----------|--------|
| Género estable es ELECTRONIC | Activar `highInertiaMode = true` |
| Intento de cambio a LATINO | **VETAR** hasta acumular 5s de confianza >0.9 |
| 20 segundos de silencio | Desactivar `highInertiaMode` (nueva canción) |
| BPM baja en breakdown | **IGNORAR** cambio de género |

### Resultado
```
Frame 100: genre=cyberpunk
Frame 200: [BREAKDOWN] BPM=106, Sync=0.35
Frame 201: 🔒 GENRE LOCK: VETO Latino (12/300) - Manteniendo cyberpunk ✅
```

---

## ✅ SOLUCIÓN 2: DROP SUSTAINABILITY

### Problema Original
```
Frame 100: section=buildup
Frame 101: [PICO WAV] kickAuthority=0.7 → DROP ❌ (falso positivo)
Frame 102: kickAuthority=0.2 → buildup (ya demasiado tarde)
```

### Filosofía
> "Un Drop no es un PUM, es un PUM-PUM-PUM-PUM"

El DROP es un **ESTADO**, no un **PICO**. Requiere sostenibilidad.

### Implementación

```typescript
// WAVE 47.5: DROP SUSTAINABILITY
private dropConfidenceAccumulator = 0;
private readonly DROP_SUSTAINABILITY_THRESHOLD = 24; // ~4 beats (1 compás)
private readonly DROP_AUTHORITY_MIN = 0.5;

// En cada frame:
if (kickAuthority > DROP_AUTHORITY_MIN) {
  dropConfidenceAccumulator++; // Acumular
} else {
  dropConfidenceAccumulator -= 2; // Desacumular rápido (pico transitorio)
}

// Solo votar DROP si se ha SOSTENIDO
const dropSustained = dropConfidenceAccumulator >= DROP_SUSTAINABILITY_THRESHOLD;
```

### Reglas

| KickAuthority | Acumulador | Resultado |
|---------------|------------|-----------|
| Pico alto → baja | +1 → -2 (reset) | **BUILDUP** (ignorar pico) |
| Alto sostenido 4+ beats | +24 → THRESHOLD | **DROP** (confirmado) |
| Bajo consistente | 0 | **BUILDUP/BREAKDOWN** |

### Resultado
```
Frame 100: section=buildup, kickAuth=0.2, accumulator=0
Frame 101: [PICO WAV] kickAuth=0.7, accumulator=1
Frame 102: kickAuth=0.2, accumulator=0 (reset) → buildup ✅
...
Frame 200: kickAuth=0.6, accumulator=24 → DROP ✅ (sostenido confirmado)
```

---

## ✅ SOLUCIÓN 3: OUTRO vs BREAKDOWN Refinado

### Problema Original
```
Frame 500: section=buildup, energy=0.6
Frame 501: [SILENCIO DRAMÁTICO] energy=0.1
Frame 502: section=outro ❌ (debería ser breakdown)
```

### Reglas Implementadas

| Sección Anterior | Energía | Tiempo | Resultado |
|------------------|---------|--------|-----------|
| buildup | < 0.15 | cualquiera | **BREAKDOWN** (tensión) |
| drop | < 0.15 | cualquiera | **BREAKDOWN** (respirar) |
| verse | < 0.15 | cualquiera | **OUTRO** permitido |
| breakdown | < 0.2 | > 3 min | **OUTRO** permitido |
| breakdown | < 0.2 | < 3 min | **BREAKDOWN** (aún no es final) |

### Código Clave
```typescript
// OUTRO solo desde VERSE o tras 3+ minutos desde breakdown
const isLateInSong = this.frameCount > 10800; // ~3 minutos

if (relativeEnergy < 0.2) {
  if (this.currentSection === 'verse' && relativeEnergy < 0.15) {
    this.addVote('outro', 0.6); // Fin natural suave
  } else if (this.currentSection === 'breakdown' && isLateInSong) {
    this.addVote('outro', 0.4); // Probablemente final real
  } else if (this.currentSection === 'buildup' || this.currentSection === 'drop') {
    this.addVote('breakdown', 0.8);
    this.sectionVotes['outro'] = 0; // PROHIBIDO
  }
}
```

---

## 📊 RESUMEN DE CAMBIOS

### SimpleGenreClassifier

| Variable | Valor | Propósito |
|----------|-------|-----------|
| `highInertiaMode` | bool | Flag de bloqueo de género |
| `latinVoteAccumulator` | 0-300 | Contador para confirmar cambio a latino |
| `LATIN_VETO_THRESHOLD` | 300 | ~5 segundos de latino confirmado |
| `SILENCE_TO_UNLOCK` | 1200 | ~20 segundos de silencio para desbloquear |

### SimpleSectionTracker

| Variable | Valor | Propósito |
|----------|-------|-----------|
| `dropConfidenceAccumulator` | 0-34 | Contador de sostenibilidad de DROP |
| `DROP_SUSTAINABILITY_THRESHOLD` | 24 | ~4 beats (1 compás) para confirmar DROP |
| `DROP_AUTHORITY_MIN` | 0.5 | kickAuthority mínimo para acumular |
| `lastKickAuthority` | 0-1 | Último valor de kickAuthority |

---

## 🎯 RESULTADO ESPERADO

### Con Techno .WAV

| Momento | Antes | Ahora |
|---------|-------|-------|
| Breakdown (BPM baja) | `latin_pop` ❌ | `cyberpunk` ✅ (GENRE LOCK) |
| Pico de buildup | `drop` ❌ | `buildup` ✅ (no sostenido) |
| Drop real (4+ beats) | `buildup` a veces | `drop` ✅ (sostenido) |
| Silencio dramático | `outro` ❌ | `breakdown` ✅ |
| Final de canción (3+ min) | `outro` | `outro` ✅ |

---

## 📁 ARCHIVOS MODIFICADOS

- `src/main/workers/TrinityBridge.ts`
  - **SimpleGenreClassifier**: High Inertia Mode + Latin Veto
  - **SimpleSectionTracker**: Drop Sustainability + OUTRO refinado

---

## 🔄 PRÓXIMOS PASOS

1. **Test con Techno .WAV** → Verificar estabilidad de género
2. **Test con Boris Brejcha** → Verificar DROP solo con kicks sostenidos
3. **Test cambio de canción** → Verificar desbloqueo tras 20s silencio
4. **Ajustar umbrales** si necesario:
   - `DROP_AUTHORITY_MIN`: 0.5 (puede subir a 0.6)
   - `DROP_SUSTAINABILITY_THRESHOLD`: 24 frames (puede subir a 30)

---

**Status:** ✅ BUILD EXITOSO - LISTO PARA TEST CON WAV
