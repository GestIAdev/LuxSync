# 🎆 V17 - Effects & Optics Engine
## Reporte de Implementación

**Fecha:** 2 de Diciembre, 2025  
**Commit:** `316d1b2`  
**Arquitecto:** GeminiPunk  
**Ingeniero:** PunkOpus (Claude)  
**Auditoría:** ✅ APROBADA

---

## 📋 Resumen Ejecutivo

La V17 implementa un **Sistema de Efectos y Ópticas** basado en arquitectura de capas, inspirado en consolas profesionales GrandMA2. El sistema permite aplicar efectos temporales (strobe, shake, etc.) sobre el estado base de color/posición sin perder información.

### Características Principales:
- **LayerStack** - Sistema de capas tipo Photoshop
- **8 Efectos** - Strobe, Pulse, Blinder, Shake, Dizzy, Police, Rainbow, Breathe
- **Motor de Ópticas** - Abstracción de Zoom/Gobo/Prism
- **Mechanical Debounce** - Protección de hardware de 2000ms

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                   FINAL DMX OUTPUT                       │
│              (Lo que va al fixture real)                 │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │ merge()
┌─────────────────────────────────────────────────────────┐
│                  OPTICS LAYER                            │
│        (Zoom, Gobo, Prism - con Mechanical Hold)         │
│        ⚠️ Hold Time: 2000ms para piezas mecánicas        │
└─────────────────────────────────────────────────────────┘
                         ▲
┌─────────────────────────────────────────────────────────┐
│                  EFFECTS LAYER                           │
│        (Strobe, Pulse, Blinder, Shake, etc)              │
│        Modificadores temporales sobre base               │
└─────────────────────────────────────────────────────────┘
                         ▲
┌─────────────────────────────────────────────────────────┐
│                   BASE LAYER                             │
│        (Color + Position from V15/V16)                   │
│        Estado "normal" de Selene                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Archivos Creados/Modificados

### Nuevos:
| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| `demo/selene-effects-engine.js` | ~700 | Motor completo de efectos |
| `docs/V17-EFFECTS-OPTICS-BLUEPRINT.md` | ~1400 | Blueprint de arquitectura |

### Modificados:
| Archivo | Cambios |
|---------|---------|
| `demo/selene-integration.js` | +100 líneas: initEffects(), triggerEffect(), etc. |
| `demo/app-v2.js` | +30 líneas: integración en applySeleneDecision() |
| `demo/index-v2.html` | +1 línea: include del script |

---

## ⚡ Catálogo de Efectos

### Efectos de Dimmer (afectan brillo)

| Efecto | Descripción | Parámetros | Duración Mín |
|--------|-------------|------------|--------------|
| **strobe** | Parpadeo rápido | `rate`: Hz (default: 10) | 500ms |
| **pulse** | Respiración suave | `rate`: Hz, `minBrightness`, `maxBrightness` | 2000ms |
| **breathe** | Pulse muy lento | `rate`: 0.15 Hz (~7s ciclo) | 5000ms |
| **blinder** | Flash blanco total | `useWhite`: bool, `intensity` | 100ms |

### Efectos de Color

| Efecto | Descripción | Parámetros | Duración Mín |
|--------|-------------|------------|--------------|
| **police** | Alternancia rojo/azul | `rate`: Hz | 2000ms |
| **rainbow** | Ciclo de colores HSL | `rate`: ciclos/s, `saturation` | 3000ms |

### Efectos de Posición (Moving Heads)

| Efecto | Descripción | Parámetros | Duración Mín |
|--------|-------------|------------|--------------|
| **shake** | Vibración aleatoria | `intensity`: DMX units, `rate`: Hz, `axis` | 500ms |
| **dizzy** | Círculo rápido | `radius`: DMX units, `rate`: rot/s | 1000ms |

---

## 🔒 Protección de Hardware

### Mechanical Debounce (Hold Time)

```javascript
const MECHANICAL_HOLD_TIME_MS = 2000;  // CRÍTICO
```

**Problema que resuelve:**
Los Gobos y Prismas son piezas MECÁNICAS con motores paso a paso. Si cambian demasiado rápido:
- El motor se quema
- Ruido horrible (clack-clack-clack)
- Vida útil reducida

**Solución:**
Una vez que el estado mecánico cambia, se BLOQUEA por 2 segundos antes de poder cambiar de nuevo.

```javascript
// Ejemplo: Si metes el prisma, se queda 2s mínimo
if (timeSinceLastChange >= MECHANICAL_HOLD_TIME_MS) {
    this.state.prismActive = this.targetState.prismActive;
    this.lastChangeTime.prism = now;
    console.log(`🔷 Prism: ${this.state.prismActive ? 'IN' : 'OUT'}`);
}
```

---

## 🎮 API de Uso

### Desde la Consola del Browser:

