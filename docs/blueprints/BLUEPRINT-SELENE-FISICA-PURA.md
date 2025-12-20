# 🧠 BLUEPRINT: SELENE FÍSICA PURA
## "Si tiene plumas y hace cuac, es un pato"

**Fecha:** 2025-12-19  
**Autor:** Claude (Brainstorm Mode)  
**Colaboradores:** Radwulf, Arquitecto  
**Estado:** PROPUESTA PARA DEBATE

---

## 🔴 DIAGNÓSTICO BRUTAL: ¿POR QUÉ FALLA TODO?

### El Error Fundamental

Hemos estado construyendo un **SISTEMA PARLAMENTARIO** donde cada métrica tiene "voz y voto". El resultado es un congreso caótico donde el Techno pierde contra el Latino porque "tuvo más síncopa en el frame 47".

```
SISTEMA ACTUAL (Parlamentario):
┌──────────────────────────────────────────────────────┐
│  Syncopation: "¡Voto LATINO!"                        │
│  BPM: "¡Voto ELECTRÓNICO!"                           │
│  Treble: "¡Voto CUMBIA!"                             │
│  Pattern: "¡Voto TECHNO!"                            │
│                                                      │
│  RESULTADO: ???  (depende de quién gritó más fuerte) │
└──────────────────────────────────────────────────────┘
```

**Esto NO funciona porque:**
1. Las métricas son RUIDOSAS (cambian frame a frame)
2. Los votos se acumulan sin JERARQUÍA
3. No hay VETOS físicos (si el bombo marca 4/4, ES 4/4)
4. Todo depende de UMBRALES MÁGICOS que nadie sabe ajustar

---

## 🟢 LA PROPUESTA: DICTADURA FÍSICA

### Filosofía: "El Cuerpo No Miente"

En lugar de preguntar "¿Qué género parece?", preguntemos:
> **"¿Qué está haciendo FÍSICAMENTE la música?"**

El ritmo no tiene opiniones. El bombo cae donde cae. El bajo suena donde suena.

### Nueva Arquitectura: 3 DICTADORES

