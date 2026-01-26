# 🛡️ WAVE 984: MECHANICAL SYMPATHY AUDIT & REPAIR

**Fecha**: 2026-01-23  
**Autores**: PunkOpus + Radwulf  
**Estado**: ✅ COMPLETADO

---

## 📋 RESUMEN EJECUTIVO

Se implementó **THE MOVER LAW** para proteger los motores de rueda de color mecánica (LB230N y similares) de cambios rápidos de color que pueden dañar engranajes y provocar comportamiento errático.

### 🎯 LA LEY:
> **"Si un efecto dura más de 2 segundos, los Movers tienen PROHIBIDO modular el color."**
> 
> - ✅ Pueden MOVERSE (Pan/Tilt)
> - ✅ Pueden RESPIRAR (Dimmer)  
> - ❌ NO pueden CAMBIAR COLOR (rueda mecánica se queda quieta)

---

## 📊 AUDITORÍA COMPLETA (22 Efectos)

### 🔴 RIESGO ALTO - WHEEL KILLERS (Reparados)

| Efecto | Duración | Problema | Solución Aplicada |
|--------|----------|----------|-------------------|
| **VoidMist** | 5000ms | Color UV modulando en movers | ✅ MODO FANTASMA (solo dimmer+movement) |
| **DeepBreath** | 6000ms | Color BLUE→PURPLE en movers | ✅ MODO FANTASMA |
| **DigitalRain** | 4000ms | Color CYAN/LIME flickering | ✅ MODO FANTASMA + BOOST intensidad |
| **StaticPulse** | 5000ms | Color UV/GREEN/BLUE | ✅ CASTRACIÓN (movers eliminados) + BOOST |
| **AcidSweep** | ~6000ms | Color CYAN/GREEN sweep | ✅ MODO FANTASMA |
| **AbyssalRise** | 8000ms | Color BLUE→WHITE gradual | ✅ MODO FANTASMA (3 fases reparadas) |

### 🟡 RIESGO MEDIO - Movers con Color Fijo (OK)

| Efecto | Duración | Estado |
|--------|----------|--------|
| **CyberDualism** | 3000ms | ⚠️ Strobe alternando L/R pero <2s por lado |
| **SonarPing** | ~840ms | ✅ SAFE - Solo pars, sin movers |

### 🟢 RIESGO BAJO - SAFE

| Efecto | Duración | Razón |
|--------|----------|-------|
| **IndustrialStrobe** | ~500ms | Strobe corto, sin modulación continua |
| **GatlingRaid** | ~400ms | Ráfagas cortas, sin color change |
| **StrobeBurst** | ~600ms | Strobe puro |
| **SkySaw** | 2000ms | Solo MOVEMENT (tilt snaps), color fijo |
| **AmbientStrobe** | 4000ms | Solo PARS (front/pars/back), sin movers |
| **TropicalPulse** | ~500ms | Strobe corto |
| **SalsaFire** | 2500ms | Impacto, color fijo durante efecto |
| **ClaveRhythm** | ~2000ms | Rítmico, sin modulación gradual |
| **CumbiaMoon** | 3000ms | Solo pars (movers ya excluidos) |
| **CorazonLatino** | ~3000ms | Heartbeat, sin movers |
| **GhostBreath** | ~3000ms | Ambient, sin movers |
| **TidalWave** | ~2000ms | Sweep espacial, color estático |
| **SolarFlare** | ~1500ms | Impacto corto |
| **StrobeStorm** | ~800ms | Strobe caótico pero corto |

---

## 🔧 MODIFICACIONES TÉCNICAS

### 1. VoidMist.ts
```typescript
// 🛡️ WAVE 984: THE MOVER LAW - Movers en MODO FANTASMA
output.zoneOverrides!['movers'] = {
  dimmer: moverDimmer,
  // 🚫 NO COLOR - Transparente a rueda mecánica (física decide)
  blendMode: 'max' as const,
  movement: {
    pan: this.panOffset,
    tilt: 0,
  },
}
```

### 2. DeepBreath.ts
```typescript
// 🛡️ WAVE 984: THE MOVER LAW - Solo dimmer + movement, SIN COLOR
output.zoneOverrides!['movers'] = {
  dimmer,
  // 🚫 NO COLOR - Transparente a rueda mecánica (física decide)
  blendMode: 'max' as const,
  movement: { pan, tilt },
}
```

