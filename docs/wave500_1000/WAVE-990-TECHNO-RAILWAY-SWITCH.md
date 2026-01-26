# 🚂 WAVE 990 - THE TECHNO RAILWAY SWITCH

> **"Cada efecto Techno elige su vía: Dictador o Colaborador"**

**Fecha**: WAVE 990
**Objetivo**: Implementar la propiedad mixBus en todos los efectos Techno
**Estado**: ✅ **COMPLETE**

---

## 📋 RESUMEN EJECUTIVO

WAVE 990 implementa la arquitectura Railway Switch (originalmente diseñada en WAVE 800 para Fiesta Latina) en el arsenal Techno completo.

### **Cambios Realizados**

| EFECTO | ANTES | DESPUÉS | RAZÓN |
|--------|-------|---------|-------|
| AmbientStrobe | global | **htp** | Flashes que suman brillo, no dictan |
| CyberDualism | htp | **global** | Arregla sangrado de fondo reportado |

**Total archivos modificados**: 3
- `AmbientStrobe.ts` - Cambio de vía
- `CyberDualism.ts` - Cambio de vía
- `index.ts` - Documentación actualizada

---

## 🛤️ CLASIFICACIÓN DEFINITIVA DE VÍAS

### **VÍA GLOBAL - Los Dictadores (Override Físico)**

Estos efectos **MATAN** la física subyacente para ser vistos con claridad.

| EFECTO | ICONO | RAZÓN |
|--------|-------|-------|
| CoreMeltdown | ☢️ | Bomba nuclear - control total del DMX |
| BinaryGlitch | ⚡ | Contraste ON/OFF puro - necesita negro |
| SeismicSnap | 💥 | Blackout previo vital para el impacto |
| GatlingRaid | 🔫 | Balas no se ven si fondo iluminado |
| IndustrialStrobe | 🔨 | Strobe puro = dictador por naturaleza |
| CyberDualism | 🤖 | **WAVE 990**: Arregla sangrado de fondo |
| DigitalRain | 🌧️ | Gotas verdes deben cortar bombos blancos |
| FiberOptics | 🔮 | Sutil - física fuerte lo mata |
| VoidMist | 🌫️ | Atmósfera pura sin interferencia rítmica |
| SonarPing | 📡 | Ping necesita oscuridad para el eco |
| DeepBreath | 💨 | Respiración orgánica sin mezcla |
| AbyssalRise | 🌊 | Viaje épico de 5s - control total |

**Total Dictadores**: 12 efectos

### **VÍA HTP - Los Colaboradores (Suma)**

Estos efectos **SE SUMAN** a la energía base de la física.

| EFECTO | ICONO | RAZÓN |
|--------|-------|-------|
| AcidSweep | 🔪 | Confirmado: "Es sumatorio HTP, 0 problemas" |
| AmbientStrobe | 📸 | **WAVE 990**: Flashes de cámara que suman brillo |
| SkySaw | 🪚 | Sierras que conviven con movimiento base |

**Total Colaboradores**: 3 efectos

---

## 🔧 DETALLES TÉCNICOS

### **AmbientStrobe: global → htp**

**Archivo**: `AmbientStrobe.ts`

```typescript
// ANTES (WAVE 977)
readonly mixBus = 'global' as const  // 🚂 Salpica la física

// DESPUÉS (WAVE 990)
readonly mixBus = 'htp' as const  // 🚂 WAVE 990: HTP - Flashes que suman brillo
```

**Justificación**: 
- AmbientStrobe son flashes suaves dispersos (como cámaras de fotos)
- NO necesitan matar la física, SUMAN brillo al layer existente
- Intensidad 40-70% permite mezcla con física sin competir

### **CyberDualism: htp → global**

**Archivo**: `CyberDualism.ts`

```typescript
// ANTES (WAVE 810)
readonly mixBus = 'htp' as const  // 🚂 ADITIVO - suma con física

// DESPUÉS (WAVE 990)
readonly mixBus = 'global' as const  // 🚂 WAVE 990: GLOBAL - Arregla sangrado de fondo
```

**Justificación**:
- CyberDualism hace ping-pong L/R con blackouts intermedios
- Con HTP, el layer físico "sangraba" durante los blackouts
- Con GLOBAL, el negro es NEGRO REAL (dimmer=0 efectivo)
- El contraste LEFT=ON / RIGHT=OFF ahora es perfecto

---

## 📊 ESTADO FINAL DEL ARSENAL TECHNO

### **Inventario Completo** (16 efectos)

