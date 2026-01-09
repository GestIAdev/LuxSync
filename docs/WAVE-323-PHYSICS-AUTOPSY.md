# WAVE 323: PHYSICS AUTOPSY - EL REFRITO MORFÍNICO

**FECHA:** 2026-01-07  
**MISIÓN:** Comparar Techno (DIOS 3D) + Fiesta Latina (DIOS Melódico) para crear Chill-Lounge (OCÉANO CÓSMICO)

---

## 🔬 ANÁLISIS COMPARATIVO DE PARÁMETROS

### **TECHNO STEREO PHYSICS** (El Patrón Oro 3D)

```typescript
// NO USA VISCOSITY ENGINE - Usa smoothing básico
INTENSITY_SMOOTHING = 0.4     // Smoothing factor genérico

// FRONT PARS (Bass/Bombo)
FRONT_PAR_BASE = 0.08         // Piso muy bajo
FRONT_PAR_BASS_MULT = 0.85    // 85% directo

// BACK PARS (Mid/Snare)
BACK_PAR_GATE = 0.25          // Gate ALTO anti-karaoke
BACK_PAR_MID_MULT = 1.8       // Multiplicador agresivo

// MOVERS (Treble con vitaminas)
TREBLE_VITAMIN = 2.2          // ¡EXPLOSIÓN!
ACTIVATION_THRESHOLD = 0.15
HYSTERESIS_MARGIN = 0.06
```

**FILOSOFÍA:** Respuesta INSTANTÁNEA. Sin viscosity, sin slew rate. Cálculo directo:
```typescript
intensity = smoothing * (target - current) + current
```

---

### **FIESTA LATINA PHYSICS** (El Dios Melódico)

```typescript
// MOVERS (Mid puro - Voz/Melodía)
MOVER_ATTACK = 0.65           // Subida rápida
MOVER_DECAY_FACTOR = 0.75     // Decay líquido (¡MUY LENTO!)
MOVER_GATE = 0.22             // Gate bajo (rescatar melodías)
MOVER_GAIN = 1.30
MOVER_HYSTERESIS = 0.25       // Piso de relleno constante

// BACK PARS (Treble - Snare/Hi-hat)
BACK_PAR_GATE = 0.16          // Gate medio
BACK_PAR_ATTACK = 0.70        // Rápido
BACK_PAR_DECAY = 0.25         // Decay moderado
BACK_PAR_GAIN = 1.9

// FRONT PARS (Bass - Bombo "TÚN")
FRONT_PAR_GATE = 0.48         // Gate MUY alto (solo bombos reales)
FRONT_PAR_ATTACK = 0.70       // Rápido
FRONT_PAR_DECAY_LINEAR = 0.05 // Decay rápido (bofetada!)
FRONT_PAR_GAIN = 1.7
```

**FILOSOFÍA:** Attack/Decay ASIMÉTRICOS. Los movers flotan (decay 0.75), los pares golpean (decay 0.05-0.25).

---

### **CHILL-LOUNGE PHYSICS** (El Problema Actual)

```typescript
// FILOSOFÍA: Viscosity Engine (Slew Rate Limiting)
// NO usa Attack/Decay, usa RISE/FALL per-frame

FLOOR = 0.10                  // Piso ambiente

// FRONT (Bongos/Bass)
FRONT_GATE = 0.40
FRONT_GAIN = 1.2
FRONT_RISE = 0.05             // ¡RÁPIDO! (como Techno)
FRONT_FALL = 0.02             // VISCOSO (ni Techno ni Latino)

// BACK (Estrellas/Treble)
BACK_GATE = 0.30              // ALTO (solo brillos)
BACK_GAIN = 2.0
BACK_RISE = 0.02              // Lento
BACK_FALL = 0.01              // MUY lento

// MOVERS (Mantas/Mid)
MOVER_GATE = 0.10             // BAJO (flotar siempre)
MOVER_GAIN = 2.0
MOVER_RISE = 0.01             // ULTRA-lento
MOVER_FALL = 0.005            // CASI ESTÁTICO (con Trapdoor ×10)

// HYSTERESIS (WAVE 322)
HYSTERESIS_THRESHOLD = 0.03   // 3% cambio mínimo
```

**FILOSOFÍA:** Viscosity Engine (física continua) + Hysteresis temporal. Pero los parámetros son **FRANKENSTEIN**: Rise rápido (Techno) + Fall lento (¿inventado?).

---

## 🎯 DIAGNÓSTICO BRUTAL

### **EL PROBLEMA:**

