# 📺 WAVE 126: UI TRUTH - PalettePreview Limpio

**Fecha:** Diciembre 2025  
**Estado:** ✅ IMPLEMENTADO  
**Archivo:** `src/components/telemetry/PalettePreview/PalettePreview.tsx`

---

## 🎯 OBJETIVO

Reemplazar `PalettePreview.tsx` con versión **limpia** que:
- ✅ Lee datos REALES del backend (no recalcula)
- ✅ Mapea fixtures reales (FRONT_PARS, MOVER_L, MOVER_R, BACK_PARS)
- ✅ Detecta estado Strobe (blanco) en BACK_PARS
- ✅ Muestra hues derivados por el Techno Prism

---

## 🚫 PROBLEMAS DE LA UI ANTERIOR

### 1. **Recálculo Redundante**
```typescript
// ❌ ANTES: La UI calculaba sus propios colores
const baseHue = keyToHue[dna.key] || 0;
const secondary = calculateSecondary(baseHue, strategy);
```

**Problema:** La UI mostraba **colores teóricos**, no los que realmente se enviaban a fixtures.

### 2. **Estrategias Obsoletas**
```typescript
// ❌ ANTES: Labels de estrategias que ya no existen
const STRATEGY_LABELS = {
  'analogous': 'Análogo',
  'triadic': 'Triádico',
  ...
}
```

**Problema:** El backend (WAVE 125.1) usa derivación geométrica fija, no estrategias dinámicas.

### 3. **Mapeo Abstracto**
```typescript
// ❌ ANTES: Nombres genéricos sin mapeo a fixtures
<SwatchSlot label="PRIMARY" />
<SwatchSlot label="SECONDARY" />
<SwatchSlot label="ACCENT" />
```

**Problema:** No se sabía qué fixture mostraba qué color.

---

## ✅ WAVE 126: LA SOLUCIÓN

### Filosofía
> "La UI es un espejo, no un motor."

### Arquitectura

```
Backend (SeleneLux.ts)        →    Frontend (PalettePreview.tsx)
═══════════════════════════        ═══════════════════════════════
color (FRONT_PARS)            →    palette.primary.hex
secondary (MOVER_L)           →    palette.secondary.hex
ambient (MOVER_R)             →    palette.ambient.hex
backParColor (BACK_PARS)      →    palette.accent.hex
```

---

## 📡 HOOKS DE LA VERDAD

### Antes (Recálculo)
```typescript
// ❌ UI calculaba colores desde la Key
const baseHue = keyToHue[dna.key];
const primary = hslToHex(baseHue, 100, 50);
```

### Ahora (Lectura Directa)
```typescript
// ✅ UI lee lo que el backend decidió
const palette = useTruthPalette();
const currentPalette = {
  primary: palette?.primary?.hex || '#333',
  secondary: palette?.secondary?.hex || '#333',
  ambient: palette?.ambient?.hex || '#333',
  accent: palette?.accent?.hex || '#333'
};
```

---

## 🎨 SWATCHES MAPEADOS

### Mapeo Fixture Real

```tsx
{/* FRONT PARS (Base Fría) */}
<SwatchSlot 
  role="primary" 
  color={currentPalette.primary} 
  label="FRONT PARS" 
  subLabel={`Base: ${p_hue}°`}
  large={true} 
/>

{/* MOVER L (Melodía +60°) */}
<SwatchSlot 
  role="secondary" 
  color={currentPalette.secondary} 
  label="MOVER L"
  subLabel={`Melody: ${s_hue}°`} 
/>

{/* MOVER R (Triádico +120°) */}
<SwatchSlot 
  role="ambient" 
  color={currentPalette.ambient} 
  label="MOVER R" 
  subLabel={`Atmosphere: ${amb_hue}°`}
/>

{/* BACK PARS (Complementario +180° / Strobe) */}
<SwatchSlot 
  role="accent" 
  color={currentPalette.accent} 
  label="BACK PARS" 
  subLabel={isStrobe ? "⚪ FLASH" : `Accent: ${acc_hue}°`}
/>
```

---

## ⚪ DETECCIÓN DE STROBE

### Lógica Implementada

```typescript
// Detectar si BACK_PARS están en modo blanco (strobe)
const isStrobe = (palette?.accent?.s === 0 && palette?.accent?.l === 100);

// Mostrar "⚪ FLASH" en lugar de hue
subLabel={isStrobe ? "⚪ FLASH" : `Accent: ${acc_hue}°`}
```

### Estados Visuales