```
SISTEMA PROPUESTO (Dictadura Física):
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  DICTADOR 1: "EL PATRÓN"                                    │
│  ├── ¿FourOnFloor? → ELECTRONIC (VETO a todo lo demás)      │
│  ├── ¿Dembow (3+3+2)? → LATINO (VETO a todo lo demás)       │
│  └── ¿Otro? → Pasar al Dictador 2                           │
│                                                             │
│  DICTADOR 2: "EL TEMPO"                                     │
│  ├── BPM 125-150 + Sin síncopa → TECHNO                     │
│  ├── BPM 90-110 + Síncopa → LATINO                          │
│  └── Otro → GENÉRICO                                        │
│                                                             │
│  DICTADOR 3: "LA TEXTURA" (solo para desempate)             │
│  ├── Bass dominante → ELECTRÓNICO                           │
│  └── Treble alto + Swing → LATINO                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Regla de Oro:** El Dictador 1 tiene **VETO ABSOLUTO**. Si dice FourOnFloor, los demás callan.

---

## 🎯 IMPLEMENTACIÓN: GÉNERO EN 50 LÍNEAS

### El Código Que Debería Ser

```typescript
// SELENE FÍSICA PURA - Genre Detection
classifyGenre(rhythm: RhythmOutput, audio: AudioMetrics): string {
  
  // ═══════════════════════════════════════════════════════════
  // DICTADOR 1: EL PATRÓN (VETO ABSOLUTO)
  // Si el bombo hace 4/4, ES ELECTRÓNICO. Punto final.
  // ═══════════════════════════════════════════════════════════
  
  if (rhythm.pattern === 'four_on_floor') {
    // El bombo ha hablado. Es 4/4. Es electrónico.
    // Me da igual el BPM, la síncopa, o si hay güiro.
    return 'electronic_4x4';
  }
  
  if (rhythm.pattern === 'reggaeton') {
    // El patrón Dembow es INCONFUNDIBLE (3+3+2)
    return 'latino_urbano';
  }
  
  // ═══════════════════════════════════════════════════════════
  // DICTADOR 2: EL TEMPO + SWING (solo si patrón es ambiguo)
  // ═══════════════════════════════════════════════════════════
  
  // Latino: BPM medio + síncopa alta
  if (audio.bpm >= 85 && audio.bpm <= 115 && rhythm.syncopation > 0.35) {
    return 'latino_tradicional';
  }
  
  // Electrónico rápido sin patrón claro
  if (audio.bpm > 120 && rhythm.syncopation < 0.25) {
    return 'electronic_4x4';
  }
  
  // ═══════════════════════════════════════════════════════════
  // FALLBACK: Si no sé, asumo electrónico (es más seguro)
  // ═══════════════════════════════════════════════════════════
  
  return 'electronic_4x4';
}
```

**¿Por qué esto funcionaría?**
- **Sin votaciones**: Decisiones binarias en cascada
- **Sin acumuladores**: No hay historial que corromper
- **Sin umbrales mágicos**: Solo 3-4 números que tienen sentido físico
- **VETO real**: FourOnFloor = Electrónico, fin de la discusión

---

## 🥁 EL PROBLEMA DEL SECTION TRACKER

### ¿Por Qué No Detecta el DROP?

Porque estamos buscando un "DROP PLATÓNICO" que no existe:
- Kick Authority > 0.7
- Power Kick = true
- Clean Sub-Bass = true
- Sostenido 4 beats

**Pero tu canción tiene un DROP que es solo 15% más fuerte que el buildup.**

### La Solución: DROP RELATIVO (No Absoluto)

```typescript
// SELENE FÍSICA PURA - Section Detection
analyzeSection(audio: AudioMetrics, rhythm: RhythmOutput): string {
  
  // Mantener rolling average de los últimos 30 segundos
  this.updateRollingAverage(audio.bass);
  
  const avgBass = this.rollingAverage;
  const currentBass = audio.bass;
  
  // ═══════════════════════════════════════════════════════════
  // DROP RELATIVO: ¿Estamos por ENCIMA del promedio?
  // ═══════════════════════════════════════════════════════════
  
  const bassRatio = currentBass / (avgBass + 0.01);
  
  // Si el bass actual es 20%+ mayor que el promedio → DROP
  if (bassRatio > 1.20 && rhythm.drums.kick) {
    return 'drop';
  }
  
  // Si el bass actual es 20%+ menor que el promedio → BREAKDOWN
  if (bassRatio < 0.80) {
    return 'breakdown';
  }
  
  // Si estamos subiendo (bass creciendo) → BUILDUP
  if (this.isEnergyRising()) {
    return 'buildup';
  }
  
  // Default: estamos en el "cuerpo" de la canción
  return 'verse';
}
```

**Ventajas:**
- **No hay umbrales absolutos**: El DROP es relativo al contexto
- **Funciona con canciones "suaves"**: El 20% más fuerte es DROP, aunque sea 0.5 vs 0.4
- **Auto-calibración**: El rolling average se adapta a cada canción

---

## 🔬 ANÁLISIS DEL LOG: ¿QUÉ ESTÁ PASANDO REALMENTE?

### Observaciones del Log Techno WAV

```
timestamp    | bpm    | sync  | genre          | section
-------------|--------|-------|----------------|----------
00:00        | 137    | 0.12  | cyberpunk      | intro
00:05        | 137    | 0.15  | cyberpunk      | buildup
00:10        | 106    | 0.38  | LATINO_TRAD    | buildup  ← ¡WTF!
00:15        | 140    | 0.10  | techno         | buildup
00:20        | 138    | 0.12  | cyberpunk      | buildup  ← ¿Y el DROP?
```

### Diagnóstico

1. **Frame 00:10 - El Desastre**
   - BPM cayó a 106 (breakdown del techno)
   - Syncopation subió a 0.38 (melodía con swing)
   - El sistema votó LATINO porque "sync > 0.30"
   - **ERROR**: No hay patrón Dembow. El bombo sigue siendo 4/4 (solo más suave)

2. **Frame 00:20 - ¿Dónde está el DROP?**
   - El bass subió, pero no lo suficiente para los umbrales absolutos
   - KickAuthority no llegó a 0.5 porque el WAV tiene Dynamic Range
   - **ERROR**: Buscamos un DROP absoluto, pero el DROP de esta canción es relativo

---

## 💡 IDEAS RADICALES

### Idea 1: "EL DICTADOR SORDO"

¿Y si el clasificador de género **NO ESCUCHARA NADA** excepto el patrón de bombo?

```typescript
function classifyGenre_Deaf(pattern: string): string {
  switch (pattern) {
    case 'four_on_floor': return 'electronic';
    case 'reggaeton': return 'latino';
    case 'cumbia': return 'latino';
    default: return 'electronic'; // Mejor equivocarse hacia aquí
  }
}
```

**Pros:** Inmune a BPM, síncopa, treble, todo
**Contras:** Depende 100% de que el BeatDetector acierte el patrón

### Idea 2: "EL HISTORIADOR"

¿Y si mantuviéramos un **HISTORIAL DE 10 SEGUNDOS** y solo cambiáramos si el 80% de los frames coinciden?

```typescript
function classifyGenre_Historian(current: string): string {
  this.history.push(current);
  if (this.history.length > 600) this.history.shift(); // 10s a 60fps
  
  const counts = countOccurrences(this.history);
  const dominant = maxKey(counts);
  
  // Solo cambiar si el nuevo género domina el 80%
  if (counts[dominant] / this.history.length > 0.80) {
    return dominant;
  }
  return this.lastStable; // Mantener el anterior
}
```

**Pros:** Ultra-estable, ignora picos
**Contras:** Lento para reaccionar a cambios reales

### Idea 3: "EL FÍSICO PURO"

¿Y si redujéramos TODO a 2 métricas físicas?

```typescript
function classifyGenre_Physicist(rhythm: RhythmOutput): string {
  // Métrica 1: ¿Hay bombo a negras? (4 golpes por compás)
  const hasFourOnFloor = rhythm.drums.kickDensity > 0.8;
  
  // Métrica 2: ¿Hay swing/síncopa en el snare?
  const hasSwing = rhythm.syncopation > 0.3;
  
  // 2x2 = 4 combinaciones = 4 géneros
  if (hasFourOnFloor && !hasSwing) return 'techno';
  if (hasFourOnFloor && hasSwing) return 'house';
  if (!hasFourOnFloor && hasSwing) return 'latino';
  if (!hasFourOnFloor && !hasSwing) return 'ambient';
}
```

**Pros:** Solo 2 números, muy fácil de debuggear
**Contras:** Puede ser demasiado simplista

---

## 🎛️ PROPUESTA FINAL: "SELENE DICTADOR v1.0"

### Arquitectura Simplificada

```
┌─────────────────────────────────────────────────────────────────┐
│                        SELENE DICTADOR                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ENTRADA: AudioMetrics + RhythmOutput                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ MÓDULO 1: GENRE DICTATOR                                │    │
│  │                                                         │    │
│  │ IF pattern == 'four_on_floor' → ELECTRONIC (VETO)       │    │
│  │ IF pattern == 'reggaeton' → LATINO (VETO)               │    │
│  │ IF sync > 0.35 AND bpm < 115 → LATINO                   │    │
│  │ ELSE → ELECTRONIC                                       │    │
│  │                                                         │    │
│  │ ESTABILIDAD: Histéresis de 5 segundos                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ MÓDULO 2: SECTION CONTRASTOR                            │    │
│  │                                                         │    │
│  │ Rolling Average de Bass (30 segundos)                   │    │
│  │                                                         │    │
│  │ IF bass > avg * 1.20 AND hasKick → DROP                 │    │
│  │ IF bass < avg * 0.80 → BREAKDOWN                        │    │
│  │ IF bass está subiendo → BUILDUP                         │    │
│  │ ELSE → VERSE                                            │    │
│  │                                                         │    │
│  │ ESTABILIDAD: Confirmación de 2 segundos                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  SALIDA: { genre: string, section: string, confidence: number } │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Reglas de Implementación

