# WAVE 318: CHRONOS & COSMOS - Time-Based Physics 🕐🌌

**Fecha:** 2026-01-07  
**Motor:** ChillStereoPhysics.ts  
**Filosofía:** "El Beat es la unidad de tiempo, no los frames"

## 🔥 PROBLEMA QUE RESUELVE

### WAVE 317 tenía:
- `RollingAverage` buffers → **Artefactos de latencia**
- Decay basado en frames → **Inconsistencia entre máquinas**
- Parámetros arbitrarios → **Desincronización musical**

### Síntomas:
1. **Front Pars (Bongo Strobe):** Parpadeo rápido en percusión
2. **Back Pars saturados:** Pegados al techo
3. **Movers inestables:** Flicker en decay

## 🎯 SOLUCIÓN ARQUITECTÓNICA

### Delta Time (dt)
```typescript
const now = performance.now();
const dt = Math.min(now - this.lastFrameTime, 100); // Cap 100ms
this.lastFrameTime = now;
```

**Beneficio:** Si el frame tarda 16ms o 100ms, la luz está donde debe matemáticamente.

### BPM Gravity
```typescript
const beatMs = 60000 / this.currentBpm;  // ms por beat

// Front (Bass): Cae a 0 en 1 Beat
const frontDecayRate = 1.0 / (beatMs * 1.0);

// Back (Treble): Cae a 0 en 2 Beats  
const backDecayRate = 1.0 / (beatMs * 2.0);

// Mover (Mid): Cae a 0 en 4 Beats
const moverDecayRate = 1.0 / (beatMs * 4.0);
```

**Ejemplo @ 100 BPM:**
- 1 beat = 600ms
- Front cae de 1→0 en 600ms
- Back cae de 1→0 en 1200ms
- Mover cae de 1→0 en 2400ms

**Ejemplo @ 80 BPM (Café del Mar típico):**
- 1 beat = 750ms
- Front cae de 1→0 en 750ms
- Back cae de 1→0 en 1500ms
- Mover cae de 1→0 en 3000ms

### Attack Temporal (Slew Limiter)
```typescript
private readonly ATTACK_MS = 150;  // 150ms de 0 a 1
const attackRatePerMs = 1.0 / this.ATTACK_MS;
const maxRise = attackRatePerMs * dt;
```

**Resultado:** Subida suave pero responsive. Sin saltos bruscos.

## 📊 COMPARACIÓN

| Aspecto | WAVE 317 | WAVE 318 |
|---------|----------|----------|
| Decay | Frame-based (`-= 0.005`) | Time-based (`-= rate * dt`) |
| Attack | Slew per-frame | Slew per-ms |
| BPM | Ignorado | **Es la unidad de tiempo** |
| Buffers | RollingAverage (15 frames) | **NINGUNO** (señal cruda) |
| FPS-independence | ❌ | ✅ |
| Sincronía musical | Aproximada | **Exacta** |

## 🔧 CONFIGURACIÓN

```typescript
// Gravedad BPM
FRONT_BEATS_TO_ZERO = 1.0;   // Percusión respira
BACK_BEATS_TO_ZERO = 2.0;    // Estela melódica
MOVER_BEATS_TO_ZERO = 4.0;   // Flotación cósmica

// Gates (señal cruda)
BASS_GATE = 0.30;
TREBLE_GATE = 0.15;  // Bajo para estrellas sensibles
MID_GATE = 0.25;

// Gains (moderados, sin buffers los picos son más altos)
TREBLE_GAIN = 1.8;
MID_GAIN = 1.5;
```

## 🌊 FLUJO DE DATOS

```
Audio → [Gate] → [Gain] → Target
                              ↓
                    [Chronos Physics]
                              ↓
          ┌─────────────────────────────────┐
          │ if (target > current):          │
          │   rise = min(delta, maxRise)    │
          │   next = current + rise         │
          │ else:                           │
          │   next = current - (decay * dt) │
          │   next = max(next, floor)       │
          └─────────────────────────────────┘
                              ↓
                           Output
```

## 🎵 INTEGRACIÓN BPM

El BPM llega desde:
1. `senses.ts` → `TrinityBridge` → `SeleneLux` → `ChillStereoPhysics`
2. Fallback: 100 BPM si no hay detección

```typescript
// SeleneLux.ts
const result = this.chillPhysics.apply(
  inputPalette,
  metrics,
  elementalMods,
  vibeContext.bpm  // 🆕 WAVE 318
);
```

## ⚡ RESULTADO ESPERADO

Con Café del Mar @ 80 BPM:
- **Front:** Pulsa con cada golpe de djembe, respira en ~750ms
- **Back:** Estrellas que brillan y se apagan lentamente (~1.5s)
- **Movers:** Flotan como medusas (~3s de decay)

**Sincronía perfecta:** La luz SABE cuánto dura un beat y actúa en consecuencia.

---

*"En WAVE 317 la luz esperaba a la música. En WAVE 318 la luz BAILA con la música."*
