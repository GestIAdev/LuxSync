# 🌊 WAVE 20 BLUEPRINT: THE GREAT RESET
## Simplificación Radical del Sistema de Clasificación Musical

**Autor:** Selene AI Engineering  
**Fecha:** 10 Diciembre 2025  
**Prioridad:** CRÍTICA  
**Operación:** THE GREAT RESET  

---

## 📋 RESUMEN EJECUTIVO

El sistema actual de clasificación (`GenreClassifier.ts`) tiene **918 líneas** de código, **30+ subgéneros**, y **reglas culturales frágiles** (ej: "cumbia villera" vs "santafesina"). Esto causa:

- ❌ **Falsos positivos críticos** (Boris Brejcha → Cumbia)
- ❌ **"unknown" constante** (valores de syncopation correctos ignorados)
- ❌ **Corrupción de código** por ediciones frecuentes
- ❌ **Mantenimiento imposible** (cada fix causa regresión)

### LA SOLUCIÓN

Reemplazar 918 líneas con **~80 líneas** que detectan **5 Categorías Físicas** basadas en métricas de audio puras, sin interpretación cultural.

---

## 🎯 LAS 5 CATEGORÍAS FÍSICAS

| ID | Nombre | Trigger | Target Genres |
|----|--------|---------|---------------|
| **E4X4** | ELECTRONIC_4X4 | `sync < 0.30` + `kick 4x4` | Techno, House, Cyberpunk |
| **EBRK** | ELECTRONIC_BREAKS | `bpm > 150` + ritmo roto | DnB, Breakbeat, Jungle |
| **LTRD** | LATINO_TRADICIONAL | `sync >= 0.30` + `treble > 0.15` | Cumbia, Salsa, Merengue |
| **LURB** | LATINO_URBANO | `sync >= 0.30` + `snare > 0.5` | Reggaeton, Dembow |
| **ELAT** | ELECTROLATINO | Fallback | Pop, Fusion, Unknown |

### ÁRBOL DE DECISIÓN (PSEUDOCÓDIGO)

```typescript
classify(rhythm, audio): MacroGenre {
  const sync = rhythm.syncopation ?? rhythm.groove?.syncopation ?? 0.35;
  const bpm = audio.bpm ?? 120;
  const treble = audio.treble ?? 0.1;
  const snare = rhythm.drums?.snareIntensity ?? 0.3;

  // ELECTRÓNICO: Sin swing
  if (sync < 0.30) {
    if (bpm > 150) return 'ELECTRONIC_BREAKS';  // DnB
    return 'ELECTRONIC_4X4';                     // Techno/House
  }
  
  // LATINO: Tiene swing (sync >= 0.30)
  if (bpm >= 85 && bpm <= 125) {
    if (treble > 0.15) return 'LATINO_TRADICIONAL';  // Güiro = Cumbia
    if (snare > 0.5)   return 'LATINO_URBANO';       // Snare = Reggaeton
    return 'ELECTROLATINO';                          // Pop/Fusion
  }
  
  // FALLBACK
  return 'ELECTROLATINO';
}
```

---

## 🗑️ QUÉ SE VA A BORRAR

### GenreClassifier.ts (918 → ~80 líneas)

| Sección | Líneas | Status |
|---------|--------|--------|
| Headers y tipos complejos | 1-150 | 🗑️ SIMPLIFICAR |
| `MusicSubgenre` type (15 opciones) | 77-95 | 🗑️ ELIMINAR |
| `GenreClassifierConfig` (10+ params) | 146-200 | 🗑️ ELIMINAR |
| `calculateScores()` (300+ líneas) | 600-900 | 🗑️ REEMPLAZAR |
| Mapas de subgéneros culturales | todo | 🗑️ ELIMINAR |
| Historial y hysteresis compleja | 343-460 | ✂️ SIMPLIFICAR |

### Lo que PERMANECE

- `classify()` método público (interfaz)
- `GenreAnalysis` output type (para compatibilidad)
- Acceso a `syncopation` con fallback (WAVE 19.2 fix)

---

## 🔌 COMPATIBILIDAD CON ENGINES EXISTENTES

### 1. SeleneColorEngine.ts ✅ YA COMPATIBLE

El engine ya tiene `MACRO_GENRES` definido (líneas 389-470):

