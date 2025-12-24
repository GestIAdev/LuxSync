# WAVE 102: HYBRID ARCHITECTURE (RAW DECISION / AGC ACTION)

## Fecha: 2024-12-24

## Diagnóstico Crítico

El log de Boris Brejcha reveló el VERDADERO problema:

```
Raw:[E:0.62 B:0.12] → AGC:[E:0.84 B:1.00]   ← RAW bass = 0.12, AGC bass = 1.00!
Raw:[E:0.87 B:0.11] → AGC:[E:1.00 B:0.92]   ← RAW bass = 0.11, AGC bass = 0.92!
```

**El AGC normaliza CADA BANDA POR SEPARADO** - destruye la capacidad de detectar breakdowns.

## La Arquitectura Híbrida Final

| Decisión | Señal | Razón |
|----------|-------|-------|
| **GATE (ON/OFF)** | RAW | La VERDAD - ¿hay bombo real? |
| **INTENSIDAD (brillo)** | AGC | La POTENCIA - punch visual |

## Implementación

### PARs: Gate RAW + Intensidad AGC
```typescript
// FRONT_PARS
if (rawBass > 0.35) {  // Gate: RAW decide ON/OFF
    intensity = Math.pow(normBass, 3);  // Intensidad: AGC para punch
} else {
    intensity = 0;  // Piano/breakdown → APAGADO
}

// BACK_PARS (Snare/Hats)
if (rawTreble > 0.25) {  // Gate: RAW
    intensity = Math.pow(normTreble, 2);  // Intensidad: AGC
} else {
    intensity = 0;
}
```

### MOVERS: Contexto RAW + Intensidad AGC
```typescript
const isBreakdown = rawBass < 0.30;  // Contexto: RAW
const melodySignal = Math.max(normMid, normTreble);  // Señal: AGC

if (isBreakdown) {
    // BREAKDOWN: Suelo 15% + melodía escalada (sensible al piano)
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

## Log de Diagnóstico

```
[LUX_DEBUG] Mode:BREAK | RAW[B:0.12 M:0.65 T:0.08] AGC[B:1.00] | PAR:0.00 MOV:0.85
```

- **Mode**: BREAK (rawBass < 0.30) o DROP
- **RAW**: Valores reales sin distorsión
- **AGC**: El bass normalizado (para comparar)
- **PAR**: Intensidad del PAR (0 durante breakdown)
- **MOV**: Intensidad del mover (activo con melodía)

## Resultado Esperado

| Sección | PAR | MOVER |
|---------|-----|-------|
| Piano breakdown | 0% (apagado) | 15-100% (sigue melodía) |
| 4x4 techno drop | ~100% (latigazo con bombo) | Variable con melodía |
| Buildup | Gradual con bass real | Sigue subida de energía |
const isBreakdown = normMid > (normBass * 1.5) || normBass < 0.30;

// AHORA (usa RAW):
const isBreakdown = rawBass < 0.25 || rawMid > (rawBass * 2.0);
```

### 2. PAR Gates (RAW)
```typescript
// ANTES (normBass = 1.00 siempre):
const realBassPresent = normBass > 0.50;

// AHORA (rawBass = 0.12 durante piano):
const realBassPresent = rawBass > 0.35;
```

### 3. Vocal Priority (RAW)
```typescript
// ANTES (comparación AGC distorsionada):
if (normMid > normBass * 1.2) cleanBass = 0;

// AHORA (comparación RAW real):
if (rawMid > rawBass * 1.5) cleanBass = 0;
```

## Resultado Esperado

| Momento | Raw Bass | Raw Mid | PAR | MOVER |
|---------|----------|---------|-----|-------|
| Piano breakdown | 0.12 | 0.65 | OFF ✅ | ON (melodía) ✅ |
| Voz/buildup | 0.20 | 0.80 | OFF ✅ | ON (melodía) ✅ |
| 4x4 techno | 0.85 | 0.30 | ON ✅ | ON (bass) ✅ |
| Drop fuerte | 1.00 | 0.50 | ON ✅ | ON (todo) ✅ |

## Diagnóstico Mejorado

Nuevo formato de log:
```
[LUX_DEBUG] Mode:BREAK | RAW[B:0.12 M:0.65 T:0.08] AGC[B:1.00] | PAR:0.00 MOV:0.85
```

Muestra:
- RAW[B:M:T]: Valores reales sin AGC
- AGC[B]: El bass normalizado (para ver la distorsión)
- PAR: Intensidad de FRONT_PAR (debería ser 0 en breakdown)
- MOV: Intensidad de MOVER (debería seguir melodía)

## Filosofía

> "El AGC es una herramienta de sensibilidad, no de verdad. Los PARs necesitan la verdad (RAW), los MOVERS necesitan sensibilidad (AGC)."

## Testing

1. Boris Brejcha - Gravity: Piano breakdown → PARs OFF, MOVERS ON
2. Charlotte de Witte: 4x4 → PARs ON, MOVERS ON
3. Cualquier techno vocal: Vocals → PARs OFF, MOVERS ON