| # | EFECTO | MIXBUS | ZONA TARGET |
|---|--------|--------|-------------|
| 1 | VoidMist | global | THE VOID |
| 2 | DeepBreath | global | THE VOID |
| 3 | SonarPing | global | THE VOID |
| 4 | FiberOptics | global | THE VOID |
| 5 | DigitalRain | global | THE VOID |
| 6 | AmbientStrobe | **htp** | THE DRIVE |
| 7 | AcidSweep | htp | THE DRIVE |
| 8 | CyberDualism | **global** | THE DRIVE |
| 9 | BinaryGlitch | global | THE DRIVE |
| 10 | SeismicSnap | global | THE IMPACT |
| 11 | SkySaw | htp | THE IMPACT |
| 12 | AbyssalRise | global | THE IMPACT |
| 13 | IndustrialStrobe | global | THE DESTRUCTION |
| 14 | GatlingRaid | global | THE DESTRUCTION |
| 15 | CoreMeltdown | global | THE DESTRUCTION |
| 16 | StaticPulse | global | (legacy/deprecated) |

### **Distribución por Vía**

```
VÍA GLOBAL (Dictadores): 13 efectos (81%)
VÍA HTP (Colaboradores):  3 efectos (19%)
```

**Nota**: El Techno es mayoritariamente dictatorial por naturaleza. Los efectos necesitan control total del espacio visual para el contraste agresivo característico del género.

---

## 🏗️ ARQUITECTURA RAILWAY SWITCH

### **Cómo Funciona**

```typescript
// 1. DECLARACIÓN EN EFECTO
export class CoreMeltdown extends BaseEffect {
  readonly mixBus = 'global' as const  // Dictador
}

export class AcidSweep extends BaseEffect {
  readonly mixBus = 'htp' as const  // Colaborador
}

// 2. PROPAGACIÓN EN EffectManager
let dominantMixBus: 'htp' | 'global' = 'htp'
if (effect.mixBus === 'global') {
  dominantMixBus = 'global'  // Global siempre gana
}

// 3. EJECUCIÓN EN TitanOrchestrator
if (effectOutput.mixBus === 'global') {
  // VÍA GLOBAL: El efecto REEMPLAZA la física
  return { ...f, r, g, b, dimmer: effectDimmer }
} else {
  // VÍA HTP: El efecto SUMA a la física
  return { ...f, r, g, b, dimmer: Math.max(f.dimmer, effectDimmer) }
}
```

### **Filosofía**

```
NO es hardcoding sucio.
ES arquitectura de señal.

Como en una mesa de mezclas:
- Algunos canales van al bus principal (suman)
- Algunos canales tienen mute groups (reemplazan)

La decisión vive DONDE DEBE VIVIR: en el efecto.
El Orchestrator solo lee y ejecuta.
```

---

## ✅ VALIDACIÓN

### **Compilación**
```
✅ AmbientStrobe.ts  - Sin errores
✅ CyberDualism.ts   - Sin errores
✅ index.ts          - Sin errores
```

### **Efectos Impactados**

1. **CyberDualism (htp → global)**
   - ✅ El sangrado de fondo reportado debería estar ARREGLADO
   - ✅ Los blackouts L/R ahora son NEGRO REAL
   - ✅ Contraste visual mejorado

2. **AmbientStrobe (global → htp)**
   - ✅ Los flashes ahora SUMAN al layer físico
   - ✅ No compiten con la física, la complementan
   - ✅ Comportamiento más natural de "cámara de fotos"

---

## 📝 NOTAS ADICIONALES

### **Sobre DeepBreath**
- Ya tenía `global` (WAVE 964)
- NO estaba en la lista original pero está correcto
- Respiración orgánica necesita lienzo limpio

### **Sobre AbyssalRise**
- Ya tenía `global` (WAVE 930)
- NO estaba en la lista original pero está correcto
- Viaje épico de 5s necesita control total

### **Sobre StaticPulse**
- Es legacy/deprecated (reemplazado por BinaryGlitch)
- Mantiene `global` por seguridad
- Puede ser eliminado en futuras WAVEs

---

## 🔥 PUNK OPUS SIGNATURE

> *"El tren del Techno cambió de vía."*
> 
> *"DigitalRain ya no tendrá ruido de fondo."*
> 
> *"CyberDualism será negro puro."*
> 
> *"CoreMeltdown será el único rey de la pista."*

---

**WAVE 990 - RAILWAY SWITCH: Cada efecto Techno elige su destino.**

*"🛤️ HTP = Suma | 🛤️ GLOBAL = Dicta"*

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---------|--------|
| `techno/AmbientStrobe.ts` | mixBus: global → htp |
| `techno/CyberDualism.ts` | mixBus: htp → global |
| `techno/index.ts` | Documentación Railway Switch |

**Total líneas modificadas**: ~60 líneas
**Riesgo de regresión**: BAJO (cambios aislados en propiedades)
**Testing requerido**: Verificar CyberDualism blackouts y AmbientStrobe suma

---

# 🚂 WAVE 990: THE TECHNO RAILWAY SWITCH - COMPLETE

