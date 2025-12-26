# 🎛️ WAVE 117: THE VIRTUAL CROSSOVER

**Fecha**: 2025-12-25  
**Objetivo**: Desacoplar visualmente Front/Back Pars compensando la fuga espectral del Snare  
**Estrategia**: Sidechain Visual + Detección de Transitorios en Agudos

---

## 🎯 PROBLEMA RESUELTO

### Síntoma (WAVE 116 Diagnóstico)
```
Snare = Bass(0.7) + Mid(0.5) + Treble(0.2)
  ↓
FRONT_PARS lee Bass → Enciende
BACK_PARS lee Treble → Enciende
MOVERS leen Mid → Encienden

Resultado: Las 3 zonas encienden SIMULTÁNEAMENTE con cada snare
```

### Causa Raíz
**Fuga Espectral** - El snare es un instrumento de amplio espectro:
- **Attack** (golpe inicial): 100-400Hz → Activa Bass
- **Body** (cuerpo): 200Hz-1kHz → Activa Mid
- **Brightness** (brillo): 2-8kHz → Activa Treble

Esto NO era un bug de código - era comportamiento físicamente correcto. Pero visualmente era confuso.

---

## 🏗️ ARQUITECTURA: VIRTUAL CROSSOVER

### Concepto
Simular un **crossover de audio activo** pero para iluminación:
- Cuando detectamos un **transiente agudo** (snare snap), reducimos la sensibilidad del bass
- Esto crea un "hueco negro" visual durante el snare

### Componentes Implementados

#### 1. 🎵 TREBLE PULSE DETECTION
```typescript
// Fase 3: Physics Engine
const trebleFloor = avgNormEnergy * 0.6 || 0.3;
let treblePulse = rawTreble - (trebleFloor * 0.8);
if (treblePulse < 0) treblePulse = 0;
```

**¿Qué es?**
- `rawTreble` = nivel crudo de agudos (incluye rides, noise constante)
- `treblePulse` = **transitorios** solamente (snare snap, hi-hat attack)
- Diferencia entre nivel instantáneo y promedio = el "punch"

---

#### 2. 🥊 KICK GUARD (FRONT_PARS Sidechain)
```typescript
// Antes de calcular Front Pars
let isolationFactor = 1.0;
if (treblePulse > 0.2) {
  // Snare fuerte detectado - suprimir bass 60%
  isolationFactor = 0.4;
} else if (treblePulse > 0.1) {
  // Hi-hat/transiente menor - supresión parcial
  isolationFactor = 0.7;
}

// Aplicar al pulso de bass
const isolatedPulse = bassPulse * isolationFactor;
```

**Efecto Visual**:
- Cuando suena el **kick solo**: Front Pars brillan al 100%
- Cuando suena el **snare**: Front Pars bajan al 40% (sidechain visual)
- Crea separación clara entre kick y snare

---

#### 3. 💥 SNARE SNAP (BACK_PARS Percusivo)
```typescript
// BACK_PARS ahora responden a treblePulse, NO rawTreble
if (treblePulse > preset.backParGate) {
  // Gain x1.5 porque pulso es más pequeño que raw
  let rawIntensity = (treblePulse - preset.backParGate) * preset.backParGain * 1.5;
  ...
}
```

**Cambio Crítico**:
- **Antes** (WAVE 116): `rawTreble` → respuesta ambiental (rides siempre encendidos)
- **Ahora** (WAVE 117): `treblePulse` → respuesta percusiva (solo transitorios)

**Efecto Visual**:
- Back Pars solo encienden con snares/hi-hats nítidos
- Ignoran el brillo constante de rides/synthesizers

---

#### 4. 🎹 MINIMAL TECHNO TEXTURE MODE (MOVERS)
```typescript
// Si movers están apagados Y hay actividad en hi-hats
if (targetMover === 0 && currentVibePreset.includes('techno')) {
  if (treblePulse > 0.1 && treblePulse < 0.25) {
    // Hi-hat detectado - textura suave
    targetMover = Math.min(0.4, treblePulse * 2.0);
  }
}
```

**Problema Resuelto**:
- Minimal Techno: Kick + Hi-hat solamente (sin melodía)
- Movers estaban siempre apagados porque no había melodía
- Ahora los hi-hats dan textura sutil a los movers

---

## 📊 FLUJO DE SEÑALES

### Antes (WAVE 116):
```
rawBass ─────────────→ FRONT_PARS
rawTreble ───────────→ BACK_PARS
rawMid + rawTreble ──→ MOVERS
```

### Ahora (WAVE 117):
```
rawBass ──┬──────────────────────→ FRONT_PARS
          │                         ↑
treblePulse ───[isolationFactor]────┘  (Sidechain: -60% si snare)
          │
          ├──[x1.5 gain]─────────→ BACK_PARS (percusivo)
          │
          └──[texture mode]──────→ MOVERS (hi-hat = 40% max)
```

---

## 🔍 LOGS DIAGNÓSTICOS

### [CROSSOVER]
```
[CROSSOVER] TreblePulse:0.32 | Raw[B:0.75 T:0.45] | Floor:0.28
```
- Dispara cuando `treblePulse > 0.15`
- Muestra el cálculo del pulso vs floor

### [PAR_AUDIT] (Actualizado)
```
[PAR_AUDIT] Pulse:0.45 | Iso:0.4 | IsoPulse:0.18 | Before:0.78 | After:0.72 | Vibe:techno-club
```
- `Iso:0.4` = isolationFactor (snare detectado)
- `IsoPulse:0.18` = pulso después de sidechain
- Muestra el efecto del Kick Guard

### [BACK_SNAP]
```
[BACK_SNAP] TreblePulse:0.28 | Target:0.65 | Vibe:techno-club
```
- Muestra los Back Pars respondiendo a transitorios

---

## 🎚️ PARÁMETROS DE TUNNING

| Parámetro | Valor | Efecto |
|-----------|-------|--------|
| `treblePulse > 0.2` | Snare fuerte | isolationFactor = 0.4 |
| `treblePulse > 0.1` | Hi-hat | isolationFactor = 0.7 |
| `backParGain * 1.5` | Boost | Compensa pulso más débil que raw |
| `treblePulse 0.1-0.25` | Texture range | Hi-hats activan movers tenues |

---

## ✅ RESULTADOS ESPERADOS

### En Techno:
1. **Kick**: Front Pars al 78% (parMax), Back Pars apagados
2. **Snare**: Front Pars bajan al ~31% (78% × 0.4), Back Pars encienden
3. **Hi-hat**: Movers con textura suave (40% max)

### En Música Latina:
- Menos afectado porque los snares son menos prominentes
- Back Pars responderán mejor a congas/timbales

### En Pop/EDM:
- Separación clara entre drops (kick heavy) y builds (snare rolls)

---

## 📈 EVOLUCIÓN

| Wave | Feature | Problema Resuelto |
|------|---------|------------------|
| 114 | parMax 0.78 | Techo de intensidad |
| 115 | Relaxed gates | Cross-inhibition mataba Dubstep |
| 116 | Diagnóstico | Confirmó fuga espectral |
| **117** | **Virtual Crossover** | **Aislamiento visual kick/snare** |

---

## 🎯 PRÓXIMOS PASOS

### WAVE 118 (Si necesario):
- **Dynamic Crossover Point**: Ajustar umbrales según BPM detectado
- **Genre-Aware Isolation**: Menos sidechain en Latino, más en Techno Industrial

### WAVE 119 (Futuro):
- **Spectral Band Separation**: Usar 5 bandas en vez de 3 para mejor resolución