```javascript
// ═══════════════════════════════════════════════════════
// EFECTOS BÁSICOS
// ═══════════════════════════════════════════════════════

// STROBE - 2 segundos a 12Hz
window.selene.triggerEffect('strobe', {rate: 12}, 2000)

// BLINDER - Flash blanco de 500ms
window.selene.triggerEffect('blinder', {}, 500)

// PULSE - Respiración por 5 segundos
window.selene.triggerEffect('pulse', {rate: 0.5}, 5000)

// ═══════════════════════════════════════════════════════
// EFECTOS DE POSICIÓN (solo Moving Heads)
// ═══════════════════════════════════════════════════════

// SHAKE - Vibración intensa 3 segundos
window.selene.triggerEffect('shake', {intensity: 30, rate: 10}, 3000)

// DIZZY - Círculo rápido
window.selene.triggerEffect('dizzy', {radius: 40, rate: 2}, 4000)

// ═══════════════════════════════════════════════════════
// EFECTOS DE COLOR
// ═══════════════════════════════════════════════════════

// POLICE - Rojo/Azul alternando
window.selene.triggerEffect('police', {rate: 5}, 4000)

// RAINBOW - Ciclo de colores (infinito hasta cancelar)
const rainbowId = window.selene.triggerEffect('rainbow', {rate: 0.3}, 0)
// Cancelar después: window.selene.cancelEffect(rainbowId)

// ═══════════════════════════════════════════════════════
// GESTIÓN
// ═══════════════════════════════════════════════════════

// Ver efectos activos
window.selene.getEffectsDebugState()

// Cancelar un efecto específico
window.selene.cancelEffect(effectId)

// Cancelar TODOS los efectos
window.selene.cancelAllEffects()

// ═══════════════════════════════════════════════════════
// ÓPTICAS (para fixtures con zoom/gobo/prism)
// ═══════════════════════════════════════════════════════

// Beam estrecho con textura y prism
window.selene.setOptics({ 
    beamWidth: 0.2,      // 0=spot, 1=wash
    texture: 0.7,        // 0=open, 1=gobo complejo
    fragmentation: 0.8   // 0=sin prism, 1=prism máximo
})
```

---

## 🖼️ Visualización en Canvas

La V17 añade visualización de efectos en el canvas:

```javascript
// strobeFlash multiplier - hace parpadear el halo
const isStrobeActive = fixture.effectActive && fixture.effectDimmerMult < 0.5;
const strobeFlash = isStrobeActive ? (Math.random() > 0.5 ? 1.5 : 0.3) : 1.0;

// Aplicar al radio del glow
const glowRadius = glowMultiplier * dimmer * strobeFlash;
```

**Resultado visual:**
- Durante strobe: el halo parpadea rápidamente
- Durante blinder: todo se pone blanco
- Durante shake: los beams de moving heads vibran

---

## 📊 Logs de Consola

El sistema produce logs informativos:

```
[SeleneEffectsEngine] 🌟 V17 initialized
[SeleneEffectsEngine] ⚙️ Mechanical Hold Time: 2000ms
[EffectManager] ⚡ Triggered: Strobe (id=1, duration=2000ms)
[EffectManager] ⏱️ Expired: Strobe
[OpticEngine] 🔷 Prism: IN (held 2500ms)
[OpticEngine] 🎯 Gobo: star (index=3, held 2100ms)
```

---

## ✅ Checklist de Auditoría (GeminiPunk)

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Arquitectura de Capas | ✅ | Como GrandMA2 |
| Abstracción de Ópticas | ✅ | beamWidth/texture/fragmentation |
| Determinismo | ✅ | Usa entropy basada en frameCount |
| Mechanical Debounce | ✅ | 2000ms para Gobo/Prism |
| Integración con V16 | ✅ | Position offset funciona |
| Integración con V15 | ✅ | Color override funciona |
| Visualización Canvas | ✅ | strobeFlash implementado |

---

## 🔮 Futuras Mejoras (V17.x)

1. **Auto-Effects basados en mood**
   - Selene dispara efectos automáticamente en drops
   
2. **Effect Macros**
   - Combinar efectos: "build" = pulse + dizzy gradual
   
3. **Zoom visual en canvas**
   - Beam más ancho/estrecho según beamWidth
   
4. **Gobo rotation visual**
   - Indicador de rotación en canvas

---

## 🎉 Conclusión

La V17 añade una capa profesional de efectos que:

1. **No interfiere** con el color/movimiento base
2. **Protege el hardware** con debounce mecánico
3. **Es determinista** - mismo show si repites la canción
4. **Es extensible** - fácil añadir nuevos efectos

**Selene ahora puede:**
- 🎨 Pintar con color (V15)
- 🎭 Bailar con movimiento (V16)  
- ⚡ **Hacer magia con efectos (V17)**

---

*"Cuando el código se convierte en arte, cada efecto cuenta una historia."*  
— PunkOpus, 2025