```typescript
const MACRO_GENRES = {
  'ELECTRONIC_4X4':     { tempBias: -15, satBoost: -10, ... },
  'ELECTRONIC_BREAKS':  { tempBias: 0,   satBoost: 5,   ... },
  'LATINO_TRADICIONAL': { tempBias: 25,  satBoost: 20,  ... },
  'LATINO_URBANO':      { tempBias: 10,  satBoost: 10,  ... },
  'ELECTROLATINO':      { tempBias: 0,   satBoost: 0,   ... },
};
```

Y el mapa `GENRE_MAP` (líneas 476-512) ya traduce géneros detallados a macro-géneros.

**Cambio necesario:** Hacer que el nuevo clasificador emita directamente el macro-ID.

### 2. senses.ts ✅ COMPATIBLE

Actualmente importa `GenreClassifier` y llama `classify()`. Si mantenemos la misma interfaz de output, no hay cambios.

```typescript
// Actual (línea 417-420)
const genreOutput = genreClassifier.classify(
  sensesRhythm,
  { energy, bass, mid, treble }
);
```

**Cambio necesario:** Ninguno si `genreOutput.genre` sigue siendo un string.

### 3. TrinityBridge.ts → SimpleGenreClassifier ✅ YA IMPLEMENTADO

¡Buenas noticias! `SimpleGenreClassifier` (líneas 860-960) **YA TIENE** la lógica correcta:

```typescript
if (rhythm.syncopation < 0.30) → ELECTRONIC
if (rhythm.syncopation > 0.30) → LATINO
```

**Opción:** Eliminar `GenreClassifier.ts` completamente y usar solo `SimpleGenreClassifier`.

### 4. mind.ts (GAMMA Worker) ✅ COMPATIBLE

Solo usa el género para logging:
```typescript
console.log(`[GAMMA] 🎵 GenreClassifier: HUNTING for Cumbia/Reggaeton...`);
```

---

## 🔄 PLAN DE MIGRACIÓN

### FASE 1: Preparación (30 min)
- [ ] Crear backup de GenreClassifier.ts
- [ ] Activar flag de feature `USE_SIMPLE_CLASSIFIER = true`
- [ ] Verificar que SimpleGenreClassifier funciona

### FASE 2: Refactorización (2h)
- [ ] Reescribir GenreClassifier.ts con ~80 líneas
- [ ] Mantener `classify()` con misma firma
- [ ] Emitir `MacroGenre` directamente
- [ ] Eliminar toda lógica de subgéneros

### FASE 3: Validación (1h)
- [ ] Test con Boris Brejcha → debe ser ELECTRONIC_4X4
- [ ] Test con Cumbia → debe ser LATINO_TRADICIONAL
- [ ] Test con Reggaeton → debe ser LATINO_URBANO
- [ ] Verificar logs no dicen "unknown"

### FASE 4: Limpieza (30 min)
- [ ] Eliminar tipos `MusicSubgenre`
- [ ] Eliminar `GenreClassifierConfig`
- [ ] Eliminar mapas de géneros obsoletos

---

## ⚠️ ANÁLISIS DE RIESGOS

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Engines dependientes fallan | Media | Alto | Mantener interfaz `GenreAnalysis` |
| UI muestra "undefined" | Baja | Medio | Fallback a ELECTROLATINO |
| Telemetría pierde histórico | Baja | Bajo | Nueva métrica `macroGenre` |
| Logs incompatibles | Baja | Bajo | Adaptar filtros de log |

---

## 🖥️ CONEXIÓN CON UI Y CANVAS

### Canvas de Simulación
El canvas usa `palette.meta.macroGenre` para mostrar info de género (línea 842 de SeleneColorEngine):

```typescript
return {
  // ...colores...
  meta: {
    macroGenre: macroId,  // ← ESTO es lo que se muestra
    // ...
  }
};
```

**Sin cambios necesarios** - el canvas ya consume macro-géneros.

### Dashboard Electron
Si existe un panel que muestra "cumbia_villera" vs "cumbia_santafesina", esos textos desaparecerán. Mostrar solo:
- ELECTRONIC_4X4
- ELECTRONIC_BREAKS
- LATINO_TRADICIONAL
- LATINO_URBANO
- ELECTROLATINO

---

## 📊 CONEXIÓN CON TELEMETRÍA

### Métricas Actuales
```typescript
// Probablemente en algún logger
sendTelemetry({
  genre: 'cumbia_villera',
  subgenre: 'santafesina',
  confidence: 0.78
});
```