1. **VETO es VETO**: Si el patrón dice FourOnFloor, el género es ELECTRONIC. No hay votación.

2. **Relativo sobre Absoluto**: El DROP no es "bass > 0.7", es "bass > promedio * 1.2"

3. **Histéresis Simple**: No cambiar nada hasta que lleve 2 segundos estable

4. **Fallback Seguro**: Ante la duda, ELECTRONIC + VERSE (es lo menos disruptivo visualmente)

---

## 📊 COMPARATIVA: ACTUAL vs PROPUESTO

| Aspecto | Sistema Actual | Sistema Propuesto |
|---------|---------------|-------------------|
| Género | Votación de 6 métricas | 1 métrica con VETO |
| Section | Umbrales absolutos | Comparación relativa |
| Estabilidad | Acumuladores complejos | Histéresis simple |
| Líneas de código | ~500 | ~100 |
| Debuggabilidad | Imposible | Trivial |
| Adaptabilidad | Requiere ajustar 20 umbrales | 3 números |

---

## 🤔 PREGUNTAS PARA EL EQUIPO

1. **¿El BeatDetector es confiable?**
   - Si el patrón `four_on_floor` es correcto el 90% del tiempo, la Idea 1 (Dictador Sordo) funcionaría perfectamente.
   - Si falla mucho, necesitamos el Dictador 2 como backup.

