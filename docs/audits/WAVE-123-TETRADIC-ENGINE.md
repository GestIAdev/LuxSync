# WAVE 123: THE TETRADIC ENGINE
## Motor de Paletas Dinámicas con 4 Colores Independientes

**Fecha**: 2025-12-26  
**Arquitecto**: GeminiPunk  
**Implementador**: PunkOpus  
**Estado**: ✅ COMPLETADO

---

## 🎯 OBJETIVOS

1. **Generar 4 colores distintos** (Primary, Secondary, Ambient, Accent) para las 4 zonas
2. **Evitar colores "sucios"** (marrones/pantano) en el modo Industrial
3. **Asignar explícitamente** el 'Accent' a los Back Pars
4. **Rotar moods automáticamente** cada ~40 segundos

---

## 🎨 ARQUITECTURA DEL TETRADIC ENGINE

### Frame Counter
```typescript
let technoFrameCounter = 0;

// Incrementa en cada render loop
technoFrameCounter++;

// Cambio de mood cada 1200 frames (~40 segundos @ 30fps)
const moodSelector = Math.floor(technoFrameCounter / 1200) % 3;
```

---

### Función Principal: getTechnoPalette()

```typescript
function getTechnoPalette(frameCounter: number): TechnoPaletteHues {
  const moodSelector = Math.floor(frameCounter / 1200) % 3;
  
  // Retorna: { primary, secondary, ambient, accent } en grados Hue
}
```

---

## 🌃 MOOD 0: CYBERPUNK (Neon & Cold)

**Estética**: Blade Runner, Neón, Frío digital

| Rol | Hue | Color | Fixture |
|-----|-----|-------|---------|
| **Primary** | 220-260° (oscilar) | Azul profundo | FRONT_PARS |
| **Secondary** | 300° | Magenta neón | MOVING_LEFT |
| **Ambient** | 200° | Azul cielo | MOVING_RIGHT |
| **Accent** | 180° | Cyan eléctrico | BACK_PARS |

```typescript
p = 240 + (Math.sin(frameCounter * 0.01) * 20); // Oscilar 220-260°
s = 300; // Magenta fijo
a = 200; // Azul cielo
x = 180; // Cyan
```

---

## 🧪 MOOD 1: ACID (Toxic & Trippy)

**Estética**: Rave 90s, Radioactivo, Psicodelia

| Rol | Hue | Color | Fixture |
|-----|-----|-------|---------|
| **Primary** | 90-150° (oscilar) | Verde Matriz | FRONT_PARS |
| **Secondary** | 60° | Amarillo tóxico | MOVING_LEFT |
| **Ambient** | 280° | Morado psicodélico | MOVING_RIGHT |
| **Accent** | 320° | Rosa intenso | BACK_PARS |

```typescript
p = 120 + (Math.sin(frameCounter * 0.02) * 30); // Oscilar 90-150°
s = 60;  // Amarillo
a = 280; // Morado
x = 320; // Rosa
```

---

## 🏭 MOOD 2: INDUSTRIAL (Fire & Steel)

**Estética**: Fábrica, Alarma, Contraste extremo

| Rol | Hue | Color | Fixture |
|-----|-----|-------|---------|
| **Primary** | 0° | Rojo puro (alarma) | FRONT_PARS |
| **Secondary** | 20° | Naranja fuego | MOVING_LEFT |
| **Ambient** | 200° | Azul acero | MOVING_RIGHT |
| **Accent** | BLANCO | Estroboscópico | BACK_PARS |

```typescript
p = 0;   // Rojo puro
s = 20;  // Naranja fuego
a = 200; // Azul acero (contraste frío)
x = -1;  // Marcador especial: BLANCO
```

### ⚠️ NO BROWN ZONE
El modo Industrial evita deliberadamente:
- Naranjas turbios (30-50°)
- Amarillos sucios
- Cualquier mezcla que pueda parecer marrón