| Condición Backend | Swatch Label | Explicación |
|-------------------|--------------|-------------|
| `treblePulse > 0.6` | `⚪ FLASH` | Snare explosivo, blanco puro |
| `treblePulse ≤ 0.6` | `Accent: 60°` | Color complementario normal |

---

## 📊 DATA STREAM (Derivation Chain)

### Visualización del Flujo

```tsx
<div className="derivation-chain">
  <div className="chain-node">
    <span className="node-label">INPUT KEY</span>
    <span className="node-val">{dna?.key || '?'}</span>
  </div>
  <div className="chain-arrow">→</div>
  <div className="chain-node">
    <span className="node-label">ENGINE</span>
    <span className="node-val">PRISM FX</span>
  </div>
  <div className="chain-arrow">→</div>
  <div className="chain-node">
    <span className="node-label">OUTPUT BASE</span>
    <span className="node-val">{p_hue}°</span>
  </div>
</div>
```

**Muestra:**
1. Key de entrada (ej: `A`)
2. Procesamiento del Engine (`PRISM FX`)
3. Hue final de salida (ej: `240°` si fue enfriado por Cold Dictator)

---

## 🌡️ THERMAL BAR (Legacy)

```typescript
// Thermal temperature del MoodArbiter
const thermalTemp = cognitive?.thermalTemperature || 5000;
const thermalPercent = Math.min(100, Math.max(0, (thermalTemp - 2000) / 8000 * 100));
```

### Estados
- `< 4000K` → 🔥 WARM
- `4000-6000K` → ⚖️ NEUTRAL
- `> 6000K` → ❄️ COOL

---

## 🔄 COMPARATIVA ANTES/DESPUÉS

| Aspecto | ANTES (UI Calculadora) | AHORA (UI Espejo) |
|---------|------------------------|-------------------|
| Fuente de color | `keyToHue[key]` calculado | `palette.primary.hex` leído |
| Secondary | Calculado por estrategia | `palette.secondary.hex` leído |
| Ambient | Genérico | `palette.ambient.hex` (MOVER_R real) |
| Strobe | Sin detección | `isStrobe` visual |
| Mapeo | Abstracto (PRIMARY/SECONDARY) | Concreto (FRONT_PARS/MOVER_L) |

---

## 📋 CHANGELOG WAVE 126

### Eliminado
- ❌ `STRATEGY_LABELS` (obsoleto)
- ❌ `keyToHue` recálculo local
- ❌ `calculateSecondary()` lógica redundante
- ❌ Strategy wheel mini (ya no aplica)
- ❌ Tech readout HSL (demasiado técnico)

### Agregado
- ✅ Mapeo directo a fixtures reales
- ✅ Detección de estado Strobe
- ✅ Hues reales del backend (no teóricos)
- ✅ Labels descriptivos (MOVER_L, MOVER_R, etc.)
- ✅ Data Stream visual (INPUT → ENGINE → OUTPUT)

### Mantenido
- ✅ Thermal temperature bar
- ✅ Key + Mode display
- ✅ BPM display
- ✅ Online/Offline status

---

## 🎯 RESULTADO ESPERADO

### En Techno con Key A (La)

**Backend (WAVE 125.1):**
```
Input: A → 270° (Índigo)
Cold Dictator: isWarm=false → Sin cambio
baseHue = 270°

Derivaciones:
- FRONT_PARS: 270° (Violeta)
- MOVER_L: 270+60=330° (Rosa)
- MOVER_R: 270+120=390%360=30° → sanitize → 320° (Magenta)
- BACK_PARS: 270+180=450%360=90° (o ⚪ si strobe)
```

**UI WAVE 126:**
```
FRONT PARS: Base: 270° (Violeta)
MOVER L: Melody: 330° (Rosa)
MOVER R: Atmosphere: 320° (Magenta)
BACK PARS: ⚪ FLASH (o Accent: 90°)

Data Stream:
A → PRISM FX → 270°
```

---

## ✅ VERIFICACIÓN

### Checklist de Testing
- [ ] UI muestra los mismos colores que los fixtures físicos
- [ ] BACK_PARS muestra "⚪ FLASH" en snares fuertes
- [ ] Hues mostrados coinciden con logs del backend
- [ ] Data Stream muestra Key → OUTPUT correctamente
- [ ] Thermal bar funciona (opcional, legacy)

---

## 📚 REFERENCIAS

- **WAVE 125.1:** Techno Prism Full Spectrum (Backend)
- **WAVE 124:** Strobe Taming (Flash logic)
- **SeleneProtocol.ts:** Tipos de datos (`PaletteData`, `MusicalDNAData`)

---

*"La UI es un espejo. No calcula, refleja."*
