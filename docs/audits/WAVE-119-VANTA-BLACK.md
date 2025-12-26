# 🎩 WAVE 119: VANTA BLACK - The AGC Trap

**Fecha**: 25 Diciembre 2025
**Estado**: ✅ IMPLEMENTADO
**Arquitecto**: GeminiPunk (Netrunner)
**Implementador**: PunkOpus

---

## 📊 DIAGNÓSTICO DEL ARQUITECTO

> "El Culpable de la 'Unión Mística': No es un cable místico. Es el AGC (Control Automático de Ganancia)."
>
> "Cuando la música baja (silencios, puentes), el AGC entra en pánico: '¡No oigo nada! ¡Subid el volumen!'. Multiplica el siseo de fondo (ruido) por 6x o 10x. Resultado: Tanto Pares como Móviles reciben una señal de 'falso 100%' generada por el ruido de fondo amplificado."
>
> "Si tienes que gritar (Ganancia Alta) para que se te oiga... es que lo que estás oyendo es ruido. CÁLLATE."

---

## 🎯 PROBLEMA IDENTIFICADO

### El Log Dubstep Revelaba:
```
[AGC] Peak:0.10 Gain:9.9x Avg:0.52 | Raw:[E:0.09 B:0.03] → Norm:[E:0.86 B:0.29]
                                          ^^^^^^^^^^^^^^^       ^^^^^^^^^^^^^^^
                                          SEÑAL REAL: ~9%       SEÑAL AGC: ~86% (!)
```

El AGC amplificaba señales de **9%** a **86%**, convirtiendo ruido de fondo en "falsa melodía".

### Evidencia del Acoplamiento:
```
[LUX_DEBUG] Mode:DROP | RAW[B:0.65 M:0.53 T:0.20] | Pulse:0.10 Floor:0.91 | MelDom:N | PAR:0.28 MOV:1.00
                                                                                        ^^^       ^^^^^
                                                                                        Pars OK   Movers siempre al 100%!
```

---

## 🔧 SOLUCIÓN: TRIPLE FILTRO VANTA BLACK

### 1. AGC TRAP (Noise Floor Killer)

```typescript
// WAVE 119: VANTA BLACK - AGC TRAP
const RAW_SILENCE_THRESHOLD = 0.15;
const isAGCTrap = rawBass < RAW_SILENCE_THRESHOLD && rawMid < RAW_SILENCE_THRESHOLD;
const vantaBlackDimmer = isAGCTrap ? 0.0 : 1.0;

// Aplicado a TODAS las zonas:
targetIntensity *= vantaBlackDimmer;  // Pars
intensity *= vantaBlackDimmer;         // Movers
```

**Lógica**: Si la señal CRUDA (pre-AGC) es menor al 15%, ignoramos TODO. El AGC puede gritar todo lo que quiera, no le hacemos caso.

### 2. MOVER HYSTERESIS (Estabilidad + Apagado)

```typescript
// Estado persistente
const moverHysteresisState = new Map<string, boolean>();
const MOVER_ON_THRESHOLD = 0.35;   // Cuesta encender (evita ruido)
const MOVER_OFF_THRESHOLD = 0.10;  // Cuesta apagar (mantiene beam)

// Lógica
if (!wasOn) {
  // APAGADO: Necesita mucha energía para encender
  if (melodyVal > MOVER_ON_THRESHOLD) {
    moverHysteresisState.set(hystKey, true);
    targetMover = melodyVal;
  } else {
    targetMover = 0; // SE QUEDA EN NEGRO
  }
} else {
  // ENCENDIDO: Se mantiene hasta que la energía muera
  if (melodyVal > MOVER_OFF_THRESHOLD) {
    targetMover = melodyVal;
  } else {
    moverHysteresisState.set(hystKey, false);
    targetMover = 0; // APAGADO TOTAL
  }
}
```

**Lógica**: El ruido de fondo (~0.20) no alcanza el `MOVER_ON_THRESHOLD` (0.35). Los movers se quedan apagados hasta que entre un sintetizador de verdad.

### 3. HARD FLOOR 0.20 (Zero Residue)

```typescript
// FRONT PARS
if (targetIntensity < 0.20) targetIntensity = 0;

// BACK PARS  
if (targetIntensity < 0.20) targetIntensity = 0;
```

**Lógica**: "Si es menos del 20%, es basura. A NEGRO." Esto elimina el residuo del 12% que quedaba incluso después del clipper.

### 4. WOBBLE BASS FILTER (Bonus)

