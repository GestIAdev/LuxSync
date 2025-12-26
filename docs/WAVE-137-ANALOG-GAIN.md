# 🔊 WAVE 137: THE ANALOG GAIN (BRIGHTNESS UNCHAINED)

## 📋 Diagnóstico

**Problema detectado en WAVE 136:**
- Umbrales excesivos (SNARE 0.45, KICK 0.40)
- Back Pars "muertos" con Queen y pop clásico
- El contenido de mids nunca superaba el umbral → Sin reactividad

**Síntoma:** Los Back Pars no reaccionaban a la música porque los umbrales eran demasiado altos.

## 🔧 Solución Implementada

### Fix 1: Sweet Spot Thresholds
```typescript
// WAVE 135: 0.20/0.25 (demasiado bajo - epilepsia)
// WAVE 136: 0.45/0.40 (demasiado alto - muerto)
// WAVE 137: 0.32/0.35 (justo en el medio - balance)
const SNARE_THRESHOLD = 0.32
const KICK_THRESHOLD = 0.35
```

### Fix 2: Brightness Injection
```typescript
// Snare: Flash Tungsteno con L:95 (forzar encendido visual)
accentLight = 95  // Era L:100, bajamos ligeramente para evitar clip

// Kick: Golpe con L:80 (punch visual)
accentLight = 80  // Era L:70, subido para más impacto
```

### Fix 3: Front Par Liberado
```typescript
// WAVE 137: Front Par liberado a L:60 (sin cap de Techno)
this.lastColors.primary = hslToRgbRock(primaryHue, 100, 60)   // L:60 (era 50)
this.lastColors.secondary = hslToRgbRock(secondaryHue, 100, 55)  // L:55 (boost)
this.lastColors.ambient = hslToRgbRock(ambientHue, 100, 55)   // L:55 (boost)
```

## 📊 Evolución de Umbrales Pop/Rock

| Wave | SNARE | KICK | Resultado |
|------|-------|------|-----------|
| 135 | 0.20 | 0.25 | Epilepsia (Dream Theater) |
| 136 | 0.45 | 0.40 | Muerto (Queen) |
| **137** | **0.32** | **0.35** | **Sweet Spot** |

## 🎨 Paleta (Sin Cambios desde WAVE 136)

La paleta Stadium Contrast se MANTIENE:
- **Primary:** baseHue (Front)
- **Secondary:** +180° Complementario (Mover L)
- **Ambient:** +120° Triada (Mover R)
- **Accent:** Secondary default, Snare=Tungsteno, Kick=Primary

## 🏷️ UI Label

`getStrategyLabel()` actualizado:
- WAVE 135: "ROCK DYNAMICS"
- WAVE 136: "STADIUM CONTRAST"
- **WAVE 137: "STADIUM DYNAMICS"**

## 🔍 Debug Log

```
[WAVE137] ANALOG GAIN | Base:30 | MidPulse:0.28 | BassPulse:0.31 | Snare:false | Kick:false | AccentL:50
[WAVE137] ANALOG GAIN | Base:30 | MidPulse:0.45 | BassPulse:0.22 | Snare:true | Kick:false | AccentL:95
```

## ✅ Verificación de Caps

Se buscaron caps de brillo globales (`brightness.*0.78`, `maxBrightness`) - **No encontrados**.
El bloque Pop/Rock tiene control directo sobre HSL sin interferencias.

## 🎵 Testing Recomendado

1. **Queen - Bohemian Rhapsody** (Pop clásico, dinámica amplia)
2. **AC/DC - Back in Black** (Rock directo, kick/snare claros)
3. **Bon Jovi - Livin' on a Prayer** (Arena rock, subidas épicas)
4. **Dream Theater - Pull Me Under** (Prog rock, verificar que no hay epilepsia)

## 📁 Archivos Modificados

- `electron-app/src/main/selene-lux-core/SeleneLux.ts`
  - Umbrales actualizados (0.32/0.35)
  - Brightness injection (L:95/L:80)
  - Front Par L:60, Secondary/Ambient L:55
  - Header actualizado a WAVE 137
  - Debug log actualizado
  - getStrategyLabel() → "STADIUM DYNAMICS"

---
*WAVE 137 - THE ANALOG GAIN: Brightness Unchained 🔊*
