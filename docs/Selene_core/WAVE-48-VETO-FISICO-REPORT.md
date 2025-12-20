# WAVE 48: VETO FÍSICO - "La Dictadura del 4x4"

## 📋 Resumen Ejecutivo

**Fecha**: 2024
**Archivo modificado**: `electron-app/src/main/workers/TrinityBridge.ts`
**Estado**: ✅ IMPLEMENTADO

> "La democracia ha fallado. Larga vida a la Dictadura Física."
> "Si tiene plumas y hace cuac, es un pato. Y me da igual lo que diga el Senado."

---

## 🎯 El Problema (WAVE 47.x)

Múltiples iteraciones (47.4, 47.4.1, 47.5) intentaron arreglar la detección de género y sección mediante sistemas de **votación**:
- Acumuladores
- Histéresis
- Thresholds
- Locks temporales

**Resultado**: FRACASO TOTAL
- "LATINO" y "TRADICIONAL" aparecían en música techno pura
- DROP nunca se detectaba (siempre OUTRO)
- Cada fix introducía una nueva regresión

### Diagnóstico

El problema fundamental es **filosófico**: un sistema de votación permite que métricas irrelevantes anulen señales físicas inequívocas.

Si el bombo hace PUM-PUM-PUM-PUM en patrón 4x4, **ES** música electrónica. No necesita "votos" de otras métricas.

---

## 🔨 La Solución: VETO FÍSICO

### Concepto

```
if (rhythm.pattern === 'four_on_floor' && rhythm.confidence > 0.6) {
  return ELECTRONIC;  // PUNTO FINAL. No hay votación.
}
```

El VETO FÍSICO es un **cortocircuito** que se ejecuta ANTES de cualquier sistema de votación. Si una señal física inequívoca está presente, el resultado es determinístico.

### Implementación

#### 1. VETO ABSOLUTO - Género (SimpleGenreClassifier)

```typescript
// VETO ABSOLUTO: 4x4 pattern = ELECTRONIC, sin votacion
if (rhythm.pattern === 'four_on_floor' && rhythm.confidence > 0.6) {
  this.lastVetoFrame = this.frameCount;
  this.currentStableGenre = 'cyberpunk';
  this.highInertiaMode = true;
  
  return {
    primary: 'cyberpunk',
    secondary: 'techno',
    confidence: 1.0,  // Confianza absoluta
    scores: { ...scores, cyberpunk: 1.0, techno: 0.8 },
  };
}
```

#### 2. INERCIA DEL VETO (15 segundos)

Si el patrón 4x4 desaparece (breakdown, transición), mantenemos el género vetado por 15 segundos antes de reconsiderar.

```typescript
// Variables de estado
private lastVetoFrame = 0;
private readonly VETO_INERTIA_FRAMES = 900;  // 15 segundos a 60fps

// Lógica de inercia
if (this.frameCount - this.lastVetoFrame < this.VETO_INERTIA_FRAMES) {
  const secondsRemaining = ((this.VETO_INERTIA_FRAMES - (this.frameCount - this.lastVetoFrame)) / 60).toFixed(1);
  
  return {
    primary: this.currentStableGenre,
    secondary: 'electronic',
    confidence: 0.9,
  };
}
```

#### 3. DROP RELATIVO (SimpleSectionTracker)

El DROP ya no se detecta con umbrales absolutos (que fallan en canciones tranquilas). Ahora es **relativo al contexto de la canción**:

```typescript
// WAVE 48: DROP RELATIVO
// Si bass actual > 120% del promedio de LA canción = DROP
const bassRatio = avgBass > 0.01 ? audio.bass / avgBass : 1.0;
const isDropCandidate = bassRatio > 1.20 && rhythm.drums.kick && kickAuthority > 0.3;
```

**Antes**:
- `isDropCandidate = kickAuthority > 0.4 && (audio.bass > hiFreqContent * 0.7)`
- Problema: Valores absolutos que no se adaptaban a canciones diferentes

**Después**:
- `isDropCandidate = bassRatio > 1.20 && rhythm.drums.kick && kickAuthority > 0.3`
- Solución: Compara contra el promedio de LA canción, no valores universales

---

## 📊 Cambios Técnicos

### SimpleGenreClassifier

| Concepto | Antes (WAVE 47.5) | Después (WAVE 48) |
|----------|-------------------|-------------------|
| Detección | Votación + acumuladores | VETO primero, votación después |
| 4x4 Pattern | Un voto más entre muchos | RETURN INMEDIATO, sin votación |
| Persistencia | Genre Lock temporal | Inercia de 15 segundos |
| Confianza | Variable según votos | 1.0 (absoluta) si hay VETO |

### SimpleSectionTracker

| Concepto | Antes (WAVE 47.4.1) | Después (WAVE 48) |
|----------|---------------------|-------------------|
| DROP Detection | Umbral absoluto (kickAuthority > 0.4) | Relativo (bass > avgBass * 1.20) |
| Contexto | Universal para todas las canciones | Adaptativo por canción |
| Kick Requirement | Implícito | Explícito (rhythm.drums.kick) |

---

## 🧪 Casos de Prueba Esperados