1. **RISE/FALL NO SON EQUIVALENTES A ATTACK/DECAY**
   - Techno: `smoothing = 0.4` → Converge en ~2 frames (33ms)
   - Fiesta Latina: `decay = 0.75` → Converge en ~4 frames (67ms)
   - **Chill: `FALL = 0.02`** → Converge en **50 FRAMES (833ms)** 😱

2. **VELOCIDADES ASIMÉTRICAS EXTREMAS**
   - Front Rise: 0.05 = 20 frames (333ms) para 0→1
   - Front Fall: 0.02 = 50 frames (833ms) para 1→0
   - **Ratio 2.5:1** (Fiesta Latina es ~14:1, Techno es simétrico)

3. **HYSTERESIS INÚTIL EN VALORES ALTOS**
   - Threshold 3% de 0.85 = 0.025 (casi 1 escalón DMX)
   - Threshold 3% de 0.10 = 0.003 (¡1/3 de escalón DMX!)
   - **Hysteresis solo funciona en zona baja, no en zona alta**

---

## 💊 WAVE 323: EL REFRITO MORFÍNICO

### **NUEVA FILOSOFÍA: "Techno Fumado"**

Vamos a **abandonar Viscosity Engine** y adoptar el sistema **Attack/Decay de Fiesta Latina**, pero con valores **RELAJADOS**:

```typescript
// INSPIRACIÓN:
// - Techno: Gates precisos, respuesta instantánea
// - Fiesta Latina: Decay líquido (0.75), hysteresis de relleno (0.25)
// - Morfina: TODO ×1.5 más lento que Fiesta Latina

// FRONT (Bongos/Bass)
FRONT_GATE = 0.40             // Mantener (buenos resultados)
FRONT_ATTACK = 0.80           // Rápido (marcar golpe)
FRONT_DECAY = 0.40            // MORFÍNICO (vs 0.05 en Latino)
FRONT_GAIN = 1.2
FRONT_HYSTERESIS = 0.15       // Piso de flotación

// BACK (Estrellas/Treble)
BACK_GATE = 0.30              // Mantener (solo brillos)
BACK_ATTACK = 0.70            // Moderado
BACK_DECAY = 0.50             // Muy líquido
BACK_GAIN = 2.0
BACK_HYSTERESIS = 0.12

// MOVERS (Mantas/Mid)
MOVER_GATE = 0.10             // Mantener (flotar siempre)
MOVER_ATTACK = 0.60           // Lento (ignorar transientes)
MOVER_DECAY = 0.85            // OCÉANO (vs 0.75 en Latino)
MOVER_GAIN = 2.0
MOVER_HYSTERESIS = 0.20       // Piso alto (nunca apagar)
```

---

## 🧪 MATEMÁTICA DEL DECAY

### **Attack/Decay Factor (Fiesta Latina style):**

```typescript
// Si target > current (subiendo)
current = current + (target - current) * ATTACK

// Si target < current (bajando)
current = current + (target - current) * DECAY

// Convergencia: current → target en ~(1/factor) frames
```

**EJEMPLOS:**
- `DECAY = 0.05` → Converge en 20 frames (333ms) - RÁPIDO (Latino Front)
- `DECAY = 0.40` → Converge en 2.5 frames (42ms) - MODERADO (propuesto Chill Front)
- `DECAY = 0.75` → Converge en 1.3 frames (22ms) - LÍQUIDO (Latino Movers)
- `DECAY = 0.85` → Converge en 1.2 frames (20ms) - OCÉANO (propuesto Chill Movers)

---

## 🎸 VENTAJAS DEL SISTEMA ATTACK/DECAY

1. **CONVERGENCIA PREDECIBLE:** Factor 0.85 siempre converge en ~1.2 frames, independiente del valor inicial
2. **HYSTERESIS INTEGRADO:** El piso de flotación (`FRONT_HYSTERESIS = 0.15`) reemplaza al Quantum Lock
3. **SIMETRÍA OPCIONAL:** Podemos hacer Attack = Decay para "respiración natural"
4. **COMPATIBLE CON FPS Y BPM:** No depende de dt, funciona igual a 60Hz o 120Hz

---

## 🔥 PLAN DE ACCIÓN

1. **Reemplazar Viscosity Engine** por Attack/Decay system
2. **Eliminar Quantum Lock + Temporal Hysteresis** (redundante con hysteresis floor)
3. **Calibrar con música real:** Café del Mar, Bonobo, Tycho
4. **Validar parpadeo:** Si persiste, subir `DECAY` o `HYSTERESIS`

---

**READY TO EXECUTE, RADWULF?** 🌊✨
