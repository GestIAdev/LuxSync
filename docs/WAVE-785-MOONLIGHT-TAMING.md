# 🌙 WAVE 785 - MOONLIGHT TAMING

> **"De superluna cegadora a lunitas que insinúan"**

## 🎯 EL PROBLEMA

CumbiaMoon estaba **demasiado brillante**. Con `peakIntensity: 0.70` y color blanco puro (`l: 100`), iluminaba la sala como si fuera de día. Concepto de "luna llena" → **Superluna de Chernóbil**.

**La queja:** "Ilumina como si fuera de día"

## 💡 LA SOLUCIÓN: Plata Lunar

Dos ajustes quirúrgicos:

### 1. Intensidad Down

```typescript
peakIntensity: 0.30  // Antes: 0.70 → TOPE DRAMÁTICO
```

**30%** es el sweet spot para "lunitas pequeñas" - se ve el foco encendido pero NO baña la pista de luz.

### 2. Color: Blanco Puro → Plata Lunar

```typescript
// ANTES (WAVE 770): Blanco puro hiriente
colorCycle: [
  { h: 0, s: 0, l: 80 },   // Blanco suave
  { h: 0, s: 0, l: 100 },  // 💥 LUNA SUPERNOVA
  { h: 0, s: 0, l: 70 },   // Blanco tenue
]

// AHORA (WAVE 785): Plata lunar que insinúa
colorCycle: [
  { h: 210, s: 10, l: 60 },  // Plata tenue
  { h: 210, s: 10, l: 70 },  // 🌙 PLATA LUNAR (pico)
  { h: 210, s: 10, l: 55 },  // Plata oscura
]
```

**Plata Lunar:**
- `h: 210` → Azul pálido (toque frío)
- `s: 10` → Casi monocromo (sutileza)
- `l: 70` → Luminosidad moderada (NO hiriente)

## 🎨 FILOSOFÍA

```
Blanco Puro (l: 100) = SOL ARTIFICIAL
Plata Lunar (h: 210, s: 10, l: 70) = INSINUACIÓN NOCTURNA

La luna NO grita "¡AQUÍ ESTOY!"
La luna susurra "aquí estoy... si me buscas"
```

## 📊 ANTES vs DESPUÉS

| Parámetro | WAVE 770 (Superluna) | WAVE 785 (Lunitas) |
|-----------|---------------------|-------------------|
| peakIntensity | 0.70 (70%) | 0.30 (30%) |
| Color pico | Blanco puro (l: 100) | Plata lunar (h: 210, s: 10, l: 70) |
| Impacto | "Ilumina como de día" | "Lunitas pequeñas y sutiles" |
| blendMode | `'replace'` ✅ | `'replace'` ✅ |

## 🔧 BLEND MODE INTACTO

`blendMode: 'replace'` se mantiene para que:
1. La luna oscurezca el fondo (física silenciada)
2. El contraste entre luna tenue y negro profundo sea visible
3. La "insinuación" destaque sobre negrura absoluta

**Replace + Low Dimmer = Magia lunar**

---

**WAVE 785 - Porque la luna no compite con el sol.**

*"Plata lunar sobre negrura - eso es elegancia"*