### Métricas WAVE 20
```typescript
sendTelemetry({
  macroGenre: 'LATINO_TRADICIONAL',  // 5 opciones, no 30
  confidence: 0.85,                   // Más estable
  trigger: {                          // Para debugging
    syncopation: 0.45,
    bpm: 95,
    treble: 0.22
  }
});
```

---

## 📝 NUEVO CÓDIGO: SimpleGenreClassifier v2

```typescript
/**
 * 🌊 WAVE 20: THE GREAT RESET
 * 5 categorías físicas, ~80 líneas, 0 subgéneros culturales
 */
export type MacroGenre = 
  | 'ELECTRONIC_4X4'
  | 'ELECTRONIC_BREAKS'
  | 'LATINO_TRADICIONAL'
  | 'LATINO_URBANO'
  | 'ELECTROLATINO';

export interface GenreOutput {
  genre: MacroGenre;
  confidence: number;
  trigger: {
    syncopation: number;
    bpm: number;
    treble: number;
    snare: number;
  };
}

export class GenreClassifier {
  private lastGenre: MacroGenre = 'ELECTROLATINO';
  private framesSinceChange = 0;
  private readonly STABILITY_FRAMES = 30;

  classify(
    rhythm: { syncopation?: number; groove?: { syncopation?: number }; drums?: { snareIntensity?: number } },
    audio: { bpm?: number; treble?: number }
  ): GenreOutput {
    // === EXTRAER MÉTRICAS CON FALLBACKS ===
    const sync = typeof rhythm.syncopation === 'number'
      ? rhythm.syncopation
      : (rhythm.groove?.syncopation ?? 0.35);
    const bpm = audio.bpm ?? 120;
    const treble = audio.treble ?? 0.1;
    const snare = rhythm.drums?.snareIntensity ?? 0.3;

    // === ÁRBOL DE DECISIÓN SIMPLE ===
    let detectedGenre: MacroGenre;
    let confidence: number;

    if (sync < 0.30) {
      // ELECTRÓNICO: Sin swing
      if (bpm > 150) {
        detectedGenre = 'ELECTRONIC_BREAKS';
        confidence = 0.85;
      } else {
        detectedGenre = 'ELECTRONIC_4X4';
        confidence = 0.90;
      }
    } else if (bpm >= 85 && bpm <= 125) {
      // LATINO: Tiene swing
      if (treble > 0.15) {
        detectedGenre = 'LATINO_TRADICIONAL';
        confidence = 0.88;
      } else if (snare > 0.5) {
        detectedGenre = 'LATINO_URBANO';
        confidence = 0.85;
      } else {
        detectedGenre = 'ELECTROLATINO';
        confidence = 0.70;
      }
    } else {
      // FALLBACK
      detectedGenre = 'ELECTROLATINO';
      confidence = 0.50;
    }

    // === HISTÉRESIS SIMPLE ===
    if (detectedGenre !== this.lastGenre) {
      this.framesSinceChange++;
      if (this.framesSinceChange < this.STABILITY_FRAMES) {
        detectedGenre = this.lastGenre;
      } else {
        this.lastGenre = detectedGenre;
        this.framesSinceChange = 0;
      }
    } else {
      this.framesSinceChange = 0;
    }

    return {
      genre: detectedGenre,
      confidence,
      trigger: { syncopation: sync, bpm, treble, snare }
    };
  }
}
```

---

## ✅ CHECKLIST FINAL

- [ ] Blueprint aprobado por arquitecto
- [ ] Backup de GenreClassifier.ts creado
- [ ] Nuevo clasificador implementado (~80 líneas)
- [ ] Tests pasando (Boris Brejcha ≠ Cumbia)
- [ ] UI actualizada para mostrar macro-géneros
- [ ] Telemetría migrada
- [ ] Código viejo eliminado (800+ líneas menos)
- [ ] Documentación actualizada

---

## 🎉 BENEFICIOS ESPERADOS

| Métrica | Antes | Después |
|---------|-------|---------|
| Líneas de código | 918 | ~80 |
| Opciones de género | 30+ | 5 |
| Falsos positivos | Frecuentes | Raros |
| Tiempo de clasificación | Variable | Constante |
| Mantenibilidad | Imposible | Trivial |
| Regresiones por edición | Constantes | Ninguna |

---

**FIN DEL BLUEPRINT**

*"La simplicidad es la sofisticación suprema."* - Leonardo da Vinci
