# WAVE 49: VISUAL FIRST & MEMORY WIPE
## "Selene llega virgen a cada canción"

**Fecha**: 2025-12-19  
**Estado**: ✅ IMPLEMENTADO

---

## 🔴 PROBLEMAS IDENTIFICADOS

### Problema 1: Fuga de Estado (State Leak)

**Síntoma**: La 1ª reproducción de un WAV es correcta. La 3ª detecta 'Latino' erróneamente.

**Causa**: Acumuladores (`latinScore`, `genreHistory`, `scoreHistory`) NO se limpiaban al cambiar de canción. El estado de la canción anterior "contaminaba" el análisis de la nueva.

**Ejemplo**:
```
Canción 1: Salsa → latinVoteAccumulator = 300
Canción 2: Techno → latinVoteAccumulator = 300 (¡heredado!) → Detecta LATINO
```

### Problema 2: Epilepsia Cromática

**Síntoma**: Cambios de Key/Género provocan saltos de color instantáneos (Magenta → Amarillo en 1 frame).

**Causa**: `SeleneColorEngine.generate()` es estático y sin estado. Cada frame genera una paleta nueva sin transición.

**Ejemplo**:
```
Frame 1: Key=C → Hue=0 (Rojo)
Frame 2: Key=A → Hue=100 (Verde)
Frame 3: Key=A → Hue=100 (Verde)
→ SALTO INSTANTÁNEO de Rojo a Verde = parpadeo visual horrible
```

---

## 🟢 SOLUCIONES IMPLEMENTADAS

### 1. 🧹 HARD RESET (Memory Wipe)

**Ubicación**: `TrinityBridge.ts` - `SimpleGenreClassifier`

**Trigger**: Silencio prolongado (>3 segundos de `energy < 0.05` Y `bpm === 0`)

**Acción**: Purgar TODOS los acumuladores:

```typescript
// Nuevas variables de estado
private silenceFramesForReset = 0;
private readonly HARD_RESET_THRESHOLD = 180;  // 3 segundos @ 60fps
private readonly HARD_RESET_ENERGY_MIN = 0.05;

// Método de purga
public hardReset(): void {
  console.log('[SimpleGenreClassifier] 🧹 HARD RESET: Purgando estado para nueva canción');
  
  // Limpiar historial de scores
  this.scoreHistory.clear();
  
  // Reset de histéresis
  this.currentStableGenre = 'unknown';
  this.genreVotes = [];
  this.lastGenreChangeFrame = 0;
  
  // Reset de GENRE LOCK
  this.highInertiaMode = false;
  this.silenceFramesForLock = 0;
  this.latinVoteAccumulator = 0;
  
  // Reset de VETO FÍSICO
  this.lastVetoFrame = 0;
  
  // Reset contadores
  this.frameCount = 0;
  this.lastLogFrame = 0;
  this.silenceFramesForReset = 0;
}
```

**Detección en `classify()`**:

```typescript
// Al inicio de classify()
if (audio.volume < this.HARD_RESET_ENERGY_MIN && audio.bpm === 0) {
  this.silenceFramesForReset++;
  if (this.silenceFramesForReset >= this.HARD_RESET_THRESHOLD) {
    this.hardReset();
    return { primary: 'unknown', secondary: null, confidence: 0, scores: {} };
  }
} else {
  this.silenceFramesForReset = 0;
}
```

---

### 2. 🎨 Color Interpolation (Anti-Epilepsia)

**Ubicación**: `SeleneColorEngine.ts` - Nueva clase `SeleneColorInterpolator`

**Concepto**: Buffer de transición que interpola entre colores en lugar de cambios instantáneos.

**Configuración**:
- **Transición Normal**: 120 frames (~2 segundos @ 60fps)
- **Transición DROP**: 30 frames (~0.5 segundos)
- **Mínimo**: 6 frames (~0.1 segundos) - NUNCA instantáneo

```typescript
export class SeleneColorInterpolator {
  // Estado actual (lo que se envía a fixtures)
  private currentPalette: SelenePalette | null = null;
  
  // Estado objetivo (hacia donde interpolamos)
  private targetPalette: SelenePalette | null = null;
  
  // Progreso de interpolación (0 = inicio, 1 = completado)
  private transitionProgress = 1.0;
  
  // Configuración
  private readonly NORMAL_TRANSITION_FRAMES = 120;  // ~2 segundos
  private readonly DROP_TRANSITION_FRAMES = 30;     // ~0.5 segundos
  private readonly MIN_TRANSITION_FRAMES = 6;       // Mínimo 0.1s
  
  update(targetData: ExtendedAudioAnalysis, isDrop: boolean = false): SelenePalette {
    // ... detecta cambio significativo de Hue/Género
    // ... inicia interpolación
    // ... avanza transición cada frame
    // ... retorna paleta interpolada
  }
  
  private lerpHSL(from: HSLColor, to: HSLColor, t: number): HSLColor {
    // Interpolación que usa el camino más corto en el círculo de hue
    // Evita saltos de 350° a 10° (va por 355°, 360°, 5°, 10°)
  }
  
  reset(): void {
    // Para nueva canción
  }
}
```

