# 🔗 WAVE 991 - THE MISSING LINK (BUS FIX)

> **"El cable que conecta el Railway Switch con el Orchestrator"**

**Fecha**: WAVE 991
**Tipo**: CRITICAL BUGFIX
**Estado**: ✅ **COMPLETE**

---

## 🐛 EL BUG

### **Síntoma**
Los efectos con `mixBus='global'` (como CoreMeltdown, CyberDualism) no estaban generando oscuridad real. La física seguía "sangrando" debajo del efecto.

### **Root Cause**
El problema estaba en **DOS lugares**:

#### **1. EffectManager.ts - Variable Compartida**
```typescript
// ❌ BUG: highestPriority se actualizaba SOLO cuando había colorOverride
if (output.colorOverride && effect.priority > highestPriority) {
  highestPriority = effect.priority
  highestPriorityColor = output.colorOverride
}

// ❌ BUG: La comparación usaba highestPriority que podía no haberse actualizado
if (effect.priority > highestPriority || ...) {
  dominantMixBus = effect.mixBus  // Nunca se ejecutaba correctamente
}
```

Si un efecto (ej: CoreMeltdown prioridad 100) NO tenía `colorOverride` (usa `zoneOverrides` en su lugar), la comparación era incorrecta.

#### **2. TitanOrchestrator.ts - mixBus Ignorado en zoneOverrides**
```typescript
// ❌ BUG: El blendMode se leía del zoneData, IGNORANDO el mixBus del efecto
const blendMode = zoneData.blendMode || 'max'  // Default HTP aunque mixBus='global'

if (blendMode === 'replace') {
  finalDimmer = effectDimmer
} else {
  finalDimmer = Math.max(physicsDimmer, effectDimmer)  // HTP siempre
}
```

Aunque el efecto tenía `mixBus='global'`, el Orchestrator seguía usando HTP para mezclar.

---

## 🛠️ LA SOLUCIÓN

### **Fix 1: EffectManager.ts - Variable Separada**

```typescript
// ✅ WAVE 991: Variables SEPARADAS para color y mixBus
let highestPriority = -1       // Para color (legacy)
let mixBusPriority = -1        // 🔗 WAVE 991: Para mixBus (THE MISSING LINK)

// ...

// Color: Solo se actualiza si hay colorOverride
if (output.colorOverride && effect.priority > highestPriority) {
  highestPriority = effect.priority
  highestPriorityColor = output.colorOverride
}

// 🔗 WAVE 991: mixBus tiene su PROPIA variable de prioridad
if (effect.priority > mixBusPriority || 
    (effect.priority === mixBusPriority && effect.mixBus === 'global')) {
  mixBusPriority = effect.priority
  dominantMixBus = effect.mixBus  // ✅ AHORA SÍ se ejecuta correctamente
}
```

**Cambio clave**: `mixBusPriority` es independiente de `highestPriority`.

### **Fix 2: TitanOrchestrator.ts - mixBus como Autoridad Máxima**

```typescript
// ✅ WAVE 991: isGlobalBus se calcula UNA VEZ y aplica a TODO
const isGlobalBus = effectOutput.mixBus === 'global'

// Para dimmer:
const blendMode = isGlobalBus ? 'replace' : (zoneData.blendMode || 'max')
// ↑ Si mixBus='global', FORZAR 'replace' siempre

// Para white/amber:
fixtureStates[index].white = isGlobalBus 
  ? effectWhite                              // LTP (dictador)
  : Math.max(physicsWhite, effectWhite)      // HTP (colaborador)
```

**Cambio clave**: `mixBus='global'` ahora es **LEY** para dimmer, white y amber.

---

## 📊 ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---------|--------|
| `EffectManager.ts` | +`mixBusPriority` variable separada |
| `TitanOrchestrator.ts` | `isGlobalBus` como autoridad máxima |

### **Líneas Modificadas**

#### EffectManager.ts
- Línea ~362: Agregada variable `mixBusPriority = -1`
- Línea ~417-420: Lógica del mixBus ahora usa `mixBusPriority`

#### TitanOrchestrator.ts
- Línea ~388: `isGlobalBus` movido afuera del bloque dimmer
- Línea ~426: `blendMode` ahora respeta `isGlobalBus`
- Línea ~463, ~470: white/amber ahora respetan `isGlobalBus`

---

## ✅ COMPORTAMIENTO ESPERADO DESPUÉS DEL FIX

### **Escenario: CoreMeltdown (mixBus='global', prioridad 100)**

```
ANTES (BUG):
  - CoreMeltdown envía dimmer=0 para blackout
  - TitanOrchestrator: Math.max(physics=0.8, effect=0) = 0.8
  - RESULTADO: La física sigue visible (sangrado) ❌

DESPUÉS (FIX):
  - CoreMeltdown envía dimmer=0 para blackout
  - TitanOrchestrator: isGlobalBus=true → blendMode='replace'
  - TitanOrchestrator: finalDimmer = effectDimmer = 0
  - RESULTADO: Negro real ✅
```

