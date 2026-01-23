# 🔦 WAVE 985: CYBERDUALISM BLACKOUT FIX

**Fecha**: 2026-01-23  
**Autores**: PunkOpus + Radwulf  
**Estado**: ✅ COMPLETADO

---

## 🎯 PROBLEMA DIAGNOSTICADO

### Síntoma:
Durante la fase "OFF" del ciclo L/R, los movers mostraban el **color del background layer** (ej: azul del wash base) en lugar de oscuridad total.

**Comportamiento esperado**: 
```
L(White) / R(Black) <-> L(Black) / R(White)
```

**Comportamiento real**:
```
L(White) / R(Blue-Bleed) <-> L(Blue-Bleed) / R(White)
```

### Causa Raíz:
Línea 193 de `CyberDualism.ts`:
```typescript
if (!this.flashActive) {
  return null  // ❌ NO EMITE OUTPUT = Layer inferior sangra
}
```

Cuando el efecto iba a fase DARK, **no emitía ningún override**, permitiendo que la física subyacente (wash azul) se visualizara en los movers "apagados".

---

## 🛠️ SOLUCIÓN TÉCNICA: DIMMER LOCK

### Concepto:
**Dimmer Lock** = El efecto SIEMPRE emite un override, incluso cuando quiere "apagar" algo. Usa `dimmer: 0` explícito con `blendMode: 'replace'` para **aplastar** el layer inferior.

### Cambios en `CyberDualism.ts`:

#### ❌ ANTES (HTP Bleed):
```typescript
if (!this.flashActive) {
  return null  // NO OUTPUT = Sangrado permitido
}

const output = {
  zones: [activeZone],  // Solo lado activo
  zoneOverrides: {
    [activeZone]: {
      color,
      dimmer: intensity,
      blendMode: 'max',  // HTP = Permite sangrado
    },
  },
}
```

#### ✅ DESPUÉS (Dimmer Lock):
```typescript
// 🔦 WAVE 985: DIMMER LOCK - NO MORE RETURN NULL
const intensity = this.flashActive 
  ? this.triggerIntensity * this.config.strobeIntensity
  : 0  // 🔦 EXPLÍCITO: dimmer=0 en fase dark

const output = {
  zones: ['movers_left', 'movers_right'],  // 🔦 AMBOS LADOS SIEMPRE
  zoneOverrides: {
    // LADO ACTIVO: Strobe ON
    [activeZone]: {
      dimmer: intensity,
      blendMode: 'replace',  // 🔦 LTP = Override estricto
    },
    // LADO DARK: Blackout forzado
    [darkZone]: {
      dimmer: 0,  // 🔦 EXPLÍCITO: Negro absoluto
      blendMode: 'replace',  // 🔦 APLASTA el layer inferior
    },
  },
}
```

---

## 🔑 CAMBIOS CLAVE

### 1. Eliminación de `return null`
```typescript
// ❌ ANTES:
if (!this.flashActive) return null

// ✅ AHORA:
const intensity = this.flashActive ? strobeIntensity : 0
// Siempre emite output
```

### 2. Control de AMBOS lados
```typescript
// ❌ ANTES:
zones: [activeZone]  // Solo el lado ON

// ✅ AHORA:
zones: ['movers_left', 'movers_right']  // Ambos lados controlados
```

### 3. BlendMode: 'replace' (LTP)
```typescript
// ❌ ANTES:
blendMode: 'max'  // HTP = Permite sangrado

// ✅ AHORA:
blendMode: 'replace'  // LTP = Override estricto, APLASTA inferior
```

### 4. Dimmer explícito en lado DARK
```typescript
[darkZone]: {
  dimmer: 0,  // ✅ Negro explícito, no implícito
  blendMode: 'replace',
}
```

---

## 🛡️ INTEGRACIÓN CON WAVE 984

CyberDualism es **EXCEPCIÓN** a THE MOVER LAW porque:

1. **Duración total**: ~900ms (6 cycles × 150ms)
2. **Cycles individuales**: 150ms cada uno
3. **Cambios de color**: Instantáneos (strobe), no graduales

```typescript
zoneOverrides: {
  [activeZone]: {
    color,  // ✅ PERMITIDO: Strobe <1s es SAFE para ruedas mecánicas
    dimmer: intensity,
    blendMode: 'replace',
  },
}
```

**Razón**: THE MOVER LAW protege contra modulación gradual de color en efectos >2s. CyberDualism es un **strobe rápido** donde la rueda solo hace 1 cambio por cycle (150ms), lo cual es manejable para LB230N.

---

## 🎨 COMPORTAMIENTO POST-FIX

### Modo Strobe (default):
```
Frame 1-60:   L=WHITE (1.0) | R=BLACK (0.0)
Frame 61-120: L=BLACK (0.0) | R=WHITE (1.0)
Frame 121-180: L=WHITE (1.0) | R=BLACK (0.0)
...
```

### Modo Chromatic:
```
Frame 1-60:   L=CYAN (1.0) | R=BLACK (0.0)
Frame 61-120: L=BLACK (0.0) | R=MAGENTA (1.0)
...
```

**Resultado**: Contraste puro, sin sangrado de capa inferior. Negro es NEGRO, no azul-lavado.

---

## 🔬 FÍSICA DEL BLENDING

### HTP (Highest Takes Precedence) - `blendMode: 'max'`
- **Pro**: Suma energía, efectos aditivos
- **Con**: Si efecto va a 0, permite sangrado del layer inferior

### LTP (Latest Takes Precedence) - `blendMode: 'replace'`
- **Pro**: Override estricto, controla todo
- **Con**: Puede "matar" otros efectos si priority es baja

**Elección para CyberDualism**: LTP porque necesita **control absoluto** del negro para el contraste L/R.

---

## 🧪 VERIFICACIÓN

- ✅ Eliminado `return null` en fase DARK
- ✅ Ambos lados (`movers_left`, `movers_right`) siempre controlados
- ✅ `blendMode: 'replace'` para override estricto
- ✅ `dimmer: 0` explícito en lado apagado
- ✅ Integración con WAVE 984 (sin color override)
- ⏳ Pendiente: Test en hardware real con wash azul de fondo

---

## 📁 ARCHIVOS MODIFICADOS

1. `src/core/effects/library/techno/CyberDualism.ts`

---

**WAVE 985: DIMMER LOCK** - Negro es negro, no azul. Contraste puro en el ping-pong de los gemelos. 🔦