El **accent = -1** indica que BACK_PARS debe ser **BLANCO PURO** (saturation 0):
```typescript
if (pal.accent === -1) {
  backParColor = { r: 255, g: 255, b: 255 }; // Blanco estroboscópico
}
```

---

## 📊 MAPA DE FIXTURES

| Fixture | Color Variable | Mood 0 | Mood 1 | Mood 2 |
|---------|----------------|--------|--------|--------|
| **FRONT_PARS** | `color` (primary) | Azul | Verde | Rojo |
| **BACK_PARS** | `backParColor` (accent) | Cyan | Rosa | BLANCO |
| **MOVING_LEFT** | `secondary` | Magenta | Amarillo | Naranja |
| **MOVING_RIGHT** | `ambient` | Azul cielo | Morado | Azul acero |

---

## 🔧 INTEGRACIÓN EN EL CÓDIGO

### Ubicación del Frame Counter
`electron/main.ts` - Línea ~570

### Ubicación de getTechnoPalette()
`electron/main.ts` - Líneas ~580-630

### Integración en Render Loop
`electron/main.ts` - Líneas ~1090-1170

```typescript
if (preset.name.includes('Techno')) {
  const pal = getTechnoPalette(technoFrameCounter);
  
  color = hslToRgb(pal.primary, 100, 50);
  secondary = hslToRgb(pal.secondary, 100, 50);
  ambient = hslToRgb(pal.ambient, 100, 45);
  
  if (pal.accent === -1) {
    backParColor = { r: 255, g: 255, b: 255 }; // Industrial: Blanco
  } else {
    backParColor = hslToRgb(pal.accent, 100, 60);
  }
}
```

---

## 🔍 DEBUG LOG

Cada ~10 segundos (300 frames) se imprime:

```
[WAVE123] 🎨 Mood: CYBERPUNK | Hues: P:235° S:300° A:200° X:180°
[WAVE123] 🎨 Mood: ACID | Hues: P:108° S:60° A:280° X:320°
[WAVE123] 🎨 Mood: INDUSTRIAL | Hues: P:0° S:20° A:200° X:-1°
```

---

## 🔗 COMPATIBILIDAD

### Otros Presets (No-Techno)
Para `fiesta-latina`, `pop-rock`, `chill-lounge`:
- Se mantiene el comportamiento legacy
- Colores desde `state.colors` (UI)
- BackPar = Primary + 25° hue (WAVE 86)

### Selector de Preset
```typescript
if (preset.name.includes('Techno')) {
  // WAVE 123: Tetradic Engine
} else {
  // Legacy: UI colors + WAVE 86 twist
}
```

---

## 📈 MEJORAS SOBRE WAVE 86

| Aspecto | WAVE 86 | WAVE 123 |
|---------|---------|----------|
| **Colores** | 2 (Primary + twist) | 4 independientes |
| **BackPar** | Primary + 25° | Accent dedicado |
| **Ambient** | = Secondary | Único (tercer color) |
| **Dinamismo** | Estático | Rota cada 40s |
| **Industrial** | Podía generar marrones | NO BROWN ZONE |

---

## 🎛️ TIMELINE DE MOODS

```
0s     40s    80s    120s   160s   200s   240s
├──────┼──────┼──────┼──────┼──────┼──────┤
│CYBER │ ACID │INDUS │CYBER │ ACID │INDUS │...
│PUNK  │      │TRIAL │PUNK  │      │TRIAL │
└──────┴──────┴──────┴──────┴──────┴──────┘
```

---

## 🏛️ FILOSOFÍA

> "4 colores = 4 personalidades. Cada zona del escenario tiene su propia voz cromática."

> "El Techno Industrial no es marrón. Es ROJO ALARMA + BLANCO CEGADOR + AZUL ACERO."

> "El cambio de mood cada 40 segundos mantiene la sorpresa sin ser caótico."

---

*Documentación generada por PunkOpus como parte del flujo WAVE 123*