### **Escenario: CyberDualism (mixBus='global') - Ping Pong L/R**

```
ANTES (BUG):
  - LEFT=strobe, RIGHT=blackout (dimmer=0)
  - TitanOrchestrator RIGHT: Math.max(physics=0.5, effect=0) = 0.5
  - RESULTADO: El lado "dark" tenía luz de la física (sangrado) ❌

DESPUÉS (FIX):
  - LEFT=strobe, RIGHT=blackout (dimmer=0)
  - TitanOrchestrator RIGHT: isGlobalBus=true → dimmer=0
  - RESULTADO: El lado "dark" es NEGRO REAL ✅
```

### **Escenario: AcidSweep (mixBus='htp', prioridad 75)**

```
ANTES y DESPUÉS (sin cambio):
  - AcidSweep envía dimmer=0.6
  - TitanOrchestrator: isGlobalBus=false → blendMode='max'
  - TitanOrchestrator: Math.max(physics=0.8, effect=0.6) = 0.8
  - RESULTADO: HTP funciona correctamente ✅
```

---

## 🔑 REGLAS DEL RAILWAY SWITCH POST-FIX

### **Flujo de Datos**

```
┌────────────────────────────────────────────────────────────────────────┐
│ EFECTO (Ej: CoreMeltdown)                                              │
│ ┌──────────────────────────────────────────────────────────────────┐   │
│ │ readonly mixBus = 'global' as const  // ← DECLARACIÓN           │   │
│ │ readonly priority = 100               // ← PRIORIDAD            │   │
│ └──────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ EffectManager.generateEffectOutput()                                   │
│ ┌──────────────────────────────────────────────────────────────────┐   │
│ │ // 🔗 WAVE 991: Variable SEPARADA para mixBus                   │   │
│ │ if (effect.priority > mixBusPriority || global_wins) {          │   │
│ │   mixBusPriority = effect.priority                              │   │
│ │   dominantMixBus = effect.mixBus  // ← 'global'                 │   │
│ │ }                                                                │   │
│ │                                                                  │   │
│ │ return { mixBus: dominantMixBus, ... }  // ← SE PROPAGA         │   │
│ └──────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TitanOrchestrator.processEffects()                                     │
│ ┌──────────────────────────────────────────────────────────────────┐   │
│ │ // 🔗 WAVE 991: mixBus es la AUTORIDAD MÁXIMA                   │   │
│ │ const isGlobalBus = effectOutput.mixBus === 'global'            │   │
│ │                                                                  │   │
│ │ // Dimmer: Global = LTP, HTP = Max                              │   │
│ │ const blendMode = isGlobalBus ? 'replace' : 'max'               │   │
│ │ finalDimmer = blendMode === 'replace' ? effectDimmer : max()    │   │
│ │                                                                  │   │
│ │ // White/Amber: También respetan mixBus                         │   │
│ │ white = isGlobalBus ? effectWhite : max()                       │   │
│ │ amber = isGlobalBus ? effectAmber : max()                       │   │
│ └──────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                          ┌────────────────┐
                          │  DMX OUTPUT    │
                          │  Negro = Negro │
                          │  ✅ CORRECTO   │
                          └────────────────┘
```

### **Jerarquía de Autoridad**

```
1. effect.mixBus ('global' | 'htp')     ← LA LEY SUPREMA (WAVE 991)
2. zoneData.blendMode ('replace' | 'max') ← Solo si mixBus='htp'
3. Default: 'max' (HTP)                   ← Fallback seguro
```

---

## 🧪 TESTING

Para verificar el fix:

1. **CoreMeltdown**: Los blackouts deben ser NEGRO TOTAL
2. **CyberDualism**: El lado "dark" del ping-pong debe ser NEGRO REAL
3. **DigitalRain**: Las gotas deben cortar los bombos blancos de la física
4. **BinaryGlitch**: El contraste ON/OFF debe ser perfecto
5. **AcidSweep**: Debe seguir sumando (HTP) con la física

---

## 🔥 PUNK OPUS SIGNATURE

> *"El cable estaba desconectado. El tren pasaba pero las agujas no cambiaban."*
> 
> *"WAVE 991: El eslabón perdido entre el efecto y el output."*
> 
> *"Ahora cuando CoreMeltdown dice NEGRO, es NEGRO."*

---

**WAVE 991 - THE MISSING LINK: El cable que faltaba está conectado.**

*"🔗 mixBus='global' = DICTADOR REAL"*

---

# 🔗 WAVE 991: THE MISSING LINK - COMPLETE