**Integración en `SeleneLux.ts`**:

```typescript
// Declaración
private colorInterpolator: SeleneColorInterpolator = new SeleneColorInterpolator()

// Uso (reemplaza SeleneColorEngine.generate() directo)
const currentSection = this.lastTrinityData?.sectionDetail?.type || 'unknown'
const isDrop = currentSection === 'drop'
finalHslPalette = this.colorInterpolator.update(safeAnalysis as any, isDrop)
```

---

## 📊 Antes vs Después

| Aspecto | Antes (WAVE 48) | Después (WAVE 49) |
|---------|-----------------|-------------------|
| **State Leak** | Acumuladores persistían entre canciones | `hardReset()` purga todo en silencio |
| **Color Changes** | Instantáneos (1 frame) | Interpolados (30-120 frames) |
| **DROP Transition** | N/A | 0.5 segundos (rápido pero visible) |
| **Normal Transition** | N/A | 2 segundos (suave) |
| **Mínimo** | 0 frames | 6 frames (NUNCA instantáneo) |

---

## 🧪 Logs Esperados

### HARD RESET (nueva canción)
```
[SimpleGenreClassifier] 🧹 HARD RESET: Purgando estado para nueva canción
```

### COLOR INTERPOLATION
```
[ColorInterpolator] 🎨 Nueva transición: ELECTRONIC_4X4 → LATINO_TRADICIONAL (normal)
[ColorInterpolator] 🎨 Nueva transición: LATINO_TRADICIONAL → ELECTRONIC_4X4 (DROP)
```

---

## 📈 Casos de Prueba

### Test 1: State Leak Prevention
1. Reproducir Salsa (3 minutos)
2. Parar (silencio 5 segundos)
3. Reproducir Techno
4. **Esperado**: Frame 1 de Techno detecta `unknown`, Frame 60+ detecta `ELECTRONIC`
5. **NO esperado**: `LATINO` en Techno

### Test 2: Color Interpolation
1. Reproducir track con cambio de Key (C → A)
2. Observar transición de color
3. **Esperado**: Transición suave de ~2 segundos
4. **NO esperado**: Salto instantáneo

### Test 3: DROP Fast Transition
1. Reproducir track con buildup → drop
2. Observar transición de color en el DROP
3. **Esperado**: Transición de ~0.5 segundos (más rápida que normal)
4. **NO esperado**: Transición lenta de 2s en DROP (pierde impacto)

---

## 🔧 Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `TrinityBridge.ts` | Añadido `hardReset()` y detección de silencio |
| `SeleneColorEngine.ts` | Añadida clase `SeleneColorInterpolator` |
| `SeleneLux.ts` | Integración de `SeleneColorInterpolator` |

---

## 🎯 Filosofía WAVE 49

> **"Visual First & Memory Wipe"**

1. **La detección de género es MEDIOS, no FINES**. Lo que importa son las LUCES.
2. **Selene llega virgen a cada canción**. Sin prejuicios del pasado.
3. **Los cambios de color deben ser PERCIBIDOS**, no solo técnicamente correctos.
4. **Un salto instantáneo es un BUG**, aunque los valores sean correctos.

---

## 📝 Notas de Implementación

### Interpolación de Hue (Camino Corto)

El hue es circular (0-360). La interpolación lineal simple puede causar saltos feos:
- De 350° a 10° → La interpolación simple va 350 → 180 → 10 (¡pasa por verde!)
- **Solución**: Detectar el camino más corto (350 → 355 → 360 → 5 → 10)

```typescript
let hueDiff = to.h - from.h;
if (hueDiff > 180) hueDiff -= 360;
if (hueDiff < -180) hueDiff += 360;
const h = normalizeHue(from.h + hueDiff * t);
```

### Trigger de Transición

La transición se inicia cuando:
1. El Hue objetivo cambia más de 10° (cambio de Key)
2. El Macro-Género cambia (ELECTRONIC → LATINO)

Esto evita micro-transiciones innecesarias por ruido en los datos.

---

*WAVE 49: Visual First & Memory Wipe - Porque las luces son lo que VEN los humanos.* 🎨
