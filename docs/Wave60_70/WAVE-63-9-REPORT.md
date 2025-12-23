# 🔒 WAVE 63.9 - UI STATE INTERLOCKS

**Fecha:** 2024-12-22  
**Objetivo:** Interbloquear componentes UI con el estado de energía global

---

## 📋 RESUMEN

Se implementó un sistema de interlocks que sincroniza el estado visual de los componentes UI con el estado de energía global (`useSystemPower`). Cuando el sistema está apagado (OFFLINE), todos los controles aparecen en estado "dormido" (grises/deshabilitados), evitando que la UI "mienta" mostrando estados activos.

---

## 🔧 COMPONENTES BLOQUEADOS

### 1. **ModeSwitcherSleek.tsx**
- ✅ Suscrito a `useSystemPower`
- ✅ Cuando `powerState !== 'ONLINE'`:
  - `visualActiveMode` = `null` (ningún botón iluminado)
  - Botones deshabilitados (`disabled={!isOnline}`)
  - Clase CSS `.system-offline` aplicada
  - Indicador deslizante oculto
  - Power line en color `#222` (apagado)

### 2. **VibeSelector.tsx**  
- ✅ Suscrito a `useSystemPower`
- ✅ Cuando sistema está OFF:
  - `isActive` solo se muestra si `isActive && isSystemOn`
  - Bordes de color SOLO aparecen con `showActiveState`
  - Opacidad reducida al 40%
  - Cursor `not-allowed`
  - No hay glow/shadow
  - Tooltip cambia a "System offline"

### 3. **controlStore.ts**
- ✅ `globalMode` inicial cambiado a `null`
- ✅ Tipo `GlobalMode` ahora incluye `null`
- ✅ Cuando sistema se enciende → `setGlobalMode('selene')`
- ✅ Cuando sistema se apaga → `setGlobalMode(null)`

### 4. **useSystemPower.ts**
- ✅ `powerOn()` ahora establece `globalMode = 'selene'` al encender
- ✅ `powerOff()` ahora establece `globalMode = null` al apagar

---

## 🎨 ESTADO FINAL

### Sistema APAGADO (OFFLINE):
```
┌─────────────────────────────────────────────────────────────┐
│  [🔴 POWER]  COMMAND CENTER              [      |      |     ] │  ← Botones grises, sin highlight
├─────────────────────────────────────────────────────────────┤
│   AUDIO REACTOR      │      SELENE AI                        │
│                      ├───────────────────────────────────────┤
│                      │  [⚡] [🔥] [🎤] [🛋️]                   │  ← Vibes grises, sin bordes
└─────────────────────────────────────────────────────────────┘
```

### Sistema ENCENDIDO (ONLINE):
```
┌─────────────────────────────────────────────────────────────┐
│  [🟢 POWER]  COMMAND CENTER        [MANUAL|FLOW|✨SELENE✨]  │  ← SELENE activo, iluminado
├─────────────────────────────────────────────────────────────┤
│   AUDIO REACTOR      │      SELENE AI                        │
│                      ├───────────────────────────────────────┤
│                      │  [✨TECHNO✨] [🔥] [🎤] [🛋️]           │  ← Techno activo, borde cyan
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ TEST MANUAL

### Escenario 1: Arranque Frío
1. **Abrir la aplicación**
   - ❓ ¿El botón de Power está rojo pulsante?
   - ❓ ¿Los botones de modo (Manual/Flow/Selene) están grises y sin highlight?
   - ❓ ¿Los botones de Vibe están grises y sin bordes de color?

### Escenario 2: Encendido
1. **Pulsar el botón Power**
   - ❓ ¿El botón cambia a amarillo con spinner durante STARTING?
   - ❓ ¿Después de ~100ms cambia a cyan fijo?
   - ❓ ¿El modo SELENE se ilumina automáticamente?
   - ❓ ¿El Vibe activo (ej: Techno) muestra su borde de color?

### Escenario 3: Apagado
1. **Pulsar el botón Power (estando ON)**
   - ❓ ¿El botón vuelve a rojo pulsante?
   - ❓ ¿Todos los modos vuelven a estar grises?
   - ❓ ¿Todos los vibes pierden sus bordes de color?

---

## ⚠️ PROBLEMAS CONOCIDOS

1. **Ninguno detectado** - Todos los archivos compilan sin errores.

2. **Consideración de persistencia:** `controlStore` usa `persist` middleware de Zustand. El estado `globalMode` persiste en localStorage. Al recargar la app con sistema OFF, el modo persistido podría ser 'selene' del session anterior. Sin embargo, el interlock visual lo oculta correctamente porque depende de `isOnline`.

3. **Edge case:** Si el usuario cambia de modo mientras el sistema está encendido, ese modo se mantiene. Solo se resetea a 'selene' cuando se vuelve a encender después de apagar.

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `ModeSwitcherSleek.tsx` | Import useSystemPower, lógica de interlock, clases disabled |
| `ModeSwitcherSleek.css` | Estilos para `.system-offline` y `.mode-button.disabled` |
| `VibeSelector.tsx` | Import useSystemPower, prop `isSystemOn`, lógica `showActiveState` |
| `controlStore.ts` | Tipo GlobalMode incluye `null`, default inicial `null` |
| `useSystemPower.ts` | Import controlStore, setGlobalMode en powerOn/powerOff |

---

## 🏁 CONCLUSIÓN

La UI ahora refleja fielmente el estado del backend. El principio **"Never Lie to the DJ"** se mantiene: cuando el sistema está apagado, la UI lo muestra claramente. No hay más estados fantasma que confundan al usuario.
