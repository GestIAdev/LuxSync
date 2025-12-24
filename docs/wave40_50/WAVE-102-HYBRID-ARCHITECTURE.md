# WAVE 102: HYBRID ARCHITECTURE (RAW DECISION / AGC ACTION)

## Fecha: 2024-12-24

## El Descubrimiento Crítico

El log de Boris Brejcha reveló que el AGC normaliza **CADA BANDA POR SEPARADO**:

```
Raw:[E:0.62 B:0.12] → AGC:[E:0.84 B:1.00]   ← RAW bass = 0.12, AGC bass = 1.00!
Raw:[E:0.87 B:0.11] → AGC:[E:1.00 B:0.92]   ← RAW bass = 0.11, AGC bass = 0.92!
```

**Problema**: Cuando hay solo piano (bass raw = 0.12), el AGC detecta que el bass es la frecuencia más baja y lo normaliza al máximo (1.00). Esto enciende los PARs al 100% SIEMPRE.

## La Arquitectura Híbrida Final

| Decisión | Señal | Razón |
|----------|-------|-------|
| **GATE (ON/OFF)** | RAW | La VERDAD - ¿hay bombo real? |
| **INTENSIDAD (brillo)** | AGC | La POTENCIA - punch visual |

---

## Implementación en main.ts

### 1. Obtención de Datos (Híbrida)
```typescript
// LA VERDAD (para decidir ON/OFF)
const rawBass = audioInput.bass;
const rawMid = audioInput.mid;
const rawTreble = audioInput.treble;

// LA POTENCIA (para calcular brillo)
const normBass = agcData.normalizedBass;
const normMid = agcData.normalizedMid;
const normTreble = agcData.normalizedTreble;
```

### 2. Detección de Contexto (RAW)
```typescript
// Breakdown = bajo REAL débil
// Umbral 0.30: Piano=0.12 (Break), Drop=0.80 (Drop)
const isBreakdown = rawBass < 0.30;
```

### 3. FRONT_PARS: Gate RAW + Intensidad AGC
```typescript
if (rawBass > 0.35) {  // Gate: RAW decide ON/OFF
    intensity = Math.pow(normBass, 3);  // Intensidad: AGC^3 para PUNCH
} else {
    intensity = 0;  // Piano/breakdown → APAGADO
}
```

### 4. BACK_PARS: Gate RAW + Intensidad AGC
```typescript
if (rawTreble > 0.25) {  // Gate: RAW
    intensity = Math.pow(normTreble, 2);  // Intensidad: AGC^2
} else {
    intensity = 0;  // Ruido → APAGADO
}
```

### 5. MOVERS: Ghost Hunter Simplificado
```typescript
const melodySignal = Math.max(normMid, normTreble);

if (isBreakdown) {
    // BREAKDOWN: Suelo 15% + melodía escalada
    intensity = 0.15 + (melodySignal * 0.85);
} else {
    // DROP: Solo brilla con melodía fuerte
    if (melodySignal > 0.30) {
        intensity = Math.pow(melodySignal, 2);
    } else {
        intensity = 0;
    }
}
```

---

## Log de Diagnóstico

```
[LUX_DEBUG] Mode:BREAK | RAW[B:0.12 M:0.65 T:0.08] AGC[B:1.00] | PAR:0.00 MOV:0.85
```

| Campo | Significado |
|-------|-------------|
| Mode | BREAK (rawBass < 0.30) o DROP |
| RAW[B:M:T] | Valores reales sin distorsión AGC |
| AGC[B] | Bass normalizado (para comparar) |
| PAR | Intensidad del PAR (0 = apagado) |
| MOV | Intensidad del mover |

---

## Resultado Esperado

| Sección | Raw Bass | PAR | MOVER |
|---------|----------|-----|-------|
| Piano breakdown | 0.12 | **0% (OFF)** | 15-100% (melodía) |
| Voz/buildup | 0.20 | **0% (OFF)** | Variable con melodía |
| 4x4 techno | 0.85 | **~100% (LATIGAZO)** | Variable |
| Drop explosivo | 1.00 | **100%** | 100% |

---

## Por Qué Esta Solución Funciona

1. **RAW para Gates**: No puede mentir. Si el micrófono no capta bombo, rawBass es bajo.
2. **AGC para Intensidad**: Cuando SÍ hay señal real, el AGC la potencia para visual punch.
3. **Mejor de dos mundos**: Decisiones precisas + visuales potentes.

## Archivos Modificados
- `electron-app/electron/main.ts`: Líneas 560-820 (arquitectura híbrida completa)