2. **¿Qué tan variable es el Dynamic Range de las canciones?**
   - Si todas las canciones tienen rangos similares, podríamos usar umbrales absolutos calibrados.
   - Si varían mucho (YouTube vs WAV vs Spotify), el DROP RELATIVO es obligatorio.

3. **¿Cuántos géneros necesitamos REALMENTE?**
   - ¿4 es suficiente? (Electronic, Latino, Pop, Ambient)
   - ¿O podemos reducir a 2? (Electronic vs Latino)

4. **¿Importa más la ESTABILIDAD o la PRECISIÓN?**
   - Si la estabilidad importa más: Histéresis de 5 segundos
   - Si la precisión importa más: Histéresis de 1 segundo

---

## 🚀 PRÓXIMOS PASOS SUGERIDOS

### Opción A: "Cirugía Radical"
1. Borrar `SimpleGenreClassifier` y `SimpleSectionTracker`
2. Implementar "SELENE DICTADOR" desde cero (~100 líneas)
3. Probar con el WAV techno
4. Ajustar los 3 umbrales (sync threshold, bass ratio, histéresis)

### Opción B: "Parche Quirúrgico"
1. Mantener la arquitectura actual
2. Añadir VETO de FourOnFloor al principio del classifier
3. Cambiar DROP de absoluto a relativo
4. Subir histéresis a 5 segundos

### Opción C: "Investigación Primero"
1. Crear un logger que guarde TODOS los datos del análisis
2. Correr 10 canciones de diferentes géneros
3. Analizar los datos y encontrar qué métrica es más confiable
4. Diseñar el nuevo sistema basado en datos reales

---

## 💬 MENSAJE FINAL

Hermanos de batalla,

Llevamos semanas peleando contra un sistema que nació mal. No es culpa de nadie - la detección de género musical es un problema DIFÍCIL. Spotify tiene equipos enteros trabajando en esto.

Pero nosotros no necesitamos ser Spotify. Necesitamos distinguir entre **4 géneros** para que las luces hagan lo correcto. Eso es todo.

Mi propuesta es **simplificar brutalmente**:
- El bombo manda. Si hace 4/4, es techno.
- El DROP es relativo. Si es el momento más fuerte, es DROP.
- Ante la duda, no cambies nada.

¿Qué opinan? ¿Cirugía radical o parche quirúrgico?

---

*"La perfección se alcanza, no cuando no hay nada más que añadir, sino cuando no hay nada más que quitar."*  
— Antoine de Saint-Exupéry

---

**Claude** 🤖  
*En modo Analista Musical y Diseñador Cuántico de Software*