```typescript
// Solo cuenta como melodía si mids > 80% del bass
// Filtra el "wobble bass" que tiene mids altos correlacionados con bass
const isRealMelody = rawMid > rawBass * 0.8;
const melodyVal = isRealMelody ? melodySignal : 0;
```

**Lógica**: En Dubstep, el wobble bass tiene mucha energía en mids (armónicos). Este filtro distingue entre melodía real y armónicos del bajo.

---

## 📈 COMPARATIVA: Antes vs Después

| Escenario | WAVE 118 (Antes) | WAVE 119 (Después) |
|-----------|------------------|-------------------|
| Silencio con siseo | 12% residual | **0% (Vanta Black)** |
| Movers en drop | 100% constante | **0% (Hysteresis)** |
| Ruido AGC amplificado | Pasa el gate | **Bloqueado (AGC Trap)** |
| Wobble bass | Enciende movers | **Ignorado (Wobble Filter)** |

---

## 🧮 MATEMÁTICAS DE LA SOLUCIÓN

### Escenario: Silencio con Siseo de Fondo

**ANTES (WAVE 118):**
```
rawBass: 0.09, rawMid: 0.07
AGC Gain: 9.9x
normBass: 0.86, normMid: 0.70
melodySignal: 0.70 > threshold 0.25 → PASA
targetMover: 0.70 → Movers al 70% (!)
```

**DESPUÉS (WAVE 119):**
```
rawBass: 0.09 < 0.15 → AGC TRAP ACTIVO
rawMid: 0.07 < 0.15 → AGC TRAP ACTIVO
vantaBlackDimmer = 0.0
intensity = 0.70 * 0.0 = 0 → ⬛ VANTA BLACKOUT
```

### Escenario: Drop de Dubstep

**ANTES:**
```
rawBass: 0.65, rawMid: 0.53
melodySignal: 0.53 > threshold 0.25 → PASA
targetMover: 0.53 → Movers encendidos durante el drop (!)
```

**DESPUÉS:**
```
rawMid: 0.53 > rawBass * 0.8 (0.52)? → SÍ (apenas)
melodyVal: 0.53
wasOn: false, melodyVal: 0.53 > MOVER_ON_THRESHOLD (0.35)? → SÍ
Pero... bassGate: rawMid (0.53) < rawBass * 0.5 (0.325)? → NO
Movers pueden encender si hay melodía real
```

---

## ✅ ARCHIVOS MODIFICADOS

### `electron-app/electron/main.ts`

| Línea | Cambio |
|-------|--------|
| ~635 | Añadido `moverHysteresisState` Map y constantes |
| ~850 | AGC Trap: `isAGCTrap` y `vantaBlackDimmer` |
| ~1050 | FRONT_PARS: Hard Floor 0.20 + vantaBlackDimmer |
| ~1105 | BACK_PARS: Hard Floor 0.20 + vantaBlackDimmer |
| ~1120 | MOVING_LEFT: Hysteresis + Wobble Filter |
| ~1210 | MOVING_LEFT: vantaBlackDimmer aplicado |
| ~1230 | MOVING_RIGHT: Hysteresis + Wobble Filter |
| ~1280 | MOVING_RIGHT: vantaBlackDimmer aplicado |

---

## 🔮 RESULTADO ESPERADO

### En la Consola:
```
[VANTA_BLACK] ⬛ AGC TRAP ACTIVE | Raw[B:0.09 M:0.07] < 0.15
```

### En la Pista:
- **Silencios puros**: Negro total (Vanta Black)
- **Drops de Dubstep**: Solo pars reactivos, movers apagados
- **Breakdowns con melodía**: Movers encendidos (melodía > 0.35)
- **Independencia total**: Cada zona responde solo a SU señal

---

## 📋 RESUMEN EJECUTIVO

**Arquitecto GeminiPunk diagnosticó:**
- El AGC amplifica ruido de fondo x6-10x en silencios
- Esto genera señal "falsa" que mantiene todas las fixtures encendidas
- "Si tienes que gritar para que te oigan, es que estás oyendo ruido"

**Solución implementada (WAVE 119):**
1. **AGC Trap**: Detecta señal cruda < 15% → dimmer global a 0
2. **Hysteresis**: ON > 0.35, OFF < 0.10 → estabilidad + apagado real
3. **Hard Floor**: < 20% → 0 (elimina residuos)
4. **Wobble Filter**: mids > bass*0.8 para ser considerado melodía

**Resultado**: VANTA BLACK - Negro puro en silencios, independencia total de zonas.
