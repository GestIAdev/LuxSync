# 🎨 CHANGELOG V14 - LIVING PALETTES

**Fecha:** 2 Diciembre 2025  
**Commit:** `2358b57`  
**Colaboración:** GeminiPunk (teoría) + Claude (implementación)

---

## 📋 RESUMEN

V14 reemplaza los arrays estáticos de colores RGB por un **motor de generación procedural HSL**. Los colores ahora "respiran" y evolucionan con el tiempo, haciendo que sesiones largas (2+ horas) sean visualmente más interesantes.

---

## 🆕 NUEVAS CARACTERÍSTICAS

### 1. Motor `getLivingColor(paletteName, intensity, zoneType)`

El corazón de Living Palettes. Genera colores matemáticamente en tiempo real.

**Parámetros:**
- `paletteName`: `'fuego'` | `'hielo'` | `'selva'` | `'neon'`
- `intensity`: `0-1` (normalizado)
- `zoneType`: `'wash'` (pars) | `'spot'` (moving heads)

**Características:**
```javascript
// 🕐 TIME DRIFT: El color "respira" cada ~15 segundos
const timeDrift = (Date.now() / 15000) % 1;
```

### 2. Paletas Simplificadas

**Antes (V13):**
```javascript
this.PALETTES = {
  fuego: {
    front: { base: { r: 255, g: 0, b: 0 }, accent: { r: 255, g: 80, b: 0 } },
    back: { base: {...}, accent: {...} },
    left: { base: {...}, accent: {...} },
    right: { base: {...}, accent: {...} },
    peakAccents: [...],
    hsl: { hueMin, hueMax, satMin, satMax, lightMin, lightMax },
  },
  // ~100 líneas de arrays RGB...
}
```

**Ahora (V14):**
```javascript
this.PALETTES = {
  fuego: { 
    name: 'Fuego Vivo', 
    icon: '🔥', 
    type: 'dynamic',
    // El color se calcula proceduralmente
  },
  // ~30 líneas de IDENTIDAD, no datos
}
```

### 3. Comportamiento por Paleta

#### 🔥 FUEGO (Latino, Reggaeton, Salsa)
- **Base:** Brasa oscura (H:15, L:25) → Llama dorada (H:45, L:60)
- **Sorpresa:** Violeta en spots cuando `intensity > 0.8` (20% probabilidad)
- **Drift:** ±10° de variación en el hue

#### ❄️ HIELO (Chill, Ambient, Downtempo)
- **Nunca negro:** `minIntensity: 0.25` (siempre elegante)
- **Base:** Azul profundo → Blanco estroboscópico
- **Aurora:** En washes con energía alta + drift > 0.7, shift a verde-cyan
- **Saturación inversa:** Más intenso = más desaturado (blanco)

#### 🌿 SELVA (Tropical House, Reggae)
- **Base:** Verde esmeralda (H:120) → Turquesa (H:140)
- **Flores:** Los spots muestran magenta/rosa cuando `intensity > 0.5` (40% prob)
- **Tropical:** Saturación siempre alta (75-100%)

#### ⚡ NEÓN (Techno, Cyberpunk, EDM)
- **Binario:** No hay gradientes suaves
- **Blackouts:** Si `intensity < 0.3`, es negro total
- **Pares complementarios:** Rotan cada 30 segundos
  - Ciclo 0: Magenta ↔ Cyan
  - Ciclo 1: Violeta ↔ Amarillo
  - Ciclo 2: Azul Eléctrico ↔ Naranja

---

## 🔄 CAMBIOS EN `calculateZoneColors()`

El método principal de renderizado ahora usa `getLivingColor()`:

```javascript
// ANTES (V13):
frontColor = this._lerpColor(palette.front.base, palette.front.accent, t);

// AHORA (V14):
const bassNormalized = Math.min(1, (bass - BASS_THRESHOLD) / (1 - BASS_THRESHOLD));
frontColor = this.getLivingColor(this.activePalette, bassNormalized, 'wash');
```

### Zones y zoneType

| Zona | zoneType | Comportamiento |
|------|----------|----------------|
| Front Pars | `'wash'` | Colores amplios, graduales |
| Back Pars | `'wash'` | Igual que front |
| Moving Left | `'spot'` | Sorpresas (violeta, flores) |
| Moving Right | `'spot'` | Igual que left con ligero offset |

---

## ✅ PRESERVADO DE V13.2

- ✅ Sistema de blackouts (300ms) y silencios
- ✅ Filtro bass rumble: `bass > 0.6 AND treble < 0.20` → moving heads OFF
- ✅ Formula back pars: `80% treble + 20% mid` (evita voces)
- ✅ `shouldMovingHeadsRespond()` para shakers

---

## 🔧 COMPATIBILIDAD

Los métodos legacy ahora son wrappers del nuevo motor:

```javascript
/**
 * @deprecated Use getLivingColor() instead
 */
getPaletteColors(zone, intensity) {
  const normalizedIntensity = intensity / 255;
  const zoneType = (zone === 'front' || zone === 'back') ? 'wash' : 'spot';
  return this.getLivingColor(this.activePalette, normalizedIntensity, zoneType);
}
```

---

## 📊 MÉTRICAS

| Métrica | V13 | V14 | Cambio |
|---------|-----|-----|--------|
| Líneas PALETTES | ~100 | ~30 | -70% |
| Métodos de color | 3 | 1+2 wrappers | Simplificado |
| Colores únicos/hora | ~50 | ~∞ | Procedural |

---

## 🧪 TESTING

### Verificar en Demo

1. Abrir `http://localhost:3000`
2. Seleccionar cada paleta y verificar:
   - 🔥 Fuego: Rojos → Naranjas → Amarillos, violeta ocasional
   - ❄️ Hielo: Nunca negro total, auroras en momentos altos
   - 🌿 Selva: Verde base, flores magenta en moving heads
   - ⚡ Neón: Colores duros, rotación cada 30s

### Verificar Time Drift

```javascript
// En consola del navegador:
setInterval(() => {
  const drift = (Date.now() / 15000) % 1;
  console.log('Time drift:', drift.toFixed(2));
}, 1000);
```

---

## 🔮 FUTURO (Ideas para V15+)

- [ ] BPM sync para time drift (respirar al ritmo)
- [ ] Personalización de paletas desde UI
- [ ] Modo "DJ Override" para forzar colores específicos
- [ ] Exportar configuración de paleta como JSON

---

*Documentado por Claude en colaboración con GeminiPunk*