### Test 1: Techno con 4x4 constante
- **Input**: Boris Brejcha - Gravity
- **Esperado**: `VETO FISICO: 4x4 pattern -> ELECTRONIC` en consola
- **Género**: `cyberpunk` con confidence 1.0
- **NUNCA**: LATINO, TRADICIONAL

### Test 2: Breakdown sin bombo
- **Input**: Mismo track, sección breakdown
- **Esperado**: `INERCIA VETO: Manteniendo cyberpunk (X.Xs restantes)`
- **Género**: Mantiene `cyberpunk` durante 15 segundos

### Test 3: DROP vs Buildup
- **Input**: Transición buildup → drop
- **Esperado**: 
  - Buildup: `isDropCandidate = false` (bass ≤ 120% del promedio)
  - Drop: `isDropCandidate = true` (bass > 120% del promedio)

---

## 📈 Logs Esperados

```
[SimpleGenreClassifier] VETO FISICO: 4x4 pattern (conf=0.85) -> ELECTRONIC
[SimpleGenreClassifier] VETO FISICO: 4x4 pattern (conf=0.82) -> ELECTRONIC
...
[SimpleGenreClassifier] INERCIA VETO: Manteniendo cyberpunk (14.2s restantes)
[SimpleGenreClassifier] INERCIA VETO: Manteniendo cyberpunk (13.5s restantes)
...
```

---

## 🔄 Flujo de Decisión

```
┌─────────────────────────────────────────┐
│           classify() llamado            │
└─────────────────┬───────────────────────┘
                  │
                  ▼
        ┌─────────────────┐
        │ 4x4 pattern &&  │
        │ confidence > 0.6│
        └────────┬────────┘
                 │
        ┌────────┴────────┐
        │                 │
       SÍ                NO
        │                 │
        ▼                 ▼
┌───────────────┐  ┌──────────────────┐
│ VETO FÍSICO   │  │ ¿Dentro de 15s   │
│ return ELECTR │  │ desde último VETO?│
│ confidence=1.0│  └────────┬─────────┘
└───────────────┘           │
                   ┌────────┴────────┐
                   │                 │
                  SÍ                NO
                   │                 │
                   ▼                 ▼
          ┌────────────────┐ ┌────────────────┐
          │ INERCIA VETO   │ │ Sistema de     │
          │ return current │ │ VOTACIÓN       │
          │ confidence=0.9 │ │ (legacy code)  │
          └────────────────┘ └────────────────┘
```

---

## 📝 Código Añadido

### Variables de Estado (SimpleGenreClassifier)
```typescript
// 🔨 WAVE 48: VETO FÍSICO
private lastVetoFrame = 0;
private readonly VETO_INERTIA_FRAMES = 900;  // 15 segundos a 60fps
```

### VETO FÍSICO (SimpleGenreClassifier.classify)
```typescript
// ======================================================================
// WAVE 48: VETO FISICO - LA DICTADURA DEL 4x4
// ======================================================================

if (rhythm.pattern === 'four_on_floor' && rhythm.confidence > 0.6) {
  this.lastVetoFrame = this.frameCount;
  this.currentStableGenre = 'cyberpunk';
  this.highInertiaMode = true;
  
  return {
    primary: 'cyberpunk',
    secondary: 'techno',
    confidence: 1.0,
    scores: { ...scores, cyberpunk: 1.0, techno: 0.8 },
  };
}

// INERCIA DEL VETO
if (this.frameCount - this.lastVetoFrame < this.VETO_INERTIA_FRAMES) {
  return {
    primary: this.currentStableGenre,
    secondary: 'electronic',
    confidence: 0.9,
    scores: { ...scores, [this.currentStableGenre]: 0.9 },
  };
}
```

### DROP RELATIVO (SimpleSectionTracker.calculateSpectralMetrics)
```typescript
// ═══════════════════════════════════════════════════════════════════════
// WAVE 48: DROP RELATIVO - "El Drop es relativo a TU canción"
// ═══════════════════════════════════════════════════════════════════════

const bassRatio = avgBass > 0.01 ? audio.bass / avgBass : 1.0;
const isDropCandidate = bassRatio > 1.20 && rhythm.drums.kick && kickAuthority > 0.3;
```

---

## 🎬 Próximos Pasos

1. **Testing**: Probar con Boris Brejcha y otros tracks
2. **Logging**: Verificar que aparece `VETO FISICO` en consola
3. **Fine-tuning**: Ajustar `VETO_INERTIA_FRAMES` si 15s es muy largo/corto
4. **DROP Validation**: Confirmar que DROP ahora sí se detecta con música real

---

## 📚 Filosofía

> "Un Drop no es un PUM, es un PUM-PUM-PUM-PUM."

El sistema de VETO FÍSICO se basa en la premisa de que ciertas señales físicas son **determinísticas**:

- Si hay patrón 4x4 con alta confianza → ES electrónico
- Si el bass supera el 120% del promedio de la canción → ES un drop
- Si el kick desaparece pero había VETO reciente → MANTENER género

No necesitamos "votos" para estas decisiones. La física manda.

---

*WAVE 48: La democracia ha fallado. Larga vida a la Dictadura Física.* 🔨
