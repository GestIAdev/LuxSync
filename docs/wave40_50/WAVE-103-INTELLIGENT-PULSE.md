# WAVE 103: INTELLIGENT PULSE & CONTEXT AWARENESS

## Fecha: 2024-12-24

## El Problema: "Síndrome del Ladrillo" 🧱

En techno moderno (Boris Brejcha, etc.) existe el **Rolling Bass** - una línea de bajo continua que rellena los huecos entre bombos:

```
Música normal:  KICK - silencio - KICK - silencio
Techno moderno: KICK - bass - bass - KICK - bass - bass
```

**Lo que Selene veía:**
```
rawBass: 0.9 → 1.0 → 0.95 → 1.0 → 0.9 → 1.0
```

**Lo que Selene hacía:** "¡Hay muchísima energía todo el tiempo! ¡LUZ A TOPE!"

**Resultado:** La luz queda FIJA al 100%. No parpadea. No hay ritmo visible.

---

## La Solución: Cambio de Paradigma

| Antes (WAVE 102) | Ahora (WAVE 103) |
|------------------|------------------|
| Mirar NIVEL de bass | Mirar PULSO (cambio repentino) |
| Umbral fijo 0.35 | Ratio relativo al promedio |
| `if (rawBass > 0.35)` | `if (bassPulse > 0.10)` |

---

## Arquitectura WAVE 103

### 1. Transient Pulse Detector (PARs)

```typescript
// Calculamos el "suelo" de referencia (promedio reciente)
const bassFloor = avgNormEnergy || 0.5;

// PULSO = cuánto SOBRESALE el bajo actual sobre el promedio
let bassPulse = rawBass - (bassFloor * 0.85);
if (bassPulse < 0) bassPulse = 0;

// Gate del pulso: Solo encender si hay "golpe" real
const pulseGate = 0.10;

// LÓGICA:
// Rolling Bass constante (1.0 vs 1.0): Pulso = 0 → LUZ OFF
// Kick real (subida repentina): Pulso alto → LUZ ON
if (bassPulse > pulseGate) {
    intensity = Math.pow(pulseIntensity, 2) * normBass;
}
```

### 2. Context Awareness (Ratios vs Umbrales)

```typescript
// En vez de preguntarnos "¿Hay volumen alto?"
// Preguntamos "¿Quién GANA? ¿Bass o Melodía?"

const melodySum = rawMid + rawTreble;
const isMelodyDominant = melodySum > (rawBass * 1.5);

// Piano solo: Volumen bajo, pero Melodía > Bass → BREAKDOWN
// Drop techno: Volumen alto, pero Bass > Melodía → DROP
```

### 3. Vocal Lock (PARs)

```typescript
// Si melodía domina → PARs APAGADOS automáticamente
if (isMelodyDominant || isRealSilence) {
    intensity = 0;
}
```

### 4. Contextual Visibility (MOVERs)

```typescript
if (isMelodyDominant || isRealSilence) {
    // BREAKDOWN MODE: Suelo 15% + señal melódica
    if (!isRealSilence) {
        intensity = 0.15 + (melodySignal * 0.85);
    }
} else {
    // DROP MODE: Solo con melodía fuerte
    if (melodySignal > 0.25) {
        intensity = Math.pow(melodySignal, 2);
    }
}
```

---

## Log de Diagnóstico

```
[LUX_DEBUG] Mode:MELODY | RAW[B:0.12 M:0.65 T:0.08] Pulse:0.00 MelDom:Y | PAR:0.00 MOV:0.85
[LUX_DEBUG] Mode:DROP | RAW[B:0.95 M:0.30 T:0.20] Pulse:0.15 MelDom:N | PAR:0.45 MOV:0.09
```

| Campo | Significado |
|-------|-------------|
| Mode | MELODY (melodía domina), DROP (bass domina), TRANS (transición) |
| Pulse | Valor del pulso detectado (subida repentina) |
| MelDom | Y/N - ¿La melodía domina sobre el bass? |
| PAR | Intensidad del PAR |
| MOV | Intensidad del mover |

---

## Por Qué Funciona en Todos los Géneros

| Género | Comportamiento |
|--------|----------------|
| **Techno (Boris Brejcha)** | Rolling bass ignorado. Solo kicks reales encienden PARs. Piano detectado por MelDom. |
| **Cumbia/Salsa** | Percusión marcada = pulsos altos. PARs funcionan porque hay diferencia kick/silencio. |
| **Pop/Voz** | `isMelodyDominant = true` automáticamente. PARs off, MOVERs siguen voz. |
| **EDM Drops** | Bass > Melodía = DROP mode. Pulsos del kick encienden PARs con punch. |

---

## Resumen de Variables Clave

| Variable | Descripción |
|----------|-------------|
| `bassPulse` | Diferencia entre bass actual y promedio. Solo reacciona a SUBIDAS. |
| `isMelodyDominant` | `melodySum > rawBass * 1.5` - ¿Melodía gana? |
| `isRealSilence` | `(rawBass + melodySum) < 0.15` - Silencio absoluto |
| `melodySignal` | `max(normMid, normTreble)` - Señal melódica AGC |

---

## Archivos Modificados
- `electron-app/electron/main.ts`: Líneas 560-890 (arquitectura completa)