### 3. DigitalRain.ts
```typescript
// 🛡️ WAVE 984: THE MOVER LAW - Eliminar color, deja que VMM controle
// + BOOST intensidad: 0.1-0.3 → 0.35-0.70
if (moverDimmer > 0) {
  output.zoneOverrides!['movers'] = {
    dimmer: moverDimmer,
    // 🚫 NO COLOR
    blendMode: 'max' as const,
  }
}
```

### 4. StaticPulse.ts
```typescript
// 🛡️ WAVE 984: THE MOVER LAW - MOVERS CASTRADOS
// StaticPulse dura 5s → Movers ELIMINADOS del output
// + BOOST intensidad: 0.4 → 0.75
// output.zoneOverrides!['movers'] = { ... } → ELIMINADO
```

### 5. AcidSweep.ts
```typescript
// 🛡️ WAVE 984: THE MOVER LAW - Movers solo dimmer, SIN COLOR
const isMovers = zone === 'movers'

if (isMovers) {
  zoneOverrides[zone] = {
    dimmer: scaledIntensity,
    // 🚫 NO COLOR
    blendMode: 'max'
  }
} else {
  // PARS: Color completo con modulación
  zoneOverrides[zone] = { color: zoneColor, dimmer, blendMode: 'max' }
}
```

### 6. AbyssalRise.ts (3 fases)
```typescript
// Dark Phase:
'movers': { dimmer: 0, /* 🚫 NO COLOR */ movement: {...} }

// Rising Phase:
'movers_left': { dimmer: moverDimmer, /* 🚫 NO COLOR */ movement: {...} }
'movers_right': { dimmer: moverDimmer, /* 🚫 NO COLOR */ movement: {...} }

// Blinding Phase:
'movers': { dimmer, white: phaseProgress, /* 🚫 NO COLOR */ movement: {...} }
```

---

## 🎚️ BOOSTS DE INTENSIDAD (Compensación)

Para compensar la pérdida de presencia visual por eliminar movers, se boostearon los pars:

| Efecto | Antes | Después | Incremento |
|--------|-------|---------|------------|
| **DigitalRain** | 0.10-0.30 | 0.35-0.70 | +250% |
| **StaticPulse** | 0.40 | 0.75 | +87% |

---

## ⚖️ COMPATIBILIDAD

### ✅ Fixtures LED (14M colores)
Los fixtures LED pueden mostrar los colores que la física les envíe sin restricción. El efecto simplemente deja la decisión del color a la capa inferior (TitanEngine/VibePhysics).

### ✅ Fixtures con Rueda de Color (7R/5R)
Los movers con rueda mecánica ahora recibirán:
- **Dimmer**: Respiran y flashean correctamente
- **Movement**: Pan/Tilt funcionan normal
- **Color**: La rueda se queda en la posición que TitanEngine haya establecido (no hay conflicto)

---

## 📜 NUEVA LEY DE DISEÑO

A partir de WAVE 984, todo efecto nuevo debe cumplir:

```typescript
// En getOutput() de cualquier efecto >2000ms:
if (this.config.durationMs > 2000) {
  zoneOverrides['movers'] = {
    dimmer: calculatedDimmer,
    // 🚫 NUNCA incluir 'color' aquí
    blendMode: 'max',
    movement: { pan, tilt } // Opcional
  }
}
```

---

## 🧪 VERIFICACIÓN

- ✅ App compila correctamente (Vite dev server)
- ✅ 6 efectos modificados sin errores TypeScript nuevos
- ✅ Efectos mantienen presencia visual en pars
- ⏳ Pendiente: Test en hardware real (LB230N)

---

## 📁 ARCHIVOS MODIFICADOS

1. `src/core/effects/library/techno/VoidMist.ts`
2. `src/core/effects/library/techno/DeepBreath.ts`
3. `src/core/effects/library/techno/DigitalRain.ts`
4. `src/core/effects/library/techno/StaticPulse.ts`
5. `src/core/effects/library/techno/AcidSweep.ts`
6. `src/core/effects/library/techno/AbyssalRise.ts`

---

**WAVE 984: MECHANICAL SYMPATHY** - Protegiendo el hardware, preservando el arte. 🛡️
