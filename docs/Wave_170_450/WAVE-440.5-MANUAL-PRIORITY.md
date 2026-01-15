# WAVE 440.5: MANUAL PRIORITY FIX 🎯

**Fecha**: 15 Enero 2026  
**Arquitecto**: PunkOpus  
**Diagnóstico**: Radwulf (síntoma del "1 segundo azul")

---

## 🔍 SÍNTOMA REPORTADO

> "Al darle al botón de release, se pone azul (el color seleccionado) pero durante 1 segundo, después vuelve a su color normal"

Este síntoma fue **ORO DIAGNÓSTICO**. Indicaba que:
1. El valor del override SÍ llegaba al backend ✅
2. El valor estaba guardado correctamente ✅
3. PERO no se aplicaba durante el arbitrate normal ❌
4. Solo se veía durante el crossfade de release ✅

---

## 🎯 ROOT CAUSE: LTP vs TIMESTAMP RACE

```
DEFAULT_MERGE_STRATEGIES:
  red: 'LTP'    // Latest Takes Precedence
  green: 'LTP'
  blue: 'LTP'
  zoom: 'LTP'
  focus: 'LTP'
```

**El problema**:
1. Usuario pone override manual con `timestamp: performance.now()` (ej: T=1000)
2. Titan AI se actualiza **CADA FRAME** con nuevo timestamp (T=1033, T=1066...)
3. LTP = "el timestamp más reciente gana"
4. **Titan siempre gana porque su timestamp es más nuevo**

**Por qué el release mostraba el color**:
- `releaseManualOverride()` obtiene `currentValue` del override
- Inicia crossfade: `currentValue → titanValue`
- Durante ese crossfade (500ms), el valor manual ES visible
- Después, vuelve a Titan

---

## 🔧 SOLUCIÓN APLICADA

### Fix 1: Manual = Prioridad Absoluta

**Archivo**: `MasterArbiter.ts` → `mergeChannelForFixture()`

```typescript
// ANTES (WAVE 440):
if (manualOverride && manualOverride.overrideChannels.includes(channel)) {
  const manualValue = this.getManualChannelValue(manualOverride, channel)
  values.push({
    layer: ControlLayer.MANUAL,
    value: manualValue,
    timestamp: manualOverride.timestamp,  // ← ESTE TIMESTAMP PERDÍA
  })
}
// Luego llamaba a mergeChannel() con LTP → Titan ganaba

// DESPUÉS (WAVE 440.5):
if (manualOverride && manualOverride.overrideChannels.includes(channel)) {
  const manualValue = this.getManualChannelValue(manualOverride, channel)
  controlSources[channel] = ControlLayer.MANUAL
  return manualValue  // ← RETURN DIRECTO, SKIP MERGE
}
```

**Filosofía**: Cuando el usuario agarra el control, lo **MANTIENE** hasta que lo suelte. Sin competir con timestamps.

### Fix 2: Dimmer Initial State = Null

**Archivo**: `TheProgrammerContent.tsx`

```typescript
// ANTES:
const [currentDimmer, setCurrentDimmer] = useState(100)
// Problema: Botón 100% siempre aparecía activo

// DESPUÉS:
const [currentDimmer, setCurrentDimmer] = useState<number | null>(null)
// Y en IntensitySection:
value={currentDimmer ?? -1}  // -1 no matchea ningún preset
```

---

## ✅ CANALES AFECTADOS (Todos ahora con prioridad absoluta)

| Canal | Antes (LTP) | Después |
|-------|-------------|---------|
| red | Titan ganaba | **Manual gana** |
| green | Titan ganaba | **Manual gana** |
| blue | Titan ganaba | **Manual gana** |
| zoom | Titan ganaba | **Manual gana** |
| focus | Titan ganaba | **Manual gana** |
| gobo | Titan ganaba | **Manual gana** |
| prism | Titan ganaba | **Manual gana** |
| pan | Titan ganaba | **Manual gana** |
| tilt | Titan ganaba | **Manual gana** |
| dimmer | HTP (ya funcionaba) | Sin cambio |

---

## 📊 ANTES vs DESPUÉS

### Antes (LTP Race Condition):
```
Frame 1: User sets color blue (T=1000)
Frame 2: Titan updates (T=1033) → LTP picks Titan → Blue invisible
Frame 3: Titan updates (T=1066) → LTP picks Titan → Blue invisible
...
Release: Crossfade starts from blue → Blue visible for 500ms
```

### Después (Manual Priority):
```
Frame 1: User sets color blue (T=1000)
Frame 2: Manual override exists → RETURN blue directly → Blue visible ✅
Frame 3: Manual override exists → RETURN blue directly → Blue visible ✅
...
Release: Crossfade starts from blue → Blue fades to Titan
```

---

## 🧪 TEST PLAN

1. **Color Test**:
   - Seleccionar fixture
   - Click botón "B" (azul)
   - Verificar que el fixture SE PONE azul inmediatamente
   - Verificar que MANTIENE azul mientras no hagas release

2. **Zoom Test**:
   - Seleccionar moving head
   - Abrir BEAM / OPTICS
   - Mover slider Zoom al 9%
   - Verificar que el microdebug muestra ~9% (no 45%)
   - Verificar que el haz se hace más estrecho visualmente

3. **Dimmer Buttons Test**:
   - Abrir INTENSITY
   - Verificar que NINGÚN botón de % tiene clase `.active`
   - Click 75%
   - Verificar que SOLO 75% tiene `.active`

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---------|--------|
| `MasterArbiter.ts` | Manual override return directo sin merge |
| `TheProgrammerContent.tsx` | currentDimmer initial = null + reset en release |

**Detalles del reset**:
- `handleDimmerRelease()`: `setCurrentDimmer(null)` ✅
- `handleColorRelease()`: `setCurrentColor({ r: 128, g: 128, b: 128 })` ✅
- `handleUnlockAll()`: Reset ambos valores ✅
- `useEffect([selectedIds.length])`: Reset cuando cambia selección ✅

---

## 🩸 WAVE 440.5 COMPLETE

El sistema de control manual ahora funciona como debe:
- **Agarras = Controlas**
- **Sueltas = Selene retoma**
- Sin race conditions de timestamp
- Sin sorpresas

*"When the user grabs the wheel, they drive. Period."*
